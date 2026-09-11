/**
 * M16-R2 — Read-Only Tool Implementations
 *
 * Each tool delegates to the authoritative domain service.
 * M16 NEVER calculates progress, CPM, readiness, etc.
 *
 * AUTHORITY MAP:
 *   getProgress              → M8.13 ProgressAggregationService
 *   getWorkpackStatus        → FieldExecutionService (read)
 *   getActivityStatus        → FieldExecutionService (read)
 *   getReadiness             → ExecutionReadinessService
 *   getCriticalActivities    → FieldExecutionService (read)
 *   getConstraints           → Prisma read (org+event scoped)
 *   getDelays                → FieldExecutionService.getPlanVsActual
 *   getLookahead             → FieldExecutionService.getLookahead
 *   getControlTowerSummary   → ControlTowerQueryService
 *   getContractorPerformance → M8.13 dimension progress
 *   getDisciplinePerformance → M8.13 dimension progress
 *   getEquipmentDetails      → Prisma read (org scoped)
 *   getWorkpackDetails       → Prisma read (org+event scoped)
 *
 * DOES NOT:
 *   - prisma.activity.update/create/delete
 *   - prisma.workpack.update/create/delete
 *   - prisma.progressLog.create
 *   - calculateProgressMetrics directly (calls M8.13 aggregation)
 *   - calculate CPM/schedule
 *   - calculate readiness formulas
 */

import { M16Intent } from '../intents';
import { ActionRiskLevel } from '../risk';
import { registerTool, getTool } from './ToolRegistry';
import type { ToolParams, ToolResult } from './ToolRegistry';
import type { M16InteractionContext } from '../types';

// ── Lazy imports (to avoid circular deps and allow test mocking) ─────────────

async function getProgressAggregation() {
  const { ProgressAggregationService } = await import('@/core/progress/ProgressAggregationService');
  return ProgressAggregationService;
}

async function getFieldExecution() {
  const { FieldExecutionService } = await import('@/core/execution/FieldExecutionService');
  return FieldExecutionService;
}

async function getReadinessService() {
  const { ExecutionReadinessService } = await import('@/core/execution/ExecutionReadinessService');
  return ExecutionReadinessService;
}

async function getControlTower() {
  const { ControlTowerQueryService } = await import('@/core/control-tower/ControlTowerQueryService');
  return ControlTowerQueryService;
}

async function getPrisma() {
  const { prisma } = await import('@/lib/prisma');
  return prisma;
}

// ── Tool: getProgress ─────────────────────────────────────────────────────────

async function executeGetProgress(
  ctx: M16InteractionContext,
  params: ToolParams
): Promise<ToolResult> {
  try {
    const Agg = await getProgressAggregation();
    const result = await Agg.getEventProgress(ctx.organizationId, ctx.eventId!);
    return {
      status: 'SUCCESS',
      data: result,
      summary: `Overall progress: ${result.metrics.weightedProgress}% (${result.metrics.completedCount} completed, ${result.metrics.inProgressCount} in progress, ${result.metrics.totalCount} total)`,
      authority: 'M8.13 ProgressAggregationService',
    };
  } catch (err: unknown) {
    return {
      status: 'ERROR',
      data: null,
      summary: `Could not retrieve progress: ${(err as Error).message}`,
      authority: 'M8.13 ProgressAggregationService',
    };
  }
}

// ── Tool: getActivityStatus ───────────────────────────────────────────────────

async function executeGetActivityStatus(
  ctx: M16InteractionContext,
  params: ToolParams
): Promise<ToolResult> {
  if (!params.activityId) {
    return {
      status: 'NOT_FOUND',
      data: null,
      summary: 'No activity resolved. Please specify the activity.',
      authority: 'FieldExecutionService',
    };
  }
  try {
    const prisma = await getPrisma();
    const activity = await prisma.activity.findFirst({
      where: {
        id: params.activityId,
        organization_id: ctx.organizationId,
        deleted_at: null,
      },
      select: {
        id: true,
        activity_number: true,
        description: true,
        status: true,
        progress_percent: true,
        planned_start: true,
        planned_end: true,
        actual_start: true,
        actual_end: true,
        duration_hours: true,
        is_critical: true,
        total_float: true,
        responsible: true,
        delay_reason: true,
        workpack: {
          select: {
            workpack_number: true,
            title: true,
            asset: { select: { tag_number: true, name: true } },
          },
        },
      },
    });

    if (!activity) {
      return {
        status: 'NOT_FOUND',
        data: null,
        summary: 'Activity not found or access denied.',
        authority: 'FieldExecutionService',
      };
    }

    return {
      status: 'SUCCESS',
      data: activity,
      summary: `Activity ${activity.activity_number ?? activity.description}: Status=${activity.status}, Progress=${activity.progress_percent ?? 0}%${activity.is_critical ? ' (CRITICAL)' : ''}`,
      authority: 'FieldExecutionService',
    };
  } catch (err: unknown) {
    return {
      status: 'ERROR',
      data: null,
      summary: `Could not retrieve activity status: ${(err as Error).message}`,
      authority: 'FieldExecutionService',
    };
  }
}

// ── Tool: getWorkpackStatus ───────────────────────────────────────────────────

async function executeGetWorkpackStatus(
  ctx: M16InteractionContext,
  params: ToolParams
): Promise<ToolResult> {
  if (!params.workpackId) {
    return {
      status: 'NOT_FOUND',
      data: null,
      summary: 'No workpack resolved. Please specify the workpack.',
      authority: 'FieldExecutionService',
    };
  }
  try {
    const prisma = await getPrisma();
    const wp = await prisma.workpack.findFirst({
      where: {
        id: params.workpackId,
        organization_id: ctx.organizationId,
        deleted_at: null,
      },
      select: {
        id: true,
        workpack_number: true,
        title: true,
        status: true,
        overall_progress: true,
        asset: { select: { tag_number: true, name: true } },
        activities: {
          where: { deleted_at: null },
          select: {
            id: true,
            description: true,
            status: true,
            progress_percent: true,
            is_critical: true,
          },
        },
      },
    });

    if (!wp) {
      return {
        status: 'NOT_FOUND',
        data: null,
        summary: 'Workpack not found or access denied.',
        authority: 'FieldExecutionService',
      };
    }

    const total = wp.activities.length;
    const done = wp.activities.filter(a => a.status === 'completed').length;
    const inProg = wp.activities.filter(a => a.status === 'in_progress').length;

    return {
      status: 'SUCCESS',
      data: wp,
      summary: `Workpack ${wp.workpack_number}: Status=${wp.status}, Progress=${wp.overall_progress ?? 0}%, Activities: ${done} done, ${inProg} in progress, ${total - done - inProg} pending`,
      authority: 'FieldExecutionService',
    };
  } catch (err: unknown) {
    return {
      status: 'ERROR',
      data: null,
      summary: `Could not retrieve workpack status: ${(err as Error).message}`,
      authority: 'FieldExecutionService',
    };
  }
}

// ── Tool: getReadiness ────────────────────────────────────────────────────────

async function executeGetReadiness(
  ctx: M16InteractionContext,
  params: ToolParams
): Promise<ToolResult> {
  if (!params.activityId) {
    return {
      status: 'NOT_FOUND',
      data: null,
      summary: 'No activity resolved. Please specify the activity to check readiness.',
      authority: 'M12 ExecutionReadinessService',
    };
  }
  try {
    const Svc = await getReadinessService();
    const result = await Svc.evaluateReadiness(ctx.organizationId, params.activityId);
    const summary = result.is_ready
      ? 'Activity is READY for execution.'
      : `Activity is NOT READY. Blockers: ${result.blockers.join('; ')}`;
    return {
      status: 'SUCCESS',
      data: result,
      summary,
      authority: 'M12 ExecutionReadinessService',
    };
  } catch (err: unknown) {
    return {
      status: 'ERROR',
      data: null,
      summary: `Could not evaluate readiness: ${(err as Error).message}`,
      authority: 'M12 ExecutionReadinessService',
    };
  }
}

// ── Tool: getConstraints ──────────────────────────────────────────────────────

async function executeGetConstraints(
  ctx: M16InteractionContext,
  _params: ToolParams
): Promise<ToolResult> {
  try {
    const prisma = await getPrisma();
    const constraints = await prisma.constraintLog.findMany({
      where: {
        organization_id: ctx.organizationId,
        workpack: ctx.eventId ? { event_id: ctx.eventId } : undefined,
        status: { in: ['open', 'in_progress'] },
        deleted_at: null,
      },
      select: {
        id: true,
        title: true,
        severity: true,
        status: true,
        constraint_type: true,
        workpack: { select: { workpack_number: true } },
      },
      orderBy: [
        { severity: 'asc' },
        { created_at: 'desc' },
      ],
      take: 20,
    });

    const critical = constraints.filter(c => c.severity === 'critical').length;
    const high = constraints.filter(c => c.severity === 'high').length;

    return {
      status: 'SUCCESS',
      data: constraints,
      summary: `${constraints.length} open constraints (${critical} critical, ${high} high)`,
      authority: 'Constraint Service',
    };
  } catch (err: unknown) {
    return {
      status: 'ERROR',
      data: null,
      summary: `Could not retrieve constraints: ${(err as Error).message}`,
      authority: 'Constraint Service',
    };
  }
}

// ── Tool: getControlTowerSummary ──────────────────────────────────────────────

async function executeGetControlTower(
  ctx: M16InteractionContext,
  _params: ToolParams
): Promise<ToolResult> {
  try {
    const CT = await getControlTower();
    const summary = await CT.getSummary(ctx.organizationId, ctx.eventId!);
    return {
      status: 'SUCCESS',
      data: summary,
      summary: `Control Tower: Progress=${summary.progress.overall.weightedProgress}%, Exceptions=${summary.exceptions.length}, Critical path=${summary.schedule.criticalPathCount}, Late=${summary.schedule.lateCount}`,
      authority: 'M13 ControlTowerQueryService',
    };
  } catch (err: unknown) {
    return {
      status: 'ERROR',
      data: null,
      summary: `Could not retrieve control tower summary: ${(err as Error).message}`,
      authority: 'M13 ControlTowerQueryService',
    };
  }
}

// ── Tool: getLookahead ────────────────────────────────────────────────────────

async function executeGetLookahead(
  ctx: M16InteractionContext,
  _params: ToolParams
): Promise<ToolResult> {
  try {
    const FES = await getFieldExecution();
    const result = await FES.getLookahead(ctx.organizationId, ctx.eventId!);
    const starting = result.filter((a: Record<string, unknown>) => {
      const cats = a.categories as string[] | undefined;
      return cats?.includes('STARTING');
    }).length;
    const overdue = result.filter((a: Record<string, unknown>) => {
      const cats = a.categories as string[] | undefined;
      return cats?.includes('OVERDUE');
    }).length;
    return {
      status: 'SUCCESS',
      data: result,
      summary: `Lookahead: ${result.length} activities (${starting} starting, ${overdue} overdue)`,
      authority: 'FieldExecutionService.getLookahead',
    };
  } catch (err: unknown) {
    return {
      status: 'ERROR',
      data: null,
      summary: `Could not retrieve lookahead: ${(err as Error).message}`,
      authority: 'FieldExecutionService.getLookahead',
    };
  }
}

// ── Tool: getDelays ──────────────────────────────────────────────────────────

async function executeGetDelays(
  ctx: M16InteractionContext,
  _params: ToolParams
): Promise<ToolResult> {
  try {
    const FES = await getFieldExecution();
    const result = await FES.getPlanVsActual(ctx.organizationId, ctx.eventId!);
    const delayed = result.filter((a: Record<string, unknown>) => a.is_delayed);
    return {
      status: 'SUCCESS',
      data: delayed,
      summary: `${delayed.length} delayed activities out of ${result.length} total`,
      authority: 'FieldExecutionService.getPlanVsActual',
    };
  } catch (err: unknown) {
    return {
      status: 'ERROR',
      data: null,
      summary: `Could not retrieve delays: ${(err as Error).message}`,
      authority: 'FieldExecutionService.getPlanVsActual',
    };
  }
}

// ── Tool: getEquipmentDetails ─────────────────────────────────────────────────

async function executeGetEquipmentDetails(
  ctx: M16InteractionContext,
  params: ToolParams
): Promise<ToolResult> {
  if (!params.assetId) {
    return {
      status: 'NOT_FOUND',
      data: null,
      summary: 'No equipment resolved. Please specify the equipment.',
      authority: 'Asset Service',
    };
  }
  try {
    const prisma = await getPrisma();
    const asset = await prisma.asset.findFirst({
      where: {
        id: params.assetId,
        organization_id: ctx.organizationId,
      },
      include: {
        system: { select: { name: true, unit: { select: { name: true, code: true } } } },
        workpacks: {
          where: {
            deleted_at: null,
            ...(ctx.eventId ? { event_id: ctx.eventId } : {}),
          },
          select: {
            workpack_number: true,
            title: true,
            status: true,
            overall_progress: true,
          },
          take: 5,
        },
      },
    });

    if (!asset) {
      return {
        status: 'NOT_FOUND',
        data: null,
        summary: 'Equipment not found or access denied.',
        authority: 'Asset Service',
      };
    }

    return {
      status: 'SUCCESS',
      data: asset,
      summary: `Equipment ${asset.tag_number} (${asset.name}): ${asset.workpacks.length} active workpacks`,
      authority: 'Asset Service',
    };
  } catch (err: unknown) {
    return {
      status: 'ERROR',
      data: null,
      summary: `Could not retrieve equipment details: ${(err as Error).message}`,
      authority: 'Asset Service',
    };
  }
}

// ── Tool: getDisciplinePerformance ─────────────────────────────────────────────

async function executeGetDisciplinePerformance(
  ctx: M16InteractionContext,
  _params: ToolParams
): Promise<ToolResult> {
  try {
    const Agg = await getProgressAggregation();
    const result = await Agg.getEventProgress(ctx.organizationId, ctx.eventId!);
    return {
      status: 'SUCCESS',
      data: result.byDiscipline,
      summary: `Discipline performance: ${result.byDiscipline?.length ?? 0} disciplines tracked`,
      authority: 'M8.13 ProgressAggregationService',
    };
  } catch (err: unknown) {
    return {
      status: 'ERROR',
      data: null,
      summary: `Could not retrieve discipline performance: ${(err as Error).message}`,
      authority: 'M8.13 ProgressAggregationService',
    };
  }
}

// ── Tool: getContractorPerformance ─────────────────────────────────────────────

async function executeGetContractorPerformance(
  ctx: M16InteractionContext,
  _params: ToolParams
): Promise<ToolResult> {
  try {
    const Agg = await getProgressAggregation();
    const result = await Agg.getEventProgress(ctx.organizationId, ctx.eventId!);
    return {
      status: 'SUCCESS',
      data: result.byContractor,
      summary: `Contractor performance: ${result.byContractor?.length ?? 0} contractors tracked`,
      authority: 'M8.13 ProgressAggregationService',
    };
  } catch (err: unknown) {
    return {
      status: 'ERROR',
      data: null,
      summary: `Could not retrieve contractor performance: ${(err as Error).message}`,
      authority: 'M8.13 ProgressAggregationService',
    };
  }
}

// ── Tool: getScheduleStatus ──────────────────────────────────────────────────

async function executeGetScheduleStatus(
  ctx: M16InteractionContext,
  _params: ToolParams
): Promise<ToolResult> {
  try {
    const FES = await getFieldExecution();
    const summary = await FES.getExecutionSummary(ctx.organizationId, ctx.eventId!);
    return {
      status: 'SUCCESS',
      data: summary,
      summary: `Schedule: ${summary.activities_planned_today} planned today, ${summary.activities_in_progress} in progress, ${summary.delayed_activities} delayed, ${summary.overall_progress}% progress`,
      authority: 'FieldExecutionService.getExecutionSummary',
    };
  } catch (err: unknown) {
    return {
      status: 'ERROR',
      data: null,
      summary: `Could not retrieve schedule status: ${(err as Error).message}`,
      authority: 'FieldExecutionService.getExecutionSummary',
    };
  }
}

// ── Registration ──────────────────────────────────────────────────────────────

/**
 * Register all R2 read tools.
 * Called once at application startup.
 */
export function registerR2ReadTools(): void {
  if (getTool('getProgress')) return;
  registerTool({
    name: 'getProgress',
    description: 'Get overall or filtered progress for the current event',
    authority: 'M8.13 ProgressAggregationService',
    permission: null,
    riskLevel: ActionRiskLevel.READ,
    readWrite: 'read',
    eventScoped: true,
    intents: [M16Intent.GET_PROGRESS],
    execute: executeGetProgress,
  });

  registerTool({
    name: 'getActivityStatus',
    description: 'Get status and details of a specific activity',
    authority: 'FieldExecutionService',
    permission: null,
    riskLevel: ActionRiskLevel.READ,
    readWrite: 'read',
    eventScoped: true,
    intents: [M16Intent.GET_ACTIVITY_STATUS],
    execute: executeGetActivityStatus,
  });

  registerTool({
    name: 'getWorkpackStatus',
    description: 'Get status and details of a specific workpack',
    authority: 'FieldExecutionService',
    permission: null,
    riskLevel: ActionRiskLevel.READ,
    readWrite: 'read',
    eventScoped: true,
    intents: [M16Intent.GET_WORKPACK_STATUS],
    execute: executeGetWorkpackStatus,
  });

  registerTool({
    name: 'getReadiness',
    description: 'Check if an activity is ready for execution',
    authority: 'M12 ExecutionReadinessService',
    permission: null,
    riskLevel: ActionRiskLevel.READ,
    readWrite: 'read',
    eventScoped: true,
    intents: [M16Intent.GET_READINESS],
    execute: executeGetReadiness,
  });

  registerTool({
    name: 'getConstraints',
    description: 'Get open constraints for the current event',
    authority: 'Constraint Service',
    permission: null,
    riskLevel: ActionRiskLevel.READ,
    readWrite: 'read',
    eventScoped: true,
    intents: [M16Intent.GET_CONSTRAINTS],
    execute: executeGetConstraints,
  });

  registerTool({
    name: 'getControlTowerSummary',
    description: 'Get control tower overview (progress, exceptions, schedule)',
    authority: 'M13 ControlTowerQueryService',
    permission: null,
    riskLevel: ActionRiskLevel.READ,
    readWrite: 'read',
    eventScoped: true,
    intents: [M16Intent.OPEN_CONTROL_TOWER],
    execute: executeGetControlTower,
  });

  registerTool({
    name: 'getLookahead',
    description: 'Get upcoming activities for the next 24-72 hours',
    authority: 'FieldExecutionService.getLookahead',
    permission: null,
    riskLevel: ActionRiskLevel.READ,
    readWrite: 'read',
    eventScoped: true,
    intents: [M16Intent.GET_LOOKAHEAD, M16Intent.GET_SCHEDULE],
    execute: executeGetLookahead,
  });

  registerTool({
    name: 'getDelays',
    description: 'Get delayed activities and delay reasons',
    authority: 'FieldExecutionService.getPlanVsActual',
    permission: null,
    riskLevel: ActionRiskLevel.READ,
    readWrite: 'read',
    eventScoped: true,
    intents: [M16Intent.GET_DELAY],
    execute: executeGetDelays,
  });

  registerTool({
    name: 'getEquipmentDetails',
    description: 'Get equipment 360 view with active workpacks',
    authority: 'Asset Service',
    permission: null,
    riskLevel: ActionRiskLevel.READ,
    readWrite: 'read',
    eventScoped: false,
    intents: [M16Intent.OPEN_EQUIPMENT],
    execute: executeGetEquipmentDetails,
  });

  registerTool({
    name: 'getDisciplinePerformance',
    description: 'Get progress broken down by discipline',
    authority: 'M8.13 ProgressAggregationService',
    permission: null,
    riskLevel: ActionRiskLevel.READ,
    readWrite: 'read',
    eventScoped: true,
    intents: [],
    execute: executeGetDisciplinePerformance,
  });

  registerTool({
    name: 'getContractorPerformance',
    description: 'Get progress broken down by contractor',
    authority: 'M8.13 ProgressAggregationService',
    permission: null,
    riskLevel: ActionRiskLevel.READ,
    readWrite: 'read',
    eventScoped: true,
    intents: [],
    execute: executeGetContractorPerformance,
  });

  registerTool({
    name: 'getScheduleStatus',
    description: 'Get schedule KPIs (today plan, delays, in-progress)',
    authority: 'FieldExecutionService.getExecutionSummary',
    permission: null,
    riskLevel: ActionRiskLevel.READ,
    readWrite: 'read',
    eventScoped: true,
    intents: [],
    execute: executeGetScheduleStatus,
  });
}
