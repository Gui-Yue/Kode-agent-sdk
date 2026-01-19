/**
 * Skills 功能验证脚本
 *
 * 这是一个简单的验证脚本，用于测试SkillsManager的基本功能
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { SkillsManager } from '../../src/core/skills/manager';

async function main() {
  console.log('=== Skills 功能验证 ===\n');

  // 创建临时测试目录
  const testSkillsDir = path.join(process.cwd(), 'test-skills-verify-' + Date.now());

  try {
    // 1. 测试空目录
    console.log('1. 测试空目录...');
    let manager = new SkillsManager(testSkillsDir);
    let skills = await manager.getSkillsMetadata();
    console.log(`   ✓ 空目录返回 ${skills.length} 个skills`);

    // 2. 创建测试skill
    console.log('\n2. 创建测试skill...');
    await fs.mkdir(testSkillsDir, { recursive: true });
    const skillDir = path.join(testSkillsDir, 'test-skill');
    await fs.mkdir(skillDir, { recursive: true });

    const skillContent = `---
name: test-skill
description: 测试技能
---

# Test Skill

这是一个测试skill。
`;
    await fs.writeFile(path.join(skillDir, 'SKILL.md'), skillContent);
    console.log('   ✓ SKILL.md 已创建');

    // 3. 测试扫描功能
    console.log('\n3. 测试扫描功能...');
    manager = new SkillsManager(testSkillsDir);
    skills = await manager.getSkillsMetadata();
    console.log(`   ✓ 扫描到 ${skills.length} 个skill(s)`);
    if (skills.length > 0) {
      console.log(`   - 名称: ${skills[0].name}`);
      console.log(`   - 描述: ${skills[0].description}`);
      console.log(`   - 路径: ${skills[0].path}`);
    }

    // 4. 测试加载功能
    console.log('\n4. 测试加载功能...');
    const content = await manager.loadSkillContent('test-skill');
    if (content) {
      console.log('   ✓ Skill内容加载成功');
      console.log(`   - 包含 ${content.references.length} 个references文件`);
      console.log(`   - 包含 ${content.scripts.length} 个scripts文件`);
      console.log(`   - 包含 ${content.assets.length} 个assets文件`);
    } else {
      console.log('   ✗ Skill内容加载失败');
    }

    // 5. 测试子目录
    console.log('\n5. 测试子目录...');
    await fs.mkdir(path.join(skillDir, 'scripts'), { recursive: true });
    await fs.mkdir(path.join(skillDir, 'references'), { recursive: true });
    await fs.mkdir(path.join(skillDir, 'assets'), { recursive: true });

    await fs.writeFile(path.join(skillDir, 'scripts', 'test.js'), 'console.log("test");');
    await fs.writeFile(path.join(skillDir, 'references', 'doc.md'), '# Doc');
    await fs.writeFile(path.join(skillDir, 'assets', 'template.txt'), 'Template');

    const contentWithFiles = await manager.loadSkillContent('test-skill');
    if (contentWithFiles) {
      console.log(`   ✓ Scripts: ${contentWithFiles.scripts.length} 个`);
      console.log(`   ✓ References: ${contentWithFiles.references.length} 个`);
      console.log(`   ✓ Assets: ${contentWithFiles.assets.length} 个`);
    }

    // 6. 测试热更新
    console.log('\n6. 测试热更新...');
    const updatedContent = `---
name: test-skill
description: 更新后的描述
---

# Updated Skill

内容已更新。
`;
    await fs.writeFile(path.join(skillDir, 'SKILL.md'), updatedContent);

    const updated = await manager.loadSkillContent('test-skill');
    if (updated && updated.metadata.description === '更新后的描述') {
      console.log('   ✓ 热更新正常工作');
      console.log(`   - 新描述: ${updated.metadata.description}`);
    } else {
      console.log('   ✗ 热更新失败');
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
