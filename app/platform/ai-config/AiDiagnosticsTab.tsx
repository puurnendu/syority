'use client';

import { useState } from 'react';

type DiagnosticResult = {
    status: 'success' | 'failed';
    response?: any;
    error?: string;
    latency_ms?: number;
    model?: string;
    provider?: string;
    hint?: string;
};

type FullResults = Record<string, DiagnosticResult | any>;

export default function AiDiagnosticsTab() {
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState<FullResults | null>(null);
    const [error, setError] = useState<string | null>(null);

    const runTests = async () => {
        setLoading(true);
        setError(null);
        setResults(null);
        try {
            const res = await fetch('/api/ai-config/diagnostics', { method: 'POST' });
            const json = await res.json();
            if (json.error) throw new Error(json.error);
            setResults(json.data);
        } catch (err: any) {
            setError(err.message || 'Failed to run diagnostics');
        } finally {
            setLoading(false);
        }
    };

    const renderCard = (key: string, label: string, icon: string) => {
        const res = results?.[key] as DiagnosticResult | undefined;
        if (!res) return null;

        const isSuccess = res.status === 'success';

        return (
            <div key={key} className={`p-4 rounded-xl border transition-all ${isSuccess ? 'bg-white border-gray-200' : 'bg-red-50 border-red-100'}`}>
                <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                        <span className="text-xl">{icon}</span>
                        <div>
                            <h4 className="text-sm font-semibold text-gray-900">{label}</h4>
                            <p className="text-[10px] text-gray-500 uppercase tracking-wider font-medium">
                                {res.provider} {res.model ? `· ${res.model}` : ''}
                            </p>
                        </div>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${isSuccess ? 'bg-green-100 text-green-700' : 'bg-red-200 text-red-800'}`}>
                        {res.status}
                    </span>
                </div>

                {isSuccess ? (
                    <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs">
                            <span className="text-gray-500">Latency</span>
                            <span className="font-mono text-gray-900">{res.latency_ms}ms</span>
                        </div>
                        <div className="p-2 bg-gray-50 rounded text-[11px] font-mono text-gray-600 break-all line-clamp-2">
                            {JSON.stringify(res.response)}
                        </div>
                    </div>
                ) : (
                    <div className="space-y-2">
                        <p className="text-xs text-red-600 font-medium leading-relaxed">{res.error}</p>
                        {res.hint && (
                            <p className="text-[11px] text-red-500/80 italic border-l-2 border-red-200 pl-2">
                                Tip: {res.hint}
                            </p>
                        )}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="space-y-6">
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-5 flex items-center justify-between gap-4">
                <div className="space-y-1">
                    <h3 className="text-sm font-semibold text-blue-900 flex items-center gap-2">
                        <span>🛡️</span> System Health Check
                    </h3>
                    <p className="text-xs text-blue-700 max-w-md">
                        Run a real-time smoke test of your current AI configuration. This will verify connectivity to Google Cloud or OpenAI.
                    </p>
                </div>
                <button
                    onClick={runTests}
                    disabled={loading}
                    className="px-5 py-2.5 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 transition shadow-sm disabled:opacity-50"
                >
                    {loading ? (
                        <span className="flex items-center gap-2">
                            <svg className="animate-spin h-3 w-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                            Running Diagnostics...
                        </span>
                    ) : 'Run Complete Diagnostics'}
                </button>
            </div>

            {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-center gap-3">
                    <span>⚠️</span> {error}
                </div>
            )}

            {results && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {renderCard('text', 'Basic Connectivity', '📡')}
                    {renderCard('json', 'Structured Output', '🧩')}
                    {renderCard('vision', 'Document Vision', '👁️')}
                </div>
            )}

            {results && (results.fallback || results.whisper) && (
                <>
                    <h3 className="text-sm font-semibold text-gray-900 mt-8 mb-4 border-b pb-2">Secondary Providers</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {renderCard('fallback', 'Fallback Provider', '🔄')}
                        {renderCard('whisper', 'Voice / Audio Engine', '🎙️')}
                    </div>
                </>
            )}

            {results?.vertex && (
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 space-y-4">
                    <div className="flex items-center gap-2 border-b border-gray-200 pb-3">
                        <span className="text-sm">☁️</span>
                        <h4 className="text-sm font-semibold text-gray-900">Vertex AI Environment (GCP)</h4>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div>
                            <p className="text-[10px] text-gray-400 uppercase font-bold mb-1">Project ID</p>
                            <p className="text-xs font-mono text-gray-700">{results.vertex.project_id}</p>
                        </div>
                        <div>
                            <p className="text-[10px] text-gray-400 uppercase font-bold mb-1">Compute Location</p>
                            <p className="text-xs font-mono text-gray-700">{results.vertex.location}</p>
                        </div>
                        <div>
                            <p className="text-[10px] text-gray-400 uppercase font-bold mb-1">Authentication</p>
                            <p className="text-xs text-gray-700">{results.vertex.auth_method}</p>
                        </div>
                    </div>
                </div>
            )}

            {!loading && !results && !error && (
                <div className="h-64 flex flex-col items-center justify-center border-2 border-dashed border-gray-200 rounded-2xl text-gray-400 gap-3">
                    <span className="text-4xl">🚀</span>
                    <p className="text-sm font-medium">Diagnostics are ready to run</p>
                    <p className="text-xs">Execution results will appear here</p>
                </div>
            )}
        </div>
    );
}
