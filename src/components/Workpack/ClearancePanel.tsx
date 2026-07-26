'use client';

import { useState, useEffect, useCallback } from 'react';

interface Props {
    workpack: any;
}

// ── Safe JSON fetch helper ───────────────────────────────────────────────
// Always resolves; never throws on empty/malformed body.
async function safeJsonFetch<T = unknown>(
    url: string,
    options?: RequestInit
): Promise<{ data: T | null; ok: boolean; status: number; error: string | null }> {
    try {
        const res = await fetch(url, options);
        console.log(`[ClearancePanel] ${options?.method ?? 'GET'} ${url} → ${res.status}`);

        // Parse body regardless of status so we can surface the server error message
        let data: T | null = null;
        const text = await res.text();
        if (text) {
            try {
                data = JSON.parse(text) as T;
            } catch {
                console.error('[ClearancePanel] Non-JSON response body:', text.slice(0, 200));
                return { data: null, ok: false, status: res.status, error: 'Server returned an invalid response.' };
            }
        }

        if (!res.ok) {
            const serverMsg = (data as any)?.error ?? `HTTP ${res.status}`;
            return { data: null, ok: false, status: res.status, error: serverMsg };
        }

        return { data, ok: true, status: res.status, error: null };
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Network error';
        console.error('[ClearancePanel] Fetch failed:', message);
        return { data: null, ok: false, status: 0, error: message };
    }
}

// ── Component ────────────────────────────────────────────────────────────

export function ClearancePanel({ workpack }: Props) {
    const [clearance, setClearance] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    // ── Initial load ───────────────────────────────────────────────────
    useEffect(() => {
        let cancelled = false;
        (async () => {
            const { data, ok, error } = await safeJsonFetch(`/api/workpacks/${workpack.id}/clearance-boxup`);
            if (cancelled) return;
            if (!ok) {
                console.warn('[ClearancePanel] GET failed:', error);
                // Don't show an error banner for "not yet initialized" (null data is fine)
            }
            setClearance(data ?? null);
            setLoading(false);
        })();
        return () => { cancelled = true; };
    }, [workpack.id]);

    // ── Initialize clearance protocol ──────────────────────────────────
    const handleInitialize = useCallback(async () => {
        setErrorMsg(null);
        setSaving(true);
        try {
            const { data, ok, error } = await safeJsonFetch(`/api/workpacks/${workpack.id}/clearance-boxup`, {
                method: 'POST',
            });

            if (!ok || !data) {
                setErrorMsg(error ?? 'Failed to initialize clearance. Please retry.');
                return;
            }
            setClearance(data);
        } finally {
            setSaving(false);
        }
    }, [workpack.id]);

    // ── Sign-off ───────────────────────────────────────────────────────
    const handleSignOff = useCallback(async (signOffId: string) => {
        const notes = prompt('Any comments/notes for sign-off?') || '';
        setErrorMsg(null);
        setSaving(true);
        try {
            const { ok, error } = await safeJsonFetch(
                `/api/workpacks/${workpack.id}/clearance-boxup/sign-off/${signOffId}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ notes }),
                }
            );

            if (!ok) {
                setErrorMsg(error ?? 'Failed to record sign-off. Please retry.');
                return;
            }

            // Reload full clearance after sign-off
            const { data, ok: reloadOk } = await safeJsonFetch(`/api/workpacks/${workpack.id}/clearance-boxup`);
            if (reloadOk && data) setClearance(data);
        } finally {
            setSaving(false);
        }
    }, [workpack.id]);

    // ── Render ─────────────────────────────────────────────────────────

    if (loading) {
        return (
            <div className="p-8 animate-pulse space-y-4">
                <div className="h-10 bg-gray-100 rounded-xl w-1/4" />
                <div className="h-64 bg-gray-50 rounded-2xl w-full" />
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Error banner */}
            {errorMsg && (
                <div className="flex items-start gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                    <span className="text-lg leading-none flex-shrink-0 mt-0.5">⚠️</span>
                    <div className="flex-1">
                        <p className="font-semibold">Action failed</p>
                        <p className="opacity-80 mt-0.5">{errorMsg}</p>
                    </div>
                    <button
                        type="button"
                        onClick={() => setErrorMsg(null)}
                        className="text-red-400 hover:text-red-600 text-xl leading-none flex-shrink-0"
                    >
                        ×
                    </button>
                </div>
            )}

            {/* Empty state — not yet initialized */}
            {!clearance && (
                <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-dashed border-gray-200 shadow-sm">
                    <div className="w-20 h-20 bg-amber-50 text-amber-600 rounded-3xl flex items-center justify-center text-4xl mb-6 shadow-inner">🔓</div>
                    <h3 className="text-xl font-extrabold text-gray-900 tracking-tight">Clearance for Final Boxup</h3>
                    <p className="text-sm text-gray-500 mt-2 mb-8 text-center max-w-sm leading-relaxed">
                        This protocol requires multi-party sign-off from all stakeholders before the equipment can be permanently closed.
                    </p>
                    <button
                        onClick={handleInitialize}
                        disabled={saving}
                        className="px-8 py-3 bg-blue-600 text-white text-sm font-bold rounded-2xl hover:bg-blue-700 transition-all shadow-xl shadow-blue-500/30 active:scale-95 disabled:opacity-50"
                    >
                        {saving ? 'Preparing Protocol…' : 'Initialize Clearance Protocol'}
                    </button>
                </div>
            )}

            {/* Clearance sign-off table */}
            {clearance && (
                <div className="space-y-6">
                    <div className="bg-white p-10 rounded-[2.5rem] border border-gray-100 shadow-2xl shadow-gray-200/50">
                        <div className="flex justify-between items-start mb-10">
                            <div>
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-blue-600 text-white shadow-lg shadow-blue-500/20">Quality Gate</span>
                                    <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-gray-100 text-gray-500 border border-gray-200">
                                        Ref: {workpack.workpack_number}-CLR
                                    </span>
                                </div>
                                <h2 className="text-3xl font-black text-gray-900 tracking-tighter">Multi-Party Boxup Clearance</h2>
                                <p className="text-gray-500 mt-2 text-sm font-medium">Final authorization protocol for pressure vessel and piping closure.</p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            {clearance.sign_offs?.map((s: any) => (
                                <div
                                    key={s.id}
                                    className={`group flex items-center justify-between p-6 rounded-3xl border transition-all ${
                                        s.signed_at
                                            ? 'bg-green-50/30 border-green-100 ring-1 ring-green-100'
                                            : 'bg-gray-50/50 border-gray-100 hover:border-blue-200 hover:bg-white'
                                    }`}
                                >
                                    <div className="flex items-center gap-6">
                                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-xl shadow-sm transition-all ${
                                            s.signed_at
                                                ? 'bg-green-500 text-white shadow-green-200'
                                                : 'bg-white text-gray-400 group-hover:bg-blue-600 group-hover:text-white'
                                        }`}>
                                            {s.signed_at ? '✓' : '✒️'}
                                        </div>
                                        <div>
                                            <h4 className="text-base font-bold text-gray-900 leading-tight">{s.party_name}</h4>
                                            <p className="text-xs text-gray-500 font-medium mt-1">{s.condition}</p>
                                            {s.notes && (
                                                <p className="text-xs text-blue-600 font-bold mt-2 bg-blue-50 px-2 py-1 rounded-lg inline-block">"{s.notes}"</p>
                                            )}
                                        </div>
                                    </div>

                                    <div className="text-right">
                                        {s.signed_at ? (
                                            <div className="space-y-1">
                                                <p className="text-xs font-black text-green-700 uppercase tracking-widest italic">Fully Authorized</p>
                                                <p className="text-[10px] text-gray-400 font-mono">{new Date(s.signed_at).toLocaleString()}</p>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => handleSignOff(s.id)}
                                                disabled={saving}
                                                className="px-6 py-2.5 bg-gray-900 text-white text-[11px] font-black uppercase tracking-widest rounded-xl hover:bg-blue-600 transition-all shadow-lg active:scale-95 disabled:opacity-50"
                                            >
                                                Confirm &amp; Sign
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="mt-12 p-6 bg-blue-50/50 rounded-3xl border border-blue-100 flex items-start gap-4">
                            <span className="text-2xl">💡</span>
                            <div>
                                <p className="text-xs font-bold text-blue-900 uppercase tracking-widest mb-1">Authorization Rule</p>
                                <p className="text-sm text-blue-800 font-medium">
                                    This workpack cannot be closed until all stakeholders listed above have digitally confirmed the conditions of closure.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
