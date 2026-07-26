'use client';

import { useState, useEffect } from 'react';
import { AiGeneratedBanner } from '@/components/Workpack/AiGeneratedBanner';
import { EmptyStateWithAI } from '@/components/Workpack/EmptyStateWithAI';

const CATEGORIES = [
    { value: 'technical', label: 'Technical' },
    { value: 'procurement', label: 'Procurement' },
    { value: 'resource', label: 'Resource' },
    { value: 'permit', label: 'Permit' },
    { value: 'weather', label: 'Weather' },
    { value: 'design', label: 'Design' },
    { value: 'other', label: 'Other' },
];

const SEVERITIES = [
    { value: 'critical', label: 'Critical', bg: 'bg-red-50', border: 'border-red-300', badge: 'bg-red-100 text-red-700' },
    { value: 'high', label: 'High', bg: 'bg-orange-50', border: 'border-orange-300', badge: 'bg-orange-100 text-orange-700' },
    { value: 'medium', label: 'Medium', bg: 'bg-yellow-50', border: 'border-yellow-200', badge: 'bg-yellow-100 text-yellow-700' },
    { value: 'low', label: 'Low', bg: 'bg-gray-50', border: 'border-gray-200', badge: 'bg-gray-100 text-gray-600' },
];

const STATUS_STYLES: Record<string, string> = {
    open: 'bg-red-100 text-red-700',
    in_progress: 'bg-blue-100 text-blue-700',
    resolved: 'bg-green-100 text-green-700',
    closed: 'bg-gray-100 text-gray-500',
    cancelled: 'bg-gray-100 text-gray-400',
};

type FormData = {
    title: string;
    description: string;
    category: string;
    severity: string;
    owner: string;
    target_resolution: string;
    resolution_steps: string;
};

const EMPTY_FORM: FormData = {
    title: '',
    description: '',
    category: 'technical',
    severity: 'medium',
    owner: '',
    target_resolution: '',
    resolution_steps: '',
};

export function ConstraintsTab({
    workpackId,
    canEdit,
}: {
    workpackId: string;
    canEdit: boolean;
}) {
    const [data, setData] = useState<{ constraints?: any[]; counts?: Record<string, number> } | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState<FormData>(EMPTY_FORM);
    const [submitting, setSubmitting] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState<Partial<FormData>>({});
    const [uploadingFor, setUploadingFor] = useState<string | null>(null);
    const [aiBannerDismissed, setAiBannerDismissed] = useState(false);
    const [regenConfirmOpen, setRegenConfirmOpen] = useState(false);
    const [regenLoading, setRegenLoading] = useState(false);
    const [regenSuccess, setRegenSuccess] = useState<string | null>(null);

    useEffect(() => {
        loadConstraints();
    }, [workpackId]);

    useEffect(() => {
        const handler = () => setRegenConfirmOpen(true);
        window.addEventListener('trigger-regen-constraints', handler);
        return () => window.removeEventListener('trigger-regen-constraints', handler);
    }, []);

    async function runRegenerate() {
        setRegenConfirmOpen(false);
        setRegenLoading(true);
        setError(null);
        try {
            const res = await fetch(`/api/workpacks/${workpackId}/constraints/generate-with-ai`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ regenerate: true, preserveManual: true, autoSave: true }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error((data as { error?: string }).error ?? 'Regenerate failed');
            await loadConstraints();
            const n = (data as { count?: number }).count ?? 0;
            setRegenSuccess(`✓ Constraints regenerated — ${n} AI constraints replaced. Manual constraints preserved.`);
            setTimeout(() => setRegenSuccess(null), 5000);
        } catch (e: any) {
            setError('Regenerate failed: ' + (e?.message ?? 'Unknown error'));
        } finally {
            setRegenLoading(false);
        }
    }

    async function loadConstraints() {
        setLoading(true);
        try {
            const res = await fetch(`/api/workpacks/${workpackId}/constraints`);
            if (!res.ok) throw new Error((await res.json()).error);
            setData(await res.json());
        } catch (e: any) {
            setError('Failed to load: ' + (e?.message ?? ''));
        } finally {
            setLoading(false);
        }
    }

    async function handleCreate() {
        if (!form.title.trim()) {
            setError('Title is required');
            return;
        }
        setSubmitting(true);
        setError(null);
        try {
            const res = await fetch(`/api/workpacks/${workpackId}/constraints`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form),
            });
            if (!res.ok) throw new Error((await res.json()).error);
            setForm(EMPTY_FORM);
            setShowForm(false);
            await loadConstraints();
        } catch (e: any) {
            setError('Failed to create: ' + (e?.message ?? ''));
        } finally {
            setSubmitting(false);
        }
    }

    async function handleStatusChange(constraintId: string, newStatus: string) {
        const res = await fetch(`/api/workpacks/${workpackId}/constraints/${constraintId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus }),
        });
        if (res.ok) await loadConstraints();
    }

    async function handleEdit(constraintId: string) {
        const res = await fetch(`/api/workpacks/${workpackId}/constraints/${constraintId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(editForm),
        });
        if (res.ok) {
            setEditingId(null);
            await loadConstraints();
        }
    }

    async function handleDelete(constraintId: string) {
        if (!confirm('Delete this constraint? This cannot be undone.')) return;
        await fetch(`/api/workpacks/${workpackId}/constraints/${constraintId}`, { method: 'DELETE' });
        await loadConstraints();
    }

    async function handleAttach(constraintId: string, file: File) {
        setUploadingFor(constraintId);
        const formData = new FormData();
        formData.append('file', file);
        const res = await fetch(
            `/api/workpacks/${workpackId}/constraints/${constraintId}/attach`,
            { method: 'POST', body: formData }
        );
        setUploadingFor(null);
        if (!res.ok) {
            const d = await res.json();
            setError(d.error ?? 'Upload failed');
            return;
        }
        await loadConstraints();
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12 text-gray-400 text-sm">
                <div className="animate-spin w-5 h-5 border-2 border-gray-300 border-t-blue-600 rounded-full mr-3" />
                Loading constraints...
            </div>
        );
    }

    const constraints = data?.constraints ?? [];
    const counts = data?.counts ?? {};
    const aiGeneratedCount = (constraints as { ai_generated?: boolean }[]).filter((c) => c.ai_generated).length;

    return (
        <div className="space-y-4">
            {aiGeneratedCount > 0 && !aiBannerDismissed && (
                <AiGeneratedBanner
                    count={aiGeneratedCount}
                    entityName="constraints"
                    message="Assign owners and update status as constraints are resolved."
                    onDismiss={() => setAiBannerDismissed(true)}
                />
            )}
            {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                    <span>⚠</span>
                    <span className="flex-1">{error}</span>
                    <button type="button" onClick={() => setError(null)}>✕</button>
                </div>
            )}

            <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3 flex-wrap">
                    {[
                        { label: 'Open', count: counts.open, color: 'text-red-600' },
                        { label: 'In Progress', count: counts.in_progress, color: 'text-blue-600' },
                        { label: 'Resolved', count: counts.resolved, color: 'text-green-600' },
                    ].map((s) => (
                        <div key={s.label} className="text-sm">
                            <span className={`font-bold ${s.color}`}>{s.count ?? 0}</span>
                            <span className="text-gray-500 ml-1">{s.label}</span>
                        </div>
                    ))}
                    <span className="text-xs text-gray-400 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-full">
                        🔄 Auto-synced to central register
                    </span>
                </div>
                {canEdit && (
                    <>
                        <button
                            type="button"
                            onClick={() => setRegenConfirmOpen(true)}
                            className="px-3 py-1.5 text-xs border border-indigo-200 text-indigo-600 rounded-lg hover:bg-indigo-50 flex items-center gap-1.5"
                            title="Replace AI-generated constraints; manual constraints preserved"
                        >
                            ↻ Regenerate Constraints
                        </button>
                        <button
                            type="button"
                            onClick={() => setShowForm(true)}
                            className="px-4 py-2 bg-[#0D2137] text-white text-sm font-medium rounded-xl hover:bg-[#1a3a5c]"
                        >
                            + Add Constraint
                        </button>
                    </>
                )}
            </div>

            {regenSuccess && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
                    {regenSuccess}
                </div>
            )}

            {regenConfirmOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
                    <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
                        <p className="text-sm text-gray-800 mb-4">
                            This will replace AI-generated constraints. Manually added constraints will be preserved. Continue?
                        </p>
                        <div className="flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => setRegenConfirmOpen(false)}
                                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={runRegenerate}
                                disabled={regenLoading}
                                className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                            >
                                {regenLoading ? 'Regenerating…' : 'Regenerate'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showForm && (
                <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-4">
                    <h3 className="text-sm font-semibold text-gray-900">New Constraint</h3>
                    <div>
                        <label className="text-xs font-medium text-gray-600 mb-1 block">Title *</label>
                        <input
                            type="text"
                            value={form.title}
                            onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                            placeholder="e.g. Valve delivery delayed"
                            className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-medium text-gray-600 mb-1 block">Category</label>
                            <select
                                value={form.category}
                                onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
                                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none"
                            >
                                {CATEGORIES.map((c) => (
                                    <option key={c.value} value={c.value}>{c.label}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-medium text-gray-600 mb-1 block">Severity</label>
                            <select
                                value={form.severity}
                                onChange={(e) => setForm((p) => ({ ...p, severity: e.target.value }))}
                                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none"
                            >
                                {SEVERITIES.map((s) => (
                                    <option key={s.value} value={s.value}>{s.label}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <div>
                        <label className="text-xs font-medium text-gray-600 mb-1 block">Description</label>
                        <textarea
                            value={form.description}
                            onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                            rows={3}
                            placeholder="Describe the constraint in detail..."
                            className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500 resize-none"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-medium text-gray-600 mb-1 block">Owner</label>
                            <input
                                type="text"
                                value={form.owner}
                                onChange={(e) => setForm((p) => ({ ...p, owner: e.target.value }))}
                                placeholder="Name or role"
                                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-medium text-gray-600 mb-1 block">Target Resolution Date</label>
                            <input
                                type="date"
                                value={form.target_resolution}
                                onChange={(e) => setForm((p) => ({ ...p, target_resolution: e.target.value }))}
                                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="text-xs font-medium text-gray-600 mb-1 block">Resolution Steps</label>
                        <textarea
                            value={form.resolution_steps}
                            onChange={(e) => setForm((p) => ({ ...p, resolution_steps: e.target.value }))}
                            rows={2}
                            placeholder="What needs to happen to resolve this?"
                            className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none resize-none"
                        />
                    </div>
                    <div className="flex gap-3 justify-end pt-1">
                        <button
                            type="button"
                            onClick={() => { setShowForm(false); setForm(EMPTY_FORM); setError(null); }}
                            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={handleCreate}
                            disabled={submitting || !form.title.trim()}
                            className="px-5 py-2 bg-[#0D2137] text-white text-sm font-medium rounded-xl hover:bg-[#1a3a5c] disabled:opacity-40"
                        >
                            {submitting ? 'Saving...' : 'Save Constraint'}
                        </button>
                    </div>
                </div>
            )}

            {constraints.length === 0 && !showForm && canEdit ? (
                <EmptyStateWithAI
                    tabName="constraints"
                    workpackId={workpackId}
                    icon="⚠️"
                    emptyText="No constraints logged yet"
                    onGenerated={() => loadConstraints()}
                />
            ) : constraints.length === 0 && !showForm ? (
                <div className="text-center py-16 text-gray-500 text-sm">No constraints logged. Constraints are shared to the organisation&apos;s central register.</div>
            ) : (
                <div className="space-y-3">
                    {constraints.map((c: any) => {
                        const sev = SEVERITIES.find((s) => s.value === c.severity) ?? SEVERITIES[2];
                        const isEditing = editingId === c.id;
                        return (
                            <div key={c.id} className={`rounded-2xl border p-4 ${sev.bg} ${sev.border}`}>
                                <div className="flex items-start justify-between gap-3 mb-3">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-mono text-xs font-semibold text-gray-500">{c.constraint_number}</span>
                                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${sev.badge}`}>{sev.label}</span>
                                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${STATUS_STYLES[c.status] ?? 'bg-gray-100 text-gray-600'}`}>
                                            {c.status.replace('_', ' ')}
                                        </span>
                                        <span className="text-xs text-gray-400 bg-white/70 px-2 py-0.5 rounded-full capitalize">{c.category}</span>
                                    </div>
                                    {canEdit && !isEditing && (
                                        <div className="flex items-center gap-2 flex-none">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setEditingId(c.id);
                                                    setEditForm({
                                                        title: c.title,
                                                        description: c.description,
                                                        category: c.category,
                                                        severity: c.severity,
                                                        owner: c.owner ?? '',
                                                        resolution_steps: c.resolution_steps ?? '',
                                                    });
                                                }}
                                                className="text-xs text-gray-500 hover:text-blue-600 px-2 py-1 rounded-lg hover:bg-white/60"
                                            >
                                                ✎ Edit
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleDelete(c.id)}
                                                className="text-xs text-gray-400 hover:text-red-500 px-2 py-1 rounded-lg hover:bg-white/60"
                                            >
                                                ✕
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {isEditing ? (
                                    <div className="space-y-3 bg-white/80 rounded-xl p-3">
                                        <input
                                            type="text"
                                            value={editForm.title ?? ''}
                                            onChange={(e) => setEditForm((p) => ({ ...p, title: e.target.value }))}
                                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none font-medium"
                                        />
                                        <textarea
                                            value={editForm.description ?? ''}
                                            onChange={(e) => setEditForm((p) => ({ ...p, description: e.target.value }))}
                                            rows={2}
                                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none resize-none"
                                        />
                                        <textarea
                                            value={editForm.resolution_steps ?? ''}
                                            onChange={(e) => setEditForm((p) => ({ ...p, resolution_steps: e.target.value }))}
                                            rows={2}
                                            placeholder="Resolution steps..."
                                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none resize-none"
                                        />
                                        <div className="flex gap-2 justify-end">
                                            <button type="button" onClick={() => setEditingId(null)} className="text-xs text-gray-500 hover:text-gray-800 px-3 py-1">Cancel</button>
                                            <button type="button" onClick={() => handleEdit(c.id)} className="text-xs bg-blue-600 text-white px-3 py-1 rounded-lg hover:bg-blue-700">Save</button>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <h3 className="text-sm font-semibold text-gray-900 mb-1">{c.title}</h3>
                                        {c.description && <p className="text-sm text-gray-700 mb-2 whitespace-pre-wrap">{c.description}</p>}
                                        {c.resolution_steps && (
                                            <div className="mt-2 text-xs text-gray-600 bg-white/60 rounded-lg px-3 py-2">
                                                <span className="font-semibold">Resolution steps:</span> {c.resolution_steps}
                                            </div>
                                        )}
                                    </>
                                )}

                                <div className="flex items-center justify-between mt-3 flex-wrap gap-2">
                                    <div className="flex items-center gap-3 text-xs text-gray-500 flex-wrap">
                                        {c.owner && <span>👤 {c.owner}</span>}
                                        {c.target_resolution && <span>🎯 {new Date(c.target_resolution).toLocaleDateString('en-GB')}</span>}
                                        {c.raised_by && <span>Raised by {c.raised_by}</span>}
                                        {c.attachments?.map((att: any) => (
                                            <a key={att.id} href={att.file_path} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-blue-600 hover:underline">
                                                📎 {att.filename}
                                            </a>
                                        ))}
                                    </div>
                                    {canEdit && !isEditing && (
                                        <div className="flex items-center gap-2">
                                            <select
                                                value={c.status}
                                                onChange={(e) => handleStatusChange(c.id, e.target.value)}
                                                className="text-xs border border-gray-300 rounded-lg px-2 py-1 bg-white focus:outline-none"
                                            >
                                                {['open', 'in_progress', 'resolved', 'closed', 'cancelled'].map((s) => (
                                                    <option key={s} value={s}>{s.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase())}</option>
                                                ))}
                                            </select>
                                            <label className="text-xs text-gray-500 border border-gray-300 rounded-lg px-2 py-1 bg-white/80 cursor-pointer hover:bg-white flex items-center gap-1">
                                                <input
                                                    type="file"
                                                    accept=".pdf"
                                                    className="hidden"
                                                    disabled={uploadingFor === c.id}
                                                    onChange={(e) => {
                                                        const f = e.target.files?.[0];
                                                        if (f) handleAttach(c.id, f);
                                                    }}
                                                />
                                                {uploadingFor === c.id ? '⏳' : '📎 PDF'}
                                            </label>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
