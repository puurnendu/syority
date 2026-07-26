/**
 * ProviderLoader
 *
 * Single source of truth for AI provider selection.
 *
 * Architecture: ONE main provider config used for ALL job types.
 * A fallback provider is automatically tried if the main call fails.
 *
 * Auth:
 *   - Vertex AI                  GCP Project ID / Location
 *   - OpenAI / Gemini               encrypted API key from database
 */

import { prisma } from '@/lib/prisma';
import { decrypt } from '@/lib/encryption';
import { logAiRequest } from './AiLoggingService';

// ── Types ─────────────────────────────────────────────────────────────────────

export type JobType =
  | 'workpack_generation'
  | 'document_vision'
  | 'whatsapp_extraction'
  | 'whatsapp_report'
  | 'lessons_suggestion'
  | 'whisper_transcription';

export type ProviderConfig = {
  provider: string;   // vertex | openai | gemini
  model: string;
  apiKey: string;     // empty string is valid for Vertex AI (uses ADC)
  endpoint: string | null;
};

export class ProviderLoaderError extends Error {
  constructor(
    message: string,
    public readonly code?: 'NO_PROVIDER' | 'NO_API_KEY' | 'NO_VISION_KEY'
  ) {
    super(message);
    this.name = 'ProviderLoaderError';
  }
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function decryptKey(encrypted: string | null | undefined): string {
  if (!encrypted?.trim()) return '';
  if (!encrypted.includes(':')) return encrypted;
  try {
    return decrypt(encrypted) ?? '';
  } catch {
    return '';
  }
}

/** Resolve API key — Vertex AI never needs one */
function resolveApiKey(provider: string, encrypted: string | null | undefined): string {
  if (provider === 'vertex') return '';
  const key = decryptKey(encrypted);
  if (!key && provider !== 'vertex') {
    throw new ProviderLoaderError(
      `No API key configured for provider "${provider}". Set it in Admin → AI Configuration.`,
      'NO_API_KEY'
    );
  }
  return key;
}

/** Build a ProviderConfig from a raw settings row (main fields) */
function buildConfig(provider: string, model: string, apiKey: string, endpoint: string | null): ProviderConfig {
  return { provider, model, apiKey, endpoint };
}

// ── Whisper special case ──────────────────────────────────────────────────────

/** Whisper transcription always requires OpenAI — separate from main provider */
export async function loadWhisperConfig(orgId: string): Promise<ProviderConfig> {
  const s = await prisma.aiProviderSetting.findFirst({
    where: { organization_id: orgId, is_active: true },
  });
  const key = decryptKey(s?.whisper_api_key_encrypted ?? s?.whatsapp_api_key_encrypted ?? s?.api_key_encrypted);
  if (!key) {
    throw new ProviderLoaderError(
      'No OpenAI API key for Whisper transcription. Add one under Admin → AI Configuration → Voice-to-Text.',
      'NO_API_KEY'
    );
  }
  return { provider: 'openai', model: s?.whisper_model || 'whisper-1', apiKey: key, endpoint: null };
}

// ── Main loader ───────────────────────────────────────────────────────────────

/**
 * Load the active provider configuration for any job type.
 * All jobs (workpack, vision, lessons, whatsapp) use the SAME main provider.
 * Whisper transcription is the only exception — it always uses OpenAI.
 */
export async function loadProviderForJob(
  organizationId: string,
  jobType: JobType
): Promise<ProviderConfig> {

  // Whisper is always OpenAI — independent of the main config
  if (jobType === 'whisper_transcription') {
    return loadWhisperConfig(organizationId);
  }

  const s = await prisma.aiProviderSetting.findFirst({
    where: { organization_id: organizationId, is_active: true },
  });

  if (!s) {
    throw new ProviderLoaderError(
      'No AI provider configured. Go to Admin → AI Configuration to set up your provider.',
      'NO_PROVIDER'
    );
  }

  const provider = (s.provider ?? 'vertex') as string;
  const model    = (s.model    ?? 'gemini-1.5-flash-002') as string;
  const apiKey   = resolveApiKey(provider, s.api_key_encrypted);
  const endpoint = s.api_endpoint ?? null;

  return buildConfig(provider, model, apiKey, endpoint);
}

// ── Fallback loader ───────────────────────────────────────────────────────────

/** Load the fallback provider config (if configured). Returns null if none. */
export async function loadFallbackConfig(organizationId: string): Promise<ProviderConfig | null> {
  const s = await prisma.aiProviderSetting.findFirst({
    where: { organization_id: organizationId, is_active: true },
  });

  if (!s?.fallback_provider) return null;

  const provider = s.fallback_provider as string;
  const model    = (s.fallback_model ?? '') as string;
  if (!model) return null;

  try {
    const apiKey = resolveApiKey(provider, s.fallback_api_key_encrypted ?? null);
    return buildConfig(provider, model, apiKey, null);
  } catch {
    return null; // Fallback not usable if key missing
  }
}

// ── callWithFallback ──────────────────────────────────────────────────────────

/**
 * Run an AI call with automatic fallback.
 *
 * Usage:
 *   const result = await callWithFallback(orgId, (config) => callTextAi(config, prompt));
 *
 * 1. Loads the main provider config → runs the call
 * 2. If call fails → loads fallback config → retries
 * 3. If both fail → throws combined error
 */
export async function callWithFallback<T>(
  organizationId: string,
  jobType: JobType,
  callFn: (config: ProviderConfig) => Promise<T>
): Promise<T> {
  let mainConfig: ProviderConfig;
  try {
    mainConfig = await loadProviderForJob(organizationId, jobType);
  } catch (err: any) {
    throw err; // Config missing — no point trying fallback
  }

  try {
    return await callFn(mainConfig);
  } catch (mainErr: any) {
    console.warn(`[ProviderLoader] Main provider (${mainConfig.provider}) failed: ${mainErr.message}. Trying fallback...`);

    const fallback = await loadFallbackConfig(organizationId);
    if (!fallback) {
      throw new Error(`AI call failed: ${mainErr.message} (No fallback configured)`);
    }

    try {
      console.log(`[ProviderLoader] Using fallback: ${fallback.provider}/${fallback.model}`);
      return await callFn(fallback);
    } catch (fallbackErr: any) {
      throw new Error(
        `AI call failed on both providers.\n` +
        `Main (${mainConfig.provider}): ${mainErr.message}\n` +
        `Fallback (${fallback.provider}): ${fallbackErr.message}`
      );
    }
  }
}

// ── callTextAi ────────────────────────────────────────────────────────────────

/**
 * Make a plain text AI call using the given provider config.
 * Supports: vertex | openai | gemini
 */
export async function callTextAi(
  config: ProviderConfig,
  prompt: string,
  maxTokens = 4096,
  temperature = 0.1,
  metadata?: { organizationId?: string; userId?: string; jobType?: string }
): Promise<{ content: string; tokens_input?: number; tokens_output?: number; latency_ms?: number }> {
  const startedAt = Date.now();
  const orgId = metadata?.organizationId;
  const jobType = metadata?.jobType ?? 'generic_text';

  if (config.provider === 'vertex') {
    const { callVertexAI } = await import('@/lib/ai/vertexAiClient');
    try {
        const content = await callVertexAI({ model: config.model, prompt, maxTokens, temperature });
        const latency_ms = Date.now() - startedAt;

        if (orgId) {
          logAiRequest({
            organization_id: orgId,
            user_id: metadata?.userId,
            job_type: jobType,
            provider: 'vertex',
            model: config.model,
            prompt,
            response: content,
            latency_ms,
            status: 'success'
          });
        }

        return { content, latency_ms };
    } catch (err: any) {
        if (orgId) {
          logAiRequest({
            organization_id: orgId,
            user_id: metadata?.userId,
            job_type: jobType,
            provider: 'vertex',
            model: config.model,
            prompt,
            latency_ms: Date.now() - startedAt,
            status: 'failed',
            error_message: err.message
          });
        }
        throw err;
    }
  }

  if (config.provider === 'openai') {
    const baseUrl = config.endpoint?.trim() || 'https://api.openai.com/v1';
    const endpoint = baseUrl.endsWith('/') ? `${baseUrl}chat/completions` : `${baseUrl}/chat/completions`;
    
    let lastError: Error | null = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout for AI
        
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.apiKey}`,
          },
          body: JSON.stringify({
            model: config.model,
            messages: [{ role: 'user', content: prompt }],
            max_tokens: maxTokens,
            temperature,
          }),
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);
        
        if (!res.ok) {
           const errText = await res.text();
           throw new Error(`OpenAI HTTP ${res.status}: ${errText}`);
        }
        
        const data = await res.json();
        
        const content = data?.choices?.[0]?.message?.content ?? '';
        if (!content && attempt < 3) {
            throw new Error('Empty or malformed response structure from OpenAI');
        }
        
        const tokens_input = data?.usage?.prompt_tokens ?? 0;
        const tokens_output = data?.usage?.completion_tokens ?? 0;
        const latency_ms = Date.now() - startedAt;

        if (orgId) {
          logAiRequest({
            organization_id: orgId,
            user_id: metadata?.userId,
            job_type: jobType,
            provider: 'openai',
            model: config.model,
            prompt,
            response: content,
            tokens_input,
            tokens_output,
            latency_ms,
            status: 'success'
          });
        }
        
        return { 
          content,
          tokens_input,
          tokens_output,
          latency_ms
        };
      } catch (err: any) {
        lastError = err;
        console.warn(`[OpenAI] Attempt ${attempt} failed: ${err.message}`);
        if (attempt < 3) await new Promise(r => setTimeout(r, 1000 * attempt));
      }
    }

    if (orgId) {
      logAiRequest({
        organization_id: orgId,
        user_id: metadata?.userId,
        job_type: jobType,
        provider: 'openai',
        model: config.model,
        prompt,
        latency_ms: Date.now() - startedAt,
        status: 'failed',
        error_message: lastError?.message
      });
    }

    throw new ProviderLoaderError(`OpenAI failed after 3 attempts. Last err: ${lastError?.message}`, 'API_ERROR');
  }

  if (config.provider === 'gemini') {
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    try {
        const genAI = new GoogleGenerativeAI(config.apiKey);
        const model = genAI.getGenerativeModel({ model: config.model });
        const result = await model.generateContent(prompt);
        const content = result.response.text();
        const latency_ms = Date.now() - startedAt;

        const tokens_input = result.response.usageMetadata?.promptTokenCount ?? 0;
        const tokens_output = result.response.usageMetadata?.candidatesTokenCount ?? 0;

        if (orgId) {
          logAiRequest({
            organization_id: orgId,
            user_id: metadata?.userId,
            job_type: jobType,
            provider: 'gemini',
            model: config.model,
            prompt,
            response: content,
            tokens_input,
            tokens_output,
            latency_ms,
            status: 'success'
          });
        }

        return { content, tokens_input, tokens_output, latency_ms };
    } catch (err: any) {
        if (orgId) {
          logAiRequest({
            organization_id: orgId,
            user_id: metadata?.userId,
            job_type: jobType,
            provider: 'gemini',
            model: config.model,
            prompt,
            latency_ms: Date.now() - startedAt,
            status: 'failed',
            error_message: err.message
          });
        }
        throw err;
    }
  }

}

