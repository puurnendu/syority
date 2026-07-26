import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guardApi } from '@/lib/apiGuard';
import { withTenantGuard } from '@/lib/withTenantGuard';
import { ProjectBranchingService } from '@/lib/services/ProjectBranchingService';

export const GET = withTenantGuard(async (req: NextRequest, { params }, session) => {
  const { error } = await guardApi('workpacks.view');
  if (error) return error;

  const { id: projectId } = await params;

  const baselines = await prisma.project.findMany({
    where: { 
      parentProjectId: projectId,
      isBaseline:      true
    },
    orderBy: { createdAt: 'desc' }
  });

  const sourceProject = await prisma.project.findUnique({
    where: { id: projectId },
    select: { primaryBaselineId: true }
  });

  return NextResponse.json({ baselines, primaryBaselineId: sourceProject?.primaryBaselineId });
});

export const POST = withTenantGuard(async (req: NextRequest, { params }, session) => {
  const { error } = await guardApi('nav.schedule'); // Assuming same permission as schedule manage
  if (error) return error;

  const { id: projectId } = await params;
  const { action, name, baselineId } = await req.json();

  try {
    if (action === 'snapshot') {
      if (!name) return NextResponse.json({ error: 'Baseline name is required' }, { status: 400 });
      const newId = await ProjectBranchingService.createBaseline(projectId, name, session.user.id);
      return NextResponse.json({ success: true, id: newId });
    }

    if (action === 'assign') {
      if (!baselineId) return NextResponse.json({ error: 'Baseline ID is required' }, { status: 400 });
      await prisma.project.update({
        where: { id: projectId },
        data: { primaryBaselineId: baselineId }
      });
      return NextResponse.json({ success: true });
    }

    if (action === 'restore') {
        if (!baselineId) return NextResponse.json({ error: 'Baseline ID is required' }, { status: 400 });
        const newProjectId = await ProjectBranchingService.restoreBaseline(baselineId, session.user.id);
        return NextResponse.json({ success: true, newProjectId });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err: any) {
    console.error('[Baselines API Error]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
});

export const DELETE = withTenantGuard(async (req: NextRequest, { params }, session) => {
    const { error } = await guardApi('nav.schedule');
    if (error) return error;

    const url = new URL(req.url);
    const baselineId = url.searchParams.get('baselineId');

    if (!baselineId) return NextResponse.json({ error: 'Baseline ID required' }, { status: 400 });

    try {
        await prisma.project.delete({
            where: { id: baselineId, isBaseline: true }
        });
        return NextResponse.json({ success: true });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
});
