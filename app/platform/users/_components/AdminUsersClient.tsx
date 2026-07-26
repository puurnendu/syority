'use client';

import { useState } from 'react';
import Link from 'next/link';

type User = {
    id: string;
    name: string;
    email: string;
    is_active: boolean;
    last_login_at: Date | null;
    created_at: Date;
    organization_id: string;
    organization: { name: string; slug: string } | null;
    role: string;
};

type Org = { id: string; name: string; slug: string | null };

export function AdminUsersClient({ users: initialUsers, organizations }: { users: User[], organizations: Org[] }) {
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [transferringUser, setTransferringUser] = useState<User | null>(null);
    const [targetOrgId, setTargetOrgId] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isResetting, setIsResetting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    async function handleResetPassword(e: React.FormEvent) {
        e.preventDefault();
        if (!selectedUser) return;
        if (newPassword !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }
        if (newPassword.length < 8) {
            setError('Password must be at least 8 characters');
            return;
        }

        setIsResetting(true);
        setError(null);
        try {
            const res = await fetch(`/api/admin/users/${selectedUser.id}/reset-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ new_password: newPassword })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to reset password');

            setSuccess(`Password for ${selectedUser.name} has been reset.`);
            setTimeout(() => {
                setSuccess(null);
                setSelectedUser(null);
                setNewPassword('');
                setConfirmPassword('');
            }, 3000);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsResetting(false);
        }
    }

    async function handleTransfer() {
        if (!transferringUser || !targetOrgId) return;
        setIsResetting(true);
        setError(null);
        try {
            const res = await fetch(`/api/admin/users/${transferringUser.id}/transfer`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ target_organization_id: targetOrgId })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to transfer user');

            setSuccess(data.message);
            setTransferringUser(null);
            // We could update local state, but a refresh is cleaner for org name changes
            setTimeout(() => {
                window.location.reload();
            }, 1500);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsResetting(false);
        }
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-xl font-bold text-gray-900">All Users</h1>
                <p className="text-sm text-gray-500 mt-0.5">Users across all organisations.</p>
            </div>

            {success && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
                    ✓ {success}
                </div>
            )}

            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                <table className="w-full text-left">
                    <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                            <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Name</th>
                            <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Email</th>
                            <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Organisation</th>
                            <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Role</th>
                            <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                            <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Last Login</th>
                            <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {initialUsers.map((u) => (
                            <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                                <td className="px-4 py-3 text-sm font-medium text-gray-900">{u.name}</td>
                                <td className="px-4 py-3 text-sm text-gray-600">{u.email}</td>
                                <td className="px-4 py-3 text-sm text-gray-600">
                                    <Link href={`/admin/tenants/${u.organization_id}`} className="text-blue-600 hover:underline">
                                        {u.organization?.name ?? '—'}
                                    </Link>
                                </td>
                                <td className="px-4 py-3">
                                    <span className="text-[10px] bg-gray-100 text-gray-700 px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                                        {String(u.role).replace('_', ' ')}
                                    </span>
                                </td>
                                <td className="px-4 py-3">
                                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-widest ${u.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                        {u.is_active ? 'Active' : 'Inactive'}
                                    </span>
                                </td>
                                <td className="px-4 py-3 text-xs text-gray-400">
                                    {u.last_login_at ? new Date(u.last_login_at).toLocaleDateString('en-GB') : 'Never'}
                                </td>
                                <td className="px-4 py-3 text-right">
                                    <div className="flex items-center justify-end gap-3 text-[10px] font-black uppercase tracking-widest">
                                        <button
                                            onClick={() => { setSelectedUser(u); setError(null); }}
                                            className="text-blue-500 hover:text-blue-700 transition-colors"
                                        >
                                            Reset PW
                                        </button>
                                        <span className="text-gray-200">|</span>
                                        <button
                                            onClick={() => { setTransferringUser(u); setTargetOrgId(''); setError(null); }}
                                            className="text-orange-500 hover:text-orange-700 transition-colors"
                                        >
                                            Transfer
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {selectedUser && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                            <h3 className="text-base font-bold text-gray-900 tracking-tight">Reset Password</h3>
                            <button onClick={() => setSelectedUser(null)} className="text-gray-400 hover:text-gray-600 text-xl font-light">✕</button>
                        </div>
                        <form onSubmit={handleResetPassword} className="p-6 space-y-4">
                            <div>
                                <p className="text-sm text-gray-600 mb-4">
                                    Resetting password for <span className="font-bold text-[#0D2137]">{selectedUser.name}</span> (<span className="text-xs font-mono">{selectedUser.email}</span>)
                                </p>
                                <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5 font-bold">New Password</label>
                                <input
                                    type="password"
                                    required
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    placeholder="Min 8 characters"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all text-sm"
                                    autoFocus
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5 font-bold">Confirm New Password</label>
                                <input
                                    type="password"
                                    required
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all text-sm"
                                />
                            </div>

                            {error && (
                                <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-xs text-red-600 font-medium">
                                    ⚠ {error}
                                </div>
                            )}

                            <div className="flex justify-end gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setSelectedUser(null)}
                                    className="px-4 py-2 text-xs font-bold text-gray-500 hover:bg-gray-100 rounded-lg transition-colors uppercase tracking-tight"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isResetting}
                                    className="px-6 py-2 bg-[#0D2137] text-white text-xs font-bold rounded-lg hover:bg-[#1a3a5c] shadow-lg shadow-blue-100 disabled:opacity-50 transition-all uppercase tracking-tight"
                                >
                                    {isResetting ? 'Resetting…' : 'Update Password'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {transferringUser && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                            <div>
                                <h3 className="text-base font-bold text-gray-900 tracking-tight">Transfer User</h3>
                                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-0.5">Change Organization</p>
                            </div>
                            <button onClick={() => setTransferringUser(null)} className="text-gray-400 hover:text-gray-600 text-xl font-light">✕</button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="p-4 bg-orange-50/50 border border-orange-100 rounded-xl">
                                <p className="text-sm text-gray-600">
                                    Transferring <span className="font-bold text-[#0D2137]">{transferringUser.name}</span> from <span className="font-bold text-blue-600">{transferringUser.organization?.name}</span>
                                </p>
                                <p className="text-[10px] text-orange-600 font-bold uppercase tracking-widest mt-2">⚠️ Warning</p>
                                <p className="text-[10px] text-gray-500 mt-1 uppercase tracking-tight font-medium outline-none">Site access and permissions will be reset to default.</p>
                            </div>

                            <div>
                                <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5 font-bold">Target Organization</label>
                                <div className="relative">
                                    <select
                                        value={targetOrgId}
                                        onChange={(e) => setTargetOrgId(e.target.value)}
                                        className="w-full px-3 py-3 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all text-sm appearance-none bg-white font-medium pr-10"
                                    >
                                        <option value="">Select Organization...</option>
                                        {organizations.filter(o => o.id !== transferringUser.organization_id).map(org => (
                                            <option key={org.id} value={org.id}>{org.name}</option>
                                        ))}
                                    </select>
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                        </svg>
                                    </div>
                                </div>
                            </div>

                            {error && (
                                <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-xs text-red-600 font-medium font-bold">
                                    ⚠ {error}
                                </div>
                            )}

                            <div className="flex justify-end gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setTransferringUser(null)}
                                    className="px-4 py-2 text-xs font-bold text-gray-500 hover:bg-gray-100 rounded-lg transition-colors uppercase tracking-tight"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleTransfer}
                                    disabled={!targetOrgId || isResetting}
                                    className="px-6 py-2 bg-orange-600 text-white text-xs font-bold rounded-lg hover:bg-orange-700 shadow-lg shadow-orange-100 disabled:opacity-50 transition-all uppercase tracking-tight"
                                >
                                    {isResetting ? 'Transferring…' : 'Confirm Transfer'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
