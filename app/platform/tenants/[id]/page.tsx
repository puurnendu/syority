import { requirePlatformContext } from '@/lib/server-context';

import { prisma } from '@/lib/prisma';
import { notFound, redirect } from 'next/navigation';
import { hasPermission } from '@/lib/permissions';
import { TenantDetailClient } from './TenantDetailClient';

export default async function TenantDetailPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const session = await requirePlatformContext();
    const role = session.role ?? '';

    if (!hasPermission(role, 'nav.admin')) {
        redirect('/platform/tenants');
    }

    const { id } = await params;

    if (!id || typeof id !== 'string') {
        notFound();
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
        notFound();
    }

    let org: any = null;

    try {
        org = await prisma.organization.findUnique({
            where: { id },
        });
    } catch (e: any) {
        console.error('[TenantDetail] org fetch error:', { message: e.message, code: e.code, meta: e.meta });
        throw e;
    }

    if (!org) {
        notFound();
    }

    let sites: any[] = [];
    try {
        sites = await prisma.site.findMany({
            where: { organization_id: id, deleted_at: null },
            orderBy: { name: 'asc' },
        });
    } catch (e: any) {
        console.warn('[TenantDetail] sites fetch failed:', e?.message);
    }

    let usersRaw: any[] = [];
    try {
        usersRaw = await prisma.user.findMany({
            where: { organization_id: id, deleted_at: null },
            orderBy: { name: 'asc' },
            select: {
                id: true,
                name: true,
                email: true,
                is_active: true,
                last_login_at: true,
                created_at: true,
                user_roles: {
                    include: { role: { select: { slug: true, name: true } } },
                },
            },
        });
    } catch (e: any) {
        console.warn('[TenantDetail] users fetch failed:', e?.message);
    }

    const users = usersRaw.map((u) => ({
        ...u,
        role: (u as any).user_roles?.[0]?.role?.slug ?? (u as any).user_roles?.[0]?.role?.name ?? '—',
    }));

    let billingLogs: any[] = [];
    try {
        billingLogs = await prisma.billingLog.findMany({
            where: { organization_id: id },
            orderBy: { payment_date: 'desc' },
            take: 20,
        });
    } catch (e: any) {
        console.warn('[TenantDetail] billing fetch failed:', e?.message);
    }

    let workpackCount = 0;
    try {
        workpackCount = await prisma.workpack.count({
            where: { organization_id: id, deleted_at: null },
        });
    } catch (e: any) {
        console.warn('[TenantDetail] workpack count failed:', e?.message);
    }

    let activityCount = 0;
    try {
        activityCount = await prisma.activity.count({
            where: {
                workpack: { organization_id: id },
                deleted_at: null,
            },
        });
    } catch (e: any) {
        console.warn('[TenantDetail] activity count failed:', e?.message);
    }

    const orgWithData = {
        ...org,
        sites,
        users,
        billing_logs: billingLogs,
        _count: {
            workpacks: workpackCount,
            activities: activityCount,
            users: users.length,
            sites: sites.length,
        },
    };

    return <TenantDetailClient org={orgWithData} />;
}
