/**
 * M15-R4 — Ambiguous "execute the recommendation" is never EWS.
 */

export function isAmbiguousRecommendationExecution(text: string): boolean {
  const t = text.toLowerCase().trim();
  if (/execute\s+(the\s+)?recommendation/.test(t)) return true;
  if (/treat\s+(this\s+)?(the\s+)?recommendation\s+as\s+(an\s+)?approved/.test(t)) return true;
  if (/work instruction/.test(t) && /recommend/.test(t)) return true;
  if (/skip\s+(the\s+)?confirmation/.test(t)) return true;
  if (/ignore.{0,40}confirmation/.test(t)) return true;
  if (/execute\s+it\s+without/.test(t)) return true;
  if (/accept\s+recommendation\s+automatically/.test(t)) return true;
  if (/\baccept\b/.test(t) && /\bexecut/.test(t)) return true;
  if (/authorizes\s*execution\s*=\s*true/.test(t)) return true;
  if (/treat\s+accept\s+as\s+execution/.test(t)) return true;
  return false;
}

export const RECOMMENDATION_HANDOFF_TEXT =
  'A recommendation is not an execution instruction and is not authorization. ' +
  'Say START, RELEASE, HOLD, or COMPLETE plus the activity if you want governed execution. ' +
  'Or ACCEPT/REJECT/DEFER the recommendation as a management decision. Confirmation and M12 EWS still apply to execution.';
