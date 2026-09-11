/**
 * M7.6C — Workspace Data Providers
 *
 * Bridge providers that consume RollupEngine and ValidationEngineService.
 * These make planner workspace data available as OIS widgets.
 */

import { BaseProvider, type ProviderContext } from '@/core/report-engine/providers/BaseProvider';
import type { DataFetcherResult } from '@/core/report-engine/data-fetchers';
import { RollupEngine } from '@/core/planner-workspace/RollupEngine';

// ─── Helpers ────────────────────────────────────────────────────────────────

function getEventId(params: Record<string, any>): string {
  return params.event ?? params.eventId ?? params.event_id ?? '';
}

// ─── Providers ──────────────────────────────────────────────────────────────

import { ProgressAggregationService } from '@/core/progress/ProgressAggregationService';

export class WorkspaceEventRollupProvider extends BaseProvider {
  readonly key = 'workspace.event_rollup';
  readonly category = 'planning';
  readonly name = 'Event Rollup';
  readonly description = 'Event-level rollup KPIs combining RollupEngine with M8.13 progress authority.';
  readonly requiredParams = ['event'];

  async fetch(ctx: ProviderContext, params: Record<string, any>): Promise<DataFetcherResult> {
    const eventId = getEventId(params);
    if (!eventId) return { kpis: [] };

    try {
      const [rollup, progressSummary] = await Promise.all([
        RollupEngine.computeEventRollups(ctx.organizationId, eventId),
        ProgressAggregationService.getDashboardSummary(ctx.organizationId, eventId).catch(() => null),
      ]);

      const overallProgress = progressSummary?.overallProgress ?? 0;

      return {
        kpis: [
          { label: 'Total Workpacks', value: rollup.event.workpackCount },
          { label: 'Total Activities', value: rollup.event.activityCount },
          { label: 'Resource Hours', value: Math.round(rollup.event.totalResourceHrs), unit: 'hrs' },
          {
            label: 'Progress',
            value: `${Math.round(overallProgress)}%`,
            color: overallProgress >= 90 ? '#10B981' : overallProgress >= 50 ? '#F59E0B' : '#DC2626',
          },
          { label: 'Avg Readiness', value: `${Math.round(rollup.event.avgReadiness)}%` },
          { label: 'Total Crew', value: rollup.event.totalCrew, unit: 'pax' },
        ],
        metadata: { rollup, progressSummary },
      };
    } catch (err: any) {
      return {
        kpis: [{ label: 'Error', value: err.message, color: '#DC2626' }],
      };
    }
  }
}

export class WorkspaceHierarchyProgressProvider extends BaseProvider {
  readonly key = 'workspace.hierarchy_progress';
  readonly category = 'planning';
  readonly name = 'Hierarchy Progress';
  readonly description = 'Unit-level progress breakdown from M8.13 progress authority.';
  readonly requiredParams = ['event'];

  async fetch(ctx: ProviderContext, params: Record<string, any>): Promise<DataFetcherResult> {
    const eventId = getEventId(params);
    if (!eventId) return { rows: [] };

    try {
      const payload = await ProgressAggregationService.getEventProgress(ctx.organizationId, eventId, { includeUnit: true });
      const rows = (payload.byUnit ?? []).map((u) => ({
        unit: u.label ?? u.key ?? 'Unassigned',
        activities: u.metrics.totalActivities,
        completed: u.metrics.completedActivities,
        inProgress: u.metrics.inProgressActivities,
        progress: `${Math.round(u.metrics.weightedProgress)}%`,
      }));

      return {
        rows,
        kpis: [
          { label: 'Units', value: rows.length },
          { label: 'Total Activities', value: rows.reduce((s, r) => s + r.activities, 0) },
        ],
      };
    } catch {
      return { rows: [] };
    }
  }
}

// ─── Export ──────────────────────────────────────────────────────────────────

export const workspaceProviders = [
  new WorkspaceEventRollupProvider(),
  new WorkspaceHierarchyProgressProvider(),
];
