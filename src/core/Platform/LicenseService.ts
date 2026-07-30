/**
 * M7.6G — Enterprise Licensing Engine
 *
 * Manages organization licenses, resource limits, and quota enforcement.
 * Each organization has exactly one license controlling access and limits.
 *
 * License Types:
 *   trial → beta → starter → professional → enterprise → unlimited → custom
 *
 * License Lifecycle:
 *   active → suspended | expired | revoked | grace
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

export type LicenseType = 'trial' | 'beta' | 'starter' | 'professional' | 'enterprise' | 'unlimited' | 'custom';
export type LicenseStatus = 'active' | 'suspended' | 'expired' | 'revoked' | 'grace';

export type LimitKey =
  | 'max_users'
  | 'max_shutdowns'
  | 'max_projects'
  | 'max_storage_gb'
  | 'max_documents'
  | 'max_reports'
  | 'max_dashboards'
  | 'max_scheduled_reports'
  | 'max_ai_credits'
  | 'max_api_calls_daily'
  | 'max_bg_jobs_daily'
  | 'max_emails_monthly';

export interface LicenseInput {
  organizationId: string;
  licenseType: LicenseType;
  expiresAt?: Date;
  gracePeriodDays?: number;
  limits?: Partial<Record<LimitKey, number>>;
  notes?: string;
  createdBy?: string;
}

export interface LimitCheckResult {
  allowed: boolean;
  current: number;
  limit: number;
  remaining: number;
  limitKey: LimitKey;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Default Limits Per License Type
// ═══════════════════════════════════════════════════════════════════════════════

const LICENSE_DEFAULTS: Record<LicenseType, Record<LimitKey, number>> = {
  trial: {
    max_users: 5, max_shutdowns: 1, max_projects: 2, max_storage_gb: 2,
    max_documents: 50, max_reports: 10, max_dashboards: 3, max_scheduled_reports: 1,
    max_ai_credits: 100, max_api_calls_daily: 1000, max_bg_jobs_daily: 50, max_emails_monthly: 100,
  },
  beta: {
    max_users: 15, max_shutdowns: 5, max_projects: 10, max_storage_gb: 10,
    max_documents: 500, max_reports: 100, max_dashboards: 20, max_scheduled_reports: 10,
    max_ai_credits: 1000, max_api_calls_daily: 10000, max_bg_jobs_daily: 500, max_emails_monthly: 1000,
  },
  starter: {
    max_users: 10, max_shutdowns: 3, max_projects: 5, max_storage_gb: 5,
    max_documents: 200, max_reports: 50, max_dashboards: 10, max_scheduled_reports: 5,
    max_ai_credits: 500, max_api_calls_daily: 5000, max_bg_jobs_daily: 200, max_emails_monthly: 500,
  },
  professional: {
    max_users: 50, max_shutdowns: 10, max_projects: 25, max_storage_gb: 50,
    max_documents: 2000, max_reports: 500, max_dashboards: 50, max_scheduled_reports: 25,
    max_ai_credits: 5000, max_api_calls_daily: 50000, max_bg_jobs_daily: 2000, max_emails_monthly: 5000,
  },
  enterprise: {
    max_users: 200, max_shutdowns: 50, max_projects: 100, max_storage_gb: 200,
    max_documents: 10000, max_reports: 2000, max_dashboards: 200, max_scheduled_reports: 100,
    max_ai_credits: 20000, max_api_calls_daily: 200000, max_bg_jobs_daily: 10000, max_emails_monthly: 20000,
  },
  unlimited: {
    max_users: 999999, max_shutdowns: 999999, max_projects: 999999, max_storage_gb: 999999,
    max_documents: 999999, max_reports: 999999, max_dashboards: 999999, max_scheduled_reports: 999999,
    max_ai_credits: 999999, max_api_calls_daily: 999999, max_bg_jobs_daily: 999999, max_emails_monthly: 999999,
  },
  custom: {
    max_users: 15, max_shutdowns: 5, max_projects: 10, max_storage_gb: 10,
    max_documents: 500, max_reports: 100, max_dashboards: 20, max_scheduled_reports: 10,
    max_ai_credits: 1000, max_api_calls_daily: 10000, max_bg_jobs_daily: 500, max_emails_monthly: 1000,
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// Service
// ═══════════════════════════════════════════════════════════════════════════════

export class LicenseService {

  /**
   * Generate a unique license number: SYO-XXXX-XXXX
   */
  private generateLicenseNumber(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No O/0/I/1
    const seg = (len: number) =>
      Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    return `SYO-${seg(4)}-${seg(4)}`;
  }

  /**
   * Create a license for an organization.
   * If the org already has a license, throws an error.
   */
  async createLicense(input: LicenseInput) {
    const existing = await prisma.platform_licenses.findUnique({
      where: { organization_id: input.organizationId },
    });
    if (existing) {
      throw new Error(`Organization ${input.organizationId} already has a license (${existing.license_number})`);
    }

    const defaults = LICENSE_DEFAULTS[input.licenseType];
    const limits = { ...defaults, ...(input.limits ?? {}) };

    let licenseNumber = this.generateLicenseNumber();
    // Ensure uniqueness (collision extremely unlikely but safe)
    let attempts = 0;
    while (attempts < 5) {
      const dup = await prisma.platform_licenses.findUnique({ where: { license_number: licenseNumber } });
      if (!dup) break;
      licenseNumber = this.generateLicenseNumber();
      attempts++;
    }

    const license = await prisma.platform_licenses.create({
      data: {
        organization_id: input.organizationId,
        license_number: licenseNumber,
        license_type: input.licenseType,
        status: 'active',
        expires_at: input.expiresAt,
        grace_period_days: input.gracePeriodDays ?? 14,
        ...limits,
        notes: input.notes,
        created_by: input.createdBy,
      },
    });

    logger.info('LicenseService', 'License created', {
      licenseNumber, orgId: input.organizationId, type: input.licenseType,
    });

    return license;
  }

  /**
   * Get the license for an organization.
   */
  async getLicense(organizationId: string) {
    return prisma.platform_licenses.findUnique({
      where: { organization_id: organizationId },
      include: { organization: { select: { name: true, slug: true } } },
    });
  }

  /**
   * List all licenses with org info.
   */
  async listLicenses(filters?: { type?: LicenseType; status?: LicenseStatus }) {
    const where: any = {};
    if (filters?.type) where.license_type = filters.type;
    if (filters?.status) where.status = filters.status;

    return prisma.platform_licenses.findMany({
      where,
      include: { organization: { select: { id: true, name: true, slug: true, is_active: true } } },
      orderBy: { created_at: 'desc' },
    });
  }

  /**
   * Update a license's limits, status, or expiry.
   */
  async updateLicense(id: string, updates: Partial<{
    license_type: LicenseType;
    status: LicenseStatus;
    expires_at: Date | null;
    grace_period_days: number;
    notes: string;
  } & Record<LimitKey, number>>) {
    const license = await prisma.platform_licenses.update({
      where: { id },
      data: updates as any,
    });

    logger.audit('LicenseService', 'License updated', { id, updates });
    return license;
  }

  /**
   * Check if a resource limit is exceeded.
   * Returns whether the action is allowed and the remaining quota.
   */
  async checkLimit(organizationId: string, limitKey: LimitKey, currentCount?: number): Promise<LimitCheckResult> {
    const license = await prisma.platform_licenses.findUnique({
      where: { organization_id: organizationId },
    });

    if (!license) {
      // No license = trial defaults
      const defaults = LICENSE_DEFAULTS.trial;
      return {
        allowed: true,
        current: currentCount ?? 0,
        limit: defaults[limitKey],
        remaining: defaults[limitKey] - (currentCount ?? 0),
        limitKey,
      };
    }

    const limit = (license as any)[limitKey] as number;
    const current = currentCount ?? await this.getCurrentCount(organizationId, limitKey);

    return {
      allowed: current < limit,
      current,
      limit,
      remaining: Math.max(0, limit - current),
      limitKey,
    };
  }

  /**
   * Get the current count for a limit key by querying the database.
   */
  private async getCurrentCount(organizationId: string, limitKey: LimitKey): Promise<number> {
    switch (limitKey) {
      case 'max_users':
        return prisma.user.count({ where: { organization_id: organizationId, deleted_at: null, is_active: true } });
      case 'max_shutdowns':
        return prisma.event.count({ where: { organization_id: organizationId, deleted_at: null } });
      case 'max_projects':
        return prisma.project.count({ where: { organization_id: organizationId, deleted_at: null } });
      case 'max_documents':
        return prisma.docLibrary.count({ where: { organization_id: organizationId, deleted_at: null } });
      case 'max_reports':
        return prisma.report_templates.count({ where: { organization_id: organizationId } });
      case 'max_dashboards':
        // Dashboards stored in OIS dashboard definitions
        return 0; // TODO: count from OIS when table exists
      default:
        return 0;
    }
  }

  /**
   * Get a full usage summary for an organization.
   */
  async getUsageSummary(organizationId: string) {
    const license = await this.getLicense(organizationId);
    if (!license) return null;

    const limitKeys: LimitKey[] = [
      'max_users', 'max_shutdowns', 'max_projects', 'max_documents', 'max_reports',
    ];

    const checks = await Promise.all(
      limitKeys.map((key) => this.checkLimit(organizationId, key)),
    );

    return {
      license: {
        number: license.license_number,
        type: license.license_type,
        status: license.status,
        expiresAt: license.expires_at,
      },
      limits: checks.reduce((acc, c) => {
        acc[c.limitKey] = { current: c.current, limit: c.limit, remaining: c.remaining, allowed: c.allowed };
        return acc;
      }, {} as Record<string, any>),
    };
  }

  /**
   * Check and update license expiry status.
   * Designed to run as a daily cron job.
   */
  async enforceExpiry(): Promise<{ expired: number; graced: number }> {
    const now = new Date();
    let expired = 0;
    let graced = 0;

    const activeLicenses = await prisma.platform_licenses.findMany({
      where: { status: { in: ['active', 'grace'] }, expires_at: { not: null } },
    });

    for (const lic of activeLicenses) {
      if (!lic.expires_at) continue;

      const graceEnd = new Date(lic.expires_at.getTime() + lic.grace_period_days * 24 * 60 * 60 * 1000);

      if (now > graceEnd) {
        // Past grace period — expire
        await prisma.platform_licenses.update({
          where: { id: lic.id },
          data: { status: 'expired' },
        });
        expired++;
        logger.audit('LicenseService', 'License expired', { id: lic.id, licenseNumber: lic.license_number });
      } else if (now > lic.expires_at && lic.status === 'active') {
        // In grace period
        await prisma.platform_licenses.update({
          where: { id: lic.id },
          data: { status: 'grace' },
        });
        graced++;
        logger.info('LicenseService', 'License entered grace period', {
          id: lic.id, licenseNumber: lic.license_number, graceEnd: graceEnd.toISOString(),
        });
      }
    }

    return { expired, graced };
  }

  /**
   * Get license statistics for the platform dashboard.
   */
  async getStats() {
    const all = await prisma.platform_licenses.findMany({
      select: { license_type: true, status: true, expires_at: true },
    });

    const byType: Record<string, number> = {};
    const byStatus: Record<string, number> = {};
    let expiringSoon = 0;
    const in30d = Date.now() + 30 * 24 * 60 * 60 * 1000;

    for (const lic of all) {
      byType[lic.license_type] = (byType[lic.license_type] ?? 0) + 1;
      byStatus[lic.status] = (byStatus[lic.status] ?? 0) + 1;
      if (lic.expires_at && lic.expires_at.getTime() <= in30d && lic.status === 'active') {
        expiringSoon++;
      }
    }

    return { total: all.length, byType, byStatus, expiringSoon };
  }
}

// ─── Singleton ──────────────────────────────────────────────────────────────

export const licenseService = new LicenseService();
