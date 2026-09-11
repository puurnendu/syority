import { ResourceConstraint } from './ResourceConstraintService';

export interface ConflictScoreCandidate {
  activity_id: string;
  activity_name: string;
  constrained_resource_count: number;
  total_deficit: number;
  downstream_constraint_count: number;
  float_available: number;
  score: number;
  explanation: string;
}

export class ResourceConflictService {
  /**
   * Generates a deterministic ranking of leveling candidates.
   * 
   * Scoring formula:
   * ConflictScore = (constrainedResourceCount * 100) + normalizedDeficit + downstreamConstraintCount + (float_available)
   * Note: We want to sort descending on score (higher score = better candidate to delay), 
   * so float_available should be positive (more float = better to delay).
   */
  static analyzeConflicts(
    constraints: ResourceConstraint[],
    activitiesData: Map<string, { id: string, name: string, is_critical: boolean, total_float_days: number }>
  ): ConflictScoreCandidate[] {
    
    // Map activity ID -> constraints it contributes to
    const activityToConstraints = new Map<string, ResourceConstraint[]>();

    for (const constraint of constraints) {
      if (constraint.severity !== 'CRITICAL' && constraint.severity !== 'HIGH') {
         continue; // Only focus on hard overloads
      }
      for (const actId of constraint.affected_activity_ids) {
        if (!activityToConstraints.has(actId)) {
          activityToConstraints.set(actId, []);
        }
        activityToConstraints.get(actId)!.push(constraint);
      }
    }

    const candidates: ConflictScoreCandidate[] = [];

    for (const [actId, relatedConstraints] of activityToConstraints.entries()) {
      const act = activitiesData.get(actId);
      if (!act) continue;

      if (act.is_critical || act.total_float_days <= 0) {
        continue; // DO NOT recommend delaying critical or negative float activities
      }

      // 1. How many distinct constrained resources does this activity consume?
      const distinctResources = new Set(relatedConstraints.map(c => c.resource_type_id));
      const constrained_resource_count = distinctResources.size;

      // 2. What is the total deficit magnitude across these constraints?
      const total_deficit = relatedConstraints.reduce((acc, c) => acc + Math.max(0, c.planned_demand - c.available_capacity), 0);
      
      // 3. How many downstream constraints are there? (Proxy: total constraint occurrences over time)
      const downstream_constraint_count = relatedConstraints.length;

      const float_available = act.total_float_days;

      // Penalty for near-critical
      let float_score = float_available;
      if (float_available <= 2) {
         float_score -= 1000; // Strong penalty to avoid picking near-critical
      }

      const score = 
        (constrained_resource_count * 100) + 
        total_deficit + 
        (downstream_constraint_count * 10) + 
        float_score;

      const explanation = `Activity ${act.name} is recommended because it consumes ${constrained_resource_count} constrained resources and moving it resolves ${downstream_constraint_count} constraint instances while having ${float_available} days of available float.`;

      candidates.push({
        activity_id: actId,
        activity_name: act.name,
        constrained_resource_count,
        total_deficit,
        downstream_constraint_count,
        float_available,
        score,
        explanation
      });
    }

    // Sort Descending on score (Highest score = best candidate)
    // Deterministic tie-breaker on activity_id
    candidates.sort((a, b) => {
      if (a.score !== b.score) return b.score - a.score;
      return a.activity_id.localeCompare(b.activity_id);
    });

    return candidates;
  }
}
