import { NextRequest, NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { prisma } from '@/lib/prisma';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { session, error } = await guardApi('masterdata.view');
  if (error) return error;
  const { orgId } = orgScope(session!);

  const { eventId } = await params;
  const event = await prisma.event.findFirst({
    where: { id: eventId, organization_id: orgId, deleted_at: null },
    select: { id: true },
  });
  if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

  const units = await prisma.eventUnit.findMany({
    where: { event_id: eventId },
    include: { unit: { select: { id: true, name: true, code: true } } },
  });
  return NextResponse.json({ data: units });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { session, error } = await guardApi('masterdata.edit');
  if (error) return error;
  const { orgId } = orgScope(session!);

  const { eventId } = await params;
  const event = await prisma.event.findFirst({
    where: { id: eventId, organization_id: orgId, deleted_at: null },
    select: { id: true },
  });
  if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

  const body = await req.json().catch(() => null);
  if (!body?.unit_id) return NextResponse.json({ error: 'unit_id is required' }, { status: 400 });

  const unit = await prisma.unit.findFirst({
    where: { id: body.unit_id, organization_id: orgId },
    select: { id: true },
  });
  if (!unit) return NextResponse.json({ error: 'Unit not found' }, { status: 404 });

  const existing = await prisma.eventUnit.findUnique({
    where: { event_id_unit_id: { event_id: eventId, unit_id: body.unit_id } },
  });
  if (existing) return NextResponse.json({ error: 'Unit already in event' }, { status: 409 });

  const eventUnit = await prisma.eventUnit.create({
    data: {
      event_id: eventId,
      unit_id: body.unit_id,
      is_active: true,
      notes: body.notes?.trim() ?? null,
    },
    include: { unit: { select: { id: true, name: true, code: true } } },
  });
  return NextResponse.json({ data: eventUnit }, { status: 201 });
}
