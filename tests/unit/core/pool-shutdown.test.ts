/**
 * Tests for AgentPool graceful shutdown functionality
 */

import path from 'path';
import fs from 'fs';
import os from 'os';
import {
  AgentPool,
  JSONStore,
  SandboxFactory,
  AgentTemplateRegistry,
  ToolRegistry,
  AgentConfig,
} from '../../../src';
import { Agent } from '../../../src/core/agent';
import { MockProvider } from '../../mock-provider';
import { TestRunner, expect } from '../../helpers/utils';

const runner = new TestRunner('AgentPool Graceful Shutdown');

let pool: AgentPool;
let store: JSONStore;
let testDir: string;

function createMockAgent(state: 'READY' | 'WORKING' | 'PAUSED' = 'READY') {
  let interruptCalled = false;
  return {
    status: async () => ({ state }),
    interrupt: async (_opts?: { note?: string }) => {
      interruptCalled = true;
    },
    get interruptCalled() {
      return interruptCalled;
    },
  } as unknown as Agent & { interruptCalled: boolean };
}

async function setupPool() {
  testDir = path.join(os.tmpdir(), `kode-pool-test-${Date.now()}`);
  fs.mkdirSync(testDir, { recursive: true });
  store = new JSONStore(testDir);

  const templates = new AgentTemplateRegistry();
  const tools = new ToolRegistry();
  const sandboxFactory = new SandboxFactory();

  templates.register({
    id: 'test-agent',
    systemPrompt: 'Test agent',
  });

  pool = new AgentPool({
    dependencies: {
      store,
      templateRegistry: templates,
      sandboxFactory,
      toolRegistry: tools,
      modelFactory: () => new MockProvider([{ text: 'Hello!' }]),
    },
    maxAgents: 10,
  });
}

function cleanupPool() {
  try {
    fs.rmSync(testDir, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors
  }
}

runner
  .beforeEach(setupPool)
  .afterEach(cleanupPool)

  .test('gracefulShutdown - should return empty result when pool is empty', async () => {
    const result = await pool.gracefulShutdown();

    expect.toDeepEqual(result.completed, []);
    expect.toDeepEqual(result.interrupted, []);
    expect.toDeepEqual(result.failed, []);
    expect.toBeGreaterThanOrEqual(result.durationMs, 0);
  })

  .test('gracefulShutdown - should save running agents list when saveRunningList is true', async () => {
    const mockAgent = createMockAgent('READY');
    (pool as any).agents.set('test-agent-1', mockAgent);

    const result = await pool.gracefulShutdown({ saveRunningList: true });

    expect.toContain(result.completed, 'test-agent-1');

    // Verify running agents list was saved
    const savedInfo = await store.loadInfo('__pool_meta__');
    expect.toBeTruthy(savedInfo);
    expect.toContain((savedInfo as any).runningAgents.agentIds, 'test-agent-1');
  })

  .test('gracefulShutdown - should not save running agents list when saveRunningList is false', async () => {
    const mockAgent = createMockAgent('READY');
    (pool as any).agents.set('test-agent-2', mockAgent);

    await pool.gracefulShutdown({ saveRunningList: false });

    // Verify running agents list was NOT saved
    const savedInfo = await store.loadInfo('__pool_meta__');
    expect.toBeFalsy(savedInfo);
  })

  .test('gracefulShutdown - should interrupt working agents after timeout', async () => {
    const mockAgent = createMockAgent('WORKING');
    (pool as any).agents.set('working-agent', mockAgent);

    const result = await pool.gracefulShutdown({
      timeout: 100, // Very short timeout
      forceInterrupt: true,
    });

    expect.toBeTruthy(mockAgent.interruptCalled);
    expect.toContain(result.interrupted, 'working-agent');
  })

  .test('resumeFromShutdown - should return empty array when no running agents list exists', async () => {
    const configFactory = (agentId: string): AgentConfig => ({
      agentId,
      templateId: 'test-agent',
    });

    const resumed = await pool.resumeFromShutdown(configFactory);

    expect.toDeepEqual(resumed, []);
  })

  .test('resumeFromShutdown - should clear running agents list after resume', async () => {
    // Manually save a running agents list
    await store.saveInfo('__pool_meta__', {
      agentId: '__pool_meta__',
      templateId: '__pool_meta__',
      createdAt: new Date().toISOString(),
      runningAgents: {
        agentIds: ['non-existent-agent'],
        shutdownAt: new Date().toISOString(),
        version: '1.0.0',
      },
    } as any);

    const configFactory = (agentId: string): AgentConfig => ({
      agentId,
      templateId: 'test-agent',
    });

    // Resume will fail for non-existent agent, but should still clear the list
    await pool.resumeFromShutdown(configFactory);

    // Verify the list was cleared
    const savedInfo = await store.loadInfo('__pool_meta__');
    expect.toBeFalsy(savedInfo);
  })

  .test('registerShutdownHandlers - should register SIGTERM and SIGINT handlers', async () => {
    const handlers: Map<string, Function> = new Map();
    const originalOn = process.on.bind(process);

    // Mock process.on
    (process as any).on = (event: string, handler: Function) => {
      handlers.set(event, handler);
      return process;
    };

    try {
      pool.registerShutdownHandlers();

      expect.toBeTruthy(handlers.has('SIGTERM'));
      expect.toBeTruthy(handlers.has('SIGINT'));
    } finally {
      // Restore original
      (process as any).on = originalOn;
    }
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
