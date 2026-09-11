import { NextRequest, NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { prisma } from '@/lib/prisma';

async function ensureEventAccess(eventId: string, orgId: string) {
  const event = await prisma.event.findFirst({
    where: { id: eventId, organization_id: orgId, deleted_at: null },
    select: { id: true },
  });
  return event;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { session, error } = await guardApi('safety.view');
  if (error) return error;
  const { orgId } = orgScope(session!);

  const { eventId } = await params;
  const event = await ensureEventAccess(eventId, orgId);
  if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

  const incidents = await prisma.safetyIncident.findMany({
    where: { event_id: eventId },
    include: {
      SafetyPhoto: { select: { id: true, public_url: true } },
    },
    orderBy: { created_at: 'desc' },
  });
  return NextResponse.json(incidents);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { session, error } = await guardApi('safety.log');
  if (error) return error;
  const { orgId, userId } = orgScope(session!);
  const user = session!.user as { id?: string; name?: string; email?: string };

  const { eventId } = await params;
  const event = await ensureEventAccess(eventId, orgId);
  if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

  const body = await req.json().catch(() => ({}));

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let log = await prisma.safetyLog.findFirst({
    where: { event_id: eventId, log_date: today },
  });

  if (!log) {
    log = await prisma.safetyLog.create({
      data: {
        id: crypto.randomUUID(),
        event_id: eventId,
        log_date: today,
        submitted_by: userId ?? user.id ?? null,
        submitted_by_name: user.name ?? user.email ?? null,
        updated_at: new Date(),
      },
    });
  }

  const incident = await prisma.safetyIncident.create({
    data: {
      id: crypto.randomUUID(),
      safety_id: body.safety_id ?? null,
      safety_log_id: log.id,
      event_id: eventId,
      incident_date: body.incident_date ? new Date(body.incident_date) : new Date(),
      incident_time: body.incident_time ?? null,
      incident_type: body.incident_type ?? 'Near Miss',
      severity: body.severity ?? 'Low',
      title: body.title ?? '',
      description: body.description ?? '',
      location: body.location ?? null,
      unit_area: body.unit_area ?? null,
      contractor: body.contractor ?? null,
      persons_involved: body.persons_involved ?? null,
      immediate_action: body.immediate_action ?? null,
      root_cause: body.root_cause ?? null,
      root_cause_category: body.root_cause_category ?? null,
      contributing_factors: body.contributing_factors ?? null,
      corrective_actions: body.corrective_actions ?? null,
      preventive_actions: body.preventive_actions ?? null,
      lesson_learned: body.lesson_learned ?? null,
      action_owner: body.action_owner ?? null,
      action_due_date: body.action_due_date ? new Date(body.action_due_date) : null,
      status: 'Open',
      reported_by: user.name ?? user.email ?? null,
      updated_at: new Date(),
    },
  });

  return NextResponse.json(incident, { status: 201 });
}
