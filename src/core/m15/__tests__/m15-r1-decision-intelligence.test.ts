/**
 * M15-R1 Decision Intelligence Facade tests.
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

import { prisma } from '@/lib/prisma';
import { ControlTowerQueryService } from '@/core/control-tower/ControlTowerQueryService';
import { CriticalPathIntelligenceService } from '@/core/resources/CriticalPathIntelligenceService';
import { ResourceRiskService } from '@/core/resources/ResourceRiskService';
import { ScheduleForecastService } from '@/core/resources/ScheduleForecastService';
import { ScheduleOrchestrationService } from '@/core/schedule/ScheduleOrchestrationService';
import { calculateLiveEvm } from '@/core/evm/EvmSnapshotService';
import { ScenarioPlanningService } from '@/core/schedule/scenario/ScenarioPlanningService';
import { ScenarioCalculationService } from '@/core/schedule/scenario/ScenarioCalculationService';
import { DecisionIntelligenceService } from '../DecisionIntelligenceService';
import { DecisionContextError } from '../types';
import { m15ToToolResult } from '../m16Adapter';

const ORG_A = 'org-a';
const ORG_B = 'org-b';
const EVT_A = 'event-ta-2027';
const EVT_B = 'event-ta-2028';
const ACT_A = 'act-hx-204-a';

const ROOT = path.resolve(__dirname, '../../../..');

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), 'utf-8');
}

function emptyCp() {
  return {
    critical_activities: [],
    near_critical_activities: [],
    high_downstream_impact: [],
    predecessor_concentration: [],
  };
}

describe('M15-R1 isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fails closed when event is missing', async () => {
    await expect(DecisionIntelligenceService.getManagementRisks(ORG_A, '')).rejects.toBeInstanceOf(
      DecisionContextError
    );
  });

  it('Org A cannot use Org B event id', async () => {
    (prisma.event.findFirst as any).mockResolvedValue(null);
    await expect(DecisionIntelligenceService.getManagementRisks(ORG_A, EVT_B)).rejects.toMatchObject({
      code: 'EVENT_NOT_FOUND',
    });
    expect(prisma.event.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: EVT_B, organization_id: ORG_A }),
      })
    );
  });

  it('same org Event A cannot load Event B activity', async () => {
    (prisma.event.findFirst as any).mockResolvedValue({ id: EVT_A });
    (prisma.activity.findFirst as any).mockResolvedValue(null);
    await expect(DecisionIntelligenceService.getImpact(ORG_A, EVT_A, ACT_A, 12)).rejects.toMatchObject({
      code: 'ACTIVITY_NOT_FOUND',
    });
    expect(prisma.activity.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: ACT_A,
          organization_id: ORG_A,
          event_id: EVT_A,
        }),
      })
    );
  });

  it('identical equipment names cannot cross events — activity lookup is UUID + org + event', async () => {
    (prisma.event.findFirst as any).mockResolvedValue({ id: EVT_A });
    (prisma.activity.findFirst as any).mockResolvedValue(null);
    await expect(DecisionIntelligenceService.getImpact(ORG_A, EVT_A, ACT_A, 1)).rejects.toMatchObject({
      code: 'ACTIVITY_NOT_FOUND',
    });
    const where = (prisma.activity.findFirst as any).mock.calls[0][0].where;
    expect(where).toEqual(
      expect.objectContaining({
        id: ACT_A,
        organization_id: ORG_A,
        event_id: EVT_A,
        deleted_at: null,
      })
    );
    expect(where).not.toHaveProperty('activity_number');
    expect(where).not.toHaveProperty('description');
  });

  it('scenario finish requires matching org and event', async () => {
    (prisma.event.findFirst as any).mockResolvedValue({ id: EVT_A });
    (ScheduleOrchestrationService.resolveWorkingHoursPerDay as any).mockResolvedValue(10);
    (ScheduleForecastService.computeForecast as any).mockResolvedValue({});
    (calculateLiveEvm as any).mockResolvedValue(null);
    (prisma.scheduleScenario.findFirst as any).mockResolvedValue(null);

    await expect(
      DecisionIntelligenceService.getForecast(ORG_A, EVT_A, {
        scenarioId: 'scn-other-event',
        forecastType: 'SCHEDULE_SCENARIO_FINISH',
      })
    ).rejects.toMatchObject({ code: 'SCENARIO_NOT_FOUND' });

    expect(prisma.scheduleScenario.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'scn-other-event',
          organization_id: ORG_A,
          event_id: EVT_A,
        }),
      })
    );
  });
});

describe('M15-R1 forecast semantics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.event.findFirst as any).mockResolvedValue({ id: EVT_A });
    (ScheduleOrchestrationService.resolveWorkingHoursPerDay as any).mockResolvedValue(8);
  });

  it('does not present EAC as a finish date', async () => {
    (ScheduleForecastService.computeForecast as any).mockResolvedValue({
      project_forecast_finish: '2027-04-01',
      project_planned_finish: '2027-03-20',
      project_variance_days: 12,
    });
    (calculateLiveEvm as any).mockResolvedValue({
      eac: 1500000,
      cpi: 0.8,
      spi: 0.9,
      bac: 1000000,
    });

    const rows = await DecisionIntelligenceService.getForecast(ORG_A, EVT_A);
    const finish = rows.find((r) => r.forecastType === 'EXECUTION_FINISH_FORECAST');
    const eac = rows.find((r) => r.forecastType === 'EAC_COST_FORECAST');
    expect(finish?.unit).toBe('date');
    expect(finish?.value).toBe('2027-04-01');
    expect(finish?.sourceAuthority).toBe('M8.8');
    expect(eac?.unit).toBe('currency');
    expect(eac?.value).toBe(1500000);
    expect(eac?.sourceAuthority).toBe('M8.10');
    expect(eac?.explanation).toMatch(/not a schedule finish/i);
    expect(rows.some((r) => r.forecastType === 'SCHEDULE_SCENARIO_FINISH')).toBe(false);
    expect(finish?.quality.confidence).toBe('NOT_AVAILABLE');
    expect(eac?.quality.confidence).toBe('NOT_AVAILABLE');
    expect(eac?.assumptions.length).toBeGreaterThan(0);
  });
});

describe('M15-R1 management risks consume M13', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.event.findFirst as any).mockResolvedValue({ id: EVT_A });
  });

  it('ranks M13 CRITICAL_LATE without re-evaluating exception rules', async () => {
    (ControlTowerQueryService.getSummary as any).mockResolvedValue({
      exceptions: [
        {
          activityId: ACT_A,
          activityIdCode: 'HX-204-BP',
          description: 'Bundle pullout',
          workpackId: 'wp-1',
          equipmentName: 'HX-204',
          status: 'in_progress',
          progressPercent: 40,
          totalFloat: 2,
          isCritical: true,
          spi: 0.7,
          reason: 'CRITICAL_LATE',
          severity: 'P1',
        },
      ],
    });
    (CriticalPathIntelligenceService.analyze as any).mockResolvedValue({
      ...emptyCp(),
      critical_activities: [{ activity_id: ACT_A, downstream_impact: 17 }],
    });
    (ResourceRiskService.getRisks as any).mockResolvedValue([]);

    const result = await DecisionIntelligenceService.getManagementRisks(ORG_A, EVT_A);
    expect(ControlTowerQueryService.getSummary).toHaveBeenCalledWith(
      ORG_A,
      EVT_A,
      expect.objectContaining({ exceptionLimit: 500 })
    );
    const risks = result.risks;
    expect(risks[0].exceptionCode).toBe('CRITICAL_LATE');
    expect(risks[0].sourceAuthority).toBe('M13');
    expect(risks[0].organizationId).toBe(ORG_A);
    expect(risks[0].eventId).toBe(EVT_A);
    expect(risks[0].statement).toMatch(/17 downstream/);
    expect(risks[0].evidence.some((e) => e.metric === 'downstream_activity_count' && e.unit === 'count')).toBe(true);
    expect(risks[0].evidence.every((e) => e.entityId === ACT_A || e.entityId === EVT_A)).toBe(true);
  });
});

describe('M15-R1 impact semantics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.event.findFirst as any).mockResolvedValue({ id: EVT_A });
    (prisma.activity.findFirst as any).mockResolvedValue({
      id: ACT_A,
      activity_number: 'HX-204-BP',
      description: 'Bundle',
      is_critical: true,
      total_float: 4,
      planned_end: new Date(),
    });
    (CriticalPathIntelligenceService.analyze as any).mockResolvedValue({
      ...emptyCp(),
      critical_activities: [{ activity_id: ACT_A, downstream_impact: 14 }],
    });
    (ResourceRiskService.getRisks as any).mockResolvedValue([]);
  });

  it('labels network impact as activity_count not hours', async () => {
    const impact = await DecisionIntelligenceService.getImpact(ORG_A, EVT_A, ACT_A, 12);
    expect(impact.slip.unit).toBe('hours');
    expect(impact.slip.value).toBe(12);
    expect(impact.network.unit).toBe('activity_count');
    expect(impact.network.value).toBe(14);
    expect(impact.network.explanation).toMatch(/activity count/i);
    expect(impact.network.explanation).toMatch(/not hours/i);
    expect(impact.resource.unit).toBe('risk_record_count');
    expect(impact.downstreamActivityCount).toBe(14);
    expect(impact.networkCompletionImpactHours).toBeNull();
  });
});

describe('M15-R1 scenario orchestration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.event.findFirst as any).mockResolvedValue({ id: EVT_A });
    (prisma.activity.findFirst as any).mockResolvedValue({ id: ACT_A, duration_hours: 8 });
    (prisma.scheduleBaseline.findFirst as any).mockResolvedValue({ id: 'bl-1' });
    (ScenarioPlanningService.createScenario as any).mockResolvedValue({ id: 'scn-1' });
    (ScenarioPlanningService.setActivityOverride as any).mockResolvedValue({});
    (ScenarioCalculationService.calculate as any).mockResolvedValue({});
    (ScheduleOrchestrationService.resolveWorkingHoursPerDay as any).mockResolvedValue(10);
    (prisma.scheduleScenario.findFirst as any).mockResolvedValue({
      id: 'scn-1',
      status: 'ready',
      name: 'sim',
      snapshot_json: { cpm_result: { project_finish: '2027-04-10' } },
    });
  });

  it('runImpactScenario uses M8.9 and does not call prisma.activity.update', async () => {
    const result = await DecisionIntelligenceService.runImpactScenario(
      ORG_A,
      EVT_A,
      'user-1',
      ACT_A,
      12
    );
    expect(ScenarioPlanningService.createScenario).toHaveBeenCalled();
    expect(ScenarioCalculationService.calculate).toHaveBeenCalledWith('scn-1', ORG_A, 'user-1');
    expect(result.snapshotFinish).toBe('2027-04-10');
    expect(prisma.activity.findFirst).toHaveBeenCalled();
    expect((prisma as any).activity.update).toBeUndefined();
  });
});

describe('M15-R1 M16 adapter and APIs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('m16 adapter uses trusted context only', async () => {
    (prisma.event.findFirst as any).mockResolvedValue({ id: EVT_A });
    (ControlTowerQueryService.getSummary as any).mockResolvedValue({ exceptions: [] });
    (CriticalPathIntelligenceService.analyze as any).mockResolvedValue(emptyCp());
    (ResourceRiskService.getRisks as any).mockResolvedValue([]);
    const result = await m15ToToolResult(
      { organizationId: ORG_A, eventId: EVT_A },
      'getManagementRisks'
    );
    expect(result.authority).toBe('M15 DecisionIntelligenceService');
    expect(result.status).toBe('SUCCESS');
  });

  it('runImpactScenario adapter fails closed without trusted userId', async () => {
    const denied = await m15ToToolResult(
      { organizationId: ORG_A, eventId: EVT_A },
      'runImpactScenario',
      { activityId: ACT_A, slipHours: 12 }
    );
    expect(denied.status).toBe('DENIED');
    expect(ScenarioCalculationService.calculate).not.toHaveBeenCalled();
  });

  it('HTTP routes use session org, nav.schedule, and facade', () => {
    const risks = read('app/api/events/[eventId]/management/risks/route.ts');
    const forecast = read('app/api/events/[eventId]/management/forecast/route.ts');
    const impact = read('app/api/events/[eventId]/management/impact/route.ts');
    for (const src of [risks, forecast, impact]) {
      expect(src).toContain("guardApi('nav.schedule')");
      expect(src).toContain('withTenantGuard');
      expect(src).toContain('session.user.organization_id');
      expect(src).toContain('DecisionIntelligenceService');
      expect(src).not.toContain('calculateProgressMetrics');
      expect(src).not.toContain('evaluateExceptions');
      expect(src).not.toContain('body.organizationId');
      expect(src).not.toContain('body.eventId');
    }
    const guard = read('src/lib/withTenantGuard.ts');
    expect(guard).toContain("error: 'Unauthorized'");
    expect(guard).toContain('status: 401');
  });
});

describe('M15-R1 authority source scan', () => {
  const m15Dir = path.join(ROOT, 'src/core/m15');

  function allM15Source(): string {
    return fs
      .readdirSync(m15Dir)
      .filter((f) => f.endsWith('.ts') && !f.includes('.test.'))
      .map((f) => fs.readFileSync(path.join(m15Dir, f), 'utf-8'))
      .join('\n');
  }

  it('does not import forbidden engines', () => {
    const src = allM15Source();
    expect(src).not.toMatch(/from ['"][^'"]*ExecutionWriteService/);
    expect(src).not.toMatch(/from ['"][^'"]*ResourceLevelingApplyService/);
    expect(src).not.toMatch(/ResourceLevelingApplyService\.(apply|run)/);
    expect(src).not.toContain('calculateProgressMetrics');
    expect(src).not.toContain('ScopeChangeImpactService');
    expect(src).not.toContain('evaluateExceptions');
    expect(src).not.toMatch(/from ['"]@\/core\/m16/);
    expect(src).not.toMatch(/import\s*\{[^}]*ActionRiskLevel/);
    expect(src).not.toContain('PlanningReadinessService');
    expect(src).not.toContain('ExecutionReadinessService');
    expect(src).not.toMatch(/prisma\.(?!m15_management_decisions)\w+\.(create|update|delete)/);
    expect(src).not.toMatch(/prisma\.activity\.(create|update|delete)/);
    expect(src).toContain('ControlTowerQueryService');
  });

  it('M13 constraint query is event-scoped via workpack', () => {
    const ct = read('src/core/control-tower/ControlTowerQueryService.ts');
    expect(ct).toContain('workpack:');
    expect(ct).toContain('event_id: eventId');
  });

  it('critical-path intelligence loads event-scoped relationships', () => {
    const cp = read('src/core/resources/CriticalPathIntelligenceService.ts');
    expect(cp).toContain('predecessor: { event_id: eventId');
    expect(cp).toContain('successor: { event_id: eventId');
    expect(cp).not.toMatch(/where:\s*\{\s*organization_id:\s*organizationId\s*\}/);
  });

  it('scenario calculation uses SOS calendar hours not hardcoded 10', () => {
    const scn = read('src/core/schedule/scenario/ScenarioCalculationService.ts');
    expect(scn).toContain('resolveWorkingHoursPerDay');
    expect(scn).not.toMatch(/working_hours_per_day:\s*10/);
    expect(scn).toContain('predecessor: { event_id: scenario.event_id');
    expect(scn).not.toContain('prisma.activity.update');
    expect(scn).not.toContain('ResourceLevelingApplyService');
  });
});
