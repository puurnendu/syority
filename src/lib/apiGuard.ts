import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { hasPermission, Permission } from '@/lib/permissions';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { isPlatformRole, normalizeRole } from '@/security/scopes';

/**
 * Proxy Mode support: when a Platform Admin has entered Proxy Mode
 * (httpOnly cookie `syority_proxy` set by /api/proxy/enter), API queries must
 * scope to the proxied tenant, not the admin's own organization.
 * Only honored for platform admin roles — the cookie is ignored for everyone
 * else so regular users cannot forge cross-tenant access.
 */
export async function applyProxyOverride(user: any): Promise<void> {
    const role = user?.role;
    const isPlatformAdmin = isPlatformRole(role);
    if (!isPlatformAdmin) return;
    try {
        const cookieStore = await cookies();
        const proxyCookie = cookieStore.get('syority_proxy')?.value;
        if (!proxyCookie) return;
        const proxyData = JSON.parse(proxyCookie);
        if (proxyData?.tenant_id && typeof proxyData.tenant_id === 'string') {
            user.organization_id = proxyData.tenant_id;
            user.is_proxy = true;
        }
    } catch {
        // Invalid/unreadable cookie — fall through to the admin's own org
    }
}

/**
 * Tenant API guard.
 *
 * IMPORTANT: Tenant `super_admin` / `is_super_admin` do NOT bypass.
 * Platform roles only bypass when they are true platform_* roles
 * (and typically should use guardPlatformApi for platform endpoints).
 *
 * Prefer `@/security/apiGuards` `guardTenantApi` / `guardPlatformApi` for new code.
 */
export async function guardApi(permission: Permission): Promise<{
    session: { user: any } | null;
    error: NextResponse | null;
}> {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
        return {
            session: null,
            error: NextResponse.json(
                { error: 'Unauthorized — please log in' },
                { status: 401 }
            ),
        };
    }

    const user = session.user as any;
    await applyProxyOverride(user);

    const primaryRole = normalizeRole(user.role);
    const allRoles: string[] = [
        ...new Set([
            ...(primaryRole ? [primaryRole] : []),
            ...((user.roles || []) as string[]).map(normalizeRole),
        ]),
    ];

    // Only true platform_super_admin gets a soft bypass for tenant ops.
    // Tenant super_admin / is_super_admin must go through the permission map.
    const isPlatformSuper = allRoles.includes('platform_super_admin');
    if (isPlatformSuper) {
        return { session, error: null };
    }

    const hasPerm = allRoles.some((r: string) => hasPermission(r, permission));

    // No boolean-flag bypass. Tenant administrators get access via role permissions
    // (tenant_administrator / super_admin alias / org_admin) in ROLE_PERMISSIONS.

    if (!hasPerm) {
        return {
            session,
            error: NextResponse.json(
                {
                    error: 'Forbidden',
                    message: `Role(s) [${allRoles.join(', ')}] do not have permission to perform this action.`,
                    required_permission: permission,
                },
                { status: 403 }
            ),
        };
    }

    return { session, error: null };
}

/** Org scope helper for API routes — throws if no org in session. */
export function orgScope(session: { user?: any } | null): {
    orgId: string;
    userId: string;
    role: string;
    isSuperAdmin: boolean;
    isPlatformAdmin: boolean;
} {
    const orgId = session?.user?.organization_id as string;
    const userId = session?.user?.id as string;
    const role = (session?.user?.role as string) ?? '';
    if (!orgId) throw new Error('No organization in session');
    const isPlatformAdmin = isPlatformRole(role);
    // Tenant-level elevated = role map only (not User.is_super_admin flag)
    const isSuperAdmin =
        normalizeRole(role) === 'super_admin' ||
        normalizeRole(role) === 'tenant_administrator' ||
        normalizeRole(role) === 'org_admin';
    return { orgId, userId, role, isSuperAdmin, isPlatformAdmin };
}
