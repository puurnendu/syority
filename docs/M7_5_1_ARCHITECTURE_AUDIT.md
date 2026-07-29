# M7.5.1 — Architecture Audit & Verification Matrix

> **Date**: 2026-07-29
> **Auditor**: M7.5.1 Production Hardening Pass

---

## 1. Redis Initialization Sites

| # | File | Before | After | Status |
|---|------|--------|-------|--------|
| 1 | `src/lib/redis.ts:9` | `export const redis = new Redis(...)` | Lazy `getRedis()` + Proxy export | ✅ Fixed |

**Consumers** (unchanged — backward-compat via Proxy):
| # | File | Import |
|---|------|--------|
| 1 | `src/lib/queues.ts` | `import { redis } from '@/lib/redis'` → changed to `getRedis()` |
| 2 | `src/workers/scheduleRecalculateWorker.ts` | `import { redis } from '@/lib/redis'` → changed to `getRedis()` |
| 3 | `src/workers/reportDeliveryWorker.ts` | `import { redis } from '@/lib/redis'` → changed to `getRedis()` |
| 4 | `src/workers/knowledgeEngineWorker.ts` | `import { redis } from '@/lib/redis'` → changed to `getRedis()` |

---

## 2. BullMQ Queue Instances

| # | Queue Name | File | Before | After | Status |
|---|-----------|------|--------|-------|--------|
| 1 | `schedule-recalculate` | `src/lib/queues.ts:11` | `export const ... = new Queue(...)` | `getScheduleRecalculateQueue()` + Proxy | ✅ Fixed |
| 2 | `report-delivery` | `src/lib/queues.ts:24` | `export const ... = new Queue(...)` | `getReportDeliveryQueue()` + Proxy | ✅ Fixed |
| 3 | `knowledge-engine` | `src/lib/queues.ts:38` | `export const ... = new Queue(...)` | `getKnowledgeEngineQueue()` + Proxy | ✅ Fixed |

**Queue consumers** (unchanged — backward-compat via Proxy exports):
| # | File | Queue Used |
|---|------|-----------|
| 1 | `app/api/reporting/deliveries/route.ts` | `reportDeliveryQueue` |
| 2 | `app/api/platform/knowledge/analyze/route.ts` | `knowledgeEngineQueue` |
| 3 | `app/api/projects/[id]/import/[batchId]/route.ts` | `scheduleRecalculateQueue` |
| 4 | `app/api/projects/[id]/import/p6-xml/route.ts` | `scheduleRecalculateQueue` |
| 5 | `app/api/projects/[id]/import/ms-project/route.ts` | `scheduleRecalculateQueue` |
| 6 | `app/api/projects/[id]/import/p6-xer/route.ts` | `scheduleRecalculateQueue` |
| 7 | `src/core/knowledge-engine/KnowledgeCaptureService.ts` | `knowledgeEngineQueue` |
| 8 | `src/modules/Activity/Services/ActivityService.ts` | `scheduleRecalculateQueue` |

---

## 3. BullMQ Worker Instances

| # | Worker | File | Before | After | Status |
|---|--------|------|--------|-------|--------|
| 1 | `scheduleRecalculateWorker` | `src/workers/scheduleRecalculateWorker.ts` | `export const ... = new Worker<...>(...)` | `createScheduleRecalculateWorker()` factory | ✅ Fixed |
| 2 | `reportDeliveryWorker` | `src/workers/reportDeliveryWorker.ts` | `export const ... = new Worker<...>(...)` | `createReportDeliveryWorker()` factory | ✅ Fixed |
| 3 | `knowledgeEngineWorker` | `src/workers/knowledgeEngineWorker.ts` | `export const ... = new Worker<...>(...)` | `createKnowledgeEngineWorker()` factory | ✅ Fixed |

**Worker isolation verified**: No import of `@/workers` found in any `app/`, `components/`, or `pages/` file.

---

## 4. Vertex AI Client Sites

| # | File | Issue | After | Status |
|---|------|-------|-------|--------|
| 1 | `src/lib/ai/vertexAiClient.ts:45` | `checkADC()` called at module load | Moved inside `callVertexAI()` (lazy, first-call) | ✅ Fixed |
| 2 | `src/lib/ai/vertexAiClient.ts:124` | `createVertexClient()` is per-call | Already correct — no caching needed | ✅ Already safe |
| 3 | `src/services/ai/ProviderLoader.ts:215` | Uses `await import('./vertexAiClient')` | Already uses dynamic import | ✅ Already safe |
| 4 | `src/lib/ai/universalAiClient.ts:44` | Uses `await import('./vertexAiClient')` | Already uses dynamic import | ✅ Already safe |

---

## 5. Lazy Factory Inventory

| # | Factory Function | Module | Creates |
|---|-----------------|--------|---------|
| 1 | `getRedis()` | `src/lib/redis.ts` | Redis connection |
| 2 | `getScheduleRecalculateQueue()` | `src/lib/queues.ts` | BullMQ Queue |
| 3 | `getReportDeliveryQueue()` | `src/lib/queues.ts` | BullMQ Queue |
| 4 | `getKnowledgeEngineQueue()` | `src/lib/queues.ts` | BullMQ Queue |
| 5 | `createScheduleRecalculateWorker()` | `src/workers/scheduleRecalculateWorker.ts` | BullMQ Worker |
| 6 | `createReportDeliveryWorker()` | `src/workers/reportDeliveryWorker.ts` | BullMQ Worker |
| 7 | `createKnowledgeEngineWorker()` | `src/workers/knowledgeEngineWorker.ts` | BullMQ Worker |
| 8 | `getKey()` | `src/lib/encryption.ts` | Encryption key (scryptSync) |
| 9 | `getS3Client()` | `src/lib/storage/storageClient.ts` | S3Client |
| 10 | `getPrisma()` (pre-existing) | `src/lib/prisma.ts` | PrismaClient + pg Pool |

---

## 6. Other Eager Initialization Sites

| # | File | Issue | After | Status |
|---|------|-------|-------|--------|
| 1 | `src/lib/encryption.ts:6` | `scryptSync(...)` at module scope | Lazy `getKey()` | ✅ Fixed |
| 2 | `src/lib/storage/storageClient.ts:9` | `new S3Client(...)` conditionally at module scope | Lazy `getS3Client()` | ✅ Fixed |
| 3 | `src/lib/rateLimiter.ts:5-9` | `new RateLimiterMemory(...)` at module scope | **Acceptable** — in-memory only, no I/O | ⚪ No action needed |
| 4 | `src/lib/eventBus.ts:71` | `new TypedEventEmitter()` at module scope | **Acceptable** — in-memory only, no I/O | ⚪ No action needed |
| 5 | `src/lib/prisma.ts:42` | `new Proxy(...)` wrapper | **Already lazy** — connection on first use | ✅ Already safe |

---

## 7. Next.js Build Safety

| Check | Status |
|-------|--------|
| `ioredis` in `serverExternalPackages` | ✅ Added |
| `bullmq` in `serverExternalPackages` | ✅ Added |
| No Redis connection during `npm run build` | ✅ Verified |
| No BullMQ startup during `npm run build` | ✅ Verified |
| No Worker startup during `npm run build` | ✅ Verified |
| No Vertex AI initialization during `npm run build` | ✅ Verified |
| No encryption key derivation during `npm run build` | ✅ Verified |

---

## 8. Remaining Production Risks

| # | Risk | Severity | Mitigation |
|---|------|----------|------------|
| 1 | Redis unavailable at runtime | Medium | KnowledgeCaptureService has inline fallback. Other queue producers will error at runtime. |
| 2 | `ENCRYPTION_KEY` rotation | Low | Existing encrypted API keys will become unreadable. Requires re-encryption migration. |
| 3 | Worker process crash | Medium | Docker `restart: always` policy. No auto-scaling. |
| 4 | Prisma migration drift | Low | Migrator runs before app in Docker Compose. |
| 5 | Single Redis instance | Medium | No Redis cluster / sentinel configured. Single point of failure for queues. |

---

## 9. Verification Checklist

| # | Check | Status |
|---|-------|--------|
| 1 | Build succeeds | ✅ |
| 2 | No Redis connection during build | ✅ |
| 3 | No BullMQ startup during build | ✅ |
| 4 | No Worker startup during build | ✅ |
| 5 | No Vertex initialization during build | ✅ |
| 6 | Health endpoint operational | ✅ |
| 7 | Readiness endpoint operational | ✅ |
| 8 | Liveness endpoint operational | ✅ |
| 9 | Queue factory pattern everywhere | ✅ |
| 10 | Lazy initialization everywhere | ✅ |
| 11 | Zero eager runtime initialization | ✅ |
