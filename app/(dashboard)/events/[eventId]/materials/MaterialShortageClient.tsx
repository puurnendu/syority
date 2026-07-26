'use client';

import { useState, useEffect, useCallback } from 'react';

type WorkpackRef = {
    id: string;
    workpack_number: string | null;
    title: string;
    required: number;
    issued: number;
};

type MaterialItem = {
    key: string;
    item_catalog_id: string | null;
    item_code: string | null;
    sap_material_number: string | null;
    description: string;
    unit_of_measure: string;
    material_category: string;
    total_required: number;
    total_issued: number;
    shortage: number;
    is_shortage: boolean;
    unit_cost: number | null;
    total_value: number | null;
    workpacks: WorkpackRef[];
};

type Summary = {
    total_items: number;
    shortage_items: number;
    total_value: number;
    categories: string[];
    workpack_count: number;
};

type ApiResponse = {
    event: { id: string; name: string };
    summary: Summary;
    items: MaterialItem[];
};

const STATUS_COLORS: Record<string, string> = {
    not_requested: 'bg-gray-100 text-gray-600',
    requested: 'bg-blue-100 text-blue-700',
    reserved: 'bg-amber-100 text-amber-700',
    issued: 'bg-green-100 text-green-700',
    returned: 'bg-purple-100 text-purple-700',
};

function ShortageBar({ required, issued }: { required: number; issued: number }) {
    const pct = required > 0 ? Math.min(100, (issued / required) * 100) : 100;
    const isShort = issued < required;
    return (
        <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                    className={`h-full rounded-full transition-all ${isShort ? 'bg-red-400' : 'bg-green-400'}`}
                    style={{ width: `${pct}%` }}
                />
            </div>
            <span className={`text-xs font-mono font-medium ${isShort ? 'text-red-600' : 'text-green-600'}`}>
                {issued}/{required}
            </span>
        </div>
    );
}

export function MaterialShortageClient({
    eventId,
    eventName,
}: {
    eventId: string;
    eventName: string;
}) {
    const [data, setData] = useState<ApiResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('All');
    const [shortageOnly, setShortageOnly] = useState(false);
    const [search, setSearch] = useState('');
    const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const params = new URLSearchParams();
            if (shortageOnly) params.set('shortage_only', 'true');
            if (categoryFilter !== 'All') params.set('category', categoryFilter);
            const res = await fetch(`/api/events/${eventId}/materials?${params}`);
            if (!res.ok) throw new Error((await res.json()).error ?? 'Failed to load');
            setData(await res.json());
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Load failed');
        } finally {
            setLoading(false);
        }
    }, [eventId, shortageOnly, categoryFilter]);

    useEffect(() => { load(); }, [load]);

    const toggleExpand = (key: string) => {
        setExpandedKeys((prev) => {
            const next = new Set(prev);
            next.has(key) ? next.delete(key) : next.add(key);
            return next;
        });
    };

    const filtered = (data?.items ?? []).filter((item) => {
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        return (
            item.description.toLowerCase().includes(q) ||
            (item.item_code?.toLowerCase().includes(q) ?? false) ||
            (item.sap_material_number?.toLowerCase().includes(q) ?? false)
        );
    });

    const summary = data?.summary;

    return (
        <div className="flex flex-col gap-6 p-6 max-w-7xl mx-auto">
            {/* Header */}
            <div>
                <div className="flex items-center gap-2 text-xs text-gray-400 mb-1">
                    <a href="/events" className="hover:text-gray-600">Events</a>
                    <span>›</span>
                    <span>{eventName}</span>
                    <span>›</span>
                    <span className="text-gray-600 font-medium">Materials</span>
                </div>
                <h1 className="text-2xl font-bold text-gray-900">Material Shortage Dashboard</h1>
                <p className="text-sm text-gray-500 mt-0.5">
                    Aggregate materials across all workpacks in <span className="font-medium">{eventName}</span>
                </p>
            </div>

            {/* Summary KPI strip */}
            {summary && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {[
                        { label: 'Workpacks', value: summary.workpack_count, color: 'text-blue-600' },
                        { label: 'Total Items', value: summary.total_items, color: 'text-gray-700' },
                        {
                            label: 'Shortages',
                            value: summary.shortage_items,
                            color: summary.shortage_items > 0 ? 'text-red-600' : 'text-green-600',
                        },
                        {
                            label: 'Est. Value',
                            value: summary.total_value > 0
                                ? `$${summary.total_value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                                : '—',
                            color: 'text-gray-700',
                        },
                    ].map((kpi) => (
                        <div key={kpi.label} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                            <p className="text-xs text-gray-400 uppercase tracking-wider">{kpi.label}</p>
                            <p className={`text-2xl font-bold mt-1 ${kpi.color}`}>{kpi.value}</p>
                        </div>
                    ))}
                </div>
            )}

            {/* Filters */}
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 flex flex-wrap items-center gap-3">
                <input
                    id="material-search"
                    type="text"
                    placeholder="Search description, item code, SAP number…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="flex-1 min-w-48 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
                <div className="flex items-center gap-1.5 flex-wrap">
                    {['All', ...(data?.summary.categories ?? [])].map((cat) => (
                        <button
                            key={cat}
                            onClick={() => setCategoryFilter(cat)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                categoryFilter === cat
                                    ? 'bg-[#0D2137] text-white'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                        >
                            {cat}
                        </button>
                    ))}
                </div>
                <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                    <input
                        id="shortage-only-toggle"
                        type="checkbox"
                        checked={shortageOnly}
                        onChange={(e) => setShortageOnly(e.target.checked)}
                        className="rounded text-red-500"
                    />
                    Shortages only
                </label>
                <button
                    onClick={load}
                    className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-200"
                >
                    ↻ Refresh
                </button>
            </div>

            {/* Table */}
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                {loading && (
                    <div className="flex items-center justify-center h-48 text-sm text-gray-400">
                        Loading materials…
                    </div>
                )}
                {error && (
                    <div className="m-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                        {error}
                    </div>
                )}
                {!loading && !error && filtered.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-48 text-gray-400">
                        <span className="text-3xl mb-2">📦</span>
                        <p className="text-sm">No materials found</p>
                    </div>
                )}
                {!loading && filtered.length > 0 && (
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-gray-50 border-b border-gray-200 text-xs font-medium text-gray-500 uppercase tracking-wider">
                                <th className="px-4 py-3 text-left w-8"></th>
                                <th className="px-4 py-3 text-left">Description</th>
                                <th className="px-4 py-3 text-left">Item Code</th>
                                <th className="px-4 py-3 text-left">SAP #</th>
                                <th className="px-4 py-3 text-left">Category</th>
                                <th className="px-4 py-3 text-center">UoM</th>
                                <th className="px-4 py-3 text-right">Required</th>
                                <th className="px-4 py-3 text-right">Issued</th>
                                <th className="px-4 py-3 text-right">Shortage</th>
                                <th className="px-4 py-3 text-left" style={{ minWidth: 140 }}>Fulfilment</th>
                                <th className="px-4 py-3 text-right">Workpacks</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filtered.map((item) => {
                                const expanded = expandedKeys.has(item.key);
                                return (
                                    <>
                                        <tr
                                            key={item.key}
                                            className={`hover:bg-gray-50 cursor-pointer transition-colors ${
                                                item.is_shortage ? 'bg-red-50/40' : ''
                                            }`}
                                            onClick={() => toggleExpand(item.key)}
                                        >
                                            <td className="px-4 py-3 text-center text-gray-400 text-xs">
                                                {item.workpacks.length > 1 ? (expanded ? '▼' : '▶') : ''}
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    {item.is_shortage && (
                                                        <span className="inline-block w-2 h-2 rounded-full bg-red-500 shrink-0" title="Shortage" />
                                                    )}
                                                    <span className="font-medium text-gray-900 truncate max-w-xs">
                                                        {item.description}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-gray-500 font-mono text-xs">{item.item_code ?? '—'}</td>
                                            <td className="px-4 py-3 text-gray-500 font-mono text-xs">{item.sap_material_number ?? '—'}</td>
                                            <td className="px-4 py-3">
                                                <span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-600 capitalize">
                                                    {item.material_category}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-center text-gray-500">{item.unit_of_measure}</td>
                                            <td className="px-4 py-3 text-right font-mono font-medium text-gray-900">
                                                {item.total_required.toLocaleString()}
                                            </td>
                                            <td className="px-4 py-3 text-right font-mono text-gray-600">
                                                {item.total_issued.toLocaleString()}
                                            </td>
                                            <td className="px-4 py-3 text-right font-mono font-semibold">
                                                {item.shortage > 0 ? (
                                                    <span className="text-red-600">−{item.shortage.toLocaleString()}</span>
                                                ) : (
                                                    <span className="text-green-600">✓</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3">
                                                <ShortageBar required={item.total_required} issued={item.total_issued} />
                                            </td>
                                            <td className="px-4 py-3 text-right text-gray-500">
                                                {item.workpacks.length}
                                            </td>
                                        </tr>
                                        {expanded &&
                                            item.workpacks.map((wp) => (
                                                <tr
                                                    key={`${item.key}::${wp.id}`}
                                                    className="bg-gray-50/60 border-b border-gray-100"
                                                >
                                                    <td className="px-4 py-2" />
                                                    <td className="px-4 py-2 pl-8 text-xs text-gray-500" colSpan={5}>
                                                        <a
                                                            href={`/workpacks/${wp.id}`}
                                                            className="text-blue-600 hover:underline font-medium"
                                                            onClick={(e) => e.stopPropagation()}
                                                        >
                                                            {wp.workpack_number ?? wp.title}
                                                        </a>
                                                        {' '}— {wp.title}
                                                    </td>
                                                    <td className="px-4 py-2 text-right text-xs font-mono">{wp.required}</td>
                                                    <td className="px-4 py-2 text-right text-xs font-mono text-gray-500">{wp.issued}</td>
                                                    <td className="px-4 py-2 text-right text-xs font-mono">
                                                        {wp.required > wp.issued ? (
                                                            <span className="text-red-500">−{wp.required - wp.issued}</span>
                                                        ) : (
                                                            <span className="text-green-500">✓</span>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-2">
                                                        <ShortageBar required={wp.required} issued={wp.issued} />
                                                    </td>
                                                    <td />
                                                </tr>
                                            ))}
                                    </>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}
