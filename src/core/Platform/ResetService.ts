/**
 * M7.6G.1 — Organization Reset Service
 *
 * Allows platform admin to reset beta organizations without deleting the tenant.
 * Creates a rollback backup before reset. Full audit trail.
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { backupService } from '@/core/Platform/BackupService';

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

export interface ResetOptions {
  // What to reset (default: all true)
  planning?: boolean;          // events, scope
  issues?: boolean;            // engineering issues
  workpacks?: boolean;         // workpacks + activities
  reports?: boolean;           // generated reports
  dashboards?: boolean;        // OIS dashboards
  notifications?: boolean;     // notifications
  bre?: boolean;               // business rules, formulas, KPIs, alerts
  feedback?: boolean;          // feedback entries
  usage?: boolean;             // usage statistics
  safety?: boolean;            // safety records
  documents?: boolean;         // documents, artifacts
  // What to keep (default: all true)
  keepUsers?: boolean;
  keepRoles?: boolean;
  keepPermissions?: boolean;
  keepBranding?: boolean;
  keepLicense?: boolean;
  keepSMTP?: boolean;
  keepAI?: boolean;
  keepFeatureFlags?: boolean;
  keepModules?: boolean;
  keepOrganization?: boolean;  // always true, cannot delete org via reset
}

export interface ResetPreview {
  organizationName: string;
  categories: {
    category: string;
    willReset: boolean;
    recordCount: number;
  }[];
  totalRecords: number;
  preserved: string[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// Service
// ═══════════════════════════════════════════════════════════════════════════════

export class ResetService {

  /**
   * Preview affected records before reset.
   */
  async preview(organizationId: string, options: ResetOptions): Promise<ResetPreview> {
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { name: true },
    });
    if (!org) throw new Error('Organization not found');

    const categories: ResetPreview['categories'] = [];
    const w = { organization_id: organizationId };

    if (options.planning !== false) {
      const events = await prisma.shutdownEvent.count({ where: { ...w, deleted_at: null } });
      categories.push({ category: 'Shutdown Events', willReset: true, recordCount: events });
    }

    if (options.issues !== false) {
      const issues = await prisma.engineeringIssue.count({ where: { ...w, deleted_at: null } });
      categories.push({ category: 'Engineering Issues', willReset: true, recordCount: issues });
    }

    if (options.workpacks !== false) {
      const workpacks = await prisma.workpack.count({ where: { ...w, deleted_at: null } });
      const wps = await prisma.workpack.findMany({ where: { ...w, deleted_at: null }, select: { id: true } });
      const activities = wps.length > 0
        ? await prisma.activity.count({ where: { workpack_id: { in: wps.map(wp => wp.id) } } })
        : 0;
      categories.push({ category: 'Workpacks', willReset: true, recordCount: workpacks });
      categories.push({ category: 'Activities', willReset: true, recordCount: activities });
    }

    if (options.notifications !== false) {
      const notifications = await prisma.notification.count({ where: { organization_id: organizationId } });
      categories.push({ category: 'Notifications', willReset: true, recordCount: notifications });
    }

    if (options.feedback !== false) {
      const feedback = await prisma.platform_feedback.count({ where: { organization_id: organizationId } });
      categories.push({ category: 'Feedback', willReset: true, recordCount: feedback });
    }

    if (options.usage !== false) {
      const usage = await prisma.platform_usage.count({ where: { organization_id: organizationId } });
      categories.push({ category: 'Usage Statistics', willReset: true, recordCount: usage });
    }

    const preserved: string[] = [];
    if (options.keepUsers !== false) preserved.push('Users');
    if (options.keepRoles !== false) preserved.push('Roles');
    if (options.keepBranding !== false) preserved.push('Branding');
    if (options.keepLicense !== false) preserved.push('License');
    if (options.keepFeatureFlags !== false) preserved.push('Feature Flags');
    if (options.keepModules !== false) preserved.push('Modules');
    preserved.push('Organization');
    preserved.push('Hierarchy (Sites, Plants, Areas, Units, Systems, Assets)');

    return {
      organizationName: org.name,
      categories,
      totalRecords: categories.reduce((s, c) => s + c.recordCount, 0),
      preserved,
    };
  }

  /**
   * Execute organization reset.
   */
  async execute(organizationId: string, options: ResetOptions, userId?: string) {
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true, name: true, slug: true },
    });
    if (!org) throw new Error('Organization not found');

    // 1. Create rollback point
    let rollbackBackupId: string | undefined;
    try {
      const backup = await backupService.createBackup({
        name: `rollback-${org.slug}-${Date.now()}`,
        type: 'data_only',
        notes: `Rollback point before reset of ${org.name}`,
        retentionDays: 30,
      }, userId);
      rollbackBackupId = backup.id;
    } catch (err) {
      logger.warn('ResetService', 'Failed to create rollback backup', { err });
    }

    const log: string[] = [];
    let totalDeleted = 0;
    const w = { organization_id: organizationId };

    // 2. Reset categories
    if (options.workpacks !== false) {
      // Delete activities first (child records)
      const wps = await prisma.workpack.findMany({ where: { ...w, deleted_at: null }, select: { id: true } });
      if (wps.length > 0) {
        const actCount = await prisma.activity.deleteMany({
          where: { workpack_id: { in: wps.map(wp => wp.id) } },
        });
        totalDeleted += actCount.count;
        log.push(`🗑️ Activities: ${actCount.count}`);
      }
      const wpCount = await prisma.workpack.deleteMany({ where: { ...w, deleted_at: null } });
      totalDeleted += wpCount.count;
      log.push(`🗑️ Workpacks: ${wpCount.count}`);
    }

    if (options.issues !== false) {
      const count = await prisma.engineeringIssue.deleteMany({ where: { ...w, deleted_at: null } });
      totalDeleted += count.count;
      log.push(`🗑️ Engineering Issues: ${count.count}`);
    }

    if (options.planning !== false) {
      const count = await prisma.shutdownEvent.deleteMany({ where: { ...w, deleted_at: null } });
      totalDeleted += count.count;
      log.push(`🗑️ Shutdown Events: ${count.count}`);
    }

    if (options.notifications !== false) {
      const count = await prisma.notification.deleteMany({ where: { organization_id: organizationId } });
      totalDeleted += count.count;
      log.push(`🗑️ Notifications: ${count.count}`);
    }

    if (options.feedback !== false) {
      const count = await prisma.platform_feedback.deleteMany({ where: { organization_id: organizationId } });
      totalDeleted += count.count;
      log.push(`🗑️ Feedback: ${count.count}`);
    }

    if (options.usage !== false) {
      const count = await prisma.platform_usage.deleteMany({ where: { organization_id: organizationId } });
      totalDeleted += count.count;
      log.push(`🗑️ Usage Statistics: ${count.count}`);
    }

    logger.audit('ResetService', 'Organization reset executed', {
      organizationId,
      organizationName: org.name,
      totalDeleted,
      rollbackBackupId,
      options,
      userId,
    });

    return {
      organizationId,
      organizationName: org.name,
      totalDeleted,
      rollbackBackupId,
      log,
    };
  }
}

// ─── Singleton ──────────────────────────────────────────────────────────────

export const resetService = new ResetService();
