/**
 * Skills Manager 单元测试
 *
 * 测试SkillsManager的核心功能：
 * 1. 扫描skills目录
 * 2. 获取skills元数据
 * 3. 加载skill内容
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import * as fs from 'fs/promises';
import * as path from 'path';
import { SkillsManager } from '../../src/core/skills/manager';
import { SkillMetadata, SkillContent } from '../../src/core/skills/types';

describe('SkillsManager', () => {
  let testSkillsDir: string;
  let skillsManager: SkillsManager;

  beforeEach(async () => {
    // 创建临时测试目录
    testSkillsDir = path.join(process.cwd(), 'test-skills-' + Date.now());
    await fs.mkdir(testSkillsDir, { recursive: true });
    skillsManager = new SkillsManager(testSkillsDir);
  });

  afterEach(async () => {
    // 清理测试目录
    try {
      await fs.rm(testSkillsDir, { recursive: true, force: true });
    } catch (error) {
      // 忽略清理错误
    }
  });

  describe('扫描功能', () => {
    it('应该返回空数组当skills目录不存在', async () => {
      const manager = new SkillsManager('non-existent-dir');
      const skills = await manager.getSkillsMetadata();
      expect(skills).toEqual([]);
    });

    it('应该扫描并解析有效的SKILL.md文件', async () => {
      // 创建测试skill
      const skillDir = path.join(testSkillsDir, 'test-skill');
      await fs.mkdir(skillDir, { recursive: true });

      const skillContent = `---
name: test-skill
description: Test skill for unit testing
---

# Test Skill

This is a test skill.
`;
      await fs.writeFile(path.join(skillDir, 'SKILL.md'), skillContent);

      // 扫描skills
      const skills = await skillsManager.getSkillsMetadata();

      expect(skills).toHaveLength(1);
      expect(skills[0].name).toBe('test-skill');
      expect(skills[0].description).toBe('Test skill for unit testing');
      expect(skills[0].path).toContain('SKILL.md');
      expect(skills[0].baseDir).toBe(skillDir);
    });

    it('应该跳过无效的SKILL.md文件', async () => {
      // 创建无效skill（没有YAML frontmatter）
      const skillDir = path.join(testSkillsDir, 'invalid-skill');
      await fs.mkdir(skillDir, { recursive: true });

      await fs.writeFile(path.join(skillDir, 'SKILL.md'), 'Invalid content without frontmatter');

      // 扫描skills
      const skills = await skillsManager.getSkillsMetadata();

      expect(skills).toHaveLength(0);
    });

    it('应该递归扫描子目录', async () => {
      // 创建嵌套skill
      const nestedDir = path.join(testSkillsDir, 'level1', 'level2', 'nested-skill');
      await fs.mkdir(nestedDir, { recursive: true });

      const skillContent = `---
name: nested-skill
description: Nested test skill
---

# Nested Skill
`;
      await fs.writeFile(path.join(nestedDir, 'SKILL.md'), skillContent);

      // 扫描skills
      const skills = await skillsManager.getSkillsMetadata();

      expect(skills).toHaveLength(1);
      expect(skills[0].name).toBe('nested-skill');
    });
  });

  describe('加载功能', () => {
    it('应该加载skill的完整内容', async () => {
      // 创建测试skill
      const skillDir = path.join(testSkillsDir, 'test-skill');
      await fs.mkdir(skillDir, { recursive: true });

      // 创建SKILL.md
      const skillContent = `---
name: test-skill
description: Test skill
---

# Test Skill

Content here.
`;
      await fs.writeFile(path.join(skillDir, 'SKILL.md'), skillContent);

      // 创建子目录和文件
      await fs.mkdir(path.join(skillDir, 'references'), { recursive: true });
      await fs.mkdir(path.join(skillDir, 'scripts'), { recursive: true });
      await fs.mkdir(path.join(skillDir, 'assets'), { recursive: true });

      await fs.writeFile(path.join(skillDir, 'references', 'doc.md'), '# Reference Doc');
      await fs.writeFile(path.join(skillDir, 'scripts', 'script.js'), 'console.log("test");');
      await fs.writeFile(path.join(skillDir, 'assets', 'template.txt'), 'Template content');

      // 加载skill内容
      const content = await skillsManager.loadSkillContent('test-skill');

      expect(content).not.toBeNull();
      expect(content!.metadata.name).toBe('test-skill');
      expect(content!.content).toContain('Content here.');
      expect(content!.references).toHaveLength(1);
      expect(content!.scripts).toHaveLength(1);
      expect(content!.assets).toHaveLength(1);
    });

    it('应该返回null当skill不存在', async () => {
      const content = await skillsManager.loadSkillContent('non-existent');
      expect(content).toBeNull();
    });

    it('应该处理不存在的子目录', async () => {
      // 创建测试skill（没有子目录）
      const skillDir = path.join(testSkillsDir, 'test-skill');
      await fs.mkdir(skillDir, { recursive: true });

      const skillContent = `---
name: test-skill
description: Test skill
---

# Test Skill
`;
      await fs.writeFile(path.join(skillDir, 'SKILL.md'), skillContent);

      // 加载skill内容
      const content = await skillsManager.loadSkillContent('test-skill');

      expect(content).not.toBeNull();
      expect(content!.references).toEqual([]);
      expect(content!.scripts).toEqual([]);
      expect(content!.assets).toEqual([]);
    });
  });

  describe('热更新功能', () => {
    it('应该支持动态添加新skill', async () => {
      // 初始扫描
      let skills = await skillsManager.getSkillsMetadata();
      expect(skills).toHaveLength(0);

      // 添加新skill
      const skillDir = path.join(testSkillsDir, 'new-skill');
      await fs.mkdir(skillDir, { recursive: true });

      const skillContent = `---
name: new-skill
description: Newly added skill
---

# New Skill
`;
      await fs.writeFile(path.join(skillDir, 'SKILL.md'), skillContent);

      // 重新扫描
      skills = await skillsManager.getSkillsMetadata();
      expect(skills).toHaveLength(1);
      expect(skills[0].name).toBe('new-skill');
    });

    it('应该支持动态修改skill内容', async () => {
      // 创建初始skill
      const skillDir = path.join(testSkillsDir, 'test-skill');
      await fs.mkdir(skillDir, { recursive: true });

      const skillContent = `---
name: test-skill
description: Original description
---

# Original Content
`;
      await fs.writeFile(path.join(skillDir, 'SKILL.md'), skillContent);

      // 首次加载
      let content = await skillsManager.loadSkillContent('test-skill');
      expect(content!.metadata.description).toBe('Original description');
      expect(content!.content).toContain('Original Content');

      // 修改skill
      const updatedContent = `---
name: test-skill
description: Updated description
---

# Updated Content
`;
      await fs.writeFile(path.join(skillDir, 'SKILL.md'), updatedContent);

      // 重新加载
      content = await skillsManager.loadSkillContent('test-skill');
      expect(content!.metadata.description).toBe('Updated description');
      expect(content!.content).toContain('Updated Content');
    });
  });
});
