'use client';

import { useState, useEffect, useCallback } from 'react';

type FieldDef = {
    key: string;
    label: string;
    type: 'text' | 'number' | 'date' | 'boolean' | 'select';
    options?: string;
    required?: boolean;
};

type Template = {
    id: string;
    cert_name: string;
    cert_type: string;
    equipment_types: string[];
    fields: FieldDef[];
    is_platform: boolean;
    is_active: boolean;
    version: number;
    organization_id: string | null;
};

const FIELD_TYPES = ['text', 'number', 'date', 'boolean', 'select'] as const;

const defaultField = (): FieldDef => ({ key: '', label: '', type: 'text', options: '', required: false });

function FieldEditor({ fields, onChange }: { fields: FieldDef[]; onChange: (f: FieldDef[]) => void }) {
    const update = (i: number, partial: Partial<FieldDef>) => {
        const next = [...fields];
        next[i] = { ...next[i], ...partial };
        onChange(next);
    };
    const remove = (i: number) => onChange(fields.filter((_, idx) => idx !== i));
    const add = () => onChange([...fields, defaultField()]);

    return (
        <div className="flex flex-col gap-2">
            {fields.map((f, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-center border border-gray-200 rounded-lg p-2 bg-gray-50">
                    <input className="col-span-3 px-2 py-1.5 border border-gray-300 rounded text-xs outline-none" placeholder="key" value={f.key}
                        onChange={(e) => update(i, { key: e.target.value })} />
                    <input className="col-span-3 px-2 py-1.5 border border-gray-300 rounded text-xs outline-none" placeholder="Label" value={f.label}
                        onChange={(e) => update(i, { label: e.target.value })} />
                    <select className="col-span-2 px-2 py-1.5 border border-gray-300 rounded text-xs outline-none" value={f.type}
                        onChange={(e) => update(i, { type: e.target.value as FieldDef['type'] })}>
                        {FIELD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                    {f.type === 'select' ? (
                        <input className="col-span-2 px-2 py-1.5 border border-gray-300 rounded text-xs outline-none" placeholder="opt1,opt2"
                            value={f.options ?? ''} onChange={(e) => update(i, { options: e.target.value })} />
                    ) : <div className="col-span-2" />}
                    <label className="col-span-1 flex items-center gap-1 text-xs text-gray-500">
                        <input type="checkbox" checked={f.required ?? false} onChange={(e) => update(i, { required: e.target.checked })} /> Req
                    </label>
                    <button onClick={() => remove(i)} className="col-span-1 text-red-400 hover:text-red-600 text-sm font-bold">✕</button>
                </div>
            ))}
            <button onClick={add} className="text-xs text-[#0D2137] hover:underline self-start mt-1">+ Add field</button>
        </div>
    );
}

const emptyForm = { cert_name: '', cert_type: '', equipment_types: '', fields: [] as FieldDef[], is_active: true };

export default function CertificateTemplatesPage() {
    const [templates, setTemplates] = useState<Template[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [showCreate, setShowCreate] = useState(false);
    const [form, setForm] = useState({ ...emptyForm });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const load = useCallback(async () => {
        setLoading(true);
        const res = await fetch('/api/settings/certificate-templates');
        if (res.ok) setTemplates(await res.json());
        setLoading(false);
    }, []);

    useEffect(() => { void load(); }, [load]);

    const startEdit = (t: Template) => {
        setEditingId(t.id);
        setForm({
            cert_name: t.cert_name,
            cert_type: t.cert_type,
            equipment_types: t.equipment_types.join(', '),
            fields: (t.fields ?? []) as FieldDef[],
            is_active: t.is_active,
        });
        setShowCreate(false);
    };

    const startCreate = () => {
        setEditingId(null);
        setForm({ ...emptyForm });
        setShowCreate(true);
    };

    const saveTemplate = async () => {
        setSaving(true);
        setError('');
        const payload = {
            cert_name: form.cert_name.trim(),
            cert_type: form.cert_type.trim(),
            equipment_types: form.equipment_types.split(',').map((s) => s.trim()).filter(Boolean),
            fields: form.fields.map((f) => ({
                key: f.key.trim(),
                label: f.label.trim(),
                type: f.type,
                ...(f.type === 'select' && f.options ? { options: f.options.split(',').map((s) => s.trim()) } : {}),
                required: f.required ?? false,
            })),
            is_active: form.is_active,
        };

        try {
            const url = editingId
                ? `/api/settings/certificate-templates/${editingId}`
                : '/api/settings/certificate-templates';
            const method = editingId ? 'PATCH' : 'POST';
            const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            if (!res.ok) throw new Error((await res.json()).error ?? 'Failed');
            setEditingId(null);
            setShowCreate(false);
            await load();
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Save failed');
        } finally {
            setSaving(false);
        }
    };

    const deleteTemplate = async (id: string) => {
        if (!confirm('Delete this template? This cannot be undone.')) return;
        await fetch(`/api/settings/certificate-templates/${id}`, { method: 'DELETE' });
        await load();
    };

    const FormPanel = () => (
        <div className="border border-gray-200 rounded-2xl p-6 bg-white shadow-sm flex flex-col gap-4">
            <h3 className="text-base font-semibold text-gray-900">{editingId ? 'Edit Template' : 'New Template'}</h3>
            <div className="grid grid-cols-2 gap-4">
                <label className="flex flex-col gap-1">
                    <span className="text-xs font-medium text-gray-500">Certificate Name *</span>
                    <input value={form.cert_name} onChange={(e) => setForm({ ...form, cert_name: e.target.value })}
                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#0D2137]" />
                </label>
                <label className="flex flex-col gap-1">
                    <span className="text-xs font-medium text-gray-500">Certificate Type *</span>
                    <input value={form.cert_type} onChange={(e) => setForm({ ...form, cert_type: e.target.value })}
                        placeholder="e.g. HYDRO, TORQUE, FLANGE"
                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#0D2137]" />
                </label>
            </div>
            <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-gray-500">Equipment Types (comma-separated)</span>
                <input value={form.equipment_types} onChange={(e) => setForm({ ...form, equipment_types: e.target.value })}
                    placeholder="e.g. PUMP, VALVE, COMPRESSOR"
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#0D2137]" />
            </label>
            <div>
                <p className="text-xs font-medium text-gray-500 mb-2">Template Fields</p>
                <FieldEditor fields={form.fields} onChange={(f) => setForm({ ...form, fields: f })} />
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-600">
                <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
                Active (available to attach to workpacks)
            </label>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex gap-3">
                <button onClick={() => { setEditingId(null); setShowCreate(false); }} className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg">Cancel</button>
                <button id="save-template-btn" onClick={() => void saveTemplate()} disabled={saving || !form.cert_name || !form.cert_type}
                    className="flex-1 px-4 py-2 bg-[#0D2137] text-white text-sm rounded-lg hover:bg-[#1a3a5c] disabled:opacity-40">
                    {saving ? 'Saving…' : editingId ? 'Update Template' : 'Create Template'}
                </button>
            </div>
        </div>
    );

    return (
        <div className="max-w-4xl mx-auto py-8 px-6 flex flex-col gap-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Certificate Templates</h1>
                    <p className="text-sm text-gray-500 mt-1">Define the certificates that can be attached to workpacks. Platform templates are read-only.</p>
                </div>
                <button id="new-template-btn" onClick={startCreate} className="px-5 py-2.5 bg-[#0D2137] text-white text-sm font-medium rounded-xl hover:bg-[#1a3a5c]">
                    + New Template
                </button>
            </div>

            {(showCreate || editingId) && <FormPanel />}

            {loading ? (
                <div className="flex items-center justify-center h-40 text-sm text-gray-400">Loading…</div>
            ) : templates.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 gap-2 text-gray-400">
                    <span className="text-4xl">📜</span>
                    <p className="text-sm">No certificate templates yet</p>
                </div>
            ) : (
                <div className="flex flex-col gap-3">
                    {templates.map((t) => (
                        <div key={t.id} className={`border rounded-xl p-4 bg-white shadow-sm ${t.is_platform ? 'border-blue-200' : 'border-gray-200'}`}>
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-semibold text-gray-900">{t.cert_name}</span>
                                        <span className="text-xs font-mono text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">{t.cert_type}</span>
                                        {t.is_platform && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">Platform</span>}
                                        {!t.is_active && <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Inactive</span>}
                                    </div>
                                    {t.equipment_types.length > 0 && (
                                        <p className="text-xs text-gray-400 mt-1">Equipment: {t.equipment_types.join(', ')}</p>
                                    )}
                                    <p className="text-xs text-gray-400 mt-0.5">{(t.fields ?? []).length} fields · v{t.version}</p>
                                </div>
                                {!t.is_platform && (
                                    <div className="flex gap-2 shrink-0">
                                        <button id={`edit-template-${t.id}`} onClick={() => startEdit(t)}
                                            className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg hover:border-[#0D2137] hover:text-[#0D2137]">
                                            ✏ Edit
                                        </button>
                                        <button id={`delete-template-${t.id}`} onClick={() => void deleteTemplate(t.id)}
                                            className="px-3 py-1.5 text-xs border border-red-200 text-red-600 rounded-lg hover:bg-red-50">
                                            🗑 Delete
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
