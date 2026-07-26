'use client';

import { Fragment, useMemo, useState } from 'react';
import useSWR from 'swr';

const fetcher = async (url: string) => {
    const res = await fetch(url);
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
    return data;
};

type RegistryItem = {
    key: string;
    name: string;
    description: string;
    modules: string[];
};

type FlagRow = {
    id: string;
    key: string;
    name: string;
    description: string | null;
    is_enabled: boolean;
    modules: string[];
    registered: boolean;
    usage: { tenant_override_count: number; tenants_with_override: number };
    tenant_overrides: Array<{
        organization_id: string;
        organization_name: string;
        organization_slug: string | null;
        is_enabled: boolean;
    }>;
};

export default function FeatureFlagsPage() {
    const { data, error, mutate } = useSWR('/api/admin/features', fetcher);
    const [expanded, setExpanded] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [createKey, setCreateKey] = useState('');
    const [msg, setMsg] = useState<string | null>(null);

    const flags: FlagRow[] = Array.isArray(data?.flags) ? data.flags : [];
    const registry: RegistryItem[] = Array.isArray(data?.registry) ? data.registry : [];

    const missingFromDb = useMemo(() => {
        const existing = new Set(flags.map((f) => f.key));
        return registry.filter((r) => !existing.has(r.key));
    }, [flags, registry]);

    async function handleToggle(id: string, currentStatus: boolean) {
        setMsg(null);
        try {
            const res = await fetch(`/api/admin/features/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ is_enabled: !currentStatus }),
            });
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                setMsg(body.error || 'Failed to toggle flag');
                return;
            }
            mutate();
        } catch {
            setMsg('Failed to toggle flag');
        }
    }

    async function createFromRegistry(key: string) {
        setLoading(true);
        setMsg(null);
        try {
            const res = await fetch('/api/admin/features', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key, is_enabled: true }),
            });
            const body = await res.json().catch(() => ({}));
            if (!res.ok) {
                setMsg(body.error || 'Failed to create flag');
                return;
            }
            setCreateKey('');
            mutate();
        } catch {
            setMsg('Failed to create flag');
        } finally {
            setLoading(false);
        }
    }

    async function seedMissing() {
        setLoading(true);
        setMsg(null);
        try {
            for (const item of missingFromDb) {
                await fetch('/api/admin/features', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ key: item.key, is_enabled: true }),
                });
            }
            mutate();
        } catch {
            setMsg('Failed to seed registered flags');
        } finally {
            setLoading(false);
        }
    }

    if (error) {
        return <div className="p-8 text-red-500 font-medium">Failed to load platform settings.</div>;
    }
    if (!data) {
        return (
            <div className="p-8 text-gray-500 animate-pulse font-medium">
                Loading platform configurations...
            </div>
        );
    }

    return (
        <div className="p-8 max-w-5xl mx-auto space-y-8">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Platform Feature Flags</h1>
                    <p className="text-gray-500 mt-1 max-w-2xl">
                        Registered modules only — orphan keys cannot be created. Review usage, tenant overrides, and
                        affected modules below.
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    {missingFromDb.length > 0 && (
                        <button
                            onClick={seedMissing}
                            disabled={loading}
                            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                        >
                            Seed {missingFromDb.length} registered
                        </button>
                    )}
                </div>
            </div>

            {msg && (
                <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800">{msg}</div>
            )}

            {missingFromDb.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
                    <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
                        Add registered flag
                    </h2>
                    <p className="text-xs text-gray-500">
                        Only keys from the platform registry are allowed (prevents orphan feature flags).
                    </p>
                    <div className="flex flex-col sm:flex-row gap-2">
                        <select
                            value={createKey}
                            onChange={(e) => setCreateKey(e.target.value)}
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        >
                            <option value="">Select registered module…</option>
                            {missingFromDb.map((r) => (
                                <option key={r.key} value={r.key}>
                                    {r.name} ({r.key})
                                </option>
                            ))}
                        </select>
                        <button
                            disabled={!createKey || loading}
                            onClick={() => createFromRegistry(createKey)}
                            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                        >
                            Create
                        </button>
                    </div>
                </div>
            )}

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden text-sm">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                            <th className="px-6 py-4 font-bold text-gray-500 uppercase tracking-wider text-[11px]">
                                Feature
                            </th>
                            <th className="px-6 py-4 font-bold text-gray-500 uppercase tracking-wider text-[11px]">
                                Modules
                            </th>
                            <th className="px-6 py-4 font-bold text-gray-500 uppercase tracking-wider text-[11px] text-center">
                                Global
                            </th>
                            <th className="px-6 py-4 font-bold text-gray-500 uppercase tracking-wider text-[11px] text-center">
                                Usage
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {flags.map((flag) => {
                            const open = expanded === flag.key;
                            return (
                                <Fragment key={flag.key}>
                                    <tr className="hover:bg-gray-50">
                                        <td className="px-6 py-4">
                                            <button
                                                type="button"
                                                onClick={() => setExpanded(open ? null : flag.key)}
                                                className="text-left"
                                            >
                                                <div className="font-semibold text-gray-900">{flag.name}</div>
                                                <div className="text-gray-500 font-mono text-[11px] mt-0.5">
                                                    {flag.key}
                                                </div>
                                                {flag.description && (
                                                    <p className="text-gray-400 mt-1 line-clamp-1">{flag.description}</p>
                                                )}
                                            </button>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-wrap gap-1">
                                                {(flag.modules || []).map((m) => (
                                                    <span
                                                        key={m}
                                                        className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-medium"
                                                    >
                                                        {m}
                                                    </span>
                                                ))}
                                                {(!flag.modules || flag.modules.length === 0) && (
                                                    <span className="text-xs text-gray-400">—</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <button
                                                onClick={() => handleToggle(flag.id, flag.is_enabled)}
                                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                                    flag.is_enabled ? 'bg-blue-600' : 'bg-gray-200'
                                                }`}
                                            >
                                                <span
                                                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                                        flag.is_enabled ? 'translate-x-6' : 'translate-x-1'
                                                    }`}
                                                />
                                            </button>
                                            <div
                                                className={`mt-1.5 text-[10px] font-bold uppercase tracking-widest ${
                                                    flag.is_enabled ? 'text-blue-600' : 'text-gray-400'
                                                }`}
                                            >
                                                {flag.is_enabled ? 'Enabled' : 'Disabled'}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <button
                                                type="button"
                                                onClick={() => setExpanded(open ? null : flag.key)}
                                                className="px-2 py-1 bg-gray-100 rounded text-gray-600 font-medium text-[11px] hover:bg-gray-200"
                                            >
                                                {flag.usage?.tenant_override_count ?? 0} overrides
                                            </button>
                                        </td>
                                    </tr>
                                    {open && (
                                        <tr className="bg-slate-50/80">
                                            <td colSpan={4} className="px-6 py-4">
                                                <div className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
                                                    Tenant overrides
                                                </div>
                                                {flag.tenant_overrides?.length ? (
                                                    <ul className="space-y-2">
                                                        {flag.tenant_overrides.map((o) => (
                                                            <li
                                                                key={o.organization_id}
                                                                className="flex items-center justify-between text-sm bg-white border border-gray-200 rounded-lg px-3 py-2"
                                                            >
                                                                <span className="font-medium text-gray-800">
                                                                    {o.organization_name}
                                                                    {o.organization_slug && (
                                                                        <span className="ml-2 text-[11px] font-mono text-gray-400">
                                                                            {o.organization_slug}
                                                                        </span>
                                                                    )}
                                                                </span>
                                                                <span
                                                                    className={`text-[11px] font-bold uppercase ${
                                                                        o.is_enabled
                                                                            ? 'text-emerald-600'
                                                                            : 'text-rose-600'
                                                                    }`}
                                                                >
                                                                    {o.is_enabled ? 'Enabled' : 'Disabled'}
                                                                </span>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                ) : (
                                                    <p className="text-sm text-gray-400">
                                                        No tenant overrides. All tenants inherit the global status.
                                                    </p>
                                                )}
                                            </td>
                                        </tr>
                                    )}
                                </Fragment>
                            );
                        })}
                        {flags.length === 0 && (
                            <tr>
                                <td colSpan={4} className="px-6 py-16 text-center text-gray-400 italic">
                                    No flags in the database yet. Seed registered modules to begin.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            <div className="bg-blue-50/50 p-6 rounded-xl border border-blue-100">
                <h3 className="text-sm font-bold text-blue-900 uppercase tracking-widest mb-2">Registry</h3>
                <p className="text-sm text-blue-800 leading-relaxed opacity-90">
                    Allowed keys: {registry.map((r) => r.key).join(', ') || '—'}. Creation of unlisted keys is rejected
                    by the API.
                </p>
            </div>
        </div>
    );
}
