/**
 * M7.5 — Rollup Engine
 *
 * Server-side hierarchical rollup computation.
 * Aggregates numeric values from Activity → Workpack → Equipment → System → Unit → Event.
 *
 * Client-side handles Activity → Workpack rollups (data already loaded).
 * This engine handles Workpack → hierarchy levels above.
 */
import { prisma } from '@/lib/prisma';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RollupValues {
  workpackCount: number;
  activityCount: number;
  totalDurationHrs: number;
  totalCrew: number;
  totalResourceHrs: number;
  documentCount: number;
  certificateCount: number;
  avgReadiness: number;
  avgCompliance: number;
  /** Numeric UDF rollups keyed by UDF code → SUM */
  udfRollups: Record<string, number>;
}

export interface HierarchyRollup {
  entityId: string;
  entityType: 'unit' | 'system' | 'asset' | 'event';
  entityCode: string;
  entityName: string;
  values: RollupValues;
}

// ── Service ───────────────────────────────────────────────────────────────────

export class RollupEngine {

  /**
   * Compute rollups for all hierarchy levels in an event.
   * Returns rollup values per unit, system, and event-total.
   */
  static async computeEventRollups(
    organizationId: string,
    eventId: string,
  ): Promise<{
    event: RollupValues;
    units: HierarchyRollup[];
    systems: HierarchyRollup[];
  }> {
    // Load all workpacks with aggregation data
    const workpacks = await prisma.workpack.findMany({
      where: {
        organization_id: organizationId,
        event_id: eventId,
        deleted_at: null,
      },
      select: {
        id: true,
        unit_id: true,
        system_id: true,
        asset_id: true,
        readiness_score: true,
        compliance_score: true,
        unit: { select: { id: true, code: true, name: true } },
        system: { select: { id: true, code: true, name: true } },
        activities: {
          where: { deleted_at: null },
          select: {
            duration_hours: true,
            manpower_count: true,
            resources: { select: { planned_hours: true } },
            udf_values: {
              where: {
                udf_definition: { type: 'number' },
              },
              select: {
                value_number: true,
                udf_definition: { select: { code: true } },
              },
            },
          },
        },
        workpack_documents: { select: { id: true } },
        certificateInstances: { select: { id: true } },
      },
    });

    // ── Aggregate per unit and system ───────────────────────────────────

    const unitRollups = new Map<string, { meta: { code: string; name: string }; values: RollupValues }>();
    const systemRollups = new Map<string, { meta: { code: string; name: string }; values: RollupValues }>();

    const eventRollup = createEmptyRollup();
    let readinessSum = 0;
    let complianceSum = 0;
    let wpWithScores = 0;

    for (const wp of workpacks) {
      const wpValues = this.computeWorkpackRollup(wp);

      // Event-level
      addRollup(eventRollup, wpValues);
      readinessSum += wp.readiness_score ?? 0;
      complianceSum += wp.compliance_score ?? 0;
      wpWithScores++;

      // Unit-level
      if (wp.unit_id && wp.unit) {
        if (!unitRollups.has(wp.unit_id)) {
          unitRollups.set(wp.unit_id, {
            meta: { code: wp.unit.code ?? '', name: wp.unit.name },
            values: createEmptyRollup(),
          });
        }
        addRollup(unitRollups.get(wp.unit_id)!.values, wpValues);
      }

      // System-level
      if (wp.system_id && wp.system) {
        if (!systemRollups.has(wp.system_id)) {
          systemRollups.set(wp.system_id, {
            meta: { code: wp.system.code ?? '', name: wp.system.name },
            values: createEmptyRollup(),
          });
        }
        addRollup(systemRollups.get(wp.system_id)!.values, wpValues);
      }
    }

    // Compute averages
    if (wpWithScores > 0) {
      eventRollup.avgReadiness = Math.round(readinessSum / wpWithScores);
      eventRollup.avgCompliance = Math.round(complianceSum / wpWithScores);
    }

    // Compute unit/system averages
    for (const [unitId, data] of unitRollups) {
      if (data.values.workpackCount > 0) {
        // Sum readiness/compliance for workpacks in this unit
        const unitWps = workpacks.filter((w) => w.unit_id === unitId);
        const rSum = unitWps.reduce((s, w) => s + (w.readiness_score ?? 0), 0);
        const cSum = unitWps.reduce((s, w) => s + (w.compliance_score ?? 0), 0);
        data.values.avgReadiness = Math.round(rSum / unitWps.length);
        data.values.avgCompliance = Math.round(cSum / unitWps.length);
      }
    }

    return {
      event: eventRollup,
      units: Array.from(unitRollups.entries()).map(([id, data]) => ({
        entityId: id,
        entityType: 'unit' as const,
        entityCode: data.meta.code,
        entityName: data.meta.name,
        values: data.values,
      })),
      systems: Array.from(systemRollups.entries()).map(([id, data]) => ({
        entityId: id,
        entityType: 'system' as const,
        entityCode: data.meta.code,
        entityName: data.meta.name,
        values: data.values,
      })),
    };
  }

  // ── Internal: per-workpack rollup ─────────────────────────────────────────

  private static computeWorkpackRollup(wp: {
    activities: {
      duration_hours: unknown;
      manpower_count: number | null;
      resources: { planned_hours: unknown }[];
      udf_values: {
        value_number: unknown;
        udf_definition: { code: string };
      }[];
    }[];
    workpack_documents: { id: string }[];
    certificateInstances: { id: string }[];
  }): RollupValues {
    const values: RollupValues = {
      workpackCount: 1,
      activityCount: wp.activities.length,
      totalDurationHrs: 0,
      totalCrew: 0,
      totalResourceHrs: 0,
      documentCount: wp.workpack_documents.length,
      certificateCount: wp.certificateInstances.length,
      avgReadiness: 0,
      avgCompliance: 0,
      udfRollups: {},
    };

    for (const act of wp.activities) {
      values.totalDurationHrs += Number(act.duration_hours ?? 0);
      values.totalCrew += act.manpower_count ?? 0;
      values.totalResourceHrs += act.resources.reduce(
        (s, r) => s + Number(r.planned_hours ?? 0), 0
      );

      // UDF numeric rollups
      for (const uv of act.udf_values) {
        if (uv.value_number != null) {
          const code = uv.udf_definition.code;
          values.udfRollups[code] = (values.udfRollups[code] ?? 0) + Number(uv.value_number);
        }
      }
    }

    return values;
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function createEmptyRollup(): RollupValues {
  return {
    workpackCount: 0,
    activityCount: 0,
    totalDurationHrs: 0,
    totalCrew: 0,
    totalResourceHrs: 0,
    documentCount: 0,
    certificateCount: 0,
    avgReadiness: 0,
    avgCompliance: 0,
    udfRollups: {},
  };
}

function addRollup(target: RollupValues, source: RollupValues): void {
  target.workpackCount += source.workpackCount;
  target.activityCount += source.activityCount;
  target.totalDurationHrs += source.totalDurationHrs;
  target.totalCrew += source.totalCrew;
  target.totalResourceHrs += source.totalResourceHrs;
  target.documentCount += source.documentCount;
  target.certificateCount += source.certificateCount;

  // Merge UDF rollups
  for (const [code, val] of Object.entries(source.udfRollups)) {
    target.udfRollups[code] = (target.udfRollups[code] ?? 0) + val;
  }
}
