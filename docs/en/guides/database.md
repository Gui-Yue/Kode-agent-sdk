# Database Persistence Guide

KODE SDK supports SQLite and PostgreSQL as persistence backends, providing high-performance querying, aggregation, and analysis capabilities.

---

## Supported Backends

| Backend | Use Case | Features |
|---------|----------|----------|
| SQLite | Development, Single Instance | Zero config, file-based |
| PostgreSQL | Production, Multi-Instance | Concurrent writes, JSONB queries |

---

## Environment Variables

<!-- tabs:start -->
#### **Linux / macOS**
```bash
# SQLite
export KODE_STORE_TYPE=sqlite
export KODE_SQLITE_PATH=./data/agents.db
export KODE_STORE_PATH=./data/store

# PostgreSQL
export KODE_STORE_TYPE=postgres
export POSTGRES_HOST=localhost
export POSTGRES_PORT=5432
export POSTGRES_DB=kode_agents
export POSTGRES_USER=kode
export POSTGRES_PASSWORD=your_password
```

#### **Windows (PowerShell)**
```powershell
# SQLite
$env:KODE_STORE_TYPE="sqlite"
$env:KODE_SQLITE_PATH="./data/agents.db"
$env:KODE_STORE_PATH="./data/store"

# PostgreSQL
$env:KODE_STORE_TYPE="postgres"
$env:POSTGRES_HOST="localhost"
$env:POSTGRES_PORT="5432"
$env:POSTGRES_DB="kode_agents"
$env:POSTGRES_USER="kode"
$env:POSTGRES_PASSWORD="your_password"
```

#### **Windows (CMD)**
```cmd
set KODE_STORE_TYPE=sqlite
set KODE_SQLITE_PATH=./data/agents.db
set KODE_STORE_PATH=./data/store
```
<!-- tabs:end -->

---

## Quick Start

### Using Factory Function (Recommended)

```typescript
import { createExtendedStore } from '@shareai-lab/kode-sdk';

// Auto-selects backend based on KODE_STORE_TYPE
const store = await createExtendedStore();

// Or specify backend explicitly
const sqliteStore = await createExtendedStore({
  type: 'sqlite',
  dbPath: './data/agents.db',
  fileStoreBaseDir: './data/store',
});

const postgresStore = await createExtendedStore({
  type: 'postgres',
  connection: {
    host: process.env.POSTGRES_HOST ?? 'localhost',
    port: parseInt(process.env.POSTGRES_PORT ?? '5432'),
    database: process.env.POSTGRES_DB ?? 'kode_agents',
    user: process.env.POSTGRES_USER ?? 'kode',
    password: process.env.POSTGRES_PASSWORD!,
  },
  fileStoreBaseDir: './data/store',
});
```

### Direct Class Usage

```typescript
import { SqliteStore, PostgresStore } from '@shareai-lab/kode-sdk';

// SQLite
const sqliteStore = new SqliteStore('./data/agents.db', './data/store');

// PostgreSQL
const postgresStore = new PostgresStore(
  {
    host: 'localhost',
    port: 5432,
    database: 'kode_agents',
    user: 'kode',
    password: 'password',
  },
  './data/store'
);
```

### Using with Agent

```typescript
import { Agent, createExtendedStore } from '@shareai-lab/kode-sdk';

const store = await createExtendedStore();

const agent = await Agent.create({
  provider,
  store,
  template: {
    id: 'assistant',
    systemPrompt: 'You are a helpful assistant.',
    tools: [],
  },
});

await agent.send('Hello!');

// Close database when done
await store.close();
```

---

## Query APIs

### Query Sessions: `querySessions()`

Query Agent session list with filtering and pagination.

```typescript
interface SessionQueryFilter {
  templateId?: string;      // Filter by template ID
  createdAfter?: Date;      // Created after date
  createdBefore?: Date;     // Created before date
  limit?: number;           // Max results (default: 100)
  offset?: number;          // Pagination offset (default: 0)
}

const sessions = await store.querySessions({
  templateId: 'chat-assistant',
  createdAfter: new Date('2025-01-01'),
  limit: 20,
});

sessions.forEach(session => {
  console.log({
    agentId: session.agentId,
    templateId: session.templateId,
    createdAt: session.createdAt,
    messageCount: session.messageCount,
  });
});
```

### Query Messages: `queryMessages()`

Query message records with filtering by role and content type.

```typescript
interface MessageQueryFilter {
  agentId?: string;
  role?: 'user' | 'assistant';
  contentType?: 'text' | 'tool_use' | 'tool_result';
  createdAfter?: Date;
  createdBefore?: Date;
  limit?: number;
  offset?: number;
}

const messages = await store.queryMessages({
  agentId: 'agt-abc123',
  role: 'assistant',
  contentType: 'tool_use',
  limit: 50,
});
```

### Query Tool Calls: `queryToolCalls()`

Query tool call records with filtering by tool name and error status.

```typescript
interface ToolCallQueryFilter {
  agentId?: string;
  toolName?: string;        // Filter by tool name
  isError?: boolean;        // Filter by error status
  hasApproval?: boolean;    // Filter by approval status
  createdAfter?: Date;
  createdBefore?: Date;
  limit?: number;
  offset?: number;
}

const toolCalls = await store.queryToolCalls({
  toolName: 'bash_run',
  isError: true,
  limit: 10,
});

toolCalls.forEach(call => {
  console.log({
    toolCallId: call.toolCallId,
    toolName: call.toolName,
    input: call.input,
    output: call.output,
    isError: call.isError,
    approval: call.approval,
  });
});
```

### Aggregate Stats: `aggregateStats()`

Aggregate statistics for an Agent including message counts and tool call metrics.

```typescript
const stats = await store.aggregateStats('agt-abc123');

console.log({
  totalMessages: stats.totalMessages,
  totalToolCalls: stats.totalToolCalls,
  totalSnapshots: stats.totalSnapshots,
  toolCallsByState: stats.toolCallsByState,  // { completed: 10, failed: 2, ... }
});

// Calculate success rate using toolCallsByState
if (stats.toolCallsByState) {
  const completed = stats.toolCallsByState['completed'] || 0;
  const successRate = (completed / stats.totalToolCalls * 100).toFixed(2);
  console.log(`Tool call success rate: ${successRate}%`);
}
```

---

## SQLite vs PostgreSQL

### Comparison

| Feature | SQLite | PostgreSQL |
|---------|--------|------------|
| **Deployment** | Single file, zero config | Requires database server |
| **Concurrent Writes** | Single process | Multi-process |
| **Query Performance** | Good for small datasets | Optimized for large datasets |
| **JSON Support** | JSON functions | JSONB + GIN indexes |
| **Backup** | Copy file | pg_dump/restore |
| **Scaling** | Single machine | Replication, sharding |

### When to Choose SQLite

- Single instance deployment
- Less than 1000 Agents
- Less than 100K messages per day
- Quick prototyping
- Zero maintenance overhead

### When to Choose PostgreSQL

- Multi-instance deployment
- More than 1000 Agents
- More than 100K messages per day
- Complex queries and analytics
- High availability requirements

---

## Docker Quick Start

### PostgreSQL

```bash
# Development
docker run --name kode-postgres \
  -e POSTGRES_PASSWORD=kode123 \
  -e POSTGRES_DB=kode_agents \
  -p 5432:5432 \
  -d postgres:16-alpine

# Production (persistent data)
docker run --name kode-postgres \
  -e POSTGRES_PASSWORD=kode123 \
  -e POSTGRES_DB=kode_agents \
  -v /data/postgres:/var/lib/postgresql/data \
  -p 5432:5432 \
  -d postgres:16-alpine
```

---

## Performance Tips

### Use Pagination

```typescript
// Avoid loading all data at once
const PAGE_SIZE = 100;
let offset = 0;

while (true) {
  const messages = await store.queryMessages({
    agentId,
    limit: PAGE_SIZE,
    offset,
  });

  if (messages.length === 0) break;
  processMessages(messages);
  offset += PAGE_SIZE;
}
```

### Use Time Filters

```typescript
// Limit to recent data
const messages = await store.queryMessages({
  agentId,
  createdAfter: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
});
```

### PostgreSQL Connection Pool

```typescript
const store = await createExtendedStore({
  type: 'postgres',
  connection: {
    host: 'localhost',
    port: 5432,
    database: 'kode_agents',
    user: 'kode',
    password: 'password',
    max: 20,                    // Max connections
    idleTimeoutMillis: 30000,   // Idle connection timeout
    connectionTimeoutMillis: 2000,
  },
  fileStoreBaseDir: './data/store',
});
```

---

## Backup

### SQLite

```bash
# Online backup (recommended)
sqlite3 agents.db ".backup agents.db.backup"

# Export SQL
sqlite3 agents.db .dump > agents.sql
```

### PostgreSQL

```bash
# Logical backup
pg_dump -h localhost -U kode -d kode_agents > backup.sql

# Compressed backup
pg_dump -h localhost -U kode -d kode_agents | gzip > backup.sql.gz

# Scheduled backup (cron)
0 2 * * * pg_dump -h localhost -U kode -d kode_agents | gzip > /backup/kode_$(date +\%Y\%m\%d).sql.gz
```

---

## Troubleshooting

### SQLite: Database Locked

```
Error: SQLITE_BUSY: database is locked
```

**Solution**: Enable WAL mode

```typescript
const db = new Database('./agents.db');
db.pragma('journal_mode = WAL');
db.pragma('busy_timeout = 5000');
```

### PostgreSQL: Connection Refused

```
Error: connect ECONNREFUSED 127.0.0.1:5432
```

**Checklist**:
1. Check if PostgreSQL is running: `pg_isready -h localhost -p 5432`
2. Check firewall settings
3. Verify `pg_hba.conf` allows connections
4. Verify `listen_addresses = '*'` in postgresql.conf

### PostgreSQL: Too Many Clients

```
Error: sorry, too many clients already
```

**Solution**: Optimize connection pool

```typescript
const store = await createExtendedStore({
  type: 'postgres',
  connection: {
    ...config,
    max: 10,                    // Reduce per-instance connections
    idleTimeoutMillis: 10000,   // Release idle connections faster
  },
  fileStoreBaseDir: './data/store',
});
```

---

## FAQ

**Q: Can I migrate from JSONStore to database?**

A: Yes, manual migration is required. A migration tool will be provided in future versions.

**Q: Does database storage affect performance?**

A: No. For regular operations (create, send, resume), performance is comparable to JSONStore.

**Q: Can I mix SQLite and PostgreSQL?**

A: Yes. The `ExtendedStore` interface abstracts the underlying implementation:

```typescript
const store = process.env.NODE_ENV === 'production'
  ? await createExtendedStore({ type: 'postgres', ... })
  : await createExtendedStore({ type: 'sqlite', ... });
```

**Q: How to delete old data?**

```typescript
// Delete specific Agent
await store.delete(agentId);

// Batch delete old Agents
const sessions = await store.querySessions({
  createdBefore: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), // 90 days ago
});
for (const session of sessions) {
  await store.delete(session.agentId);
}
```

---

## References

- Example code: [`examples/db-sqlite.ts`](../../examples/db-sqlite.ts), [`examples/db-postgres.ts`](../../examples/db-postgres.ts)
- Store interface: [API Reference](../reference/api.md#store)
