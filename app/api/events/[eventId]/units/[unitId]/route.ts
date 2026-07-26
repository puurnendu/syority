import { NextRequest, NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { prisma } from '@/lib/prisma';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string; unitId: string }> }
) {
  const { session, error } = await guardApi('masterdata.edit');
  if (error) return error;
  const { orgId } = orgScope(session!);

  const { eventId, unitId } = await params;
  const event = await prisma.event.findFirst({
    where: { id: eventId, organization_id: orgId, deleted_at: null },
    select: { id: true },
  });
  if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

  const eventUnit = await prisma.eventUnit.findUnique({
    where: { event_id_unit_id: { event_id: eventId, unit_id: unitId } },
  });
  if (!eventUnit) return NextResponse.json({ error: 'Unit not in event' }, { status: 404 });

  await prisma.eventUnit.delete({
    where: { event_id_unit_id: { event_id: eventId, unit_id: unitId } },
  });
  return NextResponse.json({ ok: true });
}
