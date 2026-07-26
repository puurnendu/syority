'use client';

import { useState } from 'react';

/**
 * BackfillToolSection — Platform admin maintenance tools.
 * 12.3: Activity code backfill trigger
 */
export function BackfillToolSection() {
    const [running, setRunning] = useState(false);
    const [result, setResult] = useState<{ updated: number; workpacksProcessed: number } | null>(null);
    const [err, setErr] = useState<string | null>(null);

    const runBackfill = async () => {
        if (!confirm('Run activity code backfill? This will assign auto-generated codes to activities that are missing one. Safe to run multiple times.')) return;
        setRunning(true);
        setResult(null);
        setErr(null);
        try {
            const res = await fetch('/api/admin/backfill-activity-codes');
            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? 'Backfill failed');
            setResult(data);
        } catch (e: any) {
            setErr(e.message);
        } finally {
            setRunning(false);
        }
    };

    return (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-900 mb-1">Maintenance Tools</h3>
            <p className="text-xs text-gray-500 mb-4">One-time and idempotent admin operations</p>

            <div className="flex items-start gap-4 p-4 bg-gray-50 border border-gray-200 rounded-xl">
                <div className="flex-1">
                    <p className="text-sm font-medium text-gray-800">Backfill Activity Codes</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                        Assigns auto-generated activity numbers to any activities that are missing one (format: {'{TAG}_{SEQ}'}).
                        Safe to run multiple times — only updates blank fields.
                    </p>
                    {result && (
                        <div className="mt-2 flex items-center gap-2 text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                            <span>✓</span>
                            <span>
                                Updated <strong>{result.updated}</strong> activities across{' '}
                                <strong>{result.workpacksProcessed}</strong> workpacks.
                            </span>
                        </div>
                    )}
                    {err && (
                        <div className="mt-2 flex items-center gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                            <span>⚠</span>
                            <span>{err}</span>
                        </div>
                    )}
                </div>
                <button
                    type="button"
                    onClick={runBackfill}
                    disabled={running}
                    className="px-4 py-2 bg-[#0D2137] text-white text-sm font-medium rounded-xl
                               hover:bg-[#1a3a5c] disabled:opacity-50 disabled:cursor-not-allowed
                               transition-all active:scale-95 whitespace-nowrap flex-shrink-0"
                >
                    {running ? '⏳ Running…' : '▶ Run Backfill'}
                </button>
            </div>
        </div>
    );
}
