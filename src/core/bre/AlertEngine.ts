/**
 * M7.6E — Alert Engine
 *
 * Alert lifecycle management.
 * Alerts are created by the Rules Engine when conditions are met.
 * Dispatches notifications via existing NotificationRuleEngine.
 *
 * Lifecycle: Open → Acknowledged → In Progress → Resolved → Closed
 *
 * Consumed by:
 *   • OIS Dashboard (badge counts, threshold colors)
 *   • TV Mode (emergency banner)
 *   • Meeting Mode (alerts tab)
 *   • Report Engine (alert summaries)
 */

import { prisma } from '@/lib/prisma';
import { processEvent } from '@/core/notifications/NotificationRuleEngine';

// ─── Types ──────────────────────────────────────────────────────────────────

export type AlertSeverity = 'information' | 'warning' | 'critical' | 'emergency';
export type AlertStatus = 'open' | 'acknowledged' | 'in_progress' | 'resolved' | 'closed' | 'suppressed';
export type AlertType = 'threshold' | 'trend' | 'deviation' | 'missing_data' | 'late_activity' | 'critical_path' | 'schedule_health' | 'resource' | 'safety' | 'permit' | 'quality' | 'execution' | 'contractor' | 'inspection' | 'attendance' | 'custom';

export interface AlertInstance {
  id: string;
  organizationId: string;
  ruleId: string;
  alertType: AlertType;
  title: string;
  message: string;
  severity: AlertSeverity;
  priority: number;
  entityType: string | null;
  entityId: string | null;
  scopeSiteId: string | null;
  scopeUnitId: string | null;
  scopeArea: string | null;
  triggerValue: string | null;
  thresholdValue: string | null;
  evaluationData: any;
  status: AlertStatus;
  acknowledgedBy: string | null;
  acknowledgedAt: Date | null;
  resolvedBy: string | null;
  resolvedAt: Date | null;
  closedBy: string | null;
  closedAt: Date | null;
  assignedTo: string | null;
  resolutionNotes: string | null;
  escalationLevel: number;
  escalatedAt: Date | null;
  aiExplanation: string | null;
  suppressUntil: Date | null;
  createdAt: Date;
  updatedAt: Date;
  comments?: AlertComment[];
}

export interface AlertComment {
  id: string;
  alertId: string;
  comment: string;
  commentType: string;
  createdBy: string;
  createdAt: Date;
}

export interface CreateAlertInput {
  organizationId: string;
  ruleId: string;
  alertType: AlertType;
  title: string;
  message: string;
  severity: AlertSeverity;
  priority?: number;
  entityType?: string;
  entityId?: string;
  scopeSiteId?: string;
  scopeUnitId?: string;
  scopeArea?: string;
  triggerValue?: string;
  thresholdValue?: string;
  evaluationData?: any;
}

export interface AlertFilters {
  status?: AlertStatus | AlertStatus[];
  severity?: AlertSeverity | AlertSeverity[];
  alertType?: AlertType;
  assignedTo?: string;
  scopeSiteId?: string;
  scopeUnitId?: string;
  category?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface AlertCounts {
  total: number;
  open: number;
  acknowledged: number;
  inProgress: number;
  critical: number;
  emergency: number;
}

// ─── Service ────────────────────────────────────────────────────────────────

export class AlertEngine {

  /**
   * Create a new alert and dispatch notification.
   */
  static async createAlert(input: CreateAlertInput): Promise<AlertInstance> {
    // Dedup: check if same rule+entity has an open alert
    const existing = await prisma.bre_alerts.findFirst({
      where: {
        organization_id: input.organizationId,
        rule_id: input.ruleId,
        entity_type: input.entityType ?? null,
        entity_id: input.entityId ?? null,
        status: { in: ['open', 'acknowledged', 'in_progress'] },
      },
    });

    if (existing) {
      // Update existing alert instead of creating duplicate
      const updated = await prisma.bre_alerts.update({
        where: { id: existing.id },
        data: {
          trigger_value: input.triggerValue,
          threshold_value: input.thresholdValue,
          evaluation_data: input.evaluationData,
          severity: input.severity,
          updated_at: new Date(),
        },
      });
      return mapAlert(updated);
    }

    const alert = await prisma.bre_alerts.create({
      data: {
        organization_id: input.organizationId,
        rule_id: input.ruleId,
        alert_type: input.alertType,
        title: input.title,
        message: input.message,
        severity: input.severity,
        priority: input.priority ?? 5,
        entity_type: input.entityType,
        entity_id: input.entityId,
        scope_site_id: input.scopeSiteId,
        scope_unit_id: input.scopeUnitId,
        scope_area: input.scopeArea,
        trigger_value: input.triggerValue,
        threshold_value: input.thresholdValue,
        evaluation_data: input.evaluationData,
        status: 'open',
      },
    });

    // Dispatch notification via existing platform
    try {
      await processEvent('bre.alert.triggered', {
        organizationId: input.organizationId,
        entityType: 'alert',
        entityId: alert.id,
        variables: {
          alert_title: input.title,
          alert_message: input.message,
          alert_severity: input.severity,
          alert_type: input.alertType,
          trigger_value: input.triggerValue ?? '',
          threshold_value: input.thresholdValue ?? '',
        },
      });
    } catch { /* notification failure should not block alert creation */ }

    return mapAlert(alert);
  }

  /**
   * Acknowledge an alert.
   */
  static async acknowledge(alertId: string, userId: string): Promise<AlertInstance> {
    const alert = await prisma.bre_alerts.update({
      where: { id: alertId },
      data: {
        status: 'acknowledged',
        acknowledged_by: userId,
        acknowledged_at: new Date(),
      },
    });

    await addSystemComment(alertId, userId, 'status_change', 'Alert acknowledged');
    return mapAlert(alert);
  }

  /**
   * Assign an alert to a user.
   */
  static async assign(alertId: string, assignedTo: string, assignedBy: string): Promise<AlertInstance> {
    const alert = await prisma.bre_alerts.update({
      where: { id: alertId },
      data: {
        assigned_to: assignedTo,
        status: 'in_progress',
      },
    });

    await addSystemComment(alertId, assignedBy, 'assignment', `Assigned to user ${assignedTo}`);
    return mapAlert(alert);
  }

  /**
   * Resolve an alert.
   */
  static async resolve(alertId: string, userId: string, notes?: string): Promise<AlertInstance> {
    const alert = await prisma.bre_alerts.update({
      where: { id: alertId },
      data: {
        status: 'resolved',
        resolved_by: userId,
        resolved_at: new Date(),
        resolution_notes: notes,
      },
    });

    await addSystemComment(alertId, userId, 'resolution', notes ?? 'Alert resolved');
    return mapAlert(alert);
  }

  /**
   * Close an alert.
   */
  static async close(alertId: string, userId: string, notes?: string): Promise<AlertInstance> {
    const alert = await prisma.bre_alerts.update({
      where: { id: alertId },
      data: {
        status: 'closed',
        closed_by: userId,
        closed_at: new Date(),
        resolution_notes: notes ?? undefined,
      },
    });

    await addSystemComment(alertId, userId, 'status_change', notes ?? 'Alert closed');
    return mapAlert(alert);
  }

  /**
   * Suppress an alert until a given date.
   */
  static async suppress(alertId: string, until: Date, userId: string): Promise<AlertInstance> {
    const alert = await prisma.bre_alerts.update({
      where: { id: alertId },
      data: {
        status: 'suppressed',
        suppress_until: until,
      },
    });

    await addSystemComment(alertId, userId, 'status_change', `Suppressed until ${until.toISOString()}`);
    return mapAlert(alert);
  }

  /**
   * Bulk acknowledge alerts.
   */
  static async bulkAcknowledge(alertIds: string[], userId: string): Promise<number> {
    const result = await prisma.bre_alerts.updateMany({
      where: { id: { in: alertIds }, status: 'open' },
      data: { status: 'acknowledged', acknowledged_by: userId, acknowledged_at: new Date() },
    });
    return result.count;
  }

  /**
   * Bulk close alerts.
   */
  static async bulkClose(alertIds: string[], userId: string): Promise<number> {
    const result = await prisma.bre_alerts.updateMany({
      where: { id: { in: alertIds }, status: { in: ['open', 'acknowledged', 'in_progress', 'resolved'] } },
      data: { status: 'closed', closed_by: userId, closed_at: new Date() },
    });
    return result.count;
  }

  /**
   * Add a comment to an alert.
   */
  static async addComment(alertId: string, userId: string, comment: string): Promise<AlertComment> {
    const row = await prisma.bre_alert_comments.create({
      data: { alert_id: alertId, comment, comment_type: 'note', created_by: userId },
    });
    return { id: row.id, alertId: row.alert_id, comment: row.comment, commentType: row.comment_type, createdBy: row.created_by, createdAt: row.created_at };
  }

  /**
   * Get comments for an alert.
   */
  static async getComments(alertId: string): Promise<AlertComment[]> {
    const rows = await prisma.bre_alert_comments.findMany({
      where: { alert_id: alertId },
      orderBy: { created_at: 'asc' },
    });
    return rows.map((r: any) => ({
      id: r.id, alertId: r.alert_id, comment: r.comment,
      commentType: r.comment_type, createdBy: r.created_by, createdAt: r.created_at,
    }));
  }

  /**
   * List alerts with filters.
   */
  static async list(organizationId: string, filters?: AlertFilters): Promise<AlertInstance[]> {
    const where: any = { organization_id: organizationId };

    if (filters?.status) {
      where.status = Array.isArray(filters.status) ? { in: filters.status } : filters.status;
    }
    if (filters?.severity) {
      where.severity = Array.isArray(filters.severity) ? { in: filters.severity } : filters.severity;
    }
    if (filters?.alertType) where.alert_type = filters.alertType;
    if (filters?.assignedTo) where.assigned_to = filters.assignedTo;
    if (filters?.scopeSiteId) where.scope_site_id = filters.scopeSiteId;
    if (filters?.scopeUnitId) where.scope_unit_id = filters.scopeUnitId;
    if (filters?.search) {
      where.OR = [
        { title: { contains: filters.search, mode: 'insensitive' } },
        { message: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const alerts = await prisma.bre_alerts.findMany({
      where,
      include: { comments: { orderBy: { created_at: 'desc' }, take: 5 } },
      orderBy: [{ severity: 'asc' }, { priority: 'asc' }, { created_at: 'desc' }],
      take: filters?.limit ?? 100,
      skip: filters?.offset ?? 0,
    });

    return alerts.map(mapAlert);
  }

  /**
   * Get alert counts by status/severity for dashboard badges.
   */
  static async getCounts(organizationId: string): Promise<AlertCounts> {
    const [total, open, acknowledged, inProgress, critical, emergency] = await Promise.all([
      prisma.bre_alerts.count({ where: { organization_id: organizationId, status: { not: 'closed' } } }),
      prisma.bre_alerts.count({ where: { organization_id: organizationId, status: 'open' } }),
      prisma.bre_alerts.count({ where: { organization_id: organizationId, status: 'acknowledged' } }),
      prisma.bre_alerts.count({ where: { organization_id: organizationId, status: 'in_progress' } }),
      prisma.bre_alerts.count({ where: { organization_id: organizationId, status: { not: 'closed' }, severity: 'critical' } }),
      prisma.bre_alerts.count({ where: { organization_id: organizationId, status: { not: 'closed' }, severity: 'emergency' } }),
    ]);

    return { total, open, acknowledged, inProgress, critical, emergency };
  }

  /**
   * Get the active emergency banner text (for TV Mode).
   * Returns the highest-severity open alert title, or null.
   */
  static async getEmergencyBanner(organizationId: string): Promise<string | null> {
    const emergency = await prisma.bre_alerts.findFirst({
      where: {
        organization_id: organizationId,
        status: 'open',
        severity: 'emergency',
      },
      orderBy: { created_at: 'desc' },
    });

    return emergency?.title ?? null;
  }

  /**
   * Get critical alerts for meeting mode.
   */
  static async getMeetingAlerts(organizationId: string, limit = 10): Promise<AlertInstance[]> {
    const alerts = await prisma.bre_alerts.findMany({
      where: {
        organization_id: organizationId,
        status: { in: ['open', 'acknowledged', 'in_progress'] },
        severity: { in: ['critical', 'emergency'] },
      },
      orderBy: [{ severity: 'asc' }, { created_at: 'desc' }],
      take: limit,
    });

    return alerts.map(mapAlert);
  }

  /**
   * Get an alert by ID.
   */
  static async getById(id: string): Promise<AlertInstance | null> {
    const alert = await prisma.bre_alerts.findUnique({
      where: { id },
      include: { comments: { orderBy: { created_at: 'asc' } } },
    });
    return alert ? mapAlert(alert) : null;
  }

  /**
   * Update escalation level.
   */
  static async escalate(alertId: string, newLevel: number): Promise<AlertInstance> {
    const alert = await prisma.bre_alerts.update({
      where: { id: alertId },
      data: {
        escalation_level: newLevel,
        escalated_at: new Date(),
      },
    });

    await addSystemComment(alertId, 'system', 'escalation', `Escalated to level ${newLevel}`);
    return mapAlert(alert);
  }

  /**
   * Unsuppress alerts whose suppress_until has passed.
   */
  static async unsuppressExpired(): Promise<number> {
    const result = await prisma.bre_alerts.updateMany({
      where: {
        status: 'suppressed',
        suppress_until: { lte: new Date() },
      },
      data: { status: 'open', suppress_until: null },
    });
    return result.count;
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

async function addSystemComment(alertId: string, userId: string, type: string, comment: string) {
  await prisma.bre_alert_comments.create({
    data: { alert_id: alertId, comment, comment_type: type, created_by: userId },
  });
}

function mapAlert(row: any): AlertInstance {
  return {
    id: row.id,
    organizationId: row.organization_id,
    ruleId: row.rule_id,
    alertType: row.alert_type as AlertType,
    title: row.title,
    message: row.message,
    severity: row.severity as AlertSeverity,
    priority: row.priority,
    entityType: row.entity_type,
    entityId: row.entity_id,
    scopeSiteId: row.scope_site_id,
    scopeUnitId: row.scope_unit_id,
    scopeArea: row.scope_area,
    triggerValue: row.trigger_value,
    thresholdValue: row.threshold_value,
    evaluationData: row.evaluation_data,
    status: row.status as AlertStatus,
    acknowledgedBy: row.acknowledged_by,
    acknowledgedAt: row.acknowledged_at,
    resolvedBy: row.resolved_by,
    resolvedAt: row.resolved_at,
    closedBy: row.closed_by,
    closedAt: row.closed_at,
    assignedTo: row.assigned_to,
    resolutionNotes: row.resolution_notes,
    escalationLevel: row.escalation_level,
    escalatedAt: row.escalated_at,
    aiExplanation: row.ai_explanation,
    suppressUntil: row.suppress_until,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    comments: row.comments?.map((c: any) => ({
      id: c.id, alertId: c.alert_id, comment: c.comment,
      commentType: c.comment_type, createdBy: c.created_by, createdAt: c.created_at,
    })),
  };
}
