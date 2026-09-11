/**
 * M12 V1 Phase 1 — Workspace Query Types
 *
 * Platform-level workspace query contract consumed by:
 *   Activity Grid | Export | AI | Reports | Dashboard
 *
 * ARCHITECTURE:
 *   WorkspaceQuery → DimensionQueryBuilder → Prisma WHERE/ORDER
 *   WorkspaceQueryResult ← DimensionResolver → ResolvedDimensionValue
 *
 * AUTHORITY BOUNDARIES:
 *   - This module does NOT calculate progress (M8.13 authority)
 *   - This module does NOT calculate CPM/schedule (M11 authority)
 *   - This module does NOT perform execution writes (M12 ExecutionWriteService authority)
 *   - Schedule fields (planned_start, planned_end, duration) are READ-ONLY projections
 */

import type {
  DimensionFilter,
  DimensionFilterGroup,
  ResolvedDimensionValue,
} from '@/core/dimensions';

// ── Workspace Query ──────────────────────────────────────────────────────────

/**
 * The canonical input for all workspace data queries.
 *
 * Consumers build a WorkspaceQuery and submit it to WorkspaceQueryService.
 * All filtering, sorting, and grouping is expressed in terms of
 * DimensionRegistry codes — never raw DB column names.
 */
export interface WorkspaceQuery {
  /** Tenant scope — always required */
  organizationId: string;

  /** Event scope — always required (workspace operates within an event) */
  eventId: string;

  /** Dimension-based filter conditions */
  filters: DimensionFilter[];

  /** Composite filter groups with AND/OR logic */
  filterGroups: DimensionFilterGroup[];

  /** Sort specification — ordered by precedence */
  sort: WorkspaceSort[];

  /** Grouping levels — dimension codes */
  groupBy: string[];

  /** Page number (1-based) */
  page: number;

  /** Page size (max rows per page) */
  pageSize: number;

  /** Full-text search across activity_id + description */
  search?: string;

  /** Hierarchy context from tree selection (filters down to a subtree) */
  hierarchyContext?: HierarchyContext;

  /**
   * Requested dimension codes for value resolution on result rows.
   * Only these dimensions will be resolved (performance: no unnecessary work).
   * If empty, no dimension values are resolved (base fields only).
   */
  dimensions: string[];
}

// ── Sort ─────────────────────────────────────────────────────────────────────

export interface WorkspaceSort {
  /** Dimension code from DimensionRegistry */
  dimensionCode: string;

  /** Sort direction */
  direction: 'asc' | 'desc';
}

// ── Hierarchy Context ────────────────────────────────────────────────────────

/**
 * Hierarchy context from tree selection.
 *
 * Maps directly from HierarchyTreePanel node selection.
 * DimensionQueryBuilder translates this into Prisma WHERE clauses
 * using canonical relational paths (Activity → Workpack → Unit, etc.).
 */
export interface HierarchyContext {
  plantId?: string;
  areaId?: string;
  unitId?: string;
  systemId?: string;
  assetId?: string;
  workpackId?: string;
}

// ── Query Result ─────────────────────────────────────────────────────────────

/**
 * The canonical output from WorkspaceQueryService.execute().
 *
 * Contains a bounded page of resolved workspace rows plus metadata
 * about pagination, applied filters, and optional grouping.
 */
export interface WorkspaceQueryResult {
  /** Resolved activity rows for the current page */
  rows: WorkspaceRow[];

  /** Total count of activities matching the query (for pagination) */
  totalCount: number;

  /** Current page (1-based) */
  page: number;

  /** Page size used */
  pageSize: number;

  /** Dimension codes that were resolved on each row */
  dimensions: string[];

  /** Echo of the applied filters (for UI state reconciliation) */
  appliedFilters: DimensionFilter[];

  /** Echo of the applied sort (for UI state reconciliation) */
  appliedSort: WorkspaceSort[];

  /** Echo of the applied groupBy (for UI state reconciliation) */
  appliedGroupBy: string[];

  /** Grouping metadata (present when groupBy is non-empty) */
  groupingMetadata?: GroupingMetadata;
}

// ── Workspace Row ────────────────────────────────────────────────────────────

/**
 * A single activity row in the workspace result set.
 *
 * Base fields are always returned (identity + schedule).
 * Dimension values are keyed by dimension code and only populated
 * for the codes requested in WorkspaceQuery.dimensions.
 */
export interface WorkspaceRow {
  /** Internal UUID (primary key) */
  activityId: string;

  // ── Base Fields (always returned) ──────────────────────────────────────

  /** Human-readable activity ID (e.g., "A0010") */
  activityIdCode: string | null;

  /** Activity description */
  description: string;

  /** Parent workpack UUID */
  workpackId: string | null;

  /** Activity status */
  status: string | null;

  /** Sequence number within workpack */
  sequenceNumber: number | null;

  // ── Schedule Fields (read-only, from M11 authority) ────────────────────

  /** Duration in hours */
  durationHours: number;

  /** Planned start date (ISO string) */
  plannedStart: string | null;

  /** Planned end date (ISO string) */
  plannedEnd: string | null;

  /** Early start date (ISO string) */
  earlyStart: string | null;

  /** Early finish date (ISO string) */
  earlyFinish: string | null;

  /** Total float in hours */
  totalFloat: number | null;

  /** Whether this activity is on the critical path */
  isCritical: boolean;

  // ── Execution Fields (from M12 / M8.13) ────────────────────────────────

  /** Actual start date (ISO string) */
  actualStart: string | null;

  /** Actual end date (ISO string) */
  actualEnd: string | null;

  /** Physical progress (0-100) */
  progress: number;

  /** Execution remarks */
  remarks: string | null;

  // ── Relationships ──────────────────────────────────────────────────────

  /** Predecessor display strings (e.g., ["A0010FS", "A0020SS+1d"]) */
  predecessors: string[];

  /** Successor display strings */
  successors: string[];

  // ── Dimension Values ───────────────────────────────────────────────────

  /**
   * Resolved dimension values keyed by dimension code.
   * Only populated for codes listed in WorkspaceQuery.dimensions.
   */
  dimensionValues: Record<string, ResolvedDimensionValue>;
}

// ── Grouping Metadata ────────────────────────────────────────────────────────

/**
 * Server-computed grouping metadata.
 *
 * Provides counts per group value for each grouping level.
 * The actual rows are still returned flat — visual nesting is Phase 2.
 */
export interface GroupingMetadata {
  /** One entry per groupBy dimension code */
  levels: GroupLevelMetadata[];
}

export interface GroupLevelMetadata {
  /** Dimension code used for grouping */
  dimensionCode: string;

  /** Human-readable label of the dimension */
  label: string;

  /** Groups with counts */
  groups: GroupInfo[];
}

export interface GroupInfo {
  /** The raw group value (may be null for activities with no value) */
  value: string | null;

  /** Human-readable label for the group */
  label: string;

  /** Number of activities in this group */
  count: number;
}

// ── Query Defaults ───────────────────────────────────────────────────────────

/** Default page size for workspace queries */
export const DEFAULT_PAGE_SIZE = 200;

/** Maximum allowed page size (prevents unbounded queries) */
export const MAX_PAGE_SIZE = 2000;

/** Minimum page size */
export const MIN_PAGE_SIZE = 10;

/**
 * Clamp page size to valid range.
 */
export function clampPageSize(size: number): number {
  return Math.max(MIN_PAGE_SIZE, Math.min(MAX_PAGE_SIZE, Math.floor(size)));
}

/**
 * Create a default (empty) WorkspaceQuery for an event.
 */
export function createDefaultQuery(
  organizationId: string,
  eventId: string,
): WorkspaceQuery {
  return {
    organizationId,
    eventId,
    filters: [],
    filterGroups: [],
    sort: [],
    groupBy: [],
    page: 1,
    pageSize: DEFAULT_PAGE_SIZE,
    dimensions: [],
  };
}
