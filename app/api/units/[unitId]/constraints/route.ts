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

  const systemIds = await prisma.system.findMany({
    where: { unit_id: unitId },
    select: { id: true },
  }).then((s) => s.map((x) => x.id));
  if (systemIds.length === 0) {
    return NextResponse.json({ data: [] });
  }

  const constraints = await prisma.constraint.findMany({
    where: {
      workpack: { system_id: { in: systemIds }, deleted_at: null },
      status: { in: ['open', 'in_progress'] },
      deleted_at: null,
    },
    include: {
      workpack: { select: { id: true, workpack_id_code: true, title: true, system_id: true } },
      owner: { select: { id: true, name: true, email: true } },
    },
    orderBy: { target_resolution_date: 'asc' },
  });

  const systemMap = await prisma.system.findMany({
    where: { id: { in: systemIds } },
    select: { id: true, code: true, name: true },
  }).then((list) => Object.fromEntries(list.map((s) => [s.id, s])));

  const data = constraints.map((c) => ({
    id: c.id,
    constraint_number: c.constraint_number,
    type: c.constraint_type,
    title: c.title,
    raised: c.raised_at,
    status: c.status,
    owner: c.owner ? { id: c.owner.id, name: c.owner.name, email: c.owner.email } : null,
    workpack: c.workpack
      ? {
          id: c.workpack.id,
          workpack_id_code: c.workpack.workpack_id_code,
          title: c.workpack.title,
        }
      : null,
    system: c.workpack?.system_id ? systemMap[c.workpack.system_id] ?? null : null,
    dueDate: c.target_resolution_date,
  }));

  return NextResponse.json({ data });
}
