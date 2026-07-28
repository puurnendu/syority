import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { EventPlanningService } from '@/core/planning/EventPlanningService';

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

    if (!name || !code || !site_id) {
      return NextResponse.json({ error: 'Name, code, and site_id are required' }, { status: 400 });
    }

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
      calendar_id: body.calendar_id,
      discipline_id: body.discipline_id,
      parent_event_id: body.parent_event_id,
    });

    return NextResponse.json(event, { status: 201 });
  } catch (error: any) {
    console.error('Error creating event:', error);
    return NextResponse.json({ error: error.message || 'Failed to create event' }, { status: 500 });
  }
}
