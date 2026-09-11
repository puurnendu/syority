/**
 * M16 — Authorization Boundary
 *
 * Dedicated conceptual boundary between intent/entity resolution
 * and domain action.
 *
 * The LLM CANNOT assert "the user is authorized".
 * Authorization MUST come from application-side permission checks.
 *
 * ARCHITECTURE:
 *   LLM → Intent → Entity → AUTHORIZATION BOUNDARY → Risk → Confirm → Domain Service
 *
 * R3: Enforces actual permission checks via hasPermission(role, permission).
 *
 * This module makes bypassing the architecture difficult/impossible.
 */

import type { M16InteractionContext, AuthorizationResult, M16ResolvedEntities } from '../types';
import { M16Intent, M16IntentCategory, getIntentCategory } from '../intents';
import { classifyRisk, isAllowedOnChannel } from '../risk';
import { hasPermission } from '@/lib/permissions';
import type { M16Channel } from '../types';

// ── Permission Mapping ────────────────────────────────────────────────────────

/**
 * Map M16 intents to application permissions.
 * These align with the existing permission system in @/lib/permissions.
 */
const INTENT_PERMISSION_MAP: Partial<Record<M16Intent, string>> = {
  // Execution intents require specific permissions
  [M16Intent.RELEASE_ACTIVITY]:  'execution.release',
  [M16Intent.START_ACTIVITY]:    'execution.start',
  [M16Intent.UPDATE_PROGRESS]:   'execution.update',
  [M16Intent.HOLD_ACTIVITY]:     'execution.hold',
  [M16Intent.RESUME_ACTIVITY]:   'execution.start',
  [M16Intent.REPORT_DELAY]:      'execution.delay',
  [M16Intent.COMPLETE_ACTIVITY]: 'execution.complete',
  [M16Intent.VERIFY_ACTIVITY]:   'execution.verify',
  [M16Intent.CLOSE_ACTIVITY]:    'execution.close',
  // Governance intents require strong permissions
  [M16Intent.CHANGE_SCOPE]:         'scope.manage',
  [M16Intent.CHANGE_SCHEDULE]:      'schedule.manage',
  [M16Intent.CHANGE_MASTER_DATA]:   'admin.manage',
  [M16Intent.CHANGE_CONFIGURATION]: 'admin.manage',
};

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Check if the current interaction is authorized for the given intent.
 *
 * R3: Full enforcement for execution intents.
 *
 * @param ctx      - Trusted M16InteractionContext
 * @param intent   - Validated M16Intent
 * @param entities - Resolved entities (may be null for non-entity intents)
 * @param userRole - Optional user role for permission checks (avoids DB lookup when available)
 */
export function checkAuthorization(
  ctx: M16InteractionContext,
  intent: M16Intent,
  entities: M16ResolvedEntities | null,
  userRole?: string | null
): AuthorizationResult {
  // 1. Channel restriction check
  if (ctx.channel === 'whatsapp' || ctx.channel === 'voice') {
    const channel = ctx.channel as 'whatsapp' | 'voice';
    if (!isAllowedOnChannel(intent, channel)) {
      return {
        authorized: false,
        deniedReason: `Intent '${intent}' is not allowed via ${ctx.channel} channel. Use the web interface for governance operations.`,
        permission: INTENT_PERMISSION_MAP[intent] || undefined,
        checkedBy: 'application',
      };
    }
  }

  // 2. Event context requirement check
  const category = getIntentCategory(intent);
  if (
    category === M16IntentCategory.EXECUTION &&
    !ctx.eventId
  ) {
    return {
      authorized: false,
      deniedReason: `Execution intent '${intent}' requires event context, but no event is selected.`,
      permission: INTENT_PERMISSION_MAP[intent] || undefined,
      checkedBy: 'application',
    };
  }

  // 3. Query/Navigation/System intents — generally authorized (view permission assumed)
  if (category === M16IntentCategory.QUERY ||
      category === M16IntentCategory.NAVIGATION ||
      category === M16IntentCategory.SYSTEM) {
    return {
      authorized: true,
      permission: undefined,
      checkedBy: 'application',
    };
  }

  // 4. Governance intents — blocked in R3 (deferred to R5+)
  if (category === M16IntentCategory.GOVERNANCE) {
    return {
      authorized: false,
      deniedReason: 'Governance actions are not yet available via the AI assistant. Use the web interface.',
      permission: INTENT_PERMISSION_MAP[intent] || undefined,
      checkedBy: 'application',
    };
  }

  // 5. Execution intents — FAIL-CLOSED permission check
  //    Missing, undefined, or invalid role → DENIED. No fail-open.
  const requiredPermission = INTENT_PERMISSION_MAP[intent];

  // 5a. No mapped permission means unmapped execution intent → deny
  if (!requiredPermission) {
    return {
      authorized: false,
      deniedReason: `Execution intent '${intent}' has no mapped permission. Action blocked.`,
      permission: undefined,
      checkedBy: 'application',
    };
  }

  // 5b. No role provided → deny (fail-closed: never allow execution without verified role)
  if (!userRole) {
    return {
      authorized: false,
      deniedReason: `Authorization requires a verified user role. No role was provided for intent '${intent}'.`,
      permission: requiredPermission,
      checkedBy: 'application',
    };
  }

  // 5c. Role provided but lacks permission → deny
  if (!hasPermission(userRole, requiredPermission as any)) {
    return {
      authorized: false,
      deniedReason: `You don't have permission to perform '${intent}'. Required: ${requiredPermission}. Contact your administrator.`,
      permission: requiredPermission,
      checkedBy: 'application',
    };
  }

  // All checks passed — authorized for execution
  return {
    authorized: true,
    permission: requiredPermission,
    checkedBy: 'application',
  };
}

/**
 * Get the required permission for an intent.
 */
export function getRequiredPermissionForIntent(intent: M16Intent): string | null {
  return INTENT_PERMISSION_MAP[intent] || null;
}

