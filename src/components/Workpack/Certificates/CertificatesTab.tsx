'use client';

import { useState, useEffect, useCallback } from 'react';

type TemplateField = { key: string; label: string; type: 'text' | 'number' | 'date' | 'boolean' | 'select'; options?: string[]; required?: boolean };

type CertInstance = {
    id: string;
    cert_type: string;
    cert_name: string;
    status: string;
    pass_fail: string | null;
    field_values: Record<string, unknown>;
    prepared_by: string | null;
    prepared_date: string | null;
    approved_by: string | null;
    approved_date: string | null;
    third_party_inspector: string | null;
    third_party_date: string | null;
    remarks: string | null;
    include_in_pdf: boolean;
    template: { cert_name: string; cert_type: string; fields: TemplateField[] } | null;
};

type Template = { id: string; cert_name: string; cert_type: string; equipment_types: string[] };

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
    not_started:   { label: 'Not Started',      color: 'bg-gray-100 text-gray-500' },
    in_progress:   { label: 'In Progress',       color: 'bg-blue-50 text-blue-700' },
    pending_sign:  { label: 'Pending Sign-off',  color: 'bg-amber-50 text-amber-700' },
    signed:        { label: 'Signed',            color: 'bg-green-50 text-green-700' },
    rejected:      { label: 'Rejected',          color: 'bg-red-50 text-red-700' },
};

function StatusBadge({ status }: { status: string }) {
    const s = STATUS_LABELS[status] ?? { label: status, color: 'bg-gray-100 text-gray-500' };
    return <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${s.color}`}>{s.label}</span>;
}

function PassFailBadge({ value }: { value: string | null }) {
    if (!value) return <span className="text-gray-400 text-xs">—</span>;
    return (
        <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${value === 'pass' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
            {value === 'pass' ? '✓ Pass' : '✗ Fail'}
        </span>
    );
}

interface CertEditDrawerProps {
    cert: CertInstance;
    workpackId: string;
    onClose: () => void;
    onSaved: () => void;
}

function CertEditDrawer({ cert, workpackId, onClose, onSaved }: CertEditDrawerProps) {
    const fields: TemplateField[] = (cert.template?.fields ?? []) as TemplateField[];
    const [fieldValues, setFieldValues] = useState<Record<string, unknown>>(cert.field_values ?? {});
    const [status, setStatus] = useState(cert.status);
    const [passFail, setPassFail] = useState(cert.pass_fail ?? '');
    const [remarks, setRemarks] = useState(cert.remarks ?? '');
    const [preparedBy, setPreparedBy] = useState(cert.prepared_by ?? '');
    const [approvedBy, setApprovedBy] = useState(cert.approved_by ?? '');
    const [thirdParty, setThirdParty] = useState(cert.third_party_inspector ?? '');
    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        setSaving(true);
        try {
            await fetch(`/api/workpacks/${workpackId}/certificates/${cert.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    field_values: fieldValues,
                    status,
                    pass_fail: passFail || null,
                    remarks: remarks || null,
                    prepared_by: preparedBy || null,
                    approved_by: approvedBy || null,
                    third_party_inspector: thirdParty || null,
                }),
            });
            onSaved();
            onClose();
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex">
            <div className="absolute inset-0 bg-black/40" onClick={onClose} />
            <div className="relative ml-auto w-full max-w-lg bg-white shadow-2xl flex flex-col h-full overflow-auto">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50">
                    <div>
                        <h3 className="font-semibold text-gray-900 text-base">{cert.cert_name}</h3>
                        <p className="text-xs text-gray-500">{cert.cert_type}</p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
                </div>

                <div className="flex-1 overflow-auto px-6 py-5 flex flex-col gap-5">
                    {/* Status + pass/fail */}
                    <div className="grid grid-cols-2 gap-4">
                        <label className="flex flex-col gap-1">
                            <span className="text-xs font-medium text-gray-500">Status</span>
                            <select value={status} onChange={(e) => setStatus(e.target.value)}
                                className="px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#0D2137]">
                                {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                            </select>
                        </label>
                        <label className="flex flex-col gap-1">
                            <span className="text-xs font-medium text-gray-500">Pass / Fail</span>
                            <select value={passFail} onChange={(e) => setPassFail(e.target.value)}
                                className="px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#0D2137]">
                                <option value="">— not set —</option>
                                <option value="pass">Pass</option>
                                <option value="fail">Fail</option>
                            </select>
                        </label>
                    </div>

                    {/* Dynamic fields from template */}
                    {fields.length > 0 && (
                        <div className="flex flex-col gap-3">
                            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Certificate Fields</h4>
                            {fields.map((f) => (
                                <label key={f.key} className="flex flex-col gap-1">
                                    <span className="text-xs font-medium text-gray-600">{f.label}{f.required && <span className="text-red-500 ml-0.5">*</span>}</span>
                                    {f.type === 'boolean' ? (
                                        <input type="checkbox" checked={Boolean(fieldValues[f.key])}
                                            onChange={(e) => setFieldValues({ ...fieldValues, [f.key]: e.target.checked })}
                                            className="w-5 h-5 rounded border-gray-300" />
                                    ) : f.type === 'select' && f.options ? (
                                        <select value={String(fieldValues[f.key] ?? '')} onChange={(e) => setFieldValues({ ...fieldValues, [f.key]: e.target.value })}
                                            className="px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#0D2137]">
                                            <option value="">— select —</option>
                                            {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
                                        </select>
                                    ) : (
                                        <input type={f.type === 'date' ? 'date' : f.type === 'number' ? 'number' : 'text'}
                                            value={String(fieldValues[f.key] ?? '')}
                                            onChange={(e) => setFieldValues({ ...fieldValues, [f.key]: e.target.value })}
                                            className="px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#0D2137]" />
                                    )}
                                </label>
                            ))}
                        </div>
                    )}

                    {/* Sign-off block */}
                    <div className="flex flex-col gap-3">
                        <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Sign-off Chain</h4>
                        {[
                            ['Prepared By', preparedBy, setPreparedBy],
                            ['Approved By', approvedBy, setApprovedBy],
                            ['Third-Party Inspector', thirdParty, setThirdParty],
                        ].map(([label, value, setter]) => (
                            <label key={label as string} className="flex flex-col gap-1">
                                <span className="text-xs font-medium text-gray-600">{label as string}</span>
                                <input type="text" value={value as string} onChange={(e) => (setter as (v: string) => void)(e.target.value)}
                                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#0D2137]" />
                            </label>
                        ))}
                    </div>

                    <label className="flex flex-col gap-1">
                        <span className="text-xs font-medium text-gray-500">Remarks</span>
                        <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={3}
                            className="px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#0D2137] resize-none" />
                    </label>
                </div>

                <div className="px-6 py-4 border-t border-gray-200 flex gap-3">
                    <button onClick={onClose} className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200">Cancel</button>
                    <button id={`save-cert-${cert.id}`} onClick={() => void handleSave()} disabled={saving}
                        className="flex-1 px-4 py-2 bg-[#0D2137] text-white text-sm rounded-lg hover:bg-[#1a3a5c] disabled:opacity-50">
                        {saving ? 'Saving…' : 'Save Certificate'}
                    </button>
                </div>
            </div>
        </div>
    );
}

export function CertificatesTab({ workpackId, readOnly = false }: { workpackId: string; readOnly?: boolean }) {
    const [certs, setCerts] = useState<CertInstance[]>([]);
    const [templates, setTemplates] = useState<Template[]>([]);
    const [loading, setLoading] = useState(true);
    const [editCert, setEditCert] = useState<CertInstance | null>(null);
    const [showAttach, setShowAttach] = useState(false);
    const [selectedTemplate, setSelectedTemplate] = useState('');
    const [attaching, setAttaching] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        const [certsRes, templatesRes] = await Promise.all([
            fetch(`/api/workpacks/${workpackId}/certificates`),
            fetch(`/api/settings/certificate-templates`),
        ]);
        if (certsRes.ok) setCerts(await certsRes.json());
        if (templatesRes.ok) setTemplates(await templatesRes.json());
        setLoading(false);
    }, [workpackId]);

    useEffect(() => { void load(); }, [load]);

    const attachTemplate = async () => {
        if (!selectedTemplate) return;
        setAttaching(true);
        try {
            await fetch(`/api/workpacks/${workpackId}/certificates`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ template_id: selectedTemplate }),
            });
            setShowAttach(false);
            setSelectedTemplate('');
            await load();
        } finally {
            setAttaching(false);
        }
    };

    const removeCert = async (certId: string) => {
        await fetch(`/api/workpacks/${workpackId}/certificates/${certId}`, { method: 'DELETE' });
        await load();
    };

    if (loading) return <div className="flex items-center justify-center h-40 text-sm text-gray-400">Loading certificates…</div>;

    const attachedIds = new Set(certs.map((c) => c.template?.cert_name));

    return (
        <div className="flex flex-col gap-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-gray-900">
                    Certificates <span className="text-gray-400 font-normal text-sm">({certs.length})</span>
                </h3>
                {!readOnly && (
                    <button id="attach-cert-btn" onClick={() => setShowAttach(true)}
                        className="px-4 py-2 bg-[#0D2137] text-white text-sm font-medium rounded-lg hover:bg-[#1a3a5c]">
                        + Attach Certificate
                    </button>
                )}
            </div>

            {/* Attach modal */}
            {showAttach && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/40" onClick={() => setShowAttach(false)} />
                    <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 flex flex-col gap-4">
                        <h4 className="text-lg font-semibold text-gray-900">Attach Certificate</h4>
                        <label className="flex flex-col gap-1">
                            <span className="text-xs font-medium text-gray-500">Template</span>
                            <select value={selectedTemplate} onChange={(e) => setSelectedTemplate(e.target.value)}
                                className="px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#0D2137]">
                                <option value="">— select template —</option>
                                {templates.filter((t) => !attachedIds.has(t.cert_name)).map((t) => (
                                    <option key={t.id} value={t.id}>{t.cert_name} ({t.cert_type})</option>
                                ))}
                            </select>
                        </label>
                        <div className="flex gap-3">
                            <button onClick={() => setShowAttach(false)} className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg">Cancel</button>
                            <button onClick={() => void attachTemplate()} disabled={!selectedTemplate || attaching}
                                className="flex-1 px-4 py-2 bg-[#0D2137] text-white text-sm rounded-lg hover:bg-[#1a3a5c] disabled:opacity-40">
                                {attaching ? '…' : 'Attach'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {certs.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 gap-2 text-gray-400">
                    <span className="text-3xl">📜</span>
                    <p className="text-sm">No certificates attached to this workpack</p>
                </div>
            ) : (
                <div className="flex flex-col gap-2">
                    {certs.map((cert) => (
                        <div key={cert.id} className="border border-gray-200 rounded-xl p-4 flex items-start justify-between gap-4 hover:bg-gray-50 transition-colors">
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-semibold text-gray-900 text-sm">{cert.cert_name}</span>
                                    <span className="text-xs text-gray-400 font-mono">{cert.cert_type}</span>
                                    <StatusBadge status={cert.status} />
                                    <PassFailBadge value={cert.pass_fail} />
                                </div>
                                {cert.prepared_by && (
                                    <p className="text-xs text-gray-400 mt-1">Prepared by: {cert.prepared_by}{cert.approved_by ? ` · Approved by: ${cert.approved_by}` : ''}</p>
                                )}
                                {cert.remarks && <p className="text-xs text-gray-500 mt-1 truncate max-w-md">{cert.remarks}</p>}
                            </div>
                            <div className="flex gap-2 shrink-0">
                                {!readOnly && (
                                    <>
                                        <button id={`edit-cert-${cert.id}`} onClick={() => setEditCert(cert)}
                                            className="px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg hover:border-[#0D2137] hover:text-[#0D2137]">
                                            ✏ Edit
                                        </button>
                                        <button id={`remove-cert-${cert.id}`} onClick={() => void removeCert(cert.id)}
                                            className="px-3 py-1.5 text-xs font-medium border border-red-200 text-red-600 rounded-lg hover:bg-red-50">
                                            ✕
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {editCert && (
                <CertEditDrawer cert={editCert} workpackId={workpackId} onClose={() => setEditCert(null)} onSaved={() => void load()} />
            )}
        </div>
    );
}
