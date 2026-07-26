import { NextRequest, NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { withTenantGuard } from '@/lib/withTenantGuard';
import { prisma } from '@/lib/prisma';

export const GET = withTenantGuard(async (req: NextRequest, _ctx, session) => {
  try {
    const { error } = await guardApi('projects.view');
    if (error) return error;
    const { orgId } = orgScope(session!);

    const projects = await prisma.project.findMany({
      where: { orgId },
      select: {
        id: true,
        name: true,
        code: true,
        status: true,
        client: true,
        location: true,
        plantName: true,
        plannedSdDate: true,
        plannedSuDate: true,
        _count: {
          select: { workpacks: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(projects);
  } catch (err: any) {
    console.error('Error in GET /api/projects:', err);
    return NextResponse.json({ error: err.message, stack: err.stack }, { status: 500 });
  }
});

export const POST = withTenantGuard(async (req: NextRequest, _ctx, session) => {
  try {
    const { error } = await guardApi('projects.view');
    if (error) return error;
    const { orgId, userId } = orgScope(session!);

    const body = await req.json().catch(() => ({}));
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const code = typeof body.code === 'string' ? body.code.trim() : '';
    if (!name || !code) {
      return NextResponse.json({ error: 'name and code are required' }, { status: 400 });
    }

    const plannedSdDate = body.plannedSdDate ? new Date(body.plannedSdDate) : null;
    const plannedSuDate = body.plannedSuDate ? new Date(body.plannedSuDate) : null;

    const project = await prisma.project.create({
      data: {
        orgId,
        name,
        code,
        client: body.client?.trim() || null,
        location: body.location?.trim() || null,
        plantName: body.plantName?.trim() || null,
        plannedSdDate: plannedSdDate && !isNaN(plannedSdDate.getTime()) ? plannedSdDate : null,
        plannedSuDate: plannedSuDate && !isNaN(plannedSuDate.getTime()) ? plannedSuDate : null,
        createdBy: userId,
      },
      select: {
        id: true,
        name: true,
        code: true,
        status: true,
        client: true,
        plantName: true,
        plannedSdDate: true,
        plannedSuDate: true,
        _count: { select: { workpacks: true } },
      },
    });

    return NextResponse.json(project);
  } catch (err: any) {
    console.error('Error in POST /api/projects:', err);
    return NextResponse.json({ error: err.message, stack: err.stack }, { status: 500 });
  }
});
