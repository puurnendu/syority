import { prisma } from '@/lib/prisma';
import { ResourcePlanningService } from './ResourcePlanningService';
import { ResourceConstraintService } from './ResourceConstraintService';

export interface ResourceKpiSummary {
  resource_type_id?: string;
  resource_type_name?: string;
  contractor_id?: string;
  planned_demand: number;
  available_capacity: number;
  deficit: number;
  surplus: number;
  utilization_percent: number;
  peak_utilization: number;
  overloaded_days: number;
  hard_capacity_shortages: number;
  near_capacity_days: number;
  max_daily_deficit: number;
  max_consecutive_shortage_days: number;
  risk_level: 'NORMAL' | 'WATCH' | 'AT_RISK' | 'CRITICAL';
}

export interface ProjectResourceKpis {
  total_demand: number;
  total_capacity: number;
  total_deficit: number;
  total_surplus: number;
  average_utilization: number;
  peak_utilization: number;
  overloaded_days: number;
  hard_capacity_shortages: number;
  critical_resource_conflicts: number;
  near_capacity_days: number;
  max_daily_deficit: number;
  max_consecutive_shortage_days: number;
  affected_activities_count: number;
  affected_critical_activities_count: number;
  resource_types_at_risk: number;
  contractors_at_risk: number;
  by_resource: ResourceKpiSummary[];
}

export class ResourceKpiService {
  static async getEventKpis(
    eventId: string,
    organizationId: string,
    filters?: { startDate?: string; endDate?: string }
  ): Promise<ProjectResourceKpis> {
    const rawData = await ResourcePlanningService.getDemandVsCapacity(eventId, organizationId, filters);
    const constraints = await ResourceConstraintService.detectConstraints(eventId, organizationId, filters);

    let total_demand = 0;
    let total_capacity = 0;
    let total_deficit = 0;
    let total_surplus = 0;
    let peak_utilization = 0;
    let overloaded_days = new Set<string>();
    let hard_capacity_shortages = 0;
    let near_capacity_days = 0;
    let max_daily_deficit = 0;

    const resourceMap = new Map<string, any>(); // key = resource_type_id + | + contractor_id

    for (const point of rawData) {
      // Exclude shift-specific duplicates if they are just breakdowns of the daily total
      // getDemandVsCapacity returns both daily aggregate (shift=null) and shift-specific data.
      // We should only sum the daily aggregates to avoid double counting.
      if (point.shift !== null) continue;

      total_demand += point.planned_demand;
      total_capacity += point.available_capacity;

      if (point.variance < 0) {
        total_deficit += Math.abs(point.variance);
        overloaded_days.add(point.date);
        max_daily_deficit = Math.max(max_daily_deficit, Math.abs(point.variance));
        if (point.available_capacity === 0) hard_capacity_shortages++;
      } else {
        total_surplus += point.variance;
      }

      const util = point.utilization_percent || 0;
      if (util > peak_utilization) peak_utilization = util;

      if (util >= 90 && util <= 100) {
        near_capacity_days++;
      }

      // Group by resource
      const key = `${point.resource_type_id}|${point.contractor_id || 'null'}`;
      if (!resourceMap.has(key)) {
        resourceMap.set(key, {
          resource_type_id: point.resource_type_id,
          resource_type_name: point.resource_type_name,
          contractor_id: point.contractor_id,
          planned_demand: 0,
          available_capacity: 0,
          deficit: 0,
          surplus: 0,
          peak_utilization: 0,
          overloaded_days_set: new Set<string>(),
          hard_capacity_shortages: 0,
          near_capacity_days: 0,
          max_daily_deficit: 0,
          dates_with_deficit: [] as string[]
        });
      }

      const rm = resourceMap.get(key);
      rm.planned_demand += point.planned_demand;
      rm.available_capacity += point.available_capacity;
      if (point.variance < 0) {
        rm.deficit += Math.abs(point.variance);
        rm.overloaded_days_set.add(point.date);
        rm.dates_with_deficit.push(point.date);
        rm.max_daily_deficit = Math.max(rm.max_daily_deficit, Math.abs(point.variance));
        if (point.available_capacity === 0) rm.hard_capacity_shortages++;
      } else {
        rm.surplus += point.variance;
      }
      if (util > rm.peak_utilization) rm.peak_utilization = util;
      if (util >= 90 && util <= 100) rm.near_capacity_days++;
    }

    // Process distinct affected activities from constraints
    const affectedActivities = new Set<string>();
    const affectedCriticalActivities = new Set<string>();
    let critical_resource_conflicts = 0;

    // To know which activities are critical, we need to fetch them
    const activities = await prisma.activity.findMany({
      where: { event_id: eventId, organization_id: organizationId, deleted_at: null },
      select: { id: true, is_critical: true, total_float: true }
    });
    const actMap = new Map(activities.map(a => [a.id, a]));

    for (const c of constraints) {
      if (c.severity === 'CRITICAL') critical_resource_conflicts++;
      for (const actId of c.affected_activity_ids) {
        affectedActivities.add(actId);
        const act = actMap.get(actId);
        if (act && (act.is_critical || (act.total_float !== null && Number(act.total_float) <= 2))) {
          affectedCriticalActivities.add(actId);
        }
      }
    }

    const by_resource: ResourceKpiSummary[] = [];
    let resource_types_at_risk = 0;
    let contractors_at_risk = new Set<string>();
    let global_max_consecutive = 0;

    for (const [key, rm] of resourceMap.entries()) {
      // Calculate max consecutive shortage days for this resource
      rm.dates_with_deficit.sort();
      let max_consecutive = 0;
      let current_consecutive = 0;
      let prevDate: Date | null = null;
      for (const dateStr of rm.dates_with_deficit) {
        const d = new Date(dateStr);
        if (prevDate) {
          const diff = (d.getTime() - prevDate.getTime()) / 86400000;
          if (diff === 1) {
            current_consecutive++;
          } else {
            if (current_consecutive > max_consecutive) max_consecutive = current_consecutive;
            current_consecutive = 1;
          }
        } else {
          current_consecutive = 1;
        }
        prevDate = d;
      }
      if (current_consecutive > max_consecutive) max_consecutive = current_consecutive;
      if (max_consecutive > global_max_consecutive) global_max_consecutive = max_consecutive;

      const util = rm.available_capacity > 0 ? (rm.planned_demand / rm.available_capacity) * 100 : (rm.planned_demand > 0 ? 100 : 0);
      
      let risk_level: 'NORMAL' | 'WATCH' | 'AT_RISK' | 'CRITICAL' = 'NORMAL';
      if (util >= 100 || rm.deficit > 0) risk_level = 'CRITICAL';
      else if (util >= 90) risk_level = 'AT_RISK';
      else if (util >= 80) risk_level = 'WATCH';

      if (risk_level === 'CRITICAL' || risk_level === 'AT_RISK') {
        resource_types_at_risk++;
        if (rm.contractor_id && rm.contractor_id !== 'null') {
          contractors_at_risk.add(rm.contractor_id);
        }
      }

      by_resource.push({
        resource_type_id: rm.resource_type_id,
        resource_type_name: rm.resource_type_name,
        contractor_id: rm.contractor_id === 'null' ? null : rm.contractor_id,
        planned_demand: Number(rm.planned_demand.toFixed(2)),
        available_capacity: Number(rm.available_capacity.toFixed(2)),
        deficit: Number(rm.deficit.toFixed(2)),
        surplus: Number(rm.surplus.toFixed(2)),
        utilization_percent: Number(util.toFixed(2)),
        peak_utilization: Number(rm.peak_utilization.toFixed(2)),
        overloaded_days: rm.overloaded_days_set.size,
        hard_capacity_shortages: rm.hard_capacity_shortages,
        near_capacity_days: rm.near_capacity_days,
        max_daily_deficit: Number(rm.max_daily_deficit.toFixed(2)),
        max_consecutive_shortage_days: max_consecutive,
        risk_level
      });
    }

    const average_utilization = total_capacity > 0 ? (total_demand / total_capacity) * 100 : (total_demand > 0 ? 100 : 0);

    return {
      total_demand: Number(total_demand.toFixed(2)),
      total_capacity: Number(total_capacity.toFixed(2)),
      total_deficit: Number(total_deficit.toFixed(2)),
      total_surplus: Number(total_surplus.toFixed(2)),
      average_utilization: Number(average_utilization.toFixed(2)),
      peak_utilization: Number(peak_utilization.toFixed(2)),
      overloaded_days: overloaded_days.size,
      hard_capacity_shortages,
      critical_resource_conflicts,
      near_capacity_days,
      max_daily_deficit: Number(max_daily_deficit.toFixed(2)),
      max_consecutive_shortage_days: global_max_consecutive,
      affected_activities_count: affectedActivities.size,
      affected_critical_activities_count: affectedCriticalActivities.size,
      resource_types_at_risk,
      contractors_at_risk: contractors_at_risk.size,
      by_resource
    };
  }
}
