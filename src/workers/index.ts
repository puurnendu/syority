/**
 * Worker process entry point.
 */

import 'dotenv/config';
import { scheduleRecalculateWorker } from './scheduleRecalculateWorker';
import { reportDeliveryWorker } from './reportDeliveryWorker';
import { knowledgeEngineWorker } from './knowledgeEngineWorker';

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
