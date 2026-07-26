'use client';

import { useState, useEffect } from 'react';

export function SapSyncPanel({
    workpackId,
    isAdmin,
}: {
    workpackId: string;
    isAdmin: boolean;
}) {
    const [info, setInfo] = useState<{
        sap_work_order?: string | null;
        sync_status?: string;
        message?: string;
    } | null>(null);
    const [editing, setEditing] = useState(false);
    const [value, setValue] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        void load();
    }, [workpackId]);

    async function load() {
        const res = await fetch(`/api/workpacks/${workpackId}/sap-sync`);
        if (res.ok) {
            const d = await res.json();
            setInfo(d);
            setValue(d.sap_work_order ?? '');
        }
    }

    async function save() {
        setSaving(true);
        setError(null);
        const res = await fetch(`/api/workpacks/${workpackId}/sap-sync`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sap_work_order: value.trim() || null,
            }),
        });
        const d = await res.json();
        if (!res.ok) {
            setError(d.error ?? 'Failed');
            setSaving(false);
            return;
        }
        setInfo(d);
        setEditing(false);
        setSaving(false);
    }

    if (!info) return null;

    const linked = info.sync_status === 'linked';

    return (
        <div
            className={`rounded-2xl border p-4 ${
                linked ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'
            }`}
        >
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <span className="text-xl">{linked ? '🔗' : '🔌'}</span>
                    <div>
                        <p className="text-sm font-semibold text-gray-900">SAP Work Order</p>
                        {editing ? (
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                                <input
                                    type="text"
                                    value={value}
                                    onChange={(e) =>
                                        setValue(e.target.value.toUpperCase().trim())
                                    }
                                    placeholder="e.g. WO123456"
                                    className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm font-mono w-40 focus:outline-none focus:border-blue-500"
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') void save();
                                        if (e.key === 'Escape') setEditing(false);
                                    }}
                                    autoFocus
                                />
                                <button
                                    type="button"
                                    onClick={() => void save()}
                                    disabled={saving}
                                    className="px-3 py-1.5 bg-[#0D2137] text-white text-xs rounded-lg hover:bg-[#1a3a5c] disabled:opacity-40"
                                >
                                    {saving ? '...' : 'Save'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setEditing(false);
                                        setValue(info.sap_work_order ?? '');
                                        setError(null);
                                    }}
                                    className="text-xs text-gray-500 hover:text-gray-800"
                                >
                                    Cancel
                                </button>
                                {error && (
                                    <p className="text-xs text-red-600 w-full mt-1">{error}</p>
                                )}
                            </div>
                        ) : (
                            <p
                                className={`text-sm mt-0.5 ${
                                    linked
                                        ? 'font-mono font-bold text-green-700'
                                        : 'text-gray-400 italic'
                                }`}
                            >
                                {info.sap_work_order ?? 'Not linked'}
                            </p>
                        )}
                    </div>
                </div>

                {isAdmin && !editing && (
                    <button
                        type="button"
                        onClick={() => setEditing(true)}
                        className="text-xs text-gray-500 hover:text-blue-600 px-3 py-1.5 border border-gray-300 rounded-xl hover:border-blue-400 transition-colors"
                    >
                        {linked ? '✎ Change' : '+ Link SAP WO'}
                    </button>
                )}
            </div>

            {linked && (
                <div className="mt-3 pt-3 border-t border-green-200 text-xs text-green-700">
                    <p>
                        ✓ Linked · Live SAP PM bi-directional sync is planned for Sprint 23 (Integrations Hub).
                    </p>
                </div>
            )}

            {!linked && !editing && (
                <p className="mt-2 text-xs text-gray-400">
                    Link a SAP PM Work Order to enable future bi-directional sync.
                </p>
            )}

            {/* BOM Export — always available */}
            <div className="mt-4 pt-3 border-t border-gray-200 flex items-center justify-between gap-3">
                <div>
                    <p className="text-xs font-medium text-gray-700">BOM Export for SAP</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                        Download all material lines as a SAP-formatted CSV for manual reservation import.
                    </p>
                </div>
                <a
                    id="bom-export-btn"
                    href={`/api/workpacks/${workpackId}/sap-sync/bom-export`}
                    download
                    className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-[#0D2137] text-white text-xs font-medium rounded-lg hover:bg-[#1a3a5c] transition-colors"
                >
                    ⬇ Export BOM CSV
                </a>
            </div>
        </div>
    );
}
