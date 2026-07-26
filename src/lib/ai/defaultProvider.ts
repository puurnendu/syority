/**
 * Default AI provider used when no per-organization settings exist.
 * API key from env: OPENAI_API_KEY.
 */

const DEFAULT_PROVIDER = 'openai';
const DEFAULT_MODEL = 'gpt-4o-mini';

export const DEFAULT_AI_PROVIDER = {
    provider: DEFAULT_PROVIDER,
    model: DEFAULT_MODEL,
    isActive: true,
};

function getDefaultApiKey(): string | null {
    const openai = process.env.OPENAI_API_KEY?.trim();
    if (openai) return openai;
    return null;
}

/**
 * Settings-shaped object for workpack generator and vision/lessons services.
 * Used when no AiProviderSetting row exists for the organization.
 */
export function getDefaultAiProviderSettings(): {
    provider: string;
    model: string | null;
    api_key_encrypted: string | null;
    api_endpoint: string | null;
    max_tokens: number;
    temperature: number;
    vision_provider?: string | null;
    vision_model?: string | null;
    vision_api_key_encrypted?: string | null;
    whatsapp_provider?: string | null;
    whatsapp_model?: string | null;
    whatsapp_api_key_encrypted?: string | null;
    whisper_api_key_encrypted?: string | null;
    lessons_provider?: string | null;
    lessons_model?: string | null;
} {
    const apiKey = getDefaultApiKey();
    return {
        provider: DEFAULT_PROVIDER,
        model: DEFAULT_MODEL,
        api_key_encrypted: apiKey,
        api_endpoint: null,
        max_tokens: 4096,
        temperature: 0.1,
        vision_provider: DEFAULT_PROVIDER,
        vision_model: 'gpt-4o-mini',
        vision_api_key_encrypted: apiKey,
        whatsapp_provider: 'openai',
        whatsapp_model: 'gpt-4o-mini',
        whatsapp_api_key_encrypted: apiKey,
        whisper_api_key_encrypted: apiKey,
        lessons_provider: null,
        lessons_model: null,
    };
}

/**
 * ProviderConfig for ProviderLoader (workpack_generation, document_vision, etc.).
 */
export function getDefaultProviderConfig(): {
    provider: string;
    model: string;
    apiKey: string;
    endpoint: string | null;
} {
    const apiKey = getDefaultApiKey();
    if (!apiKey) {
        throw new Error(
            'No API key configured. Set OPENAI_API_KEY in environment, or configure AI in Admin → AI Setup.'
        );
    }
    return {
        provider: DEFAULT_PROVIDER,
        model: DEFAULT_MODEL,
        apiKey,
        endpoint: null,
    };
}

export function getAiProvider(orgProvider: unknown) {
    return orgProvider ?? DEFAULT_AI_PROVIDER;
}
