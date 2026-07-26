'use client';

import Link from 'next/link';
import { useState } from 'react';

const STATUS_STYLE: Record<string, string> = {
    active: 'bg-green-100 text-green-700',
    trial: 'bg-blue-100 text-blue-700',
    suspended: 'bg-red-100 text-red-700',
    terminated: 'bg-gray-100 text-gray-500',
};

export function TenantListClient({ orgs }: { orgs: any[] }) {
    const [search, setSearch] = useState('');

    const filtered = orgs.filter(
        (o) =>
            o.name?.toLowerCase().includes(search.toLowerCase()) ||
            o.slug?.toLowerCase().includes(search.toLowerCase())
    );

    const daysUntilExpiry = (date: string | null) => {
        if (!date) return null;
        const diff = new Date(date).getTime() - Date.now();
        return Math.ceil(diff / (1000 * 60 * 60 * 24));
    };

    const expiryBadge = (date: string | null) => {
        const days = daysUntilExpiry(date);
        if (days === null) return null;
        if (days < 0) return { label: 'Expired', class: 'bg-red-100 text-red-700' };
        if (days <= 7) return { label: `${days}d left`, class: 'bg-red-100 text-red-700' };
        if (days <= 14) return { label: `${days}d left`, class: 'bg-amber-100 text-amber-700' };
        if (days <= 30) return { label: `${days}d left`, class: 'bg-yellow-100 text-yellow-700' };
        if (days <= 60) return { label: `${days}d left`, class: 'bg-blue-100 text-blue-700' };
        return null;
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold text-gray-900">Tenant Management</h1>
                    <p className="text-sm text-gray-500 mt-0.5">
                        {orgs.length} organisation{orgs.length !== 1 ? 's' : ''} registered on the platform
                    </p>
                </div>
                <Link
                    href="/platform/tenants/new"
                    className="px-4 py-2 bg-[#0D2137] text-white text-sm font-medium rounded-lg hover:bg-[#1a3a5c] flex items-center gap-2"
                >
                    + New Tenant
                </Link>
            </div>

            <div className="grid grid-cols-4 gap-4">
                {[
                    {
                        label: 'Active',
                        count: orgs.filter((o) => o.status === 'active' || !o.status).length,
                        color: 'text-green-600',
                    },
                    {
                        label: 'Trial',
                        count: orgs.filter((o) => o.status === 'trial').length,
                        color: 'text-blue-600',
                    },
                    {
                        label: 'Expiring (30d)',
                        count: orgs.filter((o) => {
                            const d = daysUntilExpiry(o.contract_end_date);
                            return d !== null && d >= 0 && d <= 30;
                        }).length,
                        color: 'text-amber-600',
                    },
                    {
                        label: 'Suspended',
                        count: orgs.filter((o) => o.status === 'suspended').length,
                        color: 'text-red-600',
                    },
                ].map((stat) => (
                    <div
                        key={stat.label}
                        className="bg-white rounded-xl border border-gray-200 p-4 text-center"
                    >
                        <div className={`text-2xl font-bold ${stat.color}`}>{stat.count}</div>
                        <div className="text-xs text-gray-500 mt-1">{stat.label}</div>
                    </div>
                ))}
            </div>

            <div className="relative">
                <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search tenants..."
                    className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-blue-500 bg-white"
                />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <table className="w-full">
                    <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Organisation</th>
                            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Contract Expiry</th>
                            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Plan</th>
                            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Users</th>
                            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Workpacks</th>
                            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Account Mgr</th>
                            <th className="px-4 py-3"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {filtered.map((org) => {
                            const badge = expiryBadge(org.contract_end_date);
                            const statusStyle = STATUS_STYLE[org.status as string] ?? STATUS_STYLE.active;
                            return (
                                <tr key={org.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-4 py-3">
                                        <div className="font-medium text-gray-900 text-sm">{org.name}</div>
                                        <div className="text-xs text-gray-400">
                                            {org.slug ?? '—'} · {org.industry ?? 'Unknown'}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusStyle}`}>
                                            {org.status ?? 'active'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="text-sm text-gray-700">
                                            {org.contract_end_date
                                                ? new Date(org.contract_end_date).toLocaleDateString('en-GB', {
                                                      day: 'numeric',
                                                      month: 'short',
                                                      year: 'numeric',
                                                  })
                                                : <span className="text-gray-400">—</span>}
                                        </div>
                                        {badge && (
                                            <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${badge.class}`}>
                                                {badge.label}
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className="text-sm text-gray-600 capitalize">
                                            {org.plan_tier ?? 'professional'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-sm text-gray-600">
                                        {org._count?.users ?? 0}
                                        {org.max_users != null && (
                                            <span className="text-gray-400">/{org.max_users}</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-gray-600">
                                        {org._count?.workpacks ?? 0}
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className="text-xs text-gray-500">{org.account_manager ?? '—'}</span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <Link
                                            href={`/platform/tenants/${org.id}`}
                                            className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                                        >
                                            Manage →
                                        </Link>
                                    </td>
                                </tr>
                            );
                        })}
                        {filtered.length === 0 && (
                            <tr>
                                <td colSpan={8} className="px-4 py-8 text-center text-sm text-gray-400">
                                    No tenants found
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
