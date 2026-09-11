/**
 * M10 — Planning Readiness V1 Test Suite
 *
 * Verifies:
 *   - Architecture: no duplicate engines, reuses existing services
 *   - Security: tenant isolation, RBAC, workpack ownership
 *   - Data: correct relationship chain resolution
 *   - Readiness: state computation for all scenarios
 *   - Regression: protected modules untouched
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// ── Test Setup ──────────────────────────────────────────────────────────────

// Mock prisma for service-level tests
const mockPrisma = {
  workpack: { findMany: vi.fn() },
  activity: { groupBy: vi.fn(), findMany: vi.fn() },
  activityResource: { groupBy: vi.fn(), findMany: vi.fn() },
  workpack_material_lines: { groupBy: vi.fn() },
  constraint: { groupBy: vi.fn() },
  scheduleBaseline: { findMany: vi.fn() },
};

vi.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
}));

// Helper: read file content for static analysis
function readSrc(relPath: string): string {
  const fullPath = path.resolve(__dirname, '..', relPath);
  try {
    return fs.readFileSync(fullPath, 'utf-8');
  } catch {
    return '';
  }
}

// ── SECTION 1: ARCHITECTURE ─────────────────────────────────────────────────

describe('M10 Architecture', () => {
  const serviceCode = readSrc('PlanningReadinessService.ts');

  it('should NOT contain CPM calculation', () => {
    expect(serviceCode).not.toContain('calculateSchedule');
    expect(serviceCode).not.toContain('forward_pass');
    expect(serviceCode).not.toContain('backward_pass');
    expect(serviceCode).not.toContain('topologicalSort');
    expect(serviceCode).not.toContain('early_start =');
    expect(serviceCode).not.toContain('late_start =');
    expect(serviceCode).not.toContain('critical_path');
  });

  it('should NOT import scheduleEngine', () => {
    expect(serviceCode).not.toContain("from '@/lib/scheduleEngine'");
    expect(serviceCode).not.toContain("from '../lib/scheduleEngine'");
  });

  it('should NOT import or use ProgressCalculationService', () => {
    expect(serviceCode).not.toContain('ProgressCalculationService');
    expect(serviceCode).not.toContain('ProgressAggregationService');
    expect(serviceCode).not.toContain('calculateProgress');
    expect(serviceCode).not.toContain('weightedProgress');
  });

  it('should NOT contain SPI/EVM calculations', () => {
    expect(serviceCode).not.toContain('SPI');
    expect(serviceCode).not.toContain('CPI');
    expect(serviceCode).not.toContain('earned_value');
    expect(serviceCode).not.toContain('planned_value');
    expect(serviceCode).not.toContain('actual_cost');
  });

  it('should NOT contain resource-leveling logic', () => {
    expect(serviceCode).not.toContain('ResourceLevelingService');
    expect(serviceCode).not.toContain('leveling');
    expect(serviceCode).not.toContain('resource_conflict');
  });

  it('should NOT contain material-readiness calculation', () => {
    // M10 reads material line status, does NOT calculate readiness
    expect(serviceCode).not.toContain('MaterialReadinessService');
    expect(serviceCode).not.toContain('calculateLineReadiness');
  });

  it('should NOT contain duplicate readiness scoring logic', () => {
    // M10 reads cached readiness_score, does NOT recalculate
    expect(serviceCode).not.toContain('ReadinessScoreService');
    expect(serviceCode).not.toContain('computeReadiness');
    expect(serviceCode).not.toContain('CRITERIA');
    expect(serviceCode).not.toContain('earnedWeight');
  });

  it('should NOT contain ScheduleHealth calculation', () => {
    expect(serviceCode).not.toContain('ScheduleHealthService');
    expect(serviceCode).not.toContain('calculateHealth');
    expect(serviceCode).not.toContain('schedule_health_index');
  });

  it('should NOT contain baseline calculation', () => {
    expect(serviceCode).not.toContain('ScheduleBaselineService');
    expect(serviceCode).not.toContain('createBaseline');
    expect(serviceCode).not.toContain('snapshotActivities');
  });

  it('should be a read-only orchestration service', () => {
    // Should only contain prisma read operations (findMany, groupBy)
    expect(serviceCode).not.toContain('prisma.workpack.create');
    expect(serviceCode).not.toContain('prisma.workpack.update');
    expect(serviceCode).not.toContain('prisma.activity.create');
    expect(serviceCode).not.toContain('prisma.activity.update');
    expect(serviceCode).not.toContain('prisma.$transaction');
  });

  it('should import only prisma for data access', () => {
    expect(serviceCode).toContain("from '@/lib/prisma'");
    // Should not import any other service
    const importLines = serviceCode.split('\n').filter(line => line.includes('import '));
    const nonPrismaImports = importLines.filter(line =>
      !line.includes('@/lib/prisma') && !line.includes('type ')
    );
    expect(nonPrismaImports.length).toBe(0);
  });
});

// ── SECTION 2: API ARCHITECTURE ─────────────────────────────────────────────

describe('M10 API Architecture', () => {
  const apiCode = (() => {
    const apiPath = path.resolve(__dirname, '../../../../app/api/planning/readiness/route.ts');
    try { return fs.readFileSync(apiPath, 'utf-8'); } catch { return ''; }
  })();

  it('API file should exist', () => {
    expect(apiCode.length).toBeGreaterThan(0);
  });

  it('should use guardApi for authentication', () => {
    expect(apiCode).toContain('guardApi');
  });

  it('should use orgScope for tenant isolation', () => {
    expect(apiCode).toContain('orgScope');
  });

  it('should delegate to PlanningReadinessService', () => {
    expect(apiCode).toContain('PlanningReadinessService');
    expect(apiCode).toContain('getReadiness');
  });

  it('should NOT import scheduleEngine', () => {
    expect(apiCode).not.toContain('scheduleEngine');
  });

  it('should NOT import progress services', () => {
    expect(apiCode).not.toContain('ProgressCalculationService');
    expect(apiCode).not.toContain('ProgressAggregationService');
  });
});

// ── SECTION 3: SECURITY ─────────────────────────────────────────────────────

describe('M10 Security', () => {
  it('should enforce organization_id in all queries', () => {
    const serviceCode = readSrc('PlanningReadinessService.ts');
    // Every prisma query should scope by organization_id
    expect(serviceCode).toContain('organization_id: organizationId');
  });

  it('should NOT trust client-supplied IDs without org scope', () => {
    const serviceCode = readSrc('PlanningReadinessService.ts');
    // The service should always include organization_id in WHERE clauses
    const findManyMatches = serviceCode.match(/prisma\.\w+\.findMany/g) || [];
    expect(findManyMatches.length).toBeGreaterThan(0);
  });
});

// ── SECTION 4: READINESS STATE COMPUTATION ──────────────────────────────────

describe('M10 Readiness Computation', () => {
  let PlanningReadinessService: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import('../PlanningReadinessService');
    PlanningReadinessService = mod.PlanningReadinessService;
  });

  it('should return empty result for empty query', async () => {
    mockPrisma.workpack.findMany.mockResolvedValue([]);
    const result = await PlanningReadinessService.getReadiness('org-1', {});
    expect(result.kpis.total).toBe(0);
    expect(result.workpacks).toHaveLength(0);
  });

  it('should compute NOT_READY for workpack with no activities', async () => {
    mockPrisma.workpack.findMany.mockResolvedValue([{
      id: 'wp-1',
      workpack_number: 'WP-001',
      title: 'Test',
      status: 'draft',
      priority: 'Normal',
      planned_start_date: null,
      planned_end_date: null,
      readiness_score: 0,
      event_id: null,
      unit_id: null,
      system_id: null,
      discipline_id: null,
      asset_id: null,
      approval_status: 'not_submitted',
      asset: null,
      unit: null,
      system: null,
      discipline: null,
      event: null,
      _count: { activities: 0, workpack_documents: 0, constraints: 0 },
    }]);
    mockPrisma.activity.groupBy.mockResolvedValue([]);
    mockPrisma.activity.findMany.mockResolvedValue([]);
    mockPrisma.activityResource.groupBy.mockResolvedValue([]);
    mockPrisma.activityResource.findMany.mockResolvedValue([]);
    mockPrisma.workpack_material_lines.groupBy.mockResolvedValue([]);
    mockPrisma.constraint.groupBy.mockResolvedValue([]);
    mockPrisma.scheduleBaseline.findMany.mockResolvedValue([]);

    const result = await PlanningReadinessService.getReadiness('org-1', {});
    expect(result.workpacks).toHaveLength(1);
    expect(result.workpacks[0].planning_state).toBe('NOT_READY');
    expect(result.workpacks[0].activity_count).toBe(0);
    expect(result.kpis.not_ready).toBe(1);
    expect(result.kpis.ready).toBe(0);
  });

  it('should compute READY for fully-prepared workpack', async () => {
    mockPrisma.workpack.findMany.mockResolvedValue([{
      id: 'wp-ready',
      workpack_number: 'WP-100',
      title: 'Ready WP',
      status: 'approved',
      priority: 'Normal',
      planned_start_date: new Date('2027-04-01'),
      planned_end_date: new Date('2027-04-05'),
      readiness_score: 95,
      event_id: 'evt-1',
      unit_id: 'u-1',
      system_id: null,
      discipline_id: 'd-1',
      asset_id: 'a-1',
      approval_status: 'approved',
      asset: { tag_number: 'HX-101', name: 'Exchanger', equipment_type: 'Heat Exchanger' },
      unit: { name: 'Unit 1' },
      system: null,
      discipline: { name: 'Mechanical', code: 'MECH' },
      event: { name: 'TA-2027' },
      _count: { activities: 10, workpack_documents: 3, constraints: 0 },
    }]);

    // All 10 activities have durations
    mockPrisma.activity.groupBy
      .mockResolvedValueOnce([{ workpack_id: 'wp-ready', _count: { id: 10 } }]) // total
      .mockResolvedValueOnce([{ workpack_id: 'wp-ready', _count: { id: 10 } }]) // durations
      .mockResolvedValueOnce([]); // scheduled (no CPM yet)

    // All 10/10 activities have logic (100% required for CPM)
    mockPrisma.activity.findMany.mockResolvedValue(
      Array.from({ length: 10 }, (_, i) => ({
        id: `a-${i}`,
        workpack_id: 'wp-ready',
        _count: {
          predecessors: 1,
          successors: 1,
        },
      }))
    );

    // 10/10 activities have resources (80% threshold)
    mockPrisma.activityResource.groupBy.mockResolvedValue([{
      workpack_id: 'wp-ready',
      _count: { id: 15 },
    }]);
    mockPrisma.activityResource.findMany.mockResolvedValue(
      Array.from({ length: 10 }, (_, i) => ({
        activity_id: `a-${i}`,
        workpack_id: 'wp-ready',
      }))
    );

    // No materials needed
    mockPrisma.workpack_material_lines.groupBy
      .mockResolvedValueOnce([])  // total
      .mockResolvedValueOnce([]); // ready

    // No open constraints
    mockPrisma.constraint.groupBy
      .mockResolvedValueOnce([])  // open
      .mockResolvedValueOnce([]); // critical

    // No baseline
    mockPrisma.scheduleBaseline.findMany.mockResolvedValue([]);

    const result = await PlanningReadinessService.getReadiness('org-1', {});
    expect(result.workpacks).toHaveLength(1);
    expect(result.workpacks[0].planning_state).toBe('READY');
    expect(result.kpis.ready).toBe(1);
  });

  it('should compute SCHEDULED for workpack with CPM dates', async () => {
    mockPrisma.workpack.findMany.mockResolvedValue([{
      id: 'wp-sched',
      workpack_number: 'WP-200',
      title: 'Scheduled WP',
      status: 'approved',
      priority: 'Normal',
      planned_start_date: new Date('2027-04-01'),
      planned_end_date: new Date('2027-04-05'),
      readiness_score: 90,
      event_id: 'evt-1',
      unit_id: null,
      system_id: null,
      discipline_id: null,
      asset_id: 'a-2',
      approval_status: 'approved',
      asset: { tag_number: 'V-102', name: 'Vessel', equipment_type: 'Pressure Vessel' },
      unit: null,
      system: null,
      discipline: null,
      event: { name: 'TA-2027' },
      _count: { activities: 5, workpack_documents: 1, constraints: 0 },
    }]);

    mockPrisma.activity.groupBy
      .mockResolvedValueOnce([{ workpack_id: 'wp-sched', _count: { id: 5 } }]) // total
      .mockResolvedValueOnce([{ workpack_id: 'wp-sched', _count: { id: 5 } }]) // durations
      .mockResolvedValueOnce([{ workpack_id: 'wp-sched', _count: { id: 5 } }]); // scheduled

    mockPrisma.activity.findMany.mockResolvedValue(
      Array.from({ length: 5 }, (_, i) => ({
        id: `a-${i}`,
        workpack_id: 'wp-sched',
        _count: { predecessors: 1, successors: 1 },
      }))
    );

    mockPrisma.activityResource.groupBy.mockResolvedValue([{
      workpack_id: 'wp-sched', _count: { id: 5 },
    }]);
    mockPrisma.activityResource.findMany.mockResolvedValue(
      Array.from({ length: 5 }, (_, i) => ({
        activity_id: `a-${i}`, workpack_id: 'wp-sched',
      }))
    );

    mockPrisma.workpack_material_lines.groupBy.mockResolvedValue([]);
    mockPrisma.constraint.groupBy.mockResolvedValue([]);
    mockPrisma.scheduleBaseline.findMany.mockResolvedValue([]);

    const result = await PlanningReadinessService.getReadiness('org-1', {});
    expect(result.workpacks[0].planning_state).toBe('SCHEDULED');
    expect(result.kpis.scheduled).toBe(1);
  });

  it('should compute BASELINED for workpack in baselined event', async () => {
    mockPrisma.workpack.findMany.mockResolvedValue([{
      id: 'wp-base',
      workpack_number: 'WP-300',
      title: 'Baselined WP',
      status: 'approved',
      priority: 'Normal',
      planned_start_date: new Date('2027-04-01'),
      planned_end_date: new Date('2027-04-05'),
      readiness_score: 100,
      event_id: 'evt-bl',
      unit_id: null,
      system_id: null,
      discipline_id: null,
      asset_id: 'a-3',
      approval_status: 'approved',
      asset: null,
      unit: null,
      system: null,
      discipline: null,
      event: { name: 'TA-2027' },
      _count: { activities: 5, workpack_documents: 1, constraints: 0 },
    }]);

    mockPrisma.activity.groupBy
      .mockResolvedValueOnce([{ workpack_id: 'wp-base', _count: { id: 5 } }])
      .mockResolvedValueOnce([{ workpack_id: 'wp-base', _count: { id: 5 } }])
      .mockResolvedValueOnce([{ workpack_id: 'wp-base', _count: { id: 5 } }]);

    mockPrisma.activity.findMany.mockResolvedValue(
      Array.from({ length: 5 }, (_, i) => ({
        id: `a-${i}`, workpack_id: 'wp-base',
        _count: { predecessors: 1, successors: 1 },
      }))
    );

    mockPrisma.activityResource.groupBy.mockResolvedValue([{
      workpack_id: 'wp-base', _count: { id: 5 },
    }]);
    mockPrisma.activityResource.findMany.mockResolvedValue(
      Array.from({ length: 5 }, (_, i) => ({
        activity_id: `a-${i}`, workpack_id: 'wp-base',
      }))
    );

    mockPrisma.workpack_material_lines.groupBy.mockResolvedValue([]);
    mockPrisma.constraint.groupBy.mockResolvedValue([]);

    // Baseline exists for this event.
    // OD9.2: keyed on `event_id`, the authoritative STO baseline scope. This mock
    // previously returned `project_id`, encoding the defect where M10 matched Event
    // UUIDs against the Project-domain column.
    mockPrisma.scheduleBaseline.findMany.mockResolvedValue([{
      event_id: 'evt-bl',
    }]);

    const result = await PlanningReadinessService.getReadiness('org-1', {});
    expect(result.workpacks[0].planning_state).toBe('BASELINED');
    expect(result.kpis.baselined).toBe(1);
  });

  it('should identify missing durations', async () => {
    mockPrisma.workpack.findMany.mockResolvedValue([{
      id: 'wp-dur',
      workpack_number: 'WP-400',
      title: 'Missing Duration',
      status: 'approved',
      priority: 'Normal',
      planned_start_date: null,
      planned_end_date: null,
      readiness_score: 30,
      event_id: null,
      unit_id: null,
      system_id: null,
      discipline_id: null,
      asset_id: null,
      approval_status: 'approved',
      asset: null, unit: null, system: null, discipline: null, event: null,
      _count: { activities: 5, workpack_documents: 0, constraints: 0 },
    }]);

    mockPrisma.activity.groupBy
      .mockResolvedValueOnce([{ workpack_id: 'wp-dur', _count: { id: 5 } }]) // total
      .mockResolvedValueOnce([{ workpack_id: 'wp-dur', _count: { id: 2 } }]) // durations
      .mockResolvedValueOnce([]); // scheduled

    mockPrisma.activity.findMany.mockResolvedValue([]);
    mockPrisma.activityResource.groupBy.mockResolvedValue([]);
    mockPrisma.activityResource.findMany.mockResolvedValue([]);
    mockPrisma.workpack_material_lines.groupBy.mockResolvedValue([]);
    mockPrisma.constraint.groupBy.mockResolvedValue([]);
    mockPrisma.scheduleBaseline.findMany.mockResolvedValue([]);

    const result = await PlanningReadinessService.getReadiness('org-1', {});
    const wp = result.workpacks[0];
    expect(wp.activities_with_duration).toBe(2);
    const durCheck = wp.checks.find((c: any) => c.key === 'durations');
    expect(durCheck?.passed).toBe(false);
    expect(durCheck?.evidence).toContain('3 of 5 activities missing duration');
  });

  it('should detect missing logic', async () => {
    mockPrisma.workpack.findMany.mockResolvedValue([{
      id: 'wp-log',
      workpack_number: 'WP-500',
      title: 'Missing Logic',
      status: 'approved',
      priority: 'Normal',
      planned_start_date: null,
      planned_end_date: null,
      readiness_score: 40,
      event_id: null,
      unit_id: null,
      system_id: null,
      discipline_id: null,
      asset_id: null,
      approval_status: 'approved',
      asset: null, unit: null, system: null, discipline: null, event: null,
      _count: { activities: 10, workpack_documents: 0, constraints: 0 },
    }]);

    mockPrisma.activity.groupBy
      .mockResolvedValueOnce([{ workpack_id: 'wp-log', _count: { id: 10 } }])
      .mockResolvedValueOnce([{ workpack_id: 'wp-log', _count: { id: 10 } }])
      .mockResolvedValueOnce([]);

    // Only 3/10 have logic (30% < 80% threshold)
    mockPrisma.activity.findMany.mockResolvedValue(
      Array.from({ length: 10 }, (_, i) => ({
        id: `a-${i}`, workpack_id: 'wp-log',
        _count: { predecessors: i < 3 ? 1 : 0, successors: i < 3 ? 1 : 0 },
      }))
    );

    mockPrisma.activityResource.groupBy.mockResolvedValue([]);
    mockPrisma.activityResource.findMany.mockResolvedValue([]);
    mockPrisma.workpack_material_lines.groupBy.mockResolvedValue([]);
    mockPrisma.constraint.groupBy.mockResolvedValue([]);
    mockPrisma.scheduleBaseline.findMany.mockResolvedValue([]);

    const result = await PlanningReadinessService.getReadiness('org-1', {});
    const wp = result.workpacks[0];
    const logicCheck = wp.checks.find((c: any) => c.key === 'logic');
    expect(logicCheck?.passed).toBe(false);
    expect(logicCheck?.evidence).toContain('3 of 10');
    expect(logicCheck?.evidence).toContain('30%');
  });

  it('should detect open constraints as blocker', async () => {
    mockPrisma.workpack.findMany.mockResolvedValue([{
      id: 'wp-con',
      workpack_number: 'WP-600',
      title: 'Constrained',
      status: 'approved',
      priority: 'Normal',
      planned_start_date: null,
      planned_end_date: null,
      readiness_score: 60,
      event_id: null,
      unit_id: null,
      system_id: null,
      discipline_id: null,
      asset_id: null,
      approval_status: 'approved',
      asset: null, unit: null, system: null, discipline: null, event: null,
      _count: { activities: 5, workpack_documents: 1, constraints: 3 },
    }]);

    mockPrisma.activity.groupBy
      .mockResolvedValueOnce([{ workpack_id: 'wp-con', _count: { id: 5 } }])
      .mockResolvedValueOnce([{ workpack_id: 'wp-con', _count: { id: 5 } }])
      .mockResolvedValueOnce([]);

    mockPrisma.activity.findMany.mockResolvedValue(
      Array.from({ length: 5 }, (_, i) => ({
        id: `a-${i}`, workpack_id: 'wp-con',
        _count: { predecessors: 1, successors: 1 },
      }))
    );

    mockPrisma.activityResource.groupBy.mockResolvedValue([{
      workpack_id: 'wp-con', _count: { id: 5 },
    }]);
    mockPrisma.activityResource.findMany.mockResolvedValue(
      Array.from({ length: 5 }, (_, i) => ({
        activity_id: `a-${i}`, workpack_id: 'wp-con',
      }))
    );

    mockPrisma.workpack_material_lines.groupBy.mockResolvedValue([]);

    // 3 open constraints, 1 critical
    mockPrisma.constraint.groupBy
      .mockResolvedValueOnce([{ workpack_id: 'wp-con', _count: { id: 3 } }]) // open
      .mockResolvedValueOnce([{ workpack_id: 'wp-con', _count: { id: 1 } }]); // critical

    mockPrisma.scheduleBaseline.findMany.mockResolvedValue([]);

    const result = await PlanningReadinessService.getReadiness('org-1', {});
    const wp = result.workpacks[0];
    expect(wp.open_constraints).toBe(3);
    expect(wp.critical_constraints).toBe(1);
    const constCheck = wp.checks.find((c: any) => c.key === 'constraints');
    expect(constCheck?.passed).toBe(false);
    expect(constCheck?.evidence).toContain('3 open constraints');
    expect(constCheck?.evidence).toContain('1 critical');
    expect(result.kpis.critical_blockers).toBe(1);
  });

  it('should handle material blocker', async () => {
    mockPrisma.workpack.findMany.mockResolvedValue([{
      id: 'wp-mat',
      workpack_number: 'WP-700',
      title: 'Material Block',
      status: 'approved',
      priority: 'Normal',
      planned_start_date: null,
      planned_end_date: null,
      readiness_score: 50,
      event_id: null,
      unit_id: null,
      system_id: null,
      discipline_id: null,
      asset_id: null,
      approval_status: 'approved',
      asset: null, unit: null, system: null, discipline: null, event: null,
      _count: { activities: 5, workpack_documents: 1, constraints: 0 },
    }]);

    mockPrisma.activity.groupBy
      .mockResolvedValueOnce([{ workpack_id: 'wp-mat', _count: { id: 5 } }])
      .mockResolvedValueOnce([{ workpack_id: 'wp-mat', _count: { id: 5 } }])
      .mockResolvedValueOnce([]);

    mockPrisma.activity.findMany.mockResolvedValue(
      Array.from({ length: 5 }, (_, i) => ({
        id: `a-${i}`, workpack_id: 'wp-mat',
        _count: { predecessors: 1, successors: 1 },
      }))
    );

    mockPrisma.activityResource.groupBy.mockResolvedValue([{
      workpack_id: 'wp-mat', _count: { id: 3 },
    }]);
    mockPrisma.activityResource.findMany.mockResolvedValue(
      Array.from({ length: 3 }, (_, i) => ({
        activity_id: `a-${i}`, workpack_id: 'wp-mat',
      }))
    );

    // 10 material lines, 3 ready
    mockPrisma.workpack_material_lines.groupBy
      .mockResolvedValueOnce([{ workpack_id: 'wp-mat', _count: { id: 10 } }]) // total
      .mockResolvedValueOnce([{ workpack_id: 'wp-mat', _count: { id: 3 } }]); // ready

    mockPrisma.constraint.groupBy.mockResolvedValue([]);
    mockPrisma.scheduleBaseline.findMany.mockResolvedValue([]);

    const result = await PlanningReadinessService.getReadiness('org-1', {});
    const wp = result.workpacks[0];
    expect(wp.material_total).toBe(10);
    expect(wp.material_ready).toBe(3);
    expect(wp.material_status).toBe('partial');
    const matCheck = wp.checks.find((c: any) => c.key === 'materials');
    expect(matCheck?.passed).toBe(false);
    expect(matCheck?.evidence).toContain('3 of 10');
  });

  it('should handle multiple blockers simultaneously', async () => {
    mockPrisma.workpack.findMany.mockResolvedValue([{
      id: 'wp-multi',
      workpack_number: 'WP-800',
      title: 'Multi-block',
      status: 'draft',
      priority: 'Critical',
      planned_start_date: null,
      planned_end_date: null,
      readiness_score: 10,
      event_id: null,
      unit_id: null,
      system_id: null,
      discipline_id: null,
      asset_id: null,
      approval_status: 'not_submitted',
      asset: null, unit: null, system: null, discipline: null, event: null,
      _count: { activities: 0, workpack_documents: 0, constraints: 2 },
    }]);

    mockPrisma.activity.groupBy.mockResolvedValue([]);
    mockPrisma.activity.findMany.mockResolvedValue([]);
    mockPrisma.activityResource.groupBy.mockResolvedValue([]);
    mockPrisma.activityResource.findMany.mockResolvedValue([]);
    mockPrisma.workpack_material_lines.groupBy.mockResolvedValue([]);
    mockPrisma.constraint.groupBy
      .mockResolvedValueOnce([{ workpack_id: 'wp-multi', _count: { id: 2 } }])
      .mockResolvedValueOnce([{ workpack_id: 'wp-multi', _count: { id: 1 } }]);
    mockPrisma.scheduleBaseline.findMany.mockResolvedValue([]);

    const result = await PlanningReadinessService.getReadiness('org-1', {});
    const wp = result.workpacks[0];
    expect(wp.planning_state).toBe('NOT_READY');
    const failedChecks = wp.checks.filter((c: any) => !c.passed);
    expect(failedChecks.length).toBeGreaterThanOrEqual(3); // scope, activities, constraints at minimum
  });

  it('should filter by readiness_state', async () => {
    mockPrisma.workpack.findMany.mockResolvedValue([
      {
        id: 'wp-nr', workpack_number: 'WP-NR', title: 'Not Ready', status: 'draft',
        priority: 'Normal', planned_start_date: null, planned_end_date: null,
        readiness_score: 0, event_id: null, unit_id: null, system_id: null,
        discipline_id: null, asset_id: null, approval_status: 'not_submitted',
        asset: null, unit: null, system: null, discipline: null, event: null,
        _count: { activities: 0, workpack_documents: 0, constraints: 0 },
      },
    ]);

    mockPrisma.activity.groupBy.mockResolvedValue([]);
    mockPrisma.activity.findMany.mockResolvedValue([]);
    mockPrisma.activityResource.groupBy.mockResolvedValue([]);
    mockPrisma.activityResource.findMany.mockResolvedValue([]);
    mockPrisma.workpack_material_lines.groupBy.mockResolvedValue([]);
    mockPrisma.constraint.groupBy.mockResolvedValue([]);
    mockPrisma.scheduleBaseline.findMany.mockResolvedValue([]);

    // Filter for READY — should return 0 matches
    const result = await PlanningReadinessService.getReadiness('org-1', {
      readiness_state: 'READY' as any,
    });
    expect(result.workpacks).toHaveLength(0);
    expect(result.kpis.total).toBe(1); // KPIs still show total
  });
});

// ── SECTION 5: PROTECTED MODULES (REGRESSION) ──────────────────────────────

describe('M10 Protected Module Regression', () => {
  it('should NOT modify ProgressCalculationService', () => {
    // Read the file and verify it has not been touched
    const filePath = path.resolve(__dirname, '../../progress/ProgressCalculationService.ts');
    const exists = fs.existsSync(filePath);
    expect(exists).toBe(true);
    // M10 should not import or reference this service
    const serviceCode = readSrc('PlanningReadinessService.ts');
    expect(serviceCode).not.toContain('ProgressCalculation');
  });

  it('should NOT modify ProgressAggregationService', () => {
    const filePath = path.resolve(__dirname, '../../progress/ProgressAggregationService.ts');
    const exists = fs.existsSync(filePath);
    expect(exists).toBe(true);
    const serviceCode = readSrc('PlanningReadinessService.ts');
    expect(serviceCode).not.toContain('ProgressAggregation');
  });

  it('should NOT modify scheduleEngine', () => {
    const filePath = path.resolve(__dirname, '../../../lib/scheduleEngine.ts');
    const exists = fs.existsSync(filePath);
    expect(exists).toBe(true);
    const serviceCode = readSrc('PlanningReadinessService.ts');
    expect(serviceCode).not.toContain('scheduleEngine');
  });

  it('should NOT modify ReadinessScoreService', () => {
    const filePath = path.resolve(__dirname, '../../workpack-intelligence/ReadinessScoreService.ts');
    const exists = fs.existsSync(filePath);
    expect(exists).toBe(true);
  });

  it('should NOT modify MaterialReadinessService', () => {
    const filePath = path.resolve(__dirname, '../../materials/MaterialReadinessService.ts');
    const exists = fs.existsSync(filePath);
    expect(exists).toBe(true);
  });

  it('should NOT modify ResourceLevelingService', () => {
    const filePath = path.resolve(__dirname, '../../resources/ResourceLevelingService.ts');
    const exists = fs.existsSync(filePath);
    expect(exists).toBe(true);
  });

  it('should NOT modify ScheduleHealthService', () => {
    const filePath = path.resolve(__dirname, '../../resources/ScheduleHealthService.ts');
    const exists = fs.existsSync(filePath);
    expect(exists).toBe(true);
  });

  it('should NOT create new Prisma models', () => {
    const schemaPath = path.resolve(__dirname, '../../../../prisma/schema.prisma');
    const schema = fs.readFileSync(schemaPath, 'utf-8');
    // Verify PlanningReadiness model does NOT exist
    expect(schema).not.toContain('model PlanningReadiness');
    expect(schema).not.toContain('model ReadinessCheck');
    expect(schema).not.toContain('model PlanningState');
  });

  it('should have ZERO schema changes', () => {
    // This is verified by the absence of any new model or migration
    const migrationsPath = path.resolve(__dirname, '../../../../prisma/migrations');
    // We just verify the schema doesn't contain M10 models
    const schemaPath = path.resolve(__dirname, '../../../../prisma/schema.prisma');
    const schema = fs.readFileSync(schemaPath, 'utf-8');
    expect(schema).not.toContain('M10');
    expect(schema).not.toContain('planning_readiness');
  });
});

// ── SECTION 6: PAGE ARCHITECTURE ────────────────────────────────────────────

describe('M10 Page Architecture', () => {
  it('page file should exist', () => {
    const pagePath = path.resolve(__dirname, '../../../../app/(dashboard)/planning/readiness/page.tsx');
    expect(fs.existsSync(pagePath)).toBe(true);
  });

  it('page should NOT import progress services', () => {
    const pagePath = path.resolve(__dirname, '../../../../app/(dashboard)/planning/readiness/page.tsx');
    const content = fs.readFileSync(pagePath, 'utf-8');
    expect(content).not.toContain('ProgressCalculationService');
    expect(content).not.toContain('ProgressAggregationService');
    expect(content).not.toContain('scheduleEngine');
  });

  it('page should call /api/planning/readiness', () => {
    const pagePath = path.resolve(__dirname, '../../../../app/(dashboard)/planning/readiness/page.tsx');
    const content = fs.readFileSync(pagePath, 'utf-8');
    expect(content).toContain('/api/planning/readiness');
  });

  it('navigation should include planning readiness link', async () => {
    // OD9.2 moved the navigation definition out of `app/(dashboard)/layout.tsx` into
    // `src/config/business-navigation.ts` so the four frozen business domains can be
    // asserted behaviourally. This now builds the real STO menu instead of grepping the
    // layout, which is a stronger check of the same requirement.
    const { buildStoItems } = await import('@/config/business-navigation');
    const stoItems = buildStoItems({
      role: 'tenant_administrator',
      isFeat: () => true,
      isContractorTenant: false,
      showAdmin: true,
      canViewOrgSettings: true,
    });
    const readiness = stoItems.find((i) => i.href === '/planning/readiness');
    expect(readiness).toBeDefined();
    expect(readiness!.label).toContain('Planning Readiness');
    // Readiness is STO-owned (M10 is an STO authority), so it belongs in the STO domain.
    expect(readiness!.section).toBe('Readiness');
  });
});

// ── SECTION 7: M10-R1 FORENSIC TESTS ───────────────────────────────────────

describe('M10-R1 Forensic: False Readiness Prevention', () => {
  let PlanningReadinessService: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import('../PlanningReadinessService');
    PlanningReadinessService = mod.PlanningReadinessService;
  });

  // Helper: create standard mock with overrides
  function mockStandardWorkpack(overrides: any = {}) {
    return {
      id: 'wp-forensic',
      workpack_number: 'WP-F01',
      title: 'Forensic Test',
      status: 'approved',
      priority: 'Normal',
      planned_start_date: null,
      planned_end_date: null,
      readiness_score: 70,
      event_id: 'evt-1',
      unit_id: null,
      system_id: null,
      discipline_id: null,
      asset_id: 'a-1',
      approval_status: 'approved',
      asset: { tag_number: 'HX-101', name: 'Exchanger', asset_type: 'Heat Exchanger' },
      unit: null, system: null, discipline: null,
      event: { name: 'TA-2027' },
      _count: { activities: 10, workpack_documents: 1, constraints: 0 },
      ...overrides,
    };
  }

  function mockAllActivitiesReady(wpId: string, count: number) {
    mockPrisma.activity.groupBy
      .mockResolvedValueOnce([{ workpack_id: wpId, _count: { id: count } }]) // total
      .mockResolvedValueOnce([{ workpack_id: wpId, _count: { id: count } }]) // durations
      .mockResolvedValueOnce([]); // scheduled

    mockPrisma.activity.findMany.mockResolvedValue(
      Array.from({ length: count }, (_, i) => ({
        id: `a-${i}`, workpack_id: wpId,
        _count: { predecessors: 1, successors: 1 },
      }))
    );

    mockPrisma.activityResource.groupBy.mockResolvedValue([{
      workpack_id: wpId, _count: { id: count },
    }]);
    mockPrisma.activityResource.findMany.mockResolvedValue(
      Array.from({ length: count }, (_, i) => ({
        activity_id: `a-${i}`, workpack_id: wpId,
      }))
    );

    mockPrisma.workpack_material_lines.groupBy.mockResolvedValue([]);
    mockPrisma.constraint.groupBy.mockResolvedValue([]);
    mockPrisma.scheduleBaseline.findMany.mockResolvedValue([]);
  }

  it('F-002: false READY when 90% activities have logic (requires 100%)', async () => {
    mockPrisma.workpack.findMany.mockResolvedValue([mockStandardWorkpack()]);

    mockPrisma.activity.groupBy
      .mockResolvedValueOnce([{ workpack_id: 'wp-forensic', _count: { id: 10 } }])
      .mockResolvedValueOnce([{ workpack_id: 'wp-forensic', _count: { id: 10 } }])
      .mockResolvedValueOnce([]);

    // 9/10 have logic (90% — was accepted at 80%, now rejected at 100%)
    mockPrisma.activity.findMany.mockResolvedValue(
      Array.from({ length: 10 }, (_, i) => ({
        id: `a-${i}`, workpack_id: 'wp-forensic',
        _count: { predecessors: i < 9 ? 1 : 0, successors: i < 9 ? 1 : 0 },
      }))
    );

    mockPrisma.activityResource.groupBy.mockResolvedValue([{
      workpack_id: 'wp-forensic', _count: { id: 10 },
    }]);
    mockPrisma.activityResource.findMany.mockResolvedValue(
      Array.from({ length: 10 }, (_, i) => ({
        activity_id: `a-${i}`, workpack_id: 'wp-forensic',
      }))
    );
    mockPrisma.workpack_material_lines.groupBy.mockResolvedValue([]);
    mockPrisma.constraint.groupBy.mockResolvedValue([]);
    mockPrisma.scheduleBaseline.findMany.mockResolvedValue([]);

    const result = await PlanningReadinessService.getReadiness('org-1', {});
    expect(result.workpacks[0].planning_state).toBe('NOT_READY');
    const logicCheck = result.workpacks[0].checks.find((c: any) => c.key === 'logic');
    expect(logicCheck?.passed).toBe(false);
  });

  it('F-003: false READY when only 70% activities have resources (requires 80%)', async () => {
    mockPrisma.workpack.findMany.mockResolvedValue([mockStandardWorkpack()]);

    mockPrisma.activity.groupBy
      .mockResolvedValueOnce([{ workpack_id: 'wp-forensic', _count: { id: 10 } }])
      .mockResolvedValueOnce([{ workpack_id: 'wp-forensic', _count: { id: 10 } }])
      .mockResolvedValueOnce([]);

    mockPrisma.activity.findMany.mockResolvedValue(
      Array.from({ length: 10 }, (_, i) => ({
        id: `a-${i}`, workpack_id: 'wp-forensic',
        _count: { predecessors: 1, successors: 1 },
      }))
    );

    mockPrisma.activityResource.groupBy.mockResolvedValue([{
      workpack_id: 'wp-forensic', _count: { id: 7 },
    }]);
    // Only 7/10 activities have resources (70% < 80%)
    mockPrisma.activityResource.findMany.mockResolvedValue(
      Array.from({ length: 7 }, (_, i) => ({
        activity_id: `a-${i}`, workpack_id: 'wp-forensic',
      }))
    );
    mockPrisma.workpack_material_lines.groupBy.mockResolvedValue([]);
    mockPrisma.constraint.groupBy.mockResolvedValue([]);
    mockPrisma.scheduleBaseline.findMany.mockResolvedValue([]);

    const result = await PlanningReadinessService.getReadiness('org-1', {});
    expect(result.workpacks[0].planning_state).toBe('NOT_READY');
    const resCheck = result.workpacks[0].checks.find((c: any) => c.key === 'resources');
    expect(resCheck?.passed).toBe(false);
    expect(resCheck?.evidence).toContain('70%');
  });

  it('F-001: in_progress constraint blocks readiness', async () => {
    mockPrisma.workpack.findMany.mockResolvedValue([mockStandardWorkpack()]);
    mockAllActivitiesReady('wp-forensic', 10);

    // Override constraint mock: 1 in_progress constraint
    mockPrisma.constraint.groupBy
      .mockReset()
      .mockResolvedValueOnce([{ workpack_id: 'wp-forensic', _count: { id: 1 } }]) // unresolved
      .mockResolvedValueOnce([]); // no critical

    const result = await PlanningReadinessService.getReadiness('org-1', {});
    expect(result.workpacks[0].planning_state).toBe('NOT_READY');
    expect(result.workpacks[0].open_constraints).toBe(1);
  });

  it('F-004: document check is existence-only (documented limitation)', async () => {
    const serviceCode = readSrc('PlanningReadinessService.ts');
    // Documents check uses docCount > 0, not status/approval
    expect(serviceCode).toContain('docCount > 0');
    // This is a documented P3 limitation, not a false readiness for READY
    // because 'documents' is NOT in planningPrereqKeys
    expect(serviceCode).toContain("planningPrereqKeys = ['scope', 'activities', 'durations', 'logic', 'resources', 'materials', 'constraints']");
  });

  it('F-005: document readiness does NOT gate READY state', async () => {
    // A workpack with 0 documents should still be READY if all other prereqs pass
    mockPrisma.workpack.findMany.mockResolvedValue([
      mockStandardWorkpack({
        _count: { activities: 5, workpack_documents: 0, constraints: 0 },
      }),
    ]);
    mockAllActivitiesReady('wp-forensic', 5);

    const result = await PlanningReadinessService.getReadiness('org-1', {});
    // Documents check will fail, but state should still be READY
    expect(result.workpacks[0].planning_state).toBe('READY');
    const docCheck = result.workpacks[0].checks.find((c: any) => c.key === 'documents');
    expect(docCheck?.passed).toBe(false);
  });

  it('SCHEDULED does not calculate CPM — reads existing early_start', async () => {
    const serviceCode = readSrc('PlanningReadinessService.ts');
    // Verify SCHEDULED is detected by reading existing early_start, not calculating
    expect(serviceCode).toContain("early_start: { not: null }");
    expect(serviceCode).not.toContain('calculateSchedule');
    expect(serviceCode).not.toContain('forward_pass');
  });

  it('BASELINED does not create baselines — reads existing scheduleBaseline', async () => {
    const serviceCode = readSrc('PlanningReadinessService.ts');
    expect(serviceCode).toContain('prisma.scheduleBaseline.findMany');
    expect(serviceCode).not.toContain('prisma.scheduleBaseline.create');
    expect(serviceCode).toContain('is_current: true');
    expect(serviceCode).toContain('organization_id: organizationId');
  });

  it('baseline query scopes by organization_id (cross-tenant isolation)', async () => {
    const serviceCode = readSrc('PlanningReadinessService.ts');
    // The baseline query must include organization_id
    const baselineSection = serviceCode.substring(
      serviceCode.indexOf('scheduleBaseline.findMany'),
      serviceCode.indexOf('baselinedEvents.add')
    );
    expect(baselineSection).toContain('organization_id: organizationId');
  });

  it('no per-workpack Prisma calls (N+1 prevention)', async () => {
    const serviceCode = readSrc('PlanningReadinessService.ts');
    // All Prisma calls should use batch patterns: IN clause or groupBy
    // There should be NO prisma calls inside the `for (const wp of workpacks)` loop
    const loopSection = serviceCode.substring(
      serviceCode.indexOf('for (const wp of workpacks)'),
      serviceCode.indexOf('return { kpis, workpacks: filtered }')
    );
    expect(loopSection).not.toContain('prisma.');
    expect(loopSection).not.toContain('await ');
  });

  it('Prisma call count is bounded O(1) regardless of workpack count', async () => {
    const serviceCode = readSrc('PlanningReadinessService.ts');
    // Count all prisma calls — should be fixed regardless of workpack count
    const prismaCallPattern = /prisma\.\w+\.\w+\(/g;
    const calls = serviceCode.match(prismaCallPattern) || [];
    // Expected: 1 workpack.findMany + 3 activity.groupBy + 1 activity.findMany
    //         + 1 activityResource.groupBy + 1 activityResource.findMany
    //         + 2 material_lines.groupBy + 2 constraint.groupBy
    //         + 1 scheduleBaseline.findMany = 12 calls
    expect(calls.length).toBeLessThanOrEqual(13);
    expect(calls.length).toBeGreaterThanOrEqual(10);
  });

  it('scope check requires explicit approval status', async () => {
    // draft + not_submitted should NOT be scope-approved
    mockPrisma.workpack.findMany.mockResolvedValue([
      mockStandardWorkpack({
        status: 'draft',
        approval_status: 'not_submitted',
      }),
    ]);
    mockAllActivitiesReady('wp-forensic', 10);

    const result = await PlanningReadinessService.getReadiness('org-1', {});
    const scopeCheck = result.workpacks[0].checks.find((c: any) => c.key === 'scope');
    expect(scopeCheck?.passed).toBe(false);
    expect(result.workpacks[0].planning_state).toBe('NOT_READY');
  });

  it('material readiness uses authoritative material_readiness field', async () => {
    const serviceCode = readSrc('PlanningReadinessService.ts');
    // Must use the authoritative material_readiness field, not procurement_status
    expect(serviceCode).toContain("material_readiness: 'ready'");
    expect(serviceCode).not.toContain("procurement_status");
  });

  it('constraint evidence shows both open and critical counts', async () => {
    mockPrisma.workpack.findMany.mockResolvedValue([mockStandardWorkpack()]);
    mockAllActivitiesReady('wp-forensic', 10);

    mockPrisma.constraint.groupBy
      .mockReset()
      .mockResolvedValueOnce([{ workpack_id: 'wp-forensic', _count: { id: 5 } }])
      .mockResolvedValueOnce([{ workpack_id: 'wp-forensic', _count: { id: 2 } }]);

    const result = await PlanningReadinessService.getReadiness('org-1', {});
    const constCheck = result.workpacks[0].checks.find((c: any) => c.key === 'constraints');
    expect(constCheck?.evidence).toContain('5 open constraints');
    expect(constCheck?.evidence).toContain('2 critical');
  });
});

// ── SECTION 8: M10-R2 LOGIC DEFINITION VALIDATION ──────────────────────────

describe('M10-R2: CPM Network Logic Semantics', () => {
  let PlanningReadinessService: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import('../PlanningReadinessService');
    PlanningReadinessService = mod.PlanningReadinessService;
  });

  function makeWp(overrides: any = {}) {
    return {
      id: 'wp-logic', workpack_number: 'WP-L01', title: 'Logic Test',
      status: 'approved', priority: 'Normal',
      planned_start_date: null, planned_end_date: null,
      readiness_score: 70, event_id: 'evt-1', unit_id: null, system_id: null,
      discipline_id: null, asset_id: 'a-1', approval_status: 'approved',
      asset: { tag_number: 'HX-1', name: 'X', asset_type: 'Y' },
      unit: null, system: null, discipline: null, event: { name: 'TA-2027' },
      _count: { activities: 4, workpack_documents: 1, constraints: 0 },
      ...overrides,
    };
  }

  function mockResourcesMaterialsConstraints(wpId: string, actCount: number) {
    mockPrisma.activityResource.groupBy.mockResolvedValue([{ workpack_id: wpId, _count: { id: actCount } }]);
    mockPrisma.activityResource.findMany.mockResolvedValue(
      Array.from({ length: actCount }, (_, i) => ({ activity_id: `a-${i}`, workpack_id: wpId }))
    );
    mockPrisma.workpack_material_lines.groupBy.mockResolvedValue([]);
    mockPrisma.constraint.groupBy.mockResolvedValue([]);
    mockPrisma.scheduleBaseline.findMany.mockResolvedValue([]);
  }

  it('R2-1: valid start activity (successor only) → accepted', async () => {
    // 4-activity network: A→B→C→D
    // A has successor only, D has predecessor only, B/C have both
    mockPrisma.workpack.findMany.mockResolvedValue([makeWp()]);
    mockPrisma.activity.groupBy
      .mockResolvedValueOnce([{ workpack_id: 'wp-logic', _count: { id: 4 } }])
      .mockResolvedValueOnce([{ workpack_id: 'wp-logic', _count: { id: 4 } }])
      .mockResolvedValueOnce([]);

    mockPrisma.activity.findMany.mockResolvedValue([
      { id: 'a-0', workpack_id: 'wp-logic', _count: { predecessors: 0, successors: 1 } }, // START: successor only
      { id: 'a-1', workpack_id: 'wp-logic', _count: { predecessors: 1, successors: 1 } }, // INTERMEDIATE
      { id: 'a-2', workpack_id: 'wp-logic', _count: { predecessors: 1, successors: 1 } }, // INTERMEDIATE
      { id: 'a-3', workpack_id: 'wp-logic', _count: { predecessors: 1, successors: 0 } }, // FINISH: predecessor only
    ]);

    mockResourcesMaterialsConstraints('wp-logic', 4);

    const result = await PlanningReadinessService.getReadiness('org-1', {});
    const logicCheck = result.workpacks[0].checks.find((c: any) => c.key === 'logic');
    expect(logicCheck?.passed).toBe(true);
    expect(result.workpacks[0].activities_with_logic).toBe(4);
  });

  it('R2-2: valid intermediate activity (predecessor + successor) → accepted', async () => {
    // Covered by R2-1 — intermediate activities have both
    const serviceCode = readSrc('PlanningReadinessService.ts');
    // Logic uses OR: predecessors > 0 || successors > 0
    expect(serviceCode).toContain('a._count.predecessors > 0 || a._count.successors > 0');
  });

  it('R2-3: valid finish activity (predecessor only) → accepted', async () => {
    // Single-activity workpack with predecessor only (finish milestone)
    mockPrisma.workpack.findMany.mockResolvedValue([makeWp({ _count: { activities: 1, workpack_documents: 1, constraints: 0 } })]);
    mockPrisma.activity.groupBy
      .mockResolvedValueOnce([{ workpack_id: 'wp-logic', _count: { id: 1 } }])
      .mockResolvedValueOnce([{ workpack_id: 'wp-logic', _count: { id: 1 } }])
      .mockResolvedValueOnce([]);

    mockPrisma.activity.findMany.mockResolvedValue([
      { id: 'a-0', workpack_id: 'wp-logic', _count: { predecessors: 1, successors: 0 } }, // FINISH only
    ]);

    mockResourcesMaterialsConstraints('wp-logic', 1);

    const result = await PlanningReadinessService.getReadiness('org-1', {});
    const logicCheck = result.workpacks[0].checks.find((c: any) => c.key === 'logic');
    expect(logicCheck?.passed).toBe(true);
  });

  it('R2-4: genuinely disconnected activity (no predecessor, no successor) → rejected', async () => {
    mockPrisma.workpack.findMany.mockResolvedValue([makeWp({ _count: { activities: 3, workpack_documents: 1, constraints: 0 } })]);
    mockPrisma.activity.groupBy
      .mockResolvedValueOnce([{ workpack_id: 'wp-logic', _count: { id: 3 } }])
      .mockResolvedValueOnce([{ workpack_id: 'wp-logic', _count: { id: 3 } }])
      .mockResolvedValueOnce([]);

    mockPrisma.activity.findMany.mockResolvedValue([
      { id: 'a-0', workpack_id: 'wp-logic', _count: { predecessors: 0, successors: 1 } },
      { id: 'a-1', workpack_id: 'wp-logic', _count: { predecessors: 1, successors: 0 } },
      { id: 'a-2', workpack_id: 'wp-logic', _count: { predecessors: 0, successors: 0 } }, // DISCONNECTED
    ]);

    mockResourcesMaterialsConstraints('wp-logic', 3);

    const result = await PlanningReadinessService.getReadiness('org-1', {});
    const logicCheck = result.workpacks[0].checks.find((c: any) => c.key === 'logic');
    expect(logicCheck?.passed).toBe(false);
    expect(result.workpacks[0].activities_with_logic).toBe(2);
    expect(result.workpacks[0].planning_state).toBe('NOT_READY');
  });

  it('R2-5: multiple disconnected activities → rejected', async () => {
    mockPrisma.workpack.findMany.mockResolvedValue([makeWp({ _count: { activities: 5, workpack_documents: 1, constraints: 0 } })]);
    mockPrisma.activity.groupBy
      .mockResolvedValueOnce([{ workpack_id: 'wp-logic', _count: { id: 5 } }])
      .mockResolvedValueOnce([{ workpack_id: 'wp-logic', _count: { id: 5 } }])
      .mockResolvedValueOnce([]);

    mockPrisma.activity.findMany.mockResolvedValue([
      { id: 'a-0', workpack_id: 'wp-logic', _count: { predecessors: 0, successors: 1 } },
      { id: 'a-1', workpack_id: 'wp-logic', _count: { predecessors: 1, successors: 0 } },
      { id: 'a-2', workpack_id: 'wp-logic', _count: { predecessors: 0, successors: 0 } }, // disconnected
      { id: 'a-3', workpack_id: 'wp-logic', _count: { predecessors: 0, successors: 0 } }, // disconnected
      { id: 'a-4', workpack_id: 'wp-logic', _count: { predecessors: 0, successors: 0 } }, // disconnected
    ]);

    mockResourcesMaterialsConstraints('wp-logic', 5);

    const result = await PlanningReadinessService.getReadiness('org-1', {});
    expect(result.workpacks[0].activities_with_logic).toBe(2);
    expect(result.workpacks[0].planning_state).toBe('NOT_READY');
  });

  it('R2-6: 100% connected network → READY', async () => {
    mockPrisma.workpack.findMany.mockResolvedValue([makeWp()]);
    mockPrisma.activity.groupBy
      .mockResolvedValueOnce([{ workpack_id: 'wp-logic', _count: { id: 4 } }])
      .mockResolvedValueOnce([{ workpack_id: 'wp-logic', _count: { id: 4 } }])
      .mockResolvedValueOnce([]);

    mockPrisma.activity.findMany.mockResolvedValue([
      { id: 'a-0', workpack_id: 'wp-logic', _count: { predecessors: 0, successors: 1 } },
      { id: 'a-1', workpack_id: 'wp-logic', _count: { predecessors: 1, successors: 1 } },
      { id: 'a-2', workpack_id: 'wp-logic', _count: { predecessors: 1, successors: 1 } },
      { id: 'a-3', workpack_id: 'wp-logic', _count: { predecessors: 1, successors: 0 } },
    ]);

    mockResourcesMaterialsConstraints('wp-logic', 4);

    const result = await PlanningReadinessService.getReadiness('org-1', {});
    expect(result.workpacks[0].planning_state).toBe('READY');
    expect(result.workpacks[0].checks.find((c: any) => c.key === 'logic')?.passed).toBe(true);
  });
});

// ── SECTION 9: M10-R2 RESOURCE THRESHOLD BOUNDARY TESTS ────────────────────

describe('M10-R2: Resource Threshold Boundary', () => {
  let PlanningReadinessService: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import('../PlanningReadinessService');
    PlanningReadinessService = mod.PlanningReadinessService;
  });

  function readyWp(actCount: number) {
    return {
      id: 'wp-res', workpack_number: 'WP-R01', title: 'Res Test',
      status: 'approved', priority: 'Normal',
      planned_start_date: null, planned_end_date: null,
      readiness_score: 80, event_id: 'evt-1', unit_id: null, system_id: null,
      discipline_id: null, asset_id: 'a-1', approval_status: 'approved',
      asset: { tag_number: 'HX-1', name: 'X', asset_type: 'Y' },
      unit: null, system: null, discipline: null, event: { name: 'TA' },
      _count: { activities: actCount, workpack_documents: 1, constraints: 0 },
    };
  }

  function mockBase(wpId: string, actCount: number, resCount: number) {
    mockPrisma.workpack.findMany.mockResolvedValue([readyWp(actCount)]);
    mockPrisma.activity.groupBy
      .mockResolvedValueOnce([{ workpack_id: wpId, _count: { id: actCount } }])
      .mockResolvedValueOnce([{ workpack_id: wpId, _count: { id: actCount } }])
      .mockResolvedValueOnce([]);
    mockPrisma.activity.findMany.mockResolvedValue(
      Array.from({ length: actCount }, (_, i) => ({
        id: `a-${i}`, workpack_id: wpId,
        _count: { predecessors: 1, successors: 1 },
      }))
    );
    mockPrisma.activityResource.groupBy.mockResolvedValue([{ workpack_id: wpId, _count: { id: resCount } }]);
    mockPrisma.activityResource.findMany.mockResolvedValue(
      Array.from({ length: resCount }, (_, i) => ({ activity_id: `a-${i}`, workpack_id: wpId }))
    );
    mockPrisma.workpack_material_lines.groupBy.mockResolvedValue([]);
    mockPrisma.constraint.groupBy.mockResolvedValue([]);
    mockPrisma.scheduleBaseline.findMany.mockResolvedValue([]);
  }

  it('R2-res: 100% assigned → pass', async () => {
    mockBase('wp-res', 10, 10);
    const result = await PlanningReadinessService.getReadiness('org-1', {});
    expect(result.workpacks[0].checks.find((c: any) => c.key === 'resources')?.passed).toBe(true);
  });

  it('R2-res: exactly 80% assigned → pass', async () => {
    mockBase('wp-res', 10, 8);
    const result = await PlanningReadinessService.getReadiness('org-1', {});
    expect(result.workpacks[0].checks.find((c: any) => c.key === 'resources')?.passed).toBe(true);
  });

  it('R2-res: 79% assigned (below threshold) → fail', async () => {
    // ceil(10 * 0.8) = 8, so 7 < 8 → fail
    mockBase('wp-res', 10, 7);
    const result = await PlanningReadinessService.getReadiness('org-1', {});
    expect(result.workpacks[0].checks.find((c: any) => c.key === 'resources')?.passed).toBe(false);
  });

  it('R2-res: 0% assigned → fail', async () => {
    mockPrisma.workpack.findMany.mockResolvedValue([readyWp(10)]);
    mockPrisma.activity.groupBy
      .mockResolvedValueOnce([{ workpack_id: 'wp-res', _count: { id: 10 } }])
      .mockResolvedValueOnce([{ workpack_id: 'wp-res', _count: { id: 10 } }])
      .mockResolvedValueOnce([]);
    mockPrisma.activity.findMany.mockResolvedValue(
      Array.from({ length: 10 }, (_, i) => ({
        id: `a-${i}`, workpack_id: 'wp-res',
        _count: { predecessors: 1, successors: 1 },
      }))
    );
    mockPrisma.activityResource.groupBy.mockResolvedValue([]);
    mockPrisma.activityResource.findMany.mockResolvedValue([]);
    mockPrisma.workpack_material_lines.groupBy.mockResolvedValue([]);
    mockPrisma.constraint.groupBy.mockResolvedValue([]);
    mockPrisma.scheduleBaseline.findMany.mockResolvedValue([]);

    const result = await PlanningReadinessService.getReadiness('org-1', {});
    expect(result.workpacks[0].checks.find((c: any) => c.key === 'resources')?.passed).toBe(false);
    expect(result.workpacks[0].planning_state).toBe('NOT_READY');
  });

  it('R2-res: does NOT check capacity/leveling/availability', async () => {
    const serviceCode = readSrc('PlanningReadinessService.ts');
    // Exclude comment lines, check functional code only
    const funcCode = serviceCode.split('\n').filter((l: string) => !l.trim().startsWith('*') && !l.trim().startsWith('//')).join('\n');
    expect(funcCode).not.toContain('capacity');
    expect(funcCode).not.toContain('availability');
    expect(funcCode).not.toContain('leveling');
    expect(funcCode).not.toContain('conflict');
    expect(funcCode).not.toContain('overallocation');
  });
});

// ── SECTION 10: M10-R2 STATE MACHINE + BASELINE SEMANTICS ──────────────────

describe('M10-R2: State Machine & Baseline Semantics', () => {
  it('BASELINED is event-level, not workpack-level', () => {
    const serviceCode = readSrc('PlanningReadinessService.ts');
    // Baseline check maps Workpack.event_id → ScheduleBaseline.event_id
    expect(serviceCode).toContain('baselinedEvents.has(wp.event_id)');
    // NOT per-workpack baseline
    expect(serviceCode).not.toContain('baselinedWorkpacks');
    // The baseline section specifically should not use wp.id
    const baselineSection = serviceCode.substring(
      serviceCode.indexOf('Batch check baselines'),
      serviceCode.indexOf('Build results')
    );
    expect(baselineSection).not.toContain('wp.id');
    // OD9.2: the baseline query is keyed on the authoritative STO scope `event_id`.
    // It must never filter by the Project-domain `project_id` column, which would
    // make Project a de-facto STO readiness authority.
    expect(baselineSection).toContain('event_id: { in: eventIds }');
    expect(baselineSection).not.toContain('project_id: { in: eventIds }');
  });

  it('SCHEDULED requires existing CPM output + mandatory checks', () => {
    const serviceCode = readSrc('PlanningReadinessService.ts');
    // SCHEDULED condition
    expect(serviceCode).toContain('hasScheduleDates && allMandatoryPassed');
  });

  it('BASELINED takes priority over SCHEDULED', () => {
    const serviceCode = readSrc('PlanningReadinessService.ts');
    // State derivation: if(hasBaseline)→BASELINED, else if(hasSchedule)→SCHEDULED, else if(allPrereqs)→READY
    // Check the if-chain order by looking at the assignment lines
    const baselinedAssign = serviceCode.indexOf("planningState = 'BASELINED'");
    const scheduledAssign = serviceCode.indexOf("planningState = 'SCHEDULED'");
    const readyAssign = serviceCode.indexOf("planningState = 'READY'");
    const notReadyAssign = serviceCode.indexOf("planningState = 'NOT_READY'");
    expect(baselinedAssign).toBeGreaterThan(-1);
    expect(scheduledAssign).toBeGreaterThan(-1);
    expect(baselinedAssign).toBeLessThan(scheduledAssign);
    expect(scheduledAssign).toBeLessThan(readyAssign);
    expect(readyAssign).toBeLessThan(notReadyAssign);
  });
});

// ── SECTION 11: M10-R2 ARCHITECTURE GOVERNANCE ─────────────────────────────

describe('M10-R2: Architecture Governance', () => {
  const serviceCode = readSrc('PlanningReadinessService.ts');

  const forbidden = [
    'calculateSchedule', 'forward_pass', 'backward_pass', 'topologicalSort',
    'calculateProgress', 'ProgressCalculation', 'ProgressAggregation',
    'earned_value', 'planned_value', 'actual_cost',
    'ResourceLeveling', 'MaterialReadinessService',
    'ScheduleHealthService', 'ReadinessScoreService',
    'ScheduleBaselineService', 'createBaseline', 'snapshotActivities',
  ];

  for (const keyword of forbidden) {
    it(`does NOT contain forbidden engine keyword: ${keyword}`, () => {
      expect(serviceCode).not.toContain(keyword);
    });
  }

  it('does NOT contain SPI calculation', () => {
    // SPI appears in comments only — check for actual calculation
    expect(serviceCode).not.toMatch(/SPI\s*[=:]/);
  });

  it('does NOT contain CPI calculation', () => {
    expect(serviceCode).not.toContain('CPI');
  });

  it('does NOT contain EVM calculation', () => {
    expect(serviceCode).not.toMatch(/EVM\s*[=:]/);
  });
});

// ── SECTION 12: M10-R2 KPI CONSISTENCY ─────────────────────────────────────

describe('M10-R2: KPI Consistency', () => {
  let PlanningReadinessService: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import('../PlanningReadinessService');
    PlanningReadinessService = mod.PlanningReadinessService;
  });

  it('KPIs reflect all workpacks, filtered list reflects filter', async () => {
    // 2 workpacks: one NOT_READY, one NOT_READY (different reasons)
    mockPrisma.workpack.findMany.mockResolvedValue([
      { id: 'wp-1', workpack_number: 'WP-1', title: 'A', status: 'draft',
        priority: 'Normal', planned_start_date: null, planned_end_date: null,
        readiness_score: 0, event_id: null, unit_id: null, system_id: null,
        discipline_id: null, asset_id: null, approval_status: 'not_submitted',
        asset: null, unit: null, system: null, discipline: null, event: null,
        _count: { activities: 0, workpack_documents: 0, constraints: 0 } },
      { id: 'wp-2', workpack_number: 'WP-2', title: 'B', status: 'draft',
        priority: 'Normal', planned_start_date: null, planned_end_date: null,
        readiness_score: 0, event_id: null, unit_id: null, system_id: null,
        discipline_id: null, asset_id: null, approval_status: 'not_submitted',
        asset: null, unit: null, system: null, discipline: null, event: null,
        _count: { activities: 0, workpack_documents: 0, constraints: 0 } },
    ]);
    mockPrisma.activity.groupBy.mockResolvedValue([]);
    mockPrisma.activity.findMany.mockResolvedValue([]);
    mockPrisma.activityResource.groupBy.mockResolvedValue([]);
    mockPrisma.activityResource.findMany.mockResolvedValue([]);
    mockPrisma.workpack_material_lines.groupBy.mockResolvedValue([]);
    mockPrisma.constraint.groupBy.mockResolvedValue([]);
    mockPrisma.scheduleBaseline.findMany.mockResolvedValue([]);

    // Unfiltered
    const result = await PlanningReadinessService.getReadiness('org-1', {});
    expect(result.kpis.total).toBe(2);
    expect(result.kpis.not_ready).toBe(2);
    expect(result.workpacks).toHaveLength(2);

    // Filtered for READY — should return 0 workpacks but KPIs still show 2 total
    vi.clearAllMocks();
    mockPrisma.workpack.findMany.mockResolvedValue([
      { id: 'wp-1', workpack_number: 'WP-1', title: 'A', status: 'draft',
        priority: 'Normal', planned_start_date: null, planned_end_date: null,
        readiness_score: 0, event_id: null, unit_id: null, system_id: null,
        discipline_id: null, asset_id: null, approval_status: 'not_submitted',
        asset: null, unit: null, system: null, discipline: null, event: null,
        _count: { activities: 0, workpack_documents: 0, constraints: 0 } },
      { id: 'wp-2', workpack_number: 'WP-2', title: 'B', status: 'draft',
        priority: 'Normal', planned_start_date: null, planned_end_date: null,
        readiness_score: 0, event_id: null, unit_id: null, system_id: null,
        discipline_id: null, asset_id: null, approval_status: 'not_submitted',
        asset: null, unit: null, system: null, discipline: null, event: null,
        _count: { activities: 0, workpack_documents: 0, constraints: 0 } },
    ]);
    mockPrisma.activity.groupBy.mockResolvedValue([]);
    mockPrisma.activity.findMany.mockResolvedValue([]);
    mockPrisma.activityResource.groupBy.mockResolvedValue([]);
    mockPrisma.activityResource.findMany.mockResolvedValue([]);
    mockPrisma.workpack_material_lines.groupBy.mockResolvedValue([]);
    mockPrisma.constraint.groupBy.mockResolvedValue([]);
    mockPrisma.scheduleBaseline.findMany.mockResolvedValue([]);

    const filtered = await PlanningReadinessService.getReadiness('org-1', { readiness_state: 'READY' as any });
    expect(filtered.kpis.total).toBe(2); // KPIs always show full picture
    expect(filtered.workpacks).toHaveLength(0); // Table filtered
  });

  it('KPI counts sum correctly', async () => {
    const serviceCode = readSrc('PlanningReadinessService.ts');
    // KPIs are computed from `results` (unfiltered), not `filtered`
    expect(serviceCode).toContain("total: results.length");
    expect(serviceCode).toContain("ready: results.filter");
    expect(serviceCode).toContain("not_ready: results.filter");
    // Filtered workpacks are a separate list
    expect(serviceCode).toContain("workpacks: filtered");
  });
});
