/**
 * M12 V1 Phase 1 — DimensionQueryBuilder
 *
 * THE SINGLE GATEWAY from dimension codes to Prisma predicates.
 *
 * Translates registered DimensionRegistry codes into safe, tenant-scoped
 * Prisma `where` and `orderBy` clauses. No raw dimension code → Prisma
 * field injection is allowed — every code is validated against the
 * DimensionRegistry and mapped through a whitelisted predicate map.
 *
 * SECURITY:
 *   - All queries are scoped to organization_id and deleted_at: null
 *   - Dimension codes are validated against DimensionRegistry before use
 *   - UDF dimension codes resolve through the EAV pattern (ActivityUdfValue)
 *   - Arbitrary field names are never passed to Prisma
 *
 * AUTHORITY BOUNDARIES:
 *   - Does NOT calculate progress (M8.13 authority)
 *   - Does NOT calculate CPM/schedule (M11 authority)
 *   - Does NOT perform execution writes (M12 ExecutionWriteService authority)
 */

import type { Prisma } from '@prisma/client';
import type { DimensionFilter, DimensionFilterGroup, DimensionFilterOperator } from '@/core/dimensions';
import { SYSTEM_DIMENSION_CODES } from '@/core/dimensions';
import type { WorkspaceSort, HierarchyContext } from './types';

// ── Filter Operator → Prisma Predicate Mapping ──────────────────────────────

type PrismaStringFilter = Prisma.StringNullableFilter<'Activity'>;

/**
 * Convert a DimensionFilterOperator + value into a Prisma scalar predicate.
 * Returns a Prisma filter object for string/number/boolean/date comparisons.
 */
function buildScalarPredicate(
  operator: DimensionFilterOperator,
  value: unknown,
): Record<string, unknown> {
  switch (operator) {
    case 'equals':
      return { equals: value };
    case 'not_equals':
      return { not: value };
    case 'contains':
      return { contains: String(value), mode: 'insensitive' };
    case 'starts_with':
      return { startsWith: String(value), mode: 'insensitive' };
    case 'ends_with':
      return { endsWith: String(value), mode: 'insensitive' };
    case 'greater_than':
      return { gt: value };
    case 'less_than':
      return { lt: value };
    case 'between': {
      const [min, max] = Array.isArray(value) ? value : [null, null];
      return { gte: min, lte: max };
    }
    case 'in':
      return { in: Array.isArray(value) ? value : [value] };
    case 'is_empty':
      return { equals: null };
    case 'is_not_empty':
      return { not: null };
    case 'before':
      return { lt: value };
    case 'after':
      return { gt: value };
    case 'is_true':
      return { equals: true };
    case 'is_false':
      return { equals: false };
    default:
      return { equals: value };
  }
}

// ── System Dimension → Prisma Where Builders ────────────────────────────────

/**
 * Whitelist map of system dimension codes to Prisma WHERE clause builders.
 *
 * Each builder takes a scalar Prisma predicate (from buildScalarPredicate)
 * and returns a Prisma.ActivityWhereInput that applies that predicate
 * to the correct canonical relational path.
 *
 * IMPORTANT: This map is the ONLY place where dimension codes are connected
 * to database schema paths. Adding a new system dimension requires adding
 * an entry here.
 */
const SYSTEM_DIMENSION_WHERE_MAP: Record<
  string,
  (predicate: Record<string, unknown>) => Prisma.ActivityWhereInput
> = {
  // ── Activity-level fields (direct columns) ──────────────────────────────
  EVENT: (p) => ({ event_id: p as any }),
  SITE: (p) => ({ site_id: p as any }),
  STATUS: (p) => ({ status: p as any }),
  WBS_CODE: (p) => ({ wbs_code: p as any }),
  WORK_CATEGORY: (p) => ({ work_category: p as any }),
  DISCIPLINE: (p) => ({ discipline_id: p as any }),

  // ── Workpack-level fields (one hop: Activity → Workpack) ────────────────
  WORKPACK: (p) => ({ workpack_id: p as any }),
  CONTRACTOR: (p) => ({ workpack: { contractor_id: p as any } }),
  PRIORITY: (p) => ({ workpack: { priority: p as any } }),

  // ── Digital Plant fields (two hops: Activity → Workpack → Entity) ───────
  PLANT: (p) => ({ workpack: { plant_id: p as any } }),
  AREA: (p) => ({ workpack: { unit: { area: { id: p as any } } } }),
  UNIT: (p) => ({ workpack: { unit_id: p as any } }),
  SYSTEM: (p) => ({ workpack: { system_id: p as any } }),
  EQUIPMENT: (p) => ({ workpack: { asset_id: p as any } }),
  EQUIPMENT_TYPE: (p) => ({ workpack: { asset: { asset_type: p as any } } }),
  CRITICALITY: (p) => ({ workpack: { asset: { criticality: p as any } } }),
};

// ── System Dimension → Prisma OrderBy Builders ──────────────────────────────

/**
 * Whitelist map of system dimension codes to Prisma ORDER BY clause builders.
 *
 * NOTE: For 2-hop relational sorts (e.g., UNIT), Prisma generates
 * efficient JOINs — no N+1.
 */
const SYSTEM_DIMENSION_ORDERBY_MAP: Record<
  string,
  (dir: 'asc' | 'desc') => Prisma.ActivityOrderByWithRelationInput
> = {
  // Activity-level
  EVENT: (dir) => ({ event_id: dir }),
  SITE: (dir) => ({ site_id: dir }),
  STATUS: (dir) => ({ status: dir }),
  WBS_CODE: (dir) => ({ wbs_code: dir }),
  WORK_CATEGORY: (dir) => ({ work_category: dir }),
  DISCIPLINE: (dir) => ({ discipline: { code: dir } }),

  // Workpack-level
  WORKPACK: (dir) => ({ workpack: { workpack_number: dir } }),
  CONTRACTOR: (dir) => ({ workpack: { contractor: { name: dir } } }),
  PRIORITY: (dir) => ({ workpack: { priority: dir } }),

  // Digital Plant
  PLANT: (dir) => ({ workpack: { plant: { name: dir } } }),
  UNIT: (dir) => ({ workpack: { unit: { code: dir } } }),
  SYSTEM: (dir) => ({ workpack: { system: { code: dir } } }),
  EQUIPMENT: (dir) => ({ workpack: { asset: { tag_number: dir } } }),
  EQUIPMENT_TYPE: (dir) => ({ workpack: { asset: { asset_type: dir } } }),
  CRITICALITY: (dir) => ({ workpack: { asset: { criticality: dir } } }),
  // AREA sort requires nested unit → area, which Prisma supports:
  AREA: (dir) => ({ workpack: { unit: { area: { name: dir } } } }),
};

// ── UDF Filter Builder ──────────────────────────────────────────────────────

/**
 * Build a Prisma WHERE clause for a UDF dimension filter.
 *
 * UDF dimensions are stored in the ActivityUdfValue EAV table.
 * The filter matches activities that have a udf_value row where:
 *   1. The udf_definition.code matches the UDF code (without 'UDF_' prefix)
 *   2. The appropriate value column matches the predicate
 *
 * For text/dropdown UDFs → value_string
 * For number UDFs → value_number
 * For boolean UDFs → value_boolean
 * For date UDFs → value_date
 *
 * NOTE: is_empty/is_not_empty operators need special handling for UDFs
 * because the row may not exist at all (not just have a null value).
 */
function buildUdfWhere(
  udfCode: string,
  operator: DimensionFilterOperator,
  value: unknown,
): Prisma.ActivityWhereInput {
  const predicate = buildScalarPredicate(operator, value);

  // Special case: "is_empty" means the UDF row doesn't exist OR value is null
  if (operator === 'is_empty') {
    return {
      OR: [
        {
          udf_values: {
            none: {
              udf_definition: { code: udfCode },
            },
          },
        },
        {
          udf_values: {
            some: {
              udf_definition: { code: udfCode },
              value_string: null,
              value_number: null,
              value_boolean: null,
              value_date: null,
            },
          },
        },
      ],
    };
  }

  // Special case: "is_not_empty" means the UDF row exists AND at least one value is non-null
  if (operator === 'is_not_empty') {
    return {
      udf_values: {
        some: {
          udf_definition: { code: udfCode },
          OR: [
            { value_string: { not: null } },
            { value_number: { not: null } },
            { value_boolean: { not: null } },
            { value_date: { not: null } },
          ],
        },
      },
    };
  }

  // For boolean operators
  if (operator === 'is_true' || operator === 'is_false') {
    return {
      udf_values: {
        some: {
          udf_definition: { code: udfCode },
          value_boolean: predicate as any,
        },
      },
    };
  }

  // For date operators
  if (operator === 'before' || operator === 'after') {
    return {
      udf_values: {
        some: {
          udf_definition: { code: udfCode },
          value_date: predicate as any,
        },
      },
    };
  }

  // For numeric operators
  if (operator === 'greater_than' || operator === 'less_than' || operator === 'between') {
    return {
      udf_values: {
        some: {
          udf_definition: { code: udfCode },
          value_number: predicate as any,
        },
      },
    };
  }

  // Default: text-based matching (value_string)
  return {
    udf_values: {
      some: {
        udf_definition: { code: udfCode },
        value_string: predicate as any,
      },
    },
  };
}

// ── DimensionQueryBuilder ────────────────────────────────────────────────────

export class DimensionQueryBuilder {
  /**
   * Build a complete Prisma WHERE clause from a WorkspaceQuery.
   *
   * Combines:
   *   1. Mandatory scoping (organization_id, event_id, deleted_at)
   *   2. Dimension filters (from DimensionFilter conditions)
   *   3. Filter groups (from DimensionFilterGroup with AND/OR)
   *   4. Hierarchy context (from tree selection)
   *   5. Text search (from search string)
   *
   * All dimension codes are validated against the whitelist.
   * Unknown codes are silently skipped (graceful degradation).
   */
  static buildWhereClause(params: {
    organizationId: string;
    eventId: string;
    filters: DimensionFilter[];
    filterGroups: DimensionFilterGroup[];
    hierarchyContext?: HierarchyContext;
    search?: string;
  }): Prisma.ActivityWhereInput {
    const conditions: Prisma.ActivityWhereInput[] = [];

    // 1. Mandatory scoping
    const base: Prisma.ActivityWhereInput = {
      organization_id: params.organizationId,
      event_id: params.eventId,
      deleted_at: null,
    };

    // 2. Individual dimension filters
    for (const filter of params.filters) {
      const where = this.buildDimensionFilterWhere(filter);
      if (where) conditions.push(where);
    }

    // 3. Filter groups
    for (const group of params.filterGroups) {
      const where = this.buildFilterGroupWhere(group);
      if (where) conditions.push(where);
    }

    // 4. Hierarchy context
    if (params.hierarchyContext) {
      const hierarchyWhere = this.buildHierarchyWhere(params.hierarchyContext);
      if (Object.keys(hierarchyWhere).length > 0) {
        conditions.push(hierarchyWhere);
      }
    }

    // 5. Text search
    if (params.search && params.search.trim().length > 0) {
      const searchTerm = params.search.trim();
      conditions.push({
        OR: [
          { activity_id: { contains: searchTerm, mode: 'insensitive' } },
          { description: { contains: searchTerm, mode: 'insensitive' } },
          { wbs_code: { contains: searchTerm, mode: 'insensitive' } },
        ],
      });
    }

    // Combine: base AND all conditions
    if (conditions.length === 0) {
      return base;
    }

    return {
      AND: [base, ...conditions],
    };
  }

  /**
   * Build a Prisma WHERE clause for a single DimensionFilter.
   * Returns null for unknown/unsupported dimension codes.
   */
  static buildDimensionFilterWhere(
    filter: DimensionFilter,
  ): Prisma.ActivityWhereInput | null {
    const { dimensionCode, operator, value } = filter;

    // System dimension
    if (SYSTEM_DIMENSION_CODES.has(dimensionCode)) {
      const builder = SYSTEM_DIMENSION_WHERE_MAP[dimensionCode];
      if (!builder) return null; // Dimension exists but has no filter path
      const predicate = buildScalarPredicate(operator, value);
      return builder(predicate);
    }

    // UDF dimension
    if (dimensionCode.startsWith('UDF_')) {
      const udfCode = dimensionCode.slice(4);
      return buildUdfWhere(udfCode, operator, value);
    }

    // Unknown code — silently skip
    return null;
  }

  /**
   * Build a Prisma WHERE clause for a DimensionFilterGroup (recursive).
   */
  static buildFilterGroupWhere(
    group: DimensionFilterGroup,
  ): Prisma.ActivityWhereInput | null {
    const clauses: Prisma.ActivityWhereInput[] = [];

    for (const condition of group.conditions) {
      if ('dimensionCode' in condition) {
        // It's a DimensionFilter
        const where = this.buildDimensionFilterWhere(condition);
        if (where) clauses.push(where);
      } else {
        // It's a nested DimensionFilterGroup
        const where = this.buildFilterGroupWhere(condition);
        if (where) clauses.push(where);
      }
    }

    if (clauses.length === 0) return null;

    if (group.operator === 'AND') {
      return { AND: clauses };
    } else {
      return { OR: clauses };
    }
  }

  /**
   * Build a Prisma WHERE clause from a HierarchyContext.
   *
   * Maps tree node selections to canonical relational paths:
   *   workpackId → Activity.workpack_id
   *   assetId    → Activity → Workpack.asset_id
   *   systemId   → Activity → Workpack.system_id
   *   unitId     → Activity → Workpack.unit_id
   *   areaId     → Activity → Workpack → Unit.area_id (if area model exists)
   *   plantId    → Activity → Workpack.plant_id
   *
   * Only the most specific filter is applied (workpackId > assetId > systemId > ...)
   */
  static buildHierarchyWhere(ctx: HierarchyContext): Prisma.ActivityWhereInput {
    // Most specific takes precedence
    if (ctx.workpackId) {
      return { workpack_id: ctx.workpackId };
    }
    if (ctx.assetId) {
      return { workpack: { asset_id: ctx.assetId } };
    }
    if (ctx.systemId) {
      return { workpack: { system_id: ctx.systemId } };
    }
    if (ctx.unitId) {
      return { workpack: { unit_id: ctx.unitId } };
    }
    if (ctx.areaId) {
      // Area is on Unit, so we filter through unit → area
      return { workpack: { unit: { area: { id: ctx.areaId } } } };
    }
    if (ctx.plantId) {
      return { workpack: { plant_id: ctx.plantId } };
    }

    return {};
  }

  /**
   * Build a Prisma ORDER BY clause from WorkspaceSort specifications.
   *
   * System dimensions are mapped through the whitelist.
   * UDF dimensions cannot be sorted at DB level (EAV limitation) —
   * they are sorted in-memory on the bounded page (Phase 1 hybrid approach).
   *
   * @returns An array of Prisma orderBy objects, plus a list of UDF sort
   *          codes that must be applied in-memory on the result page.
   */
  static buildOrderByClause(sort: WorkspaceSort[]): {
    prismaOrderBy: Prisma.ActivityOrderByWithRelationInput[];
    inMemoryUdfSorts: WorkspaceSort[];
  } {
    const prismaOrderBy: Prisma.ActivityOrderByWithRelationInput[] = [];
    const inMemoryUdfSorts: WorkspaceSort[] = [];

    for (const s of sort) {
      // System dimension
      if (SYSTEM_DIMENSION_CODES.has(s.dimensionCode)) {
        const builder = SYSTEM_DIMENSION_ORDERBY_MAP[s.dimensionCode];
        if (builder) {
          prismaOrderBy.push(builder(s.direction));
        }
        continue;
      }

      // UDF dimension — cannot sort at DB level, defer to in-memory
      if (s.dimensionCode.startsWith('UDF_')) {
        inMemoryUdfSorts.push(s);
        continue;
      }

      // Unknown code — silently skip
    }

    // Always add a stable tiebreaker sort to ensure deterministic pagination
    prismaOrderBy.push({ workpack_id: 'asc' });
    prismaOrderBy.push({ sequence_number: 'asc' });

    return { prismaOrderBy, inMemoryUdfSorts };
  }

  /**
   * Validate dimension codes against the whitelist.
   *
   * @returns List of invalid/unsupported codes (empty = all valid)
   */
  static validateFilterCodes(codes: string[]): string[] {
    return codes.filter(
      (code) => !SYSTEM_DIMENSION_CODES.has(code) && !code.startsWith('UDF_'),
    );
  }

  /**
   * Validate sort codes against the whitelist.
   * Checks both code existence AND sortability.
   *
   * @returns List of invalid/non-sortable codes
   */
  static validateSortCodes(
    sorts: WorkspaceSort[],
    dimensionMap: Map<string, { sortable: boolean }>,
  ): string[] {
    return sorts
      .filter((s) => {
        const def = dimensionMap.get(s.dimensionCode);
        // Invalid if: no definition found OR not sortable
        return !def || !def.sortable;
      })
      .map((s) => s.dimensionCode);
  }

  /**
   * Validate group-by codes.
   * Checks both code existence AND groupability.
   *
   * @returns List of invalid/non-groupable codes
   */
  static validateGroupByCodes(
    codes: string[],
    dimensionMap: Map<string, { groupable: boolean }>,
  ): string[] {
    return codes.filter((code) => {
      const def = dimensionMap.get(code);
      return !def || !def.groupable;
    });
  }
}
