/**
 * M7.6G — Module Management Service
 *
 * Controls which modules are available per organization.
 * Module status respects license restrictions — core modules cannot be disabled.
 *
 * Module Statuses: enabled | disabled | hidden | beta | coming_soon | experimental
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

export type ModuleStatus = 'enabled' | 'disabled' | 'hidden' | 'beta' | 'coming_soon' | 'experimental';

export interface ModuleDefinition {
  slug: string;
  name: string;
  description?: string;
  category: string;
  icon?: string;
  sortOrder: number;
  isCore: boolean;
  defaultStatus: ModuleStatus;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Default Module Catalog
// ═══════════════════════════════════════════════════════════════════════════════

export const MODULE_CATALOG: ModuleDefinition[] = [
  // Core — cannot be disabled
  { slug: 'authentication', name: 'Authentication', category: 'core', icon: '🔐', sortOrder: 1, isCore: true, defaultStatus: 'enabled' },
  { slug: 'authorization', name: 'Authorization', category: 'core', icon: '🛡️', sortOrder: 2, isCore: true, defaultStatus: 'enabled' },
  { slug: 'organization', name: 'Organization Management', category: 'core', icon: '🏢', sortOrder: 3, isCore: true, defaultStatus: 'enabled' },
  { slug: 'user_management', name: 'User Management', category: 'core', icon: '👥', sortOrder: 4, isCore: true, defaultStatus: 'enabled' },

  // Planning
  { slug: 'digital_plant', name: 'Digital Plant', category: 'planning', icon: '🏭', sortOrder: 10, isCore: false, defaultStatus: 'enabled' },
  { slug: 'asset_register', name: 'Asset Register', category: 'planning', icon: '⚙️', sortOrder: 11, isCore: false, defaultStatus: 'enabled' },
  { slug: 'engineering_issues', name: 'Engineering Issues', category: 'planning', icon: '🔧', sortOrder: 12, isCore: false, defaultStatus: 'enabled' },
  { slug: 'shutdown_scope', name: 'Shutdown Scope', category: 'planning', icon: '📋', sortOrder: 13, isCore: false, defaultStatus: 'enabled' },
  { slug: 'planner_workspace', name: 'Planner Workspace', category: 'planning', icon: '📐', sortOrder: 14, isCore: false, defaultStatus: 'enabled' },

  // Intelligence
  { slug: 'workpack_intelligence', name: 'Workpack Intelligence', category: 'intelligence', icon: '🧠', sortOrder: 20, isCore: false, defaultStatus: 'enabled' },
  { slug: 'knowledge_engine', name: 'Knowledge Engine', category: 'intelligence', icon: '📚', sortOrder: 21, isCore: false, defaultStatus: 'enabled' },
  { slug: 'notification_platform', name: 'Notification Platform', category: 'intelligence', icon: '🔔', sortOrder: 22, isCore: false, defaultStatus: 'enabled' },
  { slug: 'report_builder', name: 'Report Builder', category: 'intelligence', icon: '📊', sortOrder: 23, isCore: false, defaultStatus: 'enabled' },
  { slug: 'report_engine', name: 'Report Engine', category: 'intelligence', icon: '📄', sortOrder: 24, isCore: false, defaultStatus: 'enabled' },
  { slug: 'ois', name: 'Operational Intelligence Studio', category: 'intelligence', icon: '📈', sortOrder: 25, isCore: false, defaultStatus: 'enabled' },
  { slug: 'bre', name: 'Business Rules Engine', category: 'intelligence', icon: '⚡', sortOrder: 26, isCore: false, defaultStatus: 'enabled' },

  // Safety
  { slug: 'safety', name: 'Safety Management', category: 'safety', icon: '🦺', sortOrder: 30, isCore: false, defaultStatus: 'enabled' },

  // Future
  { slug: 'execution', name: 'Execution Management', category: 'future', icon: '🚀', sortOrder: 40, isCore: false, defaultStatus: 'coming_soon' },
  { slug: 'asset_integrity', name: 'Asset Integrity', category: 'future', icon: '🔩', sortOrder: 41, isCore: false, defaultStatus: 'coming_soon' },
  { slug: 'reliability', name: 'Reliability', category: 'future', icon: '📉', sortOrder: 42, isCore: false, defaultStatus: 'coming_soon' },
  { slug: 'predictive_maintenance', name: 'Predictive Maintenance', category: 'future', icon: '🔮', sortOrder: 43, isCore: false, defaultStatus: 'coming_soon' },
];

// ═══════════════════════════════════════════════════════════════════════════════
// Service
// ═══════════════════════════════════════════════════════════════════════════════

export class ModuleService {

  /**
   * Seed the module catalog into the database.
   * Idempotent — skips existing slugs.
   */
  async seedModules() {
    let created = 0;
    for (const mod of MODULE_CATALOG) {
      const existing = await prisma.platform_modules.findUnique({ where: { slug: mod.slug } });
      if (!existing) {
        await prisma.platform_modules.create({
          data: {
            slug: mod.slug,
            name: mod.name,
            description: mod.description,
            category: mod.category,
            icon: mod.icon,
            sort_order: mod.sortOrder,
            is_core: mod.isCore,
            default_status: mod.defaultStatus,
          },
        });
        created++;
      }
    }
    if (created > 0) {
      logger.info('ModuleService', `Seeded ${created} module definitions`);
    }
    return created;
  }

  /**
   * Get all modules with their status for an organization.
   */
  async getModules(organizationId: string) {
    const modules = await prisma.platform_modules.findMany({
      orderBy: { sort_order: 'asc' },
      include: {
        organization_modules: {
          where: { organization_id: organizationId },
        },
      },
    });

    return modules.map((mod) => {
      const override = mod.organization_modules[0];
      return {
        id: mod.id,
        slug: mod.slug,
        name: mod.name,
        description: mod.description,
        category: mod.category,
        icon: mod.icon,
        isCore: mod.is_core,
        status: override?.status ?? mod.default_status,
        hasOverride: !!override,
      };
    });
  }

  /**
   * Check if a module is enabled for an organization.
   */
  async isModuleEnabled(organizationId: string, moduleSlug: string): Promise<boolean> {
    const mod = await prisma.platform_modules.findUnique({
      where: { slug: moduleSlug },
      include: {
        organization_modules: {
          where: { organization_id: organizationId },
        },
      },
    });

    if (!mod) return false;

    const override = mod.organization_modules[0];
    const status = override?.status ?? mod.default_status;
    return status === 'enabled' || status === 'beta';
  }

  /**
   * Set module status for an organization.
   * Core modules cannot be disabled.
   */
  async setModuleStatus(organizationId: string, moduleId: string, status: ModuleStatus, enabledBy?: string) {
    const mod = await prisma.platform_modules.findUnique({ where: { id: moduleId } });
    if (!mod) throw new Error(`Module ${moduleId} not found`);

    if (mod.is_core && (status === 'disabled' || status === 'hidden')) {
      throw new Error(`Cannot disable core module: ${mod.name}`);
    }

    const result = await prisma.organization_modules.upsert({
      where: {
        organization_id_module_id: {
          organization_id: organizationId,
          module_id: moduleId,
        },
      },
      create: {
        organization_id: organizationId,
        module_id: moduleId,
        status,
        enabled_by: enabledBy,
      },
      update: {
        status,
        enabled_by: enabledBy,
      },
    });

    logger.audit('ModuleService', 'Module status changed', {
      organizationId, moduleSlug: mod.slug, status,
    });

    return result;
  }

  /**
   * Get enabled module slugs for an organization.
   */
  async getEnabledModules(organizationId: string): Promise<string[]> {
    const modules = await this.getModules(organizationId);
    return modules
      .filter((m) => m.status === 'enabled' || m.status === 'beta')
      .map((m) => m.slug);
  }

  /**
   * Initialize modules for a new organization.
   * Sets all modules to their default status.
   */
  async initializeForOrganization(organizationId: string) {
    const modules = await prisma.platform_modules.findMany();
    let initialized = 0;

    for (const mod of modules) {
      const existing = await prisma.organization_modules.findUnique({
        where: {
          organization_id_module_id: {
            organization_id: organizationId,
            module_id: mod.id,
          },
        },
      });

      if (!existing) {
        await prisma.organization_modules.create({
          data: {
            organization_id: organizationId,
            module_id: mod.id,
            status: mod.default_status,
          },
        });
        initialized++;
      }
    }

    logger.info('ModuleService', `Initialized ${initialized} modules for org`, { organizationId });
    return initialized;
  }

  /**
   * Get module catalog (admin view).
   */
  async getModuleCatalog() {
    return prisma.platform_modules.findMany({
      orderBy: { sort_order: 'asc' },
      include: {
        _count: { select: { organization_modules: true } },
      },
    });
  }
}

// ─── Singleton ──────────────────────────────────────────────────────────────

export const moduleService = new ModuleService();
