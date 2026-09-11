import { NextRequest, NextResponse } from 'next/server';
import { guardApi } from '@/lib/apiGuard';
import { withTenantGuard } from '@/lib/withTenantGuard';

/**
 * R0.4-E — the Project S-curve / EVM engine is RETIRED.
 *
 * M8.10 is the sole earned-value and S-curve authority. This route previously
 * computed a second, independent earned-value engine from raw Prisma, scoped by
 * the deprecated Project campaign key and windowed by the Project planned
 * shutdown/startup dates. That made a Project identifier an STO
 * performance-measurement authority, and it surfaced a Project-level campaign
 * date error to operators.
 *
 * It now fails closed. No earned-value arithmetic happens here.
 *
 * Canonical Event-authoritative endpoints:
 *   GET /api/events/{eventId}/schedule/evm/s-curve
 *   GET /api/events/{eventId}/schedule/evm/summary
 *
 * The empty arrays are retained so legacy Project display surfaces render their
 * documented empty state instead of an error banner.
 */
export const GET = withTenantGuard(async (req: NextRequest, { params }, session) => {
  const { error } = await guardApi('workpacks.view');
  if (error) return error;
  void params;
  void session;

  return NextResponse.json({
    sCurve: [],
    series: [],
    evm: null,
    message: 'STO S-curve is Event-authoritative. Use /api/events/{eventId}/schedule/evm/s-curve.',
    code: 'PROJECT_S_CURVE_RETIRED',
  });
});
