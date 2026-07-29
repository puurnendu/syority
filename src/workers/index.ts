/**
 * Worker process entry point.
 *
 * Workers are created via factory functions — nothing is instantiated
 * at import time. This file is the ONLY place that calls the factories.
 *
 * Start with:  tsx src/workers/index.ts
 * Or via npm:  npm run worker
 */

import 'dotenv/config';
import { createScheduleRecalculateWorker } from './scheduleRecalculateWorker';
import { createReportDeliveryWorker } from './reportDeliveryWorker';
import { createKnowledgeEngineWorker } from './knowledgeEngineWorker';

// Create all workers — this is the only place where Redis/BullMQ connects
const scheduleRecalculateWorker = createScheduleRecalculateWorker();
const reportDeliveryWorker = createReportDeliveryWorker();
const knowledgeEngineWorker = createKnowledgeEngineWorker();

console.log('[Workers] Schedule recalculate worker started');
console.log('[Workers] Report delivery worker started');
console.log('[Workers] Knowledge Engine worker started');

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[Workers] SIGTERM received — closing workers...');
  await Promise.all([
    scheduleRecalculateWorker.close(),
    reportDeliveryWorker.close(),
    knowledgeEngineWorker.close(),
  ]);
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('[Workers] SIGINT received — closing workers...');
  await Promise.all([
    scheduleRecalculateWorker.close(),
    reportDeliveryWorker.close(),
    knowledgeEngineWorker.close(),
  ]);
  process.exit(0);
});
