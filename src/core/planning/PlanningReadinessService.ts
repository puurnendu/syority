/**
 * M10 — Planning Readiness Service
 *
 * Orchestration-only layer. Computes per-workpack planning readiness
 * by reading existing authoritative data:
 *
 *   Workpack.readiness_score  → Cached 12-criteria weighted readiness
 *   workpack_material_lines   → Material availability status
 *   Activity model            → Duration, logic, schedule data
 *   ActivityResource model    → Resource assignment
 *   Constraint model          → Open constraints
 *
 * This service does NOT duplicate any existing engine or service.
 * It is a pure read/orchestration service.
 */
import { prisma } from '@/lib/prisma';

// ── Types ──────────────────────────────────────────────────────────────────────

export type PlanningReadinessState = 'NOT_READY' | 'READY' | 'SCHEDULED' | 'BASELINED';

export interface ReadinessCheck {
  key: string;
  label: string;
  passed: boolean;
  evidence: string;
}

export interface WorkpackPlanningReadiness {
  id: string;
  workpack_number: string | null;
  title: string;
  status: string;
  priority: string | null;

  // Hierarchy
  equipment_tag: string | null;
  equipment_type: string | null;
  unit_name: string | null;
  system_name: string | null;
  discipline_name: string | null;
  discipline_code: string | null;
  event_name: string | null;
  event_id: string | null;

  // Counts
  activity_count: number;
  activities_with_duration: number;
  activities_with_logic: number;
  activities_with_resources: number;
  activities_scheduled: number;

  // Existing readiness score (from cached workpack field)
  readiness_score: number;

  // Material readiness
  material_total: number;
  material_ready: number;
  material_status: string;

  // Constraints
  open_constraints: number;
  critical_constraints: number;

  // Documents
  document_count: number;

  // Schedule info (read from persisted CPM data — NOT calculated here)
  planned_start: string | null;
  planned_end: string | null;
  has_schedule_dates: boolean;
  has_baseline: boolean;

  // Derived readiness
  planning_state: PlanningReadinessState;
  checks: ReadinessCheck[];
}

export interface PlanningReadinessKpis {
  total: number;
  ready: number;
  not_ready: number;
  scheduled: number;
  baselined: number;
  critical_blockers: number;
}

export interface PlanningReadinessResult {
  kpis: PlanningReadinessKpis;
  workpacks: WorkpackPlanningReadiness[];
}

export interface PlanningReadinessFilters {
  event_id?: string;
  discipline_id?: string;
  unit_id?: string;
  system_id?: string;
  status?: string;
  readiness_state?: PlanningReadinessState;
  priority?: string;
  search?: string;
}

// ── Service ────────────────────────────────────────────────────────────────────

export class PlanningReadinessService {

  /**
   * Get planning readiness for all workpacks in an event (or all).
   * This is the main entry point for the readiness workspace.
   */
  static async getReadiness(
    organizationId: string,
    filters: PlanningReadinessFilters = {}
  ): Promise<PlanningReadinessResult> {

    // ── 1. Build workpack query ──────────────────────────────────────────────
    const where: any = {
      organization_id: organizationId,
      deleted_at: null,
    };
    if (filters.event_id) where.event_id = filters.event_id;
    if (filters.discipline_id) where.discipline_id = filters.discipline_id;
    if (filters.unit_id) where.unit_id = filters.unit_id;
    if (filters.system_id) where.system_id = filters.system_id;
    if (filters.status) where.status = filters.status;
    if (filters.priority) where.priority = filters.priority;
    if (filters.search) {
      where.OR = [
        { title: { contains: filters.search, mode: 'insensitive' } },
        { workpack_number: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    // ── 2. Fetch workpacks with aggregated data (batched, no N+1) ────────────
    const workpacks = await prisma.workpack.findMany({
      where,
      select: {
        id: true,
        workpack_number: true,
        title: true,
        status: true,
        priority: true,
        planned_start_date: true,
        planned_end_date: true,
        readiness_score: true,
        event_id: true,
        unit_id: true,
        system_id: true,
        discipline_id: true,
        asset_id: true,
        approval_status: true,
        // Relations
        asset: {
          select: {
            tag_number: true,
            name: true,
            asset_type: true,
          },
        },
        unit: { select: { name: true } },
        system: { select: { name: true } },
        discipline: { select: { name: true, code: true } },
        event: { select: { name: true } },
        // Counts via _count
        _count: {
          select: {
            activities: true,
            workpack_documents: true,
            constraints: true,
          },
        },
      },
      orderBy: [
        { workpack_number: 'asc' },
      ],
    }) as any[];

    if (workpacks.length === 0) {
      return {
        kpis: { total: 0, ready: 0, not_ready: 0, scheduled: 0, baselined: 0, critical_blockers: 0 },
        workpacks: [],
      };
    }

    const wpIds = workpacks.map(wp => wp.id);

    // ── 3. Batch fetch activity-level data ───────────────────────────────────
    //    Single query: per-workpack aggregation of activities
    const activityAggs = await prisma.activity.groupBy({
      by: ['workpack_id'],
      where: {
        workpack_id: { in: wpIds },
        deleted_at: null,
      },
      _count: { id: true },
    });
    const activityCountMap = new Map(activityAggs.map(a => [a.workpack_id, a._count.id]));

    // Activities with duration > 0
    const durationAggs = await prisma.activity.groupBy({
      by: ['workpack_id'],
      where: {
        workpack_id: { in: wpIds },
        deleted_at: null,
        duration_hours: { gt: 0 },
      },
      _count: { id: true },
    });
    const durationCountMap = new Map(durationAggs.map(a => [a.workpack_id, a._count.id]));

    // Activities with schedule dates (early_start populated = CPM has run)
    const scheduledAggs = await prisma.activity.groupBy({
      by: ['workpack_id'],
      where: {
        workpack_id: { in: wpIds },
        deleted_at: null,
        early_start: { not: null },
      },
      _count: { id: true },
    });
    const scheduledCountMap = new Map(scheduledAggs.map(a => [a.workpack_id, a._count.id]));

    // ── 4. Batch fetch logic (predecessors/successors) per workpack ──────────
    //    Count distinct activities that have at least one relationship
    const activitiesForLogic = await prisma.activity.findMany({
      where: {
        workpack_id: { in: wpIds },
        deleted_at: null,
      },
      select: {
        id: true,
        workpack_id: true,
        _count: {
          select: {
            predecessors: true,
            successors: true,
          },
        },
      },
    });

    const logicMap = new Map<string, number>();
    for (const a of activitiesForLogic) {
      if (!a.workpack_id) continue;
      const hasLogic = (a._count.predecessors > 0 || a._count.successors > 0);
      if (hasLogic) {
        logicMap.set(a.workpack_id, (logicMap.get(a.workpack_id) ?? 0) + 1);
      }
    }

    // ── 5. Batch fetch resource assignments per workpack ─────────────────────
    const resourceAggs = await prisma.activityResource.groupBy({
      by: ['workpack_id'],
      where: { workpack_id: { in: wpIds } },
      _count: { id: true },
    });
    const resourceCountMap = new Map(resourceAggs.map(r => [r.workpack_id, r._count.id]));

    // Activities with at least one resource
    const activitiesWithResources = await prisma.activityResource.findMany({
      where: { workpack_id: { in: wpIds } },
      select: { activity_id: true, workpack_id: true },
      distinct: ['activity_id'],
    });
    const resourcedActivityMap = new Map<string, number>();
    for (const r of activitiesWithResources) {
      resourcedActivityMap.set(r.workpack_id, (resourcedActivityMap.get(r.workpack_id) ?? 0) + 1);
    }

    // ── 6. Batch fetch material lines per workpack ──────────────────────────
    const materialAggs = await prisma.workpack_material_lines.groupBy({
      by: ['workpack_id'],
      where: {
        workpack_id: { in: wpIds },
        deleted_at: null,
      },
      _count: { id: true },
    });
    const materialTotalMap = new Map(materialAggs.map(m => [m.workpack_id, (m._count as any).id ?? 0]));

    // Materials that are "ready" (material_readiness = 'ready')
    const materialReadyAggs = await prisma.workpack_material_lines.groupBy({
      by: ['workpack_id'],
      where: {
        workpack_id: { in: wpIds },
        deleted_at: null,
        material_readiness: 'ready',
      },
      _count: { id: true },
    });
    const materialReadyMap = new Map(materialReadyAggs.map(m => [m.workpack_id, (m._count as any).id ?? 0]));

    // ── 7. Batch fetch unresolved constraints per workpack ──────────────────
    //    Both 'open' and 'in_progress' are unresolved and block readiness.
    //    Only 'resolved', 'deferred', 'cancelled' are non-blocking.
    const constraintAggs = await prisma.constraint.groupBy({
      by: ['workpack_id'],
      where: {
        workpack_id: { in: wpIds },
        deleted_at: null,
        status: { in: ['open', 'in_progress'] },
      },
      _count: { id: true },
    });
    const constraintOpenMap = new Map(constraintAggs.map(c => [c.workpack_id, c._count.id]));

    const criticalConstraintAggs = await prisma.constraint.groupBy({
      by: ['workpack_id'],
      where: {
        workpack_id: { in: wpIds },
        deleted_at: null,
        status: { in: ['open', 'in_progress'] },
        priority: 'critical',
      },
      _count: { id: true },
    });
    const criticalConstraintMap = new Map(criticalConstraintAggs.map(c => [c.workpack_id, c._count.id]));

    // ── 8. Batch check baselines ────────────────────────────────────────────
    //    A workpack is "baselined" if it belongs to an event that has a current baseline
    const eventIds = [...new Set(workpacks.map(wp => wp.event_id).filter(Boolean))] as string[];
    const baselinedEvents = new Set<string>();
    if (eventIds.length > 0) {
      // OD9.2: STO readiness must resolve baselines through Event, never Project.
      // ScheduleBaseline.event_id is the authoritative STO scope (see its schema
      // comment); the Project-domain column on that model is not an STO authority.
      // This previously matched Event UUIDs against that Project column, silently
      // under-reporting baselined workpacks (measured on `syority`: 1 instead of 4).
      const baselines = await prisma.scheduleBaseline.findMany({
        where: {
          organization_id: organizationId,
          is_current: true,
          event_id: { in: eventIds },
        },
        select: { event_id: true },
      });
      for (const b of baselines) if (b.event_id) baselinedEvents.add(b.event_id);
    }

    // ── 9. Build results ────────────────────────────────────────────────────
    const results: WorkpackPlanningReadiness[] = [];

    for (const wp of workpacks) {
      const actCount = activityCountMap.get(wp.id) ?? 0;
      const durCount = durationCountMap.get(wp.id) ?? 0;
      const logicCount = logicMap.get(wp.id) ?? 0;
      const resActCount = resourcedActivityMap.get(wp.id) ?? 0;
      const scheduledCount = scheduledCountMap.get(wp.id) ?? 0;
      const matTotal = materialTotalMap.get(wp.id) ?? 0;
      const matReady = materialReadyMap.get(wp.id) ?? 0;
      const openConst = constraintOpenMap.get(wp.id) ?? 0;
      const critConst = criticalConstraintMap.get(wp.id) ?? 0;
      const docCount = wp._count.workpack_documents ?? 0;
      const hasBaseline = wp.event_id ? baselinedEvents.has(wp.event_id) : false;
      const hasScheduleDates = scheduledCount > 0;

      // Material status derivation
      let materialStatus = 'not_required';
      if (matTotal > 0) {
        if (matReady >= matTotal) materialStatus = 'ready';
        else if (matReady > 0) materialStatus = 'partial';
        else materialStatus = 'not_ready';
      }

      // ── Build readiness checks ──────────────────────────────────────────
      const checks: ReadinessCheck[] = [];

      // Scope / approval
      const scopeApproved = wp.approval_status === 'approved' || wp.status === 'approved' || wp.status === 'issued';
      checks.push({
        key: 'scope',
        label: 'Scope Approved',
        passed: scopeApproved,
        evidence: scopeApproved
          ? `Workpack status: ${wp.status}, approval: ${wp.approval_status ?? 'n/a'}`
          : `Workpack status: ${wp.status} — approval pending (${wp.approval_status ?? 'not_submitted'})`,
      });

      // Equipment identified
      const hasEquipment = !!wp.asset_id;
      checks.push({
        key: 'equipment',
        label: 'Equipment Identified',
        passed: hasEquipment,
        evidence: hasEquipment
          ? `Equipment: ${wp.asset?.tag_number ?? 'assigned'}`
          : 'No equipment assigned to workpack',
      });

      // Activities created
      checks.push({
        key: 'activities',
        label: 'Activities Created',
        passed: actCount > 0,
        evidence: actCount > 0
          ? `${actCount} activities`
          : 'No activities created',
      });

      // Durations
      const missingDuration = actCount - durCount;
      checks.push({
        key: 'durations',
        label: 'Activity Durations',
        passed: actCount > 0 && missingDuration === 0,
        evidence: actCount === 0
          ? 'No activities to check'
          : missingDuration === 0
            ? `All ${actCount} activities have durations`
            : `${missingDuration} of ${actCount} activities missing duration`,
      });

      // Logic / dependencies
      const missingLogic = actCount > 0 ? actCount - logicCount : 0;
      const logicPassed = actCount > 0 && logicCount >= actCount; // 100%: ALL activities must have logic for CPM
      checks.push({
        key: 'logic',
        label: 'Logic / Dependencies',
        passed: logicPassed,
        evidence: actCount === 0
          ? 'No activities to check'
          : `${logicCount} of ${actCount} activities have predecessors/successors (${Math.round((logicCount / actCount) * 100)}%)`,
      });

      // Resources
      const resPassed = actCount > 0 && resActCount >= Math.ceil(actCount * 0.8); // 80% threshold
      checks.push({
        key: 'resources',
        label: 'Resources Assigned',
        passed: resPassed,
        evidence: actCount === 0
          ? 'No activities to check'
          : `${resActCount} of ${actCount} activities have resources (${Math.round((resActCount / actCount) * 100)}%)`,
      });

      // Materials
      const matPassed = matTotal === 0 || matReady >= matTotal;
      checks.push({
        key: 'materials',
        label: 'Materials Ready',
        passed: matPassed,
        evidence: matTotal === 0
          ? 'No materials required'
          : `${matReady} of ${matTotal} material lines ready (${Math.round((matReady / matTotal) * 100)}%)`,
      });

      // Constraints
      const constPassed = openConst === 0;
      checks.push({
        key: 'constraints',
        label: 'Constraints Resolved',
        passed: constPassed,
        evidence: constPassed
          ? 'No open constraints'
          : `${openConst} open constraints (${critConst} critical)`,
      });

      // Documents
      checks.push({
        key: 'documents',
        label: 'Documents Attached',
        passed: docCount > 0,
        evidence: docCount > 0
          ? `${docCount} documents attached`
          : 'No documents attached',
      });

      // Schedule
      checks.push({
        key: 'schedule',
        label: 'Schedule Calculated',
        passed: hasScheduleDates,
        evidence: hasScheduleDates
          ? `${scheduledCount} of ${actCount} activities have calculated dates`
          : 'CPM schedule not yet calculated',
      });

      // Calendar / dates
      const hasDates = !!wp.planned_start_date && !!wp.planned_end_date;
      checks.push({
        key: 'calendar',
        label: 'Execution Calendar',
        passed: hasDates,
        evidence: hasDates
          ? `Planned: ${wp.planned_start_date?.toISOString().slice(0, 10)} — ${wp.planned_end_date?.toISOString().slice(0, 10)}`
          : 'No planned start/end dates set',
      });

      // ── Derive planning state ─────────────────────────────────────────
      // Mandatory for READY: scope, activities, durations, logic
      const mandatoryChecks = checks.filter(c =>
        ['activities', 'durations', 'logic', 'scope'].includes(c.key)
      );
      const allMandatoryPassed = mandatoryChecks.every(c => c.passed);

      // Planning prerequisites: mandatory + resources + materials + constraints
      const planningPrereqKeys = ['scope', 'activities', 'durations', 'logic', 'resources', 'materials', 'constraints'];
      const planningPrereqs = checks.filter(c => planningPrereqKeys.includes(c.key));
      const allPrereqsPassed = planningPrereqs.every(c => c.passed);

      let planningState: PlanningReadinessState;
      if (hasBaseline) {
        planningState = 'BASELINED';
      } else if (hasScheduleDates && allMandatoryPassed) {
        planningState = 'SCHEDULED';
      } else if (allPrereqsPassed) {
        planningState = 'READY';
      } else {
        planningState = 'NOT_READY';
      }

      const row: WorkpackPlanningReadiness = {
        id: wp.id,
        workpack_number: wp.workpack_number,
        title: wp.title,
        status: wp.status,
        priority: wp.priority,
        equipment_tag: wp.asset?.tag_number ?? null,
        equipment_type: wp.asset?.asset_type ?? null,
        unit_name: wp.unit?.name ?? null,
        system_name: wp.system?.name ?? null,
        discipline_name: wp.discipline?.name ?? null,
        discipline_code: wp.discipline?.code ?? null,
        event_name: wp.event?.name ?? null,
        event_id: wp.event_id,
        activity_count: actCount,
        activities_with_duration: durCount,
        activities_with_logic: logicCount,
        activities_with_resources: resActCount,
        activities_scheduled: scheduledCount,
        readiness_score: wp.readiness_score ?? 0,
        material_total: matTotal,
        material_ready: matReady,
        material_status: materialStatus,
        open_constraints: openConst,
        critical_constraints: critConst,
        document_count: docCount,
        planned_start: wp.planned_start_date?.toISOString().slice(0, 10) ?? null,
        planned_end: wp.planned_end_date?.toISOString().slice(0, 10) ?? null,
        has_schedule_dates: hasScheduleDates,
        has_baseline: hasBaseline,
        planning_state: planningState,
        checks,
      };

      results.push(row);
    }

    // ── 10. Apply post-query readiness filter ───────────────────────────────
    let filtered = results;
    if (filters.readiness_state) {
      filtered = results.filter(r => r.planning_state === filters.readiness_state);
    }

    // ── 11. Compute KPIs ────────────────────────────────────────────────────
    const kpis: PlanningReadinessKpis = {
      total: results.length,
      ready: results.filter(r => r.planning_state === 'READY').length,
      not_ready: results.filter(r => r.planning_state === 'NOT_READY').length,
      scheduled: results.filter(r => r.planning_state === 'SCHEDULED').length,
      baselined: results.filter(r => r.planning_state === 'BASELINED').length,
      critical_blockers: results.reduce((sum, r) => sum + r.critical_constraints, 0),
    };

    return { kpis, workpacks: filtered };
  }
}
