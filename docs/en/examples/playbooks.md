# Playbooks: Common Scenario Scripts

This page breaks down the most common usage scenarios from a practical perspective, providing mental maps, key APIs, example files, and considerations. Example code is in the `examples/` directory and can be run directly with `ts-node`.

---

## 1. Collaborative Inbox (Event-Driven UI)

- **Goal**: Persistent single Agent, UI displays text/tool progress via Progress stream, Monitor for lightweight alerts.
- **Example**: `examples/01-agent-inbox.ts`
- **Run**: `npm run example:agent-inbox`
- **Key Steps**:
  1. `Agent.create` + `agent.subscribe(['progress'])` pushes text increments.
  2. Use `bookmark` / `cursor` for checkpoint replay.
  3. `agent.on('tool_executed')` / `agent.on('error')` writes governance events to logs or monitoring.
  4. `agent.todoManager` for auto-reminders, UI can display Todo panel.
- **Considerations**:
  - Expose Progress stream to frontend via SSE/WebSocket.
  - Enable `exposeThinking` in template metadata if UI needs thinking process.

```typescript
// Basic event subscription
for await (const envelope of agent.subscribe(['progress'])) {
  if (envelope.event.type === 'text_chunk') {
    process.stdout.write(envelope.event.delta);
  }
  if (envelope.event.type === 'done') {
    break;
  }
}
```

---

## 2. Tool Approval & Governance

- **Goal**: Approval for sensitive tools (e.g., `bash_run`, database writes); combine with Hooks for policy guards.
- **Example**: `examples/02-approval-control.ts`
- **Run**: `npm run example:approval`
- **Key Steps**:
  1. Configure `permission` in template (e.g., `mode: 'approval'` + `requireApprovalTools`).
  2. Subscribe to `agent.on('permission_required')`, push approval tasks to business system.
  3. Approval UI calls `agent.decide(id, 'allow' | 'deny', note)`.
  4. Combine with `HookManager`'s `preToolUse` / `postToolUse` for finer-grained policies (path guards, result truncation).
- **Considerations**:
  - Agent is at `AWAITING_APPROVAL` breakpoint during approval; SDK auto-resumes after decision.
  - Denying a tool automatically writes `tool_result`, UI can prompt retry strategies.

```typescript
// Permission configuration
const template = {
  id: 'secure-runner',
  permission: {
    mode: 'approval',
    requireApprovalTools: ['bash_run'],
  },
  // Hook for additional guards
  hooks: {
    preToolUse(call) {
      if (call.name === 'bash_run' && /rm -rf|sudo/.test(call.args.cmd)) {
        return { decision: 'deny', reason: 'Command matches forbidden keywords' };
      }
    },
  },
};

// Approval handling
agent.on('permission_required', async (event) => {
  const decision = await getApprovalFromAdmin(event.call);
  await event.respond(decision, { note: 'Approved by admin' });
});
```

---

## 3. Multi-Agent Team Collaboration

- **Goal**: One Planner coordinates multiple Specialists, all Agents persistent and forkable.
- **Example**: `examples/03-room-collab.ts`
- **Run**: `npm run example:room`
- **Key Steps**:
  1. Use singleton `AgentPool` to manage Agent lifecycle (`create` / `resume` / `fork`).
  2. Use `Room` for broadcast/mention messages; messages use `[from:name]` pattern for collaboration.
  3. Sub-Agents launched via `task_run` tool or explicit `pool.create`.
  4. Use `agent.snapshot()` + `agent.fork()` to fork at Safe-Fork-Points.
- **Considerations**:
  - Template's `runtime.subagents` can limit dispatchable templates and depth.
  - Persist lineage (SDK writes to metadata by default) for audit and replay.
  - Disable `watchFiles` in template if not monitoring external files.

```typescript
const pool = new AgentPool({ dependencies: deps, maxAgents: 10 });
const room = new Room(pool);

const planner = await pool.create('agt-planner', { templateId: 'planner', ... });
const dev = await pool.create('agt-dev', { templateId: 'executor', ... });

room.join('planner', planner.agentId);
room.join('dev', dev.agentId);

// Broadcast to room
await room.say('planner', 'Hi team, let us audit the repository. @dev please execute.');
await room.say('dev', 'Acknowledged, working on it.');
```

---

## 4. Scheduling & System Reminders

- **Goal**: Agent executes periodic tasks, monitors file changes, sends system reminders during long-running operations.
- **Example**: `examples/04-scheduler-watch.ts`
- **Run**: `npm run example:scheduler`
- **Key Steps**:
  1. `const scheduler = agent.schedule(); scheduler.everySteps(N, callback)` registers step triggers.
  2. Use `agent.remind(text, options)` for system-level reminders (via Monitor, doesn't pollute Progress).
  3. FilePool monitors written files by default, combine `monitor.file_changed` with `scheduler.notifyExternalTrigger` for auto-response.
  4. Todo with `remindIntervalSteps` for periodic reviews.
- **Considerations**:
  - Keep scheduled tasks idempotent, follow event-driven principles.
  - For high-frequency tasks, combine with external Cron and call `scheduler.notifyExternalTrigger`.

---

## 5. Database Persistence

- **Goal**: Persist Agent state to SQLite or PostgreSQL for production deployments.
- **Example**: `examples/db-sqlite.ts`, `examples/db-postgres.ts`
- **Key Steps**:
  1. Use `createExtendedStore` factory function to create store.
  2. Pass store to Agent dependencies.
  3. Use Query APIs for session management and analytics.

```typescript
import { createExtendedStore, SqliteStore } from '@shareai-lab/kode-sdk';

// Create SQLite store
const store = createExtendedStore({
  type: 'sqlite',
  dbPath: './data/agents.db',
  fileStoreBaseDir: './data/files',
}) as SqliteStore;

// Use with Agent
const agent = await Agent.create(
  { templateId: 'my-agent', ... },
  { store, ... }
);

// Query APIs
const sessions = await store.querySessions({ limit: 10 });
const stats = await store.aggregateStats(agent.agentId);
```

---

## 6. Combined: Approval + Collaboration + Scheduling

- **Scenario**: Code review bot, Planner splits tasks and assigns to Specialists, tool operations need approval, scheduled reminders ensure SLA.
- **Implementation**:
  1. **Planner template**: Has `task_run` tool and scheduling hooks, auto-patrol each morning.
  2. **Specialist template**: Focuses on `fs_*` + `todo_*` tools, approval only for `bash_run`.
  3. **Unified approval service**: Listens to all Agent Control events, integrates with enterprise IM/approval workflow.
  4. **Room collaboration**: Planner delivers tasks via `@executor`, executor reports back via `@planner`.
  5. **SLA monitoring**: Monitor events feed into observability pipeline (Prometheus/ELK/Datadog).
  6. **Scheduled reminders**: Use Scheduler to periodically check todos or external system signals.

---

## Quick API Reference

| Category | API |
|----------|-----|
| Events | `agent.subscribe(['progress'])`, `agent.on('error', handler)`, `agent.on('tool_executed', handler)` |
| Approval | `permission_required` → `event.respond()` / `agent.decide()` |
| Multi-Agent | `new AgentPool({ dependencies, maxAgents })`, `const room = new Room(pool)` |
| Fork | `const snapshot = await agent.snapshot(); const fork = await agent.fork(snapshot);` |
| Scheduling | `agent.schedule().everySteps(10, ...)`, `scheduler.notifyExternalTrigger(...)` |
| Todo | `agent.getTodos()` / `agent.setTodos()` / `todo_read` / `todo_write` |
| Database | `createExtendedStore({ type: 'sqlite', ... })`, `store.querySessions()` |

---

## References

- [Getting Started](../getting-started/quickstart.md)
- [Events Guide](../guides/events.md)
- [Multi-Agent Systems](../advanced/multi-agent.md)
- [Database Guide](../guides/database.md)
