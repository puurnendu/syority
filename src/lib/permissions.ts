/**
 * RBAC — single source of truth for role → permissions.
 *
 * Roles are scoped:
 *   PLATFORM: platform_super_admin, platform_admin, …
 *   TENANT:   tenant_administrator (canonical), plus operational roles
 *
 * Legacy aliases (resolved by resolveRoleSlug):
 *   super_admin / super-admin  → tenant_administrator
 *   org_admin / org-admin      → org_admin (kept as elevated tenant admin)
 *
 * Do NOT use User.is_super_admin / is_tenant_admin as SoT — derive via identity.ts
 */
export type AppRole =
    | 'platform_super_admin'
    | 'platform_admin'
    | 'tenant_administrator'
    | 'super_admin' // deprecated alias → tenant_administrator
    | 'org_admin'
    | 'tenant_admin'
    | 'planner'
    | 'engineer'
    | 'reviewer'
    | 'contractor'
    | 'viewer'
    | 'workpack_manager';

export type Permission =
    | 'settings.view' | 'settings.org.view' | 'settings.org.edit'
    | 'settings.users.view' | 'settings.users.edit'
    | 'settings.roles.view' | 'settings.roles.edit'
    | 'settings.udf.view' | 'settings.udf.edit'
    | 'settings.templates.view' | 'settings.templates.edit'
    | 'settings.clearance.view' | 'settings.clearance.edit'
    | 'settings.print.view' | 'settings.print.edit'
    | 'settings.ai.view' | 'settings.ai.edit'
    | 'masterdata.view' | 'masterdata.edit'
    | 'masterdata.activity_codes.edit'
    | 'masterdata.disciplines.edit' | 'masterdata.resources.edit'
    | 'masterdata.consumables.edit' | 'masterdata.gaskets.edit'
    | 'masterdata.bolts.edit' | 'masterdata.blinds.edit'
    | 'workpacks.view' | 'workpacks.create' | 'workpacks.edit'
    | 'workpacks.delete' | 'workpacks.approve'
    | 'workpacks.export.pdf' | 'workpacks.export.xml' | 'workpacks.export.excel'
    | 'nav.schedule' | 'nav.portfolio' | 'nav.billing'
    | 'nav.operations' | 'nav.admin'
    | 'events.view' | 'events.create' | 'events.edit' | 'events.delete'
    | 'system:view' | 'system:create' | 'system:edit' | 'system:delete'
    | 'system:blind:update' | 'system:wbs:manage' | 'system:wbs:generate'
    | 'unit:view' | 'unit:edit' | 'unit:manage'
    /** Enterprise hierarchy (Site → Plant → Area → Unit → System → Asset) */
    | 'site.view' | 'site.manage'
    | 'plant.view' | 'plant.manage'
    | 'area.view' | 'area.manage'
    | 'unit.view' | 'unit.manage'
    | 'system.view' | 'system.manage'
    | 'asset.view' | 'asset.manage'
    | 'admin.view' | 'admin.edit'
    | 'projects.view' | 'reports.generate'
    | 'safety.view' | 'safety.log'
    | 'documents.view' | 'documents.upload'
    | 'masterdata.units.view' | 'masterdata.units.edit'
    | 'reporting:view' | 'reporting:build' | 'reporting:admin';

/** Canonical slug after alias resolution */
export function resolveRoleSlug(slug: string): string {
    const n = String(slug || '')
        .toLowerCase()
        .trim()
        .replace(/[\s-]+/g, '_');

    const aliases: Record<string, string> = {
        super_admin: 'tenant_administrator',
        superadmin: 'tenant_administrator',
        'tenant_admin_full': 'tenant_administrator',
        platform_superadmin: 'platform_super_admin',
        'platform_super-admin': 'platform_super_admin',
    };
    return aliases[n] || n;
}

const TENANT_ADMIN_PERMS: Permission[] = [
    'settings.view', 'settings.org.view', 'settings.org.edit',
    'settings.users.view', 'settings.users.edit',
    'settings.roles.view', 'settings.roles.edit',
    'settings.udf.view', 'settings.udf.edit',
    'settings.templates.view', 'settings.templates.edit',
    'settings.clearance.view', 'settings.clearance.edit',
    'settings.print.view', 'settings.print.edit',
    'settings.ai.view', 'settings.ai.edit',
    'masterdata.view', 'masterdata.edit',
    'masterdata.activity_codes.edit', 'masterdata.disciplines.edit', 'masterdata.resources.edit',
    'masterdata.consumables.edit', 'masterdata.gaskets.edit', 'masterdata.bolts.edit', 'masterdata.blinds.edit',
    'workpacks.view', 'workpacks.create', 'workpacks.edit', 'workpacks.delete', 'workpacks.approve',
    'workpacks.export.pdf', 'workpacks.export.xml', 'workpacks.export.excel',
    'nav.schedule', 'nav.portfolio', 'nav.operations',
    'system:view', 'system:create', 'system:edit', 'system:delete',
    'system:blind:update', 'system:wbs:manage', 'system:wbs:generate',
    'unit:view', 'unit:edit', 'unit:manage',
    'site.view', 'site.manage',
    'plant.view', 'plant.manage',
    'area.view', 'area.manage',
    'unit.view', 'unit.manage',
    'system.view', 'system.manage',
    'asset.view', 'asset.manage',
    'admin.view', 'admin.edit',
    'projects.view', 'reports.generate',
    'safety.view', 'safety.log',
    'documents.view', 'documents.upload',
    'reporting:view', 'reporting:build', 'reporting:admin',
    'events.view', 'events.create', 'events.edit', 'events.delete',
];

const PLATFORM_PERMS: Permission[] = [
    ...TENANT_ADMIN_PERMS,
    'nav.billing',
    'nav.admin',
    'masterdata.units.view',
    'masterdata.units.edit',
];

const ROLE_PERMISSIONS: Record<string, Permission[]> = {
    platform_super_admin: PLATFORM_PERMS,
    platform_admin: PLATFORM_PERMS,
    tenant_administrator: TENANT_ADMIN_PERMS,
    // Deprecated alias — same as tenant_administrator (kept so old JWT/DB slugs work)
    super_admin: TENANT_ADMIN_PERMS,
    org_admin: TENANT_ADMIN_PERMS.filter((p) => p !== 'settings.ai.view' && p !== 'settings.ai.edit'),
    tenant_admin: [
        'workpacks.view', 'workpacks.create', 'workpacks.edit', 'workpacks.delete', 'workpacks.approve',
        'workpacks.export.pdf', 'workpacks.export.xml', 'workpacks.export.excel',
        'nav.schedule', 'nav.portfolio', 'nav.operations',
        'system:view', 'unit:view', 'unit:edit', 'unit:manage',
        'site.view', 'plant.view', 'area.view', 'unit.view', 'system.view', 'asset.view',
        'projects.view', 'reports.generate', 'safety.view', 'safety.log',
        'reporting:view', 'reporting:build',
        'events.view', 'events.create', 'events.edit',
    ],
    planner: [
        'settings.view', 'settings.udf.view', 'settings.udf.edit',
        'settings.templates.view', 'settings.templates.edit',
        'settings.print.view', 'settings.print.edit',
        'masterdata.view', 'masterdata.edit',
        'workpacks.view', 'workpacks.create', 'workpacks.edit', 'workpacks.delete', 'workpacks.approve',
        'workpacks.export.pdf', 'workpacks.export.xml', 'workpacks.export.excel',
        'nav.schedule',
        'system:view', 'system:edit', 'system:blind:update', 'system:wbs:manage', 'system:wbs:generate',
        'unit:view', 'unit:edit', 'projects.view', 'reports.generate',
        'site.view', 'site.manage', 'plant.view', 'plant.manage', 'area.view', 'area.manage',
        'unit.view', 'unit.manage', 'system.view', 'system.manage', 'asset.view', 'asset.manage',
        'safety.view', 'safety.log', 'documents.view', 'documents.upload',
        'masterdata.units.view', 'masterdata.units.edit',
        'reporting:view', 'reporting:build',
        'events.view', 'events.create', 'events.edit',
    ],
    workpack_manager: [
        'masterdata.view',
        'workpacks.view', 'workpacks.create', 'workpacks.edit', 'workpacks.delete', 'workpacks.approve',
        'workpacks.export.pdf', 'workpacks.export.xml', 'workpacks.export.excel',
        'nav.schedule',
        'system:view', 'system:edit', 'system:blind:update', 'system:wbs:manage', 'system:wbs:generate',
        'unit:view', 'unit:edit', 'projects.view', 'reports.generate',
        'site.view', 'plant.view', 'area.view', 'unit.view', 'system.view', 'asset.view',
        'safety.view', 'safety.log', 'reporting:view',
        'events.view', 'events.create', 'events.edit',
    ],
    engineer: [
        'masterdata.view', 'workpacks.view', 'workpacks.edit',
        'workpacks.export.pdf', 'workpacks.export.xml', 'workpacks.export.excel',
        'nav.schedule', 'system:view', 'system:edit', 'system:blind:update',
        'unit:view', 'unit:edit', 'projects.view', 'reports.generate',
        'site.view', 'plant.view', 'area.view', 'unit.view', 'system.view', 'asset.view',
        'safety.view', 'safety.log', 'reporting:view',
        'events.view', 'events.create', 'events.edit',
    ],
    reviewer: [
        'workpacks.view', 'workpacks.approve', 'workpacks.export.pdf',
        'system:view', 'unit:view', 'projects.view', 'safety.view', 'events.view',
        'site.view', 'plant.view', 'area.view', 'unit.view', 'system.view', 'asset.view',
    ],
    contractor: [
        'workpacks.view', 'workpacks.export.pdf',
        'system:view', 'unit:view', 'projects.view', 'safety.view', 'safety.log', 'events.view',
        'site.view', 'plant.view', 'unit.view', 'system.view', 'asset.view',
    ],
    viewer: [
        'workpacks.view', 'workpacks.export.pdf',
        'system:view', 'unit:view', 'projects.view', 'safety.view', 'documents.view', 'events.view',
        'site.view', 'plant.view', 'area.view', 'unit.view', 'system.view', 'asset.view',
    ],
};

export function hasPermission(role: AppRole | string | undefined | null, permission: Permission): boolean {
    if (!role) return false;
    const n = resolveRoleSlug(String(role));
    const perms = ROLE_PERMISSIONS[n];
    return perms ? perms.includes(permission) : false;
}

export function hasAnyPermission(role: AppRole | string | undefined | null, permissions: Permission[]): boolean {
    return permissions.some((p) => hasPermission(role, p));
}

export function hasAllPermissions(role: AppRole | string | undefined | null, permissions: Permission[]): boolean {
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
