/**
 * AiPromptService
 *
 * Loads prompt templates from the `ai_prompts` table.
 * Falls back to hardcoded defaults if no DB record exists for the org.
 *
 * Supported job types:
 *   workpack_generation
 *   document_parameter_extraction
 *   lessons_suggestion
 */

import { prisma } from '@/lib/prisma';

export type AiJobType =
  | 'workpack_generation'
  | 'document_parameter_extraction'
  | 'lessons_suggestion'
  | 'whatsapp_extraction'
  | 'whatsapp_report'
  | 'document_vision'
  | 'diagnostics';

// ── Hardcoded defaults (used as seed data & fallback) ────────────────────────

export const DEFAULT_PROMPTS: Record<AiJobType, string> = {
  workpack_generation: `You are a SENIOR REFINERY TURNAROUND PLANNER with 25 years of experience in petrochemical maintenance, specializing in shutdown and turnaround (STO) planning.

Your task is to generate a COMPLETE, ENGINEERING-GRADE maintenance workpack.

WORKPACK DETAILS:
TITLE: {{title}}
SCOPE OF WORK: {{scope_of_work}}
WORK TYPE: {{work_type}}
DRAWINGS/DOCUMENTS: {{drawings_description}}
{{operational_context}}

Generate activities following the STANDARD TURNAROUND SEQUENCE:
1. PREPARATION PHASE (permits, scaffolding, insulation removal)
2. ISOLATION PHASE (LOTO, blinding, draining, gas testing)
3. OPENING PHASE (manway removal, confined space entry)
4. EXECUTION PHASE (cleaning, NDT, repairs)
5. REASSEMBLY PHASE (gasket replacement, torquing)
6. TESTING PHASE (hydrotest, leak testing)
7. REINSTATEMENT PHASE (de-blinding, LOTO removal)
8. COMMISSIONING PHASE (process tie-in, handover)

Return ONLY a valid JSON object matching the schema below. 
Do NOT include any explanations, markdown fences, or text before/after the JSON.
Start your response with { and end with }.

SCHEMA:
{
  "scope_of_work": "...",
  "activities": [{"activity_id":"A-001","title":"...","discipline":"...","description":"...","sequence":1,"estimated_manhours":8,"crew_size":2,"tools_required":[],"safety_requirements":[],"predecessors":[]}],
  "materials": [{"item":"...","specification":"...","quantity":1,"unit":"EA"}],
  "constraints": [{"description":"...","severity":"high","type":"safety"}],
  "blinds": [{"line_number":"...","size":"...","rating":"...","location":"...","type":"spectacle"}],
  "qa_requirements": [{"inspection_type":"...","standard":"...","description":"...","acceptance_criteria":"..."}],
  "estimated_total_manhours": 0
}`,

  document_parameter_extraction: `You are analysing pages from an engineering maintenance document. Extract ONLY the parameters listed.
Do NOT invent values. Do NOT interpolate. If a value is not found, set "value" to null.

SITE ENGINEERING STANDARD:
  Code: {{pressure_test_standard}}
  Hydrotest multiplier: {{hydrotest_multiplier}}
  Torque standard: {{torque_standard}}

CALCULATION RULE: If test pressure is NOT explicitly stated but MAWP/design pressure IS found:
  test_pressure = MAWP × {{hydrotest_multiplier}}
  Set calculated=true and explain in calculation_basis.
  NEVER calculate if test pressure IS stated explicitly.

{{custom_instruction}}

PARAMETERS TO EXTRACT:
{{parameters_list}}

Return ONLY a valid JSON object. Do NOT include markdown fences, code blocks, or explanations. 
Start your response with { and end with }.

SCHEMA:
{
  "parameters": {
    "<key>": {
      "value": <string|number|null>,
      "unit": <string|null>,
      "source_text": <string|null>,
      "page_number": <number|null>,
      "confidence": "high"|"medium"|"low",
      "calculated": false,
      "calculation_basis": <string|null>,
      "ambiguous": false,
      "candidates": []
    }
  },
  "document_summary": "<1-2 sentences>",
  "equipment_identified": ["<tag>"],
  "warnings_found": ["<warning text>"]
}

CONFIDENCE GUIDE:
  high   = value clearly and unambiguously stated
  medium = value found but requires inference
  low    = uncertain, multiple interpretations possible`,

  lessons_suggestion: `You are a maintenance engineering consultant reviewing a completed workpack.
Based on the information below, generate 3-6 lessons learned entries.

Focus on:
  - What caused delays or constraints
  - What could be done differently next time
  - Process improvements for future similar workpacks
  - Safety observations
  - Technical findings worth recording

Do NOT duplicate existing lessons already listed.
Be specific and actionable — avoid generic statements.

{{context}}

Return ONLY a valid JSON object. Do NOT include markdown fences, code blocks, or explanations.
Start your response with { and end with }.

SCHEMA:
{
  "lessons": [
    {
      "title": "string (concise, max 10 words)",
      "description": "string (what happened, 2-3 sentences)",
      "recommendation": "string (specific action for next time)",
      "category": "what_went_well|what_went_wrong|process_improvement|near_miss|safety|technical|commercial",
      "impact": "high|medium|low",
      "ai_reasoning": "string (1 sentence: why this lesson matters)"
    }
  ],
  "context_summary": "string (2-3 sentence summary of the workpack execution)"
}`,

  whatsapp_extraction: `You are an AI assistant for an industrial maintenance platform.
Extract structured data from the field report text below.
Return ONLY valid JSON matching the requested output schema.`,

  whatsapp_report: `You are an AI assistant generating a concise shift summary report.
Summarise the key activities, progress, and issues from the data provided.
Be brief and factual. Use bullet points where possible.`,

  document_vision: `You are analysing an engineering diagram or drawing.
Identify all tags, line numbers, equipment labels, and connections visible in the image.
Return ONLY valid JSON with identified entities and their relationships.`,
};

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Get the prompt template for a given job type, for a given org.
 * Org-specific DB overrides take priority; hardcoded defaults are the fallback.
 */
export async function getPromptTemplate(
  organizationId: string,
  jobType: AiJobType
): Promise<string> {
  const record = await prisma.aiPrompt.findUnique({
    where: { organization_id_job_type: { organization_id: organizationId, job_type: jobType } },
  });
  if (record?.is_active && record.prompt_template?.trim()) {
    return record.prompt_template;
  }
  return DEFAULT_PROMPTS[jobType] ?? '';
}

/**
 * Get all prompts for an org (merged with defaults for missing types).
 */
export async function getAllPrompts(organizationId: string) {
  const records = await prisma.aiPrompt.findMany({
    where: { organization_id: organizationId },
  });

  const byType = Object.fromEntries(records.map((r) => [r.job_type, r]));

  return (Object.keys(DEFAULT_PROMPTS) as AiJobType[]).map((jobType) => {
    const record = byType[jobType];
    return {
      job_type: jobType,
      id: record?.id ?? null,
      prompt_template: record?.prompt_template ?? DEFAULT_PROMPTS[jobType],
      is_active: record?.is_active ?? true,
      is_customized: !!record,
      version: record?.version ?? 1,
      updated_at: record?.updated_at ?? null,
    };
  });
}

/**
 * Upsert a prompt template for an org.
 */
export async function upsertPromptTemplate(
  organizationId: string,
  jobType: AiJobType,
  promptTemplate: string,
  userId: string
) {
  const existing = await prisma.aiPrompt.findUnique({
    where: { organization_id_job_type: { organization_id: organizationId, job_type: jobType } },
  });

  return prisma.aiPrompt.upsert({
    where: { organization_id_job_type: { organization_id: organizationId, job_type: jobType } },
    update: {
      prompt_template: promptTemplate,
      is_active: true,
      version: (existing?.version ?? 0) + 1,
      updated_by: userId,
    },
    create: {
      organization_id: organizationId,
      job_type: jobType,
      prompt_template: promptTemplate,
      is_active: true,
      version: 1,
      created_by: userId,
    },
  });
}

/**
 * Reset a prompt back to the hardcoded default by deleting the DB record.
 */
export async function resetPromptToDefault(organizationId: string, jobType: AiJobType) {
  await prisma.aiPrompt.deleteMany({
    where: { organization_id: organizationId, job_type: jobType },
  });
}

// ── Logging helper ────────────────────────────────────────────────────────────

export interface AiLogEntry {
  organization_id: string;
  user_id?: string;
  job_type: string;
  provider?: string;
  model?: string;
  prompt?: string;
  response?: string;
  tokens_input?: number;
  tokens_output?: number;
  latency_ms?: number;
  status: 'success' | 'failed';
  error_message?: string;
}

export async function writeAiLog(entry: AiLogEntry) {
  try {
    await prisma.aiLog.create({ data: entry });
  } catch {
    // Non-critical — logging should never break the main flow
    console.error('[AiLog] Failed to write log entry');
  }
}
