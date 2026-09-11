import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { EventPlanningService } from '@/core/planning/EventPlanningService';
import { isUuid, normalizeUuid } from '@/lib/uuid';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const orgId = (session.user as any).organization_id;
  if (!orgId) return NextResponse.json({ error: 'No organization' }, { status: 403 });

  const events = await EventPlanningService.list(orgId);
  return NextResponse.json({ items: events });
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const orgId = (session.user as any).organization_id;
    const userId = (session.user as any).id;

    const body = await req.json();
    const { name, code, site_id } = body;

    // [TRACE-1] Browser Request Payload
    console.log('[TRACE-1][API /api/events POST] body.site =', body.site, '| body.site_id =', body.site_id, '| isUuid(site_id):', isUuid(String(site_id ?? '')));

    if (!name || !code || !site_id) {
      return NextResponse.json({ error: 'Name, code, and site_id are required' }, { status: 400 });
    }

    // Normalize optional foreign key strings (empty string -> null)
    const calendarId = normalizeUuid(body.calendar_id);
    const disciplineId = normalizeUuid(body.discipline_id);
    const parentEventId = normalizeUuid(body.parent_event_id);

    // [TRACE-2] API Route — after destructure, before service call
    console.log('[TRACE-2][API route] name:', name, '| code:', code, '| site_id (passed to service):', site_id);

    const event = await EventPlanningService.create(orgId, userId, {
      name,
      code,
      site_id,
      event_type: body.event_type,
      planned_start: body.planned_start,
      planned_end: body.planned_end,
      status: body.status,
      scope_notes: body.scope_notes,
      description: body.description,
      budget_manhours: body.budget_manhours ? parseInt(body.budget_manhours, 10) : undefined,
      budget_cost: body.budget_cost ? parseFloat(body.budget_cost) : undefined,
      calendar_id: calendarId,
      discipline_id: disciplineId,
      parent_event_id: parentEventId,
    });

    return NextResponse.json(event, { status: 201 });
  } catch (error: any) {
    console.error('Error creating event:', error);
    return NextResponse.json({ error: error.message || 'Failed to create event' }, { status: 500 });
  }
}
