import { loadProviderForJob, callTextAi } from '@/services/ai/ProviderLoader';

/**
 * Call configured AI provider (OpenAI, Gemini, or Vertex AI) to generate structured workpack JSON.
 */

export interface AiProviderConfig {
    provider: string;
    model: string | null;
    api_key_encrypted: string | null;
    api_endpoint?: string | null;
    max_tokens?: number | null;
    temperature?: number | null;
}

export async function generateWorkpackWithAi(
    config: AiProviderConfig,
    prompt: string
): Promise<string> {
    const provider = (config.provider || 'vertex').toLowerCase();
    const apiKey = config.api_key_encrypted || '';
    
    const result = await callTextAi(
        {
            provider,
            model: config.model || (provider === 'openai' ? 'gpt-4o' : 'gemini-1.5-flash'),
            apiKey,
            endpoint: config.api_endpoint || null,
        },
        prompt,
        config.max_tokens || 4096,
        config.temperature || 0.1
    );

    return result.content;
}


