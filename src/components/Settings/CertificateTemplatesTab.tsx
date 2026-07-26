'use client';

import { useState, useEffect } from 'react';

export function CertificateTemplatesTab() {
    const [templates, setTemplates] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [showNew, setShowNew] = useState(false);
    const [newForm, setNewForm] = useState({
        cert_name: '',
        cert_type: '',
        equipment_types: '',
    });
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        void load();
    }, []);

    async function load() {
        setLoading(true);
        try {
            const res = await fetch('/api/settings/certificate-templates');
            const data = await res.json().catch(() => []);
            setTemplates(Array.isArray(data) ? data : []);
            if (!res.ok) setError((data as any)?.error ?? 'Failed to load templates');
        } catch {
            setTemplates([]);
            setError('Failed to load templates');
        } finally {
            setLoading(false);
        }
    }

    async function createTemplate() {
        if (!newForm.cert_name.trim() || !newForm.cert_type.trim()) {
            setError('Name and type are required');
            return;
        }
        setSaving(true);
        setError(null);
        const res = await fetch('/api/settings/certificate-templates', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                cert_name: newForm.cert_name.trim(),
                cert_type: newForm.cert_type.trim(),
                equipment_types: newForm.equipment_types.split(',').map((s) => s.trim()).filter(Boolean),
                fields: [],
            }),
        });
        if (!res.ok) {
            const d = await res.json().catch(() => ({}));
            setError((d as any).error ?? 'Failed to create');
            setSaving(false);
            return;
        }
        setNewForm({ cert_name: '', cert_type: '', equipment_types: '' });
        setShowNew(false);
        await load();
        setSaving(false);
    }

    async function toggleActive(templateId: string, isActive: boolean) {
        await fetch(`/api/settings/certificate-templates/${templateId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ is_active: isActive }),
        });
        await load();
    }

    if (loading) {
        return (
            <div className="text-sm text-gray-400 py-8 text-center">
                Loading...
            </div>
        );
    }

    const platformTemplates = templates.filter((t) => t.is_platform);
    const orgTemplates = templates.filter((t) => !t.is_platform);

    return (
        <div className="space-y-6">
            {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                    <span>⚠</span>
                    <span className="flex-1">{error}</span>
                    <button type="button" onClick={() => setError(null)}>✕</button>
                </div>
            )}

            <div>
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-gray-700">
                        Platform Templates
                        <span className="text-xs font-normal text-gray-400 ml-2">(read-only — shared across all orgs)</span>
                    </h3>
                </div>
                <div className="space-y-2">
                    {platformTemplates.map((t) => (
                        <div
                            key={t.id}
                            className="flex items-center justify-between p-3 border border-gray-200 rounded-xl bg-gray-50/50"
                        >
                            <div>
                                <p className="text-sm font-medium text-gray-900">{t.cert_name}</p>
                                <p className="text-xs text-gray-400 mt-0.5">
                                    {(t.equipment_types as string[] ?? []).join(', ')}
                                    {' · '}
                                    {(t.fields as any[])?.length ?? 0} fields
                                </p>
                            </div>
                            <div className="flex items-center gap-3">
                                <span
                                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                        t.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'
                                    }`}
                                >
                                    {t.is_active ? 'Active' : 'Inactive'}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => setExpandedId(expandedId === t.id ? null : t.id)}
                                    className="text-xs text-blue-600 hover:underline"
                                >
                                    {expandedId === t.id ? 'Hide fields' : 'View fields'}
                                </button>
                            </div>
                        </div>
                    ))}
                    {expandedId && (() => {
                        const t = templates.find((x) => x.id === expandedId);
                        if (!t) return null;
                        const fields = (t.fields as any[]) ?? [];
                        return (
                            <div className="bg-white border border-gray-200 rounded-xl p-4 overflow-x-auto">
                                <table className="w-full text-xs">
                                    <thead>
                                        <tr className="text-gray-400 border-b">
                                            {['Key', 'Label', 'Type', 'Required', 'Unit', 'Auto-from'].map((h) => (
                                                <th key={h} className="text-left py-1.5 pr-4 font-medium">
                                                    {h}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {fields.map((f: any, i: number) => (
                                            <tr key={i} className="border-b border-gray-50 last:border-0">
                                                <td className="py-1.5 pr-4 font-mono text-gray-600">{f.key}</td>
                                                <td className="py-1.5 pr-4 text-gray-800">{f.label}</td>
                                                <td className="py-1.5 pr-4 text-blue-600">{f.type}</td>
                                                <td className="py-1.5 pr-4">{f.required ? '✓' : ''}</td>
                                                <td className="py-1.5 pr-4 text-gray-400">{f.unit ?? ''}</td>
                                                <td className="py-1.5 pr-4 font-mono text-gray-400">{f.auto_from ?? ''}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        );
                    })()}
                </div>
            </div>

            <div>
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-gray-700">Organisation Templates</h3>
                    <button
                        type="button"
                        onClick={() => setShowNew((v) => !v)}
                        className="px-3 py-1.5 bg-[#0D2137] text-white text-xs font-medium rounded-xl hover:bg-[#1a3a5c]"
                    >
                        + New Template
                    </button>
                </div>

                {showNew && (
                    <div className="bg-white border border-gray-200 rounded-2xl p-5 mb-4 space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-medium text-gray-600 mb-1 block">Certificate Name *</label>
                                <input
                                    type="text"
                                    value={newForm.cert_name}
                                    onChange={(e) => setNewForm((p) => ({ ...p, cert_name: e.target.value }))}
                                    placeholder="e.g. Pressure Test Certificate"
                                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-medium text-gray-600 mb-1 block">
                                    Certificate Type * <span className="font-normal text-gray-400 ml-1">(slug, unique)</span>
                                </label>
                                <input
                                    type="text"
                                    value={newForm.cert_type}
                                    onChange={(e) =>
                                        setNewForm((p) => ({
                                            ...p,
                                            cert_type: e.target.value.toLowerCase().replace(/\s+/g, '_'),
                                        }))
                                    }
                                    placeholder="e.g. pressure_test"
                                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm font-mono focus:outline-none"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="text-xs font-medium text-gray-600 mb-1 block">
                                Equipment Types <span className="font-normal text-gray-400 ml-1">(comma separated)</span>
                            </label>
                            <input
                                type="text"
                                value={newForm.equipment_types}
                                onChange={(e) => setNewForm((p) => ({ ...p, equipment_types: e.target.value }))}
                                placeholder="Heat Exchanger, Pressure Vessel"
                                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none"
                            />
                        </div>
                        <p className="text-xs text-gray-400">
                            After creating, edit the template to add field definitions (key, label, type, etc.)
                        </p>
                        <div className="flex gap-3 justify-end">
                            <button
                                type="button"
                                onClick={() => setShowNew(false)}
                                className="text-sm text-gray-500 hover:text-gray-800 px-4 py-2"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={createTemplate}
                                disabled={saving}
                                className="px-5 py-2 bg-[#0D2137] text-white text-sm rounded-xl hover:bg-[#1a3a5c] disabled:opacity-40"
                            >
                                {saving ? 'Creating...' : 'Create Template'}
                            </button>
                        </div>
                    </div>
                )}

                {orgTemplates.length === 0 && !showNew ? (
                    <div className="text-center py-10 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
                        <p className="text-sm text-gray-400">No organisation templates yet.</p>
                        <p className="text-xs text-gray-400 mt-1">Create custom templates for your equipment types.</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {orgTemplates.map((t) => (
                            <div
                                key={t.id}
                                className="flex items-center justify-between p-3 border border-gray-200 rounded-xl bg-white"
                            >
                                <div>
                                    <p className="text-sm font-medium text-gray-900">{t.cert_name}</p>
                                    <p className="text-xs text-gray-400 mt-0.5">
                                        {(t.equipment_types as string[] ?? []).join(', ') || 'No equipment types set'}
                                        {' · '}
                                        {(t.fields as any[])?.length ?? 0} fields
                                    </p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={t.is_active ?? true}
                                            onChange={(e) => toggleActive(t.id, e.target.checked)}
                                            className="rounded"
                                        />
                                        Active
                                    </label>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
