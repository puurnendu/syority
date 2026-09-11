/**
 * Sprint 1b — planned-date authority (E2E lineage audit §30: A6, A9;
 * Phase 1 items 9–10).
 *
 * A6 — predecessor actual finish 10-Apr 14:00, successor FS+0 → successor
 *      planned_start is 10-Apr 14:00 with no manual re-entry.
 * A9 — a silent planned-date write is rejected; an audited override records
 *      reason/user/timestamp and preserves the CPM-derived value.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { randomUUID } from 'crypto';
import { prisma } from '@/lib/prisma';
import { calculateSchedule } from '@/lib/scheduleEngine';
import { CalendarEngine } from '@/lib/CalendarEngine';
import { ScheduleOrchestrationService } from '@/core/schedule/ScheduleOrchestrationService';
import { PlannedDateAuthority } from '@/core/schedule/PlannedDateAuthority';
import {
  assertNoSilentPlannedDateWrite,
  PlannedDateAuthorityError,
} from '@/core/schedule/plannedDateGuard';
import { ActivityService } from '@/modules/Activity/Services/ActivityService';

const FINISH = new Date('2027-04-10T14:00:00+05:30');
const TA_START = new Date('2027-04-10T06:00:00+05:30');
const ALL_WEEK = new CalendarEngine([1, 2, 3, 4, 5, 6, 7], 8, []);

function kolkataHm(d: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d);
}

function kolkataDate(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

describe('A6 — successor planned start follows predecessor actual finish (engine)', () => {
  it('FS+0 successor starts at the predecessor actual finish, including 14:00', () => {
    const r = calculateSchedule(
      [
        { id: 'a', description: 'A', duration_hours: 8, actual_end: FINISH },
        { id: 'b', description: 'B', duration_hours: 8 },
      ],
      [{ predecessor_id: 'a', successor_id: 'b', relationship_type: 'FS', lag_minutes: 0 }],
      { project_start_date: TA_START, working_hours_per_day: 8, calendar: ALL_WEEK }
    );
    expect(r.success).toBe(true);
    const b = r.activities.find((x) => x.id === 'b')!;
    const bStart = new Date(b.early_start);
    expect(kolkataDate(bStart)).toBe('2027-04-10');
    expect(kolkataHm(bStart)).toBe('14:00');
  });
});

describe('A6 — successor planned start follows predecessor actual finish (orchestrated)', () => {
  let anchor: { orgId: string; siteId: string; userId: string };

  beforeAll(async () => {
    const event = await prisma.event.findFirst({
      where: { deleted_at: null },
      select: { organization_id: true, site_id: true },
      orderBy: { created_at: 'asc' },
    });
    if (!event) throw new Error('A6 requires an existing Event for org/site anchors.');
    const user = await prisma.user.findFirst({
      where: { organization_id: event.organization_id },
      select: { id: true },
    });
    if (!user) throw new Error('A6 requires a User.');
    anchor = { orgId: event.organization_id, siteId: event.site_id, userId: user.id };
  });

  it('persists B.planned_start = A.actual_end 14:00 with no manual re-entry', async () => {
    const calendar = await prisma.scheduleCalendar.create({
      data: {
        id: randomUUID(),
        organization_id: anchor.orgId,
        name: 'P0-A6 7-day',
        work_days: [1, 2, 3, 4, 5, 6, 7],
        hours_per_day: 8,
        exceptions: [],
      },
    });
    const event = await prisma.event.create({
      data: {
        id: randomUUID(),
        organization_id: anchor.orgId,
        site_id: anchor.siteId,
        name: 'P0-A6 Event',
        code: `P0A6-${randomUUID().slice(0, 6)}`,
        planned_start: TA_START,
        calendar_id: calendar.id,
        updated_at: new Date(),
      },
    });
    const workpack = await prisma.workpack.create({
      data: {
        id: randomUUID(),
        organization_id: anchor.orgId,
        site_id: anchor.siteId,
        title: 'P0-A6 pack',
        created_by: anchor.userId,
        event_id: event.id,
        status: 'draft',
      },
    });
    const a = await prisma.activity.create({
      data: {
        id: randomUUID(), organization_id: anchor.orgId, site_id: anchor.siteId,
        workpack_id: workpack.id, event_id: event.id,
        description: 'A', duration_hours: 8, sequence_number: 1,
        actual_end: FINISH,
      },
    });
    const b = await prisma.activity.create({
      data: {
        id: randomUUID(), organization_id: anchor.orgId, site_id: anchor.siteId,
        workpack_id: workpack.id, event_id: event.id,
        description: 'B', duration_hours: 8, sequence_number: 2,
      },
    });
    const rel = await prisma.activityRelationship.create({
      data: {
        id: randomUUID(), organization_id: anchor.orgId,
        predecessor_id: a.id, successor_id: b.id,
        relationship_type: 'FS', lag_minutes: 0, updated_at: new Date(),
      },
    });

    try {
      const result = await ScheduleOrchestrationService.calculateEventSchedule(event.id, anchor.orgId);
      expect(result.success).toBe(true);
      const bRow = await prisma.activity.findUnique({ where: { id: b.id } });
      expect(bRow?.planned_start).toBeTruthy();
      expect(kolkataDate(bRow!.planned_start!)).toBe('2027-04-10');
      expect(kolkataHm(bRow!.planned_start!)).toBe('14:00');
      expect(bRow?.planned_start_override).toBeNull();
      expect(bRow?.planned_derived_start?.getTime()).toBe(bRow!.planned_start!.getTime());
    } finally {
      await prisma.activityRelationship.deleteMany({ where: { id: rel.id } });
      await prisma.activity.deleteMany({ where: { id: { in: [a.id, b.id] } } });
      await prisma.workpack.deleteMany({ where: { id: workpack.id } });
      await prisma.event.deleteMany({ where: { id: event.id } });
      await prisma.scheduleCalendar.deleteMany({ where: { id: calendar.id } });
    }
  }, 60_000);
});

describe('A9 — silent planned-date edit is rejected; override is audited', () => {
  it('assertNoSilentPlannedDateWrite rejects a body that types planned_start', () => {
    expect(() => assertNoSilentPlannedDateWrite({ planned_start: '2027-04-10T14:00:00+05:30' }))
      .toThrow(PlannedDateAuthorityError);
  });

  it('applyOverride without a reason is rejected', async () => {
    await expect(
      PlannedDateAuthority.applyOverride({
        organizationId: randomUUID(),
        activityId: randomUUID(),
        userId: randomUUID(),
        reason: '   ',
        planned_start: FINISH,
      })
    ).rejects.toBeInstanceOf(PlannedDateAuthorityError);
  });

  it('ActivityService.updateActivity rejects a silent planned_start write', async () => {
    const event = await prisma.event.findFirst({
      where: { deleted_at: null },
      select: { organization_id: true, site_id: true },
      orderBy: { created_at: 'asc' },
    });
    if (!event) throw new Error('A9 requires an Event.');
    const user = await prisma.user.findFirst({
      where: { organization_id: event.organization_id },
      select: { id: true },
    });
    if (!user) throw new Error('A9 requires a User.');

    const workpack = await prisma.workpack.create({
      data: {
        id: randomUUID(), organization_id: event.organization_id,
        site_id: event.site_id, title: 'P0-A9 pack',
        created_by: user.id, event_id: (await prisma.event.findFirst({
          where: { organization_id: event.organization_id, deleted_at: null },
          select: { id: true },
        }))!.id,
        status: 'draft',
      },
    });
    const activity = await prisma.activity.create({
      data: {
        id: randomUUID(), organization_id: event.organization_id,
        site_id: event.site_id, workpack_id: workpack.id,
        description: 'A9 target', duration_hours: 8,
        planned_derived_start: TA_START,
        early_start: TA_START,
      },
    });
    try {
      await expect(
        ActivityService.updateActivity(
          activity.id,
          event.organization_id,
          { planned_start: FINISH },
          user.id
        )
      ).rejects.toBeInstanceOf(PlannedDateAuthorityError);

      const pinned = await PlannedDateAuthority.applyOverride({
        organizationId: event.organization_id,
        activityId: activity.id,
        userId: user.id,
        reason: 'Scaffold clash — hold start until 14:00',
        planned_start: FINISH,
      });
      expect(pinned.planned_start?.getTime()).toBe(FINISH.getTime());
      expect(pinned.planned_start_override?.getTime()).toBe(FINISH.getTime());
      expect(pinned.planned_derived_start?.getTime()).toBe(TA_START.getTime());
      expect(pinned.planned_override_reason).toContain('Scaffold clash');
      expect(pinned.planned_override_by).toBe(user.id);
      expect(pinned.planned_override_at).toBeTruthy();

      // A later CPM persist must not erase the pin or the derived value.
      await PlannedDateAuthority.persistCpmResults(
        event.organization_id,
        [{
          id: activity.id,
          description: 'A9 target',
          duration_hours: 8,
          duration_days: 1,
          early_start: TA_START.toISOString(),
          early_finish: FINISH.toISOString(),
          late_start: TA_START.toISOString(),
          late_finish: FINISH.toISOString(),
          total_float_days: 0,
          total_float_hours: 0,
          free_float_days: 0,
          is_critical: true,
          predecessors: [],
          successors: [],
        }],
        { hoursPerDay: 8 }
      );
      const afterCpm = await prisma.activity.findUnique({ where: { id: activity.id } });
      expect(afterCpm?.planned_start?.getTime()).toBe(FINISH.getTime());
      expect(afterCpm?.planned_derived_start?.getTime()).toBe(TA_START.getTime());
      expect(afterCpm?.planned_override_reason).toContain('Scaffold clash');
    } finally {
      await prisma.activity.deleteMany({ where: { id: activity.id } });
      await prisma.workpack.deleteMany({ where: { id: workpack.id } });
    }
  }, 60_000);
});
