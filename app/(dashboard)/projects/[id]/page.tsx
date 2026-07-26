import { ProjectDetailClient } from './ProjectDetailClient';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: projectId } = await params;
  const session = await getServerSession(authOptions);
  
  if (!session) redirect('/login');

  const user = session.user as { organization_id: string };
  const org = await prisma.organization.findUnique({
    where: { id: user.organization_id },
    select: { tenant_type: true }
  });

  // Redirect contractors to project intelligence dashboard by default
  if (org?.tenant_type === 'contractor') {
    redirect(`/projects/${projectId}/reports`);
  }

  return <ProjectDetailClient projectId={projectId} />;
}
