import { NextRequest, NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { prisma } from '@/lib/prisma';

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ siteId: string; plantId: string }> }
) {
  const { session, error } = await guardApi('settings.org.edit');
  if (error) return error;
  const { orgId } = orgScope(session!);

  const { siteId, plantId } = await context.params;

  const existing = await prisma.plant.findFirst({
    where: { id: plantId, site_id: siteId, organization_id: orgId, deleted_at: null },
    select: { id: true },
  });
  if (!existing) return NextResponse.json({ error: 'Plant not found' }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const plant = await prisma.plant.update({
    where: { id: plantId },
    data: {
      ...(typeof body.name === 'string' && { name: body.name.trim() }),
      ...(typeof body.code === 'string' && { code: body.code.trim() || null }),
      ...(typeof body.description === 'string' && {
        description: body.description.trim() || null,
      }),
    },
  });

  return NextResponse.json(plant);
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ siteId: string; plantId: string }> }
) {
  const { session, error } = await guardApi('settings.org.edit');
  if (error) return error;
  const { orgId } = orgScope(session!);

  const { siteId, plantId } = await context.params;

  const existing = await prisma.plant.findFirst({
    where: { id: plantId, site_id: siteId, organization_id: orgId, deleted_at: null },
    select: { id: true },
  });
  if (!existing) return NextResponse.json({ error: 'Plant not found' }, { status: 404 });

  const unitCount = await prisma.unit.count({
    where: { plant_id: plantId, deleted_at: null },
  });
  if (unitCount > 0) {
    return NextResponse.json(
      {
        error: `Cannot delete plant with ${unitCount} unit(s). Remove units first.`,
      },
      { status: 400 }
    );
  }

  await prisma.plant.update({
    where: { id: plantId },
    data: { deleted_at: new Date() },
  });

  return NextResponse.json({ success: true });
}
