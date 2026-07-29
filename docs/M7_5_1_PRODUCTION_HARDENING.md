# M7.5.1 — Production Hardening & Runtime Architecture

> **Milestone Type**: Architecture Stabilization (not a feature milestone)
> **Date**: 2026-07-29
> **Status**: Complete

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        PRODUCTION RUNTIME                          │
│                                                                     │
│  ┌─────────────┐    ┌──────────────┐    ┌────────────────────────┐ │
│  │   Next.js    │    │   Redis      │    │   Worker Process       │ │
│  │   App Server │    │   (BullMQ)   │    │   (tsx workers/index)  │ │
│  │              │    │              │    │                        │ │
│  │  API Routes ─┼───▶│  Queues      │◀──▶│  scheduleRecalculate  │ │
│  │  Services    │    │  - schedule  │    │  reportDelivery        │ │
│  │  Middleware  │    │  - delivery  │    │  knowledgeEngine       │ │
│  │              │    │  - knowledge │    │                        │ │
│  └──────┬───────┘    └──────────────┘    └────────────────────────┘ │
│         │                                                           │
│    ┌────▼─────┐    ┌──────────────┐    ┌────────────────────────┐   │
│    │ PostgreSQL│    │  Vertex AI   │    │   Storage (S3/Local)   │   │
│    │ (Prisma)  │    │  (ADC auth)  │    │                        │   │
│    └──────────┘    └──────────────┘    └────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

### Key Invariant

**Build must never connect to runtime infrastructure.**

`npm run build` performs only:
- TypeScript compilation
- Static page generation
- Asset bundling

It must NOT:
- Connect to Redis
- Instantiate BullMQ queues or workers
- Call Vertex AI / Google Auth
- Derive encryption keys
- Create S3 clients

---

## 2. Redis Lifecycle

### Before (Eager — ❌ ECONNREFUSED during build)
```typescript
export const redis = new Redis(process.env.REDIS_URL);
```

### After (Lazy Singleton — ✅ No connection until first use)
```typescript
let _redis: Redis | undefined;

export function getRedis(): Redis {
  if (!_redis) {
    _redis = new Redis(process.env.REDIS_URL, { ... });
  }
  return _redis;
}

// Backward-compat Proxy: existing `import { redis }` still works
export const redis = new Proxy({} as Redis, {
  get(_, prop) { return getRedis()[prop]; },
});
```

**Connection timeline:**
1. Module imported → nothing happens (Proxy is an empty shell)
2. First runtime property access (e.g. `.ping()`, `.set()`) → Proxy invokes `getRedis()`
3. `getRedis()` creates the connection, caches it, returns it
4. All subsequent accesses use the cached connection

---

## 3. Queue Lifecycle

### Factory Pattern
```
API Route → Service → getScheduleRecalculateQueue() → Queue → Redis → Worker
```

Three queue factories:
| Factory | Queue Name | Purpose |
|---------|-----------|---------|
| `getScheduleRecalculateQueue()` | `schedule-recalculate` | CPM schedule recalculation |
| `getReportDeliveryQueue()` | `report-delivery` | Report delivery (email, WhatsApp, in-app) |
| `getKnowledgeEngineQueue()` | `knowledge-engine` | Knowledge asset AI analysis |

Each factory creates its Queue instance lazily and caches it. Backward-compatible Proxy exports ensure zero consumer code changes.

---

## 4. Worker Lifecycle

Workers run in a **separate process** (`tsx src/workers/index.ts`), never inside Next.js.

```
workers/index.ts
  ├── createScheduleRecalculateWorker() → Worker connected to Redis
  ├── createReportDeliveryWorker()      → Worker connected to Redis
  └── createKnowledgeEngineWorker()     → Worker connected to Redis
```

**Isolation guarantee**: No file under `src/workers/` is imported from `app/`, `components/`, `pages/`, or middleware. Workers are only invoked via:
- `npm run worker` (package.json script)
- Docker Compose `worker` service

---

## 5. Vertex AI Lifecycle

### Before (Eager ADC check — ❌ Network call during build)
```typescript
checkADC(); // Line 45 — runs on module import
```

### After (Lazy — ✅ ADC check on first AI call)
```typescript
export async function callVertexAI(options) {
  await checkADC(); // Runs once, on first call only
  // ... rest of the function
}
```

Vertex AI clients are already per-call (via `createVertexClient()`), so no additional caching is needed.

---

## 6. Health Endpoints

| Endpoint | Purpose | I/O | Response |
|----------|---------|-----|----------|
| `GET /api/system/live` | Liveness probe | None | `{ status: "alive", uptime, pid }` |
| `GET /api/system/readiness` | Operational readiness | DB + Redis + env | `200` or `503` |
| `GET /api/system/health` | Comprehensive health | All systems | Full status report |

### Docker HEALTHCHECK Configuration
```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:3000/api/system/live"]
  interval: 30s
  timeout: 5s
  retries: 3
  start_period: 30s
```

---

## 7. Configuration Validation

Required at startup (fail fast):
- `DATABASE_URL` — PostgreSQL connection string
- `NEXTAUTH_SECRET` — Session signing key
- `ENCRYPTION_KEY` — AES-256 key for API key storage

Optional (warn if missing):
- `REDIS_URL` — Background job processing
- `GOOGLE_CLOUD_PROJECT` — Vertex AI
- `GOOGLE_CLOUD_LOCATION` — Vertex AI region
- `NEXTAUTH_URL` — Public app URL
- `STORAGE_PROVIDER` — File storage backend

---

## 8. Deployment Checklist

### Pre-Deployment
- [ ] All required env vars set (`DATABASE_URL`, `NEXTAUTH_SECRET`, `ENCRYPTION_KEY`)
- [ ] Redis accessible from app and worker containers
- [ ] Database migrations applied (`prisma migrate deploy`)
- [ ] `npm run build` succeeds without ECONNREFUSED

### Post-Deployment
- [ ] `GET /api/system/live` returns `200` → Process alive
- [ ] `GET /api/system/readiness` returns `200` → Infrastructure ready
- [ ] `GET /api/system/health` returns `healthy` → All systems operational
- [ ] Worker process running and processing jobs

### Rollback Criteria
- Health endpoint returns `unhealthy` for > 2 minutes
- Database check fails
- Redis unreachable AND no queue degradation configured

---

## 9. Production Startup Sequence

```
1. Node.js process starts
2. Next.js loads instrumentation.ts
3. validateRequiredConfig() runs:
   - Missing required vars → process exits with clear error
   - Missing optional vars → warning logged
4. Event subscribers registered
5. First HTTP request arrives:
   - Prisma Proxy → creates DB connection (lazy)
   - Redis Proxy → creates Redis connection (lazy, if touched)
   - Queue Proxy → creates BullMQ Queue (lazy, if enqueuing)
6. Worker process starts separately:
   - createScheduleRecalculateWorker()
   - createReportDeliveryWorker()
   - createKnowledgeEngineWorker()
   - All workers connect to Redis
```

---

## 10. Known Assumptions

1. **Single Redis instance** — BullMQ queues and workers share one Redis connection.
2. **Workers run separately** — The Next.js process never runs workers. Docker Compose `worker` service handles this.
3. **ADC for Vertex AI** — No API keys for Vertex; uses Application Default Credentials.
4. **Encryption key stability** — Changing `ENCRYPTION_KEY` after deployment will break existing encrypted API keys.
5. **Queue degradation** — KnowledgeCaptureService falls back to inline processing when Redis is unavailable. Other queue producers propagate errors.

---

## 11. Centralized Logging

All subsystems use `import { logger } from '@/lib/logger'`:

| Level | Usage | Output |
|-------|-------|--------|
| `DEBUG` | Detailed diagnostic info | Dev only (unless LOG_LEVEL=DEBUG) |
| `INFO` | Normal operational events | Always in production |
| `WARN` | Recoverable issues | Always |
| `ERROR` | Failures requiring attention | Always |
| `AUDIT` | Compliance-critical events | Always (cannot be suppressed) |

Production output: JSON structured logging.
Development output: Human-readable with timestamps.

---

## 12. Error Handling

Standardized error classes in `src/lib/errors.ts`:

| Class | HTTP | Code | Usage |
|-------|------|------|-------|
| `ValidationError` | 400 | `VALIDATION_ERROR` | Bad input |
| `AuthenticationError` | 401 | `AUTHENTICATION_ERROR` | Not authenticated |
| `PermissionError` | 403 | `PERMISSION_ERROR` | No permission |
| `NotFoundError` | 404 | `NOT_FOUND` | Resource missing |
| `BusinessError` | 422 | `BUSINESS_ERROR` | Business rule violation |
| `InfrastructureError` | 503 | `INFRASTRUCTURE_ERROR` | Redis/DB/AI down |

`handleApiError(error)` maps these to safe JSON responses — never leaks stack traces.
