import { NextRequest, NextResponse } from 'next/server';
import { guardApi } from '@/lib/apiGuard';
import { withTenantGuard } from '@/lib/withTenantGuard';
import { ScheduleVarianceService } from '@/core/resources/ScheduleVarianceService';

/**
 * GET /api/events/[eventId]/schedule/variance
 * Calculate variance between current schedule and baseline.
 *
 * Query params:
 *  - baselineId (optional): specific baseline to compare against
 */
export const GET = withTenantGuard(async (req: NextRequest, { params }, session) => {
  const { error } = await guardApi('nav.schedule');
  if (error) return error;

  const { eventId } = await params;
  const orgId = session.user.organization_id;
  const url = new URL(req.url);
  const baselineId = url.searchParams.get('baselineId') || undefined;

  try {
    const result = await ScheduleVarianceService.calculateVariance(eventId, orgId, baselineId);
    if (!result) {
      return NextResponse.json({ data: null, message: 'No baseline assigned' });
    }
    return NextResponse.json({ data: result });
  } catch (err: any) {
    console.error('[GET /schedule/variance] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
});
