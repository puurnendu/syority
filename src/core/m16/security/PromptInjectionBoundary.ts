/**
 * M16 — Prompt Injection Boundary
 *
 * Guards trusted context fields against LLM output tampering.
 *
 * User text is UNTRUSTED INPUT. The LLM may interpret text but
 * cannot elevate trust. This module enforces the boundary between
 * LLM output (untrusted) and application context (trusted).
 *
 * The LLM CANNOT:
 *   - Override organizationId
 *   - Override eventId
 *   - Override userId
 *   - Manufacture entity IDs
 *   - Assert permissions
 *   - Bypass authorization
 */

import type { M16InteractionContext } from '../types';

// ── Trusted Fields ────────────────────────────────────────────────────────────

/**
 * Fields in M16InteractionContext that are TRUSTED and CANNOT be
 * modified by LLM output under any circumstances.
 */
const TRUSTED_CONTEXT_FIELDS: ReadonlySet<keyof M16InteractionContext> = new Set([
  'organizationId',
  'userId',
  'eventId',
  'channel',
  'conversationId',
  'identitySource',
  'siteId',
]);

/**
 * UUID v4 regex pattern for detecting LLM-manufactured IDs.
 */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Validate that LLM output has not altered trusted context fields.
 *
 * Compares a "before" context (trusted, built from application state)
 * with an "after" partial (potentially containing LLM-influenced values).
 *
 * Returns true if context integrity is maintained (no trusted field overridden).
 */
export function validateContextIntegrity(
  trustedContext: M16InteractionContext,
  llmSuggestedOverrides: Record<string, unknown>
): { valid: boolean; violations: string[] } {
  const violations: string[] = [];

  for (const field of TRUSTED_CONTEXT_FIELDS) {
    if (field in llmSuggestedOverrides) {
      const trustedValue = trustedContext[field];
      const suggestedValue = llmSuggestedOverrides[field];

      if (suggestedValue !== undefined && suggestedValue !== trustedValue) {
        violations.push(
          `PROMPT_INJECTION: LLM attempted to override trusted field '${field}' ` +
          `from '${String(trustedValue)}' to '${String(suggestedValue)}'`
        );
      }
    }
  }

  return { valid: violations.length === 0, violations };
}

/**
 * Sanitize LLM entity hints by stripping any UUID-like values.
 *
 * The LLM may produce entity references (equipment tags, workpack codes),
 * but it must NEVER produce actual database IDs. Those must come from
 * the authoritative M16EntityResolver.
 *
 * @param hints - Raw entity hints from LLM output
 * @returns Sanitized hints with UUIDs stripped
 */
export function sanitizeLlmEntityHints(hints: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(hints)) {
    if (typeof value === 'string' && UUID_PATTERN.test(value)) {
      // Strip manufactured UUIDs — the resolver will look up real IDs
      sanitized[key] = null;
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Check if a message appears to contain prompt injection patterns.
 *
 * This is a heuristic check — it does NOT prevent injection on its own.
 * The real protection is the trust boundary: LLM output never populates
 * trusted context fields regardless of what the message contains.
 *
 * @returns Array of detected injection patterns (empty if none)
 */
export function detectInjectionPatterns(message: string): string[] {
  const patterns: string[] = [];
  const lower = message.toLowerCase();

  const injectionPatterns = [
    { pattern: /ignore.*previous.*instructions/i, label: 'INSTRUCTION_OVERRIDE' },
    { pattern: /you are now.*admin/i, label: 'ROLE_ESCALATION' },
    { pattern: /set.*event.?id.*to/i, label: 'CONTEXT_OVERRIDE' },
    { pattern: /ignore.{0,40}event.{0,20}context/i, label: 'CONTEXT_OVERRIDE' },
    { pattern: /from another (event|organization|tenant)/i, label: 'CONTEXT_OVERRIDE' },
    { pattern: /set.*organization.*to/i, label: 'TENANT_OVERRIDE' },
    { pattern: /bypass.*auth/i, label: 'AUTH_BYPASS' },
    { pattern: /ignore.*current.*turnaround/i, label: 'EVENT_OVERRIDE' },
    { pattern: /use.*another.*organization/i, label: 'TENANT_SWITCH' },
    { pattern: /switch.*to.*org/i, label: 'TENANT_SWITCH' },
  ];

  for (const { pattern, label } of injectionPatterns) {
    if (pattern.test(message)) {
      patterns.push(label);
    }
  }

  return patterns;
}
