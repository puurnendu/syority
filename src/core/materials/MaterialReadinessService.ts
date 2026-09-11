/**
 * M8.12 — Material Readiness Service
 *
 * Pure computation service for calculating material readiness status
 * from supply chain data. Reads material lines, supply records, and
 * computes readiness status, constraint dates, and readiness percentages.
 *
 * Architecture: Read-heavy, write-light.
 * This service DOES NOT modify Activity, Workpack, or Schedule data.
 */
import { prisma } from '@/lib/prisma';

// ── Types ──────────────────────────────────────────────────────────────

export type ReadinessStatus = 'ready' | 'partial' | 'not_ready' | 'blocked' | 'not_assessed';

export interface MaterialReadinessResult {
  material_line_id: string;
  description: string;
  is_critical: boolean;
  quantity_required: number;
  quantity_available: number;
  quantity_on_order: number;
  quantity_shortfall: number;
  readiness_status: ReadinessStatus;
  readiness_percent: number;
  earliest_eta: string | null;       // ISO date
  constraint_date: string | null;    // ISO date — null if ready
}

export interface ActivityReadinessResult {
  activity_id: string;
  description: string;
  workpack_id: string | null;
  total_materials: number;
  ready_count: number;
  partial_count: number;
  not_ready_count: number;
  blocked_count: number;
  overall_status: ReadinessStatus;
  overall_readiness_percent: number;
  constraint_date: string | null;    // Binding material constraint date
  material_details: MaterialReadinessResult[];
}

export interface EventReadinessSummary {
  event_id: string;
  total_activities_with_materials: number;
  ready_count: number;
  partial_count: number;
  not_ready_count: number;
  blocked_count: number;
  overall_readiness_percent: number;
  critical_constraints: {
    activity_id: string;
    activity_description: string;
    constraint_date: string | null;
    impact_days: number;
  }[];
}

// ── Service ────────────────────────────────────────────────────────────

export class MaterialReadinessService {

  /**
   * Calculate readiness for a single material line from its supply records.
   */
  static calculateLineReadiness(line: {
    id: string;
    description: string;
    is_critical: boolean;
    quantity_required: number;
    quantity_available: number;
    quantity_on_order: number;
    expected_eta: Date | null;
    supply_records: {
      quantity_ordered: number;
      quantity_received: number;
      expected_delivery: Date | null;
      delivery_status: string;
    }[];
  }): MaterialReadinessResult {
    // Aggregate supply data
    let totalOrdered = line.quantity_on_order;
    let totalReceived = line.quantity_available;
    let latestEta: Date | null = line.expected_eta;

    for (const sr of line.supply_records) {
      // If supply records have more recent data, use them
      if (sr.expected_delivery && (!latestEta || sr.expected_delivery > latestEta)) {
        if (sr.delivery_status !== 'cancelled' && sr.delivery_status !== 'received') {
          latestEta = sr.expected_delivery;
        }
      }
    }

    const shortfall = Math.max(0, line.quantity_required - totalReceived);
    const readinessPercent = line.quantity_required > 0
      ? Math.min(100, (Math.min(totalReceived, line.quantity_required) / line.quantity_required) * 100)
      : 100;

    let status: ReadinessStatus;
    let constraintDate: string | null = null;

    if (shortfall <= 0) {
      status = 'ready';
    } else if (totalReceived > 0 && totalReceived < line.quantity_required) {
      status = 'partial';
      if (latestEta) {
        constraintDate = latestEta.toISOString().slice(0, 10);
      } else if (totalOrdered >= shortfall) {
        status = 'not_ready'; // Ordered but no ETA
      } else {
        status = 'blocked'; // Not enough ordered and no ETA
      }
    } else if (totalOrdered >= shortfall && latestEta) {
      status = 'not_ready';
      constraintDate = latestEta.toISOString().slice(0, 10);
    } else if (totalOrdered >= shortfall) {
      status = 'not_ready'; // Ordered but no ETA
    } else {
      status = 'blocked'; // Nothing ordered, nothing available
    }

    return {
      material_line_id: line.id,
      description: line.description,
      is_critical: line.is_critical,
      quantity_required: line.quantity_required,
      quantity_available: totalReceived,
      quantity_on_order: totalOrdered,
      quantity_shortfall: shortfall,
      readiness_status: status,
      readiness_percent: Math.round(readinessPercent * 10) / 10,
      earliest_eta: latestEta ? latestEta.toISOString().slice(0, 10) : null,
      constraint_date: constraintDate,
    };
  }

  /**
   * Calculate material readiness for a specific activity.
   */
  static async calculateActivityReadiness(
    activityId: string,
    orgId: string
  ): Promise<ActivityReadinessResult> {
    // Find the activity
    const activity = await prisma.activity.findFirst({
      where: { id: activityId, organization_id: orgId },
      select: { id: true, description: true, workpack_id: true },
    });

    if (!activity) {
      throw new Error('Activity not found or access denied');
    }

    // Get material lines linked to this activity's workpack
    const materialLines = activity.workpack_id
      ? await prisma.workpack_material_lines.findMany({
          where: {
            workpack_id: activity.workpack_id,
            deleted_at: null,
          },
          include: {
            supply_records: {
              where: { delivery_status: { not: 'cancelled' } },
            },
          },
        })
      : [];

    if (materialLines.length === 0) {
      return {
        activity_id: activity.id,
        description: activity.description,
        workpack_id: activity.workpack_id,
        total_materials: 0,
        ready_count: 0,
        partial_count: 0,
        not_ready_count: 0,
        blocked_count: 0,
        overall_status: 'not_assessed',
        overall_readiness_percent: 100,
        constraint_date: null,
        material_details: [],
      };
    }

    const details: MaterialReadinessResult[] = materialLines.map((ml) =>
      this.calculateLineReadiness({
        id: ml.id,
        description: ml.description,
        is_critical: ml.is_critical,
        quantity_required: ml.quantity_required,
        quantity_available: ml.quantity_available,
        quantity_on_order: ml.quantity_on_order,
        expected_eta: ml.expected_eta,
        supply_records: ml.supply_records.map((sr) => ({
          quantity_ordered: sr.quantity_ordered,
          quantity_received: sr.quantity_received,
          expected_delivery: sr.expected_delivery,
          delivery_status: sr.delivery_status,
        })),
      })
    );

    const readyCount = details.filter((d) => d.readiness_status === 'ready').length;
    const partialCount = details.filter((d) => d.readiness_status === 'partial').length;
    const notReadyCount = details.filter((d) => d.readiness_status === 'not_ready').length;
    const blockedCount = details.filter((d) => d.readiness_status === 'blocked').length;

    // Binding constraint = latest constraint_date among CRITICAL materials
    const criticalConstraints = details
      .filter((d) => d.is_critical && d.constraint_date)
      .map((d) => d.constraint_date!)
      .sort();
    const bindingConstraint = criticalConstraints.length > 0
      ? criticalConstraints[criticalConstraints.length - 1]
      : null;

    // Overall readiness percent
    const totalRequired = details.reduce((s, d) => s + d.quantity_required, 0);
    const totalAvailable = details.reduce((s, d) => s + Math.min(d.quantity_available, d.quantity_required), 0);
    const overallPercent = totalRequired > 0 ? (totalAvailable / totalRequired) * 100 : 100;

    // Overall status
    let overallStatus: ReadinessStatus;
    if (blockedCount > 0) overallStatus = 'blocked';
    else if (notReadyCount > 0) overallStatus = 'not_ready';
    else if (partialCount > 0) overallStatus = 'partial';
    else overallStatus = 'ready';

    return {
      activity_id: activity.id,
      description: activity.description,
      workpack_id: activity.workpack_id,
      total_materials: details.length,
      ready_count: readyCount,
      partial_count: partialCount,
      not_ready_count: notReadyCount,
      blocked_count: blockedCount,
      overall_status: overallStatus,
      overall_readiness_percent: Math.round(overallPercent * 10) / 10,
      constraint_date: bindingConstraint,
      material_details: details,
    };
  }

  /**
   * Calculate readiness summary for an entire event.
   */
  static async calculateEventReadiness(
    eventId: string,
    orgId: string
  ): Promise<EventReadinessSummary> {
    // Get all activities for this event that have workpacks with materials
    const activities = await prisma.activity.findMany({
      where: {
        event_id: eventId,
        organization_id: orgId,
        deleted_at: null,
        workpack_id: { not: null },
      },
      select: { id: true, description: true, workpack_id: true, planned_start: true },
    });

    let readyCount = 0;
    let partialCount = 0;
    let notReadyCount = 0;
    let blockedCount = 0;
    let activitiesWithMaterials = 0;
    const criticalConstraints: EventReadinessSummary['critical_constraints'] = [];
    let totalRequired = 0;
    let totalAvailable = 0;

    // Batch-load material lines for all workpacks
    const workpackIds = [...new Set(activities.map((a) => a.workpack_id!).filter(Boolean))];
    const allMaterialLines = workpackIds.length > 0
      ? await prisma.workpack_material_lines.findMany({
          where: { workpack_id: { in: workpackIds }, deleted_at: null },
          include: {
            supply_records: { where: { delivery_status: { not: 'cancelled' } } },
          },
        })
      : [];

    // Group by workpack
    const linesByWorkpack = new Map<string, typeof allMaterialLines>();
    for (const ml of allMaterialLines) {
      const arr = linesByWorkpack.get(ml.workpack_id) || [];
      arr.push(ml);
      linesByWorkpack.set(ml.workpack_id, arr);
    }

    for (const activity of activities) {
      const lines = linesByWorkpack.get(activity.workpack_id!) || [];
      if (lines.length === 0) continue;
      activitiesWithMaterials++;

      const details = lines.map((ml) =>
        this.calculateLineReadiness({
          id: ml.id,
          description: ml.description,
          is_critical: ml.is_critical,
          quantity_required: ml.quantity_required,
          quantity_available: ml.quantity_available,
          quantity_on_order: ml.quantity_on_order,
          expected_eta: ml.expected_eta,
          supply_records: ml.supply_records.map((sr) => ({
            quantity_ordered: sr.quantity_ordered,
            quantity_received: sr.quantity_received,
            expected_delivery: sr.expected_delivery,
            delivery_status: sr.delivery_status,
          })),
        })
      );

      const hasBlocked = details.some((d) => d.readiness_status === 'blocked');
      const hasNotReady = details.some((d) => d.readiness_status === 'not_ready');
      const hasPartial = details.some((d) => d.readiness_status === 'partial');

      if (hasBlocked) blockedCount++;
      else if (hasNotReady) notReadyCount++;
      else if (hasPartial) partialCount++;
      else readyCount++;

      // Constraint calculation
      const critDates = details
        .filter((d) => d.is_critical && d.constraint_date)
        .map((d) => d.constraint_date!);
      const bindingDate = critDates.length > 0 ? critDates.sort().reverse()[0] : null;

      if (bindingDate && activity.planned_start) {
        const plannedMs = new Date(activity.planned_start).getTime();
        const constraintMs = new Date(bindingDate).getTime();
        const impactDays = Math.max(0, (constraintMs - plannedMs) / (86400000));

        if (impactDays > 0) {
          criticalConstraints.push({
            activity_id: activity.id,
            activity_description: activity.description,
            constraint_date: bindingDate,
            impact_days: Math.round(impactDays * 10) / 10,
          });
        }
      }

      totalRequired += details.reduce((s, d) => s + d.quantity_required, 0);
      totalAvailable += details.reduce((s, d) => s + Math.min(d.quantity_available, d.quantity_required), 0);
    }

    const overallPercent = totalRequired > 0 ? (totalAvailable / totalRequired) * 100 : 100;

    // Sort critical constraints by impact days descending
    criticalConstraints.sort((a, b) => b.impact_days - a.impact_days);

    return {
      event_id: eventId,
      total_activities_with_materials: activitiesWithMaterials,
      ready_count: readyCount,
      partial_count: partialCount,
      not_ready_count: notReadyCount,
      blocked_count: blockedCount,
      overall_readiness_percent: Math.round(overallPercent * 10) / 10,
      critical_constraints: criticalConstraints.slice(0, 20), // Top 20
    };
  }

  /**
   * Recalculate and persist MaterialConstraint records for an event.
   */
  static async recalculateConstraints(eventId: string, orgId: string): Promise<number> {
    const activities = await prisma.activity.findMany({
      where: {
        event_id: eventId,
        organization_id: orgId,
        deleted_at: null,
        workpack_id: { not: null },
      },
      select: { id: true, workpack_id: true, planned_start: true },
    });

    const workpackIds = [...new Set(activities.map((a) => a.workpack_id!).filter(Boolean))];
    const allLines = workpackIds.length > 0
      ? await prisma.workpack_material_lines.findMany({
          where: { workpack_id: { in: workpackIds }, deleted_at: null, is_critical: true },
          include: {
            supply_records: { where: { delivery_status: { not: 'cancelled' } } },
          },
        })
      : [];

    const linesByWorkpack = new Map<string, typeof allLines>();
    for (const ml of allLines) {
      const arr = linesByWorkpack.get(ml.workpack_id) || [];
      arr.push(ml);
      linesByWorkpack.set(ml.workpack_id, arr);
    }

    let constraintsWritten = 0;

    for (const activity of activities) {
      const lines = linesByWorkpack.get(activity.workpack_id!) || [];
      if (lines.length === 0) continue;

      for (const ml of lines) {
        const result = this.calculateLineReadiness({
          id: ml.id,
          description: ml.description,
          is_critical: ml.is_critical,
          quantity_required: ml.quantity_required,
          quantity_available: ml.quantity_available,
          quantity_on_order: ml.quantity_on_order,
          expected_eta: ml.expected_eta,
          supply_records: ml.supply_records.map((sr) => ({
            quantity_ordered: sr.quantity_ordered,
            quantity_received: sr.quantity_received,
            expected_delivery: sr.expected_delivery,
            delivery_status: sr.delivery_status,
          })),
        });

        // Determine if binding
        let impactDays = 0;
        const isBinding = result.constraint_date != null && activity.planned_start != null;
        if (isBinding) {
          const constraintMs = new Date(result.constraint_date!).getTime();
          const plannedMs = new Date(activity.planned_start!).getTime();
          impactDays = Math.max(0, (constraintMs - plannedMs) / 86400000);
        }

        await prisma.materialConstraint.upsert({
          where: {
            activity_id_material_line_id: {
              activity_id: activity.id,
              material_line_id: ml.id,
            },
          },
          create: {
            organization_id: orgId,
            event_id: eventId,
            activity_id: activity.id,
            workpack_id: activity.workpack_id,
            material_line_id: ml.id,
            constraint_type: 'material_eta',
            constraint_date: result.constraint_date ? new Date(result.constraint_date) : null,
            readiness_status: result.readiness_status,
            readiness_percent: result.readiness_percent,
            quantity_required: result.quantity_required,
            quantity_available: result.quantity_available,
            quantity_on_order: result.quantity_on_order,
            earliest_eta: result.earliest_eta ? new Date(result.earliest_eta) : null,
            is_binding: impactDays > 0,
            is_critical_material: result.is_critical,
            impact_days: impactDays,
            last_calculated_at: new Date(),
          },
          update: {
            constraint_date: result.constraint_date ? new Date(result.constraint_date) : null,
            readiness_status: result.readiness_status,
            readiness_percent: result.readiness_percent,
            quantity_required: result.quantity_required,
            quantity_available: result.quantity_available,
            quantity_on_order: result.quantity_on_order,
            earliest_eta: result.earliest_eta ? new Date(result.earliest_eta) : null,
            is_binding: impactDays > 0,
            is_critical_material: result.is_critical,
            impact_days: impactDays,
            last_calculated_at: new Date(),
          },
        });
        constraintsWritten++;
      }
    }

    return constraintsWritten;
  }
}
