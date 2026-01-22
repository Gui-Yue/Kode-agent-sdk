# Quickstart

Build your first Agent in 5 minutes.

## Prerequisites

- Completed [Installation](./installation.md)
- Set `ANTHROPIC_API_KEY` environment variable

## Step 1: Create an Agent

```typescript
import { Agent, AnthropicProvider, JSONStore } from '@shareai-lab/kode-sdk';

// Create provider
const provider = new AnthropicProvider(
  process.env.ANTHROPIC_API_KEY!,
  process.env.ANTHROPIC_MODEL_ID  // optional, uses default if not set
);

// Create agent
const agent = await Agent.create({
  provider,
  store: new JSONStore('./.kode'),
  systemPrompt: 'You are a helpful assistant.'
});
```

## Step 2: Subscribe to Events

```typescript
// Subscribe to progress events (text streaming) using subscribe()
for await (const envelope of agent.subscribe(['progress'])) {
  switch (envelope.event.type) {
    case 'text_chunk':
      process.stdout.write(envelope.event.delta);
      break;
    case 'done':
      console.log('\n--- Message complete ---');
      break;
  }
  if (envelope.event.type === 'done') break;
}

// Subscribe to control events using on()
agent.on('permission_required', async (event) => {
  console.log(`Tool ${event.call.name} needs approval`);
  // Auto-approve for demo
  await event.respond('allow');
});
```

## Step 3: Send a Message

```typescript
await agent.send('Hello! What can you help me with?');
```

## Complete Example

```typescript
// getting-started.ts
import 'dotenv/config';
import { Agent, AnthropicProvider, JSONStore, AgentTemplateRegistry, ToolRegistry, SandboxFactory } from '@shareai-lab/kode-sdk';

async function main() {
  const provider = new AnthropicProvider(
    process.env.ANTHROPIC_API_KEY!,
    process.env.ANTHROPIC_MODEL_ID
  );

  // Setup dependencies
  const store = new JSONStore('./.kode');
  const templates = new AgentTemplateRegistry();
  const tools = new ToolRegistry();
  const sandboxFactory = new SandboxFactory();

  templates.register({
    id: 'assistant',
    systemPrompt: 'You are a helpful assistant.',
  });

  const agent = await Agent.create(
    { templateId: 'assistant' },
    { store, templateRegistry: templates, toolRegistry: tools, sandboxFactory, modelFactory: () => provider }
  );

  // Subscribe to progress using async iterator
  const progressTask = (async () => {
    for await (const envelope of agent.subscribe(['progress'])) {
      if (envelope.event.type === 'text_chunk') {
        process.stdout.write(envelope.event.delta);
      }
      if (envelope.event.type === 'done') break;
    }
  })();

  await agent.send('Hello!');
  await progressTask;
  console.log('\n');
}

main().catch(console.error);
```

Run it:

```bash
npx ts-node getting-started.ts
```

## Using Built-in Tools

Add file system and bash tools:

```typescript
import { Agent, AnthropicProvider, JSONStore, builtin } from '@shareai-lab/kode-sdk';

const agent = await Agent.create({
  provider,
  store: new JSONStore('./.kode'),
  systemPrompt: 'You are a coding assistant.',
  tools: [
    ...builtin.fs(),    // fs_read, fs_write, fs_edit, fs_glob, fs_grep
    ...builtin.bash(),  // bash_run, bash_logs, bash_kill
    ...builtin.todo(),  // todo_read, todo_write
  ]
});
```

## Next Steps

- [Concepts](./concepts.md) - Understand Agent, Events, Tools
- [Events Guide](../guides/events.md) - Master the three-channel system
- [Tools Guide](../guides/tools.md) - Learn about built-in and custom tools
