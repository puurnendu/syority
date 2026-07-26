'use client';

import { useState, useEffect, useCallback } from 'react';

type CleaningRecord = {
    id: string;
    cleaning_method: string;
    created_at: string;
    certificate_number: string | null;
    cleaning_medium: string | null;
    before_condition: string | null;
    after_condition: string | null;
    notes: string | null;
};

const CLEANING_METHODS = [
    'chemical_flush',
    'hp_water',
    'steam',
    'mechanical_pigging',
    'solvent',
] as const;
type CleaningMethodType = typeof CLEANING_METHODS[number];

interface CleaningRecordsTabProps {
    workpackId: string;
    readOnly?: boolean;
}

export function CleaningRecordsTab({ workpackId, readOnly = false }: CleaningRecordsTabProps) {
    const [records, setRecords] = useState<CleaningRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [form, setForm] = useState({
        cleaning_method: 'chemical_flush' as CleaningMethodType,
        certificate_number: '',
        cleaning_medium: '',
        before_condition: '',
        after_condition: '',
        notes: '',
    });

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/workpacks/${workpackId}/cleaning`);
            if (res.ok) setRecords(await res.json());
        } finally {
            setLoading(false);
        }
    }, [workpackId]);

    useEffect(() => { load(); }, [load]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setError('');
        try {
            const res = await fetch(`/api/workpacks/${workpackId}/cleaning`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    cleaning_method: form.cleaning_method,
                    certificate_number: form.certificate_number.trim() || null,
                    cleaning_medium: form.cleaning_medium.trim() || null,
                    before_condition: form.before_condition.trim() || null,
                    after_condition: form.after_condition.trim() || null,
                    notes: form.notes.trim() || null,
                }),
            });
            if (!res.ok) throw new Error((await res.json()).error ?? 'Failed');
            setShowForm(false);
            setForm({ cleaning_method: 'chemical_flush', certificate_number: '', cleaning_medium: '', before_condition: '', after_condition: '', notes: '' });
            await load();
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Save failed');
        } finally {
            setSaving(false);
        }
    };

    const typeLabel = (t: string) => t.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

    if (loading) return <div className="flex items-center justify-center h-40 text-sm text-gray-400">Loading…</div>;

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-gray-900">Cleaning Records <span className="text-gray-400 font-normal text-sm">({records.length})</span></h3>
                {!readOnly && (
                    <button
                        id="add-cleaning-record-btn"
                        onClick={() => setShowForm(true)}
                        className="px-4 py-2 bg-[#0D2137] text-white text-sm font-medium rounded-lg hover:bg-[#1a3a5c]"
                    >
                        + Add Record
                    </button>
                )}
            </div>

            {/* Add form modal */}
            {showForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/40" onClick={() => setShowForm(false)} />
                    <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 flex flex-col gap-4">
                        <h4 className="text-lg font-semibold text-gray-900">Add Cleaning Record</h4>
                        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                            <div className="grid grid-cols-2 gap-4">
                                <label className="flex flex-col gap-1">
                                    <span className="text-xs font-medium text-gray-500">Method *</span>
                                    <select
                                        value={form.cleaning_method}
                                        onChange={(e) => setForm({ ...form, cleaning_method: e.target.value as CleaningMethodType })}
                                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#0D2137] outline-none"
                                    >
                                        {CLEANING_METHODS.map((t) => <option key={t} value={t}>{typeLabel(t)}</option>)}
                                    </select>
                                </label>
                                <label className="flex flex-col gap-1">
                                    <span className="text-xs font-medium text-gray-500">Certificate No.</span>
                                    <input
                                        type="text"
                                        value={form.certificate_number}
                                        onChange={(e) => setForm({ ...form, certificate_number: e.target.value })}
                                        placeholder="e.g. CLN-2024-001"
                                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#0D2137] outline-none"
                                    />
                                </label>
                            </div>
                            <label className="flex flex-col gap-1">
                                <span className="text-xs font-medium text-gray-500">Cleaning Medium</span>
                                <input
                                    type="text"
                                    value={form.cleaning_medium}
                                    onChange={(e) => setForm({ ...form, cleaning_medium: e.target.value })}
                                    placeholder="e.g. Water, Solvent, N2"
                                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#0D2137] outline-none"
                                />
                            </label>
                            <label className="flex flex-col gap-1">
                                <span className="text-xs font-medium text-gray-500">Before Condition</span>
                                <input
                                    type="text"
                                    value={form.before_condition}
                                    onChange={(e) => setForm({ ...form, before_condition: e.target.value })}
                                    placeholder="Condition before cleaning"
                                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#0D2137] outline-none"
                                />
                            </label>
                            <label className="flex flex-col gap-1">
                                <span className="text-xs font-medium text-gray-500">After Condition</span>
                                <input
                                    type="text"
                                    value={form.after_condition}
                                    onChange={(e) => setForm({ ...form, after_condition: e.target.value })}
                                    placeholder="Condition after cleaning"
                                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#0D2137] outline-none"
                                />
                            </label>
                            <label className="flex flex-col gap-1">
                                <span className="text-xs font-medium text-gray-500">Notes</span>
                                <textarea
                                    value={form.notes}
                                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                                    rows={2}
                                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#0D2137] outline-none resize-none"
                                />
                            </label>
                            {error && <p className="text-sm text-red-600">{error}</p>}
                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => setShowForm(false)} className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200">Cancel</button>
                                <button type="submit" disabled={saving} className="flex-1 px-4 py-2 bg-[#0D2137] text-white text-sm rounded-lg hover:bg-[#1a3a5c] disabled:opacity-50">{saving ? 'Saving…' : 'Save Record'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {records.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 gap-2 text-gray-400">
                    <span className="text-3xl">🧹</span>
                    <p className="text-sm">No cleaning records yet</p>
                </div>
            ) : (
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-gray-50 border-b border-gray-200 text-xs font-medium text-gray-500 uppercase tracking-wider">
                                <th className="px-4 py-3 text-left">Method</th>
                                <th className="px-4 py-3 text-left">Certificate</th>
                                <th className="px-4 py-3 text-left">Before</th>
                                <th className="px-4 py-3 text-left">After</th>
                                <th className="px-4 py-3 text-left">Date Added</th>
                                <th className="px-4 py-3 text-left">Notes</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {records.map((rec) => (
                                <tr key={rec.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-4 py-3">
                                        <span className="px-2 py-0.5 text-xs font-medium bg-blue-50 text-blue-700 rounded-full">
                                            {typeLabel(rec.cleaning_method)}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-gray-500 text-xs font-mono">{rec.certificate_number ?? '—'}</td>
                                    <td className="px-4 py-3 text-gray-500 text-xs">{rec.before_condition ?? '—'}</td>
                                    <td className="px-4 py-3 text-gray-500 text-xs">{rec.after_condition ?? '—'}</td>
                                    <td className="px-4 py-3 text-gray-400 text-xs">{new Date(rec.created_at).toLocaleDateString()}</td>
                                    <td className="px-4 py-3 text-gray-400 text-xs max-w-xs truncate">{rec.notes ?? '—'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
