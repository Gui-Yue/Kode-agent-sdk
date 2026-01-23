import {
  Agent,
  AgentConfig,
  AgentDependencies,
  AnthropicProvider,
  JSONStore,
  SandboxFactory,
  AgentTemplateRegistry,
  ToolRegistry,
  builtin,
} from '../../src';

async function runFsDemo() {
  const store = new JSONStore('./.kode');
  const templates = new AgentTemplateRegistry();
  const tools = new ToolRegistry();
  const sandboxFactory = new SandboxFactory();

  // Register builtin tools
  for (const tool of builtin.fs()) {
    tools.register(tool.name, () => tool);
  }
  for (const tool of builtin.bash()) {
    tools.register(tool.name, () => tool);
  }
  for (const tool of builtin.todo()) {
    tools.register(tool.name, () => tool);
  }

  templates.register({
    id: 'fs-demo',
    systemPrompt: 'Filesystem playground assistant',
    tools: ['fs_read', 'fs_write', 'fs_edit', 'fs_glob', 'fs_grep', 'fs_multi_edit'],
  });

  const deps: AgentDependencies = {
    store,
    templateRegistry: templates,
    sandboxFactory,
    toolRegistry: tools,
    modelFactory: (config) => new AnthropicProvider(config.apiKey || 'demo-key', config.model, config.baseUrl),
  };

  const config: AgentConfig = {
    templateId: 'fs-demo',
    modelConfig: { provider: 'anthropic', model: 'claude-3-5-sonnet-20241022', apiKey: 'demo-key' },
    sandbox: { kind: 'local', workDir: './workspace', enforceBoundary: true },
  };

  const agent = await Agent.create(config, deps);

  await agent.send('请使用 fs_glob 列出 src/**/*.ts 再用 fs_grep 找到包含 TODO 的文件');

  for await (const event of agent.stream('执行上述操作并总结结果')) {
    if (event.event.type === 'text_chunk') {
      process.stdout.write(event.event.delta);
    }
  }
}

runFsDemo().catch((error) => {
  console.error(error);
  process.exit(1);
});
