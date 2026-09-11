/**
 * M14-R2: Final Authority Forensic Audit & Closure Unit Tests
 *
 * Verifies that the report engine provider layer adheres strictly to the
 * non-negotiable authority boundaries:
 *   - EVM / CPI / SPI / BAC / EAC / S-Curve → M8.10
 *   - Physical Progress Aggregation → M8.13
 *   - Lookahead / Delays / Execution Board → M12
 *   - Planning Readiness → M10 / M12
 *   - Management Exceptions → M13
 *   - Data Fetcher Registry strictly delegates to Provider Registry
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { providerRegistry } from '../ProviderRegistry';
import { dataFetcherRegistry } from '@/core/report-builder/data-fetchers';
import { ProgressAggregationService } from '@/core/progress/ProgressAggregationService';
import { FieldExecutionService } from '@/core/execution/FieldExecutionService';
import { PlanningReadinessService } from '@/core/planning/PlanningReadinessService';
import { RollupEngine } from '@/core/planner-workspace/RollupEngine';
import * as EvmCalculationService from '@/core/evm/EvmCalculationService';
import * as EvmSnapshotService from '@/core/evm/EvmSnapshotService';

// Ensure all providers are registered
import '../index';

describe('M14-R2 Authority Forensic Audit', () => {
  const orgId = '11111111-1111-1111-1111-111111111111';
  const eventId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('Domain 1: EVM Authority (M8.10)', () => {
    it('management.executive_dashboard consumes M8.10 calculateEventEvm', async () => {
      const mockBaseline = { id: 'baseline-1' };
      const mockActivities = [{ activityId: 'act-1' }];
      const mockSummary = {
        eventId,
        baselineId: 'baseline-1',
        dataDate: '2026-09-07',
        bac: 50000,
        pv: 40000,
        ev: 35000,
        ac: 38000,
        cv: -3000,
        sv: -5000,
        cpi: 0.92,
        spi: 0.88,
        eac: 54347.83,
        etc: 16347.83,
        vac: -4347.83,
        tcpi: 1.25,
      };

      vi.spyOn(EvmSnapshotService, 'getCurrentBaseline').mockResolvedValue(mockBaseline as any);
      vi.spyOn(EvmSnapshotService, 'loadEvmActivities').mockResolvedValue(mockActivities as any);
      const calcSpy = vi.spyOn(EvmCalculationService, 'calculateEventEvm').mockReturnValue(mockSummary as any);

      const result = await providerRegistry.fetch('management.executive_dashboard', { organizationId: orgId }, { event: eventId });

      expect(calcSpy).toHaveBeenCalled();
      const spiKpi = result.kpis?.find(k => k.label === 'SPI');
      const cpiKpi = result.kpis?.find(k => k.label === 'CPI');
      const bacKpi = result.kpis?.find(k => k.label === 'BAC');

      expect(spiKpi?.value).toBe(0.88);
      expect(cpiKpi?.value).toBe(0.92);
      expect(bacKpi?.value).toBe(50000);
    });

    it('planning.earned_value consumes M8.10 rather than RollupEngine', async () => {
      const mockBaseline = { id: 'baseline-1' };
      const mockActivities = [{ activityId: 'act-1' }];
      const mockSummary = {
        eventId,
        baselineId: 'baseline-1',
        dataDate: '2026-09-07',
        bac: 100000,
        pv: 80000,
        ev: 75000,
        ac: 70000,
        cv: 5000,
        sv: -5000,
        cpi: 1.07,
        spi: 0.94,
        eac: 93457.94,
      };

      vi.spyOn(EvmSnapshotService, 'getCurrentBaseline').mockResolvedValue(mockBaseline as any);
      vi.spyOn(EvmSnapshotService, 'loadEvmActivities').mockResolvedValue(mockActivities as any);
      const calcSpy = vi.spyOn(EvmCalculationService, 'calculateEventEvm').mockReturnValue(mockSummary as any);

      const result = await providerRegistry.fetch('planning.earned_value', { organizationId: orgId }, { event: eventId });

      expect(calcSpy).toHaveBeenCalled();
      expect(result.kpis?.find(k => k.label === 'BAC')?.value).toBe(100000);
      expect(result.kpis?.find(k => k.label === 'EV')?.value).toBe(75000);
      expect(result.kpis?.find(k => k.label === 'SPI')?.value).toBe(0.94);
    });

    it('management.scurve delegates to M8.10 generateEventCurve', async () => {
      const mockCurve = {
        dates: ['2026-09-01', '2026-09-02'],
        pv: [1000, 2000],
        ev: [800, 1900],
        ac: [900, 2100],
        eacProjection: [null, 2500],
      };

      const curveSpy = vi.spyOn(EvmSnapshotService, 'generateEventCurve').mockResolvedValue(mockCurve as any);

      const result = await providerRegistry.fetch('management.scurve', { organizationId: orgId }, { event: eventId });

      expect(curveSpy).toHaveBeenCalledWith(eventId, orgId, undefined, undefined);
      expect(result.chartData).toEqual(mockCurve);
      expect(result.rows).toHaveLength(2);
    });
  });

  describe('Domain 2: Progress Aggregation Authority (M8.13)', () => {
    it('shutdown.unit_progress consumes ProgressAggregationService.getEventProgress', async () => {
      const mockProgressPayload = {
        eventId,
        organizationId: orgId,
        calculatedAt: new Date().toISOString(),
        overall: { totalActivities: 20, completedActivities: 10, weightedProgress: 50 } as any,
        byUnit: [
          {
            key: 'unit-1',
            label: 'Crude Unit',
            metrics: { totalActivities: 15, completedActivities: 10, inProgressActivities: 5, weightedProgress: 67 } as any,
          },
        ],
      };

      const progressSpy = vi.spyOn(ProgressAggregationService, 'getEventProgress').mockResolvedValue(mockProgressPayload as any);

      const result = await providerRegistry.fetch('shutdown.unit_progress', { organizationId: orgId }, { event: eventId });

      expect(progressSpy).toHaveBeenCalledWith(orgId, eventId, { includeUnit: true });
      expect(result.rows?.[0]?.unit).toBe('Crude Unit');
      expect(result.rows?.[0]?.actual).toBe('67%');
    });

    it('shutdown.contractor_progress consumes ProgressAggregationService.getEventProgress', async () => {
      const mockProgressPayload = {
        eventId,
        organizationId: orgId,
        calculatedAt: new Date().toISOString(),
        overall: {} as any,
        byContractor: [
          {
            key: 'c-1',
            label: 'Apex Industrial',
            metrics: { totalActivities: 30, completedActivities: 15, weightedProgress: 55 } as any,
          },
        ],
      };

      const progressSpy = vi.spyOn(ProgressAggregationService, 'getEventProgress').mockResolvedValue(mockProgressPayload as any);

      const result = await providerRegistry.fetch('shutdown.contractor_progress', { organizationId: orgId }, { event: eventId });

      expect(progressSpy).toHaveBeenCalledWith(orgId, eventId, { includeContractor: true });
      expect(result.rows?.[0]?.contractor).toBe('Apex Industrial');
      expect(result.rows?.[0]?.avg_progress).toBe('55%');
    });

    it('shutdown.discipline_progress consumes ProgressAggregationService.getEventProgress', async () => {
      const mockProgressPayload = {
        eventId,
        organizationId: orgId,
        calculatedAt: new Date().toISOString(),
        overall: {} as any,
        byDiscipline: [
          {
            key: 'd-1',
            label: 'Piping',
            metrics: { totalActivities: 50, completedActivities: 25, weightedProgress: 48 } as any,
          },
        ],
      };

      const progressSpy = vi.spyOn(ProgressAggregationService, 'getEventProgress').mockResolvedValue(mockProgressPayload as any);

      const result = await providerRegistry.fetch('shutdown.discipline_progress', { organizationId: orgId }, { event: eventId });

      expect(progressSpy).toHaveBeenCalledWith(orgId, eventId, { includeDiscipline: true });
      expect(result.rows?.[0]?.discipline).toBe('Piping');
      expect(result.rows?.[0]?.avg_progress).toBe('48%');
    });

    it('planning.schedule_performance consumes ProgressAggregationService.getEventProgress', async () => {
      const progressSpy = vi.spyOn(ProgressAggregationService, 'getEventProgress').mockResolvedValue({
        eventId,
        organizationId: orgId,
        calculatedAt: new Date().toISOString(),
        overall: { totalActivities: 100, completedActivities: 75, weightedProgress: 75 } as any,
      });

      vi.spyOn(RollupEngine, 'computeEventRollups').mockResolvedValue({
        event: { activityCount: 100, workpackCount: 15 },
      } as any);

      const result = await providerRegistry.fetch('planning.schedule_performance', { organizationId: orgId }, { event: eventId });

      expect(progressSpy).toHaveBeenCalledWith(orgId, eventId);
      expect(result.kpis?.find((k) => k.label === 'Activities')?.value).toBe(100);
      expect(result.kpis?.find((k) => k.label === 'Completed')?.value).toBe(75);
      expect(result.kpis?.find((k) => k.label === 'Completion %')?.value).toBe('75%');
    });

    it('management.kpi_dashboard consumes ProgressAggregationService.getEventProgress for event scope', async () => {
      const progressSpy = vi.spyOn(ProgressAggregationService, 'getEventProgress').mockResolvedValue({
        eventId,
        organizationId: orgId,
        calculatedAt: new Date().toISOString(),
        overall: { totalActivities: 88, completedActivities: 44, weightedProgress: 50 } as any,
      });

      const result = await providerRegistry.fetch('management.kpi_dashboard', { organizationId: orgId }, { event: eventId });

      expect(progressSpy).toHaveBeenCalledWith(orgId, eventId);
      expect(result.kpis?.find((k) => k.label === 'Event Progress')?.value).toBe('50%');
      expect(result.kpis?.find((k) => k.label === 'Total Activities')?.value).toBe(88);
    });
  });

  describe('Domain 3: Execution Facts & Lookahead Authority (M12)', () => {
    it('planning.lookahead_24h consumes FieldExecutionService.getLookahead', async () => {
      const mockLookahead = [
        {
          id: 'act-1',
          activity_number: 'A-1001',
          description: 'Blind Flange Installation',
          workpack_number: 'WP-01',
          planned_start: '2026-09-07 08:00',
          planned_end: '2026-09-07 16:00',
          status: 'not_started',
          is_critical: true,
          responsible: 'John Doe',
          is_ready_to_start: true,
          blocking_reasons: [],
        },
      ];

      const lookaheadSpy = vi.spyOn(FieldExecutionService, 'getLookahead').mockResolvedValue(mockLookahead as any);

      const result = await providerRegistry.fetch('planning.lookahead_24h', { organizationId: orgId }, { event: eventId });

      expect(lookaheadSpy).toHaveBeenCalledWith(orgId, eventId, 24, { discipline_id: undefined });
      expect(result.rows?.[0]?.activity).toBe('A-1001');
      expect(result.rows?.[0]?.ready).toBe('Ready');
      expect(result.kpis?.find(k => k.label === 'Critical')?.value).toBe(1);
    });

    it('planning.lookahead_72h consumes FieldExecutionService.getLookahead with 72h window', async () => {
      const lookaheadSpy = vi.spyOn(FieldExecutionService, 'getLookahead').mockResolvedValue([]);

      await providerRegistry.fetch('planning.lookahead_72h', { organizationId: orgId }, { event: eventId });

      expect(lookaheadSpy).toHaveBeenCalledWith(orgId, eventId, 72, { discipline_id: undefined });
    });

    it('execution.delay_register consumes FieldExecutionService.getPlanVsActual', async () => {
      const mockPva = [
        {
          id: 'act-delayed',
          activity_number: 'ACT-99',
          description: 'Gasket replacement',
          workpack_number: 'WP-09',
          planned_end: '2026-09-05',
          status: 'in_progress',
          is_delayed: true,
          finish_variance_hours: 48,
          is_critical: true,
        },
      ];

      const pvaSpy = vi.spyOn(FieldExecutionService, 'getPlanVsActual').mockResolvedValue(mockPva as any);

      const result = await providerRegistry.fetch('execution.delay_register', { organizationId: orgId }, { event: eventId });

      expect(pvaSpy).toHaveBeenCalledWith(orgId, eventId);
      expect(result.rows?.[0]?.activity).toBe('ACT-99');
      expect(result.rows?.[0]?.days_late).toBe(2);
      expect(result.kpis?.find(k => k.label === 'Delayed Activities')?.value).toBe(1);
    });

    it('planning.late_activities consumes FieldExecutionService.getPlanVsActual and filters delayed items', async () => {
      const mockPva = [
        {
          id: 'act-late-1',
          activity_number: 'A-2001',
          description: 'Valve Overhaul',
          workpack_number: 'WP-12',
          planned_end: '2026-09-04',
          status: 'in_progress',
          is_delayed: true,
          finish_variance_hours: 72,
          is_critical: false,
        },
        {
          id: 'act-on-time',
          activity_number: 'A-2002',
          description: 'Line Flushing',
          workpack_number: 'WP-12',
          planned_end: '2026-09-10',
          status: 'in_progress',
          is_delayed: false,
          finish_variance_hours: null,
          is_critical: false,
        },
      ];

      const pvaSpy = vi.spyOn(FieldExecutionService, 'getPlanVsActual').mockResolvedValue(mockPva as any);

      const result = await providerRegistry.fetch('planning.late_activities', { organizationId: orgId }, { event: eventId });

      expect(pvaSpy).toHaveBeenCalledWith(orgId, eventId);
      expect(result.rows).toHaveLength(1);
      expect(result.rows?.[0]?.activity_number).toBe('A-2001');
      expect(result.rows?.[0]?.days_late).toBe(3);
      expect(result.kpis?.find((k) => k.label === 'Late Activities')?.value).toBe(1);
    });
  });

  describe('Domain 4: Planning Readiness Authority (M10/M12)', () => {
    it('planning.workpack_readiness consumes PlanningReadinessService.getReadiness', async () => {
      const mockReadinessResult = {
        kpis: {
          total: 10,
          ready: 7,
          not_ready: 3,
          scheduled: 5,
          baselined: 4,
          critical_blockers: 1,
        },
        workpacks: [
          {
            workpack_number: 'WP-101',
            title: 'Pump Overhaul',
            status: 'draft',
            planning_state: 'READY' as const,
            readiness_score: 95,
            priority: 'High',
            discipline_name: 'Mechanical',
            unit_name: 'FCCU',
            open_constraints: 0,
            critical_constraints: 0,
          },
        ],
      };

      const readinessSpy = vi.spyOn(PlanningReadinessService, 'getReadiness').mockResolvedValue(mockReadinessResult as any);

      const result = await providerRegistry.fetch('planning.workpack_readiness', { organizationId: orgId }, { event: eventId });

      expect(readinessSpy).toHaveBeenCalledWith(orgId, {
        event_id: eventId,
        unit_id: undefined,
        discipline_id: undefined,
      });

      expect(result.rows?.[0]?.workpack).toBe('WP-101');
      expect(result.rows?.[0]?.readiness).toBe('95%');
      expect(result.kpis?.find(k => k.label === 'Ready')?.value).toBe(7);
      expect(result.kpis?.find(k => k.label === 'Critical Blockers')?.value).toBe(1);
    });

    it('planning.ready_workpacks and planning.waiting_workpacks consume PlanningReadinessService.getReadiness', async () => {
      const mockReadinessResult = {
        workpacks: [
          { workpack_number: 'WP-101', title: 'Turbine Check', status: 'ready', readiness_score: 100, planning_state: 'READY' },
          { workpack_number: 'WP-102', title: 'Piping Mod', status: 'draft', readiness_score: 60, planning_state: 'NOT_READY' },
        ],
      };

      const readinessSpy = vi.spyOn(PlanningReadinessService, 'getReadiness').mockResolvedValue(mockReadinessResult as any);

      const readyRes = await providerRegistry.fetch('planning.ready_workpacks', { organizationId: orgId }, { event: eventId });
      const waitingRes = await providerRegistry.fetch('planning.waiting_workpacks', { organizationId: orgId }, { event: eventId });

      expect(readinessSpy).toHaveBeenCalledWith(orgId, { event_id: eventId });
      expect(readyRes.rows).toHaveLength(1);
      expect(readyRes.rows?.[0]?.workpack_number).toBe('WP-101');
      expect(waitingRes.rows).toHaveLength(1);
      expect(waitingRes.rows?.[0]?.workpack_number).toBe('WP-102');
    });
  });

  describe('Domain 5: Data Fetcher Registry Architecture', () => {
    it('dataFetcherRegistry dynamically proxies queries to ProviderRegistry', async () => {
      const fetchSpy = vi.spyOn(providerRegistry, 'fetch').mockResolvedValue({ rows: [{ mock: true }] });

      const fetcher = dataFetcherRegistry['management.executive_dashboard'];
      expect(fetcher).toBeDefined();

      const result = await fetcher(orgId, { event: eventId });
      expect(fetchSpy).toHaveBeenCalledWith('management.executive_dashboard', { organizationId: orgId }, { event: eventId });
      expect(result.rows?.[0]?.mock).toBe(true);
    });

    it('dataFetcherRegistry supports all categories including M7.6D intelligence providers', () => {
      expect('planning.critical_activities' in dataFetcherRegistry).toBe(true);
      expect('safety.permit_status' in dataFetcherRegistry).toBe(true);
      expect('workforce.today_attendance' in dataFetcherRegistry).toBe(true);
      expect('udf.hierarchical_rollup' in dataFetcherRegistry).toBe(true);
    });

    it('returns undefined for unregistered data source keys', () => {
      expect(dataFetcherRegistry['nonexistent.source']).toBeUndefined();
    });
  });
});
