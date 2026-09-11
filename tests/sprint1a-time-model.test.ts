/**
 * Sprint 1a — time model regression tests (E2E lineage audit §30: A5, A8;
 * Phase 1 items 7–8).
 *
 * A5 — a time-of-day saved on an operational date survives a save/reload
 *      (columns are timestamptz(3) after the widening migration).
 * A8 — CPM with a 5-day working calendar skips weekends/holidays.
 *
 * Engine tests are pure (no DB). DB tests create rows and delete them in
 * `finally` — the services under test use the global Prisma client, so the
 * rollback-sentinel pattern cannot contain them.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { randomUUID } from 'crypto';
import { prisma } from '@/lib/prisma';
import { calculateSchedule } from '@/lib/scheduleEngine';
import { CalendarEngine } from '@/lib/CalendarEngine';
import { ScheduleOrchestrationService } from '@/core/schedule/ScheduleOrchestrationService';

// 2026-09-11 is a Friday. Sat 12 / Sun 13 / Mon 14 / Tue 15 Sep 2026.
const FRIDAY = '2026-09-11';
const SATURDAY = '2026-09-12';
const MONDAY = '2026-09-14';
const TUESDAY = '2026-09-15';

const MON_FRI = new CalendarEngine([1, 2, 3, 4, 5], 8, []);

describe('A8 — CPM honours the working calendar (engine, pure)', () => {
  const acts = [
    { id: 'a', description: 'A', duration_hours: 8 }, // 1 day at 8h/day
    { id: 'b', description: 'B', duration_hours: 8 },
  ];
  const rels = [
    { predecessor_id: 'a', successor_id: 'b', relationship_type: 'FS' as const, lag_minutes: 0 },
  ];

  it('without a calendar, legacy behaviour schedules straight through the weekend', () => {
    const r = calculateSchedule(acts, rels, { project_start_date: FRIDAY, working_hours_per_day: 8 });
    expect(r.success).toBe(true);
    const b = r.activities.find((x) => x.id === 'b')!;
    // Legacy: Fri + 1 calendar day = Saturday.
    expect(String(b.early_start).slice(0, 10)).toBe(SATURDAY);
  });

  it('with a Mon–Fri calendar, the successor starts Monday, not Saturday', () => {
    const r = calculateSchedule(acts, rels, {
      project_start_date: FRIDAY,
      working_hours_per_day: 8,
      calendar: MON_FRI,
    });
    expect(r.success).toBe(true);
    const a = r.activities.find((x) => x.id === 'a')!;
    const b = r.activities.find((x) => x.id === 'b')!;
    expect(String(a.early_start).slice(0, 10)).toBe(FRIDAY);
    expect(String(a.early_finish).slice(0, 10)).toBe(MONDAY); // end of Friday's working day → Monday boundary
    expect(String(b.early_start).slice(0, 10)).toBe(MONDAY);  // skips Saturday and Sunday
    expect(String(b.early_finish).slice(0, 10)).toBe(TUESDAY);
  });

  it('a holiday exception on Monday pushes the successor to Tuesday', () => {
    const cal = new CalendarEngine([1, 2, 3, 4, 5], 8, [{ date: MONDAY, type: 'holiday' }]);
    const r = calculateSchedule(acts, rels, {
      project_start_date: FRIDAY,
      working_hours_per_day: 8,
      calendar: cal,
    });
    const b = r.activities.find((x) => x.id === 'b')!;
    expect(String(b.early_start).slice(0, 10)).toBe(TUESDAY);
  });

  it('a "work" exception makes a normally-off day workable', () => {
    const cal = new CalendarEngine([1, 2, 3, 4, 5], 8, [{ date: SATURDAY, type: 'work' }]);
    const r = calculateSchedule(acts, rels, {
      project_start_date: FRIDAY,
      working_hours_per_day: 8,
      calendar: cal,
    });
    const b = r.activities.find((x) => x.id === 'b')!;
    expect(String(b.early_start).slice(0, 10)).toBe(SATURDAY);
  });

  it('sub-day lag is expressible in minutes (4h lag at 8h/day = half a working day)', () => {
    const r = calculateSchedule(
      acts,
      [{ predecessor_id: 'a', successor_id: 'b', relationship_type: 'FS' as const, lag_minutes: 240 }],
      { project_start_date: FRIDAY, working_hours_per_day: 8, calendar: MON_FRI }
    );
    const b = r.activities.find((x) => x.id === 'b')!;
    // A finishes at offset 1.0 (Monday); +0.5 working day keeps B on Monday.
    expect(String(b.early_start).slice(0, 10)).toBe(MONDAY);
    // And legacy lag_days still reads as whole days (fallback preserved).
    const legacy = calculateSchedule(
      acts,
      [{ predecessor_id: 'a', successor_id: 'b', relationship_type: 'FS' as const, lag_days: 1 }],
      { project_start_date: FRIDAY, working_hours_per_day: 8, calendar: MON_FRI }
    );
    const lb = legacy.activities.find((x) => x.id === 'b')!;
    expect(String(lb.early_start).slice(0, 10)).toBe(TUESDAY); // Monday + 1 working day lag
  });
});

describe('A8 — CPM honours the working calendar (orchestrated, live DB)', () => {
  let anchor: { orgId: string; siteId: string; userId: string };

  beforeAll(async () => {
    const event = await prisma.event.findFirst({
      where: { deleted_at: null },
      select: { organization_id: true, site_id: true },
      orderBy: { created_at: 'asc' },
    });
    if (!event) throw new Error('A8 DB test requires an existing Event (for org/site anchors).');
    const user = await prisma.user.findFirst({
      where: { organization_id: event.organization_id },
      select: { id: true },
    });
    if (!user) throw new Error('A8 DB test requires a User.');
    anchor = { orgId: event.organization_id, siteId: event.site_id, userId: user.id };
  });

  it('Event CPM skips the weekend under a Mon–Fri ScheduleCalendar', async () => {
    const calendar = await prisma.scheduleCalendar.create({
      data: {
        id: randomUUID(),
        organization_id: anchor.orgId,
        name: 'P0-A8 Mon-Fri',
        work_days: [1, 2, 3, 4, 5],
        hours_per_day: 8,
        exceptions: [],
      },
    });
    const event = await prisma.event.create({
      data: {
        id: randomUUID(),
        organization_id: anchor.orgId,
        site_id: anchor.siteId,
        name: 'P0-A8 Event',
        code: `P0A8-${randomUUID().slice(0, 6)}`,
        planned_start: new Date(FRIDAY),
        calendar_id: calendar.id,
        updated_at: new Date(),
      },
    });
    const workpack = await prisma.workpack.create({
      data: {
        id: randomUUID(),
        organization_id: anchor.orgId,
        site_id: anchor.siteId,
        title: 'P0-A8 pack',
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
      expect(result.count).toBe(2);
      const bCalc = result.activities.find((x: any) => x.id === b.id)!;
      // Friday start, 1 working day each, FS+0 → B starts Monday 2026-09-14.
      const bStart = bCalc.early_start instanceof Date
        ? bCalc.early_start.toISOString()
        : String(bCalc.early_start);
      expect(bStart).toContain(MONDAY);
      // Persisted early_start on the row agrees (M11 writes CPM-native columns).
      const bRow = await prisma.activity.findUnique({ where: { id: b.id } });
      expect(bRow?.early_start?.toISOString()).toContain(MONDAY);
    } finally {
      await prisma.activityRelationship.deleteMany({ where: { id: rel.id } });
      await prisma.activity.deleteMany({ where: { id: { in: [a.id, b.id] } } });
      await prisma.workpack.deleteMany({ where: { id: workpack.id } });
      await prisma.event.deleteMany({ where: { id: event.id } });
      await prisma.scheduleCalendar.deleteMany({ where: { id: calendar.id } });
    }
  }, 60_000);
});

describe('A5 — time-of-day survives save/reload (timestamptz)', () => {
  it('Event.planned_start keeps 06:00 after write and re-read', async () => {
    const anchorEvent = await prisma.event.findFirst({
      where: { deleted_at: null },
      select: { organization_id: true, site_id: true },
      orderBy: { created_at: 'asc' },
    });
    if (!anchorEvent) throw new Error('A5 requires an existing Event for org/site anchors.');

    // 2027-04-10 06:00 in the operational timezone (Asia/Kolkata, +05:30).
    const withTime = new Date('2027-04-10T06:00:00+05:30');
    const event = await prisma.event.create({
      data: {
        id: randomUUID(),
        organization_id: anchorEvent.organization_id,
        site_id: anchorEvent.site_id,
        name: 'P0-A5 Event',
        code: `P0A5-${randomUUID().slice(0, 6)}`,
        planned_start: withTime,
        updated_at: new Date(),
      },
    });
    try {
      const read = await prisma.event.findUnique({ where: { id: event.id } });
      expect(read).not.toBeNull();
      const stored = read!.planned_start!;
      // The instant is preserved exactly…
      expect(stored.getTime()).toBe(withTime.getTime());
      // …and it is 06:00 in the operational zone, not truncated to midnight.
      const kolkataWall = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false,
      }).format(stored);
      expect(kolkataWall).toBe('06:00');
    } finally {
      await prisma.event.deleteMany({ where: { id: event.id } });
    }
  }, 60_000);

  it('Activity.actual_start keeps a time-of-day (TYPE 3 execution fact)', async () => {
    const anchorEvent = await prisma.event.findFirst({
      where: { deleted_at: null },
      select: { id: true, organization_id: true, site_id: true },
      orderBy: { created_at: 'asc' },
    });
    if (!anchorEvent) throw new Error('A5 requires an existing Event.');

    const withTime = new Date('2027-04-10T10:37:00+05:30'); // START pressed 10:37
    const workpack = await prisma.workpack.create({
      data: {
        id: randomUUID(), organization_id: anchorEvent.organization_id,
        site_id: anchorEvent.site_id, title: 'P0-A5 pack',
        created_by: (await prisma.user.findFirst({ where: { organization_id: anchorEvent.organization_id }, select: { id: true } }))!.id,
        event_id: anchorEvent.id, status: 'draft',
      },
    });
    const activity = await prisma.activity.create({
      data: {
        id: randomUUID(), organization_id: anchorEvent.organization_id,
        site_id: anchorEvent.site_id, workpack_id: workpack.id,
        event_id: anchorEvent.id, description: 'A5 actuals', duration_hours: 4,
        actual_start: withTime,
      },
    });
    try {
      const read = await prisma.activity.findUnique({ where: { id: activity.id } });
      expect(read!.actual_start!.getTime()).toBe(withTime.getTime());
    } finally {
      await prisma.activity.deleteMany({ where: { id: activity.id } });
      await prisma.workpack.deleteMany({ where: { id: workpack.id } });
    }
  }, 60_000);
});
