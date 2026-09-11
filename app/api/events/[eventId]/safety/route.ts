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
        event_id: eventId,
        ...(dateParam ? { log_date: new Date(dateParam) } : {}),
      },
      orderBy: { log_date: 'desc' },
      include: {
        SafetyIncident: {
          include: {
            SafetyPhoto: { select: { id: true, public_url: true, photo_type: true } },
          },
          orderBy: { created_at: 'desc' },
        },
        SafetyPhoto: {
          select: { id: true, public_url: true, photo_type: true },
          orderBy: { taken_at: 'desc' },
        },
      },
    });
    return NextResponse.json({ log });
  }

  const logs = await prisma.safetyLog.findMany({
    where: { event_id: eventId },
    orderBy: { log_date: 'desc' },
    include: {
      SafetyIncident: { select: { id: true, incident_type: true, severity: true, status: true } },
      SafetyPhoto: { select: { id: true, photo_type: true, public_url: true } },
    },
  });

  const totalManhours = logs.reduce((s, l) => s + Number(l.manhours_worked ?? 0), 0);
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
    where: { event_id: eventId, log_date: { lt: logDate } },
    orderBy: { log_date: 'asc' },
  });
  const prevManhours = prevLogs.reduce((s, l) => s + Number(l.manhours_worked ?? 0), 0);
  const prevLTI = prevLogs.reduce((s, l) => s + (l.lti ?? 0), 0);
  const cumManhours = prevManhours + Number(body.manhours_worked ?? 0);
  const cumLTI = prevLTI + Number(body.lti ?? 0);
  const ltiRate = cumManhours > 0 ? (cumLTI * 1_000_000) / cumManhours : 0;

  const data = {
    manpower_planned: body.manpower_planned ?? 0,
    manpower_actual: body.manpower_actual ?? 0,
    lti: body.lti ?? 0,
    lti_days_lost: body.lti_days_lost ?? 0,
    near_miss: body.near_miss ?? 0,
    first_aid: body.first_aid ?? 0,
    medical_treatment: body.medical_treatment ?? 0,
    dangerous_occurrence: body.dangerous_occurrence ?? 0,
    ptw_issued: body.ptw_issued ?? 0,
    ptw_closed: body.ptw_closed ?? 0,
    ptw_suspended: body.ptw_suspended ?? 0,
    toolbox_talks: body.toolbox_talks ?? 0,
    manhours_worked: body.manhours_worked ?? 0,
    manhours_planned: body.manhours_planned ?? 0,
    cumulative_manhours: cumManhours,
    cumulative_lti: cumLTI,
    lti_frequency_rate: ltiRate,
    safety_notes: body.safety_notes ?? null,
  };

  const log = await prisma.safetyLog.upsert({
    where: {
      event_id_log_date: { event_id: eventId, log_date: logDate },
    },
    create: {
      id: crypto.randomUUID(),
      event_id: eventId,
      log_date: logDate,
      ...data,
      submitted_by: userId ?? user.id ?? null,
      submitted_by_name: user.name ?? user.email ?? null,
      updated_at: new Date(),
    },
    update: {
      ...data,
      last_updated_by: userId ?? user.id ?? null,
      last_updated_by_name: user.name ?? user.email ?? null,
      updated_at: new Date(),
    },
  });

  return NextResponse.json({ log });
}
