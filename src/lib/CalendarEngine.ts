/**
 * CalendarEngine — working-day arithmetic for CPM scheduling.
 *
 * work_days uses ISO weekday numbering:
 *   1 = Monday … 6 = Saturday, 7 = Sunday
 *
 * exceptions overrides specific calendar dates:
 *   { date: "2026-03-25", type: "holiday" }  – marks a normally-working day as off
 *   { date: "2026-03-22", type: "work"    }  – marks a normally-off day as working
 */
export class CalendarEngine {
  constructor(
    private workDays: number[] = [1, 2, 3, 4, 5, 6], // Mon–Sat
    private hoursPerDay: number = 10,
    private exceptions: { date: string; type: 'holiday' | 'work' }[] = []
  ) {}

  /**
   * Returns true when the given date is a working day after applying
   * configured work_days and any date-level exceptions.
   */
  isWorkingDay(date: Date): boolean {
    const iso = date.toISOString().split('T')[0];
    const exception = this.exceptions.find(e => e.date === iso);
    if (exception) return exception.type === 'work';

    // JS getDay(): 0=Sun … 6=Sat → convert to ISO: Sun=7
    const dow = date.getDay() === 0 ? 7 : date.getDay();
    return this.workDays.includes(dow);
  }

  /**
   * Advance `start` by `days` working days.
   * Negative `days` moves backward.
   */
  addWorkingDays(start: Date, days: number): Date {
    const result = new Date(start);
    let remaining = Math.abs(days);
    const direction = days >= 0 ? 1 : -1;
    while (remaining > 0) {
      result.setDate(result.getDate() + direction);
      if (this.isWorkingDay(result)) remaining--;
    }
    return result;
  }

  /**
   * Move `end` back by `days` working days (convenience wrapper).
   */
  subtractWorkingDays(end: Date, days: number): Date {
    return this.addWorkingDays(end, -days);
  }

  /**
   * Count the number of working days strictly between `start` and `end`
   * (exclusive of `start`, inclusive of `end`).
   */
  workingDaysBetween(start: Date, end: Date): number {
    let count = 0;
    const cursor = new Date(start);
    while (cursor < end) {
      cursor.setDate(cursor.getDate() + 1);
      if (this.isWorkingDay(cursor)) count++;
    }
    return count;
  }

  /** Working hours per day configured for this calendar. */
  getHoursPerDay(): number {
    return this.hoursPerDay;
  }

  /**
   * Convert a duration in hours to working days using this calendar's
   * hoursPerDay setting.
   */
  hoursToDays(hours: number): number {
    return hours / this.hoursPerDay;
  }
}
