import { Worker } from 'bullmq';
import { redis } from '@/lib/redis';
import { KnowledgeAnalysisService } from '@/core/knowledge-engine/KnowledgeAnalysisService';

/**
 * Background analysis for Knowledge Engine assets.
 * Tenant save path only enqueues — never waits on this worker.
 */
export const knowledgeEngineWorker = new Worker<{ assetId: string }>(
  'knowledge-engine',
  async (job) => {
    const { assetId } = job.data;
    job.log(`Analyzing knowledge asset ${assetId}`);
    await KnowledgeAnalysisService.analyzeAsset(assetId);
    job.log(`Analysis complete for ${assetId}`);
  },
  { connection: redis, concurrency: 2 }
);

knowledgeEngineWorker.on('failed', (job, err) => {
  console.error(`[KnowledgeEngineWorker] Job ${job?.id} failed:`, err.message);
});
