/**
 * Planning Progress % — single 0–100 score per system for PLANNING completeness only.
 * Does NOT include execution data (activity progress, HO/WP/TO, overall progress).
 *
 * PERFORMANCE: use `computePlanningProgressForSystems` (batch) whenever scoring
 * more than one system. It runs a fixed number (~9) of bulk queries regardless
 * of how many systems are passed, instead of ~12 queries per system.
 */

import { prisma } from '@/lib/prisma';

export type PlanningChecks = {
  workpacksExist: boolean;
  activitiesAdded: boolean;
  activitiesAddedRatio: number; // for tooltip e.g. "3/5 workpacks"
  datesSet: boolean;
  datesSetRatio: number; // for tooltip e.g. "12/15 activities"
  materialsAdded: boolean;
  materialsAddedRatio: number; // for tooltip
  blindListPopulated: boolean;
  gasketRegPopulated: boolean;
  drawingAttached: boolean;
  procedureAttached: boolean;
  wbsGenerated: boolean;
};

export type ComputedPlanningProgress = {
  planningProgress: number;
  workpackCount: number;
  activityCount: number;
  status: 'Not Started' | 'In Planning' | 'Planned';
  planningChecks: PlanningChecks;
};

export type SystemPlanningProgress = {
  systemId: string;
  systemCode: string;
  systemName: string;
  unitName: string;
  criticality: string;
  planningProgress: number;
  workpackCount: number;
  activityCount: number;
  status: 'Not Started' | 'In Planning' | 'Planned';
  planningChecks: PlanningChecks;
};

const WEIGHTS = {
  workpacksExist: 15,
  activitiesAdded: 15,
  datesSet: 15,
  materialsAdded: 10,
  blindListPopulated: 10,
  gasketRegPopulated: 10,
  drawingAttached: 10,
  procedureAttached: 10,
  wbsGenerated: 5,
} as const;

const EMPTY_RESULT: ComputedPlanningProgress = {
  planningProgress: 0,
  workpackCount: 0,
  activityCount: 0,
  status: 'Not Started',
  planningChecks: {
    workpacksExist: false,
    activitiesAdded: false,
    activitiesAddedRatio: 0,
    datesSet: false,
    datesSetRatio: 0,
    materialsAdded: false,
    materialsAddedRatio: 0,
    blindListPopulated: false,
    gasketRegPopulated: false,
    drawingAttached: false,
    procedureAttached: false,
    wbsGenerated: false,
  },
};

/** groupBy count per system_id with a guard for models missing from an out-of-date client */
async function countBySystem(
  model: any,
  modelName: string,
  systemIds: string[]
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (!model?.groupBy) {
    console.warn(`${modelName} model not found in Prisma client`);
    return map;
  }
  try {
    const rows = await model.groupBy({
      by: ['system_id'],
      where: { system_id: { in: systemIds } },
      _count: { _all: true },
    });
    for (const r of rows) map.set(r.system_id, r._count._all);
  } catch (e) {
    console.error(`Error counting ${modelName}:`, e);
  }
  return map;
}

/**
 * Batch computation — fixed number of bulk queries for ANY number of systems.
 * Returns an entry for every requested id (zeroed result if the system is missing).
 */
export async function computePlanningProgressForSystems(
  systemIds: string[]
): Promise<Map<string, ComputedPlanningProgress>> {
  const results = new Map<string, ComputedPlanningProgress>();
  if (systemIds.length === 0) return results;

  const [systems, workpacks, activities, workpacksWithMaterial, blindMap, gasketMap, drawingMap, procedureMap, wbsMap] = await Promise.all([
    prisma.system.findMany({
      where: { id: { in: systemIds } },
      select: { id: true },
    }).catch(e => { console.error('Error fetching systems:', e); return [] as { id: string }[]; }),
    prisma.workpack.findMany({
      where: { system_id: { in: systemIds }, deleted_at: null },
      select: { id: true, system_id: true },
    }).catch(e => { console.error('Error fetching workpacks:', e); return [] as any[]; }),
    prisma.activity.findMany({
      where: { workpack: { system_id: { in: systemIds }, deleted_at: null }, deleted_at: null },
      select: { id: true, workpack_id: true, planned_start: true, planned_end: true },
    }).catch(e => { console.error('Error fetching activities:', e); return [] as any[]; }),
    prisma.workpack.findMany({
      where: {
        system_id: { in: systemIds },
        deleted_at: null,
        workpack_materials: { some: { deleted_at: null } },
      },
      select: { id: true, system_id: true },
    }).catch(e => { console.error('Error fetching workpacks with materials:', e); return [] as any[]; }),
    countBySystem((prisma as any).system_blinds, 'system_blinds', systemIds),
    countBySystem((prisma as any).system_gaskets, 'system_gaskets', systemIds),
    countBySystem((prisma as any).system_drawings, 'system_drawings', systemIds),
    countBySystem((prisma as any).system_procedures, 'system_procedures', systemIds),
    countBySystem((prisma as any).wbsNode, 'wbsNode', systemIds),
  ]);

  const existingSystems = new Set(systems.map((s) => s.id));

  // workpack id -> system id
  const wpToSystem = new Map<string, string>();
  const wpsBySystem = new Map<string, string[]>();
  for (const wp of workpacks) {
    if (!wp.system_id) continue;
    wpToSystem.set(wp.id, wp.system_id);
    const list = wpsBySystem.get(wp.system_id) ?? [];
    list.push(wp.id);
    wpsBySystem.set(wp.system_id, list);
  }

  // per-system activity stats + workpacks that have at least one activity
  const activityTotals = new Map<string, { total: number; withDates: number }>();
  const wpsWithActivity = new Map<string, Set<string>>();
  for (const a of activities) {
    const sysId = a.workpack_id ? wpToSystem.get(a.workpack_id) : undefined;
    if (!sysId) continue;
    const stats = activityTotals.get(sysId) ?? { total: 0, withDates: 0 };
    stats.total++;
    if (a.planned_start != null && a.planned_end != null) stats.withDates++;
    activityTotals.set(sysId, stats);
    if (a.workpack_id) {
      const set = wpsWithActivity.get(sysId) ?? new Set<string>();
      set.add(a.workpack_id);
      wpsWithActivity.set(sysId, set);
    }
  }

  const materialWpsBySystem = new Map<string, number>();
  for (const wp of workpacksWithMaterial) {
    if (!wp.system_id) continue;
    materialWpsBySystem.set(wp.system_id, (materialWpsBySystem.get(wp.system_id) ?? 0) + 1);
  }

  for (const systemId of systemIds) {
    if (!existingSystems.has(systemId)) {
      results.set(systemId, { ...EMPTY_RESULT, planningChecks: { ...EMPTY_RESULT.planningChecks } });
      continue;
    }

    const totalWps = wpsBySystem.get(systemId)?.length ?? 0;
    const actStats = activityTotals.get(systemId) ?? { total: 0, withDates: 0 };
    const totalActivities = actStats.total;
    const wpsWithAtLeastOneActivity = wpsWithActivity.get(systemId)?.size ?? 0;
    const wpsWithMaterial = materialWpsBySystem.get(systemId) ?? 0;

    const check1 = totalWps >= 1;
    const check2Ratio = totalWps > 0 ? wpsWithAtLeastOneActivity / totalWps : 0;
    const check3Ratio = totalActivities > 0 ? actStats.withDates / totalActivities : 0;
    const check4Ratio = totalWps > 0 ? wpsWithMaterial / totalWps : 0;
    const check5 = (blindMap.get(systemId) ?? 0) >= 1;
    const check6 = (gasketMap.get(systemId) ?? 0) >= 1;
    const check7 = (drawingMap.get(systemId) ?? 0) >= 1;
    const check8 = (procedureMap.get(systemId) ?? 0) >= 1;
    const check9 = (wbsMap.get(systemId) ?? 0) >= 1;

    const score =
      (check1 ? WEIGHTS.workpacksExist : 0) +
      check2Ratio * WEIGHTS.activitiesAdded +
      check3Ratio * WEIGHTS.datesSet +
      check4Ratio * WEIGHTS.materialsAdded +
      (check5 ? WEIGHTS.blindListPopulated : 0) +
      (check6 ? WEIGHTS.gasketRegPopulated : 0) +
      (check7 ? WEIGHTS.drawingAttached : 0) +
      (check8 ? WEIGHTS.procedureAttached : 0) +
      (check9 ? WEIGHTS.wbsGenerated : 0);

    const planningProgress = Math.round(Math.min(100, Math.max(0, score)));
    const status: 'Not Started' | 'In Planning' | 'Planned' =
      planningProgress === 0 ? 'Not Started' : planningProgress === 100 ? 'Planned' : 'In Planning';

    results.set(systemId, {
      planningProgress,
      workpackCount: totalWps,
      activityCount: totalActivities,
      status,
      planningChecks: {
        workpacksExist: check1,
        activitiesAdded: check2Ratio === 1,
        activitiesAddedRatio: check2Ratio,
        datesSet: check3Ratio === 1,
        datesSetRatio: check3Ratio,
        materialsAdded: check4Ratio === 1,
        materialsAddedRatio: check4Ratio,
        blindListPopulated: check5,
        gasketRegPopulated: check6,
        drawingAttached: check7,
        procedureAttached: check8,
        wbsGenerated: check9,
      },
    });
  }

  return results;
}

/** Single-system convenience wrapper — delegates to the batch implementation. */
export async function computePlanningProgressForSystem(systemId: string): Promise<ComputedPlanningProgress> {
  const results = await computePlanningProgressForSystems([systemId]);
  return results.get(systemId) ?? { ...EMPTY_RESULT, planningChecks: { ...EMPTY_RESULT.planningChecks } };
}

export async function getSystemPlanningProgressPayload(
  systemId: string,
  systemCode: string,
  systemName: string,
  unitName: string,
  criticality: string | null
): Promise<SystemPlanningProgress> {
  const computed = await computePlanningProgressForSystem(systemId);
  return {
    systemId,
    systemCode: systemCode ?? '',
    systemName,
    unitName,
    criticality: criticality ?? '',
    planningProgress: computed.planningProgress,
    workpackCount: computed.workpackCount,
    activityCount: computed.activityCount,
    status: computed.status,
    planningChecks: computed.planningChecks,
  };
}
