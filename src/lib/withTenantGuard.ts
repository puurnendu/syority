import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { applyProxyOverride } from '@/lib/apiGuard';

type RouteHandler = (
  req: NextRequest,
  context: { params: any },
  session: any
) => Promise<NextResponse>;

/**
 * Wraps an API route handler with:
 * 1. Authentication check
 * 2. Organization ID extraction
 * 3. Passes session to handler
 *
 * Usage:
 * export const GET = withTenantGuard(async (req, { params }, session) => {
 *   const orgId = session.user.organization_id;
 *   // ... always filter by orgId
 * });
 */
export function withTenantGuard(handler: RouteHandler) {
  return async (req: NextRequest, context: { params: any }) => {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const user = session.user as any;
        // Proxy Mode: platform admins operating on behalf of a tenant get their
        // organization_id overridden to the proxied tenant (cookie-gated by role).
        await applyProxyOverride(user);
        if (!user.organization_id) {
            return NextResponse.json({ error: 'No organization assigned' }, { status: 403 });
        }
        
        // Ensure params structure (Next.js 15+ params are promises sometimes, but here we assume already resolved or handled by wrapper)
        return await handler(req, context, session);
    } catch (err: any) {
        console.error('[withTenantGuard] Error:', err);
        const status = err.statusCode || 500;
        const message = status === 403 ? 'Not found' : 'Internal server error'; // Hide 403 as 404/500 to avoid leaking existence
        return NextResponse.json({ error: message }, { status: status === 403 ? 404 : status });
    }
  };
}
