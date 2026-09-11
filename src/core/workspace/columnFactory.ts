/**
 * M12 V1 Phase 1 — Column Factory
 *
 * Converts DimensionDefinition[] from the DimensionRegistry into
 * ColumnConfig[] consumed by the workspace grid (useWorkspaceStore).
 *
 * This is the bridge between the platform-level dimension contract
 * and the UI-level column configuration.
 *
 * AUTHORITY BOUNDARIES:
 *   - Does NOT calculate progress (M8.13 authority)
 *   - Does NOT calculate CPM/schedule (M11 authority)
 *   - Does NOT perform execution writes (M12 ExecutionWriteService authority)
 */

import type { DimensionDefinition } from '@/core/dimensions';
import type { ColumnConfig } from '@/stores/useWorkspaceStore';

/**
 * Convert a DimensionDefinition into a ColumnConfig.
 *
 * Maps:
 *   DimensionDefinition.code → ColumnConfig.key AND ColumnConfig.dimensionCode
 *   DimensionDefinition.label → ColumnConfig.label
 *   DimensionDefinition.width → ColumnConfig.width
 *   DimensionDefinition.source === 'ACTIVITY_UDF' → ColumnConfig.isUdf = true
 *   DimensionDefinition.bulkEditable → ColumnConfig.isContractorEditable (partial)
 *
 * System dimensions are visible by default; UDF dimensions are hidden.
 */
export function dimensionToColumnConfig(
  dim: DimensionDefinition,
  overrides?: Partial<ColumnConfig>,
): ColumnConfig {
  const isUdf = dim.source === 'ACTIVITY_UDF';

  return {
    key: dim.code,
    label: dim.label,
    width: dim.width,
    visible: overrides?.visible ?? dim.systemDefined,
    frozen: overrides?.frozen ?? false,
    dimensionCode: dim.code,
    isUdf,
    udfCode: isUdf ? dim.code.slice(4) : undefined, // Remove 'UDF_' prefix
    udfType: isUdf ? dim.dataType : undefined,
    isContractorEditable: overrides?.isContractorEditable ?? false,
    isLocked: overrides?.isLocked ?? false,
  };
}

/**
 * Convert an array of DimensionDefinitions into ColumnConfig[].
 *
 * Preserves the display order from the dimension definitions.
 * System dimensions are visible; UDF dimensions are hidden by default.
 */
export function dimensionsToColumnConfigs(
  dimensions: DimensionDefinition[],
  overrides?: Map<string, Partial<ColumnConfig>>,
): ColumnConfig[] {
  return dimensions.map((dim) =>
    dimensionToColumnConfig(dim, overrides?.get(dim.code)),
  );
}

/**
 * Merge dimension-generated columns with existing ColumnConfig[],
 * preserving user customizations (width, visibility, order).
 *
 * Algorithm:
 *   1. Build a map of existing columns by dimensionCode (or key)
 *   2. For each dimension, if an existing column matches, use the
 *      existing config (preserving user customizations)
 *   3. Otherwise, create a new column (hidden by default)
 *   4. Remove columns whose dimension codes no longer exist
 *
 * @returns Merged columns + list of removed column keys
 */
export function mergeWithExistingColumns(
  existingColumns: ColumnConfig[],
  dimensions: DimensionDefinition[],
): { columns: ColumnConfig[]; removedKeys: string[] } {
  const dimMap = new Map<string, DimensionDefinition>();
  for (const dim of dimensions) {
    dimMap.set(dim.code, dim);
  }

  // Track which dimension codes are covered by existing columns
  const coveredCodes = new Set<string>();
  const mergedColumns: ColumnConfig[] = [];
  const removedKeys: string[] = [];

  // Pass 1: Process existing columns
  for (const col of existingColumns) {
    const dimCode = col.dimensionCode ?? col.key;
    const dim = dimMap.get(dimCode);

    if (dim) {
      // Dimension still exists — preserve user customizations, update metadata
      coveredCodes.add(dimCode);
      mergedColumns.push({
        ...col,
        dimensionCode: dimCode,
        label: col.label, // Preserve user-customized label
        isUdf: dim.source === 'ACTIVITY_UDF',
        udfCode: dim.source === 'ACTIVITY_UDF' ? dimCode.slice(4) : col.udfCode,
        udfType: dim.source === 'ACTIVITY_UDF' ? dim.dataType : col.udfType,
      });
    } else {
      // Dimension no longer exists — remove
      removedKeys.push(col.key);
    }
  }

  // Pass 2: Add newly-available dimensions (hidden by default)
  for (const dim of dimensions) {
    if (!coveredCodes.has(dim.code)) {
      mergedColumns.push(dimensionToColumnConfig(dim, { visible: false }));
    }
  }

  return { columns: mergedColumns, removedKeys };
}
