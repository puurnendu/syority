import { Queue } from 'bullmq';
import { getRedis } from '@/lib/redis';

// ── Lazy Queue Factories ────────────────────────────────────────────────────
//
// Queues are created on FIRST USE, never at import time.
// Each factory caches its Queue instance in a module-scoped variable.
//
// This prevents Redis connection during `next build`.

// ── Schedule Recalculate Queue ──────────────────────────────────────────────

let _scheduleRecalculateQueue: Queue | undefined;

/**
 * CPM schedule recalculation queue.
 *
 * Jobs:  { projectId: string; orgId: string }
 *
 * Deduplication pattern: callers should pass
 *   jobId: `recalc-${projectId}`
 * so that rapid saves collapse into a single scheduled run.
 */
export function getScheduleRecalculateQueue(): Queue {
  if (!_scheduleRecalculateQueue) {
    _scheduleRecalculateQueue = new Queue('schedule-recalculate', {
      connection: getRedis(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: 100,
        removeOnFail: 50,
      },
    });
  }
  return _scheduleRecalculateQueue;
}

// ── Report Delivery Queue ───────────────────────────────────────────────────

let _reportDeliveryQueue: Queue | undefined;

/**
 * Report delivery queue.
 *
 * Jobs:  { type: 'shift' | 'lookahead'; projectId?: string; orgId: string; recipients: string[] }
 */
export function getReportDeliveryQueue(): Queue {
  if (!_reportDeliveryQueue) {
    _reportDeliveryQueue = new Queue('report-delivery', {
      connection: getRedis(),
      defaultJobOptions: {
        attempts: 2,
        backoff: { type: 'fixed', delay: 5000 },
        removeOnComplete: 50,
        removeOnFail: 25,
      },
    });
  }
  return _reportDeliveryQueue;
}

// ── Knowledge Engine Queue ──────────────────────────────────────────────────

let _knowledgeEngineQueue: Queue | undefined;

/**
 * Knowledge Engine analysis queue.
 *
 * Jobs: { assetId: string }
 * Knowledge Engine: Incoming → AI Analysis → Review Queue
 */
export function getKnowledgeEngineQueue(): Queue {
  if (!_knowledgeEngineQueue) {
    _knowledgeEngineQueue = new Queue('knowledge-engine', {
      connection: getRedis(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 3000 },
        removeOnComplete: 100,
        removeOnFail: 50,
      },
    });
  }
  return _knowledgeEngineQueue;
}

// ── Backward-compatible lazy exports ────────────────────────────────────────
//
// Existing code does `import { scheduleRecalculateQueue } from '@/lib/queues'`
// These Proxy exports defer Queue creation to first runtime property access.

export const scheduleRecalculateQueue: Queue = new Proxy({} as Queue, {
  get(_, prop: string | symbol) {
    return (getScheduleRecalculateQueue() as unknown as Record<string | symbol, unknown>)[prop];
  },
});

export const reportDeliveryQueue: Queue = new Proxy({} as Queue, {
  get(_, prop: string | symbol) {
    return (getReportDeliveryQueue() as unknown as Record<string | symbol, unknown>)[prop];
  },
});

export const knowledgeEngineQueue: Queue = new Proxy({} as Queue, {
  get(_, prop: string | symbol) {
    return (getKnowledgeEngineQueue() as unknown as Record<string | symbol, unknown>)[prop];
  },
});
