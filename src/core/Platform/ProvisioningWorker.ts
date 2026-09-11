/**
 * M7.7.1 — Provisioning Worker
 *
 * Simple DB-polling worker that processes queued provisioning jobs.
 * Lazy-started on first API request. Polls every 5 seconds.
 */

import { provisioningJobService } from '@/core/Platform/ProvisioningJobService';
import { logger } from '@/lib/logger';

// ═══════════════════════════════════════════════════════════════════════════════
// Worker
// ═══════════════════════════════════════════════════════════════════════════════

class ProvisioningWorkerInstance {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private processing = false;
  private _isRunning = false;

  get isRunning() {
    return this._isRunning;
  }

  /**
   * Start the polling loop. Idempotent — calling start() multiple times is safe.
   */
  start(intervalMs: number = 5000) {
    if (this._isRunning) return;
    this._isRunning = true;

    logger.info('ProvisioningWorker', `Worker started (polling every ${intervalMs}ms)`);

    this.intervalId = setInterval(async () => {
      if (this.processing) return; // Skip if already processing
      this.processing = true;

      try {
        const processed = await provisioningJobService.processNext();
        if (processed) {
          // If we processed a job, immediately check for more
          let hasMore = true;
          while (hasMore) {
            hasMore = await provisioningJobService.processNext();
          }
        }
      } catch (err: any) {
        logger.error('ProvisioningWorker', 'Worker error', { error: err.message });
      } finally {
        this.processing = false;
      }
    }, intervalMs);
  }

  /**
   * Stop the polling loop.
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this._isRunning = false;
    logger.info('ProvisioningWorker', 'Worker stopped');
  }

  /**
   * Ensure the worker is running (lazy start).
   */
  ensureRunning() {
    if (!this._isRunning) {
      this.start();
    }
  }
}

// ─── Singleton ──────────────────────────────────────────────────────────────

export const provisioningWorker = new ProvisioningWorkerInstance();
