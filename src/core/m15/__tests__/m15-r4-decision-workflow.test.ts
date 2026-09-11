/**
 * M15-R4 — management decision workflow + M16 adapter.
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
    m15_management_decisions: { create: vi.fn(), findMany: vi.fn() },
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

vi.mock('@/core/evm/EvmSnapshotService', () => ({
  calculateLiveEvm: vi.fn(),
}));

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
import { ControlTowerQueryService } from '@/core/control-tower/ControlTowerQueryService';
import { CriticalPathIntelligenceService } from '@/core/resources/CriticalPathIntelligenceService';
import { ResourceRiskService } from '@/core/resources/ResourceRiskService';
import { DecisionIntelligenceService } from '../DecisionIntelligenceService';
import { m15ToToolResult } from '../m16Adapter';
import { MANAGEMENT_PRIORITY_MODEL } from '../managementPriority';

const ORG_A = 'org-a';
const EVT_A = 'event-ta-2027';
const EVT_B = 'event-ta-2028';
const ACT_A = 'act-hx-204-a';
const REC_A = `m15-rec:${EVT_A}:m15-risk:${EVT_A}:EXCEPTION:${ACT_A}:CRITICAL_LATE`;
const REC_B = `m15-rec:${EVT_B}:m15-risk:${EVT_B}:EXCEPTION:${ACT_A}:CRITICAL_LATE`;
const ROOT = path.resolve(__dirname, '../../../..');

function emptyCp() {
  return {
    critical_activities: [] as any[],
    near_critical_activities: [] as any[],
    high_downstream_impact: [],
    predecessor_concentration: [],
  };
}

describe('M15-R4 recommendation retrieval and isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.event.findFirst as any).mockResolvedValue({ id: EVT_A });
    (CriticalPathIntelligenceService.analyze as any).mockResolvedValue(emptyCp());
    (ResourceRiskService.getRisks as any).mockResolvedValue([]);
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
  });

  it('retrieves an evidence-backed recommendation in event scope', async () => {
    const rec = await DecisionIntelligenceService.getRecommendation(ORG_A, EVT_A, REC_A);
    expect(rec).not.toBeNull();
    expect(rec!.eventId).toBe(EVT_A);
    expect(rec!.evidence.length).toBeGreaterThan(0);
    expect(rec!.priority).toBe('CRITICAL');
    expect(rec!.modelVersion).toContain('m15-recommendation-compose');
    expect(ControlTowerQueryService.getSummary).toHaveBeenCalledWith(ORG_A, EVT_A, expect.any(Object));
  });

  it('does not return another event recommendation', async () => {
    const rec = await DecisionIntelligenceService.getRecommendation(ORG_A, EVT_A, REC_B);
    expect(rec).toBeNull();
  });
});

describe('M15-R4 management decision separation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.event.findFirst as any).mockResolvedValue({ id: EVT_A });
    (CriticalPathIntelligenceService.analyze as any).mockResolvedValue(emptyCp());
    (ResourceRiskService.getRisks as any).mockResolvedValue([]);
    (ControlTowerQueryService.getSummary as any).mockResolvedValue({
      exceptions: [],
      readinessCoverage: { complete: true, notStartedCount: 0, evaluatedCount: 0 },
    });
  });

  it('requires a human user id', async () => {
    await expect(
      DecisionIntelligenceService.recordManagementDecision(ORG_A, EVT_A, undefined, {
        recommendationId: REC_A,
        decision: 'ACCEPT',
      })
    ).rejects.toMatchObject({ code: 'HUMAN_REQUIRED' });
    expect((prisma as any).m15_management_decisions.create).not.toHaveBeenCalled();
  });

  it('rejects a recommendation id from another event', async () => {
    await expect(
      DecisionIntelligenceService.recordManagementDecision(ORG_A, EVT_A, 'user-1', {
        recommendationId: REC_B,
        decision: 'ACCEPT',
      })
    ).rejects.toMatchObject({ code: 'RECOMMENDATION_NOT_FOUND' });
    expect((prisma as any).activity.update).toBeUndefined();
  });

  it('records ACCEPT without authorizing execution', async () => {
    (prisma.m15_management_decisions.create as any).mockResolvedValue({
      id: 'dec-1',
      organization_id: ORG_A,
      event_id: EVT_A,
      recommendation_id: REC_A,
      decided_by: 'user-1',
      decision: 'ACCEPT',
      rationale: 'prioritise HX-204',
      created_at: new Date('2026-09-08T00:00:00.000Z'),
      source_channel: 'web',
      related_scenario_id: null,
      evidence_snapshot: {},
      status: 'RECORDED',
    });
    const row = await DecisionIntelligenceService.recordManagementDecision(ORG_A, EVT_A, 'user-1', {
      recommendationId: REC_A,
      decision: 'ACCEPT',
      rationale: 'prioritise HX-204',
      sourceChannel: 'web',
    });
    expect(row.authorizesExecution).toBe(false);
    expect(row.calculationType).toBe('MANAGEMENT_DECISION');
    expect(row.decision).toBe('ACCEPT');
    expect((prisma as any).m15_management_decisions.create).toHaveBeenCalled();
    expect((prisma as any).activity.update).toBeUndefined();
  });
});

describe('M15-R4 adapter', () => {
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

  it('recordManagementDecision ignores LLM org/event/user and requires trusted userId', async () => {
    const denied = await m15ToToolResult(
      { organizationId: ORG_A, eventId: EVT_A },
      'recordManagementDecision',
      { organizationId: 'org-b', eventId: EVT_B, userId: 'attacker', recommendationId: REC_A, decision: 'ACCEPT' }
    );
    expect(denied.status).toBe('DENIED');
    expect(denied.organizationId).toBe(ORG_A);
  });

  it('cannot execute via adapter', async () => {
    const result = await m15ToToolResult(
      { organizationId: ORG_A, eventId: EVT_A },
      'getRecommendations',
      { execute: true, organizationId: 'org-b' } as any
    );
    expect(result.summary).toMatch(/not executed/i);
    expect(result.eventId).toBe(EVT_A);
  });
});

describe('M15-R4 source scan', () => {
  it('does not call EWS, BRE, or Activity mutation', () => {
    const dir = path.join(ROOT, 'src/core/m15');
    const src = fs
      .readdirSync(dir)
      .filter((f) => f.endsWith('.ts') && !f.includes('.test.'))
      .map((f) => fs.readFileSync(path.join(dir, f), 'utf-8'))
      .join('\n');
    expect(src).not.toContain('RecommendationEngine');
    expect(src).not.toMatch(/from ['"][^'"]*ExecutionWriteService/);
    expect(src).not.toMatch(/from ['"][^'"]*ResourceLevelingApplyService/);
    expect(src).not.toMatch(/prisma\.activity\.(create|update|delete)/);
    expect(src).toContain('authorizesExecution: false');
    const dec = fs.readFileSync(path.join(ROOT, 'app/api/events/[eventId]/management/decisions/route.ts'), 'utf-8');
    expect(dec).toContain("guardApi('nav.schedule')");
    expect(dec).toContain('session.user.organization_id');
    expect(dec).not.toContain('body.organizationId');
    expect(dec).not.toContain('ExecutionWriteService');
  });
});
