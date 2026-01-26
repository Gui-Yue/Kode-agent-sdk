import { TestRunner, expect } from '../../helpers/utils';
import { E2BSandbox } from '../../../src/infra/e2b/e2b-sandbox';

const runner = new TestRunner('E2BSandbox (Mock)');

// Mock E2B SDK instance
function createMockE2B() {
  const fileStore = new Map<string, string>();
  const processes: any[] = [];

  return {
    sandboxId: 'test-sandbox-123',
    files: {
      read: async (path: string) => {
        const content = fileStore.get(path);
        if (!content) throw new Error(`File not found: ${path}`);
        return content;
      },
      write: async (path: string, content: string) => {
        fileStore.set(path, content);
      },
      getInfo: async (path: string) => {
        if (!fileStore.has(path)) throw new Error(`File not found: ${path}`);
        return { modifiedTime: new Date(1700000000000) };
      },
      list: async (dir: string) => {
        const entries: any[] = [];
        for (const key of fileStore.keys()) {
          if (key.startsWith(dir + '/')) {
            const relative = key.slice(dir.length + 1);
            const parts = relative.split('/');
            if (parts.length === 1) {
              entries.push({ name: parts[0], type: 'file' });
            }
          }
        }
        return entries;
      },
      watchDir: async (_dir: string, _cb: any, _opts?: any) => ({
        stop: async () => {},
      }),
    },
    commands: {
      run: async (cmd: string, _opts?: any) => {
        if (cmd.startsWith('mkdir -p')) {
          return { exitCode: 0, stdout: '', stderr: '' };
        }
        if (cmd === 'echo hello') {
          return { exitCode: 0, stdout: 'hello\n', stderr: '' };
        }
        if (cmd === 'exit 42') {
          const err: any = new Error('Command failed');
          err.exitCode = 42;
          err.stdout = '';
          err.stderr = 'exit 42';
          throw err;
        }
        if (cmd.startsWith('find')) {
          return { exitCode: 0, stdout: '', stderr: '' };
        }
        return { exitCode: 0, stdout: '', stderr: '' };
      },
    },
    getHost: (port: number) => `${port}-test-sandbox-123.e2b.app`,
    kill: async () => {},
    setTimeout: async (_ms: number) => {},
    isRunning: async () => true,
    // internal store reference for assertions
    _fileStore: fileStore,
  };
}

runner
  .test('kind 应该是 e2b', async () => {
    const sandbox = new E2BSandbox();
    expect.toEqual(sandbox.kind, 'e2b');
  })

  .test('默认 workDir 为 /home/user', async () => {
    const sandbox = new E2BSandbox();
    expect.toEqual(sandbox.workDir, '/home/user');
  })

  .test('自定义 workDir', async () => {
    const sandbox = new E2BSandbox({ workDir: '/workspace' });
    expect.toEqual(sandbox.workDir, '/workspace');
  })

  .test('未初始化时 getE2BInstance 抛出错误', async () => {
    const sandbox = new E2BSandbox();
    await expect.toThrow(async () => {
      sandbox.getE2BInstance();
    }, 'not initialized');
  })

  .test('init 后可获取 sandboxId', async () => {
    const sandbox = new E2BSandbox();
    const mockE2B = createMockE2B();
    (sandbox as any).e2b = mockE2B;
    expect.toEqual(sandbox.getSandboxId(), 'test-sandbox-123');
  })

  .test('getHostUrl 返回正确的 URL', async () => {
    const sandbox = new E2BSandbox();
    (sandbox as any).e2b = createMockE2B();
    const url = sandbox.getHostUrl(8080);
    expect.toEqual(url, 'https://8080-test-sandbox-123.e2b.app');
  })

  .test('exec 成功执行命令', async () => {
    const sandbox = new E2BSandbox();
    (sandbox as any).e2b = createMockE2B();
    const result = await sandbox.exec('echo hello');
    expect.toEqual(result.code, 0);
    expect.toEqual(result.stdout, 'hello\n');
    expect.toEqual(result.stderr, '');
  })

  .test('exec 处理命令失败', async () => {
    const sandbox = new E2BSandbox();
    (sandbox as any).e2b = createMockE2B();
    const result = await sandbox.exec('exit 42');
    expect.toEqual(result.code, 42);
    expect.toContain(result.stderr, 'exit 42');
  })

  .test('fs.read 读取文件', async () => {
    const sandbox = new E2BSandbox();
    const mockE2B = createMockE2B();
    (sandbox as any).e2b = mockE2B;
    mockE2B._fileStore.set('/home/user/test.txt', 'hello world');
    const content = await sandbox.fs.read('test.txt');
    expect.toEqual(content, 'hello world');
  })

  .test('fs.write 写入文件', async () => {
    const sandbox = new E2BSandbox();
    const mockE2B = createMockE2B();
    (sandbox as any).e2b = mockE2B;
    await sandbox.fs.write('output.txt', 'test content');
    expect.toEqual(mockE2B._fileStore.get('/home/user/output.txt'), 'test content');
  })

  .test('fs.stat 返回修改时间', async () => {
    const sandbox = new E2BSandbox();
    const mockE2B = createMockE2B();
    (sandbox as any).e2b = mockE2B;
    mockE2B._fileStore.set('/home/user/file.txt', 'data');
    const stat = await sandbox.fs.stat('file.txt');
    expect.toEqual(stat.mtimeMs, 1700000000000);
  })

  .test('watchFiles 返回 ID', async () => {
    const sandbox = new E2BSandbox();
    (sandbox as any).e2b = createMockE2B();
    const id = await sandbox.watchFiles(['test.txt'], () => {});
    expect.toContain(id, 'e2b-watch-');
  })

  .test('unwatchFiles 清理 watcher', async () => {
    const sandbox = new E2BSandbox();
    (sandbox as any).e2b = createMockE2B();
    const id = await sandbox.watchFiles(['test.txt'], () => {});
    sandbox.unwatchFiles(id);
    // Should not throw on duplicate unwatch
    sandbox.unwatchFiles(id);
  })

  .test('dispose 清理所有资源', async () => {
    const sandbox = new E2BSandbox();
    const mockE2B = createMockE2B();
    (sandbox as any).e2b = mockE2B;
    await sandbox.watchFiles(['a.txt'], () => {});
    await sandbox.dispose();
    expect.toEqual((sandbox as any).e2b, null);
  })

  .test('isRunning 返回沙箱状态', async () => {
    const sandbox = new E2BSandbox();
    (sandbox as any).e2b = createMockE2B();
    const running = await sandbox.isRunning();
    expect.toEqual(running, true);
  })

  .test('isRunning 在异常时返回 false', async () => {
    const sandbox = new E2BSandbox();
    (sandbox as any).e2b = {
      isRunning: async () => { throw new Error('network error'); },
    };
    const running = await sandbox.isRunning();
    expect.toEqual(running, false);
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
