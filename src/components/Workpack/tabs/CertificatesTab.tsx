'use client';

import { useState, useEffect } from 'react';

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
    not_started: { bg: 'bg-gray-100', text: 'text-gray-600', label: 'Not Started' },
    in_progress: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'In Progress' },
    pending_sign: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Pending Sign-off' },
    signed: { bg: 'bg-green-100', text: 'text-green-700', label: 'Signed' },
    rejected: { bg: 'bg-red-100', text: 'text-red-600', label: 'Rejected' },
};

function getAutoValue(workpack: any, path: string): string | null {
    const parts = path.replace('workpack.', '').split('.');
    let val: any = workpack;
    for (const p of parts) {
        if (val == null) return null;
        val = val[p];
    }
    return val != null ? String(val) : null;
}

export function CertificatesTab({
    workpackId,
    workpack,
    canEdit,
}: {
    workpackId: string;
    workpack: any;
    canEdit: boolean;
}) {
    const [certs, setCerts] = useState<any[]>([]);
    const [templates, setTemplates] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [showAddModal, setShowAddModal] = useState(false);
    const [attaching, setAttaching] = useState(false);

    useEffect(() => {
        loadCerts();
    }, [workpackId]);
    useEffect(() => {
        fetch('/api/certificate-templates')
            .then((r) => (r.ok ? r.json() : []))
            .then(setTemplates);
    }, []);

    async function loadCerts() {
        setLoading(true);
        const res = await fetch(`/api/workpacks/${workpackId}/certificates`);
        if (res.ok) setCerts(await res.json());
        setLoading(false);
    }

    async function handleFieldChange(certId: string, fieldKey: string, value: string) {
        const res = await fetch(`/api/workpacks/${workpackId}/certificates/${certId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ field_values: { [fieldKey]: value } }),
        });
        if (res.ok) {
            const updated = await res.json();
            setCerts((prev) => prev.map((c) => (c.id === certId ? updated : c)));
        }
    }

    async function handleStatusChange(certId: string, newStatus: string) {
        const res = await fetch(`/api/workpacks/${workpackId}/certificates/${certId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus }),
        });
        if (res.ok) {
            const updated = await res.json();
            setCerts((prev) => prev.map((c) => (c.id === certId ? updated : c)));
        }
    }

    async function handlePdfToggle(certId: string, includeInPdf: boolean) {
        const res = await fetch(`/api/workpacks/${workpackId}/certificates/${certId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ include_in_pdf: includeInPdf }),
        });
        if (res.ok) {
            const updated = await res.json();
            setCerts((prev) => prev.map((c) => (c.id === certId ? updated : c)));
        }
    }

    async function handleDelete(certId: string) {
        if (!confirm('Remove this certificate from the workpack?')) return;
        await fetch(`/api/workpacks/${workpackId}/certificates/${certId}`, { method: 'DELETE' });
        setCerts((prev) => prev.filter((c) => c.id !== certId));
    }

    async function addFromTemplate(templateId: string) {
        setAttaching(true);
        const res = await fetch(`/api/workpacks/${workpackId}/certificates`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ template_id: templateId }),
        });
        if (!res.ok) setError((await res.json()).error);
        else {
            await loadCerts();
            setShowAddModal(false);
        }
        setAttaching(false);
    }

    async function autoAttachByEquipment() {
        if (!workpack?.equipment_type) {
            setError('Set Equipment Type on the workpack first (Edit → Equipment Type)');
            return;
        }
        setAttaching(true);
        const res = await fetch(`/api/workpacks/${workpackId}/certificates`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ equipment_type: workpack.equipment_type }),
        });
        const d = await res.json();
        if (res.ok) {
            await loadCerts();
            if (d.attached === 0) setError(`No certificate templates found for "${workpack.equipment_type}". Add templates in Settings.`);
        } else setError(d.error);
        setAttaching(false);
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12 text-gray-400 text-sm">
                <div className="animate-spin w-5 h-5 border-2 border-gray-200 border-t-blue-600 rounded-full mr-3" />
                Loading certificates...
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                    <span>⚠</span>
                    <span className="flex-1">{error}</span>
                    <button type="button" onClick={() => setError(null)}>✕</button>
                </div>
            )}
            <div className="flex items-start justify-between flex-wrap gap-3">
                <div>
                    <h2 className="text-base font-semibold text-gray-900">Certificates</h2>
                    {workpack?.equipment_type && (
                        <p className="text-xs text-gray-500 mt-0.5">
                            Equipment: {workpack.equipment_type}
                            {certs.length > 0 && (
                                <span className="ml-1 text-gray-400">
                                    · {certs.filter((c) => c.include_in_pdf).length} included in PDF
                                </span>
                            )}
                        </p>
                    )}
                </div>
                {canEdit && (
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={autoAttachByEquipment}
                            disabled={attaching}
                            className="px-3 py-1.5 text-sm border border-gray-300 rounded-xl hover:bg-gray-50 text-gray-700 disabled:opacity-40"
                        >
                            {attaching ? '⏳' : '🔗'} Auto-attach
                        </button>
                        <button
                            type="button"
                            onClick={() => setShowAddModal(true)}
                            className="px-4 py-2 bg-[#0D2137] text-white text-sm font-medium rounded-xl hover:bg-[#1a3a5c]"
                        >
                            + Add Certificate
                        </button>
                    </div>
                )}
            </div>

            {certs.length === 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 text-center">
                    <p className="text-2xl mb-2">📜</p>
                    <p className="text-sm font-medium text-gray-800 mb-1">No certificates yet</p>
                    <p className="text-xs text-gray-500 mb-4">
                        {workpack?.equipment_type
                            ? `Click "Auto-attach" to load standard certificates for ${workpack.equipment_type}`
                            : 'Set the Equipment Type on this workpack to auto-load standard certificates, or add manually.'}
                    </p>
                    {canEdit && workpack?.equipment_type && (
                        <button
                            type="button"
                            onClick={autoAttachByEquipment}
                            disabled={attaching}
                            className="px-5 py-2 bg-[#0D2137] text-white text-sm rounded-xl hover:bg-[#1a3a5c] disabled:opacity-40"
                        >
                            {attaching ? 'Attaching...' : `🔗 Auto-attach for ${workpack.equipment_type}`}
                        </button>
                    )}
                </div>
            )}

            <div className="space-y-3">
                {certs.map((cert: any) => {
                    const isExpanded = expandedId === cert.id;
                    const fields: any[] = cert.template?.fields ?? [];
                    const values: Record<string, string> = cert.field_values ?? {};
                    const statusStyle = STATUS_STYLES[cert.status] ?? STATUS_STYLES.not_started;
                    return (
                        <div key={cert.id} className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                            <div
                                className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-gray-50/50"
                                onClick={() => setExpandedId(isExpanded ? null : cert.id)}
                            >
                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                    <span className="text-xl">📜</span>
                                    <div className="min-w-0">
                                        <p className="text-sm font-semibold text-gray-900 truncate">{cert.cert_name}</p>
                                        {cert.pass_fail && (
                                            <span className={`text-xs font-bold ${cert.pass_fail === 'pass' ? 'text-green-600' : cert.pass_fail === 'fail' ? 'text-red-600' : 'text-amber-600'}`}>
                                                {cert.pass_fail.toUpperCase()}
                                            </span>
                                        )}
                                    </div>
                                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium whitespace-nowrap ${statusStyle.bg} ${statusStyle.text}`}>
                                        {statusStyle.label}
                                    </span>
                                </div>
                                <div className="flex items-center gap-3 flex-none ml-3">
                                    <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer" onClick={(e) => e.stopPropagation()}>
                                        <input
                                            type="checkbox"
                                            checked={cert.include_in_pdf ?? true}
                                            onChange={(e) => handlePdfToggle(cert.id, e.target.checked)}
                                            className="rounded"
                                        />
                                        In PDF
                                    </label>
                                    {canEdit && (
                                        <select
                                            value={cert.status}
                                            onChange={(e) => { e.stopPropagation(); handleStatusChange(cert.id, e.target.value); }}
                                            onClick={(e) => e.stopPropagation()}
                                            className="text-xs border border-gray-300 rounded-lg px-2 py-1 focus:outline-none bg-white"
                                        >
                                            {Object.entries(STATUS_STYLES).map(([k, v]) => (
                                                <option key={k} value={k}>{v.label}</option>
                                            ))}
                                        </select>
                                    )}
                                    {canEdit && (
                                        <button
                                            type="button"
                                            onClick={(e) => { e.stopPropagation(); handleDelete(cert.id); }}
                                            className="text-gray-300 hover:text-red-500 text-sm p-1"
                                        >
                                            ✕
                                        </button>
                                    )}
                                    <span className="text-gray-400 text-sm">{isExpanded ? '▲' : '▼'}</span>
                                </div>
                            </div>
                            {isExpanded && (
                                <div className="px-5 pb-5 border-t border-gray-100 bg-gray-50/30">
                                    <div className="pt-4 grid grid-cols-2 gap-4">
                                        {fields.map((field: any) => {
                                            const autoValue = field.auto_from ? getAutoValue(workpack, field.auto_from) : null;
                                            const currentValue = values[field.key] ?? autoValue ?? '';
                                            return (
                                                <div key={field.key} className={field.type === 'textarea' ? 'col-span-2' : ''}>
                                                    <label className="text-xs font-medium text-gray-600 mb-1 block">
                                                        {field.label}
                                                        {field.required && <span className="text-red-400 ml-0.5">*</span>}
                                                    </label>
                                                    {field.type === 'textarea' ? (
                                                        <textarea
                                                            value={currentValue}
                                                            onChange={(e) => handleFieldChange(cert.id, field.key, e.target.value)}
                                                            disabled={!canEdit}
                                                            rows={2}
                                                            className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none disabled:bg-gray-100 resize-none"
                                                        />
                                                    ) : (
                                                        <input
                                                            type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
                                                            value={currentValue}
                                                            onChange={(e) => handleFieldChange(cert.id, field.key, e.target.value)}
                                                            disabled={!canEdit}
                                                            className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none disabled:bg-gray-100"
                                                        />
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {showAddModal && (
                <>
                    <div className="fixed inset-0 bg-black/40 z-40" onClick={() => setShowAddModal(false)} />
                    <div className="fixed inset-y-1/4 left-1/2 -translate-x-1/2 w-full max-w-lg bg-white rounded-2xl shadow-2xl z-50 flex flex-col overflow-hidden">
                        <div className="flex items-center justify-between px-6 py-4 border-b">
                            <h3 className="font-semibold text-gray-900">Add Certificate</h3>
                            <button type="button" onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-2">
                            {templates.length === 0 ? (
                                <p className="text-sm text-gray-400 text-center py-8">No certificate templates available.</p>
                            ) : (
                                templates.map((t: any) => {
                                    const alreadyAdded = certs.some((c) => c.template_id === t.id);
                                    return (
                                        <div key={t.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-xl hover:border-blue-300">
                                            <div>
                                                <p className="text-sm font-medium text-gray-900">{t.cert_name}</p>
                                                <p className="text-xs text-gray-400 mt-0.5">{t.equipment_types?.join(', ')}</p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => addFromTemplate(t.id)}
                                                disabled={alreadyAdded || attaching}
                                                className={`text-xs px-3 py-1.5 rounded-lg font-medium ${alreadyAdded ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
                                            >
                                                {alreadyAdded ? '✓ Added' : 'Add'}
                                            </button>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
