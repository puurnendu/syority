/**
 * M8.13 Phase 1 — Progress Calculation Service
 *
 * PURE, DETERMINISTIC calculation engine.
 *
 * ┌─────────────────────────────────────────────────────────────────┐
 * │  NO database I/O.  NO HTTP.  NO Prisma.  NO side effects.     │
 * │  Input → Output only. Independently unit-testable.             │
 * └─────────────────────────────────────────────────────────────────┘
 *
 * This service replaces the calculation logic that was previously embedded
 * in FieldExecutionService.calculateWeightedProgress() and produces
 * identical results for equivalent input data.
 *
 * EXECUTION PROGRESS ONLY:
 * - NOT planning readiness (planningProgress.ts)
 * - NOT EVM SPI/CPI (EvmCalculationService)
 * - NOT schedule health (ScheduleHealthService)
 *
 * Inclusion Rules:
 *   INCLUDE: Activities where status != 'cancelled' (caller must pre-filter deleted_at)
 *   EXCLUDE: Activities with status = 'cancelled'
 *
 * Weighting Rules:
 *   PRIMARY:  Σ(duration_hours × progress_percent) / Σ(duration_hours)
 *   FALLBACK: Σ(progress_percent) / COUNT(activities)  [when all durations = 0/null]
 *   EMPTY:    0  [when no valid activities exist]
 *
 * Rounding:
 *   Math.round() — nearest integer for progress percentage
 *   2 decimal places for duration hours
 */

import type { ProgressActivityInput, ProgressMetrics, DimensionProgress, IdenticalActivityGroup } from './types';

// ─── Activity Filtering ─────────────────────────────────────────────────────

/**
 * Determines if an activity should be included in progress calculations.
 *
 * INCLUDED: All non-cancelled activities
 * EXCLUDED: Activities with status = 'cancelled'
 *
 * Note: The caller (ProgressAggregationService) is responsible for filtering
 * deleted_at IS NULL before passing data to this service.
 */
export function isActivityIncluded(activity: ProgressActivityInput): boolean {
  return activity.status !== 'cancelled';
}

/**
 * Filter activities to only those included in progress calculations.
 */
export function filterIncludedActivities(
  activities: ProgressActivityInput[]
): ProgressActivityInput[] {
  return activities.filter(isActivityIncluded);
}

// ─── Core Progress Calculation ───────────────────────────────────────────────

/**
 * Normalizes a duration value to a non-negative number.
 * null, undefined, NaN → 0. Negative → 0.
 */
function normalizeDuration(value: number | null | undefined): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * Normalizes a progress value to a number in [0, 100].
 * null, undefined, NaN → 0. Clamped to [0, 100].
 */
function normalizeProgress(value: number | null | undefined): number {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, n));
}

/**
 * Calculate authoritative execution progress metrics from activity data.
 *
 * This is the SINGLE authoritative progress calculation.
 *
 * Algorithm (matches FieldExecutionService.calculateWeightedProgress):
 *   1. Filter out cancelled activities
 *   2. For each included activity:
 *      - dur = Number(duration_hours ?? 0)
 *      - prog = Number(progress_percent ?? 0)
 *      - simpleSum += prog
 *      - if dur > 0: totalWeighted += prog * dur, totalDuration += dur
 *   3. If totalDuration > 0: weightedProgress = round(totalWeighted / totalDuration)
 *      Else: weightedProgress = round(simpleSum / count)
 *   4. If count == 0: weightedProgress = 0
 *
 * @param activities - Activity data (may include cancelled — they will be filtered)
 * @returns ProgressMetrics with weighted progress and breakdown
 */
export function calculateProgressMetrics(
  activities: ProgressActivityInput[]
): ProgressMetrics {
  const included = filterIncludedActivities(activities);

  if (included.length === 0) {
    return {
      weightedProgress: 0,
      totalActivities: 0,
      completedActivities: 0,
      inProgressActivities: 0,
      notStartedActivities: 0,
      totalDurationHours: 0,
      completedDurationHours: 0,
      balanceDurationHours: 0,
    };
  }

  let totalWeighted = 0;
  let totalDuration = 0;
  let simpleSum = 0;

  let completedCount = 0;
  let inProgressCount = 0;
  let notStartedCount = 0;
  let totalCompletedDuration = 0;

  for (const act of included) {
    const dur = normalizeDuration(act.durationHours);
    const prog = normalizeProgress(act.progressPercent);
    const status = act.status ?? 'not_started';

    simpleSum += prog;

    if (dur > 0) {
      totalWeighted += prog * dur;
      totalDuration += dur;
      totalCompletedDuration += (prog / 100) * dur;
    }

    // Classify activity
    if (status === 'completed' || prog >= 100) {
      completedCount++;
    } else if (prog > 0) {
      inProgressCount++;
    } else {
      notStartedCount++;
    }
  }

  // Weighted progress (matches FieldExecutionService exactly)
  let weightedProgress: number;
  if (totalDuration > 0) {
    weightedProgress = Math.round(totalWeighted / totalDuration);
  } else {
    weightedProgress = Math.round(simpleSum / included.length);
  }

  // Clamp to [0, 100]
  weightedProgress = Math.min(100, Math.max(0, weightedProgress));

  // Round duration values to 2 decimal places
  const roundedTotalDuration = Math.round(totalDuration * 100) / 100;
  const roundedCompletedDuration = Math.round(totalCompletedDuration * 100) / 100;
  const roundedBalanceDuration = Math.round((totalDuration - totalCompletedDuration) * 100) / 100;

  return {
    weightedProgress,
    totalActivities: included.length,
    completedActivities: completedCount,
    inProgressActivities: inProgressCount,
    notStartedActivities: notStartedCount,
    totalDurationHours: roundedTotalDuration,
    completedDurationHours: roundedCompletedDuration,
    balanceDurationHours: roundedBalanceDuration,
  };
}

// ─── Dimensional Aggregation ─────────────────────────────────────────────────

/**
 * Groups activities by a dimension key and calculates progress metrics per group.
 *
 * @param activities - Activity data (pre-filtered or will be filtered)
 * @param keyFn - Function to extract the group key from an activity
 * @param labelFn - Function to extract the display label from an activity
 * @returns Array of DimensionProgress sorted by label
 */
export function calculateDimensionProgress(
  activities: ProgressActivityInput[],
  keyFn: (act: ProgressActivityInput) => string | null,
  labelFn: (act: ProgressActivityInput) => string
): DimensionProgress[] {
  const groups = new Map<string, ProgressActivityInput[]>();

  for (const act of activities) {
    const key = keyFn(act);
    if (key === null || key === undefined) continue;
    const list = groups.get(key) ?? [];
    list.push(act);
    groups.set(key, list);
  }

  const results: DimensionProgress[] = [];
  for (const [key, groupActivities] of groups) {
    // Find the first activity with a non-empty label for this key
    const label = groupActivities.reduce(
      (best, act) => best || labelFn(act),
      '' as string
    ) || key;

    results.push({
      key,
      label,
      metrics: calculateProgressMetrics(groupActivities),
    });
  }

  // Sort by label for consistent output
  results.sort((a, b) => a.label.localeCompare(b.label));
  return results;
}

/**
 * Convenience: group by workpack.
 */
export function calculateWorkpackProgress(
  activities: ProgressActivityInput[]
): DimensionProgress[] {
  return calculateDimensionProgress(
    activities,
    (act) => act.workpackId,
    (act) => act.workpackId ?? 'Unassigned'
  );
}

/**
 * Convenience: group by discipline.
 */
export function calculateDisciplineProgress(
  activities: ProgressActivityInput[]
): DimensionProgress[] {
  return calculateDimensionProgress(
    activities,
    (act) => act.disciplineId ?? null,
    (act) => act.disciplineName ?? act.disciplineId ?? 'Unassigned'
  );
}

/**
 * Convenience: group by contractor.
 */
export function calculateContractorProgress(
  activities: ProgressActivityInput[]
): DimensionProgress[] {
  return calculateDimensionProgress(
    activities,
    (act) => act.contractorId ?? null,
    (act) => act.contractorName ?? act.contractorId ?? 'Unassigned'
  );
}

/**
 * Convenience: group by unit.
 */
export function calculateUnitProgress(
  activities: ProgressActivityInput[]
): DimensionProgress[] {
  return calculateDimensionProgress(
    activities,
    (act) => act.unitId ?? null,
    (act) => act.unitCode ?? act.unitId ?? 'Unassigned'
  );
}

/**
 * Convenience: group by equipment type.
 */
export function calculateEquipmentTypeProgress(
  activities: ProgressActivityInput[]
): DimensionProgress[] {
  return calculateDimensionProgress(
    activities,
    (act) => act.equipmentType ?? null,
    (act) => act.equipmentType ?? 'Unassigned'
  );
}

// ─── Identical Activity Intelligence (Phase 2) ──────────────────────────────

/**
 * Calculate identical activity progress.
 *
 * Groups activities by (equipmentType + standardActivityTypeCode) to answer:
 * "How many Heat Exchanger Blinding activities are complete vs balance?"
 *
 * Uses the SAME calculation mechanism as all other dimensions.
 * No new formula — reuses calculateDimensionProgress + calculateProgressMetrics.
 *
 * @param activities - Activities with equipmentType and standardActivityType* fields
 * @returns Array of IdenticalActivityGroup sorted by equipmentType + activityType
 */
export function calculateIdenticalActivityProgress(
  activities: ProgressActivityInput[]
): IdenticalActivityGroup[] {
  // Filter to only activities that have both equipment type and standard activity type
  const classifiable = filterIncludedActivities(activities).filter(
    (a) => a.equipmentType && (a.standardActivityTypeCode || a.standardActivityTypeName)
  );

  // Group by composite key: "equipmentType::standardActivityTypeCode"
  const groups = new Map<string, ProgressActivityInput[]>();
  for (const act of classifiable) {
    const key = `${act.equipmentType}::${act.standardActivityTypeCode ?? act.standardActivityTypeName}`;
    const list = groups.get(key) ?? [];
    list.push(act);
    groups.set(key, list);
  }

  const results: IdenticalActivityGroup[] = [];
  for (const [key, groupActivities] of groups) {
    const [equipmentType, activityCode] = key.split('::');
    const metrics = calculateProgressMetrics(groupActivities);

    // Instance-level counting (one activity = one equipment instance for this activity type)
    const included = filterIncludedActivities(groupActivities);
    let completedInstances = 0;
    let inProgressInstances = 0;
    let notStartedInstances = 0;
    for (const act of included) {
      const prog = normalizeProgress(act.progressPercent);
      const status = act.status ?? 'not_started';
      if (status === 'completed' || prog >= 100) completedInstances++;
      else if (prog > 0) inProgressInstances++;
      else notStartedInstances++;
    }
    const totalInstances = included.length;
    const completionPercent = totalInstances > 0
      ? Math.round((completedInstances / totalInstances) * 100)
      : 0;

    // Find display name from first activity in group
    const activityName = groupActivities.find((a) => a.standardActivityTypeName)?.standardActivityTypeName ?? activityCode;

    results.push({
      equipmentType,
      standardActivityTypeCode: activityCode,
      standardActivityTypeName: activityName,
      totalInstances,
      completedInstances,
      inProgressInstances,
      notStartedInstances,
      completionPercent,
      balancePercent: 100 - completionPercent,
      metrics,
    });
  }

  // Sort by equipment type, then activity type
  results.sort((a, b) =>
    a.equipmentType.localeCompare(b.equipmentType) ||
    a.standardActivityTypeName.localeCompare(b.standardActivityTypeName)
  );
  return results;
}

/**
 * Convenience: group by standard activity type (across all equipment types).
 */
export function calculateStandardActivityTypeProgress(
  activities: ProgressActivityInput[]
): DimensionProgress[] {
  return calculateDimensionProgress(
    activities,
    (act) => act.standardActivityTypeCode ?? act.standardActivityTypeId ?? null,
    (act) => act.standardActivityTypeName ?? act.standardActivityTypeCode ?? 'Unclassified'
  );
}

/**
 * Convenience: group by asset/equipment.
 */
export function calculateAssetProgress(
  activities: ProgressActivityInput[]
): DimensionProgress[] {
  return calculateDimensionProgress(
    activities,
    (act) => act.assetId ?? null,
    (act) => act.assetTagNumber ?? act.assetName ?? act.assetId ?? 'Unassigned'
  );
}

