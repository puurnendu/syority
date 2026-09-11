/**
 * M7.7.1 — Default Calendar & Shift Definitions
 *
 * Provisioned automatically for every new tenant.
 * work_days: 0=Sunday, 1=Monday, ..., 6=Saturday
 */

export const DEFAULT_CALENDARS = [
  {
    name: '5-Day Work Week',
    work_days: [1, 2, 3, 4, 5],
    hours_per_day: 8,
    is_default: true,
  },
  {
    name: '6-Day Work Week',
    work_days: [1, 2, 3, 4, 5, 6],
    hours_per_day: 8,
    is_default: false,
  },
  {
    name: '7-Day Continuous',
    work_days: [0, 1, 2, 3, 4, 5, 6],
    hours_per_day: 8,
    is_default: false,
  },
  {
    name: '12-Hour Shutdown',
    work_days: [0, 1, 2, 3, 4, 5, 6],
    hours_per_day: 12,
    is_default: false,
  },
  {
    name: 'Night Shift',
    work_days: [0, 1, 2, 3, 4, 5, 6],
    hours_per_day: 12,
    is_default: false,
  },
  {
    name: 'Maintenance Calendar',
    work_days: [1, 2, 3, 4, 5],
    hours_per_day: 10,
    is_default: false,
  },
  {
    name: 'Turnaround Calendar',
    work_days: [0, 1, 2, 3, 4, 5, 6],
    hours_per_day: 12,
    is_default: false,
  },
] as const;
