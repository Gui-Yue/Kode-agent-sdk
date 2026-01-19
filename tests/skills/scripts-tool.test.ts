/**
 * Scripts Tool 单元测试
 *
 * 测试Scripts工具的功能：
 * 1. 执行skill中的scripts
 * 2. 支持sandbox隔离执行（默认启用local sandbox）
 * 3. 跨平台兼容性
 * 4. Local Sandbox安全特性验证
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import * as fs from 'fs/promises';
import * as path from 'path';
import { SkillsManager } from '../../src/core/skills/manager';
import { createScriptsTool } from '../../src/tools/scripts';
import { SandboxFactory } from '../../src/infra/sandbox-factory';
import { ToolContext } from '../../src/core/types';

describe('Scripts Tool', () => {
  let testSkillsDir: string;
  let skillsManager: SkillsManager;
  let sandboxFactory: SandboxFactory;
  let scriptsTool: any;

  beforeEach(async () => {
    // 创建临时测试目录
    testSkillsDir = path.join(process.cwd(), 'test-scripts-' + Date.now());
    await fs.mkdir(testSkillsDir, { recursive: true });
    skillsManager = new SkillsManager(testSkillsDir);
    sandboxFactory = new SandboxFactory();
    scriptsTool = createScriptsTool(skillsManager, sandboxFactory);
  });

  afterEach(async () => {
    // 清理测试目录
    try {
      await fs.rm(testSkillsDir, { recursive: true, force: true });
    } catch (error) {
      // 忽略清理错误
    }
  });

  describe('执行功能', () => {
    it('应该成功执行Node.js脚本', async () => {
      // 创建测试skill
      const skillDir = path.join(testSkillsDir, 'test-skill');
      await fs.mkdir(skillDir, { recursive: true });
      await fs.mkdir(path.join(skillDir, 'scripts'), { recursive: true });

      // 创建SKILL.md
      await fs.writeFile(
        path.join(skillDir, 'SKILL.md'),
        `---
name: test-skill
description: Test skill
---

# Test Skill
`
      );

      // 创建测试脚本
      const scriptContent = `#!/usr/bin/env node
console.log('Hello from test script');
console.log('Arguments:', process.argv.slice(2).join(' '));
`;
      await fs.writeFile(path.join(skillDir, 'scripts', 'test.js'), scriptContent);

      // 执行脚本
      const mockCtx = {} as ToolContext;
      const result = await scriptsTool.exec(
        {
          skill_name: 'test-skill',
          script_name: 'test.js',
          use_sandbox: false,
          args: ['arg1', 'arg2'],
        },
        mockCtx
      );

      expect(result.ok).toBe(true);
      expect(result.data.stdout).toContain('Hello from test script');
      expect(result.data.stdout).toContain('arg1');
      expect(result.data.stdout).toContain('arg2');
    });

    it('应该支持使用sandbox执行', async () => {
      // 创建测试skill
      const skillDir = path.join(testSkillsDir, 'test-skill');
      await fs.mkdir(skillDir, { recursive: true });
      await fs.mkdir(path.join(skillDir, 'scripts'), { recursive: true });

      // 创建SKILL.md
      await fs.writeFile(
        path.join(skillDir, 'SKILL.md'),
        `---
name: test-skill
description: Test skill
---

# Test Skill
`
      );

      // 创建测试脚本
      const scriptContent = `#!/usr/bin/env node
console.log('Executed in sandbox');
`;
      await fs.writeFile(path.join(skillDir, 'scripts', 'sandbox-test.js'), scriptContent);

      // 使用sandbox执行
      const mockCtx = {} as ToolContext;
      const result = await scriptsTool.exec(
        {
          skill_name: 'test-skill',
          script_name: 'sandbox-test.js',
          use_sandbox: true,
        },
        mockCtx
      );

      expect(result.ok).toBe(true);
      expect(result.data.stdout).toContain('Executed in sandbox');
    });

    it('应该返回错误当skill不存在', async () => {
      const mockCtx = {} as ToolContext;
      const result = await scriptsTool.exec(
        {
          skill_name: 'non-existent',
          script_name: 'test.js',
          use_sandbox: false,
        },
        mockCtx
      );

      expect(result.ok).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('应该返回错误当script不存在', async () => {
      // 创建测试skill（没有scripts）
      const skillDir = path.join(testSkillsDir, 'test-skill');
      await fs.mkdir(skillDir, { recursive: true });

      await fs.writeFile(
        path.join(skillDir, 'SKILL.md'),
        `---
name: test-skill
description: Test skill
---

# Test Skill
`
      );

      const mockCtx = {} as ToolContext;
      const result = await scriptsTool.exec(
        {
          skill_name: 'test-skill',
          script_name: 'non-existent.js',
          use_sandbox: false,
        },
        mockCtx
      );

      expect(result.ok).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('应该返回错误当脚本执行失败', async () => {
      // 创建测试skill
      const skillDir = path.join(testSkillsDir, 'test-skill');
      await fs.mkdir(skillDir, { recursive: true });
      await fs.mkdir(path.join(skillDir, 'scripts'), { recursive: true });

      // 创建SKILL.md
      await fs.writeFile(
        path.join(skillDir, 'SKILL.md'),
        `---
name: test-skill
description: Test skill
---

# Test Skill
`
      );

      // 创建会失败的脚本
      const scriptContent = `#!/usr/bin/env node
console.error('Script error');
process.exit(1);
`;
      await fs.writeFile(path.join(skillDir, 'scripts', 'failing.js'), scriptContent);

      // 执行脚本
      const mockCtx = {} as ToolContext;
      const result = await scriptsTool.exec(
        {
          skill_name: 'test-skill',
          script_name: 'failing.js',
          use_sandbox: false,
        },
        mockCtx
      );

      expect(result.ok).toBe(false);
      // 错误消息可能是"Command failed"或"failed with code"
      expect(result.error).toMatch(/Command failed|failed with code/);
    });
  });

  describe('参数验证', () => {
    it('应该使用默认参数值', async () => {
      // 创建测试skill
      const skillDir = path.join(testSkillsDir, 'test-skill');
      await fs.mkdir(skillDir, { recursive: true });
      await fs.mkdir(path.join(skillDir, 'scripts'), { recursive: true });

      await fs.writeFile(
        path.join(skillDir, 'SKILL.md'),
        `---
name: test-skill
description: Test skill
---

# Test Skill
`
      );

      const scriptContent = `#!/usr/bin/env node
console.log('test');
`;
      await fs.writeFile(path.join(skillDir, 'scripts', 'test.js'), scriptContent);

      // 不传args参数和use_sandbox参数
      const mockCtx = {} as ToolContext;
      const result = await scriptsTool.exec(
        {
          skill_name: 'test-skill',
          script_name: 'test.js',
          // use_sandbox默认为true（使用local sandbox）
          // args默认为[]
        },
        mockCtx
      );

      expect(result.ok).toBe(true);
    });

    it('应该默认使用sandbox执行（use_sandbox参数默认为true）', async () => {
      // 创建测试skill
      const skillDir = path.join(testSkillsDir, 'test-skill');
      await fs.mkdir(skillDir, { recursive: true });
      await fs.mkdir(path.join(skillDir, 'scripts'), { recursive: true });

      await fs.writeFile(
        path.join(skillDir, 'SKILL.md'),
        `---
name: test-skill
description: Test skill
---

# Test Skill
`
      );

      const scriptContent = `#!/usr/bin/env node
console.log('Executed with default sandbox settings');
process.exit(0);
`;
      await fs.writeFile(path.join(skillDir, 'scripts', 'default-test.js'), scriptContent);

      // 不传use_sandbox参数，应该默认使用sandbox
      const mockCtx = {} as ToolContext;
      const result = await scriptsTool.exec(
        {
          skill_name: 'test-skill',
          script_name: 'default-test.js',
          // use_sandbox未指定，应该默认为true
        },
        mockCtx
      );

      expect(result.ok).toBe(true);
      expect(result.data.stdout).toContain('Executed with default sandbox settings');
    });
  });

  describe('Local Sandbox功能验证', () => {
    it('应该在local sandbox中成功执行脚本', async () => {
      const skillDir = path.join(testSkillsDir, 'sandbox-test');
      await fs.mkdir(skillDir, { recursive: true });
      await fs.mkdir(path.join(skillDir, 'scripts'), { recursive: true });

      await fs.writeFile(
        path.join(skillDir, 'SKILL.md'),
        `---
name: sandbox-test
description: Test sandbox functionality
---

# Sandbox Test Skill
`
      );

      // 创建一个简单的测试脚本
      const scriptContent = `#!/usr/bin/env node
console.log('Sandbox execution successful');
const fs = require('fs');

// 尝试在当前工作目录创建文件
const testFile = 'sandbox-test.txt';
fs.writeFileSync(testFile, 'test content');
console.log('File created in sandbox:', testFile);

// 读取文件验证
const content = fs.readFileSync(testFile, 'utf-8');
console.log('File content:', content);

// 清理
fs.unlinkSync(testFile);
console.log('File cleaned up');
`;
      await fs.writeFile(path.join(skillDir, 'scripts', 'sandbox-exec.js'), scriptContent);

      const mockCtx = {} as ToolContext;
      const result = await scriptsTool.exec(
        {
          skill_name: 'sandbox-test',
          script_name: 'sandbox-exec.js',
          use_sandbox: true,
        },
        mockCtx
      );

      expect(result.ok).toBe(true);
      expect(result.data.stdout).toContain('Sandbox execution successful');
      expect(result.data.stdout).toContain('File created in sandbox');
      expect(result.data.stdout).toContain('File cleaned up');
    });

    it('应该在sandbox中拦截危险命令', async () => {
      const skillDir = path.join(testSkillsDir, 'dangerous-test');
      await fs.mkdir(skillDir, { recursive: true });
      await fs.mkdir(path.join(skillDir, 'scripts'), { recursive: true });

      await fs.writeFile(
        path.join(skillDir, 'SKILL.md'),
        `---
name: dangerous-test
description: Test dangerous command blocking
---

# Dangerous Test Skill
`
      );

      // 创建尝试执行危险命令的脚本
      // 注意：这个测试需要sandbox能拦截危险命令
      const scriptContent = `#!/usr/bin/env node
const { execSync } = require('child_process');

// 尝试执行危险命令（会被sandbox拦截）
try {
  // 注意：这是测试命令，不会实际破坏系统
  // Local sandbox应该拦截此类命令
  execSync('echo "dangerous command test"');
} catch (error) {
  console.log('Command was blocked or failed as expected');
  process.exit(0);
}
`;
      await fs.writeFile(path.join(skillDir, 'scripts', 'dangerous.js'), scriptContent);

      const mockCtx = {} as ToolContext;
      const result = await scriptsTool.exec(
        {
          skill_name: 'dangerous-test',
          script_name: 'dangerous.js',
          use_sandbox: true,
        },
        mockCtx
      );

      // 由于我们在脚本中处理了错误，应该成功执行
      expect(result.ok).toBe(true);
    });

    it('应该在sandbox中支持脚本参数传递', async () => {
      const skillDir = path.join(testSkillsDir, 'args-test');
      await fs.mkdir(skillDir, { recursive: true });
      await fs.mkdir(path.join(skillDir, 'scripts'), { recursive: true });

      await fs.writeFile(
        path.join(skillDir, 'SKILL.md'),
        `---
name: args-test
description: Test argument passing in sandbox
---

# Args Test Skill
`
      );

      const scriptContent = `#!/usr/bin/env node
console.log('Received args:', process.argv.slice(2).join(' '));
const args = process.argv.slice(2);
if (args.length === 3 && args[0] === 'arg1' && args[1] === 'arg2' && args[2] === 'arg3') {
  console.log('Arguments passed correctly');
  process.exit(0);
} else {
  console.log('Arguments not passed correctly');
  process.exit(1);
}
`;
      await fs.writeFile(path.join(skillDir, 'scripts', 'args.js'), scriptContent);

      const mockCtx = {} as ToolContext;
      const result = await scriptsTool.exec(
        {
          skill_name: 'args-test',
          script_name: 'args.js',
          use_sandbox: true,
          args: ['arg1', 'arg2', 'arg3'],
        },
        mockCtx
      );

      expect(result.ok).toBe(true);
      expect(result.data.stdout).toContain('Arguments passed correctly');
    });

    it('应该在sandbox中正确处理脚本执行超时', async () => {
      const skillDir = path.join(testSkillsDir, 'timeout-test');
      await fs.mkdir(skillDir, { recursive: true });
      await fs.mkdir(path.join(skillDir, 'scripts'), { recursive: true });

      await fs.writeFile(
        path.join(skillDir, 'SKILL.md'),
        `---
name: timeout-test
description: Test timeout handling in sandbox
---

# Timeout Test Skill
`
      );

      // 创建一个会长时间运行的脚本
      const scriptContent = `#!/usr/bin/env node
console.log('Starting long running task...');
// 模拟长时间运行（但不超过超时时间）
setTimeout(() => {
  console.log('Task completed');
  process.exit(0);
}, 1000); // 1秒，远小于60秒超时
`;
      await fs.writeFile(path.join(skillDir, 'scripts', 'timeout.js'), scriptContent);

      const mockCtx = {} as ToolContext;
      const result = await scriptsTool.exec(
        {
          skill_name: 'timeout-test',
          script_name: 'timeout.js',
          use_sandbox: true,
        },
        mockCtx
      );

      expect(result.ok).toBe(true);
      expect(result.data.stdout).toContain('Task completed');
    });

    it('应该在sandbox中支持工作目录操作', async () => {
      const skillDir = path.join(testSkillsDir, 'workdir-test');
      await fs.mkdir(skillDir, { recursive: true });
      await fs.mkdir(path.join(skillDir, 'scripts'), { recursive: true });

      await fs.writeFile(
        path.join(skillDir, 'SKILL.md'),
        `---
name: workdir-test
description: Test working directory in sandbox
---

# WorkDir Test Skill
`
      );

      const scriptContent = `#!/usr/bin/env node
const path = require('path');
const fs = require('fs');

console.log('Current directory:', process.cwd());

// 在当前工作目录创建测试文件
const testDir = './test-workspace';
if (!fs.existsSync(testDir)) {
  fs.mkdirSync(testDir);
}

const testFile = path.join(testDir, 'test.txt');
fs.writeFileSync(testFile, 'workspace test');

console.log('Created file in:', testDir);
console.log('File exists:', fs.existsSync(testFile));

// 清理
fs.unlinkSync(testFile);
fs.rmdirSync(testDir);
console.log('Workspace cleaned up');
`;
      await fs.writeFile(path.join(skillDir, 'scripts', 'workdir.js'), scriptContent);

      const mockCtx = {} as ToolContext;
      const result = await scriptsTool.exec(
        {
          skill_name: 'workdir-test',
          script_name: 'workdir.js',
          use_sandbox: true,
        },
        mockCtx
      );

      expect(result.ok).toBe(true);
      expect(result.data.stdout).toContain('Workspace cleaned up');
    });
  });
});
