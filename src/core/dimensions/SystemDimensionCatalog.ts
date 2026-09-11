/**
 * Platform Dimension Registry — System Dimension Catalog
 *
 * Hard-coded registry of system-defined dimensions derived from
 * canonical relational data (Activity, Workpack, Digital Plant).
 *
 * These dimensions are ALWAYS available for every tenant.
 * They resolve from canonical FK relationships — NOT from ActivityUdfValue.
 *
 * The resolution path descriptions are for documentation/debugging only.
 * Runtime resolution is handled by DimensionResolver.
 *
 * DOES NOT:
 *   - Calculate progress (M8.13 authority)
 *   - Calculate CPM/schedule (M11 authority)
 *   - Perform execution writes (M12 ExecutionWriteService authority)
 */

import type { DimensionDefinition } from './types';

/**
 * All system-defined dimensions, ordered by display_order.
 *
 * Convention for display_order:
 *   0-99:   Navigation/hierarchy dimensions
 *   100-199: Activity-level dimensions
 *   200-299: Schedule dimensions
 *   300-399: Execution dimensions
 *   1000+:   Tenant UDFs (assigned dynamically)
 */
export const SYSTEM_DIMENSIONS: readonly DimensionDefinition[] = [
  // ── Navigation / Hierarchy ───────────────────────────────────────────────
  {
    code: 'EVENT',
    label: 'Event',
    dataType: 'dropdown',
    source: 'ACTIVITY_FIELD',
    systemDefined: true,
    filterable: true,
    sortable: true,
    groupable: true,
    exportable: true,
    bulkEditable: false,
    displayOrder: 1,
    width: 180,
    resolutionPath: 'activity.event_id → Event.name',
  },
  {
    code: 'SITE',
    label: 'Site',
    dataType: 'dropdown',
    source: 'ACTIVITY_FIELD',
    systemDefined: true,
    filterable: true,
    sortable: true,
    groupable: true,
    exportable: true,
    bulkEditable: false,
    displayOrder: 2,
    width: 150,
    resolutionPath: 'activity.site_id → Site.name',
  },
  {
    code: 'PLANT',
    label: 'Plant',
    dataType: 'dropdown',
    source: 'DIGITAL_PLANT',
    systemDefined: true,
    filterable: true,
    sortable: true,
    groupable: true,
    exportable: true,
    bulkEditable: false,
    displayOrder: 3,
    width: 150,
    resolutionPath: 'activity → workpack → plant.name',
  },
  {
    code: 'AREA',
    label: 'Area',
    dataType: 'dropdown',
    source: 'DIGITAL_PLANT',
    systemDefined: true,
    filterable: true,
    sortable: true,
    groupable: true,
    exportable: true,
    bulkEditable: false,
    displayOrder: 4,
    width: 150,
    resolutionPath: 'activity → workpack → unit → area.name',
  },
  {
    code: 'UNIT',
    label: 'Unit',
    dataType: 'dropdown',
    source: 'DIGITAL_PLANT',
    systemDefined: true,
    filterable: true,
    sortable: true,
    groupable: true,
    exportable: true,
    bulkEditable: false,
    displayOrder: 5,
    width: 150,
    resolutionPath: 'activity → workpack → unit.code / unit.name',
  },
  {
    code: 'SYSTEM',
    label: 'System',
    dataType: 'dropdown',
    source: 'DIGITAL_PLANT',
    systemDefined: true,
    filterable: true,
    sortable: true,
    groupable: true,
    exportable: true,
    bulkEditable: false,
    displayOrder: 6,
    width: 150,
    resolutionPath: 'activity → workpack → system.code / system.name',
  },
  {
    code: 'EQUIPMENT',
    label: 'Equipment',
    dataType: 'dropdown',
    source: 'DIGITAL_PLANT',
    systemDefined: true,
    filterable: true,
    sortable: true,
    groupable: true,
    exportable: true,
    bulkEditable: false,
    displayOrder: 7,
    width: 180,
    resolutionPath: 'activity → workpack → asset.tag_number / asset.name',
  },
  {
    code: 'EQUIPMENT_TYPE',
    label: 'Equipment Type',
    dataType: 'dropdown',
    source: 'DIGITAL_PLANT',
    systemDefined: true,
    filterable: true,
    sortable: true,
    groupable: true,
    exportable: true,
    bulkEditable: false,
    displayOrder: 8,
    width: 150,
    resolutionPath: 'activity → workpack → asset → equipment_type_rel.name',
  },

  // ── Work Organization ────────────────────────────────────────────────────
  {
    code: 'WORKPACK',
    label: 'Workpack',
    dataType: 'dropdown',
    source: 'WORKPACK_FIELD',
    systemDefined: true,
    filterable: true,
    sortable: true,
    groupable: true,
    exportable: true,
    bulkEditable: false,
    displayOrder: 10,
    width: 180,
    resolutionPath: 'activity → workpack.workpack_number / workpack.title',
  },
  {
    code: 'DISCIPLINE',
    label: 'Discipline',
    dataType: 'dropdown',
    source: 'ACTIVITY_FIELD',
    systemDefined: true,
    filterable: true,
    sortable: true,
    groupable: true,
    exportable: true,
    bulkEditable: false,
    displayOrder: 11,
    width: 130,
    resolutionPath: 'activity → discipline.code / discipline.name',
  },
  {
    code: 'CONTRACTOR',
    label: 'Contractor',
    dataType: 'dropdown',
    source: 'WORKPACK_FIELD',
    systemDefined: true,
    filterable: true,
    sortable: true,
    groupable: true,
    exportable: true,
    bulkEditable: false,
    displayOrder: 12,
    width: 150,
    resolutionPath: 'activity → workpack → contractor.name',
  },
  {
    code: 'PRIORITY',
    label: 'Priority',
    dataType: 'dropdown',
    source: 'WORKPACK_FIELD',
    systemDefined: true,
    filterable: true,
    sortable: true,
    groupable: true,
    exportable: true,
    bulkEditable: false,
    displayOrder: 13,
    width: 100,
    resolutionPath: 'activity → workpack.priority',
    options: [
      { value: 'Critical', label: 'Critical', sortOrder: 0 },
      { value: 'High', label: 'High', sortOrder: 1 },
      { value: 'Normal', label: 'Normal', sortOrder: 2 },
      { value: 'Low', label: 'Low', sortOrder: 3 },
    ],
  },
  {
    code: 'CRITICALITY',
    label: 'Criticality',
    dataType: 'dropdown',
    source: 'DIGITAL_PLANT',
    systemDefined: true,
    filterable: true,
    sortable: true,
    groupable: true,
    exportable: true,
    bulkEditable: false,
    displayOrder: 14,
    width: 120,
    resolutionPath: 'activity → workpack → asset.criticality',
  },

  // ── Activity-Level ───────────────────────────────────────────────────────
  {
    code: 'STATUS',
    label: 'Status',
    dataType: 'dropdown',
    source: 'ACTIVITY_FIELD',
    systemDefined: true,
    filterable: true,
    sortable: true,
    groupable: true,
    exportable: true,
    bulkEditable: false,
    displayOrder: 100,
    width: 120,
    resolutionPath: 'activity.status',
    options: [
      { value: 'not_started', label: 'Not Started', sortOrder: 0 },
      { value: 'in_progress', label: 'In Progress', sortOrder: 1 },
      { value: 'completed', label: 'Completed', sortOrder: 2 },
      { value: 'on_hold', label: 'On Hold', sortOrder: 3 },
    ],
  },
  {
    code: 'WBS_CODE',
    label: 'WBS Code',
    dataType: 'text',
    source: 'ACTIVITY_FIELD',
    systemDefined: true,
    filterable: true,
    sortable: true,
    groupable: true,
    exportable: true,
    bulkEditable: true,
    displayOrder: 101,
    width: 120,
    resolutionPath: 'activity.wbs_code',
  },
  {
    code: 'WORK_CATEGORY',
    label: 'Work Category',
    dataType: 'text',
    source: 'ACTIVITY_FIELD',
    systemDefined: true,
    filterable: true,
    sortable: true,
    groupable: true,
    exportable: true,
    bulkEditable: true,
    displayOrder: 102,
    width: 140,
    resolutionPath: 'activity.work_category',
  },
] as const;

/**
 * Lookup a system dimension by code.
 * Returns undefined if not found (code may be a tenant UDF).
 */
export function getSystemDimension(code: string): DimensionDefinition | undefined {
  return SYSTEM_DIMENSIONS.find((d) => d.code === code);
}

/**
 * All system dimension codes as a Set for O(1) membership checks.
 */
export const SYSTEM_DIMENSION_CODES = new Set(SYSTEM_DIMENSIONS.map((d) => d.code));
