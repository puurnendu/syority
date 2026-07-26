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

    const event = await prisma.event.findFirst({
      where: { id: eventId, organization_id: orgId },
      include: {
        Workpack: { select: { status: true } }
      }
    });
    if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

    // Optional: Validate that all workpacks are closed
    const openWp = event.Workpack.filter(w => w.status.toLowerCase() !== 'closed' && w.status.toLowerCase() !== 'cancelled');
    if (openWp.length > 0) {
      return NextResponse.json({ 
        error: `Cannot close event: ${openWp.length} workpacks are still open.` 
      }, { status: 400 });
    }

    const updatedEvent = await prisma.event.update({
      where: { id: eventId },
      data: {
        status: 'closed',
        actual_end: new Date(),
      }
    });

    return NextResponse.json(updatedEvent);
  } catch (error: any) {
    console.error('Error closing event:', error);
    return NextResponse.json({ error: error.message || 'Failed to close event' }, { status: 500 });
  }
}
