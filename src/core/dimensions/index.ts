/**
 * Platform Dimension Registry — Barrel Export
 *
 * Single import point for all dimension services and types.
 *
 * Usage:
 *   import { DimensionRegistry, DimensionResolver } from '@/core/dimensions';
 *   import type { DimensionDefinition, ResolvedDimensionValue } from '@/core/dimensions';
 */

// ── Services ──────────────────────────────────────────────────────────────────
export { DimensionRegistry } from './DimensionRegistry';
export { DimensionResolver } from './DimensionResolver';

// ── Catalog ───────────────────────────────────────────────────────────────────
export {
  SYSTEM_DIMENSIONS,
  SYSTEM_DIMENSION_CODES,
  getSystemDimension,
} from './SystemDimensionCatalog';

// ── Types ─────────────────────────────────────────────────────────────────────
export type {
  DimensionSource,
  DimensionDataType,
  DimensionDefinition,
  DimensionOption,
  ResolvedDimensionValue,
  DimensionFilterOperator,
  DimensionFilter,
  DimensionFilterGroup,
  ActivityWithRelations,
} from './types';
