/**
 * M5.3 Role Catalog — frozen authorization model before M6.
 *
 * Runtime permission checks still use ROLE_PERMISSIONS in permissions.ts.
 * This catalog is the product SoT for: scope, modules, default/system/customizable.
 *
 * Rules:
 *   - Platform roles exist ONLY on the platform organization.
 *   - Tenant roles exist ONLY on tenant organizations.
 *   - Platform roles never appear in tenant role pickers.
 *   - Tenant roles never grant /platform/* access (enforced via isPlatformRole + middleware).
 */

export type RoleScope = 'PLATFORM' | 'TENANT';

export type RoleCatalogEntry = {
  slug: string;
  name: string;
  scope: RoleScope;
  /** Product modules this role is expected to use */
  modules: string[];
  isDefault: boolean;
  isSystem: boolean;
  /** Tenant admins may clone/customize non-system tenant roles only */
  customizable: boolean;
  description: string;
  /** Legacy / kept for backward compatibility — not seeded as default test users */
  legacy?: boolean;
};

/** Canonical Platform roles (seeded on syority-platform only). */
export const PLATFORM_ROLE_CATALOG: RoleCatalogEntry[] = [
  {
    slug: 'platform_super_admin',
    name: 'Platform Super Admin',
    scope: 'PLATFORM',
    modules: [
      'platform.dashboard',
      'platform.tenants',
      'platform.billing',
      'platform.users',
      'platform.features',
      'platform.ai',
      'platform.system',
      'platform.knowledge',
      'platform.master_data',
      'platform.monitoring',
    ],
    isDefault: true,
    isSystem: true,
    customizable: false,
    description: 'Full platform control. Soft-bypasses missing permission checks.',
  },
  {
    slug: 'platform_product_manager',
    name: 'Platform Product Manager',
    scope: 'PLATFORM',
    modules: [
      'platform.dashboard',
      'platform.tenants',
      'platform.features',
      'platform.knowledge',
      'platform.master_data',
      'platform.ai',
      'platform.onboarding',
    ],
    isDefault: true,
    isSystem: true,
    customizable: false,
    description: 'Product, features, master data, Knowledge Engine review. No billing or infra admin.',
  },
  {
    slug: 'platform_master_scheduler',
    name: 'Platform Master Scheduler',
    scope: 'PLATFORM',
    modules: [
      'platform.dashboard',
      'platform.master_data',
      'platform.knowledge',
      'nav.schedule',
      'platform.templates',
    ],
    isDefault: true,
    isSystem: true,
    customizable: false,
    description: 'Global scheduling standards, templates, and schedule-related master data.',
  },
  {
    slug: 'platform_support',
    name: 'Platform Support',
    scope: 'PLATFORM',
    modules: [
      'platform.dashboard',
      'platform.tenants',
      'platform.users',
      'platform.logs',
      'platform.monitoring',
      'platform.knowledge',
    ],
    isDefault: true,
    isSystem: true,
    customizable: false,
    description: 'Tenant support, diagnostics, Knowledge view. No billing, features, or promote.',
  },
  {
    slug: 'platform_finance',
    name: 'Platform Finance',
    scope: 'PLATFORM',
    modules: ['platform.dashboard', 'platform.tenants', 'platform.billing'],
    isDefault: true,
    isSystem: true,
    customizable: false,
    description: 'Licensing & billing only. No Knowledge Engine review, no master data edit.',
  },
];

/** Canonical Tenant roles (seeded on each tenant / demo tenant). */
export const TENANT_ROLE_CATALOG: RoleCatalogEntry[] = [
  {
    slug: 'tenant_administrator',
    name: 'Tenant Administrator',
    scope: 'TENANT',
    modules: [
      'settings',
      'users',
      'roles',
      'masterdata',
      'workpacks',
      'schedule',
      'events',
      'safety',
      'documents',
      'reporting',
      'hierarchy',
    ],
    isDefault: true,
    isSystem: true,
    customizable: false,
    description: 'Full tenant administration. Cannot access Platform modules.',
  },
  {
    slug: 'lead_planner',
    name: 'Lead Planner',
    scope: 'TENANT',
    modules: ['workpacks', 'schedule', 'masterdata', 'events', 'templates', 'hierarchy', 'reporting'],
    isDefault: true,
    isSystem: true,
    customizable: false,
    description: 'Senior planning: create/edit/approve workpacks, templates, schedule.',
  },
  {
    slug: 'planner',
    name: 'Planner',
    scope: 'TENANT',
    modules: ['workpacks', 'schedule', 'masterdata', 'events', 'templates', 'hierarchy'],
    isDefault: true,
    isSystem: true,
    customizable: false,
    description: 'Day-to-day workpack planning and master data.',
  },
  {
    slug: 'scheduler',
    name: 'Scheduler',
    scope: 'TENANT',
    modules: ['schedule', 'workpacks', 'events', 'reporting'],
    isDefault: true,
    isSystem: true,
    customizable: false,
    description: 'Schedule ownership; limited workpack edit.',
  },
  {
    slug: 'project_manager',
    name: 'Project Manager',
    scope: 'TENANT',
    modules: ['projects', 'events', 'workpacks', 'schedule', 'reporting', 'portfolio'],
    isDefault: true,
    isSystem: true,
    customizable: false,
    description: 'Event/project oversight, approve workpacks, reporting.',
  },
  {
    slug: 'safety_officer',
    name: 'Safety Officer',
    scope: 'TENANT',
    modules: ['safety', 'workpacks', 'documents', 'events'],
    isDefault: true,
    isSystem: true,
    customizable: false,
    description: 'Safety logs, permits view, limited workpack view.',
  },
  {
    slug: 'qa_qc_inspector',
    name: 'QA/QC Inspector',
    scope: 'TENANT',
    modules: ['workpacks', 'documents', 'qaqc'],
    isDefault: true,
    isSystem: true,
    customizable: false,
    description: 'Inspection / hold / witness; approve quality gates.',
  },
  {
    slug: 'material_coordinator',
    name: 'Material Coordinator',
    scope: 'TENANT',
    modules: ['masterdata', 'workpacks', 'materials'],
    isDefault: true,
    isSystem: true,
    customizable: false,
    description: 'Consumables, gaskets, bolts, blinds, workpack materials.',
  },
  {
    slug: 'mechanical_engineer',
    name: 'Mechanical Engineer',
    scope: 'TENANT',
    modules: ['workpacks', 'masterdata', 'hierarchy'],
    isDefault: true,
    isSystem: true,
    customizable: false,
    description: 'Mechanical discipline engineering on workpacks and assets.',
  },
  {
    slug: 'electrical_engineer',
    name: 'Electrical Engineer',
    scope: 'TENANT',
    modules: ['workpacks', 'masterdata', 'hierarchy'],
    isDefault: true,
    isSystem: true,
    customizable: false,
    description: 'Electrical discipline engineering.',
  },
  {
    slug: 'instrumentation_engineer',
    name: 'Instrumentation Engineer',
    scope: 'TENANT',
    modules: ['workpacks', 'masterdata', 'hierarchy'],
    isDefault: true,
    isSystem: true,
    customizable: false,
    description: 'Instrumentation & control engineering.',
  },
  {
    slug: 'civil_engineer',
    name: 'Civil Engineer',
    scope: 'TENANT',
    modules: ['workpacks', 'hierarchy'],
    isDefault: true,
    isSystem: true,
    customizable: false,
    description: 'Civil / structural engineering support.',
  },
  {
    slug: 'execution_engineer',
    name: 'Execution Engineer',
    scope: 'TENANT',
    modules: ['workpacks', 'schedule', 'safety'],
    isDefault: true,
    isSystem: true,
    customizable: false,
    description: 'Field execution and progress updates.',
  },
  {
    slug: 'warehouse',
    name: 'Warehouse',
    scope: 'TENANT',
    modules: ['materials', 'masterdata', 'documents'],
    isDefault: true,
    isSystem: true,
    customizable: false,
    description: 'Stores / warehouse issue and receipt.',
  },
  {
    slug: 'document_controller',
    name: 'Document Controller',
    scope: 'TENANT',
    modules: ['documents', 'workpacks'],
    isDefault: true,
    isSystem: true,
    customizable: false,
    description: 'Document control and controlled copies.',
  },
  {
    slug: 'viewer',
    name: 'Viewer',
    scope: 'TENANT',
    modules: ['workpacks', 'events', 'documents', 'safety'],
    isDefault: true,
    isSystem: true,
    customizable: false,
    description: 'Read-only access across operational modules.',
  },
];

/** Legacy tenant roles — still recognized, not default-seeded as test personas. */
export const LEGACY_TENANT_ROLES: RoleCatalogEntry[] = [
  {
    slug: 'platform_admin',
    name: 'Platform Admin (legacy)',
    scope: 'PLATFORM',
    modules: ['platform'],
    isDefault: false,
    isSystem: true,
    customizable: false,
    description: 'Legacy alias — prefer platform_product_manager.',
    legacy: true,
  },
  {
    slug: 'org_admin',
    name: 'Organization Administrator',
    scope: 'TENANT',
    modules: ['settings', 'workpacks'],
    isDefault: false,
    isSystem: false,
    customizable: true,
    description: 'Legacy elevated tenant admin without AI settings.',
    legacy: true,
  },
  {
    slug: 'tenant_admin',
    name: 'Tenant Admin (ops)',
    scope: 'TENANT',
    modules: ['workpacks', 'events'],
    isDefault: false,
    isSystem: false,
    customizable: true,
    description: 'Legacy ops-limited admin.',
    legacy: true,
  },
  {
    slug: 'workpack_manager',
    name: 'Execution Manager',
    scope: 'TENANT',
    modules: ['workpacks'],
    isDefault: false,
    isSystem: false,
    customizable: true,
    legacy: true,
    description: 'Legacy execution manager.',
  },
  {
    slug: 'engineer',
    name: 'Engineer',
    scope: 'TENANT',
    modules: ['workpacks'],
    isDefault: false,
    isSystem: false,
    customizable: true,
    legacy: true,
    description: 'Legacy engineer.',
  },
  {
    slug: 'reviewer',
    name: 'Reviewer',
    scope: 'TENANT',
    modules: ['workpacks'],
    isDefault: false,
    isSystem: false,
    customizable: true,
    legacy: true,
    description: 'Legacy reviewer.',
  },
  {
    slug: 'contractor',
    name: 'Contractor Coordinator',
    scope: 'TENANT',
    modules: ['workpacks', 'safety'],
    isDefault: false,
    isSystem: false,
    customizable: true,
    legacy: true,
    description: 'Legacy contractor coordinator.',
  },
];

export const ROLE_CATALOG: RoleCatalogEntry[] = [
  ...PLATFORM_ROLE_CATALOG,
  ...TENANT_ROLE_CATALOG,
  ...LEGACY_TENANT_ROLES,
];

export const PLATFORM_ROLE_SLUGS = PLATFORM_ROLE_CATALOG.map((r) => r.slug);

/** All platform slugs including legacy platform_admin */
export const ALL_PLATFORM_ROLE_SLUGS = [
  ...PLATFORM_ROLE_SLUGS,
  'platform_admin',
] as const;

export function getRoleCatalogEntry(slug: string): RoleCatalogEntry | undefined {
  const n = String(slug || '')
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, '_');
  return ROLE_CATALOG.find((r) => r.slug === n);
}

export function isCatalogPlatformRole(slug: string): boolean {
  const n = String(slug || '')
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, '_');
  return (ALL_PLATFORM_ROLE_SLUGS as readonly string[]).includes(n) || n.startsWith('platform_');
}

export function assertRoleAllowedForOrgScope(
  roleSlug: string,
  orgTenantType: string | null | undefined
): void {
  const platformOrg = (orgTenantType || '').toLowerCase() === 'platform';
  const roleIsPlatform = isCatalogPlatformRole(roleSlug);

  if (roleIsPlatform && !platformOrg) {
    throw new Error(
      `Platform role "${roleSlug}" cannot be assigned inside a tenant organization`
    );
  }
  if (!roleIsPlatform && platformOrg) {
    throw new Error(
      `Tenant role "${roleSlug}" cannot be assigned to the platform organization`
    );
  }
}
