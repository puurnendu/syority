/**
 * M7.6G — Platform Analytics Service
 *
 * Computes DAU/MAU, module usage, report usage, AI usage,
 * notification success rates, feature adoption, and org growth.
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

// ═══════════════════════════════════════════════════════════════════════════════
// Service
// ═══════════════════════════════════════════════════════════════════════════════

export class AnalyticsService {

  /**
   * Daily Active Users (users who logged in today).
   */
  async getDAU(): Promise<number> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return prisma.user.count({
      where: {
        deleted_at: null,
        is_active: true,
        last_login_at: { gte: today },
      },
    });
  }

  /**
   * Monthly Active Users (users who logged in this month).
   */
  async getMAU(): Promise<number> {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    return prisma.user.count({
      where: {
        deleted_at: null,
        is_active: true,
        last_login_at: { gte: startOfMonth },
      },
    });
  }

  /**
   * Organization growth over time.
   */
  async getOrgGrowth(days: number = 90) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const orgs = await prisma.organization.findMany({
      where: { deleted_at: null, created_at: { gte: since } },
      select: { created_at: true },
      orderBy: { created_at: 'asc' },
    });

    // Group by week
    const weeks: Record<string, number> = {};
    for (const org of orgs) {
      const weekStart = new Date(org.created_at);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      const key = weekStart.toISOString().split('T')[0];
      weeks[key] = (weeks[key] ?? 0) + 1;
    }

    return Object.entries(weeks).map(([week, count]) => ({ week, count }));
  }

  /**
   * Most used reports.
   */
  async getReportUsage(limit: number = 10) {
    const templates = await prisma.report_templates.findMany({
      take: limit,
      orderBy: { created_at: 'desc' },
      select: { id: true, name: true, slug: true, created_at: true },
    });

    return templates.map((t) => ({
      id: t.id,
      name: t.name,
      slug: t.slug,
    }));
  }

  /**
   * Notification success rate.
   */
  async getNotificationStats() {
    const total = await prisma.notification.count();
    const read = await prisma.notification.count({ where: { read: true } });
    const unread = total - read;

    return {
      total,
      read,
      unread,
      readRate: total > 0 ? Math.round((read / total) * 100) : 0,
    };
  }

  /**
   * Feature flag adoption — how many orgs have each flag enabled.
   */
  async getFeatureAdoption() {
    const flags = await prisma.featureFlag.findMany({
      include: {
        TenantFeature: {
          where: { isEnabled: true },
        },
      },
    });

    return flags.map((f) => ({
      key: f.key,
      description: f.description,
      globalEnabled: f.isEnabled,
      orgAdoption: f.TenantFeature.length,
    }));
  }

  /**
   * AI usage summary.
   */
  async getAIUsage() {
    const jobs = await prisma.aiExtractionJob.groupBy({
      by: ['status'],
      _count: { id: true },
    });

    const result: Record<string, number> = {};
    for (const j of jobs) {
      result[j.status] = j._count.id;
    }

    return result;
  }

  /**
   * Inactive organizations (no login in 30 days).
   */
  async getInactiveOrgs(days: number = 30) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    const orgs = await prisma.organization.findMany({
      where: {
        deleted_at: null,
        NOT: { tenant_type: 'platform' },
      },
      select: {
        id: true,
        name: true,
        slug: true,
        User: {
          where: { deleted_at: null, is_active: true },
          select: { last_login_at: true },
          orderBy: { last_login_at: 'desc' },
          take: 1,
        },
      },
    });

    return orgs.filter((org) => {
      const lastLogin = org.User[0]?.last_login;
      return !lastLogin || lastLogin < cutoff;
    }).map((org) => ({
      id: org.id,
      name: org.name,
      slug: org.slug,
      lastLogin: org.User[0]?.last_login ?? null,
    }));
  }

  /**
   * Full analytics dashboard payload.
   */
  async getDashboardData() {
    const [
      dau, mau, orgGrowth, reportUsage,
      notificationStats, featureAdoption, aiUsage, inactiveOrgs,
    ] = await Promise.all([
      this.getDAU(),
      this.getMAU(),
      this.getOrgGrowth(),
      this.getReportUsage(),
      this.getNotificationStats(),
      this.getFeatureAdoption(),
      this.getAIUsage(),
      this.getInactiveOrgs(),
    ]);

    const totalOrgs = await prisma.organization.count({
      where: { deleted_at: null, NOT: { tenant_type: 'platform' } },
    });
    const totalUsers = await prisma.user.count({ where: { deleted_at: null } });

    return {
      dau,
      mau,
      totalOrgs,
      totalUsers,
      orgGrowth,
      reportUsage,
      notificationStats,
      featureAdoption,
      aiUsage,
      inactiveOrgs,
    };
  }
}

// ─── Singleton ──────────────────────────────────────────────────────────────

export const analyticsService = new AnalyticsService();
