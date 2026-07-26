import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { cookies } from 'next/headers';
import { isPlatformRole } from '@/security/scopes';
import { auditProxyAction } from '@/security/apiGuards';

export async function POST() {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!isPlatformRole((session.user as any).role)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    try {
        const cookieStore = await cookies();
        const raw = cookieStore.get('syority_proxy')?.value;
        if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed?.tenant_id) {
                await auditProxyAction({
                    actorUserId: (session.user as any).id,
                    tenantId: parsed.tenant_id,
                    action: 'EXIT_PROXY',
                    detail: { tenant_name: parsed.tenant_name },
                });
            }
        }
    } catch {
        /* ignore audit failures on exit */
    }

    const response = NextResponse.json({ success: true, message: 'Exited Proxy Mode successfully.' });
    response.cookies.set('syority_proxy', '', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 0,
    });
    return response;
}
