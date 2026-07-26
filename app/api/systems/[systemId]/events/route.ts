import { NextRequest, NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { prisma } from '@/lib/prisma';

/** GET: list events linked to this system */
export async function GET(req: NextRequest, { params }: { params: Promise<{ systemId: string }> }) {
  const { session, error } = await guardApi('system:view');
  if (error) return error;
  const { orgId } = orgScope(session!);
  const { systemId } = await params;

  const system = await prisma.system.findFirst({
    where: { id: systemId, organization_id: orgId, deleted_at: null },
    select: { id: true },
  });
  if (!system) return NextResponse.json({ error: 'System not found' }, { status: 404 });

  const links = await prisma.eventSystem.findMany({
    where: { system_id: systemId },
    include: { event: { select: { id: true, name: true, code: true, status: true, planned_start: true, planned_end: true } } },
  });
  const events = links.map((l) => l.event);
  return NextResponse.json({ data: events });
}

/** POST: link this system to an event (body: { event_id }) */
export async function POST(req: NextRequest, { params }: { params: Promise<{ systemId: string }> }) {
  const { session, error } = await guardApi('system:edit');
  if (error) return error;
  const { orgId } = orgScope(session!);
  const { systemId } = await params;

  const system = await prisma.system.findFirst({
    where: { id: systemId, organization_id: orgId, deleted_at: null },
    select: { id: true },
  });
  if (!system) return NextResponse.json({ error: 'System not found' }, { status: 404 });

  const body = await req.json().catch(() => null);
  const eventId = body?.event_id;
  if (!eventId) return NextResponse.json({ error: 'event_id is required' }, { status: 400 });

  const event = await prisma.event.findFirst({
    where: { id: eventId, organization_id: orgId, deleted_at: null },
    select: { id: true },
  });
  if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

  await prisma.eventSystem.upsert({
    where: { event_id_system_id: { event_id: eventId, system_id: systemId } },
    create: { event_id: eventId, system_id: systemId },
    update: {},
  });
  const links = await prisma.eventSystem.findMany({
    where: { system_id: systemId },
    include: { event: { select: { id: true, name: true, code: true, status: true } } },
  });
  return NextResponse.json({ data: links }, { status: 201 });
}
