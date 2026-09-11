import { NextRequest, NextResponse } from 'next/server';
import { guardApi } from '@/lib/apiGuard';
import { withTenantGuard } from '@/lib/withTenantGuard';
import { generateEventCurve } from '@/core/evm/EvmSnapshotService';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/events/[eventId]/schedule/evm/s-curve
 *
 * Returns time-phased S-curve data (PV, EV, AC arrays) for chart rendering.
 *
 * Query params:
 *   from — optional ISO date for curve start
 *   to — optional ISO date for curve end
 *
 * Security: withTenantGuard + guardApi('nav.schedule') (UD-2 Decision A)
 */
export const GET = withTenantGuard(async (req: NextRequest, { params }, session) => {
  const { error } = await guardApi('nav.schedule');
  if (error) return error;

  const { eventId } = await params;
  const orgId = session.user.organization_id;

  try {
    const event = await prisma.event.findFirst({
      where: { id: eventId, organization_id: orgId, deleted_at: null },
      select: { id: true },
    });
    if (!event) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const url = new URL(req.url);
    const fromStr = url.searchParams.get('from');
    const toStr = url.searchParams.get('to');
    const from = fromStr ? new Date(fromStr) : undefined;
    const to = toStr ? new Date(toStr) : undefined;

    const curve = await generateEventCurve(eventId, orgId, from, to);

    if (!curve) {
      return NextResponse.json({
        success: true,
        data: null,
        message: 'No schedule/progress data available',
      });
    }

    return NextResponse.json({ success: true, data: curve });
  } catch (err: any) {
    console.error('[GET /schedule/evm/s-curve] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
});
