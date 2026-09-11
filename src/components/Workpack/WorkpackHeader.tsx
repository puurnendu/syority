'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { ApprovalStatusBar } from './ApprovalStatusBar';

type WorkpackStatus = 'pending_ai_review' | 'draft' | 'under_review' | 'approved' | 'issued' | 'in_execution' | 'completed' | 'closed' | 'cancelled';

const STATUS_CONFIG: Record<WorkpackStatus, { label: string; color: string; bg: string; border: string }> = {
    pending_ai_review: { label: 'AI Review', color: '#7C3AED', bg: '#F5F3FF', border: '#DDD6FE' },
    draft: { label: 'Draft', color: '#6B7280', bg: '#F9FAFB', border: '#E5E7EB' },
    under_review: { label: 'Under Review', color: '#D97706', bg: '#FFFBEB', border: '#FDE68A' },
    approved: { label: 'Approved', color: '#059669', bg: '#ECFDF5', border: '#A7F3D0' },
    issued: { label: 'Issued', color: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE' },
    in_execution: { label: 'In Execution', color: '#EA580C', bg: '#FFF7ED', border: '#FDBA74' },
    completed: { label: 'Completed', color: '#0D9488', bg: '#F0FDFA', border: '#99F6E4' },
    closed: { label: 'Closed', color: '#047857', bg: '#D1FAE5', border: '#6EE7B7' },
    cancelled: { label: 'Cancelled', color: '#B91C1C', bg: '#FEF2F2', border: '#FECACA' },
};

interface WorkpackHeaderProps {
    /** When true, show Export MS Project XML button. From tenant feature_flags.can_export_xml. */
    canExportXml?: boolean;
    workpack: {
        id: string;
        workpack_number?: string;
        title: string;
        revision?: string;
        status: WorkpackStatus;
        is_locked?: boolean;
        sap_work_order?: string;
        sap_notification?: string;
        work_type?: string;
        priority?: string;
        scope_of_work?: string;
        planned_start_date?: string;
        planned_end_date?: string;
        estimated_manhours?: number;
        discipline?: { name: string; code: string; color: string } | null;
        site?: { name: string } | null;
        contractor?: { name: string } | null;
        creator?: { name: string } | null;
        approval_status?: string | null;
        approval_submitted_at?: string | null;
        approval_decided_at?: string | null;
        approved_by_name?: string | null;
        approved_by_email?: string | null;
        approval_notes?: string | null;
    };
}

const inputClass = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none";

export function WorkpackHeader({ workpack, canExportXml }: WorkpackHeaderProps) {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [showCloneModal, setShowCloneModal] = useState(false);
    const [cloneTitle, setCloneTitle] = useState('');
    const [cloning, setCloning] = useState(false);
    const cfg = STATUS_CONFIG[workpack.status] ?? STATUS_CONFIG.draft;
    const canEdit = !workpack.is_locked && ['draft', 'pending_ai_review'].includes(workpack.status);

    const handleWorkflowAction = async (action: string, comment?: string) => {
        if (action === 'reject') {
            const c = prompt('Rejection comment (required):');
            if (!c) return;
            comment = c;
        }
        setLoading(true);
        try {
            const res = await fetch(`/api/workpacks/${workpack.id}/workflow`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action, comment }),
            });
            if (!res.ok) {
                const err = await res.json();
                setError(err.error ?? 'Action failed');
            } else {
                window.location.reload();
            }
        } finally {
            setLoading(false);
        }
    };

    const handleClone = async () => {
        setCloning(true);
        setError('');
        try {
            const res = await fetch(`/api/workpacks/${workpack.id}/clone`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title: cloneTitle.trim() || undefined }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error ?? 'Clone failed');
            setShowCloneModal(false);
            router.push(`/workpacks/${json.data.id}`);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setCloning(false);
        }
    };

    const handleSave = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setSaving(true);
        setError('');
        const form = new FormData(e.currentTarget);
        const data: Record<string, any> = {};

        // Only include changed fields
        const title = form.get('title') as string;
        if (title && title !== workpack.title) data.title = title;

        const sap_work_order = form.get('sap_work_order') as string;
        if (sap_work_order !== (workpack.sap_work_order ?? '')) data.sap_work_order = sap_work_order || null;

        const sap_notification = form.get('sap_notification') as string;
        if (sap_notification !== (workpack.sap_notification ?? '')) data.sap_notification = sap_notification || null;

        const work_type = form.get('work_type') as string;
        if (work_type !== (workpack.work_type ?? '')) data.work_type = work_type || null;

        const priority = form.get('priority') as string;
        if (priority !== (workpack.priority ?? '')) data.priority = priority || null;

        const scope_of_work = form.get('scope_of_work') as string;
        if (scope_of_work !== (workpack.scope_of_work ?? '')) data.scope_of_work = scope_of_work || null;

        const estimated_manhours = form.get('estimated_manhours') as string;
        const eh = estimated_manhours ? Number(estimated_manhours) : null;
        if (eh !== (workpack.estimated_manhours ?? null)) data.estimated_manhours = eh;

        const planned_start_date = form.get('planned_start_date') as string;
        if (planned_start_date) data.planned_start_date = new Date(planned_start_date).toISOString();
        else if (workpack.planned_start_date) data.planned_start_date = null;

        const planned_end_date = form.get('planned_end_date') as string;
        if (planned_end_date) data.planned_end_date = new Date(planned_end_date).toISOString();
        else if (workpack.planned_end_date) data.planned_end_date = null;

        if (Object.keys(data).length === 0) {
            setEditing(false);
            setSaving(false);
            return;
        }

        try {
            const res = await fetch(`/api/workpacks/${workpack.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || 'Save failed');
            }
            setEditing(false);
            router.refresh();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    const WORKFLOW_BUTTONS: Record<WorkpackStatus, Array<{ action: string; label: string; variant: 'primary' | 'danger' | 'secondary' }>> = {
        draft: [{ action: 'submit', label: 'Submit for Review', variant: 'primary' }],
        under_review: [{ action: 'approve', label: 'Approve', variant: 'primary' }, { action: 'reject', label: 'Reject', variant: 'danger' }],
        approved: [{ action: 'issue', label: 'Issue Workpack', variant: 'primary' }],
        issued: [{ action: 'close', label: 'Close Workpack', variant: 'secondary' }],
        pending_ai_review: [{ action: 'submit', label: 'Move to Draft', variant: 'secondary' }],
        closed: [],
        cancelled: [],
    };

    const actions = WORKFLOW_BUTTONS[workpack.status] ?? [];

    const formatDate = (d?: string) => d ? new Date(d).toISOString().split('T')[0] : '';

    // ── EDIT MODE ──
    if (editing) {
        return (
            <div className="bg-white border border-blue-200 rounded-xl shadow-sm overflow-hidden">
                <form onSubmit={handleSave}>
                    <div className="px-6 py-4 border-b border-blue-100 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-mono font-semibold text-gray-400 tracking-wider uppercase">
                                {workpack.workpack_number ?? 'DRAFT'}
                            </span>
                            <span className="text-sm font-medium text-blue-600">— Editing</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <button type="button" onClick={() => setEditing(false)} className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200">
                                Cancel
                            </button>
                            <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">
                                {saving ? 'Saving…' : 'Save Changes'}
                            </button>
                        </div>
                    </div>
                    {error && <div className="mx-6 mt-4 p-3 bg-red-50 text-red-700 text-sm rounded-lg">{error}</div>}
                    <div className="px-6 py-4 space-y-4">
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Title</label>
                            <input name="title" defaultValue={workpack.title} required className={inputClass} />
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">SAP Work Order</label>
                                <input name="sap_work_order" defaultValue={workpack.sap_work_order ?? ''} className={inputClass} />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">SAP Notification</label>
                                <input name="sap_notification" defaultValue={workpack.sap_notification ?? ''} className={inputClass} />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Work Type</label>
                                <select name="work_type" defaultValue={workpack.work_type ?? ''} className={inputClass}>
                                    <option value="">Select…</option>
                                    <option value="Shutdown">Shutdown</option>
                                    <option value="Turnaround">Turnaround</option>
                                    <option value="Maintenance">Maintenance</option>
                                    <option value="Capital Project">Capital Project</option>
                                    <option value="Inspection">Inspection</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Priority</label>
                                <select name="priority" defaultValue={workpack.priority ?? ''} className={inputClass}>
                                    <option value="">Select…</option>
                                    <option value="critical">Critical</option>
                                    <option value="high">High</option>
                                    <option value="medium">Medium</option>
                                    <option value="low">Low</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Planned Start</label>
                                <input name="planned_start_date" type="date" defaultValue={formatDate(workpack.planned_start_date)} className={inputClass} />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Planned End</label>
                                <input name="planned_end_date" type="date" defaultValue={formatDate(workpack.planned_end_date)} className={inputClass} />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Est. Manhours</label>
                                <input name="estimated_manhours" type="number" min="0" step="0.5" defaultValue={workpack.estimated_manhours ?? ''} className={inputClass} />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Scope of Work</label>
                            <textarea name="scope_of_work" rows={3} defaultValue={workpack.scope_of_work ?? ''} className={inputClass} />
                        </div>
                    </div>
                </form>
            </div>
        );
    }

    // ── VIEW MODE ──
    return (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-mono font-semibold text-gray-400 tracking-wider uppercase">
                                {workpack.workpack_number ?? 'DRAFT'}
                            </span>
                            {workpack.revision && (
                                <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{workpack.revision}</span>
                            )}
                            {workpack.is_locked && (
                                <span title="Workpack Locked" className="text-yellow-500" style={{ fontSize: 14 }}>🔒</span>
                            )}
                        </div>
                        <h1 className="text-xl font-semibold text-gray-900 truncate">{workpack.title}</h1>
                    </div>
                    <span
                        className="ml-3 shrink-0 inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border"
                        style={{ color: cfg.color, background: cfg.bg, borderColor: cfg.border }}
                    >
                        {cfg.label}
                    </span>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    {canEdit && (
                        <button
                            onClick={() => setEditing(true)}
                            className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200"
                        >
                            ✏️ Edit
                        </button>
                    )}
                    {actions.map((btn) => (
                        <button
                            key={btn.action}
                            disabled={loading}
                            onClick={() => handleWorkflowAction(btn.action)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${btn.variant === 'primary' ? 'bg-blue-600 text-white hover:bg-blue-700' :
                                btn.variant === 'danger' ? 'bg-red-600 text-white hover:bg-red-700' :
                                    'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                        >
                            {btn.label}
                        </button>
                    ))}
                    <button
                        onClick={() => window.open(`/api/workpacks/${workpack.id}/pdf`, '_blank')}
                        className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-800 text-white hover:bg-gray-900"
                    >
                        📄 PDF
                    </button>
                    {canExportXml && (
                        <button
                            onClick={() => window.open(`/api/workpacks/${workpack.id}/export/ms-project`, '_blank')}
                            className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-700 text-white hover:bg-gray-800"
                            title="Export schedule as MS Project XML"
                        >
                            📅 Export MS Project XML
                        </button>
                    )}
                    <button
                        onClick={() => {
                            setCloneTitle(`Copy of ${workpack.title}`);
                            setShowCloneModal(true);
                        }}
                        className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200"
                        title="Clone this workpack into a new draft"
                    >
                        ⧉ Clone
                    </button>
                </div>
            </div>

            {error && (
                <div className="flex items-start gap-2 p-3 mx-6 mt-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                    <span className="flex-shrink-0 mt-0.5">⚠</span>
                    <span>{error}</span>
                    <button onClick={() => setError('')} className="ml-auto flex-shrink-0 text-red-400 hover:text-red-600">✕</button>
                </div>
            )}

            <div className="px-6 py-3 border-b border-gray-100 flex items-center gap-4 bg-gray-50">
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Client approval</span>
                <ApprovalStatusBar
                    workpackId={workpack.id}
                    initialStatus={workpack.approval_status as any}
                    initialApprovedByName={workpack.approved_by_name}
                    initialApprovedByEmail={workpack.approved_by_email}
                    initialNotes={workpack.approval_notes}
                    canEdit={canEdit}
                />
            </div>

            <div className="px-6 py-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-x-6 gap-y-2 bg-gray-50 text-xs">
                {[
                    { label: 'Site', value: workpack.site?.name },
                    { label: 'Work Type', value: workpack.work_type },
                    { label: 'Priority', value: workpack.priority },
                    { label: 'Discipline', value: workpack.discipline ? `${workpack.discipline.code} · ${workpack.discipline.name}` : undefined },
                    { label: 'SAP WO', value: workpack.sap_work_order },
                    { label: 'Est. Hours', value: workpack.estimated_manhours != null ? `${workpack.estimated_manhours} h` : undefined },
                    { label: 'Start', value: workpack.planned_start_date ? new Date(workpack.planned_start_date).toLocaleDateString() : undefined },
                    { label: 'End', value: workpack.planned_end_date ? new Date(workpack.planned_end_date).toLocaleDateString() : undefined },
                    { label: 'Contractor', value: workpack.contractor?.name },
                    { label: 'Creator', value: workpack.creator?.name },
                ].filter(f => f.value).map((field) => (
                    <div key={field.label}>
                        <span className="text-gray-400 uppercase tracking-wider font-medium">{field.label}</span>
                        <p className="text-gray-800 font-medium truncate">{field.value}</p>
                    </div>
                ))}
            </div>

            {/* Clone Modal */}
            {showCloneModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
                        <div className="px-6 py-4 border-b border-gray-100">
                            <h3 className="font-semibold text-gray-900">Clone Workpack</h3>
                            <p className="text-xs text-gray-500 mt-0.5">
                                A new draft will be created copying activities, materials, and tools.
                                Joints and blinds are not copied.
                            </p>
                        </div>
                        <div className="px-6 py-4 space-y-3">
                            <label className="block text-xs font-medium text-gray-600 mb-1">New Workpack Title</label>
                            <input
                                id="clone-title-input"
                                type="text"
                                value={cloneTitle}
                                onChange={(e) => setCloneTitle(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                autoFocus
                                onKeyDown={(e) => e.key === 'Enter' && handleClone()}
                            />
                            {error && (
                                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
                            )}
                        </div>
                        <div className="px-6 py-4 border-t border-gray-100 flex justify-between">
                            <button
                                type="button"
                                onClick={() => { setShowCloneModal(false); setError(''); }}
                                className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleClone}
                                disabled={cloning || !cloneTitle.trim()}
                                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                            >
                                {cloning ? 'Cloning…' : '⧉ Clone Workpack'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
