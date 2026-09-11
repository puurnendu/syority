/**
 * M10 — Planning Readiness API
 *
 * GET /api/planning/readiness?event_id=...&discipline_id=...&search=...
 *
 * Returns per-workpack planning readiness with KPIs.
 * Uses guardApi() + orgScope() for tenant isolation.
 *
 * Delegates entirely to PlanningReadinessService — zero duplicate calculation.
 */
import { NextRequest, NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { PlanningReadinessService } from '@/core/planning/PlanningReadinessService';
import type { PlanningReadinessFilters, PlanningReadinessState } from '@/core/planning/PlanningReadinessService';

export async function GET(req: NextRequest) {
  const { session, error } = await guardApi('workpacks.view');
  if (error) return error;
  const { orgId } = orgScope(session!);

  const url = new URL(req.url ?? '', 'http://localhost');

  const filters: PlanningReadinessFilters = {};
  const eventId = url.searchParams.get('event_id');
  const disciplineId = url.searchParams.get('discipline_id');
  const unitId = url.searchParams.get('unit_id');
  const systemId = url.searchParams.get('system_id');
  const status = url.searchParams.get('status');
  const readinessState = url.searchParams.get('readiness_state');
  const priority = url.searchParams.get('priority');
  const search = url.searchParams.get('search');

  if (eventId) filters.event_id = eventId;
  if (disciplineId) filters.discipline_id = disciplineId;
  if (unitId) filters.unit_id = unitId;
  if (systemId) filters.system_id = systemId;
  if (status) filters.status = status;
  if (readinessState) filters.readiness_state = readinessState as PlanningReadinessState;
  if (priority) filters.priority = priority;
  if (search) filters.search = search;

  try {
    const result = await PlanningReadinessService.getReadiness(orgId, filters);
    return NextResponse.json(result);
  } catch (err: any) {
    console.error('[GET /api/planning/readiness] Error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to fetch planning readiness' },
      { status: 500 }
    );
  }
}
