/**
 * M12 V1 Phase 1 — Layout Hydration
 *
 * Utilities for migrating saved workspace layouts to dimension-code-based
 * persistence, and hydrating them back from stored form.
 *
 * A saved layout stores dimension codes (stable identifiers) rather than
 * column indices or UI positions. When hydrating:
 *   1. Each code is validated against the current DimensionRegistry
 *   2. Deactivated/deleted UDF dimension codes are silently dropped
 *   3. Column order from the saved layout is preserved
 *   4. Newly-added dimensions are appended at the end (not visible by default)
 *
 * AUTHORITY BOUNDARIES:
 *   - Does NOT calculate progress (M8.13 authority)
 *   - Does NOT calculate CPM/schedule (M11 authority)
 *   - Does NOT perform execution writes (M12 ExecutionWriteService authority)
 */

import type { DimensionDefinition } from '@/core/dimensions';

// ── Saved Layout Column ──────────────────────────────────────────────────────

/**
 * A serializable column configuration persisted in saved layouts.
 *
 * Uses dimension codes for stability across schema migrations and
 * UDF lifecycle changes.
 */
export interface SavedLayoutColumn {
  /** Stable dimension code from DimensionRegistry */
  dimensionCode: string;

  /** User-customized label (falls back to DimensionDefinition.label) */
  label?: string;

  /** Column width in pixels */
  width: number;

  /** Whether the column is visible */
  visible: boolean;

  /** Whether the column is frozen (pinned left) */
  frozen: boolean;
}

/**
 * A serializable saved layout configuration.
 */
export interface SavedLayoutV2 {
  /** Layout version (for forward-compatible migration) */
  version: 2;

  /** Layout name */
  name: string;

  /** Columns with dimension codes */
  columns: SavedLayoutColumn[];

  /** Sort specification */
  sort: Array<{ dimensionCode: string; direction: 'asc' | 'desc' }>;

  /** Group-by dimension codes */
  groupBy: string[];

  /** Scope */
  scope: 'personal' | 'organization' | 'predefined';
}

// ── Hydration ────────────────────────────────────────────────────────────────

/**
 * Hydrate a saved layout against the current DimensionRegistry.
 *
 * This function:
 *   1. Validates each saved column's dimensionCode against available dimensions
 *   2. Silently drops columns whose dimensions no longer exist (UDF deleted/deactivated)
 *   3. Preserves column order from the saved layout
 *   4. Appends newly-added dimensions at the end (visible: false)
 *   5. Merges saved width/visibility overrides with dimension defaults
 *
 * @param savedLayout - The serialized saved layout
 * @param availableDimensions - Current dimension definitions from DimensionRegistry
 * @returns Hydrated column configs ready for the workspace grid
 */
export function hydrateLayout(
  savedLayout: SavedLayoutV2,
  availableDimensions: DimensionDefinition[],
): {
  columns: SavedLayoutColumn[];
  droppedCodes: string[];
  newCodes: string[];
} {
  const dimMap = new Map<string, DimensionDefinition>();
  for (const dim of availableDimensions) {
    dimMap.set(dim.code, dim);
  }

  const hydratedColumns: SavedLayoutColumn[] = [];
  const droppedCodes: string[] = [];
  const usedCodes = new Set<string>();

  // Pass 1: Process saved columns in order
  for (const col of savedLayout.columns) {
    const dim = dimMap.get(col.dimensionCode);
    if (!dim) {
      // Dimension no longer exists — silently drop
      droppedCodes.push(col.dimensionCode);
      continue;
    }

    usedCodes.add(col.dimensionCode);
    hydratedColumns.push({
      dimensionCode: col.dimensionCode,
      label: col.label ?? dim.label,
      width: col.width > 0 ? col.width : dim.width,
      visible: col.visible,
      frozen: col.frozen,
    });
  }

  // Pass 2: Append newly-added dimensions (not in saved layout)
  const newCodes: string[] = [];
  for (const dim of availableDimensions) {
    if (!usedCodes.has(dim.code)) {
      newCodes.push(dim.code);
      hydratedColumns.push({
        dimensionCode: dim.code,
        label: dim.label,
        width: dim.width,
        visible: false, // Not visible by default — user must opt in
        frozen: false,
      });
    }
  }

  return { columns: hydratedColumns, droppedCodes, newCodes };
}

/**
 * Create a default layout from dimension definitions.
 *
 * Uses the display order and default widths from the registry.
 * System dimensions are visible by default; UDF dimensions are hidden.
 */
export function createDefaultLayout(
  dimensions: DimensionDefinition[],
  name: string = 'Default',
): SavedLayoutV2 {
  const columns: SavedLayoutColumn[] = dimensions.map((dim) => ({
    dimensionCode: dim.code,
    label: dim.label,
    width: dim.width,
    visible: dim.systemDefined, // System dims visible, UDFs hidden by default
    frozen: false,
  }));

  return {
    version: 2,
    name,
    columns,
    sort: [],
    groupBy: [],
    scope: 'personal',
  };
}

/**
 * Migrate a v1 layout (using field keys) to v2 (using dimension codes).
 *
 * Attempts to map old field-based column keys to dimension codes.
 * Unrecognized keys are dropped.
 */
export function migrateV1Layout(
  v1Columns: Array<{
    key: string;
    label: string;
    width: number;
    visible: boolean;
    frozen: boolean;
    isUdf?: boolean;
    udfCode?: string;
  }>,
): SavedLayoutColumn[] {
  // Map of old column keys → dimension codes
  const keyToDimCode: Record<string, string> = {
    activity_id: 'EVENT',
    description: 'STATUS', // Best guess — description isn't a dimension
    wbs_code: 'WBS_CODE',
    work_category: 'WORK_CATEGORY',
    discipline_code: 'DISCIPLINE',
    discipline_name: 'DISCIPLINE',
    status: 'STATUS',
    unit_code: 'UNIT',
    system_code: 'SYSTEM',
    equipment_tag: 'EQUIPMENT',
    contractor_name: 'CONTRACTOR',
    priority: 'PRIORITY',
    criticality: 'CRITICALITY',
    plant: 'PLANT',
    area: 'AREA',
    workpack: 'WORKPACK',
    equipment_type: 'EQUIPMENT_TYPE',
  };

  const migrated: SavedLayoutColumn[] = [];

  for (const col of v1Columns) {
    // UDF columns
    if (col.isUdf && col.udfCode) {
      migrated.push({
        dimensionCode: `UDF_${col.udfCode}`,
        label: col.label,
        width: col.width,
        visible: col.visible,
        frozen: col.frozen,
      });
      continue;
    }

    // System columns
    const dimCode = keyToDimCode[col.key];
    if (dimCode) {
      migrated.push({
        dimensionCode: dimCode,
        label: col.label,
        width: col.width,
        visible: col.visible,
        frozen: col.frozen,
      });
    }
    // Unknown keys are silently dropped
  }

  return migrated;
}
