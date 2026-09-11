/**
 * M16-R3 — Write Tool Implementations
 *
 * Every write tool delegates to ExecutionWriteService.applyAction().
 * M16 NEVER calls prisma.activity.update() directly.
 *
 * AUTHORITY:
 *   ALL write tools → ExecutionWriteService.applyAction()
 *   source_channel: 'ai' (always)
 *
 * GUARANTEES (from EWS):
 *   1. $transaction — Activity + ProgressLog + AuditLog atomic
 *   2. AuditLog — every mutation audited
 *   3. EventBus — every mutation emitted
 *   4. State machine guards — invalid transitions rejected
 *   5. Readiness checks — prerequisites enforced
 *   6. Workpack sync — cache refresh post-transaction
 *
 * DOES NOT:
 *   - prisma.activity.update/create/delete
 *   - prisma.workpack.update/create/delete
 *   - prisma.progressLog.create
 *   - Calculate progress (EWS delegates to M8.13)
 *   - Calculate CPM
 *   - Override state machine guards
 */

import { M16Intent } from '../intents';
import { ActionRiskLevel } from '../risk';
import { registerTool, getTool } from './ToolRegistry';
import type { ToolParams, ToolResult } from './ToolRegistry';
import type { M16InteractionContext } from '../types';
import type {
  ExecutionAction,
  ExecutionActionParams,
} from '@/core/execution/ExecutionWriteService';

// ── Lazy import (to avoid circular deps) ─────────────────────────────────────

async function getEWS() {
  const { ExecutionWriteService } = await import('@/core/execution/ExecutionWriteService');
  return ExecutionWriteService;
}

// ── Generic EWS executor ──────────────────────────────────────────────────────

async function executeViaEWS(
  ctx: M16InteractionContext,
  params: ToolParams,
  action: ExecutionAction,
  extraParams?: Partial<ExecutionActionParams>
): Promise<ToolResult> {
  if (!params.activityId) {
    return {
      status: 'NOT_FOUND',
      data: null,
      summary: 'No activity resolved. Please specify which activity.',
      authority: 'ExecutionWriteService',
    };
  }

  try {
    const EWS = await getEWS();
    const result = await EWS.applyAction(
      ctx.organizationId,
      ctx.userId,
      {
        activityId: params.activityId,
        action,
        ...extraParams,
      },
      { source_channel: 'ai' }
    );

    return {
      status: result.success ? 'SUCCESS' : 'ERROR',
      data: result,
      summary: formatActionSummary(action, params, result),
      authority: 'ExecutionWriteService',
    };
  } catch (err: unknown) {
    const msg = (err as Error).message;
    return {
      status: 'ERROR',
      data: null,
      summary: `${action} failed: ${msg}`,
      authority: 'ExecutionWriteService',
    };
  }
}

function formatActionSummary(
  action: ExecutionAction,
  params: ToolParams,
  result: { success: boolean; activity?: any }
): string {
  const tag = params.equipmentTag ? ` on ${params.equipmentTag}` : '';
  const desc = params.activityDescription || params.activityId || 'activity';

  if (!result.success) return `Failed to ${action.toLowerCase()} ${desc}${tag}`;

  const progress = result.activity?.progress_percent;
  const status = result.activity?.status;

  switch (action) {
    case 'START':
      return `Activity "${desc}"${tag} started. Status: ${status}, Progress: ${progress ?? 10}%`;
    case 'UPDATE_PROGRESS':
      return `Progress updated to ${progress}% for "${desc}"${tag}`;
    case 'COMPLETE':
      return `Activity "${desc}"${tag} marked as complete (100%)`;
    case 'HOLD':
      return `Activity "${desc}"${tag} placed on hold`;
    case 'RESUME':
      return `Activity "${desc}"${tag} resumed`;
    case 'RELEASE':
      return `Activity "${desc}"${tag} released to field`;
    case 'REPORT_DELAY':
      return `Delay reported for "${desc}"${tag}`;
    case 'VERIFY':
      return `Activity "${desc}"${tag} verified`;
    case 'CLOSE':
      return `Activity "${desc}"${tag} closed`;
    default:
      return `${action} applied to "${desc}"${tag}. Status: ${status}`;
  }
}

// ── Tool: startActivity ───────────────────────────────────────────────────────

async function executeStartActivity(
  ctx: M16InteractionContext,
  params: ToolParams
): Promise<ToolResult> {
  return executeViaEWS(ctx, params, 'START', {
    notes: 'Started via AI assistant',
  });
}

// ── Tool: updateProgress ──────────────────────────────────────────────────────

async function executeUpdateProgress(
  ctx: M16InteractionContext,
  params: ToolParams
): Promise<ToolResult> {
  const progress = params.filter?.progress ? Number(params.filter.progress) : undefined;
  if (progress === undefined || isNaN(progress)) {
    return {
      status: 'ERROR',
      data: null,
      summary: 'Progress value is required. Please specify a percentage (0-100).',
      authority: 'ExecutionWriteService',
    };
  }

  return executeViaEWS(ctx, params, 'UPDATE_PROGRESS', {
    progress,
    notes: params.filter?.notes || `Progress updated to ${progress}% via AI assistant`,
  });
}

// ── Tool: completeActivity ────────────────────────────────────────────────────

async function executeCompleteActivity(
  ctx: M16InteractionContext,
  params: ToolParams
): Promise<ToolResult> {
  return executeViaEWS(ctx, params, 'COMPLETE', {
    notes: 'Completed via AI assistant',
  });
}

// ── Tool: holdActivity ────────────────────────────────────────────────────────

async function executeHoldActivity(
  ctx: M16InteractionContext,
  params: ToolParams
): Promise<ToolResult> {
  const reason = params.filter?.hold_reason || params.filter?.notes || 'Placed on hold via AI assistant';
  return executeViaEWS(ctx, params, 'HOLD', {
    hold_reason: reason,
    notes: reason,
  });
}

// ── Tool: resumeActivity ──────────────────────────────────────────────────────

async function executeResumeActivity(
  ctx: M16InteractionContext,
  params: ToolParams
): Promise<ToolResult> {
  return executeViaEWS(ctx, params, 'RESUME', {
    notes: 'Resumed via AI assistant',
  });
}

// ── Tool: releaseActivity ─────────────────────────────────────────────────────

async function executeReleaseActivity(
  ctx: M16InteractionContext,
  params: ToolParams
): Promise<ToolResult> {
  return executeViaEWS(ctx, params, 'RELEASE', {
    notes: 'Released via AI assistant',
  });
}

// ── Tool: reportDelay ─────────────────────────────────────────────────────────

async function executeReportDelay(
  ctx: M16InteractionContext,
  params: ToolParams
): Promise<ToolResult> {
  const title = params.filter?.delay_title || 'Delay reported via AI';
  const category = params.filter?.delay_category || 'other';
  const severity = params.filter?.delay_severity || 'medium';
  const description = params.filter?.delay_description || params.filter?.notes || 'Delay reported via AI assistant';

  return executeViaEWS(ctx, params, 'REPORT_DELAY', {
    delayDetails: {
      category,
      severity,
      title,
      description,
    },
    notes: description,
  });
}

// ── Tool: verifyActivity ──────────────────────────────────────────────────────

async function executeVerifyActivity(
  ctx: M16InteractionContext,
  params: ToolParams
): Promise<ToolResult> {
  return executeViaEWS(ctx, params, 'VERIFY', {
    notes: 'Verified via AI assistant',
  });
}

// ── Tool: closeActivity ───────────────────────────────────────────────────────

async function executeCloseActivity(
  ctx: M16InteractionContext,
  params: ToolParams
): Promise<ToolResult> {
  return executeViaEWS(ctx, params, 'CLOSE', {
    notes: 'Closed via AI assistant',
  });
}

// ── Registration ──────────────────────────────────────────────────────────────

/**
 * Register all R3 write tools.
 * Called once at application startup AFTER registerR2ReadTools().
 */
export function registerR3WriteTools(): void {
  if (getTool('startActivity')) return;
  registerTool({
    name: 'startActivity',
    description: 'Start an activity — sets status to in_progress',
    authority: 'ExecutionWriteService',
    permission: 'execution.start',
    riskLevel: ActionRiskLevel.HIGH_RISK_WRITE,
    readWrite: 'write',
    eventScoped: true,
    intents: [M16Intent.START_ACTIVITY],
    execute: executeStartActivity,
  });

  registerTool({
    name: 'updateProgress',
    description: 'Update progress percentage for an activity',
    authority: 'ExecutionWriteService',
    permission: 'execution.update',
    riskLevel: ActionRiskLevel.LOW_RISK_WRITE,
    readWrite: 'write',
    eventScoped: true,
    intents: [M16Intent.UPDATE_PROGRESS],
    execute: executeUpdateProgress,
  });

  registerTool({
    name: 'completeActivity',
    description: 'Mark an activity as complete (100%)',
    authority: 'ExecutionWriteService',
    permission: 'execution.complete',
    riskLevel: ActionRiskLevel.DESTRUCTIVE,
    readWrite: 'write',
    eventScoped: true,
    intents: [M16Intent.COMPLETE_ACTIVITY],
    execute: executeCompleteActivity,
  });

  registerTool({
    name: 'holdActivity',
    description: 'Place an activity on hold',
    authority: 'ExecutionWriteService',
    permission: 'execution.hold',
    riskLevel: ActionRiskLevel.HIGH_RISK_WRITE,
    readWrite: 'write',
    eventScoped: true,
    intents: [M16Intent.HOLD_ACTIVITY],
    execute: executeHoldActivity,
  });

  registerTool({
    name: 'resumeActivity',
    description: 'Resume a held activity',
    authority: 'ExecutionWriteService',
    permission: 'execution.start',
    riskLevel: ActionRiskLevel.HIGH_RISK_WRITE,
    readWrite: 'write',
    eventScoped: true,
    intents: [M16Intent.RESUME_ACTIVITY],
    execute: executeResumeActivity,
  });

  registerTool({
    name: 'releaseActivity',
    description: 'Release an activity to field for execution',
    authority: 'ExecutionWriteService',
    permission: 'execution.release',
    riskLevel: ActionRiskLevel.HIGH_RISK_WRITE,
    readWrite: 'write',
    eventScoped: true,
    intents: [M16Intent.RELEASE_ACTIVITY],
    execute: executeReleaseActivity,
  });

  registerTool({
    name: 'reportDelay',
    description: 'Report a delay on an activity',
    authority: 'ExecutionWriteService',
    permission: 'execution.delay',
    riskLevel: ActionRiskLevel.LOW_RISK_WRITE,
    readWrite: 'write',
    eventScoped: true,
    intents: [M16Intent.REPORT_DELAY],
    execute: executeReportDelay,
  });

  registerTool({
    name: 'verifyActivity',
    description: 'Verify/QA an activity after completion',
    authority: 'ExecutionWriteService',
    permission: 'execution.verify',
    riskLevel: ActionRiskLevel.DESTRUCTIVE,
    readWrite: 'write',
    eventScoped: true,
    intents: [M16Intent.VERIFY_ACTIVITY],
    execute: executeVerifyActivity,
  });

  registerTool({
    name: 'closeActivity',
    description: 'Close a verified activity',
    authority: 'ExecutionWriteService',
    permission: 'execution.close',
    riskLevel: ActionRiskLevel.DESTRUCTIVE,
    readWrite: 'write',
    eventScoped: true,
    intents: [M16Intent.CLOSE_ACTIVITY],
    execute: executeCloseActivity,
  });
}
