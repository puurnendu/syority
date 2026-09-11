import { WorkpackService } from '@/modules/Workpack/Services/WorkpackService';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect, notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { WorkpackDashboard, WorkpackListItemDTO } from '@/components/Workpack/WorkpackDashboard';
import { isLegacyProjectChainEnabled } from '@/lib/legacyProjectChain';

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

export default async function ProjectWorkpacksPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const session = await getServerSession(authOptions);
    if (!session) redirect('/login');

    const { id: projectId } = await params;
    const orgId = (session.user as SessionUserWithOrg)?.organization_id;
    if (!orgId) redirect('/login');

    // Phase 0 item 5 — legacy Project workpacks view (STO Workpack model filtered
    // by project_id), quarantined behind the LEGACY_PROJECT_CHAIN feature flag
    // (default off). Project work is planned on the Project Schedule/WBS tabs;
    // the STO workpack register is /workpacks.
    if (!(await isLegacyProjectChainEnabled(orgId))) {
        redirect(`/projects/${projectId}`);
    }

    // Verify project exists and belongs to org
    const project = await prisma.project.findFirst({
        where: { id: projectId, org_id: orgId },
        select: { name: true }
    });
    if (!project) notFound();

    const rawWorkpacks = await WorkpackService.getWorkpacks(orgId, { project_id: projectId });
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
            title={`Workpacks - ${project.name}`}
            projectId={projectId}
            userRole={(session.user as { role?: string })?.role}
        />
    );
}

