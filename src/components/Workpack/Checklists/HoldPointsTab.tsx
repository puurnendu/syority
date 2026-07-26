'use client';

import { useState, useEffect, useCallback } from 'react';

type QaClearance = { id: string; cleared_at: string; witness_name: string | null; certificate_number: string | null; notes: string | null };
type HoldPointActivity = { id: string; activity_number: string | null; description: string; hold_point_type: string; hold_point_description: string | null; is_cleared: boolean; clearance: QaClearance | null };
type GroupedHoldPoints = { label: string; items: HoldPointActivity[] };
type HoldPointsData = { total: number; cleared: number; pending: number; grouped: Record<string, GroupedHoldPoints> };

const HP_ICONS: Record<string, string> = { witness_point: '👁', surveillance_point: '📡', hold_point: '✋' };
const HP_COLORS: Record<string, string> = { witness_point: 'bg-blue-50 border-blue-200 text-blue-700', surveillance_point: 'bg-amber-50 border-amber-200 text-amber-700', hold_point: 'bg-red-50 border-red-200 text-red-700' };

export function HoldPointsTab({ workpackId, readOnly = false }: { workpackId: string; readOnly?: boolean }) {
    const [data, setData] = useState<HoldPointsData | null>(null);
    const [loading, setLoading] = useState(true);
    const [clearModal, setClearModal] = useState<{ activityId: string; description: string } | null>(null);
    const [clearing, setClearing] = useState(false);
    const [clearForm, setClearForm] = useState({ witness_name: '', certificate_number: '', notes: '' });
    const [error, setError] = useState('');

    const load = useCallback(async () => {
        setLoading(true);
        const res = await fetch(`/api/workpacks/${workpackId}/hold-points`);
        if (res.ok) setData(await res.json());
        setLoading(false);
    }, [workpackId]);

    useEffect(() => { void load(); }, [load]);

    const handleClear = async () => {
        if (!clearModal) return;
        setClearing(true); setError('');
        try {
            const res = await fetch(`/api/workpacks/${workpackId}/hold-points/${clearModal.activityId}`, {
                method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ clear: true, ...clearForm }),
            });
            if (!res.ok) throw new Error((await res.json()).error ?? 'Failed');
            setClearModal(null);
            setClearForm({ witness_name: '', certificate_number: '', notes: '' });
            await load();
        } catch (e) { setError(e instanceof Error ? e.message : 'Failed'); }
        finally { setClearing(false); }
    };

    if (loading) return <div className="flex items-center justify-center h-40 text-sm text-gray-400">Loading…</div>;
    if (!data || data.total === 0) return (
        <div className="flex flex-col items-center justify-center h-48 gap-2 text-gray-400 text-center">
            <span className="text-3xl">✋</span><p className="text-sm">No hold points defined on this workpack&apos;s activities</p>
        </div>
    );

    return (
        <div className="flex flex-col gap-5">
            <div className="grid grid-cols-3 gap-3">
                {[['Total', data.total, 'text-gray-700'], ['Cleared', data.cleared, 'text-green-600'], ['Pending', data.pending, data.pending > 0 ? 'text-red-600' : 'text-gray-400']].map(([l, v, c]) => (
                    <div key={String(l)} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm text-center">
                        <p className="text-xs text-gray-400 uppercase tracking-wider">{l}</p>
                        <p className={`text-2xl font-bold mt-1 ${c}`}>{v}</p>
                    </div>
                ))}
            </div>
            {Object.entries(data.grouped).map(([type, group]) => group.items.length === 0 ? null : (
                <div key={type} className="flex flex-col gap-2">
                    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-medium w-fit ${HP_COLORS[type] ?? 'bg-gray-50 border-gray-200 text-gray-700'}`}>
                        {HP_ICONS[type] ?? '🔵'} {group.label} ({group.items.length})
                    </div>
                    <div className="border border-gray-200 rounded-xl overflow-hidden">
                        <table className="w-full text-sm">
                            <thead><tr className="bg-gray-50 border-b border-gray-200 text-xs font-medium text-gray-500 uppercase tracking-wider">
                                <th className="px-4 py-3 text-left">Activity</th>
                                <th className="px-4 py-3 text-left">Description</th>
                                <th className="px-4 py-3 text-left">Hold Point Desc.</th>
                                <th className="px-4 py-3 text-center">Status</th>
                                <th className="px-4 py-3 text-left">Cleared</th>
                                {!readOnly && <th className="px-4 py-3" />}
                            </tr></thead>
                            <tbody className="divide-y divide-gray-100">
                                {group.items.map((item) => (
                                    <tr key={item.id} className={`hover:bg-gray-50 ${item.is_cleared ? 'bg-green-50/20' : ''}`}>
                                        <td className="px-4 py-3 font-mono text-xs text-gray-500">{item.activity_number ?? '—'}</td>
                                        <td className="px-4 py-3 font-medium text-gray-900 max-w-xs truncate">{item.description}</td>
                                        <td className="px-4 py-3 text-gray-500 text-xs">{item.hold_point_description ?? '—'}</td>
                                        <td className="px-4 py-3 text-center">
                                            {item.is_cleared
                                                ? <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs font-medium">✓ Cleared</span>
                                                : <span className="px-2 py-0.5 rounded-full bg-red-50 text-red-600 text-xs font-medium">⏳ Pending</span>}
                                        </td>
                                        <td className="px-4 py-3 text-gray-400 text-xs">
                                            {item.clearance?.cleared_at ? new Date(item.clearance.cleared_at).toLocaleString() : '—'}
                                            {item.clearance?.witness_name && <div>Witness: {item.clearance.witness_name}</div>}
                                        </td>
                                        {!readOnly && <td className="px-4 py-3 text-right">
                                            {!item.is_cleared && (
                                                <button id={`clear-hp-${item.id}`} onClick={() => setClearModal({ activityId: item.id, description: item.description })}
                                                    className="px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700">Clear ✓</button>
                                            )}
                                        </td>}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            ))}
            {clearModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/40" onClick={() => setClearModal(null)} />
                    <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 flex flex-col gap-4">
                        <h4 className="text-lg font-semibold text-gray-900">Clear Hold Point</h4>
                        <p className="text-sm text-gray-500">{clearModal.description}</p>
                        <div className="flex flex-col gap-3">
                            {[['Witness Name', 'witness_name', 'QA Inspector name'], ['Certificate Number', 'certificate_number', 'e.g. ITP-2024-001']].map(([label, field, ph]) => (
                                <label key={field} className="flex flex-col gap-1">
                                    <span className="text-xs font-medium text-gray-500">{label}</span>
                                    <input value={clearForm[field as keyof typeof clearForm]} onChange={(e) => setClearForm({ ...clearForm, [field]: e.target.value })}
                                        placeholder={ph} className="px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-green-500" />
                                </label>
                            ))}
                            <label className="flex flex-col gap-1">
                                <span className="text-xs font-medium text-gray-500">Notes</span>
                                <textarea value={clearForm.notes} onChange={(e) => setClearForm({ ...clearForm, notes: e.target.value })} rows={2}
                                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-green-500 resize-none" />
                            </label>
                        </div>
                        {error && <p className="text-sm text-red-600">{error}</p>}
                        <div className="flex gap-3">
                            <button onClick={() => setClearModal(null)} className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200">Cancel</button>
                            <button onClick={() => void handleClear()} disabled={clearing}
                                className="flex-1 px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50">
                                {clearing ? 'Clearing…' : '✓ Confirm Clear'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
