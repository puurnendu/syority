/**
 * Platform Dimension Registry — DimensionRegistry
 *
 * THE SINGLE SOURCE OF TRUTH for dimension definitions.
 *
 * Merges system-defined dimensions (from SystemDimensionCatalog) with
 * tenant-defined UDF dimensions (from ActivityUdfDefinition) into a
 * unified DimensionDefinition[] contract.
 *
 * Consumers (Activity Grid, Gantt, Export, Reports, AI) call:
 *   DimensionRegistry.getDefinitions(organizationId)
 * and receive ALL available dimensions in display order.
 *
 * ARCHITECTURE:
 *   SystemDimensionCatalog (static) ─┐
 *                                    ├─► DimensionRegistry.getDefinitions()
 *   ActivityUdfDefinition (DB)  ─────┘
 *
 * DOES NOT:
 *   - Calculate progress (M8.13 authority)
 *   - Calculate CPM/schedule (M11 authority)
 *   - Perform execution writes (M12 ExecutionWriteService authority)
 *   - Resolve dimension values (that's DimensionResolver)
 */

import { prisma } from '@/lib/prisma';
import { SYSTEM_DIMENSIONS, getSystemDimension, SYSTEM_DIMENSION_CODES } from './SystemDimensionCatalog';
import type { DimensionDefinition, DimensionOption } from './types';

/**
 * Maps an ActivityUdfDefinition.type to a DimensionDataType.
 */
function mapUdfType(udfType: string): DimensionDefinition['dataType'] {
  switch (udfType.toLowerCase()) {
    case 'number':
    case 'integer':
    case 'decimal':
      return 'number';
    case 'date':
    case 'datetime':
      return 'date';
    case 'boolean':
    case 'checkbox':
      return 'boolean';
    case 'dropdown':
    case 'select':
    case 'multi_select':
      return 'dropdown';
    default:
      return 'text';
  }
}

export class DimensionRegistry {
  /**
   * Get all dimension definitions for a tenant.
   *
   * Returns system dimensions first (sorted by displayOrder),
   * then tenant UDF dimensions (sorted by display_order / sort_order).
   *
   * @param organizationId - Tenant organization ID
   */
  static async getDefinitions(organizationId: string): Promise<DimensionDefinition[]> {
    // 1. Start with system dimensions (always available)
    const systemDefs: DimensionDefinition[] = SYSTEM_DIMENSIONS.map((d) => ({ ...d }));

    // 2. Load tenant UDF definitions
    const udfDefinitions = await prisma.activityUdfDefinition.findMany({
      where: {
        organization_id: organizationId,
        is_active: true,
        deleted_at: null,
      },
      include: {
        options: {
          where: { is_active: true, deleted_at: null },
          orderBy: { sort_order: 'asc' },
          select: {
            value: true,
            label: true,
            code_value: true,
            sort_order: true,
          },
        },
      },
      orderBy: [{ display_order: 'asc' }, { sort_order: 'asc' }, { name: 'asc' }],
    });

    // 3. Map UDF definitions to DimensionDefinition contract
    const udfDefs: DimensionDefinition[] = udfDefinitions.map((udf) => {
      const dataType = mapUdfType(udf.type);

      const options: DimensionOption[] | undefined =
        dataType === 'dropdown' && udf.options.length > 0
          ? udf.options.map((opt) => ({
              value: opt.code_value ?? opt.value,
              label: opt.label,
              sortOrder: opt.sort_order ?? undefined,
            }))
          : undefined;

      return {
        code: `UDF_${udf.code}`,
        label: udf.name,
        dataType,
        source: 'ACTIVITY_UDF' as const,
        systemDefined: false,
        filterable: udf.is_filterable ?? true,
        sortable: udf.is_sortable ?? true,
        groupable: udf.is_groupable ?? true,
        exportable: true,
        bulkEditable: udf.is_bulk_editable ?? false,
        displayOrder: udf.display_order ?? (1000 + (udf.sort_order ?? 0)),
        width: udf.width ?? 150,
        options,
        validationRules: udf.validation_rules ?? null,
        udfDefinitionId: udf.id,
      };
    });

    // 4. Merge and sort by displayOrder
    const all = [...systemDefs, ...udfDefs];
    all.sort((a, b) => a.displayOrder - b.displayOrder);

    return all;
  }

  /**
   * Get a single dimension definition by code.
   *
   * For system dimensions, returns immediately without DB query.
   * For UDF dimensions, queries the database.
   *
   * @param organizationId - Tenant organization ID
   * @param code - Dimension code (e.g., 'UNIT', 'UDF_WORK_PHASE')
   */
  static async getDefinition(
    organizationId: string,
    code: string,
  ): Promise<DimensionDefinition | null> {
    // Check system dimensions first (no DB query)
    if (SYSTEM_DIMENSION_CODES.has(code)) {
      const def = getSystemDimension(code);
      return def ? { ...def } : null;
    }

    // Check if it's a UDF code (prefixed with UDF_)
    if (code.startsWith('UDF_')) {
      const udfCode = code.slice(4); // Remove 'UDF_' prefix
      const udf = await prisma.activityUdfDefinition.findFirst({
        where: {
          organization_id: organizationId,
          code: udfCode,
          is_active: true,
          deleted_at: null,
        },
        include: {
          options: {
            where: { is_active: true, deleted_at: null },
            orderBy: { sort_order: 'asc' },
            select: {
              value: true,
              label: true,
              code_value: true,
              sort_order: true,
            },
          },
        },
      });

      if (!udf) return null;

      const dataType = mapUdfType(udf.type);
      const options: DimensionOption[] | undefined =
        dataType === 'dropdown' && udf.options.length > 0
          ? udf.options.map((opt) => ({
              value: opt.code_value ?? opt.value,
              label: opt.label,
              sortOrder: opt.sort_order ?? undefined,
            }))
          : undefined;

      return {
        code: `UDF_${udf.code}`,
        label: udf.name,
        dataType,
        source: 'ACTIVITY_UDF',
        systemDefined: false,
        filterable: udf.is_filterable ?? true,
        sortable: udf.is_sortable ?? true,
        groupable: udf.is_groupable ?? true,
        exportable: true,
        bulkEditable: udf.is_bulk_editable ?? false,
        displayOrder: udf.display_order ?? (1000 + (udf.sort_order ?? 0)),
        width: udf.width ?? 150,
        options,
        validationRules: udf.validation_rules ?? null,
        udfDefinitionId: udf.id,
      };
    }

    return null;
  }

  /**
   * Get only system dimension definitions (no DB query).
   * Useful for static analysis, schema generation, and tests.
   */
  static getSystemDefinitions(): DimensionDefinition[] {
    return SYSTEM_DIMENSIONS.map((d) => ({ ...d }));
  }

  /**
   * Check if a code is a system-defined dimension.
   */
  static isSystemDimension(code: string): boolean {
    return SYSTEM_DIMENSION_CODES.has(code);
  }
}
