import { Worker } from 'bullmq';
import { getRedis } from '@/lib/redis';
import { ScheduleOrchestrationService } from '@/core/schedule/ScheduleOrchestrationService';

/**
 * CPM recalculation worker.
 *
 * Expects job.data: { eventId: string; orgId: string }
 *
 * Event-less or Project-only jobs are rejected. No Project→Event inference.
 *
 * To start this worker, run:
 *   tsx src/workers/index.ts
 * or configure the "worker" npm script (see package.json).
 *
 * M11-R0: Redirected from SchedulingService → ScheduleOrchestrationService.
 * Created via factory — never instantiated at import time.
 */
export function createScheduleRecalculateWorker(): Worker<{
  eventId: string;
  orgId: string;
}> {
  const worker = new Worker<{
    eventId: string;
    orgId: string;
  }>(
    'schedule-recalculate',
    async (job) => {
      const { orgId, eventId } = job.data;

      if (!eventId || !orgId) {
        throw new Error(`[CPM Worker] Missing eventId or orgId in job ${job.id}`);
      }

      job.log(`Starting CPM recalculation for event ${eventId}`);

      const result = await ScheduleOrchestrationService.calculateEventSchedule(eventId, orgId);

      if (!result.success) {
        throw new Error(`[CPM Worker] CPM failed: ${result.error}`);
      }

      job.log(`CPM complete: ${result.count} activities recalculated`);

      return { count: result.count };
    },
    {
      connection: getRedis(),
      concurrency: 5,
    }
  );

  worker.on('completed', (job, returnValue) => {
    console.log(
      `[CPM Worker] Job ${job.id} completed — ${returnValue?.count ?? 0} activities updated`
    );
  });

  worker.on('failed', (job, err) => {
    console.error(`[CPM Worker] Job ${job?.id} failed:`, err.message);
  });

  return worker;
}
