import { NextRequest, NextResponse } from 'next/server';
import { guardApi } from '@/lib/apiGuard';
import { withTenantGuard } from '@/lib/withTenantGuard';
import { ScheduleForecastService } from '@/core/resources/ScheduleForecastService';

/**
 * GET /api/events/[eventId]/schedule/forecast
 * Compute forecast finish dates for all activities in this event.
 *
 * Query params:
 *  - hoursPerDay (optional, default: 8)
 */
export const GET = withTenantGuard(async (req: NextRequest, { params }, session) => {
  const { error } = await guardApi('nav.schedule');
  if (error) return error;

  const { eventId } = await params;
  const orgId = session.user.organization_id;
  const url = new URL(req.url);
  const hoursPerDay = parseInt(url.searchParams.get('hoursPerDay') || '8', 10) || 8;

  try {
    const result = await ScheduleForecastService.computeForecast(eventId, orgId, hoursPerDay);
    return NextResponse.json({ data: result });
  } catch (err: any) {
    console.error('[GET /schedule/forecast] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
});
