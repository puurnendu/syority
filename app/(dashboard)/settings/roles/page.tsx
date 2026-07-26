'use client';

import { useState, useEffect } from 'react';

const DEFAULT_PERMISSIONS = {
    workpack: ['view', 'create', 'edit', 'delete', 'approve', 'publish'],
    activity: ['view', 'create', 'edit', 'delete'],
    admin: ['view', 'manage_users', 'manage_org', 'manage_settings'],
    master_data: ['view', 'manage'],
};

export default function RolesSettingsPage() {
    const [roles, setRoles] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingRole, setEditingRole] = useState<any>(null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchRoles();
    }, []);

    const fetchRoles = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch('/api/settings/roles');
            const data = await res.json();
            if (Array.isArray(data)) {
                setRoles(data);
            } else {
                setRoles([]);
                setError(data.error || 'Failed to load roles');
            }
        } catch (err: any) {
            setError(err.message || 'Error fetching roles');
            setRoles([]);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setSaving(true);
        const form = new FormData(e.currentTarget);

        // Extract permissions from checkboxes
        const permissions: any = {};
        Object.keys(DEFAULT_PERMISSIONS).forEach(module => {
            const selected = form.getAll(`perm_${module}`);
            if (selected.length > 0) permissions[module] = selected;
        });

        const body = {
            id: editingRole?.id,
            name: form.get('name'),
            is_system: form.get('is_system') === 'on',
            permissions: permissions,
        };

        try {
            const res = await fetch('/api/settings/roles', {
                method: editingRole ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            if (!res.ok) throw new Error('Failed to save role');
            setIsModalOpen(false);
            setEditingRole(null);
            fetchRoles();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error saving role');
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
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Roles & Permissions</h1>
                    <p className="text-sm text-gray-500 mt-1">Define access levels and functional permissions for your users.</p>
                </div>
                <button
                    onClick={() => { setEditingRole(null); setIsModalOpen(true); }}
                    className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
                >
                    + Add New Role
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {loading ? (
                    <div className="col-span-full py-12 text-center text-gray-400">Loading roles...</div>
                ) : roles.map((role) => (
                    <div key={role.id} className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all group">
                        <div className="flex justify-between items-start mb-4">
                            <div className="flex items-center gap-2">
                                <h3 className="text-base font-bold text-gray-900">{role.name}</h3>
                                {role.is_system && (
                                    <span className="text-[10px] bg-blue-50 text-blue-600 font-bold px-1.5 py-0.5 rounded uppercase tracking-widest border border-blue-100">System</span>
                                )}
                            </div>
                            <button
                                onClick={() => { setEditingRole(role); setIsModalOpen(true); }}
                                className="text-xs font-semibold text-blue-600 hover:text-blue-800"
                            >
                                Edit
                            </button>
                        </div>

                        <div className="space-y-3">
                            <div className="flex justify-between text-xs text-gray-500 font-medium">
                                <span>Active Users</span>
                                <span className="text-gray-900">{role._count?.user_roles || 0}</span>
                            </div>
                            <div className="pt-3 border-t border-gray-50">
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Permissions Overview</p>
                                <div className="flex flex-wrap gap-1.5">
                                    {Object.entries(role.permissions || {}).map(([mod, perms]: [string, any]) => (
                                        <span key={mod} className="px-2 py-0.5 bg-gray-50 text-gray-600 text-[10px] font-medium rounded border border-gray-100">
                                            {mod}: {perms.length}
                                        </span>
                                    ))}
                                    {Object.keys(role.permissions || {}).length === 0 && <span className="text-[10px] text-gray-400 italic">No permissions assigned</span>}
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden transform transition-all my-8">
                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                            <h3 className="text-lg font-bold text-gray-900">{editingRole ? 'Edit Role' : 'Create New Role'}</h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">✕</button>
                        </div>
                        <form onSubmit={handleSave} className="p-6 space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">Role Name</label>
                                    <input name="name" defaultValue={editingRole?.name} required className="w-full px-3 py-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" placeholder="e.g. Project Manager" />
                                </div>
                                <div className="flex items-center gap-2 pb-3">
                                    <input type="checkbox" name="is_system" defaultChecked={editingRole?.is_system ?? false} id="is_system" className="rounded text-blue-600" />
                                    <label htmlFor="is_system" className="text-sm font-medium text-gray-700">System Role (Protected)</label>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <h4 className="text-sm font-bold text-gray-900 border-b pb-2">Module Permissions</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    {Object.entries(DEFAULT_PERMISSIONS).map(([module, perms]) => (
                                        <div key={module} className="space-y-2">
                                            <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">{module.replace('_', ' ')}</p>
                                            <div className="grid grid-cols-2 gap-2">
                                                {perms.map(p => (
                                                    <label key={p} className="flex items-center gap-2 p-1.5 rounded hover:bg-gray-50 cursor-pointer transition-colors border border-transparent hover:border-gray-100">
                                                        <input
                                                            type="checkbox"
                                                            name={`perm_${module}`}
                                                            value={p}
                                                            defaultChecked={editingRole?.permissions?.[module]?.includes(p)}
                                                            className="rounded text-blue-600 h-3.5 w-3.5"
                                                        />
                                                        <span className="text-xs text-gray-600 capitalize">{p}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 pt-6 border-t">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">Cancel</button>
                                <button type="submit" disabled={saving} className="px-8 py-2.5 bg-blue-600 text-white text-sm font-bold rounded-lg hover:bg-blue-700 shadow-lg shadow-blue-200">
                                    {saving ? 'Saving...' : 'Save Role'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
