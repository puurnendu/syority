/**
 * M15-R5 — resolution, journal, provenance, performance.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { resolveRecommendationReference } from '../recommendationResolver';
import { composeRecommendation } from '../recommendationComposer';
import { MANAGEMENT_PRIORITY_MODEL } from '../managementPriority';
import { m15ToToolResult } from '../m16Adapter';
import type { ManagementRecommendation, ManagementRisk } from '../types';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    event: { findFirst: vi.fn() },
    activity: { findFirst: vi.fn() },
    activityRelationship: { count: vi.fn() },
    scheduleScenario: { findFirst: vi.fn() },
    scheduleBaseline: { findFirst: vi.fn() },
    m15_management_decisions: { create: vi.fn(), findMany: vi.fn(), update: vi.fn(), delete: vi.fn() },
  },
}));

vi.mock('@/lib/audit', () => ({
  AuditService: { log: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock('@/core/control-tower/ControlTowerQueryService', () => ({
  ControlTowerQueryService: { getSummary: vi.fn() },
}));
vi.mock('@/core/resources/CriticalPathIntelligenceService', () => ({
  CriticalPathIntelligenceService: { analyze: vi.fn() },
}));
vi.mock('@/core/resources/ResourceRiskService', () => ({
  ResourceRiskService: { getRisks: vi.fn() },
}));
vi.mock('@/core/resources/ScheduleForecastService', () => ({
  ScheduleForecastService: { computeForecast: vi.fn() },
}));
vi.mock('@/core/schedule/ScheduleOrchestrationService', () => ({
  ScheduleOrchestrationService: { resolveWorkingHoursPerDay: vi.fn() },
}));
vi.mock('@/core/evm/EvmSnapshotService', () => ({ calculateLiveEvm: vi.fn() }));
vi.mock('@/core/schedule/scenario/ScenarioPlanningService', () => ({
  ScenarioPlanningService: { createScenario: vi.fn(), setActivityOverride: vi.fn() },
}));
vi.mock('@/core/schedule/scenario/ScenarioCalculationService', () => ({
  ScenarioCalculationService: { calculate: vi.fn() },
}));
vi.mock('@/core/resources/ResourceLevelingService', () => ({
  ResourceLevelingService: { generateLevelingRecommendations: vi.fn() },
}));

import { prisma } from '@/lib/prisma';
import { AuditService } from '@/lib/audit';
import { ControlTowerQueryService } from '@/core/control-tower/ControlTowerQueryService';
import { CriticalPathIntelligenceService } from '@/core/resources/CriticalPathIntelligenceService';
import { ResourceRiskService } from '@/core/resources/ResourceRiskService';
import { DecisionIntelligenceService } from '../DecisionIntelligenceService';

const ORG_A = 'org-a';
const EVT_A = 'event-ta-2027';
const EVT_B = 'event-ta-2028';
const ROOT = path.resolve(__dirname, '../../../..');

function sampleRisk(id: string, eventId: string, title: string, activityId: string, label: string): ManagementRisk {
  return {
    id: `m15-risk:${eventId}:EXCEPTION:${activityId}:CRITICAL_LATE`,
    kind: 'EXCEPTION',
    riskType: 'CRITICAL_PATH_EXECUTION_RISK',
    priority: 'CRITICAL',
    severity: 'CRITICAL',
    exceptionSeverity: 'P1',
    title,
    statement: `${title} delayed`,
    exceptionCode: 'CRITICAL_LATE',
    activityId,
    organizationId: ORG_A,
    eventId,
    sourceAuthority: 'M13',
    sourceService: 'ControlTowerQueryService.getSummary',
    calculatedAt: '2026-09-08T00:00:00.000Z',
    asOf: '2026-09-08T00:00:00.000Z',
    calculationType: 'INTELLIGENCE',
    rankingScore: 72,
    rankingModel: MANAGEMENT_PRIORITY_MODEL,
    affectedEntities: [{ entityType: 'activity', entityId: activityId, label }],
    impactSummary: 'late',
    forecastImpact: null,
    sourceAuthorities: ['M13', 'M11'],
    evidence: [
      {
        entityType: 'activity',
        entityId: activityId,
        metric: 'exception_code',
        value: 'CRITICAL_LATE',
        sourceAuthority: 'M13',
        sourceService: 'ControlTowerRules',
        layer: 'FACT',
      },
    ],
  };
}

function rec(risk: ManagementRisk): ManagementRecommendation {
  return composeRecommendation(risk);
}

describe('M15-R5 recommendation reference resolution', () => {
  const hx = rec(sampleRisk('1', EVT_A, 'CRITICAL_LATE: HX-204', 'act-hx', 'HX-204'));
  const cdu = rec(sampleRisk('2', EVT_A, 'CRITICAL_LATE: CDU-101', 'act-cdu', 'CDU-101'));
  const hx2 = rec(sampleRisk('3', EVT_A, 'READINESS: HX-204 bundle', 'act-hx-b', 'HX-204'));

  it('resolves an explicit event-scoped id', () => {
    const result = resolveRecommendationReference(EVT_A, [hx, cdu], {
      recommendationId: hx.recommendationId,
    });
    expect(result.status).toBe('RESOLVED');
    if (result.status === 'RESOLVED') expect(result.recommendation.recommendationId).toBe(hx.recommendationId);
  });

  it('rejects another event id without guessing', () => {
    const other = rec(sampleRisk('x', EVT_B, 'CRITICAL_LATE: HX-204', 'act-hx', 'HX-204'));
    const result = resolveRecommendationReference(EVT_A, [hx], {
      recommendationId: other.recommendationId,
      text: 'Accept the HX-204 recommendation',
    });
    expect(result.status).toBe('NOT_FOUND');
  });

  it('asks when two HX-204 recommendations exist', () => {
    const result = resolveRecommendationReference(EVT_A, [hx, hx2, cdu], {
      text: 'Accept the recommendation for HX-204',
      equipmentTag: 'HX-204',
    });
    expect(result.status).toBe('AMBIGUOUS');
    if (result.status === 'AMBIGUOUS') expect(result.candidates.length).toBe(2);
  });

  it('uses the unique conversation recommendation for "this"', () => {
    const result = resolveRecommendationReference(EVT_A, [hx, cdu], {
      text: 'Accept this recommendation',
      conversationRecommendationIds: [hx.recommendationId],
    });
    expect(result.status).toBe('RESOLVED');
    if (result.status === 'RESOLVED') expect(result.recommendation.recommendationId).toBe(hx.recommendationId);
  });

  it('asks when conversation has two recs and the user says this', () => {
    const result = resolveRecommendationReference(EVT_A, [hx, cdu], {
      text: 'Accept this recommendation',
      conversationRecommendationIds: [hx.recommendationId, cdu.recommendationId],
    });
    expect(result.status).toBe('AMBIGUOUS');
  });

  it('resolves unique CDU text match', () => {
    const result = resolveRecommendationReference(EVT_A, [hx, cdu], {
      text: 'Defer the recommendation concerning the CDU',
    });
    expect(result.status).toBe('RESOLVED');
    if (result.status === 'RESOLVED') expect(result.recommendation.recommendationId).toBe(cdu.recommendationId);
  });
});

describe('M15-R5 evidence provenance', () => {
  it('keeps source authority, asOf, and compose model on composed recs', () => {
    const r = rec(sampleRisk('1', EVT_A, 'CRITICAL_LATE: HX-204', 'act-hx', 'HX-204'));
    expect(r.evidence[0].sourceAuthority).toBe('M13');
    expect(r.asOf).toBeTruthy();
    expect(r.modelVersion).toContain('m15-recommendation-compose');
    expect(r.estimatedImpact).toBeNull();
    expect(r.calculationType).toBe('RECOMMENDATION');
  });
});

describe('M15-R5 journal append-only and identity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.event.findFirst as any).mockResolvedValue({ id: EVT_A });
    (ControlTowerQueryService.getSummary as any).mockResolvedValue({
      exceptions: [],
      readinessCoverage: { complete: true, notStartedCount: 0, evaluatedCount: 0 },
    });
    (CriticalPathIntelligenceService.analyze as any).mockResolvedValue({
      critical_activities: [],
      near_critical_activities: [],
      high_downstream_impact: [],
      predecessor_concentration: [],
    });
    (ResourceRiskService.getRisks as any).mockResolvedValue([]);
  });

  it('does not update or delete journal rows', () => {
    const src = fs.readFileSync(path.join(ROOT, 'src/core/m15/ManagementDecisionService.ts'), 'utf-8');
    expect(src).toContain('m15_management_decisions.create');
    expect(src).not.toMatch(/m15_management_decisions\.(update|delete|upsert)/);
  });

  it('ignores authorizesExecution from LLM/API params', async () => {
    const recId = `m15-rec:${EVT_A}:m15-risk:${EVT_A}:EXCEPTION:act-hx:CRITICAL_LATE`;
    (prisma.m15_management_decisions.create as any).mockResolvedValue({
      id: 'dec-1',
      organization_id: ORG_A,
      event_id: EVT_A,
      recommendation_id: recId,
      decided_by: 'user-1',
      decision: 'ACCEPT',
      rationale: null,
      created_at: new Date('2026-09-08T00:00:00.000Z'),
      source_channel: 'web',
      related_scenario_id: null,
      evidence_snapshot: {},
      status: 'RECORDED',
    });
    const result = await m15ToToolResult(
      { organizationId: ORG_A, eventId: EVT_A, userId: 'user-1', sourceChannel: 'web' },
      'recordManagementDecision',
      { recommendationId: recId, decision: 'ACCEPT', authorizesExecution: true, organizationId: 'org-b', eventId: EVT_B }
    );
    expect(result.organizationId).toBe(ORG_A);
    expect(result.eventId).toBe(EVT_A);
    const data = result.data as { authorizesExecution: boolean };
    expect(data.authorizesExecution).toBe(false);
    expect(AuditService.log).toHaveBeenCalled();
    expect((prisma as any).m15_management_decisions.update).not.toHaveBeenCalled();
  });

  it('replay appends a second row instead of mutating', async () => {
    const recId = `m15-rec:${EVT_A}:m15-risk:${EVT_A}:EXCEPTION:act-hx:CRITICAL_LATE`;
    (prisma.m15_management_decisions.create as any)
      .mockResolvedValueOnce({
        id: 'dec-1',
        organization_id: ORG_A,
        event_id: EVT_A,
        recommendation_id: recId,
        decided_by: 'user-1',
        decision: 'ACCEPT',
        rationale: null,
        created_at: new Date(),
        source_channel: 'web',
        related_scenario_id: null,
        evidence_snapshot: {},
        status: 'RECORDED',
      })
      .mockResolvedValueOnce({
        id: 'dec-2',
        organization_id: ORG_A,
        event_id: EVT_A,
        recommendation_id: recId,
        decided_by: 'user-1',
        decision: 'ACCEPT',
        rationale: null,
        created_at: new Date(),
        source_channel: 'web',
        related_scenario_id: null,
        evidence_snapshot: {},
        status: 'RECORDED',
      });
    await DecisionIntelligenceService.recordManagementDecision(ORG_A, EVT_A, 'user-1', {
      recommendationId: recId,
      decision: 'ACCEPT',
    });
    await DecisionIntelligenceService.recordManagementDecision(ORG_A, EVT_A, 'user-1', {
      recommendationId: recId,
      decision: 'ACCEPT',
    });
    expect((prisma as any).m15_management_decisions.create).toHaveBeenCalledTimes(2);
    expect((prisma as any).m15_management_decisions.update).not.toHaveBeenCalled();
  });
});

describe('M15-R5 large recommendation composition', () => {
  it('composes 5000 recommendations deterministically under a time budget', () => {
    const started = Date.now();
    const rows = Array.from({ length: 5000 }, (_, i) =>
      composeRecommendation(sampleRisk(String(i), EVT_A, `LATE: A-${i}`, `act-${i}`, `EQ-${i}`))
    );
    const ms = Date.now() - started;
    expect(rows).toHaveLength(5000);
    expect(rows[0]).toEqual(composeRecommendation(sampleRisk('0', EVT_A, 'LATE: A-0', 'act-0', 'EQ-0')));
    expect(ms).toBeLessThan(4000);
  });
});

describe('M15-R5 conversational adapter (no first-match guess)', () => {
  function hxException(activityId: string, reason = 'CRITICAL_LATE') {
    return {
      activityId,
      activityIdCode: 'HX-204-BP',
      equipmentName: 'HX-204',
      reason,
      severity: 'P1',
      isCritical: true,
      progressPercent: 40,
      totalFloat: 2,
      spi: 0.7,
      status: 'in_progress',
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.event.findFirst as any).mockResolvedValue({ id: EVT_A });
    (CriticalPathIntelligenceService.analyze as any).mockResolvedValue({
      critical_activities: [],
      near_critical_activities: [],
      high_downstream_impact: [],
      predecessor_concentration: [],
    });
    (ResourceRiskService.getRisks as any).mockResolvedValue([]);
  });

  it('asks when two HX-204 recommendations exist in the event set', async () => {
    (ControlTowerQueryService.getSummary as any).mockResolvedValue({
      exceptions: [hxException('act-hx-a'), hxException('act-hx-b', 'READINESS_BLOCKED')],
      readinessCoverage: { complete: true, notStartedCount: 0, evaluatedCount: 0 },
    });
    const resolved = await DecisionIntelligenceService.resolveRecommendation(ORG_A, EVT_A, {
      text: 'Accept the recommendation for HX-204',
      equipmentTag: 'HX-204',
    });
    expect(resolved.status).toBe('AMBIGUOUS');
  });

  it('records ACCEPT from conversation last rec without executing', async () => {
    (ControlTowerQueryService.getSummary as any).mockResolvedValue({
      exceptions: [hxException('act-hx-a')],
      readinessCoverage: { complete: true, notStartedCount: 0, evaluatedCount: 0 },
    });
    const recId = `m15-rec:${EVT_A}:m15-risk:${EVT_A}:EXCEPTION:act-hx-a:CRITICAL_LATE`;
    (prisma.m15_management_decisions.create as any).mockResolvedValue({
      id: 'dec-conv',
      organization_id: ORG_A,
      event_id: EVT_A,
      recommendation_id: recId,
      decided_by: 'user-1',
      decision: 'ACCEPT',
      rationale: 'Accept this recommendation',
      created_at: new Date('2026-09-08T00:00:00.000Z'),
      source_channel: 'web',
      related_scenario_id: null,
      evidence_snapshot: {},
      status: 'RECORDED',
    });
    const result = await m15ToToolResult(
      { organizationId: ORG_A, eventId: EVT_A, userId: 'user-1', sourceChannel: 'web' },
      'recordManagementDecision',
      {
        decision: 'ACCEPT',
        text: 'Accept this recommendation',
        conversationRecommendationIds: [recId],
        authorizesExecution: true,
        organizationId: 'org-b',
        eventId: EVT_B,
      }
    );
    expect(result.status).toBe('SUCCESS');
    expect(result.organizationId).toBe(ORG_A);
    expect(result.eventId).toBe(EVT_A);
    expect((result.data as { authorizesExecution: boolean }).authorizesExecution).toBe(false);
    expect((prisma as any).m15_management_decisions.create).toHaveBeenCalledTimes(1);
  });

  it('does not resolve a guessed id from another event via text', async () => {
    (ControlTowerQueryService.getSummary as any).mockResolvedValue({
      exceptions: [hxException('act-hx-a')],
      readinessCoverage: { complete: true, notStartedCount: 0, evaluatedCount: 0 },
    });
    const other = `m15-rec:${EVT_B}:m15-risk:${EVT_B}:EXCEPTION:act-hx-a:CRITICAL_LATE`;
    const result = await m15ToToolResult(
      { organizationId: ORG_A, eventId: EVT_A, userId: 'user-1' },
      'getRecommendation',
      { recommendationId: other, text: 'Accept the HX-204 recommendation' }
    );
    expect(result.status).toBe('NOT_FOUND');
    expect(result.eventId).toBe(EVT_A);
  });
});

describe('M15-R5 source scan', () => {
  it('M15 still has no Activity mutation or EWS', () => {
    const dir = path.join(ROOT, 'src/core/m15');
    const src = fs
      .readdirSync(dir)
      .filter((f) => f.endsWith('.ts') && !f.includes('.test.'))
      .map((f) => fs.readFileSync(path.join(dir, f), 'utf-8'))
      .join('\n');
    expect(src).not.toMatch(/from ['"][^'"]*ExecutionWriteService/);
    expect(src).not.toMatch(/prisma\.activity\.(create|update|delete)/);
    expect(src).not.toContain('RecommendationEngine');
    expect(src).toContain('resolveRecommendationReference');
  });
});
