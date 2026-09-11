/**
 * M15-R2 evidence, forecast hardening, ranking, adapter, adversarial tests.
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
import { DecisionIntelligenceService } from '../DecisionIntelligenceService';
import { m15ToToolResult } from '../m16Adapter';
import { computeManagementPriority, MANAGEMENT_PRIORITY_MODEL } from '../managementPriority';

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
    critical_activities: [],
    near_critical_activities: [],
    high_downstream_impact: [],
    predecessor_concentration: [],
  };
}

describe('M15-R2 ranking model', () => {
  it('is deterministic and does not change M13 P1/P2 labels', () => {
    const a = computeManagementPriority({
      m13Severity: 'P1',
      isCritical: true,
      downstreamCount: 17,
      exceptionCode: 'CRITICAL_LATE',
    });
    const b = computeManagementPriority({
      m13Severity: 'P1',
      isCritical: true,
      downstreamCount: 17,
      exceptionCode: 'CRITICAL_LATE',
    });
    expect(a).toEqual(b);
    expect(a.priority).toBe('CRITICAL');
    expect(a.score).toBe(40 + 15 + 17);
    expect(MANAGEMENT_PRIORITY_MODEL.version).toBe('1.0');
  });

  it('does not treat a P4 exception as automatically HIGH management priority', () => {
    const r = computeManagementPriority({
      m13Severity: 'P4',
      isCritical: false,
      downstreamCount: 0,
      exceptionCode: 'LOW_FLOAT',
    });
    expect(r.priority).toBe('LOW');
  });
});

describe('M15-R2 evidence and completeness', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.event.findFirst as any).mockResolvedValue({ id: EVT_A });
  });

  it('attaches layered evidence and does not present truncated readiness as complete', async () => {
    (ControlTowerQueryService.getSummary as any).mockResolvedValue({
      exceptions: [
        {
          activityId: ACT_A,
          activityIdCode: 'HX-204-BP',
          description: 'Bundle pullout',
          workpackId: 'wp-1',
          workpackName: 'WP-1',
          equipmentName: 'HX-204',
          status: 'in_progress',
          progressPercent: 60,
          totalFloat: 2,
          isCritical: true,
          spi: 0.7,
          reason: 'CRITICAL_LATE',
          severity: 'P1',
        },
      ],
      readinessCoverage: { notStartedCount: 5000, evaluatedCount: 5000, complete: true },
      exceptionCoverage: { total: 1, returned: 1, truncated: false, limit: 500 },
    });
    (CriticalPathIntelligenceService.analyze as any).mockResolvedValue({
      ...emptyCp(),
      critical_activities: [{ activity_id: ACT_A, downstream_impact: 14 }],
    });
    (ResourceRiskService.getRisks as any).mockResolvedValue([]);

    const bundle = await DecisionIntelligenceService.getManagementRisks(ORG_A, EVT_A);
    const risk = bundle.risks[0];
    expect(risk.exceptionSeverity).toBe('P1');
    expect(risk.priority).toBe('CRITICAL');
    expect(risk.riskType).toBe('CRITICAL_PATH_EXECUTION_RISK');
    expect(risk.calculationType).toBe('INTELLIGENCE');
    expect(risk.evidence.some((e) => e.layer === 'FACT' && e.metric === 'progress_percent' && e.value === 60)).toBe(
      true
    );
    expect(risk.evidence.some((e) => e.layer === 'INTELLIGENCE' && e.metric === 'management_priority_score')).toBe(
      true
    );
    expect(risk.evidence.some((e) => e.sourceAuthority === 'M13' && e.metric === 'exception_code')).toBe(true);
    expect(bundle.completeness.readinessComplete).toBe(true);
    expect(bundle.rankingModel).toEqual(MANAGEMENT_PRIORITY_MODEL);
  });

  it('flags incomplete readiness coverage instead of hiding the skip', async () => {
    (ControlTowerQueryService.getSummary as any).mockResolvedValue({
      exceptions: [],
      readinessCoverage: { notStartedCount: 8000, evaluatedCount: 0, complete: false },
      exceptionCoverage: { total: 0, returned: 0, truncated: false, limit: 500 },
    });
    (CriticalPathIntelligenceService.analyze as any).mockResolvedValue(emptyCp());
    (ResourceRiskService.getRisks as any).mockResolvedValue([]);

    const bundle = await DecisionIntelligenceService.getManagementRisks(ORG_A, EVT_A);
    expect(bundle.completeness.readinessComplete).toBe(false);
    expect(bundle.completeness.readinessNotStartedCount).toBe(8000);
  });
});

describe('M15-R2 forecast semantics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.event.findFirst as any).mockResolvedValue({ id: EVT_A });
    (ScheduleOrchestrationService.resolveWorkingHoursPerDay as any).mockResolvedValue(9);
  });

  it('keeps EAC as currency and never invents confidence percentages', async () => {
    (ScheduleForecastService.computeForecast as any).mockResolvedValue({
      project_forecast_finish: '2027-04-01',
      project_planned_finish: '2027-03-20',
      project_variance_days: 12,
      completed: 10,
      in_progress: 4,
    });
    (calculateLiveEvm as any).mockResolvedValue({ eac: 99, cpi: 0.9, spi: 0.8, bac: 100 });

    const rows = await DecisionIntelligenceService.getForecast(ORG_A, EVT_A);
    const eac = rows.find((r) => r.forecastType === 'EAC_COST_FORECAST')!;
    const exec = rows.find((r) => r.forecastType === 'EXECUTION_FINISH_FORECAST')!;
    expect(eac.unit).toBe('currency');
    expect(exec.unit).toBe('date');
    expect(exec.assumptions.some((a) => a.name === 'working_hours_per_day' && a.value === 9)).toBe(true);
    expect(JSON.stringify(rows)).not.toMatch(/87%/);
    expect(eac.quality.confidence).toBe('NOT_AVAILABLE');
    expect(exec.evidence.every((e) => e.entityId === EVT_A)).toBe(true);
  });
});

describe('M15-R2 impact units', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.event.findFirst as any).mockResolvedValue({ id: EVT_A });
    (prisma.activity.findFirst as any).mockResolvedValue({
      id: ACT_A,
      activity_number: 'HX-204-BP',
      is_critical: true,
      total_float: 4,
    });
    (CriticalPathIntelligenceService.analyze as any).mockResolvedValue({
      ...emptyCp(),
      critical_activities: [{ activity_id: ACT_A, downstream_impact: 14 }],
    });
    (ResourceRiskService.getRisks as any).mockResolvedValue([]);
  });

  it('does not infer network hours from downstream count', async () => {
    const impact = await DecisionIntelligenceService.getImpact(ORG_A, EVT_A, ACT_A, 12);
    expect(impact.downstreamActivityCount).toBe(14);
    expect(impact.network.unit).toBe('activity_count');
    expect(impact.networkCompletionImpactHours).toBeNull();
    expect(impact.slip.unit).toBe('hours');
  });
});

describe('M15-R2 M16 adapter and adversarial context', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.event.findFirst as any).mockResolvedValue({ id: EVT_A });
    (ControlTowerQueryService.getSummary as any).mockResolvedValue({
      exceptions: [],
      readinessCoverage: { notStartedCount: 0, evaluatedCount: 0, complete: true },
    });
    (CriticalPathIntelligenceService.analyze as any).mockResolvedValue(emptyCp());
    (ResourceRiskService.getRisks as any).mockResolvedValue([]);
  });

  it('ignores LLM-supplied organizationId/eventId on params', async () => {
    const result = await m15ToToolResult(
      { organizationId: ORG_A, eventId: EVT_A },
      'getManagementRisks',
      { organizationId: 'org-b', eventId: EVT_B } as any
    );
    expect(result.organizationId).toBe(ORG_A);
    expect(result.eventId).toBe(EVT_A);
    expect(result.provenance.evidenceRetained).toBe(true);
    expect(ControlTowerQueryService.getSummary).toHaveBeenCalledWith(
      ORG_A,
      EVT_A,
      expect.any(Object)
    );
    expect(ControlTowerQueryService.getSummary).not.toHaveBeenCalledWith('org-b', EVT_B, expect.anything());
  });

  it('does not treat injected scores as authoritative', async () => {
    const result = await m15ToToolResult(
      { organizationId: ORG_A, eventId: EVT_A },
      'getManagementRisks',
      { score: 99, ignoreEventRestriction: true } as any
    );
    expect(result.status).toBe('SUCCESS');
    const data = result.data as { rankingModel: { id: string } };
    expect(data.rankingModel.id).toBe('m15-management-priority');
  });
});

describe('M15-R2 source scan', () => {
  it('does not add duplicate engines or write paths', () => {
    const dir = path.join(ROOT, 'src/core/m15');
    const src = fs
      .readdirSync(dir)
      .filter((f) => f.endsWith('.ts') && !f.includes('.test.'))
      .map((f) => fs.readFileSync(path.join(dir, f), 'utf-8'))
      .join('\n');
    expect(src).not.toContain('evaluateExceptions');
    expect(src).not.toContain('calculateProgressMetrics');
    expect(src).not.toContain('ScopeChangeImpactService');
    expect(src).not.toMatch(/from ['"][^'"]*ExecutionWriteService/);
    expect(src).not.toMatch(/from ['"][^'"]*ResourceLevelingApplyService/);
    expect(src).not.toContain('M15ReadinessService');
    expect(src).not.toMatch(/\b87%/);
    expect(read('src/core/control-tower/ControlTowerQueryService.ts')).not.toMatch(/length < 5000/);
    expect(read('src/core/execution/ExecutionReadinessService.ts')).not.toMatch(
      /for \(const id of activityIds\) \{\s*results\[id\] = await this\.evaluateReadiness/
    );
  });
});
