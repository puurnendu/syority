/**
 * Platform Dimension Registry — Core Types
 *
 * These types define the unified dimension contract consumed by:
 *   Schedule | Look-ahead | Activity Grid | Gantt | Execution |
 *   Dashboard | Reports | Export | AI
 *
 * ARCHITECTURE:
 *   System dimensions (Plant, Unit, System, Discipline, Contractor, etc.)
 *   and tenant UDF dimensions expose the SAME DimensionDefinition contract.
 *   Consumers never need to know whether a dimension is canonical relational
 *   data or tenant-defined EAV.
 *
 * DOES NOT:
 *   - Calculate progress (M8.13 authority)
 *   - Calculate CPM/schedule (M11 authority)
 *   - Perform execution writes (M12 ExecutionWriteService authority)
 */

// ── Dimension Source ──────────────────────────────────────────────────────────

/** Where the dimension's canonical data lives */
export type DimensionSource =
  | 'ACTIVITY_FIELD'    // Direct column on Activity table
  | 'WORKPACK_FIELD'    // Column on Workpack (resolved via Activity → Workpack)
  | 'DIGITAL_PLANT'     // Canonical Digital Plant entity (Plant, Unit, System, Asset, etc.)
  | 'ACTIVITY_UDF'      // Tenant-defined UDF (ActivityUdfDefinition + ActivityUdfValue)
  | 'COMPUTED';         // Derived at query time (e.g., is_critical, duration_days)

// ── Dimension Data Type ──────────────────────────────────────────────────────

export type DimensionDataType =
  | 'text'
  | 'number'
  | 'date'
  | 'boolean'
  | 'dropdown'
  | 'hierarchy';

// ── Dimension Definition ─────────────────────────────────────────────────────

/**
 * The unified contract for every dimension — system or tenant-defined.
 *
 * Consumers (grids, filters, exports, dashboards, AI) receive a flat array
 * of DimensionDefinition and operate on them uniformly.
 */
export interface DimensionDefinition {
  /** Stable, unique code — used as column key, filter key, saved-layout key */
  code: string;

  /** Human-readable label for column header / filter UI */
  label: string;

  /** Data type for rendering and validation */
  dataType: DimensionDataType;

  /** Where the canonical data lives */
  source: DimensionSource;

  /** true = built-in system dimension; false = tenant UDF */
  systemDefined: boolean;

  /** Whether this dimension can be used as a filter */
  filterable: boolean;

  /** Whether this dimension can be sorted */
  sortable: boolean;

  /** Whether this dimension can be used as a grouping level */
  groupable: boolean;

  /** Whether this dimension appears in export */
  exportable: boolean;

  /** Whether this dimension supports bulk editing */
  bulkEditable: boolean;

  /** Display order for column chooser UI (lower = first) */
  displayOrder: number;

  /** Default column width in pixels */
  width: number;

  /** For dropdown dimensions: available options */
  options?: DimensionOption[];

  /**
   * Human-readable description of the resolution path.
   * E.g. "activity → workpack → unit.code"
   * Used for documentation and debugging, not for runtime resolution.
   */
  resolutionPath?: string;

  /** Optional JSON validation rules for tenant UDFs */
  validationRules?: string | null;

  /** For UDF dimensions: the original ActivityUdfDefinition.id */
  udfDefinitionId?: string;
}

// ── Dimension Option ─────────────────────────────────────────────────────────

export interface DimensionOption {
  value: string;
  label: string;
  sortOrder?: number;
}

// ── Resolved Dimension Value ─────────────────────────────────────────────────

/**
 * A single resolved value for one dimension on one activity.
 */
export interface ResolvedDimensionValue {
  /** The dimension code */
  dimensionCode: string;

  /** The raw value (ID or primitive) */
  value: string | number | boolean | null;

  /** The display label (e.g., "Unit-101" instead of UUID) */
  label: string;
}

// ── Dimension Filter ─────────────────────────────────────────────────────────

export type DimensionFilterOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'starts_with'
  | 'ends_with'
  | 'greater_than'
  | 'less_than'
  | 'between'
  | 'in'
  | 'is_empty'
  | 'is_not_empty'
  | 'before'
  | 'after'
  | 'is_true'
  | 'is_false';

/**
 * A filter condition referencing a dimension by its stable code.
 */
export interface DimensionFilter {
  dimensionCode: string;
  operator: DimensionFilterOperator;
  value: unknown;
}

/**
 * A composite filter group with AND/OR logic.
 */
export interface DimensionFilterGroup {
  operator: 'AND' | 'OR';
  conditions: (DimensionFilter | DimensionFilterGroup)[];
}

// ── Activity with Relations (for DimensionResolver input) ────────────────────

/**
 * The shape of an Activity record with all relations pre-loaded
 * for bulk dimension resolution. This is the expected input to
 * DimensionResolver.resolveForActivities().
 *
 * Each field is typed as optional because resolution gracefully
 * handles missing relations (returns null value + empty label).
 */
export interface ActivityWithRelations {
  id: string;
  activity_id: string | null;
  description: string;
  status: string | null;
  wbs_code: string | null;
  work_category: string | null;
  event_id: string | null;
  site_id: string;
  workpack_id: string | null;
  discipline?: { id: string; code: string; name: string } | null;
  workpack?: {
    id: string;
    workpack_number: string | null;
    title: string;
    priority: string | null;
    plant_id: string | null;
    unit_id: string | null;
    system_id: string | null;
    asset_id: string | null;
    contractor_id: string | null;
    discipline_id: string | null;
    plant?: { id: string; code: string | null; name: string } | null;
    unit?: { id: string; code: string | null; name: string; area?: { id: string; code: string | null; name: string } | null } | null;
    system?: { id: string; code: string | null; name: string } | null;
    asset?: {
      id: string;
      tag_number: string;
      name: string;
      asset_type: string | null;
      criticality: string | null;
      equipment_type_rel?: { id: string; name: string; code: string | null } | null;
    } | null;
    contractor?: { id: string; code: string | null; name: string } | null;
  } | null;
  udf_values?: Array<{
    udf_definition: { code: string; type: string };
    value_string: string | null;
    value_number: any;
    value_boolean: boolean | null;
    value_date: Date | null;
    udf_option_id: string | null;
  }>;
}
