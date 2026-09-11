/**
 * M13 - Control Tower Exception Rules
 *
 * This module defines the explicit, testable rules for management exceptions.
 * It enforces the M13 architectural constraints:
 * - Read-only: Does not calculate CPM/Float (M11 authority)
 * - Read-only: Does not calculate execution progress (M8.13 authority)
 * - Read-only: Does not calculate SPI (M8.10 authority)
 *
 * Rules defined here identify business anomalies that require management attention.
 */

export type ExceptionSeverity = 'P1' | 'P2' | 'P3' | 'P4';
export type ExceptionCode =
  | 'LATE'
  | 'CRITICAL'
  | 'CRITICAL_LATE'
  | 'LOW_FLOAT'
  | 'ON_HOLD'
  | 'READINESS_BLOCKED'
  | 'CONSTRAINT_BLOCKED'
  | 'PROGRESS_LAG'
  | 'UPCOMING_RISK';

export interface ControlTowerRuleDef {
  code: ExceptionCode;
  severity: ExceptionSeverity;
  description: string;
  sourceAuthority: string;
}

export const CONTROL_TOWER_RULES: Record<ExceptionCode, ControlTowerRuleDef> = {
  CRITICAL_LATE: {
    code: 'CRITICAL_LATE',
    severity: 'P1',
    description: 'Activity is on the critical path and has passed its planned finish date.',
    sourceAuthority: 'M11 (planned_end, is_critical)',
  },
  LATE: {
    code: 'LATE',
    severity: 'P2',
    description: 'Activity is not critical but has passed its planned finish date.',
    sourceAuthority: 'M11 (planned_end)',
  },
  READINESS_BLOCKED: {
    code: 'READINESS_BLOCKED',
    severity: 'P2',
    description: 'Activity is scheduled to start but has execution readiness blockers.',
    sourceAuthority: 'M12 (ExecutionReadinessService)',
  },
  CONSTRAINT_BLOCKED: {
    code: 'CONSTRAINT_BLOCKED',
    severity: 'P2',
    description: 'Activity is blocked by an active constraint.',
    sourceAuthority: 'M12 (ConstraintLog)',
  },
  ON_HOLD: {
    code: 'ON_HOLD',
    severity: 'P3',
    description: 'Activity is explicitly placed on hold.',
    sourceAuthority: 'M12 (status)',
  },
  PROGRESS_LAG: {
    code: 'PROGRESS_LAG',
    severity: 'P3',
    description: 'Activity is falling behind its planned value (SPI < 0.90).',
    sourceAuthority: 'M8.10 (EVM SPI)',
  },
  CRITICAL: {
    code: 'CRITICAL',
    severity: 'P3',
    description: 'Active activity is on the critical path (zero or negative total float).',
    sourceAuthority: 'M11 (is_critical, total_float)',
  },
  UPCOMING_RISK: {
    code: 'UPCOMING_RISK',
    severity: 'P4',
    description: 'Activity is starting soon, float is near zero, and SPI is degrading.',
    sourceAuthority: 'M11 / M8.10',
  },
  LOW_FLOAT: {
    code: 'LOW_FLOAT',
    severity: 'P4',
    description: 'Activity is near critical path (total float <= 24 hours).',
    sourceAuthority: 'M11 (total_float)',
  },
};

export interface ExceptionInput {
  progressPercent: number;
  status: string;
  totalFloat: number | null;
  isCritical: boolean;
  plannedStart: Date | null;
  plannedEnd: Date | null;
  spi: number;
  hasReadinessBlockers: boolean;
  hasCriticalConstraints: boolean;
  dataDateMs: number;
}

export function evaluateExceptions(input: ExceptionInput): ExceptionCode[] {
  const exceptions: ExceptionCode[] = [];
  const {
    progressPercent,
    status,
    totalFloat,
    isCritical,
    plannedStart,
    plannedEnd,
    spi,
    hasReadinessBlockers,
    hasCriticalConstraints,
    dataDateMs,
  } = input;

  if (progressPercent >= 100 || status === 'completed' || status === 'cancelled') {
    return exceptions;
  }

  const plannedEndMs = plannedEnd?.getTime() ?? 0;
  const isLate = plannedEndMs > 0 && dataDateMs > plannedEndMs;
  const floatVal = totalFloat !== null ? totalFloat : 9999;
  const critical = isCritical || floatVal <= 0;

  // 1. Critical Late (P1)
  if (isLate && critical) {
    exceptions.push('CRITICAL_LATE');
  } 
  // 2. Late (P2)
  else if (isLate) {
    exceptions.push('LATE');
  }

  // 3. Readiness Blocked (P2)
  if (hasReadinessBlockers) {
    exceptions.push('READINESS_BLOCKED');
  }

  // 4. Constraint Blocked (P2)
  if (hasCriticalConstraints) {
    exceptions.push('CONSTRAINT_BLOCKED');
  }

  // 5. On Hold (P3)
  if (status === 'on_hold') {
    exceptions.push('ON_HOLD');
  }

  // 6. Progress Lag (P3)
  if (spi > 0 && spi < 0.90) {
    exceptions.push('PROGRESS_LAG');
  }

  // 7. Critical (P3) (only add if not CRITICAL_LATE to avoid spam)
  if (critical && !isLate) {
    exceptions.push('CRITICAL');
  }

  // 8. Low Float (P4)
  if (!critical && floatVal <= 24 && floatVal > 0) {
    exceptions.push('LOW_FLOAT');
  }

  // 9. Upcoming Risk (P4)
  if (!isLate && critical && spi > 0 && spi < 0.95) {
    exceptions.push('UPCOMING_RISK');
  }

  return exceptions;
}
