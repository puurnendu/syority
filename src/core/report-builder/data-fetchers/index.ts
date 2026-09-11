/**
 * M14 Authority Architecture — Data Fetcher Adapter
 *
 * M14-R2: All ad-hoc queries and unauthorized calculation logic in this file have been
 * deprecated and removed. All data fetching strictly delegates to ProviderRegistry,
 * which enforces the authoritative domain boundaries:
 *   - EVM / CPI / SPI / BAC / EAC → M8.10 (EvmCalculationService / EvmSnapshotService)
 *   - Progress Aggregation → M8.13 (ProgressAggregationService)
 *   - Schedule / CPM / Float → M11 (ScheduleEngine / prisma.activity)
 *   - Execution Facts / Delays / Lookahead → M12 (FieldExecutionService)
 *   - Management Exceptions → M13 (ControlTowerQueryService)
 */

import { providerRegistry } from '@/core/report-engine/providers';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface DataFetcherResult {
  rows?: any[];
  tables?: Record<string, { rows: any[]; columns?: Array<{ key: string; label: string }> }>;
  kpis?: Array<{ label: string; value: string | number; unit?: string; trend?: 'up' | 'down' | 'flat'; color?: string }>;
  summary?: string;
  chartData?: any;
  metadata?: Record<string, any>;
}

export type DataFetcher = (orgId: string, params: Record<string, any>) => Promise<DataFetcherResult>;

// ─── Authoritative Registry Delegation ──────────────────────────────────────

/**
 * Proxy-based registry that delegates dynamically to the authoritative ProviderRegistry.
 * Allows any provider registered in ProviderRegistry (84+ providers across all categories)
 * to be fetched seamlessly with tenant context.
 */
export const dataFetcherRegistry: Record<string, DataFetcher> = new Proxy(
  {},
  {
    get(_target, prop: string) {
      if (typeof prop !== 'string') return undefined;
      if (providerRegistry.has(prop)) {
        return async (orgId: string, params: Record<string, any>): Promise<DataFetcherResult> => {
          return providerRegistry.fetch(prop, { organizationId: orgId }, params);
        };
      }
      return undefined;
    },
    has(_target, prop: string) {
      return providerRegistry.has(prop);
    },
    ownKeys(_target) {
      return providerRegistry.keys();
    },
    getOwnPropertyDescriptor(_target, prop: string) {
      if (typeof prop === 'string' && providerRegistry.has(prop)) {
        return {
          configurable: true,
          enumerable: true,
          value: async (orgId: string, params: Record<string, any>): Promise<DataFetcherResult> => {
            return providerRegistry.fetch(prop, { organizationId: orgId }, params);
          },
        };
      }
      return undefined;
    },
  }
);
