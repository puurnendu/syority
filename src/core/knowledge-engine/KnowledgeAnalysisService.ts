import { prisma } from '@/lib/prisma';
import {
  buildAiSuggestion,
  payloadSimilarity,
  recommendFromScore,
} from './similarity';
import type { AiRecommendation } from './types';

/**
 * Duplicate detection + similarity vs Approved Library / Review Queue peers.
 * Heuristic-first; optional AI enrichment when a usable AI provider is configured.
 */
export class KnowledgeAnalysisService {
  static async analyzeAsset(assetId: string): Promise<void> {
    const asset = await prisma.knowledgeAsset.findUnique({ where: { id: assetId } });
    if (!asset) return;
    if (asset.status === 'APPROVED' || asset.status === 'REJECTED') return;

    await prisma.knowledgeAsset.update({
      where: { id: assetId },
      data: { status: 'AI_ANALYSIS' },
    });

    const candidates = await prisma.knowledgeAsset.findMany({
      where: {
        category: asset.category,
        id: { not: assetId },
        status: { in: ['APPROVED', 'REVIEW_QUEUE', 'AI_ANALYSIS'] },
      },
      select: {
        id: true,
        title: true,
        sanitized_payload: true,
        status: true,
        content_hash: true,
      },
      take: 200,
      orderBy: { last_seen_at: 'desc' },
    });

    let bestScore = 0;
    let bestId: string | null = null;
    let bestTitle: string | null = null;

    const payload = (asset.sanitized_payload || {}) as Record<string, unknown>;

    for (const c of candidates) {
      if (c.content_hash === asset.content_hash) {
        bestScore = 1;
        bestId = c.id;
        bestTitle = c.title;
        break;
      }
      const score = payloadSimilarity(
        asset.title,
        payload,
        c.title,
        (c.sanitized_payload || {}) as Record<string, unknown>
      );
      if (score > bestScore) {
        bestScore = score;
        bestId = c.id;
        bestTitle = c.title;
      }
    }

    let recommendation: AiRecommendation = recommendFromScore(bestScore);
    let suggestion = buildAiSuggestion(recommendation, bestScore, bestTitle);

    try {
      const enriched = await tryAiEnrichment(
        asset.title,
        asset.category,
        payload,
        bestTitle,
        bestScore
      );
      if (enriched) {
        recommendation = enriched.recommendation;
        suggestion = enriched.suggestion;
      }
    } catch {
      // heuristic stands
    }

    await prisma.knowledgeAsset.update({
      where: { id: assetId },
      data: {
        status: 'REVIEW_QUEUE',
        similarity_score: bestScore,
        matched_asset_id: bestId,
        ai_recommendation: recommendation,
        ai_suggestion: suggestion,
      },
    });
  }
}

async function tryAiEnrichment(
  title: string,
  category: string,
  payload: Record<string, unknown>,
  matchedTitle: string | null,
  score: number
): Promise<{ recommendation: AiRecommendation; suggestion: string } | null> {
  const cfg = await prisma.aiProviderSetting.findFirst({
    where: { is_active: true, model: { not: null } },
    orderBy: { updated_at: 'desc' },
  });
  // Keys are stored encrypted — only call AI when a plaintext-compatible key path exists.
  // Until decrypt is wired here, stay on heuristics (still produces Review Queue suggestions).
  if (!cfg?.model || !cfg.api_key_encrypted) return null;

  // Prefer not to send encrypted blobs to providers; skip unless env override key present.
  const envKey = process.env.KNOWLEDGE_ENGINE_AI_API_KEY || process.env.OPENAI_API_KEY;
  if (!envKey) return null;

  const { callSyorityAI } = await import('@/lib/ai/universalAiClient');
  const prompt = `You are reviewing a sanitized industrial master-inventory knowledge asset for a platform standard library.
Category: ${category}
Title: ${title}
Best existing match: ${matchedTitle ?? 'none'}
Heuristic similarity: ${score}
Payload JSON: ${JSON.stringify(payload).slice(0, 3000)}

Respond ONLY with JSON: {"recommendation":"NEW"|"MERGE"|"DUPLICATE"|"REJECT","suggestion":"..."}`;

  const result = await callSyorityAI(
    {
      modelIdentifier: cfg.model,
      apiKey: envKey,
      maxTokens: 400,
      temperature: 0.1,
    },
    prompt,
    'Return valid JSON only.'
  );

  const text = result.content?.trim() || '';
  const jsonStart = text.indexOf('{');
  const jsonEnd = text.lastIndexOf('}');
  if (jsonStart < 0 || jsonEnd < 0) return null;
  const parsed = JSON.parse(text.slice(jsonStart, jsonEnd + 1));
  const rec = String(parsed.recommendation || '').toUpperCase() as AiRecommendation;
  if (!['NEW', 'MERGE', 'DUPLICATE', 'REJECT'].includes(rec)) return null;
  return {
    recommendation: rec,
    suggestion: String(parsed.suggestion || buildAiSuggestion(rec, score, matchedTitle)),
  };
}
