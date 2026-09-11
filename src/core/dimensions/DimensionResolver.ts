/**
 * Platform Dimension Registry — DimensionResolver
 *
 * Bulk value resolver for activities.
 *
 * Given a set of activities (with relations pre-loaded via Prisma include)
 * and a set of dimension codes, resolves all values in a single pass.
 *
 * KEY DESIGN DECISIONS:
 *   1. NO N+1 queries — all relational data must be pre-loaded on the
 *      ActivityWithRelations input.
 *   2. System dimensions resolve from canonical relational graph
 *      (e.g., UNIT resolves from workpack.unit, NOT from ActivityUdfValue).
 *   3. UDF dimensions resolve from the udf_values array on the activity.
 *   4. Unknown dimension codes are silently skipped (graceful degradation).
 *
 * DOES NOT:
 *   - Calculate progress (M8.13 authority)
 *   - Calculate CPM/schedule (M11 authority)
 *   - Perform execution writes (M12 ExecutionWriteService authority)
 *   - Fetch activities from DB (caller provides pre-loaded activities)
 */

import { SYSTEM_DIMENSION_CODES } from './SystemDimensionCatalog';
import type { ActivityWithRelations, ResolvedDimensionValue } from './types';

/**
 * Resolves a single system dimension value for one activity.
 * Returns null for missing/unavailable data (graceful degradation).
 */
function resolveSystemDimension(
  activity: ActivityWithRelations,
  code: string,
): ResolvedDimensionValue {
  const wp = activity.workpack;

  switch (code) {
    case 'EVENT':
      return {
        dimensionCode: 'EVENT',
        value: activity.event_id,
        label: activity.event_id ?? '',
      };

    case 'SITE':
      return {
        dimensionCode: 'SITE',
        value: activity.site_id,
        label: activity.site_id ?? '',
      };

    case 'PLANT':
      return {
        dimensionCode: 'PLANT',
        value: wp?.plant?.id ?? null,
        label: wp?.plant?.name ?? '',
      };

    case 'AREA':
      return {
        dimensionCode: 'AREA',
        value: wp?.unit?.area?.id ?? null,
        label: wp?.unit?.area?.name ?? '',
      };

    case 'UNIT':
      return {
        dimensionCode: 'UNIT',
        value: wp?.unit?.id ?? null,
        label: wp?.unit?.code
          ? `${wp.unit.code} — ${wp.unit.name}`
          : wp?.unit?.name ?? '',
      };

    case 'SYSTEM':
      return {
        dimensionCode: 'SYSTEM',
        value: wp?.system?.id ?? null,
        label: wp?.system?.code
          ? `${wp.system.code} — ${wp.system.name}`
          : wp?.system?.name ?? '',
      };

    case 'EQUIPMENT':
      return {
        dimensionCode: 'EQUIPMENT',
        value: wp?.asset?.id ?? null,
        label: wp?.asset?.tag_number
          ? `${wp.asset.tag_number} — ${wp.asset.name}`
          : wp?.asset?.name ?? '',
      };

    case 'EQUIPMENT_TYPE':
      return {
        dimensionCode: 'EQUIPMENT_TYPE',
        value: wp?.asset?.equipment_type_rel?.id ?? wp?.asset?.asset_type ?? null,
        label: wp?.asset?.equipment_type_rel?.name ?? wp?.asset?.asset_type ?? '',
      };

    case 'WORKPACK':
      return {
        dimensionCode: 'WORKPACK',
        value: wp?.id ?? null,
        label: wp?.workpack_number
          ? `${wp.workpack_number} — ${wp.title}`
          : wp?.title ?? '',
      };

    case 'DISCIPLINE':
      return {
        dimensionCode: 'DISCIPLINE',
        value: activity.discipline?.id ?? null,
        label: activity.discipline?.code
          ? `${activity.discipline.code} — ${activity.discipline.name}`
          : activity.discipline?.name ?? '',
      };

    case 'CONTRACTOR':
      return {
        dimensionCode: 'CONTRACTOR',
        value: wp?.contractor?.id ?? null,
        label: wp?.contractor?.name ?? '',
      };

    case 'PRIORITY':
      return {
        dimensionCode: 'PRIORITY',
        value: wp?.priority ?? null,
        label: wp?.priority ?? '',
      };

    case 'CRITICALITY':
      return {
        dimensionCode: 'CRITICALITY',
        value: wp?.asset?.criticality ?? null,
        label: wp?.asset?.criticality ?? '',
      };

    case 'STATUS':
      return {
        dimensionCode: 'STATUS',
        value: activity.status,
        label: activity.status ?? '',
      };

    case 'WBS_CODE':
      return {
        dimensionCode: 'WBS_CODE',
        value: activity.wbs_code,
        label: activity.wbs_code ?? '',
      };

    case 'WORK_CATEGORY':
      return {
        dimensionCode: 'WORK_CATEGORY',
        value: activity.work_category,
        label: activity.work_category ?? '',
      };

    default:
      return {
        dimensionCode: code,
        value: null,
        label: '',
      };
  }
}

/**
 * Resolves a UDF dimension value for one activity.
 */
function resolveUdfDimension(
  activity: ActivityWithRelations,
  udfCode: string,
): ResolvedDimensionValue {
  const dimensionCode = `UDF_${udfCode}`;

  if (!activity.udf_values) {
    return { dimensionCode, value: null, label: '' };
  }

  const uv = activity.udf_values.find((v) => v.udf_definition.code === udfCode);
  if (!uv) {
    return { dimensionCode, value: null, label: '' };
  }

  // Resolve based on UDF type
  const type = uv.udf_definition.type.toLowerCase();

  if ((type === 'number' || type === 'integer' || type === 'decimal') && uv.value_number != null) {
    const numVal = Number(uv.value_number);
    return { dimensionCode, value: numVal, label: String(numVal) };
  }

  if ((type === 'boolean' || type === 'checkbox') && uv.value_boolean != null) {
    return { dimensionCode, value: uv.value_boolean, label: uv.value_boolean ? 'Yes' : 'No' };
  }

  if ((type === 'date' || type === 'datetime') && uv.value_date != null) {
    const dateStr = uv.value_date.toISOString().split('T')[0];
    return { dimensionCode, value: dateStr, label: dateStr };
  }

  if (uv.value_string != null) {
    return { dimensionCode, value: uv.value_string, label: uv.value_string };
  }

  return { dimensionCode, value: null, label: '' };
}

export class DimensionResolver {
  /**
   * Bulk-resolve dimension values for a set of activities.
   *
   * @param activities - Activities with relations pre-loaded (Prisma include)
   * @param dimensionCodes - Codes to resolve (e.g., ['UNIT', 'CONTRACTOR', 'UDF_WORK_PHASE'])
   * @returns Map<activityId, { [dimensionCode]: ResolvedDimensionValue }>
   *
   * Performance: O(activities × dimensionCodes) — single pass, no DB queries.
   * All relational data must be pre-loaded on ActivityWithRelations.
   */
  static resolveForActivities(
    activities: ActivityWithRelations[],
    dimensionCodes: string[],
  ): Map<string, Record<string, ResolvedDimensionValue>> {
    const result = new Map<string, Record<string, ResolvedDimensionValue>>();

    for (const activity of activities) {
      const resolved: Record<string, ResolvedDimensionValue> = {};

      for (const code of dimensionCodes) {
        if (SYSTEM_DIMENSION_CODES.has(code)) {
          // System dimension — resolve from canonical relational graph
          resolved[code] = resolveSystemDimension(activity, code);
        } else if (code.startsWith('UDF_')) {
          // UDF dimension — resolve from udf_values array
          const udfCode = code.slice(4);
          resolved[code] = resolveUdfDimension(activity, udfCode);
        }
        // Unknown codes are silently skipped (graceful degradation)
      }

      result.set(activity.id, resolved);
    }

    return result;
  }

  /**
   * Resolve a single dimension for a single activity.
   * Convenience wrapper for simple lookups.
   */
  static resolveOne(
    activity: ActivityWithRelations,
    dimensionCode: string,
  ): ResolvedDimensionValue {
    if (SYSTEM_DIMENSION_CODES.has(dimensionCode)) {
      return resolveSystemDimension(activity, dimensionCode);
    }

    if (dimensionCode.startsWith('UDF_')) {
      return resolveUdfDimension(activity, dimensionCode.slice(4));
    }

    return { dimensionCode, value: null, label: '' };
  }

  /**
   * Get the Prisma include clause needed to support all system dimensions.
   * Use this when fetching activities to ensure all relational data is loaded.
   *
   * This is the CANONICAL include shape — any query that needs dimension
   * resolution must use at least this include.
   */
  static getPrismaInclude() {
    return {
      discipline: {
        select: { id: true, code: true, name: true },
      },
      workpack: {
        select: {
          id: true,
          workpack_number: true,
          title: true,
          priority: true,
          plant_id: true,
          unit_id: true,
          system_id: true,
          asset_id: true,
          contractor_id: true,
          discipline_id: true,
          plant: { select: { id: true, code: true, name: true } },
          unit: {
            select: {
              id: true,
              code: true,
              name: true,
              area: { select: { id: true, code: true, name: true } },
            },
          },
          system: { select: { id: true, code: true, name: true } },
          asset: {
            select: {
              id: true,
              tag_number: true,
              name: true,
              asset_type: true,
              criticality: true,
              equipment_type_rel: { select: { id: true, name: true, code: true } },
            },
          },
          contractor: { select: { id: true, code: true, name: true } },
        },
      },
      udf_values: {
        include: {
          udf_definition: { select: { code: true, type: true } },
        },
      },
    } as const;
  }
}
