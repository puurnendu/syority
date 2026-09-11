/**
 * M8.10 — EVM Calculation Service
 *
 * Pure, deterministic EVM calculation engine. No I/O, no HTTP, no persistence.
 * Accepts structured input data and returns mathematical EVM results.
 *
 * Architecture Lock: M8.10_ARCHITECTURE_LOCK.md §3
 * EV Earning Rules: M8.10_EV_EARNING_RULES.md
 * AC Source: Activity.actual_cost is authoritative (UD-3 Decision A)
 * Formulas: M8.10_EVM_FORMULA_SPECIFICATION.md
 */

import type {
  ActivityEvmResult,
  EvmSummary,
  EvmCurveData,
  EvmSnapshotSummary,
  EvmSnapshotCurveData,
} from './types';

// ─── Input Types ─────────────────────────────────────────────────────────────

/** Represents an activity with its baseline and current state for EVM calculation. */
export interface EvmActivityInput {
  activityId: string;
  description: string;
  workpackId: string | null;
  /** Duration in hours — 0 or null indicates a milestone */
  durationHours: number | null;
  /** Work category: 'EXECUTION' | 'MILESTONE' | 'LOE' | null */
  workCategory: string | null;
  /** Current physical % complete (0-100) */
  progressPercent: number | null;
  /** Actual cost (authoritative AC source, UD-3 Decision A) */
  actualCost: number | null;
  /** Current actual start date */
  actualStart: Date | null;
  /** Current actual end date */
  actualEnd: Date | null;
  /** Current planned end date (used for LOE EV fallback) */
  plannedEnd: Date | null;
  /** Baseline budgeted cost (BAC) — from BaselineActivity.budgeted_cost */
  baselineBudgetedCost: number | null;
  /** Baseline planned start — from BaselineActivity.planned_start */
  baselinePlannedStart: Date | null;
  /** Baseline planned finish — from BaselineActivity.planned_finish */
  baselinePlannedFinish: Date | null;
}

// ─── Core Calculation Functions ──────────────────────────────────────────────

/**
 * Calculate the BAC for an activity.
 * BAC is the baseline budgeted cost. If null/undefined, BAC = 0.
 */
export function calculateBac(input: EvmActivityInput): number {
  return input.baselineBudgetedCost ?? 0;
}

/**
 * Calculate Planned Value (PV) for an activity at a given data date.
 *
 * PV = BAC × (Baseline Planned % Complete at Data Date)
 *
 * Uses linear interpolation between baseline planned_start and planned_finish.
 */
export function calculatePv(input: EvmActivityInput, dataDate: Date): number {
  const bac = calculateBac(input);
  if (bac === 0) return 0;

  const start = input.baselinePlannedStart;
  const finish = input.baselinePlannedFinish;

  if (!start || !finish) return 0;

  const dataMs = dataDate.getTime();
  const startMs = start.getTime();
  const finishMs = finish.getTime();

  // Before planned start: PV = 0
  if (dataMs < startMs) return 0;
  // At or after planned finish: PV = BAC (100%)
  if (dataMs >= finishMs) return bac;
  // Zero-duration (milestone): same as at-or-after finish check above
  if (finishMs === startMs) return bac;

  // Linear interpolation
  const plannedPct = (dataMs - startMs) / (finishMs - startMs);
  return bac * Math.min(plannedPct, 1.0);
}

/**
 * Calculate Earned Value (EV) for an activity using the locked earning rules.
 *
 * Normal activities:      EV = BAC × min(progress_percent / 100, 1.0)
 * Milestones (dur=0):     EV = 0 if progress < 100, EV = BAC if progress = 100
 * LOE:                    Falls back to progress_percent × BAC in Phase 1
 *
 * EV is hard-capped at BAC.
 */
export function calculateEv(input: EvmActivityInput, _dataDate?: Date): number {
  const bac = calculateBac(input);
  if (bac === 0) return 0;

  const progress = input.progressPercent ?? 0;
  const isMilestone =
    input.workCategory === 'MILESTONE' ||
    input.durationHours === 0 ||
    input.durationHours === null;

  // Milestone: 0/100 rule
  if (isMilestone) {
    return progress >= 100 ? bac : 0;
  }

  // Normal and LOE (LOE falls back to progress% in Phase 1 per architecture lock)
  const ev = bac * Math.min(progress / 100, 1.0);
  return Math.min(ev, bac); // Hard cap at BAC
}

/**
 * Get Actual Cost (AC) for an activity.
 *
 * AC source: Activity.actual_cost is authoritative (UD-3 Decision A).
 * ProgressLog.actual_cost is NOT used as authoritative — only for reconciliation.
 */
export function calculateAc(input: EvmActivityInput): number {
  return input.actualCost ?? 0;
}

/**
 * Calculate Cost Variance: CV = EV - AC
 */
export function calculateCv(ev: number, ac: number): number {
  return ev - ac;
}

/**
 * Calculate Schedule Variance: SV = EV - PV
 * Note: This is in dollars/hours, not calendar days.
 */
export function calculateSv(ev: number, pv: number): number {
  return ev - pv;
}

/**
 * Calculate Cost Performance Index: CPI = EV / AC
 *
 * Zero-division rules (locked):
 * - If AC = 0 and EV = 0: CPI = 1.0
 * - If AC = 0 and EV > 0: CPI = null (display "∞")
 */
export function calculateCpi(ev: number, ac: number): number | null {
  if (ac === 0) {
    return ev === 0 ? 1.0 : null;
  }
  const result = ev / ac;
  if (!isFinite(result) || isNaN(result)) return null;
  return result;
}

/**
 * Calculate Schedule Performance Index: SPI = EV / PV
 *
 * Zero-division rules (locked):
 * - If PV = 0 and EV = 0: SPI = 1.0
 * - If PV = 0 and EV > 0: SPI = null (display "∞")
 */
export function calculateSpi(ev: number, pv: number): number | null {
  if (pv === 0) {
    return ev === 0 ? 1.0 : null;
  }
  const result = ev / pv;
  if (!isFinite(result) || isNaN(result)) return null;
  return result;
}

/**
 * Calculate Estimate at Completion: EAC = AC + ((BAC - EV) / CPI)
 *
 * Uses CPI-driven model (turnaround default per architecture lock).
 * If CPI is null or 0: EAC = null (display "N/A").
 */
export function calculateEac(bac: number, ev: number, ac: number, cpi: number | null): number | null {
  if (cpi === null || cpi === 0) return null;
  const result = ac + (bac - ev) / cpi;
  if (!isFinite(result) || isNaN(result)) return null;
  return result;
}

/**
 * Calculate Estimate to Complete: ETC = EAC - AC
 */
export function calculateEtc(eac: number | null, ac: number): number | null {
  if (eac === null) return null;
  return eac - ac;
}

/**
 * Calculate Variance at Completion: VAC = BAC - EAC
 */
export function calculateVac(bac: number, eac: number | null): number | null {
  if (eac === null) return null;
  return bac - eac;
}

/**
 * Calculate To-Complete Performance Index: TCPI = (BAC - EV) / (BAC - AC)
 *
 * If BAC = AC: TCPI = null (display "N/A")
 */
export function calculateTcpi(bac: number, ev: number, ac: number): number | null {
  const denominator = bac - ac;
  if (denominator === 0) return null;
  const result = (bac - ev) / denominator;
  if (!isFinite(result) || isNaN(result)) return null;
  return result;
}

// ─── Activity-Level EVM ──────────────────────────────────────────────────────

/**
 * Calculate complete EVM metrics for a single activity.
 */
export function calculateActivityEvm(
  input: EvmActivityInput,
  dataDate: Date
): ActivityEvmResult {
  const bac = calculateBac(input);
  const pv = calculatePv(input, dataDate);
  const ev = calculateEv(input, dataDate);
  const ac = calculateAc(input);
  const cv = calculateCv(ev, ac);
  const sv = calculateSv(ev, pv);
  const cpi = calculateCpi(ev, ac);
  const spi = calculateSpi(ev, pv);

  return {
    activityId: input.activityId,
    activityDescription: input.description,
    workpackId: input.workpackId,
    bac,
    pv,
    ev,
    ac,
    cv,
    sv,
    cpi,
    spi,
  };
}

// ─── Event-Level EVM Aggregation ─────────────────────────────────────────────

/**
 * Calculate aggregated EVM summary for a set of activities (event-level).
 */
export function calculateEventEvm(
  activities: EvmActivityInput[],
  eventId: string,
  baselineId: string,
  dataDate: Date
): EvmSummary {
  let totalBac = 0;
  let totalPv = 0;
  let totalEv = 0;
  let totalAc = 0;
  let costLoadedCount = 0;

  for (const activity of activities) {
    const bac = calculateBac(activity);
    totalBac += bac;
    totalPv += calculatePv(activity, dataDate);
    totalEv += calculateEv(activity, dataDate);
    totalAc += calculateAc(activity);
    if (bac > 0) costLoadedCount++;
  }

  const cv = calculateCv(totalEv, totalAc);
  const sv = calculateSv(totalEv, totalPv);
  const cpi = calculateCpi(totalEv, totalAc);
  const spi = calculateSpi(totalEv, totalPv);
  const eac = calculateEac(totalBac, totalEv, totalAc, cpi);
  const etc = calculateEtc(eac, totalAc);
  const vac = calculateVac(totalBac, eac);
  const tcpi = calculateTcpi(totalBac, totalEv, totalAc);

  return {
    eventId,
    baselineId,
    dataDate: dataDate.toISOString().split('T')[0],
    bac: totalBac,
    pv: round2(totalPv),
    ev: round2(totalEv),
    ac: totalAc,
    cv: round2(cv),
    sv: round2(sv),
    cpi: cpi !== null ? round4(cpi) : null,
    spi: spi !== null ? round4(spi) : null,
    eac: eac !== null ? round2(eac) : null,
    etc: etc !== null ? round2(etc) : null,
    vac: vac !== null ? round2(vac) : null,
    tcpi: tcpi !== null ? round4(tcpi) : null,
    costLoadedActivities: costLoadedCount,
    totalActivities: activities.length,
    costLoadedPercent: activities.length > 0
      ? round2((costLoadedCount / activities.length) * 100)
      : 0,
  };
}

// ─── Time-Phased Curve Generation ────────────────────────────────────────────

/**
 * Generate cumulative S-curve data points for a date range.
 */
export function generateCurveData(
  activities: EvmActivityInput[],
  startDate: Date,
  endDate: Date
): EvmSnapshotCurveData {
  const dates: string[] = [];
  const pvCurve: number[] = [];
  const evCurve: number[] = [];
  const acCurve: number[] = [];

  const current = new Date(startDate);
  while (current <= endDate) {
    const dateStr = current.toISOString().split('T')[0];
    dates.push(dateStr);

    let dayPv = 0;
    let dayEv = 0;
    let dayAc = 0;

    for (const activity of activities) {
      dayPv += calculatePv(activity, current);
      dayEv += calculateEv(activity, current);
      dayAc += calculateAc(activity); // AC is cumulative, not date-specific in Phase 1
    }

    pvCurve.push(round2(dayPv));
    evCurve.push(round2(dayEv));
    acCurve.push(round2(dayAc));

    current.setDate(current.getDate() + 1);
  }

  return { dates, pv: pvCurve, ev: evCurve, ac: acCurve };
}

/**
 * Generate an EvmSnapshotSummary from an EvmSummary.
 */
export function toSnapshotSummary(summary: EvmSummary): EvmSnapshotSummary {
  return {
    bac: summary.bac,
    pv: summary.pv,
    ev: summary.ev,
    ac: summary.ac,
    cv: summary.cv,
    sv: summary.sv,
    cpi: summary.cpi,
    spi: summary.spi,
    eac: summary.eac,
    etc: summary.etc,
    vac: summary.vac,
    tcpi: summary.tcpi,
  };
}

// ─── Utility ─────────────────────────────────────────────────────────────────

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}
