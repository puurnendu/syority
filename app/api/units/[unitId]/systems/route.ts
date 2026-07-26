import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { prisma } from '@/lib/prisma';
import { computePlanningProgressForSystems, SystemPlanningProgress } from '@/lib/planningProgress';

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

  // Bulk computation — avoids N+1 (previously ~12 queries per system)
  const planningBySystem = await computePlanningProgressForSystems(systems.map((s) => s.id));
  const result: SystemPlanningProgress[] = systems.map((s) => {
    const c = planningBySystem.get(s.id)!;
    return {
      systemId: s.id,
      systemCode: s.code ?? '',
      systemName: s.name,
      unitName: unit.name,
      criticality: s.criticality ?? '',
      planningProgress: c.planningProgress,
      workpackCount: c.workpackCount,
      activityCount: c.activityCount,
      status: c.status,
      planningChecks: c.planningChecks,
    };
  });

  return NextResponse.json({ data: result });
}
