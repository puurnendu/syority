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

export class WorkspaceEventRollupProvider extends BaseProvider {
  readonly key = 'workspace.event_rollup';
  readonly category = 'planning';
  readonly name = 'Event Rollup';
  readonly description = 'Event-level rollup KPIs from RollupEngine — workpack progress, critical metrics, completion.';
  readonly requiredParams = ['event'];

  async fetch(ctx: ProviderContext, params: Record<string, any>): Promise<DataFetcherResult> {
    const eventId = getEventId(params);
    if (!eventId) return { kpis: [] };

    try {
      const rollup = await RollupEngine.computeEventRollups(eventId, ctx.organizationId);

      return {
        kpis: [
          { label: 'Total Workpacks', value: rollup.totalWorkpacks },
          { label: 'Completed', value: rollup.completedWorkpacks, color: '#10B981' },
          { label: 'In Progress', value: rollup.inProgressWorkpacks, color: '#3B82F6' },
          { label: 'Not Started', value: rollup.notStartedWorkpacks, color: '#6B7280' },
          {
            label: 'Progress',
            value: `${rollup.overallProgress}%`,
            color: rollup.overallProgress >= 90 ? '#10B981' : rollup.overallProgress >= 50 ? '#F59E0B' : '#DC2626',
          },
          { label: 'Total Activities', value: rollup.totalActivities },
          { label: 'Critical Activities', value: rollup.criticalActivities, color: '#DC2626' },
          { label: 'Overdue', value: rollup.overdueActivities, color: rollup.overdueActivities > 0 ? '#DC2626' : '#10B981' },
        ],
        metadata: { ...rollup },
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
  readonly description = 'Unit/system-level progress breakdown for an event.';
  readonly requiredParams = ['event'];

  async fetch(ctx: ProviderContext, params: Record<string, any>): Promise<DataFetcherResult> {
    const eventId = getEventId(params);
    if (!eventId) return { rows: [] };

    try {
      const rollup = await RollupEngine.computeEventRollups(eventId, ctx.organizationId);
      const breakdown = rollup.unitBreakdown ?? [];

      return {
        rows: breakdown.map((u: any) => ({
          unit: u.unitName ?? u.unitId,
          total: u.totalWorkpacks,
          completed: u.completedWorkpacks,
          inProgress: u.inProgressWorkpacks,
          progress: `${u.progress ?? 0}%`,
        })),
        kpis: [
          { label: 'Units', value: breakdown.length },
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
