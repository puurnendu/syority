/**
 * M7.7.1 — Tenant Provisioning Service (Enterprise)
 *
 * Production-grade multi-tenant provisioning engine.
 * Creates an isolated tenant with organization, license, site, hierarchy,
 * roles, admin user, master data, calendars, and modules.
 *
 * Supports both synchronous (legacy) and step-by-step (async job) execution.
 * Each step is self-contained for resumability.
 *
 * Reuses existing services:
 *   LicenseService  → createLicense()
 *   ModuleService   → initializeForOrganization()
 *   SeedPackService → execute()
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { licenseService } from '@/core/Platform/LicenseService';
import { moduleService } from '@/core/Platform/ModuleService';
import { seedPackService } from '@/core/Platform/SeedPackService';
import { permissionsForRoles } from '@/lib/permissions';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import {
  DEFAULT_DISCIPLINES,
  DEFAULT_EQUIPMENT_TYPES,
  DEFAULT_ROLES,
} from '@/config/tenant-defaults';
import { DEFAULT_CALENDARS } from '@/config/default-calendars';

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

export interface ProvisioningRequest {
  // Step 1: Company
  company: {
    name: string;
    shortName?: string;
    slug: string;
    industry?: string;
    country?: string;
    timezone?: string;
    currency?: string;
    language?: string;
    primaryColor?: string;
    platformName?: string;
  };
  // Step 2: License
  license: {
    type: 'professional' | 'enterprise' | 'unlimited';
    seatCount: number;
    expiresAt?: string;
    enabledModules: string[];
    aiCredits?: number;
    storageQuotaGb?: number;
    documentQuota?: number;
  };
  // Step 3: Hierarchy (M7.7.1 — now supports Areas)
  hierarchy: {
    plants: Array<{
      name: string;
      code: string;
      areas?: Array<{
        name: string;
        code: string;
        units: Array<{
          name: string;
          code: string;
          systems: Array<{ name: string; code: string }>;
        }>;
      }>;
      units: Array<{
        name: string;
        code: string;
        systems: Array<{ name: string; code: string }>;
      }>;
    }>;
    disciplines: string[];
  };
  // Step 4: Site
  site: {
    name: string;
    code: string;
    address?: string;
    country?: string;
    timezone?: string;
  };
  // Step 5: Admin User
  admin: {
    name: string;
    email: string;
    phone?: string;
    tempPassword: string;
    mustChangePassword: boolean;
    sendWelcomeEmail: boolean;
  };
  // Step 6: Configuration (optional)
  config?: {
    smtpHost?: string;
    aiProvider?: string;
    storageProvider?: string;
    reportTheme?: string;
  };
  // M7.7.1 — Optional template & seed packs
  templateId?: string;
  seedPacks?: string[];
  // Metadata
  provisionedBy: string;
}

export interface ProvisioningResult {
  success: boolean;
  organizationId?: string;
  siteId?: string;
  adminUserId?: string;
  licenseNumber?: string;
  summary: {
    organization: string;
    site: string;
    plants: number;
    units: number;
    systems: number;
    areas: number;
    roles: number;
    disciplines: number;
    equipmentTypes: number;
    calendars: number;
    modules: number;
    adminEmail: string;
  };
  auditLog: string[];
  error?: string;
}

interface ValidationError {
  field: string;
  message: string;
}

/** Step context passed between provisioning steps */
export interface StepContext {
  orgId: string;
  siteId: string;
  adminUserId: string;
  roleMap: Record<string, string>;
  counters: {
    plants: number;
    units: number;
    systems: number;
    areas: number;
    disciplines: number;
    equipmentTypes: number;
    calendars: number;
    roles: number;
    modules: number;
  };
  auditLog: string[];
  passwordHash: string;
}

/** Provisioning step names for progress tracking */
export const PROVISIONING_STEPS = [
  'organization',
  'site',
  'roles',
  'users',
  'hierarchy',
  'disciplines',
  'equipment_types',
  'calendars',
  'templates',
  'seed_packs',
  'modules',
  'license',
  'notifications',
] as const;

export type ProvisioningStep = (typeof PROVISIONING_STEPS)[number];

// ═══════════════════════════════════════════════════════════════════════════════
// Service
// ═══════════════════════════════════════════════════════════════════════════════

export class TenantProvisioningService {

  /**
   * Pre-flight validation before provisioning.
   */
  async validate(request: ProvisioningRequest): Promise<ValidationError[]> {
    const errors: ValidationError[] = [];

    // Required fields
    if (!request.company.name?.trim()) {
      errors.push({ field: 'company.name', message: 'Company name is required' });
    }
    if (!request.company.slug?.trim()) {
      errors.push({ field: 'company.slug', message: 'Slug is required' });
    }
    if (!request.site.name?.trim()) {
      errors.push({ field: 'site.name', message: 'Site name is required' });
    }
    if (!request.site.code?.trim()) {
      errors.push({ field: 'site.code', message: 'Site code is required' });
    }
    if (!request.admin.name?.trim()) {
      errors.push({ field: 'admin.name', message: 'Admin name is required' });
    }
    if (!request.admin.email?.trim()) {
      errors.push({ field: 'admin.email', message: 'Admin email is required' });
    }
    if (!request.admin.tempPassword || request.admin.tempPassword.length < 8) {
      errors.push({ field: 'admin.tempPassword', message: 'Password must be at least 8 characters' });
    }
    if (!request.license.type) {
      errors.push({ field: 'license.type', message: 'License type is required' });
    }

    // Slug format
    const slugRegex = /^[a-z0-9][a-z0-9-]*[a-z0-9]$/;
    if (request.company.slug && !slugRegex.test(request.company.slug)) {
      errors.push({ field: 'company.slug', message: 'Slug must be lowercase alphanumeric with dashes' });
    }

    // Email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (request.admin.email && !emailRegex.test(request.admin.email)) {
      errors.push({ field: 'admin.email', message: 'Invalid email format' });
    }

    // Skip DB checks if basic validation already failed
    if (errors.length > 0) return errors;

    // Slug uniqueness
    const existingOrg = await prisma.organization.findFirst({
      where: { slug: request.company.slug, deleted_at: null },
    });
    if (existingOrg) {
      errors.push({ field: 'company.slug', message: `Slug "${request.company.slug}" is already taken` });
    }

    // Email uniqueness
    const existingUser = await prisma.user.findFirst({
      where: { email: request.admin.email, deleted_at: null },
    });
    if (existingUser) {
      errors.push({ field: 'admin.email', message: `Email "${request.admin.email}" is already registered` });
    }

    return errors;
  }

  /**
   * Check if a slug is available.
   */
  async checkSlug(slug: string): Promise<boolean> {
    const existing = await prisma.organization.findFirst({
      where: { slug, deleted_at: null },
    });
    return !existing;
  }

  /**
   * Check if an email is available.
   */
  async checkEmail(email: string): Promise<boolean> {
    const existing = await prisma.user.findFirst({
      where: { email, deleted_at: null },
    });
    return !existing;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Individual Steps (used by both sync and async provisioning)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Step: Create Organization.
   */
  async stepOrganization(tx: any, request: ProvisioningRequest): Promise<{ id: string; name: string; slug: string | null }> {
    const org = await tx.organization.create({
      data: {
        id: randomUUID(),
        name: request.company.name,
        slug: request.company.slug,
        industry: request.company.industry,
        country: request.company.country,
        timezone: request.company.timezone ?? 'UTC',
        currency: request.company.currency ?? 'USD',
        primary_color: request.company.primaryColor ?? '#4F46E5',
        platform_name: request.company.platformName ?? 'SYORITY',
        tenant_type: 'Client',
        is_active: true,
        plan_tier: request.license.type,
        max_users: request.license.seatCount,
        onboarded_by: request.provisionedBy,
        onboarded_at: new Date(),
        updated_at: new Date(),
        lifecycle_status: 'provisioning',
      },
    });
    return org;
  }

  /**
   * Step: Create Site.
   */
  async stepSite(tx: any, request: ProvisioningRequest, orgId: string) {
    return tx.site.create({
      data: {
        organization_id: orgId,
        name: request.site.name,
        code: request.site.code,
        location: request.site.address,
        timezone: request.site.timezone ?? request.company.timezone ?? 'UTC',
        is_active: true,
      },
    });
  }

  /**
   * Step: Create Default Roles.
   */
  async stepRoles(tx: any, orgId: string): Promise<Record<string, string>> {
    const roleMap: Record<string, string> = {};
    for (const roleDef of DEFAULT_ROLES) {
      const perms = permissionsForRoles([roleDef.slug]);
      const role = await tx.role.create({
        data: {
          id: randomUUID(),
          organization_id: orgId,
          name: roleDef.name,
          slug: roleDef.slug,
          permissions: perms,
          is_system: true,
          updated_at: new Date(),
        },
      });
      roleMap[roleDef.slug] = role.id;
    }
    return roleMap;
  }

  /**
   * Step: Create Admin User + assign role.
   */
  async stepUser(
    tx: any,
    request: ProvisioningRequest,
    orgId: string,
    siteId: string,
    roleMap: Record<string, string>,
    passwordHash: string,
  ) {
    const adminUser = await tx.user.create({
      data: {
        organization_id: orgId,
        site_id: siteId,
        name: request.admin.name,
        email: request.admin.email,
        password: passwordHash,
        phone: request.admin.phone,
        is_active: true,
        is_tenant_admin: true,
        must_change_password: request.admin.mustChangePassword,
      },
    });

    // Assign Organization Admin role
    const adminRoleId = roleMap['tenant_administrator'];
    if (adminRoleId) {
      await tx.userRole.create({
        data: {
          organization_id: orgId,
          user_id: adminUser.id,
          role_id: adminRoleId,
          site_id: siteId,
        },
      });
    }
    return adminUser;
  }

  /**
   * Step: Create Hierarchy — Plant → (Area) → Unit → System.
   * M7.7.1: now supports optional Area level.
   */
  async stepHierarchy(
    tx: any,
    request: ProvisioningRequest,
    orgId: string,
    siteId: string,
  ): Promise<{ plants: number; areas: number; units: number; systems: number }> {
    const counters = { plants: 0, areas: 0, units: 0, systems: 0 };

    const validPlants = request.hierarchy.plants.filter((p) => p.name?.trim());
    for (const plantDef of validPlants) {
      const plant = await tx.plant.create({
        data: {
          organization_id: orgId,
          site_id: siteId,
          name: plantDef.name,
          code: plantDef.code,
          is_active: true,
        },
      });
      counters.plants++;

      // Areas (M7.7.1) — optional intermediate level
      if (plantDef.areas && plantDef.areas.length > 0) {
        for (const areaDef of plantDef.areas.filter((a) => a.name?.trim())) {
          const area = await tx.area.create({
            data: {
              organization_id: orgId,
              site_id: siteId,
              plant_id: plant.id,
              name: areaDef.name,
              code: areaDef.code,
              is_active: true,
            },
          });
          counters.areas++;

          for (const unitDef of areaDef.units.filter((u) => u.name?.trim())) {
            const unit = await tx.unit.create({
              data: {
                organization_id: orgId,
                site_id: siteId,
                plant_id: plant.id,
                area_id: area.id,
                name: unitDef.name,
                code: unitDef.code,
                is_active: true,
              },
            });
            counters.units++;

            for (const sysDef of unitDef.systems.filter((s) => s.name?.trim())) {
              await tx.system.create({
                data: {
                  organization_id: orgId,
                  site_id: siteId,
                  unit_id: unit.id,
                  name: sysDef.name,
                  code: sysDef.code,
                  is_active: true,
                },
              });
              counters.systems++;
            }
          }
        }
      }

      // Direct units (no area — backward compat)
      for (const unitDef of (plantDef.units ?? []).filter((u) => u.name?.trim())) {
        const unit = await tx.unit.create({
          data: {
            organization_id: orgId,
            site_id: siteId,
            plant_id: plant.id,
            name: unitDef.name,
            code: unitDef.code,
            is_active: true,
          },
        });
        counters.units++;

        for (const sysDef of unitDef.systems.filter((s) => s.name?.trim())) {
          await tx.system.create({
            data: {
              organization_id: orgId,
              site_id: siteId,
              unit_id: unit.id,
              name: sysDef.name,
              code: sysDef.code,
              is_active: true,
            },
          });
          counters.systems++;
        }
      }
    }
    return counters;
  }

  /**
   * Step: Create Disciplines.
   */
  async stepDisciplines(tx: any, request: ProvisioningRequest, orgId: string): Promise<number> {
    const selectedDisciplines = request.hierarchy.disciplines.length > 0
      ? DEFAULT_DISCIPLINES.filter((d) => request.hierarchy.disciplines.includes(d.code))
      : DEFAULT_DISCIPLINES;

    let count = 0;
    for (const disc of selectedDisciplines) {
      await tx.discipline.create({
        data: {
          id: randomUUID(),
          organization_id: orgId,
          name: disc.name,
          code: disc.code,
          color: disc.color,
          is_active: true,
          updated_at: new Date(),
        },
      });
      count++;
    }
    return count;
  }

  /**
   * Step: Create Equipment Types.
   */
  async stepEquipmentTypes(tx: any, orgId: string): Promise<number> {
    let count = 0;
    for (const eq of DEFAULT_EQUIPMENT_TYPES) {
      await tx.equipmentType.create({
        data: {
          id: randomUUID(),
          org_id: orgId,
          name: eq.name,
          code: eq.code,
          is_active: true,
        },
      });
      count++;
    }
    return count;
  }

  /**
   * Step: Create Calendars.
   */
  async stepCalendars(tx: any, orgId: string): Promise<number> {
    let count = 0;
    for (const cal of DEFAULT_CALENDARS) {
      await tx.scheduleCalendar.create({
        data: {
          id: randomUUID(),
          organization_id: orgId,
          name: cal.name,
          work_days: cal.work_days,
          hours_per_day: cal.hours_per_day,
          is_default: cal.is_default ?? false,
          exceptions: [],
        },
      });
      count++;
    }
    return count;
  }

  /**
   * Step: Create Audit Entries.
   */
  async stepAuditEntries(
    tx: any,
    provisionedBy: string,
    orgId: string,
    siteId: string,
    adminEmail: string,
    request: ProvisioningRequest,
    counters: StepContext['counters'],
  ) {
    const auditEntries = [
      { action: 'tenant.create', metadata: { orgName: request.company.name, slug: request.company.slug } },
      { action: 'site.create', metadata: { siteName: request.site.name, siteCode: request.site.code } },
      { action: 'user.create', metadata: { email: adminEmail, role: 'tenant_administrator' } },
      { action: 'license.provision', metadata: { type: request.license.type, seats: request.license.seatCount } },
      { action: 'hierarchy.create', metadata: { plants: counters.plants, units: counters.units, systems: counters.systems, areas: counters.areas } },
      { action: 'masterdata.seed', metadata: { disciplines: counters.disciplines, equipmentTypes: counters.equipmentTypes, calendars: counters.calendars } },
    ];

    for (const entry of auditEntries) {
      await tx.systemAuditLog.create({
        data: {
          user_id: provisionedBy,
          target_tenant_id: orgId,
          action: entry.action,
          metadata: entry.metadata,
        },
      });
    }
  }

  /**
   * Step: Create Schedule Calendars.
   * Creates default calendars for the organization.
   * Falls back gracefully if the schedule_calendars table doesn't exist yet.
   */
  async stepCalendars(tx: any, orgId: string): Promise<number> {
    let count = 0;
    try {
      for (const cal of DEFAULT_CALENDARS) {
        await tx.scheduleCalendar.create({
          data: {
            id: randomUUID(),
            organization_id: orgId,
            name: cal.name,
            work_days: cal.work_days,
            hours_per_day: cal.hours_per_day,
            is_default: cal.is_default,
          }
        });
        count++;
      }
    } catch (err: any) {
      // Table may not exist yet or other schema mismatch
      logger.info('TenantProvisioningService', `stepCalendars skipped: ${err.message}`);
      count = 0;
    }
    return count;
  }

  /**
   * Step: Apply Seed Packs (post-transaction).
   */
  async stepSeedPacks(request: ProvisioningRequest, orgId: string): Promise<string[]> {
    const results: string[] = [];
    if (!request.seedPacks || request.seedPacks.length === 0) return results;

    for (const packId of request.seedPacks) {
      try {
        await seedPackService.execute(packId, { targetOrganizationId: orgId });
        results.push(`✅ Seed pack applied: ${packId}`);
      } catch (err: any) {
        results.push(`⚠️ Seed pack ${packId}: ${err.message}`);
      }
    }
    return results;
  }

  /**
   * Step: License creation (post-transaction).
   */
  async stepLicense(request: ProvisioningRequest, orgId: string): Promise<string> {
    const license = await licenseService.createLicense({
      organizationId: orgId,
      licenseType: request.license.type,
      expiresAt: request.license.expiresAt ? new Date(request.license.expiresAt) : undefined,
      limits: {
        max_users: request.license.seatCount,
        max_ai_credits: request.license.aiCredits,
        max_storage_gb: request.license.storageQuotaGb,
        max_documents: request.license.documentQuota,
      },
      createdBy: request.provisionedBy,
    });
    return license.license_number;
  }

  /**
   * Step: Module initialization (post-transaction).
   */
  async stepModules(request: ProvisioningRequest, orgId: string): Promise<number> {
    const modulesInitialized = await moduleService.initializeForOrganization(orgId);

    // Override enabled modules based on user selection
    if (request.license.enabledModules.length > 0) {
      const allModules = await prisma.platform_modules.findMany();
      for (const mod of allModules) {
        const shouldBeEnabled = request.license.enabledModules.includes(mod.slug) || mod.is_core;
        if (!shouldBeEnabled) {
          await moduleService.setModuleStatus(orgId, mod.id, 'disabled');
        }
      }
    }
    return modulesInitialized;
  }

  /**
   * Step: Finalize — set lifecycle to active.
   */
  async stepFinalize(orgId: string, provisionedBy: string) {
    await prisma.organization.update({
      where: { id: orgId },
      data: {
        lifecycle_status: 'active',
        lifecycle_changed_at: new Date(),
        lifecycle_changed_by: provisionedBy,
      },
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Step-by-step execution (for async job worker)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Execute a single provisioning step.
   * Used by ProvisioningJobService for async/resumable provisioning.
   */
  async executeStep(
    step: ProvisioningStep,
    request: ProvisioningRequest,
    context: Partial<StepContext>,
  ): Promise<{ context: Partial<StepContext>; message: string }> {
    const orgId = context.orgId ?? '';
    const siteId = context.siteId ?? '';

    switch (step) {
      case 'organization': {
        const org = await prisma.$transaction(async (tx) => this.stepOrganization(tx, request));
        return {
          context: { ...context, orgId: org.id, auditLog: [...(context.auditLog ?? []), `✅ Organization: ${org.name}`] },
          message: `Organization created: ${org.name}`,
        };
      }

      case 'site': {
        const site = await prisma.$transaction(async (tx) => this.stepSite(tx, request, orgId));
        return {
          context: { ...context, siteId: site.id, auditLog: [...(context.auditLog ?? []), `✅ Site: ${site.name}`] },
          message: `Site created: ${site.name}`,
        };
      }

      case 'roles': {
        const roleMap = await prisma.$transaction(async (tx) => this.stepRoles(tx, orgId));
        const count = Object.keys(roleMap).length;
        return {
          context: {
            ...context,
            roleMap,
            counters: { ...(context.counters ?? this.emptyCounters()), roles: count },
            auditLog: [...(context.auditLog ?? []), `✅ Roles: ${count}`],
          },
          message: `${count} roles created`,
        };
      }

      case 'users': {
        const hash = context.passwordHash || await bcrypt.hash(request.admin.tempPassword, 12);
        const adminUser = await prisma.$transaction(async (tx) =>
          this.stepUser(tx, request, orgId, siteId, context.roleMap ?? {}, hash),
        );
        return {
          context: {
            ...context,
            adminUserId: adminUser.id,
            passwordHash: hash,
            auditLog: [...(context.auditLog ?? []), `✅ Admin: ${adminUser.email}`],
          },
          message: `Admin user created: ${adminUser.email}`,
        };
      }

      case 'hierarchy': {
        const hCounts = await prisma.$transaction(async (tx) =>
          this.stepHierarchy(tx, request, orgId, siteId),
        );
        const prev = context.counters ?? this.emptyCounters();
        return {
          context: {
            ...context,
            counters: { ...prev, ...hCounts },
            auditLog: [...(context.auditLog ?? []), `✅ Hierarchy: ${hCounts.plants}P/${hCounts.areas}A/${hCounts.units}U/${hCounts.systems}S`],
          },
          message: `${hCounts.plants} plants, ${hCounts.areas} areas, ${hCounts.units} units, ${hCounts.systems} systems`,
        };
      }

      case 'disciplines': {
        const dCount = await prisma.$transaction(async (tx) =>
          this.stepDisciplines(tx, request, orgId),
        );
        const prev2 = context.counters ?? this.emptyCounters();
        return {
          context: {
            ...context,
            counters: { ...prev2, disciplines: dCount },
            auditLog: [...(context.auditLog ?? []), `✅ Disciplines: ${dCount}`],
          },
          message: `${dCount} disciplines created`,
        };
      }

      case 'equipment_types': {
        const eCount = await prisma.$transaction(async (tx) =>
          this.stepEquipmentTypes(tx, orgId),
        );
        const prev3 = context.counters ?? this.emptyCounters();
        return {
          context: {
            ...context,
            counters: { ...prev3, equipmentTypes: eCount },
            auditLog: [...(context.auditLog ?? []), `✅ Equipment types: ${eCount}`],
          },
          message: `${eCount} equipment types created`,
        };
      }

      case 'calendars': {
        const cCount = await prisma.$transaction(async (tx) =>
          this.stepCalendars(tx, orgId),
        );
        const prev4 = context.counters ?? this.emptyCounters();
        return {
          context: {
            ...context,
            counters: { ...prev4, calendars: cCount },
            auditLog: [...(context.auditLog ?? []), `✅ Calendars: ${cCount}`],
          },
          message: `${cCount} calendars created`,
        };
      }

      case 'templates': {
        // Template config is already merged into request before steps begin
        return {
          context: { ...context, auditLog: [...(context.auditLog ?? []), `✅ Template applied`] },
          message: 'Template configuration applied',
        };
      }

      case 'seed_packs': {
        const spResults = await this.stepSeedPacks(request, orgId);
        return {
          context: { ...context, auditLog: [...(context.auditLog ?? []), ...spResults] },
          message: spResults.length > 0 ? spResults.join('; ') : 'No seed packs selected',
        };
      }

      case 'modules': {
        try {
          const mCount = await this.stepModules(request, orgId);
          const prev5 = context.counters ?? this.emptyCounters();
          return {
            context: {
              ...context,
              counters: { ...prev5, modules: mCount },
              auditLog: [...(context.auditLog ?? []), `✅ Modules: ${mCount}`],
            },
            message: `${mCount} modules initialized`,
          };
        } catch (err: any) {
          return {
            context: { ...context, auditLog: [...(context.auditLog ?? []), `⚠️ Modules: ${err.message}`] },
            message: `Module init warning: ${err.message}`,
          };
        }
      }

      case 'license': {
        try {
          const licNum = await this.stepLicense(request, orgId);
          return {
            context: { ...context, auditLog: [...(context.auditLog ?? []), `✅ License: ${licNum}`] },
            message: `License created: ${licNum}`,
          };
        } catch (err: any) {
          return {
            context: { ...context, auditLog: [...(context.auditLog ?? []), `⚠️ License: ${err.message}`] },
            message: `License warning: ${err.message}`,
          };
        }
      }

      case 'notifications': {
        // Welcome email (non-blocking)
        if (request.admin.sendWelcomeEmail) {
          this.sendWelcomeEmail(
            request.admin.email, request.admin.name,
            request.company.name, request.admin.tempPassword,
          ).catch((err) => logger.error('TenantProvisioningService', 'Welcome email failed', { error: err.message }));
        }
        // Finalize lifecycle
        await this.stepFinalize(orgId, request.provisionedBy);
        return {
          context: { ...context, auditLog: [...(context.auditLog ?? []), `✅ Notifications sent, lifecycle → active`] },
          message: 'Notifications and finalization complete',
        };
      }

      default:
        return { context, message: `Unknown step: ${step}` };
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Synchronous provisioning (legacy — still used by direct API calls)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Full synchronous provisioning. Kept for backward compatibility.
   */
  async provision(request: ProvisioningRequest): Promise<ProvisioningResult> {
    // Validate
    const validationErrors = await this.validate(request);
    if (validationErrors.length > 0) {
      return {
        success: false,
        summary: this.emptySummary(),
        auditLog: validationErrors.map((e) => `❌ ${e.field}: ${e.message}`),
        error: `Validation failed: ${validationErrors.map((e) => `${e.field}: ${e.message}`).join('; ')}`,
      };
    }

    const auditLog: string[] = [];
    const counters = this.emptyCounters();

    try {
      // Hash password outside the transaction (CPU-intensive)
      const passwordHash = await bcrypt.hash(request.admin.tempPassword, 12);

      // Run core steps inside a single interactive transaction
      const result = await prisma.$transaction(async (tx) => {
        const org = await this.stepOrganization(tx, request);
        auditLog.push(`✅ Organization created: ${org.name} (${org.slug})`);

        const site = await this.stepSite(tx, request, org.id);
        auditLog.push(`✅ Site created: ${site.name} (${site.code})`);

        const roleMap = await this.stepRoles(tx, org.id);
        counters.roles = Object.keys(roleMap).length;
        auditLog.push(`✅ Roles created: ${counters.roles}`);

        const adminUser = await this.stepUser(tx, request, org.id, site.id, roleMap, passwordHash);
        auditLog.push(`✅ Admin user created: ${adminUser.email}`);

        const hCounts = await this.stepHierarchy(tx, request, org.id, site.id);
        Object.assign(counters, hCounts);
        if (counters.plants > 0) {
          auditLog.push(`✅ Hierarchy: ${counters.plants} plants, ${counters.areas} areas, ${counters.units} units, ${counters.systems} systems`);
        }

        const dCount = await this.stepDisciplines(tx, request, org.id);
        counters.disciplines = dCount;
        auditLog.push(`✅ Disciplines: ${counters.disciplines}`);

        const eCount = await this.stepEquipmentTypes(tx, org.id);
        counters.equipmentTypes = eCount;
        auditLog.push(`✅ Equipment types: ${counters.equipmentTypes}`);

        const cCount = await this.stepCalendars(tx, org.id);
        counters.calendars = cCount;
        auditLog.push(`✅ Calendars: ${counters.calendars}`);

        // Audit entries
        await this.stepAuditEntries(tx, request.provisionedBy, org.id, site.id, adminUser.email, request, counters);

        return { org, site, adminUser };
      }, { timeout: 30000 });

      // Post-transaction: License
      let licenseNumber = '';
      try {
        licenseNumber = await this.stepLicense(request, result.org.id);
        auditLog.push(`✅ License created: ${licenseNumber} (${request.license.type})`);
      } catch (err: any) {
        auditLog.push(`⚠️ License creation: ${err.message}`);
      }

      // Post-transaction: Modules
      try {
        counters.modules = await this.stepModules(request, result.org.id);
        auditLog.push(`✅ Modules initialized: ${counters.modules}`);
      } catch (err: any) {
        auditLog.push(`⚠️ Module initialization: ${err.message}`);
      }

      // Post-transaction: Seed Packs
      const spLogs = await this.stepSeedPacks(request, result.org.id);
      auditLog.push(...spLogs);

      // Post-transaction: Finalize lifecycle
      await this.stepFinalize(result.org.id, request.provisionedBy);

      // Post-transaction: Welcome email (non-blocking)
      if (request.admin.sendWelcomeEmail) {
        this.sendWelcomeEmail(request.admin.email, request.admin.name, request.company.name, request.admin.tempPassword)
          .catch((err) => logger.error('TenantProvisioningService', 'Welcome email failed', { error: err.message }));
        auditLog.push(`📧 Welcome email queued for ${request.admin.email}`);
      }

      logger.audit('TenantProvisioningService', 'Tenant provisioned', {
        orgId: result.org.id,
        slug: request.company.slug,
        adminEmail: request.admin.email,
      });

      return {
        success: true,
        organizationId: result.org.id,
        siteId: result.site.id,
        adminUserId: result.adminUser.id,
        licenseNumber,
        summary: {
          organization: request.company.name,
          site: request.site.name,
          plants: counters.plants,
          units: counters.units,
          systems: counters.systems,
          areas: counters.areas,
          roles: counters.roles,
          disciplines: counters.disciplines,
          equipmentTypes: counters.equipmentTypes,
          calendars: counters.calendars,
          modules: counters.modules,
          adminEmail: request.admin.email,
        },
        auditLog,
      };
    } catch (err: any) {
      logger.error('TenantProvisioningService', 'Provisioning failed', {
        slug: request.company.slug,
        error: err.message,
        stack: err.stack,
      });

      return {
        success: false,
        summary: this.emptySummary(),
        auditLog: [...auditLog, `❌ ROLLBACK: ${err.message}`],
        error: err.message,
      };
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Helpers
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Send a welcome email to the new tenant admin (non-blocking).
   */
  private async sendWelcomeEmail(email: string, name: string, orgName: string, tempPassword: string) {
    try {
      const { sendEmail } = await import('@/lib/email/emailService');
      await sendEmail({
        to: email,
        subject: `Welcome to AURIANOA OS — ${orgName}`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #0D2137;">Welcome to AURIANOA OS</h2>
            <p>Hello ${name},</p>
            <p>Your organization <strong>${orgName}</strong> has been provisioned on AURIANOA OS.</p>
            <p>Your login credentials:</p>
            <table style="border-collapse: collapse; margin: 16px 0;">
              <tr><td style="padding: 4px 12px; font-weight: bold;">Email:</td><td style="padding: 4px 12px;">${email}</td></tr>
              <tr><td style="padding: 4px 12px; font-weight: bold;">Password:</td><td style="padding: 4px 12px; font-family: monospace;">${tempPassword}</td></tr>
            </table>
            <p>You will be prompted to change your password on first login.</p>
            <p>— AURIANOA Platform Team</p>
          </div>
        `,
      });
    } catch (err: any) {
      logger.warn('TenantProvisioningService', 'Welcome email failed (non-blocking)', { email, error: err.message });
    }
  }

  private emptyCounters(): StepContext['counters'] {
    return { plants: 0, units: 0, systems: 0, areas: 0, disciplines: 0, equipmentTypes: 0, calendars: 0, roles: 0, modules: 0 };
  }

  private emptySummary(): ProvisioningResult['summary'] {
    return {
      organization: '', site: '', plants: 0, units: 0, systems: 0, areas: 0,
      roles: 0, disciplines: 0, equipmentTypes: 0, calendars: 0, modules: 0, adminEmail: '',
    };
  }
}

// ─── Singleton ──────────────────────────────────────────────────────────────

export const tenantProvisioningService = new TenantProvisioningService();
