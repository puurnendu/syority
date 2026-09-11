/**
 * M15-R3 recommendations and what-if tests.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    event: { findFirst: vi.fn() },
    activity: { findFirst: vi.fn() },
    activityRelationship: { count: vi.fn() },
    scheduleScenario: { findFirst: vi.fn() },
    scheduleBaseline: { findFirst: vi.fn() },
  },
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

vi.mock('@/core/evm/EvmSnapshotService', () => ({
  calculateLiveEvm: vi.fn(),
}));

vi.mock('@/core/schedule/scenario/ScenarioPlanningService', () => ({
  ScenarioPlanningService: {
    createScenario: vi.fn(),
    setActivityOverride: vi.fn(),
  },
}));

vi.mock('@/core/schedule/scenario/ScenarioCalculationService', () => ({
  ScenarioCalculationService: { calculate: vi.fn() },
}));

vi.mock('@/core/resources/ResourceLevelingService', () => ({
  ResourceLevelingService: { generateLevelingRecommendations: vi.fn() },
}));

import { prisma } from '@/lib/prisma';
import { ControlTowerQueryService } from '@/core/control-tower/ControlTowerQueryService';
import { CriticalPathIntelligenceService } from '@/core/resources/CriticalPathIntelligenceService';
import { ResourceRiskService } from '@/core/resources/ResourceRiskService';
import { ScenarioPlanningService } from '@/core/schedule/scenario/ScenarioPlanningService';
import { ScenarioCalculationService } from '@/core/schedule/scenario/ScenarioCalculationService';
import { ResourceLevelingService } from '@/core/resources/ResourceLevelingService';
import { ScheduleOrchestrationService } from '@/core/schedule/ScheduleOrchestrationService';
import { DecisionIntelligenceService } from '../DecisionIntelligenceService';
import { m15ToToolResult } from '../m16Adapter';
import { composeRecommendation, RECOMMENDATION_COMPOSE_MODEL } from '../recommendationComposer';
import { MANAGEMENT_PRIORITY_MODEL } from '../managementPriority';
import type { ManagementRisk } from '../types';

const ORG_A = 'org-a';
const EVT_A = 'event-ta-2027';
const EVT_B = 'event-ta-2028';
const ACT_A = 'act-hx-204-a';
const ROOT = path.resolve(__dirname, '../../../..');

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), 'utf-8');
}

function emptyCp() {
  return {
    critical_activities: [] as any[],
    near_critical_activities: [] as any[],
    high_downstream_impact: [],
    predecessor_concentration: [],
  };
}

function sampleRisk(overrides?: Partial<ManagementRisk>): ManagementRisk {
  return {
    id: `m15-risk:${EVT_A}:EXCEPTION:${ACT_A}:CRITICAL_LATE`,
    kind: 'EXCEPTION',
    riskType: 'CRITICAL_PATH_EXECUTION_RISK',
    priority: 'CRITICAL',
    severity: 'CRITICAL',
    exceptionSeverity: 'P1',
    title: 'CRITICAL_LATE: HX-204',
    statement: 'Critical late activity HX-204 is likely to affect TA completion.',
    exceptionCode: 'CRITICAL_LATE',
    activityId: ACT_A,
    organizationId: ORG_A,
    eventId: EVT_A,
    sourceAuthority: 'M13',
    sourceService: 'ControlTowerQueryService.getSummary',
    calculatedAt: '2026-09-08T00:00:00.000Z',
    asOf: '2026-09-08T00:00:00.000Z',
    calculationType: 'INTELLIGENCE',
    rankingScore: 72,
    rankingModel: MANAGEMENT_PRIORITY_MODEL,
    affectedEntities: [{ entityType: 'activity', entityId: ACT_A, label: 'HX-204' }],
    impactSummary: 'late',
    forecastImpact: null,
    sourceAuthorities: ['M13', 'M11'],
    evidence: [
      {
        entityType: 'activity',
        entityId: ACT_A,
        metric: 'exception_code',
        value: 'CRITICAL_LATE',
        sourceAuthority: 'M13',
        sourceService: 'ControlTowerRules',
        layer: 'FACT',
      },
    ],
    ...overrides,
  };
}

describe('M15-R3 recommendation composition', () => {
  it('is deterministic, advisory, and not a fact', () => {
    const a = composeRecommendation(sampleRisk());
    const b = composeRecommendation(sampleRisk());
    expect(a).toEqual(b);
    expect(a.calculationType).toBe('RECOMMENDATION');
    expect(a.status).toBe('ADVISORY');
    expect(a.estimatedImpact).toBeNull();
    expect(a.recommendation).toMatch(/consider/i);
    expect(a.recommendation).not.toMatch(/execute|resume the activity now/i);
    expect(a.modelVersion).toContain(RECOMMENDATION_COMPOSE_MODEL.version);
    expect(a.priority).toBe('CRITICAL');
  });

  it('classifies empty evidence as INSUFFICIENT_EVIDENCE', () => {
    const rec = composeRecommendation(sampleRisk({ evidence: [] }));
    expect(rec.status).toBe('INSUFFICIENT_EVIDENCE');
    expect(rec.recommendation).toMatch(/Insufficient evidence/);
  });

  it('maps READINESS_BLOCKED without inventing slip hours', () => {
    const rec = composeRecommendation(
      sampleRisk({
        exceptionCode: 'READINESS_BLOCKED',
        title: 'READINESS_BLOCKED: HX-204',
        riskType: 'EXECUTION_READINESS_RISK',
      })
    );
    expect(rec.category).toBe('READINESS');
    expect(rec.expectedConsequence).not.toMatch(/\d+\s*hours/);
  });
});

describe('M15-R3 getRecommendations isolation and cap', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.event.findFirst as any).mockResolvedValue({ id: EVT_A });
    (CriticalPathIntelligenceService.analyze as any).mockResolvedValue(emptyCp());
    (ResourceRiskService.getRisks as any).mockResolvedValue([]);
  });

  it('scopes by event and does not use Org B / Event B', async () => {
    (ControlTowerQueryService.getSummary as any).mockResolvedValue({
      exceptions: [
        {
          activityId: ACT_A,
          activityIdCode: 'HX-204-BP',
          equipmentName: 'HX-204',
          reason: 'CRITICAL_LATE',
          severity: 'P1',
          isCritical: true,
          progressPercent: 40,
          totalFloat: 2,
          spi: 0.7,
          status: 'in_progress',
        },
      ],
      readinessCoverage: { notStartedCount: 0, evaluatedCount: 0, complete: true },
    });
    const result = await DecisionIntelligenceService.getRecommendations(ORG_A, EVT_A);
    expect(ControlTowerQueryService.getSummary).toHaveBeenCalledWith(ORG_A, EVT_A, expect.any(Object));
    expect(result.recommendations[0].eventId).toBe(EVT_A);
    expect(result.recommendations[0].evidence[0].entityId).toBe(ACT_A);
    expect(result.recommendationModel).toEqual(RECOMMENDATION_COMPOSE_MODEL);
  });

  it('caps large recommendation sets and flags truncation', async () => {
    const exceptions = Array.from({ length: 60 }, (_, i) => ({
      activityId: `act-${i}`,
      activityIdCode: `A-${i}`,
      equipmentName: `HX-${i}`,
      reason: 'LOW_FLOAT',
      severity: 'P4',
      isCritical: false,
      progressPercent: 0,
      totalFloat: 8,
      spi: 1,
      status: 'not_started',
    }));
    (ControlTowerQueryService.getSummary as any).mockResolvedValue({
      exceptions,
      readinessCoverage: { complete: true, notStartedCount: 0, evaluatedCount: 0 },
    });
    const result = await DecisionIntelligenceService.getRecommendations(ORG_A, EVT_A);
    expect(result.recommendations).toHaveLength(50);
    expect(result.completeness.recommendationsTruncated).toBe(true);
  });
});

describe('M15-R3 what-if', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.event.findFirst as any).mockResolvedValue({ id: EVT_A });
    (ScheduleOrchestrationService.resolveWorkingHoursPerDay as any).mockResolvedValue(10);
  });

  it('returns NOT_SUPPORTED for additional crews, constraint removal, and scope-change', async () => {
    const crews = await DecisionIntelligenceService.runWhatIf(ORG_A, EVT_A, 'user-1', {
      kind: 'ADDITIONAL_CREWS',
    });
    const constraint = await DecisionIntelligenceService.runWhatIf(ORG_A, EVT_A, 'user-1', {
      kind: 'CONSTRAINT_REMOVAL',
    });
    const scope = await DecisionIntelligenceService.runWhatIf(ORG_A, EVT_A, 'user-1', {
      kind: 'SCOPE_CHANGE',
    });
    expect(crews.status).toBe('NOT_SUPPORTED');
    expect(constraint.status).toBe('NOT_SUPPORTED');
    expect(scope.status).toBe('NOT_SUPPORTED');
    if (scope.status !== 'CALCULATED') {
      expect(scope.reason).toMatch(/M8.11|heuristic|not used/i);
    }
    expect(ScenarioCalculationService.calculate).not.toHaveBeenCalled();
  });

  it('does not apply leveling — simulation only', async () => {
    (ResourceLevelingService.generateLevelingRecommendations as any).mockResolvedValue({
      proposed_changes: [{ status: 'PROPOSED' }],
      project_finish_before: '2027-03-01',
      project_finish_after: '2027-03-02',
      project_finish_impact: 1,
      constraints_resolved: 2,
    });
    const result = await DecisionIntelligenceService.runWhatIf(ORG_A, EVT_A, undefined, {
      kind: 'RESOURCE_LEVELING_SIMULATION',
    });
    expect(result.status).toBe('CALCULATED');
    if (result.status === 'CALCULATED') {
      expect(result.hypothetical).toBe(true);
      expect(result.levelingSimulation?.note).toMatch(/ApplyService is not called/);
    }
  });

  it('DURATION_SLIP uses M8.9 and does not update Activity', async () => {
    (prisma.activity.findFirst as any).mockResolvedValue({
      id: ACT_A,
      duration_hours: 8,
      planned_start: new Date('2027-01-01'),
    });
    (prisma.scheduleBaseline.findFirst as any).mockResolvedValue({ id: 'bl-1' });
    (ScenarioPlanningService.createScenario as any).mockResolvedValue({ id: 'scn-1' });
    (ScenarioPlanningService.setActivityOverride as any).mockResolvedValue({});
    (ScenarioCalculationService.calculate as any).mockResolvedValue({});
    (prisma.scheduleScenario.findFirst as any).mockResolvedValue({
      snapshot_json: { cpm_result: { project_finish: '2027-04-10' }, impact_summary: { project_finish_delta: 1.5 } },
    });

    const result = await DecisionIntelligenceService.runWhatIf(ORG_A, EVT_A, 'user-1', {
      kind: 'DURATION_SLIP',
      activityId: ACT_A,
      slipHours: 12,
    });
    expect(result.status).toBe('CALCULATED');
    expect(ScenarioPlanningService.setActivityOverride).toHaveBeenCalledWith(
      'scn-1',
      ORG_A,
      'user-1',
      expect.objectContaining({ activity_id: ACT_A, duration_hours: 20 })
    );
    expect((prisma as any).activity.update).toBeUndefined();
    if (result.status === 'CALCULATED') {
      expect(result.hypothetical).toBe(true);
      expect(result.baselineFinishDeltaDays).toBe(1.5);
    }
  });

  it('DELAYED_START without planned_start is INSUFFICIENT_DATA', async () => {
    (prisma.activity.findFirst as any).mockResolvedValue({
      id: ACT_A,
      duration_hours: 8,
      planned_start: null,
    });
    (prisma.scheduleBaseline.findFirst as any).mockResolvedValue({ id: 'bl-1' });
    const result = await DecisionIntelligenceService.runWhatIf(ORG_A, EVT_A, 'user-1', {
      kind: 'DELAYED_START',
      activityId: ACT_A,
      delayDays: 2,
    });
    expect(result.status).toBe('INSUFFICIENT_DATA');
    expect(ScenarioPlanningService.createScenario).not.toHaveBeenCalled();
  });

  it('rejects an activity that is not in the trusted event', async () => {
    (prisma.activity.findFirst as any).mockResolvedValue(null);
    (prisma.scheduleBaseline.findFirst as any).mockResolvedValue({ id: 'bl-1' });
    await expect(
      DecisionIntelligenceService.runWhatIf(ORG_A, EVT_A, 'user-1', {
        kind: 'DURATION_SLIP',
        activityId: 'act-other-event',
        slipHours: 4,
      })
    ).rejects.toMatchObject({ code: 'ACTIVITY_NOT_FOUND' });
    expect(ScenarioPlanningService.createScenario).not.toHaveBeenCalled();
  });
});

describe('M15-R3 adapter adversarial', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.event.findFirst as any).mockResolvedValue({ id: EVT_A });
    (ControlTowerQueryService.getSummary as any).mockResolvedValue({
      exceptions: [],
      readinessCoverage: { complete: true, notStartedCount: 0, evaluatedCount: 0 },
    });
    (CriticalPathIntelligenceService.analyze as any).mockResolvedValue(emptyCp());
    (ResourceRiskService.getRisks as any).mockResolvedValue([]);
  });

  it('ignores LLM org/event and cannot execute recommendations', async () => {
    const result = await m15ToToolResult(
      { organizationId: ORG_A, eventId: EVT_A },
      'getRecommendations',
      { organizationId: 'org-b', eventId: EVT_B, execute: true, priority: 'CRITICAL' } as any
    );
    expect(result.organizationId).toBe(ORG_A);
    expect(result.eventId).toBe(EVT_A);
    expect(result.summary).toMatch(/not executed/i);
    expect(ControlTowerQueryService.getSummary).toHaveBeenCalledWith(ORG_A, EVT_A, expect.any(Object));
  });

  it('runWhatIf ignores LLM org/event and does not execute', async () => {
    const result = await m15ToToolResult(
      { organizationId: ORG_A, eventId: EVT_A, userId: 'user-1' },
      'runWhatIf',
      { organizationId: 'org-b', eventId: EVT_B, kind: 'ADDITIONAL_CREWS', execute: true } as any
    );
    expect(result.organizationId).toBe(ORG_A);
    expect(result.eventId).toBe(EVT_A);
    expect(result.status).toBe('SUCCESS');
    const data = result.data as { status: string; hypothetical: boolean; eventId: string };
    expect(data.status).toBe('NOT_SUPPORTED');
    expect(data.hypothetical).toBe(true);
    expect(data.eventId).toBe(EVT_A);
    expect(ScenarioPlanningService.createScenario).not.toHaveBeenCalled();
  });
});

describe('M15-R3 authority source scan', () => {
  it('does not persist BRE, call EWS, apply leveling, or fork exception rules', () => {
    const dir = path.join(ROOT, 'src/core/m15');
    const src = fs
      .readdirSync(dir)
      .filter((f) => f.endsWith('.ts') && !f.includes('.test.'))
      .map((f) => fs.readFileSync(path.join(dir, f), 'utf-8'))
      .join('\n');
    expect(src).not.toContain('RecommendationEngine');
    expect(src).not.toContain('bre_recommendations');
    expect(src).not.toContain('evaluateExceptions');
    expect(src).not.toContain('calculateProgressMetrics');
    expect(src).not.toContain('ScopeChangeImpactService');
    expect(src).not.toMatch(/from ['"][^'"]*ExecutionWriteService/);
    expect(src).not.toMatch(/from ['"][^'"]*ResourceLevelingApplyService/);
    expect(src).toContain('ResourceLevelingService');
    const recRoute = read('app/api/events/[eventId]/management/recommendations/route.ts');
    const whatIf = read('app/api/events/[eventId]/management/what-if/route.ts');
    for (const s of [recRoute, whatIf]) {
      expect(s).toContain("guardApi('nav.schedule')");
      expect(s).toContain('session.user.organization_id');
      expect(s).not.toContain('body.organizationId');
    }
  });
});
