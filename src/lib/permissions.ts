/**
 * RBAC — single source of truth for role → permissions.
 * Role catalog metadata: src/security/roleCatalog.ts (M5.3 freeze).
 *
 * Platform roles NEVER grant tenant shell by themselves without Proxy.
 * Tenant roles NEVER include nav.admin / knowledge.* / nav.billing.
 */
export type AppRole =
  | 'platform_super_admin'
  | 'platform_product_manager'
  | 'platform_master_scheduler'
  | 'platform_support'
  | 'platform_finance'
  | 'platform_admin' // legacy → treated like product manager for perms
  | 'tenant_administrator'
  | 'lead_planner'
  | 'planner'
  | 'scheduler'
  | 'project_manager'
  | 'safety_officer'
  | 'qa_qc_inspector'
  | 'material_coordinator'
  | 'mechanical_engineer'
  | 'electrical_engineer'
  | 'instrumentation_engineer'
  | 'civil_engineer'
  | 'execution_engineer'
  | 'warehouse'
  | 'document_controller'
  | 'viewer'
  // legacy aliases / roles
  | 'super_admin'
  | 'org_admin'
  | 'tenant_admin'
  | 'engineer'
  | 'reviewer'
  | 'contractor'
  | 'workpack_manager';

export type Permission =
  | 'settings.view'
  | 'settings.org.view'
  | 'settings.org.edit'
  | 'settings.users.view'
  | 'settings.users.edit'
  | 'settings.roles.view'
  | 'settings.roles.edit'
  | 'settings.udf.view'
  | 'settings.udf.edit'
  | 'settings.templates.view'
  | 'settings.templates.edit'
  | 'settings.clearance.view'
  | 'settings.clearance.edit'
  | 'settings.print.view'
  | 'settings.print.edit'
  | 'settings.ai.view'
  | 'settings.ai.edit'
  | 'masterdata.view'
  | 'masterdata.edit'
  | 'masterdata.activity_codes.edit'
  | 'masterdata.disciplines.edit'
  | 'masterdata.resources.edit'
  | 'masterdata.consumables.edit'
  | 'masterdata.gaskets.edit'
  | 'masterdata.bolts.edit'
  | 'masterdata.blinds.edit'
  | 'workpacks.view'
  | 'workpacks.create'
  | 'workpacks.edit'
  | 'workpacks.delete'
  | 'workpacks.approve'
  | 'workpacks.export.pdf'
  | 'workpacks.export.xml'
  | 'workpacks.export.excel'
  // M12-R0.1: Execution permissions
  | 'execution.view'
  | 'execution.release'
  | 'execution.start'
  | 'execution.update'
  | 'execution.hold'
  | 'execution.complete'
  | 'execution.verify'
  | 'execution.close'
  | 'execution.delay'
  | 'execution.bulk'
  | 'nav.schedule'
  | 'nav.portfolio'
  | 'nav.billing'
  | 'nav.operations'
  | 'nav.admin'
  | 'events.view'
  | 'events.create'
  | 'events.edit'
  | 'events.delete'
  | 'system:view'
  | 'system:create'
  | 'system:edit'
  | 'system:delete'
  | 'system:blind:update'
  | 'system:wbs:manage'
  | 'system:wbs:generate'
  | 'unit:view'
  | 'unit:edit'
  | 'unit:manage'
  | 'site.view'
  | 'site.manage'
  | 'plant.view'
  | 'plant.manage'
  | 'area.view'
  | 'area.manage'
  | 'unit.view'
  | 'unit.manage'
  | 'system.view'
  | 'system.manage'
  | 'asset.view'
  | 'asset.manage'
  | 'admin.view'
  | 'admin.edit'
  | 'projects.view'
  | 'reports.generate'
  | 'safety.view'
  | 'safety.log'
  | 'safety.edit'
  | 'documents.view'
  | 'documents.upload'
  | 'masterdata.units.view'
  | 'masterdata.units.edit'
  | 'reporting:view'
  | 'reporting:build'
  | 'reporting:admin'
  /** Knowledge Engine (Platform only) */
  | 'knowledge.view'
  | 'knowledge.review'
  | 'knowledge.admin'
  /** OIS — Operational Intelligence Studio */
  | 'ois:dashboard.view'
  | 'ois:dashboard.build'
  | 'ois:dashboard.admin'
  | 'ois:cockpit.view'
  | 'ois:cockpit.build'
  | 'ois:widget.view'
  | 'ois:widget.build'
  | 'ois:export.pdf'
  | 'ois:export.excel'
  | 'ois:tv_mode'
  | 'ois:meeting_mode'
  /** BRE — Business Rules Engine */
  | 'bre:rules.view'
  | 'bre:rules.edit'
  | 'bre:rules.admin'
  | 'bre:formulas.view'
  | 'bre:formulas.edit'
  | 'bre:alerts.view'
  | 'bre:alerts.manage'
  | 'bre:kpis.view'
  | 'bre:kpis.edit'
  | 'bre:escalations.view'
  | 'bre:escalations.edit'
  | 'bre:recommendations.view'
  | 'bre:recommendations.manage'
  /** M7.6G — Platform Beta & Licensing */
  | 'platform:licenses.view'
  | 'platform:licenses.edit'
  | 'platform:modules.view'
  | 'platform:modules.edit'
  | 'platform:diagnostics.view'
  | 'platform:feedback.view'
  | 'platform:feedback.manage'
  | 'platform:analytics.view'
  | 'platform:release.view'
  | 'platform:beta.manage';

/** Canonical slug after alias resolution */
export function resolveRoleSlug(slug: string): string {
  const n = String(slug || '')
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, '_');

  const aliases: Record<string, string> = {
    super_admin: 'tenant_administrator',
    superadmin: 'tenant_administrator',
    tenant_admin_full: 'tenant_administrator',
    platform_superadmin: 'platform_super_admin',
    'platform_super-admin': 'platform_super_admin',
    qa_qc: 'qa_qc_inspector',
    qaqc_inspector: 'qa_qc_inspector',
    materials_coordinator: 'material_coordinator',
  };
  return aliases[n] || n;
}

const HIERARCHY_VIEW: Permission[] = [
  'site.view',
  'plant.view',
  'area.view',
  'unit.view',
  'system.view',
  'asset.view',
];

const HIERARCHY_MANAGE: Permission[] = [
  ...HIERARCHY_VIEW,
  'site.manage',
  'plant.manage',
  'area.manage',
  'unit.manage',
  'system.manage',
  'asset.manage',
];

const WORKPACK_CRUD: Permission[] = [
  'workpacks.view',
  'workpacks.create',
  'workpacks.edit',
  'workpacks.delete',
  'workpacks.export.pdf',
  'workpacks.export.xml',
  'workpacks.export.excel',
];

const WORKPACK_FULL: Permission[] = [...WORKPACK_CRUD, 'workpacks.approve'];

const EXECUTION_VIEW: Permission[] = ['execution.view'];
const EXECUTION_FIELD: Permission[] = [
  'execution.view',
  'execution.start',
  'execution.update',
  'execution.hold',
  'execution.complete',
  'execution.delay',
];
const EXECUTION_QA: Permission[] = ['execution.view', 'execution.verify'];
const EXECUTION_MGMT: Permission[] = [
  'execution.view',
  'execution.release',
  'execution.close',
  'execution.bulk',
];
const EXECUTION_FULL: Permission[] = [
  ...EXECUTION_FIELD,
  ...EXECUTION_QA,
  ...EXECUTION_MGMT,
];

const TENANT_ADMIN_PERMS: Permission[] = [
  'settings.view',
  'settings.org.view',
  'settings.org.edit',
  'settings.users.view',
  'settings.users.edit',
  'settings.roles.view',
  'settings.roles.edit',
  'settings.udf.view',
  'settings.udf.edit',
  'settings.templates.view',
  'settings.templates.edit',
  'settings.clearance.view',
  'settings.clearance.edit',
  'settings.print.view',
  'settings.print.edit',
  'settings.ai.view',
  'settings.ai.edit',
  'masterdata.view',
  'masterdata.edit',
  'masterdata.activity_codes.edit',
  'masterdata.disciplines.edit',
  'masterdata.resources.edit',
  'masterdata.consumables.edit',
  'masterdata.gaskets.edit',
  'masterdata.bolts.edit',
  'masterdata.blinds.edit',
  ...WORKPACK_FULL,
  ...EXECUTION_FULL,
  'nav.schedule',
  'nav.portfolio',
  'nav.operations',
  'system:view',
  'system:create',
  'system:edit',
  'system:delete',
  'system:blind:update',
  'system:wbs:manage',
  'system:wbs:generate',
  'unit:view',
  'unit:edit',
  'unit:manage',
  ...HIERARCHY_MANAGE,
  'admin.view',
  'admin.edit',
  'projects.view',
  'reports.generate',
  'safety.view',
  'safety.log',
  'documents.view',
  'documents.upload',
  'reporting:view',
  'reporting:build',
  'reporting:admin',
  'ois:dashboard.view',
  'ois:dashboard.build',
  'ois:dashboard.admin',
  'ois:cockpit.view',
  'ois:cockpit.build',
  'ois:widget.view',
  'ois:widget.build',
  'ois:export.pdf',
  'ois:export.excel',
  'ois:tv_mode',
  'ois:meeting_mode',
  'safety.edit',
  'events.view',
  'events.create',
  'events.edit',
  'events.delete',
  // BRE — Business Rules Engine
  'bre:rules.view',
  'bre:rules.edit',
  'bre:rules.admin',
  'bre:formulas.view',
  'bre:formulas.edit',
  'bre:alerts.view',
  'bre:alerts.manage',
  'bre:kpis.view',
  'bre:kpis.edit',
  'bre:escalations.view',
  'bre:escalations.edit',
  'bre:recommendations.view',
  'bre:recommendations.manage',
];

/** Platform-only permissions — never attach to tenant roles */
const PLATFORM_ONLY: Permission[] = [
  'nav.billing',
  'nav.admin',
  'masterdata.units.view',
  'masterdata.units.edit',
  'knowledge.view',
  'knowledge.review',
  'knowledge.admin',
  // M7.6G — Platform Beta & Licensing
  'platform:licenses.view',
  'platform:licenses.edit',
  'platform:modules.view',
  'platform:modules.edit',
  'platform:diagnostics.view',
  'platform:feedback.view',
  'platform:feedback.manage',
  'platform:analytics.view',
  'platform:release.view',
  'platform:beta.manage',
];

const PLATFORM_SUPER: Permission[] = [...TENANT_ADMIN_PERMS, ...PLATFORM_ONLY];

const PLATFORM_PRODUCT_MANAGER: Permission[] = [
  ...TENANT_ADMIN_PERMS.filter((p) => !p.startsWith('settings.ai')),
  'nav.admin',
  'masterdata.units.view',
  'masterdata.units.edit',
  'knowledge.view',
  'knowledge.review',
  'knowledge.admin',
  'settings.ai.view',
  // M7.6G — Platform Beta & Licensing
  'platform:licenses.view',
  'platform:licenses.edit',
  'platform:modules.view',
  'platform:modules.edit',
  'platform:diagnostics.view',
  'platform:feedback.view',
  'platform:feedback.manage',
  'platform:analytics.view',
  'platform:release.view',
  'platform:beta.manage',
];

const PLATFORM_MASTER_SCHEDULER: Permission[] = [
  'nav.admin',
  'nav.schedule',
  'masterdata.view',
  'masterdata.edit',
  'masterdata.activity_codes.edit',
  'masterdata.units.view',
  'masterdata.units.edit',
  'settings.templates.view',
  'settings.templates.edit',
  'knowledge.view',
  'knowledge.review',
  'workpacks.view',
  'events.view',
  'reporting:view',
];

const PLATFORM_SUPPORT: Permission[] = [
  'nav.admin',
  'settings.users.view',
  'knowledge.view',
  'workpacks.view',
  'events.view',
  'admin.view',
  'reporting:view',
  ...HIERARCHY_VIEW,
];

const PLATFORM_FINANCE: Permission[] = [
  'nav.admin',
  'nav.billing',
  'settings.org.view',
  'reporting:view',
  'reports.generate',
];

export const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  platform_super_admin: PLATFORM_SUPER,
  platform_product_manager: PLATFORM_PRODUCT_MANAGER,
  platform_master_scheduler: PLATFORM_MASTER_SCHEDULER,
  platform_support: PLATFORM_SUPPORT,
  platform_finance: PLATFORM_FINANCE,
  // legacy
  platform_admin: PLATFORM_PRODUCT_MANAGER,

  tenant_administrator: TENANT_ADMIN_PERMS,
  super_admin: TENANT_ADMIN_PERMS,

  lead_planner: [
    ...WORKPACK_FULL,
    'settings.view',
    'settings.udf.view',
    'settings.udf.edit',
    'settings.templates.view',
    'settings.templates.edit',
    'settings.print.view',
    'settings.print.edit',
    'masterdata.view',
    'masterdata.edit',
    'masterdata.activity_codes.edit',
    'nav.schedule',
    'nav.portfolio',
    'system:view',
    'system:edit',
    'system:blind:update',
    'system:wbs:manage',
    'system:wbs:generate',
    'unit:view',
    'unit:edit',
    ...HIERARCHY_MANAGE,
    'projects.view',
    'reports.generate',
    'safety.view',
    'documents.view',
    'documents.upload',
    'reporting:view',
    'reporting:build',
    'events.view',
    'events.create',
    'events.edit',
  ],

  planner: [
    'settings.view',
    'settings.udf.view',
    'settings.udf.edit',
    'settings.templates.view',
    'settings.templates.edit',
    'settings.print.view',
    'settings.print.edit',
    'masterdata.view',
    'masterdata.edit',
    ...WORKPACK_FULL,
    'nav.schedule',
    'system:view',
    'system:edit',
    'system:blind:update',
    'system:wbs:manage',
    'system:wbs:generate',
    'unit:view',
    'unit:edit',
    'projects.view',
    'reports.generate',
    ...HIERARCHY_MANAGE,
    'safety.view',
    'safety.log',
    'documents.view',
    'documents.upload',
    'reporting:view',
    'reporting:build',
    'events.view',
    'events.create',
    'events.edit',
  ],

  scheduler: [
    'workpacks.view',
    'workpacks.edit',
    'workpacks.export.pdf',
    'nav.schedule',
    'nav.portfolio',
    'events.view',
    'events.edit',
    'projects.view',
    'reports.generate',
    'reporting:view',
    'reporting:build',
    ...HIERARCHY_VIEW,
    'system:view',
    'unit:view',
  ],

  project_manager: [
    ...WORKPACK_FULL,
    ...EXECUTION_FULL,
    'nav.schedule',
    'nav.portfolio',
    'nav.operations',
    'events.view',
    'events.create',
    'events.edit',
    'events.delete',
    'projects.view',
    'reports.generate',
    'reporting:view',
    'reporting:build',
    'reporting:admin',
    'safety.view',
    'documents.view',
    ...HIERARCHY_VIEW,
    'system:view',
    'unit:view',
  ],

  safety_officer: [
    'workpacks.view',
    'workpacks.export.pdf',
    'safety.view',
    'safety.log',
    'documents.view',
    'documents.upload',
    'events.view',
    ...HIERARCHY_VIEW,
    'system:view',
    'unit:view',
  ],

  qa_qc_inspector: [
    ...EXECUTION_QA,
    'workpacks.view',
    'workpacks.edit',
    'workpacks.approve',
    'workpacks.export.pdf',
    'documents.view',
    'documents.upload',
    'events.view',
    ...HIERARCHY_VIEW,
    'system:view',
    'unit:view',
    'safety.view',
  ],

  material_coordinator: [
    'workpacks.view',
    'workpacks.edit',
    'masterdata.view',
    'masterdata.edit',
    'masterdata.consumables.edit',
    'masterdata.gaskets.edit',
    'masterdata.bolts.edit',
    'masterdata.blinds.edit',
    'masterdata.resources.edit',
    'documents.view',
    ...HIERARCHY_VIEW,
    'system:view',
    'unit:view',
  ],

  mechanical_engineer: [
    'masterdata.view',
    'workpacks.view',
    'workpacks.edit',
    'workpacks.export.pdf',
    'workpacks.export.xml',
    'workpacks.export.excel',
    'nav.schedule',
    'system:view',
    'system:edit',
    'system:blind:update',
    'unit:view',
    'unit:edit',
    'projects.view',
    ...HIERARCHY_VIEW,
    'safety.view',
    'documents.view',
    'reporting:view',
    'events.view',
    'events.edit',
  ],
  electrical_engineer: [
    'masterdata.view',
    'workpacks.view',
    'workpacks.edit',
    'workpacks.export.pdf',
    'nav.schedule',
    'system:view',
    'system:edit',
    'unit:view',
    'unit:edit',
    'projects.view',
    ...HIERARCHY_VIEW,
    'safety.view',
    'documents.view',
    'reporting:view',
    'events.view',
  ],
  instrumentation_engineer: [
    'masterdata.view',
    'workpacks.view',
    'workpacks.edit',
    'workpacks.export.pdf',
    'nav.schedule',
    'system:view',
    'system:edit',
    'unit:view',
    'unit:edit',
    'projects.view',
    ...HIERARCHY_VIEW,
    'safety.view',
    'documents.view',
    'reporting:view',
    'events.view',
  ],
  civil_engineer: [
    'workpacks.view',
    'workpacks.edit',
    'workpacks.export.pdf',
    'system:view',
    'unit:view',
    ...HIERARCHY_VIEW,
    'safety.view',
    'documents.view',
    'events.view',
  ],
  execution_engineer: [
    ...EXECUTION_FULL,
    'workpacks.view',
    'workpacks.edit',
    'workpacks.export.pdf',
    'nav.schedule',
    'system:view',
    'system:edit',
    'system:blind:update',
    'unit:view',
    'unit:edit',
    ...HIERARCHY_VIEW,
    'safety.view',
    'safety.log',
    'documents.view',
    'documents.upload',
    'events.view',
    'reporting:view',
  ],
  warehouse: [
    'workpacks.view',
    'masterdata.view',
    'masterdata.edit',
    'masterdata.consumables.edit',
    'masterdata.gaskets.edit',
    'masterdata.bolts.edit',
    'masterdata.blinds.edit',
    'documents.view',
    ...HIERARCHY_VIEW,
    'system:view',
    'unit:view',
  ],
  document_controller: [
    'workpacks.view',
    'workpacks.export.pdf',
    'documents.view',
    'documents.upload',
    'events.view',
    ...HIERARCHY_VIEW,
    'system:view',
    'unit:view',
  ],

  viewer: [
    'workpacks.view',
    'workpacks.export.pdf',
    'system:view',
    'unit:view',
    'projects.view',
    'safety.view',
    'documents.view',
    'events.view',
    ...HIERARCHY_VIEW,
  ],

  // legacy
  org_admin: TENANT_ADMIN_PERMS.filter((p) => p !== 'settings.ai.view' && p !== 'settings.ai.edit'),
  tenant_admin: [
    ...WORKPACK_FULL,
    'nav.schedule',
    'nav.portfolio',
    'nav.operations',
    'system:view',
    'unit:view',
    'unit:edit',
    'unit:manage',
    ...HIERARCHY_VIEW,
    'projects.view',
    'reports.generate',
    'safety.view',
    'safety.log',
    'reporting:view',
    'reporting:build',
    'events.view',
    'events.create',
    'events.edit',
  ],
  workpack_manager: [
    'masterdata.view',
    ...WORKPACK_FULL,
    'nav.schedule',
    'system:view',
    'system:edit',
    'system:blind:update',
    'system:wbs:manage',
    'system:wbs:generate',
    'unit:view',
    'unit:edit',
    'projects.view',
    'reports.generate',
    ...HIERARCHY_VIEW,
    'safety.view',
    'safety.log',
    'reporting:view',
    'events.view',
    'events.create',
    'events.edit',
  ],
  engineer: [
    'masterdata.view',
    'workpacks.view',
    'workpacks.edit',
    'workpacks.export.pdf',
    'workpacks.export.xml',
    'workpacks.export.excel',
    'nav.schedule',
    'system:view',
    'system:edit',
    'system:blind:update',
    'unit:view',
    'unit:edit',
    'projects.view',
    'reports.generate',
    ...HIERARCHY_VIEW,
    'safety.view',
    'safety.log',
    'reporting:view',
    'events.view',
    'events.create',
    'events.edit',
  ],
  reviewer: [
    'workpacks.view',
    'workpacks.approve',
    'workpacks.export.pdf',
    'system:view',
    'unit:view',
    'projects.view',
    'safety.view',
    'events.view',
    ...HIERARCHY_VIEW,
  ],
  contractor: [
    ...EXECUTION_FIELD,
    'workpacks.view',
    'workpacks.export.pdf',
    'system:view',
    'unit:view',
    'projects.view',
    'safety.view',
    'safety.log',
    'events.view',
    'site.view',
    'plant.view',
    'unit.view',
    'system.view',
    'asset.view',
  ],
};

export function hasPermission(role: AppRole | string | undefined | null, permission: Permission): boolean {
  if (!role) return false;
  const n = resolveRoleSlug(String(role));
  const perms = ROLE_PERMISSIONS[n];
  return perms ? perms.includes(permission) : false;
}

export function hasAnyPermission(
  role: AppRole | string | undefined | null,
  permissions: Permission[]
): boolean {
  return permissions.some((p) => hasPermission(role, p));
}

export function hasAllPermissions(
  role: AppRole | string | undefined | null,
  permissions: Permission[]
): boolean {
  return permissions.every((p) => hasPermission(role, p));
}

/** Permissions for a set of roles (union). */
export function permissionsForRoles(roles: string[]): Permission[] {
  const set = new Set<Permission>();
  for (const r of roles) {
    const perms = ROLE_PERMISSIONS[resolveRoleSlug(r)] || [];
    perms.forEach((p) => set.add(p));
  }
  return [...set];
}

/** Assert no tenant role accidentally carries platform-only perms (catalog freeze check). */
export function assertTenantIsolation(roleSlug: string): boolean {
  const n = resolveRoleSlug(roleSlug);
  if (n.startsWith('platform_')) return true;
  const perms = ROLE_PERMISSIONS[n] || [];
  return !perms.some((p) => PLATFORM_ONLY.includes(p));
}
