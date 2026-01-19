/**
 * SandboxFileManager 单元测试
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { SandboxFileManager } from '../../../../src/core/skills/sandbox-file-manager';
import { SandboxFactory } from '../../../../src/infra/sandbox-factory';
import { TestRunner, expect } from '../../../helpers/utils';
import { TEST_ROOT } from '../../../helpers/fixtures';

const runner = new TestRunner('SandboxFileManager');

let testDir: string;
let fileManager: SandboxFileManager;

runner.beforeAll(async () => {
  // 创建临时测试目录
  testDir = path.join(TEST_ROOT, 'sandbox-file-manager');
  await fs.mkdir(testDir, { recursive: true });

  // 创建SandboxFileManager实例
  fileManager = new SandboxFileManager(new SandboxFactory());
});

runner.afterAll(async () => {
  // 清理测试目录
  await fs.rm(testDir, { recursive: true, force: true });
});

runner.beforeEach(async () => {
  // 每个测试前清理测试目录
  await fs.rm(testDir, { recursive: true, force: true });
  await fs.mkdir(testDir, { recursive: true });
});

runner
  .test('读取文件内容', async () => {
    const testFile = path.join(testDir, 'test.txt');
    const testContent = 'Hello, Sandbox!';

    // 直接创建测试文件
    await fs.writeFile(testFile, testContent, 'utf-8');

    // 使用SandboxFileManager读取
    const content = await fileManager.readFile(testDir, 'test.txt');

    expect.toEqual(content, testContent);
  })

  .test('写入文件内容', async () => {
    const testContent = 'Write test content';

    // 使用SandboxFileManager写入
    await fileManager.writeFile(testDir, 'output.txt', testContent);

    // 验证文件已创建并包含正确内容
    const filePath = path.join(testDir, 'output.txt');
    const exists = await fs.access(filePath).then(() => true).catch(() => false);
    expect.toBeTruthy(exists);

    const content = await fs.readFile(filePath, 'utf-8');
    expect.toEqual(content, testContent);
  })

  .test('写入文件自动创建目录', async () => {
    const testContent = 'Nested file content';

    // 写入到不存在的子目录
    await fileManager.writeFile(testDir, 'subdir/nested/file.txt', testContent);

    // 验证文件已创建
    const filePath = path.join(testDir, 'subdir', 'nested', 'file.txt');
    const exists = await fs.access(filePath).then(() => true).catch(() => false);
    expect.toBeTruthy(exists);

    const content = await fs.readFile(filePath, 'utf-8');
    expect.toEqual(content, testContent);
  })

  .test('列出目录文件', async () => {
    // 创建测试文件结构
    await fs.mkdir(path.join(testDir, 'dir1'), { recursive: true });
    await fs.mkdir(path.join(testDir, 'dir2'), { recursive: true });
    await fs.writeFile(path.join(testDir, 'file1.txt'), 'content1');
    await fs.writeFile(path.join(testDir, 'file2.md'), 'content2');
    await fs.writeFile(path.join(testDir, 'dir1', 'nested.txt'), 'nested');

    // 列出文件
    const fileTree = await fileManager.listFiles(testDir, '.');

    expect.toEqual(fileTree.name, '.');
    expect.toEqual(fileTree.type, 'dir');
    expect.toBeTruthy(fileTree.children);
    expect.toEqual(fileTree.children!.length, 4); // dir1, dir2, file1.txt, file2.md
  })

  .test('边界控制 - 拒绝访问父目录', async () => {
    let errorThrown = false;
    try {
      // 尝试读取父目录的文件
      await fileManager.readFile(testDir, '../parent-file.txt');
    } catch (error: any) {
      errorThrown = true;
      expect.toContain(error.message.toLowerCase(), 'outside');
    }

    expect.toBeTruthy(errorThrown, 'Should throw error for path outside sandbox');
  })

  .test('边界控制 - 拒绝绝对路径', async () => {
    let errorThrown = false;
    try {
      // 尝试使用绝对路径
      await fileManager.readFile(testDir, '/etc/passwd');
    } catch (error: any) {
      errorThrown = true;
      expect.toContain(error.message.toLowerCase(), 'outside');
    }

    expect.toBeTruthy(errorThrown, 'Should throw error for absolute path');
  })

  .test('删除文件', async () => {
    // 创建测试文件
    const testFile = path.join(testDir, 'to-delete.txt');
    await fs.writeFile(testFile, 'delete me');

    // 验证文件存在
    let exists = await fs.access(testFile).then(() => true).catch(() => false);
    expect.toBeTruthy(exists);

    // 使用SandboxFileManager删除
    await fileManager.deleteFile(testDir, 'to-delete.txt');

    // 验证文件已删除
    exists = await fs.access(testFile).then(() => true).catch(() => false);
    expect.toBeFalsy(exists);
  })

  .test('创建目录', async () => {
    // 创建目录
    await fileManager.createDir(testDir, 'new-dir/nested');

    // 验证目录已创建
    const dirPath = path.join(testDir, 'new-dir', 'nested');
    const exists = await fs.access(dirPath).then(() => true).catch(() => false);
    expect.toBeTruthy(exists);
  })
  .test('文件树结构正确', async () => {
    // 创建测试文件结构
    await fs.mkdir(path.join(testDir, 'references'), { recursive: true });
    await fs.mkdir(path.join(testDir, 'scripts'), { recursive: true });
    await fs.mkdir(path.join(testDir, 'assets'), { recursive: true });
    await fs.writeFile(path.join(testDir, 'SKILL.md'), '# Test Skill');
    await fs.writeFile(path.join(testDir, 'references', 'ref1.txt'), 'ref1');
    await fs.writeFile(path.join(testDir, 'scripts', 'script1.sh'), '#!/bin/bash');

    // 获取文件树
    const fileTree = await fileManager.listFiles(testDir, '.');

    expect.toEqual(fileTree.name, '.');
    expect.toEqual(fileTree.type, 'dir');

    // 验证子节点
    expect.toBeTruthy(fileTree.children);

    // 应该包含 SKILL.md, references, scripts, assets
    const names = fileTree.children!.map(c => c.name);
    expect.toContain(names, 'SKILL.md');
    expect.toContain(names, 'references');
    expect.toContain(names, 'scripts');
    expect.toContain(names, 'assets');
  });

export async function run() {
  return runner.run();
}

if (require.main === module) {
  run().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}
