'use client';

import { useSession } from 'next-auth/react';
import { hasPermission, type Permission } from '@/lib/permissions';
import { isPlatformRole, normalizeRole, Scope } from '@/security';

type CanProps = {
    /** Required permission (any of user's roles) */
    permission?: Permission;
    /** Required scope */
    scope?: typeof Scope.PLATFORM | typeof Scope.TENANT;
    children: React.ReactNode;
    fallback?: React.ReactNode;
};

/**
 * Component-level authorization. Hide buttons/widgets that the user cannot use.
 * Never rely on menu hiding alone.
 */
export function Can({ permission, scope, children, fallback = null }: CanProps) {
    const { data: session, status } = useSession();
    if (status === 'loading') return null;

    const user = session?.user as any;
    if (!user) return <>{fallback}</>;

    const roles: string[] = [
        ...new Set([
            normalizeRole(user.role),
            ...((user.roles || []) as string[]).map(normalizeRole),
        ].filter(Boolean)),
    ];

    if (scope === Scope.PLATFORM && !roles.some(isPlatformRole)) {
        return <>{fallback}</>;
    }
    if (scope === Scope.TENANT && roles.some(isPlatformRole) && !user.is_proxy) {
        // Platform admin outside proxy should not see tenant action buttons
        // (layout already restricts pages; this is belt-and-suspenders for widgets)
    }

    if (permission && !roles.some((r) => hasPermission(r, permission))) {
        return <>{fallback}</>;
    }

    return <>{children}</>;
}
