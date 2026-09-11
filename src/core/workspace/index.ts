/**
 * M12 V1 Phase 1 — Workspace Module Barrel Export
 *
 * Single import point for all workspace query services and types.
 *
 * Usage:
 *   import { WorkspaceQueryService, DimensionQueryBuilder } from '@/core/workspace';
 *   import type { WorkspaceQuery, WorkspaceQueryResult } from '@/core/workspace';
 */

// ── Services ──────────────────────────────────────────────────────────────────
export { WorkspaceQueryService } from './WorkspaceQueryService';
export { DimensionQueryBuilder } from './DimensionQueryBuilder';

// ── Layout Hydration ─────────────────────────────────────────────────────────
export {
  hydrateLayout,
  createDefaultLayout,
  migrateV1Layout,
} from './layoutHydration';

// ── Column Factory ───────────────────────────────────────────────────────────
export {
  dimensionToColumnConfig,
  dimensionsToColumnConfigs,
  mergeWithExistingColumns,
} from './columnFactory';

// ── Types ─────────────────────────────────────────────────────────────────────
export type {
  WorkspaceQuery,
  WorkspaceSort,
  HierarchyContext,
  WorkspaceQueryResult,
  WorkspaceRow,
  GroupingMetadata,
  GroupLevelMetadata,
  GroupInfo,
} from './types';

export {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  MIN_PAGE_SIZE,
  clampPageSize,
  createDefaultQuery,
} from './types';

// ── Layout Types ──────────────────────────────────────────────────────────────
export type {
  SavedLayoutColumn,
  SavedLayoutV2,
} from './layoutHydration';
