/**
 * M7.6G — Beta Feedback Service
 *
 * Manages user-submitted feedback with auto-captured environment context.
 * Feedback types: bug, improvement, feature_request, question, general
 * Lifecycle: open → acknowledged → in_progress → resolved → closed | wont_fix
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

export type FeedbackType = 'bug' | 'improvement' | 'feature_request' | 'question' | 'general';
export type FeedbackSeverity = 'low' | 'medium' | 'high' | 'critical';
export type FeedbackStatus = 'open' | 'acknowledged' | 'in_progress' | 'resolved' | 'closed' | 'wont_fix';

export interface FeedbackInput {
  organizationId: string;
  userId: string;
  type: FeedbackType;
  title: string;
  description: string;
  severity?: FeedbackSeverity;
  // Auto-captured
  appVersion?: string;
  gitCommit?: string;
  route?: string;
  currentModule?: string;
  browser?: string;
  os?: string;
  resolution?: string;
  screenshotUrl?: string;
}

export interface FeedbackFilter {
  organizationId?: string;
  type?: FeedbackType;
  status?: FeedbackStatus;
  severity?: FeedbackSeverity;
  userId?: string;
  page?: number;
  limit?: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Service
// ═══════════════════════════════════════════════════════════════════════════════

export class FeedbackService {

  /**
   * Submit feedback with auto-captured context.
   */
  async submit(input: FeedbackInput) {
    const feedback = await prisma.platform_feedback.create({
      data: {
        organization_id: input.organizationId,
        user_id: input.userId,
        type: input.type,
        title: input.title,
        description: input.description,
        severity: input.severity ?? 'medium',
        app_version: input.appVersion,
        git_commit: input.gitCommit,
        route: input.route,
        current_module: input.currentModule,
        browser: input.browser,
        os: input.os,
        resolution: input.resolution,
        screenshot_url: input.screenshotUrl,
      },
    });

    logger.info('FeedbackService', 'Feedback submitted', {
      id: feedback.id,
      type: input.type,
      severity: input.severity,
      route: input.route,
    });

    return feedback;
  }

  /**
   * List feedback with filtering and pagination.
   */
  async list(filter: FeedbackFilter) {
    const page = filter.page ?? 1;
    const limit = Math.min(filter.limit ?? 50, 100);
    const skip = (page - 1) * limit;

    const where: any = {};
    if (filter.organizationId) where.organization_id = filter.organizationId;
    if (filter.type) where.type = filter.type;
    if (filter.status) where.status = filter.status;
    if (filter.severity) where.severity = filter.severity;
    if (filter.userId) where.user_id = filter.userId;

    const [items, total] = await Promise.all([
      prisma.platform_feedback.findMany({
        where,
        orderBy: [{ severity: 'desc' }, { created_at: 'desc' }],
        skip,
        take: limit,
      }),
      prisma.platform_feedback.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  /**
   * Update feedback status, assignment, or resolution.
   */
  async updateStatus(
    id: string,
    updates: Partial<{
      status: FeedbackStatus;
      assigned_to: string;
      resolution_notes: string;
    }>,
  ) {
    const data: any = { ...updates };
    if (updates.status === 'resolved' || updates.status === 'closed') {
      data.resolved_at = new Date();
    }

    const feedback = await prisma.platform_feedback.update({
      where: { id },
      data,
    });

    logger.audit('FeedbackService', 'Feedback updated', { id, updates });
    return feedback;
  }

  /**
   * Get feedback statistics.
   */
  async getStats() {
    const all = await prisma.platform_feedback.findMany({
      select: { type: true, status: true, severity: true },
    });

    const byType: Record<string, number> = {};
    const byStatus: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};

    for (const f of all) {
      byType[f.type] = (byType[f.type] ?? 0) + 1;
      byStatus[f.status] = (byStatus[f.status] ?? 0) + 1;
      bySeverity[f.severity] = (bySeverity[f.severity] ?? 0) + 1;
    }

    return {
      total: all.length,
      open: (byStatus.open ?? 0) + (byStatus.acknowledged ?? 0) + (byStatus.in_progress ?? 0),
      byType,
      byStatus,
      bySeverity,
    };
  }
}

// ─── Singleton ──────────────────────────────────────────────────────────────

export const feedbackService = new FeedbackService();
