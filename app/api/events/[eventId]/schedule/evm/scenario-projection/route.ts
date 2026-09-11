import { NextRequest, NextResponse } from 'next/server';
import { guardApi } from '@/lib/apiGuard';
import { withTenantGuard } from '@/lib/withTenantGuard';
import { calculateScenarioEvmProjection } from '@/core/evm/EvmScenarioProjection';

/**
 * GET /api/events/[eventId]/schedule/evm/scenario-projection?scenarioId=xxx
 *
 * Returns read-only EVM projection comparing live vs scenario-modified schedule.
 * ZERO MUTATION of live data.
 *
 * Query params:
 *   scenarioId — required, the M8.9 scenario ID
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
    const scenarioId = url.searchParams.get('scenarioId');
    if (!scenarioId) {
      return NextResponse.json(
        { error: 'scenarioId query parameter is required.' },
        { status: 400 }
      );
    }

    const dateDateStr = url.searchParams.get('dataDate');
    const dataDate = dateDateStr ? new Date(dateDateStr) : undefined;

    const projection = await calculateScenarioEvmProjection(
      scenarioId, eventId, orgId, dataDate
    );

    if (!projection) {
      return NextResponse.json(
        { error: 'Scenario, baseline, or activities not found.' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: projection });
  } catch (err: any) {
    console.error('[GET /schedule/evm/scenario-projection] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
});
