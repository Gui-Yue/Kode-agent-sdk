/**
 * Skills 综合功能验证脚本
 *
 * 全面测试Skills系统的所有功能：
 * 1. SkillsManager 基本功能
 * 2. SkillsTool 的 list 和 load
 * 3. ScriptsTool 的直接执行和sandbox执行
 * 4. 错误处理和边界情况
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { SkillsManager } from '../../src/core/skills/manager';
import { createSkillsTool } from '../../src/tools/skills';
import { createScriptsTool } from '../../src/tools/scripts';
import { SandboxFactory } from '../../src/infra/sandbox-factory';

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║       Skills 综合功能验证 - 全面测试                      ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  const testSkillsDir = path.join(process.cwd(), 'test-skills-comprehensive-' + Date.now());
  let passedTests = 0;
  let failedTests = 0;

  try {
    // ========== 测试套件 1: SkillsManager 基本功能 ==========
    console.log('📋 测试套件 1: SkillsManager 基本功能');
    console.log('───────────────────────────────────────────────────────────');

    await fs.mkdir(testSkillsDir, { recursive: true });
    const skillsManager = new SkillsManager(testSkillsDir);

    // 测试 1.1: 空目录扫描
    console.log('测试 1.1: 空目录扫描');
    let skills = await skillsManager.getSkillsMetadata();
    if (skills.length === 0) {
      console.log('  ✅ PASS: 空目录返回空数组');
      passedTests++;
    } else {
      console.log('  ❌ FAIL: 空目录应返回空数组');
      failedTests++;
    }

    // 创建多个测试skills
    console.log('\n测试 1.2: 创建多个测试skills');
    const skill1Dir = path.join(testSkillsDir, 'skill-1');
    const skill2Dir = path.join(testSkillsDir, 'skill-2');
    await fs.mkdir(skill1Dir, { recursive: true });
    await fs.mkdir(skill2Dir, { recursive: true });

    await fs.writeFile(
      path.join(skill1Dir, 'SKILL.md'),
      `---
name: skill-1
description: 第一个测试技能
---

# Skill 1
第一个技能内容
`
    );

    await fs.writeFile(
      path.join(skill2Dir, 'SKILL.md'),
      `---
name: skill-2
description: 第二个测试技能
---

# Skill 2
第二个技能内容
`
    );

    console.log('  ✅ PASS: 已创建2个测试skills');
    passedTests++;

    // 测试 1.3: 扫描多个skills
    console.log('\n测试 1.3: 扫描多个skills');
    skills = await skillsManager.getSkillsMetadata();
    if (skills.length === 2) {
      console.log(`  ✅ PASS: 扫描到2个skills`);
      console.log(`    - skill-1: ${skills[0].description}`);
      console.log(`    - skill-2: ${skills[1].description}`);
      passedTests++;
    } else {
      console.log(`  ❌ FAIL: 应扫描到2个skills，实际: ${skills.length}`);
      failedTests++;
    }

    // 测试 1.4: 加载skill内容
    console.log('\n测试 1.4: 加载skill内容');
    const content = await skillsManager.loadSkillContent('skill-1');
    if (content && content.metadata.name === 'skill-1') {
      console.log(`  ✅ PASS: 成功加载skill内容`);
      console.log(`    - 名称: ${content.metadata.name}`);
      console.log(`    - 描述: ${content.metadata.description}`);
      console.log(`    - 内容长度: ${content.content.length} 字符`);
      passedTests++;
    } else {
      console.log('  ❌ FAIL: 加载skill内容失败');
      failedTests++;
    }

    // 测试 1.5: 创建子目录文件
    console.log('\n测试 1.5: 创建子目录文件');
    await fs.mkdir(path.join(skill1Dir, 'scripts'), { recursive: true });
    await fs.mkdir(path.join(skill1Dir, 'references'), { recursive: true });
    await fs.mkdir(path.join(skill1Dir, 'assets'), { recursive: true });

    await fs.writeFile(path.join(skill1Dir, 'scripts', 'test.js'), 'console.log("test");');
    await fs.writeFile(path.join(skill1Dir, 'references', 'doc.md'), '# Doc');
    await fs.writeFile(path.join(skill1Dir, 'assets', 'template.txt'), 'Template');

    const contentWithFiles = await skillsManager.loadSkillContent('skill-1');
    if (contentWithFiles &&
        contentWithFiles.scripts.length === 1 &&
        contentWithFiles.references.length === 1 &&
        contentWithFiles.assets.length === 1) {
      console.log(`  ✅ PASS: 正确识别子目录文件`);
      console.log(`    - Scripts: ${contentWithFiles.scripts.length}`);
      console.log(`    - References: ${contentWithFiles.references.length}`);
      console.log(`    - Assets: ${contentWithFiles.assets.length}`);
      passedTests++;
    } else {
      console.log('  ❌ FAIL: 子目录文件识别错误');
      failedTests++;
    }

    // 测试 1.6: 热更新
    console.log('\n测试 1.6: 热更新功能');
    await fs.writeFile(
      path.join(skill1Dir, 'SKILL.md'),
      `---
name: skill-1
description: 更新后的描述
---

# Updated Skill
内容已更新
`
    );

    const updatedContent = await skillsManager.loadSkillContent('skill-1');
    if (updatedContent && updatedContent.metadata.description === '更新后的描述') {
      console.log(`  ✅ PASS: 热更新正常工作`);
      console.log(`    - 新描述: ${updatedContent.metadata.description}`);
      passedTests++;
    } else {
      console.log('  ❌ FAIL: 热更新失败');
      failedTests++;
    }

    // ========== 测试套件 2: SkillsTool ==========
    console.log('\n\n📋 测试套件 2: SkillsTool');
    console.log('───────────────────────────────────────────────────────────');

    const skillsTool = createSkillsTool(skillsManager);

    // 测试 2.1: list action
    console.log('\n测试 2.1: list action');
    const listResult = await skillsTool.exec({ action: 'list' }, {} as any);
    if (listResult.ok && listResult.data.count === 2) {
      console.log(`  ✅ PASS: list action 成功`);
      console.log(`    - 返回 ${listResult.data.count} 个skills`);
      passedTests++;
    } else {
      console.log('  ❌ FAIL: list action 失败');
      failedTests++;
    }

    // 测试 2.2: load action
    console.log('\n测试 2.2: load action');
    const loadResult = await skillsTool.exec(
      { action: 'load', skill_name: 'skill-1' },
      {} as any
    );
    if (loadResult.ok && loadResult.data.name === 'skill-1') {
      console.log(`  ✅ PASS: load action 成功`);
      console.log(`    - Skill: ${loadResult.data.name}`);
      console.log(`    - 描述: ${loadResult.data.description}`);
      passedTests++;
    } else {
      console.log('  ❌ FAIL: load action 失败');
      failedTests++;
    }

    // 测试 2.3: 错误处理 - 不存在的skill
    console.log('\n测试 2.3: 错误处理 - 不存在的skill');
    const notFoundResult = await skillsTool.exec(
      { action: 'load', skill_name: 'not-found' },
      {} as any
    );
    if (!notFoundResult.ok) {
      console.log(`  ✅ PASS: 正确处理不存在的skill`);
      console.log(`    - 错误: ${notFoundResult.error}`);
      passedTests++;
    } else {
      console.log('  ❌ FAIL: 应该返回错误');
      failedTests++;
    }

    // 测试 2.4: 错误处理 - 缺少参数
    console.log('\n测试 2.4: 错误处理 - 缺少参数');
    const missingParamResult = await skillsTool.exec({ action: 'load' }, {} as any);
    if (!missingParamResult.ok) {
      console.log(`  ✅ PASS: 正确处理缺少参数`);
      console.log(`    - 错误: ${missingParamResult.error}`);
      passedTests++;
    } else {
      console.log('  ❌ FAIL: 应该返回错误');
      failedTests++;
    }

    // ========== 测试套件 3: ScriptsTool ==========
    console.log('\n\n📋 测试套件 3: ScriptsTool');
    console.log('───────────────────────────────────────────────────────────');

    const sandboxFactory = new SandboxFactory();
    const scriptsTool = createScriptsTool(skillsManager, sandboxFactory);

    // 测试 3.1: 直接执行脚本
    console.log('\n测试 3.1: 直接执行脚本（不使用sandbox）');
    const execResult = await scriptsTool.exec(
      {
        skill_name: 'skill-1',
        script_name: 'test.js',
        use_sandbox: false,
      },
      {} as any
    );
    if (execResult.ok) {
      console.log(`  ✅ PASS: 脚本执行成功`);
      console.log(`    - 输出: ${execResult.data.stdout.trim()}`);
      passedTests++;
    } else {
      console.log('  ❌ FAIL: 脚本执行失败');
      console.log(`    - 错误: ${execResult.error}`);
      failedTests++;
    }

    // 测试 3.2: 使用sandbox执行脚本
    console.log('\n测试 3.2: 使用sandbox执行脚本');
    const sandboxResult = await scriptsTool.exec(
      {
        skill_name: 'skill-1',
        script_name: 'test.js',
        use_sandbox: true,
      },
      {} as any
    );
    if (sandboxResult.ok) {
      console.log(`  ✅ PASS: sandbox执行成功`);
      console.log(`    - 输出: ${sandboxResult.data.stdout.trim()}`);
      passedTests++;
    } else {
      console.log('  ❌ FAIL: sandbox执行失败');
      console.log(`    - 错误: ${sandboxResult.error}`);
      failedTests++;
    }

    // 测试 3.3: 脚本参数传递
    console.log('\n测试 3.3: 脚本参数传递');
    await fs.writeFile(
      path.join(skill1Dir, 'scripts', 'args.js'),
      `console.log('Args:', process.argv.slice(2).join(' '));`
    );

    const argsResult = await scriptsTool.exec(
      {
        skill_name: 'skill-1',
        script_name: 'args.js',
        use_sandbox: false,
        args: ['param1', 'param2'],
      },
      {} as any
    );
    if (argsResult.ok && argsResult.data.stdout.includes('param1')) {
      console.log(`  ✅ PASS: 参数传递成功`);
      console.log(`    - 输出: ${argsResult.data.stdout.trim()}`);
      passedTests++;
    } else {
      console.log('  ❌ FAIL: 参数传递失败');
      failedTests++;
    }

    // 测试 3.4: 错误处理 - 不存在的脚本
    console.log('\n测试 3.4: 错误处理 - 不存在的脚本');
    const notFoundScriptResult = await scriptsTool.exec(
      {
        skill_name: 'skill-1',
        script_name: 'not-found.js',
        use_sandbox: false,
      },
      {} as any
    );
    if (!notFoundScriptResult.ok) {
      console.log(`  ✅ PASS: 正确处理不存在的脚本`);
      passedTests++;
    } else {
      console.log('  ❌ FAIL: 应该返回错误');
      failedTests++;
    }

    // ========== 测试总结 ==========
    console.log('\n\n╔════════════════════════════════════════════════════════════╗');
    console.log('║                    测试结果总结                            ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log(`\n  ✅ 通过: ${passedTests} 个测试`);
    console.log(`  ❌ 失败: ${failedTests} 个测试`);
    console.log(`  📊 总计: ${passedTests + failedTests} 个测试`);
    console.log(`  📈 成功率: ${((passedTests / (passedTests + failedTests)) * 100).toFixed(1)}%\n`);

    if (failedTests === 0) {
      console.log('🎉 恭喜！所有测试都通过了！');
    } else {
      console.log('⚠️  部分测试失败，请检查日志');
    }

  } catch (error) {
    console.error('\n❌ 测试执行失败:', error);
    failedTests++;
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
