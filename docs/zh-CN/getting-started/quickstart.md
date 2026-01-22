# 快速上手

5 分钟创建你的第一个 Agent。

## 前置条件

- 完成 [安装配置](./installation.md)
- 设置 `ANTHROPIC_API_KEY` 环境变量

## 第一步：创建 Agent

```typescript
import { Agent, AnthropicProvider, JSONStore } from '@shareai-lab/kode-sdk';

// 创建 Provider
const provider = new AnthropicProvider(
  process.env.ANTHROPIC_API_KEY!,
  process.env.ANTHROPIC_MODEL_ID  // 可选，不设置则使用默认值
);

// 创建 Agent
const agent = await Agent.create({
  provider,
  store: new JSONStore('./.kode'),
  systemPrompt: '你是一个乐于助人的助手。'
});
```

## 第二步：订阅事件

```typescript
// 使用 subscribe() 订阅 Progress 事件（文本流）
for await (const envelope of agent.subscribe(['progress'])) {
  switch (envelope.event.type) {
    case 'text_chunk':
      process.stdout.write(envelope.event.delta);
      break;
    case 'done':
      console.log('\n--- 消息完成 ---');
      break;
  }
  if (envelope.event.type === 'done') break;
}

// 使用 on() 订阅 Control 事件
agent.on('permission_required', async (event) => {
  console.log(`工具 ${event.call.name} 需要审批`);
  // 演示用：自动批准
  await event.respond('allow');
});
```

## 第三步：发送消息

```typescript
await agent.send('你好！有什么可以帮助你的？');
```

## 完整示例

```typescript
// getting-started.ts
import 'dotenv/config';
import { Agent, AnthropicProvider, JSONStore, AgentTemplateRegistry, ToolRegistry, SandboxFactory } from '@shareai-lab/kode-sdk';

async function main() {
  const provider = new AnthropicProvider(
    process.env.ANTHROPIC_API_KEY!,
    process.env.ANTHROPIC_MODEL_ID
  );

  // 设置依赖
  const store = new JSONStore('./.kode');
  const templates = new AgentTemplateRegistry();
  const tools = new ToolRegistry();
  const sandboxFactory = new SandboxFactory();

  templates.register({
    id: 'assistant',
    systemPrompt: '你是一个乐于助人的助手。',
  });

  const agent = await Agent.create(
    { templateId: 'assistant' },
    { store, templateRegistry: templates, toolRegistry: tools, sandboxFactory, modelFactory: () => provider }
  );

  // 使用异步迭代器订阅 progress
  const progressTask = (async () => {
    for await (const envelope of agent.subscribe(['progress'])) {
      if (envelope.event.type === 'text_chunk') {
        process.stdout.write(envelope.event.delta);
      }
      if (envelope.event.type === 'done') break;
    }
  })();

  await agent.send('你好！');
  await progressTask;
  console.log('\n');
}

main().catch(console.error);
```

运行：

```bash
npx ts-node getting-started.ts
```

## 使用内置工具

添加文件系统和 Bash 工具：

```typescript
import { Agent, AnthropicProvider, JSONStore, builtin } from '@shareai-lab/kode-sdk';

const agent = await Agent.create({
  provider,
  store: new JSONStore('./.kode'),
  systemPrompt: '你是一个编程助手。',
  tools: [
    ...builtin.fs(),    // fs_read, fs_write, fs_edit, fs_glob, fs_grep
    ...builtin.bash(),  // bash_run, bash_logs, bash_kill
    ...builtin.todo(),  // todo_read, todo_write
  ]
});
```

## 下一步

- [核心概念](./concepts.md) - 理解 Agent、事件、工具
- [事件系统](../guides/events.md) - 掌握三通道系统
- [工具系统](../guides/tools.md) - 学习内置和自定义工具
