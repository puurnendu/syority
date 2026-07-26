'use client';

import { useState, useEffect } from 'react';

interface Props {
    workpack: any;
}

export function CleaningPanel({ workpack }: Props) {
    const [records, setRecords] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [showForm, setShowForm] = useState(false);

    const [form, setForm] = useState({
        cleaning_method: 'hp_water',
        cleaning_medium: '',
        concentration: '',
        temperature_c: '',
        duration_hours: '',
        before_condition: '',
        after_condition: '',
        remaining_deposits: ''
    });

    useEffect(() => {
        fetchRecords();
    }, [workpack.id]);

    const fetchRecords = async () => {
        const res = await fetch(`/api/workpacks/${workpack.id}/cleaning`);
        setRecords(await res.json());
        setLoading(false);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            await fetch(`/api/workpacks/${workpack.id}/cleaning`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form)
            });
            setShowForm(false);
            fetchRecords();
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="p-8">Loading cleaning logs…</div>;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-black text-gray-900 uppercase tracking-tighter italic">Cleaning Records</h2>
                <button
                    onClick={() => setShowForm(true)}
                    className="px-6 py-2 bg-gray-900 text-white text-[11px] font-black uppercase tracking-widest rounded-xl hover:bg-blue-600 transition-all shadow-lg"
                >
                    + Log Cleaning Record
                </button>
            </div>

            {records.length === 0 ? (
                <div className="text-center py-8 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200 mb-6">
                    <p className="text-sm text-gray-500">No cleaning records</p>
                    <p className="text-xs text-gray-400 mt-1">This section will be <strong>omitted from the PDF</strong> if empty. Add records to include it.</p>
                </div>
            ) : (
                <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-2 text-xs text-green-700 flex items-center gap-2 mb-6">
                    <span>✓</span>
                    <span>{records.length} cleaning record{records.length !== 1 ? 's' : ''} defined. This section will be <strong>included in the PDF</strong>.</span>
                </div>
            )}

            {showForm && (
                <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-xl animate-in slide-in-from-top duration-300">
                    <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Method</label>
                            <select
                                value={form.cleaning_method}
                                onChange={e => setForm({ ...form, cleaning_method: e.target.value })}
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold shadow-inner"
                            >
                                <option value="hp_water">HP Water Jetting</option>
                                <option value="chemical_flush">Chemical Flush</option>
                                <option value="steam">Steam Cleaning</option>
                                <option value="mechanical_pigging">Mechanical Pigging</option>
                                <option value="solvent">Solvent Wash</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Medium / Agent</label>
                            <input
                                value={form.cleaning_medium}
                                onChange={e => setForm({ ...form, cleaning_medium: e.target.value })}
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold shadow-inner"
                                placeholder="e.g. Deionized Water + Citric Acid"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Temp (°C)</label>
                            <input
                                type="number"
                                value={form.temperature_c}
                                onChange={e => setForm({ ...form, temperature_c: e.target.value })}
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold shadow-inner"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Duration (Hrs)</label>
                            <input
                                type="number"
                                value={form.duration_hours}
                                onChange={e => setForm({ ...form, duration_hours: e.target.value })}
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold shadow-inner"
                            />
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Observations (Before/After)</label>
                            <textarea
                                value={form.after_condition}
                                onChange={e => setForm({ ...form, after_condition: e.target.value })}
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm font-medium shadow-inner"
                                rows={3}
                                placeholder="Verify removal of all hydrocarbons and scale."
                            />
                        </div>
                        <div className="md:col-span-2 flex justify-end gap-3">
                            <button type="button" onClick={() => setShowForm(false)} className="px-6 py-3 text-xs font-bold text-gray-400 hover:text-gray-600 transition-all uppercase tracking-widest">Discard</button>
                            <button type="submit" disabled={saving} className="px-8 py-3 bg-blue-600 text-white text-xs font-black rounded-xl hover:bg-blue-700 transition-all shadow-xl shadow-blue-500/20 uppercase tracking-[0.2em]">Save Record</button>
                        </div>
                    </form>
                </div>
            )}

            <div className="grid grid-cols-1 gap-6">
                {records.map(r => (
                    <div key={r.id} className="bg-white p-8 rounded-3xl border border-gray-100 shadow-xl shadow-gray-200/50 flex flex-col md:flex-row justify-between gap-8">
                        <div>
                            <div className="flex items-center gap-3 mb-4">
                                <span className="p-2 bg-blue-50 text-blue-600 rounded-lg text-lg">🧽</span>
                                <span className="px-3 py-1 bg-gray-900 text-white text-[9px] font-black uppercase tracking-widest rounded-full">{r.cleaning_method.replace('_', ' ')}</span>
                                <span className="text-xs font-mono text-gray-400 italic">ID: {r.id.slice(0, 8)}</span>
                            </div>
                            <h3 className="text-lg font-black text-gray-900 tracking-tight">{r.cleaning_medium || 'Standard Cleaning Protocol'}</h3>
                            <div className="flex gap-6 mt-4">
                                <div>
                                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Temperature</p>
                                    <p className="text-sm font-bold text-gray-900 italic">{r.temperature_c}°C</p>
                                </div>
                                <div>
                                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Duration</p>
                                    <p className="text-sm font-bold text-gray-900 italic">{r.duration_hours} Hrs</p>
                                </div>
                            </div>
                        </div>
                        <div className="flex flex-col justify-between items-end">
                            <div className="text-right">
                                {r.inspector_acceptance ? (
                                    <div className="space-y-1">
                                        <p className="text-xs font-black text-green-700 uppercase tracking-widest italic flex items-center gap-1.5 justify-end">
                                            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                                            Verification Passed
                                        </p>
                                        <p className="text-[10px] text-gray-400 font-mono tracking-tighter">SINCE: {new Date(r.inspected_at).toLocaleString()}</p>
                                    </div>
                                ) : (
                                    <div className="px-4 py-2 bg-amber-50 text-amber-600 text-[10px] font-black uppercase tracking-widest border border-amber-100 rounded-xl">Pending QC Check</div>
                                )}
                            </div>
                            <p className="text-[10px] text-gray-400 font-bold uppercase mt-4">Logged {new Date(r.created_at).toLocaleDateString()}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
