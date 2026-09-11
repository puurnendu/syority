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
    select: {
      id: true,
      name: true,
      code: true,
      status: true,
      client: true,
      description: true,
      location: true,
      plant_name: true,
      // OD9.2 §15: the Project detail surface renders planned dates, but they were never
      // selected here, so they always showed as blank.
      planned_sd_date: true,
      planned_su_date: true,
      portfolio_id: true,
      portfolio: { select: { id: true, name: true, code: true } },
      _count: {
        select: {
          Workpack: true,
          wbsNodes: true,
        },
      },
    },
  });

  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { _count, ...rest } = project;
  return NextResponse.json({ ...rest, _count });
});

export const PATCH = withTenantGuard(async (req: NextRequest, { params }, session) => {
  const { error } = await guardApi('projects.view');
  if (error) return error;
  const { orgId } = orgScope(session!);
  const { id: projectId } = await params;
  const body = await req.json().catch(() => ({}));

  const existing = await prisma.project.findFirst({
    where: { id: projectId, org_id: orgId },
    select: { id: true },
  });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  let portfolio_id: string | null | undefined = undefined;
  if (body.portfolio_id !== undefined) {
    if (body.portfolio_id === null || body.portfolio_id === '') {
      portfolio_id = null;
    } else {
      const portfolio = await prisma.portfolio.findFirst({
        where: { id: body.portfolio_id, organization_id: orgId },
        select: { id: true },
      });
      if (!portfolio) return NextResponse.json({ error: 'Portfolio not found' }, { status: 404 });
      portfolio_id = portfolio.id;
    }
  }

  const updated = await prisma.project.update({
    where: { id: projectId },
    data: {
      ...(body.name ? { name: String(body.name).trim() } : {}),
      ...(body.description !== undefined ? { description: body.description } : {}),
      ...(portfolio_id !== undefined ? { portfolio_id } : {}),
      updated_at: new Date(),
    },
    select: { id: true, name: true, portfolio_id: true },
  });
  return NextResponse.json({ data: updated });
});
