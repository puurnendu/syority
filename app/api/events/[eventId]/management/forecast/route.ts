/**
 * GET /api/events/[eventId]/management/forecast
 * Explicit forecast types. Query: forecastType, scenarioId.
 */
import { NextRequest, NextResponse } from 'next/server';
import { guardApi } from '@/lib/apiGuard';
import { withTenantGuard } from '@/lib/withTenantGuard';
import { DecisionIntelligenceService } from '@/core/m15/DecisionIntelligenceService';
import { DecisionContextError } from '@/core/m15/types';
import type { ForecastType } from '@/core/m15/types';

const FORECAST_TYPES = new Set<ForecastType>([
  'EXECUTION_FINISH_FORECAST',
  'SCHEDULE_SCENARIO_FINISH',
  'EAC_COST_FORECAST',
]);

export const GET = withTenantGuard(async (req: NextRequest, { params }, session) => {
  const { error } = await guardApi('nav.schedule');
  if (error) return error;

  const { eventId } = await params;
  const orgId = session.user.organization_id;
  const url = new URL(req.url);
  const forecastTypeRaw = url.searchParams.get('forecastType');
  const scenarioId = url.searchParams.get('scenarioId') || undefined;

  if (forecastTypeRaw && !FORECAST_TYPES.has(forecastTypeRaw as ForecastType)) {
    return NextResponse.json({ error: 'Unknown forecastType' }, { status: 400 });
  }

  try {
    const data = await DecisionIntelligenceService.getForecast(orgId, eventId, {
      forecastType: forecastTypeRaw as ForecastType | undefined,
      scenarioId,
    });
    return NextResponse.json({ data });
  } catch (err: any) {
    if (err instanceof DecisionContextError) {
      const status = err.code === 'EVENT_REQUIRED' ? 400 : 404;
      return NextResponse.json({ error: err.message }, { status });
    }
    console.error('[GET management/forecast]', err);
    return NextResponse.json({ error: 'Failed to load forecast' }, { status: 500 });
  }
});
