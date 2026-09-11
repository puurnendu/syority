/**
 * M11-R0 Test 7.3 — ScheduleOrchestrationService Verification
 *
 * Tests the orchestration layer: event resolution, calendar loading,
 * delegation to scheduleEngine, persistence behavior, and event isolation.
 *
 * Uses vi.mock with factory to stub Prisma.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock Prisma (hoisted factory — no external references) ──────────────────

vi.mock('@/lib/prisma', () => {
  const mockPrisma = {
    event: {
      findFirst: vi.fn(),
    },
    activity: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    activityRelationship: {
      findMany: vi.fn(),
    },
    scheduleCalendar: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
    workpack: {
      findFirst: vi.fn(),
    },
    scheduleBaseline: {
      findFirst: vi.fn(),
    },
    baselineActivity: {
      findMany: vi.fn(),
    },
    $transaction: vi.fn((updates: any[]) => Promise.all(updates)),
  };
  return { prisma: mockPrisma };
});

// ─── Import after mocking ────────────────────────────────────────────────────

import { prisma } from '@/lib/prisma';
import { ScheduleOrchestrationService } from '@/core/schedule/ScheduleOrchestrationService';

// ─── Type-safe mock reference ────────────────────────────────────────────────

const mockPrisma = vi.mocked(prisma, true);

// ─── Test Data ────────────────────────────────────────────────────────────────

const ORG_ID = '00000000-0000-0000-0000-000000000001';
const EVENT_ID = '00000000-0000-0000-0000-000000000002';

const mockEvent = {
  id: EVENT_ID,
  name: 'Test Turnaround',
  planned_start: new Date('2026-01-01'),
  planned_end: new Date('2026-02-01'),
  calendar_id: null,
};

const mockActivities = [
  { id: 'a1', activity_number: 'ACT-001', description: 'Handover', duration_hours: 8, planned_start: null, planned_end: null, wbs_code: null, status: 'not_started', discipline_id: null },
  { id: 'a2', activity_number: 'ACT-002', description: 'Isolation', duration_hours: 16, planned_start: null, planned_end: null, wbs_code: null, status: 'not_started', discipline_id: null },
];

const mockRelationships = [
  { id: 'r1', predecessor_id: 'a1', successor_id: 'a2', relationship_type: 'FS', lag_days: 0 },
];

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ScheduleOrchestrationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default mocks
    (mockPrisma.event.findFirst as any).mockResolvedValue(mockEvent);
    (mockPrisma.activity.findMany as any).mockResolvedValue(mockActivities);
    (mockPrisma.activityRelationship.findMany as any).mockResolvedValue(mockRelationships);
    (mockPrisma.scheduleCalendar.findUnique as any).mockResolvedValue(null);
    (mockPrisma.scheduleCalendar.findFirst as any).mockResolvedValue(null);
    (mockPrisma.activity.update as any).mockResolvedValue({});
  });

  describe('calculateEventSchedule', () => {
    it('returns error when event not found', async () => {
      (mockPrisma.event.findFirst as any).mockResolvedValue(null);

      const result = await ScheduleOrchestrationService.calculateEventSchedule(EVENT_ID, ORG_ID);

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('returns empty result for zero activities', async () => {
      (mockPrisma.activity.findMany as any).mockResolvedValue([]);

      const result = await ScheduleOrchestrationService.calculateEventSchedule(EVENT_ID, ORG_ID);

      expect(result.success).toBe(true);
      expect(result.count).toBe(0);
    });

    it('delegates CPM to scheduleEngine (not SchedulingService)', async () => {
      (mockPrisma.activity.findMany as any)
        .mockResolvedValueOnce(mockActivities)
        .mockResolvedValueOnce(mockActivities);

      const result = await ScheduleOrchestrationService.calculateEventSchedule(EVENT_ID, ORG_ID);

      expect(result.success).toBe(true);
      expect(result.count).toBe(2);
      expect(result.calculation.activities).toHaveLength(2);
      expect(result.calculation.activities[0].early_start).toBeDefined();
      expect(result.calculation.activities[0].late_start).toBeDefined();
    });

    it('persists CPM results when persist=true (default)', async () => {
      (mockPrisma.activity.findMany as any)
        .mockResolvedValueOnce(mockActivities)
        .mockResolvedValueOnce(mockActivities);

      await ScheduleOrchestrationService.calculateEventSchedule(EVENT_ID, ORG_ID);

      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('skips persistence when persist=false', async () => {
      (mockPrisma.activity.findMany as any).mockResolvedValue(mockActivities);

      await ScheduleOrchestrationService.calculateEventSchedule(EVENT_ID, ORG_ID, {
        persist: false,
      });

      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('scopes queries by event_id (not project_id)', async () => {
      (mockPrisma.activity.findMany as any)
        .mockResolvedValueOnce(mockActivities)
        .mockResolvedValueOnce(mockActivities);

      await ScheduleOrchestrationService.calculateEventSchedule(EVENT_ID, ORG_ID);

      const firstCall = (mockPrisma.activity.findMany as any).mock.calls[0][0];
      expect(firstCall.where.event_id).toBe(EVENT_ID);
      expect(firstCall.where).not.toHaveProperty('project_id');
    });

    it('scopes queries by organization_id (tenant isolation)', async () => {
      (mockPrisma.activity.findMany as any)
        .mockResolvedValueOnce(mockActivities)
        .mockResolvedValueOnce(mockActivities);

      await ScheduleOrchestrationService.calculateEventSchedule(EVENT_ID, ORG_ID);

      const eventCall = (mockPrisma.event.findFirst as any).mock.calls[0][0];
      expect(eventCall.where.organization_id).toBe(ORG_ID);
    });
  });

  describe('Calendar resolution', () => {
    it('uses event-specific calendar when available', async () => {
      const eventWithCal = { ...mockEvent, calendar_id: 'cal-1' };
      (mockPrisma.event.findFirst as any).mockResolvedValue(eventWithCal);
      (mockPrisma.scheduleCalendar.findUnique as any).mockResolvedValue({
        id: 'cal-1',
        work_days: [1, 2, 3, 4, 5],
        hours_per_day: 8,
        exceptions: [],
      });
      (mockPrisma.activity.findMany as any)
        .mockResolvedValueOnce(mockActivities)
        .mockResolvedValueOnce(mockActivities);

      await ScheduleOrchestrationService.calculateEventSchedule(EVENT_ID, ORG_ID);

      expect(mockPrisma.scheduleCalendar.findUnique).toHaveBeenCalledWith({
        where: { id: 'cal-1' },
      });
    });

    it('falls back to org default calendar', async () => {
      (mockPrisma.scheduleCalendar.findUnique as any).mockResolvedValue(null);
      (mockPrisma.scheduleCalendar.findFirst as any).mockResolvedValue({
        id: 'org-cal',
        work_days: [1, 2, 3, 4, 5, 6],
        hours_per_day: 10,
        exceptions: [],
      });
      (mockPrisma.activity.findMany as any)
        .mockResolvedValueOnce(mockActivities)
        .mockResolvedValueOnce(mockActivities);

      await ScheduleOrchestrationService.calculateEventSchedule(EVENT_ID, ORG_ID);

      expect(mockPrisma.scheduleCalendar.findFirst).toHaveBeenCalledWith({
        where: { organization_id: ORG_ID, is_default: true },
      });
    });

    it('uses fallback when no calendar configured', async () => {
      (mockPrisma.scheduleCalendar.findUnique as any).mockResolvedValue(null);
      (mockPrisma.scheduleCalendar.findFirst as any).mockResolvedValue(null);
      (mockPrisma.activity.findMany as any)
        .mockResolvedValueOnce(mockActivities)
        .mockResolvedValueOnce(mockActivities);

      const result = await ScheduleOrchestrationService.calculateEventSchedule(EVENT_ID, ORG_ID);

      expect(result.success).toBe(true);
    });
  });

  describe('R0.4-E Project resolver removed', () => {
    it('does not expose resolveEventIdFromProject', () => {
      expect((ScheduleOrchestrationService as any).resolveEventIdFromProject).toBeUndefined();
    });
  });

  describe('No dependency on SchedulingService', () => {
    it('ScheduleOrchestrationService does not import SchedulingService', async () => {
      const fs = await import('fs');
      const source = fs.readFileSync(
        'src/core/schedule/ScheduleOrchestrationService.ts',
        'utf8'
      );
      // Verify no active import from SchedulingService (comments may reference it)
      expect(source).not.toMatch(/import\s.*SchedulingService/);
      expect(source).toContain('scheduleEngine');
      expect(source).toContain('CalendarEngine');
    });
  });
});
