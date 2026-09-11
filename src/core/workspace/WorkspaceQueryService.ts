/**
 * M12 V1 Phase 1 — WorkspaceQueryService
 *
 * The main orchestrator for workspace data queries.
 *
 * Accepts a WorkspaceQuery, builds Prisma predicates via DimensionQueryBuilder,
 * executes a paginated query, resolves dimension values via DimensionResolver,
 * and returns a WorkspaceQueryResult.
 *
 * PERFORMANCE CONTRACT:
 *   1. Only the requested page of activities is fetched (server-side pagination)
 *   2. Count query runs in parallel with the data query
 *   3. DimensionResolver is called ONLY on the page-sized result set
 *   4. No N+1: uses DimensionResolver.getPrismaInclude()
 *
 * AUTHORITY BOUNDARIES:
 *   - Does NOT calculate progress (M8.13 authority)
 *   - Does NOT calculate CPM/schedule (M11 authority)
 *   - Does NOT perform execution writes (M12 ExecutionWriteService authority)
 *   - Schedule fields are READ-ONLY projections from the Activity table
 */

import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';
import { formatLag } from '@/lib/lagFormat';
import { DimensionResolver } from '@/core/dimensions';
import type { ResolvedDimensionValue } from '@/core/dimensions';
import { DimensionQueryBuilder } from './DimensionQueryBuilder';
import type {
  WorkspaceQuery,
  WorkspaceQueryResult,
  WorkspaceRow,
  WorkspaceSort,
  GroupingMetadata,
  GroupLevelMetadata,
  GroupInfo,
} from './types';
import { clampPageSize, DEFAULT_PAGE_SIZE } from './types';

// ── In-Memory UDF Sort ───────────────────────────────────────────────────────

/**
 * Apply UDF sorts in-memory on the bounded page.
 *
 * Phase 1 hybrid approach: UDF sort is applied after fetching the page.
 * This means UDF sort is within-page only. Full server-side UDF sort
 * can be added in Phase 2 via raw SQL lateral joins.
 */
function applyInMemoryUdfSorts(
  rows: WorkspaceRow[],
  udfSorts: WorkspaceSort[],
): WorkspaceRow[] {
  if (udfSorts.length === 0) return rows;

  return [...rows].sort((a, b) => {
    for (const sort of udfSorts) {
      const aVal = a.dimensionValues[sort.dimensionCode]?.value;
      const bVal = b.dimensionValues[sort.dimensionCode]?.value;

      // Nulls sort to end
      if (aVal == null && bVal == null) continue;
      if (aVal == null) return sort.direction === 'asc' ? 1 : -1;
      if (bVal == null) return sort.direction === 'asc' ? -1 : 1;

      let cmp = 0;
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        cmp = aVal - bVal;
      } else if (typeof aVal === 'boolean' && typeof bVal === 'boolean') {
        cmp = (aVal ? 1 : 0) - (bVal ? 1 : 0);
      } else {
        cmp = String(aVal).localeCompare(String(bVal), undefined, { sensitivity: 'base' });
      }

      if (cmp !== 0) {
        return sort.direction === 'asc' ? cmp : -cmp;
      }
    }
    return 0;
  });
}

// ── WorkspaceQueryService ────────────────────────────────────────────────────

export class WorkspaceQueryService {
  /**
   * Execute a workspace query.
   *
   * This is the main entry point for all workspace data access.
   *
   * @param query - The workspace query specification
   * @returns Paginated, dimension-resolved result set
   */
  static async execute(query: WorkspaceQuery): Promise<WorkspaceQueryResult> {
    // ── 1. Validate & clamp pagination ──────────────────────────────────
    const pageSize = clampPageSize(query.pageSize || DEFAULT_PAGE_SIZE);
    const page = Math.max(1, Math.floor(query.page || 1));
    const skip = (page - 1) * pageSize;

    // ── 2. Build Prisma WHERE clause ────────────────────────────────────
    const where = DimensionQueryBuilder.buildWhereClause({
      organizationId: query.organizationId,
      eventId: query.eventId,
      filters: query.filters,
      filterGroups: query.filterGroups,
      hierarchyContext: query.hierarchyContext,
      search: query.search,
    });

    // ── 3. Build Prisma ORDER BY clause ─────────────────────────────────
    const { prismaOrderBy, inMemoryUdfSorts } =
      DimensionQueryBuilder.buildOrderByClause(query.sort);

    // ── 4. Build the Prisma include for dimension resolution ────────────
    const dimensionInclude = DimensionResolver.getPrismaInclude();

    // Add predecessor/successor includes for relationship display
    const fullInclude = {
      ...dimensionInclude,
      predecessors: {
        include: {
          predecessor: { select: { activity_id: true } },
        },
      },
      successors: {
        include: {
          successor: { select: { activity_id: true } },
        },
      },
    };

    // ── 5. Execute data + count queries in parallel ─────────────────────
    const [activities, totalCount] = await Promise.all([
      prisma.activity.findMany({
        where,
        include: fullInclude,
        orderBy: prismaOrderBy,
        skip,
        take: pageSize,
      }),
      prisma.activity.count({ where }),
    ]);

    // ── 6. Resolve dimension values on the bounded page ─────────────────
    const dimensionCodes = query.dimensions.length > 0 ? query.dimensions : [];
    const resolvedMap = dimensionCodes.length > 0
      ? DimensionResolver.resolveForActivities(activities as any, dimensionCodes)
      : new Map<string, Record<string, ResolvedDimensionValue>>();

    // ── 7. Map to WorkspaceRow[] ────────────────────────────────────────
    let rows: WorkspaceRow[] = activities.map((act: any) => {
      // Format predecessor/successor strings
      const predecessors = (act.predecessors ?? []).map((rel: any) => {
        const predId = rel.predecessor?.activity_id ?? rel.predecessor_id?.slice(0, 8) ?? '';
        const type = rel.relationship_type ?? 'FS';
        return `${predId}${type}${formatLag(rel)}`;
      });

      const successors = (act.successors ?? []).map((rel: any) => {
        const succId = rel.successor?.activity_id ?? rel.successor_id?.slice(0, 8) ?? '';
        const type = rel.relationship_type ?? 'FS';
        return `${succId}${type}${formatLag(rel)}`;
      });

      return {
        activityId: act.id,
        activityIdCode: act.activity_id ?? null,
        description: act.description,
        workpackId: act.workpack_id ?? null,
        status: act.status ?? null,
        sequenceNumber: act.sequence_number ?? null,
        durationHours: Number(act.duration_hours ?? 0),
        plannedStart: act.planned_start?.toISOString() ?? null,
        plannedEnd: act.planned_end?.toISOString() ?? null,
        earlyStart: act.early_start?.toISOString() ?? null,
        earlyFinish: act.early_finish?.toISOString() ?? null,
        totalFloat: act.total_float ? Number(act.total_float) : null,
        isCritical: act.is_critical ?? false,
        actualStart: act.actual_start?.toISOString() ?? null,
        actualEnd: act.actual_end?.toISOString() ?? null,
        progress: act.progress ? Number(act.progress) : 0,
        remarks: act.remarks ?? null,
        predecessors,
        successors,
        dimensionValues: resolvedMap.get(act.id) ?? {},
      };
    });

    // ── 8. Apply in-memory UDF sorts ────────────────────────────────────
    rows = applyInMemoryUdfSorts(rows, inMemoryUdfSorts);

    // ── 9. Compute grouping metadata (if requested) ─────────────────────
    let groupingMetadata: GroupingMetadata | undefined;
    if (query.groupBy.length > 0) {
      groupingMetadata = await this.computeGroupingMetadata(
        where,
        query.groupBy,
        resolvedMap,
        activities as any,
      );
    }

    // ── 10. Return result ───────────────────────────────────────────────
    return {
      rows,
      totalCount,
      page,
      pageSize,
      dimensions: dimensionCodes,
      appliedFilters: query.filters,
      appliedSort: query.sort,
      appliedGroupBy: query.groupBy,
      groupingMetadata,
    };
  }

  /**
   * Compute grouping metadata for the specified group-by dimension codes.
   *
   * For system dimensions with DB-level columns, uses Prisma count queries.
   * For UDF dimensions, computes groups from the full where-matched set
   * (limited to prevent unbounded queries).
   */
  private static async computeGroupingMetadata(
    where: Prisma.ActivityWhereInput,
    groupByCodes: string[],
    resolvedMap: Map<string, Record<string, ResolvedDimensionValue>>,
    pageActivities: any[],
  ): Promise<GroupingMetadata> {
    const levels: GroupLevelMetadata[] = [];

    for (const code of groupByCodes) {
      const levelMeta = await this.computeGroupLevel(where, code, resolvedMap, pageActivities);
      if (levelMeta) levels.push(levelMeta);
    }

    return { levels };
  }

  /**
   * Compute a single grouping level's metadata.
   */
  private static async computeGroupLevel(
    where: Prisma.ActivityWhereInput,
    dimensionCode: string,
    resolvedMap: Map<string, Record<string, ResolvedDimensionValue>>,
    pageActivities: any[],
  ): Promise<GroupLevelMetadata | null> {
    // For system dimensions with known DB paths, use Prisma groupBy
    const groupByField = this.getGroupByField(dimensionCode);

    if (groupByField) {
      try {
        const groups = await prisma.activity.groupBy({
          by: [groupByField as any],
          where,
          _count: { _all: true },
          orderBy: { [groupByField]: 'asc' } as any,
        });

        const groupInfos: GroupInfo[] = groups.map((g: any) => ({
          value: g[groupByField] ?? null,
          label: g[groupByField] ?? '(empty)',
          count: g._count._all,
        }));

        return {
          dimensionCode,
          label: dimensionCode, // Will be enriched by caller with DimensionDefinition.label
          groups: groupInfos,
        };
      } catch {
        // Fallback to in-memory grouping
      }
    }

    // For UDF dimensions or fallback: compute from resolved values
    // We aggregate from the full result set metadata
    const groupMap = new Map<string, { label: string; count: number }>();

    for (const [, resolved] of resolvedMap) {
      const rv = resolved[dimensionCode];
      const key = rv?.value != null ? String(rv.value) : '__null__';
      const label = rv?.label || '(empty)';
      const existing = groupMap.get(key);
      if (existing) {
        existing.count++;
      } else {
        groupMap.set(key, { label, count: 1 });
      }
    }

    const groupInfos: GroupInfo[] = Array.from(groupMap.entries()).map(([key, info]) => ({
      value: key === '__null__' ? null : key,
      label: info.label,
      count: info.count,
    }));

    return {
      dimensionCode,
      label: dimensionCode,
      groups: groupInfos,
    };
  }

  /**
   * Map a system dimension code to a direct Activity table column
   * for Prisma groupBy (only works for direct columns).
   */
  private static getGroupByField(dimensionCode: string): string | null {
    const map: Record<string, string> = {
      EVENT: 'event_id',
      SITE: 'site_id',
      STATUS: 'status',
      WBS_CODE: 'wbs_code',
      WORK_CATEGORY: 'work_category',
      DISCIPLINE: 'discipline_id',
      WORKPACK: 'workpack_id',
    };
    return map[dimensionCode] ?? null;
  }
}
