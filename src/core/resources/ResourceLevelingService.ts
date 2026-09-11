import { prisma } from '@/lib/prisma';
import { calculateSchedule, ScheduleActivityInput, ScheduleRelationshipInput } from '@/lib/scheduleEngine';
import { ResourceConstraintService } from './ResourceConstraintService';
import { ResourcePlanningService } from './ResourcePlanningService';
import { ResourceConflictService } from './ResourceConflictService';
import crypto from 'crypto';

export interface LevelingRecommendation {
  activity_id: string;
  activity_name: string;
  current_start: string | null;
  current_end: string | null;
  proposed_start: string;
  proposed_end: string;
  delay_days: number;
  float_before: number;
  float_after: number;
  float_consumed: number;
  resources_affected: string[];
  constraints_resolved: number;
  project_finish_impact: number;
  reason: string;
  status: 'PROPOSED' | 'PROTECTED' | 'REJECTED' | 'UNRESOLVED';
}

export interface LevelingSimulationResult {
  scenario_id: string;
  generated_at: string;
  event_id: string;
  baseline_snapshot: any;
  proposed_changes: LevelingRecommendation[];
  expected_improvement: string;
  constraints_before: number;
  constraints_after: number;
  constraints_resolved: number;
  constraints_remaining: number;
  float_consumed: number;
  project_finish_before: string;
  project_finish_after: string;
  project_finish_impact: number;
  warnings: string[];
}

export class ResourceLevelingService {
  static async generateLevelingRecommendations(
    eventId: string,
    organizationId: string,
    options?: {
      startDate?: string;
      endDate?: string;
      resourceTypeId?: string;
      contractorId?: string;
    }
  ): Promise<LevelingSimulationResult> {
    // 1. Verify Event
    const event = await prisma.event.findFirst({
      where: { id: eventId, organization_id: organizationId },
    });
    if (!event) throw new Error('Event not found or access denied');

    const warnings: string[] = [];
    const proposed_changes: LevelingRecommendation[] = [];

    // 2. Fetch all data for in-memory simulation
    const activitiesRaw = await prisma.activity.findMany({
      where: {
        event_id: eventId,
        organization_id: organizationId,
        deleted_at: null,
        status: { not: 'cancelled' },
      },
      include: {
        resources: true,
      }
    });

    const relationshipsRaw = await prisma.activityRelationship.findMany({
      where: {
        organization_id: organizationId,
        predecessor: { event_id: eventId, deleted_at: null },
        successor: { event_id: eventId, deleted_at: null },
      },
    });

    const capacities = await ResourcePlanningService.listCapacity(eventId, organizationId, options);
    const HOURS_PER_DAY = 10;
    
    // In-memory state of activities
    const simulatedActivities = new Map<string, {
      id: string;
      description: string;
      planned_start: Date | null;
      duration_hours: number;
      resources: any[];
      original_start: Date | null;
      original_end: Date | null;
      original_float: number;
      is_critical: boolean;
      current_float: number;
    }>();

    for (const act of activitiesRaw) {
      simulatedActivities.set(act.id, {
        id: act.id,
        description: act.description,
        planned_start: act.planned_start ? new Date(act.planned_start) : null,
        duration_hours: Number(act.duration_hours || 0),
        resources: act.resources,
        original_start: act.planned_start ? new Date(act.planned_start) : null,
        original_end: act.planned_end ? new Date(act.planned_end) : null,
        original_float: 0,
        is_critical: false,
        current_float: 0,
      });
    }

    const runScheduleCalculation = () => {
      const scheduleInputs: ScheduleActivityInput[] = [];
      for (const [_, a] of simulatedActivities) {
         scheduleInputs.push({
           id: a.id,
           description: a.description,
           duration_hours: a.duration_hours,
           planned_start: a.planned_start?.toISOString(),
         });
      }

      const scheduleRels: ScheduleRelationshipInput[] = relationshipsRaw.map(r => ({
        predecessor_id: r.predecessor_id,
        successor_id: r.successor_id,
        relationship_type: r.relationship_type as any,
        lag_days: r.lag_days ? Number(r.lag_days) : 0,
        lag_minutes: (r as any).lag_minutes != null ? Number((r as any).lag_minutes) : null,
      }));

      return calculateSchedule(scheduleInputs, scheduleRels, { working_hours_per_day: HOURS_PER_DAY });
    };

    // Calculate baseline schedule
    const baselineSchedule = runScheduleCalculation();
    if (!baselineSchedule.success) {
       throw new Error('Baseline schedule calculation failed due to cyclic relationships.');
    }

    // Update base activities with schedule data
    for (const a of baselineSchedule.activities) {
       const sim = simulatedActivities.get(a.id);
       if (sim) {
          sim.original_float = a.total_float_days;
          sim.current_float = a.total_float_days;
          sim.is_critical = a.is_critical;
          if (!sim.original_start && a.early_start) {
             sim.original_start = new Date(a.early_start);
             sim.planned_start = new Date(a.early_start);
             sim.original_end = new Date(a.early_finish);
          }
       }
    }

    const project_finish_before = baselineSchedule.project_finish;

    const calculateConstraints = () => {
      const demandMap = new Map<string, number>();
      for (const [actId, act] of simulatedActivities.entries()) {
        if (!act.planned_start || act.duration_hours <= 0 || act.resources.length === 0) continue;
        
        const start = new Date(act.planned_start);
        start.setUTCHours(0, 0, 0, 0);
        const durationDays = Math.max(1, Math.ceil(act.duration_hours / HOURS_PER_DAY));

        for (const res of act.resources) {
          if (!res.resource_type_id) continue;
          
          let resourceDemandTotal = 0;
          if (res.resource_type === 'machine' || res.resource_type === 'material') {
             resourceDemandTotal = Number(res.quantity || 1);
          } else {
             resourceDemandTotal = (res.headcount || 1) * (res.crew_size || 1);
          }

          const rtId = res.resource_type_id;
          const contractorId = res.contractor_id || 'null';
          
          if (options?.resourceTypeId && rtId !== options.resourceTypeId) continue;
          if (options?.contractorId && contractorId !== options.contractorId) continue;

          for (let day = 0; day < durationDays; day++) {
            const d = new Date(start);
            d.setDate(d.getDate() + day);
            const dateStr = d.toISOString().slice(0, 10);
            const key = `${dateStr}|${rtId}|${contractorId}`;
            demandMap.set(key, (demandMap.get(key) || 0) + resourceDemandTotal);
          }
        }
      }

      const capacityMap = new Map<string, number>();
      for (const cap of capacities) {
        const dateStr = cap.target_date.toISOString().slice(0, 10);
        const rtId = cap.resource_type_id;
        const contractorId = cap.contractor_id || 'null';
        const key = `${dateStr}|${rtId}|${contractorId}`;
        capacityMap.set(key, (capacityMap.get(key) || 0) + Number(cap.capacity_limit));
      }

      const allKeys = new Set([...capacityMap.keys(), ...demandMap.keys()]);
      const simConstraints: any[] = [];
      
      for (const key of allKeys) {
        const [dateStr, rtId, contractorId] = key.split('|');
        const demand = demandMap.get(key) || 0;
        const capacity = capacityMap.get(key) || 0;
        
        let severity = null;
        let constraint_type = null;
        if (capacity === 0 && demand > 0) {
           severity = 'CRITICAL';
           constraint_type = 'HARD_CAPACITY';
        } else if (demand > capacity) {
           severity = 'HIGH';
           constraint_type = 'CAPACITY_OVERLOAD';
        }
        
        if (severity) {
          const affected = [];
          for (const [actId, act] of simulatedActivities.entries()) {
            if (!act.planned_start || act.duration_hours <= 0 || act.resources.length === 0) continue;
            
            const hasResource = act.resources.some((r: any) => 
              r.resource_type_id === rtId && (contractorId === 'null' ? r.contractor_id === null : r.contractor_id === contractorId)
            );
            
            if (hasResource) {
              const start = new Date(act.planned_start);
              start.setUTCHours(0, 0, 0, 0);
              const durationDays = Math.max(1, Math.ceil(act.duration_hours / HOURS_PER_DAY));
              for (let day = 0; day < durationDays; day++) {
                const d = new Date(start);
                d.setDate(d.getDate() + day);
                if (d.toISOString().slice(0, 10) === dateStr) {
                  affected.push(actId);
                  break;
                }
              }
            }
          }
          
          simConstraints.push({
            date: dateStr,
            resource_type_id: rtId,
            contractor_id: contractorId === 'null' ? null : contractorId,
            planned_demand: demand,
            available_capacity: capacity,
            severity,
            constraint_type,
            affected_activity_ids: affected
          });
        }
      }
      return simConstraints;
    };

    let simConstraints = calculateConstraints();
    const constraints_before = simConstraints.length;

    // 4. Leveling Loop
    const MAX_ITERATIONS = 100;
    let iterations = 0;

    while (simConstraints.length > 0 && iterations < MAX_ITERATIONS) {
      iterations++;
      
      const activitiesData = new Map<string, { id: string, name: string, is_critical: boolean, total_float_days: number }>();
      for (const [actId, simAct] of simulatedActivities) {
         activitiesData.set(actId, {
            id: actId,
            name: simAct.description,
            is_critical: simAct.is_critical,
            total_float_days: simAct.current_float
         });
      }

      const candidates = ResourceConflictService.analyzeConflicts(simConstraints as any, activitiesData);

      if (candidates.length === 0) {
        warnings.push('No valid candidates found to resolve remaining constraints (float exhausted or critical path).');
        break;
      }

      const bestCandidate = candidates[0];
      const targetAct = simulatedActivities.get(bestCandidate.activity_id)!;

      // Shift activity by 1 day forward
      const currentStart = targetAct.planned_start!;
      const newStart = new Date(currentStart);
      newStart.setDate(newStart.getDate() + 1);

      targetAct.planned_start = newStart;

      // Recalculate schedule to see float impact and project impact
      const newSchedule = runScheduleCalculation();
      if (!newSchedule.success) {
         warnings.push(`Cycle detected when shifting ${targetAct.description}.`);
         targetAct.planned_start = currentStart; // revert
         simConstraints = simConstraints.filter(c => !c.affected_activity_ids.includes(targetAct.id)); // Ignore to avoid infinite loop
         continue;
      }

      const newTargetActData = newSchedule.activities.find(a => a.id === targetAct.id);
      
      // Update float values across the board
      for (const a of newSchedule.activities) {
         const sim = simulatedActivities.get(a.id);
         if (sim) {
            sim.current_float = a.total_float_days;
            sim.is_critical = a.is_critical;
         }
      }

      // Record recommendation or update existing
      const existingRec = proposed_changes.find(r => r.activity_id === targetAct.id);
      
      const proposedEnd = new Date(newStart.getTime() + targetAct.duration_hours * 3600000);

      const delay_days = existingRec ? existingRec.delay_days + 1 : 1;
      const float_consumed = targetAct.original_float - newTargetActData!.total_float_days;

      if (existingRec) {
        existingRec.proposed_start = newStart.toISOString();
        existingRec.proposed_end = proposedEnd.toISOString();
        existingRec.delay_days = delay_days;
        existingRec.float_after = newTargetActData!.total_float_days;
        existingRec.float_consumed = float_consumed;
        existingRec.constraints_resolved += 1;
      } else {
        proposed_changes.push({
          activity_id: targetAct.id,
          activity_name: targetAct.description,
          current_start: targetAct.original_start?.toISOString() || null,
          current_end: targetAct.original_end?.toISOString() || null,
          proposed_start: newStart.toISOString(),
          proposed_end: proposedEnd.toISOString(),
          delay_days: delay_days,
          float_before: targetAct.original_float,
          float_after: newTargetActData!.total_float_days,
          float_consumed: float_consumed,
          resources_affected: [...new Set(targetAct.resources.map(r => r.resource_type_id))],
          constraints_resolved: 1,
          project_finish_impact: 0,
          reason: bestCandidate.explanation,
          status: 'PROPOSED'
        });
      }

      // Re-evaluate constraints for next loop
      simConstraints = calculateConstraints();
    }
    
    // Final CPM to compute true project finish impact for each recommendation
    const finalSchedule = runScheduleCalculation();
    const project_finish_after = finalSchedule.project_finish;
    const total_finish_impact = (new Date(project_finish_after).getTime() - new Date(project_finish_before).getTime()) / 86400000;

    // Distribute finish impact among recommendations (simplified model for now)
    for (const rec of proposed_changes) {
       rec.project_finish_impact = total_finish_impact;
    }

    const constraints_after = simConstraints.length;

    return {
      scenario_id: crypto.randomUUID(),
      generated_at: new Date().toISOString(),
      event_id: eventId,
      baseline_snapshot: baselineSchedule,
      proposed_changes,
      expected_improvement: `Resolved ${constraints_before - constraints_after} constraints`,
      constraints_before,
      constraints_after,
      constraints_resolved: constraints_before - constraints_after,
      constraints_remaining: constraints_after,
      float_consumed: proposed_changes.reduce((acc, r) => acc + r.float_consumed, 0),
      project_finish_before,
      project_finish_after,
      project_finish_impact: total_finish_impact,
      warnings
    };
  }
}
