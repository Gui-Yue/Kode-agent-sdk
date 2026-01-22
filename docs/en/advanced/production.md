# Production Deployment

This guide covers production configuration, monitoring, and best practices for KODE SDK.

---

## Database Selection

### Development vs Production

| Store | Use Case | Features |
|-------|----------|----------|
| `JSONStore` | Development, single machine | Simple file-based storage |
| `SqliteStore` | Development, medium scale | QueryableStore + ExtendedStore |
| `PostgresStore` | Production, multi-worker | Full ExtendedStore, distributed locks |

### PostgreSQL Configuration

```typescript
import { createStore } from '@shareai-lab/kode-sdk';

const store = await createStore({
  type: 'postgres',
  connection: {
    host: process.env.PG_HOST!,
    port: 5432,
    database: 'kode_agents',
    user: process.env.PG_USER!,
    password: process.env.PG_PASSWORD!,
    ssl: { rejectUnauthorized: true },

    // Connection pool settings
    max: 20,                       // Pool size
    idleTimeoutMillis: 30000,      // Idle connection timeout
    connectionTimeoutMillis: 5000, // Connection timeout
  },
  fileStoreBaseDir: '/data/kode-files',
});
```

---

## Health Checks

ExtendedStore provides built-in health check capabilities.

### Health Check API

```typescript
const health = await store.healthCheck();

// Response:
// {
//   healthy: true,
//   database: { connected: true, latencyMs: 5 },
//   fileSystem: { writable: true },
//   checkedAt: 1706000000000
// }
```

### HTTP Health Endpoint

```typescript
import express from 'express';

const app = express();

app.get('/health', async (req, res) => {
  const status = await store.healthCheck();
  res.status(status.healthy ? 200 : 503).json(status);
});

// Kubernetes readiness probe
app.get('/ready', async (req, res) => {
  const status = await store.healthCheck();
  res.status(status.healthy ? 200 : 503).send();
});
```

### Data Consistency Check

```typescript
const consistency = await store.checkConsistency(agentId);

if (!consistency.consistent) {
  console.error('Consistency issues:', consistency.issues);
}
```

---

## Metrics & Monitoring

### Store Metrics

```typescript
const metrics = await store.getMetrics();

// {
//   operations: { saves: 1234, loads: 5678, queries: 910, deletes: 11 },
//   performance: { avgLatencyMs: 15.5, maxLatencyMs: 250, minLatencyMs: 2 },
//   storage: { totalAgents: 100, totalMessages: 50000, dbSizeBytes: 104857600 },
//   collectedAt: 1706000000000
// }
```

### Prometheus Integration

```typescript
import { register, Gauge, Histogram } from 'prom-client';

const agentCount = new Gauge({ name: 'kode_agents_total', help: 'Total agents' });
const toolLatency = new Histogram({
  name: 'kode_tool_duration_seconds',
  help: 'Tool execution duration',
  buckets: [0.1, 0.5, 1, 2, 5, 10],
});

agent.on('tool_executed', (event) => {
  if (event.call.durationMs) {
    toolLatency.observe(event.call.durationMs / 1000);
  }
});

app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.send(await register.metrics());
});
```

---

## Retry Strategy

### Built-in Retry Configuration

```typescript
import { withRetry, DEFAULT_RETRY_CONFIG } from '@shareai-lab/kode-sdk/provider';

// Default: { maxRetries: 3, baseDelayMs: 1000, maxDelayMs: 60000, jitterFactor: 0.2 }

const result = await withRetry(
  () => callExternalAPI(),
  { maxRetries: 5, baseDelayMs: 500, provider: 'myservice' },
  (error, attempt, delay) => console.log(`Retry ${attempt} after ${delay}ms`)
);
```

### Retryable Errors

| Error Type | Retryable | Description |
|------------|-----------|-------------|
| `RateLimitError` | Yes | Respects `retry-after` header |
| `TimeoutError` | Yes | Request timeout |
| `ServiceUnavailableError` | Yes | 5xx server errors |
| `AuthenticationError` | No | Invalid credentials |
| `QuotaExceededError` | No | Billing limit reached |

---

## Distributed Locking

### Using Agent Locks

```typescript
const release = await store.acquireAgentLock(agentId, 30000);

try {
  const agent = await Agent.resumeFromStore(agentId, deps);
  await agent.send('Process this task');
} finally {
  await release();
}
```

- **SQLite**: In-memory lock (single process only)
- **PostgreSQL**: Database-level advisory lock (multi-worker safe)

---

## Graceful Shutdown

```typescript
async function gracefulShutdown() {
  // 1. Stop accepting new requests
  server.close();

  // 2. Interrupt running agents
  for (const agentId of pool.list()) {
    const agent = pool.get(agentId);
    if (agent) await agent.interrupt();
  }

  // 3. Close database connections
  await store.close();

  process.exit(0);
}

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
```

---

## Logging & Cost Management

### Logger Interface

```typescript
const config: DebugConfig = {
  verbose: false,
  logTokenUsage: true,
  logCache: true,
  logRetries: true,
  redactSensitive: true,
};
```

### Cost Limiting

```typescript
let sessionCost = 0;
const COST_LIMIT = 10.0;

agent.on('token_usage', (event) => {
  const cost = (event.inputTokens * 0.003 + event.outputTokens * 0.015) / 1000;
  sessionCost += cost;

  if (sessionCost > COST_LIMIT) {
    agent.interrupt();
  }
});
```

---

## Security Best Practices

```typescript
// Permission configuration
const agent = await Agent.create({
  permission: {
    mode: 'approval',
    requireApprovalTools: ['bash_run', 'fs_write'],
    allowTools: ['fs_read', 'fs_glob'],
  },
}, deps);

// Sandbox boundary
const sandbox = new LocalSandbox({
  workDir: '/app/workspace',
  enforceBoundary: true,
  allowPaths: ['/app/workspace', '/tmp'],
});
```

---

## Deployment Checklist

- [ ] Use PostgreSQL for production
- [ ] Configure connection pooling
- [ ] Set up health check endpoints
- [ ] Configure metrics collection
- [ ] Implement graceful shutdown
- [ ] Use environment variables for secrets
- [ ] Enable SSL for database connections
- [ ] Set sandbox boundaries

---

## References

- [Database Guide](../guides/database.md)
- [Error Handling](../guides/error-handling.md)
- [Events Guide](../guides/events.md)
