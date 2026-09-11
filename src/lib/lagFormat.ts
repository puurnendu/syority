/**
 * Sprint 1a — lag representation helpers.
 *
 * Canonical storage is `lag_minutes` (working minutes, sub-day capable).
 * `lag_days` (integer days) is the legacy fallback, still read for rows that
 * predate the migration. The 480-minute day below matches the backfill
 * semantics (the retired API boundary stored hours ÷ 8 into lag_days).
 */
export type LagCarrier = { lag_minutes?: number | null; lag_days?: number | null };

/** Lag in hours (for API payloads and P6/MPP export, which speak hours). */
export function lagToHours(rel: LagCarrier): number {
  if (rel.lag_minutes != null) return Number(rel.lag_minutes) / 60;
  return (Number(rel.lag_days) || 0) * 8;
}

/** Lag in day-offset units for day-granular consumers (e.g. resource leveling). */
export function lagToDays(rel: LagCarrier, hoursPerDay = 8): number {
  if (rel.lag_minutes != null) return Number(rel.lag_minutes) / (hoursPerDay * 60);
  return Number(rel.lag_days) || 0;
}

/** Display string: whole 8h-days as "+2d", sub-day as "+4h". '' when zero. */
export function formatLag(rel: LagCarrier): string {
  const m = rel.lag_minutes != null ? Number(rel.lag_minutes) : null;
  if (m != null) {
    if (m === 0) return '';
    const sign = m > 0 ? '+' : '-';
    const abs = Math.abs(m);
    return abs % 480 === 0 ? `${sign}${abs / 480}d` : `${sign}${Math.round((abs / 60) * 10) / 10}h`;
  }
  const d = Number(rel.lag_days) || 0;
  return d !== 0 ? (d > 0 ? `+${d}d` : `${d}d`) : '';
}
