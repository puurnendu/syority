/**
 * M7.6F — Decision Recommendation Engine
 *
 * Generates, manages, and tracks decision recommendations for planners,
 * engineers, shutdown managers, and directors.
 *
 * Architecture:
 *   Business Rules Engine → RecommendationEngine → Notification Platform → OIS Dashboard
 *
 * CRITICAL CONSTRAINT:
 *   The engine SHALL NEVER execute operational actions automatically.
 *   It shall RECOMMEND actions to humans who accept or reject them.
 *
 * Lifecycle: pending → presented → accepted | rejected | deferred | expired | superseded
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

export type RecommendationCategory =
  | 'planning'
  | 'safety'
  | 'execution'
  | 'qa_qc'
  | 'inspection'
  | 'contractor'
  | 'resource'
  | 'material'
  | 'permit'
  | 'critical_path'
  | 'constraint';

export type RecommendationPriority = 'low' | 'medium' | 'high' | 'critical';

export type RecommendationStatus =
  | 'pending'
  | 'presented'
  | 'accepted'
  | 'rejected'
  | 'deferred'
  | 'expired'
  | 'superseded';

export type RecommendationSource = 'rule' | 'formula' | 'kpi' | 'ai' | 'manual';

export interface RecommendationInput {
  organizationId: string;
  slug: string;
  title: string;
  description: string;
  category: RecommendationCategory;
  priority: RecommendationPriority;
  confidenceScore: number;
  reasoning: string;
  expectedImpact?: string;
  sourceType: RecommendationSource;
  sourceRuleId?: string;
  sourceFormulaId?: string;
  supportingKpis?: Array<{ name: string; value: number; threshold: number }>;
  supportingRules?: Array<{ ruleId: string; name: string; result: boolean }>;
  relatedAlertIds?: string[];
  alternatives?: Array<{ title: string; description: string; confidence: number }>;
  targetEntityType?: string;
  targetEntityId?: string;
  eventId?: string;
  expiresAt?: Date;
  showInDashboard?: boolean;
  showInTvMode?: boolean;
  showInMeeting?: boolean;
  showInReports?: boolean;
  createdBy?: string;
}

export interface RecommendationFilter {
  organizationId: string;
  status?: RecommendationStatus | RecommendationStatus[];
  category?: RecommendationCategory | RecommendationCategory[];
  priority?: RecommendationPriority | RecommendationPriority[];
  eventId?: string;
  targetEntityType?: string;
  showInDashboard?: boolean;
  showInTvMode?: boolean;
  showInMeeting?: boolean;
  showInReports?: boolean;
  page?: number;
  limit?: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Engine
// ═══════════════════════════════════════════════════════════════════════════════

export class RecommendationEngine {

  /**
   * Generate a new recommendation.
   * Does NOT execute any action — only creates a record for human review.
   */
  async generate(input: RecommendationInput) {
    const recommendation = await prisma.bre_recommendations.create({
      data: {
        organization_id: input.organizationId,
        slug: input.slug,
        title: input.title,
        description: input.description,
        category: input.category,
        priority: input.priority,
        confidence_score: input.confidenceScore,
        reasoning: input.reasoning,
        expected_impact: input.expectedImpact,
        source_type: input.sourceType,
        source_rule_id: input.sourceRuleId,
        source_formula_id: input.sourceFormulaId,
        supporting_kpis: input.supportingKpis ?? undefined,
        supporting_rules: input.supportingRules ?? undefined,
        related_alert_ids: input.relatedAlertIds ?? undefined,
        alternatives: input.alternatives ?? undefined,
        target_entity_type: input.targetEntityType,
        target_entity_id: input.targetEntityId,
        event_id: input.eventId,
        expires_at: input.expiresAt,
        show_in_dashboard: input.showInDashboard ?? true,
        show_in_tv_mode: input.showInTvMode ?? false,
        show_in_meeting: input.showInMeeting ?? true,
        show_in_reports: input.showInReports ?? true,
        created_by: input.createdBy,
      },
    });

    // Log creation
    await this.logAction(recommendation.id, 'created', undefined, undefined, 'pending');

    logger.info('RecommendationEngine', 'Recommendation generated', {
      id: recommendation.id,
      slug: input.slug,
      category: input.category,
      priority: input.priority,
      confidence: input.confidenceScore,
    });

    return recommendation;
  }

  /**
   * Accept a recommendation. Records who accepted and when.
   * Does NOT execute the recommended action — that is the caller's responsibility.
   */
  async accept(id: string, userId: string, comment?: string) {
    const rec = await prisma.bre_recommendations.findUnique({ where: { id } });
    if (!rec) throw new Error(`Recommendation ${id} not found`);

    const previousStatus = rec.status;
    const updated = await prisma.bre_recommendations.update({
      where: { id },
      data: {
        status: 'accepted',
        accepted_by: userId,
        accepted_at: new Date(),
      },
    });

    await this.logAction(id, 'accepted', userId, previousStatus, 'accepted', comment);

    logger.audit('RecommendationEngine', 'Recommendation accepted', {
      id, userId, slug: rec.slug,
    });

    return updated;
  }

  /**
   * Reject a recommendation. Records who rejected and why.
   */
  async reject(id: string, userId: string, reason: string) {
    const rec = await prisma.bre_recommendations.findUnique({ where: { id } });
    if (!rec) throw new Error(`Recommendation ${id} not found`);

    const previousStatus = rec.status;
    const updated = await prisma.bre_recommendations.update({
      where: { id },
      data: {
        status: 'rejected',
        rejected_by: userId,
        rejected_at: new Date(),
        rejection_reason: reason,
      },
    });

    await this.logAction(id, 'rejected', userId, previousStatus, 'rejected', reason);

    logger.audit('RecommendationEngine', 'Recommendation rejected', {
      id, userId, reason, slug: rec.slug,
    });

    return updated;
  }

  /**
   * Defer a recommendation to a later date.
   */
  async defer(id: string, userId: string, deferUntil: Date, comment?: string) {
    const rec = await prisma.bre_recommendations.findUnique({ where: { id } });
    if (!rec) throw new Error(`Recommendation ${id} not found`);

    const previousStatus = rec.status;
    const updated = await prisma.bre_recommendations.update({
      where: { id },
      data: {
        status: 'deferred',
        deferred_until: deferUntil,
      },
    });

    await this.logAction(id, 'deferred', userId, previousStatus, 'deferred', comment);

    logger.info('RecommendationEngine', 'Recommendation deferred', {
      id, deferUntil: deferUntil.toISOString(),
    });

    return updated;
  }

  /**
   * Supersede a recommendation (replaced by a newer one).
   */
  async supersede(id: string, replacedById?: string) {
    const rec = await prisma.bre_recommendations.findUnique({ where: { id } });
    if (!rec) throw new Error(`Recommendation ${id} not found`);

    const previousStatus = rec.status;
    const updated = await prisma.bre_recommendations.update({
      where: { id },
      data: { status: 'superseded' },
    });

    await this.logAction(id, 'superseded', undefined, previousStatus, 'superseded', undefined, {
      replaced_by: replacedById,
    });

    return updated;
  }

  /**
   * Expire recommendations past their expiry date.
   * Designed to run as a scheduled job.
   */
  async expireStale(): Promise<number> {
    const result = await prisma.bre_recommendations.updateMany({
      where: {
        status: { in: ['pending', 'presented'] },
        expires_at: { lte: new Date() },
        deleted_at: null,
      },
      data: { status: 'expired' },
    });

    if (result.count > 0) {
      logger.info('RecommendationEngine', `Expired ${result.count} stale recommendations`);
    }

    return result.count;
  }

  /**
   * List recommendations with filtering and pagination.
   */
  async list(filter: RecommendationFilter) {
    const page = filter.page ?? 1;
    const limit = Math.min(filter.limit ?? 50, 100);
    const skip = (page - 1) * limit;

    const where: any = {
      organization_id: filter.organizationId,
      deleted_at: null,
    };

    if (filter.status) {
      where.status = Array.isArray(filter.status) ? { in: filter.status } : filter.status;
    }
    if (filter.category) {
      where.category = Array.isArray(filter.category) ? { in: filter.category } : filter.category;
    }
    if (filter.priority) {
      where.priority = Array.isArray(filter.priority) ? { in: filter.priority } : filter.priority;
    }
    if (filter.eventId) where.event_id = filter.eventId;
    if (filter.targetEntityType) where.target_entity_type = filter.targetEntityType;
    if (filter.showInDashboard !== undefined) where.show_in_dashboard = filter.showInDashboard;
    if (filter.showInTvMode !== undefined) where.show_in_tv_mode = filter.showInTvMode;
    if (filter.showInMeeting !== undefined) where.show_in_meeting = filter.showInMeeting;
    if (filter.showInReports !== undefined) where.show_in_reports = filter.showInReports;

    const [items, total] = await Promise.all([
      prisma.bre_recommendations.findMany({
        where,
        orderBy: [
          { priority: 'desc' },
          { confidence_score: 'desc' },
          { created_at: 'desc' },
        ],
        skip,
        take: limit,
        include: { logs: { orderBy: { performed_at: 'desc' }, take: 5 } },
      }),
      prisma.bre_recommendations.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  /**
   * Get a single recommendation with full audit log.
   */
  async getById(id: string) {
    return prisma.bre_recommendations.findUnique({
      where: { id },
      include: { logs: { orderBy: { performed_at: 'desc' } } },
    });
  }

  /**
   * Get recommendation statistics for a dashboard widget.
   */
  async getStats(organizationId: string, eventId?: string) {
    const where: any = {
      organization_id: organizationId,
      deleted_at: null,
    };
    if (eventId) where.event_id = eventId;

    const all = await prisma.bre_recommendations.findMany({
      where,
      select: {
        status: true,
        priority: true,
        category: true,
        confidence_score: true,
      },
    });

    const byStatus: Record<string, number> = {};
    const byPriority: Record<string, number> = {};
    const byCategory: Record<string, number> = {};

    for (const r of all) {
      byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
      byPriority[r.priority] = (byPriority[r.priority] ?? 0) + 1;
      byCategory[r.category] = (byCategory[r.category] ?? 0) + 1;
    }

    const pending = all.filter((r) => r.status === 'pending' || r.status === 'presented');
    const avgConfidence = pending.length > 0
      ? pending.reduce((sum, r) => sum + Number(r.confidence_score), 0) / pending.length
      : 0;

    return {
      total: all.length,
      byStatus,
      byPriority,
      byCategory,
      pendingCount: pending.length,
      averageConfidence: Math.round(avgConfidence * 10000) / 10000,
    };
  }

  // ── Internal Helpers ────────────────────────────────────────────────────────

  private async logAction(
    recommendationId: string,
    action: string,
    performedBy?: string,
    previousStatus?: string,
    newStatus?: string,
    comment?: string,
    metadata?: Record<string, any>,
  ) {
    await prisma.bre_recommendation_log.create({
      data: {
        recommendation_id: recommendationId,
        action,
        performed_by: performedBy,
        previous_status: previousStatus,
        new_status: newStatus,
        comment,
        metadata: metadata ?? undefined,
      },
    });
  }
}

// ─── Singleton ──────────────────────────────────────────────────────────────

export const recommendationEngine = new RecommendationEngine();
