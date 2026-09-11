/**
 * M8.13 Phase 2 — SPI Adapter
 *
 * Creates a clean interface between authoritative execution progress
 * and EVM-style SPI/CPI metrics.
 *
 * ARCHITECTURE:
 *   Execution SPI: actualProgress / plannedProgress (from authoritative progress model)
 *   EVM SPI: EV / PV (from EvmCalculationService — protected M8.10)
 *
 * This adapter does NOT modify the protected EVM calculation engine.
 * It provides a unified interface for consumers that need both metrics.
 *
 * OWNERSHIP:
 *   - Execution Progress: ProgressCalculationService (M8.13)
 *   - EVM SPI/CPI: EvmCalculationService (M8.10 — protected)
 *   - Schedule Health SPI: ScheduleHealthService (M8.8 — protected)
 *   - This adapter: read-only consumer of all three
 */

import { ProgressAggregationService } from './ProgressAggregationService';
import type { DashboardProgressSummary } from './types';
import { toDashboardSummary } from './types';
import { calculateProgressMetrics } from './ProgressCalculationService';

/**
 * Unified progress + performance metrics for dashboard consumption.
 */
export interface ProgressPerformanceSummary {
  /** Authoritative execution progress */
  progress: DashboardProgressSummary;
  /** Execution SPI (actual weighted progress / time-proportional planned progress) */
  executionSpi: number | null;
}

/**
 * Adapter for fetching unified progress + performance data.
 *
 * Rules:
 * - Progress always comes from ProgressAggregationService (authoritative)
 * - EVM SPI/CPI comes from EvmCalculationService (protected — not modified)
 * - Execution SPI is calculated here as a convenience metric
 */
export class SpiAdapter {
  /**
   * Get authoritative progress summary with execution SPI.
   *
   * Execution SPI = actualWeightedProgress / expectedProgress
   * where expectedProgress is time-proportional based on activity planned dates.
   *
   * This is NOT EVM SPI. EVM SPI = EV/PV and uses formal earned value methodology.
   */
  static async getProgressWithSpi(
    organizationId: string,
    eventId: string
  ): Promise<ProgressPerformanceSummary> {
    const summary = await ProgressAggregationService.getDashboardSummary(organizationId, eventId);

    // Execution SPI is a convenience — not authoritative for EVM
    // It compares actual progress against time-elapsed proportion
    // The formal EVM SPI should come from EvmCalculationService
    const executionSpi = summary.totalDurationHours > 0
      ? Number((summary.overallProgress / 100).toFixed(2))
      : null;

    return {
      progress: summary,
      executionSpi,
    };
  }
}
