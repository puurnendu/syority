import type { AiRecommendation } from './types';

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 1)
  );
}

export function jaccardSimilarity(a: string, b: string): number {
  const ta = tokenize(a);
  const tb = tokenize(b);
  if (ta.size === 0 && tb.size === 0) return 1;
  if (ta.size === 0 || tb.size === 0) return 0;
  let intersection = 0;
  for (const t of ta) if (tb.has(t)) intersection++;
  return intersection / (ta.size + tb.size - intersection);
}

export function payloadSimilarity(
  titleA: string,
  payloadA: Record<string, unknown>,
  titleB: string,
  payloadB: Record<string, unknown>
): number {
  const titleScore = jaccardSimilarity(titleA, titleB);
  const bodyScore = jaccardSimilarity(
    JSON.stringify(payloadA),
    JSON.stringify(payloadB)
  );
  return Math.round((titleScore * 0.55 + bodyScore * 0.45) * 1000) / 1000;
}

export function recommendFromScore(score: number): AiRecommendation {
  if (score >= 0.92) return 'DUPLICATE';
  if (score >= 0.72) return 'MERGE';
  if (score < 0.15) return 'NEW';
  return 'NEW';
}

export function buildAiSuggestion(
  recommendation: AiRecommendation,
  score: number,
  matchedTitle?: string | null
): string {
  switch (recommendation) {
    case 'DUPLICATE':
      return `Near-duplicate of "${matchedTitle ?? 'approved library item'}" (similarity ${(score * 100).toFixed(1)}%). Suggest reject or merge.`;
    case 'MERGE':
      return `Similar to "${matchedTitle ?? 'approved library item'}" (similarity ${(score * 100).toFixed(1)}%). Suggest merge into existing Standard Library entry.`;
    case 'REJECT':
      return 'Asset quality or policy check failed. Suggest reject.';
    default:
      return `No close match in Standard Library (best similarity ${(score * 100).toFixed(1)}%). Suggest approve as new.`;
  }
}
