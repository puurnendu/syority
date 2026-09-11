/**
 * M7.7.1 — Resource Quota Service
 *
 * Wraps UsageLimitService with enriched quota categories and dashboard output.
 * Adds warning/exceeded thresholds for monitoring.
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

export interface QuotaMetric {
  metric: string;
  label: string;
  used: number;
  limit: number;
  remaining: number;
  status: 'ok' | 'warning' | 'exceeded' | 'unlimited';
}

const WARNING_THRESHOLD = 0.80; // 80% of limit

// ═══════════════════════════════════════════════════════════════════════════════
// Service
// ═══════════════════════════════════════════════════════════════════════════════

export class ResourceQuotaService {

  /**
   * Get a full quota dashboard for an organization.
   */
  async getDashboard(orgId: string): Promise<QuotaMetric[]> {
    // Get license limits
    const license = await prisma.platform_licenses.findFirst({
      where: { organization_id: orgId },
    });

    if (!license) {
      return this.getDefaultDashboard(orgId);
    }

    // Count actual usage
    const [
      userCount,
      workpackCount,
      siteCount,
      plantCount,
    ] = await Promise.all([
      prisma.user.count({ where: { organization_id: orgId, deleted_at: null } }),
      prisma.workpack.count({ where: { organization_id: orgId, deleted_at: null } }),
      prisma.site.count({ where: { organization_id: orgId, deleted_at: null } }),
      prisma.plant.count({ where: { organization_id: orgId } }),
    ]);

    let documentCount = 0;
    try {
      documentCount = await prisma.document.count({
        where: { organization_id: orgId, deleted_at: null },
      });
    } catch { /* table might not exist */ }

    const metrics: QuotaMetric[] = [
      this.buildMetric('users', 'Users', userCount, license.max_users),
      this.buildMetric('shutdowns', 'Shutdowns', workpackCount, license.max_shutdowns),
      this.buildMetric('projects', 'Projects', 0, license.max_projects),
      this.buildMetric('storage_gb', 'Storage (GB)', 0, license.max_storage_gb),
      this.buildMetric('documents', 'Documents', documentCount, license.max_documents),
      this.buildMetric('reports', 'Reports', 0, license.max_reports),
      this.buildMetric('dashboards', 'Dashboards', 0, license.max_dashboards),
      this.buildMetric('ai_credits', 'AI Credits', 0, license.max_ai_credits),
      this.buildMetric('api_calls', 'API Calls (Daily)', 0, license.max_api_calls_daily),
      this.buildMetric('emails', 'Emails (Monthly)', 0, license.max_emails_monthly),
      this.buildMetric('sites', 'Sites', siteCount, 999999), // No explicit site limit
      this.buildMetric('plants', 'Plants', plantCount, 999999),
    ];

    return metrics;
  }

  /**
   * Default dashboard when no license exists.
   */
  private async getDefaultDashboard(orgId: string): Promise<QuotaMetric[]> {
    const userCount = await prisma.user.count({ where: { organization_id: orgId, deleted_at: null } });
    return [
      this.buildMetric('users', 'Users', userCount, 15),
      this.buildMetric('shutdowns', 'Shutdowns', 0, 5),
      this.buildMetric('storage_gb', 'Storage (GB)', 0, 10),
      this.buildMetric('documents', 'Documents', 0, 500),
    ];
  }

  /**
   * Initialize quota tracking entries after provisioning.
   */
  async initializeQuotas(orgId: string): Promise<void> {
    // Create a platform_usage entry for the current period
    try {
      await prisma.platform_usage.create({
        data: {
          organization_id: orgId,
          period: this.currentPeriod(),
          metric: 'initialized',
          value: 0,
        },
      });
    } catch {
      // Ignore — usage tracking may already be initialized or table might not exist
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Helpers
  // ═══════════════════════════════════════════════════════════════════════════

  private buildMetric(metric: string, label: string, used: number, limit: number): QuotaMetric {
    if (limit >= 999999) {
      return { metric, label, used, limit, remaining: 999999, status: 'unlimited' };
    }
    const remaining = Math.max(0, limit - used);
    let status: QuotaMetric['status'] = 'ok';
    if (used >= limit) {
      status = 'exceeded';
    } else if (used / limit >= WARNING_THRESHOLD) {
      status = 'warning';
    }
    return { metric, label, used, limit, remaining, status };
  }

  private currentPeriod(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }
}

// ─── Singleton ──────────────────────────────────────────────────────────────

export const resourceQuotaService = new ResourceQuotaService();
