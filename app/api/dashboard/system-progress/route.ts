import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { prisma } from '@/lib/prisma';
import { computePlanningProgressForSystems, SystemPlanningProgress } from '@/lib/planningProgress';

const querySchema = z.object({
  event_id: z.string().uuid().optional(),
});

export async function GET(req: NextRequest) {
  const { session, error } = await guardApi('workpacks.view');
  if (error) return error;
  const { orgId } = orgScope(session!);

  const { searchParams } = new URL(req.url);
  const parsed = querySchema.safeParse({
    event_id: searchParams.get('event_id') ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid query', details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const { event_id } = parsed.data;

  let systemIds: string[] = [];
  if (event_id) {
    const eventSystems = await prisma.eventSystem.findMany({
      where: { event_id },
      select: { system_id: true },
    });
    systemIds = eventSystems.map((es) => es.system_id);
  } else {
    const systems = await prisma.system.findMany({
      where: { organization_id: orgId, deleted_at: null },
      select: { id: true },
    });
    systemIds = systems.map((s) => s.id);
  }

  const systems = await prisma.system.findMany({
    where: { id: { in: systemIds } },
    include: { unit: { select: { name: true } } },
  });

  // Bulk computation — avoids N+1 (previously ~12 queries per system)
  const planningBySystem = await computePlanningProgressForSystems(systems.map((s) => s.id));
  const result: SystemPlanningProgress[] = systems.map((s) => {
    const c = planningBySystem.get(s.id)!;
    return {
      systemId: s.id,
      systemCode: s.code ?? '',
      systemName: s.name,
      unitName: s.unit?.name ?? '',
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
