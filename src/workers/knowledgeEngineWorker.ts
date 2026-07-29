import { Worker } from 'bullmq';
import { getRedis } from '@/lib/redis';
import { KnowledgeAnalysisService } from '@/core/knowledge-engine/KnowledgeAnalysisService';

/**
 * Background analysis for Knowledge Engine assets.
 * Tenant save path only enqueues — never waits on this worker.
 *
 * Created via factory — never instantiated at import time.
 */
export function createKnowledgeEngineWorker(): Worker<{ assetId: string }> {
  const worker = new Worker<{ assetId: string }>(
    'knowledge-engine',
    async (job) => {
      const { assetId } = job.data;
      job.log(`Analyzing knowledge asset ${assetId}`);
      await KnowledgeAnalysisService.analyzeAsset(assetId);
      job.log(`Analysis complete for ${assetId}`);
    },
    { connection: getRedis(), concurrency: 2 }
  );

  worker.on('failed', (job, err) => {
    console.error(`[KnowledgeEngineWorker] Job ${job?.id} failed:`, err.message);
  });

  return worker;
}
