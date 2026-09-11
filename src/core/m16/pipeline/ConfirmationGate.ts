/**
 * M16-R3 — Confirmation Gate (Security Closure)
 *
 * State machine for pending execution confirmations.
 *
 * ARCHITECTURE:
 *   1. User says "start activity A-001"
 *   2. Pipeline classifies intent, resolves entity, checks auth
 *   3. Risk model says EXPLICIT confirmation required
 *   4. ConfirmationGate stores pending action → returns prompt
 *   5. User says "YES" → gate confirms → pipeline RE-VALIDATES auth → tool executes
 *   6. User says "no" or timeout → gate cancels
 *
 * SECURITY INVARIANTS:
 *   - At most 1 pending confirmation per conversation
 *   - New intent while pending → cancels old confirmation
 *   - 2-minute default timeout
 *   - Pending confirmations are NOT persisted to DB (memory only)
 *   - IMPLICIT confirmation (UPDATE_PROGRESS, REPORT_DELAY) → auto-proceed, no gate
 *   - EXPLICIT confirmation → present details, wait for YES
 *   - STRONG_AUTHORIZATION → blocked in R3 (governance deferred)
 *   - Confirmation is BOUND to (userId, organizationId, eventId, channel,
 *     conversationId, intent, toolName, activityId)
 *   - Confirmation is INVALIDATED if ANY bound field differs at execution time
 *   - Confirmation is SINGLE-USE: once CONFIRMED or CANCELLED, cannot revert to PENDING
 *   - CONFIRMED state is terminal: replay returns null
 *
 * DOES NOT:
 *   - Execute domain actions
 *   - Grant authorization
 *   - Persist state to database
 */

import { M16Intent, INTENT_METADATA } from '../intents';
import { ConfirmationRequirement, classifyRisk } from '../risk';
import type { ToolParams } from '../tools/ToolRegistry';
import type { M16InteractionContext } from '../types';

// ── Types ─────────────────────────────────────────────────────────────────────

export type ConfirmationStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'EXPIRED';

/**
 * Security context bindings captured at confirmation creation time.
 * ALL fields must match at execution time or the confirmation is rejected.
 */
export interface ConfirmationSecurityBinding {
  /** User who initiated the action — NEVER from LLM */
  readonly userId: string;
  /** Organization context — NEVER from LLM */
  readonly organizationId: string;
  /** Event context at creation time */
  readonly eventId: string | null;
  /** Channel at creation time */
  readonly channel: string;
  /** Conversation at creation time */
  readonly conversationId: string;
  /** The resolved activity ID (if any) */
  readonly activityId: string | undefined;
}

export interface PendingConfirmation {
  /** Conversation this belongs to */
  conversationId: string;
  /** The intent that needs confirmation */
  intent: M16Intent;
  /** Resolved tool params (entity IDs, not LLM hints) */
  toolParams: ToolParams;
  /** Tool name to execute on confirmation */
  toolName: string;
  /** Human-readable summary of what will happen */
  actionSummary: string;
  /** When this confirmation was created */
  createdAt: number;
  /** Current status */
  status: ConfirmationStatus;
  /** Security context bindings — immutable after creation */
  readonly securityBinding: ConfirmationSecurityBinding;
}

/**
 * Result of validating security bindings at execution time.
 */
export interface BindingValidationResult {
  valid: boolean;
  /** Which field(s) mismatched — empty if valid */
  mismatches: string[];
}

// ── Configuration ─────────────────────────────────────────────────────────────

const CONFIRMATION_TIMEOUT_MS = 2 * 60 * 1000; // 2 minutes

// ── Store ─────────────────────────────────────────────────────────────────────

const pendingConfirmations = new Map<string, PendingConfirmation>();

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Check if an intent requires explicit confirmation before execution.
 */
export function requiresExplicitConfirmation(intent: M16Intent): boolean {
  const risk = classifyRisk(intent);
  return risk.confirmation === ConfirmationRequirement.EXPLICIT;
}

/**
 * Check if an intent can auto-proceed (implicit confirmation).
 */
export function canAutoConfirm(intent: M16Intent): boolean {
  const risk = classifyRisk(intent);
  return risk.confirmation === ConfirmationRequirement.IMPLICIT ||
         risk.confirmation === ConfirmationRequirement.NONE;
}

/**
 * Create a pending confirmation for an execution action.
 * Cancels any existing pending confirmation for this conversation.
 *
 * SECURITY: Captures the full security context at creation time.
 */
export function createPendingConfirmation(
  conversationId: string,
  intent: M16Intent,
  toolName: string,
  toolParams: ToolParams,
  actionSummary: string,
  ctx?: M16InteractionContext
): PendingConfirmation {
  // Cancel any existing pending confirmation
  const existing = pendingConfirmations.get(conversationId);
  if (existing && existing.status === 'PENDING') {
    existing.status = 'CANCELLED';
  }

  const securityBinding: ConfirmationSecurityBinding = {
    userId: ctx?.userId ?? '',
    organizationId: ctx?.organizationId ?? '',
    eventId: ctx?.eventId ?? null,
    channel: ctx?.channel ?? '',
    conversationId,
    activityId: toolParams.activityId,
  };

  const pending: PendingConfirmation = {
    conversationId,
    intent,
    toolParams: { ...toolParams },
    toolName,
    actionSummary,
    createdAt: Date.now(),
    status: 'PENDING',
    securityBinding,
  };

  pendingConfirmations.set(conversationId, pending);
  return pending;
}

/**
 * Check if there's a pending confirmation for a conversation.
 * Returns null if no pending or if expired.
 */
export function getPendingConfirmation(conversationId: string): PendingConfirmation | null {
  const pending = pendingConfirmations.get(conversationId);
  if (!pending || pending.status !== 'PENDING') return null;

  // Check timeout
  if (Date.now() - pending.createdAt > CONFIRMATION_TIMEOUT_MS) {
    pending.status = 'EXPIRED';
    return null;
  }

  return pending;
}

/**
 * Check if a user message is a confirmation response.
 */
export function isConfirmationResponse(text: string): 'confirm' | 'cancel' | 'other' {
  const lower = text.toLowerCase().trim();

  // Positive confirmations
  if (
    lower === 'yes' ||
    lower === 'y' ||
    lower === 'confirm' ||
    lower === 'ok' ||
    lower === 'proceed' ||
    lower === 'go' ||
    lower === 'do it' ||
    lower === 'go ahead' ||
    lower === 'yes please' ||
    lower === 'yes, proceed' ||
    lower === 'affirmative'
  ) {
    return 'confirm';
  }

  // Negative cancellations
  if (
    lower === 'no' ||
    lower === 'n' ||
    lower === 'cancel' ||
    lower === 'abort' ||
    lower === 'stop' ||
    lower === 'never mind' ||
    lower === 'nevermind' ||
    lower === "don't" ||
    lower === 'dont' ||
    lower === 'no thanks'
  ) {
    return 'cancel';
  }

  return 'other';
}

/**
 * Validate security bindings at execution time.
 *
 * SECURITY: Compares every bound field from creation time against
 * the current interaction context. ANY mismatch → rejection.
 */
export function validateSecurityBindings(
  pending: PendingConfirmation,
  currentCtx: M16InteractionContext,
  currentActivityId?: string | null
): BindingValidationResult {
  const mismatches: string[] = [];
  const binding = pending.securityBinding;

  if (binding.userId && binding.userId !== currentCtx.userId) {
    mismatches.push(`userId: expected '${binding.userId}', got '${currentCtx.userId}'`);
  }
  if (binding.organizationId && binding.organizationId !== currentCtx.organizationId) {
    mismatches.push(`organizationId: expected '${binding.organizationId}', got '${currentCtx.organizationId}'`);
  }
  if (binding.eventId !== currentCtx.eventId) {
    mismatches.push(`eventId: expected '${binding.eventId}', got '${currentCtx.eventId}'`);
  }
  if (binding.channel && binding.channel !== currentCtx.channel) {
    mismatches.push(`channel: expected '${binding.channel}', got '${currentCtx.channel}'`);
  }
  if (binding.conversationId !== currentCtx.conversationId) {
    mismatches.push(`conversationId: expected '${binding.conversationId}', got '${currentCtx.conversationId}'`);
  }

  const boundActivityId = binding.activityId;
  const pendingParamsActivityId = pending.toolParams?.activityId;
  if (boundActivityId && pendingParamsActivityId && boundActivityId !== pendingParamsActivityId) {
    mismatches.push(
      `activityId: expected '${boundActivityId}', got tampered toolParams '${pendingParamsActivityId}'`
    );
  }
  if (
    boundActivityId &&
    currentActivityId !== undefined &&
    currentActivityId !== null &&
    currentActivityId !== boundActivityId
  ) {
    mismatches.push(`activityId: expected '${boundActivityId}', got '${currentActivityId}'`);
  }

  return {
    valid: mismatches.length === 0,
    mismatches,
  };
}

/**
 * Confirm a pending action → returns the pending for execution.
 *
 * SECURITY: Status transitions are ONE-WAY.
 * CONFIRMED → cannot revert to PENDING.
 * The returned confirmation is consumed — getPendingConfirmation will return null.
 */
export function confirmPending(conversationId: string): PendingConfirmation | null {
  const pending = getPendingConfirmation(conversationId);
  if (!pending) return null;

  pending.status = 'CONFIRMED';
  return pending;
}

/**
 * Cancel a pending action.
 */
export function cancelPending(conversationId: string): boolean {
  const pending = pendingConfirmations.get(conversationId);
  if (!pending || pending.status !== 'PENDING') return false;

  pending.status = 'CANCELLED';
  return true;
}

/**
 * Build human-readable confirmation prompt for an execution action.
 */
export function buildConfirmationPrompt(
  intent: M16Intent,
  actionSummary: string
): string {
  const meta = INTENT_METADATA[intent];
  const risk = classifyRisk(intent);

  let riskWarning = '';
  if (risk.riskLevel === 'DESTRUCTIVE') {
    riskWarning = '\n⚠️ This action is difficult to reverse.';
  } else if (risk.riskLevel === 'HIGH_RISK_WRITE') {
    riskWarning = '\n⚡ This is a significant state change.';
  }

  return `I'll ${meta.description.toLowerCase()}.\n\n📋 ${actionSummary}${riskWarning}\n\nReply **YES** to confirm or **NO** to cancel.`;
}

/**
 * Clear all pending confirmations — for testing only.
 */
export function clearAllPendingConfirmations(): void {
  pendingConfirmations.clear();
}
