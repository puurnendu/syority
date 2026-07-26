import { requirePlatformContext } from '@/lib/server-context';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import { hasPermission } from '@/lib/permissions';
import { AdminUsersClient } from './_components/AdminUsersClient';

export default async function AdminUsersPage() {
    const session = await requirePlatformContext();
    const role = session.role;
    if (!hasPermission(role, 'nav.admin')) redirect('/platform/tenants');

    const users = await prisma.user.findMany({
        where: { deleted_at: null },
        orderBy: [{ organization: { name: 'asc' } }, { name: 'asc' }],
        select: {
            id: true,
            name: true,
            email: true,
            is_active: true,
            last_login_at: true,
            created_at: true,
            organization_id: true,
            organization: { select: { name: true, slug: true } },
            user_roles: { include: { role: { select: { slug: true, name: true } } } },
        },
    });

    const organizations = await prisma.organization.findMany({
        orderBy: { name: 'asc' },
        select: { id: true, name: true, slug: true },
    });

    const withRole = users.map((u) => ({
        ...u,
        role: (u as any).user_roles?.[0]?.role?.slug ?? (u as any).user_roles?.[0]?.role?.name ?? '—',
    }));

    return <AdminUsersClient users={withRole as any} organizations={organizations as any} />;
}
