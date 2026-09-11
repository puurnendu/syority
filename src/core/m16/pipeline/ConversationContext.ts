/**
 * M16-R2 — Conversation Context
 *
 * Tracks resolved entities across conversation turns so the user can say:
 *   "Show HX-204" → resolves HX-204
 *   "What's its progress?" → uses HX-204 from previous turn
 *
 * CRITICAL RULES:
 *   - Conversation context NEVER overrides org/event/auth
 *   - Context expires after configurable timeout (default 30 min)
 *   - Context resets on event change
 *   - Only resolved (application-verified) entities are stored
 */

export interface ConversationEntity {
  assetId?: string;
  equipmentTag?: string;
  workpackId?: string;
  workpackNumber?: string;
  activityId?: string;
  activityDescription?: string;
}

export interface ConversationState {
  /** Conversation ID */
  conversationId: string;
  /** Last resolved entities */
  lastEntities: ConversationEntity;
  /** Event ID at time of resolution */
  eventId: string | null;
  /** Timestamp of last update */
  lastUpdated: number;
  /** Previous turns (for LLM context window) */
  turns: Array<{ role: 'user' | 'assistant'; content: string }>;
  /** Application-verified recommendation ids shown in this conversation (event-scoped). */
  lastRecommendationIds: string[];
}

const DEFAULT_EXPIRY_MS = 30 * 60 * 1000; // 30 minutes
const MAX_TURNS = 10;

const conversations = new Map<string, ConversationState>();

/**
 * Get or create conversation state.
 */
export function getConversation(conversationId: string): ConversationState {
  const existing = conversations.get(conversationId);
  if (existing && (Date.now() - existing.lastUpdated) < DEFAULT_EXPIRY_MS) {
    return existing;
  }
  // Expired or new — create fresh
  const fresh: ConversationState = {
    conversationId,
    lastEntities: {},
    eventId: null,
    lastUpdated: Date.now(),
    turns: [],
    lastRecommendationIds: [],
  };
  conversations.set(conversationId, fresh);
  return fresh;
}

/**
 * Update conversation with resolved entities.
 * Only stores application-verified entity IDs.
 */
export function updateConversationEntities(
  conversationId: string,
  entities: Partial<ConversationEntity>,
  eventId: string | null
): void {
  const state = getConversation(conversationId);

  // If event changed, reset entities — they belong to the old event
  if (state.eventId && eventId && state.eventId !== eventId) {
    state.lastEntities = {};
    state.lastRecommendationIds = [];
  }

  // Merge new entities (only non-null values overwrite)
  for (const [key, value] of Object.entries(entities)) {
    if (value !== undefined && value !== null) {
      (state.lastEntities as Record<string, string>)[key] = value;
    }
  }

  state.eventId = eventId;
  state.lastUpdated = Date.now();
}

/**
 * Add a turn to conversation history.
 */
export function addConversationTurn(
  conversationId: string,
  role: 'user' | 'assistant',
  content: string
): void {
  const state = getConversation(conversationId);
  state.turns.push({ role, content: content.slice(0, 500) }); // Limit content size
  if (state.turns.length > MAX_TURNS) {
    state.turns = state.turns.slice(-MAX_TURNS);
  }
  state.lastUpdated = Date.now();
}

/**
 * Get the conversation history for LLM context.
 */
export function getConversationHistory(
  conversationId: string
): Array<{ role: 'user' | 'assistant'; content: string }> {
  const state = getConversation(conversationId);
  return [...state.turns];
}

/**
 * Get previously resolved entities for follow-up questions.
 */
export function getLastEntities(conversationId: string): ConversationEntity {
  const state = getConversation(conversationId);
  return { ...state.lastEntities };
}

/**
 * Store recommendation ids that the application actually returned (not LLM-invented).
 */
export function updateConversationRecommendations(
  conversationId: string,
  recommendationIds: string[],
  eventId: string | null
): void {
  const state = getConversation(conversationId);
  if (state.eventId && eventId && state.eventId !== eventId) {
    state.lastRecommendationIds = [];
    state.lastEntities = {};
  }
  const scoped = eventId
    ? recommendationIds.filter((id) => id.startsWith(`m15-rec:${eventId}:`))
    : [];
  state.lastRecommendationIds = scoped.slice(0, 50);
  state.eventId = eventId;
  state.lastUpdated = Date.now();
}

export function getLastRecommendationIds(conversationId: string): string[] {
  return [...getConversation(conversationId).lastRecommendationIds];
}

/**
 * Clear conversation state — for testing or explicit reset.
 */
export function clearConversation(conversationId: string): void {
  conversations.delete(conversationId);
}

/**
 * Clear all conversations — for testing only.
 */
export function clearAllConversations(): void {
  conversations.clear();
}
