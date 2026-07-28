import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { EventPlanningService } from '@/core/planning/EventPlanningService';
import { prisma } from '@/lib/prisma';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ eventId: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const orgId = (session.user as any).organization_id;
    const { eventId } = await params;

    const body = await req.json();
    const event = await EventPlanningService.update(eventId, orgId, {
      name: body.name,
      code: body.code,
      event_type: body.event_type,
      planned_start: body.planned_start,
      planned_end: body.planned_end,
      status: body.status,
      scope_notes: body.scope_notes,
      description: body.description,
      calendar_id: body.calendar_id || null,
      discipline_id: body.discipline_id || null,
      parent_event_id: body.parent_event_id || null,
      budget_manhours: body.budget_manhours,
      budget_cost: body.budget_cost,
    });

    return NextResponse.json(event);
  } catch (error: any) {
    console.error('Error updating event:', error);
    return NextResponse.json({ error: error.message || 'Failed to update event' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ eventId: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const orgId = (session.user as any).organization_id;
    const { eventId } = await params;

    await prisma.event.update({
      where: { id: eventId, organization_id: orgId },
      data: { deleted_at: new Date() },
    });

    return new NextResponse(null, { status: 204 });
  } catch (error: any) {
    console.error('Error deleting event:', error);
    return NextResponse.json({ error: error.message || 'Failed to delete event' }, { status: 500 });
  }
}
