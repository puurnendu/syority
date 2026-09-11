'use client';

import { useState, useEffect, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { QaClearanceDrawer } from './QaClearanceDrawer';
import { ApplyTemplateModal } from './ApplyTemplateModal';
import { ActivityCodeLibraryModal } from './ActivityCodeLibraryModal';
import { GanttChart } from './GanttChart';
import { PredecessorEditor, type PredecessorItem } from './Activity/PredecessorEditor';
import { BulkPredecessorModal } from './Activity/BulkPredecessorModal';
import { mapGridFieldToExecution } from '@/core/execution/executionFieldGuard';

// ── Column resize handle (reusable) ─────────────────────
function ColResizeHandle({
    colKey,
    onStart,
}: {
    colKey: string;
    onStart: (e: React.MouseEvent, key: string) => void;
}) {
    return (
        <div
            className="absolute right-0 top-0 h-full w-2 cursor-col-resize z-10 flex items-center justify-center group/handle"
            onMouseDown={(e) => onStart(e, colKey)}
            onClick={(e) => e.stopPropagation()}
        >
            <div className="w-px h-4 bg-gray-300 group-hover/handle:bg-blue-400 group-hover/handle:w-0.5 transition-all" />
        </div>
    );
}

// ── Column Definitions ──────────────────────────────────
// Per master prompt Section 11.1 + P8:
//   planned_start / planned_end are READ-ONLY (calculated by recalculateSchedule)
//   Planner enters: description, activity_code, discipline, duration_hours, predecessors

type ColDef = {
    key: string; label: string; width: string;
    type: 'text' | 'number' | 'date_ro' | 'select' | 'progress' | 'readonly' | 'discipline_select' | 'predecessors_edit' | 'hold_point' | 'qa_action' | 'udf_text' | 'udf_number' | 'udf_select';
    field: string; options?: { value: string; label: string }[];
    defaultVisible?: boolean;
    tooltip?: string;
    udfCode?: string;
    udfType?: string;
    udfOptions?: Array<{ value: string; code_value?: string | null; label: string }>;
};

const WORK_CATEGORIES = [
    { value: '', label: '—' }, { value: 'mechanical', label: 'Mechanical' }, { value: 'electrical', label: 'Electrical' },
    { value: 'instrumentation', label: 'Instrumentation' }, { value: 'piping', label: 'Piping' }, { value: 'civil', label: 'Civil' },
    { value: 'painting', label: 'Painting' }, { value: 'insulation', label: 'Insulation' }, { value: 'scaffolding', label: 'Scaffolding' },
    { value: 'welding', label: 'Welding' }, { value: 'ndt', label: 'NDT' },
];

const STATUS_OPTIONS = [
    { value: 'not_started', label: 'Not Started' }, { value: 'in_progress', label: 'In Progress' },
    { value: 'completed', label: 'Completed' }, { value: 'on_hold', label: 'On Hold' }, { value: 'cancelled', label: 'Cancelled' },
];

const WINDOW_OPTIONS = [
    { value: '', label: '— None —' },
    { value: 'PreSD', label: 'Pre-Shutdown (PreSD)' },
    { value: 'OP', label: 'Operational (OP)' },
    { value: 'IR', label: 'Initial Response (IR)' },
    { value: 'CP', label: 'Critical Path (CP)' },
    { value: 'TO', label: 'Turn-Over (TO)' },
    { value: 'SP', label: 'Spare (SP)' },
    { value: 'PostSD', label: 'Post-Shutdown (PostSD)' },
];

// Columns per Section 11.1:
// # | Activity Code | Description | Discipline | Duration (hrs) | Predecessors | Plan Start (calc) | Plan End (calc) | Progress% | Status
const ALL_COLUMNS: ColDef[] = [
    { key: 'seq', label: '#', width: 'w-10', type: 'readonly', field: 'sequence_number', defaultVisible: true },
    { key: 'act_code', label: 'Activity ID', width: 'w-28', type: 'text', field: 'activity_number', defaultVisible: true },
    { key: 'desc', label: 'Description', width: 'min-w-[200px]', type: 'text', field: 'description', defaultVisible: true },
    { key: 'hold_point', label: 'HP', width: 'w-12', type: 'hold_point', field: 'hold_point_type', defaultVisible: true, tooltip: 'QA Hold Point (H) / Witness (W)' },
    { key: 'category', label: 'Work Category', width: 'w-28', type: 'select', field: 'work_category', options: WORK_CATEGORIES, defaultVisible: true },
    { key: 'window', label: 'Window', width: 'w-24', type: 'select', field: 'window', options: WINDOW_OPTIONS, defaultVisible: true },
    { key: 'discipline', label: 'Discipline', width: 'w-28', type: 'discipline_select', field: 'discipline_id', defaultVisible: true },
    { key: 'hours', label: 'Dur. (hrs)', width: 'w-20', type: 'number', field: 'duration_hours', defaultVisible: true },
    { key: 'predecessors', label: 'Predecessors', width: 'w-28', type: 'predecessors_edit', field: '_predecessors', defaultVisible: true },
    // P8: Plan Start and Plan End are CALCULATED — read-only in UI
    { key: 'plan_start', label: 'Plan Start (calc)', width: 'w-28', type: 'date_ro', field: 'planned_start', defaultVisible: false, tooltip: 'Auto-calculated from duration + predecessor relationships' },
    { key: 'plan_end', label: 'Plan End (calc)', width: 'w-28', type: 'date_ro', field: 'planned_end', defaultVisible: false, tooltip: 'Auto-calculated from duration + predecessor relationships' },
    { key: 'act_start', label: 'Act. Start', width: 'w-28', type: 'date_ro', field: 'actual_start', defaultVisible: false },
    { key: 'act_end', label: 'Act. End', width: 'w-28', type: 'date_ro', field: 'actual_end', defaultVisible: false },
    { key: 'progress', label: 'Progress %', width: 'w-24', type: 'progress', field: 'progress_percent', defaultVisible: true },
    { key: 'qa', label: 'Quality', width: 'w-16', type: 'qa_action', field: 'id', defaultVisible: true },
    { key: 'status', label: 'Status', width: 'w-28', type: 'select', field: 'status', options: STATUS_OPTIONS, defaultVisible: true },
    { key: 'notes', label: 'Notes', width: 'min-w-[150px]', type: 'text', field: 'notes', defaultVisible: false },
    { key: 'p6_id', label: 'P6 Activity ID', width: 'w-28', type: 'readonly', field: 'p6_activity_id', defaultVisible: false },
    { key: 'critical', label: 'Critical', width: 'w-16', type: 'readonly', field: 'is_critical', defaultVisible: true },
];

const DEFAULT_VISIBLE_UDF_CODES = new Set(['discipline', 'hold_point_ts', 'hold_point_ai', 'welding_qty', 'scaffolding_qty', 'permit_type', 'phase']);

const statusColor: Record<string, string> = {
    not_started: 'gray', in_progress: 'blue', completed: 'green', on_hold: 'yellow', cancelled: 'red', pending: 'gray',
};

const inputCls = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none";

// ── Helpers ─────────────────────────────────────────────
function Badge({ label, color }: { label: string; color: string }) {
    const colors: Record<string, string> = {
        green: 'bg-green-100 text-green-800', red: 'bg-red-100 text-red-800',
        yellow: 'bg-yellow-100 text-yellow-800', blue: 'bg-blue-100 text-blue-800',
        gray: 'bg-gray-100 text-gray-700', purple: 'bg-purple-100 text-purple-800',
        indigo: 'bg-indigo-100 text-indigo-800',
    };
    return <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${colors[color] ?? colors.gray}`}>{label}</span>;
}

function EmptyState({ icon, message }: { icon: string; message: string }) {
    return (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <span className="text-4xl mb-3">{icon}</span>
            <p className="text-sm">{message}</p>
        </div>
    );
}

function Modal({ title, open, onClose, children }: { title: string; open: boolean; onClose: () => void; children: React.ReactNode }) {
    if (!open) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[85vh] flex flex-col">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                    <h3 className="text-base font-semibold text-gray-900">{title}</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
                </div>
                <div className="p-6 overflow-y-auto flex-1">{children}</div>
            </div>
        </div>
    );
}

function FormField({ label, children, required, hint }: { label: string; children: React.ReactNode; required?: boolean; hint?: string }) {
    return (
        <div className="mb-4">
            <label className="block text-xs font-medium text-gray-700 mb-1">
                {label}{required && <span className="text-red-500 ml-0.5">*</span>}
            </label>
            {children}
            {hint && <p className="mt-1 text-xs text-gray-400">{hint}</p>}
        </div>
    );
}

function getUdfValue(activity: any, udfCode: string): string {
    const vals = activity?.udf_values ?? [];
    const v = vals.find((x: any) => x.definition?.code === udfCode);
    if (!v) return '';
    const opt = v.option;
    if (opt) return opt.label ?? opt.code_value ?? opt.value ?? '';
    return v.value_string ?? (v.value_number != null ? String(v.value_number) : '') ?? '';
}

function getUdfRawValue(activity: any, udfCode: string): string | number | null {
    const vals = activity?.udf_values ?? [];
    const v = vals.find((x: any) => x.definition?.code === udfCode);
    if (!v) return null;
    if (v.option) return v.option.code_value ?? v.option.value ?? null;
    if (v.value_string != null) return v.value_string;
    if (v.value_number != null) return Number(v.value_number);
    return null;
}

// ── Main Component ──────────────────────────────────────
// ── Column widths (px) — persisted to localStorage ─
const DEFAULT_COL_WIDTHS: Record<string, number> = {
    seq: 52,
    act_code: 120,
    desc: 300,
    discipline: 100,
    hours: 80,
    plan_start: 110,
    plan_end: 110,
    progress: 90,
    hold_point: 90,
    status: 110,
    notes: 160,
    category: 100,
    window: 90,
    predecessors: 120,
    act_start: 110,
    act_end: 110,
    qa: 90,
    p6_id: 120,
    critical: 70,
};

export function ActivitiesPanel({ workpack, udfDefinitions = [] }: { workpack: any; udfDefinitions?: any[] }) {
    const router = useRouter();
    const [view, setView] = useState<'table' | 'gantt'>('table');
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [bulkStatus, setBulkStatus] = useState('');
    const [bulking, setBulking] = useState(false);
    const [bulkError, setBulkError] = useState<string | null>(null);
    const [showBulkPredecessor, setShowBulkPredecessor] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [assigningCodeId, setAssigningCodeId] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [showModal, setShowModal] = useState(false);
    const [showApplyModal, setShowApplyModal] = useState(false);
    const [showLibrary, setShowLibrary] = useState(false);
    const [showColumns, setShowColumns] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [editCell, setEditCell] = useState<{ rowId: string; field: string } | null>(null);
    const [editValue, setEditValue] = useState<string>('');
    const [activityIdDuplicate, setActivityIdDuplicate] = useState<{ rowId: string; suggestion: string } | null>(null);
    const [selectedActivity, setSelectedActivity] = useState<any>(null);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [disciplines, setDisciplines] = useState<{ id: string; name: string; code: string; color: string | null }[]>([]);

    const [colWidths, setColWidths] = useState<Record<string, number>>(() => {
        try {
            const saved = localStorage.getItem('activities_col_widths');
            return saved ? { ...DEFAULT_COL_WIDTHS, ...JSON.parse(saved) } : DEFAULT_COL_WIDTHS;
        } catch {
            return DEFAULT_COL_WIDTHS;
        }
    });
    function persistColWidths(widths: Record<string, number>) {
        try {
            localStorage.setItem('activities_col_widths', JSON.stringify(widths));
        } catch {}
    }
    function startColResize(e: React.MouseEvent, colKey: string) {
        e.preventDefault();
        e.stopPropagation();
        const startX = e.clientX;
        const startWidth = colWidths[colKey] ?? 100;
        const onMove = (ev: MouseEvent) => {
            const newWidth = Math.max(40, startWidth + (ev.clientX - startX));
            setColWidths((prev) => {
                const next = { ...prev, [colKey]: newWidth };
                persistColWidths(next);
                return next;
            });
        };
        const onUp = () => {
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
        };
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
    }

    const udfCols: ColDef[] = (udfDefinitions ?? []).map((udf: any) => {
        const key = `udf_${udf.code}`;
        const type = udf.type === 'select' ? 'udf_select' : udf.type === 'number' ? 'udf_number' : 'udf_text';
        const options = (udf.options ?? []).map((o: any) => ({ value: o.code_value ?? o.value, label: o.label ?? o.description ?? o.value }));
        return {
            key,
            label: udf.name,
            width: udf.type === 'select' ? 'w-28' : 'w-24',
            type,
            field: key,
            udfCode: udf.code,
            udfType: udf.type,
            udfOptions: options,
            defaultVisible: DEFAULT_VISIBLE_UDF_CODES.has(udf.code),
        };
    });
    const allCols = [...ALL_COLUMNS, ...udfCols];

    const storageKey = typeof workpack?.id === 'string' ? `aurianoa_activity_columns_${workpack.id}` : null;
    const [visibleCols, setVisibleCols] = useState<Set<string>>(() => {
        const defaultSet = new Set(allCols.filter(c => c.defaultVisible).map(c => c.key));
        if (typeof window !== 'undefined' && storageKey) {
            try {
                const raw = localStorage.getItem(storageKey);
                if (raw) {
                    const parsed = JSON.parse(raw) as string[];
                    if (Array.isArray(parsed)) return new Set(parsed);
                }
            } catch { /* ignore */ }
        }
        return defaultSet;
    });
    useEffect(() => {
        if (storageKey && visibleCols) {
            try {
                localStorage.setItem(storageKey, JSON.stringify([...visibleCols]));
            } catch { /* ignore */ }
        }
    }, [storageKey, visibleCols]);

    const activities: any[] = workpack.activities ?? [];
    const columns = allCols.filter(c => visibleCols.has(c.key));
    const canEdit = !workpack.is_locked && ['draft', 'pending_ai_review'].includes(workpack.status);

    // Fetch disciplines for dropdown
    useEffect(() => {
        fetch('/api/disciplines')
            .then(r => r.json())
            .then(d => setDisciplines(d.data ?? d ?? []))
            .catch(() => { });
    }, []);

    // Build predecessor lookup: activity_id → array of { seq, code, type, lagDisplay } for display and edit
    const predecessorMap = new Map<string, number[]>();
    const predecessorDisplayMap = new Map<string, Array<{ code: string; type: string; lagDisplay: string }>>();
    for (const a of activities) {
        const preds: number[] = [];
        const displayList: Array<{ code: string; type: string; lagDisplay: string }> = [];
        if (a.predecessors) {
            for (const rel of a.predecessors) {
                const pred = activities.find((act: any) => act.id === rel.predecessor_id);
                if (pred) {
                    preds.push(pred.sequence_number);
                    const code = pred.activity_id ?? (pred.activity_number || String(pred.sequence_number ?? ''));
                    const type = (rel.relationship_type ?? 'FS') as string;
                    const lagHrs = rel.lag_minutes != null ? Number(rel.lag_minutes) / 60 : (rel.lag_days != null ? Number(rel.lag_days) * 8 : 0);
                    const lagDisplay = lagHrs !== 0 ? (lagHrs > 0 ? `+${Math.round(lagHrs)}h` : `${Math.round(lagHrs)}h`) : '';
                    displayList.push({ code, type, lagDisplay });
                }
            }
        }
        predecessorMap.set(a.id, preds.sort((x: number, y: number) => x - y));
        predecessorDisplayMap.set(a.id, displayList);
    }

    const toggleColumn = (key: string) => {
        setVisibleCols(prev => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    };

    // ── Inline edit ─────────────────────────────────────
    const startEdit = (rowId: string, field: string, currentValue: any, type: string, col?: ColDef) => {
        if (type === 'readonly' || type === 'date_ro') return;
        if (type === 'udf_select' || type === 'udf_number' || type === 'udf_text') {
            const activity = activities.find((a: any) => a.id === rowId);
            const code = col?.udfCode ?? field.replace(/^udf_/, '');
            const raw = getUdfRawValue(activity, code);
            setEditCell({ rowId, field });
            setEditValue(raw != null ? String(raw) : '');
            return;
        }
        if (type === 'discipline_select') {
            const activity = activities.find((a: any) => a.id === rowId);
            setEditCell({ rowId, field });
            setEditValue(activity?.discipline_id ?? '');
            return;
        }
        if (type === 'predecessors_edit') {
            const preds = predecessorMap.get(rowId) ?? [];
            setEditCell({ rowId, field });
            setEditValue(preds.join(', '));
            return;
        }
        const v = currentValue ?? '';
        setEditCell({ rowId, field });
        setEditValue(String(v));
    };

    const saveEdit = async () => {
        if (!editCell) return;
        const { rowId, field } = editCell;
        const col = allCols.find(c => c.field === field);
        if (!col) return;

        // UDF inline save
        if (field.startsWith('udf_') && col.udfCode) {
            setEditCell(null);
            try {
                const value = col.type === 'udf_number' ? (editValue === '' ? null : Number(editValue)) : (editValue === '' ? null : editValue);
                const res = await fetch(`/api/workpacks/${workpack.id}/activities/${rowId}/udf`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ code: col.udfCode, value }),
                });
                if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    throw new Error(err.error || 'Save failed');
                }
                router.refresh();
            } catch (err: unknown) {
                setError(err instanceof Error ? err.message : 'Save failed');
            }
            return;
        }

        // Handle predecessors separately — needs to save relationships
        if (col.type === 'predecessors_edit') {
            setEditCell(null);
            try {
                // Parse comma-separated sequence numbers to predecessor activity IDs
                const seqNums = editValue.split(',').map(s => s.trim()).filter(s => s !== '').map(Number).filter(n => !isNaN(n));
                const predecessorIds = seqNums
                    .map(seq => activities.find((a: any) => a.sequence_number === seq))
                    .filter(Boolean)
                    .map((a: any) => a.id);
                const res = await fetch(`/api/workpacks/${workpack.id}/activities/${rowId}/predecessors`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ predecessor_ids: predecessorIds }),
                });
                if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    throw new Error(err.error || 'Save failed');
                }
                router.refresh();
            } catch (err: unknown) {
                setError(err instanceof Error ? err.message : 'Save failed');
            }
            return;
        }

        let value: any = editValue;
        if (col.type === 'number' || col.type === 'progress') {
            value = Number(value) || 0;
            if (col.type === 'progress' && value === 100) {
                const activity = activities.find((a: any) => a.id === rowId);
                if (activity?.hold_point_type === 'H' && (!activity.qa_clearances || activity.qa_clearances.length === 0)) {
                    setError('Cannot complete activity: QA Hold Point clearance required. Use the QA column to provide clearance first.');
                    return;
                }
            }
        } else if (col.type === 'discipline_select') {
            value = editValue || null;
        } else if (value === '') {
            value = null;
        }

        // Activity ID column: send activity_id to API
        const patchBody = col.key === 'act_code' ? { activity_id: value } : { [field]: value };

        if (field === 'status' || field === 'progress_percent') {
            const activity = activities.find((a: any) => a.id === rowId);
            const mapped = mapGridFieldToExecution(field, value, activity?.status);
            if ('error' in mapped) {
                setError(mapped.error);
                setEditCell(null);
                return;
            }
            try {
                const res = await fetch('/api/execution/action', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        activityId: rowId,
                        action: mapped.action,
                        progress: mapped.progress,
                        hold_reason: mapped.action === 'HOLD' ? 'Hold from workpack activity grid' : undefined,
                    }),
                });
                const errData = await res.json().catch(() => ({}));
                if (!res.ok) {
                    throw new Error((errData as { error?: string }).error || 'Execution update blocked');
                }
                setEditCell(null);
                router.refresh();
            } catch (err: unknown) {
                setEditCell(null);
                setError(err instanceof Error ? err.message : 'Save failed');
            }
            return;
        }

        try {
            const res = await fetch(`/api/workpacks/${workpack.id}/activities/${rowId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(patchBody),
            });
            const errData = await res.json().catch(() => ({}));
            if (!res.ok) {
                if (res.status === 409 && (errData as { code?: string }).code === 'ACTIVITY_ID_DUPLICATE') {
                    setActivityIdDuplicate({ rowId, suggestion: (errData as { suggestion?: string }).suggestion ?? '' });
                    setError('');
                    return; // keep cell in edit mode
                }
                setEditCell(null);
                setActivityIdDuplicate(null);
                throw new Error((errData as { error?: string }).error || 'Save failed');
            }
            setEditCell(null);
            setActivityIdDuplicate(null);
            router.refresh();
        } catch (err: unknown) {
            setEditCell(null);
            setActivityIdDuplicate(null);
            setError(err instanceof Error ? err.message : 'Save failed');
        }
    };

    const cancelEdit = () => { setEditCell(null); setActivityIdDuplicate(null); };
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') { e.preventDefault(); saveEdit(); }
        else if (e.key === 'Escape') cancelEdit();
    };

    // ── Add new activity (NO date fields — P8 rule) ─────
    const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setSaving(true); setError('');
        const form = new FormData(e.currentTarget);
        try {
            const res = await fetch(`/api/workpacks/${workpack.id}/activities`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    description: form.get('description'),
                    activity_id: (form.get('activity_number') as string)?.trim() || undefined,
                    activity_number: form.get('activity_number') || null,
                    work_category: form.get('work_category') || null,
                    window: form.get('window') || null,
                    duration_hours: Number(form.get('duration_hours')) || 0,
                    notes: form.get('notes') || null,
                    sequence_number: activities.length + 1,
                    // No planned_start / planned_end — they are CALCULATED
                }),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({})) as { error?: string; code?: string; suggestion?: string };
                if (res.status === 409 && err.code === 'ACTIVITY_ID_DUPLICATE') {
                    setError(err.suggestion ? `Activity ID already exists in this event. Next available: ${err.suggestion}` : (err.error || 'Activity ID already exists'));
                    return;
                }
                throw new Error(err.error || 'Create failed');
            }
            setShowModal(false);
            router.refresh();
        } catch (err: any) { setError(err.message); } finally { setSaving(false); }
    };

    // ── Cell rendering ──────────────────────────────────
    const formatDate = (d?: string) => {
        if (!d) return '—';
        try {
            return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
        } catch { return '—'; }
    };

    const getCellDisplay = (a: any, col: ColDef) => {
        if (col.type === 'udf_select' || col.type === 'udf_number' || col.type === 'udf_text') {
            const code = col.udfCode ?? col.field.replace(/^udf_/, '');
            const display = getUdfValue(a, code);
            if (col.type === 'udf_select') {
                if (!display) return <span className="text-gray-300">—</span>;
                const disciplineColors: Record<string, string> = { MECH: 'blue', ELEC: 'amber', INST: 'purple', CIVIL: 'gray', PIPING: 'green', STRUCT: 'red', NDT: 'orange', INSUL: 'lime', PAINT: 'pink', SCAFF: 'cyan' };
                const hpColors: Record<string, string> = { H: 'red', W: 'amber', R: 'blue', I: 'gray' };
                const color = code === 'discipline' ? disciplineColors[display.split(' ')[0]] : code === 'hold_point_ts' || code === 'hold_point_ai' ? hpColors[display.split(' ')[0]] ?? 'gray' : 'gray';
                return <Badge label={display} color={color} />;
            }
            if (col.type === 'udf_number') {
                if (display === '' || display === '0') return <span className="text-gray-400">—</span>;
                return <span className="text-right block text-gray-800">{display}</span>;
            }
            if (!display) return <span className="text-gray-300">—</span>;
            return <span className="text-gray-700 truncate block max-w-[120px]" title={display}>{display}</span>;
        }
        const val = a[col.field];

        if (col.key === 'seq') return (
            <span className="font-mono text-[11px] text-gray-400 select-none">
                {val}
            </span>
        );

        if (col.key === 'act_code') {
            const displayVal = a.activity_id ?? a.activity_number ?? '';
            if (!displayVal?.trim()) {
                return (
                    <button
                        type="button"
                        onClick={async (e) => {
                            e.stopPropagation();
                            setAssigningCodeId(a.id);
                            setError('');
                            try {
                                const res = await fetch(`/api/workpacks/${workpack.id}/activities/${a.id}/assign-code`, { method: 'POST' });
                                const data = await res.json().catch(() => ({}));
                                if (!res.ok) throw new Error((data as { error?: string }).error ?? 'Failed');
                                router.refresh();
                                setSuccessMessage('Code assigned');
                                setTimeout(() => setSuccessMessage(null), 2000);
                            } catch (err) {
                                setError(err instanceof Error ? err.message : 'Failed to assign code');
                            } finally {
                                setAssigningCodeId(null);
                            }
                        }}
                        disabled={assigningCodeId === a.id}
                        className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-500 hover:bg-gray-200 disabled:opacity-50"
                    >
                        {assigningCodeId === a.id ? '…' : 'Assign Code'}
                    </button>
                );
            }
            return <span className="font-mono text-gray-800">{displayVal}</span>;
        }

        if (col.key === 'discipline') {
            if (!a.discipline) return <span className="text-gray-300">—</span>;
            return (
                <span className="inline-flex items-center gap-1">
                    {a.discipline.color && <span className="w-2 h-2 rounded-full" style={{ backgroundColor: a.discipline.color }} />}
                    <span className="font-medium">{a.discipline.code}</span>
                </span>
            );
        }

        // Predecessors column — MSP style: "10SS+24 hrs", "9", "13,14"
        if (col.key === 'predecessors') {
            const list = predecessorDisplayMap.get(a.id) ?? [];
            if (list.length === 0) return <span className="text-gray-300 text-[11px]">—</span>;
            return (
                <span className="font-mono text-[11px] text-gray-700">
                    {list.map(({ code, type, lagDisplay }) => {
                        const lag = lagDisplay ? lagDisplay.replace(/h$/i, '') + ' hrs' : '';
                        return `${code}${type !== 'FS' ? type : ''}${lag}`;
                    }).join(', ')}
                </span>
            );
        }

        // P8: Dates are read-only calculated — show with lock icon
        if (col.type === 'date_ro') {
            return (
                <span className="text-gray-500 cursor-default" title={col.tooltip ?? 'Auto-calculated'}>
                    {formatDate(val)} {val ? '🔒' : ''}
                </span>
            );
        }

        if (col.type === 'progress') {
            const pct = Number(val ?? 0);
            return (
                <div className="flex items-center gap-1.5">
                    <div className="w-12 bg-gray-100 rounded-full h-1.5">
                        <div className="bg-blue-500 h-1.5 rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs w-7 text-right">{pct}%</span>
                </div>
            );
        }

        if (col.key === 'status') {
            const labels: Record<string, string> = {
                not_started: 'Not Started',
                in_progress: 'In Progress',
                completed: 'Completed',
                on_hold: 'On Hold',
                cancelled: 'Cancelled',
            };
            const colors: Record<string, string> = {
                not_started: 'text-gray-500',
                in_progress: 'text-blue-600',
                completed: 'text-green-600',
                on_hold: 'text-amber-600',
                cancelled: 'text-red-500',
            };
            return (
                <span className={`text-[11px] font-medium ${colors[val] ?? 'text-gray-500'}`}>
                    {labels[val] ?? val ?? '—'}
                </span>
            );
        }

        if (col.type === 'select') {
            if (col.key === 'window' && val) {
                const WINDOW_COLORS: Record<string, string> = {
                    PreSD: 'blue', OP: 'green', IR: 'yellow', CP: 'red',
                    TO: 'purple', SP: 'gray', PostSD: 'indigo',
                };
                return <Badge label={val} color={WINDOW_COLORS[val] ?? 'gray'} />;
            }
            const opt = col.options?.find(o => o.value === val);
            return opt?.label ?? val ?? <span className="text-gray-300">—</span>;
        }

        if (col.type === 'number') return <span className="text-gray-700">{val ?? 0}</span>;

        if (col.key === 'hold_point') {
            if (!val) return <span className="text-gray-300">—</span>;
            return <Badge label={val} color={val === 'H' ? 'red' : 'yellow'} />;
        }

        if (col.key === 'qa') {
            if (a.hold_point_type === 'H' || a.hold_point_type === 'W') {
                const isCleared = a.qa_clearances?.length > 0;
                return (
                    <button
                        onClick={(e) => { e.stopPropagation(); setSelectedActivity(a); setIsDrawerOpen(true); }}
                        className={`text-[10px] px-2 py-0.5 rounded font-bold transition-all ${isCleared ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700 hover:bg-amber-200'}`}
                    >
                        {isCleared ? 'CLEARED' : 'PENDING'}
                    </button>
                );
            }
            return <span className="text-gray-200">—</span>;
        }

        if (col.key === 'p6_id') return <span className="font-mono text-gray-400 text-xs">{val ?? '—'}</span>;

        if (col.key === 'critical') {
            return val ? (
                <span className="inline-flex items-center text-[10px] font-bold text-red-600 bg-red-50 border border-red-200 rounded-full px-1.5 py-0.5">
                    🔴 Critical
                </span>
            ) : <span className="text-gray-200">—</span>;
        }

        if (col.field === 'description') {
            const indent = (a.indent_level ?? 0);
            const isSummary = a.is_summary ?? false;
            return (
                <span
                    className={`block truncate text-[12px] ${
                        isSummary
                            ? 'font-semibold text-gray-900'
                            : 'font-normal text-gray-800'
                    }`}
                    style={{ paddingLeft: `${indent * 16 + 4}px` }}
                    title={a.description}
                >
                    {isSummary && (
                        <span className="mr-1 text-gray-500 text-[10px]">▶</span>
                    )}
                    {a.description}
                </span>
            );
        }

        return val ?? <span className="text-gray-300">—</span>;
    };

    const getEditInput = (col: ColDef) => {
        const edCls = "w-full px-1.5 py-1 text-xs border border-blue-400 rounded bg-blue-50 focus:outline-none focus:ring-1 focus:ring-blue-500";
        if (col.type === 'select') {
            return (
                <select value={editValue} onChange={e => setEditValue(e.target.value)} onBlur={saveEdit} onKeyDown={handleKeyDown} autoFocus className={edCls}>
                    {col.options?.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
            );
        }
        // Discipline select dropdown
        if (col.type === 'discipline_select') {
            return (
                <select value={editValue} onChange={e => setEditValue(e.target.value)} onBlur={saveEdit} onKeyDown={handleKeyDown} autoFocus className={edCls}>
                    <option value="">— None —</option>
                    {disciplines.map(d => (
                        <option key={d.id} value={d.id}>{d.code} — {d.name}</option>
                    ))}
                </select>
            );
        }
        // Predecessors — full relationship editor with type and lag
        if (col.type === 'predecessors_edit' && editCell) {
            const activity = activities.find((a: any) => a.id === editCell!.rowId);
            const predecessors: PredecessorItem[] = (activity?.predecessors ?? []).map((rel: any) => ({
                predecessorId: rel.predecessor_id,
                type: (rel.relationship_type ?? 'FS') as PredecessorItem['type'],
                // Sprint 1a — canonical lag_minutes → hours; legacy lag_days × 8 fallback.
                lagHours: rel.lag_minutes != null ? Number(rel.lag_minutes) / 60 : (rel.lag_days != null ? Number(rel.lag_days) : 0) * 8,
            }));
            return (
                <PredecessorEditor
                    workpackId={workpack.id}
                    activityId={editCell.rowId}
                    activities={activities}
                    predecessors={predecessors}
                    onSave={async (list) => {
                        const res = await fetch(`/api/workpacks/${workpack.id}/activities/${editCell!.rowId}/predecessors`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ predecessors: list }),
                        });
                        if (!res.ok) {
                            const d = await res.json().catch(() => ({}));
                            throw new Error(d.error ?? 'Save failed');
                        }
                        setEditCell(null);
                        router.refresh();
                    }}
                    onCancel={() => setEditCell(null)}
                />
            );
        }
        if (col.type === 'number' || col.type === 'progress') {
            return <input type="number" value={editValue} onChange={e => setEditValue(e.target.value)} onBlur={saveEdit} onKeyDown={handleKeyDown} autoFocus min={0} max={col.type === 'progress' ? 100 : undefined} step={col.type === 'progress' ? 1 : 0.5} className={edCls} />;
        }
        if (col.type === 'udf_select') {
            return (
                <select value={editValue} onChange={e => setEditValue(e.target.value)} onBlur={saveEdit} onKeyDown={handleKeyDown} autoFocus className={edCls}>
                    <option value="">— None —</option>
                    {(col.udfOptions ?? []).map((o: any) => (
                        <option key={o.value} value={o.value}>{o.label ?? o.value}</option>
                    ))}
                </select>
            );
        }
        if (col.type === 'udf_number') {
            return <input type="number" value={editValue} onChange={e => setEditValue(e.target.value)} onBlur={saveEdit} onKeyDown={handleKeyDown} autoFocus className={edCls} />;
        }
        if (col.type === 'udf_text') {
            return <input type="text" value={editValue} onChange={e => setEditValue(e.target.value)} onBlur={saveEdit} onKeyDown={handleKeyDown} autoFocus className={edCls} />;
        }
        // text
        return <input type="text" value={editValue} onChange={e => setEditValue(e.target.value)} onBlur={saveEdit} onKeyDown={handleKeyDown} autoFocus className={edCls} />;
    };

    // ── Footer summary (Section 11.1) ───────────────────
    const totalDuration = activities.reduce((sum: number, a: any) => sum + (Number(a.duration_hours) || 0), 0);

    return (
        <>
            {error && (
                <div className="mb-4 flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                    <span>⚠</span><span>{error}</span><button onClick={() => setError('')} className="ml-auto text-red-400 hover:text-red-600">✕</button>
                </div>
            )}
            {successMessage && (
                <div className="mb-4 flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
                    <span>✓</span><span>{successMessage}</span><button onClick={() => setSuccessMessage(null)} className="ml-auto text-green-500 hover:text-green-700">✕</button>
                </div>
            )}
            <div className="bg-white border border-gray-300 overflow-hidden shadow-sm">
                {/* View toggle + Toolbar */}
                <div className="px-4 py-2.5 border-b-2 border-gray-300 bg-[#f5f5f5] flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-0 border border-gray-300 rounded overflow-hidden">
                            <button
                                type="button"
                                onClick={() => setView('table')}
                                className={`px-3 py-1.5 text-[11px] font-medium transition-colors border-r border-gray-300 ${
                                    view === 'table'
                                        ? 'bg-white text-gray-900 shadow-inner'
                                        : 'bg-[#f0f0f0] text-gray-500 hover:bg-gray-200'
                                }`}
                            >
                                ☰ Table
                            </button>
                            <button
                                type="button"
                                onClick={() => setView('gantt')}
                                className={`px-3 py-1.5 text-[11px] font-medium transition-colors ${
                                    view === 'gantt'
                                        ? 'bg-white text-gray-900 shadow-inner'
                                        : 'bg-[#f0f0f0] text-gray-500 hover:bg-gray-200'
                                }`}
                            >
                                📊 Gantt
                            </button>
                        </div>
                        <h3 className="text-sm font-semibold text-gray-900">Activities ({activities.length})</h3>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="relative">
                            <button onClick={() => setShowColumns(!showColumns)}
                                className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 flex items-center gap-1">
                                ⚙ Columns
                            </button>
                            {showColumns && (
                                <div className="absolute right-0 top-full mt-1 z-50 bg-white border border-gray-200 rounded-xl shadow-xl p-3 w-64 max-h-80 overflow-y-auto">
                                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Column visibility</p>
                                    <p className="text-[10px] text-gray-400 mb-2">Fixed &amp; schedule</p>
                                    {ALL_COLUMNS.map(col => (
                                        <label key={col.key} className="flex items-center gap-2 py-1 cursor-pointer hover:bg-gray-50 px-1 rounded text-xs text-gray-700">
                                            <input type="checkbox" checked={visibleCols.has(col.key)} onChange={() => toggleColumn(col.key)}
                                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5" />
                                            {col.label}
                                            {col.type === 'date_ro' && <span className="text-gray-400 text-[10px]">(calc)</span>}
                                        </label>
                                    ))}
                                    {udfCols.length > 0 && (
                                        <>
                                            <p className="text-[10px] text-gray-400 mt-2 mb-1">UDF fields</p>
                                            {udfCols.map(col => (
                                                <label key={col.key} className="flex items-center gap-2 py-1 cursor-pointer hover:bg-gray-50 px-1 rounded text-xs text-gray-700">
                                                    <input type="checkbox" checked={visibleCols.has(col.key)} onChange={() => toggleColumn(col.key)}
                                                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5" />
                                                    {col.label}
                                                </label>
                                            ))}
                                        </>
                                    )}
                                    <div className="border-t border-gray-100 mt-2 pt-2 flex gap-3">
                                        <button onClick={() => setVisibleCols(new Set(allCols.map(c => c.key)))} className="text-xs text-blue-600 hover:underline">Show All</button>
                                        <button onClick={() => setVisibleCols(new Set(allCols.filter(c => c.defaultVisible).map(c => c.key)))} className="text-xs text-gray-500 hover:underline">Reset</button>
                                    </div>
                                </div>
                            )}
                        </div>
                        <button
                            onClick={() => {
                                setColWidths(DEFAULT_COL_WIDTHS);
                                persistColWidths(DEFAULT_COL_WIDTHS);
                            }}
                            title="Reset column widths"
                            className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1 rounded hover:bg-gray-100"
                        >
                            ⟳ Reset columns
                        </button>
                        <button
                            onClick={() => setShowLibrary(true)}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700"
                        >
                            📚 From Library
                        </button>
                        <button
                            onClick={() => setShowApplyModal(true)}
                            className="px-3 py-1.5 bg-gray-900 text-white text-xs font-medium rounded-lg hover:bg-black transition-all shadow-md active:scale-95"
                        >
                            🪄 Apply Template
                        </button>
                        <button
                            onClick={async () => {
                                if (!workpack.event_id) {
                                    alert('Cannot calculate CPM: this Workpack has no Event context.');
                                    return;
                                }
                                if (!confirm('Calculate Critical Path for this event?')) return;
                                setSaving(true);
                                const res = await fetch('/api/schedule/calculate', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ event_id: workpack.event_id }),
                                });
                                if (res.ok) {
                                    alert('CPM Calculation complete!');
                                    router.refresh();
                                } else {
                                    const payload = await res.json().catch(() => ({}));
                                    alert(payload.error || 'Failed to calculate CPM');
                                }
                                setSaving(false);
                            }}
                            className="px-3 py-1.5 bg-red-50 text-red-700 text-xs font-medium rounded-lg border border-red-200 hover:bg-red-100 shadow-sm active:scale-95"
                        >
                            Calculate CPM
                        </button>
                        <button onClick={() => setShowModal(true)} className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 shadow-md active:scale-95">
                            + Add Activity
                        </button>
                    </div>
                </div>

                {/* Data Grid or Gantt */}
                {activities.length === 0
                    ? <div className="p-6"><EmptyState icon="📝" message="No activities. Click '+ Add Activity' to begin." /></div>
                    : view === 'gantt'
                      ? (
                            <div className="p-4">
                                <GanttChart
                                    activities={activities.map((a: any) => ({
                                        id: a.id,
                                        activity_code: a.activity_number ?? null,
                                        description: a.description ?? null,
                                        discipline: a.discipline?.code ?? null,
                                        planned_start: a.planned_start ? (typeof a.planned_start === 'string' ? a.planned_start : new Date(a.planned_start).toISOString()) : null,
                                        planned_end: a.planned_end ? (typeof a.planned_end === 'string' ? a.planned_end : new Date(a.planned_end).toISOString()) : null,
                                        progress_percent: a.progress_percent ?? 0,
                                        status: a.status ?? null,
                                        duration_hours: a.duration_hours != null ? Number(a.duration_hours) : null,
                                        is_critical: a.is_critical ?? false,
                                        workpack: { project_id: workpack.project_id, event_id: workpack.event_id }
                                    }))}
                                    workpackStart={workpack.planned_start_date ? (typeof workpack.planned_start_date === 'string' ? workpack.planned_start_date : new Date(workpack.planned_start_date).toISOString()) : null}
                                    workpackEnd={workpack.planned_end_date ? (typeof workpack.planned_end_date === 'string' ? workpack.planned_end_date : new Date(workpack.planned_end_date).toISOString()) : null}
                                />
                            </div>
                        )
                      : (
                        <div className="flex flex-col min-h-0" style={{ height: 'calc(100vh - 260px)' }}>
                            {selectedIds.size > 0 && canEdit && (
                                <div className="flex-none flex items-center gap-3 px-4 py-2 bg-blue-50 border-b border-blue-200 flex-wrap">
                                    <span className="text-sm font-medium text-blue-800">
                                        {selectedIds.size} activit{selectedIds.size !== 1 ? 'ies' : 'y'} selected
                                    </span>
                                    <select
                                        value={bulkStatus}
                                        onChange={(e) => setBulkStatus(e.target.value)}
                                        className="text-sm border border-blue-300 bg-white rounded-lg px-3 py-1.5 focus:outline-none text-gray-700"
                                    >
                                        <option value="">Set status...</option>
                                        {[
                                            { v: 'not_started', l: 'Not Started' },
                                            { v: 'in_progress', l: 'In Progress' },
                                            { v: 'completed', l: 'Completed' },
                                            { v: 'on_hold', l: 'On Hold' },
                                        ].map((o) => (
                                            <option key={o.v} value={o.v}>{o.l}</option>
                                        ))}
                                    </select>
                                    <button
                                        type="button"
                                        onClick={async () => {
                                            if (!bulkStatus) return;
                                            setBulking(true);
                                            setBulkError(null);
                                            const res = await fetch(
                                                `/api/workpacks/${workpack.id}/activities/bulk`,
                                                {
                                                    method: 'PATCH',
                                                    headers: { 'Content-Type': 'application/json' },
                                                    body: JSON.stringify({
                                                        ids: [...selectedIds],
                                                        updates: { status: bulkStatus },
                                                    }),
                                                }
                                            );
                                            if (!res.ok) {
                                                const d = await res.json().catch(() => ({}));
                                                setBulkError(d.error ?? 'Update failed');
                                            } else {
                                                setSelectedIds(new Set());
                                                setBulkStatus('');
                                                router.refresh();
                                            }
                                            setBulking(false);
                                        }}
                                        disabled={!bulkStatus || bulking}
                                        className="px-4 py-1.5 bg-[#0D2137] text-white text-sm rounded-xl hover:bg-[#1a3a5c] disabled:opacity-40"
                                    >
                                        {bulking ? 'Updating...' : 'Apply'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setShowBulkPredecessor(true)}
                                        className="px-4 py-1.5 text-sm font-medium border border-blue-300
                                               text-blue-700 bg-white rounded-xl hover:bg-blue-50
                                               flex items-center gap-1.5"
                                    >
                                        🔗 Link Predecessors
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setSelectedIds(new Set())}
                                        className="text-sm text-blue-600 hover:underline"
                                    >
                                        Clear
                                    </button>
                                    {bulkError && (
                                        <span className="text-xs text-red-600">{bulkError}</span>
                                    )}
                                </div>
                            )}
                            <div className="flex-1 overflow-auto min-h-0" id="activities-scroll-container">
                                <table className="w-full text-xs border-collapse" style={{ minWidth: '1400px' }}>
                                    <thead className="sticky top-0 z-20 bg-[#f0f0f0]">
                                        <tr className="border-b-2 border-gray-300">
                                        {canEdit && (
                                            <th className="w-8 py-2 px-2 bg-[#f0f0f0] sticky left-0 z-30 border-r border-gray-300 min-w-[32px]">
                                                <input
                                                    type="checkbox"
                                                    checked={activities.length > 0 && selectedIds.size === activities.length}
                                                    onChange={(e) =>
                                                        setSelectedIds(
                                                            e.target.checked
                                                                ? new Set(activities.map((a: any) => a.id))
                                                                : new Set()
                                                        )
                                                    }
                                                    className="rounded"
                                                />
                                            </th>
                                        )}
                                        {columns.map((col, colIdx) => (
                                            <th
                                                key={col.key}
                                                className={`relative select-none py-2 px-2 text-left text-[11px] font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap border-r border-gray-300 last:border-r-0 ${col.key === 'seq' ? 'bg-[#e8e8e8]' : 'bg-[#f0f0f0]'} ${colIdx <= 1 ? 'sticky z-30' : ''} ${colIdx === 1 ? 'border-r-2 border-gray-400' : ''}`}
                                                style={{
                                                    width: col.key === 'seq' ? 36 : (colWidths[col.key] ?? 100),
                                                    minWidth: col.key === 'seq' ? 36 : 60,
                                                    ...(colIdx === 0 ? { left: canEdit ? 32 : 0 } : {}),
                                                    ...(colIdx === 1 ? { left: canEdit ? 88 : 48 } : {}),
                                                }}
                                                title={col.tooltip}
                                            >
                                                {col.label}
                                                <ColResizeHandle colKey={col.key} onStart={startColResize} />
                                            </th>
                                        ))}
                                        {canEdit && (
                                            <th className="w-10 py-2 px-2 text-left text-[11px] font-semibold text-gray-600 uppercase tracking-wide border-r-0 bg-[#f0f0f0]" title="Delete activity">
                                                —
                                            </th>
                                        )}
                                    </tr>
                                </thead>
                                <tbody>
                                    {activities.map((a: any, idx: number) => (
                                        <tr key={a.id} className={`border-b border-[#e0e0e0] group transition-colors
                                            ${selectedIds.has(a.id)
                                                ? 'bg-[#cce4f7] hover:bg-[#b8d8f0]'
                                                : idx % 2 === 0
                                                    ? 'bg-white hover:bg-[#f5f9ff]'
                                                    : 'bg-[#f8f8f8] hover:bg-[#f0f5ff]'
                                            } ${a.is_critical ? 'border-l-4 border-l-red-500 bg-red-50/30' : ''}`}>
                                            {canEdit && (
                                                <td className="px-2 py-2 sticky left-0 z-10 border-r border-gray-200" style={{ backgroundColor: idx % 2 === 0 ? '#fff' : 'rgba(249,250,251,0.5)' }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedIds.has(a.id)}
                                                        onChange={(e) => {
                                                            const next = new Set(selectedIds);
                                                            if (e.target.checked) next.add(a.id);
                                                            else next.delete(a.id);
                                                            setSelectedIds(next);
                                                        }}
                                                        className="rounded"
                                                    />
                                                </td>
                                            )}
                                            {columns.map((col, colIdx) => {
                                                const isEditing = editCell?.rowId === a.id && editCell?.field === col.field;
                                                const isUdf = col.type === 'udf_select' || col.type === 'udf_number' || col.type === 'udf_text';
                                                const canEditCell = col.type !== 'readonly' && col.type !== 'date_ro';
                                                const currentVal = col.key === 'act_code'
                                                    ? (a.activity_id ?? a.activity_number)
                                                    : isUdf ? getUdfValue(a, col.udfCode ?? col.field.replace(/^udf_/, '')) : a[col.field];
                                                const rowBg = idx % 2 === 0 ? '#fff' : 'rgba(249,250,251,0.5)';
                                                const stickyStyle = colIdx <= 1 ? { position: 'sticky' as const, zIndex: 10, left: colIdx === 0 ? (canEdit ? 32 : 0) : (canEdit ? 88 : 48), backgroundColor: isEditing ? 'rgb(239 246 255)' : rowBg } : {};
                                                return (
                                                    <td
                                                        key={col.key}
                                                        className={`py-1 px-2 border-r border-[#e0e0e0] text-[12px] last:border-r-0 ${canEditCell ? 'cursor-text hover:bg-blue-50/50' : ''} ${isEditing ? 'bg-blue-50 ring-1 ring-inset ring-blue-400' : ''} ${colIdx === 1 ? 'border-r-2 border-gray-300' : ''}`}
                                                        style={stickyStyle}
                                                        onDoubleClick={() => {
                                                            if (col.type === 'date_ro') {
                                                                setError('Dates are automatically calculated from duration and predecessor relationships.');
                                                                return;
                                                            }
                                                            startEdit(a.id, col.field, currentVal, col.type, col);
                                                        }}
                                                        title={canEditCell ? 'Double-click to edit' : col.tooltip}
                                                    >
                                                        {isEditing ? (
                                                            <>
                                                                {getEditInput(col)}
                                                                {col.key === 'act_code' && activityIdDuplicate?.rowId === a.id && activityIdDuplicate?.suggestion && (
                                                                    <div className="mt-1 flex items-center gap-2 flex-wrap">
                                                                        <span className="text-amber-700 text-[11px]">Already used — next available: {activityIdDuplicate.suggestion}</span>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => {
                                                                                setEditValue(activityIdDuplicate.suggestion);
                                                                                setActivityIdDuplicate(null);
                                                                            }}
                                                                            className="text-[11px] px-2 py-0.5 rounded bg-blue-600 text-white hover:bg-blue-700"
                                                                        >
                                                                            Use {activityIdDuplicate.suggestion}
                                                                        </button>
                                                                    </div>
                                                                )}
                                                            </>
                                                        ) : getCellDisplay(a, col)}
                                                    </td>
                                                );
                                            })}
                                            {canEdit && (
                                                <td className="px-2 py-1.5 border-r-0 align-middle">
                                                    <button
                                                        type="button"
                                                        onClick={async (e) => {
                                                            e.stopPropagation();
                                                            if (!confirm('Delete this activity? This cannot be undone.')) return;
                                                            setDeletingId(a.id);
                                                            setError('');
                                                            setSuccessMessage(null);
                                                            try {
                                                                const res = await fetch(`/api/workpacks/${workpack.id}/activities/${a.id}`, { method: 'DELETE' });
                                                                if (!res.ok) {
                                                                    const d = await res.json().catch(() => ({}));
                                                                    throw new Error(d.error ?? 'Delete failed');
                                                                }
                                                                setSuccessMessage('Activity deleted');
                                                                router.refresh();
                                                                setTimeout(() => setSuccessMessage(null), 3000);
                                                            } catch (err: unknown) {
                                                                setError(err instanceof Error ? err.message : 'Delete failed');
                                                            } finally {
                                                                setDeletingId(null);
                                                            }
                                                        }}
                                                        disabled={deletingId === a.id}
                                                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                                                        title="Delete activity"
                                                    >
                                                        {deletingId === a.id ? '…' : '🗑'}
                                                    </button>
                                                </td>
                                            )}
                                        </tr>
                                    ))}
                                </tbody>
                                </table>
                            </div>
                            <div className="flex-none px-4 py-2 bg-[#f0f0f0] border-t-2 border-gray-300 flex items-center justify-between">
                                <div className="text-[11px] text-gray-600 flex items-center gap-6">
                                    <span><strong className="text-gray-800">Total:</strong> {activities.length} activities</span>
                                    <span><strong className="text-gray-800">Duration:</strong> {totalDuration} hrs</span>
                                </div>
                                <div className="text-[11px] text-gray-400 flex items-center gap-3">
                                    <span>Double-click to edit</span>
                                    <span>·</span>
                                    <span>↵ Save</span>
                                    <span>·</span>
                                    <span>Esc Cancel</span>
                                </div>
                            </div>
                        </div>
                    )
                }
            </div>

            {showColumns && <div className="fixed inset-0 z-40" onClick={() => setShowColumns(false)} />}

            {/* Add Activity Modal — NO DATE FIELDS per P8 */}
            <Modal title="Add Activity" open={showModal} onClose={() => setShowModal(false)}>
                <form onSubmit={handleSubmit}>
                    {error && <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-lg">{error}</div>}

                    <FormField label="Activity ID (optional)" hint="Leave blank to auto-generate (e.g. E-421-001). Or enter a custom ID; duplicate in this event will suggest next available.">
                        <input name="activity_number" className={inputCls} placeholder="e.g. E-421-001" />
                    </FormField>

                    <FormField label="Description" required>
                        <textarea name="description" required rows={2} className={inputCls} placeholder="Describe the activity scope…" />
                    </FormField>

                    <div className="grid grid-cols-2 gap-4">
                        <FormField label="Work Category">
                            <select name="work_category" className={inputCls}>
                                {WORK_CATEGORIES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                        </FormField>
                        <FormField label="Execution Window">
                            <select name="window" className={inputCls}>
                                {WINDOW_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                        </FormField>
                    </div>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                        <FormField label="Duration (hours)" required>
                            <input name="duration_hours" type="number" min="0" step="0.5" className={inputCls} placeholder="8" required />
                        </FormField>
                    </div>

                    <FormField label="Notes">
                        <textarea name="notes" rows={2} className={inputCls} placeholder="Additional notes…" />
                    </FormField>

                    {/* P8 notice — no date fields */}
                    <div className="mb-4 p-3 bg-blue-50 text-blue-700 text-xs rounded-lg flex items-start gap-2">
                        <span className="text-base">ℹ️</span>
                        <span>Planned Start and End dates are <strong>automatically calculated</strong> from duration and predecessor relationships. They cannot be entered manually.</span>
                    </div>

                    <div className="flex justify-end gap-3 mt-6">
                        <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200">Cancel</button>
                        <button type="submit" disabled={saving} className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50">{saving ? 'Saving…' : 'Add Activity'}</button>
                    </div>
                </form>
            </Modal>
            <QaClearanceDrawer
                open={isDrawerOpen}
                onClose={() => setIsDrawerOpen(false)}
                activity={selectedActivity}
                workpackId={workpack.id}
            />
            <ApplyTemplateModal
                open={showApplyModal}
                onClose={() => setShowApplyModal(false)}
                workpackId={workpack.id}
            />
            {showLibrary && (
                <ActivityCodeLibraryModal
                    workpackId={workpack.id}
                    onAdd={async (codes: any[]) => {
                        for (const code of codes) {
                            await fetch(`/api/workpacks/${workpack.id}/activities`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    activity_number: code.code,
                                    description: code.description ?? '',
                                    discipline_id: code.discipline_id ?? undefined,
                                    duration_hours: code.default_duration_hours ?? 0,
                                    activity_library_id: code.id,
                                }),
                            });
                        }
                        router.refresh();
                        setShowLibrary(false);
                    }}
                    onClose={() => setShowLibrary(false)}
                />
            )}
            {showBulkPredecessor && selectedIds.size > 0 && (
                <BulkPredecessorModal
                    workpackId={workpack.id}
                    selectedIds={[...selectedIds]}
                    activities={activities}
                    onSave={() => {
                        setShowBulkPredecessor(false);
                        setSelectedIds(new Set());
                        router.refresh();
                    }}
                    onClose={() => setShowBulkPredecessor(false)}
                />
            )}
        </>
    );
}
