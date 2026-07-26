import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { prisma } from '@/lib/prisma';

const querySchema = z.object({
  site_id: z.string().uuid().optional(),
  event_id: z.string().uuid().optional(),
  plant_id: z.string().uuid().optional(),
  status: z.string().optional(),
  search: z.string().optional(),
});

export async function GET(req: NextRequest) {
  const { session, error } = await guardApi('unit:view');
  if (error) return error;
  const { orgId } = orgScope(session!);

  const { searchParams } = new URL(req.url);
  const parsed = querySchema.safeParse({
    site_id: searchParams.get('site_id') ?? undefined,
    event_id: searchParams.get('event_id') ?? undefined,
    plant_id: searchParams.get('plant_id') ?? undefined,
    status: searchParams.get('status') ?? undefined,
    search: searchParams.get('search') ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid query', details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const { site_id, event_id, plant_id, status, search } = parsed.data;

  const where: Record<string, unknown> = {
    organization_id: orgId,
  };
  if (site_id) (where as any).site_id = site_id;
  if (plant_id) (where as any).plant_id = plant_id;
  if (search) {
    (where as any).OR = [
      { code: { contains: search, mode: 'insensitive' } },
      { name: { contains: search, mode: 'insensitive' } },
    ];
  }

  if (event_id) {
    const eventSystems = await prisma.eventSystem.findMany({
      where: { event_id },
      select: { system: { select: { unit_id: true } } },
    });
    const unitIds = [...new Set(eventSystems.map((es) => es.system.unit_id))];
    if (unitIds.length) (where as any).id = { in: unitIds };
    else (where as any).id = { in: [] };
  }

  const units = await prisma.unit.findMany({
    where,
    include: {
      site: { select: { id: true, name: true, code: true } },
      plant: { select: { id: true, name: true, code: true } },
      _count: {
        select: { systems: true, workpacks: true },
      },
    },
    orderBy: [{ name: 'asc' }],
  });

  const assetCountByUnit = await prisma.asset.groupBy({
    by: ['system_id'],
    where: {
      system: { unit_id: { in: units.map((u) => u.id) } },
      deleted_at: null,
    },
    _count: { _all: true },
  });
  const systemIds = assetCountByUnit.map((a) => a.system_id).filter((id): id is string => id != null);
  const systemToUnit = await prisma.system.findMany({
    where: { id: { in: systemIds } },
    select: { id: true, unit_id: true },
  });
  const unitAssetCount: Record<string, number> = {};
  for (const s of systemToUnit) {
    const count = assetCountByUnit.find((a) => a.system_id === s.id)?._count._all ?? 0;
    unitAssetCount[s.unit_id] = (unitAssetCount[s.unit_id] ?? 0) + count;
  }

  const allSystemsInUnits = await prisma.system.findMany({
    where: { unit_id: { in: units.map((u) => u.id) }, deleted_at: null },
    select: { id: true, unit_id: true },
  });
  const unitSystemIds: Record<string, string[]> = {};
  for (const s of allSystemsInUnits) {
    if (!unitSystemIds[s.unit_id]) unitSystemIds[s.unit_id] = [];
    unitSystemIds[s.unit_id].push(s.id);
  }
  const { computePlanningProgressForSystems } = await import('@/lib/planningProgress');
  // Bulk computation — avoids N+1 (previously ~12 sequential queries per system)
  const planningBySystem = await computePlanningProgressForSystems(allSystemsInUnits.map((s) => s.id));
  const progressBySystemId: Record<string, number> = {};
  for (const s of allSystemsInUnits) {
    progressBySystemId[s.id] = planningBySystem.get(s.id)?.planningProgress ?? 0;
  }
  const avgProgressByUnit: Record<string, number> = {};
  for (const unit of units) {
    const sysIds = unitSystemIds[unit.id] ?? [];
    if (sysIds.length === 0) {
      avgProgressByUnit[unit.id] = 0;
      continue;
    }
    const sum = sysIds.reduce((a, id) => a + (progressBySystemId[id] ?? 0), 0);
    avgProgressByUnit[unit.id] = Math.round(sum / sysIds.length);
  }

  const list = units.map((u) => {
    const progress = u._count.systems > 0 ? avgProgressByUnit[u.id] ?? 0 : 0;
    const status =
      progress === 0 ? 'Not Started' : progress === 100 ? 'Planned' : 'In Planning';
    return {
      id: u.id,
      code: u.code,
      name: u.name,
      plant: u.plant,
      site: u.site,
      systems_count: u._count.systems,
      equipment_count: unitAssetCount[u.id] ?? 0,
      workpacks_count: u._count.workpacks,
      planning_progress: progress,
      status,
    };
  });

  let filtered = list;
  if (status) {
    filtered = list.filter((u) => u.status === status);
  }

  return NextResponse.json({ data: filtered });
}

const createUnitSchema = z.object({
  site_id: z.string().uuid(),
  plant_id: z.string().uuid(),
  name: z.string().min(1),
  code: z.string().optional(),
  description: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const { session, error } = await guardApi('unit:manage');
  if (error) return error;
  const { orgId, userId } = orgScope(session!);

  const body = await req.json().catch(() => null);
  const parsed = createUnitSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const data = parsed.data;

  const site = await prisma.site.findFirst({
    where: { id: data.site_id, organization_id: orgId },
    select: { id: true },
  });
  if (!site) return NextResponse.json({ error: 'Site not found' }, { status: 404 });

  const plant = await prisma.plant.findFirst({
    where: { id: data.plant_id, organization_id: orgId, site_id: data.site_id },
    select: { id: true },
  });
  if (!plant) return NextResponse.json({ error: 'Plant not found' }, { status: 404 });

  const unit = await prisma.unit.create({
    data: {
      organization_id: orgId,
      site_id: data.site_id,
      plant_id: data.plant_id,
      name: data.name.trim(),
      code: data.code?.trim() ?? null,
      description: data.description?.trim() ?? null,
      created_by: userId,
    },
    include: {
      site: { select: { id: true, name: true, code: true } },
      plant: { select: { id: true, name: true, code: true } },
    },
  });

  return NextResponse.json({ data: unit }, { status: 201 });
}
