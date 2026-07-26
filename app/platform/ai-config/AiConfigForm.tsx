'use client';

import { useState, useEffect, FormEvent } from 'react';
import { useRouter } from 'next/navigation';

const PROVIDERS = [
    { value: 'vertex',    label: 'Vertex AI  —  Google Cloud (Enterprise, no API key needed)' },
    { value: 'openai',    label: 'OpenAI  —  GPT-5.4 / GPT-5.4-mini' },
    { value: 'gemini',    label: 'Gemini  —  API Key based' },
];

const inputCls  = 'w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none';
const labelCls  = 'block text-xs font-semibold text-gray-600 mb-1.5';
const cardCls   = 'bg-white border border-gray-200 rounded-xl p-6 space-y-5';
const hintBlueCls  = 'p-3 rounded-lg text-xs bg-blue-50 text-blue-700 border border-blue-200';
const hintAmberCls = 'p-3 rounded-lg text-xs bg-amber-50 text-amber-700 border border-amber-200';

function ProviderSection({
    title,
    subtitle,
    prefix,
    existing,
    isVertex,
    onProviderChange,
}: {
    title: string;
    subtitle: string;
    prefix: 'main' | 'fallback';
    existing: any;
    isVertex: boolean;
    onProviderChange: (v: string) => void;
}) {
    const fProvider = prefix === 'main' ? 'provider' : 'fallback_provider';
    const fModel    = prefix === 'main' ? 'model'    : 'fallback_model';
    const fApiKey   = prefix === 'main' ? 'api_key'  : 'fallback_api_key';

    const defaultProvider = prefix === 'main'
        ? (existing?.provider          ?? 'vertex')
        : (existing?.fallback_provider ?? '');
    const defaultModel = prefix === 'main'
        ? (existing?.model          ?? '')
        : (existing?.fallback_model ?? '');
    const hasKey = prefix === 'main'
        ? !!existing?.api_key_encrypted
        : !!existing?.fallback_api_key_encrypted;

    return (
        <div className={cardCls}>
            <div>
                <h2 className="text-base font-semibold text-gray-900">{title}</h2>
                <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                    <label className={labelCls}>Provider</label>
                    <select
                        name={fProvider}
                        defaultValue={defaultProvider}
                        onChange={e => onProviderChange(e.target.value)}
                        className={inputCls}
                    >
                        {prefix === 'fallback' && <option value="">— None (disabled) —</option>}
                        {PROVIDERS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                    </select>
                </div>
                <div>
                    <label className={labelCls}>Model Identifier</label>
                    <input
                        name={fModel}
                        defaultValue={defaultModel}
                        placeholder="e.g. gemini-1.5-flash, gpt-5.4-mini"
                        className={inputCls}
                    />
                    <p className="text-xs text-gray-400 mt-1">
                        Vertex aliases: <code className="bg-gray-100 px-1 rounded">gemini-1.5-flash-002</code>&nbsp;
                        <code className="bg-gray-100 px-1 rounded">gemini-1.5-pro-002</code>
                    </p>
                </div>
            </div>

            {prefix === 'main' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-2">
                    <div>
                        <label className={labelCls}>Max Output Tokens / Request</label>
                        <input
                            name="max_tokens"
                            type="number"
                            defaultValue={existing?.max_tokens ?? 8192}
                            placeholder="e.g. 8192"
                            className={inputCls}
                        />
                        <p className="text-xs text-gray-400 mt-1">
                            Higher allows longer outputs (vital for big JSON extraction).
                        </p>
                    </div>
                </div>
            )}

            {isVertex ? (
                <div className={hintBlueCls}>
                    🔐 <strong>Vertex AI uses Google Cloud identity (ADC)</strong> — no API key required here.
                    Locally: run <code className="bg-blue-100 px-1 rounded">gcloud auth application-default login</code>.
                    In production (Antigravity): the attached service account is used automatically.
                </div>
            ) : (
                <div>
                    <label className={labelCls}>API Key</label>
                    <input
                        name={fApiKey}
                        type="password"
                        defaultValue={hasKey ? '••••••••' : ''}
                        placeholder="Enter your API key"
                        className={inputCls}
                    />
                    <p className="text-xs text-gray-400 mt-1">Stored encrypted. Leave unchanged if not updating.</p>
                </div>
            )}
        </div>
    );
}

export function AiConfigForm({ existing, orgId }: { existing: any; orgId: string }) {
    const router  = useRouter();
    const [saving, setSaving]   = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const [mainProvider,     setMainProvider]     = useState(existing?.provider          ?? 'vertex');
    const [fallbackProvider, setFallbackProvider] = useState(existing?.fallback_provider ?? '');

    const isMainVertex     = mainProvider     === 'vertex';
    const isFallbackVertex = fallbackProvider === 'vertex';

    const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setSaving(true);
        setMessage(null);
        const form = new FormData(e.currentTarget);

        const provider         = form.get('provider')         as string;
        const model            = form.get('model')            as string;
        const api_key          = form.get('api_key')          as string;
        const max_tokens       = parseInt(form.get('max_tokens') as string, 10);
        const fallback_provider = form.get('fallback_provider') as string;
        const fallback_model   = form.get('fallback_model')   as string;
        const fallback_api_key = form.get('fallback_api_key') as string;

        const body = {
            // ── Main (used by ALL features) ──────────────────────────────
            provider,
            model,
            api_key: provider === 'vertex' ? '' : api_key,
            api_endpoint: null,
            api_version:  null,
            max_tokens:   isNaN(max_tokens) ? 8192 : max_tokens,
            temperature:  0.1,
            is_active:    true,

            // ── Fallback ─────────────────────────────────────────────────
            fallback_provider: fallback_provider  || null,
            fallback_model:    fallback_model      || null,
            fallback_api_key:  fallback_provider === 'vertex' ? '' : (fallback_api_key || null),

            // ── Mirror main to all per-feature fields ────────────────────
            // (so legacy code paths still work if they read individual fields)
            vision_provider:   provider,
            vision_model:      model,
            vision_api_key:    provider === 'vertex' ? '' : api_key,

            whatsapp_provider: provider,
            whatsapp_model:    model,
            whatsapp_api_key:  provider === 'vertex' ? '' : api_key,

            lessons_provider:  provider,
            lessons_model:     model,

            // ── Whisper separate key (OpenAI audio only) ─────────────────
            whisper_api_key: form.get('whisper_api_key') as string || null,
            whisper_model:   form.get('whisper_model') as string || null,

            extraction_prompt: form.get('extraction_prompt') || null,
        };

        try {
            const res = await fetch('/api/ai-config', {
                method: existing ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || 'Save failed');
            }
            setMessage({ type: 'success', text: 'AI configuration saved successfully!' });
            router.refresh();
        } catch (err: any) {
            setMessage({ type: 'error', text: err.message });
        } finally {
            setSaving(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            {message && (
                <div className={`p-3 rounded-lg text-sm ${message.type === 'success'
                    ? 'bg-green-50 text-green-700 border border-green-200'
                    : 'bg-red-50 text-red-700 border border-red-200'}`}>
                    {message.text}
                </div>
            )}

            {/* Main Provider */}
            <ProviderSection
                title="Main AI Provider"
                subtitle="Used by all features: workpack generation, document analysis, lessons, mobile assistant."
                prefix="main"
                existing={existing}
                isVertex={isMainVertex}
                onProviderChange={setMainProvider}
            />

            {/* Fallback Provider */}
            <ProviderSection
                title="Fallback Provider (optional)"
                subtitle="Automatically used if the main provider fails or is unavailable."
                prefix="fallback"
                existing={existing}
                isVertex={isFallbackVertex}
                onProviderChange={setFallbackProvider}
            />

            {/* Whisper — Audio only */}
            <div className={cardCls}>
                <div>
                    <h2 className="text-base font-semibold text-gray-900">Voice-to-Text Transcription</h2>
                    <p className="text-xs text-gray-500 mt-0.5">Audio transcription for field notes (OpenAI Whisper only).</p>
                </div>
                <div className={hintAmberCls}>
                    ⚠️ Audio transcription requires an <strong>OpenAI API key</strong> — Whisper is not available on Vertex AI or Google Gemini.
                    Leave blank if you do not use voice features.
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className={labelCls}>Transcription Model</label>
                        <input
                            name="whisper_model"
                            defaultValue={existing?.whisper_model ?? 'whisper-1'}
                            placeholder="e.g. whisper-1"
                            className={inputCls}
                        />
                    </div>
                    <div>
                        <label className={labelCls}>OpenAI API Key (Whisper)</label>
                        <input
                            name="whisper_api_key"
                            type="password"
                            defaultValue={existing?.whisper_api_key_encrypted ? '••••••••' : ''}
                            placeholder="sk-... (leave blank if not using voice)"
                            className={inputCls}
                        />
                    </div>
                </div>
            </div>

            {/* Custom Extraction Logic */}
            <div className={cardCls}>
                <div>
                    <h2 className="text-base font-semibold text-gray-900">Custom Extraction Logic</h2>
                    <p className="text-xs text-gray-500 mt-0.5">Override instructions for document processing. Leave blank to use default.</p>
                </div>
                <textarea
                    name="extraction_prompt"
                    rows={5}
                    defaultValue={existing?.extraction_prompt ?? ''}
                    placeholder="Custom processing instructions..."
                    autoComplete="off"
                    spellCheck={false}
                    className={inputCls + ' font-mono text-xs'}
                />
            </div>

            {/* Submit */}
            <div className="flex items-center justify-end gap-3">
                <button
                    type="submit"
                    disabled={saving}
                    className="px-6 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm"
                >
                    {saving ? 'Saving…' : (existing ? 'Save Configuration' : 'Create Configuration')}
                </button>
            </div>
        </form>
    );
}
