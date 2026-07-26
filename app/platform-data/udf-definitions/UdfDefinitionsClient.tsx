'use client';

import React, { useState, useEffect } from 'react';
import { UdfEditDrawer, type UdfDefinition } from '@/components/Udf/UdfEditDrawer';
import { UdfOptionsPanel, type UdfOption } from '@/components/Udf/UdfOptionsPanel';

type DefWithCount = UdfDefinition & { _valuesCount?: number; options?: UdfOption[] };

export default function UdfDefinitionsClient() {
    const [definitions, setDefinitions] = useState<DefWithCount[]>([]);
    const [loading, setLoading] = useState(true);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [editingDef, setEditingDef] = useState<DefWithCount | null>(null);
    const [expandedOptionsId, setExpandedOptionsId] = useState<string | null>(null);
    const [toast, setToast] = useState<string | null>(null);

    const fetchList = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/master-data/udf-definitions');
            const data = await res.json();
            setDefinitions(Array.isArray(data) ? data : []);
        } catch {
            setDefinitions([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchList();
    }, []);

    useEffect(() => {
        if (!toast) return;
        const t = setTimeout(() => setToast(null), 3000);
        return () => clearTimeout(t);
    }, [toast]);

    const openEdit = (def: DefWithCount | null) => {
        setEditingDef(def);
        setDrawerOpen(true);
    };

    const openOptions = (id: string) => {
        setExpandedOptionsId((prev) => (prev === id ? null : id));
    };

    const optionsForDef = (d: DefWithCount) => (d.options ?? []).filter((o: UdfOption) => o.is_active !== false);
    const previewPills = (d: DefWithCount, max = 4) => {
        const opts = optionsForDef(d);
        const show = opts.slice(0, max);
        const rest = opts.length - max;
        return { show, rest };
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">UDF Definitions</h1>
                    <p className="text-sm text-gray-500 mt-1">Custom fields that appear on every activity in workpacks.</p>
                </div>
                <button
                    type="button"
                    onClick={() => openEdit(null)}
                    className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 shadow-sm"
                >
                    + Add UDF
                </button>
            </div>

            {toast && (
                <div className="fixed bottom-4 right-4 z-50 px-4 py-2 bg-gray-900 text-white text-sm rounded-lg shadow-lg">
                    {toast}
                </div>
            )}

            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                {loading ? (
                    <div className="p-8 text-center text-gray-500">Loading…</div>
                ) : (
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase w-8">#</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Code</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Label</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Options</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase w-20">Mandatory</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase w-16">Active</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase w-28">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {definitions.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="px-4 py-8 text-center text-gray-500">No UDF definitions yet. Click &quot;+ Add UDF&quot; to create one.</td>
                                </tr>
                            ) : (
                                definitions.map((d) => {
                                    const { show, rest } = previewPills(d);
                                    const isOptionsExpanded = expandedOptionsId === d.id;
                                    return (
                                        <React.Fragment key={d.id}>
                                            <tr>
                                                <td className="px-4 py-2 text-sm text-gray-400 font-mono">{d.sort_order ?? '—'}</td>
                                                <td className="px-4 py-2 text-sm font-mono text-gray-900">{d.code}</td>
                                                <td className="px-4 py-2 text-sm text-gray-700">{d.name}</td>
                                                <td className="px-4 py-2">
                                                    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                                                        d.type === 'select' ? 'bg-orange-100 text-orange-800' : d.type === 'number' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
                                                    }`}>
                                                        {d.type}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-2">
                                                    {d.type === 'select' ? (
                                                        <button type="button" onClick={() => openOptions(d.id)} className="flex flex-wrap gap-1 text-left">
                                                            {show.map((o: UdfOption) => (
                                                                <span key={o.id} className="inline-flex px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 text-xs">
                                                                    {(o.code_value ?? o.value)} / {(o.label ?? o.description ?? '')}
                                                                </span>
                                                            ))}
                                                            {rest > 0 && <span className="inline-flex px-1.5 py-0.5 rounded bg-gray-200 text-gray-600 text-xs">+{rest} more</span>}
                                                        </button>
                                                    ) : (
                                                        <span className="text-gray-400">—</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-2 text-sm text-gray-600">{d.is_mandatory ? 'Yes' : 'No'}</td>
                                                <td className="px-4 py-2">
                                                    <span className={`inline-flex w-2.5 h-2.5 rounded-full ${d.is_active !== false ? 'bg-green-500' : 'bg-gray-300'}`} title={d.is_active !== false ? 'Active' : 'Inactive'} />
                                                </td>
                                                <td className="px-4 py-2">
                                                    <div className="flex items-center gap-2">
                                                        {d.type === 'select' && (
                                                            <button type="button" onClick={() => openOptions(d.id)} className="text-xs font-medium text-gray-600 hover:text-blue-600" title="Options">⚙ Options</button>
                                                        )}
                                                        <button type="button" onClick={() => openEdit(d)} className="text-xs font-medium text-blue-600 hover:underline">✏ Edit</button>
                                                    </div>
                                                </td>
                                            </tr>
                                            {isOptionsExpanded && (
                                                <tr key={`${d.id}-options`}>
                                                    <td colSpan={8} className="px-4 py-2 bg-gray-50 align-top">
                                                        <UdfOptionsPanel
                                                            definitionId={d.id}
                                                            definitionName={d.name}
                                                            options={d.options ?? []}
                                                            onSaved={() => { fetchList(); setToast('Options saved'); setExpandedOptionsId(null); }}
                                                            onCancel={() => setExpandedOptionsId(null)}
                                                        />
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                )}
            </div>

            <UdfEditDrawer
                open={drawerOpen}
                onClose={() => { setDrawerOpen(false); setEditingDef(null); }}
                definition={editingDef}
                hasValues={(editingDef?._valuesCount ?? 0) > 0}
                onSaved={() => { fetchList(); setToast(editingDef ? 'UDF updated' : 'UDF created'); }}
            />
        </div>
    );
}
