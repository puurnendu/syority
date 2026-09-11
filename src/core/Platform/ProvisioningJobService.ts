/**
 * M7.7.1 — Provisioning Job Service
 *
 * DB-backed async provisioning queue.
 * Creates jobs, processes them step-by-step, supports cancel/retry/resume/rollback.
 *
 * Uses TenantProvisioningService.executeStep() for each provisioning phase.
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import {
  tenantProvisioningService,
  PROVISIONING_STEPS,
  type ProvisioningRequest,
  type ProvisioningStep,
  type StepContext,
} from '@/core/Platform/TenantProvisioningService';

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

export interface JobProgress {
  jobId: string;
  status: string;
  currentStep: string | null;
  completedSteps: string[];
  failedStep: string | null;
  progressPct: number;
  error: string | null;
  organizationId: string | null;
  startedAt: string | null;
  completedAt: string | null;
  durationMs: number | null;
  retries: number;
  logs: Array<{
    step: string;
    status: string;
    message: string | null;
    durationMs: number | null;
    createdAt: string;
  }>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Service
// ═══════════════════════════════════════════════════════════════════════════════

export class ProvisioningJobService {

  /**
   * Enqueue a new provisioning job.
   */
  async enqueue(request: ProvisioningRequest, createdBy: string, templateId?: string): Promise<string> {
    // Validate before queuing
    const errors = await tenantProvisioningService.validate(request);
    if (errors.length > 0) {
      throw new Error(`Validation failed: ${errors.map((e) => `${e.field}: ${e.message}`).join('; ')}`);
    }

    const job = await prisma.provisioning_jobs.create({
      data: {
        request: request as any,
        template_id: templateId,
        created_by: createdBy,
        status: 'queued',
        progress_pct: 0,
        completed_steps: [],
      },
    });

    logger.audit('ProvisioningJobService', 'Job enqueued', { jobId: job.id, slug: request.company.slug });
    return job.id;
  }

  /**
   * Get job progress with step logs.
   */
  async getProgress(jobId: string): Promise<JobProgress | null> {
    const job = await prisma.provisioning_jobs.findUnique({
      where: { id: jobId },
      include: {
        logs: { orderBy: { created_at: 'asc' } },
      },
    });

    if (!job) return null;

    return {
      jobId: job.id,
      status: job.status,
      currentStep: job.current_step,
      completedSteps: (job.completed_steps as string[]) ?? [],
      failedStep: job.failed_step,
      progressPct: job.progress_pct,
      error: job.error,
      organizationId: job.organization_id,
      startedAt: job.started_at?.toISOString() ?? null,
      completedAt: job.completed_at?.toISOString() ?? null,
      durationMs: job.duration_ms,
      retries: job.retries,
      logs: job.logs.map((l) => ({
        step: l.step,
        status: l.status,
        message: l.message,
        durationMs: l.duration_ms,
        createdAt: l.created_at.toISOString(),
      })),
    };
  }

  /**
   * List jobs with optional status filter.
   */
  async listJobs(status?: string, limit: number = 50) {
    return prisma.provisioning_jobs.findMany({
      where: status ? { status } : undefined,
      orderBy: { created_at: 'desc' },
      take: limit,
      include: {
        organization: { select: { id: true, name: true, slug: true } },
        template: { select: { id: true, name: true, slug: true } },
      },
    });
  }

  /**
   * Cancel a queued or running job.
   */
  async cancel(jobId: string): Promise<void> {
    const job = await prisma.provisioning_jobs.findUnique({ where: { id: jobId } });
    if (!job) throw new Error('Job not found');
    if (!['queued', 'starting', 'running'].includes(job.status)) {
      throw new Error(`Cannot cancel job in status: ${job.status}`);
    }

    await prisma.provisioning_jobs.update({
      where: { id: jobId },
      data: { status: 'cancelled', cancelled_at: new Date() },
    });

    logger.audit('ProvisioningJobService', 'Job cancelled', { jobId });
  }

  /**
   * Retry a failed job (resets to queued).
   */
  async retry(jobId: string): Promise<void> {
    const job = await prisma.provisioning_jobs.findUnique({ where: { id: jobId } });
    if (!job) throw new Error('Job not found');
    if (job.status !== 'failed') {
      throw new Error(`Cannot retry job in status: ${job.status}`);
    }
    if (job.retries >= job.max_retries) {
      throw new Error(`Max retries (${job.max_retries}) exceeded`);
    }

    await prisma.provisioning_jobs.update({
      where: { id: jobId },
      data: {
        status: 'queued',
        retries: { increment: 1 },
        error: null,
        stack_trace: null,
        failed_step: null,
        // Keep completed_steps so resume can skip them
      },
    });

    logger.audit('ProvisioningJobService', 'Job retried', { jobId, retries: job.retries + 1 });
  }

  /**
   * Resume a failed job from the last completed step.
   */
  async resume(jobId: string): Promise<void> {
    const job = await prisma.provisioning_jobs.findUnique({ where: { id: jobId } });
    if (!job) throw new Error('Job not found');
    if (!['failed', 'cancelled'].includes(job.status)) {
      throw new Error(`Cannot resume job in status: ${job.status}`);
    }

    await prisma.provisioning_jobs.update({
      where: { id: jobId },
      data: {
        status: 'queued',
        error: null,
        stack_trace: null,
        failed_step: null,
        // completed_steps preserved — worker will skip them
      },
    });

    logger.audit('ProvisioningJobService', 'Job resumed', { jobId });
  }

  /**
   * Force-complete a job (admin override).
   */
  async forceComplete(jobId: string): Promise<void> {
    const job = await prisma.provisioning_jobs.findUnique({ where: { id: jobId } });
    if (!job) throw new Error('Job not found');

    await prisma.provisioning_jobs.update({
      where: { id: jobId },
      data: {
        status: 'completed',
        progress_pct: 100,
        completed_at: new Date(),
      },
    });

    // If org was created, set lifecycle to active
    if (job.organization_id) {
      await prisma.organization.update({
        where: { id: job.organization_id },
        data: { lifecycle_status: 'active', lifecycle_changed_at: new Date() },
      }).catch(() => { /* org may not exist */ });
    }

    logger.audit('ProvisioningJobService', 'Job force-completed', { jobId });
  }

  /**
   * Rollback a provisioned tenant (cascading delete).
   */
  async rollback(jobId: string): Promise<void> {
    const job = await prisma.provisioning_jobs.findUnique({ where: { id: jobId } });
    if (!job) throw new Error('Job not found');
    if (!job.organization_id) throw new Error('No organization to rollback');

    await prisma.provisioning_jobs.update({
      where: { id: jobId },
      data: { status: 'rolling_back' },
    });

    try {
      // Delete the organization — cascading deletes handle Site, Plant, Unit, System, User, etc.
      await prisma.organization.delete({
        where: { id: job.organization_id },
      });

      await prisma.provisioning_jobs.update({
        where: { id: jobId },
        data: {
          status: 'rolled_back',
          organization_id: null,
          completed_at: new Date(),
        },
      });

      logger.audit('ProvisioningJobService', 'Job rolled back', { jobId, orgId: job.organization_id });
    } catch (err: any) {
      await prisma.provisioning_jobs.update({
        where: { id: jobId },
        data: { status: 'failed', error: `Rollback failed: ${err.message}` },
      });
      throw err;
    }
  }

  /**
   * Export full logs for a job.
   */
  async exportLogs(jobId: string) {
    const job = await prisma.provisioning_jobs.findUnique({
      where: { id: jobId },
      include: { logs: { orderBy: { created_at: 'asc' } } },
    });
    if (!job) throw new Error('Job not found');

    return {
      jobId: job.id,
      status: job.status,
      request: job.request,
      organizationId: job.organization_id,
      completedSteps: job.completed_steps,
      failedStep: job.failed_step,
      error: job.error,
      stackTrace: job.stack_trace,
      retries: job.retries,
      durationMs: job.duration_ms,
      createdAt: job.created_at.toISOString(),
      startedAt: job.started_at?.toISOString(),
      completedAt: job.completed_at?.toISOString(),
      logs: job.logs,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Worker Processing
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Process the next queued job. Called by ProvisioningWorker.
   * Returns true if a job was processed.
   */
  async processNext(): Promise<boolean> {
    // Atomic claim: find oldest queued job and mark as starting
    const jobs = await prisma.provisioning_jobs.findMany({
      where: { status: 'queued' },
      orderBy: { created_at: 'asc' },
      take: 1,
    });

    if (jobs.length === 0) return false;
    const job = jobs[0];

    // Claim the job
    const claimed = await prisma.provisioning_jobs.updateMany({
      where: { id: job.id, status: 'queued' },
      data: { status: 'starting', started_at: new Date() },
    });
    if (claimed.count === 0) return false; // Another worker claimed it

    logger.info('ProvisioningJobService', `Processing job ${job.id}`);

    const request = job.request as unknown as ProvisioningRequest;
    const completedSteps = (job.completed_steps as string[]) ?? [];
    let context: Partial<StepContext> = {};
    const startTime = Date.now();

    // If resuming, reconstruct context from DB
    if (completedSteps.length > 0 && job.organization_id) {
      context.orgId = job.organization_id;
      // Try to recover siteId
      const site = await prisma.site.findFirst({
        where: { organization_id: job.organization_id },
        orderBy: { created_at: 'asc' },
      });
      if (site) context.siteId = site.id;
      // Recover roleMap
      const roles = await prisma.role.findMany({
        where: { organization_id: job.organization_id },
        select: { id: true, slug: true },
      });
      context.roleMap = Object.fromEntries(roles.map((r) => [r.slug, r.id]));
      // Recover admin user
      const adminUser = await prisma.user.findFirst({
        where: { organization_id: job.organization_id, is_tenant_admin: true },
      });
      if (adminUser) context.adminUserId = adminUser.id;
      context.auditLog = [];
    }

    // Mark as running
    await prisma.provisioning_jobs.update({
      where: { id: job.id },
      data: { status: 'running' },
    });

    try {
      for (let i = 0; i < PROVISIONING_STEPS.length; i++) {
        const step = PROVISIONING_STEPS[i];

        // Skip already completed steps (for resume)
        if (completedSteps.includes(step)) {
          continue;
        }

        // Check if job was cancelled mid-execution
        const freshJob = await prisma.provisioning_jobs.findUnique({
          where: { id: job.id },
          select: { status: true },
        });
        if (freshJob?.status === 'cancelled') {
          logger.info('ProvisioningJobService', `Job ${job.id} cancelled during execution`);
          return true;
        }

        const progressPct = Math.round(((i + 1) / PROVISIONING_STEPS.length) * 100);

        // Update current step
        await prisma.provisioning_jobs.update({
          where: { id: job.id },
          data: {
            current_step: step,
            progress_pct: Math.min(progressPct, 95),
          },
        });

        // Log step start
        const stepLog = await prisma.provisioning_job_logs.create({
          data: { job_id: job.id, step, status: 'running', message: `Starting ${step}...` },
        });

        const stepStart = Date.now();

        try {
          // Execute the step
          const result = await tenantProvisioningService.executeStep(
            step as ProvisioningStep,
            request,
            context,
          );
          context = result.context;

          // Update org_id on job after organization step
          if (step === 'organization' && context.orgId) {
            await prisma.provisioning_jobs.update({
              where: { id: job.id },
              data: { organization_id: context.orgId },
            });
          }

          // Log step completion
          await prisma.provisioning_job_logs.update({
            where: { id: stepLog.id },
            data: {
              status: 'completed',
              message: result.message,
              duration_ms: Date.now() - stepStart,
            },
          });

          // Update completed steps
          completedSteps.push(step);
          await prisma.provisioning_jobs.update({
            where: { id: job.id },
            data: { completed_steps: completedSteps },
          });

        } catch (stepErr: any) {
          // Log step failure
          await prisma.provisioning_job_logs.update({
            where: { id: stepLog.id },
            data: {
              status: 'failed',
              message: stepErr.message,
              duration_ms: Date.now() - stepStart,
            },
          });
          throw stepErr; // Re-throw to outer catch
        }
      }

      // All steps completed
      await prisma.provisioning_jobs.update({
        where: { id: job.id },
        data: {
          status: 'completed',
          progress_pct: 100,
          completed_at: new Date(),
          duration_ms: Date.now() - startTime,
          current_step: null,
        },
      });

      logger.audit('ProvisioningJobService', `Job ${job.id} completed`, {
        orgId: context.orgId,
        durationMs: Date.now() - startTime,
      });

      return true;

    } catch (err: any) {
      logger.error('ProvisioningJobService', `Job ${job.id} failed`, {
        error: err.message,
        step: (await prisma.provisioning_jobs.findUnique({ where: { id: job.id }, select: { current_step: true } }))?.current_step,
      });

      await prisma.provisioning_jobs.update({
        where: { id: job.id },
        data: {
          status: 'failed',
          failed_step: (await prisma.provisioning_jobs.findUnique({ where: { id: job.id }, select: { current_step: true } }))?.current_step,
          error: err.message,
          stack_trace: err.stack?.substring(0, 4000),
          completed_at: new Date(),
          duration_ms: Date.now() - startTime,
          completed_steps: completedSteps,
        },
      });

      return true;
    }
  }
}

// ─── Singleton ──────────────────────────────────────────────────────────────

export const provisioningJobService = new ProvisioningJobService();
