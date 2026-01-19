/**
 * SkillsManagementManager Archived 功能单元测试
 *
 * 测试目标：
 * - 验证归档目录默认为 .archived（隐藏目录）
 * - 验证支持自定义归档目录
 * - 验证 listSkills 排除 .archived 目录中的技能
 * - 验证 listArchivedSkills 正确获取归档技能
 * - 验证 deleteSkill 将技能移动到 .archived
 * - 验证 restoreSkill 从 .archived 恢复技能
 * - 验证编辑、重命名、删除等操作不支持对 .archived 中的技能进行
 * - 验证时间戳解析支持带毫秒和不带毫秒两种格式
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { TestRunner, expect } from '../../../helpers/utils';
import { SkillsManagementManager } from '../../../../src/core/skills/management-manager';
import { SandboxFactory } from '../../../../src/infra/sandbox-factory';

const runner = new TestRunner('SkillsManagementManager - Archived 功能');

runner
  .test('应该使用默认的 .archived 归档目录', async () => {
    // 创建临时测试目录
    const testRootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'skills-test-'));
    const skillsDir = path.join(testRootDir, 'skills');
    await fs.mkdir(skillsDir, { recursive: true });

    try {
      // 创建 SkillsManagementManager 实例
      const sandboxFactory = new SandboxFactory();
      const manager = new SkillsManagementManager(skillsDir, sandboxFactory);

      // 创建一个测试技能
      await manager.createSkill('test-skill', {
        name: 'test-skill',
        description: 'Test skill',
      });

      // 删除技能（会移动到 .archived）
      await manager.deleteSkill('test-skill');

      // 验证 .archived 目录存在
      const archivedDir = path.join(skillsDir, '.archived');
      const exists = await fs.access(archivedDir).then(() => true).catch(() => false);
      expect.toBeTruthy(exists);
    } finally {
      // 清理
      await fs.rm(testRootDir, { recursive: true, force: true }).catch(() => {});
    }
  })

  .test('应该支持自定义归档目录', async () => {
    // 创建临时测试目录
    const testRootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'skills-test-'));
    const skillsDir = path.join(testRootDir, 'skills');
    await fs.mkdir(skillsDir, { recursive: true });

    try {
      // 使用自定义归档目录创建 manager
      const customArchivedDir = path.join(testRootDir, 'custom-archived');
      const sandboxFactory = new SandboxFactory();
      const customManager = new SkillsManagementManager(
        skillsDir,
        sandboxFactory,
        customArchivedDir
      );

      // 创建一个测试技能
      await customManager.createSkill('test-skill', {
        name: 'test-skill',
        description: 'Test skill',
      });

      // 删除技能
      await customManager.deleteSkill('test-skill');

      // 验证自定义归档目录存在
      const exists = await fs.access(customArchivedDir).then(() => true).catch(() => false);
      expect.toBeTruthy(exists);

      // 验证默认的 .archived 目录不存在
      const defaultArchivedDir = path.join(skillsDir, '.archived');
      const defaultExists = await fs.access(defaultArchivedDir).then(() => true).catch(() => false);
      expect.toBeFalsy(defaultExists);
    } finally {
      // 清理
      await fs.rm(testRootDir, { recursive: true, force: true }).catch(() => {});
    }
  })

  .test('应该只返回在线技能，不包含 .archived 中的技能', async () => {
    // 创建临时测试目录
    const testRootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'skills-test-'));
    const skillsDir = path.join(testRootDir, 'skills');
    await fs.mkdir(skillsDir, { recursive: true });

    try {
      const sandboxFactory = new SandboxFactory();
      const manager = new SkillsManagementManager(skillsDir, sandboxFactory);

      // 创建两个技能
      await manager.createSkill('online-skill', {
        name: 'online-skill',
        description: 'Online skill',
      });
      await manager.createSkill('archived-skill', {
        name: 'archived-skill',
        description: 'Archived skill',
      });

      // 删除一个技能（移动到 .archived）
      await manager.deleteSkill('archived-skill');

      // 获取在线技能列表
      const onlineSkills = await manager.listSkills();

      // 验证只包含在线技能
      expect.toEqual(onlineSkills.length, 1);
      expect.toEqual(onlineSkills[0].name, 'online-skill');
      expect.toBeFalsy(onlineSkills[0].baseDir.includes('.archived'));
    } finally {
      // 清理
      await fs.rm(testRootDir, { recursive: true, force: true }).catch(() => {});
    }
  })

  .test('应该正确排除 .archived 目录（Windows 和 Unix 路径）', async () => {
    // 创建临时测试目录
    const testRootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'skills-test-'));
    const skillsDir = path.join(testRootDir, 'skills');
    await fs.mkdir(skillsDir, { recursive: true });

    try {
      const sandboxFactory = new SandboxFactory();
      const manager = new SkillsManagementManager(skillsDir, sandboxFactory);

      // 创建技能
      await manager.createSkill('test-skill', {
        name: 'test-skill',
        description: 'Test skill',
      });

      // 删除技能
      await manager.deleteSkill('test-skill');

      // 获取在线技能列表
      const onlineSkills = await manager.listSkills();

      // 验证没有技能包含 archived 路径（无论 Windows 还是 Unix 格式）
      for (const skill of onlineSkills) {
        expect.toBeFalsy(skill.baseDir.includes('/.archived/'));
        expect.toBeFalsy(skill.baseDir.includes('\\.archived\\'));
      }
    } finally {
      // 清理
      await fs.rm(testRootDir, { recursive: true, force: true }).catch(() => {});
    }
  })

  .test('应该返回 .archived 目录中的所有技能', async () => {
    // 创建临时测试目录
    const testRootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'skills-test-'));
    const skillsDir = path.join(testRootDir, 'skills');
    await fs.mkdir(skillsDir, { recursive: true });

    try {
      const sandboxFactory = new SandboxFactory();
      const manager = new SkillsManagementManager(skillsDir, sandboxFactory);

      // 创建并删除两个技能
      await manager.createSkill('skill1', { name: 'skill1', description: 'Skill 1' });
      await manager.createSkill('skill2', { name: 'skill2', description: 'Skill 2' });

      await manager.deleteSkill('skill1');
      await manager.deleteSkill('skill2');

      // 获取归档技能列表
      const archivedSkills = await manager.listArchivedSkills();

      // 验证返回两个归档技能
      expect.toEqual(archivedSkills.length, 2);
      const names = archivedSkills.map(s => s.originalName).sort();
      expect.toEqual(names.join(','), 'skill1,skill2');
    } finally {
      // 清理
      await fs.rm(testRootDir, { recursive: true, force: true }).catch(() => {});
    }
  })

  .test('应该正确解析归档时间戳（带毫秒）', async () => {
    // 创建临时测试目录
    const testRootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'skills-test-'));
    const skillsDir = path.join(testRootDir, 'skills');
    await fs.mkdir(skillsDir, { recursive: true });

    try {
      const sandboxFactory = new SandboxFactory();
      const manager = new SkillsManagementManager(skillsDir, sandboxFactory);

      // 创建并删除技能
      await manager.createSkill('test-skill', { name: 'test-skill', description: 'Test' });
      await manager.deleteSkill('test-skill');

      // 获取归档技能
      const archivedSkills = await manager.listArchivedSkills();

      // 验证归档技能信息
      expect.toEqual(archivedSkills.length, 1);
      expect.toEqual(archivedSkills[0].originalName, 'test-skill');
      expect.toBeTruthy(archivedSkills[0].archivedName.match(/^test-skill_\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}/));
      expect.toBeTruthy(archivedSkills[0].archivedAt);
    } finally {
      // 清理
      await fs.rm(testRootDir, { recursive: true, force: true }).catch(() => {});
    }
  })

  .test('应该按归档时间倒序排列', async () => {
    // 创建临时测试目录
    const testRootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'skills-test-'));
    const skillsDir = path.join(testRootDir, 'skills');
    await fs.mkdir(skillsDir, { recursive: true });

    try {
      const sandboxFactory = new SandboxFactory();
      const manager = new SkillsManagementManager(skillsDir, sandboxFactory);

      // 创建并删除两个技能
      await manager.createSkill('skill1', { name: 'skill1', description: 'Skill 1' });
      await manager.deleteSkill('skill1');

      // 等待至少 10ms 确保时间戳不同
      await new Promise(resolve => setTimeout(resolve, 10));

      await manager.createSkill('skill2', { name: 'skill2', description: 'Skill 2' });
      await manager.deleteSkill('skill2');

      // 获取归档技能列表
      const archivedSkills = await manager.listArchivedSkills();

      // 验证按时间倒序（skill2 在前）
      expect.toEqual(archivedSkills.length, 2);
      expect.toEqual(archivedSkills[0].originalName, 'skill2');
      expect.toEqual(archivedSkills[1].originalName, 'skill1');
    } finally {
      // 清理
      await fs.rm(testRootDir, { recursive: true, force: true }).catch(() => {});
    }
  })

  .test('.archived 目录不存在时应该返回空数组', async () => {
    // 创建临时测试目录
    const testRootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'skills-test-'));
    const skillsDir = path.join(testRootDir, 'skills');
    await fs.mkdir(skillsDir, { recursive: true });

    try {
      const sandboxFactory = new SandboxFactory();
      const manager = new SkillsManagementManager(skillsDir, sandboxFactory);

      // 不创建任何技能，直接查询归档列表
      const archivedSkills = await manager.listArchivedSkills();

      // 验证返回空数组
      expect.toEqual(archivedSkills.length, 0);
    } finally {
      // 清理
      await fs.rm(testRootDir, { recursive: true, force: true }).catch(() => {});
    }
  })

  .test('应该将技能移动到 .archived 目录并添加时间戳', async () => {
    // 创建临时测试目录
    const testRootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'skills-test-'));
    const skillsDir = path.join(testRootDir, 'skills');
    await fs.mkdir(skillsDir, { recursive: true });

    try {
      const sandboxFactory = new SandboxFactory();
      const manager = new SkillsManagementManager(skillsDir, sandboxFactory);

      // 创建技能
      await manager.createSkill('test-skill', { name: 'test-skill', description: 'Test' });

      // 删除技能
      await manager.deleteSkill('test-skill');

      // 验证技能不再在线列表中
      const onlineSkills = await manager.listSkills();
      expect.toBeFalsy(onlineSkills.find(s => s.name === 'test-skill'));

      // 验证技能在归档列表中
      const archivedSkills = await manager.listArchivedSkills();
      expect.toBeTruthy(archivedSkills.find(s => s.originalName === 'test-skill'));

      // 验证归档目录结构
      const archivedDir = path.join(skillsDir, '.archived');
      const entries = await fs.readdir(archivedDir);
      expect.toEqual(entries.length, 1);
      expect.toBeTruthy(entries[0].match(/^test-skill_\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}/));
    } finally {
      // 清理
      await fs.rm(testRootDir, { recursive: true, force: true }).catch(() => {});
    }
  })

  .test('应该将技能从 .archived 移回 skills 目录', async () => {
    // 创建临时测试目录
    const testRootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'skills-test-'));
    const skillsDir = path.join(testRootDir, 'skills');
    await fs.mkdir(skillsDir, { recursive: true });

    try {
      const sandboxFactory = new SandboxFactory();
      const manager = new SkillsManagementManager(skillsDir, sandboxFactory);

      // 创建并删除技能
      await manager.createSkill('test-skill', { name: 'test-skill', description: 'Test' });
      await manager.deleteSkill('test-skill');

      // 获取归档技能
      const archivedSkills = await manager.listArchivedSkills();
      expect.toEqual(archivedSkills.length, 1);

      // 恢复技能
      await manager.restoreSkill(archivedSkills[0].archivedName);

      // 验证技能回到在线列表
      const onlineSkills = await manager.listSkills();
      expect.toBeTruthy(onlineSkills.find(s => s.name === 'test-skill'));

      // 验证技能不再在归档列表中
      const newArchivedSkills = await manager.listArchivedSkills();
      expect.toBeFalsy(newArchivedSkills.find(s => s.originalName === 'test-skill'));
    } finally {
      // 清理
      await fs.rm(testRootDir, { recursive: true, force: true }).catch(() => {});
    }
  })

  .test('恢复时如果目标技能已存在应该抛出错误', async () => {
    // 创建临时测试目录
    const testRootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'skills-test-'));
    const skillsDir = path.join(testRootDir, 'skills');
    await fs.mkdir(skillsDir, { recursive: true });

    try {
      const sandboxFactory = new SandboxFactory();
      const manager = new SkillsManagementManager(skillsDir, sandboxFactory);

      // 创建并删除 skill1
      await manager.createSkill('skill1', { name: 'skill1', description: 'Skill 1' });
      await manager.deleteSkill('skill1');

      // 手动创建 skill1 目录（绕过 createSkill 的检查，模拟已有同名技能的情况）
      const skillDir = path.join(skillsDir, 'skill1');
      await fs.mkdir(skillDir, { recursive: true });
      await fs.mkdir(path.join(skillDir, 'references'));
      await fs.mkdir(path.join(skillDir, 'scripts'));
      await fs.mkdir(path.join(skillDir, 'assets'));
      await fs.writeFile(
        path.join(skillDir, 'SKILL.md'),
        '---\nname: skill1\ndescription: Skill 1 again\n---\n'
      );

      // 尝试恢复（应该失败）
      const archivedSkills = await manager.listArchivedSkills();
      let errorThrown = false;
      try {
        await manager.restoreSkill(archivedSkills[0].archivedName);
      } catch (error: any) {
        errorThrown = true;
        expect.toBeTruthy(error.message.includes('Skill already exists'));
      }
      expect.toBeTruthy(errorThrown);
    } finally {
      // 清理
      await fs.rm(testRootDir, { recursive: true, force: true }).catch(() => {});
    }
  })

  .test('不应该允许编辑 .archived 中的技能', async () => {
    // 创建临时测试目录
    const testRootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'skills-test-'));
    const skillsDir = path.join(testRootDir, 'skills');
    await fs.mkdir(skillsDir, { recursive: true });

    try {
      const sandboxFactory = new SandboxFactory();
      const manager = new SkillsManagementManager(skillsDir, sandboxFactory);

      // 创建并删除技能
      await manager.createSkill('test-skill', { name: 'test-skill', description: 'Test' });
      await manager.deleteSkill('test-skill');

      // 尝试编辑归档技能（应该失败）
      let errorThrown = false;
      try {
        await manager.editSkillFile('test-skill', 'SKILL.md', 'updated content');
      } catch (error: any) {
        errorThrown = true;
        expect.toBeTruthy(error.message.includes('Cannot edit archived skill'));
      }
      expect.toBeTruthy(errorThrown);
    } finally {
      // 清理
      await fs.rm(testRootDir, { recursive: true, force: true }).catch(() => {});
    }
  })

  .test('不应该允许获取 .archived 中技能的详细信息', async () => {
    // 创建临时测试目录
    const testRootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'skills-test-'));
    const skillsDir = path.join(testRootDir, 'skills');
    await fs.mkdir(skillsDir, { recursive: true });

    try {
      const sandboxFactory = new SandboxFactory();
      const manager = new SkillsManagementManager(skillsDir, sandboxFactory);

      // 创建并删除技能
      await manager.createSkill('test-skill', { name: 'test-skill', description: 'Test' });
      await manager.deleteSkill('test-skill');

      // 尝试获取归档技能详细信息（应该失败）
      let errorThrown = false;
      try {
        await manager.getSkillInfo('test-skill');
      } catch (error: any) {
        errorThrown = true;
        expect.toBeTruthy(error.message.includes('Cannot get info for archived skill'));
      }
      expect.toBeTruthy(errorThrown);
    } finally {
      // 清理
      await fs.rm(testRootDir, { recursive: true, force: true }).catch(() => {});
    }
  })

  .test('不应该允许获取 .archived 中技能的文件树', async () => {
    // 创建临时测试目录
    const testRootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'skills-test-'));
    const skillsDir = path.join(testRootDir, 'skills');
    await fs.mkdir(skillsDir, { recursive: true });

    try {
      const sandboxFactory = new SandboxFactory();
      const manager = new SkillsManagementManager(skillsDir, sandboxFactory);

      // 创建并删除技能
      await manager.createSkill('test-skill', { name: 'test-skill', description: 'Test' });
      await manager.deleteSkill('test-skill');

      // 尝试获取归档技能文件树（应该失败）
      let errorThrown = false;
      try {
        await manager.getSkillFileTree('test-skill');
      } catch (error: any) {
        errorThrown = true;
        expect.toBeTruthy(error.message.includes('Cannot get file tree for archived skill'));
      }
      expect.toBeTruthy(errorThrown);
    } finally {
      // 清理
      await fs.rm(testRootDir, { recursive: true, force: true }).catch(() => {});
    }
  })

  .test('创建与 .archived 中技能同名的新技能应该失败', async () => {
    // 创建临时测试目录
    const testRootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'skills-test-'));
    const skillsDir = path.join(testRootDir, 'skills');
    await fs.mkdir(skillsDir, { recursive: true });

    try {
      const sandboxFactory = new SandboxFactory();
      const manager = new SkillsManagementManager(skillsDir, sandboxFactory);

      // 创建并删除技能
      await manager.createSkill('test-skill', { name: 'test-skill', description: 'Test' });
      await manager.deleteSkill('test-skill');

      // 尝试创建同名技能（应该失败）
      let errorThrown = false;
      try {
        await manager.createSkill('test-skill', { name: 'test-skill', description: 'New test skill' });
      } catch (error: any) {
        errorThrown = true;
        expect.toBeTruthy(error.message.includes('Archived skill with name'));
      }
      expect.toBeTruthy(errorThrown);
    } finally {
      // 清理
      await fs.rm(testRootDir, { recursive: true, force: true }).catch(() => {});
    }
  })

  .test('应该正确解析带毫秒的时间戳格式', async () => {
    // 创建临时测试目录
    const testRootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'skills-test-'));
    const skillsDir = path.join(testRootDir, 'skills');
    await fs.mkdir(skillsDir, { recursive: true });

    try {
      const sandboxFactory = new SandboxFactory();
      const manager = new SkillsManagementManager(skillsDir, sandboxFactory);

      // 手动创建带毫秒的归档目录
      const archivedDir = path.join(skillsDir, '.archived');
      await fs.mkdir(archivedDir, { recursive: true });

      const skillDir = path.join(archivedDir, 'test-skill_2024-01-15T10-30-45-123Z');
      await fs.mkdir(skillDir, { recursive: true });

      // 创建 SKILL.md
      const skillMdPath = path.join(skillDir, 'SKILL.md');
      await fs.writeFile(skillMdPath, '---\nname: test-skill\ndescription: Test\n---\n');

      // 获取归档技能列表
      const archivedSkills = await manager.listArchivedSkills();

      // 验证能正确解析
      expect.toEqual(archivedSkills.length, 1);
      expect.toEqual(archivedSkills[0].originalName, 'test-skill');
      expect.toEqual(archivedSkills[0].archivedName, 'test-skill_2024-01-15T10-30-45-123Z');
    } finally {
      // 清理
      await fs.rm(testRootDir, { recursive: true, force: true }).catch(() => {});
    }
  })

  .test('应该正确解析不带毫秒的时间戳格式', async () => {
    // 创建临时测试目录
    const testRootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'skills-test-'));
    const skillsDir = path.join(testRootDir, 'skills');
    await fs.mkdir(skillsDir, { recursive: true });

    try {
      const sandboxFactory = new SandboxFactory();
      const manager = new SkillsManagementManager(skillsDir, sandboxFactory);

      // 手动创建不带毫秒的归档目录
      const archivedDir = path.join(skillsDir, '.archived');
      await fs.mkdir(archivedDir, { recursive: true });

      const skillDir = path.join(archivedDir, 'test-skill_2024-01-15T10-30-45Z');
      await fs.mkdir(skillDir, { recursive: true });

      // 创建 SKILL.md
      const skillMdPath = path.join(skillDir, 'SKILL.md');
      await fs.writeFile(skillMdPath, '---\nname: test-skill\ndescription: Test\n---\n');

      // 获取归档技能列表
      const archivedSkills = await manager.listArchivedSkills();

      // 验证能正确解析
      expect.toEqual(archivedSkills.length, 1);
      expect.toEqual(archivedSkills[0].originalName, 'test-skill');
      expect.toEqual(archivedSkills[0].archivedName, 'test-skill_2024-01-15T10-30-45Z');
    } finally {
      // 清理
      await fs.rm(testRootDir, { recursive: true, force: true }).catch(() => {});
    }
  })

  .test('应该能恢复带毫秒时间戳的归档技能', async () => {
    // 创建临时测试目录
    const testRootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'skills-test-'));
    const skillsDir = path.join(testRootDir, 'skills');
    await fs.mkdir(skillsDir, { recursive: true });

    try {
      const sandboxFactory = new SandboxFactory();
      const manager = new SkillsManagementManager(skillsDir, sandboxFactory);

      // 手动创建带毫秒的归档目录
      const archivedDir = path.join(skillsDir, '.archived');
      await fs.mkdir(archivedDir, { recursive: true });

      const skillDir = path.join(archivedDir, 'test-skill_2024-01-15T10-30-45-123Z');
      await fs.mkdir(skillDir, { recursive: true });

      // 创建 SKILL.md
      const skillMdPath = path.join(skillDir, 'SKILL.md');
      await fs.writeFile(skillMdPath, '---\nname: test-skill\ndescription: Test\n---\n');

      // 恢复技能
      await manager.restoreSkill('test-skill_2024-01-15T10-30-45-123Z');

      // 验证技能恢复成功
      const onlineSkills = await manager.listSkills();
      expect.toBeTruthy(onlineSkills.find(s => s.name === 'test-skill'));
    } finally {
      // 清理
      await fs.rm(testRootDir, { recursive: true, force: true }).catch(() => {});
    }
  })

  .test('应该能恢复不带毫秒时间戳的归档技能', async () => {
    // 创建临时测试目录
    const testRootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'skills-test-'));
    const skillsDir = path.join(testRootDir, 'skills');
    await fs.mkdir(skillsDir, { recursive: true });

    try {
      const sandboxFactory = new SandboxFactory();
      const manager = new SkillsManagementManager(skillsDir, sandboxFactory);

      // 手动创建不带毫秒的归档目录
      const archivedDir = path.join(skillsDir, '.archived');
      await fs.mkdir(archivedDir, { recursive: true });

      const skillDir = path.join(archivedDir, 'test-skill_2024-01-15T10-30-45Z');
      await fs.mkdir(skillDir, { recursive: true });

      // 创建 SKILL.md
      const skillMdPath = path.join(skillDir, 'SKILL.md');
      await fs.writeFile(skillMdPath, '---\nname: test-skill\ndescription: Test\n---\n');

      // 恢复技能
      await manager.restoreSkill('test-skill_2024-01-15T10-30-45Z');

      // 验证技能恢复成功
      const onlineSkills = await manager.listSkills();
      expect.toBeTruthy(onlineSkills.find(s => s.name === 'test-skill'));
    } finally {
      // 清理
      await fs.rm(testRootDir, { recursive: true, force: true }).catch(() => {});
    }
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
