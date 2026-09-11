/**
 * M16-R2 — Intent Classifier
 *
 * LLM-assisted intent classification with deterministic validation.
 *
 * ARCHITECTURE:
 *   1. Takes raw user text + optional conversation history
 *   2. Calls LLM with constrained output schema (JSON mode)
 *   3. Validates output against known M16Intent enum
 *   4. Falls back to UNKNOWN for unrecognized intents
 *   5. Extracts entity hints alongside intent
 *
 * TRUST BOUNDARY:
 *   - LLM output is UNTRUSTED
 *   - Intent must match known enum via validateIntent()
 *   - Entity hints are PROPOSALS — application resolves them
 *   - LLM-generated arbitrary intent strings → UNKNOWN
 *
 * DOES NOT:
 *   - Grant authorization
 *   - Determine tenant/event
 *   - Access Prisma directly
 */

import { M16Intent, validateIntent, INTENT_METADATA, M16IntentCategory } from '../intents';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface EntityHints {
  /** Equipment tag reference (e.g., "HX-204", "E-101A") */
  equipmentTag: string | null;
  /** Workpack number reference (e.g., "WP-042") */
  workpackNumber: string | null;
  /** Activity description reference (e.g., "bundle pullout") */
  activityDescription: string | null;
  /** Event code reference (e.g., "TA-2027") */
  eventCode: string | null;
  /** Unit reference (e.g., "CDU", "FCC") */
  unitName: string | null;
  /** Discipline reference (e.g., "mechanical", "electrical") */
  discipline: string | null;
  /** Contractor reference */
  contractor: string | null;
  /** Raw target for navigation (e.g., "delayed workpacks", "critical activities") */
  navigationTarget: string | null;
}

export interface ClassificationResult {
  /** Validated M16Intent */
  intent: M16Intent;
  /** Confidence score 0–1 from LLM */
  confidence: number;
  /** Entity hints extracted from user text — ALL are UNTRUSTED proposals */
  entityHints: EntityHints;
  /** Whether the LLM's raw intent was recognized */
  intentRecognized: boolean;
  /** The raw intent string from LLM (for audit) */
  rawLlmIntent: string;
}

export interface ConversationTurn {
  role: 'user' | 'assistant';
  content: string;
}

// ── Classification Prompt ─────────────────────────────────────────────────────

const INTENT_LIST = Object.values(M16Intent).join(', ');

const CLASSIFICATION_SYSTEM_PROMPT = `You are an intent classifier for an industrial turnaround (STO) management system.

Given a user message, classify it into exactly ONE intent and extract entity references.

AVAILABLE INTENTS:
${INTENT_LIST}

INTENT DESCRIPTIONS:
- GET_PROGRESS: User asks about progress (overall, equipment, workpack, activity)
- GET_ACTIVITY_STATUS: User asks about a specific activity's status
- GET_WORKPACK_STATUS: User asks about a workpack's status
- GET_READINESS: User asks if something is ready to start/execute
- GET_CONSTRAINTS: User asks about open constraints or blockers
- GET_DELAY: User asks about delayed activities or delay reasons
- GET_SCHEDULE: User asks about today's schedule or upcoming activities
- GET_REPORT: User asks for a report
- GET_LOOKAHEAD: User asks about lookahead (24h, 72h, 7d)
- GET_MANAGEMENT_RISKS: User asks why something is a management concern / top risks
- GET_RECOMMENDATIONS: User asks what management should consider doing
- GET_MANAGEMENT_FORECAST: User asks for management/schedule/cost forecast from M15
- GET_MANAGEMENT_IMPACT: User asks about downstream/network impact of an activity
- RUN_WHAT_IF: User asks a hypothetical what-if (crews, slip, delay) — not live execution
- RECORD_MANAGEMENT_DECISION: User accepts/rejects/defers a recommendation (NOT start/release/complete)
- RELEASE_ACTIVITY: User wants to release an activity
- START_ACTIVITY: User wants to start an activity
- UPDATE_PROGRESS: User wants to report/update progress
- HOLD_ACTIVITY: User wants to put something on hold
- RESUME_ACTIVITY: User wants to resume something on hold
- REPORT_DELAY: User wants to report a delay
- COMPLETE_ACTIVITY: User wants to mark something complete
- VERIFY_ACTIVITY: User wants to verify/QA something
- CLOSE_ACTIVITY: User wants to close an activity
- OPEN_EQUIPMENT: User wants to see/open/show equipment details
- OPEN_WORKPACK: User wants to see/open/show a workpack
- OPEN_ACTIVITY: User wants to see/open/show an activity
- OPEN_CONTROL_TOWER: User wants to see the control tower/dashboard
- OPEN_REPORT: User wants to open/view a report
- SELECT_EVENT: User wants to switch turnaround/event
- CHANGE_SCOPE: User wants to change scope
- CHANGE_SCHEDULE: User wants to change schedule
- CHANGE_MASTER_DATA: User wants to change master data
- CHANGE_CONFIGURATION: User wants to change configuration
- HELP: User asks for help or capabilities
- UNKNOWN: Cannot determine intent

RULES:
1. Return exactly ONE intent from the list above
2. If the user asks "show me X" or "take me to X", classify as OPEN_* navigation
3. If the user asks "what is the status/progress of X", classify as GET_* query
4. If the user wants to PERFORM an action (start, complete, hold), classify as execution intent
4b. "Execute the recommendation" is NOT an execution intent — if they did not name start/release/complete, use UNKNOWN
5. If you cannot determine the intent with >50% confidence, return UNKNOWN
6. Extract all entity references you can find

Respond ONLY with valid JSON matching this schema:
{"intent":"<INTENT>","confidence":0.0,"equipment_tag":null,"workpack_number":null,"activity_description":null,"event_code":null,"unit_name":null,"discipline":null,"contractor":null,"navigation_target":null}`;

// ── Classifier ────────────────────────────────────────────────────────────────

/**
 * Classify user intent using LLM with deterministic validation.
 *
 * @param text - Raw user message (UNTRUSTED)
 * @param history - Previous conversation turns for context
 * @param llmCaller - Injected LLM call function (for testability)
 * @returns ClassificationResult with validated intent
 */
export async function classifyIntent(
  text: string,
  history: ConversationTurn[],
  llmCaller: (systemPrompt: string, userPrompt: string) => Promise<string>
): Promise<ClassificationResult> {
  // Build user prompt with conversation context
  const historyContext = history.length > 0
    ? '\n\nRecent conversation:\n' + history.slice(-4).map(t => `${t.role}: ${t.content}`).join('\n')
    : '';

  const userPrompt = `${historyContext}\n\nClassify this message:\n"${text}"`;

  let rawLlmIntent = 'UNKNOWN';
  let confidence = 0;
  let entityHints: EntityHints = {
    equipmentTag: null,
    workpackNumber: null,
    activityDescription: null,
    eventCode: null,
    unitName: null,
    discipline: null,
    contractor: null,
    navigationTarget: null,
  };

  try {
    const rawResponse = await llmCaller(CLASSIFICATION_SYSTEM_PROMPT, userPrompt);
    const cleaned = rawResponse
      .replace(/```json\s*/g, '')
      .replace(/```/g, '')
      .trim();

    const parsed = JSON.parse(cleaned) as Record<string, unknown>;

    rawLlmIntent = typeof parsed.intent === 'string' ? parsed.intent : 'UNKNOWN';
    confidence = typeof parsed.confidence === 'number' ? Math.min(1, Math.max(0, parsed.confidence)) : 0;

    entityHints = {
      equipmentTag: typeof parsed.equipment_tag === 'string' ? parsed.equipment_tag : null,
      workpackNumber: typeof parsed.workpack_number === 'string' ? parsed.workpack_number : null,
      activityDescription: typeof parsed.activity_description === 'string' ? parsed.activity_description : null,
      eventCode: typeof parsed.event_code === 'string' ? parsed.event_code : null,
      unitName: typeof parsed.unit_name === 'string' ? parsed.unit_name : null,
      discipline: typeof parsed.discipline === 'string' ? parsed.discipline : null,
      contractor: typeof parsed.contractor === 'string' ? parsed.contractor : null,
      navigationTarget: typeof parsed.navigation_target === 'string' ? parsed.navigation_target : null,
    };
  } catch {
    // LLM returned invalid JSON — safe fallback
    rawLlmIntent = 'UNKNOWN';
    confidence = 0;
  }

  // TRUST BOUNDARY: validate LLM intent against known enum
  const intent = validateIntent(rawLlmIntent);
  const intentRecognized = intent !== M16Intent.UNKNOWN || rawLlmIntent === 'UNKNOWN';

  return {
    intent,
    confidence,
    entityHints,
    intentRecognized,
    rawLlmIntent,
  };
}

/**
 * Quick deterministic intent check for common patterns.
 * Bypasses LLM for obvious cases — faster + cheaper.
 */
export function tryDeterministicClassification(text: string): ClassificationResult | null {
  const lower = text.toLowerCase().trim();

  // Help
  if (lower === 'help' || lower === '?' || lower === '/help') {
    return {
      intent: M16Intent.HELP,
      confidence: 1.0,
      entityHints: emptyHints(),
      intentRecognized: true,
      rawLlmIntent: 'HELP',
    };
  }

  // Control tower
  if (/^(open|show|go to)\s+(the\s+)?control\s*tower$/i.test(lower)) {
    return {
      intent: M16Intent.OPEN_CONTROL_TOWER,
      confidence: 1.0,
      entityHints: { ...emptyHints(), navigationTarget: 'control-tower' },
      intentRecognized: true,
      rawLlmIntent: 'OPEN_CONTROL_TOWER',
    };
  }

  if (
    /what should (we|i) (consider doing|consider|do)\??$/.test(lower) ||
    /^show (me )?(the )?(management )?recommendations/.test(lower) ||
    /show (me )?(the )?recommendation (about|for|concerning|on)\b/.test(lower) ||
    /what was the recommendation you just/.test(lower)
  ) {
    return {
      intent: M16Intent.GET_RECOMMENDATIONS,
      confidence: 1.0,
      entityHints: emptyHints(),
      intentRecognized: true,
      rawLlmIntent: 'GET_RECOMMENDATIONS',
    };
  }

  if (/why is .+ (a )?(management )?concern/.test(lower) || /top management (risks|concerns)/.test(lower)) {
    return {
      intent: M16Intent.GET_RECOMMENDATIONS,
      confidence: 1.0,
      entityHints: emptyHints(),
      intentRecognized: true,
      rawLlmIntent: 'GET_RECOMMENDATIONS',
    };
  }

  if (/^what if\b/.test(lower)) {
    return {
      intent: M16Intent.RUN_WHAT_IF,
      confidence: 1.0,
      entityHints: emptyHints(),
      intentRecognized: true,
      rawLlmIntent: 'RUN_WHAT_IF',
    };
  }

  if (
    (/\b(accept|reject|defer)\b/.test(lower) && /recommend/.test(lower)) ||
    (/request more information/.test(lower) && /recommend/.test(lower))
  ) {
    return {
      intent: M16Intent.RECORD_MANAGEMENT_DECISION,
      confidence: 1.0,
      entityHints: emptyHints(),
      intentRecognized: true,
      rawLlmIntent: 'RECORD_MANAGEMENT_DECISION',
    };
  }

  return null; // Not deterministically classifiable — use LLM
}

/**
 * Full classification: tries deterministic first, falls back to LLM.
 */
export async function classifyUserIntent(
  text: string,
  history: ConversationTurn[],
  llmCaller: (systemPrompt: string, userPrompt: string) => Promise<string>
): Promise<ClassificationResult> {
  const deterministic = tryDeterministicClassification(text);
  if (deterministic) return deterministic;
  return classifyIntent(text, history, llmCaller);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function emptyHints(): EntityHints {
  return {
    equipmentTag: null,
    workpackNumber: null,
    activityDescription: null,
    eventCode: null,
    unitName: null,
    discipline: null,
    contractor: null,
    navigationTarget: null,
  };
}

/**
 * Check if a classified intent is a query (read-only).
 */
export function isQueryIntent(intent: M16Intent): boolean {
  const meta = INTENT_METADATA[intent];
  return meta.category === M16IntentCategory.QUERY || meta.category === M16IntentCategory.SYSTEM;
}

/**
 * Check if a classified intent is a navigation request.
 */
export function isNavigationIntent(intent: M16Intent): boolean {
  return INTENT_METADATA[intent].category === M16IntentCategory.NAVIGATION;
}

/**
 * Check if a classified intent is an execution (write) request.
 * R2 does NOT handle these — they return "not yet available".
 */
export function isExecutionIntent(intent: M16Intent): boolean {
  return INTENT_METADATA[intent].category === M16IntentCategory.EXECUTION;
}

/**
 * Check if a classified intent is a governance request.
 * R2 does NOT handle these — they return "not yet available".
 */
export function isGovernanceIntent(intent: M16Intent): boolean {
  return INTENT_METADATA[intent].category === M16IntentCategory.GOVERNANCE;
}
