'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';

const PROVIDERS = [
    { value: 'vertex', label: 'Vertex AI (Google Cloud)' },
    { value: 'openai', label: 'OpenAI' },
    { value: 'gemini', label: 'Google Gemini (API Key)' },
];

const inputCls = "w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none";
const labelCls = "block text-xs font-semibold text-gray-600 mb-1.5";

export function AiConfigForm({ existing, orgId }: { existing: any; orgId: string }) {
    const router = useRouter();
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setSaving(true);
        setMessage(null);
        const form = new FormData(e.currentTarget);

        const body = {
            provider: form.get('provider'),
            model: form.get('model'),
            api_key: form.get('api_key'),
            api_endpoint: form.get('api_endpoint') || null,
            api_version: form.get('api_version') || null,
            max_tokens: Number(form.get('max_tokens')) || 4096,
            temperature: Number(form.get('temperature')) || 0.1,
            is_active: form.get('is_active') === 'on',
            fallback_provider: form.get('fallback_provider') || null,
            fallback_api_key: form.get('fallback_api_key') || null,
            fallback_model: form.get('fallback_model') || null,
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
                <div className={`p-3 rounded-lg text-sm ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                    {message.text}
                </div>
            )}

            {/* Primary Provider */}
            <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-5">
                <h2 className="text-base font-semibold text-gray-900">Primary AI Provider</h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                        <label className={labelCls}>Provider</label>
                        <select name="provider" defaultValue={existing?.provider ?? 'vertex'} className={inputCls}>
                            {PROVIDERS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className={labelCls}>Model</label>
                        <input name="model" defaultValue={existing?.model ?? ''} placeholder="e.g. gpt-4o, gemini-1.5-pro" className={inputCls} />
                    </div>
                </div>

                <div>
                    <label className={labelCls}>API Key</label>
                    <input name="api_key" type="password" defaultValue={existing?.api_key_encrypted ? '••••••••' : ''} placeholder="Enter your API key" className={inputCls} />
                    <p className="text-xs text-gray-400 mt-1">Stored encrypted. Leave unchanged if not updating.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                        <label className={labelCls}>API Endpoint (optional)</label>
                        <input name="api_endpoint" defaultValue={existing?.api_endpoint ?? ''} placeholder="Custom endpoint URL" className={inputCls} />
                    </div>
                    <div>
                        <label className={labelCls}>API Version (optional)</label>
                        <input name="api_version" defaultValue={existing?.api_version ?? ''} placeholder="e.g. v1" className={inputCls} />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    <div>
                        <label className={labelCls}>Max Tokens</label>
                        <input name="max_tokens" type="number" defaultValue={existing?.max_tokens ?? 4096} min={100} max={128000} className={inputCls} />
                    </div>
                    <div>
                        <label className={labelCls}>Temperature</label>
                        <input name="temperature" type="number" step="0.05" min="0" max="2" defaultValue={existing?.temperature ?? 0.1} className={inputCls} />
                    </div>
                    <div className="flex items-end">
                        <label className="inline-flex items-center gap-2 cursor-pointer">
                            <input name="is_active" type="checkbox" defaultChecked={existing?.is_active ?? false}
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4" />
                            <span className="text-sm font-medium text-gray-700">Active</span>
                        </label>
                    </div>
                </div>
            </div>

            {/* Fallback Provider */}
            <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-5">
                <h2 className="text-base font-semibold text-gray-900">Fallback Provider (optional)</h2>
                <p className="text-xs text-gray-500 -mt-3">Used if the primary provider fails.</p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                        <label className={labelCls}>Fallback Provider</label>
                        <select name="fallback_provider" defaultValue={existing?.fallback_provider ?? ''} className={inputCls}>
                            <option value="">— None —</option>
                            {PROVIDERS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className={labelCls}>Fallback Model</label>
                        <input name="fallback_model" defaultValue={existing?.fallback_model ?? ''} placeholder="e.g. gpt-4o, gemini-1.5-pro" className={inputCls} />
                    </div>
                </div>

                <div>
                    <label className={labelCls}>Fallback API Key</label>
                    <input name="fallback_api_key" type="password" defaultValue={existing?.fallback_api_key_encrypted ? '••••••••' : ''} placeholder="Fallback API key" className={inputCls} />
                </div>
            </div>

            {/* Extraction Prompt */}
            <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
                <h2 className="text-base font-semibold text-gray-900">Extraction Prompt</h2>
                <p className="text-xs text-gray-500 -mt-2">Custom prompt used for AI-based document extraction. Leave blank to use default.</p>
                <textarea name="extraction_prompt" rows={6} defaultValue={existing?.extraction_prompt ?? ''} placeholder="Custom extraction prompt..." autoComplete="off" spellCheck={false} className={inputCls + " font-mono text-xs"} />
            </div>

            {/* Submit */}
            <div className="flex items-center justify-end gap-3">
                <button type="submit" disabled={saving}
                    className="px-6 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm">
                    {saving ? 'Saving…' : (existing ? 'Update Configuration' : 'Save Configuration')}
                </button>
            </div>
        </form>
    );
}
