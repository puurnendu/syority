import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { prisma } from '@/lib/prisma';

const createSystemSchema = z.object({
  site_id: z.string().uuid(),
  unit_id: z.string().uuid(),
  code: z.string().min(1).optional(),
  name: z.string().min(1),
  description: z.string().optional(),
  criticality: z.enum(['High', 'Medium', 'Low']).optional(),
  status: z.string().optional(),
  p_and_id_ref: z.string().optional(),
});

export async function GET(req: NextRequest) {
  const { session, error } = await guardApi('system:view');
  if (error) return error;
  const { orgId } = orgScope(session!);

  const { searchParams } = new URL(req.url);
  const siteId = searchParams.get('site_id') ?? undefined;
  const eventId = searchParams.get('event_id') ?? undefined;
  const unitId = searchParams.get('unit_id') ?? undefined;
  const criticality = searchParams.get('criticality') ?? undefined;
  const status = searchParams.get('status') ?? undefined;
  const search = searchParams.get('search') ?? undefined;

  const where: Record<string, unknown> = {
    organization_id: orgId,
    deleted_at: null,
  };
  if (siteId) (where as any).site_id = siteId;
  if (unitId) (where as any).unit_id = unitId;
  if (criticality) (where as any).criticality = criticality;
  if (status) (where as any).status = status;
  if (search) {
    (where as any).OR = [
      { code: { contains: search, mode: 'insensitive' } },
      { name: { contains: search, mode: 'insensitive' } },
    ];
  }

  // If eventId: only systems linked to this event via EventSystem
  if (eventId) {
    const eventSystems = await prisma.eventSystem.findMany({
      where: { event_id: eventId },
      select: { system_id: true },
    });
    const systemIds = eventSystems.map((es) => es.system_id);
    if (systemIds.length) (where as any).id = { in: systemIds };
    else (where as any).id = { in: [] }; // no systems in event
  }

  const systems = await prisma.system.findMany({
    where,
    include: {
      site: { select: { id: true, name: true, code: true } },
      unit: { select: { id: true, name: true, code: true } },
      _count: {
        select: { blinds: true, gaskets: true, workpacks: true },
      },
    },
    orderBy: [{ unit: { name: 'asc' } }, { code: 'asc' }, { name: 'asc' }],
  });

  return NextResponse.json({ data: systems });
}

export async function POST(req: NextRequest) {
  const { session, error } = await guardApi('system:create');
  if (error) return error;
  const { orgId, userId } = orgScope(session!);

  const body = await req.json().catch(() => null);
  const parsed = createSystemSchema.safeParse(body);
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

  const unit = await prisma.unit.findFirst({
    where: { id: data.unit_id, organization_id: orgId, site_id: data.site_id },
    select: { id: true },
  });
  if (!unit) return NextResponse.json({ error: 'Unit not found' }, { status: 404 });

  const system = await prisma.system.create({
    data: {
      organization_id: orgId,
      site_id: data.site_id,
      unit_id: data.unit_id,
      code: data.code?.trim() ?? null,
      name: data.name.trim(),
      description: data.description?.trim() ?? null,
      criticality: data.criticality ?? null,
      status: data.status ?? 'Active',
      p_and_id_ref: data.p_and_id_ref?.trim() ?? null,
      created_by: userId,
    },
    include: {
      site: { select: { id: true, name: true, code: true } },
      unit: { select: { id: true, name: true, code: true } },
      _count: { select: { blinds: true, gaskets: true, workpacks: true } },
    },
  });

  return NextResponse.json({ data: system }, { status: 201 });
}
