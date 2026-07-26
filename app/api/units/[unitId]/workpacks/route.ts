import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { prisma } from '@/lib/prisma';

const paramsSchema = z.object({ unitId: z.string().uuid() });
const querySchema = z.object({
  system_id: z.string().uuid().optional(),
  status: z.string().optional(),
  discipline_id: z.string().uuid().optional(),
});

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ unitId: string }> }
) {
  const { session, error } = await guardApi('unit:view');
  if (error) return error;
  const { orgId } = orgScope(session!);

  const parsedParams = paramsSchema.safeParse(await context.params);
  if (!parsedParams.success) {
    return NextResponse.json(
      { error: 'Invalid unit ID', details: parsedParams.error.flatten() },
      { status: 400 }
    );
  }
  const { unitId } = parsedParams.data;

  const { searchParams } = new URL(req.url);
  const parsedQuery = querySchema.safeParse({
    system_id: searchParams.get('system_id') ?? undefined,
    status: searchParams.get('status') ?? undefined,
    discipline_id: searchParams.get('discipline_id') ?? undefined,
  });
  if (!parsedQuery.success) {
    return NextResponse.json(
      { error: 'Invalid query', details: parsedQuery.error.flatten() },
      { status: 400 }
    );
  }
  const { system_id, status, discipline_id } = parsedQuery.data;

  const unit = await prisma.unit.findFirst({
    where: { id: unitId, organization_id: orgId },
    select: { id: true },
  });
  if (!unit) return NextResponse.json({ error: 'Unit not found' }, { status: 404 });

  const systemIds = await prisma.system
    .findMany({
      where: { unit_id: unitId },
      select: { id: true },
    })
    .then((s) => s.map((x) => x.id));
  if (systemIds.length === 0) return NextResponse.json({ data: [] });

  const where: Record<string, unknown> = {
    system_id: { in: systemIds },
    deleted_at: null,
  };
  if (system_id) (where as any).system_id = system_id;
  if (status) (where as any).status = status;
  if (discipline_id) (where as any).discipline_id = discipline_id;

  const workpacks = await prisma.workpack.findMany({
    where,
    include: {
      system: { select: { id: true, code: true, name: true } },
      asset: { select: { id: true, tag_number: true, name: true } },
      discipline: { select: { id: true, name: true, code: true } },
    },
    orderBy: [{ workpack_id_code: 'asc' }],
  });

  const data = workpacks.map((w) => ({
    id: w.id,
    workpack_id_code: w.workpack_id_code,
    title: w.title,
    system: w.system ? { id: w.system.id, code: w.system.code, name: w.system.name } : null,
    equipment: w.asset ? { id: w.asset.id, tag: w.asset.tag_number, name: w.asset.name } : null,
    discipline: w.discipline ? { id: w.discipline.id, name: w.discipline.name, code: w.discipline.code } : null,
    status: w.status,
  }));

  return NextResponse.json({ data });
}
