/**
 * M8.10 — EVM Scenario Projection Service
 *
 * Read-only, in-memory EVM projection for M8.9 scenarios.
 * ZERO MUTATION of live Activity, ProgressLog, ScheduleBaseline, or resource data.
 *
 * Architecture Lock: M8.10_ARCHITECTURE_LOCK.md §5
 * This service:
 *  1. Loads live activities + baseline
 *  2. Loads scenario overrides from ScenarioActivityOverride
 *  3. Merges overrides IN MEMORY (never writes back)
 *  4. Calculates projected EVM from the merged data
 *  5. Returns the comparison (live vs projected)
 *
 * AC Source: Activity.actual_cost (UD-3 Decision A) — scenario does not override AC
 */

import { prisma } from '../../lib/prisma';
import {
  calculateEventEvm,
  type EvmActivityInput,
} from './EvmCalculationService';
import {
  loadEvmActivities,
  getCurrentBaseline,
} from './EvmSnapshotService';
import type { ScenarioEvmProjection, EvmSummary } from './types';

interface ScenarioOverrideRow {
  activity_id: string;
  duration_hours: number | null;
  planned_start: Date | null;
  planned_end: Date | null;
}

/**
 * Calculate scenario EVM projection — read-only, zero mutation.
 *
 * @param scenarioId - The M8.9 scenario ID
 * @param eventId - The event ID
 * @param organizationId - Tenant organization ID
 * @param dataDate - Optional data date
 * @returns Live vs projected comparison, or null if scenario/baseline not found
 */
export async function calculateScenarioEvmProjection(
  scenarioId: string,
  eventId: string,
  organizationId: string,
  dataDate?: Date
): Promise<ScenarioEvmProjection | null> {
  // 1. Load baseline
  const baseline = await getCurrentBaseline(eventId, organizationId);
  if (!baseline) return null;

  // 2. Get scenario metadata
  const scenarios = await prisma.$queryRawUnsafe<Array<{ id: string; name: string }>>(
    `SELECT id, name FROM "schedule_scenarios" WHERE id = $1 AND organization_id = $2 AND event_id = $3`,
    scenarioId, organizationId, eventId
  );
  if (scenarios.length === 0) return null;
  const scenarioName = scenarios[0].name;

  // 3. Load live activities (same as live EVM)
  const liveActivities = await loadEvmActivities(eventId, organizationId, baseline.id);
  if (liveActivities.length === 0) return null;

  const dd = dataDate ?? new Date();

  // 4. Calculate LIVE EVM (unchanged)
  const liveEvm = calculateEventEvm(liveActivities, eventId, baseline.id, dd);

  // 5. Load scenario overrides
  const overrides = await prisma.$queryRawUnsafe<ScenarioOverrideRow[]>(
    `SELECT activity_id, duration_hours, planned_start, planned_end
     FROM "ScenarioActivityOverride"
     WHERE scenario_id = $1 AND is_active = true`,
    scenarioId
  );

  // 6. Merge overrides IN MEMORY — create a cloned activity set
  const overrideMap = new Map<string, ScenarioOverrideRow>();
  for (const o of overrides) {
    overrideMap.set(o.activity_id, o);
  }

  const projectedActivities: EvmActivityInput[] = liveActivities.map((a) => {
    const override = overrideMap.get(a.activityId);
    if (!override) return a; // No override — use live data as-is

    // Clone and apply override — NEVER modifies the original
    return {
      ...a,
      durationHours: override.duration_hours !== null
        ? Number(override.duration_hours)
        : a.durationHours,
      plannedEnd: override.planned_end ?? a.plannedEnd,
      // Note: scenario does NOT override actual_cost (UD-3 Decision A)
      // Note: scenario does NOT override baselineBudgetedCost (baseline is immutable)
    };
  });

  // 7. Calculate PROJECTED EVM (from merged data)
  const projectedEvm = calculateEventEvm(projectedActivities, eventId, baseline.id, dd);

  // 8. Calculate deltas
  const delta = {
    bacDelta: projectedEvm.bac - liveEvm.bac,
    eacDelta: safeDelta(projectedEvm.eac, liveEvm.eac),
    cpiDelta: safeDelta(projectedEvm.cpi, liveEvm.cpi),
    spiDelta: safeDelta(projectedEvm.spi, liveEvm.spi),
    projectFinishDelta: null as number | null, // Future: compare projected finish dates
  };

  return {
    scenarioId,
    scenarioName,
    liveEvm,
    projectedEvm,
    delta,
  };
}

function safeDelta(a: number | null, b: number | null): number | null {
  if (a === null || b === null) return null;
  return a - b;
}
