/**
 * M7.6D — UDF Rollup Providers
 *
 * 3 providers consuming existing RollupEngine.udfRollups.
 * Auto-discovers UDFs from the rollup map — no hardcoded provider per UDF type.
 * Supports: SUM, AVG, MIN, MAX, COUNT and hierarchy rollups.
 */

import { BaseProvider, type ProviderContext } from './BaseProvider';
import type { DataFetcherResult } from '../data-fetchers';
import { RollupEngine } from '@/core/planner-workspace/RollupEngine';
import { prisma } from '@/lib/prisma';

// ─── Providers ──────────────────────────────────────────────────────────────

/**
 * Hierarchical rollup for any UDF code.
 * Equipment → System → Area → Unit → Site → Company.
 */
export class HierarchicalUDFRollupProvider extends BaseProvider {
  readonly key = 'udf.hierarchical_rollup';
  readonly category = 'udf';
  readonly name = 'UDF Hierarchical Rollup';
  readonly description = 'Hierarchical rollup of any UDF value across Equipment → System → Unit → Event.';
  readonly requiredParams = ['event'];
  readonly optionalParams = ['udfCode', 'unit', 'system'];

  async fetch(ctx: ProviderContext, params: Record<string, any>): Promise<DataFetcherResult> {
    const rollups = await RollupEngine.computeEventRollups(ctx.organizationId, params.event);
    const udfCode = params.udfCode;

    if (udfCode) {
      // Return rollup for a specific UDF code
      const unitRows = rollups.units.map((u) => ({
        entity: u.entityName,
        entityType: u.entityType,
        value: u.values.udfRollups[udfCode] ?? 0,
      }));
      const systemRows = rollups.systems.map((s) => ({
        entity: s.entityName,
        entityType: s.entityType,
        value: s.values.udfRollups[udfCode] ?? 0,
      }));

      return {
        rows: [...unitRows, ...systemRows],
        kpis: [
          { label: `${udfCode} (Event Total)`, value: rollups.event.udfRollups[udfCode] ?? 0 },
        ],
      };
    }

    // Return all UDF rollups at event level
    const allUdfs = Object.entries(rollups.event.udfRollups).map(([code, value]) => ({
      udfCode: code,
      value: Math.round(value * 100) / 100,
    }));

    return {
      rows: allUdfs,
      kpis: [{ label: 'UDF Types', value: allUdfs.length }],
    };
  }
}

/**
 * Quantity summary for UDFs with aggregation options.
 */
export class UDFQuantitySummaryProvider extends BaseProvider {
  readonly key = 'udf.quantity_summary';
  readonly category = 'udf';
  readonly name = 'UDF Quantity Summary';
  readonly description = 'Aggregated UDF quantities (SUM/AVG/MIN/MAX/COUNT).';
  readonly requiredParams = ['event'];
  readonly optionalParams = ['udfCode', 'aggregation'];

  async fetch(ctx: ProviderContext, params: Record<string, any>): Promise<DataFetcherResult> {
    // Get all workpack UDF values
    const workpacks = await (prisma.workpack as any).findMany({
      where: {
        organization_id: ctx.organizationId,
        event_id: params.event,
        deleted_at: null,
      },
      select: {
        workpack_number: true,
        title: true,
        udf_values: true,
      },
    });

    const udfCode = params.udfCode;
    const agg = params.aggregation ?? 'sum';

    if (!udfCode) {
      // Return summary of all UDF codes found
      const codes = new Set<string>();
      for (const wp of workpacks) {
        const udfValues = (wp.udf_values as Record<string, any>) ?? {};
        Object.keys(udfValues).forEach((k) => codes.add(k));
      }
      return {
        rows: Array.from(codes).map((c) => ({ code: c })),
        kpis: [{ label: 'UDF Codes Found', value: codes.size }],
      };
    }

    // Extract values for the specific UDF
    const values: number[] = [];
    for (const wp of workpacks) {
      const udfValues = (wp.udf_values as Record<string, any>) ?? {};
      const v = Number(udfValues[udfCode]);
      if (!isNaN(v)) values.push(v);
    }

    let result = 0;
    switch (agg) {
      case 'sum': result = values.reduce((s, v) => s + v, 0); break;
      case 'avg': result = values.length > 0 ? values.reduce((s, v) => s + v, 0) / values.length : 0; break;
      case 'min': result = values.length > 0 ? Math.min(...values) : 0; break;
      case 'max': result = values.length > 0 ? Math.max(...values) : 0; break;
      case 'count': result = values.length; break;
    }

    return {
      kpis: [
        { label: `${udfCode} (${agg.toUpperCase()})`, value: Math.round(result * 100) / 100 },
        { label: 'Data Points', value: values.length },
      ],
      rows: workpacks.filter((wp) => {
        const udfValues = (wp.udf_values as Record<string, any>) ?? {};
        return udfValues[udfCode] !== undefined;
      }).map((wp) => ({
        workpack: wp.workpack_number,
        title: wp.title,
        value: Number(((wp.udf_values as Record<string, any>) ?? {})[udfCode]) || 0,
      })),
    };
  }
}

/**
 * Baseline vs Actual for UDF values.
 */
export class UDFComparisonProvider extends BaseProvider {
  readonly key = 'udf.comparison';
  readonly category = 'udf';
  readonly name = 'UDF Baseline vs Actual';
  readonly description = 'Compare baseline vs actual UDF values.';
  readonly requiredParams = ['event'];
  readonly optionalParams = ['udfCode'];

  async fetch(ctx: ProviderContext, params: Record<string, any>): Promise<DataFetcherResult> {
    const workpacks = await (prisma.workpack as any).findMany({
      where: {
        organization_id: ctx.organizationId,
        event_id: params.event,
        deleted_at: null,
      },
      select: {
        workpack_number: true,
        title: true,
        udf_values: true,
        baseline_udf_values: true,
      },
    });

    const udfCode = params.udfCode;
    if (!udfCode) {
      return { rows: [], kpis: [{ label: 'Specify udfCode', value: '—' }] };
    }

    const rows = workpacks.map((wp) => {
      const actual = Number(((wp.udf_values as Record<string, any>) ?? {})[udfCode]) || 0;
      const baseline = Number(((wp.baseline_udf_values as Record<string, any>) ?? {})[udfCode]) || 0;
      const variance = actual - baseline;
      return { workpack: wp.workpack_number, title: wp.title, baseline, actual, variance };
    }).filter((r) => r.baseline !== 0 || r.actual !== 0);

    const totalBaseline = rows.reduce((s, r) => s + r.baseline, 0);
    const totalActual = rows.reduce((s, r) => s + r.actual, 0);

    return {
      rows,
      kpis: [
        { label: 'Baseline Total', value: Math.round(totalBaseline * 100) / 100 },
        { label: 'Actual Total', value: Math.round(totalActual * 100) / 100 },
        { label: 'Variance', value: Math.round((totalActual - totalBaseline) * 100) / 100, color: totalActual > totalBaseline ? '#DC2626' : '#10B981' },
      ],
    };
  }
}

// ─── Export All ──────────────────────────────────────────────────────────────

export const udfRollupProviders = [
  new HierarchicalUDFRollupProvider(),
  new UDFQuantitySummaryProvider(),
  new UDFComparisonProvider(),
];
