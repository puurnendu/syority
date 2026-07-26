/**
 * API guards with explicit scope.
 */
import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { hasPermission, type Permission } from '@/lib/permissions';
import { applyProxyOverride } from '@/lib/apiGuard';
import { Scope, isPlatformRole, normalizeRole } from './scopes';
import { AuditService } from '@/lib/audit';

export type GuardResult = {
    session: { user: any } | null;
    error: NextResponse | null;
};

function rolesOf(user: any): string[] {
    const primary = normalizeRole(user?.role);
    const extras = (user?.roles || []).map(normalizeRole);
    return [...new Set([...(primary ? [primary] : []), ...extras])];
}

/** Platform-only API. Tenant super_admin / is_super_admin CANNOT pass. */
export async function guardPlatformApi(permission?: Permission): Promise<GuardResult> {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return {
            session: null,
            error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
        };
    }

    const user = session.user as any;
    const roles = rolesOf(user);
    const isPlatform = roles.some(isPlatformRole);

    if (!isPlatform) {
        return {
            session,
            error: NextResponse.json(
                {
                    error: 'Forbidden',
                    message: 'Platform scope required',
                    requiredScope: Scope.PLATFORM,
                },
                { status: 403 }
            ),
        };
    }

    if (permission) {
        const ok = roles.some((r) => hasPermission(r, permission));
        // platform_super_admin always allowed for platform console ops
        if (!ok && !roles.includes('platform_super_admin')) {
            return {
                session,
                error: NextResponse.json(
                    {
                        error: 'Forbidden',
                        message: `Missing permission ${permission}`,
                        requiredScope: Scope.PLATFORM,
                        required_permission: permission,
                    },
                    { status: 403 }
                ),
            };
        }
    }

    return { session, error: null };
}

/** Tenant-scoped API. Platform admins must be in proxy mode. */
export async function guardTenantApi(permission: Permission): Promise<GuardResult> {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return {
            session: null,
            error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
        };
    }

    const user = session.user as any;
    await applyProxyOverride(user);
    const roles = rolesOf(user);
    const isPlatform = roles.some(isPlatformRole);

    if (isPlatform && !user.is_proxy) {
        return {
            session,
            error: NextResponse.json(
                {
                    error: 'Forbidden',
                    message: 'Enter Proxy mode to access tenant APIs',
                    requiredScope: Scope.PROXY,
                },
                { status: 403 }
            ),
        };
    }

    // No blanket is_super_admin bypass for all permissions — check role map
    const hasPerm = roles.some((r) => hasPermission(r, permission));
    if (!hasPerm) {
        return {
            session,
            error: NextResponse.json(
                {
                    error: 'Forbidden',
                    message: `Missing permission ${permission}`,
                    requiredScope: Scope.TENANT,
                    required_permission: permission,
                },
                { status: 403 }
            ),
        };
    }

    return { session, error: null };
}

/** Record proxy actions for audit trail */
export async function auditProxyAction(opts: {
    actorUserId: string;
    tenantId: string;
    action: string;
    detail?: Record<string, unknown>;
}) {
    try {
        await AuditService.log({
            organization_id: opts.tenantId,
            user_id: opts.actorUserId,
            action: 'UPDATE',
            model_name: 'ProxySession',
            model_id: opts.tenantId,
            new_values: {
                proxy_action: opts.action,
                ...opts.detail,
            },
        });
    } catch (e) {
        console.error('[auditProxyAction]', e);
    }
}
