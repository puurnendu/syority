import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ControlTowerQueryService } from '../ControlTowerQueryService';
import { prisma } from '@/lib/prisma';
import { ProgressAggregationService } from '@/core/progress/ProgressAggregationService';
import { loadEvmActivities } from '@/core/evm/EvmSnapshotService';
import { ExecutionReadinessService } from '@/core/execution/ExecutionReadinessService';

// Mock Dependencies
vi.mock('@/lib/prisma', () => ({
  prisma: {
    activity: {
      findMany: vi.fn(),
    },
    scheduleBaseline: {
      findFirst: vi.fn(),
    },
    constraintLog: {
      findMany: vi.fn(),
    }
  },
}));

vi.mock('@/core/progress/ProgressAggregationService', () => ({
  ProgressAggregationService: {
    getDashboardSummary: vi.fn(),
    getEventProgress: vi.fn(),
  },
}));

vi.mock('@/core/evm/EvmSnapshotService', () => ({
  loadEvmActivities: vi.fn(),
}));

vi.mock('@/core/execution/ExecutionReadinessService', () => ({
  ExecutionReadinessService: {
    evaluateBulkReadiness: vi.fn(),
  }
}));

describe('ControlTowerQueryService Forensic Hardening', () => {
  const orgId = 'org-1';
  const eventId = 'evt-1';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('must strictly enforce tenant isolation (organizationId)', async () => {
    // 1. Progress Mock
    (ProgressAggregationService.getDashboardSummary as any).mockResolvedValue({
      overallProgress: 0, totalActivities: 0, completedActivities: 0, inProgressActivities: 0,
      notStartedActivities: 0, totalDurationHours: 0, completedEquivalentHours: 0, balanceDurationHours: 0
    });
    (ProgressAggregationService.getEventProgress as any).mockResolvedValue({ identicalActivities: [] });

    // 2. Baseline Mock
    (prisma.scheduleBaseline.findFirst as any).mockResolvedValue({ id: 'baseline-1' });
    (loadEvmActivities as any).mockResolvedValue([]);

    // 3. Activity Mock
    (prisma.activity.findMany as any).mockResolvedValue([
      { id: 'act-1', status: 'not_started' }
    ]);

    // 4. Constraints Mock
    (prisma.constraintLog.findMany as any).mockResolvedValue([]);

    // 5. Readiness Mock
    (ExecutionReadinessService.evaluateBulkReadiness as any).mockResolvedValue({
      'act-1': { is_ready: true, blockers: [] },
    });

    const result = await ControlTowerQueryService.getSummary(orgId, eventId);

    // Assertions for strictly passing organizationId to every layer
    expect(ProgressAggregationService.getDashboardSummary).toHaveBeenCalledWith(orgId, eventId);
    expect(ProgressAggregationService.getEventProgress).toHaveBeenCalledWith(
      'org-1',
      'evt-1',
      { includeIdenticalActivities: true, includeContractor: true, includeDiscipline: true }
    );
    
    expect(prisma.scheduleBaseline.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ organization_id: orgId, event_id: eventId })
      })
    );

    expect(loadEvmActivities).toHaveBeenCalledWith(eventId, orgId, 'baseline-1');

    expect(prisma.activity.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ organization_id: orgId, event_id: eventId })
      })
    );

    expect(prisma.constraintLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organization_id: orgId,
          workpack: expect.objectContaining({
            event_id: eventId,
            organization_id: orgId,
          }),
        })
      })
    );

    expect(ExecutionReadinessService.evaluateBulkReadiness).toHaveBeenCalledWith(orgId, ['act-1']);
    expect(result.readinessCoverage.complete).toBe(true);
  });

  it('must identify READINESS_BLOCKED exceptions without recalculating readiness locally', async () => {
    (ProgressAggregationService.getDashboardSummary as any).mockResolvedValue({});
    (ProgressAggregationService.getEventProgress as any).mockResolvedValue({});
    (prisma.scheduleBaseline.findFirst as any).mockResolvedValue(null);
    (prisma.constraintLog.findMany as any).mockResolvedValue([]);
    
    const now = Date.now();
    (prisma.activity.findMany as any).mockResolvedValue([
      {
        id: 'act-1',
        activity_id: 'ACT-001',
        status: 'not_started',
        progress_percent: 0,
        total_float: 10,
        is_critical: false,
        planned_end: new Date(now + 1000000), // not late
      }
    ]);

    // Mock ExecutionReadinessService returning not ready
    (ExecutionReadinessService.evaluateBulkReadiness as any).mockResolvedValue({
      'act-1': { is_ready: false, blockers: ['Missing Permit'] }
    });

    const result = await ControlTowerQueryService.getSummary(orgId, eventId);

    expect(result.exceptions).toHaveLength(1);
    expect(result.exceptions[0].reason).toBe('READINESS_BLOCKED');
    expect(result.exceptions[0].severity).toBe('P2');
    expect(result.readinessCoverage.complete).toBe(true);
  });

  it('does not skip M12 readiness at 5000 not-started activities', async () => {
    (ProgressAggregationService.getDashboardSummary as any).mockResolvedValue({});
    (ProgressAggregationService.getEventProgress as any).mockResolvedValue({});
    (prisma.scheduleBaseline.findFirst as any).mockResolvedValue(null);
    (prisma.constraintLog.findMany as any).mockResolvedValue([]);

    const ids = Array.from({ length: 5000 }, (_, i) => ({
      id: `act-${i}`,
      status: 'not_started',
      progress_percent: 0,
      total_float: 10,
      is_critical: false,
      planned_end: new Date(Date.now() + 1_000_000),
    }));
    (prisma.activity.findMany as any).mockResolvedValue(ids);

    const map: Record<string, { is_ready: boolean; blockers: string[] }> = {};
    for (const a of ids) map[a.id] = { is_ready: true, blockers: [] };
    (ExecutionReadinessService.evaluateBulkReadiness as any).mockResolvedValue(map);

    const result = await ControlTowerQueryService.getSummary(orgId, eventId);

    expect(ExecutionReadinessService.evaluateBulkReadiness).toHaveBeenCalledTimes(1);
    expect((ExecutionReadinessService.evaluateBulkReadiness as any).mock.calls[0][1]).toHaveLength(5000);
    expect(result.readinessCoverage).toEqual({
      notStartedCount: 5000,
      evaluatedCount: 5000,
      complete: true,
    });
  });
});
