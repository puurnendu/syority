import { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

/**
 * Get the authenticated user's organization ID from the request (JWT token).
 * Honors Platform Admin proxy cookie (`syority_proxy`) so proxied sessions
 * scope to the target tenant — same rules as guardApi.applyProxyOverride.
 */
export async function getOrgIdFromRequest(req: NextRequest): Promise<string | null> {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    const role = (token?.role as string) || '';
    const isPlatformAdmin = role === 'platform_super_admin' || role === 'platform_admin';

    if (isPlatformAdmin) {
        try {
            const raw = req.cookies.get('syority_proxy')?.value;
            if (raw) {
                const proxyData = JSON.parse(raw) as { tenant_id?: string };
                if (proxyData?.tenant_id && typeof proxyData.tenant_id === 'string') {
                    return proxyData.tenant_id;
                }
            }
        } catch {
            // fall through to JWT org
        }
    }

    const orgId = token?.organization_id;
    return typeof orgId === 'string' ? orgId : null;
}

/**
 * Get user ID from request for audit/deletedBy. Falls back to 'system' if not present.
 */
export async function getUserIdFromRequest(req: NextRequest): Promise<string> {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    const id = token?.sub ?? token?.id;
    return typeof id === 'string' ? id : 'system';
}
