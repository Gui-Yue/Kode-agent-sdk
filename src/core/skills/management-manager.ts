/**
 * 技能管理器模块（路径1 - 技能管理）
 *
 * 设计原则 (UNIX哲学):
 * - 简洁: 只负责技能文件系统的CRUD操作
 * - 模块化: 协调OperationQueue、SandboxFileManager进行文件系统操作
 * - 隔离: 与Agent运行时完全隔离，不参与Agent使用
 *
 * ⚠️ 重要说明:
 * - 此模块专门用于路径1（技能管理）
 * - 与路径2（Agent运行时）完全独立
 * - 请勿与SkillsManager混淆
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import { SkillsManager } from './manager';
import { OperationQueue, OperationType, OperationTask } from './operation-queue';
import { SandboxFileManager } from './sandbox-file-manager';
import type {
  SkillInfo,
  SkillDetail,
  SkillFileTree,
  CreateSkillOptions,
  ArchivedSkillInfo,
} from './types';
import { SandboxFactory } from '../../infra/sandbox-factory';
import { logger } from '../../utils/logger';

/**
 * 技能管理器类
 *
 * 职责:
 * - 提供所有技能管理操作的统一接口（CRUD操作）
 * - 协调OperationQueue、SandboxFileManager进行文件系统操作
 * - 处理业务逻辑和权限验证
 * - ❌ 不参与Agent运行时
 * - ❌ 不提供技能加载、扫描等Agent使用的功能
 */
export class SkillsManagementManager {
  private skillsManager: SkillsManager;
  private operationQueue: OperationQueue;
  private sandboxFileManager: SandboxFileManager;
  private skillsDir: string;
  private archivedDir: string;  // 归档目录：skills/.archived/

  constructor(
    skillsDir: string,
    sandboxFactory?: SandboxFactory,
    archivedDir?: string  // 可选，默认为 skills/.archived/
  ) {
    this.skillsDir = path.resolve(skillsDir);
    this.archivedDir = archivedDir ? path.resolve(archivedDir) : path.join(this.skillsDir, '.archived');
    this.skillsManager = new SkillsManager(this.skillsDir);
    this.operationQueue = new OperationQueue();
    this.sandboxFileManager = new SandboxFileManager(
      sandboxFactory || new SandboxFactory()
    );

    logger.log(`[SkillsManagementManager] Initialized with skills directory: ${this.skillsDir}`);
    logger.log(`[SkillsManagementManager] Archived directory: ${this.archivedDir}`);
  }

  /**
   * 获取所有在线技能列表（不包含archived技能）
   */
  async listSkills(): Promise<SkillInfo[]> {
    // 扫描所有技能
    const allSkills = await this.skillsManager.getSkillsMetadata();

    // 过滤掉archived技能（排除.archived目录）
    const onlineSkills = allSkills.filter((skill) => {
      return !skill.baseDir.includes('/.archived/') &&
             !skill.baseDir.includes('\\.archived\\');
    });

    // 添加文件统计信息
    const skillsWithInfo: SkillInfo[] = [];
    for (const skill of onlineSkills) {
      const stat = await this.safeGetFileStat(skill.path);
      skillsWithInfo.push({
        ...skill,
        createdAt: stat?.birthtime?.toISOString(),
        updatedAt: stat?.mtime?.toISOString(),
      });
    }

    return skillsWithInfo;
  }

  /**
   * 获取单个在线技能详细信息
   * @param skillName 技能名称
   */
  async getSkillInfo(skillName: string): Promise<SkillDetail | null> {
    // 检查技能是否在线（不在archived中）
    const skill = await this.skillsManager.loadSkillContent(skillName);
    if (!skill) {
      return null;
    }

    // 验证技能不是archived（排除.archived目录）
    if (skill.metadata.baseDir.includes('/.archived/') ||
        skill.metadata.baseDir.includes('\\.archived\\')) {
      throw new Error(`Cannot get info for archived skill: ${skillName}`);
    }

    // 获取文件树
    const files = await this.getSkillFileTree(skillName);

    // 获取文件统计信息
    const stat = await this.safeGetFileStat(skill.metadata.path);

    return {
      name: skill.metadata.name,
      description: skill.metadata.description,
      path: skill.metadata.path,
      baseDir: skill.metadata.baseDir,
      createdAt: stat?.birthtime?.toISOString(),
      updatedAt: stat?.mtime?.toISOString(),
      files,
      references: skill.references,
      scripts: skill.scripts,
      assets: skill.assets,
    };
  }

  /**
   * 获取已归档技能列表（只读，不支持修改）
   */
  async listArchivedSkills(): Promise<ArchivedSkillInfo[]> {
    // 使用配置的归档目录
    const archivedDir = this.archivedDir;

    // 检查archived目录是否存在
    const exists = await this.fileExists(archivedDir);
    if (!exists) {
      return [];
    }

    try {
      // 读取archived目录
      const entries = await fs.readdir(archivedDir, { withFileTypes: true });

      const archivedSkills: ArchivedSkillInfo[] = [];
      for (const entry of entries) {
        if (!entry.isDirectory()) {
          continue;
        }

        const archivedPath = path.join(archivedDir, entry.name);

        // 检查是否包含SKILL.md
        const skillMdPath = path.join(archivedPath, 'SKILL.md');
        if (!(await this.fileExists(skillMdPath))) {
          continue;
        }

        // 提取原始名称和归档时间（支持带毫秒和不带毫秒两种格式）
        const match = entry.name.match(/^(.+?)_(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}(?:-\d{3})?Z)$/);
        if (!match) {
          continue;
        }

        const originalName = match[1];

        // 解析时间戳（支持带毫秒和不带毫秒两种格式）
        // 格式1: 2026-01-15T05-05-01-350Z (带毫秒)
        // 格式2: 2026-01-15T05-05-01Z (不带毫秒)
        const timestampMatch = match[2].match(/^(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})(?:-(\d{3}))?Z$/);
        if (!timestampMatch) {
          continue;
        }
        const [, date, hour, min, sec, ms] = timestampMatch;
        const isoTimestamp = ms
          ? `${date}T${hour}:${min}:${sec}.${ms}Z`
          : `${date}T${hour}:${min}:${sec}Z`;
        const archivedAt = new Date(isoTimestamp).toISOString();

        // 获取文件统计信息
        const stat = await this.safeGetFileStat(archivedPath);

        archivedSkills.push({
          originalName,
          archivedName: entry.name,
          archivedPath,
          archivedAt: stat?.mtime?.toISOString() || archivedAt,
        });
      }

      return archivedSkills.sort((a, b) =>
        b.archivedAt.localeCompare(a.archivedAt)
      );
    } catch (error: any) {
      logger.error('[SkillsManagementManager] Error listing archived skills:', error);
      return [];
    }
  }

  /**
   * 创建新技能
   * @param skillName 技能名称
   * @param options 技能配置（名称、描述等）
   */
  async createSkill(
    skillName: string,
    options: CreateSkillOptions
  ): Promise<SkillDetail> {
    // 包装为操作任务
    const task: OperationTask = {
      id: crypto.randomUUID(),
      type: OperationType.CREATE,
      targetSkill: skillName,
      status: 'pending' as any,
      execute: async () => {
        await this.doCreateSkill(skillName, options);
      },
      createdAt: new Date(),
    };

    // 入队并等待完成
    await this.operationQueue.enqueue(task);
    await this.waitForTask(task);

    // 检查是否有错误
    if (task.error) {
      throw task.error;
    }

    // 返回创建的技能详细信息
    const skillDetail = await this.getSkillInfo(skillName);
    if (!skillDetail) {
      throw new Error(`Failed to get skill info after creation: ${skillName}`);
    }
    return skillDetail;
  }

  /**
   * 重命名技能
   * @param oldName 旧技能名称
   * @param newName 新技能名称
   */
  async renameSkill(oldName: string, newName: string): Promise<void> {
    // 包装为操作任务
    const task: OperationTask = {
      id: crypto.randomUUID(),
      type: OperationType.RENAME,
      targetSkill: `${oldName} -> ${newName}`,
      status: 'pending' as any,
      execute: async () => {
        await this.doRenameSkill(oldName, newName);
      },
      createdAt: new Date(),
    };

    // 入队并等待完成
    await this.operationQueue.enqueue(task);
    await this.waitForTask(task);

    // 检查是否有错误
    if (task.error) {
      throw task.error;
    }
  }

  /**
   * 编辑技能文件
   * @param skillName 技能名称
   * @param filePath 文件路径（相对于技能根目录，如"SKILL.md"）
   * @param content 文件内容
   * @param useSandbox 是否使用sandbox（默认true）
   */
  async editSkillFile(
    skillName: string,
    filePath: string,
    content: string,
    useSandbox: boolean = true
  ): Promise<void> {
    // 包装为操作任务
    const task: OperationTask = {
      id: crypto.randomUUID(),
      type: OperationType.EDIT,
      targetSkill: skillName,
      status: 'pending' as any,
      execute: async () => {
        await this.doEditSkillFile(skillName, filePath, content, useSandbox);
      },
      createdAt: new Date(),
    };

    // 入队并等待完成
    await this.operationQueue.enqueue(task);
    await this.waitForTask(task);

    // 检查是否有错误
    if (task.error) {
      throw task.error;
    }
  }

  /**
   * 删除技能（移动到archived）
   * @param skillName 技能名称
   */
  async deleteSkill(skillName: string): Promise<void> {
    // 包装为操作任务
    const task: OperationTask = {
      id: crypto.randomUUID(),
      type: OperationType.DELETE,
      targetSkill: skillName,
      status: 'pending' as any,
      execute: async () => {
        await this.doDeleteSkill(skillName);
      },
      createdAt: new Date(),
    };

    // 入队并等待完成
    await this.operationQueue.enqueue(task);
    await this.waitForTask(task);

    // 检查是否有错误
    if (task.error) {
      throw task.error;
    }
  }

  /**
   * 恢复已删除的技能
   * @param archivedSkillName archived中的技能名称（含时间戳）
   */
  async restoreSkill(archivedSkillName: string): Promise<void> {
    // 包装为操作任务
    const task: OperationTask = {
      id: crypto.randomUUID(),
      type: OperationType.RESTORE,
      targetSkill: archivedSkillName,
      status: 'pending' as any,
      execute: async () => {
        await this.doRestoreSkill(archivedSkillName);
      },
      createdAt: new Date(),
    };

    // 入队并等待完成
    await this.operationQueue.enqueue(task);
    await this.waitForTask(task);

    // 检查是否有错误
    if (task.error) {
      throw task.error;
    }
  }

  /**
   * 获取技能文件树（仅在线技能）
   * @param skillName 技能名称
   */
  async getSkillFileTree(skillName: string): Promise<SkillFileTree> {
    // 获取技能信息
    const skill = await this.skillsManager.loadSkillContent(skillName);
    if (!skill) {
      throw new Error(`Skill not found: ${skillName}`);
    }

    // 验证技能不是archived（排除.archived目录）
    if (skill.metadata.baseDir.includes('/.archived/') ||
        skill.metadata.baseDir.includes('\\.archived\\')) {
      throw new Error(`Cannot get file tree for archived skill: ${skillName}`);
    }

    // 使用SandboxFileManager获取文件树
    return await this.sandboxFileManager.listFiles(
      skill.metadata.baseDir,
      '.'
    );
  }

  /**
   * 获取队列状态
   */
  getQueueStatus() {
    return this.operationQueue.getQueueStatus();
  }

  // ==================== 私有方法 ====================

  /**
   * 执行创建技能
   */
  private async doCreateSkill(
    skillName: string,
    options: CreateSkillOptions
  ): Promise<void> {
    // 1. 验证技能名称
    if (!this.isValidSkillName(skillName)) {
      throw new Error(`Invalid skill name: ${skillName}`);
    }

    // 优先检查archived技能是否已存在（因为 SkillsManager 也会扫描 .archived 目录）
    const archivedSkills = await this.listArchivedSkills();
    const archivedSkill = archivedSkills.find(s => s.originalName === skillName);
    if (archivedSkill) {
      throw new Error(
        `Archived skill with name '${skillName}' already exists. Please restore or permanently delete it first.`
      );
    }

    // 检查在线技能是否已存在（排除 .archived 目录中的技能）
    const existingSkill = await this.skillsManager.loadSkillContent(skillName);
    if (existingSkill) {
      // 二次验证：确保技能不在 .archived 目录中
      if (existingSkill.metadata.baseDir.includes('/.archived/') ||
          existingSkill.metadata.baseDir.includes('\\.archived\\')) {
        throw new Error(
          `Archived skill with name '${skillName}' already exists. Please restore or permanently delete it first.`
        );
      }
      throw new Error(`Skill already exists: ${skillName}`);
    }

    // 2. 创建目录结构
    const skillDir = path.join(this.skillsDir, skillName);
    await fs.mkdir(skillDir, { recursive: true });
    await fs.mkdir(path.join(skillDir, 'references'));
    await fs.mkdir(path.join(skillDir, 'scripts'));
    await fs.mkdir(path.join(skillDir, 'assets'));

    // 3. 生成SKILL.md
    const skillMdContent = this.generateSkillMd(options);
    await fs.writeFile(path.join(skillDir, 'SKILL.md'), skillMdContent, 'utf-8');

    logger.log(`[SkillsManagementManager] Skill created: ${skillName}`);
  }

  /**
   * 执行重命名技能
   */
  private async doRenameSkill(oldName: string, newName: string): Promise<void> {
    // 1. 验证旧技能存在
    const oldSkill = await this.skillsManager.loadSkillContent(oldName);
    if (!oldSkill) {
      throw new Error(`Skill not found: ${oldName}`);
    }

    // 2. 验证新名称
    if (!this.isValidSkillName(newName)) {
      throw new Error(`Invalid skill name: ${newName}`);
    }

    const newSkill = await this.skillsManager.loadSkillContent(newName);
    if (newSkill) {
      throw new Error(`Skill already exists: ${newName}`);
    }

    // 3. 重命名目录
    const oldPath = path.join(this.skillsDir, oldName);
    const newPath = path.join(this.skillsDir, newName);
    await fs.rename(oldPath, newPath);

    // 4. 更新SKILL.md中的name字段
    const skillMdPath = path.join(newPath, 'SKILL.md');
    let content = await fs.readFile(skillMdPath, 'utf-8');
    content = content.replace(/^name:\s*.+$/m, `name: ${newName}`);
    await fs.writeFile(skillMdPath, content, 'utf-8');

    logger.log(`[SkillsManagementManager] Skill renamed: ${oldName} -> ${newName}`);
  }

  /**
   * 执行编辑技能文件
   */
  private async doEditSkillFile(
    skillName: string,
    filePath: string,
    content: string,
    useSandbox: boolean
  ): Promise<void> {
    // 1. 获取技能信息
    const skill = await this.skillsManager.loadSkillContent(skillName);
    if (!skill) {
      throw new Error(`Skill not found: ${skillName}`);
    }

    // 1.1 验证技能是否为archived（不支持编辑.archived中的技能）
    if (skill.metadata.baseDir.includes('/.archived/') ||
        skill.metadata.baseDir.includes('\\.archived\\')) {
      throw new Error(
        `Cannot edit archived skill: ${skillName}. Please restore it first.`
      );
    }

    // 2. 验证文件路径（防止路径穿越）
    const normalizedPath = path.normalize(filePath);
    if (normalizedPath.startsWith('..') || path.isAbsolute(normalizedPath)) {
      throw new Error(`Invalid file path: ${filePath}`);
    }

    // 3. 写入文件
    if (useSandbox) {
      // 使用sandbox写入（安全）
      await this.sandboxFileManager.writeFile(
        skill.metadata.baseDir,
        normalizedPath,
        content
      );
    } else {
      // 直接写入（不推荐）
      const fullPath = path.join(skill.metadata.baseDir, normalizedPath);
      await fs.writeFile(fullPath, content, 'utf-8');
    }

    logger.log(`[SkillsManagementManager] File edited: ${skillName}/${filePath}`);
  }

  /**
   * 执行删除技能
   */
  private async doDeleteSkill(skillName: string): Promise<void> {
    // 1. 验证技能存在
    const skill = await this.skillsManager.loadSkillContent(skillName);
    if (!skill) {
      throw new Error(`Skill not found: ${skillName}`);
    }

    // 2. 确保archived目录存在（使用配置的归档目录）
    const archivedDir = this.archivedDir;
    await fs.mkdir(archivedDir, { recursive: true });

    // 3. 生成归档名称
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const archivedName = `${skillName}_${timestamp}`;
    const archivedPath = path.join(archivedDir, archivedName);

    // 4. 移动到archived
    await fs.rename(skill.metadata.baseDir, archivedPath);

    logger.log(`[SkillsManagementManager] Skill archived: ${skillName} -> ${archivedName}`);
  }

  /**
   * 执行恢复技能
   */
  private async doRestoreSkill(archivedSkillName: string): Promise<void> {
    // 1. 查找archived技能（使用配置的归档目录）
    const archivedDir = this.archivedDir;
    const archivedPath = path.join(archivedDir, archivedSkillName);

    const exists = await this.fileExists(archivedPath);
    if (!exists) {
      throw new Error(`Archived skill not found: ${archivedSkillName}`);
    }

    // 2. 提取原始名称（去掉时间戳后缀，支持带毫秒和不带毫秒两种格式）
    const originalName = archivedSkillName.replace(
      /_\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}(?:-\d{3})?Z$/,
      ''
    );

    // 3. 检查目标位置是否已存在
    const targetPath = path.join(this.skillsDir, originalName);
    if (await this.fileExists(targetPath)) {
      throw new Error(`Skill already exists: ${originalName}`);
    }

    // 4. 移回skills目录
    await fs.rename(archivedPath, targetPath);

    logger.log(`[SkillsManagementManager] Skill restored: ${archivedSkillName} -> ${originalName}`);
  }

  /**
   * 验证技能名称
   */
  private isValidSkillName(name: string): boolean {
    // 只允许字母、数字、连字符、下划线
    return /^[a-zA-Z0-9_-]+$/.test(name) && name.length > 0 && name.length <= 50;
  }

  /**
   * 生成SKILL.md内容
   */
  private generateSkillMd(options: CreateSkillOptions): string {
    const { name, description = '' } = options;

    return `---
name: ${name}
description: ${description}
---

# ${name}

This is a custom skill created for ${name}.

## Usage

Describe how to use this skill here.

## Configuration

Add any configuration details here.
`;
  }

  /**
   * 检查文件是否存在
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 安全获取文件统计信息
   */
  private async safeGetFileStat(filePath: string): Promise<import('fs').Stats | null> {
    try {
      return await fs.stat(filePath);
    } catch {
      return null;
    }
  }

  /**
   * 等待任务完成
   */
  private async waitForTask(task: OperationTask): Promise<void> {
    // 轮询任务状态，最多等待30秒
    const maxWaitTime = 30000;
    const pollInterval = 100;
    let totalWaited = 0;

    while (
      task.status !== 'completed' &&
      task.status !== 'failed' &&
      totalWaited < maxWaitTime
    ) {
      await new Promise(resolve => setTimeout(resolve, pollInterval));
      totalWaited += pollInterval;
    }

    if (task.status !== 'completed' && task.status !== 'failed') {
      throw new Error(`Operation timeout: ${task.type} - ${task.targetSkill}`);
    }
  }
}
