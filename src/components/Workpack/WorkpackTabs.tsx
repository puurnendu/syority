'use client';

import { useState, useCallback, useEffect, useRef, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import {
    WorkpackLayout,
    WORKPACK_TABS,
    type WorkpackTabId,
} from './WorkpackLayout';
import { ActivitiesPanel } from './ActivitiesPanel';
import { DroppingBoxupPanel } from './DroppingBoxupPanel';
import { ClearancePanel } from './ClearancePanel';
import { FlangeBoxupCertPanel } from './FlangeBoxupCertPanel';
import { TorqueCertPanel } from './TorqueCertPanel';
import { HydrotestCertPanel } from './HydrotestCertPanel';
import { CleaningPanel } from './CleaningPanel';
import { JobCompletionPanel } from './JobCompletionPanel';
import { LessonsLearntPanel } from './LessonsLearntPanel';
import { MaterialsTab } from './tabs/MaterialsTab';
import { ToolsTab } from './tabs/ToolsTab';
import { ConstraintsTab } from './tabs/ConstraintsTab';
import { CertificatesTab } from './tabs/CertificatesTab';
import { AttachmentsTab } from './tabs/AttachmentsTab';
import { JointsBlindTab } from './tabs/JointsBlindTab';
import { GenerateJointsModal } from './Joints/GenerateJointsModal';
import { JointReviewTable } from './Joints/JointReviewTable';
import { AiGeneratedBanner } from './AiGeneratedBanner';
import { PreparationTab } from './tabs/PreparationTab';
import { QaClearanceTab } from './tabs/QaClearanceTab';
import { DocumentsTab } from './tabs/DocumentsTab';
import { WorkpackTimeline } from './WorkpackTimeline';
import { SapSyncPanel } from './SapSyncPanel';
import { DocumentExtractionPanel } from './DocumentExtractionPanel';
import { EquipmentTechnicalCard } from './EquipmentTechnicalCard';
import { ElectricalRequirementsSection } from './sections/ElectricalRequirementsSection';
import { ConfirmDeleteDialog } from '@/components/ui/ConfirmDeleteDialog';
import { EmptyStateWithAI } from '@/components/Workpack/EmptyStateWithAI';

const TAB_ID_MAP: Record<string, WorkpackTabId> = {
    overview: 'overview',
    workflow: 'overview',
    activities: 'activities',
    joints: 'joints_blinds',
    joint_register: 'joints_blinds',
    blinds: 'joints_blinds',
    blind_register: 'joints_blinds',
    materials: 'materials',
    tools: 'tools',
    constraints: 'constraints',
    constraint_log: 'constraints',
    dropping: 'preparation',
    boxup: 'preparation',
    checklist: 'preparation',
    checklists: 'preparation',
    cleaning: 'cleaning',
    qa: 'qa_clearance',
    qa_clearance: 'qa_clearance',
    hold_points: 'qa_clearance',
    clearance: 'qa_clearance',
    certificates: 'certificates',
    'cert-boxup': 'certificates',
    'cert-torque': 'certificates',
    'cert-hydro': 'certificates',
    boxup_cert: 'certificates',
    torque_cert: 'certificates',
    hydrotest_cert: 'certificates',
    attachments: 'attachments',
    documents: 'documents',
    lessons: 'lessons',
    lessons_learnt: 'lessons',
    audit: 'overview',
    audit_log: 'overview',
    jcc: 'overview',
    completion: 'overview',
    punch: 'punch_list',
    punch_list: 'punch_list',
};

function normaliseTabId(id: string): WorkpackTabId {
    return (TAB_ID_MAP[id] ?? 'overview') as WorkpackTabId;
}

// ─── Helpers ────────────────────────────────────────────
function Badge({ label, color }: { label: string; color: string }) {
    const colors: Record<string, string> = {
        green: 'bg-green-100 text-green-800', red: 'bg-red-100 text-red-800',
        yellow: 'bg-yellow-100 text-yellow-800', blue: 'bg-blue-100 text-blue-800',
        gray: 'bg-gray-100 text-gray-700', purple: 'bg-purple-100 text-purple-800',
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

function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
    return (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
                {action}
            </div>
            <div className="p-6">{children}</div>
        </div>
    );
}

// ─── Modal Shell ────────────────────────────────────────
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

function FormField({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
    return (
        <div className="mb-4">
            <label className="block text-xs font-medium text-gray-700 mb-1">{label}{required && <span className="text-red-500 ml-0.5">*</span>}</label>
            {children}
        </div>
    );
}

const inputClass = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none";
const selectClass = inputClass;
const btnPrimary = "px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50";
const btnSecondary = "px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200";

// ─── API helper ─────────────────────────────────────────
async function postApi(url: string, data: Record<string, any>) {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Request failed (${res.status})`);
    }
    return res.json();
}

// ─── Tab Panels ─────────────────────────────────────────

function OverviewPanel({ workpack, onRefresh, isAdmin = false }: { workpack: any; onRefresh?: () => void; isAdmin?: boolean }) {
    const router = useRouter();
    const [activityDates, setActivityDates] = useState<{ min_start: string | null; max_end: string | null; count: number } | null>(null);
    const [technicalData, setTechnicalData] = useState<Record<string, unknown>>(
        (workpack.equipment_technical_data && typeof workpack.equipment_technical_data === 'object')
            ? (workpack.equipment_technical_data as Record<string, unknown>)
            : {}
    );
    const [syncSuccess, setSyncSuccess] = useState('');
    const [syncError, setSyncError] = useState('');

    useEffect(() => {
        fetch(`/api/workpacks/${workpack.id}/activities/date-range`)
            .then((r) => (r.ok ? r.json() : null))
            .then((d) => { if (d) setActivityDates(d); })
            .catch(() => { });
    }, [workpack.id]);

    const workpackStart = workpack.planned_start_date ? new Date(workpack.planned_start_date).toISOString().slice(0, 10) : null;
    const workpackEnd = workpack.planned_end_date ? new Date(workpack.planned_end_date).toISOString().slice(0, 10) : null;
    const activityStart = activityDates?.min_start?.slice(0, 10) ?? null;
    const activityEnd = activityDates?.max_end?.slice(0, 10) ?? null;
    const startMismatch = activityStart && workpackStart && activityStart !== workpackStart;
    const endMismatch = activityEnd && workpackEnd && activityEnd !== workpackEnd;

    async function handleSyncDates() {
        if (!activityDates?.min_start && !activityDates?.max_end) return;
        setSyncError('');
        try {
            const res = await fetch(`/api/workpacks/${workpack.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    planned_start_date: activityDates?.min_start ?? null,
                    planned_end_date: activityDates?.max_end ?? null,
                }),
            });
            if (!res.ok) {
                const d = await res.json().catch(() => ({}));
                setSyncError(d.error ?? 'Sync failed');
                return;
            }
            onRefresh?.();
            router.refresh();
            setSyncSuccess('Dates synced to activity schedule');
            setTimeout(() => setSyncSuccess(''), 3000);
        } catch (e: unknown) {
            setSyncError(e instanceof Error ? e.message : 'Sync failed');
        }
    }

    const fields = [
        { label: 'Workpack Number', value: workpack.workpack_number },
        { label: 'Revision', value: workpack.revision },
        { label: 'Work Type', value: workpack.work_type },
        { label: 'Priority', value: workpack.priority },
        { label: 'Est. Manhours', value: workpack.estimated_manhours != null ? `${workpack.estimated_manhours} h` : '—' },
        { label: 'Contractor', value: workpack.contractor?.name },
    ];

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
                <Section title="Scope of Work">
                    <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                        {workpack.scope_of_work || <span className="italic text-gray-400">No scope defined.</span>}
                    </p>
                </Section>
                <div className="mt-6">
                    <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                        <span>🔧</span> Equipment Technical Data
                    </h2>
                    <EquipmentTechnicalCard
                        workpackId={workpack.id}
                        data={technicalData}
                        organizationId={workpack.organization_id}
                        onExtracted={(data) => setTechnicalData(data)}
                    />
                </div>
                {(() => {
                    const cols = workpack.organization?.workpackPdfColumns;
                    const parsed = typeof cols === 'string' ? (JSON.parse(cols || '{}') as Record<string, boolean>) : (cols ?? {});
                    return parsed.showElectrical !== false && <ElectricalRequirementsSection workpackId={workpack.id} />;
                })()}
                <SapSyncPanel workpackId={workpack.id} isAdmin={isAdmin} />
                <Section title="Identification">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Workpack ID</label>
                            <div className="flex items-center gap-2 mt-1">
                                <span className="font-mono text-lg font-bold text-[#0D2137]">
                                    {workpack.workpack_id_code ?? '—'}
                                </span>
                                {!workpack.workpack_id_code && (
                                    <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded">ID not yet generated</span>
                                )}
                                <span title="Cannot be changed after creation" className="text-gray-300 text-xs">🔒</span>
                            </div>
                        </div>
                        <div>
                            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">SAP Work Order</label>
                            <div className="flex items-center gap-2 mt-1">
                                <span className="font-mono text-sm text-gray-700">{workpack.sap_work_order ?? '—'}</span>
                                <span title="Set by platform administrator" className="text-gray-300 text-xs">🔒</span>
                                {!workpack.sap_work_order && <span className="text-xs text-gray-400 italic">Not assigned</span>}
                            </div>
                        </div>
                    </div>
                </Section>
                <Section title="Field Summary">
                    <dl className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-8 gap-y-4">
                        {fields.filter(f => f.value).map(f => (
                            <div key={f.label}>
                                <dt className="text-xs text-gray-400 uppercase tracking-wider font-medium">{f.label}</dt>
                                <dd className="mt-0.5 text-sm text-gray-900 font-medium">{f.value}</dd>
                            </div>
                        ))}
                    </dl>
                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <dt className="text-xs text-gray-400 uppercase tracking-wider font-medium">Planned Start</dt>
                            <dd className="mt-0.5 text-sm text-gray-900 font-medium">
                                {workpack.planned_start_date ? new Date(workpack.planned_start_date).toLocaleDateString('en-GB') : '—'}
                            </dd>
                            {activityDates?.count === 0 && (
                                <div className="text-xs text-gray-400 mt-0.5">No activities scheduled yet</div>
                            )}
                            {startMismatch && (
                                <div className="flex items-center gap-1 text-xs text-amber-600 mt-0.5">
                                    <span>⚠</span>
                                    <span>Activity schedule: {activityStart ? new Date(activityStart).toLocaleDateString('en-GB') : ''}</span>
                                    <button type="button" onClick={handleSyncDates} className="text-blue-600 underline ml-1">Sync</button>
                                </div>
                            )}
                        </div>
                        <div>
                            <dt className="text-xs text-gray-400 uppercase tracking-wider font-medium">Planned End</dt>
                            <dd className="mt-0.5 text-sm text-gray-900 font-medium">
                                {workpack.planned_end_date ? new Date(workpack.planned_end_date).toLocaleDateString('en-GB') : '—'}
                            </dd>
                            {endMismatch && (
                                <div className="flex items-center gap-1 text-xs text-amber-600 mt-0.5">
                                    <span>⚠</span>
                                    <span>Activity schedule: {activityEnd ? new Date(activityEnd).toLocaleDateString('en-GB') : ''}</span>
                                    <button type="button" onClick={handleSyncDates} className="text-blue-600 underline ml-1">Sync</button>
                                </div>
                            )}
                        </div>
                    </div>
                    {syncSuccess && <p className="mt-2 text-sm text-green-600">{syncSuccess}</p>}
                    {syncError && <p className="mt-2 text-sm text-red-600">{syncError}</p>}
                </Section>
            </div>
            <div className="space-y-4">
                <Section title="Workflow Status">
                    <div className="flex flex-col items-center py-4">
                        <div className="w-20 h-20 rounded-full border-4 border-blue-500 flex items-center justify-center mb-4 shadow-lg shadow-blue-500/20">
                            <span className="text-2xl font-black text-blue-600 italic">v{workpack.revision}</span>
                        </div>
                        <Badge label={workpack.status?.replace(/_/g, ' ') || 'DRAFT'} color="blue" />
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-4">Current Phase</p>
                        <p className="text-sm font-black text-gray-900 uppercase italic tracking-tighter mt-1">{['issued', 'in_execution', 'completed'].includes(workpack.status) ? 'Execution phase' : 'Planning phase'}</p>
                        <a
                            href={`/api/workpacks/${workpack.id}/pdf`}
                            className="mt-6 w-full py-3 bg-gray-900 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-black transition-all flex items-center justify-center gap-2 shadow-xl shadow-gray-200"
                        >
                            <span>📥</span> Download Master PDF
                        </a>
                    </div>
                </Section>
            </div>
        </div>
    );
}

// ── Joints ──────────────────────────────────────────────
function JointsPanel({ workpack }: { workpack: any }) {
    const router = useRouter();
    const [showModal, setShowModal] = useState(false);
    const [showGenerateModal, setShowGenerateModal] = useState(false);
    const [showReviewModal, setShowReviewModal] = useState(false);
    const [extractedJoints, setExtractedJoints] = useState<any[]>([]);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [autoFillNotice, setAutoFillNotice] = useState('');
    const [suggestWarning, setSuggestWarning] = useState<string | null>(null);
    const [jointsAiBannerDismissed, setJointsAiBannerDismissed] = useState(false);
    const joints: any[] = workpack.joint_integrity_items ?? [];
    const jointsAiGeneratedCount = joints.filter((j: { ai_generated?: boolean }) => j.ai_generated).length;
    const existingJointNumbers = new Set((joints as { joint_number?: string }[]).map((j) => (j.joint_number ?? '').trim()).filter(Boolean));
    const statusColor: Record<string, string> = {
        pending: 'gray', assembled: 'blue', inspected: 'yellow', signed_off: 'green', dismantled: 'red',
    };
    const attachedDocs = (workpack.workpack_documents ?? []).map((d: any) => ({ id: d.id, title: d.title, original_filename: d.original_filename }));

    const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setSaving(true); setError('');
        const form = new FormData(e.currentTarget);
        try {
            await postApi(`/api/workpacks/${workpack.id}/joints`, {
                joint_number: form.get('joint_number'),
                tightening_method: form.get('tightening_method') || null,
                flange_size: form.get('flange_size') || null,
                rating: form.get('rating') || null,
                flange_type: form.get('flange_type') || null,
                specification: form.get('specification') || null,
                pipeline_number: form.get('pipeline_number') || null,
                location: form.get('location') || null,
            });
            setShowModal(false);
            router.refresh();
        } catch (err: any) { setError(err.message); } finally { setSaving(false); }
    };

    const handleAction = async (jointId: string, action: string) => {
        try {
            setError('');
            await postApi(`/api/workpacks/${workpack.id}/joints`, { action, id: jointId });
            router.refresh();
        } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Action failed'); }
    };

    const autoFillGasketBolt = async (joint: any) => {
        const size = joint.flange_size;
        const rating = joint.rating;
        const flangeType = joint.flange_type ?? 'RF';
        if (!size || !rating) return;
        setSuggestWarning(null);
        try {
            const params = new URLSearchParams({
                pipe_size: size,
                pressure_class: rating,
                flange_type: flangeType,
            });
            const res = await fetch(`/api/master-data/gasket-lookup?${params}`);
            if (!res.ok) return;
            const lookup = await res.json();
            if (!lookup) {
                setSuggestWarning(joint.id);
                return;
            }
            await postApi(`/api/workpacks/${workpack.id}/joints`, {
                action: 'update',
                id: joint.id,
                gasket_material: lookup.gasket_description ?? lookup.gasket_item?.description ?? '',
                bolt_material: lookup.bolt_description ?? lookup.bolt_item?.description ?? '',
                bolt_quantity: lookup.bolt_count,
            });
            setAutoFillNotice(`✓ Gasket and bolt spec auto-filled from ASME B16.5 ${size} ${rating} table`);
            setTimeout(() => setAutoFillNotice(''), 4000);
            router.refresh();
        } catch {
            setSuggestWarning(joint.id);
        }
    };

    const handleDeleteJoint = async (jointId: string) => {
        if (!confirm('Delete this joint from the register?')) return;
        try {
            const res = await fetch(`/api/workpacks/${workpack.id}/joints/${jointId}`, { method: 'DELETE' });
            if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Delete failed');
            setError('');
            router.refresh();
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Delete failed');
        }
    };

    const handleGeneratedJoints = (joints: any[]) => {
        setExtractedJoints(joints);
        setShowGenerateModal(false);
        setShowReviewModal(true);
    };

    return (
        <>
            {jointsAiGeneratedCount > 0 && !jointsAiBannerDismissed && (
                <AiGeneratedBanner
                    count={jointsAiGeneratedCount}
                    entityName="joints"
                    message="Review and edit as needed."
                    onDismiss={() => setJointsAiBannerDismissed(true)}
                />
            )}
            {autoFillNotice && (
                <div className="flex items-center gap-2 p-2.5 bg-green-50 border border-green-200 rounded-lg text-xs text-green-700 mb-4">
                    <span>🔩</span>
                    <span>{autoFillNotice}</span>
                </div>
            )}
            <Section
                title={`Joint Register (${joints.length})`}
                action={<button onClick={() => setShowModal(true)} className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700">+ Add Joint</button>}
            >
                {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center justify-between"><span>{error}</span><button onClick={() => setError('')} className="text-red-400 hover:text-red-600">✕</button></div>}
                {joints.length === 0
                    ? (
                        <EmptyStateWithAI
                            tabName="joints"
                            workpackId={workpack.id}
                            icon="🔩"
                            emptyText="No joints added to this workpack."
                            onGenerated={() => router.refresh()}
                        />
                    )
                    : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-gray-100 text-xs text-gray-500 uppercase tracking-wider">
                                        <th className="py-2 pr-4 text-left font-medium">Joint No.</th>
                                        <th className="py-2 pr-4 text-left font-medium">Location / Desc.</th>
                                        <th className="py-2 pr-4 text-left font-medium">Type</th>
                                        <th className="py-2 pr-4 text-left font-medium">Size / Spec</th>
                                        <th className="py-2 pr-4 text-left font-medium">Line No.</th>
                                        <th className="py-2 pr-4 text-left font-medium">Status</th>
                                        <th className="py-2 text-left font-medium">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {joints.map((j: any) => (
                                        <tr key={j.id} className="border-b border-gray-50 hover:bg-gray-50">
                                            <td className="py-3 pr-4 font-mono text-xs text-gray-900">{j.joint_number}</td>
                                            <td className="py-3 pr-4 text-gray-700 text-xs">{j.location ?? '—'}</td>
                                            <td className="py-3 pr-4 text-gray-700">{j.flange_type ?? '—'}</td>
                                            <td className="py-3 pr-4 text-gray-500 text-xs text-nowrap">
                                                <div>{j.flange_size ?? '—'}{j.rating ? ` · ${j.rating}` : (j.specification ? ` · ${j.specification}` : '')}</div>
                                                {(j.item_catalog?.sap_material_number || j.gasket_item?.sap_material_number) && (
                                                    <div className="text-[10px] text-blue-600 mt-0.5 font-mono">
                                                        SAP: {j.item_catalog?.sap_material_number || j.gasket_item?.sap_material_number}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="py-3 pr-4 text-gray-500 text-xs">{j.pipeline_number ?? '—'}</td>
                                            <td className="py-3 pr-4"><Badge label={j.status?.replace(/_/g, ' ')} color={statusColor[j.status] ?? 'gray'} /></td>
                                            <td className="py-3 flex gap-1 flex-wrap items-center">
                                                {j.flange_size && j.rating && (
                                                    <button type="button" onClick={() => autoFillGasketBolt(j)} className="text-xs text-blue-600 hover:text-blue-800 underline">🔩 Auto-suggest</button>
                                                )}
                                                {suggestWarning === j.id && (
                                                    <span className="text-xs text-amber-600">No lookup for {j.flange_size} {j.rating}</span>
                                                )}
                                                {j.status === 'pending' && <button onClick={() => handleAction(j.id, 'assemble')} className="text-xs px-2 py-0.5 rounded bg-blue-50 text-blue-700 hover:bg-blue-100">Assemble</button>}
                                                {j.status === 'assembled' && <button onClick={() => handleAction(j.id, 'inspect')} className="text-xs px-2 py-0.5 rounded bg-yellow-50 text-yellow-700 hover:bg-yellow-100">Inspect</button>}
                                                {j.status === 'inspected' && <button onClick={() => handleAction(j.id, 'sign-off')} className="text-xs px-2 py-0.5 rounded bg-green-50 text-green-700 hover:bg-green-100">Sign Off</button>}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )
                }
            </Section>

            <Modal title="Add Joint" open={showModal} onClose={() => setShowModal(false)}>
                <form onSubmit={handleSubmit}>
                    {error && <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-lg">{error}</div>}
                    <FormField label="Joint Number" required>
                        <input name="joint_number" required className={inputClass} placeholder="e.g. JI-001" />
                    </FormField>
                    <FormField label="Tightening Method">
                        <select name="tightening_method" className={selectClass}>
                            <option value="">Select…</option>
                            <option value="torque">Torque</option>
                            <option value="tensioning">Tensioning</option>
                            <option value="manual">Manual</option>
                        </select>
                    </FormField>
                    <div className="grid grid-cols-2 gap-4">
                        <FormField label="Flange Size"><input name="flange_size" className={inputClass} placeholder="e.g. 4&quot; or 6&quot;" /></FormField>
                        <FormField label="Pressure Rating"><input name="rating" className={inputClass} placeholder="e.g. 150# or #300" /></FormField>
                        <FormField label="Flange Type">
                            <select name="flange_type" className={selectClass}>
                                <option value="">—</option>
                                <option value="RF">RF — Raised Face</option>
                                <option value="RTJ">RTJ — Ring Type Joint</option>
                                <option value="FF">FF — Full Face</option>
                            </select>
                        </FormField>
                        <FormField label="Specification"><input name="specification" className={inputClass} placeholder="e.g. ASME B16.5" /></FormField>
                    </div>
                    <FormField label="Location / Description">
                        <input name="location" className={inputClass} placeholder="e.g. Shell Inlet Nozzle N1" />
                    </FormField>
                    <FormField label="Pipeline Number">
                        <input name="pipeline_number" className={inputClass} placeholder="e.g. PL-1201" />
                    </FormField>
                    <div className="flex justify-end gap-3 mt-6">
                        <button type="button" onClick={() => setShowModal(false)} className={btnSecondary}>Cancel</button>
                        <button type="submit" disabled={saving} className={btnPrimary}>{saving ? 'Saving…' : 'Add Joint'}</button>
                    </div>
                </form>
            </Modal>
        </>
    );
}

// ── Blinds ──────────────────────────────────────────────
function BlindsPanel({ workpack }: { workpack: any }) {
    const router = useRouter();
    const [showModal, setShowModal] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const blinds: any[] = workpack.blinds ?? [];
    const statusColor: Record<string, string> = {
        pending: 'gray', inserted: 'blue', pressure_tested: 'yellow', removed: 'green', cancelled: 'red',
    };

    const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setSaving(true); setError('');
        const form = new FormData(e.currentTarget);
        try {
            await postApi(`/api/workpacks/${workpack.id}/blinds`, {
                blind_number: form.get('blind_number'),
                blind_type: form.get('blind_type') || null,
                location: form.get('location') || null,
                size: form.get('size') || null,
                pressure_rating: form.get('pressure_rating') || null,
            });
            setShowModal(false);
            router.refresh();
        } catch (err: any) { setError(err.message); } finally { setSaving(false); }
    };

    const handleAction = async (blindId: string, action: string) => {
        try {
            setError('');
            await postApi(`/api/workpacks/${workpack.id}/blinds`, { action, id: blindId });
            router.refresh();
        } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Action failed'); }
    };

    return (
        <>
            <Section
                title={`Blind Register (${blinds.length})`}
                action={<button onClick={() => setShowModal(true)} className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700">+ Add Blind</button>}
            >
                {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center justify-between"><span>{error}</span><button onClick={() => setError('')} className="text-red-400 hover:text-red-600">✕</button></div>}
                {blinds.length === 0
                    ? <EmptyState icon="🚫" message="No blinds added to this workpack." />
                    : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-gray-100 text-xs text-gray-500 uppercase tracking-wider">
                                        <th className="py-2 pr-4 text-left font-medium">Blind No.</th>
                                        <th className="py-2 pr-4 text-left font-medium">Type</th>
                                        <th className="py-2 pr-4 text-left font-medium">Location</th>
                                        <th className="py-2 pr-4 text-left font-medium">Size / Rating</th>
                                        <th className="py-2 pr-4 text-left font-medium">Status</th>
                                        <th className="py-2 text-left font-medium">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {blinds.map((b: any) => (
                                        <tr key={b.id} className="border-b border-gray-50 hover:bg-gray-50">
                                            <td className="py-3 pr-4 font-mono text-xs text-gray-900">{b.blind_number}</td>
                                            <td className="py-3 pr-4 text-gray-700">{b.blind_type?.replace(/_/g, ' ') ?? '—'}</td>
                                            <td className="py-3 pr-4 text-gray-500 text-xs">{b.location ?? '—'}</td>
                                            <td className="py-3 pr-4 text-gray-500 text-xs text-nowrap">
                                                <div>{b.flange_size ?? '—'}{b.rating ? ` · ${b.rating}` : ''}</div>
                                                {b.item_catalog?.sap_material_number && (
                                                    <div className="text-[10px] text-blue-600 mt-0.5 font-mono">
                                                        SAP: {b.item_catalog.sap_material_number}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="py-3 pr-4"><Badge label={b.status?.replace(/_/g, ' ')} color={statusColor[b.status] ?? 'gray'} /></td>
                                            <td className="py-3 flex gap-1">
                                                {b.status === 'pending' && <button onClick={() => handleAction(b.id, 'insert')} className="text-xs px-2 py-0.5 rounded bg-blue-50 text-blue-700">Insert</button>}
                                                {b.status === 'inserted' && <button onClick={() => handleAction(b.id, 'remove')} className="text-xs px-2 py-0.5 rounded bg-green-50 text-green-700">Remove</button>}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )
                }
            </Section>

            <Modal title="Add Blind" open={showModal} onClose={() => setShowModal(false)}>
                <form onSubmit={handleSubmit}>
                    {error && <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-lg">{error}</div>}
                    <FormField label="Blind Number" required>
                        <input name="blind_number" required className={inputClass} placeholder="e.g. BL-001" />
                    </FormField>
                    <FormField label="Blind Type">
                        <select name="blind_type" className={selectClass}>
                            <option value="">Select…</option>
                            <option value="spectacle_blind">Spectacle Blind</option>
                            <option value="paddle_blind">Paddle Blind</option>
                            <option value="slip_blind">Slip Blind</option>
                            <option value="line_blind">Line Blind</option>
                        </select>
                    </FormField>
                    <FormField label="Location"><input name="location" className={inputClass} placeholder="e.g. Line PL-1201" /></FormField>
                    <div className="grid grid-cols-2 gap-4">
                        <FormField label="Size"><input name="size" className={inputClass} placeholder="e.g. 6 inch" /></FormField>
                        <FormField label="Pressure Rating"><input name="pressure_rating" className={inputClass} placeholder="e.g. 150#" /></FormField>
                    </div>
                    <div className="flex justify-end gap-3 mt-6">
                        <button type="button" onClick={() => setShowModal(false)} className={btnSecondary}>Cancel</button>
                        <button type="submit" disabled={saving} className={btnPrimary}>{saving ? 'Saving…' : 'Add Blind'}</button>
                    </div>
                </form>
            </Modal>
        </>
    );
}

// ── Constraints ─────────────────────────────────────────
function ConstraintsPanel({ workpack }: { workpack: any }) {
    const router = useRouter();
    const [showModal, setShowModal] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const constraints: any[] = workpack.constraints ?? [];
    const priorityColor: Record<string, string> = { critical: 'red', high: 'red', medium: 'yellow', low: 'gray' };
    const statusColor: Record<string, string> = { open: 'red', in_progress: 'yellow', resolved: 'green', deferred: 'blue', cancelled: 'gray' };

    const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setSaving(true); setError('');
        const form = new FormData(e.currentTarget);
        try {
            await postApi(`/api/workpacks/${workpack.id}/constraints`, {
                title: form.get('title'),
                description: form.get('description') || null,
                constraint_type: form.get('constraint_type') || 'general',
                priority: form.get('priority') || 'medium',
            });
            setShowModal(false);
            router.refresh();
        } catch (err: any) { setError(err.message); } finally { setSaving(false); }
    };

    const handleAction = async (constraintId: string, action: string) => {
        try {
            setError('');
            await postApi(`/api/workpacks/${workpack.id}/constraints`, { action, id: constraintId });
            router.refresh();
        } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Action failed'); }
    };

    return (
        <>
            <Section
                title={`Constraint Log (${constraints.length})`}
                action={<button onClick={() => setShowModal(true)} className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700">+ Add Constraint</button>}
            >
                {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center justify-between"><span>{error}</span><button onClick={() => setError('')} className="text-red-400 hover:text-red-600">✕</button></div>}
                {constraints.length === 0
                    ? <EmptyState icon="⚠️" message="No constraints logged." />
                    : (
                        <div className="space-y-3">
                            {constraints.map((c: any) => (
                                <div key={c.id} className="border border-gray-100 rounded-lg p-4 hover:bg-gray-50">
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <p className="text-sm font-medium text-gray-900">{c.title}</p>
                                            {c.description && <p className="text-xs text-gray-500 mt-0.5">{c.description}</p>}
                                        </div>
                                        <div className="flex gap-2 shrink-0">
                                            <Badge label={c.priority} color={priorityColor[c.priority] ?? 'gray'} />
                                            <Badge label={c.status?.replace(/_/g, ' ')} color={statusColor[c.status] ?? 'gray'} />
                                        </div>
                                    </div>
                                    <div className="mt-2 flex items-center gap-3 text-xs text-gray-400">
                                        <span>{c.constraint_type?.replace(/_/g, ' ')}</span>
                                        {c.owner && <span>Owner: {c.owner.name}</span>}
                                    </div>
                                    {(c.status === 'open' || c.status === 'in_progress') && (
                                        <div className="mt-2 flex gap-2">
                                            <button onClick={() => handleAction(c.id, 'resolve')} className="text-xs px-2 py-0.5 rounded bg-green-50 text-green-700 hover:bg-green-100">Resolve</button>
                                            <button onClick={() => handleAction(c.id, 'defer')} className="text-xs px-2 py-0.5 rounded bg-blue-50 text-blue-700 hover:bg-blue-100">Defer</button>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )
                }
            </Section>

            <Modal title="Add Constraint" open={showModal} onClose={() => setShowModal(false)}>
                <form onSubmit={handleSubmit}>
                    {error && <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-lg">{error}</div>}
                    <FormField label="Title" required>
                        <input name="title" required className={inputClass} placeholder="Constraint title" />
                    </FormField>
                    <FormField label="Description">
                        <textarea name="description" rows={2} className={inputClass} placeholder="Details…" />
                    </FormField>
                    <div className="grid grid-cols-2 gap-4">
                        <FormField label="Type">
                            <select name="constraint_type" className={selectClass}>
                                <option value="general">General</option>
                                <option value="permit">Permit</option>
                                <option value="material">Material</option>
                                <option value="resource">Resource</option>
                                <option value="access">Access</option>
                                <option value="engineering">Engineering</option>
                            </select>
                        </FormField>
                        <FormField label="Priority">
                            <select name="priority" className={selectClass}>
                                <option value="low">Low</option>
                                <option value="medium">Medium</option>
                                <option value="high">High</option>
                                <option value="critical">Critical</option>
                            </select>
                        </FormField>
                    </div>
                    <div className="flex justify-end gap-3 mt-6">
                        <button type="button" onClick={() => setShowModal(false)} className={btnSecondary}>Cancel</button>
                        <button type="submit" disabled={saving} className={btnPrimary}>{saving ? 'Saving…' : 'Add Constraint'}</button>
                    </div>
                </form>
            </Modal>
        </>
    );
}

// ── Materials ───────────────────────────────────────────
function MaterialsPanel({ workpack }: { workpack: any }) {
    const router = useRouter();
    const [showModal, setShowModal] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const materials: any[] = workpack.workpack_materials ?? [];
    const statusColor: Record<string, string> = { pending: 'gray', reserved: 'yellow', issued: 'green', returned: 'blue', cancelled: 'red' };

    const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setSaving(true); setError('');
        const form = new FormData(e.currentTarget);
        try {
            await postApi(`/api/workpacks/${workpack.id}/materials`, {
                description: form.get('description'),
                material_number: form.get('material_number') || null,
                unit_of_measure: form.get('unit_of_measure') || 'EA',
                quantity_required: Number(form.get('quantity_required')) || 1,
                material_category: form.get('material_category') || 'mechanical',
            });
            setShowModal(false);
            router.refresh();
        } catch (err: any) { setError(err.message); } finally { setSaving(false); }
    };

    return (
        <>
            <Section
                title={`Materials (${materials.length})`}
                action={<button onClick={() => setShowModal(true)} className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700">+ Add Material</button>}
            >
                {materials.length === 0
                    ? <EmptyState icon="📦" message="No materials added. Use '+ Add Material' to add from catalog or ad-hoc." />
                    : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-gray-100 text-xs text-gray-500 uppercase tracking-wider">
                                        <th className="py-2 pr-4 text-left font-medium">Material No.</th>
                                        <th className="py-2 pr-4 text-left font-medium">Description</th>
                                        <th className="py-2 pr-4 text-left font-medium">UOM</th>
                                        <th className="py-2 pr-4 text-right font-medium">Required</th>
                                        <th className="py-2 pr-4 text-right font-medium">Issued</th>
                                        <th className="py-2 text-left font-medium">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {materials.map((m: any) => (
                                        <tr key={m.id} className="border-b border-gray-50 hover:bg-gray-50">
                                            <td className="py-3 pr-4 font-mono text-xs text-gray-500">{m.material_number ?? '—'}</td>
                                            <td className="py-3 pr-4 text-gray-900">{m.description}</td>
                                            <td className="py-3 pr-4 text-gray-500 text-xs">{m.unit_of_measure}</td>
                                            <td className="py-3 pr-4 text-right text-gray-700">{m.quantity_required}</td>
                                            <td className="py-3 pr-4 text-right text-gray-700">{m.quantity_issued ?? 0}</td>
                                            <td className="py-3"><Badge label={m.status?.replace(/_/g, ' ')} color={statusColor[m.status] ?? 'gray'} /></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )
                }
            </Section>

            <Modal title="Add Material" open={showModal} onClose={() => setShowModal(false)}>
                <form onSubmit={handleSubmit}>
                    {error && <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-lg">{error}</div>}
                    <FormField label="Description" required>
                        <input name="description" required className={inputClass} placeholder="Material description" />
                    </FormField>
                    <FormField label="Material Number">
                        <input name="material_number" className={inputClass} placeholder="SAP material number (optional)" />
                    </FormField>
                    <FormField label="Category">
                        <select name="material_category" className={selectClass}>
                            <option value="mechanical">Mechanical</option>
                            <option value="electrical">Electrical</option>
                            <option value="instrumentation">Instrumentation</option>
                            <option value="consumable">Consumable</option>
                            <option value="scaffolding">Scaffolding</option>
                            <option value="insulation">Insulation</option>
                            <option value="painting">Painting</option>
                        </select>
                    </FormField>
                    <div className="grid grid-cols-2 gap-4">
                        <FormField label="Unit of Measure">
                            <select name="unit_of_measure" className={selectClass}>
                                <option value="EA">Each (EA)</option>
                                <option value="M">Metre (M)</option>
                                <option value="KG">Kilogram (KG)</option>
                                <option value="L">Litre (L)</option>
                                <option value="SET">Set (SET)</option>
                            </select>
                        </FormField>
                        <FormField label="Qty Required" required>
                            <input name="quantity_required" type="number" min="1" required className={inputClass} defaultValue="1" />
                        </FormField>
                    </div>
                    <div className="flex justify-end gap-3 mt-6">
                        <button type="button" onClick={() => setShowModal(false)} className={btnSecondary}>Cancel</button>
                        <button type="submit" disabled={saving} className={btnPrimary}>{saving ? 'Saving…' : 'Add Material'}</button>
                    </div>
                </form>
            </Modal>
        </>
    );
}

// ── Punch List ──────────────────────────────────────────
function PunchListPanel({ workpack }: { workpack: any }) {
    const router = useRouter();
    const [showModal, setShowModal] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const items: any[] = workpack.punch_list_items ?? [];
    const catColor: Record<string, string> = { A: 'red', B: 'yellow', C: 'gray' };
    const statusColor: Record<string, string> = { open: 'red', in_progress: 'yellow', closed: 'green', accepted_with_comments: 'blue' };
    const openCatA = items.filter((i: any) => i.category === 'A' && i.status !== 'closed').length;

    const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setSaving(true); setError('');
        const form = new FormData(e.currentTarget);
        try {
            await postApi(`/api/workpacks/${workpack.id}/punch-list`, {
                title: form.get('title'),
                description: form.get('description') || null,
                category: form.get('category') || 'B',
            });
            setShowModal(false);
            router.refresh();
        } catch (err: any) { setError(err.message); } finally { setSaving(false); }
    };

    const handleClose = async (itemId: string) => {
        try {
            setError('');
            await postApi(`/api/workpacks/${workpack.id}/punch-list`, { action: 'close', id: itemId });
            router.refresh();
        } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Action failed'); }
    };

    return (
        <>
            <Section
                title={`Punch List (${items.length})`}
                action={<button onClick={() => setShowModal(true)} className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700">+ Raise Item</button>}
            >
                {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center justify-between"><span>{error}</span><button onClick={() => setError('')} className="text-red-400 hover:text-red-600">✕</button></div>}
                {openCatA > 0 && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2">
                        <span>🚫</span>
                        <span><strong>{openCatA} open Category A</strong> item(s) must be closed before this workpack can be closed.</span>
                    </div>
                )}
                {items.length === 0
                    ? <EmptyState icon="✅" message="No punch list items. Workpack is clear." />
                    : (
                        <div className="space-y-2">
                            {items.map((item: any) => (
                                <div key={item.id} className="border border-gray-100 rounded-lg p-3 flex items-start gap-3 hover:bg-gray-50">
                                    <span className={`shrink-0 inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold text-white ${item.category === 'A' ? 'bg-red-500' : item.category === 'B' ? 'bg-yellow-500' : 'bg-gray-400'}`}>
                                        {item.category}
                                    </span>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm text-gray-900">{item.title}</p>
                                        {item.description && <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>}
                                        <div className="flex gap-2 mt-1">
                                            <Badge label={item.status?.replace(/_/g, ' ')} color={statusColor[item.status] ?? 'gray'} />
                                        </div>
                                    </div>
                                    {item.status === 'open' && (
                                        <button onClick={() => handleClose(item.id)} className="shrink-0 text-xs px-2 py-0.5 rounded bg-green-50 text-green-700 hover:bg-green-100">Close</button>
                                    )}
                                </div>
                            ))}
                        </div>
                    )
                }
            </Section>

            <Modal title="Raise Punch Item" open={showModal} onClose={() => setShowModal(false)}>
                <form onSubmit={handleSubmit}>
                    {error && <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-lg">{error}</div>}
                    <FormField label="Title" required>
                        <input name="title" required className={inputClass} placeholder="Punch item title" />
                    </FormField>
                    <FormField label="Description">
                        <textarea name="description" rows={2} className={inputClass} placeholder="Details…" />
                    </FormField>
                    <FormField label="Category" required>
                        <select name="category" className={selectClass} defaultValue="B">
                            <option value="A">Category A — Blocks closure</option>
                            <option value="B">Category B — Must resolve post-closure</option>
                            <option value="C">Category C — Minor / optional</option>
                        </select>
                    </FormField>
                    <div className="flex justify-end gap-3 mt-6">
                        <button type="button" onClick={() => setShowModal(false)} className={btnSecondary}>Cancel</button>
                        <button type="submit" disabled={saving} className={btnPrimary}>{saving ? 'Saving…' : 'Raise Item'}</button>
                    </div>
                </form>
            </Modal>
        </>
    );
}

// ── Documents ───────────────────────────────────────────
function DocumentsPanel({ workpack, canEdit }: { workpack: any; canEdit: boolean }) {
    const router = useRouter();
    const [uploading, setUploading] = useState(false);
    const [showExtract, setShowExtract] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [docs, setDocs] = useState<any[]>(() => workpack.workpack_documents ?? []);
    const [saving, setSaving] = useState<string | null>(null);
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [uploadDescription, setUploadDescription] = useState('');
    const generated: any[] = workpack.document_instances ?? [];
    const attachments: any[] = workpack.attachments ?? [];
    const workpackId = workpack.id;

    useEffect(() => {
        setDocs(workpack.workpack_documents ?? []);
    }, [workpack.workpack_documents]);

    const onFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files ?? []);
        setSelectedFiles(files);
        if (files.length > 0) setShowUploadModal(true);
        e.target.value = '';
    };

    const handleUploadFromModal = async () => {
        if (selectedFiles.length === 0) return;
        setUploading(true);
        setError(null);
        const description = uploadDescription.trim().slice(0, 80);
        for (const file of selectedFiles) {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('document_type', /\.(dwg|dxf|pdf)$/i.test(file.name) ? 'drawing' : 'attachment');
            if (description) formData.append('description', description);
            const res = await fetch(`/api/workpacks/${workpackId}/documents`, { method: 'POST', body: formData });
            if (!res.ok) {
                const d = await res.json().catch(() => ({}));
                setError(`${file.name}: ${(d as any).error ?? 'Upload failed'}`);
            }
        }
        setSelectedFiles([]);
        setUploadDescription('');
        setShowUploadModal(false);
        router.refresh();
        setUploading(false);
    };

    async function handleIncludeToggle(docId: string, checked: boolean) {
        setDocs((prev) => prev.map((d) => (d.id === docId ? { ...d, include_in_pdf: checked } : d)));
        setSaving(docId);
        setError(null);
        try {
            const res = await fetch(`/api/workpacks/${workpackId}/documents/${docId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ include_in_pdf: checked }),
                credentials: 'same-origin',
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                const msg = (data as { error?: string }).error || `Request failed (${res.status})`;
                throw new Error(msg);
            }
        } catch (err) {
            setDocs((prev) => prev.map((d) => (d.id === docId ? { ...d, include_in_pdf: !checked } : d)));
            setError(err instanceof Error ? err.message : 'Failed to update — please try again');
        } finally {
            setSaving(null);
        }
    }

    const docsWithPdf = docs.filter((d: any) => d.include_in_pdf);
    const totalDocs = docs.length;

    return (
        <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {error && <div className="col-span-full p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center justify-between"><span>{error}</span><button type="button" onClick={() => setError(null)} className="text-red-400 hover:text-red-600">✕</button></div>}
                <Section
                    title="Engineering Documents"
                    action={
                        <>
                            <input
                                ref={fileInputRef}
                                type="file"
                                multiple
                                accept=".pdf,.png,.jpg,.jpeg,.xlsx,.docx,.dwg,.dxf"
                                className="hidden"
                                onChange={onFileSelect}
                            />
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={uploading}
                                className="flex items-center gap-2 px-4 py-2 bg-[#0D2137] text-white text-sm font-medium rounded-xl hover:bg-[#1a3a5c] disabled:opacity-40"
                            >
                                {uploading ? '⏳ Uploading...' : '+ Upload'}
                            </button>
                        </>
                    }
                >
                    <div className="space-y-4">
                        {totalDocs > 0 ? (
                            docsWithPdf.length > 0 ? (
                                <p className="text-sm text-blue-600 mb-3">
                                    {docsWithPdf.length} of {totalDocs} documents will be included in PDF export
                                </p>
                            ) : (
                                <p className="text-sm text-gray-400 mb-3">
                                    No documents selected for PDF export. Check &quot;Include in PDF&quot; to embed documents.
                                </p>
                            )
                        ) : null}
                        {[...docs, ...attachments].length === 0 ? (
                            <EmptyState icon="📎" message="No attachments uploaded." />
                        ) : (
                            <ul className="divide-y divide-gray-50">
                                {docs.map((doc: any) => (
                                    <li key={doc.id} className="py-3">
                                        <div className="flex justify-between items-center gap-3">
                                            <div className="min-w-0 flex-1">
                                                <p className="text-sm font-bold text-gray-900 truncate">{doc.original_filename}</p>
                                                <p className="text-[10px] text-gray-400 font-mono uppercase tracking-tighter">{doc.mime_type || doc.document_type || 'Document'}</p>
                                                {doc.source === 'ai_upload' && (
                                                    <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full mt-1 inline-block">🤖 AI Upload</span>
                                                )}
                                                {doc.source === 'ai_extract' && (
                                                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full mt-1 inline-block">🤖 AI Extract</span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2 flex-none">
                                                {doc.mime_type === 'application/pdf' && canEdit && doc.source !== 'ai_extract' && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowExtract(showExtract === doc.id ? null : doc.id)}
                                                        className={`text-xs px-2 py-1 rounded-lg border transition-colors ${showExtract === doc.id ? 'bg-blue-50 border-blue-300 text-blue-700' : 'border-gray-200 text-gray-500'}`}
                                                    >
                                                        🤖 Extract
                                                    </button>
                                                )}
                                                <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer whitespace-nowrap">
                                                    <input
                                                        type="checkbox"
                                                        id={`include-${doc.id}`}
                                                        checked={doc.include_in_pdf ?? false}
                                                        onChange={(e) => handleIncludeToggle(doc.id, e.target.checked)}
                                                        disabled={saving === doc.id}
                                                        className="w-4 h-4 rounded cursor-pointer accent-blue-600"
                                                    />
                                                    Include in PDF
                                                    {saving === doc.id && (
                                                        <span className="text-xs text-gray-400 animate-pulse">saving...</span>
                                                    )}
                                                </label>
                                                <a href={`/api/workpacks/${workpackId}/documents/${doc.id}`} target="_blank" rel="noreferrer" className="text-blue-500 font-bold text-xs hover:underline">View</a>
                                            </div>
                                        </div>
                                        {showExtract === doc.id && doc.mime_type === 'application/pdf' && canEdit && doc.source !== 'ai_extract' && (
                                            <div className="mt-3">
                                                <DocumentExtractionPanel
                                                    workpackId={workpackId}
                                                    document={{ id: doc.id, title: doc.title, original_filename: doc.original_filename }}
                                                    canEdit={canEdit}
                                                    onExtractionComplete={() => {
                                                        setShowExtract(null);
                                                        router.refresh();
                                                    }}
                                                />
                                            </div>
                                        )}
                                    </li>
                                ))}
                                {attachments.map((a: any) => (
                                    <li key={a.id} className="py-3 flex justify-between items-center">
                                        <div className="min-w-0">
                                            <p className="text-sm font-bold text-gray-900 truncate">{a.original_filename ?? a.stored_filename ?? 'File'}</p>
                                            <p className="text-[10px] text-gray-400 font-mono uppercase tracking-tighter">{a.mime_type || 'Document'}</p>
                                        </div>
                                        <span className="text-blue-500 font-bold text-xs cursor-pointer hover:underline">View</span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </Section>

                <Section title="Auto-Generated Forms">
                    {generated.length === 0 ? (
                        <EmptyState icon="📄" message="No system forms generated yet." />
                    ) : (
                        <ul className="divide-y divide-gray-50">
                            {generated.map((inst: any) => (
                                <li key={inst.id} className="py-3 flex justify-between items-center">
                                    <div className="min-w-0">
                                        <p className="text-sm font-bold text-gray-900 truncate">{inst.tab_title}</p>
                                        <p className="text-[10px] text-gray-400 font-mono uppercase tracking-tighter">Generated {new Date(inst.created_at).toLocaleDateString()}</p>
                                    </div>
                                    <span className="text-green-500 font-bold text-xs cursor-pointer hover:underline">PDF</span>
                                </li>
                            ))}
                        </ul>
                    )}
                </Section>
            </div>
            <Modal title="Upload document" open={showUploadModal} onClose={() => { setShowUploadModal(false); setSelectedFiles([]); setUploadDescription(''); }}>
                <FormField label="Files">
                    <div className="flex items-center gap-2">
                        <button type="button" onClick={() => fileInputRef.current?.click()} className={btnSecondary}>
                            Choose files
                        </button>
                        <span className="text-sm text-gray-500">
                            {selectedFiles.length === 0 ? 'No files chosen' : `${selectedFiles.length} file(s) selected`}
                        </span>
                    </div>
                </FormField>
                <FormField label="Short description (shown in PDF index)">
                    <input
                        type="text"
                        className={inputClass}
                        placeholder="e.g. OEM technical manual for E-435 heat exchanger"
                        maxLength={80}
                        value={uploadDescription}
                        onChange={(e) => setUploadDescription(e.target.value)}
                    />
                    <p className="text-xs text-gray-400 mt-1">{uploadDescription.length}/80</p>
                </FormField>
                <div className="flex justify-end gap-3 mt-6">
                    <button type="button" onClick={() => { setShowUploadModal(false); setSelectedFiles([]); setUploadDescription(''); }} className={btnSecondary}>Cancel</button>
                    <button type="button" onClick={handleUploadFromModal} disabled={uploading || selectedFiles.length === 0} className={btnPrimary}>
                        {uploading ? 'Uploading…' : 'Upload'}
                    </button>
                </div>
            </Modal>
        </>
    );
}

function AttachmentsPanel({ workpack }: { workpack: any }) {
    const attachments: any[] = workpack.attachments ?? [];
    return (
        <Section title="Attachments">
            {attachments.length === 0 ? (
                <EmptyState icon="📎" message="No attachments." />
            ) : (
                <ul className="divide-y divide-gray-50">
                    {attachments.map((a: any) => (
                        <li key={a.id} className="py-3 flex justify-between items-center">
                            <p className="text-sm font-medium text-gray-900 truncate">{a.original_filename ?? a.stored_filename ?? 'File'}</p>
                            <span className="text-xs text-gray-500">{a.mime_type ?? '—'}</span>
                        </li>
                    ))}
                </ul>
            )}
        </Section>
    );
}

function WorkflowPanel({ workpack }: { workpack: any }) {
    const transitions: any[] = workpack.workflow_transitions ?? [];
    const actionColor: Record<string, string> = {
        submit: 'blue', approve: 'green', reject: 'red', issue: 'purple', close: 'gray', cancel: 'red',
    };
    return (
        <Section title="Workflow History">
            {transitions.length === 0
                ? <EmptyState icon="🔄" message="No workflow actions recorded yet." />
                : (
                    <ol className="relative border-l border-gray-200 ml-2 space-y-4">
                        {transitions.map((t: any) => (
                            <li key={t.id} className="ml-4">
                                <div className="absolute w-3 h-3 bg-white border-2 border-blue-400 rounded-full -left-1.5 mt-1" />
                                <div className="flex items-start gap-3">
                                    <div>
                                        <Badge label={t.action} color={actionColor[t.action] ?? 'gray'} />
                                        <span className="ml-2 text-xs text-gray-400">
                                            {t.from_status?.replace(/_/g, ' ')} → {t.to_status?.replace(/_/g, ' ')}
                                        </span>
                                        {t.performer && <span className="ml-2 text-xs text-gray-500">by {t.performer.name}</span>}
                                        {t.comment && <p className="text-xs text-gray-600 mt-1 italic">"{t.comment}"</p>}
                                        <p className="text-xs text-gray-400 mt-0.5">{new Date(t.performed_at).toLocaleString()}</p>
                                    </div>
                                </div>
                            </li>
                        ))}
                    </ol>
                )
            }
        </Section>
    );
}

// ─── Main WorkpackTabs component ────────────────────────
export function WorkpackTabs({ workpack, udfDefinitions = [], isAdmin = false, canDelete = false }: { workpack: any; udfDefinitions?: any[]; isAdmin?: boolean; canDelete?: boolean }) {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<WorkpackTabId>('overview');
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [deleting, setDeleting] = useState(false);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const hash = window.location.hash.slice(1);
        if (hash) setActiveTab(normaliseTabId(hash));
    }, []);

    const [openConstraintsCount, setOpenConstraintsCount] = useState(0);
    const [openHoldPointsCount, setOpenHoldPointsCount] = useState(0);
    const [pendingCertsCount, setPendingCertsCount] = useState(0);
    const [aiGeneratedCounts, setAiGeneratedCounts] = useState({
        joints_blinds: 0,
        materials: 0,
        tools: 0,
        constraints: 0,
    });
    const [sectionCounts, setSectionCounts] = useState<{
        activities?: number;
        materials?: number;
        preparation?: number;
        cleaning?: number;
        constraints?: number;
        joints_blinds?: number;
        tools?: number;
        qa_clearance?: number;
        certificates?: number;
        documents?: number;
        lessons?: number;
    }>({});
    const [fillingAll, setFillingAll] = useState(false);
    const [fillDone, setFillDone] = useState(false);
    const [fillError, setFillError] = useState<string | null>(null);

    const fetchSummaryCounts = useCallback(() => {
        fetch(`/api/workpacks/${workpack.id}/summary-counts`)
            .then((r) => (r.ok ? r.json() : {}))
            .then((d: {
                open_constraints?: number;
                open_hold_points?: number;
                pending_certs?: number;
                ai_generated_joints?: number;
                ai_generated_materials?: number;
                ai_generated_tools?: number;
                ai_generated_constraints?: number;
                section_counts?: {
                    activities?: number;
                    materials?: number;
                    preparation?: number;
                    cleaning?: number;
                    constraints?: number;
                    joints_blinds?: number;
                    tools?: number;
                    qa_clearance?: number;
                    certificates?: number;
                    documents?: number;
                    lessons?: number;
                };
            }) => {
                setOpenConstraintsCount(d.open_constraints ?? 0);
                setOpenHoldPointsCount(d.open_hold_points ?? 0);
                setPendingCertsCount(d.pending_certs ?? 0);
                setAiGeneratedCounts({
                    joints_blinds: d.ai_generated_joints ?? 0,
                    materials: d.ai_generated_materials ?? 0,
                    tools: d.ai_generated_tools ?? 0,
                    constraints: d.ai_generated_constraints ?? 0,
                });
                setSectionCounts(d.section_counts ?? {});
            })
            .catch(() => { });
    }, [workpack.id]);

    useEffect(() => {
        fetchSummaryCounts();
    }, [fetchSummaryCounts]);

    useEffect(() => {
        if (activeTab === 'overview') {
            fetchSummaryCounts();
        }
    }, [activeTab, fetchSummaryCounts]);

    useEffect(() => {
        const onRefreshEvent = (e: Event) => {
            if (e.type === 'blinds-refreshed') {
                console.log("[UI] blinds-refreshed event received");
            } else {
                console.log(`[UI] ${e.type} event received`);
            }
            router.refresh();
            fetchSummaryCounts();
        };

        window.addEventListener('joints-refreshed', onRefreshEvent);
        window.addEventListener('blinds-refreshed', onRefreshEvent);

        return () => {
            window.removeEventListener('joints-refreshed', onRefreshEvent);
            window.removeEventListener('blinds-refreshed', onRefreshEvent);
        };
    }, [router, fetchSummaryCounts]);

    const features = new Set<string>(
        (workpack.organization?.feature_flags && typeof workpack.organization.feature_flags === 'object'
            ? Object.keys(workpack.organization.feature_flags).filter(
                (k) => workpack.organization.feature_flags[k] === true
            )
            : []
        ).concat([
            'wp.tab.activities',
            'wp.tab.joints',
            'wp.tab.materials',
            'wp.tab.tools',
            'wp.tab.constraints',
            'wp.tab.checklists',
            'wp.tab.cleaning',
            'wp.tab.qa',
            'wp.tab.certificates',
            'wp.tab.lessons_learnt',
        ])
    );

    const canEdit = !workpack.is_locked && ['draft', 'pending_ai_review'].includes(workpack.status);

    function renderTabContent(tab: WorkpackTabId): React.ReactNode {
        switch (tab) {
            case 'overview': {
                const allTabsEmpty =
                    (sectionCounts.materials ?? 0) === 0 &&
                    (sectionCounts.tools ?? 0) === 0 &&
                    (sectionCounts.constraints ?? 0) === 0 &&
                    (sectionCounts.joints_blinds ?? 0) === 0;
                return (
                    <div className="space-y-5">
                        {allTabsEmpty && !fillDone && (
                            <div className="mb-6 p-5 bg-violet-50 border border-violet-200 rounded-xl flex items-start justify-between gap-4">
                                <div>
                                    <p className="font-semibold text-violet-900 flex items-center gap-2">
                                        🤖 Auto-fill this workpack with AI
                                    </p>
                                    <p className="text-sm text-violet-600 mt-1">
                                        Instantly generate materials, tools, constraints and joint register
                                        based on activities, equipment type and attached documents.
                                    </p>
                                    {fillError && (
                                        <p className="text-sm text-red-600 mt-2 bg-red-50 px-3 py-1 rounded">
                                            {fillError}
                                        </p>
                                    )}
                                </div>
                                <button
                                    type="button"
                                    onClick={async () => {
                                        setFillingAll(true);
                                        setFillError(null);
                                        const steps = [
                                            { name: 'Joints', url: `/api/workpacks/${workpack.id}/joints/generate-from-drawing` },
                                            { name: 'Materials', url: `/api/workpacks/${workpack.id}/materials/generate-with-ai` },
                                            { name: 'Tools', url: `/api/workpacks/${workpack.id}/tools/generate-with-ai` },
                                            { name: 'Constraints', url: `/api/workpacks/${workpack.id}/constraints/generate-with-ai` },
                                        ];
                                        const errors: string[] = [];
                                        for (const step of steps) {
                                            try {
                                                const res = await fetch(step.url, {
                                                    method: 'POST',
                                                    headers: { 'Content-Type': 'application/json' },
                                                    body: JSON.stringify({ autoSave: true }),
                                                });
                                                const data = await res.json().catch(() => ({}));
                                                if (!res.ok) errors.push(`${step.name}: ${data.error ?? res.status}`);
                                            } catch (err) {
                                                errors.push(`${step.name}: ${err instanceof Error ? err.message : 'network error'}`);
                                            }
                                        }
                                        setFillingAll(false);
                                        if (errors.length > 0) setFillError(errors.join(' | '));
                                        else {
                                            setFillDone(true);
                                            router.refresh();
                                        }
                                    }}
                                    disabled={fillingAll}
                                    className="flex-shrink-0 flex items-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap shadow-sm"
                                >
                                    {fillingAll ? (
                                        <>
                                            <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                                            </svg>
                                            Filling tabs...
                                        </>
                                    ) : (
                                        '✨ Fill All Tabs'
                                    )}
                                </button>
                            </div>
                        )}
                        {fillDone && (
                            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl text-green-800 text-sm font-medium">
                                ✅ All tabs filled with AI. Review and edit as needed.
                            </div>
                        )}
                        <WorkpackTimeline
                            workpack={workpack}
                            summaryData={{
                                open_constraints: openConstraintsCount,
                                open_hold_points: openHoldPointsCount,
                                pending_certs: pendingCertsCount,
                            }}
                            sectionCounts={sectionCounts}
                            onTabChange={(tabId) => setActiveTab(tabId as WorkpackTabId)}
                        />
                        <OverviewPanel workpack={workpack} isAdmin={isAdmin} />
                    </div>
                );
            }
            case 'activities':
                return <ActivitiesPanel workpack={workpack} udfDefinitions={udfDefinitions} />;
            case 'joints_blinds':
                return (
                    <JointsBlindTab
                        workpackId={workpack.id}
                        topContent={<JointsPanel workpack={workpack} />}
                        bottomContent={<BlindsPanel workpack={workpack} />}
                        jointCount={workpack.joint_integrity_items?.length ?? 0}
                    />
                );
            case 'materials':
                return <MaterialsTab workpack={workpack} />;
            case 'tools':
                return <ToolsTab workpack={workpack} />;
            case 'constraints':
                return <ConstraintsTab workpackId={workpack.id} canEdit={canEdit} />;
            case 'preparation':
                return <PreparationTab workpack={workpack} />;
            case 'cleaning':
                return <CleaningPanel workpack={workpack} />;
            case 'qa_clearance':
                return <QaClearanceTab workpack={workpack} />;
            case 'certificates':
                return (
                    <CertificatesTab
                        workpackId={workpack.id}
                        workpack={workpack}
                        canEdit={canEdit}
                    />
                );
            case 'attachments':
                return <AttachmentsTab workpackId={workpack.id} />;
            case 'documents':
                return <DocumentsTab workpackId={workpack.id} canEdit={canEdit} />;
            case 'lessons':
                return <LessonsLearntPanel workpack={workpack} canEdit={canEdit} />;
            case 'punch_list':
                return <PunchListPanel workpack={workpack} />;
            default:
                return (
                    <div className="text-center py-12 text-gray-400 text-sm">
                        Tab not found.
                    </div>
                );
        }
    }

    async function handleDeleteWorkpack() {
        setDeleting(true);
        try {
            const res = await fetch(`/api/workpacks/${workpack.id}`, { method: 'DELETE' });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error ?? 'Delete failed');
            }
            setShowDeleteDialog(false);
            router.push('/workpacks');
        } catch (err) {
            console.error(err);
            alert(err instanceof Error ? err.message : 'Failed to delete workpack. Please try again.');
        } finally {
            setDeleting(false);
        }
    }

    return (
        <>
            <WorkpackLayout
                workpack={workpack}
                activeTab={activeTab}
                features={features}
                canEdit={canEdit}
                onTabChange={(tab) => setActiveTab(tab)}
                counts={{
                    open_constraints: openConstraintsCount,
                    open_hold_points: openHoldPointsCount,
                    pending_certs: pendingCertsCount,
                    ai_generated_joints: aiGeneratedCounts.joints_blinds,
                    ai_generated_materials: aiGeneratedCounts.materials,
                    ai_generated_tools: aiGeneratedCounts.tools,
                    ai_generated_constraints: aiGeneratedCounts.constraints,
                }}
                canDelete={canDelete}
                onDeleteClick={canDelete ? () => setShowDeleteDialog(true) : undefined}
            >
                <div className="h-full">
                    <ErrorBoundary key={activeTab}>
                        {renderTabContent(activeTab)}
                    </ErrorBoundary>
                </div>
            </WorkpackLayout>
            {showDeleteDialog && (
                <ConfirmDeleteDialog
                    title="Delete Workpack?"
                    message={`This will permanently delete "${workpack.workpack_id_code ?? workpack.workpack_number ?? 'Workpack'} — ${workpack.title}" and all its data including activities, materials, joints, documents and certificates. This cannot be undone.`}
                    confirmLabel="Delete Workpack"
                    onConfirm={handleDeleteWorkpack}
                    onCancel={() => setShowDeleteDialog(false)}
                    loading={deleting}
                    dangerous
                />
            )}
        </>
    );
}
