'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { hasPermission } from '@/lib/permissions';

export default function ResourcesSettingsPage() {
    const { data: session } = useSession();
    const role = (session?.user as any)?.role ?? (session?.user as any)?.roles?.[0] ?? '';
    const canEdit = hasPermission(role, 'masterdata.edit');

    const [resources, setResources] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<any>(null);
    const [saving, setSaving] = useState(false);

    const [sites, setSites] = useState<any[]>([]);
    const [resourceTypes, setResourceTypes] = useState<any[]>([]);
    const [contractors, setContractors] = useState<any[]>([]);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = () => {
        setLoading(true);
        Promise.all([
            fetch('/api/settings/master-data/resources').then(res => res.json()),
            fetch('/api/settings/sites').then(res => res.json()),
            fetch('/api/settings/master-data/resource-types').then(res => res.json()),
            fetch('/api/settings/master-data/contractors').then(res => res.json()),
        ]).then(([resData, sitesData, typesData, contractorsData]) => {
            setResources(Array.isArray(resData) ? resData : []);
            setSites(Array.isArray(sitesData) ? sitesData : []);
            setResourceTypes(Array.isArray(typesData) ? typesData : []);
            setContractors(Array.isArray(contractorsData) ? contractorsData : []);
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
            employee_id: form.get('employee_id'),
            craft_code: form.get('craft_code'),
            resource_type_id: form.get('resource_type_id'),
            contractor_id: form.get('contractor_id') || null,
            site_id: form.get('site_id') || null,
            is_active: form.get('is_active') === 'on',
        };

        try {
            const res = await fetch('/api/settings/master-data/resources', {
                method: editingItem ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            if (!res.ok) throw new Error('Failed to save resource');
            setIsModalOpen(false);
            setEditingItem(null);
            fetchData();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error saving resource');
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
                    <h1 className="text-2xl font-bold text-gray-900">Manpower Resources</h1>
                    <p className="text-sm text-gray-500 mt-1">Manage human resources, crafts, and workforce capabilities.</p>
                </div>
                {canEdit && (
                    <button
                        onClick={() => { setEditingItem(null); setIsModalOpen(true); }}
                        className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
                    >
                        + Add Resource
                    </button>
                )}
            </div>

            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Resource Name</th>
                            <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Type / Craft</th>
                            <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Contractor / Site</th>
                            <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                            <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {loading ? (
                            <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-400 font-medium">Loading manpower data...</td></tr>
                        ) : resources.length === 0 ? (
                            <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-400 font-medium">No resources found in the database.</td></tr>
                        ) : resources.map((item) => (
                            <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-sm">
                                            {item.name.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <div className="text-sm font-bold text-gray-900">{item.name}</div>
                                            <div className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">{item.employee_id || 'EXT-RES'}</div>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="text-xs font-bold text-gray-700">{item.resource_type?.name}</div>
                                    <div className="text-[10px] text-gray-500 font-mono">{item.craft_code || item.resource_type?.code || '—'}</div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="text-xs text-gray-600 font-medium">{item.contractor?.name || 'In-House'}</div>
                                    <div className="text-[10px] text-gray-400">{item.site?.name || 'Global'}</div>
                                </td>
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
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden transform transition-all my-8">
                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                            <h3 className="text-lg font-bold text-gray-900">{editingItem ? 'Edit Resource' : 'Register New Resource'}</h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">✕</button>
                        </div>
                        <form onSubmit={handleSave} className="p-6 space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">Full Name</label>
                                    <input name="name" defaultValue={editingItem?.name} required className="w-full px-3 py-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">Employee / Resource ID</label>
                                    <input name="employee_id" defaultValue={editingItem?.employee_id} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" placeholder="e.g. EMP-001" />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">Resource Type / Craft</label>
                                    <select name="resource_type_id" defaultValue={editingItem?.resource_type_id || ''} required className="w-full px-3 py-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                                        <option value="">Select Resource Type</option>
                                        {resourceTypes.map(t => <option key={t.id} value={t.id}>{t.name} ({t.code})</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">Specific Craft Code</label>
                                    <input name="craft_code" defaultValue={editingItem?.craft_code} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" placeholder="e.g. PW-6G" />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">Employer / Contractor</label>
                                    <select name="contractor_id" defaultValue={editingItem?.contractor_id || ''} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                                        <option value="">In-House / Direct</option>
                                        {contractors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">Primary Site Assignment</label>
                                    <select name="site_id" defaultValue={editingItem?.site_id || ''} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                                        <option value="">Global / Corporate</option>
                                        {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 pt-2">
                                <input type="checkbox" name="is_active" defaultChecked={editingItem?.is_active ?? true} id="is_active" className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4" />
                                <label htmlFor="is_active" className="text-sm font-semibold text-gray-700 cursor-pointer">Active and Available for Scheduling</label>
                            </div>

                            <div className="flex justify-end gap-3 pt-6 border-t border-gray-100">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 text-sm font-bold text-gray-600 hover:bg-gray-100 rounded-xl transition-all">Cancel</button>
                                <button type="submit" disabled={saving} className="px-10 py-2.5 bg-blue-600 text-white text-sm font-black rounded-xl hover:bg-blue-700 shadow-xl shadow-blue-200 transition-all hover:-translate-y-0.5 disabled:opacity-50">
                                    {saving ? 'Saving...' : (editingItem ? 'Update Portfolio' : 'Complete Registration')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
