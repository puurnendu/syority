/**
 * M8.13 Phase 1+2 — Progress Intelligence Types
 *
 * Domain types for the authoritative execution progress calculation system.
 * These types are PURE — no framework, database, or I/O dependencies.
 *
 * IMPORTANT DISTINCTIONS:
 * A. EXECUTION PROGRESS — physical % complete of activities (this module)
 * B. PLANNING READINESS  — whether workpacks/materials/docs are ready (planningProgress.ts)
 * C. SCHEDULE PERFORMANCE — SPI from CPM/schedule variance (ScheduleHealthService)
 * D. COST/EVM PERFORMANCE — SPI/CPI from earned value (EvmCalculationService)
 *
 * These four concepts must NEVER be conflated.
 */

// ─── Input Types ─────────────────────────────────────────────────────────────

/**
 * Minimal activity data required for progress calculation.
 * This is the contract between the aggregation service and the calculation service.
 */
export interface ProgressActivityInput {
  /** Activity ID */
  activityId: string;
  /** Duration in hours — used as weight for aggregation */
  durationHours: number | null;
  /** Current physical % complete (0-100) */
  progressPercent: number | null;
  /** Activity status — cancelled activities are excluded */
  status: string | null;
  /** Workpack ID for workpack-level aggregation */
  workpackId: string | null;
  /** Event ID */
  eventId: string | null;
  /** Optional grouping dimensions for dimensional analysis */
  disciplineId?: string | null;
  disciplineName?: string | null;
  contractorId?: string | null;
  contractorName?: string | null;
  unitId?: string | null;
  unitCode?: string | null;
  equipmentType?: string | null;
  /** M8.13 — Standard activity type classification */
  standardActivityTypeId?: string | null;
  standardActivityTypeName?: string | null;
  standardActivityTypeCode?: string | null;
  /** M8.13 Phase 2 — Equipment/Asset details */
  assetId?: string | null;
  assetName?: string | null;
  assetTagNumber?: string | null;
  /** Activity description — used for name-based auto-classification */
  description?: string | null;
}

// ─── Output Types ────────────────────────────────────────────────────────────

/**
 * Core progress metrics — the authoritative progress calculation result.
 *
 * Inclusion rules:
 * - INCLUDED: All activities where deleted_at IS NULL AND status != 'cancelled'
 * - EXCLUDED: Activities with status = 'cancelled' or deleted_at IS NOT NULL
 *
 * Weighting rules:
 * - Duration-weighted: If totalDurationHours > 0, progress = Σ(duration × progress) / Σ(duration)
 * - Fallback: If all durations are 0 or null, progress = simple average of progress_percent
 * - Zero activities: progress = 0
 *
 * These rules match the validated FieldExecutionService.calculateWeightedProgress() behavior.
 */
export interface ProgressMetrics {
  /** Duration-weighted execution progress (0-100), rounded to nearest integer */
  weightedProgress: number;
  /** Total activities counted (excluding cancelled/deleted) */
  totalActivities: number;
  /** Activities with progress_percent = 100 or status = 'completed' */
  completedActivities: number;
  /** Activities with progress > 0 and < 100 */
  inProgressActivities: number;
  /** Activities with progress = 0 or null and status not completed */
  notStartedActivities: number;
  /** Total duration hours across all included activities (the denominator for weighting) */
  totalDurationHours: number;
  /** Completed equivalent duration = Σ(duration × progress/100) */
  completedDurationHours: number;
  /** Balance = totalDurationHours - completedDurationHours */
  balanceDurationHours: number;
}

/**
 * Progress broken down by a grouping dimension.
 */
export interface DimensionProgress {
  /** Grouping key (ID or code) */
  key: string;
  /** Display label (name) */
  label: string;
  /** Progress metrics for this group */
  metrics: ProgressMetrics;
}

// ─── Identical Activity Intelligence (Phase 2) ──────────────────────────────

/**
 * Identical activity metrics — activities grouped by EquipmentType + StandardActivityType.
 *
 * Example: "Heat Exchanger + Blinding" → 20 total, 6 completed, 14 balance = 30% / 70%
 */
export interface IdenticalActivityGroup {
  /** Equipment type name (e.g., "Heat Exchanger") */
  equipmentType: string;
  /** Standard activity type code (e.g., "BLINDING") */
  standardActivityTypeCode: string;
  /** Standard activity type display name (e.g., "Blinding") */
  standardActivityTypeName: string;
  /** Number of equipment instances with this activity */
  totalInstances: number;
  /** Completed instances (progress = 100 or status = completed) */
  completedInstances: number;
  /** In-progress instances (progress > 0 and < 100) */
  inProgressInstances: number;
  /** Not-started instances (progress = 0 or null) */
  notStartedInstances: number;
  /** Completion percentage = completedInstances / totalInstances × 100 */
  completionPercent: number;
  /** Balance percentage = 100 - completionPercent */
  balancePercent: number;
  /** Duration-weighted progress metrics for this group */
  metrics: ProgressMetrics;
}

/**
 * Equipment-level progress — progress for a single equipment/asset item.
 */
export interface EquipmentInstanceProgress {
  /** Asset ID */
  assetId: string;
  /** Asset name or tag number */
  assetLabel: string;
  /** Activities on this asset with their progress */
  activities: Array<{
    activityId: string;
    description: string | null;
    standardActivityTypeName: string | null;
    progressPercent: number;
    status: string | null;
    durationHours: number;
  }>;
  /** Aggregate progress for this asset */
  metrics: ProgressMetrics;
}

/**
 * Equipment type drill-down — all assets of a type with their activity progress.
 */
export interface EquipmentTypeDrillDown {
  /** Equipment type name */
  equipmentType: string;
  /** All equipment instances of this type */
  instances: EquipmentInstanceProgress[];
  /** Identical activity groups within this equipment type */
  identicalActivities: IdenticalActivityGroup[];
  /** Overall metrics for this equipment type */
  metrics: ProgressMetrics;
}

// ─── Dashboard Progress Contract (Phase 2) ──────────────────────────────────

/**
 * DashboardProgressSummary — the SINGLE reusable contract for all dashboards.
 *
 * Every dashboard component that displays execution progress MUST consume this type.
 * No dashboard may independently calculate progress from raw activities.
 *
 * Flow: Database → ProgressAggregationService → ProgressCalculationService → this contract → UI
 */
export interface DashboardProgressSummary {
  /** Overall duration-weighted progress (0-100) */
  overallProgress: number;
  /** Total activities */
  totalActivities: number;
  /** Completed activities */
  completedActivities: number;
  /** In-progress activities */
  inProgressActivities: number;
  /** Not-started activities */
  notStartedActivities: number;
  /** Total planned duration hours */
  totalDurationHours: number;
  /** Completed-equivalent duration hours */
  completedEquivalentHours: number;
  /** Balance duration hours */
  balanceDurationHours: number;
}

// ─── Full Event Progress Payload ─────────────────────────────────────────────

/**
 * Full event-level progress payload — the primary API response.
 */
export interface EventProgressPayload {
  /** Event ID */
  eventId: string;
  /** Organization ID */
  organizationId: string;
  /** Calculation timestamp (ISO string) */
  calculatedAt: string;
  /** Overall duration-weighted execution progress */
  overall: ProgressMetrics;
  /** Breakdown by discipline (if requested) */
  byDiscipline?: DimensionProgress[];
  /** Breakdown by contractor (if requested) */
  byContractor?: DimensionProgress[];
  /** Breakdown by unit (if requested) */
  byUnit?: DimensionProgress[];
  /** Breakdown by equipment type (if requested) */
  byEquipmentType?: DimensionProgress[];
  /** Breakdown by workpack (if requested) */
  byWorkpack?: DimensionProgress[];
  /** Identical activity intelligence (if requested) */
  identicalActivities?: IdenticalActivityGroup[];
  /** Equipment type drill-downs (if requested) */
  equipmentDrillDown?: EquipmentTypeDrillDown[];
}

/**
 * Recalculation result — returned by the POST /recalculate endpoint.
 */
export interface RecalculationResult {
  /** Event ID */
  eventId: string;
  /** Whether any cached values were updated */
  workpacksSynced: number;
  /** The recalculated overall progress */
  overall: ProgressMetrics;
  /** Timestamp */
  calculatedAt: string;
}

/**
 * Convert ProgressMetrics to DashboardProgressSummary.
 */
export function toDashboardSummary(metrics: ProgressMetrics): DashboardProgressSummary {
  return {
    overallProgress: metrics.weightedProgress,
    totalActivities: metrics.totalActivities,
    completedActivities: metrics.completedActivities,
    inProgressActivities: metrics.inProgressActivities,
    notStartedActivities: metrics.notStartedActivities,
    totalDurationHours: metrics.totalDurationHours,
    completedEquivalentHours: metrics.completedDurationHours,
    balanceDurationHours: metrics.balanceDurationHours,
  };
}
