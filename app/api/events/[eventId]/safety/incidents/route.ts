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
    where: { eventId },
    include: {
      photos: { select: { id: true, publicUrl: true } },
    },
    orderBy: { createdAt: 'desc' },
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
    where: { eventId, logDate: today },
  });

  if (!log) {
    log = await prisma.safetyLog.create({
      data: {
        eventId,
        logDate: today,
        submittedBy: userId ?? user.id ?? null,
        submittedByName: user.name ?? user.email ?? null,
      },
    });
  }

  const incident = await prisma.safetyIncident.create({
    data: {
      safetyId: body.safety_id ?? null,
      safetyLogId: log.id,
      eventId,
      incidentDate: body.incident_date ? new Date(body.incident_date) : new Date(),
      incidentTime: body.incident_time ?? null,
      incidentType: body.incident_type ?? 'Near Miss',
      severity: body.severity ?? 'Low',
      title: body.title ?? '',
      description: body.description ?? '',
      location: body.location ?? null,
      unitArea: body.unit_area ?? null,
      contractor: body.contractor ?? null,
      personsInvolved: body.persons_involved ?? null,
      immediateAction: body.immediate_action ?? null,
      rootCause: body.root_cause ?? null,
      rootCauseCategory: body.root_cause_category ?? null,
      contributingFactors: body.contributing_factors ?? null,
      correctiveActions: body.corrective_actions ?? null,
      preventiveActions: body.preventive_actions ?? null,
      lessonLearned: body.lesson_learned ?? null,
      actionOwner: body.action_owner ?? null,
      actionDueDate: body.action_due_date ? new Date(body.action_due_date) : null,
      status: 'Open',
      reportedBy: user.name ?? user.email ?? null,
    },
  });

  return NextResponse.json(incident, { status: 201 });
}
