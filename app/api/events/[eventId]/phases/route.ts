import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function POST(req: NextRequest, { params }: { params: Promise<{ eventId: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const orgId = (session.user as any).organization_id;
    const { eventId } = await params;

    const { name, planned_start, planned_end } = await req.json();

    const event = await prisma.event.findFirst({
      where: { id: eventId, organization_id: orgId },
    });
    if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

    if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 });

    const phase = await prisma.eventPhase.create({
      data: {
        organization_id: orgId,
        event_id: eventId,
        name,
        planned_start: planned_start ? new Date(planned_start) : null,
        planned_end: planned_end ? new Date(planned_end) : null,
      }
    });

    return NextResponse.json(phase, { status: 201 });
  } catch (error: any) {
    console.error('Error creating event phase:', error);
    return NextResponse.json({ error: error.message || 'Failed to create event phase' }, { status: 500 });
  }
}
