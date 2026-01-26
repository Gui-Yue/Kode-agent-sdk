import { TestRunner, expect } from '../../helpers/utils';
import { E2BFS, E2BFSHost } from '../../../src/infra/e2b/e2b-fs';

const runner = new TestRunner('E2BFS');

// Mock host for unit testing pure logic methods
function createMockHost(workDir = '/home/user'): E2BFSHost {
  return {
    workDir,
    getE2BInstance: () => { throw new Error('Not available in unit tests'); },
  };
}

runner
  .test('resolve: 相对路径拼接 workDir', async () => {
    const fs = new E2BFS(createMockHost('/home/user'));
    expect.toEqual(fs.resolve('file.txt'), '/home/user/file.txt');
    expect.toEqual(fs.resolve('src/index.ts'), '/home/user/src/index.ts');
  })

  .test('resolve: 绝对路径直接返回', async () => {
    const fs = new E2BFS(createMockHost('/home/user'));
    expect.toEqual(fs.resolve('/tmp/test.txt'), '/tmp/test.txt');
    expect.toEqual(fs.resolve('/etc/config'), '/etc/config');
  })

  .test('resolve: 清理多余斜杠', async () => {
    const fs = new E2BFS(createMockHost('/home/user'));
    expect.toEqual(fs.resolve('a//b///c'), '/home/user/a/b/c');
  })

  .test('isInside: 始终返回 true', async () => {
    const fs = new E2BFS(createMockHost('/home/user'));
    expect.toEqual(fs.isInside('/home/user/file.txt'), true);
    expect.toEqual(fs.isInside('/etc/passwd'), true);
    expect.toEqual(fs.isInside('../outside'), true);
    expect.toEqual(fs.isInside('/'), true);
  })

  .test('temp: 返回 /tmp/ 下路径', async () => {
    const fs = new E2BFS(createMockHost('/home/user'));
    const t1 = fs.temp();
    expect.toContain(t1, '/tmp/');
    expect.toContain(t1, 'temp-');

    const t2 = fs.temp('my-file');
    expect.toEqual(t2, '/tmp/my-file');
  })

  .test('temp: 不指定 name 时生成唯一名称', async () => {
    const fs = new E2BFS(createMockHost('/home/user'));
    const t1 = fs.temp();
    const t2 = fs.temp();
    expect.toBeTruthy(t1 !== t2, 'temp names should be unique');
  })

  .test('matchGlob: 精确匹配', async () => {
    const fs = new E2BFS(createMockHost());
    expect.toEqual(fs.matchGlob('file.txt', 'file.txt'), true);
    expect.toEqual(fs.matchGlob('file.txt', 'other.txt'), false);
  })

  .test('matchGlob: * 匹配单层', async () => {
    const fs = new E2BFS(createMockHost());
    expect.toEqual(fs.matchGlob('*.ts', 'index.ts'), true);
    expect.toEqual(fs.matchGlob('*.ts', 'src/index.ts'), false);
    expect.toEqual(fs.matchGlob('src/*.ts', 'src/index.ts'), true);
  })

  .test('matchGlob: ** 匹配多层', async () => {
    const fs = new E2BFS(createMockHost());
    expect.toEqual(fs.matchGlob('**/*.ts', 'index.ts'), true);
    expect.toEqual(fs.matchGlob('**/*.ts', 'src/index.ts'), true);
    expect.toEqual(fs.matchGlob('**/*.ts', 'src/core/agent.ts'), true);
    expect.toEqual(fs.matchGlob('**/*.ts', 'src/core/agent.js'), false);
  })

  .test('matchGlob: ? 匹配单个字符', async () => {
    const fs = new E2BFS(createMockHost());
    expect.toEqual(fs.matchGlob('file?.txt', 'file1.txt'), true);
    expect.toEqual(fs.matchGlob('file?.txt', 'file12.txt'), false);
  })

  .test('matchGlob: 带特殊字符的 pattern', async () => {
    const fs = new E2BFS(createMockHost());
    expect.toEqual(fs.matchGlob('*.test.ts', 'sandbox.test.ts'), true);
    expect.toEqual(fs.matchGlob('*.test.ts', 'sandbox.spec.ts'), false);
  })

  .test('globToFindPattern: 简单 pattern 转 -name', async () => {
    const fs = new E2BFS(createMockHost());
    expect.toEqual(fs.globToFindPattern('*.ts'), '-name "*.ts"');
    expect.toEqual(fs.globToFindPattern('*.json'), '-name "*.json"');
  })

  .test('globToFindPattern: 带路径的 pattern 转 -path', async () => {
    const fs = new E2BFS(createMockHost());
    const result = fs.globToFindPattern('src/**/*.ts');
    expect.toContain(result, '-path');
    expect.toContain(result, 'src');
  })

  .test('globToFindPattern: ** 替换为 *', async () => {
    const fs = new E2BFS(createMockHost());
    const result = fs.globToFindPattern('**/*.ts');
    expect.toContain(result, '-path');
    // ** should be replaced with * in find pattern
    expect.toBeTruthy(!result.includes('**'), 'should not contain **');
  });

export async function run() {
  return await runner.run();
}

if (require.main === module) {
  run().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}
