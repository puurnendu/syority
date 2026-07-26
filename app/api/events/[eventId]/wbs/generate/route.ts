import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { WbsNodeType } from '@prisma/client';

export async function POST(req: NextRequest, { params }: { params: Promise<{ eventId: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const orgId = (session.user as any).organization_id;
    const { eventId } = await params;

    const event = await prisma.event.findFirst({
      where: { id: eventId, organization_id: orgId, deleted_at: null },
      include: {
        event_phases: true,
        eventUnits: { include: { unit: { include: { systems: true } } } }
      }
    });
    if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

    const existing = await prisma.wbsNode.findFirst({
      where: { event_id: eventId, organization_id: orgId },
    });
    if (existing) return NextResponse.json({ error: 'WBS already exists for this event. Clear it first or use the WBS editor.' }, { status: 409 });

    let order = 0;

    // 1. Event Node
    const eventNode = await prisma.wbsNode.create({
      data: {
        organization_id: orgId,
        event_id: eventId,
        parent_id: null,
        code: event.code,
        name: event.name,
        type: WbsNodeType.EVENT,
        order: order++,
        linked_entity_id: event.id,
        linked_entity_type: 'event',
      }
    });

    // 2. Phases
    const phases = event.event_phases.length > 0 ? event.event_phases : [
      { id: 'pre', name: 'Pre-TA' },
      { id: 'exe', name: 'Execution' },
      { id: 'post', name: 'Post-TA' }
    ];

    for (const phase of phases) {
      const phaseNode = await prisma.wbsNode.create({
        data: {
          organization_id: orgId,
          event_id: eventId,
          parent_id: eventNode.id,
          code: `${event.code}.${phase.name.substring(0, 3).toUpperCase()}`,
          name: phase.name,
          type: WbsNodeType.CUSTOM,
          order: order++,
        }
      });

      // 3. Units inside Phases (Simplified: linking all scope units to the Execution phase, or just all phases if no custom logic)
      for (const eu of event.eventUnits) {
        const unit = eu.unit;
        const unitNode = await prisma.wbsNode.create({
          data: {
            organization_id: orgId,
            event_id: eventId,
            parent_id: phaseNode.id,
            code: `${event.code}.${phase.name.substring(0, 3).toUpperCase()}.${unit.code || 'U'}`,
            name: unit.name,
            type: WbsNodeType.UNIT,
            order: order++,
            linked_entity_id: unit.id,
            linked_entity_type: 'unit',
          }
        });

        // 4. Systems inside Units
        for (const sys of unit.systems) {
          await prisma.wbsNode.create({
            data: {
              organization_id: orgId,
              event_id: eventId,
              system_id: sys.id,
              parent_id: unitNode.id,
              code: `${event.code}.${phase.name.substring(0, 3).toUpperCase()}.${unit.code || 'U'}.${sys.code || sys.id.substring(0,4)}`,
              name: sys.name,
              type: WbsNodeType.SYSTEM,
              order: order++,
              linked_entity_id: sys.id,
              linked_entity_type: 'system',
            }
          });
        }
      }
    }

    const nodes = await prisma.wbsNode.findMany({
      where: { event_id: eventId, organization_id: orgId },
      orderBy: [{ order: 'asc' }],
    });

    return NextResponse.json({ data: nodes }, { status: 201 });
  } catch (error: any) {
    console.error('Error generating event wbs:', error);
    return NextResponse.json({ error: error.message || 'Failed to generate wbs' }, { status: 500 });
  }
}
