import { NextRequest, NextResponse } from 'next/server';
import { guardApi } from '@/lib/apiGuard';
import { withTenantGuard } from '@/lib/withTenantGuard';
import { buildWbsDrillDown } from '@/core/evm/EvmSnapshotService';

/**
 * GET /api/events/[eventId]/schedule/evm/drill-down
 *
 * Returns a WBS drill-down tree with EVM metrics at each level
 * (event → workpack → activity).
 *
 * Query params:
 *   dataDate — optional ISO date for the data date
 *
 * Security: withTenantGuard + guardApi('nav.schedule') (UD-2 Decision A)
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

    const tree = await buildWbsDrillDown(eventId, orgId, dataDate);

    if (!tree) {
      return NextResponse.json(
        { error: 'No active baseline or activities found.' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: tree });
  } catch (err: any) {
    console.error('[GET /schedule/evm/drill-down] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
});
