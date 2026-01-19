# Skills 系统

KODE SDK 提供了一个完整的Skills系统，支持模块化、可重用的能力单元，使Agent能够动态加载和执行特定技能。

## 核心特性

- **热重载 (Hot Reload)**：Skills代码修改后自动重新加载，无需重启Agent
- **元数据注入**：自动将技能描述注入到系统提示，提升AI理解
- **沙箱隔离**：每个技能有独立的文件系统空间
- **操作队列**：确保技能更新的原子性
- **白名单机制**：支持选择性加载特定技能
- **中文友好**：支持中文名称和描述

## Skills 目录结构

```
skills/
├── skill-name/              # 技能目录
│   ├── SKILL.md            # 技能定义（必需）
│   ├── metadata.json       # 技能元数据（可选）
│   ├── references/         # 参考资料
│   ├── scripts/            # 可执行脚本
│   └── assets/             # 静态资源
└── .archived/              # 已归档技能
    └── archived-skill/
```

### SKILL.md 格式

```markdown
<!-- skill: skill-name -->
<!-- version: 1.0.0 -->
<!-- author: Your Name -->

# 技能名称

简短描述技能的功能。

## 使用场景

- 场景1
- 场景2

## 使用指南

使用此技能的详细说明...
```

### metadata.json 格式

```json
{
  "name": "skill-name",
  "description": "技能描述",
  "version": "1.0.0",
  "author": "作者",
  "baseDir": "/path/to/skill"
}
```

## Agent运行时使用 (SkillsManager)

SkillsManager是Agent在运行时使用的技能管理器，支持热更新和动态加载。

### 基本用法

```typescript
import { SkillsManager } from '@kode/sdk';

// 创建Skills管理器
const skillsManager = new SkillsManager(
  './skills',  // 技能目录路径
  ['skill1', 'skill2']  // 可选：白名单
);

// 扫描所有技能
const skills = await skillsManager.getSkillsMetadata();
console.log(`Found ${skills.length} skills`);

// 加载特定技能内容
const skillContent = await skillsManager.loadSkillContent('skill-name');
if (skillContent) {
  console.log('Metadata:', skillContent.metadata);
  console.log('Content:', skillContent.content);
  console.log('References:', skillContent.references);
  console.log('Scripts:', skillContent.scripts);
}
```

### 热更新机制

SkillsManager每次调用都会重新扫描文件系统，确保数据最新：

```typescript
// 每次调用都会重新扫描
await skillsManager.getSkillsMetadata();  // 扫描1
// ... 修改文件 ...
await skillsManager.getSkillsMetadata();  // 扫描2，获取最新数据
```

### 白名单过滤

通过白名单机制，可以限制Agent只加载特定技能：

```typescript
// 只加载白名单中的技能
const manager = new SkillsManager('./skills', ['allowed-skill-1', 'allowed-skill-2']);

const skills = await manager.getSkillsMetadata();
// 只返回白名单中的技能
```

### 环境变量配置

可以通过环境变量配置技能目录：

```bash
export SKILLS_DIR=/path/to/skills
```

```typescript
// 自动使用 SKILLS_DIR 环境变量
const manager = new SkillsManager();
```

## 技能管理 (SkillsManagementManager)

SkillsManagementManager提供技能的CRUD操作，包括创建、更新、归档等。

### 基本操作

```typescript
import { SkillsManagementManager } from '@kode/sdk';

const manager = new SkillsManagementManager('./skills');

// 列出所有在线技能
const skills = await manager.listSkills();

// 获取技能详细信息
const skillDetail = await manager.getSkillInfo('skill-name');

// 创建新技能
await manager.createSkill('new-skill', {
  description: '新技能描述',
  content: '# 新技能\n\n详细内容...'
});

// 更新技能
await manager.updateSkill('skill-name', {
  content: '# 更新后的内容'
});

// 删除技能（移动到归档）
await manager.deleteSkill('skill-name');

// 列出已归档技能
const archived = await manager.listArchivedSkills();

// 恢复已归档技能
await manager.restoreSkill('archived-skill');
```

### 文件操作

```typescript
// 获取技能文件树
const files = await manager.getSkillFileTree('skill-name');

// 读取技能文件
const content = await manager.readSkillFile('skill-name', 'SKILL.md');

// 写入技能文件
await manager.writeSkillFile('skill-name', 'references/doc.md', '内容');

// 删除技能文件
await manager.deleteSkillFile('skill-name', 'references/old-doc.md');

// 上传文件到技能目录
await manager.uploadSkillFile('skill-name', 'assets/image.png', fileBuffer);
```

## Agent集成

### 注册Skills工具

```typescript
import { Agent, builtin } from '@kode/sdk';
import { createSkillsTool } from '@kode/sdk';
import { SkillsManager } from '@kode/sdk';

const deps = createDependencies();

// 创建Skills管理器
const skillsManager = new SkillsManager('./skills');

// 注册Skills工具
const skillsTool = createSkillsTool(skillsManager);
deps.toolRegistry.register('skills', () => skillsTool);

// 创建Agent
const agent = await Agent.create({
  templateId: 'my-agent',
  tools: ['skills', 'fs_read', 'fs_write'],
}, deps);
```

### 元数据自动注入

Agent会自动收集所有工具的prompt并注入到系统提示中：

```typescript
// Agent内部自动执行
const toolPrompts = this.tools
  .map(tool => tool.descriptor.prompt)
  .filter(Boolean);

const manual = `\n\n### Tools Manual\n\n${toolPrompts.join('\n\n')}`;
this.template.systemPrompt += manual;

// 触发 Monitor 事件
this.events.emitMonitor({
  channel: 'monitor',
  type: 'tool_manual_updated',
  tools: this.tools.map(t => t.descriptor.name),
  timestamp: Date.now()
});
```

### Skills工具使用

Agent可以通过`skills`工具动态加载技能：

```
用户: 我需要处理代码格式化

Agent: 我来加载代码格式化技能。

[调用 skills 工具，action=load, skill_name=code-formatter]

Agent: 已加载代码格式化技能。现在我可以帮你格式化代码了。
```

## 沙箱文件隔离

每个技能的文件操作都在独立的沙箱环境中进行：

```typescript
// SandboxFileManager 确保技能文件隔离
const sandboxFileManager = new SandboxFileManager(sandboxFactory);

// 技能文件读写都在沙箱中
await sandboxFileManager.readFile(skillPath, 'SKILL.md');
await sandboxFileManager.writeFile(skillPath, 'references/doc.md', content);
```

## 操作队列

SkillsManagementManager使用操作队列确保更新的原子性：

```typescript
// OperationQueue 确保操作顺序
await operationQueue.enqueue({
  type: OperationType.Update,
  skillName,
  data: updateData,
});

// 同一技能的更新会排队执行
await operationQueue.enqueue({
  type: OperationType.Update,
  skillName,
  data: anotherUpdateData,  // 等待上一个更新完成
});
```

## 最佳实践

### 1. 技能设计原则

- **单一职责**：每个技能只做一件事
- **可组合**：技能之间可以互相调用
- **文档完整**：提供清晰的使用说明
- **版本控制**：使用语义化版本号

### 2. 热更新利用

```typescript
// 定期刷新技能列表
setInterval(async () => {
  const skills = await skillsManager.getSkillsMetadata();
  console.log('Skills updated:', skills.length);
}, 60000);  // 每分钟刷新
```

### 3. 白名单管理

```typescript
// 生产环境使用白名单
const allowedSkills = ['safe-skill-1', 'safe-skill-2'];
const manager = new SkillsManager('./skills', allowedSkills);

// 开发环境加载所有技能
const devManager = new SkillsManager('./skills');
```

### 4. 错误处理

```typescript
// 处理技能加载失败
const content = await skillsManager.loadSkillContent('skill-name');
if (!content) {
  console.error('Skill not found or failed to load');
  // 降级处理
}
```

## 高级特性

### 1. 技能归档

不再使用的技能可以归档而不是删除：

```typescript
// 归档技能
await manager.deleteSkill('old-skill');  // 移动到 .archived/

// 查看已归档技能
const archived = await manager.listArchivedSkills();

// 恢复技能
await manager.restoreSkill('old-skill');  // 从 .archived/ 移回
```

### 2. 技能依赖

技能可以引用其他技能的资源：

```markdown
# Main Skill

参见 [参考文档](references/shared-knowledge.md) 了解更多。

使用脚本：
- `scripts/setup.sh` - 环境配置
- `scripts/deploy.sh` - 部署脚本
```

### 3. 动态技能加载

Agent可以根据需要动态加载技能：

```
用户: 我需要分析日志

Agent: [检测到需要日志分析技能]
[调用 skills 工具加载 log-analyzer]
[使用日志分析技能处理任务]
```

## 监控与调试

### Monitor事件

```typescript
// 监听技能工具调用
agent.onMonitor('tool_executed', (event) => {
  if (event.call.name === 'skills') {
    console.log('Skill loaded:', event.call.input.skill_name);
  }
});

// 监听工具说明书更新
agent.onMonitor('tool_manual_updated', (event) => {
  console.log('Tools manual updated:', event.tools);
});
```

### 日志输出

Skills系统会输出详细的日志信息：

```
[SkillsManager] Initialized with skills directory: ./skills
[SkillsManager] Scanned 5 skill(s)
[SkillsManagementManager] Created skill: new-skill
[SandboxFileManager] Reading file: skills/new-skill/SKILL.md
```

## 性能优化

### 1. 缓存策略

```typescript
// 首次扫描会缓存元数据
await skillsManager.getSkillsMetadata();  // 扫描文件系统

// 后续调用使用缓存（如果文件未变化）
await skillsManager.getSkillsMetadata();  // 快速返回
```

### 2. 按需加载

```typescript
// 只加载需要的技能
const content = await skillsManager.loadSkillContent('specific-skill');
// 而不是加载所有技能
```

### 3. 并发扫描

```typescript
// 并发扫描多个技能目录
const [skills1, skills2] = await Promise.all([
  manager1.getSkillsMetadata(),
  manager2.getSkillsMetadata(),
]);
```

## 故障排除

### 常见问题

1. **技能未找到**
   - 检查技能目录路径是否正确
   - 确认SKILL.md文件存在
   - 检查白名单配置

2. **热更新不生效**
   - 确认文件保存成功
   - 检查文件系统权限
   - 查看日志确认扫描时间

3. **沙箱权限错误**
   - 检查沙箱工作目录配置
   - 确认文件路径在允许范围内
   - 查看沙箱日志

### 调试技巧

```typescript
// 启用详细日志
process.env.LOG_LEVEL = 'debug';

// 检查技能元数据
console.log(JSON.stringify(skills, null, 2));

// 验证技能目录
const fs = require('fs');
console.log(fs.readdirSync('./skills'));
```

## 相关文档

- [`tools.md`](./tools.md)：工具系统详解
- [`api.md`](./api.md)：API参考
- [`events.md`](./events.md)：事件系统
