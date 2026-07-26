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

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string; incidentId: string }> }
) {
  const { session, error } = await guardApi('safety.log');
  if (error) return error;
  const { orgId } = orgScope(session!);

  const { eventId, incidentId } = await params;
  const event = await ensureEventAccess(eventId, orgId);
  if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

  const existing = await prisma.safetyIncident.findFirst({
    where: { id: incidentId, eventId },
    select: { id: true },
  });
  if (!existing) return NextResponse.json({ error: 'Incident not found' }, { status: 404 });

  const body = await req.json().catch(() => ({}));

  const incident = await prisma.safetyIncident.update({
    where: { id: incidentId },
    data: {
      safetyId: body.safety_id ?? undefined,
      incidentType: body.incident_type ?? undefined,
      severity: body.severity ?? undefined,
      title: body.title ?? undefined,
      description: body.description ?? undefined,
      rootCause: body.root_cause ?? undefined,
      lessonLearned: body.lesson_learned ?? undefined,
      location: body.location ?? undefined,
      unitArea: body.unit_area ?? undefined,
      contractor: body.contractor ?? undefined,
    },
  });
  return NextResponse.json(incident);
}
