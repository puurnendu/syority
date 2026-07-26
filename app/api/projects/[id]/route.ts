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
    where: { id: projectId, orgId },
    select: {
      id: true,
      name: true,
      code: true,
      status: true,
      client: true,
      location: true,
      plantName: true,
      _count: {
        select: {
          workpacks: true,
        },
      },
    },
  });

  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { _count, ...rest } = project;
  return NextResponse.json({ ...rest, _count });
});
