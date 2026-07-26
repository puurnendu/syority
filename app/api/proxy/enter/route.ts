import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { isPlatformRole } from '@/security/scopes';
import { auditProxyAction } from '@/security/apiGuards';

export async function POST(request: Request) {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const role = (session.user as any).role;
    if (!isPlatformRole(role)) {
        return NextResponse.json(
            { error: 'Forbidden: Proxy Mode restricted to Platform Admins.' },
            { status: 403 }
        );
    }

    const body = await request.json().catch(() => ({}));
    const { tenant_id } = body;

    if (!tenant_id || typeof tenant_id !== 'string') {
        return NextResponse.json({ error: 'Tenant ID required to enter Proxy Mode.' }, { status: 400 });
    }

    const tenant = await prisma.organization.findFirst({
        where: { id: tenant_id, deleted_at: null },
        select: { id: true, name: true, is_active: true },
    });
    if (!tenant) {
        return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    await auditProxyAction({
        actorUserId: (session.user as any).id,
        tenantId: tenant.id,
        action: 'ENTER_PROXY',
        detail: { tenant_name: tenant.name },
    });

    const response = NextResponse.json({
        success: true,
        tenant: { id: tenant.id, name: tenant.name },
    });

    response.cookies.set('syority_proxy', JSON.stringify({ tenant_id: tenant.id, tenant_name: tenant.name }), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
    });

    return response;
}
