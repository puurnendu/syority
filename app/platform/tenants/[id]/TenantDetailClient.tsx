'use client';

import Link from 'next/link';
import { useState } from 'react';

const STATUS_STYLE: Record<string, string> = {
    active: 'bg-green-100 text-green-700',
    trial: 'bg-blue-100 text-blue-700',
    suspended: 'bg-red-100 text-red-700',
    terminated: 'bg-gray-100 text-gray-500',
};

type TabId = 'overview' | 'users' | 'usage' | 'billing' | 'danger';

export function TenantDetailClient({ org }: { org: any }) {
    const safeOrg = {
        ...org,
        status: org.status ?? 'active',
        plan_tier: org.plan_tier ?? 'professional',
        payment_status: org.payment_status ?? 'active',
        contract_start_date: org.contract_start_date ?? null,
        contract_end_date: org.contract_end_date ?? null,
        contract_value: org.contract_value ?? null,
        account_manager: org.account_manager ?? '',
        notes: org.notes ?? '',
        feature_flags: org.feature_flags ?? {},
        billing_logs: org.billing_logs ?? [],
        users: org.users ?? [],
        sites: org.sites ?? [],
        _count: org._count ?? { workpacks: 0, activities: 0, users: 0, sites: 0 },
    };

    const [tab, setTab] = useState<TabId>('overview');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const [contractStart, setContractStart] = useState(
        safeOrg.contract_start_date ? String(safeOrg.contract_start_date).slice(0, 10) : ''
    );
    const [contractEnd, setContractEnd] = useState(
        safeOrg.contract_end_date ? String(safeOrg.contract_end_date).slice(0, 10) : ''
    );
    const [contractValue, setContractValue] = useState(safeOrg.contract_value?.toString() ?? '');
    const [planTier, setPlanTier] = useState(safeOrg.plan_tier ?? 'professional');
    const [status, setStatus] = useState(safeOrg.status ?? 'active');
    const [paymentStatus, setPaymentStatus] = useState(safeOrg.payment_status ?? 'active');
    const [accountManager, setAccountManager] = useState(safeOrg.account_manager ?? '');
    const [notes, setNotes] = useState(safeOrg.notes ?? '');
    const [resetUser, setResetUser] = useState<any>(null);
    const [resetPass, setResetPass] = useState('');
    const [confirmPass, setConfirmPass] = useState('');
    const [resetting, setResetting] = useState(false);
    const [enteringProxy, setEnteringProxy] = useState(false);

    const [flags, setFlags] = useState({
        can_use_ai: false,
        can_export_xml: true,
        can_use_portfolio: false,
        can_use_operations: false,
        ...(typeof safeOrg.feature_flags === 'object' && safeOrg.feature_flags ? safeOrg.feature_flags : {}),
    });

    async function handleSaveOverview() {
        setSaving(true);
        setError(null);
        try {
            const res = await fetch(`/api/admin/tenants/${safeOrg.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contract_start_date: contractStart || null,
                    contract_end_date: contractEnd || null,
                    contract_value: contractValue ? parseFloat(contractValue) : null,
                    plan_tier: planTier,
                    status,
                    payment_status: paymentStatus,
                    account_manager: accountManager,
                    notes,
                    feature_flags: flags,
                }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || 'Failed to update');
            setSuccess('Tenant updated successfully');
            setTimeout(() => setSuccess(null), 3000);
        } catch (e: any) {
            setError(e.message || 'Failed to save');
        } finally {
            setSaving(false);
        }
    }

    async function handleSuspend() {
        if (!confirm(`Suspend ${safeOrg.name}? Users will lose access.`)) return;
        try {
            const res = await fetch(`/api/admin/tenants/${safeOrg.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    status: 'suspended',
                    suspended_at: new Date().toISOString(),
                    suspension_reason: prompt('Reason for suspension:') || undefined,
                }),
            });
            if (res.ok) {
                setStatus('suspended');
                setSuccess('Account suspended');
                setTimeout(() => setSuccess(null), 3000);
            } else {
                const data = await res.json().catch(() => ({}));
                setError(data.error || 'Failed to suspend');
            }
        } catch (e: any) {
            setError(e.message);
        }
    }

    async function handleEnterProxy() {
        setEnteringProxy(true);
        setError(null);
        try {
            const res = await fetch('/api/proxy/enter', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tenant_id: safeOrg.id }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || 'Failed to enter proxy mode');
            window.location.href = '/dashboard';
        } catch (e: any) {
            setError(e.message || 'Failed to enter proxy mode');
            setEnteringProxy(false);
        }
    }

    async function handleResetPassword(e: React.FormEvent) {
        e.preventDefault();
        if (!resetUser) return;
        if (resetPass !== confirmPass) {
            setError('Passwords do not match');
            return;
        }
        if (resetPass.length < 8) {
            setError('Password must be at least 8 characters');
            return;
        }

        setResetting(true);
        setError(null);
        try {
            const res = await fetch(`/api/admin/users/${resetUser.id}/reset-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ new_password: resetPass })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to reset password');

            setSuccess(`Password for ${resetUser.name} has been reset.`);
            setTimeout(() => {
                setSuccess(null);
                setResetUser(null);
                setResetPass('');
                setConfirmPass('');
            }, 3000);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setResetting(false);
        }
    }

    const tabs: { id: TabId; label: string }[] = [
        { id: 'overview', label: 'Overview' },
        { id: 'users', label: `Users (${safeOrg.users?.length ?? 0})` },
        { id: 'usage', label: 'Usage' },
        { id: 'billing', label: 'Billing' },
        { id: 'danger', label: '⚠ Danger Zone' },
    ];

    return (
        <div className="space-y-6">
            <div>
                <Link href="/platform/tenants" className="text-sm text-gray-500 hover:text-gray-700">
                    ← Tenants
                </Link>
                <div className="flex items-start justify-between mt-3 gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">{safeOrg.name}</h1>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="text-sm text-gray-500">
                                {safeOrg.industry ?? '—'} · {safeOrg.country ?? '—'}
                            </span>
                            <span
                                className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                                    STATUS_STYLE[safeOrg.status as string] ?? 'bg-green-100 text-green-700'
                                }`}
                            >
                                {safeOrg.status ?? 'active'}
                            </span>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={handleEnterProxy}
                        disabled={enteringProxy || status === 'suspended' || status === 'terminated'}
                        className="shrink-0 px-4 py-2 bg-amber-600 text-white text-sm font-semibold rounded-lg hover:bg-amber-700 disabled:opacity-50 shadow-sm"
                        title="Impersonate this tenant — all actions are audited"
                    >
                        {enteringProxy ? 'Entering…' : 'Enter Proxy Mode'}
                    </button>
                </div>
            </div>

            <div className="flex gap-1 border-b border-gray-200">
                {tabs.map((t) => (
                    <button
                        key={t.id}
                        onClick={() => setTab(t.id)}
                        className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                            tab === t.id
                                ? 'border-blue-600 text-blue-700'
                                : 'border-transparent text-gray-500 hover:text-gray-800'
                        } ${t.id === 'danger' ? 'text-red-500' : ''}`}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            {success && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
                    ✓ {success}
                </div>
            )}
            {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                    ⚠ {error}
                </div>
            )}

            {tab === 'overview' && (
                <div className="space-y-5">
                    <div className="bg-white rounded-xl border border-gray-200 p-5">
                        <h3 className="font-semibold text-gray-900 mb-4">Contract</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1 block">Contract Start</label>
                                <input
                                    type="date"
                                    value={contractStart}
                                    onChange={(e) => setContractStart(e.target.value)}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1 block">Contract End</label>
                                <input
                                    type="date"
                                    value={contractEnd}
                                    onChange={(e) => setContractEnd(e.target.value)}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1 block">Annual Value (USD)</label>
                                <input
                                    type="number"
                                    value={contractValue}
                                    onChange={(e) => setContractValue(e.target.value)}
                                    placeholder="e.g. 48000"
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1 block">Payment Status</label>
                                <select
                                    value={paymentStatus}
                                    onChange={(e) => setPaymentStatus(e.target.value)}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                                >
                                    <option value="active">Active / Paid</option>
                                    <option value="pending">Pending</option>
                                    <option value="overdue">Overdue</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl border border-gray-200 p-5">
                        <h3 className="font-semibold text-gray-900 mb-4">Plan & Status</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1 block">Plan Tier</label>
                                <select
                                    value={planTier}
                                    onChange={(e) => setPlanTier(e.target.value)}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                                >
                                    <option value="starter">Starter</option>
                                    <option value="professional">Professional</option>
                                    <option value="enterprise">Enterprise</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1 block">Account Status</label>
                                <select
                                    value={status}
                                    onChange={(e) => setStatus(e.target.value)}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                                >
                                    <option value="trial">Trial</option>
                                    <option value="active">Active</option>
                                    <option value="suspended">Suspended</option>
                                </select>
                            </div>
                        </div>
                        <div className="mt-4">
                            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 block">Feature Flags</label>
                            <div className="grid grid-cols-2 gap-2">
                                {Object.entries(flags).map(([key, val]) => (
                                    <label key={key} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={Boolean(val)}
                                            onChange={(e) => setFlags((f: Record<string, boolean>) => ({ ...f, [key]: e.target.checked }))}
                                            className="rounded text-blue-600"
                                        />
                                        {key.replace(/_/g, ' ')}
                                    </label>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl border border-gray-200 p-5">
                        <h3 className="font-semibold text-gray-900 mb-4">Account Details</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1 block">Account Manager</label>
                                <input
                                    type="text"
                                    value={accountManager}
                                    onChange={(e) => setAccountManager(e.target.value)}
                                    placeholder="Your team member"
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                                />
                            </div>
                        </div>
                        <div className="mt-4">
                            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1 block">Internal Notes</label>
                            <textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                rows={3}
                                placeholder="Notes visible to SYORITY team only..."
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none"
                            />
                        </div>
                    </div>

                    <div className="flex justify-end">
                        <button
                            onClick={handleSaveOverview}
                            disabled={saving}
                            className="px-5 py-2 bg-[#0D2137] text-white text-sm font-medium rounded-lg hover:bg-[#1a3a5c] disabled:opacity-50"
                        >
                            {saving ? 'Saving…' : 'Save Changes'}
                        </button>
                    </div>
                </div>
            )}

            {tab === 'users' && (
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-gray-50 border-b border-gray-200">
                                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Name</th>
                                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Email</th>
                                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Role</th>
                                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Last Login</th>
                                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {(safeOrg.users || []).map((u: any) => (
                                <tr key={u.id} className="hover:bg-gray-50">
                                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{u.name}</td>
                                    <td className="px-4 py-3 text-sm text-gray-600">{u.email}</td>
                                    <td className="px-4 py-3">
                                        <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded capitalize">
                                            {String(u.role ?? '—').replace('_', ' ')}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span
                                            className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                                u.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                                            }`}
                                        >
                                            {u.is_active ? 'Active' : 'Inactive'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-xs text-gray-400">
                                        {u.last_login_at
                                            ? new Date(u.last_login_at).toLocaleDateString('en-GB')
                                            : 'Never'}
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <button
                                            onClick={() => { setResetUser(u); setError(null); }}
                                            className="text-xs font-bold text-blue-600 hover:text-blue-800 uppercase tracking-tight"
                                        >
                                            Reset Password
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {tab === 'usage' && (
                <div className="grid grid-cols-3 gap-4">
                    {[
                        { label: 'Workpacks', value: safeOrg._count?.workpacks ?? 0 },
                        { label: 'Activities', value: safeOrg._count?.activities ?? 0 },
                        { label: 'Users', value: safeOrg.users?.length ?? 0 },
                        { label: 'Sites', value: safeOrg.sites?.length ?? 0 },
                    ].map((stat) => (
                        <div
                            key={stat.label}
                            className="bg-white rounded-xl border border-gray-200 p-5 text-center"
                        >
                            <div className="text-3xl font-bold text-gray-900">{stat.value}</div>
                            <div className="text-sm text-gray-500 mt-1">{stat.label}</div>
                        </div>
                    ))}
                </div>
            )}

            {tab === 'billing' && (
                <BillingTab
                    orgId={safeOrg.id}
                    billingLogs={safeOrg.billing_logs ?? []}
                    contractValue={safeOrg.contract_value}
                />
            )}

            {tab === 'danger' && (
                <div className="space-y-4">
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                        <h3 className="font-semibold text-amber-800 mb-1">⚠ Danger Zone</h3>
                        <p className="text-sm text-amber-700">Actions here affect the client&apos;s access immediately.</p>
                    </div>
                    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
                        <div className="flex items-center justify-between py-3 border-b border-gray-100">
                            <div>
                                <p className="font-medium text-gray-900 text-sm">Suspend Account</p>
                                <p className="text-xs text-gray-500 mt-0.5">Users lose access immediately. Data preserved.</p>
                            </div>
                            <button
                                onClick={handleSuspend}
                                className="px-4 py-2 bg-amber-500 text-white text-sm font-medium rounded-lg hover:bg-amber-600"
                            >
                                Suspend
                            </button>
                        </div>
                        <div className="flex items-center justify-between py-3">
                            <div>
                                <p className="font-medium text-green-700 text-sm">Reactivate Account</p>
                                <p className="text-xs text-gray-500 mt-0.5">Restore access for suspended account.</p>
                            </div>
                            <button
                                onClick={async () => {
                                    const res = await fetch(`/api/admin/tenants/${safeOrg.id}`, {
                                        method: 'PATCH',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ status: 'active' }),
                                    });
                                    if (res.ok) {
                                        setStatus('active');
                                        setSuccess('Account reactivated');
                                        setTimeout(() => setSuccess(null), 3000);
                                    }
                                }}
                                className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700"
                            >
                                Reactivate
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {resetUser && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                            <h3 className="text-base font-bold text-gray-900 tracking-tight">Reset Password</h3>
                            <button onClick={() => setResetUser(null)} className="text-gray-400 hover:text-gray-600 text-xl font-light">✕</button>
                        </div>
                        <form onSubmit={handleResetPassword} className="p-6 space-y-4">
                            <div>
                                <p className="text-sm text-gray-600 mb-4">
                                    Resetting password for <span className="font-bold text-[#0D2137]">{resetUser.name}</span>
                                </p>
                                <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5 font-bold text-gray-500 tracking-wide uppercase">New Password</label>
                                <input
                                    type="password"
                                    required
                                    value={resetPass}
                                    onChange={(e) => setResetPass(e.target.value)}
                                    placeholder="Min 8 characters"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all text-sm"
                                    autoFocus
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5 font-bold text-gray-500 tracking-wide uppercase">Confirm Password</label>
                                <input
                                    type="password"
                                    required
                                    value={confirmPass}
                                    onChange={(e) => setConfirmPass(e.target.value)}
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
                                    onClick={() => setResetUser(null)}
                                    className="px-4 py-2 text-xs font-bold text-gray-500 hover:bg-gray-100 rounded-lg transition-colors uppercase tracking-tight"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={resetting}
                                    className="px-6 py-2 bg-[#0D2137] text-white text-xs font-bold rounded-lg hover:bg-[#1a3a5c] shadow-lg shadow-blue-100 disabled:opacity-50 transition-all uppercase tracking-tight"
                                >
                                    {resetting ? 'Resetting…' : 'Update Password'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

function BillingTab({
    orgId,
    billingLogs,
    contractValue,
}: {
    orgId: string;
    billingLogs: any[];
    contractValue: number | null;
}) {
    const [logs, setLogs] = useState(billingLogs);
    const [adding, setAdding] = useState(false);
    const [form, setForm] = useState({
        payment_date: new Date().toISOString().slice(0, 10),
        amount: contractValue?.toString() ?? '',
        reference: '',
        notes: '',
    });
    const [saving, setSaving] = useState(false);

    async function addPayment() {
        setSaving(true);
        try {
            const res = await fetch(`/api/admin/tenants/${orgId}/billing`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...form,
                    amount: parseFloat(form.amount) || 0,
                    payment_date: new Date(form.payment_date).toISOString(),
                }),
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok && data.id) {
                setLogs((prev) => [{ ...data, payment_date: data.payment_date || form.payment_date }, ...prev]);
                setAdding(false);
                setForm({
                    payment_date: new Date().toISOString().slice(0, 10),
                    amount: contractValue?.toString() ?? '',
                    reference: '',
                    notes: '',
                });
            }
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h3 className="font-semibold text-gray-900">Payment History</h3>
                <button
                    onClick={() => setAdding(true)}
                    className="px-3 py-1.5 bg-[#0D2137] text-white text-sm rounded-lg"
                >
                    + Record Payment
                </button>
            </div>

            {adding && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
                    <h4 className="font-medium text-blue-900 text-sm">Record New Payment</h4>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-xs text-gray-600 mb-1 block">Payment Date</label>
                            <input
                                type="date"
                                value={form.payment_date}
                                onChange={(e) => setForm((f) => ({ ...f, payment_date: e.target.value }))}
                                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                            />
                        </div>
                        <div>
                            <label className="text-xs text-gray-600 mb-1 block">Amount (USD)</label>
                            <input
                                type="number"
                                value={form.amount}
                                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                            />
                        </div>
                        <div>
                            <label className="text-xs text-gray-600 mb-1 block">Invoice / Reference</label>
                            <input
                                type="text"
                                value={form.reference}
                                onChange={(e) => setForm((f) => ({ ...f, reference: e.target.value }))}
                                placeholder="INV-2026-001"
                                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                            />
                        </div>
                        <div>
                            <label className="text-xs text-gray-600 mb-1 block">Notes</label>
                            <input
                                type="text"
                                value={form.notes}
                                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                            />
                        </div>
                    </div>
                    <div className="flex gap-2 justify-end">
                        <button
                            onClick={() => setAdding(false)}
                            className="px-3 py-1.5 text-sm text-gray-600 border border-gray-300 rounded"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={addPayment}
                            disabled={saving}
                            className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded disabled:opacity-50"
                        >
                            {saving ? 'Saving…' : 'Record Payment'}
                        </button>
                    </div>
                </div>
            )}

            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <table className="w-full">
                    <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                            <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Date</th>
                            <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Amount</th>
                            <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Reference</th>
                            <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Recorded By</th>
                            <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Notes</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {logs.map((log: any) => (
                            <tr key={log.id}>
                                <td className="px-4 py-2 text-sm text-gray-700">
                                    {new Date(log.payment_date).toLocaleDateString('en-GB')}
                                </td>
                                <td className="px-4 py-2 text-sm font-medium text-gray-900">
                                    ${Number(log.amount)?.toLocaleString()}
                                </td>
                                <td className="px-4 py-2 text-sm text-gray-500">{log.reference ?? '—'}</td>
                                <td className="px-4 py-2 text-xs text-gray-400">{log.recorded_by ?? '—'}</td>
                                <td className="px-4 py-2 text-xs text-gray-400">{log.notes ?? '—'}</td>
                            </tr>
                        ))}
                        {logs.length === 0 && (
                            <tr>
                                <td colSpan={5} className="px-4 py-6 text-center text-sm text-gray-400">
                                    No payments recorded yet
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
