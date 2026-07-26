/**
 * Worker process entry point.
 */

import 'dotenv/config';
import { scheduleRecalculateWorker } from './scheduleRecalculateWorker';
import { reportDeliveryWorker } from './reportDeliveryWorker';

console.log('[Workers] Schedule recalculate worker started');
console.log('[Workers] Report delivery worker started');

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[Workers] SIGTERM received — closing workers...');
  await Promise.all([
    scheduleRecalculateWorker.close(),
    reportDeliveryWorker.close(),
  ]);
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('[Workers] SIGINT received — closing workers...');
  await Promise.all([
    scheduleRecalculateWorker.close(),
    reportDeliveryWorker.close(),
  ]);
  process.exit(0);
});
