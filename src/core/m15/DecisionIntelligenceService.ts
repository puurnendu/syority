/**
 * M15 — Decision Intelligence Facade
 *
 * Composes M8–M13 authorities. Does not calculate progress, CPM, or readiness.
 * Does not call ExecutionWriteService or ResourceLevelingApplyService.
 */

import { prisma } from '@/lib/prisma';
import { ControlTowerQueryService } from '@/core/control-tower/ControlTowerQueryService';
import type { ControlTowerException } from '@/core/control-tower/ControlTowerQueryService';
import { CONTROL_TOWER_RULES } from '@/core/control-tower/ControlTowerRules';
import { ScheduleForecastService } from '@/core/resources/ScheduleForecastService';
import { CriticalPathIntelligenceService } from '@/core/resources/CriticalPathIntelligenceService';
import { ResourceRiskService } from '@/core/resources/ResourceRiskService';
import { ScheduleOrchestrationService } from '@/core/schedule/ScheduleOrchestrationService';
import { calculateLiveEvm } from '@/core/evm/EvmSnapshotService';
import { ScenarioPlanningService } from '@/core/schedule/scenario/ScenarioPlanningService';
import { ScenarioCalculationService } from '@/core/schedule/scenario/ScenarioCalculationService';
import type {
  DecisionResultBase,
  EvidenceLayer,
  ForecastAssumption,
  ForecastQuality,
  ForecastResult,
  ForecastType,
  ImpactResult,
  ImpactSlice,
  IntelligenceEvidence,
  ManagementRecommendation,
  ManagementRecommendationResult,
  ManagementRisk,
  ManagementRiskResult,
  WhatIfInput,
  WhatIfKind,
  WhatIfResult,
  ManagementDecisionRecord,
  ManagementDecisionValue,
} from './types';
import { DecisionContextError } from './types';
import {
  MANAGEMENT_PRIORITY_MODEL,
  computeManagementPriority,
  riskTypeFromException,
} from './managementPriority';
import { composeRecommendation, RECOMMENDATION_COMPOSE_MODEL } from './recommendationComposer';
import { ResourceLevelingService } from '@/core/resources/ResourceLevelingService';
import { ManagementDecisionService } from './ManagementDecisionService';
import {
  resolveRecommendationReference,
  type RecommendationResolveQuery,
  type RecommendationResolveResult,
} from './recommendationResolver';

const M15_EXCEPTION_LIMIT = 500;
const M15_RECOMMENDATION_LIMIT = 50;

function nowIso(): string {
  return new Date().toISOString();
}

function evidence(partial: Omit<IntelligenceEvidence, 'layer'> & { layer?: EvidenceLayer }): IntelligenceEvidence {
  return {
    layer: partial.layer ?? 'FACT',
    entityType: partial.entityType,
    entityId: partial.entityId,
    entityLabel: partial.entityLabel,
    metric: partial.metric,
    value: partial.value,
    unit: partial.unit,
    sourceAuthority: partial.sourceAuthority,
    sourceService: partial.sourceService,
    sourceRecord: partial.sourceRecord,
    observedAt: partial.observedAt,
    explanation: partial.explanation,
  };
}

function uniqueAuthorities(items: string[]): string[] {
  return [...new Set(items)];
}

export class DecisionIntelligenceService {
  static async assertEventScope(organizationId: string, eventId: string): Promise<void> {
    if (!organizationId || !eventId) {
      throw new DecisionContextError('organizationId and eventId are required', 'EVENT_REQUIRED');
    }
    const event = await prisma.event.findFirst({
      where: { id: eventId, organization_id: organizationId, deleted_at: null },
      select: { id: true },
    });
    if (!event) {
      throw new DecisionContextError('Event not found for this organization', 'EVENT_NOT_FOUND');
    }
  }

  static async getManagementRisks(
    organizationId: string,
    eventId: string
  ): Promise<ManagementRiskResult> {
    await this.assertEventScope(organizationId, eventId);
    const asOf = nowIso();

    const tower = await ControlTowerQueryService.getSummary(organizationId, eventId, {
      exceptionLimit: M15_EXCEPTION_LIMIT,
    });
    const cp = await CriticalPathIntelligenceService.analyze(eventId, organizationId);
    const downstreamByActivity = new Map<string, number>();
    for (const a of [...cp.critical_activities, ...cp.near_critical_activities]) {
      downstreamByActivity.set(a.activity_id, a.downstream_impact);
    }

    const risks: ManagementRisk[] = tower.exceptions.map((ex) =>
      this.fromException(organizationId, eventId, ex, downstreamByActivity, asOf)
    );

    try {
      const resourceRisks = await ResourceRiskService.getRisks(eventId, organizationId);
      for (const rr of resourceRisks) {
        const ranked = computeManagementPriority({ resourceSeverity: rr.severity });
        risks.push({
          id: `m15-risk:${eventId}:RESOURCE:${rr.risk_id}`,
          kind: 'RESOURCE',
          riskType: 'RESOURCE_CAPACITY_RISK',
          priority: ranked.priority,
          severity: ranked.priority,
          title: `Resource ${rr.severity}: ${rr.resource_type_name}`,
          statement: rr.reason,
          organizationId,
          eventId,
          sourceAuthority: 'ResourceRiskService',
          sourceService: 'ResourceRiskService.getRisks',
          calculatedAt: asOf,
          asOf,
          calculationType: 'INTELLIGENCE',
          rankingScore: ranked.score,
          rankingModel: MANAGEMENT_PRIORITY_MODEL,
          affectedEntities: [
            { entityType: 'event', entityId: eventId },
            { entityType: 'resource_type', entityId: rr.resource_type_id, label: rr.resource_type_name },
          ],
          impactSummary: `${rr.affected_activities.length} activities listed on this resource-risk record (count, not hours).`,
          forecastImpact: null,
          sourceAuthorities: uniqueAuthorities(['ResourceRiskService', ...ranked.signals.map((s) => s.sourceAuthority)]),
          evidence: [
            evidence({
              entityType: 'event',
              entityId: eventId,
              metric: 'resource_score',
              value: rr.score,
              sourceAuthority: 'ResourceRiskService',
              sourceService: 'ResourceRiskService.getRisks',
              sourceRecord: 'ResourceRisk.score',
              layer: 'CALCULATION',
            }),
            evidence({
              entityType: 'event',
              entityId: eventId,
              metric: 'recommended_action',
              value: rr.recommended_action,
              sourceAuthority: 'ResourceRiskService',
              sourceService: 'ResourceRiskService.getRisks',
              layer: 'RECOMMENDATION',
              explanation: 'Advisory text from ResourceRiskService. Not an executed action.',
            }),
            evidence({
              entityType: 'event',
              entityId: eventId,
              metric: 'affected_activity_count',
              value: rr.affected_activities.length,
              unit: 'count',
              sourceAuthority: 'ResourceRiskService',
              sourceService: 'ResourceRiskService.getRisks',
              layer: 'FACT',
            }),
            evidence({
              entityType: 'event',
              entityId: eventId,
              metric: 'management_priority_score',
              value: ranked.score,
              sourceAuthority: 'M15',
              sourceService: `${MANAGEMENT_PRIORITY_MODEL.id}@${MANAGEMENT_PRIORITY_MODEL.version}`,
              layer: 'INTELLIGENCE',
              explanation: ranked.signals.map((s) => `${s.name}=${s.points}`).join(', '),
            }),
          ],
        });
      }
    } catch {
      // Resource planning data may be absent; exception-based risks still return.
    }

    const rank: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
    risks.sort((a, b) => {
      const pd = rank[a.priority] - rank[b.priority];
      if (pd !== 0) return pd;
      return b.rankingScore - a.rankingScore;
    });

    const readinessComplete = tower.readinessCoverage ? tower.readinessCoverage.complete : true;
    const exceptionsTruncated = tower.exceptionCoverage?.truncated ?? false;

    return {
      organizationId,
      eventId,
      asOf,
      rankingModel: MANAGEMENT_PRIORITY_MODEL,
      completeness: {
        readinessComplete,
        readinessNotStartedCount: tower.readinessCoverage?.notStartedCount ?? null,
        readinessEvaluatedCount: tower.readinessCoverage?.evaluatedCount ?? null,
        exceptionsTruncated,
        exceptionsReturned: tower.exceptions.length,
        exceptionsTotal: tower.exceptionCoverage?.total ?? tower.exceptions.length,
      },
      risks,
    };
  }

  static async getRecommendations(
    organizationId: string,
    eventId: string,
    filters?: { priority?: string; category?: string; activityId?: string }
  ): Promise<ManagementRecommendationResult> {
    const bundle = await this.getManagementRisks(organizationId, eventId);
    let recommendations = bundle.risks.map(composeRecommendation);
    if (filters?.priority) {
      recommendations = recommendations.filter((r) => r.priority === filters.priority);
    }
    if (filters?.category) {
      recommendations = recommendations.filter((r) => r.category === filters.category);
    }
    if (filters?.activityId) {
      recommendations = recommendations.filter((r) =>
        r.affectedEntities.some((e) => e.entityType === 'activity' && e.entityId === filters.activityId)
      );
    }
    const truncated = recommendations.length > M15_RECOMMENDATION_LIMIT;
    recommendations = recommendations.slice(0, M15_RECOMMENDATION_LIMIT);
    return {
      organizationId: bundle.organizationId,
      eventId: bundle.eventId,
      asOf: bundle.asOf,
      rankingModel: bundle.rankingModel,
      recommendationModel: RECOMMENDATION_COMPOSE_MODEL,
      completeness: {
        ...bundle.completeness,
        recommendationsTruncated: truncated,
        recommendationsReturned: recommendations.length,
      },
      recommendations,
    };
  }

  static async getRecommendation(
    organizationId: string,
    eventId: string,
    recommendationId: string
  ): Promise<ManagementRecommendation | null> {
    const bundle = await this.getManagementRisks(organizationId, eventId);
    const rec = bundle.risks.map(composeRecommendation).find((r) => r.recommendationId === recommendationId);
    if (!rec) return null;
    if (rec.eventId !== eventId || rec.organizationId !== organizationId) return null;
    return rec;
  }

  /**
   * Resolve a natural/explicit reference against the current event-scoped set.
   * Never guesses when more than one candidate remains.
   */
  static async resolveRecommendation(
    organizationId: string,
    eventId: string,
    query: RecommendationResolveQuery
  ): Promise<RecommendationResolveResult> {
    const bundle = await this.getRecommendations(organizationId, eventId);
    return resolveRecommendationReference(eventId, bundle.recommendations, query);
  }

  static async recordManagementDecision(
    organizationId: string,
    eventId: string,
    userId: string | undefined,
    input: {
      recommendationId: string;
      decision: ManagementDecisionValue;
      rationale?: string | null;
      sourceChannel?: string;
      relatedScenarioId?: string | null;
    }
  ): Promise<ManagementDecisionRecord> {
    await this.assertEventScope(organizationId, eventId);
    if (!userId) {
      throw new DecisionContextError(
        'A human-authenticated user is required to record a management decision.',
        'HUMAN_REQUIRED'
      );
    }
    const rec = await this.getRecommendation(organizationId, eventId, input.recommendationId);
    return ManagementDecisionService.record({
      organizationId,
      eventId,
      userId,
      recommendationId: input.recommendationId,
      decision: input.decision,
      rationale: input.rationale,
      sourceChannel: input.sourceChannel ?? 'api',
      relatedScenarioId: input.relatedScenarioId,
      evidenceSnapshot: rec
        ? {
            recommendationId: rec.recommendationId,
            title: rec.title,
            problem: rec.problem,
            evidence: rec.evidence,
            asOf: rec.asOf,
            modelVersion: rec.modelVersion,
          }
        : { note: 'Recommendation not in current composition; id still event-scoped.' },
    });
  }

  static async listManagementDecisions(
    organizationId: string,
    eventId: string
  ): Promise<ManagementDecisionRecord[]> {
    await this.assertEventScope(organizationId, eventId);
    return ManagementDecisionService.list(organizationId, eventId);
  }

  static async getForecast(
    organizationId: string,
    eventId: string,
    options?: { scenarioId?: string; forecastType?: ForecastType }
  ): Promise<ForecastResult[]> {
    await this.assertEventScope(organizationId, eventId);
    const asOf = nowIso();
    const hoursPerDay = await ScheduleOrchestrationService.resolveWorkingHoursPerDay(eventId, organizationId);
    const results: ForecastResult[] = [];
    const wanted = options?.forecastType;
    const calendarAssumption: ForecastAssumption = {
      name: 'working_hours_per_day',
      value: hoursPerDay,
      sourceAuthority: 'M11',
    };

    if (!wanted || wanted === 'EXECUTION_FINISH_FORECAST') {
      const exec = await ScheduleForecastService.computeForecast(eventId, organizationId, hoursPerDay);
      const quality: ForecastQuality = {
        dataAsOf: asOf,
        actualProgressAvailable: exec.completed + exec.in_progress > 0,
        baselineAvailable: exec.project_planned_finish != null,
        cpmAvailable: null,
        resourceDataAvailable: null,
        scenarioAssumptionsPresent: false,
        confidence: 'NOT_AVAILABLE',
      };
      results.push({
        forecastType: 'EXECUTION_FINISH_FORECAST',
        value: exec.project_forecast_finish,
        unit: 'date',
        explanation:
          'Likely completion if current execution trajectory continues (remaining duration / earned progress / planned). Not CPM and not EAC.',
        organizationId,
        eventId,
        sourceAuthority: 'M8.8',
        sourceService: 'ScheduleForecastService.computeForecast',
        calculatedAt: asOf,
        asOf,
        calculationType: 'CALCULATION',
        assumptions: [
          calendarAssumption,
          { name: 'method', value: 'execution_trajectory', sourceAuthority: 'M8.8' },
        ],
        quality,
        evidence: [
          evidence({
            entityType: 'event',
            entityId: eventId,
            metric: 'project_forecast_finish',
            value: exec.project_forecast_finish,
            unit: 'date',
            sourceAuthority: 'M8.8',
            sourceService: 'ScheduleForecastService',
            sourceRecord: 'ForecastSummary.project_forecast_finish',
            layer: 'CALCULATION',
          }),
          evidence({
            entityType: 'event',
            entityId: eventId,
            metric: 'project_planned_finish',
            value: exec.project_planned_finish,
            unit: 'date',
            sourceAuthority: 'M8.8',
            sourceService: 'ScheduleForecastService',
            layer: 'FACT',
          }),
          evidence({
            entityType: 'event',
            entityId: eventId,
            metric: 'project_variance_days',
            value: exec.project_variance_days,
            unit: 'days',
            sourceAuthority: 'M8.8',
            sourceService: 'ScheduleForecastService',
            layer: 'CALCULATION',
          }),
          evidence({
            entityType: 'event',
            entityId: eventId,
            metric: 'hours_per_day',
            value: hoursPerDay,
            unit: 'hours',
            sourceAuthority: 'M11',
            sourceService: 'ScheduleOrchestrationService.resolveWorkingHoursPerDay',
            layer: 'FACT',
            explanation: 'Authoritative event/org calendar hours per day. Not a hard-coded 8/10/24.',
          }),
          evidence({
            entityType: 'event',
            entityId: eventId,
            metric: 'forecast_confidence',
            value: 'NOT_AVAILABLE',
            sourceAuthority: 'M15',
            sourceService: 'DecisionIntelligenceService.getForecast',
            layer: 'INTELLIGENCE',
            explanation: 'No validated statistical confidence model exists. Do not invent a percentage.',
          }),
        ],
      });
    }

    if (!wanted || wanted === 'EAC_COST_FORECAST') {
      const evm = await calculateLiveEvm(eventId, organizationId);
      const quality: ForecastQuality = {
        dataAsOf: asOf,
        actualProgressAvailable: evm != null,
        baselineAvailable: evm != null,
        cpmAvailable: null,
        resourceDataAvailable: null,
        scenarioAssumptionsPresent: false,
        confidence: 'NOT_AVAILABLE',
      };
      results.push({
        forecastType: 'EAC_COST_FORECAST',
        value: evm?.eac ?? null,
        unit: 'currency',
        explanation:
          'Estimate at Completion from M8.10 (cost performance). This is not a schedule finish date.',
        organizationId,
        eventId,
        sourceAuthority: 'M8.10',
        sourceService: 'calculateLiveEvm',
        calculatedAt: asOf,
        asOf,
        calculationType: 'CALCULATION',
        assumptions: [{ name: 'formula', value: 'EAC from CPI/BAC/EV/AC', sourceAuthority: 'M8.10' }],
        quality,
        evidence: [
          evidence({
            entityType: 'event',
            entityId: eventId,
            metric: 'eac',
            value: evm?.eac ?? null,
            unit: 'currency',
            sourceAuthority: 'M8.10',
            sourceService: 'EvmCalculationService',
            sourceRecord: 'EvmSummary.eac',
            layer: 'CALCULATION',
          }),
          evidence({
            entityType: 'event',
            entityId: eventId,
            metric: 'cpi',
            value: evm?.cpi ?? null,
            sourceAuthority: 'M8.10',
            sourceService: 'EvmCalculationService',
            layer: 'CALCULATION',
          }),
          evidence({
            entityType: 'event',
            entityId: eventId,
            metric: 'spi',
            value: evm?.spi ?? null,
            sourceAuthority: 'M8.10',
            sourceService: 'EvmCalculationService',
            layer: 'CALCULATION',
          }),
          evidence({
            entityType: 'event',
            entityId: eventId,
            metric: 'bac',
            value: evm?.bac ?? null,
            unit: 'currency',
            sourceAuthority: 'M8.10',
            sourceService: 'EvmCalculationService',
            layer: 'FACT',
          }),
          evidence({
            entityType: 'event',
            entityId: eventId,
            metric: 'forecast_confidence',
            value: 'NOT_AVAILABLE',
            sourceAuthority: 'M15',
            sourceService: 'DecisionIntelligenceService.getForecast',
            layer: 'INTELLIGENCE',
          }),
        ],
      });
    }

    if (wanted === 'SCHEDULE_SCENARIO_FINISH' || options?.scenarioId) {
      if (!options?.scenarioId) {
        throw new DecisionContextError(
          'scenarioId is required for SCHEDULE_SCENARIO_FINISH',
          'SCENARIO_NOT_FOUND'
        );
      }
      const scenario = await prisma.scheduleScenario.findFirst({
        where: {
          id: options.scenarioId,
          organization_id: organizationId,
          event_id: eventId,
        },
        select: { id: true, snapshot_json: true, status: true, name: true },
      });
      if (!scenario) {
        throw new DecisionContextError('Scenario not found for this organization and event', 'SCENARIO_NOT_FOUND');
      }
      const snap = (scenario.snapshot_json ?? {}) as Record<string, any>;
      const finish = snap?.cpm_result?.project_finish ?? null;
      const snapHours = snap?.calendar?.working_hours_per_day ?? hoursPerDay;
      const quality: ForecastQuality = {
        dataAsOf: snap?.calculation_time ?? asOf,
        actualProgressAvailable: null,
        baselineAvailable: snap?.base_baseline_id != null,
        cpmAvailable: snap?.cpm_result != null,
        resourceDataAvailable: snap?.resource_analysis != null,
        scenarioAssumptionsPresent: true,
        confidence: 'NOT_AVAILABLE',
      };
      results.push({
        forecastType: 'SCHEDULE_SCENARIO_FINISH',
        value: finish,
        unit: 'date',
        explanation:
          'CPM network finish under this scenario snapshot (M8.9 / calculateSchedule in-memory). Not live Activity CPM and not EAC.',
        organizationId,
        eventId,
        sourceAuthority: 'M8.9/M11',
        sourceService: 'ScheduleScenario.snapshot_json',
        calculatedAt: asOf,
        asOf,
        calculationType: 'CALCULATION',
        assumptions: [
          { name: 'working_hours_per_day', value: snapHours, sourceAuthority: 'M11' },
          { name: 'scenario_id', value: scenario.id, sourceAuthority: 'M8.9' },
          { name: 'in_memory_cpm', value: true, sourceAuthority: 'M11' },
        ],
        quality,
        evidence: [
          evidence({
            entityType: 'scenario',
            entityId: scenario.id,
            entityLabel: scenario.name,
            metric: 'status',
            value: scenario.status,
            sourceAuthority: 'M8.9',
            sourceService: 'ScheduleScenario',
            layer: 'FACT',
          }),
          evidence({
            entityType: 'scenario',
            entityId: scenario.id,
            metric: 'project_finish',
            value: finish,
            unit: 'date',
            sourceAuthority: 'M11',
            sourceService: 'calculateSchedule',
            sourceRecord: 'snapshot_json.cpm_result.project_finish',
            layer: 'CALCULATION',
          }),
          evidence({
            entityType: 'scenario',
            entityId: scenario.id,
            metric: 'calendar_hours_per_day',
            value: snapHours,
            unit: 'hours',
            sourceAuthority: 'M11',
            sourceService: 'ScheduleOrchestrationService.resolveWorkingHoursPerDay',
            layer: 'FACT',
          }),
          evidence({
            entityType: 'scenario',
            entityId: scenario.id,
            metric: 'forecast_confidence',
            value: 'NOT_AVAILABLE',
            sourceAuthority: 'M15',
            sourceService: 'DecisionIntelligenceService.getForecast',
            layer: 'INTELLIGENCE',
          }),
        ],
      });
    }

    return results;
  }

  static async getImpact(
    organizationId: string,
    eventId: string,
    activityId: string,
    slipHours: number
  ): Promise<ImpactResult> {
    await this.assertEventScope(organizationId, eventId);
    const asOf = nowIso();

    const activity = await prisma.activity.findFirst({
      where: {
        id: activityId,
        organization_id: organizationId,
        event_id: eventId,
        deleted_at: null,
      },
      select: {
        id: true,
        activity_number: true,
        description: true,
        is_critical: true,
        total_float: true,
        planned_end: true,
      },
    });
    if (!activity) {
      throw new DecisionContextError('Activity not found for this organization and event', 'ACTIVITY_NOT_FOUND');
    }

    const floatHours = activity.total_float !== null ? Number(activity.total_float) : null;
    const consumesFloat = floatHours !== null ? slipHours > 0 && slipHours >= floatHours : null;
    const base: Pick<DecisionResultBase, 'organizationId' | 'eventId' | 'calculatedAt' | 'asOf' | 'calculationType'> = {
      organizationId,
      eventId,
      calculatedAt: asOf,
      asOf,
      calculationType: 'INTELLIGENCE',
    };

    const slip: ImpactSlice = {
      ...base,
      impactKind: 'SLIP_IMPACT',
      activityId,
      value: slipHours,
      unit: 'hours',
      sourceAuthority: 'M11',
      sourceService: 'Activity.total_float (persisted CPM)',
      explanation:
        floatHours === null
          ? `A ${slipHours}h slip is recorded against this activity; persisted total float is unavailable so criticality change cannot be inferred from M11 fields.`
          : consumesFloat
            ? `A ${slipHours}h slip meets or exceeds persisted total float (${floatHours}h), so this activity would consume remaining float (M11 fields only — no live CPM recalculation).`
            : `A ${slipHours}h slip is within persisted total float (${floatHours}h).`,
      evidence: [
        evidence({
          entityType: 'activity',
          entityId: activityId,
          entityLabel: activity.activity_number ?? undefined,
          metric: 'slip_hours',
          value: slipHours,
          unit: 'hours',
          sourceAuthority: 'M15',
          sourceService: 'DecisionIntelligenceService.getImpact',
          layer: 'INTELLIGENCE',
          explanation: 'Requested slip input. Not a persisted schedule change.',
        }),
        evidence({
          entityType: 'activity',
          entityId: activityId,
          metric: 'total_float_hours',
          value: floatHours,
          unit: 'hours',
          sourceAuthority: 'M11',
          sourceService: 'Activity.total_float',
          sourceRecord: 'Activity.total_float',
          layer: 'CALCULATION',
        }),
        evidence({
          entityType: 'activity',
          entityId: activityId,
          metric: 'is_critical',
          value: activity.is_critical,
          sourceAuthority: 'M11',
          sourceService: 'Activity.is_critical',
          sourceRecord: 'Activity.is_critical',
          layer: 'FACT',
        }),
      ],
    };

    const cp = await CriticalPathIntelligenceService.analyze(eventId, organizationId);
    const downstream =
      cp.critical_activities.find((a) => a.activity_id === activityId)?.downstream_impact ??
      cp.near_critical_activities.find((a) => a.activity_id === activityId)?.downstream_impact ??
      null;

    let downstreamCount = downstream;
    if (downstreamCount === null) {
      const rels = await prisma.activityRelationship.count({
        where: {
          organization_id: organizationId,
          predecessor_id: activityId,
          successor: { event_id: eventId, organization_id: organizationId },
        },
      });
      downstreamCount = rels;
    }

    const network: ImpactSlice = {
      ...base,
      impactKind: 'NETWORK_IMPACT',
      activityId,
      value: downstreamCount,
      unit: 'activity_count',
      sourceAuthority: 'M11',
      sourceService: 'CriticalPathIntelligenceService / ActivityRelationship',
      explanation:
        `Downstream activity count=${downstreamCount} (activity count, not hours). networkCompletionImpactHours is not inferred from this count; use runImpactScenario for M8.9 finish impact.`,
      evidence: [
        evidence({
          entityType: 'activity',
          entityId: activityId,
          metric: 'downstream_activity_count',
          value: downstreamCount,
          unit: 'count',
          sourceAuthority: 'M11',
          sourceService: 'CriticalPathIntelligenceService',
          layer: 'CALCULATION',
          explanation: 'Transitive successor count inside this event. Not hours.',
        }),
      ],
    };

    let resourceHits = 0;
    let resourceStatement = 'No resource-risk records currently list this activity.';
    const resourceEvidence: IntelligenceEvidence[] = [];
    try {
      const rrs = await ResourceRiskService.getRisks(eventId, organizationId);
      const hits = rrs.filter((r) => r.affected_activities.includes(activityId));
      resourceHits = hits.length;
      if (hits.length > 0) {
        resourceStatement = `${hits.length} resource-risk record(s) include this activity (simulation/scoring only — not an applied leveling change).`;
      }
      resourceEvidence.push(
        evidence({
          entityType: 'activity',
          entityId: activityId,
          metric: 'resource_risk_hits',
          value: resourceHits,
          unit: 'count',
          sourceAuthority: 'ResourceRiskService',
          sourceService: 'ResourceRiskService.getRisks',
          layer: 'CALCULATION',
        })
      );
    } catch {
      resourceStatement = 'Resource risk data is unavailable for this event.';
      resourceEvidence.push(
        evidence({
          entityType: 'activity',
          entityId: activityId,
          metric: 'resource_risk_hits',
          value: 0,
          unit: 'count',
          sourceAuthority: 'ResourceRiskService',
          sourceService: 'ResourceRiskService.getRisks',
          layer: 'FACT',
        })
      );
    }

    const resource: ImpactSlice = {
      ...base,
      impactKind: 'RESOURCE_IMPACT',
      activityId,
      value: resourceHits,
      unit: 'risk_record_count',
      sourceAuthority: 'ResourceRiskService',
      sourceService: 'ResourceRiskService.getRisks',
      explanation: resourceStatement,
      evidence: resourceEvidence,
    };

    return {
      organizationId,
      eventId,
      activityId,
      slipHours,
      slip,
      network,
      resource,
      downstreamActivityCount: downstreamCount,
      networkCompletionImpactHours: null,
      calculatedAt: asOf,
      asOf,
    };
  }

  /**
   * Orchestrates M8.9 scenario calculation for a duration slip.
   * Writes only schedule_scenarios / overrides / snapshot — never live Activity CPM or EWS.
   */
  static async runImpactScenario(
    organizationId: string,
    eventId: string,
    userId: string,
    activityId: string,
    slipHours: number
  ): Promise<{ scenarioId: string; forecasts: ForecastResult[]; snapshotFinish: string | null }> {
    await this.assertEventScope(organizationId, eventId);

    const activity = await prisma.activity.findFirst({
      where: {
        id: activityId,
        organization_id: organizationId,
        event_id: eventId,
        deleted_at: null,
      },
      select: { id: true, duration_hours: true },
    });
    if (!activity) {
      throw new DecisionContextError('Activity not found for this organization and event', 'ACTIVITY_NOT_FOUND');
    }

    const baseline = await prisma.scheduleBaseline.findFirst({
      where: { organization_id: organizationId, event_id: eventId, is_current: true },
      select: { id: true },
    });
    if (!baseline) {
      throw new DecisionContextError('No current schedule baseline for this event', 'SCENARIO_NOT_FOUND');
    }

    const scenario = await ScenarioPlanningService.createScenario(
      organizationId,
      eventId,
      userId,
      {
        name: `M15 slip ${slipHours}h ${activityId}`,
        description: 'M15 impact scenario (simulation only)',
        base_baseline_id: baseline.id,
      }
    );

    const currentHours = activity.duration_hours != null ? Number(activity.duration_hours) : 0;
    await ScenarioPlanningService.setActivityOverride(scenario.id, organizationId, userId, {
      activity_id: activityId,
      duration_hours: currentHours + slipHours,
    });

    await ScenarioCalculationService.calculate(scenario.id, organizationId, userId);

    const forecasts = await this.getForecast(organizationId, eventId, {
      scenarioId: scenario.id,
      forecastType: 'SCHEDULE_SCENARIO_FINISH',
    });

    return {
      scenarioId: scenario.id,
      forecasts,
      snapshotFinish: (forecasts[0]?.value as string | null) ?? null,
    };
  }

  /**
   * Explicit what-if. Unsupported kinds return NOT_SUPPORTED (never faked).
   * M8.9 writes scenario store only. Leveling simulation is in-memory PROPOSED rows.
   */
  static async runWhatIf(
    organizationId: string,
    eventId: string,
    userId: string | undefined,
    input: WhatIfInput
  ): Promise<WhatIfResult> {
    await this.assertEventScope(organizationId, eventId);
    const asOf = nowIso();
    const kind: WhatIfKind = input.kind;

    const unsupported: WhatIfKind[] = ['ADDITIONAL_CREWS', 'CONSTRAINT_REMOVAL', 'SCOPE_CHANGE'];
    if (unsupported.includes(kind)) {
      return {
        status: 'NOT_SUPPORTED',
        kind,
        hypothetical: true,
        organizationId,
        eventId,
        asOf,
        reason:
          kind === 'SCOPE_CHANGE'
            ? 'M8.11 scope-change impact is a heuristic and is not used as CPM/network what-if.'
            : `What-if kind ${kind} is not represented on M8.9 ScenarioActivityOverride (duration_hours / planned_start / planned_end only).`,
      };
    }

    if (kind === 'RESOURCE_LEVELING_SIMULATION') {
      const sim = await ResourceLevelingService.generateLevelingRecommendations(eventId, organizationId);
      return {
        status: 'CALCULATED',
        kind,
        hypothetical: true,
        organizationId,
        eventId,
        asOf,
        assumptions: [
          { name: 'simulation_only', value: true, sourceAuthority: 'ResourceLevelingService' },
          { name: 'does_not_apply_leveling', value: true, sourceAuthority: 'M15' },
        ],
        forecasts: [],
        snapshotFinish: sim.project_finish_after ?? null,
        baselineFinishDeltaDays: sim.project_finish_impact ?? null,
        levelingSimulation: {
          proposedChangeCount: sim.proposed_changes.length,
          projectFinishBefore: sim.project_finish_before ?? null,
          projectFinishAfter: sim.project_finish_after ?? null,
          projectFinishImpact: sim.project_finish_impact ?? null,
          constraintsResolved: sim.constraints_resolved,
          note: 'PROPOSED leveling rows only. ResourceLevelingApplyService is not called.',
        },
        explanation:
          'In-memory resource leveling simulation. Status PROPOSED is not an applied schedule change.',
      };
    }

    if (!userId) {
      return {
        status: 'INSUFFICIENT_DATA',
        kind,
        hypothetical: true,
        organizationId,
        eventId,
        asOf,
        reason: 'Trusted session userId is required to persist an M8.9 simulation snapshot.',
      };
    }
    if (!input.activityId) {
      return {
        status: 'INSUFFICIENT_DATA',
        kind,
        hypothetical: true,
        organizationId,
        eventId,
        asOf,
        reason: 'activityId is required for duration/start what-if kinds.',
      };
    }

    const activity = await prisma.activity.findFirst({
      where: {
        id: input.activityId,
        organization_id: organizationId,
        event_id: eventId,
        deleted_at: null,
      },
      select: { id: true, duration_hours: true, planned_start: true },
    });
    if (!activity) {
      throw new DecisionContextError('Activity not found for this organization and event', 'ACTIVITY_NOT_FOUND');
    }

    const baseline = await prisma.scheduleBaseline.findFirst({
      where: { organization_id: organizationId, event_id: eventId, is_current: true },
      select: { id: true },
    });
    if (!baseline) {
      return {
        status: 'INSUFFICIENT_DATA',
        kind,
        hypothetical: true,
        organizationId,
        eventId,
        asOf,
        reason: 'No current schedule baseline for this event; M8.9 cannot calculate.',
      };
    }

    const currentHours = activity.duration_hours != null ? Number(activity.duration_hours) : 0;
    let durationHours: number | undefined;
    let plannedStart: string | undefined;
    const assumptions: ForecastAssumption[] = [
      { name: 'hypothetical', value: true, sourceAuthority: 'M8.9' },
      { name: 'in_memory_cpm', value: true, sourceAuthority: 'M11' },
    ];

    if (kind === 'DURATION_SLIP') {
      const slip = Number(input.slipHours ?? 0);
      if (!Number.isFinite(slip) || slip < 0) {
        return {
          status: 'INSUFFICIENT_DATA',
          kind,
          hypothetical: true,
          organizationId,
          eventId,
          asOf,
          reason: 'slipHours must be a non-negative number.',
        };
      }
      durationHours = currentHours + slip;
      assumptions.push({ name: 'slip_hours', value: slip, sourceAuthority: 'M15' });
    } else if (kind === 'DURATION_CHANGE') {
      const abs = Number(input.durationHours);
      if (!Number.isFinite(abs) || abs < 0) {
        return {
          status: 'INSUFFICIENT_DATA',
          kind,
          hypothetical: true,
          organizationId,
          eventId,
          asOf,
          reason: 'durationHours must be a non-negative number.',
        };
      }
      durationHours = abs;
      assumptions.push({ name: 'duration_hours', value: abs, sourceAuthority: 'M15' });
    } else if (kind === 'DELAYED_START') {
      const days = Number(input.delayDays ?? 0);
      if (!Number.isFinite(days) || days < 0) {
        return {
          status: 'INSUFFICIENT_DATA',
          kind,
          hypothetical: true,
          organizationId,
          eventId,
          asOf,
          reason: 'delayDays must be a non-negative number.',
        };
      }
      if (!activity.planned_start) {
        return {
          status: 'INSUFFICIENT_DATA',
          kind,
          hypothetical: true,
          organizationId,
          eventId,
          asOf,
          reason: 'Activity has no planned_start; delayed-start what-if cannot be constructed.',
        };
      }
      const shifted = new Date(activity.planned_start);
      shifted.setUTCDate(shifted.getUTCDate() + days);
      plannedStart = shifted.toISOString();
      assumptions.push({ name: 'delay_days', value: days, sourceAuthority: 'M15' });
    }

    const scenario = await ScenarioPlanningService.createScenario(organizationId, eventId, userId, {
      name: `M15 what-if ${kind} ${input.activityId}`,
      description: 'M15-R3 hypothetical scenario (simulation only)',
      base_baseline_id: baseline.id,
    });

    await ScenarioPlanningService.setActivityOverride(scenario.id, organizationId, userId, {
      activity_id: input.activityId,
      duration_hours: durationHours,
      planned_start: plannedStart,
    });

    await ScenarioCalculationService.calculate(scenario.id, organizationId, userId);
    const forecasts = await this.getForecast(organizationId, eventId, {
      scenarioId: scenario.id,
      forecastType: 'SCHEDULE_SCENARIO_FINISH',
    });

    const scenarioRow = await prisma.scheduleScenario.findFirst({
      where: { id: scenario.id, organization_id: organizationId, event_id: eventId },
      select: { snapshot_json: true },
    });
    const snap = (scenarioRow?.snapshot_json ?? {}) as Record<string, any>;
    const delta = snap?.impact_summary?.project_finish_delta;
    const baselineFinishDeltaDays = typeof delta === 'number' ? delta : null;

    return {
      status: 'CALCULATED',
      kind,
      hypothetical: true,
      organizationId,
      eventId,
      asOf,
      assumptions,
      forecasts,
      snapshotFinish: (forecasts[0]?.value as string | null) ?? null,
      baselineFinishDeltaDays,
      scenarioId: scenario.id,
      explanation:
        'Hypothetical M8.9 snapshot. project_finish_delta is scenario vs baseline (M8.9), not inferred from downstream activity count. Live Activity is unchanged.',
    };
  }

  private static fromException(
    organizationId: string,
    eventId: string,
    ex: ControlTowerException,
    downstreamByActivity: Map<string, number>,
    asOf: string
  ): ManagementRisk {
    const rule = CONTROL_TOWER_RULES[ex.reason];
    const downstream = downstreamByActivity.get(ex.activityId);
    const tag = ex.equipmentName || ex.activityIdCode || ex.description || ex.activityId;
    const downstreamClause =
      downstream !== undefined
        ? ` It has ${downstream} downstream activities in the M11 relationship network (count, not hours).`
        : '';
    const statement =
      ex.reason === 'CRITICAL_LATE'
        ? `Critical late activity ${tag} is likely to affect TA completion because it is on the critical path.${downstreamClause}`
        : `${rule?.description ?? ex.reason} (${tag}).${downstreamClause}`;

    const ranked = computeManagementPriority({
      m13Severity: ex.severity,
      isCritical: ex.isCritical,
      downstreamCount: downstream,
      exceptionCode: ex.reason,
    });

    const riskType = riskTypeFromException(ex.reason, ex.isCritical);
    const sourceAuthorities = uniqueAuthorities([
      'M13',
      'M11',
      'M8.13',
      'M8.10',
      ...ranked.signals.map((s) => s.sourceAuthority),
    ]);

    return {
      id: `m15-risk:${eventId}:EXCEPTION:${ex.activityId}:${ex.reason}`,
      kind: 'EXCEPTION',
      riskType,
      priority: ranked.priority,
      severity: ranked.priority,
      exceptionSeverity: ex.severity,
      title: `${ex.reason}: ${tag}`,
      statement,
      exceptionCode: ex.reason,
      activityId: ex.activityId,
      workpackId: ex.workpackId ?? undefined,
      organizationId,
      eventId,
      sourceAuthority: 'M13',
      sourceService: 'ControlTowerQueryService.getSummary',
      calculatedAt: asOf,
      asOf,
      calculationType: 'INTELLIGENCE',
      rankingScore: ranked.score,
      rankingModel: MANAGEMENT_PRIORITY_MODEL,
      affectedEntities: [
        { entityType: 'activity', entityId: ex.activityId, label: tag },
        ...(ex.workpackId ? [{ entityType: 'workpack', entityId: ex.workpackId, label: ex.workpackName ?? undefined }] : []),
      ],
      impactSummary: statement,
      forecastImpact: null,
      sourceAuthorities,
      evidence: [
        evidence({
          entityType: 'activity',
          entityId: ex.activityId,
          entityLabel: tag,
          metric: 'exception_code',
          value: ex.reason,
          sourceAuthority: 'M13',
          sourceService: 'ControlTowerRules',
          sourceRecord: 'ControlTowerException.reason',
          layer: 'FACT',
          explanation: 'M13 detection. M15 does not re-evaluate LATE/CRITICAL_LATE.',
        }),
        evidence({
          entityType: 'activity',
          entityId: ex.activityId,
          metric: 'm13_severity',
          value: ex.severity,
          sourceAuthority: 'M13',
          sourceService: 'ControlTowerRules',
          layer: 'FACT',
        }),
        evidence({
          entityType: 'activity',
          entityId: ex.activityId,
          metric: 'is_critical',
          value: ex.isCritical,
          sourceAuthority: 'M11',
          sourceService: 'Activity.is_critical',
          sourceRecord: 'Activity.is_critical',
          layer: 'FACT',
        }),
        evidence({
          entityType: 'activity',
          entityId: ex.activityId,
          metric: 'total_float',
          value: ex.totalFloat,
          sourceAuthority: 'M11',
          sourceService: 'Activity.total_float',
          layer: 'CALCULATION',
        }),
        evidence({
          entityType: 'activity',
          entityId: ex.activityId,
          metric: 'spi',
          value: ex.spi,
          sourceAuthority: 'M8.10',
          sourceService: 'calculateActivityEvm',
          layer: 'CALCULATION',
        }),
        evidence({
          entityType: 'activity',
          entityId: ex.activityId,
          metric: 'progress_percent',
          value: ex.progressPercent,
          unit: '%',
          sourceAuthority: 'M8.13',
          sourceService: 'Activity.progress_percent',
          sourceRecord: 'Activity.progress_percent',
          layer: 'FACT',
        }),
        ...(downstream !== undefined
          ? [
              evidence({
                entityType: 'activity',
                entityId: ex.activityId,
                metric: 'downstream_activity_count',
                value: downstream,
                unit: 'count',
                sourceAuthority: 'M11',
                sourceService: 'CriticalPathIntelligenceService',
                layer: 'CALCULATION',
                explanation: 'Count of downstream activities, not hours.',
              }),
            ]
          : []),
        evidence({
          entityType: 'activity',
          entityId: ex.activityId,
          metric: 'management_priority_score',
          value: ranked.score,
          sourceAuthority: 'M15',
          sourceService: `${MANAGEMENT_PRIORITY_MODEL.id}@${MANAGEMENT_PRIORITY_MODEL.version}`,
          layer: 'INTELLIGENCE',
          explanation: ranked.signals.map((s) => `${s.name}=${s.points}`).join(', '),
        }),
      ],
    };
  }
}
