import { WorkpackService } from '@/modules/Workpack/Services/WorkpackService';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { WorkpackDashboard, WorkpackListItemDTO } from '@/components/Workpack/WorkpackDashboard';

/** Session user shape with organization_id (set by auth callbacks) */
interface SessionUserWithOrg {
    organization_id?: string;
}

function serializeWorkpacks(
    raw: Awaited<ReturnType<typeof WorkpackService.getWorkpacks>>,
    constraintCountMap: Map<string, number>
): WorkpackListItemDTO[] {
    const arr = JSON.parse(JSON.stringify(raw)) as any[];
    return arr.map((w) => ({
        ...w,
        open_constraints: constraintCountMap.get(w.id) ?? 0,
    })) as WorkpackListItemDTO[];
}

export default async function WorkpacksPage() {
    const session = await getServerSession(authOptions);
    if (!session) redirect('/login');

    const orgId = (session.user as SessionUserWithOrg)?.organization_id;
    if (!orgId) redirect('/login');

    const rawWorkpacks = await WorkpackService.getWorkpacks(orgId);
    const workpackIds = rawWorkpacks.map((w) => w.id);
    const constraintCounts =
        workpackIds.length > 0
            ? await prisma.constraintLog
                  .groupBy({
                      by: ['workpack_id'],
                      where: {
                          workpack_id: { in: workpackIds },
                          status: { in: ['open', 'in_progress'] },
                          deleted_at: null,
                      },
                      _count: { _all: true },
                   })
                  .catch(() => [] as { workpack_id: string; _count: { _all: number } }[])
            : [];
    const constraintCountMap = new Map(
        constraintCounts.map((c) => [c.workpack_id, c._count._all])
    );
    const workpacks = serializeWorkpacks(rawWorkpacks, constraintCountMap);

    return (
        <WorkpackDashboard 
            workpacks={workpacks} 
            userRole={(session.user as { role?: string })?.role}
        />
    );
}

