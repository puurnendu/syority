import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { prisma } from '@/lib/prisma';
import { computePlanningProgressForSystems } from '@/lib/planningProgress';

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
    select: { id: true, name: true },
  });
  if (!unit) return NextResponse.json({ error: 'Unit not found' }, { status: 404 });

  const systems = await prisma.system.findMany({
    where: { unit_id: unitId, deleted_at: null },
    orderBy: [{ code: 'asc' }, { name: 'asc' }],
  });
  const systemIds = systems.map((s) => s.id);

  // Bulk queries — avoids N+1 (previously ~13 queries per system)
  const [planningBySystem, activities] = await Promise.all([
    computePlanningProgressForSystems(systemIds),
    prisma.activity.findMany({
      where: {
        workpack: { system_id: { in: systemIds }, deleted_at: null },
        deleted_at: null,
      },
      select: {
        planned_start: true,
        planned_end: true,
        workpack: { select: { system_id: true } },
      },
    }),
  ]);

  // Per-system planned date ranges
  const rangeBySystem = new Map<string, { min: number; max: number }>();
  for (const a of activities) {
    const sysId = a.workpack?.system_id;
    if (!sysId || a.planned_start == null || a.planned_end == null) continue;
    const start = new Date(a.planned_start).getTime();
    const end = new Date(a.planned_end).getTime();
    const range = rangeBySystem.get(sysId);
    if (!range) {
      rangeBySystem.set(sysId, { min: start, max: end });
    } else {
      if (start < range.min) range.min = start;
      if (end > range.max) range.max = end;
    }
  }

  const rows = systems.map((s) => {
    const payload = planningBySystem.get(s.id);
    const range = rangeBySystem.get(s.id);
    return {
      systemId: s.id,
      systemCode: s.code ?? '',
      systemName: s.name,
      planningProgress: payload?.planningProgress ?? 0,
      workpackCount: payload?.workpackCount ?? 0,
      activityCount: payload?.activityCount ?? 0,
      dateRange: range
        ? { earliestStart: new Date(range.min), latestFinish: new Date(range.max) }
        : null,
      status: payload?.status ?? 'Not Started',
    };
  });

  return NextResponse.json({ data: rows });
}
