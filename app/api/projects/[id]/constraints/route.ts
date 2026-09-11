import { NextRequest, NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { withTenantGuard } from '@/lib/withTenantGuard';
import { prisma } from '@/lib/prisma';

export const GET = withTenantGuard(async (req: NextRequest, { params }, session) => {
  const { error } = await guardApi('projects.view');
  if (error) return error;
  const { orgId } = orgScope(session!);
  const { id: projectId } = await params;

  const project = await prisma.project.findFirst({
    where: { id: projectId, org_id: orgId },
    select: { id: true },
  });
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const list = await prisma.project_constraints.findMany({
    where: { project_id: projectId },
    orderBy: { created_at: 'desc' },
  });
  return NextResponse.json({ data: list });
});
