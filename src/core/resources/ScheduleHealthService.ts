/**
 * M8.8 — Schedule Health Service
 *
 * Computes a deterministic Schedule Health Index (SHI) from 0-100
 * based on six weighted component scores:
 *
 *   SHI = w₁×CP + w₂×FE + w₃×MV + w₄×RO + w₅×PE + w₆×BV
 *
 * Components:
 *   CP = Critical Path Score     (w₁=0.25)
 *   FE = Float Erosion Score     (w₂=0.15)
 *   MV = Milestone Variance      (w₃=0.15)
 *   RO = Resource Overload       (w₄=0.15)
 *   PE = Progress Earned Value   (w₅=0.15)
 *   BV = Baseline Variance       (w₆=0.15)
 *
 * Classification:
 *   SHI ≥ 80 → GREEN  (Healthy)
 *   SHI ≥ 60 → YELLOW (At Risk)
 *   SHI ≥ 40 → ORANGE (Critical)
 *   SHI < 40 → RED    (Failing)
 *
 * All calculations are deterministic and read-only.
 */
import { prisma } from '@/lib/prisma';
import { ScheduleVarianceService } from './ScheduleVarianceService';

import { ResourceConstraint } from './ResourceConstraintService';
import { CalculatedActivity } from '@/lib/scheduleEngine';

// ── Types ──────────────────────────────────────────────────────────────

export type HealthClassification = 'GREEN' | 'YELLOW' | 'ORANGE' | 'RED';

export interface ComponentScore {
  name: string;
  score: number;      // 0-100
  weight: number;     // 0.0-1.0
  weighted: number;   // score × weight
  detail: string;     // Human-readable explanation
}

export interface ScheduleHealthResult {
  shi: number;                       // 0-100
  classification: HealthClassification;
  components: ComponentScore[];
  event_id: string;
  computed_at: string;
}

// ── Constants ──────────────────────────────────────────────────────────

const WEIGHTS = {
  critical_path: 0.25,
  float_erosion: 0.15,
  milestone_variance: 0.15,
  resource_overload: 0.15,
  progress_earned: 0.15,
  baseline_variance: 0.15,
};

// ── Service ────────────────────────────────────────────────────────────

export class ScheduleHealthService {

  /**
   * Calculate the Schedule Health Index (SHI) for an event.
   */
  static async calculateHealth(
    eventId: string,
    organizationId: string
  ): Promise<ScheduleHealthResult> {

    const components: ComponentScore[] = [];

    // ── 1. Critical Path Score (CP) ──────────────────────────────────
    // max(0, 100 - (critical_delay_days × 10))
    const cpScore = await this.scoreCriticalPath(eventId, organizationId);
    components.push(cpScore);

    // ── 2. Float Erosion Score (FE) ──────────────────────────────────
    // max(0, 100 - (avg_float_erosion_pct × 2))
    const feScore = await this.scoreFloatErosion(eventId, organizationId);
    components.push(feScore);

    // ── 3. Milestone Variance Score (MV) ─────────────────────────────
    // max(0, 100 - (milestone_slippage_days × 5))
    const mvScore = await this.scoreMilestoneVariance(eventId, organizationId);
    components.push(mvScore);

    // ── 4. Resource Overload Score (RO) ──────────────────────────────
    // max(0, 100 - (overloaded_pct × 2))
    const roScore = await this.scoreResourceOverload(eventId, organizationId);
    components.push(roScore);

    // ── 5. Progress Earned Value Score (PE) ──────────────────────────
    // min(100, (actual_progress / planned_progress) × 100)
    const peScore = await this.scoreProgressEarned(eventId, organizationId);
    components.push(peScore);

    // ── 6. Baseline Variance Score (BV) ──────────────────────────────
    // max(0, 100 - (avg_activity_variance_days × 5))
    const bvScore = await this.scoreBaselineVariance(eventId, organizationId);
    components.push(bvScore);

    // ── Compute SHI ──────────────────────────────────────────────────
    const shi = Math.round(
      components.reduce((sum, c) => sum + c.weighted, 0) * 10
    ) / 10;

    const classification = this.classify(shi);

    return {
      shi,
      classification,
      components,
      event_id: eventId,
      computed_at: new Date().toISOString(),
    };
  }

  /**
   * Pure resource overload scoring rule (reused across live scheduling and scenarios)
   */
  static computeResourceOverloadScore(constraints: ResourceConstraint[]): ComponentScore {
    if (constraints.length === 0) {
      return {
        name: 'Resource Overload',
        score: 100,
        weight: WEIGHTS.resource_overload,
        weighted: 100 * WEIGHTS.resource_overload,
        detail: 'No resource constraints detected',
      };
    }

    // Classify constraints by severity
    let criticalCount = 0;
    let highCount = 0;
    let warningCount = 0;
    let infoCount = 0;
    let criticalActivityConflicts = 0;

    for (const c of constraints) {
      switch (c.severity) {
        case 'CRITICAL': criticalCount++; break;
        case 'HIGH': highCount++; break;
        case 'WARNING': warningCount++; break;
        case 'INFO': infoCount++; break;
      }
      if (c.constraint_type === 'CRITICAL_ACTIVITY_CONFLICT') {
        criticalActivityConflicts++;
      }
    }

    // Score: start at 100, deduct based on constraint severity
    // CRITICAL: -15 per constraint
    // HIGH: -8 per constraint
    // WARNING: -3 per constraint
    // CRITICAL_ACTIVITY_CONFLICT: additional -5 per instance
    const score = Math.max(0, Math.min(100,
      100
      - (criticalCount * 15)
      - (highCount * 8)
      - (warningCount * 3)
      - (criticalActivityConflicts * 5)
    ));

    const detail = [
      criticalCount > 0 ? `${criticalCount} CRITICAL` : '',
      highCount > 0 ? `${highCount} HIGH` : '',
      warningCount > 0 ? `${warningCount} WARNING` : '',
      infoCount > 0 ? `${infoCount} INFO` : '',
      criticalActivityConflicts > 0 ? `${criticalActivityConflicts} critical-activity conflicts` : '',
    ].filter(Boolean).join(', ');

    return {
      name: 'Resource Overload',
      score: Math.round(score * 10) / 10,
      weight: WEIGHTS.resource_overload,
      weighted: Math.round(score * WEIGHTS.resource_overload * 10) / 10,
      detail: `${constraints.length} constraints: ${detail}`,
    };
  }

  /**
   * Calculate deterministic Schedule Health Index (SHI) for a scenario against a base baseline.
   */
  static async calculateScenarioHealth(params: {
    eventId: string;
    organizationId: string;
    scenarioActivities: CalculatedActivity[];
    baselineActivities: Array<{
      activity_id: string;
      planned_start?: Date | string | null;
      planned_finish?: Date | string | null;
      duration?: number | null;
      total_float?: number | null;
    }>;
    constraints: ResourceConstraint[];
  }): Promise<ScheduleHealthResult> {
    const { eventId, scenarioActivities, baselineActivities, constraints } = params;
    const components: ComponentScore[] = [];

    // 1. Critical Path Score (CP) (w = 0.25)
    let baselineFinish: Date | null = null;
    for (const ba of baselineActivities) {
      if (ba.planned_finish) {
        const d = new Date(ba.planned_finish);
        if (!baselineFinish || d > baselineFinish) baselineFinish = d;
      }
    }

    let scenarioFinish: Date | null = null;
    for (const sa of scenarioActivities) {
      if (sa.early_finish) {
        const d = new Date(sa.early_finish);
        if (!scenarioFinish || d > scenarioFinish) scenarioFinish = d;
      }
    }

    let maxDelayDays = 0;
    if (baselineFinish && scenarioFinish && scenarioFinish > baselineFinish) {
      maxDelayDays = (scenarioFinish.getTime() - baselineFinish.getTime()) / (24 * 60 * 60 * 1000);
    }

    const cpScoreValue = Math.max(0, 100 - (maxDelayDays * 10));
    components.push({
      name: 'Critical Path',
      score: Math.round(cpScoreValue * 10) / 10,
      weight: WEIGHTS.critical_path,
      weighted: Math.round(cpScoreValue * WEIGHTS.critical_path * 10) / 10,
      detail: maxDelayDays > 0
        ? `Scenario project finish delayed by ${Math.round(maxDelayDays * 10) / 10} days`
        : `Critical path on schedule (${scenarioActivities.filter(a => a.is_critical).length} critical activities)`,
    });

    // 2. Float Erosion Score (FE) (w = 0.15)
    const baseMap = new Map(baselineActivities.map(b => [b.activity_id, b]));
    let totalFloatErosion = 0;
    let floatCount = 0;
    for (const sa of scenarioActivities) {
      const ba = baseMap.get(sa.id);
      if (ba && ba.total_float !== undefined && ba.total_float !== null) {
        const baseFloat = Number(ba.total_float);
        const scenarioFloat = sa.total_float_days;
        const erosion = baseFloat - scenarioFloat;
        totalFloatErosion += erosion;
        floatCount++;
      }
    }
    const avgFloatErosion = floatCount > 0 ? totalFloatErosion / floatCount : 0;
    const feScoreValue = Math.max(0, 100 - (Math.abs(avgFloatErosion) * 2));
    components.push({
      name: 'Float Erosion',
      score: Math.round(feScoreValue * 10) / 10,
      weight: WEIGHTS.float_erosion,
      weighted: Math.round(feScoreValue * WEIGHTS.float_erosion * 10) / 10,
      detail: `Average float erosion: ${Math.round(avgFloatErosion * 10) / 10} days`,
    });

    // 3. Milestone Variance (MV) (w = 0.15)
    const milestones = await prisma.eventMilestone.findMany({
      where: { event_id: eventId },
      select: { planned_date: true, actual_date: true, status: true },
    });
    let maxMilestoneSlip = 0;
    if (milestones.length > 0 && scenarioFinish) {
      for (const ms of milestones) {
        if (ms.planned_date && ms.status !== 'completed') {
          const planned = new Date(ms.planned_date);
          if (scenarioFinish > planned) {
            const slip = (scenarioFinish.getTime() - planned.getTime()) / (24 * 60 * 60 * 1000);
            if (slip > maxMilestoneSlip) maxMilestoneSlip = slip;
          }
        }
      }
    }
    const mvScoreValue = Math.max(0, 100 - (maxMilestoneSlip * 5));
    components.push({
      name: 'Milestone Variance',
      score: Math.round(mvScoreValue * 10) / 10,
      weight: WEIGHTS.milestone_variance,
      weighted: Math.round(mvScoreValue * WEIGHTS.milestone_variance * 10) / 10,
      detail: milestones.length === 0
        ? 'No milestones defined'
        : maxMilestoneSlip > 0
          ? `Worst milestone slippage: ${Math.round(maxMilestoneSlip * 10) / 10} days`
          : `All ${milestones.length} milestones on track`,
    });

    // 4. Resource Overload Score (RO) (w = 0.15)
    const roScore = this.computeResourceOverloadScore(constraints);
    components.push(roScore);

    // 5. Progress Earned Value Score (PE) (w = 0.15)
    components.push({
      name: 'Progress Earned Value',
      score: 100,
      weight: WEIGHTS.progress_earned,
      weighted: 100 * WEIGHTS.progress_earned,
      detail: 'Forward-looking simulation (100% target planned)',
    });

    // 6. Baseline Variance Score (BV) (w = 0.15)
    let totalStartVariance = 0;
    let startVarCount = 0;
    let delayedCount = 0;
    for (const sa of scenarioActivities) {
      const ba = baseMap.get(sa.id);
      if (ba && ba.planned_start && sa.early_start) {
        const baseStart = new Date(ba.planned_start);
        const scenStart = new Date(sa.early_start);
        const varDays = (scenStart.getTime() - baseStart.getTime()) / (24 * 60 * 60 * 1000);
        totalStartVariance += varDays;
        startVarCount++;
        if (varDays > 0) delayedCount++;
      }
    }
    const avgStartVar = startVarCount > 0 ? totalStartVariance / startVarCount : 0;
    const bvScoreValue = Math.max(0, 100 - (Math.abs(avgStartVar) * 5));
    components.push({
      name: 'Baseline Variance',
      score: Math.round(bvScoreValue * 10) / 10,
      weight: WEIGHTS.baseline_variance,
      weighted: Math.round(bvScoreValue * WEIGHTS.baseline_variance * 10) / 10,
      detail: `${delayedCount} activities shifted, avg variance: ${Math.round(avgStartVar * 10) / 10} days`,
    });

    // Compute SHI
    const shi = Math.round(
      components.reduce((sum, c) => sum + c.weighted, 0) * 10
    ) / 10;

    const classification = this.classify(shi);

    return {
      shi,
      classification,
      components,
      event_id: eventId,
      computed_at: new Date().toISOString(),
    };
  }

  // ── Component Calculators ──────────────────────────────────────────

  private static async scoreCriticalPath(eventId: string, orgId: string): Promise<ComponentScore> {
    const activities = await prisma.activity.findMany({
      where: { event_id: eventId, organization_id: orgId, deleted_at: null, is_critical: true },
      select: { planned_end: true, actual_end: true, status: true },
    });

    // Calculate how many critical activities are delayed (past their planned end)
    const now = new Date();
    let maxDelayDays = 0;
    for (const act of activities) {
      if (act.status !== 'completed' && act.planned_end) {
        const pe = new Date(act.planned_end);
        if (now > pe) {
          const delayDays = (now.getTime() - pe.getTime()) / (24 * 60 * 60 * 1000);
          if (delayDays > maxDelayDays) maxDelayDays = delayDays;
        }
      }
    }

    const score = Math.max(0, 100 - (maxDelayDays * 10));
    return {
      name: 'Critical Path',
      score: Math.round(score * 10) / 10,
      weight: WEIGHTS.critical_path,
      weighted: Math.round(score * WEIGHTS.critical_path * 10) / 10,
      detail: maxDelayDays > 0
        ? `Critical path delayed by ${Math.round(maxDelayDays * 10) / 10} days`
        : `Critical path on schedule (${activities.length} critical activities)`,
    };
  }

  private static async scoreFloatErosion(eventId: string, orgId: string): Promise<ComponentScore> {
    const variance = await ScheduleVarianceService.calculateVariance(eventId, orgId);

    if (!variance) {
      return {
        name: 'Float Erosion',
        score: 100,
        weight: WEIGHTS.float_erosion,
        weighted: 100 * WEIGHTS.float_erosion,
        detail: 'No baseline assigned — float erosion cannot be measured',
      };
    }

    const erosionPct = Math.abs(variance.avg_float_erosion);
    const score = Math.max(0, 100 - (erosionPct * 2));
    return {
      name: 'Float Erosion',
      score: Math.round(score * 10) / 10,
      weight: WEIGHTS.float_erosion,
      weighted: Math.round(score * WEIGHTS.float_erosion * 10) / 10,
      detail: `Average float erosion: ${variance.avg_float_erosion} hours`,
    };
  }

  private static async scoreMilestoneVariance(eventId: string, orgId: string): Promise<ComponentScore> {
    const milestones = await prisma.eventMilestone.findMany({
      where: { event_id: eventId },
      select: { planned_date: true, actual_date: true, status: true },
    });

    if (milestones.length === 0) {
      return {
        name: 'Milestone Variance',
        score: 100,
        weight: WEIGHTS.milestone_variance,
        weighted: 100 * WEIGHTS.milestone_variance,
        detail: 'No milestones defined',
      };
    }

    const now = new Date();
    let maxSlippageDays = 0;
    for (const ms of milestones) {
      if (ms.planned_date && ms.status !== 'completed') {
        const planned = new Date(ms.planned_date);
        const actual = ms.actual_date ? new Date(ms.actual_date) : now;
        if (actual > planned) {
          const slip = (actual.getTime() - planned.getTime()) / (24 * 60 * 60 * 1000);
          if (slip > maxSlippageDays) maxSlippageDays = slip;
        }
      }
    }

    const score = Math.max(0, 100 - (maxSlippageDays * 5));
    return {
      name: 'Milestone Variance',
      score: Math.round(score * 10) / 10,
      weight: WEIGHTS.milestone_variance,
      weighted: Math.round(score * WEIGHTS.milestone_variance * 10) / 10,
      detail: maxSlippageDays > 0
        ? `Worst milestone slippage: ${Math.round(maxSlippageDays * 10) / 10} days`
        : `All ${milestones.length} milestones on track`,
    };
  }

  private static async scoreResourceOverload(eventId: string, orgId: string): Promise<ComponentScore> {
    try {
      const { ResourceConstraintService } = await import('./ResourceConstraintService');
      const constraints = await ResourceConstraintService.detectConstraints(eventId, orgId);
      return this.computeResourceOverloadScore(constraints);
    } catch (err) {
      return {
        name: 'Resource Overload',
        score: 100,
        weight: WEIGHTS.resource_overload,
        weighted: 100 * WEIGHTS.resource_overload,
        detail: 'Resource constraint analysis unavailable — no penalty applied',
      };
    }
  }

  private static async scoreProgressEarned(eventId: string, orgId: string): Promise<ComponentScore> {
    const activities = await prisma.activity.findMany({
      where: { event_id: eventId, organization_id: orgId, deleted_at: null },
      select: { progress_percent: true, status: true, planned_start: true, planned_end: true, duration_hours: true },
    });

    if (activities.length === 0) {
      return {
        name: 'Progress Earned Value',
        score: 100,
        weight: WEIGHTS.progress_earned,
        weighted: 100 * WEIGHTS.progress_earned,
        detail: 'No activities',
      };
    }

    const now = new Date();
    let totalPlannedProgress = 0;
    let totalActualProgress = 0;

    for (const act of activities) {
      const ps = act.planned_start ? new Date(act.planned_start) : null;
      const pe = act.planned_end ? new Date(act.planned_end) : null;
      const durHrs = act.duration_hours ? Number(act.duration_hours) : 0;
      const actualProg = act.progress_percent ?? 0;

      totalActualProgress += actualProg * durHrs;

      if (ps && pe && durHrs > 0) {
        const totalDur = pe.getTime() - ps.getTime();
        const elapsed = Math.max(0, Math.min(now.getTime() - ps.getTime(), totalDur));
        const plannedProg = totalDur > 0 ? (elapsed / totalDur) * 100 : 0;
        totalPlannedProgress += plannedProg * durHrs;
      }
    }

    const spi = totalPlannedProgress > 0
      ? (totalActualProgress / totalPlannedProgress) * 100
      : 100;

    const score = Math.min(100, Math.max(0, spi));
    return {
      name: 'Progress Earned Value',
      score: Math.round(score * 10) / 10,
      weight: WEIGHTS.progress_earned,
      weighted: Math.round(score * WEIGHTS.progress_earned * 10) / 10,
      detail: `SPI (weighted): ${Math.round(spi * 10) / 10}%`,
    };
  }

  private static async scoreBaselineVariance(eventId: string, orgId: string): Promise<ComponentScore> {
    const variance = await ScheduleVarianceService.calculateVariance(eventId, orgId);

    if (!variance) {
      return {
        name: 'Baseline Variance',
        score: 100,
        weight: WEIGHTS.baseline_variance,
        weighted: 100 * WEIGHTS.baseline_variance,
        detail: 'No baseline assigned — variance cannot be measured',
      };
    }

    const avgVar = Math.abs(variance.avg_start_variance_days);
    const score = Math.max(0, 100 - (avgVar * 5));
    return {
      name: 'Baseline Variance',
      score: Math.round(score * 10) / 10,
      weight: WEIGHTS.baseline_variance,
      weighted: Math.round(score * WEIGHTS.baseline_variance * 10) / 10,
      detail: `${variance.activities_delayed} activities delayed, avg variance: ${variance.avg_start_variance_days} days`,
    };
  }

  // ── Classification ─────────────────────────────────────────────────

  static classify(shi: number): HealthClassification {
    if (shi >= 80) return 'GREEN';
    if (shi >= 60) return 'YELLOW';
    if (shi >= 40) return 'ORANGE';
    return 'RED';
  }
}
