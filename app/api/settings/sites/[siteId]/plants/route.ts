import { NextRequest, NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { prisma } from '@/lib/prisma';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ siteId: string }> }
) {
  const { session, error } = await guardApi('settings.view');
  if (error) return error;
  const { orgId } = orgScope(session!);

  const { siteId } = await context.params;

  const site = await prisma.site.findFirst({
    where: { id: siteId, organization_id: orgId },
    select: { id: true },
  });
  if (!site) return NextResponse.json({ error: 'Site not found' }, { status: 404 });

  const plants = await prisma.plant.findMany({
    where: { site_id: siteId, organization_id: orgId, deleted_at: null },
    include: { _count: { select: { units: true } } },
    orderBy: { name: 'asc' },
  });

  return NextResponse.json(plants);
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ siteId: string }> }
) {
  const { session, error } = await guardApi('settings.org.edit');
  if (error) return error;
  const { orgId, userId } = orgScope(session!);

  const { siteId } = await context.params;

  const site = await prisma.site.findFirst({
    where: { id: siteId, organization_id: orgId },
    select: { id: true },
  });
  if (!site) return NextResponse.json({ error: 'Site not found' }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) {
    return NextResponse.json({ error: 'Plant name is required' }, { status: 400 });
  }

  const plant = await prisma.plant.create({
    data: {
      site_id: siteId,
      organization_id: orgId,
      name,
      code: typeof body.code === 'string' ? body.code.trim() || null : null,
      description:
        typeof body.description === 'string' ? body.description.trim() || null : null,
      created_by: userId,
    },
  });

  return NextResponse.json(plant, { status: 201 });
}
