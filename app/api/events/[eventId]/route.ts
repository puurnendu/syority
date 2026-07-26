import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ eventId: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const orgId = (session.user as any).organization_id;
    const { eventId } = await params;

    const body = await req.json();
    const { name, code, event_type, planned_start, planned_end, budget_manhours, budget_cost, scope_notes } = body;

    const event = await prisma.event.update({
      where: { id: eventId, organization_id: orgId },
      data: {
        name,
        code,
        event_type,
        planned_start: planned_start ? new Date(planned_start) : null,
        planned_end: planned_end ? new Date(planned_end) : null,
        budget_manhours: budget_manhours ? parseInt(budget_manhours, 10) : null,
        budget_cost: budget_cost ? parseFloat(budget_cost) : null,
        scope_notes,
      },
    });

    return NextResponse.json(event);
  } catch (error: any) {
    console.error('Error updating event:', error);
    return NextResponse.json({ error: error.message || 'Failed to update event' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ eventId: string }> }) {
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
