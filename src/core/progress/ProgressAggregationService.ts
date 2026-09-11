/**
 * M8.13 Phase 1+2 — Progress Aggregation Service
 *
 * Database access layer for the authoritative progress system.
 * Queries Prisma for activity data and delegates calculation to
 * ProgressCalculationService (the pure calculation engine).
 *
 * This service DOES NOT contain any progress calculation formulas.
 * All math is in ProgressCalculationService.
 *
 * Query Design:
 * - One well-designed query per aggregation call
 * - No N+1 patterns
 * - All queries enforce organization_id + event_id for tenant isolation
 * - Activities filtered: deleted_at IS NULL, status != 'cancelled' (via calc service)
 */

import { prisma } from '@/lib/prisma';
import {
  calculateProgressMetrics,
  calculateDisciplineProgress,
  calculateContractorProgress,
  calculateUnitProgress,
  calculateEquipmentTypeProgress,
  calculateWorkpackProgress,
  calculateIdenticalActivityProgress,
  calculateStandardActivityTypeProgress,
  calculateAssetProgress,
} from './ProgressCalculationService';
import type {
  ProgressActivityInput,
  ProgressMetrics,
  EventProgressPayload,
  DimensionProgress,
  RecalculationResult,
  IdenticalActivityGroup,
  EquipmentTypeDrillDown,
  EquipmentInstanceProgress,
  DashboardProgressSummary,
} from './types';
import { toDashboardSummary } from './types';

// ─── Data Loading ────────────────────────────────────────────────────────────

/**
 * Load all activities for an event with dimensional join data.
 * Single query — includes discipline, contractor, unit, equipment type,
 * standard activity type, and asset info.
 *
 * Query count: 1
 */
async function loadEventActivities(
  organizationId: string,
  eventId: string
): Promise<ProgressActivityInput[]> {
  const activities = await prisma.activity.findMany({
    where: {
      organization_id: organizationId,
      event_id: eventId,
      deleted_at: null,
    },
    select: {
      id: true,
      description: true,
      duration_hours: true,
      progress_percent: true,
      status: true,
      workpack_id: true,
      event_id: true,
      discipline_id: true,
      standard_activity_type_id: true,
      discipline: { select: { name: true } },
      workpack: {
        select: {
          contractor_id: true,
          contractor: { select: { name: true } },
          unit_id: true,
          unit: { select: { code: true } },
          equipment_type: true,
          asset_id: true,
          asset: { select: { id: true, name: true, tag_number: true } },
        },
      },
    },
  });

  // Load standard activity types mapping if any activities have the field
  let satMap = new Map<string, { name: string; code: string }>();
  try {
    const sats = await prisma.standardActivityType.findMany({
      select: { id: true, name: true, code: true },
    });
    satMap = new Map(sats.map((s) => [s.id, { name: s.name, code: s.code }]));
  } catch {
    // StandardActivityType table may not exist yet — graceful fallback
  }

  return activities.map((a) => {
    const satId = a.standard_activity_type_id ?? null;
    const sat = satId ? satMap.get(satId) : null;

    return {
      activityId: a.id,
      description: a.description ?? null,
      durationHours: a.duration_hours != null ? Number(a.duration_hours) : null,
      progressPercent: a.progress_percent,
      status: a.status,
      workpackId: a.workpack_id,
      eventId: a.event_id,
      disciplineId: a.discipline_id,
      disciplineName: a.discipline?.name ?? null,
      contractorId: a.workpack?.contractor_id ?? null,
      contractorName: a.workpack?.contractor?.name ?? null,
      unitId: a.workpack?.unit_id ?? null,
      unitCode: a.workpack?.unit?.code ?? null,
      equipmentType: a.workpack?.equipment_type ?? null,
      standardActivityTypeId: satId,
      standardActivityTypeName: sat?.name ?? null,
      standardActivityTypeCode: sat?.code ?? null,
      assetId: a.workpack?.asset_id ?? null,
      assetName: a.workpack?.asset?.name ?? null,
      assetTagNumber: a.workpack?.asset?.tag_number ?? null,
    };
  });
}

/**
 * Load activities for a specific workpack.
 * Query count: 1
 */
async function loadWorkpackActivities(
  organizationId: string,
  workpackId: string
): Promise<ProgressActivityInput[]> {
  const activities = await prisma.activity.findMany({
    where: {
      organization_id: organizationId,
      workpack_id: workpackId,
      deleted_at: null,
    },
    select: {
      id: true,
      description: true,
      duration_hours: true,
      progress_percent: true,
      status: true,
      workpack_id: true,
      event_id: true,
    },
  });

  return activities.map((a) => ({
    activityId: a.id,
    description: a.description ?? null,
    durationHours: a.duration_hours != null ? Number(a.duration_hours) : null,
    progressPercent: a.progress_percent,
    status: a.status,
    workpackId: a.workpack_id,
    eventId: a.event_id,
  }));
}

// ─── Public API ──────────────────────────────────────────────────────────────

export class ProgressAggregationService {
  /**
   * Get authoritative event-level execution progress with optional dimensions.
   *
   * Query count: 1 (single activity query with joins) + 1 (SAT lookup)
   *
   * @param organizationId - Tenant ID
   * @param eventId - Event ID
   * @param options - Which dimensions to include
   */
  static async getEventProgress(
    organizationId: string,
    eventId: string,
    options?: {
      includeDiscipline?: boolean;
      includeContractor?: boolean;
      includeUnit?: boolean;
      includeEquipmentType?: boolean;
      includeWorkpack?: boolean;
      includeIdenticalActivities?: boolean;
      includeEquipmentDrillDown?: boolean;
    }
  ): Promise<EventProgressPayload> {
    const activities = await loadEventActivities(organizationId, eventId);
    const overall = calculateProgressMetrics(activities);

    const payload: EventProgressPayload = {
      eventId,
      organizationId,
      calculatedAt: new Date().toISOString(),
      overall,
    };

    if (options?.includeDiscipline) {
      payload.byDiscipline = calculateDisciplineProgress(activities);
    }
    if (options?.includeContractor) {
      payload.byContractor = calculateContractorProgress(activities);
    }
    if (options?.includeUnit) {
      payload.byUnit = calculateUnitProgress(activities);
    }
    if (options?.includeEquipmentType) {
      payload.byEquipmentType = calculateEquipmentTypeProgress(activities);
    }
    if (options?.includeWorkpack) {
      payload.byWorkpack = calculateWorkpackProgress(activities);
    }
    if (options?.includeIdenticalActivities) {
      payload.identicalActivities = calculateIdenticalActivityProgress(activities);
    }
    if (options?.includeEquipmentDrillDown) {
      payload.equipmentDrillDown = this.buildEquipmentDrillDown(activities);
    }

    return payload;
  }

  /**
   * Get DashboardProgressSummary — the universal contract for dashboard widgets.
   */
  static async getDashboardSummary(
    organizationId: string,
    eventId: string
  ): Promise<DashboardProgressSummary> {
    const activities = await loadEventActivities(organizationId, eventId);
    const metrics = calculateProgressMetrics(activities);
    return toDashboardSummary(metrics);
  }

  /**
   * Get identical activity progress for an event.
   */
  static async getIdenticalActivityProgress(
    organizationId: string,
    eventId: string,
    equipmentTypeFilter?: string
  ): Promise<IdenticalActivityGroup[]> {
    const activities = await loadEventActivities(organizationId, eventId);
    const filtered = equipmentTypeFilter
      ? activities.filter((a) => a.equipmentType === equipmentTypeFilter)
      : activities;
    return calculateIdenticalActivityProgress(filtered);
  }

  /**
   * Get equipment type drill-down for an event.
   */
  static async getEquipmentDrillDown(
    organizationId: string,
    eventId: string,
    equipmentTypeFilter?: string
  ): Promise<EquipmentTypeDrillDown[]> {
    const activities = await loadEventActivities(organizationId, eventId);
    const filtered = equipmentTypeFilter
      ? activities.filter((a) => a.equipmentType === equipmentTypeFilter)
      : activities;
    return this.buildEquipmentDrillDown(filtered);
  }

  /**
   * Build equipment drill-down from activity data.
   * Groups by equipmentType → asset → activities.
   */
  private static buildEquipmentDrillDown(
    activities: ProgressActivityInput[]
  ): EquipmentTypeDrillDown[] {
    // Group by equipment type
    const byType = new Map<string, ProgressActivityInput[]>();
    for (const act of activities) {
      const eqType = act.equipmentType;
      if (!eqType) continue;
      const list = byType.get(eqType) ?? [];
      list.push(act);
      byType.set(eqType, list);
    }

    const drillDowns: EquipmentTypeDrillDown[] = [];
    for (const [equipmentType, typeActivities] of byType) {
      // Build instances — group by asset
      const byAsset = new Map<string, ProgressActivityInput[]>();
      for (const act of typeActivities) {
        const assetKey = act.assetId ?? act.workpackId ?? act.activityId;
        const list = byAsset.get(assetKey) ?? [];
        list.push(act);
        byAsset.set(assetKey, list);
      }

      const instances: EquipmentInstanceProgress[] = [];
      for (const [assetKey, assetActivities] of byAsset) {
        const firstAct = assetActivities[0];
        instances.push({
          assetId: assetKey,
          assetLabel: firstAct.assetTagNumber ?? firstAct.assetName ?? assetKey.slice(0, 8),
          activities: assetActivities.map((a) => ({
            activityId: a.activityId,
            description: a.description ?? null,
            standardActivityTypeName: a.standardActivityTypeName ?? null,
            progressPercent: a.progressPercent ?? 0,
            status: a.status,
            durationHours: a.durationHours ?? 0,
          })),
          metrics: calculateProgressMetrics(assetActivities),
        });
      }

      // Sort instances by label
      instances.sort((a, b) => a.assetLabel.localeCompare(b.assetLabel));

      drillDowns.push({
        equipmentType,
        instances,
        identicalActivities: calculateIdenticalActivityProgress(typeActivities),
        metrics: calculateProgressMetrics(typeActivities),
      });
    }

    drillDowns.sort((a, b) => a.equipmentType.localeCompare(b.equipmentType));
    return drillDowns;
  }

  /**
   * Get authoritative workpack-level execution progress.
   *
   * Query count: 1
   */
  static async getWorkpackProgress(
    organizationId: string,
    workpackId: string
  ): Promise<ProgressMetrics> {
    const activities = await loadWorkpackActivities(organizationId, workpackId);
    return calculateProgressMetrics(activities);
  }

  /**
   * Recalculate and sync Workpack.overall_progress for all workpacks in an event.
   *
   * This uses the authoritative duration-weighted calculation and writes the
   * result to Workpack.overall_progress for each workpack.
   *
   * SAFETY:
   * - Only writes to Workpack.overall_progress (cached field)
   * - Does NOT mutate Activity.progress_percent
   * - Does NOT mutate any other field
   * - Uses the same calculation as getWorkpackProgress()
   *
   * Query count: 1 (load) + N (updates, one per workpack with changed progress)
   */
  static async recalculateEvent(
    organizationId: string,
    eventId: string
  ): Promise<RecalculationResult> {
    // Load all activities
    const activities = await loadEventActivities(organizationId, eventId);
    const overall = calculateProgressMetrics(activities);

    // Group by workpack and calculate per-workpack progress
    const wpProgress = calculateWorkpackProgress(activities);

    // Load current workpack progress to detect changes
    const workpacks = await prisma.workpack.findMany({
      where: { organization_id: organizationId, event_id: eventId, deleted_at: null },
      select: { id: true, overall_progress: true },
    });

    const currentProgressMap = new Map(workpacks.map((w) => [w.id, w.overall_progress ?? 0]));

    // Only update workpacks where progress has changed
    let synced = 0;
    for (const wp of wpProgress) {
      const currentValue = currentProgressMap.get(wp.key) ?? 0;
      const newValue = wp.metrics.weightedProgress;
      if (currentValue !== newValue) {
        await prisma.workpack.update({
          where: { id: wp.key },
          data: { overall_progress: newValue },
        });
        synced++;
      }
    }

    return {
      eventId,
      workpacksSynced: synced,
      overall,
      calculatedAt: new Date().toISOString(),
    };
  }
}
