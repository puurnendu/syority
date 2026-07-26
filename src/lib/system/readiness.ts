import { prisma } from '@/lib/prisma';

export interface SystemReadinessResult {
    isReady: boolean;
    checks: {
        hasOrganization: boolean;
        hasRole: boolean;
        hasUser: boolean;
        hasAiProvider: boolean;
    };
}

/**
 * Check if the system is ready for use.
 * System is ready when:
 * - At least 1 organization exists
 * - At least 1 role exists
 * - At least 1 user exists
 * AI is available to all organisations by default (no per-tenant gate).
 */
export async function getSystemReadiness(): Promise<SystemReadinessResult> {
    try {
        // Check for at least 1 organization
        const organizationCount = await prisma.organization.count({
            where: {
                deleted_at: null,
            },
        });
        const hasOrganization = organizationCount > 0;

        // Check for at least 1 role (Role model has no deleted_at)
        const roleCount = await prisma.role.count();
        const hasRole = roleCount > 0;

        // Check for at least 1 active user
        const userCount = await prisma.user.count({
            where: {
                deleted_at: null,
                is_active: true,
            },
        });
        const hasUser = userCount > 0;

        // AI is always available (env default or per-org config); show as configured
        const hasAiProvider = true;

        const isReady = hasOrganization && hasRole && hasUser;

        return {
            isReady,
            checks: {
                hasOrganization,
                hasRole,
                hasUser,
                hasAiProvider,
            },
        };
    } catch (error) {
        // If database query fails, system is not ready
        console.error('[SystemReadiness] Error checking system readiness:', error);
        return {
            isReady: false,
            checks: {
                hasOrganization: false,
                hasRole: false,
                hasUser: false,
                hasAiProvider: true,
            },
        };
    }
}
