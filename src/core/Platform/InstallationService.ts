/**
 * M7.6G.1 — Installation Service
 *
 * Checks infrastructure, creates platform admin, first org, applies defaults.
 * Reuses existing readiness, LicenseService, ModuleService, SeedPackService.
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { getSystemReadiness } from '@/lib/system/readiness';
import { licenseService } from '@/core/platform/LicenseService';
import { moduleService } from '@/core/platform/ModuleService';
import { seedPackService } from '@/core/platform/SeedPackService';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { permissionsForRoles } from '@/lib/permissions';

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

export interface InfraCheck {
  component: string;
  status: 'ok' | 'warning' | 'error';
  message: string;
  details?: string;
}

export interface InstallationStatus {
  isInstalled: boolean;
  checks: {
    database: boolean;
    platformOrg: boolean;
    platformAdmin: boolean;
    roles: boolean;
    modules: boolean;
  };
  infra: InfraCheck[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// Service
// ═══════════════════════════════════════════════════════════════════════════════

export class InstallationService {

  /**
   * Check if the platform is already installed.
   */
  async getStatus(): Promise<InstallationStatus> {
    const infra: InfraCheck[] = [];

    // Database
    let dbOk = false;
    try {
      await prisma.$queryRaw`SELECT 1`;
      dbOk = true;
      infra.push({ component: 'Database', status: 'ok', message: 'Connected' });
    } catch (err: any) {
      infra.push({ component: 'Database', status: 'error', message: 'Connection failed', details: err.message });
    }

    // Redis
    try {
      const redisUrl = process.env.REDIS_URL;
      infra.push({
        component: 'Redis',
        status: redisUrl ? 'ok' : 'warning',
        message: redisUrl ? 'Configured' : 'Not configured (optional)',
      });
    } catch {
      infra.push({ component: 'Redis', status: 'warning', message: 'Not configured' });
    }

    // SMTP
    const smtpHost = process.env.SMTP_HOST ?? process.env.EMAIL_SERVER_HOST;
    infra.push({
      component: 'SMTP',
      status: smtpHost ? 'ok' : 'warning',
      message: smtpHost ? `Configured: ${smtpHost}` : 'Not configured (optional)',
    });

    // AI
    const aiKey = process.env.OPENAI_API_KEY ?? process.env.AI_API_KEY;
    infra.push({
      component: 'AI Provider',
      status: aiKey ? 'ok' : 'warning',
      message: aiKey ? 'API key configured' : 'Not configured (optional)',
    });

    // Storage
    infra.push({ component: 'Storage', status: 'ok', message: 'Local filesystem' });

    // Check existing data
    let platformOrg = false, platformAdmin = false, hasRoles = false, hasModules = false;
    if (dbOk) {
      const orgCount = await prisma.organization.count({ where: { deleted_at: null } });
      platformOrg = orgCount > 0;

      const adminCount = await prisma.user.count({ where: { is_super_admin: true, deleted_at: null } });
      platformAdmin = adminCount > 0;

      hasRoles = (await prisma.role.count()) > 0;
      hasModules = (await prisma.platform_modules.count()) > 0;
    }

    return {
      isInstalled: platformOrg && platformAdmin,
      checks: {
        database: dbOk,
        platformOrg,
        platformAdmin,
        roles: hasRoles,
        modules: hasModules,
      },
      infra,
    };
  }

  /**
   * Run full installation.
   */
  async install(config: {
    adminName: string;
    adminEmail: string;
    adminPassword: string;
    orgName?: string;
    orgSlug?: string;
    seedPackSlug?: string;
  }) {
    const log: string[] = [];

    // 1. Platform Organization
    const org = await prisma.organization.upsert({
      where: { slug: 'syority-platform' },
      update: {},
      create: {
        name: config.orgName ?? 'Syority Technologies',
        slug: config.orgSlug ?? 'syority-platform',
        is_active: true,
        tenant_type: 'platform',
      },
    });
    log.push(`✅ Platform organization: ${org.name}`);

    // 2. Default Site
    const site = await prisma.site.upsert({
      where: { organization_id_code: { organization_id: org.id, code: 'HQ' } },
      update: {},
      create: {
        organization_id: org.id,
        name: 'Headquarters',
        code: 'HQ',
        is_active: true,
        created_by: null as any,
      },
    });
    log.push(`✅ Default site: ${site.name}`);

    // 3. Platform Super Admin Role
    const perms = permissionsForRoles(['platform_super_admin']);
    const role = await prisma.role.upsert({
      where: { organization_id_slug: { organization_id: org.id, slug: 'platform_super_admin' } },
      update: { permissions: perms },
      create: {
        id: randomUUID(),
        organization_id: org.id,
        name: 'Platform Super Admin',
        slug: 'platform_super_admin',
        permissions: perms,
        is_system: true,
        created_by: null as any,
      },
    });
    log.push(`✅ Platform role: ${role.name}`);

    // 4. Platform Admin User
    const passwordHash = await bcrypt.hash(config.adminPassword, 12);
    const existingAdmin = await prisma.user.findFirst({ where: { email: config.adminEmail } });
    if (!existingAdmin) {
      await prisma.user.create({
        data: {
          id: randomUUID(),
          organization_id: org.id,
          name: config.adminName,
          email: config.adminEmail,
          password_hash: passwordHash,
          role: 'platform_super_admin',
          role_id: role.id,
          is_active: true,
          is_super_admin: true,
          must_change_password: false,
        },
      });
      log.push(`✅ Admin user: ${config.adminEmail}`);
    } else {
      log.push(`⚠️ Admin user already exists: ${config.adminEmail}`);
    }

    // 5. Seed module catalog
    try {
      await moduleService.seedCatalog();
      log.push(`✅ Module catalog seeded`);
    } catch {
      log.push(`⚠️ Module catalog already seeded`);
    }

    // 6. Seed built-in packs
    try {
      await seedPackService.seedBuiltinPacks();
      log.push(`✅ Seed packs initialized`);
    } catch {
      log.push(`⚠️ Seed packs already initialized`);
    }

    // 7. Optional: Execute seed pack for first org
    if (config.seedPackSlug && config.seedPackSlug !== 'none') {
      try {
        const pack = await seedPackService.get(config.seedPackSlug);
        if (pack) {
          const result = await seedPackService.execute(pack.id);
          log.push(`✅ Seed pack "${pack.name}" executed: ${result.recordsCreated} records`);
        }
      } catch (err: any) {
        log.push(`⚠️ Seed pack execution: ${err.message}`);
      }
    }

    logger.audit('InstallationService', 'Platform installed', { adminEmail: config.adminEmail });
    return { success: true, log };
  }

  /**
   * Generate installation report.
   */
  async generateReport() {
    const status = await this.getStatus();
    const readiness = await getSystemReadiness();

    const orgCount = await prisma.organization.count({ where: { deleted_at: null } });
    const userCount = await prisma.user.count({ where: { deleted_at: null } });
    const roleCount = await prisma.role.count();
    const moduleCount = await prisma.platform_modules.count();
    const seedPackCount = await prisma.seed_packs.count();

    let version = '1.0.0';
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      version = require('@/../package.json').version;
    } catch { /* ignore */ }

    return {
      version,
      environment: process.env.NEXT_PUBLIC_ENVIRONMENT ?? process.env.NODE_ENV,
      isInstalled: status.isInstalled,
      isReady: readiness.isReady,
      infrastructure: status.infra,
      counts: { organizations: orgCount, users: userCount, roles: roleCount, modules: moduleCount, seedPacks: seedPackCount },
      timestamp: new Date().toISOString(),
    };
  }
}

// ─── Singleton ──────────────────────────────────────────────────────────────

export const installationService = new InstallationService();
