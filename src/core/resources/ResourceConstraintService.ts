import { prisma } from '@/lib/prisma';
import { ResourcePlanningService, ResourceActivityInput, DemandVsCapacityResult } from './ResourcePlanningService';
import crypto from 'crypto';

export type ConstraintType = 
  | 'HARD_CAPACITY'
  | 'CAPACITY_OVERLOAD'
  | 'HIGH_UTILIZATION'
  | 'CRITICAL_ACTIVITY_CONFLICT'
  | 'FLOAT_RISK'
  | 'SHIFT_CAPACITY_IMBALANCE'
  | 'MULTI_RESOURCE_CONFLICT'
  | 'PROJECT_FINISH_RISK'
  | 'DEPENDENCY_BLOCK';

export type ConstraintSeverity = 'INFO' | 'WARNING' | 'HIGH' | 'CRITICAL';

export interface AffectedActivity {
  id: string;
  /** Mapped from Activity.description (schema field) */
  name: string;
  is_critical: boolean;
  /** Mapped from Activity.total_float (schema field) */
  total_float_days: number;
}

export interface ResourceConstraint {
  constraint_id: string;
  event_id: string;
  date: string;
  resource_type_id: string;
  resource_type_name?: string;
  shift_id: string | null;
  contractor_id: string | null;
  planned_demand: number;
  available_capacity: number;
  variance: number;
  utilization_percent: number | null;
  constraint_type: ConstraintType;
  severity: ConstraintSeverity;
  affected_activity_ids: string[];
  critical_activity_ids: string[];
  total_float_min: number | null;
  recommended_action: string | null;
  project_finish_impact: number | null; // left null until simulation
  
  // Keep these for backward compatibility with existing tests during migration
  affected_activities: AffectedActivity[];
  levelable_activities: AffectedActivity[];
  critical_activities: AffectedActivity[];
}

export class ResourceConstraintService {
  /**
   * Pure Resource Constraint Analysis Engine (In-Memory / Deterministic)
   */
  static analyzeConstraints(options: {
    eventId: string;
    activities: ResourceActivityInput[];
    loadingResults: DemandVsCapacityResult[];
  }): ResourceConstraint[] {
    const { eventId, activities, loadingResults } = options;
    const HOURS_PER_DAY = 10;
    const constraints: ResourceConstraint[] = [];

    for (const res of loadingResults) {
      if (res.shift !== null) continue; // Only process daily aggregate for now, as activities are not shift-bound

      let constraint_type: ConstraintType | null = null;
      let severity: ConstraintSeverity | null = null;

      if (res.available_capacity === 0 && res.planned_demand > 0) {
        constraint_type = 'HARD_CAPACITY';
        severity = 'CRITICAL';
      } else if (res.planned_demand > res.available_capacity) {
        constraint_type = 'CAPACITY_OVERLOAD';
        severity = 'HIGH';
      } else if (res.utilization_percent !== null && res.utilization_percent >= 90) {
        constraint_type = 'HIGH_UTILIZATION';
        severity = 'INFO';
      }

      if (constraint_type === null || severity === null) continue; // Not a constraint

      // Find affected activities
      const affectedActivities: AffectedActivity[] = [];
      const criticalActivities: AffectedActivity[] = [];
      const levelableActivities: AffectedActivity[] = [];
      
      const constraintDate = res.date;

      for (const act of activities) {
        if (!act.planned_start || !act.duration_hours || !act.resources || act.resources.length === 0) continue;

        const hasResource = act.resources.some(r => 
          r.resource_type_id === res.resource_type_id &&
          (res.contractor_id === null || r.contractor_id === res.contractor_id)
        );

        if (!hasResource) continue;

        const start = new Date(act.planned_start);
        start.setUTCHours(0, 0, 0, 0);
        const durationDays = Math.max(1, Math.ceil(Number(act.duration_hours) / HOURS_PER_DAY));

        for (let day = 0; day < durationDays; day++) {
          const d = new Date(start);
          d.setDate(d.getDate() + day);
          const dateStr = d.toISOString().slice(0, 10);
          if (dateStr === constraintDate) {
            const totalFloatDays = Number(act.total_float ?? (act as any).total_float_days ?? 0);
            const isCritical = Boolean(act.is_critical);
            const actId = act.id || '';
            const actName = act.description || (act as any).name || '';

            const mappedAct: AffectedActivity = {
              id: actId,
              name: actName,
              is_critical: isCritical,
              total_float_days: totalFloatDays
            };
            affectedActivities.push(mappedAct);
            if (mappedAct.is_critical || mappedAct.total_float_days <= 0) {
              criticalActivities.push(mappedAct);
            } else {
              levelableActivities.push(mappedAct);
            }
            break;
          }
        }
      }

      // Check if it's a critical activity conflict
      if (criticalActivities.length > 0 && severity !== 'INFO') {
        constraint_type = 'CRITICAL_ACTIVITY_CONFLICT';
        severity = 'CRITICAL';
      }

      // Check float risk
      let minFloat = null;
      if (affectedActivities.length > 0) {
        minFloat = Math.min(...affectedActivities.map(a => a.total_float_days));
        if (minFloat <= 2 && minFloat > 0 && severity !== 'CRITICAL') {
          constraint_type = 'FLOAT_RISK';
          severity = 'WARNING';
        }
      }

      let recommended_action = null;
      if (constraint_type === 'CRITICAL_ACTIVITY_CONFLICT') {
        recommended_action = 'Increase capacity or authorize overtime; leveling cannot automatically delay critical activities.';
      } else if (constraint_type === 'HARD_CAPACITY') {
        recommended_action = 'Assign resource capacity to this date or delay activities.';
      } else if (constraint_type === 'FLOAT_RISK') {
        recommended_action = 'Delay with caution; float is low.';
      }

      constraints.push({
        constraint_id: crypto.randomUUID(),
        event_id: eventId,
        date: res.date,
        resource_type_id: res.resource_type_id,
        resource_type_name: res.resource_type_name,
        contractor_id: res.contractor_id,
        shift_id: res.shift,
        planned_demand: res.planned_demand,
        available_capacity: res.available_capacity,
        variance: res.variance,
        utilization_percent: res.utilization_percent,
        constraint_type,
        severity,
        affected_activity_ids: affectedActivities.map(a => a.id),
        critical_activity_ids: criticalActivities.map(a => a.id),
        total_float_min: minFloat,
        recommended_action,
        project_finish_impact: null,
        affected_activities: affectedActivities,
        levelable_activities: levelableActivities,
        critical_activities: criticalActivities
      });
    }

    return constraints;
  }

  /**
   * Live Database Constraint Detection (M8.7 / M8.8 compatible)
   */
  static async detectConstraints(
    eventId: string,
    organizationId: string,
    filters?: {
      startDate?: string;
      endDate?: string;
      resourceTypeId?: string;
      contractorId?: string;
    }
  ): Promise<ResourceConstraint[]> {
    // Enforce Event / Organization ownership
    const event = await prisma.event.findFirst({
      where: { id: eventId, organization_id: organizationId },
    });
    if (!event) throw new Error('Event not found or access denied');

    const loadingResults = await ResourcePlanningService.getDemandVsCapacity(eventId, organizationId, filters);

    // Fetch activities to map affected ones
    const activities = await prisma.activity.findMany({
      where: {
        event_id: eventId,
        organization_id: organizationId,
        deleted_at: null,
        status: { not: 'cancelled' },
        planned_start: { not: null },
        duration_hours: { not: null, gt: 0 }
      },
      select: {
        id: true,
        description: true,
        planned_start: true,
        duration_hours: true,
        is_critical: true,
        total_float: true,
        resources: {
          select: {
            resource_type_id: true,
            contractor_id: true,
            planned_hours: true,
            headcount: true,
            crew_size: true,
            resource_type: true,
            quantity: true
          }
        }
      }
    });

    return this.analyzeConstraints({
      eventId,
      activities,
      loadingResults
    });
  }
}

