/**
 * M16 — Secure Interaction Foundation
 * Public barrel export
 *
 * M16 is an INTERACTION / ORCHESTRATION layer.
 * It is NOT a domain authority, calculation engine, or execution engine.
 */

// ── Core Types ────────────────────────────────────────────────────────────────
export type {
  M16InteractionContext,
  M16Channel,
  IdentitySource,
  EventContextResult,
  EventResolution,
  EntityResolutionOutcome,
  EquipmentResolution,
  WorkpackResolution,
  ActivityResolution,
  M16ResolvedEntities,
  AuthorizationResult,
  M16Identity,
} from './types';

// ── Intents ───────────────────────────────────────────────────────────────────
export { M16Intent, M16IntentCategory, INTENT_METADATA } from './intents';
export { getIntentCategory, requiresEventContext, getIntentsByCategory, validateIntent } from './intents';

// ── Risk Model ────────────────────────────────────────────────────────────────
export { ActionRiskLevel, ConfirmationRequirement } from './risk';
export { classifyRisk, requiresConfirmation, getRequiredPermission, isAllowedOnChannel, isWriteIntent } from './risk';

// ── Security ──────────────────────────────────────────────────────────────────
export { verifyMetaWebhookSignature } from './security/WebhookSignatureVerifier';
export { validateContextIntegrity, sanitizeLlmEntityHints, detectInjectionPatterns } from './security/PromptInjectionBoundary';
export { resolveWhatsAppIdentity, resolveWebIdentity } from './security/IdentityResolver';

// ── Context ───────────────────────────────────────────────────────────────────
export { resolveEventContext, setWhatsAppSessionEvent } from './context/EventContextResolver';
export { buildInteractionContext } from './context/InteractionContextBuilder';

// ── Entity Resolution ─────────────────────────────────────────────────────────
export { resolveEquipment, resolveWorkpacks, resolveActivity, resolveEntityChain } from './entity/M16EntityResolver';
export { resolveDiscipline, resolveEquipmentType, getAvailableDimensions } from './entity/DimensionResolver';

// ── Authorization ─────────────────────────────────────────────────────────────────
export { checkAuthorization, getRequiredPermissionForIntent } from './auth/M16AuthorizationBoundary';

// ── Audit ─────────────────────────────────────────────────────────────────────
export { logInteraction } from './audit/M16InteractionAuditService';

// ── R2: Intent Classification ─────────────────────────────────────────────────
export {
  classifyUserIntent,
  classifyIntent,
  tryDeterministicClassification,
  isQueryIntent,
  isNavigationIntent,
  isExecutionIntent,
  isGovernanceIntent,
} from './intent/IntentClassifier';
export type { ClassificationResult, EntityHints, ConversationTurn } from './intent/IntentClassifier';

// ── R2: Tool Registry ─────────────────────────────────────────────────────────
export {
  registerTool,
  getTool,
  getAllTools,
  findToolForIntent,
  validateToolExecution,
} from './tools/ToolRegistry';
export type { ToolDefinition, ToolParams, ToolResult, ToolResultStatus } from './tools/ToolRegistry';
export { registerR2ReadTools } from './tools/readTools';
export { registerM15DecisionTools } from './tools/m15Tools';

// ── R2: Interaction Pipeline ──────────────────────────────────────────────────
export { processInteraction } from './pipeline/M16InteractionPipeline';
export type { PipelineInput, PipelineOutput, PipelineDependencies } from './pipeline/M16InteractionPipeline';

// ── R2: Conversation Context ──────────────────────────────────────────────────
export {
  getConversation,
  addConversationTurn,
  updateConversationEntities,
  getLastEntities,
  getConversationHistory,
  clearConversation,
  updateConversationRecommendations,
  getLastRecommendationIds,
} from './pipeline/ConversationContext';

// ── R2: Navigation ────────────────────────────────────────────────────────────
export { resolveNavigation, getAvailableNavigations } from './navigation/NavigationRegistry';

// ── R2: Response Formatting ─────────────────────────────────────────────────────────
export {
  formatToolResult,
  formatHelpResponse,
  formatExecutionNotAvailable,
  formatConfirmationPrompt,
  formatConfirmationCancelled,
  formatExecutionSuccess,
  formatPermissionDenied,
} from './response/ResponseFormatter';
export type { FormattedResponse, ResponseCard } from './response/ResponseFormatter';

// ── R3: Write Tools ───────────────────────────────────────────────────────────────
export { registerR3WriteTools } from './tools/writeTools';

// ── R3: Confirmation Gate ──────────────────────────────────────────────────────────
export {
  requiresExplicitConfirmation,
  canAutoConfirm,
  createPendingConfirmation,
  getPendingConfirmation,
  isConfirmationResponse,
  confirmPending,
  cancelPending,
  buildConfirmationPrompt,
  clearAllPendingConfirmations,
  validateSecurityBindings,
} from './pipeline/ConfirmationGate';
export type { PendingConfirmation, ConfirmationStatus, ConfirmationSecurityBinding, BindingValidationResult } from './pipeline/ConfirmationGate';

// ── R4: WhatsApp Channel Adapter ──────────────────────────────────────────────
export { processWhatsAppWebhook } from './channels/WhatsAppChannelAdapter';
export type { WhatsAppWebhookRequest, WhatsAppProcessingResult, MetaWebhookPayload, MetaMessage } from './channels/WhatsAppChannelAdapter';

// ── R5: Voice Channel Adapter ─────────────────────────────────────────────────
export { processVoiceInteraction } from './channels/VoiceChannelAdapter';
export type { VoiceSession, VoiceRequest, VoiceResult } from './channels/VoiceChannelAdapter';

// ── R5: Mobile Channel Adapter ────────────────────────────────────────────────
export { processMobileExecution, getMobileReadiness } from './channels/MobileChannelAdapter';
export type { MobileSession, MobileExecutionRequest, MobileExecutionResult, MobileReadinessResult } from './channels/MobileChannelAdapter';
