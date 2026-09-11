import { NextRequest, NextResponse } from 'next/server';
import { guardApi } from '@/lib/apiGuard';
import { withTenantGuard } from '@/lib/withTenantGuard';
import { calculateLiveEvm } from '@/core/evm/EvmSnapshotService';

/**
 * GET /api/events/[eventId]/schedule/evm/summary
 *
 * Returns the current live EVM summary KPIs for the event.
 * Uses the current active baseline (is_current=true).
 *
 * Query params:
 *   dataDate — optional ISO date string for the data date (defaults to today)
 *
 * Security: withTenantGuard + guardApi('nav.schedule') (UD-2 Decision A)
 * AC Source: Activity.actual_cost (UD-3 Decision A)
 */
export const GET = withTenantGuard(async (req: NextRequest, { params }, session) => {
  const { error } = await guardApi('nav.schedule');
  if (error) return error;

  const { eventId } = await params;
  const orgId = session.user.organization_id;

  try {
    const url = new URL(req.url);
    const dateDateStr = url.searchParams.get('dataDate');
    const dataDate = dateDateStr ? new Date(dateDateStr) : undefined;

    const summary = await calculateLiveEvm(eventId, orgId, dataDate);

    if (!summary) {
      return NextResponse.json(
        { error: 'No active baseline found. Create and activate a baseline first.' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: summary });
  } catch (err: any) {
    console.error('[GET /schedule/evm/summary] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
});
