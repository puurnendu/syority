/**
 * Vertex AI Client for Syority Platform
 *
 * Authentication: ONLY Application Default Credentials (ADC).
 * NO API keys. NO base64 JSON. NO service-account.json files.
 *
 * Auth priority (automatic — no config needed):
 *   1. Google Antigravity / GCP runtime → uses attached service account automatically
 *   2. Local development → run: gcloud auth application-default login
 *
 * Required environment variables:
 *   GOOGLE_CLOUD_PROJECT  — your Google Cloud project ID
 *   GOOGLE_CLOUD_LOCATION — region (e.g. asia-south1, us-central1)
 */

import { VertexAI, HarmBlockThreshold, HarmCategory } from '@google-cloud/vertexai';
import { GoogleAuth } from 'google-auth-library';

// ── Lazy ADC check (runs once on first Vertex AI call) ────────────────────────
//
// Previously ran at module load — moved to lazy to prevent network calls
// during `next build` or static generation.

let _adcCheckDone = false;

async function checkADC(): Promise<void> {
    if (_adcCheckDone) return;
    _adcCheckDone = true;

    try {
        const auth = new GoogleAuth({
            scopes: ['https://www.googleapis.com/auth/cloud-platform'],
        });
        const client = await auth.getClient();
        // Log auth type without exposing any secret values
        const authType = (client.constructor as { name?: string }).name ?? 'UnknownClient';
        console.log(`[Vertex AI] ✅ ADC detected. Auth client: ${authType}`);
    } catch (err: any) {
        console.warn(
            '[Vertex AI] ⚠️  ADC not detected. ' +
            'For local development, run: gcloud auth application-default login\n' +
            `[Vertex AI] Detail: ${err.message}`
        );
    }
}

// ADC check is now invoked lazily inside callVertexAI() — NOT at module load.

// ── Types ─────────────────────────────────────────────────────────────────────

export interface VertexAiCallOptions {
    model: string;
    prompt: string;
    images?: Array<{ base64: string; mimeType: string }>;
    systemPrompt?: string;
    maxTokens?: number;
    temperature?: number;
    responseAsJson?: boolean;
}

// ── Project / Location resolution ─────────────────────────────────────────────

function getProjectConfig(): { projectId: string; location: string } {
    const projectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.VERTEX_AI_PROJECT_ID;
    const location = process.env.GOOGLE_CLOUD_LOCATION || process.env.VERTEX_AI_LOCATION || 'us-central1';

    if (!projectId) {
        throw new Error(
            '[Vertex AI] Missing GOOGLE_CLOUD_PROJECT environment variable. ' +
            'Set it in your .env file to your Google Cloud project ID.'
        );
    }

    console.log(`[Vertex AI] Config: Project=${projectId}, Location=${location}`);
    return { projectId, location };
}

// ── Model alias map ───────────────────────────────────────────────────────────

/**
 * Maps Syority model identifiers to real Vertex/Gemini model names.
 */
export function resolveVertexModel(modelIdentifier: string): string {
    const map: Record<string, string> = {
        // Workpack generation
        'vertex-workpack':  'gemini-1.5-pro-002',
        'vertex-pro':       'gemini-1.5-pro-002',

        // Mobile assistant & transcription
        'vertex-whatsapp':  'gemini-1.5-flash-002',
        'vertex-flash':     'gemini-1.5-flash-002',

        // Document vision
        'vertex-vision':    'gemini-1.5-flash-002',

        // Lessons learned
        'vertex-lessons':   'gemini-1.5-pro-002',
    };

    const trimmed = modelIdentifier.trim();
    let resolved = map[trimmed.toLowerCase()] ?? trimmed.replace(/^vertex-/, '');
    
    // Fix for Google Cloud Vertex AI SDK bug with model names containing dots
    // when using the publishers/google/models/ prefix. The SDK requires no prefix for these.
    if (resolved.startsWith('publishers/google/models/')) {
         resolved = resolved.replace('publishers/google/models/', '');
    }
    
    return resolved;
}

// ── VertexAI instance factory ─────────────────────────────────────────────────

/**
 * Creates a VertexAI instance using ADC ONLY.
 * Also sets the quota project so CONSUMER_INVALID errors are avoided when using
 * user ADC credentials (gcloud auth application-default login).
 */
function createVertexClient(projectId: string, location: string): VertexAI {
    // Set quota project via env so the google-auth-library picks it up automatically
    // This resolves CONSUMER_INVALID 403 errors when using user ADC credentials
    if (!process.env.GOOGLE_CLOUD_QUOTA_PROJECT) {
        process.env.GOOGLE_CLOUD_QUOTA_PROJECT = projectId;
    }
    // Intentionally no `googleAuthOptions` — the SDK picks up ADC automatically.
    return new VertexAI({ project: projectId, location });
}

// ── Main call ─────────────────────────────────────────────────────────────────

/**
 * Call Vertex AI (Gemini) with text and optional images.
 * Authentication is handled via ADC — no API key required or accepted.
 */
export async function callVertexAI(options: VertexAiCallOptions): Promise<string> {
    // Lazy ADC check — runs once on first call, not at module load
    await checkADC();

    const {
        model,
        prompt,
        systemPrompt,
        maxTokens = 4096,
        temperature = 0.1,
        responseAsJson = false,
    } = options;

    const { projectId, location } = getProjectConfig();
    const resolvedModel = resolveVertexModel(model);

    console.log(`[Vertex AI] Request → Model: ${resolvedModel} | Project: ${projectId} | Location: ${location}`);

    try {
        const vertexAI = createVertexClient(projectId, location);

        const generativeModel = vertexAI.getGenerativeModel({
            model: resolvedModel,
            generationConfig: {
                maxOutputTokens: maxTokens,
                temperature,
                ...(responseAsJson ? { responseMimeType: 'application/json' } : {}),
            },
            safetySettings: [
                { category: HarmCategory.HARM_CATEGORY_HARASSMENT,        threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
                { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,       threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
                { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
                { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
            ],
            ...(systemPrompt ? {
                systemInstruction: {
                    role: 'user',
                    parts: [{ text: systemPrompt }],
                },
            } : {}),
        });

        const request = {
            contents: [{
                role: 'user' as const,
                parts: [
                    { text: prompt },
                    // Multi-modal: include images if provided (for vision tasks)
                    ...(options.images ?? []).map((img) => ({
                        inlineData: {
                            mimeType: img.mimeType,
                            data: img.base64,
                        },
                    })),
                ],
            }],
        };

        const result = await generativeModel.generateContent(request);
        const response = result.response;
        const text = response.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

        if (!text) {
            console.error('[Vertex AI] Response was empty (safety filter or empty model output).');
            throw new Error(`Vertex AI returned empty response for model ${resolvedModel}`);
        }

        console.log(`[Vertex AI] ✅ Response received (${text.length} chars)`);
        return text;

    } catch (err: any) {
        console.error('[Vertex AI] ❌ Call failed:', err?.message ?? err);

        // Provide a clear, actionable error message for auth failures
        const msg: string = err?.message ?? 'Unknown error';
        if (msg.toLowerCase().includes('unable to authenticate') || msg.toLowerCase().includes('googleautherror')) {
            throw new Error(
                'Vertex AI authentication failed (GoogleAuthError). ' +
                'If running locally, run: gcloud auth application-default login\n' +
                'If running in production, ensure the service account has the "Vertex AI User" role.'
            );
        }

        throw new Error(`Vertex AI Call Failed: ${msg}`);
    }
}

// ── JSON array helper ─────────────────────────────────────────────────────────

/**
 * Call Vertex AI and parse the response as a JSON array.
 */
export async function callVertexAIForJsonArray(options: VertexAiCallOptions): Promise<unknown[]> {
    const text = await callVertexAI({ ...options, responseAsJson: true });

    try {
        const cleaned = text.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/, '').trim();
        const parsed = JSON.parse(cleaned);
        return Array.isArray(parsed) ? parsed : [parsed];
    } catch {
        throw new Error(`Vertex AI response could not be parsed as JSON. Raw: ${text.substring(0, 200)}`);
    }
}
