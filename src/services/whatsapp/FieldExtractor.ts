/**
 * Extracts 4 structured fields from text (message or Whisper transcript).
 * Uses GPT-4o Mini. Returns per-field confidence for routing.
 */

export type ExtractedFields = {
  unit_name: string | null;
  equipment_tag: string | null;
  job_description: string | null;
  progress_percent: number | null;
  confidence: {
    unit_name: number;
    equipment_tag: number;
    job_description: number;
    progress_percent: number;
    overall: number;
  };
  flags: {
    unit_name: null | 'amber' | 'red';
    equipment_tag: null | 'amber' | 'red';
    job_description: null | 'amber' | 'red';
    progress_percent: null | 'amber' | 'red';
  };
  is_query: boolean;
  query_type: 'status' | 'my_jobs' | 'help' | null;
  query_target: string | null;
  missing_fields: string[];
  detected_intent: 'update' | 'query' | 'unknown';
};

function flagFromScore(score: number): null | 'amber' | 'red' {
  if (score >= 0.9) return null;
  if (score >= 0.75) return 'amber';
  return 'red';
}

const EXTRACTION_PROMPT = `You are processing a field technician message from a turnaround maintenance system. Message may be in English, Hindi, Bhojpuri, Gujarati, Tamil, or Malayalam.
EXTRACT: 1) unit_name (FCC, CDU, VDU...), 2) equipment_tag (E-101A, P-201... always English), 3) job_description, 4) progress_percent (0-100 integer).
If message is a query (status, my jobs, help) set is_query true and query_type/query_target.
CONFIDENCE 0-1 per field. Respond ONLY with valid JSON:
{"unit_name":null,"equipment_tag":null,"job_description":null,"progress_percent":null,"confidence":{"unit_name":0,"equipment_tag":0,"job_description":0,"progress_percent":0,"overall":0},"is_query":false,"query_type":null,"query_target":null,"missing_fields":[],"detected_intent":"update"}`;

export async function extractFields(
  text: string,
  providerConfig: { apiKey: string; model: string }
): Promise<ExtractedFields> {
  const prompt = EXTRACTION_PROMPT + '\n\nMESSAGE:\n"' + text + '"';
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + providerConfig.apiKey,
    },
    body: JSON.stringify({
      model: providerConfig.model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 512,
      temperature: 0.1,
    }),
  });
  if (!res.ok) throw new Error('GPT error ' + res.status + ': ' + (await res.text()));
  const data = (await res.json()) as { choices: Array<{ message: { content: string } }> };
  const raw = data.choices[0]?.message?.content ?? '{}';
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw.replace(/```json\s*/g, '').replace(/```/g, '').trim()) as Record<string, unknown>;
  } catch {
    throw new Error('GPT returned invalid JSON');
  }
  const conf = (parsed.confidence ?? {}) as Record<string, number>;
  const missing = (parsed.missing_fields ?? []) as string[];
  return {
    unit_name: (parsed.unit_name as string | null) ?? null,
    equipment_tag: (parsed.equipment_tag as string | null) ?? null,
    job_description: (parsed.job_description as string | null) ?? null,
    progress_percent: (parsed.progress_percent as number | null) ?? null,
    confidence: {
      unit_name: conf.unit_name ?? 0,
      equipment_tag: conf.equipment_tag ?? 0,
      job_description: conf.job_description ?? 0,
      progress_percent: conf.progress_percent ?? 0,
      overall: conf.overall ?? 0,
    },
    flags: {
      unit_name: flagFromScore(conf.unit_name ?? 0),
      equipment_tag: flagFromScore(conf.equipment_tag ?? 0),
      job_description: flagFromScore(conf.job_description ?? 0),
      progress_percent: flagFromScore(conf.progress_percent ?? 0),
    },
    is_query: (parsed.is_query as boolean) ?? false,
    query_type: (parsed.query_type as ExtractedFields['query_type']) ?? null,
    query_target: (parsed.query_target as string | null) ?? null,
    missing_fields: missing,
    detected_intent: (parsed.detected_intent as ExtractedFields['detected_intent']) ?? 'unknown',
  };
}
