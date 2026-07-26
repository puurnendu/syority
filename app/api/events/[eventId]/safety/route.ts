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

  const url = new URL(req.url);
  const latest = url.searchParams.get('latest') === 'true';
  const dateParam = url.searchParams.get('date');

  if (latest || dateParam) {
    const log = await prisma.safetyLog.findFirst({
      where: {
        eventId,
        ...(dateParam ? { logDate: new Date(dateParam) } : {}),
      },
      orderBy: { logDate: 'desc' },
      include: {
        incidents: {
          include: {
            photos: { select: { id: true, publicUrl: true, photoType: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
        photos: {
          select: { id: true, publicUrl: true, photoType: true },
          orderBy: { takenAt: 'desc' },
        },
      },
    });
    return NextResponse.json({ log });
  }

  const logs = await prisma.safetyLog.findMany({
    where: { eventId },
    orderBy: { logDate: 'desc' },
    include: {
      incidents: { select: { id: true, incidentType: true, severity: true, status: true } },
      photos: { select: { id: true, photoType: true, publicUrl: true } },
    },
  });

  const totalManhours = logs.reduce((s, l) => s + Number(l.manhoursWorked ?? 0), 0);
  const totalLTI = logs.reduce((s, l) => s + (l.lti ?? 0), 0);
  const ltiRate = totalManhours > 0 ? (totalLTI * 1_000_000) / totalManhours : 0;

  return NextResponse.json({ logs, stats: { totalManhours, totalLTI, ltiRate } });
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
  const logDate = body.log_date ? new Date(body.log_date) : new Date();
  logDate.setHours(0, 0, 0, 0);

  const prevLogs = await prisma.safetyLog.findMany({
    where: { eventId, logDate: { lt: logDate } },
    orderBy: { logDate: 'asc' },
  });
  const prevManhours = prevLogs.reduce((s, l) => s + Number(l.manhoursWorked ?? 0), 0);
  const prevLTI = prevLogs.reduce((s, l) => s + (l.lti ?? 0), 0);
  const cumManhours = prevManhours + Number(body.manhours_worked ?? 0);
  const cumLTI = prevLTI + Number(body.lti ?? 0);
  const ltiRate = cumManhours > 0 ? (cumLTI * 1_000_000) / cumManhours : 0;

  const data = {
    manpowerPlanned: body.manpower_planned ?? 0,
    manpowerActual: body.manpower_actual ?? 0,
    lti: body.lti ?? 0,
    ltiDaysLost: body.lti_days_lost ?? 0,
    nearMiss: body.near_miss ?? 0,
    firstAid: body.first_aid ?? 0,
    medicalTreatment: body.medical_treatment ?? 0,
    dangerousOccurrence: body.dangerous_occurrence ?? 0,
    ptwIssued: body.ptw_issued ?? 0,
    ptwClosed: body.ptw_closed ?? 0,
    ptwSuspended: body.ptw_suspended ?? 0,
    toolboxTalks: body.toolbox_talks ?? 0,
    manhoursWorked: body.manhours_worked ?? 0,
    manhoursPlanned: body.manhours_planned ?? 0,
    cumulativeManhours: cumManhours,
    cumulativeLti: cumLTI,
    ltiFrequencyRate: ltiRate,
    safetyNotes: body.safety_notes ?? null,
  };

  const log = await prisma.safetyLog.upsert({
    where: {
      eventId_logDate: { eventId, logDate },
    },
    create: {
      eventId,
      logDate,
      ...data,
      submittedBy: userId ?? user.id ?? null,
      submittedByName: user.name ?? user.email ?? null,
    },
    update: {
      ...data,
      lastUpdatedBy: userId ?? user.id ?? null,
      lastUpdatedByName: user.name ?? user.email ?? null,
    },
  });

  return NextResponse.json({ log });
}
