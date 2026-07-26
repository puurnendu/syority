/**
 * Identity vs Authorization resolver.
 *
 * Single source of truth for runtime auth decisions:
 *   UserRole → Role.slug → normalized roles → Scope + Permissions
 *
 * Boolean flags (is_super_admin / is_tenant_admin) are DERIVED for
 * backward compatibility only — never the primary decision source.
 */
import { Scope, isPlatformRole, normalizeRole } from './scopes';
import { hasPermission, type Permission, resolveRoleSlug } from '@/lib/permissions';

export type AuthIdentity = {
    userId: string;
    email: string;
    name: string;
    organizationId: string | null;
    organizationName?: string;
    siteId?: string | null;
    isActive: boolean;
};

export type AuthAuthorization = {
    /** PLATFORM | TENANT — PROXY is session/cookie state, not stored on user */
    scope: typeof Scope.PLATFORM | typeof Scope.TENANT;
    /** Normalized role slugs (underscore) */
    roles: string[];
    /** Canonical primary role for display / legacy single-role checks */
    primaryRole: string;
    roleIds: string[];
    /** Derived compatibility flags — DO NOT write as SoT */
    derived: {
        is_platform_admin: boolean;
        is_tenant_administrator: boolean;
        /** @deprecated use roles / is_platform_admin */
        is_super_admin: boolean;
        /** @deprecated use roles / is_tenant_administrator */
        is_tenant_admin: boolean;
    };
};

export type ResolvedAuth = {
    identity: AuthIdentity;
    authorization: AuthAuthorization;
};

type RoleRow = { id: string; slug: string; name?: string };

/**
 * Resolve authorization from DB role rows only.
 * Flags on User are ignored as input (may still be returned as derived).
 */
export function resolveAuthorization(input: {
    userId: string;
    email: string;
    name: string;
    organizationId: string | null;
    organizationName?: string;
    siteId?: string | null;
    isActive?: boolean;
    roleRows: RoleRow[];
}): ResolvedAuth {
    const rawSlugs = input.roleRows.map((r) => normalizeRole(r.slug)).filter(Boolean);
    const roles = [...new Set(rawSlugs.map((s) => resolveRoleSlug(s)))];

    const isPlatform = roles.some(isPlatformRole);
    const isTenantAdmin = roles.some((r) =>
        ['tenant_administrator', 'super_admin', 'org_admin'].includes(r)
    );

    let primaryRole = roles[0] || 'viewer';
    if (roles.includes('platform_super_admin')) primaryRole = 'platform_super_admin';
    else if (roles.includes('platform_admin')) primaryRole = 'platform_admin';
    else if (roles.includes('tenant_administrator')) primaryRole = 'tenant_administrator';
    else if (roles.includes('super_admin')) primaryRole = 'tenant_administrator';

    return {
        identity: {
            userId: input.userId,
            email: input.email,
            name: input.name,
            organizationId: input.organizationId,
            organizationName: input.organizationName,
            siteId: input.siteId,
            isActive: input.isActive !== false,
        },
        authorization: {
            scope: isPlatform ? Scope.PLATFORM : Scope.TENANT,
            roles: roles.length ? roles : ['viewer'],
            primaryRole,
            roleIds: input.roleRows.map((r) => r.id),
            derived: {
                is_platform_admin: isPlatform,
                is_tenant_administrator: isTenantAdmin,
                // Legacy JWT fields — derived from roles, not User flags
                is_super_admin: isPlatform || roles.includes('super_admin') || roles.includes('tenant_administrator'),
                is_tenant_admin: isTenantAdmin,
            },
        },
    };
}

export function authHasPermission(auth: AuthAuthorization, permission: Permission): boolean {
    return auth.roles.some((r) => hasPermission(r, permission));
}

export function displayRoleName(slug: string): string {
    const n = resolveRoleSlug(normalizeRole(slug));
    const labels: Record<string, string> = {
        platform_super_admin: 'Platform Administrator',
        platform_admin: 'Platform Operations',
        tenant_administrator: 'Tenant Administrator',
        super_admin: 'Tenant Administrator',
        org_admin: 'Organization Administrator',
        tenant_admin: 'Tenant Admin (ops)',
        planner: 'Planner',
        workpack_manager: 'Execution Manager',
        engineer: 'Engineer',
        reviewer: 'Reviewer',
        contractor: 'Contractor Coordinator',
        viewer: 'Viewer',
    };
    return labels[n] || n.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
