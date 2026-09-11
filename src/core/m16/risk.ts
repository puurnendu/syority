/**
 * M16 — Action Risk Model
 *
 * Classifies every M16 intent by risk level and determines
 * confirmation requirements.
 *
 * CORE PRINCIPLE:
 *   AI interpretation does NOT equal authorization.
 *   The LLM classifies intent. The application verifies permission.
 *   The user confirms action. The domain service executes.
 *   The audit records everything.
 */

import { M16Intent, M16IntentCategory, getIntentCategory } from './intents';

// ── Risk Levels ───────────────────────────────────────────────────────────────

export enum ActionRiskLevel {
  /** Read-only operations — no confirmation needed */
  READ = 'READ',
  /** Minor write (progress update at high confidence, add remark) */
  LOW_RISK_WRITE = 'LOW_RISK_WRITE',
  /** Significant state change (start, hold, resume, release) */
  HIGH_RISK_WRITE = 'HIGH_RISK_WRITE',
  /** Irreversible or difficult-to-reverse actions (complete, verify, close) */
  DESTRUCTIVE = 'DESTRUCTIVE',
  /** Configuration or scope changes requiring strong authorization */
  GOVERNANCE = 'GOVERNANCE',
}

// ── Confirmation Requirements ─────────────────────────────────────────────────

export enum ConfirmationRequirement {
  /** No confirmation needed (read operations) */
  NONE = 'NONE',
  /** Context-dependent (e.g., progress update at ≥90% confidence) */
  IMPLICIT = 'IMPLICIT',
  /** User must explicitly confirm ("Reply YES to start") */
  EXPLICIT = 'EXPLICIT',
  /** Strong authorization check + explicit confirmation */
  STRONG_AUTHORIZATION = 'STRONG_AUTHORIZATION',
}

// ── Risk Classification ───────────────────────────────────────────────────────

export interface ActionRiskClassification {
  intent: M16Intent;
  riskLevel: ActionRiskLevel;
  confirmation: ConfirmationRequirement;
  /** Required permission key from @/lib/permissions */
  requiredPermission: string | null;
  /** Whether this action is allowed via WhatsApp channel */
  allowedViaWhatsApp: boolean;
  /** Whether this action is allowed via Voice channel */
  allowedViaVoice: boolean;
}

/**
 * Risk classification for each M16 intent.
 * R1 establishes this framework; R3 implements the confirmation gates.
 */
const RISK_CLASSIFICATIONS: Record<M16Intent, ActionRiskClassification> = {
  // ── Query — READ ──
  [M16Intent.GET_PROGRESS]:        { intent: M16Intent.GET_PROGRESS,        riskLevel: ActionRiskLevel.READ, confirmation: ConfirmationRequirement.NONE, requiredPermission: null, allowedViaWhatsApp: true, allowedViaVoice: true },
  [M16Intent.GET_ACTIVITY_STATUS]: { intent: M16Intent.GET_ACTIVITY_STATUS, riskLevel: ActionRiskLevel.READ, confirmation: ConfirmationRequirement.NONE, requiredPermission: null, allowedViaWhatsApp: true, allowedViaVoice: true },
  [M16Intent.GET_WORKPACK_STATUS]: { intent: M16Intent.GET_WORKPACK_STATUS, riskLevel: ActionRiskLevel.READ, confirmation: ConfirmationRequirement.NONE, requiredPermission: null, allowedViaWhatsApp: true, allowedViaVoice: true },
  [M16Intent.GET_READINESS]:       { intent: M16Intent.GET_READINESS,       riskLevel: ActionRiskLevel.READ, confirmation: ConfirmationRequirement.NONE, requiredPermission: null, allowedViaWhatsApp: true, allowedViaVoice: true },
  [M16Intent.GET_CONSTRAINTS]:     { intent: M16Intent.GET_CONSTRAINTS,     riskLevel: ActionRiskLevel.READ, confirmation: ConfirmationRequirement.NONE, requiredPermission: null, allowedViaWhatsApp: true, allowedViaVoice: true },
  [M16Intent.GET_DELAY]:           { intent: M16Intent.GET_DELAY,           riskLevel: ActionRiskLevel.READ, confirmation: ConfirmationRequirement.NONE, requiredPermission: null, allowedViaWhatsApp: true, allowedViaVoice: true },
  [M16Intent.GET_SCHEDULE]:        { intent: M16Intent.GET_SCHEDULE,        riskLevel: ActionRiskLevel.READ, confirmation: ConfirmationRequirement.NONE, requiredPermission: null, allowedViaWhatsApp: true, allowedViaVoice: true },
  [M16Intent.GET_REPORT]:          { intent: M16Intent.GET_REPORT,          riskLevel: ActionRiskLevel.READ, confirmation: ConfirmationRequirement.NONE, requiredPermission: null, allowedViaWhatsApp: true, allowedViaVoice: true },
  [M16Intent.GET_LOOKAHEAD]:       { intent: M16Intent.GET_LOOKAHEAD,       riskLevel: ActionRiskLevel.READ, confirmation: ConfirmationRequirement.NONE, requiredPermission: null, allowedViaWhatsApp: true, allowedViaVoice: true },
  [M16Intent.GET_MANAGEMENT_RISKS]: { intent: M16Intent.GET_MANAGEMENT_RISKS, riskLevel: ActionRiskLevel.READ, confirmation: ConfirmationRequirement.NONE, requiredPermission: null, allowedViaWhatsApp: true, allowedViaVoice: true },
  [M16Intent.GET_RECOMMENDATIONS]: { intent: M16Intent.GET_RECOMMENDATIONS, riskLevel: ActionRiskLevel.READ, confirmation: ConfirmationRequirement.NONE, requiredPermission: null, allowedViaWhatsApp: true, allowedViaVoice: true },
  [M16Intent.GET_MANAGEMENT_FORECAST]: { intent: M16Intent.GET_MANAGEMENT_FORECAST, riskLevel: ActionRiskLevel.READ, confirmation: ConfirmationRequirement.NONE, requiredPermission: null, allowedViaWhatsApp: true, allowedViaVoice: true },
  [M16Intent.GET_MANAGEMENT_IMPACT]: { intent: M16Intent.GET_MANAGEMENT_IMPACT, riskLevel: ActionRiskLevel.READ, confirmation: ConfirmationRequirement.NONE, requiredPermission: null, allowedViaWhatsApp: true, allowedViaVoice: true },
  [M16Intent.RUN_WHAT_IF]:         { intent: M16Intent.RUN_WHAT_IF,         riskLevel: ActionRiskLevel.READ, confirmation: ConfirmationRequirement.NONE, requiredPermission: null, allowedViaWhatsApp: true, allowedViaVoice: true },
  [M16Intent.RECORD_MANAGEMENT_DECISION]: { intent: M16Intent.RECORD_MANAGEMENT_DECISION, riskLevel: ActionRiskLevel.READ, confirmation: ConfirmationRequirement.NONE, requiredPermission: null, allowedViaWhatsApp: true, allowedViaVoice: true },

  // ── Execution — varies ──
  // R5: Voice now allowed for execution intents. R3 ConfirmationGate enforces
  // EXPLICIT confirmation for HIGH_RISK/DESTRUCTIVE actions — the confirmation
  // gate IS the safety boundary, not the channel filter.
  [M16Intent.RELEASE_ACTIVITY]:  { intent: M16Intent.RELEASE_ACTIVITY,  riskLevel: ActionRiskLevel.HIGH_RISK_WRITE, confirmation: ConfirmationRequirement.EXPLICIT, requiredPermission: 'execution.release',  allowedViaWhatsApp: true,  allowedViaVoice: true },
  [M16Intent.START_ACTIVITY]:    { intent: M16Intent.START_ACTIVITY,    riskLevel: ActionRiskLevel.HIGH_RISK_WRITE, confirmation: ConfirmationRequirement.EXPLICIT, requiredPermission: 'execution.start',    allowedViaWhatsApp: true,  allowedViaVoice: true },
  [M16Intent.UPDATE_PROGRESS]:   { intent: M16Intent.UPDATE_PROGRESS,   riskLevel: ActionRiskLevel.LOW_RISK_WRITE,  confirmation: ConfirmationRequirement.IMPLICIT, requiredPermission: 'execution.update',   allowedViaWhatsApp: true,  allowedViaVoice: true },
  [M16Intent.HOLD_ACTIVITY]:     { intent: M16Intent.HOLD_ACTIVITY,     riskLevel: ActionRiskLevel.HIGH_RISK_WRITE, confirmation: ConfirmationRequirement.EXPLICIT, requiredPermission: 'execution.hold',     allowedViaWhatsApp: true,  allowedViaVoice: true },
  [M16Intent.RESUME_ACTIVITY]:   { intent: M16Intent.RESUME_ACTIVITY,   riskLevel: ActionRiskLevel.HIGH_RISK_WRITE, confirmation: ConfirmationRequirement.EXPLICIT, requiredPermission: 'execution.start',    allowedViaWhatsApp: true,  allowedViaVoice: true },
  [M16Intent.REPORT_DELAY]:      { intent: M16Intent.REPORT_DELAY,      riskLevel: ActionRiskLevel.LOW_RISK_WRITE,  confirmation: ConfirmationRequirement.IMPLICIT, requiredPermission: 'execution.delay',    allowedViaWhatsApp: true,  allowedViaVoice: true },
  [M16Intent.COMPLETE_ACTIVITY]: { intent: M16Intent.COMPLETE_ACTIVITY, riskLevel: ActionRiskLevel.DESTRUCTIVE,     confirmation: ConfirmationRequirement.EXPLICIT, requiredPermission: 'execution.complete', allowedViaWhatsApp: true,  allowedViaVoice: true },
  [M16Intent.VERIFY_ACTIVITY]:   { intent: M16Intent.VERIFY_ACTIVITY,   riskLevel: ActionRiskLevel.DESTRUCTIVE,     confirmation: ConfirmationRequirement.EXPLICIT, requiredPermission: 'execution.verify',   allowedViaWhatsApp: true,  allowedViaVoice: true },
  [M16Intent.CLOSE_ACTIVITY]:    { intent: M16Intent.CLOSE_ACTIVITY,    riskLevel: ActionRiskLevel.DESTRUCTIVE,     confirmation: ConfirmationRequirement.EXPLICIT, requiredPermission: 'execution.close',    allowedViaWhatsApp: true,  allowedViaVoice: true },

  // ── Navigation — READ ──
  [M16Intent.OPEN_EQUIPMENT]:    { intent: M16Intent.OPEN_EQUIPMENT,    riskLevel: ActionRiskLevel.READ, confirmation: ConfirmationRequirement.NONE, requiredPermission: null, allowedViaWhatsApp: true, allowedViaVoice: true },
  [M16Intent.OPEN_WORKPACK]:     { intent: M16Intent.OPEN_WORKPACK,     riskLevel: ActionRiskLevel.READ, confirmation: ConfirmationRequirement.NONE, requiredPermission: null, allowedViaWhatsApp: true, allowedViaVoice: true },
  [M16Intent.OPEN_ACTIVITY]:     { intent: M16Intent.OPEN_ACTIVITY,     riskLevel: ActionRiskLevel.READ, confirmation: ConfirmationRequirement.NONE, requiredPermission: null, allowedViaWhatsApp: true, allowedViaVoice: true },
  [M16Intent.OPEN_CONTROL_TOWER]:{ intent: M16Intent.OPEN_CONTROL_TOWER,riskLevel: ActionRiskLevel.READ, confirmation: ConfirmationRequirement.NONE, requiredPermission: null, allowedViaWhatsApp: true, allowedViaVoice: true },
  [M16Intent.OPEN_REPORT]:       { intent: M16Intent.OPEN_REPORT,       riskLevel: ActionRiskLevel.READ, confirmation: ConfirmationRequirement.NONE, requiredPermission: null, allowedViaWhatsApp: true, allowedViaVoice: true },
  [M16Intent.SELECT_EVENT]:      { intent: M16Intent.SELECT_EVENT,      riskLevel: ActionRiskLevel.READ, confirmation: ConfirmationRequirement.NONE, requiredPermission: null, allowedViaWhatsApp: true, allowedViaVoice: true },

  // ── Governance — STRONG ──
  [M16Intent.CHANGE_SCOPE]:         { intent: M16Intent.CHANGE_SCOPE,         riskLevel: ActionRiskLevel.GOVERNANCE, confirmation: ConfirmationRequirement.STRONG_AUTHORIZATION, requiredPermission: 'scope.manage',    allowedViaWhatsApp: false, allowedViaVoice: false },
  [M16Intent.CHANGE_SCHEDULE]:      { intent: M16Intent.CHANGE_SCHEDULE,      riskLevel: ActionRiskLevel.GOVERNANCE, confirmation: ConfirmationRequirement.STRONG_AUTHORIZATION, requiredPermission: 'schedule.manage', allowedViaWhatsApp: false, allowedViaVoice: false },
  [M16Intent.CHANGE_MASTER_DATA]:   { intent: M16Intent.CHANGE_MASTER_DATA,   riskLevel: ActionRiskLevel.GOVERNANCE, confirmation: ConfirmationRequirement.STRONG_AUTHORIZATION, requiredPermission: 'admin.manage',    allowedViaWhatsApp: false, allowedViaVoice: false },
  [M16Intent.CHANGE_CONFIGURATION]: { intent: M16Intent.CHANGE_CONFIGURATION, riskLevel: ActionRiskLevel.GOVERNANCE, confirmation: ConfirmationRequirement.STRONG_AUTHORIZATION, requiredPermission: 'admin.manage',    allowedViaWhatsApp: false, allowedViaVoice: false },

  // ── System — READ ──
  [M16Intent.HELP]:    { intent: M16Intent.HELP,    riskLevel: ActionRiskLevel.READ, confirmation: ConfirmationRequirement.NONE, requiredPermission: null, allowedViaWhatsApp: true, allowedViaVoice: true },
  [M16Intent.UNKNOWN]: { intent: M16Intent.UNKNOWN, riskLevel: ActionRiskLevel.READ, confirmation: ConfirmationRequirement.NONE, requiredPermission: null, allowedViaWhatsApp: true, allowedViaVoice: true },
};

// ── Public API ────────────────────────────────────────────────────────────────

/** Classify the risk level for an intent */
export function classifyRisk(intent: M16Intent): ActionRiskClassification {
  return RISK_CLASSIFICATIONS[intent];
}

/** Does this intent require user confirmation? */
export function requiresConfirmation(intent: M16Intent): boolean {
  const classification = RISK_CLASSIFICATIONS[intent];
  return classification.confirmation !== ConfirmationRequirement.NONE;
}

/** Get the required permission for an intent, if any */
export function getRequiredPermission(intent: M16Intent): string | null {
  return RISK_CLASSIFICATIONS[intent].requiredPermission;
}

/** Is this intent allowed on a specific channel? */
export function isAllowedOnChannel(intent: M16Intent, channel: 'whatsapp' | 'voice'): boolean {
  const classification = RISK_CLASSIFICATIONS[intent];
  return channel === 'whatsapp' ? classification.allowedViaWhatsApp : classification.allowedViaVoice;
}

/** Is this intent a write operation? */
export function isWriteIntent(intent: M16Intent): boolean {
  const category = getIntentCategory(intent);
  return category === M16IntentCategory.EXECUTION || category === M16IntentCategory.GOVERNANCE;
}
