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
    select: { id: true },
  });
  if (!unit) return NextResponse.json({ error: 'Unit not found' }, { status: 404 });

  const assets = await prisma.asset.findMany({
    where: {
      system: { unit_id: unitId },
      deleted_at: null,
    },
    include: {
      system: { select: { id: true, code: true, name: true } },
      workpacks: {
        where: { deleted_at: null },
        select: { id: true, workpack_id_code: true, title: true, status: true },
        take: 1,
      },
    },
    orderBy: [{ system: { name: 'asc' } }, { tag_number: 'asc' }],
  });

  const bySystem: Record<string, typeof assets> = {};
  for (const a of assets) {
    const sid = a.system_id ?? 'unknown';
    if (!bySystem[sid]) bySystem[sid] = [];
    bySystem[sid].push(a);
  }

  const data = {
    grouped: Object.entries(bySystem).map(([systemId, list]) => ({
      systemId,
      systemCode: list[0]?.system?.code ?? '',
      systemName: list[0]?.system?.name ?? '',
      equipment: list.map((a) => ({
        id: a.id,
        tag: a.tag_number,
        equipmentName: a.name,
        system: a.system?.name ?? '',
        type: a.asset_type ?? '',
        standard: '',
        designPressure: a.design_pressure_barg,
        designTemp: a.design_temp_c,
        linkedWp: a.workpacks[0]
          ? { id: a.workpacks[0].id, code: a.workpacks[0].workpack_id_code, title: a.workpacks[0].title }
          : null,
        status: a.is_active != null ? (a.is_active ? 'Active' : 'Inactive') : 'Active',
      })),
    })),
  };

  return NextResponse.json({ data });
}
