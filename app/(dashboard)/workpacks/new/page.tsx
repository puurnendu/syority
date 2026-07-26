import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { ensureDefaultDisciplinesForOrg } from '@/lib/disciplines';
import { WorkpackCreateForm } from '@/components/Workpack/WorkpackCreateForm';

export default async function NewWorkpackPage({
    searchParams,
}: {
    searchParams: Promise<{ project_id?: string }>;
}) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) redirect('/login');

    const { project_id: projectId } = await searchParams;

    let orgId = (session.user as { organization_id?: string })?.organization_id;
    if (!orgId) {
        const user = await prisma.user.findUnique({
            where: { id: session.user.id, is_active: true, deleted_at: null },
            select: { organization_id: true },
        });
        orgId = user?.organization_id ?? undefined;
    }
    if (!orgId) redirect('/login');

    // Ensure default disciplines exist for this org so the dropdown is always populated
    await ensureDefaultDisciplinesForOrg(orgId);

    // Fetch master data scoped to current organization.
    // If we have a project ID, let's also fetch the project to see if it has a site associated.
    const [sites, disciplines, project] = await Promise.all([
        prisma.site.findMany({
            where: { organization_id: orgId, is_active: true, deleted_at: null },
            select: { id: true, name: true, code: true },
            orderBy: { name: 'asc' },
        }),
        prisma.discipline.findMany({
            where: { organization_id: orgId, is_active: true },
            select: { id: true, name: true, code: true },
            orderBy: { name: 'asc' },
        }),
        projectId ? prisma.project.findUnique({
            where: { id: projectId, orgId: orgId },
            select: { id: true, name: true }
        }) : Promise.resolve(null)
    ]);

    return (
        <div className="py-6">
            <WorkpackDashboardHeader title={project ? `New Workpack for ${project.name}` : "New Workpack"} />
            <WorkpackCreateForm
                sites={JSON.parse(JSON.stringify(sites))}
                disciplines={JSON.parse(JSON.stringify(disciplines))}
                initialProjectId={projectId}
            />
        </div>
    );
}

function WorkpackDashboardHeader({ title }: { title: string }) {
    return (
        <div className="max-w-5xl mx-auto px-4 mb-6">
            {/* Simple breadcrumb or back link could go here */}
        </div>
    );
}

