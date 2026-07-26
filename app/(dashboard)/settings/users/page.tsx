'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';

type UserRow = {
    id: string;
    name: string;
    email: string;
    employee_id?: string | null;
    position?: string | null;
    phone?: string | null;
    site_id?: string | null;
    is_active?: boolean | null;
    site?: { id: string; name: string; code?: string | null } | null;
    user_roles?: Array<{ role_id: string; role: { id: string; name: string; slug: string } }>;
};

export default function UsersSettingsPage() {
    const { data: session } = useSession();
    const [users, setUsers] = useState<UserRow[]>([]);
    const [roles, setRoles] = useState<any[]>([]);
    const [sites, setSites] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<UserRow | null>(null);
    const [resettingUser, setResettingUser] = useState<UserRow | null>(null);
    const [newPass, setNewPass] = useState('');
    const [confirmPass, setConfirmPass] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [searchInput, setSearchInput] = useState('');
    const [page, setPage] = useState(1);
    const [pageSize] = useState(25);
    const [total, setTotal] = useState(0);
    const [totalPages, setTotalPages] = useState(1);
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams({
                page: String(page),
                pageSize: String(pageSize),
            });
            if (search.trim()) params.set('search', search.trim());
            if (statusFilter === 'active') params.set('is_active', 'true');
            if (statusFilter === 'inactive') params.set('is_active', 'false');

            const [usersRes, rolesRes, sitesRes] = await Promise.all([
                fetch(`/api/settings/users?${params}`),
                fetch('/api/settings/roles'),
                fetch('/api/settings/sites'),
            ]);

            const usersPayload = await usersRes.json();
            const rolesData = await rolesRes.json();
            const sitesData = await sitesRes.json();

            if (!usersRes.ok) {
                setError(usersPayload.error || usersPayload.message || 'Failed to load users');
                setUsers([]);
            } else if (Array.isArray(usersPayload)) {
                // Backward-compatible flat array
                setUsers(usersPayload);
                setTotal(usersPayload.length);
                setTotalPages(1);
            } else if (Array.isArray(usersPayload.data)) {
                setUsers(usersPayload.data);
                setTotal(usersPayload.total ?? usersPayload.data.length);
                setTotalPages(usersPayload.totalPages ?? 1);
            } else {
                setError(usersPayload.error || 'Failed to load users');
                setUsers([]);
            }

            setRoles(Array.isArray(rolesData) ? rolesData : []);
            setSites(Array.isArray(sitesData) ? sitesData : []);
        } catch (err: any) {
            setError(err.message || 'An unexpected error occurred while fetching data');
            setUsers([]);
            setRoles([]);
            setSites([]);
        } finally {
            setLoading(false);
        }
    }, [page, pageSize, search, statusFilter]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setPage(1);
        setSearch(searchInput);
    };

    const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setSaving(true);
        setError(null);
        const form = new FormData(e.currentTarget);

        const body = {
            id: editingUser?.id,
            email: form.get('email'),
            password: form.get('password') || undefined,
            name: form.get('name'),
            employee_id: form.get('employee_id'),
            position: form.get('position'),
            phone: form.get('phone'),
            site_id: form.get('site_id') || null,
            is_active: form.get('is_active') === 'on',
            role_ids: form.getAll('role_ids'),
        };

        try {
            const res = await fetch('/api/settings/users', {
                method: editingUser ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            let data: any = null;
            const contentType = res.headers.get('content-type');
            if (contentType?.includes('application/json')) {
                data = await res.json().catch(() => ({}));
            }
            if (!res.ok) {
                setError(data?.error ?? `Error ${res.status}`);
                return;
            }
            setIsModalOpen(false);
            setEditingUser(null);
            setError(null);
            fetchData();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Network error — please try again');
        } finally {
            setSaving(false);
        }
    };

    const handleToggleActive = async (user: UserRow) => {
        setError(null);
        try {
            const res = await fetch('/api/settings/users', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: user.id, is_active: !user.is_active }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || 'Failed to update status');
            fetchData();
        } catch (err: any) {
            setError(err.message);
        }
    };

    const handleDelete = async (user: UserRow) => {
        if (!confirm(`Delete user "${user.name}" (${user.email})? This cannot be undone.`)) return;
        setError(null);
        try {
            const res = await fetch(`/api/settings/users?id=${encodeURIComponent(user.id)}`, {
                method: 'DELETE',
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || 'Failed to delete user');
            fetchData();
        } catch (err: any) {
            setError(err.message);
        }
    };

    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!resettingUser) return;
        if (newPass !== confirmPass) {
            setError('Passwords do not match');
            return;
        }
        if (newPass.length < 8) {
            setError('Password must be at least 8 characters');
            return;
        }

        setSaving(true);
        setError(null);
        try {
            const res = await fetch('/api/settings/users', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: resettingUser.id, password: newPass }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || 'Failed to reset password');
            }
            setResettingUser(null);
            setNewPass('');
            setConfirmPass('');
            fetchData();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Users</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        {(session?.user as any)?.organization_name ?? 'Organization'} — {total} users
                    </p>
                </div>
                <button
                    onClick={() => { setEditingUser(null); setError(null); setIsModalOpen(true); }}
                    className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
                >
                    + Add New User
                </button>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <form onSubmit={handleSearchSubmit} className="flex-1 flex gap-2">
                    <input
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                        placeholder="Search name, email, employee ID…"
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button type="submit" className="px-4 py-2 bg-gray-900 text-white text-sm font-semibold rounded-lg">
                        Search
                    </button>
                </form>
                <select
                    value={statusFilter}
                    onChange={(e) => { setPage(1); setStatusFilter(e.target.value as any); }}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                >
                    <option value="all">All statuses</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                </select>
            </div>

            {error && !isModalOpen && !resettingUser && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3 text-red-700">
                    <span className="text-xl">⚠️</span>
                    <div>
                        <p className="text-sm font-bold">Error</p>
                        <p className="text-xs opacity-90">{error}</p>
                    </div>
                </div>
            )}

            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">User</th>
                            <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Role</th>
                            <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Site</th>
                            <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                            <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {loading ? (
                            <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-400 font-medium">Loading users...</td></tr>
                        ) : users.length === 0 ? (
                            <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-400">No users found.</td></tr>
                        ) : users.map((u) => (
                            <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm">
                                            {(u.name || '?').charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <div className="text-sm font-semibold text-gray-900">{u.name}</div>
                                            <div className="text-xs text-gray-500">{u.email}</div>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex flex-wrap gap-1">
                                        {u.user_roles?.length ? u.user_roles.map((ur) => (
                                            <span key={ur.role_id} className="px-2 py-0.5 bg-blue-50 text-blue-700 text-[10px] font-bold rounded uppercase tracking-wider border border-blue-100">
                                                {ur.role?.name ?? '—'}
                                            </span>
                                        )) : <span className="text-xs text-gray-400">—</span>}
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-600">{u.site?.name || 'Global'}</td>
                                <td className="px-6 py-4">
                                    <button
                                        type="button"
                                        onClick={() => handleToggleActive(u)}
                                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest ${u.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}
                                        title="Click to toggle"
                                    >
                                        {u.is_active ? 'Active' : 'Inactive'}
                                    </button>
                                </td>
                                <td className="px-6 py-4 text-right space-x-2">
                                    <button
                                        onClick={() => { setResettingUser(u); setError(null); }}
                                        className="text-xs font-bold text-blue-600 hover:text-blue-800 uppercase tracking-tight"
                                    >
                                        Reset
                                    </button>
                                    <button
                                        onClick={() => { setEditingUser(u); setError(null); setIsModalOpen(true); }}
                                        className="text-blue-600 hover:text-blue-800 text-sm font-semibold"
                                    >
                                        Edit
                                    </button>
                                    <button
                                        onClick={() => handleDelete(u)}
                                        className="text-red-600 hover:text-red-800 text-sm font-semibold"
                                    >
                                        Delete
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {totalPages > 1 && (
                    <div className="flex items-center justify-between px-6 py-3 border-t border-gray-100 bg-gray-50">
                        <p className="text-xs text-gray-500">
                            Page {page} of {totalPages} ({total} total)
                        </p>
                        <div className="flex gap-2">
                            <button
                                type="button"
                                disabled={page <= 1}
                                onClick={() => setPage((p) => Math.max(1, p - 1))}
                                className="px-3 py-1.5 text-xs font-semibold border rounded-lg disabled:opacity-40"
                            >
                                Previous
                            </button>
                            <button
                                type="button"
                                disabled={page >= totalPages}
                                onClick={() => setPage((p) => p + 1)}
                                className="px-3 py-1.5 text-xs font-semibold border rounded-lg disabled:opacity-40"
                            >
                                Next
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden transform transition-all my-8">
                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                            <h3 className="text-lg font-bold text-gray-900">{editingUser ? 'Edit User' : 'Add New User'}</h3>
                            <button type="button" onClick={() => { setError(null); setIsModalOpen(false); }} className="text-gray-400 hover:text-gray-600">✕</button>
                        </div>
                        <form onSubmit={handleSave} className="p-6 space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">Full Name</label>
                                    <input name="name" defaultValue={editingUser?.name} required className="w-full px-3 py-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">Email Address</label>
                                    <input name="email" type="email" defaultValue={editingUser?.email} required disabled={!!editingUser} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">{editingUser ? 'New Password (Optional)' : 'Password'}</label>
                                    <input name="password" type="password" required={!editingUser} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">Employee ID</label>
                                    <input name="employee_id" defaultValue={editingUser?.employee_id ?? ''} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">Assigned Site</label>
                                    <select name="site_id" defaultValue={editingUser?.site_id || ''} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                                        <option value="">Global / All Sites</option>
                                        {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">Position / Job Title</label>
                                    <input name="position" defaultValue={editingUser?.position ?? ''} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-3 underline">Roles & Permissions</label>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                    {roles.map((r) => (
                                        <label key={r.id} className="flex items-center gap-2 p-2 rounded-lg border border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors">
                                            <input
                                                type="checkbox"
                                                name="role_ids"
                                                value={r.id}
                                                defaultChecked={editingUser?.user_roles?.some((ur) => ur.role_id === r.id)}
                                                className="rounded text-blue-600"
                                            />
                                            <span className="text-xs font-medium text-gray-700">{r.name}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <input type="checkbox" name="is_active" defaultChecked={editingUser?.is_active ?? true} id="is_active" className="rounded text-blue-600" />
                                <label htmlFor="is_active" className="text-sm font-medium text-gray-700">Account Active</label>
                            </div>

                            {error && (
                                <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                                    <span className="text-red-500 flex-shrink-0 mt-0.5">⚠</span>
                                    <p className="text-sm text-red-700">{error}</p>
                                </div>
                            )}

                            <div className="flex justify-end gap-3 pt-4">
                                <button type="button" onClick={() => { setError(null); setIsModalOpen(false); }} className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">Cancel</button>
                                <button type="submit" disabled={saving} className="px-6 py-2 bg-blue-600 text-white text-sm font-bold rounded-lg hover:bg-blue-700 shadow-lg shadow-blue-200 disabled:opacity-50 disabled:cursor-not-allowed">
                                    {saving ? (editingUser ? 'Saving…' : 'Creating User…') : 'Save User'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {resettingUser && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                            <h3 className="text-lg font-bold text-gray-900">Reset Password</h3>
                            <button type="button" onClick={() => { setError(null); setResettingUser(null); }} className="text-gray-400 hover:text-gray-600">✕</button>
                        </div>
                        <form onSubmit={handleResetPassword} className="p-6 space-y-6">
                            <p className="text-sm text-gray-600">
                                Set a new password for <span className="font-bold text-gray-900">{resettingUser.name}</span>
                            </p>
                            <div>
                                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">New Password</label>
                                <input
                                    type="password"
                                    required
                                    value={newPass}
                                    onChange={(e) => setNewPass(e.target.value)}
                                    placeholder="Min 8 characters"
                                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                    autoFocus
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">Confirm New Password</label>
                                <input
                                    type="password"
                                    required
                                    value={confirmPass}
                                    onChange={(e) => setConfirmPass(e.target.value)}
                                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                />
                            </div>
                            {error && (
                                <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                                    <p className="text-sm text-red-700">{error}</p>
                                </div>
                            )}
                            <div className="flex justify-end gap-3">
                                <button type="button" onClick={() => { setError(null); setResettingUser(null); }} className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
                                <button type="submit" disabled={saving} className="px-6 py-2 bg-blue-600 text-white text-sm font-bold rounded-lg hover:bg-blue-700 disabled:opacity-50">
                                    {saving ? 'Resetting...' : 'Update Password'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
