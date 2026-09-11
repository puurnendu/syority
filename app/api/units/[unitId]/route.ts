import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { prisma } from '@/lib/prisma';

const paramsSchema = z.object({ unitId: z.string().uuid() });

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ unitId: string }> }
) {
  const { session, error } = await guardApi('unit:view');
  if (error) return error;
  const { orgId } = orgScope(session!);

  const parsed = paramsSchema.safeParse(await context.params);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid unit ID', details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const { unitId } = parsed.data;

  const unit = await prisma.unit.findFirst({
    where: { id: unitId, organization_id: orgId },
    include: {
      site: { select: { id: true, name: true, code: true } },
      plant: { select: { id: true, name: true, code: true } },
      _count: { select: { systems: true, workpacks: true } },
    },
  });
  if (!unit) return NextResponse.json({ error: 'Unit not found' }, { status: 404 });

  const systemIds = await prisma.system.findMany({
    where: { unit_id: unitId },
    select: { id: true },
  }).then((s) => s.map((x) => x.id));

  const [equipmentCount, blindCount, openConstraintsCount] = await Promise.all([
    prisma.asset.count({
      where: { system_id: { in: systemIds }, deleted_at: null },
    }),
    prisma.system_blinds.count({
      where: { system_id: { in: systemIds } },
    }),
    prisma.constraint.count({
      where: {
        workpack: { system_id: { in: systemIds }, deleted_at: null },
        status: { in: ['open', 'in_progress'] },
        deleted_at: null,
      },
    }),
  ]);

  return NextResponse.json({
    data: {
      id: unit.id,
      code: unit.code,
      name: unit.name,
      description: unit.description,
      plant: unit.plant,
      site: unit.site,
      is_active: unit.is_active,
      systems_count: unit._count.systems,
      equipment_count: equipmentCount,
      workpacks_count: unit._count.workpacks,
      blinds_count: blindCount,
      open_constraints_count: openConstraintsCount,
    },
  });
}
