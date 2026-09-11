import { prisma } from '@/lib/prisma';
import { ProgressAggregationService } from '@/core/progress/ProgressAggregationService';
import { loadEvmActivities } from '@/core/evm/EvmSnapshotService';
import { calculateActivityEvm } from '@/core/evm/EvmCalculationService';
import { ExecutionReadinessService } from '@/core/execution/ExecutionReadinessService';
import { evaluateExceptions, ExceptionCode, CONTROL_TOWER_RULES } from './ControlTowerRules';
import type { DashboardProgressSummary, IdenticalActivityGroup, DimensionProgress } from '@/core/progress/types';

export interface ControlTowerException {
  activityId: string;
  activityIdCode: string | null;
  description: string | null;
  workpackId: string | null;
  workpackName: string | null;
  equipmentId: string | null;
  equipmentName: string | null;
  unitCode: string | null;
  status: string | null;
  progressPercent: number;
  totalFloat: number;
  isCritical: boolean;
  spi: number | null;
  reason: ExceptionCode;
  severity: 'P1' | 'P2' | 'P3' | 'P4';
}

export interface LookaheadBin {
  horizon: '24h' | '48h' | '72h' | '7d' | '14d';
  upcomingActivitiesCount: number;
  plannedPercent: number | null;
  actualPercent: number;
  lateAtRiskCount: number;
  unreadyCount: number;
}

export interface ReadinessCoverage {
  notStartedCount: number;
  evaluatedCount: number;
  complete: boolean;
}

export interface ExceptionCoverage {
  total: number;
  returned: number;
  truncated: boolean;
  limit: number;
}

export interface ControlTowerSummary {
  organizationId: string;
  eventId: string;
  calculatedAt: string;
  progress: DashboardProgressSummary;
  identicalActivities: IdenticalActivityGroup[];
  byContractor: DimensionProgress[];
  byDiscipline: DimensionProgress[];
  lookahead: LookaheadBin[];
  schedule: {
    criticalPathCount: number;
    lateCount: number;
  };
  exceptions: ControlTowerException[];
  /** M12 bulk readiness coverage — never silently omit this when M15 consumes the summary. */
  readinessCoverage: ReadinessCoverage;
  exceptionCoverage: ExceptionCoverage;
}

export class ControlTowerQueryService {
  /**
   * Retrieves the authoritative control tower summary for an event.
   * Enforces tenant isolation (organizationId).
   */
  static async getSummary(
    organizationId: string,
    eventId: string,
    options?: { exceptionLimit?: number }
  ): Promise<ControlTowerSummary> {
    const exceptionLimit = options?.exceptionLimit ?? 100;
    const now = new Date();
    const nowMs = now.getTime();

    // 1. Get authoritative progress from M8.13
    // This is the sole authority for execution progress.
    const progressSummary = await ProgressAggregationService.getDashboardSummary(
      organizationId,
      eventId
    );

    // Get dimension summaries
    const eventProgress = await ProgressAggregationService.getEventProgress(
      organizationId,
      eventId,
      { includeIdenticalActivities: true, includeContractor: true, includeDiscipline: true }
    );
    const identicalActivities = eventProgress.identicalActivities || [];
    const byContractor = eventProgress.byContractor || [];
    const byDiscipline = eventProgress.byDiscipline || [];

    // 2. Load EVM baseline for SPI (M8.10 authority)
    const baseline = await prisma.scheduleBaseline.findFirst({
      where: { event_id: eventId, organization_id: organizationId, is_current: true },
      select: { id: true }
    });

    let evmActivities: any[] = [];
    if (baseline) {
      evmActivities = await loadEvmActivities(eventId, organizationId, baseline.id);
    }
    const spiMap = new Map<string, number | null>();
    for (const evmAct of evmActivities) {
      const result = calculateActivityEvm(evmAct, now);
      spiMap.set(result.activityId, result.spi);
    }

    // 3. Query for active activities and their metadata
    // We only evaluate exceptions for active items to save memory/processing.
    const activeActivities = await prisma.activity.findMany({
      where: {
        organization_id: organizationId,
        event_id: eventId,
        deleted_at: null,
        status: { notIn: ['cancelled', 'completed'] },
      },
      include: {
        workpack: {
          include: {
            asset: { select: { id: true, name: true, tag_number: true } },
            unit: { select: { code: true } }
          }
        }
      },
    });

    // 4. Gather constraints (M12)
    // Map workpack -> has critical constraints
    const criticalConstraints = await prisma.constraintLog.findMany({
      where: {
        organization_id: organizationId,
        severity: 'critical',
        status: { in: ['open', 'in_progress'] },
        deleted_at: null,
        workpack: {
          event_id: eventId,
          organization_id: organizationId,
          deleted_at: null,
        },
      },
      select: { workpack_id: true }
    });
    const constraintBlockedWorkpacks = new Set(
      criticalConstraints.map(c => c.workpack_id).filter(Boolean)
    );

    // 5. Gather readiness for not_started items. M12 is the sole readiness authority.
    // evaluateBulkReadiness is set-based (not N+1); do not skip at 5K — that hid READINESS_BLOCKED.
    const notStartedIds = activeActivities
      .filter(a => a.status === 'not_started' || a.status === null)
      .map(a => a.id);

    let readinessMap: Record<string, { is_ready: boolean; blockers: string[] }> = {};
    if (notStartedIds.length > 0) {
      readinessMap = await ExecutionReadinessService.evaluateBulkReadiness(organizationId, notStartedIds);
    }
    const evaluatedCount = notStartedIds.filter((id) => readinessMap[id] !== undefined).length;
    const readinessCoverage: ReadinessCoverage = {
      notStartedCount: notStartedIds.length,
      evaluatedCount,
      complete: notStartedIds.length === 0 || evaluatedCount === notStartedIds.length,
    };

    let criticalPathCount = 0;
    let lateCount = 0;
    const allExceptions: ControlTowerException[] = [];

    // Lookahead Horizons (Cumulative)
    const msInHour = 60 * 60 * 1000;
    const horizons = [
      { key: '24h', limit: nowMs + 24 * msInHour },
      { key: '48h', limit: nowMs + 48 * msInHour },
      { key: '72h', limit: nowMs + 72 * msInHour },
      { key: '7d', limit: nowMs + 7 * 24 * msInHour },
      { key: '14d', limit: nowMs + 14 * 24 * msInHour }
    ] as const;

    const lookaheadMap = new Map<string, {
      totalDuration: number;
      completedDuration: number;
      count: number;
      lateAtRiskCount: number;
      unreadyCount: number;
    }>();

    for (const h of horizons) {
      lookaheadMap.set(h.key, { totalDuration: 0, completedDuration: 0, count: 0, lateAtRiskCount: 0, unreadyCount: 0 });
    }

    // 6. Evaluate Rules
    for (const act of activeActivities) {
      const isCritical = act.is_critical || (act.total_float !== null && Number(act.total_float) <= 0);
      if (isCritical) {
        criticalPathCount++;
      }

      const plannedEndMs = act.planned_end?.getTime() ?? 0;
      const isLate = plannedEndMs > 0 && nowMs > plannedEndMs;
      if (isLate) {
        lateCount++;
      }

      const spi = spiMap.get(act.id) ?? 1.0;
      const hasReadinessBlockers = readinessMap[act.id] ? !readinessMap[act.id].is_ready : false;
      const hasCriticalConstraints = act.workpack_id ? constraintBlockedWorkpacks.has(act.workpack_id) : false;

      // Use the formal rule engine
      const ruleCodes = evaluateExceptions({
        progressPercent: act.progress_percent ? Number(act.progress_percent) : 0,
        status: act.status ?? 'not_started',
        totalFloat: act.total_float ? Number(act.total_float) : null,
        isCritical,
        plannedStart: act.planned_start,
        plannedEnd: act.planned_end,
        spi: spi !== null ? spi : 1.0,
        hasReadinessBlockers,
        hasCriticalConstraints,
        dataDateMs: nowMs
      });

      // Map rules to exceptions (an activity might trigger multiple rules, we pick the highest severity P1 > P2 > P3 > P4)
      let highestSeverity: 'P1'|'P2'|'P3'|'P4'|null = null;
      let primaryCode: ExceptionCode | null = null;
      
      if (ruleCodes.length > 0) {
        let maxSeverityStr = 'P4';
        primaryCode = ruleCodes[0];
        for (const code of ruleCodes) {
          const rule = CONTROL_TOWER_RULES[code];
          if (rule.severity < maxSeverityStr) {
            maxSeverityStr = rule.severity;
            primaryCode = code;
          }
        }
        highestSeverity = maxSeverityStr as 'P1'|'P2'|'P3'|'P4';

        const actAny = act as any;
        allExceptions.push({
          activityId: act.id,
          activityIdCode: act.activity_id,
          description: act.description,
          workpackId: act.workpack_id,
          workpackName: actAny.workpack?.description ?? null,
          equipmentId: actAny.workpack?.asset?.id ?? null,
          equipmentName: actAny.workpack?.asset?.tag_number ?? actAny.workpack?.asset?.name ?? null,
          unitCode: actAny.workpack?.unit?.code ?? null,
          status: act.status,
          progressPercent: act.progress_percent ? Number(act.progress_percent) : 0,
          totalFloat: act.total_float ? Number(act.total_float) : 0,
          isCritical,
          spi: spi !== null ? Number(spi.toFixed(2)) : null,
          reason: primaryCode,
          severity: highestSeverity,
        });
      }

      // Lookahead Aggregation
      if (act.planned_start) {
        const pStartMs = act.planned_start.getTime();
        const prog = act.progress_percent ? Number(act.progress_percent) : 0;
        const dur = act.duration_hours ? Number(act.duration_hours) : 0;
        const isExceptionAtRisk = ['P1', 'P2', 'P3'].includes(highestSeverity ?? '');

        for (const h of horizons) {
          if (pStartMs <= h.limit) {
            const bin = lookaheadMap.get(h.key)!;
            bin.count++;
            bin.totalDuration += dur;
            bin.completedDuration += dur * (prog / 100);
            if (isExceptionAtRisk) bin.lateAtRiskCount++;
            if (hasReadinessBlockers) bin.unreadyCount++;
          }
        }
      }
    }

    // Format lookahead bins
    const lookahead: LookaheadBin[] = horizons.map(h => {
      const bin = lookaheadMap.get(h.key)!;
      return {
        horizon: h.key,
        upcomingActivitiesCount: bin.count,
        plannedPercent: null, // M13 has no planned progress engine
        actualPercent: bin.totalDuration > 0 ? Math.round((bin.completedDuration / bin.totalDuration) * 100) : 0,
        lateAtRiskCount: bin.lateAtRiskCount,
        unreadyCount: bin.unreadyCount
      };
    });

    // Sort exceptions: P1 > P2 > P3 > P4, then by SPI ascending
    allExceptions.sort((a, b) => {
      if (a.severity !== b.severity) return a.severity.localeCompare(b.severity);
      return (a.spi ?? 1) - (b.spi ?? 1);
    });

    const returnedExceptions = allExceptions.slice(0, exceptionLimit);
    const exceptionCoverage: ExceptionCoverage = {
      total: allExceptions.length,
      returned: returnedExceptions.length,
      truncated: allExceptions.length > returnedExceptions.length,
      limit: exceptionLimit,
    };

    return {
      organizationId,
      eventId,
      calculatedAt: now.toISOString(),
      progress: progressSummary,
      identicalActivities,
      byContractor,
      byDiscipline,
      lookahead,
      schedule: {
        criticalPathCount,
        lateCount,
      },
      exceptions: returnedExceptions,
      readinessCoverage,
      exceptionCoverage,
    };
  }
}
