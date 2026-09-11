import { prisma } from '@/lib/prisma';
import crypto from 'crypto';
import { ResourcePlanningService } from './ResourcePlanningService';
import { ResourceConstraintService } from './ResourceConstraintService';

export interface ResourceRisk {
  risk_id: string;
  date: string;
  resource_type_id: string;
  resource_type_name: string;
  contractor_id: string | null;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  score: number;
  affected_activities: string[];
  reason: string;
  recommended_action: string;
  project_finish_impact: number;
}

export class ResourceRiskService {
  static async getRisks(
    eventId: string,
    organizationId: string,
    filters?: { startDate?: string; endDate?: string }
  ): Promise<ResourceRisk[]> {
    // We will leverage Constraints and Demand vs Capacity data
    const constraints = await ResourceConstraintService.detectConstraints(eventId, organizationId, filters);
    const rawData = await ResourcePlanningService.getDemandVsCapacity(eventId, organizationId, filters);

    // Filter out shift specific duplicates to focus on daily aggregates
    const dailyData = rawData.filter(d => d.shift === null);

    const activities = await prisma.activity.findMany({
      where: { event_id: eventId, organization_id: organizationId, deleted_at: null },
      select: { id: true, is_critical: true, total_float: true }
    });
    const actMap = new Map(activities.map(a => [a.id, a]));

    const risks: ResourceRisk[] = [];

    // Group constraints by date to easily find multi-resource conflicts
    const constraintsByDate = new Map<string, typeof constraints>();
    for (const c of constraints) {
      if (!constraintsByDate.has(c.date)) constraintsByDate.set(c.date, []);
      constraintsByDate.get(c.date)!.push(c);
    }

    // Process each daily data point that has a deficit or high utilization
    for (const d of dailyData) {
      const util = d.utilization_percent || 0;
      if (util < 90 && d.variance >= 0) continue; // No notable risk

      let score = 0;
      let utilization_risk = 0;
      let deficit_risk = 0;
      let float_risk = 0;
      let critical_activity_risk = 0;
      let consecutive_shortage_risk = 0;
      let multi_resource_risk = 0;

      // 1. Utilization Risk
      if (util > 100) utilization_risk = 50;
      else if (util >= 90) utilization_risk = 20;

      // 2. Deficit Risk
      if (d.variance < 0) {
        deficit_risk = Math.abs(d.variance) * 5; // e.g. 10 headcount deficit = 50 points
      }

      // 3 & 4. Float / Critical Risk
      // Find associated constraint for this date and resource
      const relatedConstraint = constraintsByDate.get(d.date)?.find(c => 
        c.resource_type_id === d.resource_type_id && c.contractor_id === d.contractor_id
      );

      let affected_activities: string[] = [];
      let nearCriticalCount = 0;
      let criticalCount = 0;

      if (relatedConstraint) {
        affected_activities = relatedConstraint.affected_activity_ids;
        for (const actId of affected_activities) {
          const act = actMap.get(actId);
          if (act) {
            if (act.is_critical) {
              criticalCount++;
              critical_activity_risk += 100; // HUGE penalty
            } else if (act.total_float !== null && Number(act.total_float) <= 2) {
              nearCriticalCount++;
              float_risk += 50;
            } else if (act.total_float !== null && Number(act.total_float) <= 5) {
              float_risk += 10;
            }
          }
        }
      }

      // 5. Consecutive shortage risk (look back 3 days and forward 3 days in dailyData)
      let consecutiveCount = 1;
      const dIndex = dailyData.findIndex(x => x === d);
      // forward
      for (let i = dIndex + 1; i < dailyData.length; i++) {
        if (dailyData[i].resource_type_id === d.resource_type_id && dailyData[i].contractor_id === d.contractor_id && dailyData[i].variance < 0) {
          consecutiveCount++;
        } else if (dailyData[i].resource_type_id === d.resource_type_id && dailyData[i].contractor_id === d.contractor_id) {
          break;
        }
      }
      consecutive_shortage_risk = consecutiveCount > 1 ? consecutiveCount * 15 : 0;

      // 6. Multi-resource risk (are there other constraints on this day?)
      const otherConstraintsOnDay = constraintsByDate.get(d.date)?.filter(c => c.resource_type_id !== d.resource_type_id);
      if (otherConstraintsOnDay && otherConstraintsOnDay.length > 0) {
        multi_resource_risk = otherConstraintsOnDay.length * 10;
      }

      score = utilization_risk + deficit_risk + float_risk + critical_activity_risk + consecutive_shortage_risk + multi_resource_risk;

      let severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';
      if (score > 150 || critical_activity_risk > 0 || (util > 100 && consecutiveCount >= 3)) severity = 'CRITICAL';
      else if (score > 80) severity = 'HIGH';
      else if (score > 40) severity = 'MEDIUM';

      // Build Explanation
      let reason = `${d.resource_type_name} utilization is forecast at ${util.toFixed(0)}% for ${d.date}.`;
      if (affected_activities.length > 0) {
        reason += ` ${affected_activities.length} activities are affected`;
        if (criticalCount > 0) reason += `, including ${criticalCount} CRITICAL activity.`;
        else if (nearCriticalCount > 0) reason += `, including ${nearCriticalCount} near-critical activity (${nearCriticalCount} days float or less).`;
        else reason += '.';
      }

      // Recommended Action
      let recommended_action = '';
      if (criticalCount > 0) {
        recommended_action = `Immediate action required: Increase capacity by ${Math.abs(d.variance).toFixed(1)} to protect critical path. DO NOT delay tasks.`;
      } else if (severity === 'CRITICAL') {
        recommended_action = `Run Leveling Simulation to explore delays, or approve ${Math.abs(d.variance).toFixed(1)} additional capacity.`;
      } else if (severity === 'HIGH') {
        recommended_action = `Monitor closely. Consider running a What-If scenario to preemptively shift non-critical float.`;
      } else {
        recommended_action = `No immediate action required. Monitor for schedule drift.`;
      }

      // Project Finish Impact heuristic
      const project_finish_impact = criticalCount > 0 ? (consecutiveCount || 1) : 0;

      risks.push({
        risk_id: crypto.randomUUID(),
        date: d.date,
        resource_type_id: d.resource_type_id,
        resource_type_name: d.resource_type_name || 'Unknown',
        contractor_id: d.contractor_id,
        severity,
        score,
        affected_activities,
        reason,
        recommended_action,
        project_finish_impact
      });
    }

    // Sort by severity and score
    const severityWeight = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
    risks.sort((a, b) => {
       if (severityWeight[a.severity] !== severityWeight[b.severity]) return severityWeight[b.severity] - severityWeight[a.severity];
       return b.score - a.score;
    });

    return risks;
  }
}
