/**
 * Skills Tool 功能验证脚本
 *
 * 验证SkillsTool和ScriptsTool的基本功能
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { SkillsManager } from '../../src/core/skills/manager';
import { createSkillsTool } from '../../src/tools/skills';
import { createScriptsTool } from '../../src/tools/scripts';
import { SandboxFactory } from '../../src/infra/sandbox-factory';

async function main() {
  console.log('=== Skills Tool 功能验证 ===\n');

  const testSkillsDir = path.join(process.cwd(), 'test-skills-tool-' + Date.now());

  try {
    // 创建测试skill
    await fs.mkdir(testSkillsDir, { recursive: true });
    const skillDir = path.join(testSkillsDir, 'example-skill');
    await fs.mkdir(skillDir, { recursive: true });
    await fs.mkdir(path.join(skillDir, 'scripts'), { recursive: true });

    // 创建SKILL.md
    const skillContent = `---
name: example-skill
description: 示例技能
---

# Example Skill

这是一个示例skill。
`;
    await fs.writeFile(path.join(skillDir, 'SKILL.md'), skillContent);

    // 创建测试脚本
    const scriptContent = `#!/usr/bin/env node
console.log('Hello from example skill!');
console.log('Arguments:', process.argv.slice(2).join(' '));
`;
    await fs.writeFile(path.join(skillDir, 'scripts', 'hello.js'), scriptContent);

    // 初始化manager和tools
    const skillsManager = new SkillsManager(testSkillsDir);
    const sandboxFactory = new SandboxFactory();
    const skillsTool = createSkillsTool(skillsManager);
    const scriptsTool = createScriptsTool(skillsManager, sandboxFactory);

    // 测试1: list action
    console.log('1. 测试 list action...');
    const listResult = await skillsTool.exec({ action: 'list' }, {} as any);
    if (listResult.ok) {
      console.log(`   ✓ 列出 ${listResult.data.count} 个skill(s)`);
      console.log(`   - Skills: ${listResult.data.skills.map((s: any) => s.name).join(', ')}`);
    } else {
      console.log('   ✗ list action 失败:', listResult.error);
    }

    // 测试2: load action
    console.log('\n2. 测试 load action...');
    const loadResult = await skillsTool.exec(
      { action: 'load', skill_name: 'example-skill' },
      {} as any
    );
    if (loadResult.ok) {
      console.log('   ✓ Skill加载成功');
      console.log(`   - 名称: ${loadResult.data.name}`);
      console.log(`   - 描述: ${loadResult.data.description}`);
      console.log(`   - Scripts: ${loadResult.data.scripts.length} 个`);
    } else {
      console.log('   ✗ load action 失败:', loadResult.error);
    }

    // 测试3: execute_script tool (不使用sandbox)
    console.log('\n3. 测试 execute_script (直接执行)...');
    const execResult = await scriptsTool.exec(
      {
        skill_name: 'example-skill',
        script_name: 'hello.js',
        use_sandbox: false,
        args: ['arg1', 'arg2'],
      },
      {} as any
    );
    if (execResult.ok) {
      console.log('   ✓ 脚本执行成功');
      console.log(`   - 输出: ${execResult.data.stdout.trim()}`);
    } else {
      console.log('   ✗ 脚本执行失败:', execResult.error);
      console.log(`   - 详情: ${JSON.stringify(execResult.data)}`);
    }

    // 测试4: 错误处理
    console.log('\n4. 测试错误处理...');

    // 4.1 加载不存在的skill
    const notFoundResult = await skillsTool.exec(
      { action: 'load', skill_name: 'not-found' },
      {} as any
    );
    if (!notFoundResult.ok) {
      console.log('   ✓ 正确处理不存在的skill');
    }

    // 4.2 缺少必需参数
    const missingParamResult = await skillsTool.exec({ action: 'load' }, {} as any);
    if (!missingParamResult.ok) {
      console.log('   ✓ 正确处理缺少参数的情况');
    }

    console.log('\n=== 所有测试完成 ===');
  } catch (error) {
    console.error('\n✗ 测试失败:', error);
  } finally {
    // 清理测试目录
    try {
      await fs.rm(testSkillsDir, { recursive: true, force: true });
      console.log('\n✓ 测试目录已清理');
    } catch (error) {
      console.warn('\n⚠ 清理测试目录失败:', error);
    }
  }
}

main();
