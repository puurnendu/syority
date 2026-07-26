import { WorkpackTabs } from '@/components/Workpack/WorkpackTabs';
import { WorkpackService } from '@/modules/Workpack/Services/WorkpackService';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { isUuid, normalizeUuidFromSegment } from '@/lib/uuid';
import { notFound, redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';

export default async function WorkpackDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const session = await getServerSession(authOptions);
    if (!session?.user) redirect('/login');

    const orgId = session.user.organization_id;
    if (!orgId || !isUuid(orgId)) redirect('/login');

    const { id } = await params;
    if (!id?.trim()) return notFound();

    const normalizedId = normalizeUuidFromSegment(id);
    if (!isUuid(normalizedId)) return notFound();

    const [workpackData, udfDefinitions] = await Promise.all([
        WorkpackService.getWorkpack(normalizedId, orgId),
        prisma.activityUdfDefinition.findMany({
            where: { organization_id: orgId, is_active: true, deleted_at: null },
            include: {
                options: {
                    where: { deleted_at: null, is_active: true },
                    orderBy: [{ sort_order: 'asc' }, { value: 'asc' }],
                },
            },
            orderBy: [{ sort_order: 'asc' }, { code: 'asc' }],
        }),
    ]);

    if (!workpackData) return notFound();

    const workpack = JSON.parse(JSON.stringify(workpackData, (_, v) =>
        typeof v === 'bigint' ? Number(v) : v?.constructor?.name === 'Decimal' ? Number(v) : v
    ));
    const udfDefs = JSON.parse(JSON.stringify(udfDefinitions));
    const user = session.user as { role?: string };
    const role = String(user?.role ?? '').toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_');
    const isSuperAdmin = role === 'super_admin' || (session.user as any).is_super_admin === true;
    const isAdmin = isSuperAdmin || role === 'org_admin';
    const canDelete = ['super_admin', 'org_admin', 'tenant_admin'].includes(role);

    return (
        <div className="flex flex-col flex-1 min-h-0">
            <WorkpackTabs workpack={workpack as any} udfDefinitions={udfDefs} isAdmin={isAdmin} canDelete={canDelete} />
        </div>
    );
}
