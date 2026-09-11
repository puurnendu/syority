/**
 * Deterministic recommendation reference resolution (M15-R5).
 *
 * Resolves only against a trusted event-scoped recommendation set.
 * Never guesses when multiple candidates remain.
 */

import type { ManagementRecommendation } from './types';

export interface RecommendationResolveQuery {
  recommendationId?: string;
  activityId?: string;
  equipmentTag?: string;
  workpackNumber?: string;
  text?: string;
  conversationRecommendationIds?: string[];
}

export type RecommendationResolveResult =
  | { status: 'RESOLVED'; recommendation: ManagementRecommendation }
  | { status: 'AMBIGUOUS'; candidates: Array<{ recommendationId: string; title: string }> }
  | { status: 'NOT_FOUND'; reason: string };

function extractExplicitId(text?: string): string | undefined {
  if (!text) return undefined;
  const m = text.match(/m15-rec:[0-9a-f-]+:\S+/i);
  return m?.[0];
}

function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 3);
}

function entityHaystack(rec: ManagementRecommendation): string {
  return [
    rec.title,
    rec.problem,
    rec.recommendation,
    rec.category,
    ...rec.affectedEntities.map((e) => `${e.label ?? ''} ${e.entityId}`),
  ]
    .join(' ')
    .toLowerCase();
}

function uniqueOrAmbiguous(
  matches: ManagementRecommendation[]
): RecommendationResolveResult {
  if (matches.length === 1) {
    return { status: 'RESOLVED', recommendation: matches[0] };
  }
  if (matches.length > 1) {
    return {
      status: 'AMBIGUOUS',
      candidates: matches.slice(0, 8).map((r) => ({
        recommendationId: r.recommendationId,
        title: r.title,
      })),
    };
  }
  return { status: 'NOT_FOUND', reason: 'No matching recommendation in the trusted event set.' };
}

/**
 * Resolve a natural or explicit reference against already-fetched event-scoped recs.
 */
export function resolveRecommendationReference(
  eventId: string,
  recommendations: ManagementRecommendation[],
  query: RecommendationResolveQuery
): RecommendationResolveResult {
  const scoped = recommendations.filter((r) => r.eventId === eventId);
  if (scoped.length === 0) {
    return { status: 'NOT_FOUND', reason: 'No recommendations in the trusted event.' };
  }

  const explicit = query.recommendationId || extractExplicitId(query.text);
  if (explicit) {
    if (!explicit.startsWith(`m15-rec:${eventId}:`)) {
      return { status: 'NOT_FOUND', reason: 'Recommendation does not belong to the trusted event.' };
    }
    const hit = scoped.find((r) => r.recommendationId === explicit);
    if (!hit) {
      return { status: 'NOT_FOUND', reason: 'Recommendation is not in the current event composition.' };
    }
    return { status: 'RESOLVED', recommendation: hit };
  }

  let pool = scoped;

  if (query.activityId) {
    pool = pool.filter((r) =>
      r.affectedEntities.some((e) => e.entityType === 'activity' && e.entityId === query.activityId)
    );
  }

  if (query.equipmentTag) {
    const tag = query.equipmentTag.toLowerCase();
    pool = pool.filter((r) => entityHaystack(r).includes(tag));
  }

  if (query.workpackNumber) {
    const wp = query.workpackNumber.toLowerCase();
    pool = pool.filter((r) => entityHaystack(r).includes(wp));
  }

  if (query.conversationRecommendationIds && query.conversationRecommendationIds.length > 0) {
    const allowed = new Set(
      query.conversationRecommendationIds.filter((id) => id.startsWith(`m15-rec:${eventId}:`))
    );
    const fromConversation = pool.filter((r) => allowed.has(r.recommendationId));
    if (fromConversation.length === 1 && !query.activityId && !query.equipmentTag) {
      return { status: 'RESOLVED', recommendation: fromConversation[0] };
    }
    if (fromConversation.length > 1 && !query.activityId && !query.equipmentTag && !query.workpackNumber) {
      const text = query.text?.toLowerCase() ?? '';
      const deictic = /\b(this|that|the|it)\b/.test(text) && /recommend/.test(text);
      if (deictic || !query.text) {
        return uniqueOrAmbiguous(fromConversation);
      }
    }
    if (fromConversation.length > 0) {
      pool = fromConversation;
    }
  }

  if (query.text) {
    const skip = new Set([
      'accept', 'reject', 'defer', 'recommendation', 'recommendations', 'please',
      'show', 'about', 'concerning', 'the', 'this', 'that', 'what', 'was',
      'more', 'information', 'request', 'for', 'you', 'just', 'gave', 'me',
      'mean', 'which', 'one', 'with', 'from', 'your',
    ]);
    const meaningful = tokens(query.text).filter((t) => !skip.has(t));
    if (meaningful.length > 0 && pool.length > 1) {
      const narrowed = pool.filter((r) => {
        const hay = entityHaystack(r);
        return meaningful.every((t) => hay.includes(t) || r.category.toLowerCase() === t);
      });
      if (narrowed.length === 1) return uniqueOrAmbiguous(narrowed);
      if (narrowed.length > 1) return uniqueOrAmbiguous(narrowed);
    }
  }

  if (query.activityId || query.equipmentTag || query.workpackNumber) {
    return uniqueOrAmbiguous(pool);
  }

  if (
    query.conversationRecommendationIds &&
    query.conversationRecommendationIds.length === 1
  ) {
    const only = scoped.find((r) => r.recommendationId === query.conversationRecommendationIds![0]);
    if (only) return { status: 'RESOLVED', recommendation: only };
  }

  if (pool.length === 1) return uniqueOrAmbiguous(pool);

  if (pool.length > 1 && /recommend/.test(query.text ?? '')) {
    return uniqueOrAmbiguous(pool);
  }

  return { status: 'NOT_FOUND', reason: 'Could not uniquely resolve a recommendation in this event.' };
}
