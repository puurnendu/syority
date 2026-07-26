import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getSystemReadiness } from '@/lib/system/readiness';
import { isPlatformRole, normalizeRole } from '@/security/scopes';
import { LoginClient } from './LoginClient';

export default async function LoginPage() {
    const session = await getServerSession(authOptions);
    if (session?.user) {
        const mustChange =
            (session.user as { must_change_password?: boolean }).must_change_password === true;
        if (mustChange) {
            redirect('/auth/change-password');
        }

        const roles = [
            normalizeRole((session.user as { role?: string }).role || ''),
            ...(((session.user as { roles?: string[] }).roles || []).map(normalizeRole)),
        ].filter(Boolean);
        const isPlatform = roles.some(isPlatformRole);

        const readiness = await getSystemReadiness();
        if (!readiness.isReady) {
            redirect('/admin/setup');
        }
        if (isPlatform) {
            redirect('/platform/tenants');
        }
        redirect('/dashboard');
    }

    let organizations: Array<{ id: string; name: string; slug: string | null }> = [];
    try {
        organizations = await prisma.organization.findMany({
            where: {
                deleted_at: null,
                OR: [{ is_active: true }, { is_active: null }],
            },
            select: { id: true, name: true, slug: true },
            orderBy: { name: 'asc' },
        });
    } catch (e) {
        console.error('[LoginPage] Database error:', e);
    }

    return <LoginClient organizations={organizations} />;
}
