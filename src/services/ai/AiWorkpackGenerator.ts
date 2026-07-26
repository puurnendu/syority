/**
 * AI Workpack Generator Service
 *
 * - Loads active AI provider from database (is_active = true).
 * - Calls OpenAI (chat.completions) or Gemini (generative model) per provider.
 * - No provider keys in code; all keys read from AI provider settings table.
 */

import { callVisionAI, parseVisionJson } from './VisionAiService';
import {
    validateAiWorkpackResponse,
    type AiWorkpackResponse,
} from '@/lib/ai/workpackSchema';
import { getPromptTemplate, writeAiLog } from './AiPromptService';

// ─── Input / Output types ───────────────────────────────────────────────────

export interface AiWorkpackInput {
    /** Required for loading provider (multi-tenant). */
    organization_id: string;
    title: string;
    scope_of_work?: string;
    work_type?: string;
    /** e.g. "Uploaded documents: path1, path2. Use as context for scope and technical details." */
    drawings_description?: string;
    /** e.g. "Site and discipline from form; prioritize safety and execution sequence." */
    operational_context?: string;
}

export type AiWorkpackOutput = AiWorkpackResponse;

// ─── Errors ─────────────────────────────────────────────────────────────────

export class AiWorkpackGeneratorError extends Error {
    constructor(
        message: string,
        public readonly code?: 'NO_PROVIDER' | 'NO_API_KEY' | 'API_ERROR' | 'INVALID_JSON' | 'VALIDATION'
    ) {
        super(message);
        this.name = 'AiWorkpackGeneratorError';
    }
}

// ─── Prompt building ────────────────────────────────────────────────────────

async function buildPrompt(input: AiWorkpackInput): Promise<string> {
    const scope = input.scope_of_work?.trim() || '(not provided)';
    const workType = input.work_type?.trim() || 'Shutdown';
    const drawings = input.drawings_description?.trim() || 'No drawings uploaded.';
    const context = input.operational_context?.trim() || '';

    const template = await getPromptTemplate(input.organization_id, 'workpack_generation');

    return template
        .replace('{{title}}', input.title)
        .replace('{{scope_of_work}}', scope)
        .replace('{{work_type}}', workType)
        .replace('{{drawings_description}}', drawings)
        .replace('{{operational_context}}', context ? `OPERATIONAL CONTEXT: ${context}` : '');
}

// ─── Legacy static prompt kept for reference only ────────────────────────────
// The old hardcoded string is now stored as DEFAULT_PROMPTS.workpack_generation
// in AiPromptService.ts and can be edited via the Admin > AI Setup > Prompts UI.

function _legacyBuildPrompt(input: AiWorkpackInput): string {
    const scope = input.scope_of_work?.trim() || '(not provided)';
    const workType = input.work_type?.trim() || 'Shutdown';
    const drawings = input.drawings_description?.trim() || 'No drawings uploaded.';
    const context = input.operational_context?.trim() || '';

    return `You are a SENIOR REFINERY TURNAROUND PLANNER with 25 years of experience in petrochemical maintenance, specializing in shutdown and turnaround (STO) planning for refineries, chemical plants, and process facilities.

Your task is to generate a COMPLETE, ENGINEERING-GRADE maintenance workpack for the following equipment/scope.

═══════════════════════════════════════════════════════════════════════════════
                              WORKPACK DETAILS
═══════════════════════════════════════════════════════════════════════════════

TITLE: ${input.title}
SCOPE OF WORK: ${scope}
WORK TYPE: ${workType}
DRAWINGS/DOCUMENTS: ${drawings}
${context ? `OPERATIONAL CONTEXT: ${context}` : ''}

═══════════════════════════════════════════════════════════════════════════════
                           PLANNING REQUIREMENTS
═══════════════════════════════════════════════════════════════════════════════

Generate activities following the STANDARD TURNAROUND SEQUENCE:

1. PREPARATION PHASE
   - Work permit preparation and safety briefings
   - Scaffolding erection (if required)
   - Insulation removal (if applicable)

2. ISOLATION PHASE
   - Process isolation and depressurization
   - LOTO (Lock Out Tag Out) implementation
   - Blinding/spading of process lines
   - Draining and purging
   - Gas testing and atmospheric monitoring

3. OPENING PHASE
   - Manway/cover removal
   - Confined space entry preparation
   - Initial internal inspection

4. EXECUTION PHASE
   - Bundle extraction (for heat exchangers)
   - Cleaning (chemical/mechanical/hydrojetting)
   - NDT inspection (UT, MT, PT, RT as required)
   - Repairs (welding, machining, replacement)
   - Retubing or plug installation (if applicable)

5. REASSEMBLY PHASE
   - Bundle reinsertion
   - Gasket replacement
   - Torquing to specification
   - Manway/cover installation

6. TESTING PHASE
   - Hydrotest or pneumatic test
   - Leak testing
   - Pressure hold verification

7. REINSTATEMENT PHASE
   - Blind removal (de-blinding)
   - LOTO removal
   - Insulation reinstallation
   - Scaffolding dismantling

8. COMMISSIONING PHASE
   - Process tie-in
   - Leak check under process conditions
   - Handover to operations

═══════════════════════════════════════════════════════════════════════════════
                           OUTPUT REQUIREMENTS
═══════════════════════════════════════════════════════════════════════════════

Return ONLY valid JSON (no markdown, no code fences, no explanatory text).

Use this EXACT schema:

{
  "scope_of_work": "Detailed engineering scope statement describing the full extent of work",
  
  "activities": [
    {
      "activity_id": "A-001",
      "title": "Activity title",
      "discipline": "mechanical | piping | inspection | scaffolding | safety | electrical | instrumentation | insulation",
      "description": "Detailed step-by-step description of the task including specific actions, tools, and acceptance criteria",
      "sequence": 1,
      "estimated_manhours": 8,
      "crew_size": 2,
      "tools_required": ["Tool 1", "Tool 2"],
      "safety_requirements": ["PPE requirement", "Permit type", "Hazard control"],
      "predecessors": []
    }
  ],
  
  "materials": [
    {
      "item": "Material name",
      "specification": "ASTM/ASME/API specification or grade",
      "quantity": 1,
      "unit": "EA/M/KG/SET"
    }
  ],
  
  "constraints": [
    {
      "description": "Constraint description",
      "severity": "critical | high | medium | low",
      "type": "safety | schedule | resource | technical | environmental"
    }
  ],
  
  "blinds": [
    {
      "line_number": "12-HC-1001-A1A-150#",
      "size": "6\\"",
      "rating": "150#",
      "location": "Upstream of inlet valve V-101",
      "type": "spectacle | spade | paddle"
    }
  ],
  
  "qa_requirements": [
    {
      "inspection_type": "Ultrasonic Thickness (UT)",
      "standard": "API 510 / ASME B31.3",
      "description": "Measure remaining wall thickness at specified TMLs",
      "acceptance_criteria": "Min. wall thickness per design calculations"
    }
  ],
  
  "estimated_total_manhours": 0
}

═══════════════════════════════════════════════════════════════════════════════
                           QUALITY STANDARDS
═══════════════════════════════════════════════════════════════════════════════

MANHOUR ESTIMATES (realistic industrial rates):
- Scaffolding erection: 0.5-1.0 MH per m³
- Insulation removal: 0.3-0.5 MH per m²
- Flange breaking: 0.5-2.0 MH per flange (size dependent)
- Bundle pull: 4-16 MH (size dependent)
- Hydrotest setup: 4-8 MH
- Gasket replacement: 0.5-1.5 MH per gasket

CREW SIZES (typical):
- Scaffolding: 2-4 scaffolders
- Mechanical: 2-4 fitters + 1 rigger
- Inspection: 1-2 inspectors
- Safety: 1 safety watch per confined space

SAFETY REQUIREMENTS (always include):
- Hot work permit (if welding/grinding)
- Confined space entry permit (if entering vessels)
- LOTO verification before entry
- Gas testing: LEL, O2, H2S, CO
- Rescue standby for confined space

QA STANDARDS (reference as applicable):
- API 510 (Pressure Vessels)
- API 570 (Piping)
- API 660 (Heat Exchangers)
- ASME PCC-1 (Bolted Flange Joints)
- ASME B31.3 (Process Piping)
- TEMA (Heat Exchanger Standards)

═══════════════════════════════════════════════════════════════════════════════

Generate the complete workpack now. 
Be highly technical but concise in activity descriptions to ensure the entire engineering sequence is captured.
Ensure activities have logical predecessors forming a proper network sequence. 
Sum all activity manhours for estimated_total_manhours.`;
}

// ─── Public API ──────────────────────────────────────────────────────────────

export async function generateWorkpack(data: AiWorkpackInput): Promise<AiWorkpackOutput> {
    const prompt = await buildPrompt(data);
    const startedAt = Date.now();
    let rawContent: string;
    let attempts = 0;
    const maxAttempts = 2;

    while (attempts < maxAttempts) {
        attempts++;
        try {
            rawContent = await callVisionAI({
                orgId: data.organization_id,
                workpackId: 'new',
                userPrompt: attempts > 1 
                    ? `${prompt}\n\nERROR: Your last response was not valid JSON. Please return ONLY the JSON object, starting with { and ending with }.`
                    : prompt,
                systemPrompt: 'Senior Refinery Planner. Return JSON only. No markdown.',
                context: {
                    title: data.title,
                    work_type: data.work_type
                },
                maxTokens: 8000
            });
            
            const parsed = parseVisionJson<AiWorkpackResponse>(rawContent, { expected: 'object' });
            
            // NORMALIZE: If the AI returned a single-item array [ {...} ], unwrap it
            let dataToValidate = parsed;
            if (Array.isArray(parsed) && parsed.length === 1 && typeof parsed[0] === 'object' && parsed[0] !== null) {
                dataToValidate = parsed[0];
            }

            const result = validateAiWorkpackResponse(dataToValidate);
            
            await writeAiLog({
                organization_id: data.organization_id,
                job_type: 'workpack_generation',
                prompt: prompt.substring(0, 1000),
                response: rawContent,
                latency_ms: Date.now() - startedAt,
                status: 'success',
            });

            return result;

        } catch (err) {
            console.warn(`[WorkpackGen] Attempt ${attempts} failed:`, err instanceof Error ? err.message : err);
            
            if (attempts >= maxAttempts) {
                const message = err instanceof Error ? err.message : 'AI workpack generation failed after multiple attempts';
                await writeAiLog({
                    organization_id: data.organization_id,
                    job_type: 'workpack_generation',
                    prompt: prompt.substring(0, 1000),
                    response: rawContent!,
                    latency_ms: Date.now() - startedAt,
                    status: 'failed',
                    error_message: message,
                });
                throw new AiWorkpackGeneratorError(message, 'INVALID_JSON');
            }
            // If we have attempts left, the loop continues and retries
        }
    }

    throw new AiWorkpackGeneratorError('Unexpected fallthrough in generation loop', 'API_ERROR');
}
