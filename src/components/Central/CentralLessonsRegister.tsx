'use client';

import { useState, useEffect } from 'react';

export function CentralLessonsRegister() {
    const [items, setItems] = useState<any[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [publishing, setPublishing] = useState(false);
    const [closureLoading, setClosureLoading] = useState(false);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [filters, setFilters] = useState({
        status: '',
        category: '',
        impact: '',
        in_register: 'true',
    });

    useEffect(() => {
        load();
    }, [filters.status, filters.category, filters.impact, filters.in_register]);

    async function load() {
        setLoading(true);
        const p = new URLSearchParams();
        if (filters.status) p.set('status', filters.status);
        if (filters.category) p.set('category', filters.category);
        if (filters.impact) p.set('impact', filters.impact);
        if (filters.in_register) p.set('in_register', filters.in_register);
        const res = await fetch(`/api/central/lessons?${p}`);
        if (res.ok) {
            const d = await res.json();
            setItems(d.items ?? []);
            setTotal(d.total ?? 0);
        }
        setSelected(new Set());
        setLoading(false);
    }

    function exportCsv() {
        const headers = ['Title', 'Workpack', 'Category', 'Impact', 'Status', 'In register', 'Created'].join(',');
        const rows = items.map((l: any) =>
            [
                `"${(l.title ?? '').replace(/"/g, '""')}"`,
                l.workpack?.workpack_id_code ?? '',
                l.category ?? '',
                l.impact ?? '',
                l.status ?? '',
                l.is_in_central_register ? 'Yes' : 'No',
                l.created_at ? new Date(l.created_at).toLocaleDateString('en-GB') : '',
            ].join(',')
        );
        const csv = [headers, ...rows].join('\r\n');
        const blob = new Blob(['\xEF\xBB\xBF' + csv], { type: 'text/csv;charset=utf-8' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `Lessons_Register_${new Date().toLocaleDateString('en-GB').replace(/\//g, '-')}.csv`;
        a.click();
    }

    async function publishSelected() {
        if (selected.size === 0) return;
        setPublishing(true);
        try {
            const res = await fetch('/api/central/lessons', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids: Array.from(selected) }),
            });
            if (res.ok) await load();
        } finally {
            setPublishing(false);
        }
    }

    function toggleSelect(id: string) {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }

    function selectAll() {
        if (selected.size === items.length) setSelected(new Set());
        else setSelected(new Set(items.map((l: any) => l.id)));
    }

    async function openClosureReport() {
        setClosureLoading(true);
        try {
            const res = await fetch('/api/central/lessons/closure-report');
            if (!res.ok) throw new Error('Failed to generate report');
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Project_Closure_Report_Lessons_${new Date().toISOString().slice(0, 10)}.pdf`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (e) {
            console.error(e);
        } finally {
            setClosureLoading(false);
        }
    }

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Lessons Learned Register</h1>
                    <p className="text-sm text-gray-500 mt-1">All lessons across workpacks · {total} total</p>
                </div>
                <div className="flex gap-2">
                    <button
                        type="button"
                        onClick={openClosureReport}
                        disabled={closureLoading || total === 0}
                        className="px-4 py-2 border border-gray-300 text-sm rounded-xl hover:bg-gray-50 disabled:opacity-50"
                    >
                        {closureLoading ? 'Generating…' : '📄 Project Closure Report'}
                    </button>
                    <button
                        type="button"
                        onClick={exportCsv}
                        className="px-4 py-2 border border-gray-300 text-sm rounded-xl hover:bg-gray-50"
                    >
                        ⬇ Export CSV
                    </button>
                    {selected.size > 0 && (
                        <button
                            type="button"
                            onClick={publishSelected}
                            disabled={publishing}
                            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-xl hover:bg-blue-700 disabled:opacity-50"
                        >
                            {publishing ? 'Publishing…' : `✓ Publish ${selected.size} to register`}
                        </button>
                    )}
                </div>
            </div>

            <div className="flex gap-3 mb-4 flex-wrap">
                {[
                    { key: 'in_register', options: [{ v: 'true', l: 'In central register' }, { v: '', l: 'All' }], label: 'Scope' },
                    { key: 'status', options: ['', 'draft', 'published', 'archived'], label: 'Status' },
                    { key: 'category', options: ['', 'general', 'safety', 'technical', 'scheduling', 'resources', 'procurement', 'quality', 'hse'], label: 'Category' },
                    { key: 'impact', options: ['', 'high', 'medium', 'low'], label: 'Impact' },
                ].map((f) => (
                    <select
                        key={f.key}
                        value={(filters as any)[f.key]}
                        onChange={(e) => setFilters((p) => ({ ...p, [f.key]: e.target.value }))}
                        className="border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none"
                    >
                        {f.key === 'in_register'
                            ? (f.options as { v: string; l: string }[]).map((o) => (
                                <option key={o.v} value={o.v}>{o.l}</option>
                            ))
                            : (
                                <>
                                    <option value="">{f.label} — All</option>
                                    {(f.options as string[]).slice(1).map((o) => (
                                        <option key={o} value={o}>{o.replace(/_/g, ' ')}</option>
                                    ))}
                                </>
                            )}
                    </select>
                ))}
            </div>

            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="bg-gray-50 border-b">
                            <th className="text-left px-4 py-3 w-10">
                                <input
                                    type="checkbox"
                                    checked={items.length > 0 && selected.size === items.length}
                                    onChange={selectAll}
                                    className="rounded"
                                />
                            </th>
                            {['Title', 'Workpack', 'Category', 'Impact', 'Status', 'In register'].map((h) => (
                                <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500">{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {loading && (
                            <tr>
                                <td colSpan={7} className="px-4 py-10 text-center text-gray-400">Loading...</td>
                            </tr>
                        )}
                        {!loading && items.length === 0 && (
                            <tr>
                                <td colSpan={7} className="px-4 py-10 text-center text-gray-400">No lessons found</td>
                            </tr>
                        )}
                        {items.map((l: any) => (
                            <tr key={l.id} className="hover:bg-gray-50/50">
                                <td className="px-4 py-3">
                                    {!l.is_in_central_register && (
                                        <input
                                            type="checkbox"
                                            checked={selected.has(l.id)}
                                            onChange={() => toggleSelect(l.id)}
                                            className="rounded"
                                        />
                                    )}
                                </td>
                                <td className="px-4 py-3 font-medium text-gray-900 max-w-xs truncate">{l.title}</td>
                                <td className="px-4 py-3">
                                    <a href={`/workpacks/${l.workpack_id}`} className="text-blue-600 hover:underline font-mono text-xs">
                                        {l.workpack?.workpack_id_code ?? '—'}
                                    </a>
                                </td>
                                <td className="px-4 py-3 text-gray-500 capitalize text-xs">{l.category}</td>
                                <td className="px-4 py-3">
                                    <span
                                        className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${
                                            l.impact === 'high' ? 'bg-red-100 text-red-700'
                                                : l.impact === 'medium' ? 'bg-amber-100 text-amber-700'
                                                    : 'bg-gray-100 text-gray-600'
                                        }`}
                                    >
                                        {l.impact}
                                    </span>
                                </td>
                                <td className="px-4 py-3">
                                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 capitalize">
                                        {l.status}
                                    </span>
                                </td>
                                <td className="px-4 py-3 text-xs">{l.is_in_central_register ? 'Yes' : 'No'}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
