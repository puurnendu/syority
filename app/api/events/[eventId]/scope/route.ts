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

    const { unit_ids = [], system_ids = [] } = await req.json();

    // Verify event exists and belongs to org
    const event = await prisma.event.findFirst({
      where: { id: eventId, organization_id: orgId },
    });
    if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

    // Use a transaction to replace the scope
    await prisma.$transaction(async (tx) => {
      // 1. Delete existing
      await tx.eventUnit.deleteMany({ where: { event_id: eventId } });
      await tx.eventSystem.deleteMany({ where: { event_id: eventId } });

      // 2. Insert new units
      if (unit_ids.length > 0) {
        await tx.eventUnit.createMany({
          data: unit_ids.map((id: string) => ({ event_id: eventId, unit_id: id })),
          skipDuplicates: true,
        });
      }

      // 3. Insert new systems
      if (system_ids.length > 0) {
        await tx.eventSystem.createMany({
          data: system_ids.map((id: string) => ({ event_id: eventId, system_id: id })),
          skipDuplicates: true,
        });
      }
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error syncing event scope:', error);
    return NextResponse.json({ error: error.message || 'Failed to sync scope' }, { status: 500 });
  }
}
