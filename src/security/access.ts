/**
 * Access evaluation helpers used by middleware, layouts, and APIs.
 */
import { Scope, isPlatformRole, normalizeRole } from './scopes';
import { hasPermission, type Permission } from '@/lib/permissions';
import { matchRoute, type RouteMeta } from './routeRegistry';

export type AccessPrincipal = {
    role?: string | null;
    roles?: string[];
    is_proxy?: boolean;
    is_super_admin?: boolean;
};

export function principalRoles(p: AccessPrincipal): string[] {
    const primary = normalizeRole(p.role);
    const extras = (p.roles || []).map(normalizeRole).filter(Boolean);
    const set = new Set<string>([...(primary ? [primary] : []), ...extras]);
    return [...set];
}

export function principalIsPlatform(p: AccessPrincipal): boolean {
    return principalRoles(p).some(isPlatformRole);
}

export function principalHasPermission(p: AccessPrincipal, permission: Permission): boolean {
    return principalRoles(p).some((r) => hasPermission(r, permission));
}

/**
 * Evaluate whether a principal may access a route meta given proxy state.
 * - PLATFORM: platform roles only (proxy cookie does not grant platform pages)
 * - TENANT: tenant users always; platform roles only when is_proxy
 * - PROXY: platform roles with active proxy
 */
export function canAccessRouteMeta(
    meta: RouteMeta,
    p: AccessPrincipal,
    opts: { isProxy: boolean }
): { ok: boolean; reason?: string } {
    const platform = principalIsPlatform(p);

    if (meta.scope === Scope.PLATFORM) {
        if (!platform) return { ok: false, reason: 'PLATFORM_ONLY' };
        return { ok: true };
    }

    if (meta.scope === Scope.PROXY) {
        if (!platform || !opts.isProxy) return { ok: false, reason: 'PROXY_REQUIRED' };
        return { ok: true };
    }

    // TENANT
    if (platform && !opts.isProxy) {
        return { ok: false, reason: 'PROXY_REQUIRED_FOR_PLATFORM_ADMIN' };
    }

    if (meta.permission && !principalHasPermission(p, meta.permission) && !platform) {
        return { ok: false, reason: 'MISSING_PERMISSION' };
    }

    return { ok: true };
}

export function evaluatePathAccess(
    pathname: string,
    p: AccessPrincipal,
    opts: { isProxy: boolean }
): { meta: RouteMeta | null; ok: boolean; reason?: string } {
    const meta = matchRoute(pathname);
    if (!meta) return { meta: null, ok: true }; // unregistered paths fall through to legacy middleware rules
    const result = canAccessRouteMeta(meta, p, opts);
    return { meta, ...result };
}
