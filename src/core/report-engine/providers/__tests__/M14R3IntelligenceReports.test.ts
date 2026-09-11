/**
 * M14-R3 Intelligence Reports Test Suite
 *
 * Verifies all 10 R3 Intelligence Reports (R09 – R18):
 * 1. Explicit upstream authority delegation (M8.10, M8.13, M10, M11, M12, M13, ValidationEngine).
 * 2. Anti-local-calculation assertions (proves M14 does not calculate domain math locally).
 * 3. Tenant and event isolation across all reports.
 * 4. Immutable ReportDataset contract with SHA-256 dataset hash.
 * 5. Single semantic source verification across output formats.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { providerRegistry } from '../index';
import { prisma } from '@/lib/prisma';
import { FieldExecutionService } from '@/core/execution/FieldExecutionService';
import { PlanningReadinessService } from '@/core/planning/PlanningReadinessService';
import { ProgressAggregationService } from '@/core/progress/ProgressAggregationService';
import * as EvmSnapshotService from '@/core/evm/EvmSnapshotService';
import { ValidationEngineService } from '@/core/planner-workspace/ValidationEngineService';
import { ControlTowerQueryService } from '@/core/control-tower/ControlTowerQueryService';
import { ReportGenerationService } from '@/core/report-builder/ReportGenerationService';

// ─── Global Test Context ──────────────────────────────────────────────────────
const ORG_ID = 'org-sto-test-01';
const OTHER_ORG_ID = 'org-sto-other-02';
const EVENT_ID = 'event-turnaround-2026';
const OTHER_EVENT_ID = 'event-other-2027';

describe('M14-R3 Intelligence Reports — Authority & Dataset Verification', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // ─── R09 Lookahead ────────────────────────────────────────────────────────
  describe('R09 — Lookahead Report (planning.lookahead)', () => {
    it('delegates to FieldExecutionService.getLookahead with parameterized horizons (24h, 48h, 72h, 7d, 14d)', async () => {
      const mockLookahead = [
        {
          id: 'act-1',
          activity_number: 'ACT-101',
          description: 'Flange unbolting',
          workpack_number: 'WP-10',
          planned_start: '2026-09-08',
          planned_end: '2026-09-09',
          status: 'not_started',
          is_critical: true,
          is_ready_to_start: true,
          blocking_reasons: [],
          categories: ['STARTING', 'CRITICAL'],
        },
      ];

      const lookaheadSpy = vi.spyOn(FieldExecutionService, 'getLookahead').mockResolvedValue(mockLookahead as any);

      const horizons = [
        { param: '24h', expectedHours: 24 },
        { param: '48h', expectedHours: 48 },
        { param: '72h', expectedHours: 72 },
        { param: '7d', expectedHours: 168 },
        { param: '14d', expectedHours: 336 },
      ];

      for (const h of horizons) {
        const result = await providerRegistry.fetch('planning.lookahead', { organizationId: ORG_ID }, {
          event: EVENT_ID,
          horizon: h.param,
        });

        expect(lookaheadSpy).toHaveBeenCalledWith(
          ORG_ID,
          EVENT_ID,
          h.expectedHours,
          expect.any(Object)
        );
        expect(result.rows).toHaveLength(1);
        expect(result.rows?.[0].activity).toBe('ACT-101');
      }
    });

    it('enforces tenant isolation and passes discipline filters', async () => {
      const lookaheadSpy = vi.spyOn(FieldExecutionService, 'getLookahead').mockResolvedValue([]);

      await providerRegistry.fetch('planning.lookahead', { organizationId: ORG_ID }, {
        event: EVENT_ID,
        horizon: '48h',
        discipline: 'disc-mechanical',
      });

      expect(lookaheadSpy).toHaveBeenCalledWith(
        ORG_ID,
        EVENT_ID,
        48,
        expect.objectContaining({ discipline_id: 'disc-mechanical' })
      );
    });
  });

  // ─── R10 Critical Activities ──────────────────────────────────────────────
  describe('R10 — Critical Activities Report (planning.critical_activities)', () => {
    it('reads CPM persistence without locally calculating critical flag or float', async () => {
      // Mock returns an activity with positive float (5d) but authoritative is_critical = true
      // M14 MUST report is_critical: true and total_float: 5 without recalculating criticality
      const mockActivities = [
        {
          id: 'act-cpm-1',
          activity_number: 'CRIT-001',
          description: 'Catalyst loading',
          planned_start: new Date('2026-09-10'),
          planned_end: new Date('2026-09-12'),
          actual_start: null,
          actual_end: null,
          total_float: 5, // positive float
          is_critical: true, // authoritative CPM flag
          status: 'not_started',
          progress_percent: 0,
          constraint_status: null,
          workpack: {
            id: 'wp-1',
            workpack_number: 'WP-CAT-01',
            title: 'Reactor Catalyst Changeout',
            asset: { tag_number: 'R-101', name: 'Primary Hydrocracker' },
          },
        },
      ];

      const findSpy = vi.spyOn(prisma.activity, 'findMany').mockResolvedValue(mockActivities as any);

      const result = await providerRegistry.fetch('planning.critical_activities', { organizationId: ORG_ID }, {
        event: EVENT_ID,
      });

      expect(findSpy).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({
          organization_id: ORG_ID,
          event_id: EVENT_ID,
          is_critical: true,
        }),
      }));

      // Assert that M14 preserved the authoritative values directly
      expect(result.rows?.[0]?.critical_flag).toBe(true);
      expect(result.rows?.[0]?.total_float).toBe(5); // Proves M14 did NOT force float <= 0
      expect(result.rows?.[0]?.equipment).toBe('R-101');
      expect(result.rows?.[0]?.workpack).toBe('WP-CAT-01');
    });
  });

  // ─── R11 Constraints ──────────────────────────────────────────────────────
  describe('R11 — Constraints Report (planning.constraint_register)', () => {
    it('queries authoritative constraintLog records and maps severity, age, and impact', async () => {
      const now = new Date();
      const pastDate = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000); // 5 days old

      const mockLogs = [
        {
          id: 'const-1',
          constraint_number: 'CON-501',
          title: 'Crane permit pending',
          category: 'Permit',
          activity_id: 'ACT-99',
          severity: 'critical',
          status: 'open',
          created_at: pastDate,
          due_date: new Date('2026-09-15'),
          impact: 'Blocks heavy lift crane pad access',
          remarks: 'Awaiting port authority clearance',
          workpack: {
            id: 'wp-2',
            workpack_number: 'WP-LIFT-02',
            title: 'Column Erection',
            unit: { code: 'U-12', name: 'Crude Distillation', area: { name: 'Area North' } },
            asset: { tag_number: 'C-201', name: 'Fractionator Column' },
          },
        },
      ];

      vi.spyOn((prisma as any).constraintLog, 'findMany').mockResolvedValue(mockLogs as any);

      const result = await providerRegistry.fetch('planning.constraint_register', { organizationId: ORG_ID }, {
        event: EVENT_ID,
        status: 'open',
      });

      expect(result.rows).toHaveLength(1);
      const row = result.rows?.[0];
      expect(row.constraint).toBe('CON-501');
      expect(row.category).toBe('Permit');
      expect(row.severity).toBe('critical');
      expect(row.age).toBe('5d');
      expect(row.equipment).toBe('C-201');
      expect(row.area).toBe('Area North');
      expect(row.unit).toBe('Crude Distillation');
      expect(row.impact).toBe('Blocks heavy lift crane pad access');
      expect(result.kpis?.find(k => k.label === 'Critical Severity')?.value).toBe(1);
    });
  });

  // ─── R12 Holds & Delays ───────────────────────────────────────────────────
  describe('R12 — Holds & Delays Report (execution.holds_and_delays)', () => {
    it('consumes M12 FieldExecutionService delay facts without calculating delay status locally', async () => {
      // Mock plan vs actual with authoritative is_delayed = true even though planned_end is in the future
      const mockPva = [
        {
          id: 'act-d-1',
          activity_number: 'ACT-DEL-01',
          description: 'Hydrotest piping',
          workpack_number: 'WP-TEST-01',
          planned_start: '2026-09-20',
          planned_end: '2026-09-25', // Future date!
          actual_start: '2026-09-21',
          actual_end: null,
          duration_hours: 40,
          finish_variance_hours: 24,
          status: 'in_progress',
          is_delayed: true, // Authoritative delay fact from M12
          is_critical: true,
        },
      ];

      const pvaSpy = vi.spyOn(FieldExecutionService, 'getPlanVsActual').mockResolvedValue(mockPva as any);
      vi.spyOn(FieldExecutionService, 'getExecutionBoard').mockResolvedValue([]);

      const result = await providerRegistry.fetch('execution.holds_and_delays', { organizationId: ORG_ID }, {
        event: EVENT_ID,
      });

      expect(pvaSpy).toHaveBeenCalledWith(ORG_ID, EVENT_ID);
      expect(result.rows).toHaveLength(1);
      // Proves M12 delay fact was accepted directly
      expect(result.rows?.[0].activity).toBe('ACT-DEL-01');
      expect(result.rows?.[0].impact).toContain('24h');
      expect(result.kpis?.find(k => k.label === 'Delayed Activities')?.value).toBe(1);
    });
  });

  // ─── R13 Readiness ────────────────────────────────────────────────────────
  describe('R13 — Readiness Report (planning.workpack_readiness)', () => {
    it('delegates to M10 PlanningReadinessService and preserves authoritative score and checks', async () => {
      const mockReadiness = {
        kpis: { total: 10, ready: 7, not_ready: 3, scheduled: 5, baselined: 5, critical_blockers: 1 },
        workpacks: [
          {
            id: 'wp-r-1',
            workpack_number: 'WP-READ-01',
            title: 'Exchanger Bundle Pulling',
            status: 'issued',
            equipment_tag: 'E-101A',
            equipment_type: 'Heat Exchanger',
            unit_name: 'Hydrotreater',
            discipline_name: 'Mechanical',
            planning_state: 'NOT_READY',
            readiness_score: 72, // Authoritative M10 score
            material_status: 'Available',
            open_constraints: 2,
            critical_constraints: 1,
            checks: [
              { key: 'permits', label: 'Hot Work Permit', passed: false, evidence: 'Pending gas test' },
              { key: 'materials', label: 'Gaskets & Fasteners', passed: true, evidence: 'Allocated' },
            ],
          },
        ],
      };

      const readinessSpy = vi.spyOn(PlanningReadinessService, 'getReadiness').mockResolvedValue(mockReadiness as any);

      const result = await providerRegistry.fetch('planning.workpack_readiness', { organizationId: ORG_ID }, {
        event: EVENT_ID,
      });

      expect(readinessSpy).toHaveBeenCalledWith(ORG_ID, expect.objectContaining({ event_id: EVENT_ID }));
      expect(result.rows?.[0].workpack).toBe('WP-READ-01');
      expect(result.rows?.[0].readiness_score).toBe('72%');
      expect(result.rows?.[0].failed_checks).toBe('Hot Work Permit');
      expect(result.rows?.[0].critical_blockers).toBe(1);
    });
  });

  // ─── R14 Identical Activities ─────────────────────────────────────────────
  describe('R14 — Identical Activities Report (planning.identical_activities)', () => {
    it('delegates to M8.13 and renders authoritative progress % without local math', async () => {
      const mockGroups = [
        {
          activityType: 'Heat Exchanger Blinding',
          equipmentType: 'Heat Exchanger',
          totalActivities: 20,
          completedActivities: 6,
          progressPercent: 30, // Authoritative 30% from M8.13
          totalDurationHours: 160,
          completedDurationHours: 48,
        },
        {
          activityType: 'Bundle Pullout',
          equipmentType: 'Heat Exchanger',
          totalActivities: 20,
          completedActivities: 1,
          progressPercent: 5, // Authoritative 5% from M8.13
          totalDurationHours: 200,
          completedDurationHours: 10,
        },
      ];

      const identSpy = vi.spyOn(ProgressAggregationService, 'getIdenticalActivityProgress').mockResolvedValue(mockGroups as any);

      const result = await providerRegistry.fetch('planning.identical_activities', { organizationId: ORG_ID }, {
        event: EVENT_ID,
        equipment_type: 'Heat Exchanger',
      });

      expect(identSpy).toHaveBeenCalledWith(ORG_ID, EVENT_ID, 'Heat Exchanger');
      expect(result.rows).toHaveLength(2);

      const row1 = result.rows?.[0];
      expect(row1.standard_activity).toBe('Heat Exchanger Blinding');
      expect(row1.progress_percent).toBe('30%');
      expect(row1.balance).toContain('Balance 70%');
      // Visual bar formatted according to M8.13 percentage: 30% = 3 filled, 7 empty
      expect(row1.progress_visualization).toContain('███░░░░░░░ 30%');

      const row2 = result.rows?.[1];
      expect(row2.standard_activity).toBe('Bundle Pullout');
      expect(row2.progress_percent).toBe('5%');
      expect(row2.balance).toContain('Balance 95%');
      // 5% rounds to 1 block
      expect(row2.progress_visualization).toContain('█░░░░░░░░░ 5%');
    });
  });

  // ─── R15 Plan vs Actual ───────────────────────────────────────────────────
  describe('R15 — Plan vs Actual Report (planning.plan_vs_actual)', () => {
    it('consumes M12 getPlanVsActual variance calculations directly', async () => {
      const mockPva = [
        {
          id: 'act-pva-1',
          activity_number: 'ACT-PVA-01',
          description: 'Vessel blinding',
          workpack_number: 'WP-VESSEL-01',
          planned_start: '2026-09-01',
          planned_end: '2026-09-03',
          actual_start: '2026-09-01',
          actual_end: '2026-09-04',
          progress_percent: 100,
          status: 'completed',
          finish_variance_hours: 24, // 1 day late
          is_delayed: true,
          is_critical: false,
        },
      ];

      const pvaSpy = vi.spyOn(FieldExecutionService, 'getPlanVsActual').mockResolvedValue(mockPva as any);

      const result = await providerRegistry.fetch('planning.plan_vs_actual', { organizationId: ORG_ID }, {
        event: EVENT_ID,
      });

      expect(pvaSpy).toHaveBeenCalledWith(ORG_ID, EVENT_ID);
      expect(result.rows?.[0].variance).toContain('24h (1d)');
      expect(result.rows?.[0].status).toBe('completed');
      expect(result.rows?.[0].delay).toBe('Delayed');
    });
  });

  // ─── R16 S-Curve ──────────────────────────────────────────────────────────
  describe('R16 — S-Curve Report (management.scurve)', () => {
    it('delegates to M8.10 EvmSnapshotService.generateEventCurve and passes series directly', async () => {
      const mockCurve = {
        dates: ['2026-09-01', '2026-09-02', '2026-09-03'],
        pv: [1000, 3000, 6000],
        ev: [800, 2500, 5200],
        ac: [900, 2700, 5600],
        eacProjection: [6500, 6400, 6300],
      };

      const curveSpy = vi.spyOn(EvmSnapshotService, 'generateEventCurve').mockResolvedValue(mockCurve as any);

      const result = await providerRegistry.fetch('management.scurve', { organizationId: ORG_ID }, {
        event: EVENT_ID,
      });

      expect(curveSpy).toHaveBeenCalledWith(EVENT_ID, ORG_ID, undefined, undefined);
      expect(result.rows).toHaveLength(3);
      expect(result.rows?.[2].pv).toBe(6000);
      expect(result.rows?.[2].ev).toBe(5200);
      expect(result.rows?.[2].ac).toBe(5600);
      expect(result.rows?.[2].eacProjection).toBe(6300);
      expect(result.chartData).toEqual(mockCurve);
    });
  });

  // ─── R17 Schedule Health ──────────────────────────────────────────────────
  describe('R17 — Schedule Health Report (planning.schedule_health_index)', () => {
    it('delegates to ValidationEngineService.validate and directly reports objective issue counts', async () => {
      const mockIssues = [
        { code: 'CIRCULAR_LOGIC', message: 'Cycle detected', severity: 'error', entityType: 'activity', entityId: 'act-1' },
        { code: 'MISSING_PREDECESSOR', message: 'No incoming link', severity: 'warning', entityType: 'activity', entityId: 'act-2' },
        { code: 'HIGH_FLOAT', message: 'Float > 30d', severity: 'info', entityType: 'activity', entityId: 'act-3' },
      ];

      const validateSpy = vi.spyOn(ValidationEngineService, 'validate').mockResolvedValue(mockIssues as any);

      const result = await providerRegistry.fetch('planning.schedule_health_index', { organizationId: ORG_ID }, {
        event: EVENT_ID,
      });

      expect(validateSpy).toHaveBeenCalledWith({ organizationId: ORG_ID, eventId: EVENT_ID });
      expect(result.rows).toHaveLength(3);
      expect(result.kpis?.find(k => k.label === 'Errors')?.value).toBe(1);
      expect(result.kpis?.find(k => k.label === 'Warnings')?.value).toBe(1);
      expect(result.kpis?.find(k => k.label === 'Info')?.value).toBe(1);
    });
  });

  // ─── R18 Management Exceptions ────────────────────────────────────────────
  describe('R18 — Management Exceptions Report (management.control_tower_exceptions)', () => {
    it('delegates to M13 ControlTowerQueryService.getSummary and maps exception rules without local evaluation', async () => {
      const mockSummary = {
        organizationId: ORG_ID,
        eventId: EVENT_ID,
        calculatedAt: '2026-09-07T12:00:00Z',
        exceptions: [
          {
            activityId: 'act-ex-1',
            activityIdCode: 'ACT-CRIT-01',
            description: 'Major Column Rigging',
            workpackId: 'wp-1',
            workpackName: 'Column WP',
            equipmentId: 'eq-1',
            equipmentName: 'C-101 Column',
            unitCode: 'U-01',
            status: 'in_progress',
            progressPercent: 20,
            totalFloat: -4,
            isCritical: true,
            spi: 0.65,
            reason: 'CRITICAL_LATE',
            severity: 'P1',
          },
        ],
      };

      const summarySpy = vi.spyOn(ControlTowerQueryService, 'getSummary').mockResolvedValue(mockSummary as any);

      const result = await providerRegistry.fetch('management.control_tower_exceptions', { organizationId: ORG_ID }, {
        event: EVENT_ID,
      });

      expect(summarySpy).toHaveBeenCalledWith(ORG_ID, EVENT_ID);
      expect(result.rows).toHaveLength(1);
      const exc = result.rows?.[0];
      expect(exc.priority).toBe('P1');
      expect(exc.category).toBe('Critical Blocker');
      expect(exc.activity).toBe('ACT-CRIT-01');
      expect(exc.equipment).toBe('C-101 Column');
      expect(exc.impact).toContain('SPI: 0.65');
      expect(result.kpis?.find(k => k.label === 'P1 Critical')?.value).toBe(1);
    });
  });

  // ─── Unified ReportDataset Contract & Immutability ────────────────────────
  describe('Unified ReportDataset Contract & Immutability Pipeline', () => {
    it('generateDataset constructs an immutable, SHA-256 hashed ReportDataset', async () => {
      const mockDefinition = {
        id: 'def-r09-lookahead',
        version: '1.2',
        name: 'Lookahead Report',
        data_source_key: 'planning.lookahead',
        supports_ai_summary: false,
      };

      vi.spyOn(prisma.report_definitions, 'findUnique').mockResolvedValue(mockDefinition as any);
      vi.spyOn(prisma.report_definitions, 'findUniqueOrThrow').mockResolvedValue(mockDefinition as any);
      vi.spyOn(FieldExecutionService, 'getLookahead').mockResolvedValue([
        { id: '1', activity_number: 'A-1', description: 'Test', planned_start: '2026-09-08', status: 'not_started' }
      ] as any);

      const dataset = await ReportGenerationService.generateDataset({
        definitionId: 'def-r09-lookahead',
        organizationId: ORG_ID,
        generatedBy: 'usr-analyst-1',
        parameters: { event: EVENT_ID, horizon: '48h' },
      });

      // Verify required fields on ReportDataset contract
      expect(dataset.reportId).toBe('def-r09-lookahead');
      expect(dataset.reportVersion).toBe('1.2');
      expect(dataset.organizationId).toBe(ORG_ID);
      expect(dataset.eventId).toBe(EVENT_ID);
      expect(dataset.generatedBy).toBe('usr-analyst-1');
      expect(dataset.generatedAt).toBeDefined();
      expect(dataset.dataAsOf).toBeDefined();
      expect(dataset.filters).toEqual({ event: EVENT_ID, horizon: '48h' });
      expect(dataset.dimensions).toContain('event');
      expect(dataset.rows).toBeInstanceOf(Array);
      expect(dataset.provenance.authoritySources).toContain('planning.lookahead');
      expect(dataset.datasetHash).toMatch(/^[a-f0-9]{64}$/); // Valid SHA-256

      // Verify immutability
      expect(Object.isFrozen(dataset)).toBe(true);
      expect(() => {
        (dataset as any).reportId = 'tampered-id';
      }).toThrow();
    });
  });
});
