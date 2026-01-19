/**
 * Skills Tool 单元测试
 *
 * 测试Skills工具的功能：
 * 1. 列出所有skills
 * 2. 加载特定skill内容
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import * as fs from 'fs/promises';
import * as path from 'path';
import { SkillsManager } from '../../src/core/skills/manager';
import { createSkillsTool } from '../../src/tools/skills';
import { ToolContext } from '../../src/core/types';

describe('Skills Tool', () => {
  let testSkillsDir: string;
  let skillsManager: SkillsManager;
  let skillsTool: any;

  beforeEach(async () => {
    // 创建临时测试目录
    testSkillsDir = path.join(process.cwd(), 'test-skills-tool-' + Date.now());
    await fs.mkdir(testSkillsDir, { recursive: true });
    skillsManager = new SkillsManager(testSkillsDir);
    skillsTool = createSkillsTool(skillsManager);
  });

  afterEach(async () => {
    // 清理测试目录
    try {
      await fs.rm(testSkillsDir, { recursive: true, force: true });
    } catch (error) {
      // 忽略清理错误
    }
  });

  describe('list action', () => {
    it('应该列出所有可用的skills', async () => {
      // 创建测试skills
      const skill1Dir = path.join(testSkillsDir, 'skill1');
      const skill2Dir = path.join(testSkillsDir, 'skill2');
      await fs.mkdir(skill1Dir, { recursive: true });
      await fs.mkdir(skill2Dir, { recursive: true });

      await fs.writeFile(
        path.join(skill1Dir, 'SKILL.md'),
        `---
name: skill1
description: First skill
---

# Skill 1
`
      );

      await fs.writeFile(
        path.join(skill2Dir, 'SKILL.md'),
        `---
name: skill2
description: Second skill
---

# Skill 2
`
      );

      // 执行工具
      const mockCtx = {} as ToolContext;
      const result = await skillsTool.exec({ action: 'list' }, mockCtx);

      expect(result.ok).toBe(true);
      expect(result.data.count).toBe(2);
      expect(result.data.skills).toHaveLength(2);
      expect(result.data.skills[0].name).toBe('skill1');
      expect(result.data.skills[1].name).toBe('skill2');
    });

    it('应该返回空列表当没有skills时', async () => {
      const mockCtx = {} as ToolContext;
      const result = await skillsTool.exec({ action: 'list' }, mockCtx);

      expect(result.ok).toBe(true);
      expect(result.data.count).toBe(0);
      expect(result.data.skills).toEqual([]);
    });
  });

  describe('load action', () => {
    it('应该加载特定skill的完整内容', async () => {
      // 创建测试skill
      const skillDir = path.join(testSkillsDir, 'test-skill');
      await fs.mkdir(skillDir, { recursive: true });

      const skillContent = `---
name: test-skill
description: Test skill description
---

# Test Skill

This is the content of the test skill.
`;
      await fs.writeFile(path.join(skillDir, 'SKILL.md'), skillContent);

      // 创建子目录和文件
      await fs.mkdir(path.join(skillDir, 'scripts'), { recursive: true });
      await fs.writeFile(path.join(skillDir, 'scripts', 'test.js'), 'console.log("test");');

      // 执行工具
      const mockCtx = {} as ToolContext;
      const result = await skillsTool.exec({ action: 'load', skill_name: 'test-skill' }, mockCtx);

      expect(result.ok).toBe(true);
      expect(result.data.name).toBe('test-skill');
      expect(result.data.description).toBe('Test skill description');
      expect(result.data.content).toContain('This is the content of the test skill.');
      expect(result.data.scripts).toHaveLength(1);
    });

    it('应该返回错误当skill不存在', async () => {
      const mockCtx = {} as ToolContext;
      const result = await skillsTool.exec({ action: 'load', skill_name: 'non-existent' }, mockCtx);

      expect(result.ok).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('应该返回错误当缺少skill_name参数', async () => {
      const mockCtx = {} as ToolContext;
      const result = await skillsTool.exec({ action: 'load' }, mockCtx);

      expect(result.ok).toBe(false);
      expect(result.error).toContain('skill_name is required');
    });
  });

  describe('无效action', () => {
    it('应该返回错误当action无效', async () => {
      const mockCtx = {} as ToolContext;
      const result = await skillsTool.exec({ action: 'invalid' }, mockCtx);

      expect(result.ok).toBe(false);
      // Zod验证会返回详细的参数错误信息
      expect(result.error).toContain('Invalid option');
    });
  });
});
