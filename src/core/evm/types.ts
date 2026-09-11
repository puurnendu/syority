/**
 * M8.10 — EVM Domain Types
 *
 * All type definitions for the Enterprise EVM & Cost Intelligence module.
 * These types define the shape of EVM calculations, API responses, and
 * snapshot persistence, decoupled from Prisma models.
 *
 * Architecture Lock Reference: M8.10_ARCHITECTURE_LOCK.md §3, §6
 * AC Source of Truth: Activity.actual_cost (UD-3, Decision A)
 */

// ─── Activity-Level EVM ──────────────────────────────────────────────────────

/**
 * EVM metrics for a single activity.
 */
export interface ActivityEvmResult {
  activityId: string;
  activityDescription: string;
  workpackId: string | null;
  /** Budget at Completion — from BaselineActivity.budgeted_cost */
  bac: number;
  /** Planned Value at the data date */
  pv: number;
  /** Earned Value based on physical % complete or earning rule */
  ev: number;
  /** Actual Cost — authoritative source: Activity.actual_cost (UD-3 Decision A) */
  ac: number;
  /** Cost Variance: EV - AC */
  cv: number;
  /** Schedule Variance: EV - PV */
  sv: number;
  /** Cost Performance Index: EV / AC (null when undefined) */
  cpi: number | null;
  /** Schedule Performance Index: EV / PV (null when undefined) */
  spi: number | null;
}

// ─── Event-Level EVM Summary ─────────────────────────────────────────────────

/**
 * Aggregated EVM metrics at the event (turnaround) level.
 */
export interface EvmSummary {
  eventId: string;
  baselineId: string;
  dataDate: string; // ISO date string
  /** Budget at Completion — sum of all BaselineActivity.budgeted_cost */
  bac: number;
  /** Planned Value at data date */
  pv: number;
  /** Earned Value at data date */
  ev: number;
  /** Actual Cost at data date — sum of all Activity.actual_cost */
  ac: number;
  /** Cost Variance: EV - AC */
  cv: number;
  /** Schedule Variance: EV - PV */
  sv: number;
  /** Cost Performance Index: EV / AC */
  cpi: number | null;
  /** Schedule Performance Index: EV / PV */
  spi: number | null;
  /** Estimate at Completion: AC + ((BAC - EV) / CPI) */
  eac: number | null;
  /** Estimate to Complete: EAC - AC */
  etc: number | null;
  /** Variance at Completion: BAC - EAC */
  vac: number | null;
  /** To-Complete Performance Index: (BAC - EV) / (BAC - AC) */
  tcpi: number | null;
  /** Number of activities with BAC > 0 */
  costLoadedActivities: number;
  /** Total activities in scope */
  totalActivities: number;
  /** Percentage of activities with budgeted cost */
  costLoadedPercent: number;
}

// ─── Time-Phased Curve Data ──────────────────────────────────────────────────

/**
 * Time-phased S-curve data for chart rendering.
 * Each index position corresponds to the same date across all arrays.
 */
export interface EvmCurveData {
  /** ISO date strings for each data point */
  dates: string[];
  /** Cumulative Planned Value at each date */
  pv: number[];
  /** Cumulative Earned Value at each date */
  ev: number[];
  /** Cumulative Actual Cost at each date */
  ac: number[];
  /** Projected EAC values from data date forward (null for historical) */
  eacProjection: (number | null)[];
}

// ─── Snapshot Persistence ────────────────────────────────────────────────────

export type EvmSnapshotType = 'daily' | 'manual' | 'baseline_change';

/**
 * Shape of the JSONB `summary` field in the EvmSnapshot table.
 */
export interface EvmSnapshotSummary {
  bac: number;
  pv: number;
  ev: number;
  ac: number;
  cv: number;
  sv: number;
  cpi: number | null;
  spi: number | null;
  eac: number | null;
  etc: number | null;
  vac: number | null;
  tcpi: number | null;
}

/**
 * Shape of the JSONB `curve_data` field in the EvmSnapshot table.
 */
export interface EvmSnapshotCurveData {
  dates: string[];
  pv: number[];
  ev: number[];
  ac: number[];
}

// ─── Drill-Down ──────────────────────────────────────────────────────────────

/**
 * EVM summary for a WBS node (workpack, system, unit, or event).
 */
export interface WbsEvmNode {
  id: string;
  name: string;
  level: 'event' | 'unit' | 'system' | 'workpack' | 'activity';
  bac: number;
  pv: number;
  ev: number;
  ac: number;
  cv: number;
  sv: number;
  cpi: number | null;
  spi: number | null;
  children?: WbsEvmNode[];
}

// ─── Scenario EVM Projection ─────────────────────────────────────────────────

/**
 * Scenario EVM projection result — read-only, zero mutation.
 * This is an ephemeral in-memory calculation overlaid on live EVM.
 */
export interface ScenarioEvmProjection {
  scenarioId: string;
  scenarioName: string;
  /** Live EVM summary (unmodified) */
  liveEvm: EvmSummary;
  /** Projected EVM summary with scenario overrides applied */
  projectedEvm: EvmSummary;
  /** Delta between projected and live */
  delta: {
    bacDelta: number;
    eacDelta: number | null;
    cpiDelta: number | null;
    spiDelta: number | null;
    projectFinishDelta: number | null;
  };
}

// ─── API Response Types ──────────────────────────────────────────────────────

export interface EvmSummaryResponse {
  success: boolean;
  data: EvmSummary;
}

export interface EvmCurveResponse {
  success: boolean;
  data: EvmCurveData;
}

export interface EvmDrillDownResponse {
  success: boolean;
  data: WbsEvmNode;
}
