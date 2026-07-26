import { callTextAi } from '@/services/ai/ProviderLoader';
import { parseVisionJsonArray } from '@/services/ai/VisionAiService';
import { validateAnyModel } from './validateAiConfig';
import { callVertexAIForJsonArray } from './vertexAiClient';

export interface SyorityAiConfig {
    modelIdentifier: string;
    apiKey: string;
    organizationId?: string;
    provider?: string;
    maxTokens?: number;
    temperature?: number;
}

/**
 * Universal AI Client that routes traffic to Gemini, OpenAI, or Vertex AI
 * based on the active provider configuration.
 * 
 * Model Identifier Routing:
 *   gemini-*    → Google Generative AI (API key)
 *   gpt-*       → OpenAI (API key)
 *   vertex-*    → Google Vertex AI (service account / ADC)
 */
/**
 * Unified text AI caller with routing.
 * Returns the raw content string and token usage.
 */
export async function callSyorityAI(
    config: SyorityAiConfig,
    prompt: string,
    systemPrompt?: string
): Promise<{ content: string; tokens_input?: number; tokens_output?: number }> {
    validateAnyModel(config.modelIdentifier);

    const modelId = config.modelIdentifier.toLowerCase();
    const effectiveProvider = config.provider?.toLowerCase() || 
        (modelId.startsWith('vertex-') ? 'vertex' : 
        (modelId.includes('gemini') ? 'gemini' : 'openai'));

    const fullPrompt = systemPrompt ? `${systemPrompt}\n\n${prompt}` : prompt;

    // ROUTE: Google Vertex AI
    if (effectiveProvider === 'vertex' || modelId.startsWith('vertex-')) {
        const { callVertexAI } = await import('./vertexAiClient');
        const { logAiRequest } = await import('@/services/ai/AiLoggingService');
        const startedAt = Date.now();
        
        try {
            const rawContent = await callVertexAI({
                model: config.modelIdentifier,
                prompt,
                systemPrompt,
                maxTokens: config.maxTokens,
                temperature: config.temperature,
                responseAsJson: true,
            });
            
            if (config.organizationId) {
                await logAiRequest({
                    organization_id: config.organizationId,
                    job_type: 'document_parameter_extraction', // default for universal text
                    provider: 'vertex',
                    model: config.modelIdentifier,
                    prompt: fullPrompt,
                    response: rawContent,
                    latency_ms: Date.now() - startedAt,
                    status: 'success'
                });
            }
            return { content: rawContent };
        } catch (error: any) {
            if (config.organizationId) {
                await logAiRequest({
                    organization_id: config.organizationId,
                    job_type: 'document_parameter_extraction',
                    provider: 'vertex',
                    model: config.modelIdentifier,
                    prompt: fullPrompt,
                    latency_ms: Date.now() - startedAt,
                    status: 'failed',
                    error_message: error.message
                });
            }
            throw error;
        }
    }

    // ROUTE: AI Studio (Gemini) or OpenAI
    const provider = effectiveProvider === 'gemini' || effectiveProvider === 'openai' 
        ? effectiveProvider 
        : (modelId.includes('gemini') ? 'gemini' : 'openai');
    
    const result = await callTextAi(
        {
            provider,
            model: config.modelIdentifier,
            apiKey: config.apiKey,
            endpoint: null
        },
        fullPrompt,
        config.maxTokens || 4096,
        config.temperature || 0.1,
        {
            organizationId: config.organizationId,
            jobType: 'text_completion'
        }
    );

    return result;
}

/**
 * Universal AI Client that routes traffic to Gemini, OpenAI, or Vertex AI
 * and returns a parsed JSON array of results.
 */
export async function generateSyorityAI(
    config: SyorityAiConfig,
    prompt: string,
    systemPrompt?: string
): Promise<unknown[]> {
    try {
        const result = await callSyorityAI(config, prompt, systemPrompt);
        return parseVisionJsonArray(result.content);
    } catch (error: unknown) {
        console.error('SYORITY AI ERROR:', error);
        const msg = error instanceof Error ? error.message : String(error);
        throw new Error(`AI extraction service temporarily unavailable. Details: ${msg}`);
    }
}
