/**
 * M16-R3 — Interaction Pipeline
 *
 * THE ONE INTERACTION CORE for all channels (Web, WhatsApp, Voice, Mobile).
 *
 * Pipeline:
 *   input(text, context)
 *     → checkPendingConfirmation (YES/NO)
 *     → classifyIntent(text)
 *     → resolveEntities(text, intent, context)
 *     → checkAuthorization(intent, context, userRole)
 *     → selectTool(intent)
 *     → confirmationGate (if EXPLICIT required)
 *     → executeTool(context, validatedInput)
 *     → formatResponse(toolResult, intent)
 *     → logInteraction(audit)
 *     → return response
 *
 * ARCHITECTURE:
 *   - M16 is an INTERACTION/ORCHESTRATION layer
 *   - M16 does NOT calculate progress (M8.13)
 *   - M16 does NOT calculate CPM/schedule (M11)
 *   - M16 delegates ALL writes to ExecutionWriteService.applyAction()
 *   - All data comes from authoritative domain services via governed tools
 *
 * R3 SCOPE:
 *   - Read-only queries (QUERY + NAVIGATION intents)
 *   - Execution intents → confirmation gate → EWS.applyAction()
 *   - Governance intents → "not yet available" response
 */

import { M16Intent, INTENT_METADATA, M16IntentCategory, requiresEventContext } from '../intents';
import {
  classifyUserIntent,
  isQueryIntent,
  isNavigationIntent,
  isExecutionIntent,
  isGovernanceIntent,
  type ClassificationResult,
  type ConversationTurn,
} from '../intent/IntentClassifier';
import {
  findToolForIntent,
  validateToolExecution,
  type ToolParams,
  type ToolResult,
} from '../tools/ToolRegistry';
import {
  getConversationHistory,
  addConversationTurn,
  updateConversationEntities,
  getLastEntities,
  getLastRecommendationIds,
  updateConversationRecommendations,
} from './ConversationContext';
import {
  formatToolResult,
  formatHelpResponse,
  formatExecutionNotAvailable,
  formatConfirmationPrompt,
  formatConfirmationCancelled,
  formatExecutionSuccess,
  formatPermissionDenied,
  type FormattedResponse,
} from '../response/ResponseFormatter';
import { resolveNavigation, type NavigationRoute } from '../navigation/NavigationRegistry';
import { checkAuthorization } from '../auth/M16AuthorizationBoundary';
import { sanitizeLlmEntityHints, detectInjectionPatterns } from '../security/PromptInjectionBoundary';
import {
  isAmbiguousRecommendationExecution,
  RECOMMENDATION_HANDOFF_TEXT,
} from './recommendationHandoff';
import {
  getPendingConfirmation,
  isConfirmationResponse,
  confirmPending,
  cancelPending,
  createPendingConfirmation,
  requiresExplicitConfirmation,
  canAutoConfirm,
  buildConfirmationPrompt,
  validateSecurityBindings,
} from './ConfirmationGate';
import type { M16InteractionContext, M16ResolvedEntities } from '../types';

// ── Pipeline Types ────────────────────────────────────────────────────────────

export interface PipelineInput {
  /** Raw user message */
  text: string;
  /** Trusted interaction context (org, user, event — NEVER from LLM) */
  context: M16InteractionContext;
  /**
   * Unused leftover. STO campaign URLs use context.eventId.
   * Kept so existing channel/test call sites do not reopen the pipeline contract.
   */
  projectId?: string;
  /** User role for permission checks (from session or DB) */
  userRole?: string | null;
}

export interface PipelineOutput {
  /** Formatted response for the channel */
  response: FormattedResponse;
  /** What intent was classified */
  intent: M16Intent;
  /** Classification confidence */
  confidence: number;
  /** Whether the tool was executed */
  toolExecuted: boolean;
  /** Tool name if executed */
  toolName: string | null;
  /** Navigation actions */
  navigation: NavigationRoute[];
  /** Whether a confirmation is pending */
  pendingConfirmation: boolean;
}

// ── Dependencies (injected for testability) ───────────────────────────────────

export interface PipelineDependencies {
  /** LLM caller for intent classification */
  llmCaller: (systemPrompt: string, userPrompt: string) => Promise<string>;
  /** Entity resolver — delegates to M16EntityResolver */
  resolveEntities: (
    organizationId: string,
    eventId: string | null,
    hints: { equipmentTag?: string | null; workpackNumber?: string | null; activityDescription?: string | null }
  ) => Promise<M16ResolvedEntities>;
  /** Interaction audit logger */
  logInteraction: (entry: {
    organizationId: string;
    userId: string;
    channel: string;
    conversationId: string;
    userMessage: string;
    intent: string;
    toolName: string | null;
    responseText: string;
    eventId: string | null;
  }) => Promise<void>;
}

// ── Pipeline ──────────────────────────────────────────────────────────────────

/**
 * Process a user interaction through the M16 pipeline.
 *
 * This is the SINGLE ENTRY POINT for all channels.
 */
export async function processInteraction(
  input: PipelineInput,
  deps: PipelineDependencies
): Promise<PipelineOutput> {
  const { text, context, userRole } = input;
  const conversationId = context.conversationId;

  // Step 0: Check for pending confirmation response
  const pending = getPendingConfirmation(conversationId);
  if (pending) {
    const confirmResponse = isConfirmationResponse(text);
    if (confirmResponse === 'confirm') {
      // User confirmed — SECURITY: revalidate before execution
      addConversationTurn(conversationId, 'user', text);

      // 0a. Validate security bindings (user, org, event, channel, conversation)
      const bindingResult = validateSecurityBindings(
        pending,
        context,
        pending.toolParams?.activityId
      );
      if (!bindingResult.valid) {
        cancelPending(conversationId);
        const mismatchDetail = bindingResult.mismatches.join('; ');
        const response = formatPermissionDenied(
          `Security context changed since action was proposed. Confirmation rejected. Mismatches: ${mismatchDetail}`
        );
        addConversationTurn(conversationId, 'assistant', response.text);
        return {
          response,
          intent: pending.intent,
          confidence: 1,
          toolExecuted: false,
          toolName: null,
          navigation: [],
          pendingConfirmation: false,
        };
      }

      // 0b. Re-run authorization check at execution time (fail-closed)
      const reAuthResult = checkAuthorization(context, pending.intent, null, userRole);
      if (!reAuthResult.authorized) {
        cancelPending(conversationId);
        const response = formatPermissionDenied(
          reAuthResult.deniedReason || 'Authorization denied at execution time.'
        );
        addConversationTurn(conversationId, 'assistant', response.text);
        return {
          response,
          intent: pending.intent,
          confidence: 1,
          toolExecuted: false,
          toolName: null,
          navigation: [],
          pendingConfirmation: false,
        };
      }

      // 0c. Consume confirmation (single-use — status transitions to CONFIRMED)
      const confirmed = confirmPending(conversationId);
      if (confirmed) {
        const tool = findToolForIntent(confirmed.intent);
        if (tool) {
          let toolResult: ToolResult;
          try {
            toolResult = await tool.execute(context, confirmed.toolParams);
          } catch (err: unknown) {
            toolResult = {
              status: 'ERROR',
              data: null,
              summary: `Execution failed: ${(err as Error).message}`,
              authority: 'ExecutionWriteService',
            };
          }
          const response = formatExecutionSuccess(toolResult, confirmed.intent);
          await logAndReturn(deps, context, text, { intent: confirmed.intent, confidence: 1, entityHints: {} as any, intentRecognized: true, rawLlmIntent: confirmed.intent }, tool.name, response);
          addConversationTurn(conversationId, 'assistant', response.text);
          return {
            response,
            intent: confirmed.intent,
            confidence: 1,
            toolExecuted: true,
            toolName: tool.name,
            navigation: [],
            pendingConfirmation: false,
          };
        }
      }
    } else if (confirmResponse === 'cancel') {
      addConversationTurn(conversationId, 'user', text);
      cancelPending(conversationId);
      const response = formatConfirmationCancelled();
      addConversationTurn(conversationId, 'assistant', response.text);
      return {
        response,
        intent: pending.intent,
        confidence: 1,
        toolExecuted: false,
        toolName: null,
        navigation: [],
        pendingConfirmation: false,
      };
    }
    // If 'other', cancel old confirmation and proceed with new intent
    cancelPending(conversationId);
  }

  // Step 1: Record user turn
  addConversationTurn(conversationId, 'user', text);
  const history = getConversationHistory(conversationId);

  // Step 2: Classify intent
  const classification = await classifyUserIntent(
    text,
    history as ConversationTurn[],
    deps.llmCaller
  );

  const injectionHits = detectInjectionPatterns(text);
  const blockingInjection = injectionHits.some((h) =>
    [
      'ROLE_ESCALATION',
      'AUTH_BYPASS',
      'TENANT_OVERRIDE',
      'TENANT_SWITCH',
      'CONTEXT_OVERRIDE',
      'EVENT_OVERRIDE',
    ].includes(h)
  );
  if (blockingInjection) {
    const response = formatPermissionDenied(
      'That instruction cannot change identity, organization, or permissions.'
    );
    await logAndReturn(deps, context, text, classification, null, response);
    addConversationTurn(conversationId, 'assistant', response.text);
    return {
      response,
      intent: classification.intent,
      confidence: classification.confidence,
      toolExecuted: false,
      toolName: null,
      navigation: [],
      pendingConfirmation: false,
    };
  }
  if (classification.entityHints) {
    const sanitized = sanitizeLlmEntityHints(classification.entityHints as unknown as Record<string, unknown>);
    classification.entityHints = sanitized as typeof classification.entityHints;
  }

  if (isAmbiguousRecommendationExecution(text)) {
    const response: FormattedResponse = {
      text: RECOMMENDATION_HANDOFF_TEXT,
      card: null,
      navigation: [],
      suggestions: [
        'What should we consider?',
        'Start the activity on HX-204',
        'Accept this recommendation m15-rec:…',
      ],
      authority: 'M16',
      grounded: true,
    };
    await logAndReturn(deps, context, text, classification, null, response);
    addConversationTurn(conversationId, 'assistant', response.text);
    return {
      response,
      intent: classification.intent,
      confidence: classification.confidence,
      toolExecuted: false,
      toolName: null,
      navigation: [],
      pendingConfirmation: false,
    };
  }

  // Step 3: Handle system intents (HELP, UNKNOWN)
  if (classification.intent === M16Intent.HELP) {
    const response = formatHelpResponse();
    await logAndReturn(deps, context, text, classification, null, response);
    addConversationTurn(conversationId, 'assistant', response.text);
    return {
      response,
      intent: classification.intent,
      confidence: classification.confidence,
      toolExecuted: false,
      toolName: null,
      navigation: [],
      pendingConfirmation: false,
    };
  }

  if (classification.intent === M16Intent.UNKNOWN) {
    const response: FormattedResponse = {
      text: 'I\'m not sure what you\'re asking. Could you rephrase or ask for "help" to see what I can do?',
      card: null,
      navigation: [],
      suggestions: ['help', 'What is the progress?', 'Show delayed activities'],
      authority: 'M16',
      grounded: false,
    };
    await logAndReturn(deps, context, text, classification, null, response);
    addConversationTurn(conversationId, 'assistant', response.text);
    return {
      response,
      intent: M16Intent.UNKNOWN,
      confidence: classification.confidence,
      toolExecuted: false,
      toolName: null,
      navigation: [],
      pendingConfirmation: false,
    };
  }

  // Step 4: Governance intents — still not available in R3
  if (isGovernanceIntent(classification.intent)) {
    const response: FormattedResponse = {
      text: 'Governance actions (scope changes, schedule changes) are not yet available via the assistant. Please use the web interface.',
      card: null,
      navigation: [],
      suggestions: ['What is the progress?', 'Show constraints'],
      authority: 'M16',
      grounded: false,
    };
    await logAndReturn(deps, context, text, classification, null, response);
    addConversationTurn(conversationId, 'assistant', response.text);
    return {
      response,
      intent: classification.intent,
      confidence: classification.confidence,
      toolExecuted: false,
      toolName: null,
      navigation: [],
      pendingConfirmation: false,
    };
  }

  // Step 4b: Authorization check for execution intents (R3)
  if (isExecutionIntent(classification.intent)) {
    const authResult = checkAuthorization(context, classification.intent, null, userRole);
    if (!authResult.authorized) {
      const response = formatPermissionDenied(authResult.deniedReason || 'Permission denied.');
      await logAndReturn(deps, context, text, classification, null, response);
      addConversationTurn(conversationId, 'assistant', response.text);
      return {
        response,
        intent: classification.intent,
        confidence: classification.confidence,
        toolExecuted: false,
        toolName: null,
        navigation: [],
        pendingConfirmation: false,
      };
    }
  }

  // Step 5: Check event context for event-scoped intents
  if (requiresEventContext(classification.intent) && !context.eventId) {
    const response: FormattedResponse = {
      text: 'I need a turnaround/event context to answer that. Please select a turnaround from the dropdown first.',
      card: null,
      navigation: [],
      suggestions: [],
      authority: 'M16',
      grounded: false,
    };
    await logAndReturn(deps, context, text, classification, null, response);
    addConversationTurn(conversationId, 'assistant', response.text);
    return {
      response,
      intent: classification.intent,
      confidence: classification.confidence,
      toolExecuted: false,
      toolName: null,
      navigation: [],
      pendingConfirmation: false,
    };
  }

  // Step 6: Resolve entities (merge hints with conversation context)
  const lastEntities = getLastEntities(conversationId);
  const mergedHints = {
    equipmentTag: classification.entityHints.equipmentTag ?? lastEntities.equipmentTag ?? undefined,
    workpackNumber: classification.entityHints.workpackNumber ?? lastEntities.workpackNumber ?? undefined,
    activityDescription: classification.entityHints.activityDescription ?? lastEntities.activityDescription ?? undefined,
  };

  let resolvedEntities: M16ResolvedEntities = { equipment: null, workpack: null, activity: null };
  try {
    resolvedEntities = await deps.resolveEntities(
      context.organizationId,
      context.eventId,
      mergedHints
    );
  } catch {
    // Entity resolution failure is not fatal — tools handle NOT_FOUND
  }

  // Update conversation context with newly resolved entities
  updateConversationEntities(
    conversationId,
    {
      assetId: resolvedEntities.equipment?.assetId,
      equipmentTag: resolvedEntities.equipment?.tagNumber,
      workpackId: resolvedEntities.workpack?.workpackId,
      workpackNumber: resolvedEntities.workpack?.workpackNumber,
      activityId: resolvedEntities.activity?.activityId,
      activityDescription: resolvedEntities.activity?.description,
    },
    context.eventId
  );

  // Step 7: Find and execute tool
  const tool = findToolForIntent(classification.intent);
  let navigationRoutes: NavigationRoute[] = [];

  if (!tool) {
    // No tool registered for this intent — try navigation
    if (isNavigationIntent(classification.intent)) {
      const navTarget = classification.entityHints.navigationTarget
        ?? classification.intent.replace('OPEN_', '').toLowerCase();
      const route = resolveNavigation(navTarget, {
        eventId: context.eventId ?? undefined,
        assetId: resolvedEntities.equipment?.assetId,
        workpackId: resolvedEntities.workpack?.workpackId,
        activityId: resolvedEntities.activity?.activityId,
      });

      if (route) {
        navigationRoutes = [route];
        const response: FormattedResponse = {
          text: `I'll take you to ${route.label}.`,
          card: null,
          navigation: [route],
          suggestions: [],
          authority: 'M16 Navigation',
          grounded: true,
        };
        await logAndReturn(deps, context, text, classification, 'navigation', response);
        addConversationTurn(conversationId, 'assistant', response.text);
        return {
          response,
          intent: classification.intent,
          confidence: classification.confidence,
          toolExecuted: false,
          toolName: 'navigation',
          navigation: navigationRoutes,
          pendingConfirmation: false,
        };
      }
    }

    // No tool, no navigation — generic response
    const response: FormattedResponse = {
      text: 'I understand your request but don\'t have a tool to handle it yet. Try asking about progress, status, or constraints.',
      card: null,
      navigation: [],
      suggestions: ['What is the progress?', 'Show constraints', 'help'],
      authority: 'M16',
      grounded: false,
    };
    await logAndReturn(deps, context, text, classification, null, response);
    addConversationTurn(conversationId, 'assistant', response.text);
    return {
      response,
      intent: classification.intent,
      confidence: classification.confidence,
      toolExecuted: false,
      toolName: null,
      navigation: [],
      pendingConfirmation: false,
    };
  }

  // Validate tool execution
  const validationError = validateToolExecution(tool, context);
  if (validationError) {
    const response: FormattedResponse = {
      text: validationError,
      card: null,
      navigation: [],
      suggestions: [],
      authority: 'M16',
      grounded: false,
    };
    await logAndReturn(deps, context, text, classification, tool.name, response);
    addConversationTurn(conversationId, 'assistant', response.text);
    return {
      response,
      intent: classification.intent,
      confidence: classification.confidence,
      toolExecuted: false,
      toolName: tool.name,
      navigation: [],
      pendingConfirmation: false,
    };
  }

  // Build tool params from resolved entities
  const toolParams: ToolParams = {
    assetId: resolvedEntities.equipment?.assetId,
    equipmentTag: resolvedEntities.equipment?.tagNumber,
    workpackId: resolvedEntities.workpack?.workpackId,
    workpackNumber: resolvedEntities.workpack?.workpackNumber,
    activityId: resolvedEntities.activity?.activityId,
    activityDescription: resolvedEntities.activity?.description,
    rawUserText: text,
    conversationRecommendationIds: getLastRecommendationIds(conversationId),
  };

  // Step 8b: Confirmation gate for execution intents (R3)
  if (isExecutionIntent(classification.intent) && requiresExplicitConfirmation(classification.intent)) {
    const actionSummary = `${INTENT_METADATA[classification.intent].description}: ${toolParams.activityDescription || toolParams.activityId || 'activity'}${toolParams.equipmentTag ? ` on ${toolParams.equipmentTag}` : ''}`;
    const pendingAction = createPendingConfirmation(
      conversationId,
      classification.intent,
      tool.name,
      toolParams,
      actionSummary,
      context
    );
    const promptText = buildConfirmationPrompt(classification.intent, actionSummary);
    const response = formatConfirmationPrompt(promptText, classification.intent);
    await logAndReturn(deps, context, text, classification, tool.name, response);
    addConversationTurn(conversationId, 'assistant', response.text);
    return {
      response,
      intent: classification.intent,
      confidence: classification.confidence,
      toolExecuted: false,
      toolName: tool.name,
      navigation: [],
      pendingConfirmation: true,
    };
  }

  // Step 9: Execute tool
  let toolResult: ToolResult;
  try {
    toolResult = await tool.execute(context, toolParams);
  } catch (err: unknown) {
    toolResult = {
      status: 'ERROR',
      data: null,
      summary: `Tool execution failed: ${(err as Error).message}`,
      authority: tool.authority,
    };
  }

  if (toolResult.status === 'SUCCESS' && toolResult.data && context.eventId) {
    const payload = toolResult.data as {
      recommendations?: Array<{ recommendationId?: string }>;
      recommendationId?: string;
    };
    const ids = payload.recommendations
      ? payload.recommendations.map((r) => r.recommendationId).filter((id): id is string => !!id)
      : payload.recommendationId
        ? [payload.recommendationId]
        : [];
    if (ids.length > 0) {
      updateConversationRecommendations(conversationId, ids, context.eventId);
    }
  }

  // Step 9: Format response
  const response = formatToolResult(toolResult, tool.name, context);

  // Add navigation for entity-based results
  if (resolvedEntities.equipment?.assetId || resolvedEntities.workpack?.workpackId) {
    const route = resolveNavigation(
      resolvedEntities.equipment?.assetId ? 'equipment' : 'workpack',
      {
        eventId: context.eventId ?? undefined,
        assetId: resolvedEntities.equipment?.assetId,
        workpackId: resolvedEntities.workpack?.workpackId,
        activityId: resolvedEntities.activity?.activityId,
      }
    );
    if (route) {
      response.navigation.push(route);
      navigationRoutes.push(route);
    }
  }

  // Step 10: Log interaction + record assistant turn
  await logAndReturn(deps, context, text, classification, tool.name, response);
  addConversationTurn(conversationId, 'assistant', response.text);

  return {
    response,
    intent: classification.intent,
    confidence: classification.confidence,
    toolExecuted: true,
    toolName: tool.name,
    navigation: navigationRoutes,
    pendingConfirmation: false,
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function logAndReturn(
  deps: PipelineDependencies,
  context: M16InteractionContext,
  userMessage: string,
  classification: ClassificationResult,
  toolName: string | null,
  response: FormattedResponse
): Promise<void> {
  try {
    await deps.logInteraction({
      organizationId: context.organizationId,
      userId: context.userId,
      channel: context.channel,
      conversationId: context.conversationId,
      userMessage,
      intent: classification.intent,
      toolName,
      responseText: response.text,
      eventId: context.eventId,
    });
  } catch {
    // Audit failure should not break the interaction
    console.error('[M16] Failed to log interaction');
  }
}
