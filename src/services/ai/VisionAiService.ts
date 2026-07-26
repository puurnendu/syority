/**
 * VisionAiService
 * Calls OpenAI or Vertex AI (Gemini) with text + image inputs.
 */

import { prisma } from '@/lib/prisma';
import { loadProviderForJob } from './ProviderLoader';
import { validateModel } from '@/lib/ai/validateAiConfig';
import { callVertexAI } from '@/lib/ai/vertexAiClient';
import { decrypt } from '@/lib/encryption';
import { generateSyorityAI, callSyorityAI } from '@/lib/ai/universalAiClient';
import { logAiRequest } from './AiLoggingService';

// ── Types ─────────────────────────────────────────

export type VisionImage = {
    base64: string;
    mimeType: string;
};

export type VisionRequest = {
    organization_id: string;
    prompt: string;
    images: VisionImage[];
    max_tokens?: number;
    temperature?: number;
};

export type VisionResponse = {
    content: string;
    input_tokens: number;
    output_tokens: number;
    model_used: string;
    provider_used: string;
};

// ── Errors ────────────────────────────────────────

export class VisionAiError extends Error {
    constructor(
        message: string,
        public readonly code?:
            | 'NO_PROVIDER'
            | 'NO_VISION_SUPPORT'
            | 'API_ERROR'
            | 'INVALID_JSON'
    ) {
        super(message);
        this.name = 'VisionAiError';
    }
}

// ── Vision model allowlist ────────────────────────

const OPENAI_VISION_MODELS = new Set([
    'gpt-4o',
    'gpt-4o-mini',
    'gpt-4-vision-preview',
    'gpt-4-turbo',
    'gpt-4-turbo-preview',
]);

function modelSupportsVision(model: string | null): boolean {
    if (!model) return true;
    const lower = model.toLowerCase();
    return ['gpt-4o', 'gpt-4-turbo', 'gpt-4-vision'].some((m) => lower.includes(m));
}

function isVisionCapable(provider: string, model: string | null): boolean {
    const p = provider.toLowerCase();
    if (p === 'openai') return OPENAI_VISION_MODELS.has((model ?? '').toLowerCase());
    if (p === 'gemini' || p === 'vertex') return true; 
    return false;
}

// ── OpenAI vision call ────────────────────────────

async function callOpenAiVision(
    apiKey: string,
    model: string,
    prompt: string,
    images: VisionImage[],
    maxTokens: number,
    temp: number,
    endpoint?: string | null
): Promise<{ content: string; inputT: number; outputT: number }> {
    const baseUrl = endpoint?.trim() || 'https://api.openai.com/v1';

    const content: unknown[] = [
        { type: 'text', text: prompt },
        ...images.map((img) => ({
            type: 'image_url',
            image_url: {
                url: `data:${img.mimeType};base64,${img.base64}`,
                detail: 'high',
            },
        })),
    ];

    const res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model,
            messages: [{ role: 'user', content }],
            max_tokens: maxTokens,
            temperature: temp,
        }),
    });

    if (!res.ok) {
        const err = await res.text();
        throw new VisionAiError(
            'AI extraction service is temporarily unavailable. Please try again.',
            'API_ERROR'
        );
    }

    const data = (await res.json()) as {
        choices: Array<{ message: { content: string } }>;
        usage?: {
            prompt_tokens: number;
            completion_tokens: number;
        };
    };

    return {
        content: data.choices[0]?.message?.content ?? '',
        inputT: data.usage?.prompt_tokens ?? 0,
        outputT: data.usage?.completion_tokens ?? 0,
    };
}

/**
 * NEW: Centralized Vision/Universal AI caller using DB configuration
 * Matches requested SaaS-ready signature: (context, input, orgId, workpackId)
 */
export async function callVisionAI({
    input,
    context,
    orgId,
    workpackId,
    images,
    systemPrompt: systemPromptOverride,
    userPrompt: userPromptOverride,
    maxTokens
}: {
    input?: string;
    context?: any;
    orgId: string;
    workpackId: string;
    images?: VisionImage[];
    systemPrompt?: string;
    userPrompt?: string;
    maxTokens?: number;
}): Promise<any> {
    // 1. Fetch config from DB
    const aiSetting = await prisma.aiProviderSetting.findUnique({
        where: { organization_id: orgId }
    });

    if (!aiSetting || !aiSetting.is_active) {
        throw new Error("AI configuration not found or is inactive. Please configure in settings.");
    }

    // 2. Map to the requested 'config' shape
    const config = {
        apiKey: aiSetting.api_key_encrypted ? decrypt(aiSetting.api_key_encrypted) : '',
        model: aiSetting.model ?? 'gpt-4o',
        provider: aiSetting.provider ?? 'openai'
    };

    if (!config.apiKey && config.provider !== 'vertex') {
        throw new Error("AI API Key is missing. Please configure in settings.");
    }

    // 3. Construct prompt with context
    const contextStr = context ? `CONTEXT:\n${JSON.stringify(context, null, 2)}\n\n` : '';
    const inputStr = input ? `INPUT DATA:\n${input}\n\n` : '';
    
    // Use override if provided, otherwise fallback to generic
    const fullPrompt = userPromptOverride 
        ? `${contextStr}${inputStr}${userPromptOverride}`
        : `${contextStr}${inputStr}Please analyze the input data using the provided context.`;
    
    const systemPrompt = systemPromptOverride ?? "You are a mechanical engineering analyst. Return only valid JSON. No markdown fences.";

    const content = images && images.length > 0 
        ? (await callVisionAi({
            organization_id: orgId,
            prompt: fullPrompt,
            images,
            max_tokens: maxTokens || 4000
        })).content
        : (await callSyorityAI({
            modelIdentifier: config.model,
            apiKey: config.apiKey,
            organizationId: orgId,
            provider: config.provider,
            maxTokens: maxTokens || 4000
        }, fullPrompt, systemPrompt)).content;

    return content;
}

export async function callVisionAi(
    req: VisionRequest
): Promise<VisionResponse> {
    const startedAt = Date.now();
    const { apiKey, model, provider, endpoint } = await loadProviderForJob(req.organization_id, 'document_vision');
    
    validateModel(model);

    const maxTokens = Math.min(
        Math.max(req.max_tokens ?? 4096, 512),
        16384
    );
    const temp = req.temperature ?? 0.1;

    let result: {
        content: string;
        inputT: number;
        outputT: number;
    };

    if (provider === 'openai') {
        result = await callOpenAiVision(
            apiKey,
            model,
            req.prompt,
            req.images,
            maxTokens,
            temp,
            endpoint
        );
    } else if (provider === 'vertex') {
        const content = await callVertexAI({
            model,
            prompt: req.prompt,
            images: req.images,
            maxTokens,
            temperature: temp,
        });
        result = { content, inputT: 0, outputT: 0 };
    } else if (provider === 'gemini') {
        // Gemini vision: images passed as inline_data parts
        const { GoogleGenerativeAI } = await import('@google/generative-ai');
        const genAI = new GoogleGenerativeAI(apiKey);
        const geminiModel = genAI.getGenerativeModel({ model });

        const imageParts = req.images.map((img) => ({
            inlineData: { data: img.base64, mimeType: img.mimeType },
        }));

        const geminiResult = await geminiModel.generateContent([
            req.prompt,
            ...imageParts,
        ]);
        result = {
            content: geminiResult.response.text(),
            inputT: geminiResult.response.usageMetadata?.promptTokenCount ?? 0,
            outputT: geminiResult.response.usageMetadata?.candidatesTokenCount ?? 0,
        };
    } else {
        throw new VisionAiError(
            `Unsupported AI configuration or provider "${provider}".`,
            'API_ERROR'
        );
    }

    const response = {
        content: result.content,
        input_tokens: result.inputT,
        output_tokens: result.outputT,
        model_used: model,
        provider_used: provider,
    };

    // Log the successful vision call
    logAiRequest({
        organization_id: req.organization_id,
        job_type: 'document_vision',
        provider,
        model,
        prompt: req.prompt,
        response: result.content,
        tokens_input: result.inputT,
        tokens_output: result.outputT,
        latency_ms: Date.now() - startedAt,
        status: 'success'
    });

    return response;
}

// ── JSON extraction helper ────────────────────────

/**
 * Robust JSON parser for AI responses.
 * Extracts the first JSON object or array using regex, strips markdown, 
 * and handles common LLM formatting inconsistencies.
 */
export function parseVisionJson<T = unknown>(text: string, options?: { expected?: 'object' | 'array' }): T {
    const { expected } = options ?? {};
    if (!text?.trim()) {
        throw new VisionAiError('AI returned empty response.', 'INVALID_JSON');
    }

    // 1. Pre-cleaning: Remove markdown fences and outer whitespace
    let cleaned = text.trim()
        .replace(/^```json\s*/i, '')
        .replace(/^```\w*\s*/, '')
        .replace(/\s*```$/g, '');

    // 2. Extraction: Find the substantive JSON block
    let target = cleaned;
    
    // IF the string looks complete (ends with } or ]), we use regex to extract the target block.
    // IF the string is missing the closing bracket (e.g. hits a token limit), the regex `[\s\S]*\}` 
    // will stop at the LAST `}` it finds, unintentionally truncating the REST of the string!
    if (cleaned.endsWith('}') || cleaned.endsWith(']')) {
        const pattern = expected === 'array' ? /\[[\s\S]*\]/ : (expected === 'object' ? /\{[\s\S]*\}/ : /[\{\[]\s*[\s\S]*[\}\]]/);
        const match = cleaned.match(pattern);
        if (match) target = match[0];
    } else {
        // Truncated string: Just find the first { or [ and use everything from there
        const firstBracket = expected === 'array' 
            ? cleaned.indexOf('[') 
            : (expected === 'object' 
                ? cleaned.indexOf('{') 
                : Math.min(
                    cleaned.indexOf('{') === -1 ? Infinity : cleaned.indexOf('{'), 
                    cleaned.indexOf('[') === -1 ? Infinity : cleaned.indexOf('[')
                  ));
                  
        if (firstBracket !== -1 && firstBracket !== Infinity) {
            target = cleaned.substring(firstBracket);
        }
    }

    const flexibleParse = (str: string) => {
        try {
            return JSON.parse(str);
        } catch (e1) {
            // A. Try removing trailing commas
            try {
                const noTrailing = str.replace(/,\s*([\]}])/g, '$1');
                return JSON.parse(noTrailing);
            } catch (e2) { }

            // B. TRUNCATION RECOVERY: Try closing a cut-off JSON structure
            // Useful when the AI hits a token limit mid-list or mid-object
            try {
                const parseWithCleanup = (s: string) => {
                    let recovered = s.trim();
                    // Remove trailing comma if present
                    recovered = recovered.replace(/,\s*$/g, '');
                    
                    // Close missing braces/brackets
                    const openBrackets = (recovered.match(/\[/g) || []).length;
                    const closeBrackets = (recovered.match(/\]/g) || []).length;
                    const openBraces = (recovered.match(/\{/g) || []).length;
                    const closeBraces = (recovered.match(/\}/g) || []).length;

                    for (let i = 0; i < openBraces - closeBraces; i++) recovered += '}';
                    for (let i = 0; i < openBrackets - closeBrackets; i++) recovered += ']';
                    
                    return JSON.parse(recovered);
                };

                try {
                    return parseWithCleanup(str);
                } catch (e2) {
                    // Try dropping the last incomplete property fragment (e.g., `"tubeSideTestPressure": 3.`)
                    const lastComma = str.lastIndexOf(',');
                    if (lastComma > 0) {
                        return parseWithCleanup(str.substring(0, lastComma));
                    }
                    throw e2;
                }
            } catch (e3) { }

            // C. JS Evaluation fallback (final attempt for minor syntax errors)
            try {
                const sanitized = str.replace(/\n/g, '\\n').replace(/\r/g, '\\r');
                const evaluator = new Function('return ' + sanitized);
                const result = evaluator();
                if (result && typeof result === 'object') return result;
            } catch (e4) { }

            return null;
        }
    };

    const result = flexibleParse(target);
    
    if (result) {
        if (!expected) return result as T;
        const isArray = Array.isArray(result);
        if (expected === 'object' && !isArray && typeof result === 'object' && result !== null) return result as T;
        if (expected === 'array' && isArray) return result as T;
    }

    // Reporting failure with snippet
    const snippet = text.length > 150 ? text.slice(0, 150) + '...' : text;
    throw new VisionAiError(
        `AI response could not be parsed as ${expected ?? 'JSON'}. Please try again. Raw snippet: "${snippet}"`,
        'INVALID_JSON'
    );
}

/** Legacy support for array parsing with property unwrapping */
export function parseVisionJsonArray<T = unknown>(text: string): T[] {
    try {
        const parsed = parseVisionJson(text) as any;
        if (Array.isArray(parsed)) return parsed;
        if (parsed && typeof parsed === 'object') {
            const keys = ['tools', 'items', 'data', 'materials', 'constraints', 'results', 'lessons'];
            for (const key of keys) {
                if (Array.isArray(parsed[key])) return parsed[key];
            }
            return [parsed as T];
        }
        return [];
    } catch {
        return [];
    }
}
