/**
 * Deterministic M15 management-priority ranking (v1).
 *
 * This is NOT M13 exception severity and NOT M16 ActionRiskLevel.
 * M13 detection is unchanged. Weights are fixed, versioned, and testable.
 */

import type { ManagementRiskSeverity } from './types';

export const MANAGEMENT_PRIORITY_MODEL = {
  id: 'm15-management-priority',
  version: '1.0',
} as const;

export interface PrioritySignal {
  name: string;
  points: number;
  sourceAuthority: string;
}

export interface PriorityComputation {
  score: number;
  priority: ManagementRiskSeverity;
  signals: PrioritySignal[];
}

const BANDS = {
  CRITICAL: 55,
  HIGH: 35,
  MEDIUM: 18,
} as const;

function band(score: number): ManagementRiskSeverity {
  if (score >= BANDS.CRITICAL) return 'CRITICAL';
  if (score >= BANDS.HIGH) return 'HIGH';
  if (score >= BANDS.MEDIUM) return 'MEDIUM';
  return 'LOW';
}

const M13_POINTS: Record<string, number> = {
  P1: 40,
  P2: 25,
  P3: 12,
  P4: 5,
};

const RESOURCE_POINTS: Record<string, number> = {
  CRITICAL: 40,
  HIGH: 25,
  MEDIUM: 12,
  LOW: 5,
};

export function computeManagementPriority(input: {
  m13Severity?: string | null;
  isCritical?: boolean;
  downstreamCount?: number | null;
  exceptionCode?: string | null;
  resourceSeverity?: string | null;
}): PriorityComputation {
  const signals: PrioritySignal[] = [];

  if (input.m13Severity && M13_POINTS[input.m13Severity] != null) {
    signals.push({
      name: `m13_severity_${input.m13Severity}`,
      points: M13_POINTS[input.m13Severity],
      sourceAuthority: 'M13',
    });
  }

  if (input.resourceSeverity && RESOURCE_POINTS[input.resourceSeverity] != null && !input.m13Severity) {
    signals.push({
      name: `resource_severity_${input.resourceSeverity}`,
      points: RESOURCE_POINTS[input.resourceSeverity],
      sourceAuthority: 'ResourceRiskService',
    });
  }

  if (input.isCritical) {
    signals.push({
      name: 'm11_is_critical',
      points: 15,
      sourceAuthority: 'M11',
    });
  }

  if (input.downstreamCount != null && input.downstreamCount > 0) {
    signals.push({
      name: 'downstream_activity_count',
      points: Math.min(20, Math.floor(input.downstreamCount)),
      sourceAuthority: 'M11',
    });
  }

  if (input.exceptionCode === 'READINESS_BLOCKED') {
    signals.push({
      name: 'readiness_blocked',
      points: 10,
      sourceAuthority: 'M12',
    });
  }

  if (input.exceptionCode === 'CONSTRAINT_BLOCKED') {
    signals.push({
      name: 'constraint_blocked',
      points: 10,
      sourceAuthority: 'M12',
    });
  }

  const score = signals.reduce((sum, s) => sum + s.points, 0);
  return { score, priority: band(score), signals };
}

export function riskTypeFromException(code: string | undefined, isCritical: boolean): string {
  if (!code) return 'RESOURCE_CAPACITY_RISK';
  if (code === 'CRITICAL_LATE' || (isCritical && (code === 'LATE' || code === 'CRITICAL'))) {
    return 'CRITICAL_PATH_EXECUTION_RISK';
  }
  if (code === 'READINESS_BLOCKED') return 'EXECUTION_READINESS_RISK';
  if (code === 'CONSTRAINT_BLOCKED') return 'CONSTRAINT_RISK';
  return `EXCEPTION_${code}`;
}
