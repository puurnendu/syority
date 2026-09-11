/**
 * M16 — Interaction Context Builder
 *
 * Assembles the full M16InteractionContext from identity + event + channel.
 * Validates all mandatory fields are populated before returning.
 * Fails fast if trusted fields are missing.
 *
 * SECURITY:
 *   - All trusted fields come from application context
 *   - LLM output NEVER populates this context
 *   - Context is immutable once built (readonly interface)
 */

import type { M16InteractionContext, M16Channel, IdentitySource, M16Identity } from '../types';

// ── Build Parameters ──────────────────────────────────────────────────────────

export interface ContextBuildParams {
  /** Resolved identity from IdentityResolver */
  identity: M16Identity;
  /** The interaction channel */
  channel: M16Channel;
  /** Unique conversation/session ID */
  conversationId: string;
  /** Resolved event ID (may be null for non-event-scoped operations) */
  eventId: string | null;
  /** Site ID derived from event */
  siteId: string | null;
  /** Channel-specific message ID */
  messageId: string | null;
  /** How identity was established */
  identitySource: IdentitySource;
}

// ── Builder ───────────────────────────────────────────────────────────────────

/**
 * Build a complete M16InteractionContext from resolved components.
 *
 * @throws Error if mandatory fields are missing
 */
export function buildInteractionContext(params: ContextBuildParams): M16InteractionContext {
  // Validate mandatory fields
  if (!params.identity.organizationId) {
    throw new Error('M16_CONTEXT_ERROR: organizationId is required (from authenticated user)');
  }
  if (!params.identity.userId) {
    throw new Error('M16_CONTEXT_ERROR: userId is required (from authenticated user)');
  }
  if (!params.channel) {
    throw new Error('M16_CONTEXT_ERROR: channel is required');
  }
  if (!params.conversationId) {
    throw new Error('M16_CONTEXT_ERROR: conversationId is required');
  }

  // Build immutable context — all fields from trusted sources
  const context: M16InteractionContext = {
    organizationId: params.identity.organizationId,
    userId: params.identity.userId,
    channel: params.channel,
    conversationId: params.conversationId,
    eventId: params.eventId,
    identitySource: params.identitySource,
    siteId: params.siteId,
    messageId: params.messageId,
  };

  return Object.freeze(context);
}
