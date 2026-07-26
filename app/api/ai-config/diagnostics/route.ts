import { NextResponse } from 'next/server';
import { withTenantGuard } from '@/lib/withTenantGuard';
import { loadProviderForJob, callTextAi, loadWhisperConfig, loadFallbackConfig } from '@/services/ai/ProviderLoader';
import { callVisionAi, VisionImage } from '@/services/ai/VisionAiService';
import { writeAiLog } from '@/services/ai/AiPromptService';

// A 1x1 transparent PNG pixel in base64
const TINY_PIXEL_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';

export const POST = withTenantGuard(async (req, { params }, session) => {
    const orgId  = session.user.organization_id;
    const userId = session.user.id;

    const results: Record<string, any> = {};

    // 1. Basic Connectivity (Text)
    try {
        const config     = await loadProviderForJob(orgId, 'workpack_generation');
        const startedAt  = Date.now();
        const response   = await callTextAi(config, "Respond with only the word 'READY'.", 512, 0.1);
        results.text = {
            status:     'success',
            response:   response.content.trim(),
            latency_ms: Date.now() - startedAt,
            model:      config.model,
            provider:   config.provider,
        };
    } catch (err: any) {
        results.text = { status: 'failed', error: err.message || String(err) };
    }

    // 2. Structured JSON Output
    try {
        const config    = await loadProviderForJob(orgId, 'workpack_generation');
        const startedAt = Date.now();
        const prompt    = "Generate a JSON object with a single key 'status' and value 'connected'. Respond only with valid JSON.";
        const response  = await callTextAi(config, prompt, 512, 0.1);

        const cleaned = response.content.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/, '').trim();
        const parsed  = JSON.parse(cleaned);

        results.json = {
            status:     'success',
            response:   parsed,
            latency_ms: Date.now() - startedAt,
            model:      config.model,
            provider:   config.provider,
        };
    } catch (err: any) {
        results.json = { status: 'failed', error: err.message || String(err) };
    }

    // 3. Document Vision
    try {
        const startedAt = Date.now();
        const image: VisionImage = { base64: TINY_PIXEL_BASE64, mimeType: 'image/png' };

        const visionResponse = await callVisionAi({
            organization_id: orgId,
            prompt:          "What color is this 1x1 pixel? Respond with 'transparent' or 'unknown'.",
            images:          [image],
            max_tokens:      50,
            temperature:     0.1,
        });

        results.vision = {
            status:     'success',
            response:   visionResponse.content.trim(),
            latency_ms: Date.now() - startedAt,
            model:      visionResponse.model_used,
            provider:   visionResponse.provider_used,
        };
    } catch (err: any) {
        results.vision = {
            status: 'failed',
            error:  err.message || String(err),
        };
    }

    // 4. Fallback Provider
    try {
        const fallbackConfig = await loadFallbackConfig(orgId);
        if (fallbackConfig) {
            const startedAt = Date.now();
            const response  = await callTextAi(fallbackConfig, "Respond with only the word 'READY'.", 100, 0.1);
            results.fallback = {
                status:     'success',
                response:   response.content.trim(),
                latency_ms: Date.now() - startedAt,
                model:      fallbackConfig.model,
                provider:   fallbackConfig.provider,
            };
        } else {
            results.fallback = {
                status: 'success',
                response: 'Unconfigured',
                hint: 'No fallback provider configured',
            };
        }
    } catch (err: any) {
        results.fallback = { status: 'failed', error: err.message || String(err) };
    }

    // 5. Whisper Audio Test
    try {
        const whisperConfig = await loadWhisperConfig(orgId);
        const startedAt = Date.now();
        
        // 44-byte silent WAV file header for payload minimal ping
        const dummyWav = Buffer.from('UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=', 'base64');
        const formData = new FormData();
        formData.append('file', new Blob([dummyWav], { type: 'audio/wav' }), 'ping.wav');
        formData.append('model', whisperConfig.model);

        const whisperRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${whisperConfig.apiKey}` },
            body: formData,
        });

        if (!whisperRes.ok) {
            const errText = await whisperRes.text();
            
            // If the proxy rejected it ONLY because our dummy ping is 0.0 seconds long, 
            // that PROVES the API Key is valid and the endpoint is actively authenticating.
            if (whisperRes.status === 400 && errText.includes('audio duration')) {
                results.whisper = {
                    status:     'success',
                    response:   "(Ping Validated) Voice Ready.",
                    latency_ms: Date.now() - startedAt,
                    model:      whisperConfig.model,
                    provider:   whisperConfig.provider,
                };
            } else {
                throw new Error(`Proxy Audio HTTP ${whisperRes.status}: ${errText}`);
            }
        } else {
            const audioData = await whisperRes.json();
            results.whisper = {
                status:     'success',
                response:   "Ping Success. Voice Ready.",
                latency_ms: Date.now() - startedAt,
                model:      whisperConfig.model,
                provider:   whisperConfig.provider,
            };
        }
    } catch (err: any) {
        results.whisper = { status: 'failed', error: err.message || String(err) };
    }


    // 6. Vertex AI Environment Info (only shown when provider is vertex)
    const anyVertex = results.text?.provider === 'vertex'
        || results.json?.provider === 'vertex'
        || results.vision?.provider === 'vertex';
    if (anyVertex) {
        results.vertex_env = {
            google_cloud_project:  process.env.GOOGLE_CLOUD_PROJECT  || 'MISSING',
            google_cloud_location: process.env.GOOGLE_CLOUD_LOCATION || 'us-central1 (default)',
            auth_mode:             'Application Default Credentials (ADC)',
            env_loaded:            !!process.env.GOOGLE_CLOUD_PROJECT,
        };
    }

    // Log diagnostic run
    await writeAiLog({
        organization_id: orgId,
        user_id:         userId,
        job_type:        'diagnostics',
        status:          Object.values(results).every(r => r.status !== 'failed') ? 'success' : 'failed',
        response:        JSON.stringify(results),
    });

    return NextResponse.json({ data: results });
});
