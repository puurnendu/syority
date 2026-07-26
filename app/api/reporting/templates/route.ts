import { NextRequest, NextResponse } from 'next/server';
import { guardApi } from '@/lib/apiGuard';
import { withTenantGuard } from '@/lib/withTenantGuard';
import { prisma } from '@/lib/prisma';

/**
 * GET  /api/reporting/templates   — list templates for org
 * POST /api/reporting/templates   — create a new template
 */
export const GET = withTenantGuard(async (_req: NextRequest, _ctx, session) => {
  const { error } = await guardApi('reporting:view');
  if (error) return error;

  const templateList = await prisma.reportTemplate.findMany({
    where: { organization_id: session.user.organization_id, deleted_at: null },
    orderBy: { updated_at: 'desc' },
    select: {
      id: true,
      name: true,
      pages: true,
      created_by: true,
      created_at: true,
      updated_at: true,
      _count: { select: { deliveries: true } },
    },
  });

  return NextResponse.json({ templates: templateList });
});

export const POST = withTenantGuard(async (req: NextRequest, _ctx, session) => {
  const { error } = await guardApi('reporting:build');
  if (error) return error;

  const body = await req.json();
  const { name, pages } = body ?? {};
  if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 });

  const template = await prisma.reportTemplate.create({
    data: {
      organization_id: session.user.organization_id,
      name,
      pages: pages ?? [],
      created_by: session.user.id,
    },
  });

  return NextResponse.json({ template }, { status: 201 });
});
