/**
 * Skills 功能测试运行器
 *
 * 运行所有skills相关的单元测试
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';

// 导入测试模块
import './skills-manager.test';
import './skills-tool.test';
import './scripts-tool.test';

describe('Skills 功能集成测试', () => {
  test('测试套件应正常加载', () => {
    expect(true).toBe(true);
  });
});
