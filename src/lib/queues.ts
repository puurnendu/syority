import { Queue } from 'bullmq';
import { redis } from '@/lib/redis';

/**
 * Jobs:  { projectId: string; orgId: string }
 *
 * Deduplication pattern: callers should pass
 *   jobId: `recalc-${projectId}`
 * so that rapid saves collapse into a single scheduled run.
 */
export const scheduleRecalculateQueue = new Queue('schedule-recalculate', {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: 100,
    removeOnFail: 50,
  },
});

/**
 * Jobs:  { type: 'shift' | 'lookahead'; projectId?: string; orgId: string; recipients: string[] }
 */
export const reportDeliveryQueue = new Queue('report-delivery', {
  connection: redis,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: 'fixed', delay: 5000 },
    removeOnComplete: 50,
    removeOnFail: 25,
  },
});
