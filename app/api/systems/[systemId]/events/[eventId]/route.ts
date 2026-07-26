import { NextRequest, NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { prisma } from '@/lib/prisma';

/** DELETE: unlink this system from an event */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ systemId: string; eventId: string }> }
) {
  const { session, error } = await guardApi('system:edit');
  if (error) return error;
  const { orgId } = orgScope(session!);
  const { systemId, eventId } = await params;

  const system = await prisma.system.findFirst({
    where: { id: systemId, organization_id: orgId, deleted_at: null },
    select: { id: true },
  });
  if (!system) return NextResponse.json({ error: 'System not found' }, { status: 404 });

  await prisma.eventSystem.deleteMany({
    where: { event_id: eventId, system_id: systemId },
  });
  return NextResponse.json({ ok: true });
}
