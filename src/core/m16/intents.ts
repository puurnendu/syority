/**
 * M16 — Intent Taxonomy
 *
 * 35 intents across 4 categories + SYSTEM (M16-R0.1 29, plus M15-R4 query/decision).
 *
 * R1 establishes the contract/model; R2+ implements AI classification.
 * Each intent maps to a category, required entities, risk level,
 * and the domain service owner.
 *
 * ARCHITECTURE:
 *   - Intent is classified by LLM (untrusted output)
 *   - Intent is VALIDATED against this known taxonomy
 *   - Unknown intents default to UNKNOWN (safe)
 *   - Intent alone does NOT grant authorization
 */

// ── Intent Categories ─────────────────────────────────────────────────────────

export enum M16IntentCategory {
  QUERY = 'QUERY',
  NAVIGATION = 'NAVIGATION',
  EXECUTION = 'EXECUTION',
  GOVERNANCE = 'GOVERNANCE',
  SYSTEM = 'SYSTEM',
}

// ── Intent Enum ───────────────────────────────────────────────────────────────

export enum M16Intent {
  // ── Query Intents (READ — no confirmation, no EWS) ──
  GET_PROGRESS = 'GET_PROGRESS',
  GET_ACTIVITY_STATUS = 'GET_ACTIVITY_STATUS',
  GET_WORKPACK_STATUS = 'GET_WORKPACK_STATUS',
  GET_READINESS = 'GET_READINESS',
  GET_CONSTRAINTS = 'GET_CONSTRAINTS',
  GET_DELAY = 'GET_DELAY',
  GET_SCHEDULE = 'GET_SCHEDULE',
  GET_REPORT = 'GET_REPORT',
  GET_LOOKAHEAD = 'GET_LOOKAHEAD',

  // ── M15 decision intelligence (READ / hypothetical — never EWS) ──
  GET_MANAGEMENT_RISKS = 'GET_MANAGEMENT_RISKS',
  GET_RECOMMENDATIONS = 'GET_RECOMMENDATIONS',
  GET_MANAGEMENT_FORECAST = 'GET_MANAGEMENT_FORECAST',
  GET_MANAGEMENT_IMPACT = 'GET_MANAGEMENT_IMPACT',
  RUN_WHAT_IF = 'RUN_WHAT_IF',
  RECORD_MANAGEMENT_DECISION = 'RECORD_MANAGEMENT_DECISION',

  // ── Execution Intents (WRITE — risk-classified, via EWS) ──
  RELEASE_ACTIVITY = 'RELEASE_ACTIVITY',
  START_ACTIVITY = 'START_ACTIVITY',
  UPDATE_PROGRESS = 'UPDATE_PROGRESS',
  HOLD_ACTIVITY = 'HOLD_ACTIVITY',
  RESUME_ACTIVITY = 'RESUME_ACTIVITY',
  REPORT_DELAY = 'REPORT_DELAY',
  COMPLETE_ACTIVITY = 'COMPLETE_ACTIVITY',
  VERIFY_ACTIVITY = 'VERIFY_ACTIVITY',
  CLOSE_ACTIVITY = 'CLOSE_ACTIVITY',

  // ── Navigation Intents (READ — browser/mobile deep link) ──
  OPEN_EQUIPMENT = 'OPEN_EQUIPMENT',
  OPEN_WORKPACK = 'OPEN_WORKPACK',
  OPEN_ACTIVITY = 'OPEN_ACTIVITY',
  OPEN_CONTROL_TOWER = 'OPEN_CONTROL_TOWER',
  OPEN_REPORT = 'OPEN_REPORT',
  SELECT_EVENT = 'SELECT_EVENT',

  // ── Governance / Configuration Intents ──
  CHANGE_SCOPE = 'CHANGE_SCOPE',
  CHANGE_SCHEDULE = 'CHANGE_SCHEDULE',
  CHANGE_MASTER_DATA = 'CHANGE_MASTER_DATA',
  CHANGE_CONFIGURATION = 'CHANGE_CONFIGURATION',

  // ── System Intents ──
  HELP = 'HELP',
  UNKNOWN = 'UNKNOWN',
}

// ── Intent Metadata ───────────────────────────────────────────────────────────

export interface IntentMetadata {
  category: M16IntentCategory;
  /** Whether this intent operates on event-scoped entities */
  requiresEventContext: boolean;
  /** Which entity types this intent needs resolved */
  requiredEntities: Array<'equipment' | 'workpack' | 'activity' | 'event' | 'none'>;
  /** Domain service owner for this intent */
  domainOwner: string;
  /** Human-readable description */
  description: string;
}

/**
 * Metadata map for all M16 intents.
 * Used for validation, routing, and architecture enforcement.
 */
export const INTENT_METADATA: Record<M16Intent, IntentMetadata> = {
  // ── Query ──
  [M16Intent.GET_PROGRESS]: {
    category: M16IntentCategory.QUERY,
    requiresEventContext: false,
    requiredEntities: ['none'],
    domainOwner: 'M8.13 / FieldExecutionService',
    description: 'Get overall or entity-specific progress',
  },
  [M16Intent.GET_ACTIVITY_STATUS]: {
    category: M16IntentCategory.QUERY,
    requiresEventContext: true,
    requiredEntities: ['equipment', 'activity'],
    domainOwner: 'FieldExecutionService',
    description: 'Get status of a specific activity',
  },
  [M16Intent.GET_WORKPACK_STATUS]: {
    category: M16IntentCategory.QUERY,
    requiresEventContext: true,
    requiredEntities: ['workpack'],
    domainOwner: 'FieldExecutionService',
    description: 'Get status of a specific workpack',
  },
  [M16Intent.GET_READINESS]: {
    category: M16IntentCategory.QUERY,
    requiresEventContext: true,
    requiredEntities: ['equipment', 'workpack'],
    domainOwner: 'M10/M12 Readiness',
    description: 'Check if equipment/workpack is ready to start',
  },
  [M16Intent.GET_CONSTRAINTS]: {
    category: M16IntentCategory.QUERY,
    requiresEventContext: true,
    requiredEntities: ['none'],
    domainOwner: 'Constraint Service',
    description: 'Get open constraints',
  },
  [M16Intent.GET_DELAY]: {
    category: M16IntentCategory.QUERY,
    requiresEventContext: true,
    requiredEntities: ['none'],
    domainOwner: 'FieldExecutionService.getPlanVsActual',
    description: 'Get delayed activities',
  },
  [M16Intent.GET_SCHEDULE]: {
    category: M16IntentCategory.QUERY,
    requiresEventContext: true,
    requiredEntities: ['event'],
    domainOwner: 'FieldExecutionService.getLookahead',
    description: 'Get scheduled activities for today',
  },
  [M16Intent.GET_REPORT]: {
    category: M16IntentCategory.QUERY,
    requiresEventContext: true,
    requiredEntities: ['event'],
    domainOwner: 'M14 ReportEngine',
    description: 'Request a report',
  },
  [M16Intent.GET_LOOKAHEAD]: {
    category: M16IntentCategory.QUERY,
    requiresEventContext: true,
    requiredEntities: ['event'],
    domainOwner: 'FieldExecutionService.getLookahead',
    description: 'Get lookahead view (24h/72h)',
  },
  [M16Intent.GET_MANAGEMENT_RISKS]: {
    category: M16IntentCategory.QUERY,
    requiresEventContext: true,
    requiredEntities: ['event'],
    domainOwner: 'M15 DecisionIntelligenceService',
    description: 'Get management risks / why something is a concern',
  },
  [M16Intent.GET_RECOMMENDATIONS]: {
    category: M16IntentCategory.QUERY,
    requiresEventContext: true,
    requiredEntities: ['event'],
    domainOwner: 'M15 DecisionIntelligenceService',
    description: 'Get advisory management recommendations (not execution)',
  },
  [M16Intent.GET_MANAGEMENT_FORECAST]: {
    category: M16IntentCategory.QUERY,
    requiresEventContext: true,
    requiredEntities: ['event'],
    domainOwner: 'M15 DecisionIntelligenceService',
    description: 'Get named management forecasts (M8.8 / M8.9 / M8.10)',
  },
  [M16Intent.GET_MANAGEMENT_IMPACT]: {
    category: M16IntentCategory.QUERY,
    requiresEventContext: true,
    requiredEntities: ['activity'],
    domainOwner: 'M15 DecisionIntelligenceService',
    description: 'Get typed impact for an activity (count vs hours)',
  },
  [M16Intent.RUN_WHAT_IF]: {
    category: M16IntentCategory.QUERY,
    requiresEventContext: true,
    requiredEntities: ['event'],
    domainOwner: 'M15 / M8.9 scenario engine',
    description: 'Run a hypothetical what-if (not live schedule)',
  },
  [M16Intent.RECORD_MANAGEMENT_DECISION]: {
    category: M16IntentCategory.QUERY,
    requiresEventContext: true,
    requiredEntities: ['event'],
    domainOwner: 'M15 ManagementDecisionService',
    description: 'Record ACCEPT/REJECT/DEFER — not an execution mutation',
  },

  // ── Execution ──
  [M16Intent.RELEASE_ACTIVITY]: {
    category: M16IntentCategory.EXECUTION,
    requiresEventContext: true,
    requiredEntities: ['equipment', 'workpack', 'activity'],
    domainOwner: 'M12 ExecutionWriteService',
    description: 'Release activity for execution',
  },
  [M16Intent.START_ACTIVITY]: {
    category: M16IntentCategory.EXECUTION,
    requiresEventContext: true,
    requiredEntities: ['equipment', 'workpack', 'activity'],
    domainOwner: 'M12 ExecutionWriteService',
    description: 'Start an activity',
  },
  [M16Intent.UPDATE_PROGRESS]: {
    category: M16IntentCategory.EXECUTION,
    requiresEventContext: true,
    requiredEntities: ['equipment', 'workpack', 'activity'],
    domainOwner: 'M12 ExecutionWriteService',
    description: 'Report progress on an activity',
  },
  [M16Intent.HOLD_ACTIVITY]: {
    category: M16IntentCategory.EXECUTION,
    requiresEventContext: true,
    requiredEntities: ['equipment', 'workpack', 'activity'],
    domainOwner: 'M12 ExecutionWriteService',
    description: 'Put an activity on hold',
  },
  [M16Intent.RESUME_ACTIVITY]: {
    category: M16IntentCategory.EXECUTION,
    requiresEventContext: true,
    requiredEntities: ['equipment', 'workpack', 'activity'],
    domainOwner: 'M12 ExecutionWriteService',
    description: 'Resume a held activity',
  },
  [M16Intent.REPORT_DELAY]: {
    category: M16IntentCategory.EXECUTION,
    requiresEventContext: true,
    requiredEntities: ['equipment', 'workpack', 'activity'],
    domainOwner: 'M12 ExecutionWriteService',
    description: 'Report a delay on an activity',
  },
  [M16Intent.COMPLETE_ACTIVITY]: {
    category: M16IntentCategory.EXECUTION,
    requiresEventContext: true,
    requiredEntities: ['equipment', 'workpack', 'activity'],
    domainOwner: 'M12 ExecutionWriteService',
    description: 'Mark activity as completed',
  },
  [M16Intent.VERIFY_ACTIVITY]: {
    category: M16IntentCategory.EXECUTION,
    requiresEventContext: true,
    requiredEntities: ['equipment', 'workpack', 'activity'],
    domainOwner: 'M12 ExecutionWriteService',
    description: 'Verify a completed activity (QA)',
  },
  [M16Intent.CLOSE_ACTIVITY]: {
    category: M16IntentCategory.EXECUTION,
    requiresEventContext: true,
    requiredEntities: ['equipment', 'workpack', 'activity'],
    domainOwner: 'M12 ExecutionWriteService',
    description: 'Close an activity (supervisor)',
  },

  // ── Navigation ──
  [M16Intent.OPEN_EQUIPMENT]: {
    category: M16IntentCategory.NAVIGATION,
    requiresEventContext: false,
    requiredEntities: ['equipment'],
    domainOwner: 'UI Navigation',
    description: 'Navigate to equipment 360 view',
  },
  [M16Intent.OPEN_WORKPACK]: {
    category: M16IntentCategory.NAVIGATION,
    requiresEventContext: true,
    requiredEntities: ['workpack'],
    domainOwner: 'UI Navigation',
    description: 'Navigate to workpack detail',
  },
  [M16Intent.OPEN_ACTIVITY]: {
    category: M16IntentCategory.NAVIGATION,
    requiresEventContext: true,
    requiredEntities: ['activity'],
    domainOwner: 'UI Navigation',
    description: 'Navigate to activity inspector',
  },
  [M16Intent.OPEN_CONTROL_TOWER]: {
    category: M16IntentCategory.NAVIGATION,
    requiresEventContext: true,
    requiredEntities: ['event'],
    domainOwner: 'M13 Control Tower',
    description: 'Navigate to control tower',
  },
  [M16Intent.OPEN_REPORT]: {
    category: M16IntentCategory.NAVIGATION,
    requiresEventContext: true,
    requiredEntities: ['event'],
    domainOwner: 'M14 Reports',
    description: 'Navigate to report view',
  },
  [M16Intent.SELECT_EVENT]: {
    category: M16IntentCategory.NAVIGATION,
    requiresEventContext: false,
    requiredEntities: ['event'],
    domainOwner: 'M16 Event Context',
    description: 'Switch active event context',
  },

  // ── Governance ──
  [M16Intent.CHANGE_SCOPE]: {
    category: M16IntentCategory.GOVERNANCE,
    requiresEventContext: true,
    requiredEntities: ['event'],
    domainOwner: 'Scope Change Service',
    description: 'Request scope change',
  },
  [M16Intent.CHANGE_SCHEDULE]: {
    category: M16IntentCategory.GOVERNANCE,
    requiresEventContext: true,
    requiredEntities: ['event'],
    domainOwner: 'M11 Schedule',
    description: 'Request schedule change',
  },
  [M16Intent.CHANGE_MASTER_DATA]: {
    category: M16IntentCategory.GOVERNANCE,
    requiresEventContext: false,
    requiredEntities: ['none'],
    domainOwner: 'Master Data Service',
    description: 'Request master data change',
  },
  [M16Intent.CHANGE_CONFIGURATION]: {
    category: M16IntentCategory.GOVERNANCE,
    requiresEventContext: false,
    requiredEntities: ['none'],
    domainOwner: 'Configuration Service',
    description: 'Request configuration change',
  },

  // ── System ──
  [M16Intent.HELP]: {
    category: M16IntentCategory.SYSTEM,
    requiresEventContext: false,
    requiredEntities: ['none'],
    domainOwner: 'M16',
    description: 'Show help / capabilities',
  },
  [M16Intent.UNKNOWN]: {
    category: M16IntentCategory.SYSTEM,
    requiresEventContext: false,
    requiredEntities: ['none'],
    domainOwner: 'M16',
    description: 'Unrecognized intent',
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Get the category for an intent */
export function getIntentCategory(intent: M16Intent): M16IntentCategory {
  return INTENT_METADATA[intent].category;
}

/** Check if an intent requires event context */
export function requiresEventContext(intent: M16Intent): boolean {
  return INTENT_METADATA[intent].requiresEventContext;
}

/** Get all intents in a category */
export function getIntentsByCategory(category: M16IntentCategory): M16Intent[] {
  return Object.entries(INTENT_METADATA)
    .filter(([, meta]) => meta.category === category)
    .map(([intent]) => intent as M16Intent);
}

/**
 * Validate that a string is a known M16Intent.
 * Returns M16Intent.UNKNOWN if not recognized.
 * This is the TRUST BOUNDARY for LLM-produced intent strings.
 */
export function validateIntent(raw: string): M16Intent {
  const normalized = raw.toUpperCase().trim();
  if (normalized in M16Intent) {
    return normalized as M16Intent;
  }
  return M16Intent.UNKNOWN;
}
