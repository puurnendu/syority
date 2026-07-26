'use client';

import { useState, useEffect } from 'react';

export default function ClearancePartiesPage() {
    const [parties, setParties] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [editing, setEditing] = useState<any>(null);

    const [form, setForm] = useState({
        party_name: '',
        condition: '',
        sequence_number: 0,
        is_active: true
    });

    useEffect(() => {
        fetchParties();
    }, []);

    const fetchParties = async () => {
        const res = await fetch('/api/admin/clearance-parties');
        setParties(await res.json());
        setLoading(false);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            const url = editing ? `/api/admin/clearance-parties/${editing.id}` : '/api/admin/clearance-parties';
            const method = editing ? 'PATCH' : 'POST';
            await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form)
            });
            setShowModal(false);
            setEditing(null);
            setForm({ party_name: '', condition: '', sequence_number: 0, is_active: true });
            fetchParties();
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure?')) return;
        await fetch(`/api/admin/clearance-parties/${id}`, { method: 'DELETE' });
        fetchParties();
    };

    if (loading) return <div className="p-8">Loading…</div>;

    return (
        <div className="max-w-6xl mx-auto p-8">
            <div className="flex justify-between items-center mb-10">
                <div>
                    <h1 className="text-4xl font-black text-gray-900 tracking-tighter italic uppercase">Clearance Parties</h1>
                    <p className="text-gray-500 mt-2 font-medium">Define stakeholders for multi-party boxup clearance protocols.</p>
                </div>
                <button
                    onClick={() => { setEditing(null); setShowModal(true); }}
                    className="px-6 py-3 bg-blue-600 text-white text-sm font-bold rounded-2xl hover:bg-blue-700 transition-all shadow-xl shadow-blue-500/20 active:scale-95"
                >
                    + Add Party
                </button>
            </div>

            <div className="bg-white rounded-[2rem] border border-gray-100 shadow-2xl overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-gray-50/50 border-b border-gray-100">
                        <tr>
                            <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Seq</th>
                            <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Party Name</th>
                            <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Condition</th>
                            <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Status</th>
                            <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {parties.map(p => (
                            <tr key={p.id} className="hover:bg-blue-50/30 transition-colors group">
                                <td className="px-8 py-5 text-sm font-mono text-gray-400">{p.sequence_number}</td>
                                <td className="px-8 py-5">
                                    <span className="text-sm font-bold text-gray-900">{p.party_name}</span>
                                </td>
                                <td className="px-8 py-5 text-sm text-gray-600 max-w-xs truncate">{p.condition}</td>
                                <td className="px-8 py-5">
                                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${p.is_active ? 'bg-green-50 text-green-600 border border-green-100' : 'bg-gray-50 text-gray-400 border border-gray-100'}`}>
                                        {p.is_active ? 'Active' : 'Inactive'}
                                    </span>
                                </td>
                                <td className="px-8 py-5 text-right space-x-2">
                                    <button
                                        onClick={() => { setEditing(p); setForm(p); setShowModal(true); }}
                                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-white rounded-xl transition-all shadow-sm border border-transparent hover:border-blue-100"
                                    >
                                        ✏️
                                    </button>
                                    <button
                                        onClick={() => handleDelete(p.id)}
                                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-white rounded-xl transition-all shadow-sm border border-transparent hover:border-red-100"
                                    >
                                        🗑️
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {showModal && (
                <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-[2.5rem] w-full max-w-lg p-10 shadow-2xl animate-in fade-in zoom-in duration-200">
                        <h2 className="text-2xl font-black text-gray-900 mb-8">{editing ? 'Edit Party' : 'Add New Party'}</h2>
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div>
                                <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Party Name</label>
                                <input
                                    value={form.party_name}
                                    onChange={e => setForm({ ...form, party_name: e.target.value })}
                                    className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                    placeholder="e.g. Mechanical Supervisor"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Condition of Closure</label>
                                <textarea
                                    value={form.condition}
                                    onChange={e => setForm({ ...form, condition: e.target.value })}
                                    className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                    rows={3}
                                    placeholder="e.g. All internal inspections complete."
                                    required
                                />
                            </div>
                            <div className="flex gap-6">
                                <div className="flex-1">
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Sequence</label>
                                    <input
                                        type="number"
                                        value={form.sequence_number}
                                        onChange={e => setForm({ ...form, sequence_number: parseInt(e.target.value) })}
                                        className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                    />
                                </div>
                                <div className="flex-1 flex items-end">
                                    <label className="flex items-center gap-3 cursor-pointer p-4 bg-gray-50 border border-gray-100 rounded-2xl w-full">
                                        <input
                                            type="checkbox"
                                            checked={form.is_active}
                                            onChange={e => setForm({ ...form, is_active: e.target.checked })}
                                            className="w-5 h-5 rounded-lg border-gray-300 text-blue-600 focus:ring-blue-500"
                                        />
                                        <span className="text-sm font-bold text-gray-700">Active</span>
                                    </label>
                                </div>
                            </div>

                            <div className="flex gap-4 pt-6">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="flex-1 py-4 bg-gray-100 text-gray-500 text-sm font-bold rounded-2xl hover:bg-gray-200 transition-all font-mono tracking-widest"
                                >
                                    CANCEL
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="flex-3 py-4 bg-blue-600 text-white text-sm font-black rounded-2xl hover:bg-blue-700 transition-all shadow-xl shadow-blue-500/30 font-mono tracking-widest"
                                >
                                    {saving ? 'SAVING…' : 'SAVE PARTY'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
