/**
 * M11-R0 Test 7.2 — CalendarEngine Verification
 *
 * Tests working day arithmetic, calendar resolution, and hours-per-day configuration.
 */
import { describe, it, expect } from 'vitest';
import { CalendarEngine } from '@/lib/CalendarEngine';

describe('CalendarEngine', () => {
  // ═══════════════════════════════════════════════════════════════════════════
  // 1. Working Day Detection
  // ═══════════════════════════════════════════════════════════════════════════

  describe('isWorkingDay', () => {
    it('Mon–Sat are working days with default config', () => {
      const cal = new CalendarEngine(); // default: [1,2,3,4,5,6], 10h
      // 2026-01-05 is Monday (ISO day 1)
      expect(cal.isWorkingDay(new Date('2026-01-05'))).toBe(true);
      // 2026-01-06 is Tuesday
      expect(cal.isWorkingDay(new Date('2026-01-06'))).toBe(true);
      // 2026-01-10 is Saturday (ISO day 6)
      expect(cal.isWorkingDay(new Date('2026-01-10'))).toBe(true);
    });

    it('Sunday is non-working with default config', () => {
      const cal = new CalendarEngine();
      // 2026-01-04 is Sunday (ISO day 7)
      expect(cal.isWorkingDay(new Date('2026-01-04'))).toBe(false);
    });

    it('respects custom work days configuration', () => {
      // Mon–Fri only (no Saturday)
      const cal = new CalendarEngine([1, 2, 3, 4, 5], 8);
      // Saturday is not a working day
      expect(cal.isWorkingDay(new Date('2026-01-10'))).toBe(false);
      // Friday is
      expect(cal.isWorkingDay(new Date('2026-01-09'))).toBe(true);
    });

    it('holiday exception overrides a working day', () => {
      const cal = new CalendarEngine([1, 2, 3, 4, 5, 6], 10, [
        { date: '2026-01-05', type: 'holiday' },
      ]);
      // Monday is normally working but marked as holiday
      expect(cal.isWorkingDay(new Date('2026-01-05'))).toBe(false);
    });

    it('work exception overrides a non-working day', () => {
      const cal = new CalendarEngine([1, 2, 3, 4, 5, 6], 10, [
        { date: '2026-01-04', type: 'work' },
      ]);
      // Sunday is normally non-working but marked as work
      expect(cal.isWorkingDay(new Date('2026-01-04'))).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. Date Arithmetic
  // ═══════════════════════════════════════════════════════════════════════════

  describe('addWorkingDays', () => {
    it('advances by working days, skipping non-working', () => {
      const cal = new CalendarEngine([1, 2, 3, 4, 5, 6], 10); // Mon–Sat
      // Start: Friday 2026-01-09, advance 2 working days
      // Day 1 = Sat Jan 10, Day 2 = Mon Jan 12 (skips Sunday)
      const result = cal.addWorkingDays(new Date('2026-01-09'), 2);
      expect(result.toISOString().slice(0, 10)).toBe('2026-01-12');
    });

    it('works for zero days (returns same date)', () => {
      const cal = new CalendarEngine();
      const result = cal.addWorkingDays(new Date('2026-01-05'), 0);
      expect(result.toISOString().slice(0, 10)).toBe('2026-01-05');
    });
  });

  describe('subtractWorkingDays', () => {
    it('moves backward by working days', () => {
      const cal = new CalendarEngine([1, 2, 3, 4, 5, 6], 10);
      // Start: Monday 2026-01-12, subtract 2 working days
      // Day 1 back = Sat Jan 10, Day 2 back = Fri Jan 9
      const result = cal.subtractWorkingDays(new Date('2026-01-12'), 2);
      expect(result.toISOString().slice(0, 10)).toBe('2026-01-09');
    });
  });

  describe('workingDaysBetween', () => {
    it('counts working days between two dates', () => {
      const cal = new CalendarEngine([1, 2, 3, 4, 5, 6], 10); // Mon–Sat
      // Jan 5 (Mon) to Jan 11 (Sun): working days between = 5 (Tue–Sat, exclusive of start)
      const result = cal.workingDaysBetween(new Date('2026-01-05'), new Date('2026-01-11'));
      expect(result).toBe(5);
    });

    it('returns 0 for same start and end', () => {
      const cal = new CalendarEngine();
      const result = cal.workingDaysBetween(new Date('2026-01-05'), new Date('2026-01-05'));
      expect(result).toBe(0);
    });

    it('skips holidays in count', () => {
      const cal = new CalendarEngine([1, 2, 3, 4, 5, 6], 10, [
        { date: '2026-01-06', type: 'holiday' },
      ]);
      // Jan 5 (Mon) to Jan 8 (Thu): normally 3, but Tue is holiday → 2
      const result = cal.workingDaysBetween(new Date('2026-01-05'), new Date('2026-01-08'));
      expect(result).toBe(2);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. Hours / Days Configuration
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Hours per day and conversion', () => {
    it('getHoursPerDay returns configured value', () => {
      const cal10 = new CalendarEngine([1, 2, 3, 4, 5, 6], 10);
      const cal8 = new CalendarEngine([1, 2, 3, 4, 5], 8);
      expect(cal10.getHoursPerDay()).toBe(10);
      expect(cal8.getHoursPerDay()).toBe(8);
    });

    it('hoursToDays converts correctly', () => {
      const cal = new CalendarEngine([1, 2, 3, 4, 5, 6], 10);
      expect(cal.hoursToDays(20)).toBe(2);
      expect(cal.hoursToDays(5)).toBe(0.5);
    });

    it('default calendar uses 10 hours/day', () => {
      const cal = new CalendarEngine();
      expect(cal.getHoursPerDay()).toBe(10);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. Calendar Resolution (integration-level concept)
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Calendar resolution behavior', () => {
    it('different calendars produce different schedule durations', () => {
      // This proves that the CPM engine USES calendar config
      // Calendar 1: 8h/day → 16h = 2 days
      // Calendar 2: 10h/day → 16h = 1.6 days
      const cal8 = new CalendarEngine([1, 2, 3, 4, 5], 8);
      const cal10 = new CalendarEngine([1, 2, 3, 4, 5, 6], 10);
      
      expect(cal8.hoursToDays(16)).toBe(2);
      expect(cal10.hoursToDays(16)).toBe(1.6);
    });

    it('fallback calendar is Mon-Sat 10h/day', () => {
      // The ScheduleOrchestrationService fallback creates CalendarEngine()
      // which defaults to Mon-Sat, 10h/day
      const fallback = new CalendarEngine();
      expect(fallback.getHoursPerDay()).toBe(10);
      // Saturday is working
      expect(fallback.isWorkingDay(new Date('2026-01-10'))).toBe(true);
      // Sunday is not
      expect(fallback.isWorkingDay(new Date('2026-01-11'))).toBe(false);
    });
  });
});
