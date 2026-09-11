/**
 * M16 — Secure Interaction Foundation
 * Core Type Definitions
 *
 * These types define the trusted interaction context, channel adapters,
 * identity sources, and resolution result types used throughout M16.
 *
 * ARCHITECTURE:
 *   - M16InteractionContext is REQUEST-SCOPED, built per interaction
 *   - Trusted fields (organizationId, userId, eventId) come from
 *     authenticated application context, NEVER from LLM output
 *   - LLM output is UNTRUSTED and passes through validation before
 *     populating any context fields
 *
 * AUTHORITY:
 *   - M16 does NOT calculate progress (M8.13)
 *   - M16 does NOT calculate CPM/schedule (M11)
 *   - M16 does NOT perform execution writes (M12 EWS)
 *   - M16 is an INTERACTION / ORCHESTRATION layer
 */

// ── Channel & Identity ────────────────────────────────────────────────────────

/** Supported M16 interaction channels */
export type M16Channel = 'web' | 'whatsapp' | 'voice' | 'mobile' | 'api';

/** How the user's identity was established */
export type IdentitySource =
  | 'session_cookie'   // Web — NextAuth session
  | 'phone_number'     // WhatsApp — phone→user mapping
  | 'oauth_token'      // Mobile — OAuth2
  | 'api_key';         // API — service-to-service

// ── Interaction Context ───────────────────────────────────────────────────────

/**
 * The trusted, request-scoped context for every M16 interaction.
 *
 * CRITICAL: organizationId, userId, and eventId are populated from
 * TRUSTED application sources only. The LLM cannot set these fields.
 */
export interface M16InteractionContext {
  // ── Mandatory (must be resolved before any query/action) ──
  /** From authenticated user — NEVER from LLM */
  readonly organizationId: string;
  /** From authenticated/resolved user — NEVER from LLM */
  readonly userId: string;
  /** Channel adapter entry point */
  readonly channel: M16Channel;
  /** Unique per interaction session (whatsapp_sessions.id or web chat session) */
  readonly conversationId: string;

  // ── Mandatory for event-scoped operations ──
  /** Resolved from session/context/user-selection — NEVER from LLM */
  readonly eventId: string | null;

  // ── Derived (populated during pipeline) ──
  /** How identity was established */
  readonly identitySource: IdentitySource;
  /** Derived from event.site_id */
  readonly siteId: string | null;
  /** Channel-specific (meta_message_id for WhatsApp) */
  readonly messageId: string | null;
}

// ── Event Context Resolution ──────────────────────────────────────────────────

/** How event context was determined */
export type EventResolution =
  | 'SESSION'         // From persisted session state (whatsapp_sessions.event_id or cookie)
  | 'SINGLE_EVENT'    // Org has exactly one active event — auto-selected
  | 'USER_SELECTED'   // User explicitly specified event in message
  | 'AMBIGUOUS'       // Multiple events, user must select
  | 'NONE';           // No events available

export interface EventContextResult {
  eventId: string | null;
  eventCode: string | null;
  eventName: string | null;
  siteId: string | null;
  resolution: EventResolution;
  /** Available events when resolution is AMBIGUOUS */
  candidates?: Array<{ id: string; code: string; name: string }>;
}

// ── Entity Resolution ─────────────────────────────────────────────────────────

/** Outcome of an entity resolution attempt */
export type EntityResolutionOutcome =
  | 'RESOLVED'        // Single unambiguous match
  | 'AMBIGUOUS'       // Multiple candidates
  | 'NOT_FOUND';      // No match

export interface EquipmentResolution {
  outcome: EntityResolutionOutcome;
  assetId?: string;
  tagNumber?: string;
  assetName?: string;
  unitId?: string;
  candidates?: Array<{ id: string; tagNumber: string; name: string }>;
}

export interface WorkpackResolution {
  outcome: EntityResolutionOutcome;
  workpackId?: string;
  workpackNumber?: string;
  workpackTitle?: string;
  eventId?: string;
  candidates?: Array<{ id: string; number: string; title: string; eventCode?: string }>;
}

export interface ActivityResolution {
  outcome: EntityResolutionOutcome;
  activityId?: string;
  activityNumber?: string;
  description?: string;
  workpackId?: string;
  candidates?: Array<{ id: string; number: string; description: string }>;
}

/** Composite resolution result for an entire interaction */
export interface M16ResolvedEntities {
  equipment: EquipmentResolution | null;
  workpack: WorkpackResolution | null;
  activity: ActivityResolution | null;
}

// ── Authorization ─────────────────────────────────────────────────────────────

export interface AuthorizationResult {
  authorized: boolean;
  deniedReason?: string;
  permission?: string;
  /** Checked from application-side permission system, NEVER from LLM */
  checkedBy: 'application';
}

// ── Identity ──────────────────────────────────────────────────────────────────

export interface M16Identity {
  userId: string;
  organizationId: string;
  userName: string;
  verified: boolean;
  optedIn: boolean;
  preferredLanguage: string | null;
  phoneNumber: string | null;
}
