/**
 * OperationQueue 单元测试
 */

import { OperationQueue, OperationType, OperationStatus, OperationTask } from '../../../../src/core/skills/operation-queue';
import { TestRunner, expect } from '../../../helpers/utils';

const runner = new TestRunner('OperationQueue');

runner
  .test('FIFO队列执行顺序', async () => {
    const queue = new OperationQueue();
    const executionOrder: string[] = [];

    // 创建3个任务，记录执行顺序
    const task1: OperationTask = {
      id: '1',
      type: OperationType.CREATE,
      targetSkill: 'skill1',
      status: OperationStatus.PENDING,
      execute: async () => {
        executionOrder.push('task1');
        await new Promise(resolve => setTimeout(resolve, 10));
      },
      createdAt: new Date(),
    };

    const task2: OperationTask = {
      id: '2',
      type: OperationType.EDIT,
      targetSkill: 'skill2',
      status: OperationStatus.PENDING,
      execute: async () => {
        executionOrder.push('task2');
        await new Promise(resolve => setTimeout(resolve, 10));
      },
      createdAt: new Date(),
    };

    const task3: OperationTask = {
      id: '3',
      type: OperationType.DELETE,
      targetSkill: 'skill3',
      status: OperationStatus.PENDING,
      execute: async () => {
        executionOrder.push('task3');
      },
      createdAt: new Date(),
    };

    // 入队所有任务
    await queue.enqueue(task1);
    await queue.enqueue(task2);
    await queue.enqueue(task3);

    // 等待所有任务完成
    await new Promise(resolve => setTimeout(resolve, 100));

    // 验证执行顺序为FIFO
    expect.toEqual(executionOrder.length, 3);
    expect.toEqual(executionOrder[0], 'task1');
    expect.toEqual(executionOrder[1], 'task2');
    expect.toEqual(executionOrder[2], 'task3');
  })

  .test('任务状态更新', async () => {
    const queue = new OperationQueue();
    const task: OperationTask = {
      id: 'test-task',
      type: OperationType.CREATE,
      targetSkill: 'test-skill',
      status: OperationStatus.PENDING,
      execute: async () => {
        // 模拟执行
        await new Promise(resolve => setTimeout(resolve, 5));
      },
      createdAt: new Date(),
    };

    expect.toEqual(task.status, OperationStatus.PENDING);

    await queue.enqueue(task);

    // 等待任务完成
    await new Promise(resolve => setTimeout(resolve, 50));

    expect.toEqual(task.status, OperationStatus.COMPLETED);
    expect.toBeTruthy(task.completedAt);
    expect.toBeTruthy(task.startedAt);
  })

  .test('任务失败处理', async () => {
    const queue = new OperationQueue();
    const error = new Error('Task failed');
    const task: OperationTask = {
      id: 'failing-task',
      type: OperationType.DELETE,
      targetSkill: 'failing-skill',
      status: OperationStatus.PENDING,
      execute: async () => {
        throw error;
      },
      createdAt: new Date(),
    };

    await queue.enqueue(task);

    // 等待任务完成
    await new Promise(resolve => setTimeout(resolve, 50));

    expect.toEqual(task.status, OperationStatus.FAILED);
    expect.toEqual(task.error, error);
    expect.toBeTruthy(task.completedAt);
  })

  .test('队列状态查询', async () => {
    const queue = new OperationQueue();

    // 初始状态
    let status = queue.getQueueStatus();
    expect.toEqual(status.length, 0);
    expect.toBeFalsy(status.processing);

    // 添加任务
    const task: OperationTask = {
      id: 'status-task',
      type: OperationType.CREATE,
      targetSkill: 'status-skill',
      status: OperationStatus.PENDING,
      execute: async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
      },
      createdAt: new Date(),
    };

    await queue.enqueue(task);

    // 任务执行中
    status = queue.getQueueStatus();
    expect.toBeTruthy(status.processing);

    // 等待任务完成
    await new Promise(resolve => setTimeout(resolve, 100));

    // 任务完成后
    status = queue.getQueueStatus();
    expect.toEqual(status.length, 0);
    expect.toBeFalsy(status.processing);
  })

  .test('清空队列', async () => {
    const queue = new OperationQueue();

    // 添加多个任务
    const task1: OperationTask = {
      id: '1',
      type: OperationType.CREATE,
      targetSkill: 'skill1',
      status: OperationStatus.PENDING,
      execute: async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      },
      createdAt: new Date(),
    };

    const task2: OperationTask = {
      id: '2',
      type: OperationType.CREATE,
      targetSkill: 'skill2',
      status: OperationStatus.PENDING,
      execute: async () => {},
      createdAt: new Date(),
    };

    await queue.enqueue(task1);
    await queue.enqueue(task2);

    // 清空队列
    queue.clear();

    const status = queue.getQueueStatus();
    expect.toEqual(status.length, 0);
  })

  .test('并发任务串行执行', async () => {
    const queue = new OperationQueue();
    let concurrentCount = 0;
    let maxConcurrent = 0;

    const createSlowTask = (id: string): OperationTask => ({
      id,
      type: OperationType.EDIT,
      targetSkill: `skill${id}`,
      status: OperationStatus.PENDING,
      execute: async () => {
        concurrentCount++;
        if (concurrentCount > maxConcurrent) {
          maxConcurrent = concurrentCount;
        }
        await new Promise(resolve => setTimeout(resolve, 20));
        concurrentCount--;
      },
      createdAt: new Date(),
    });

    // 快速添加多个任务
    await Promise.all([
      queue.enqueue(createSlowTask('1')),
      queue.enqueue(createSlowTask('2')),
      queue.enqueue(createSlowTask('3')),
    ]);

    // 等待所有任务完成
    await new Promise(resolve => setTimeout(resolve, 200));

    // 验证最大并发数为1（串行执行）
    expect.toEqual(maxConcurrent, 1);
    expect.toEqual(concurrentCount, 0);
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
