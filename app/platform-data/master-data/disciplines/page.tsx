'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { hasPermission } from '@/lib/permissions';

export default function DisciplinesSettingsPage() {
    const { data: session } = useSession();
    const role = (session?.user as any)?.role ?? (session?.user as any)?.roles?.[0] ?? '';
    const canEdit = hasPermission(role, 'masterdata.edit');

    const [disciplines, setDisciplines] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<any>(null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = () => {
        setLoading(true);
        fetch('/api/settings/master-data/disciplines')
            .then(res => res.json())
            .then(data => {
                setDisciplines(Array.isArray(data) ? data : []);
                setLoading(false);
            });
    };

    const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setSaving(true);
        const form = new FormData(e.currentTarget);

        const body = {
            id: editingItem?.id,
            name: form.get('name'),
            code: form.get('code'),
            color: form.get('color'),
            is_active: form.get('is_active') === 'on',
        };

        try {
            const res = await fetch('/api/settings/master-data/disciplines', {
                method: editingItem ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            if (!res.ok) throw new Error('Failed to save discipline');
            setIsModalOpen(false);
            setEditingItem(null);
            fetchData();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error saving discipline');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-6">
            {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                    <span>⚠</span><span>{error}</span><button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600">✕</button>
                </div>
            )}
            {!canEdit && (
                <div className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-3 py-1.5 flex items-center gap-1.5">
                    <span>🔒</span>
                    <span>Read-only — contact your organisation admin to make changes.</span>
                </div>
            )}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Disciplines</h1>
                    <p className="text-sm text-gray-500 mt-1">Manage engineering and construction disciplines (e.g., Piping, Mechanical, Electrical).</p>
                </div>
                {canEdit && (
                    <button
                        onClick={() => { setEditingItem(null); setIsModalOpen(true); }}
                        className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
                    >
                        + Add Discipline
                    </button>
                )}
            </div>

            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Discipline</th>
                            <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Code</th>
                            <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                            <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {loading ? (
                            <tr><td colSpan={4} className="px-6 py-12 text-center text-gray-400 font-medium">Loading disciplines...</td></tr>
                        ) : disciplines.length === 0 ? (
                            <tr><td colSpan={4} className="px-6 py-12 text-center text-gray-400 font-medium">No disciplines found.</td></tr>
                        ) : disciplines.map((item) => (
                            <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-4 h-4 rounded-full border border-gray-100" style={{ backgroundColor: item.color }}></div>
                                        <div className="text-sm font-bold text-gray-900">{item.name}</div>
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-xs font-mono font-bold text-gray-500 uppercase tracking-wider">{item.code}</td>
                                <td className="px-6 py-4">
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest ${item.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                        {item.is_active ? 'Active' : 'Inactive'}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    {canEdit && (
                                        <button
                                            onClick={() => { setEditingItem(item); setIsModalOpen(true); }}
                                            className="text-blue-600 hover:text-blue-800 text-sm font-bold"
                                        >
                                            Edit
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden transform transition-all my-8">
                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                            <h3 className="text-lg font-bold text-gray-900">{editingItem ? 'Edit Discipline' : 'Add New Discipline'}</h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors">✕</button>
                        </div>
                        <form onSubmit={handleSave} className="p-6 space-y-6">
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">Discipline Name</label>
                                    <input name="name" defaultValue={editingItem?.name} required className="w-full px-3 py-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 font-medium" placeholder="e.g. Piping & Fabrication" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">Code</label>
                                    <input name="code" defaultValue={editingItem?.code} required className="w-full px-3 py-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 font-mono font-bold uppercase" placeholder="e.g. PIP" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">Color Tag</label>
                                    <input name="color" type="color" defaultValue={editingItem?.color || '#3B82F6'} className="w-full h-10 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-white p-1" />
                                </div>
                            </div>

                            <div className="flex items-center gap-2 pt-2">
                                <input type="checkbox" name="is_active" defaultChecked={editingItem?.is_active ?? true} id="is_active" className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4" />
                                <label htmlFor="is_active" className="text-sm font-semibold text-gray-700 cursor-pointer">Active Discipline</label>
                            </div>

                            <div className="flex justify-end gap-3 pt-6 border-t border-gray-100">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 text-sm font-bold text-gray-600 hover:bg-gray-100 rounded-xl transition-all">Cancel</button>
                                <button type="submit" disabled={saving} className="px-10 py-2.5 bg-blue-600 text-white text-sm font-black rounded-xl hover:bg-blue-700 shadow-xl shadow-blue-200 transition-all hover:-translate-y-0.5 disabled:opacity-50">
                                    {saving ? 'Processing...' : (editingItem ? 'Update Discipline' : 'Create Discipline')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
