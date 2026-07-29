import { Worker } from 'bullmq';
import { getRedis } from '@/lib/redis';
import { SchedulingService } from '@/modules/Scheduling/Services/SchedulingService';

/**
 * CPM recalculation worker.
 *
 * Expects job.data: { projectId: string; orgId: string }
 *
 * To start this worker, run:
 *   tsx src/workers/index.ts
 * or configure the "worker" npm script (see package.json).
 *
 * Created via factory — never instantiated at import time.
 */
export function createScheduleRecalculateWorker(): Worker<{
  projectId: string;
  orgId: string;
}> {
  const worker = new Worker<{
    projectId: string;
    orgId: string;
  }>(
    'schedule-recalculate',
    async (job) => {
      const { projectId, orgId } = job.data;

      if (!projectId || !orgId) {
        throw new Error(`[CPM Worker] Missing projectId or orgId in job ${job.id}`);
      }

      job.log(`Starting CPM recalculation for project ${projectId}`);

      const result = await SchedulingService.calculateProjectSchedule(projectId, orgId);

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
