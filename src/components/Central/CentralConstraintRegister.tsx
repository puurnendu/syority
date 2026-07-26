'use client';

import { useState, useEffect } from 'react';

export function CentralConstraintRegister() {
    const [items, setItems] = useState<any[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState({ status: '', severity: '', category: '' });

    useEffect(() => {
        load();
    }, [filters.status, filters.severity, filters.category]);

    async function load() {
        setLoading(true);
        const p = new URLSearchParams();
        if (filters.status) p.set('status', filters.status);
        if (filters.severity) p.set('severity', filters.severity);
        if (filters.category) p.set('category', filters.category);
        const res = await fetch(`/api/central/constraints?${p}`);
        if (res.ok) {
            const d = await res.json();
            setItems(d.items ?? []);
            setTotal(d.total ?? 0);
        }
        setLoading(false);
    }

    function exportCsv() {
        const headers = ['Number', 'Workpack', 'Title', 'Category', 'Severity', 'Status', 'Owner', 'Raised', 'Target Resolution'].join(',');
        const rows = items.map((c) =>
            [
                c.constraint_number ?? '',
                c.workpack?.workpack_id_code ?? '',
                `"${(c.title ?? '').replace(/"/g, '""')}"`,
                c.category ?? '',
                c.severity ?? '',
                c.status ?? '',
                c.owner ?? '',
                c.raised_date ? new Date(c.raised_date).toLocaleDateString('en-GB') : '',
                c.target_resolution ? new Date(c.target_resolution).toLocaleDateString('en-GB') : '',
            ].join(',')
        );
        const csv = [headers, ...rows].join('\r\n');
        const blob = new Blob(['\xEF\xBB\xBF' + csv], { type: 'text/csv;charset=utf-8' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `Constraints_Register_${new Date().toLocaleDateString('en-GB').replace(/\//g, '-')}.csv`;
        a.click();
    }

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Constraint Register</h1>
                    <p className="text-sm text-gray-500 mt-1">All constraints across all workpacks · {total} total</p>
                </div>
                <button
                    type="button"
                    onClick={exportCsv}
                    className="px-4 py-2 border border-gray-300 text-sm rounded-xl hover:bg-gray-50"
                >
                    ⬇ Export CSV
                </button>
            </div>

            <div className="flex gap-3 mb-4 flex-wrap">
                {[
                    { key: 'status', options: ['', 'open', 'in_progress', 'resolved', 'closed'], label: 'Status' },
                    { key: 'severity', options: ['', 'critical', 'high', 'medium', 'low'], label: 'Severity' },
                    { key: 'category', options: ['', 'technical', 'procurement', 'resource', 'permit', 'weather', 'design', 'other'], label: 'Category' },
                ].map((f) => (
                    <select
                        key={f.key}
                        value={(filters as any)[f.key]}
                        onChange={(e) => setFilters((p) => ({ ...p, [f.key]: e.target.value }))}
                        className="border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none"
                    >
                        <option value="">{f.label} — All</option>
                        {f.options.slice(1).map((o) => (
                            <option key={o} value={o}>{o.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase())}</option>
                        ))}
                    </select>
                ))}
            </div>

            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="bg-gray-50 border-b">
                            {['Number', 'Workpack', 'Title', 'Category', 'Severity', 'Status', 'Owner', 'Target'].map((h) => (
                                <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500">{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {loading && (
                            <tr>
                                <td colSpan={8} className="px-4 py-10 text-center text-gray-400">Loading...</td>
                            </tr>
                        )}
                        {!loading && items.length === 0 && (
                            <tr>
                                <td colSpan={8} className="px-4 py-10 text-center text-gray-400">No constraints found</td>
                            </tr>
                        )}
                        {items.map((c: any) => (
                            <tr key={c.id} className="hover:bg-gray-50/50">
                                <td className="px-4 py-3 font-mono text-xs text-gray-600">{c.constraint_number}</td>
                                <td className="px-4 py-3">
                                    <a href={`/workpacks/${c.workpack_id}`} className="text-blue-600 hover:underline font-mono text-xs">
                                        {c.workpack?.workpack_id_code ?? '—'}
                                    </a>
                                </td>
                                <td className="px-4 py-3 font-medium text-gray-900 max-w-xs truncate">{c.title}</td>
                                <td className="px-4 py-3 text-gray-500 capitalize text-xs">{c.category}</td>
                                <td className="px-4 py-3">
                                    <span
                                        className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${
                                            c.severity === 'critical'
                                                ? 'bg-red-100 text-red-700'
                                                : c.severity === 'high'
                                                ? 'bg-orange-100 text-orange-700'
                                                : c.severity === 'medium'
                                                ? 'bg-yellow-100 text-yellow-700'
                                                : 'bg-gray-100 text-gray-600'
                                        }`}
                                    >
                                        {c.severity}
                                    </span>
                                </td>
                                <td className="px-4 py-3">
                                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 capitalize">
                                        {c.status?.replace('_', ' ')}
                                    </span>
                                </td>
                                <td className="px-4 py-3 text-gray-600 text-xs">{c.owner ?? '—'}</td>
                                <td className="px-4 py-3 text-gray-600 text-xs whitespace-nowrap">
                                    {c.target_resolution ? new Date(c.target_resolution).toLocaleDateString('en-GB') : '—'}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
