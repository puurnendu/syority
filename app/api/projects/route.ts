import { NextRequest, NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { withTenantGuard } from '@/lib/withTenantGuard';
import { prisma } from '@/lib/prisma';
import { randomUUID } from 'crypto';

export const GET = withTenantGuard(async (req: NextRequest, _ctx, session) => {
  try {
    const { error } = await guardApi('projects.view');
    if (error) return error;
    const { orgId } = orgScope(session!);

    const projects = await prisma.project.findMany({
      where: { org_id: orgId },
      select: {
        id: true,
        name: true,
        code: true,
        status: true,
        client: true,
        location: true,
        plant_name: true,
        planned_sd_date: true,
        planned_su_date: true,
        portfolio_id: true,
        portfolio: { select: { id: true, name: true, code: true } },
        _count: {
          select: { Workpack: true },
        },
      },
      orderBy: { created_at: 'desc' },
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

    const plannedSdDate = body.planned_sd_date ? new Date(body.planned_sd_date) : null;
    const plannedSuDate = body.planned_su_date ? new Date(body.planned_su_date) : null;

    let portfolioId: string | null = null;
    if (body.portfolio_id) {
      const portfolio = await prisma.portfolio.findFirst({
        where: { id: body.portfolio_id, organization_id: orgId },
        select: { id: true },
      });
      if (!portfolio) return NextResponse.json({ error: 'Portfolio not found' }, { status: 404 });
      portfolioId = portfolio.id;
    }

    const project = await prisma.project.create({
      data: {
        id: randomUUID(),
        updated_at: new Date(),
        org_id: orgId,
        name,
        code,
        client: body.client?.trim() || null,
        location: body.location?.trim() || null,
        plant_name: body.plant_name?.trim() || null,
        planned_sd_date: plannedSdDate && !isNaN(plannedSdDate.getTime()) ? plannedSdDate : null,
        planned_su_date: plannedSuDate && !isNaN(plannedSuDate.getTime()) ? plannedSuDate : null,
        created_by: userId,
        portfolio_id: portfolioId,
      },
      select: {
        id: true,
        name: true,
        code: true,
        status: true,
        client: true,
        plant_name: true,
        planned_sd_date: true,
        planned_su_date: true,
        _count: { select: { Workpack: true } },
      },
    });

    return NextResponse.json(project);
  } catch (err: any) {
    console.error('Error in POST /api/projects:', err);
    return NextResponse.json({ error: err.message, stack: err.stack }, { status: 500 });
  }
});
