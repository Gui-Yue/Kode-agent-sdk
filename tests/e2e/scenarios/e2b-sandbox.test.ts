import { TestRunner, expect } from '../../helpers/utils';
import { E2BSandbox } from '../../../src/infra/e2b';

const runner = new TestRunner('E2E - E2B Cloud Sandbox');

function loadE2BApiKey(): string | undefined {
  const fs = require('fs');
  const path = require('path');
  const filePath = path.resolve(process.cwd(), '.env.test');
  if (!fs.existsSync(filePath)) return undefined;
  const content = fs.readFileSync(filePath, 'utf-8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (key === 'E2B_API_KEY') return value;
  }
  return process.env.E2B_API_KEY;
}

const apiKey = loadE2BApiKey();

if (!apiKey || apiKey === 'replace-with-your-e2b-api-key') {
  runner.skip('E2B E2E 跳过：缺少 E2B_API_KEY');
} else {
  let sandbox: E2BSandbox;

  runner
    .beforeAll(async () => {
      sandbox = new E2BSandbox({ apiKey, timeoutMs: 60_000 });
      await sandbox.init();
    })
    .afterAll(async () => {
      if (sandbox) {
        await sandbox.dispose();
      }
    })
    .test('沙箱创建成功并获取 ID', async () => {
      const id = sandbox.getSandboxId();
      expect.toBeTruthy(id, 'sandbox ID 应存在');
      expect.toBeTruthy(id.length > 0, 'sandbox ID 不应为空');
    })
    .test('沙箱运行状态检查', async () => {
      const running = await sandbox.isRunning();
      expect.toEqual(running, true, '沙箱应处于运行状态');
    })
    .test('执行基本命令 (echo)', async () => {
      const result = await sandbox.exec('echo "hello e2b"');
      expect.toEqual(result.code, 0, '退出码应为 0');
      expect.toContain(result.stdout, 'hello e2b');
    })
    .test('执行命令返回退出码', async () => {
      const result = await sandbox.exec('exit 42');
      expect.toEqual(result.code, 42, '退出码应为 42');
    })
    .test('执行多行命令', async () => {
      const result = await sandbox.exec('echo "line1" && echo "line2"');
      expect.toEqual(result.code, 0);
      expect.toContain(result.stdout, 'line1');
      expect.toContain(result.stdout, 'line2');
    })
    .test('文件写入与读取', async () => {
      const testContent = 'E2B test content: ' + Date.now();
      await sandbox.fs.write('test-file.txt', testContent);
      const readBack = await sandbox.fs.read('test-file.txt');
      expect.toEqual(readBack.trim(), testContent);
    })
    .test('文件写入嵌套目录', async () => {
      const content = 'nested content';
      await sandbox.fs.write('deep/nested/dir/file.txt', content);
      const readBack = await sandbox.fs.read('deep/nested/dir/file.txt');
      expect.toEqual(readBack.trim(), content);
    })
    .test('文件 stat 获取修改时间', async () => {
      await sandbox.fs.write('stat-test.txt', 'stat test');
      const info = await sandbox.fs.stat('stat-test.txt');
      expect.toBeTruthy(info.mtimeMs > 0, 'mtimeMs 应大于 0');
    })
    .test('glob 匹配文件 (*.txt)', async () => {
      // 创建测试文件
      await sandbox.fs.write('glob-a.txt', 'a');
      await sandbox.fs.write('glob-b.txt', 'b');
      await sandbox.fs.write('glob-c.js', 'c');

      const results = await sandbox.fs.glob('*.txt');
      expect.toBeTruthy(results.length >= 2, '应至少匹配 2 个 .txt 文件');
      const hasTxt = results.every((r: string) => r.endsWith('.txt'));
      expect.toBeTruthy(hasTxt, '所有结果应以 .txt 结尾');
      const hasJs = results.some((r: string) => r.endsWith('.js'));
      expect.toBeFalsy(hasJs, '不应包含 .js 文件');
    })
    .test('glob 匹配嵌套目录 (**/*.txt)', async () => {
      await sandbox.fs.write('sub/glob-deep.txt', 'deep');
      const results = await sandbox.fs.glob('**/*.txt');
      const hasDeep = results.some((r: string) => r.includes('sub/glob-deep.txt'));
      expect.toBeTruthy(hasDeep, '应匹配嵌套目录中的文件');
    })
    .test('resolve 路径解析（相对路径）', async () => {
      const resolved = sandbox.fs.resolve('foo/bar.ts');
      expect.toEqual(resolved, '/home/user/foo/bar.ts');
    })
    .test('resolve 路径解析（绝对路径）', async () => {
      const resolved = sandbox.fs.resolve('/tmp/test.ts');
      expect.toEqual(resolved, '/tmp/test.ts');
    })
    .test('isInside 始终返回 true', async () => {
      expect.toEqual(sandbox.fs.isInside('/any/path'), true);
      expect.toEqual(sandbox.fs.isInside('../outside'), true);
    })
    .test('temp 生成临时路径', async () => {
      const p = sandbox.fs.temp('my-file');
      expect.toContain(p, '/tmp/');
      expect.toContain(p, 'my-file');
    })
    .test('getHostUrl 返回 HTTPS URL', async () => {
      const url = sandbox.getHostUrl(3000);
      expect.toBeTruthy(url.startsWith('https://'), 'URL 应以 https:// 开头');
    })
    .test('exec 超时处理', async () => {
      const result = await sandbox.exec('sleep 10', { timeoutMs: 2000 });
      // 超时应返回非 0 退出码或错误
      expect.toBeTruthy(result.code !== 0 || result.stderr.length > 0, '超时应产生错误');
    });
}

export async function run() {
  return await runner.run();
}

if (require.main === module) {
  run().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
