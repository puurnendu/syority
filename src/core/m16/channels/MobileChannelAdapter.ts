/**
 * M16-R5 — MobileChannelAdapter
 *
 * Mobile is a CHANNEL ADAPTER for field execution.
 * It uses EWS.applyAction() as the authoritative execution path.
 *
 * TWO MODES:
 *   1. Direct execution — button press → EWS (same as web execution UI)
 *   2. AI-mediated — text/voice → processInteraction() (same pipeline)
 *
 * FLOW (direct execution — tactile confirmation, web-button parity):
 *   Authenticated session (NextAuth)
 *     → resolveWebIdentity(session)
 *     → validate activity belongs to org/event
 *     → resolve user role (organizationMembership)
 *     → checkAuthorization() — R3 fail-closed
 *     → classifyRisk() — R3 risk classification (audit/policy; ConfirmationGate is conversational)
 *     → EWS.applyAction({ source_channel: 'mobile' })
 *     → Response
 *
 * CONFIRMATION POLICY (R5 remediation):
 *   Mobile/Web deterministic operator controls = tactile UI confirmation.
 *   Conversational AI (WhatsApp/Voice) = shared ConfirmationGate.
 *   Destructive Mobile actions REQUIRE requestId (idempotency).

 *
 * DOES NOT:
 *   - Calculate progress (M8.13 authority)
 *   - Calculate CPM/schedule (M11 authority)
 *   - Calculate readiness (M12/M10 authority)
 *   - Access Prisma for domain mutations directly
 *   - Create alternate authorization/confirmation/execution
 */

import { ExecutionWriteService } from '@/core/execution/ExecutionWriteService';
import type { ExecutionAction } from '@/core/execution/ExecutionWriteService';
import { ExecutionReadinessService } from '@/core/execution/ExecutionReadinessService';
import { checkAuthorization } from '../auth/M16AuthorizationBoundary';
import { resolveWebIdentity } from '../security/IdentityResolver';
import { buildInteractionContext } from '../context/InteractionContextBuilder';
import { classifyRisk, ConfirmationRequirement, ActionRiskLevel } from '../risk';
import { M16Intent } from '../intents';
import { prisma } from '@/lib/prisma';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface MobileSession {
  userId: string;
  userName: string;
  organizationId: string;
}

export interface MobileExecutionRequest {
  activityId: string;
  action: ExecutionAction;
  eventId: string;
  progress?: number;
  notes?: string;
  hold_reason?: string;
  hold_category?: string;
  delayDetails?: {
    category: string;
    severity: string;
    title: string;
    description: string;
    target_resolution?: string;
  };
  /** Idempotency key */
  requestId?: string;
}

export interface MobileExecutionResult {
  status: 'executed' | 'denied' | 'confirmation_required' | 'error';
  reason?: string;
  activityId?: string;
  action?: string;
  newStatus?: string;
}

export interface MobileReadinessResult {
  is_ready: boolean;
  blockers: string[];
}

// ── Idempotency Store ────────────────────────────────────────────────────────

interface CachedExecution {
  result: MobileExecutionResult;
  timestamp: number;
}

const idempotencyStore = new Map<string, CachedExecution>();
const IDEMPOTENCY_TTL_MS = 5 * 60 * 1000; // 5 minutes TTL

/** Exported for testing isolation */
export function _clearMobileIdempotencyStore(): void {
  idempotencyStore.clear();
}

// ── Action → Intent Map ──────────────────────────────────────────────────────

const ACTION_TO_INTENT: Record<ExecutionAction, M16Intent> = {
  START: M16Intent.START_ACTIVITY,
  UPDATE_PROGRESS: M16Intent.UPDATE_PROGRESS,
  COMPLETE: M16Intent.COMPLETE_ACTIVITY,
  HOLD: M16Intent.HOLD_ACTIVITY,
  RESUME: M16Intent.RESUME_ACTIVITY,
  RELEASE: M16Intent.RELEASE_ACTIVITY,
  VERIFY: M16Intent.VERIFY_ACTIVITY,
  CLOSE: M16Intent.CLOSE_ACTIVITY,
  REPORT_DELAY: M16Intent.REPORT_DELAY,
};

// ── Main Entry Points ─────────────────────────────────────────────────────────

/**
 * Execute a mobile action through the governed EWS path.
 *
 * Identity from NextAuth session. Authorization via R3 boundary.
 */
export async function processMobileExecution(
  request: MobileExecutionRequest,
  session: MobileSession,
): Promise<MobileExecutionResult> {
  // ── 0a. Check idempotency cache ───────────────────────────────────────────
  if (request.requestId) {
    const cached = idempotencyStore.get(request.requestId);
    if (cached) {
      if (Date.now() - cached.timestamp < IDEMPOTENCY_TTL_MS) {
        return cached.result;
      } else {
        idempotencyStore.delete(request.requestId);
      }
    }
  }

  // ── 0b. Validate session ──────────────────────────────────────────────────
  if (!session.userId || !session.organizationId) {
    return { status: 'denied', reason: 'Authentication required.' };
  }

  if (!request.activityId || !request.action || !request.eventId) {
    return { status: 'denied', reason: 'Missing required fields: activityId, action, eventId.' };
  }

  // ── 1. Map action to intent ────────────────────────────────────────────────
  const intent = ACTION_TO_INTENT[request.action];
  if (!intent) {
    return { status: 'denied', reason: `Unknown action: ${request.action}` };
  }

  // ── 2. Identity from trusted session ───────────────────────────────────────
  const identity = resolveWebIdentity({
    user: {
      id: session.userId,
      name: session.userName,
      organization_id: session.organizationId,
    },
  });

  // ── 3. Build M16 context ───────────────────────────────────────────────────
  const context = buildInteractionContext({
    identity,
    channel: 'mobile',
    conversationId: request.requestId || `mobile-${Date.now()}`,
    eventId: request.eventId,
    identitySource: 'oauth_token',
    siteId: null,
    messageId: request.requestId,
  });

  // ── 4. Resolve user role ───────────────────────────────────────────────────
  let userRole: string | null = null;
  try {
    const membership = await prisma.organizationMembership.findFirst({
      where: { user_id: session.userId, organization_id: session.organizationId },
      select: { role: true },
    });
    userRole = membership?.role ?? null;
  } catch {
    // fail-closed
  }

  // ── 5. R3 Authorization ────────────────────────────────────────────────────
  const authResult = checkAuthorization(context, intent, null, userRole);
  if (!authResult.authorized) {
    return {
      status: 'denied',
      reason: authResult.deniedReason || 'Not authorized for this action.',
    };
  }

  // ── 5b. R3 risk classification (always executed; ConfirmationGate is conversational-only)
  const risk = classifyRisk(intent);
  const requiresRequestId =
    risk.confirmation === ConfirmationRequirement.EXPLICIT ||
    risk.riskLevel === ActionRiskLevel.DESTRUCTIVE ||
    risk.riskLevel === ActionRiskLevel.HIGH_RISK_WRITE;
  if (requiresRequestId && !request.requestId) {
    return {
      status: 'denied',
      reason: 'requestId is required for this action.',
    };
  }

  // ── 6. Validate activity belongs to org/event ──────────────────────────────
  const activity = await prisma.activity.findFirst({
    where: {
      id: request.activityId,
      organization_id: session.organizationId,
      event_id: request.eventId,
      deleted_at: null,
    },
    select: { id: true, status: true, activity_number: true },
  });

  if (!activity) {
    return {
      status: 'denied',
      reason: 'Activity not found or does not belong to your organization/event.',
    };
  }

  // ── 6b. Guard against stale commands on completed/verified/closed activities ──
  const terminalStatuses = ['completed', 'verified', 'closed'];
  if (terminalStatuses.includes(activity.status)) {
    if (request.action === 'UPDATE_PROGRESS' && (request.progress ?? 0) < 100) {
      return {
        status: 'error',
        reason: `Cannot update progress on an activity that is already ${activity.status}.`,
      };
    }
    if (request.action === 'START' || request.action === 'HOLD' || request.action === 'RESUME') {
      return {
        status: 'error',
        reason: `Cannot execute ${request.action} on an activity that is already ${activity.status}.`,
      };
    }
  }

  // ── 7. Execute via EWS ─────────────────────────────────────────────────────
  try {
    const result = await ExecutionWriteService.applyAction(
      session.organizationId,
      session.userId,
      {
        activityId: request.activityId,
        action: request.action,
        progress: request.progress,
        notes: request.notes,
        hold_reason: request.hold_reason,
        hold_category: request.hold_category,
        delayDetails: request.delayDetails,
      },
      {
        source_channel: 'mobile',
      }
    );

    const execResult: MobileExecutionResult = {
      status: 'executed',
      activityId: request.activityId,
      action: request.action,
      newStatus: result?.activity?.status || result?.newStatus || undefined,
    };

    if (request.requestId) {
      idempotencyStore.set(request.requestId, {
        result: execResult,
        timestamp: Date.now(),
      });
    }

    return execResult;
  } catch (err: any) {
    // User-friendly error messages
    const message = err.message || 'Execution failed';

    // Filter out internal details
    if (message.includes('Prisma') || message.includes('P2025')) {
      return { status: 'error', reason: 'Unable to update activity. Please try again.' };
    }

    return { status: 'error', reason: message };
  }
}

/**
 * Get readiness for an activity (read-only, from authoritative service).
 */
export async function getMobileReadiness(
  activityId: string,
  session: MobileSession,
): Promise<MobileReadinessResult> {
  return ExecutionReadinessService.evaluateReadiness(
    session.organizationId,
    activityId
  );
}
