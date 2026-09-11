/**
 * R0.4-E — Presentation mapping for M8.10 Event S-curve.
 *
 * Does not calculate EVM. Maps generateEventCurve + calculateLiveEvm
 * outputs to Control Tower chart series.
 */

import type { EvmCurveData, EvmSummary } from './types';

export const NO_SCHEDULE_PROGRESS_DATA = 'No schedule/progress data available';

export interface EventSCurveChartPoint {
  name: string;
  Planned: number;
  Earned: number;
  Actual: number;
  Forecast: number | null;
}

export interface EventSCurveChartModel {
  available: boolean;
  message: string | null;
  timeSeries: EventSCurveChartPoint[];
  metrics: { spi: number | null; cpi: number | null; sv: number; cv: number } | null;
  dataDate: string | null;
}

export function mapEventCurveToChart(
  curve: EvmCurveData | null | undefined,
  summary?: EvmSummary | null
): EventSCurveChartModel {
  if (!curve || !curve.dates?.length) {
    return {
      available: false,
      message: NO_SCHEDULE_PROGRESS_DATA,
      timeSeries: [],
      metrics: null,
      dataDate: null,
    };
  }

  const timeSeries = curve.dates.map((date, i) => ({
    name: date,
    Planned: curve.pv[i] ?? 0,
    Earned: curve.ev[i] ?? 0,
    Actual: curve.ac[i] ?? 0,
    Forecast: curve.eacProjection[i] ?? null,
  }));

  return {
    available: true,
    message: null,
    timeSeries,
    metrics: summary
      ? { spi: summary.spi, cpi: summary.cpi, sv: summary.sv, cv: summary.cv }
      : null,
    dataDate: summary?.dataDate ?? null,
  };
}
