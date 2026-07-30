/**
 * M7.6G — Usage Limit & Tracking Service
 *
 * Tracks resource consumption per organization per period.
 * Integrates with LicenseService for limit enforcement.
 *
 * Metrics: ai_tokens, emails, reports, dashboards, storage_mb,
 *          documents, api_calls, bg_jobs, provider_calls
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

export type UsageMetric =
  | 'ai_tokens'
  | 'emails'
  | 'reports'
  | 'dashboards'
  | 'storage_mb'
  | 'documents'
  | 'api_calls'
  | 'bg_jobs'
  | 'provider_calls';

export type UsagePeriod = 'daily' | 'monthly';

export interface UsageEntry {
  metric: UsageMetric;
  period: UsagePeriod;
  date: Date;
  value: number;
  limit?: number;
}

// ─── Metric → License Limit Mapping ──────────────────────────────────────────

const METRIC_TO_LICENSE_KEY: Partial<Record<UsageMetric, string>> = {
  ai_tokens: 'max_ai_credits',
  emails: 'max_emails_monthly',
  reports: 'max_reports',
  dashboards: 'max_dashboards',
  storage_mb: 'max_storage_gb',  // Needs conversion: GB → MB
  documents: 'max_documents',
  api_calls: 'max_api_calls_daily',
  bg_jobs: 'max_bg_jobs_daily',
};

// ═══════════════════════════════════════════════════════════════════════════════
// Service
// ═══════════════════════════════════════════════════════════════════════════════

export class UsageLimitService {

  /**
   * Record usage — increment metric for the current period.
   * Uses upsert for idempotent daily/monthly counters.
   */
  async trackUsage(
    organizationId: string,
    metric: UsageMetric,
    amount: number = 1,
    period: UsagePeriod = 'daily',
  ) {
    const periodDate = this.getPeriodDate(period);

    await prisma.platform_usage.upsert({
      where: {
        organization_id_metric_key_period_period_date: {
          organization_id: organizationId,
          metric_key: metric,
          period,
          period_date: periodDate,
        },
      },
      create: {
        organization_id: organizationId,
        metric_key: metric,
        period,
        period_date: periodDate,
        value: amount,
      },
      update: {
        value: { increment: amount },
      },
    });
  }

  /**
   * Get current usage for a metric in the current period.
   */
  async getUsage(
    organizationId: string,
    metric: UsageMetric,
    period: UsagePeriod = 'daily',
  ): Promise<number> {
    const periodDate = this.getPeriodDate(period);

    const record = await prisma.platform_usage.findUnique({
      where: {
        organization_id_metric_key_period_period_date: {
          organization_id: organizationId,
          metric_key: metric,
          period,
          period_date: periodDate,
        },
      },
    });

    return record?.value ?? 0;
  }

  /**
   * Check if usage exceeds the license limit.
   */
  async checkLimit(
    organizationId: string,
    metric: UsageMetric,
    period: UsagePeriod = 'daily',
  ): Promise<{ allowed: boolean; current: number; limit: number | null; remaining: number | null }> {
    const current = await this.getUsage(organizationId, metric, period);

    const licenseKey = METRIC_TO_LICENSE_KEY[metric];
    if (!licenseKey) {
      return { allowed: true, current, limit: null, remaining: null };
    }

    const license = await prisma.platform_licenses.findUnique({
      where: { organization_id: organizationId },
    });

    if (!license) {
      return { allowed: true, current, limit: null, remaining: null };
    }

    let limit = (license as any)[licenseKey] as number;
    // Convert storage GB to MB for comparison
    if (metric === 'storage_mb') limit = limit * 1024;

    return {
      allowed: current < limit,
      current,
      limit,
      remaining: Math.max(0, limit - current),
    };
  }

  /**
   * Get usage summary for an organization across all metrics.
   */
  async getUsageSummary(organizationId: string) {
    const metrics: UsageMetric[] = [
      'ai_tokens', 'emails', 'reports', 'dashboards',
      'storage_mb', 'documents', 'api_calls', 'bg_jobs', 'provider_calls',
    ];

    const results: Record<string, any> = {};

    for (const metric of metrics) {
      const dailyCheck = await this.checkLimit(organizationId, metric, 'daily');
      const monthlyValue = await this.getUsage(organizationId, metric, 'monthly');

      results[metric] = {
        daily: { value: dailyCheck.current, limit: dailyCheck.limit, remaining: dailyCheck.remaining },
        monthly: { value: monthlyValue },
      };
    }

    return results;
  }

  /**
   * Get usage trends for a metric over a number of days.
   */
  async getUsageTrends(
    organizationId: string,
    metric: UsageMetric,
    days: number = 30,
  ) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const records = await prisma.platform_usage.findMany({
      where: {
        organization_id: organizationId,
        metric_key: metric,
        period: 'daily',
        period_date: { gte: startDate },
      },
      orderBy: { period_date: 'asc' },
    });

    return records.map((r) => ({
      date: r.period_date,
      value: r.value,
    }));
  }

  /**
   * Get aggregated platform-wide usage stats.
   */
  async getPlatformStats() {
    const today = this.getPeriodDate('daily');
    const thisMonth = this.getPeriodDate('monthly');

    const dailyRecords = await prisma.platform_usage.findMany({
      where: { period: 'daily', period_date: today },
    });

    const monthlyRecords = await prisma.platform_usage.findMany({
      where: { period: 'monthly', period_date: thisMonth },
    });

    const dailyByMetric: Record<string, number> = {};
    const monthlyByMetric: Record<string, number> = {};

    for (const r of dailyRecords) {
      dailyByMetric[r.metric_key] = (dailyByMetric[r.metric_key] ?? 0) + r.value;
    }
    for (const r of monthlyRecords) {
      monthlyByMetric[r.metric_key] = (monthlyByMetric[r.metric_key] ?? 0) + r.value;
    }

    return { daily: dailyByMetric, monthly: monthlyByMetric };
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  private getPeriodDate(period: UsagePeriod): Date {
    const now = new Date();
    if (period === 'monthly') {
      return new Date(now.getFullYear(), now.getMonth(), 1);
    }
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }
}

// ─── Singleton ──────────────────────────────────────────────────────────────

export const usageLimitService = new UsageLimitService();
