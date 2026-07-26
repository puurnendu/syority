'use client';

import { useState, useEffect, useCallback } from 'react';

type ValidationResult = {
    isValid: boolean;
    incompleteActivities: number;
    openCatA: number;
    pendingSignOffs: number;
    totalPunchB: number;
    totalPunchC: number;
};

type JccCert = {
    id: string;
    certificate_number: string | null;
    scope_summary: string | null;
    activities_completed: number | null;
    open_punch_cat_b: number;
    open_punch_cat_c: number;
    pressure_tests_status: string | null;
    materials_summary: string | null;
    lessons_learnt_summary: string | null;
    maint_engineer_id: string | null;
    maint_engineer_signed_at: string | null;
    operations_id: string | null;
    operations_signed_at: string | null;
    qa_id: string | null;
    qa_signed_at: string | null;
    client_name: string | null;
    client_signed_at: string | null;
    created_at: string;
};

const SIGN_ROLES = [
    { key: 'maint_engineer', label: 'Maintenance Engineer', idField: 'maint_engineer_id' as const, atField: 'maint_engineer_signed_at' as const },
    { key: 'operations',     label: 'Operations',           idField: 'operations_id' as const,     atField: 'operations_signed_at' as const },
    { key: 'qa',             label: 'Quality Assurance',    idField: 'qa_id' as const,              atField: 'qa_signed_at' as const },
    { key: 'client',         label: 'Client',               idField: 'client_name' as const,        atField: 'client_signed_at' as const },
] as const;

export function JccPanel({ workpackId, readOnly = false }: { workpackId: string; readOnly?: boolean }) {
    const [data, setData] = useState<{ certificate: JccCert | null; validation: ValidationResult } | null>(null);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [signing, setSigning] = useState<string | null>(null);
    const [editMode, setEditMode] = useState(false);
    const [formData, setFormData] = useState({
        scope_summary: '',
        pressure_tests_status: '',
        materials_summary: '',
        lessons_learnt_summary: '',
        client_name: '',
    });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const load = useCallback(async () => {
        setLoading(true);
        const res = await fetch(`/api/workpacks/${workpackId}/jcc`);
        if (res.ok) {
            const d = await res.json();
            setData(d);
            if (d.certificate) {
                setFormData({
                    scope_summary: d.certificate.scope_summary ?? '',
                    pressure_tests_status: d.certificate.pressure_tests_status ?? '',
                    materials_summary: d.certificate.materials_summary ?? '',
                    lessons_learnt_summary: d.certificate.lessons_learnt_summary ?? '',
                    client_name: d.certificate.client_name ?? '',
                });
            }
        }
        setLoading(false);
    }, [workpackId]);

    useEffect(() => { void load(); }, [load]);

    const generate = async () => {
        setGenerating(true);
        setError('');
        try {
            const res = await fetch(`/api/workpacks/${workpackId}/jcc`, { method: 'POST' });
            if (!res.ok) throw new Error((await res.json()).error ?? 'Failed');
            await load();
        } catch (e) { setError(e instanceof Error ? e.message : 'Failed'); }
        finally { setGenerating(false); }
    };

    const saveNarrative = async () => {
        setSaving(true);
        try {
            await fetch(`/api/workpacks/${workpackId}/jcc`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            });
            setEditMode(false);
            await load();
        } finally { setSaving(false); }
    };

    const signRole = async (role: string) => {
        setSigning(role);
        try {
            await fetch(`/api/workpacks/${workpackId}/jcc/sign`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ role }),
            });
            await load();
        } finally { setSigning(null); }
    };

    if (loading) return <div className="flex items-center justify-center h-40 text-sm text-gray-400">Loading JCC…</div>;
    if (!data) return null;

    const { certificate, validation } = data;

    /* ── Validation Gate ── */
    if (!certificate) {
        const checks = [
            { label: 'All activities completed', ok: validation.incompleteActivities === 0, detail: validation.incompleteActivities > 0 ? `${validation.incompleteActivities} remaining` : undefined },
            { label: 'No open Cat A punch items', ok: validation.openCatA === 0, detail: validation.openCatA > 0 ? `${validation.openCatA} open` : undefined },
            { label: 'All clearance sign-offs received', ok: validation.pendingSignOffs === 0, detail: validation.pendingSignOffs > 0 ? `${validation.pendingSignOffs} pending` : undefined },
        ];
        const allOk = checks.every((c) => c.ok);

        return (
            <div className="flex flex-col gap-5">
                <div className={`rounded-xl border p-4 ${allOk ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
                    <h3 className={`font-semibold text-sm ${allOk ? 'text-green-800' : 'text-amber-800'}`}>
                        {allOk ? '✅ Ready to generate JCC' : '⏳ Pre-conditions not yet met'}
                    </h3>
                    <ul className="mt-3 space-y-2">
                        {checks.map((c) => (
                            <li key={c.label} className="flex items-center gap-2 text-sm">
                                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${c.ok ? 'bg-green-500 text-white' : 'bg-red-100 text-red-600'}`}>
                                    {c.ok ? '✓' : '✗'}
                                </span>
                                <span className={c.ok ? 'text-gray-700' : 'text-gray-500'}>{c.label}</span>
                                {c.detail && <span className="text-xs text-red-500 ml-auto">{c.detail}</span>}
                            </li>
                        ))}
                    </ul>
                    {validation.totalPunchB > 0 && (
                        <p className="mt-3 text-xs text-amber-700">
                            Note: {validation.totalPunchB} open Cat B and {validation.totalPunchC} open Cat C items — these will be recorded in the JCC but do not block issuance.
                        </p>
                    )}
                </div>

                {!readOnly && (
                    <button id="generate-jcc-btn" onClick={() => void generate()} disabled={!allOk || generating}
                        className="px-6 py-3 bg-[#0D2137] text-white text-sm font-semibold rounded-xl hover:bg-[#1a3a5c] disabled:opacity-40 w-full">
                        {generating ? 'Generating…' : '📄 Generate Job Completion Certificate'}
                    </button>
                )}
                {error && <p className="text-sm text-red-600">{error}</p>}
            </div>
        );
    }

    /* ── Certificate Detail ── */
    const signedCount = SIGN_ROLES.filter((r) => certificate[r.atField]).length;

    return (
        <div className="flex flex-col gap-5">
            {/* Header card */}
            <div className="rounded-xl border border-gray-200 p-5 bg-white shadow-sm">
                <div className="flex items-start justify-between">
                    <div>
                        <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Job Completion Certificate</p>
                        <h2 className="text-xl font-bold text-gray-900 mt-1">{certificate.certificate_number}</h2>
                        <p className="text-xs text-gray-400 mt-0.5">Issued {new Date(certificate.created_at).toLocaleDateString()}</p>
                    </div>
                    <div className="text-right">
                        <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${signedCount === SIGN_ROLES.length ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                            {signedCount === SIGN_ROLES.length ? '✅ Fully Signed' : `${signedCount}/${SIGN_ROLES.length} Signed`}
                        </div>
                        <div className="mt-2 flex gap-3 text-xs text-gray-500 justify-end">
                            <span>{certificate.activities_completed ?? 0} activities</span>
                            <span>{certificate.open_punch_cat_b} Cat B</span>
                            <span>{certificate.open_punch_cat_c} Cat C</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Narrative fields */}
            <div className="rounded-xl border border-gray-200 p-5 bg-white">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-gray-700">Narrative Summary</h3>
                    {!readOnly && !editMode && (
                        <button onClick={() => setEditMode(true)} className="text-xs text-[#0D2137] hover:underline">✏ Edit</button>
                    )}
                </div>
                {editMode ? (
                    <div className="flex flex-col gap-3">
                        {[
                            ['Scope Summary', 'scope_summary'],
                            ['Pressure Tests Status', 'pressure_tests_status'],
                            ['Materials Summary', 'materials_summary'],
                            ['Lessons Learnt', 'lessons_learnt_summary'],
                            ['Client Name', 'client_name'],
                        ].map(([label, key]) => (
                            <label key={key} className="flex flex-col gap-1">
                                <span className="text-xs font-medium text-gray-500">{label}</span>
                                <textarea value={formData[key as keyof typeof formData]} rows={2}
                                    onChange={(e) => setFormData({ ...formData, [key]: e.target.value })}
                                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#0D2137] resize-none" />
                            </label>
                        ))}
                        <div className="flex gap-3">
                            <button onClick={() => setEditMode(false)} className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg">Cancel</button>
                            <button onClick={() => void saveNarrative()} disabled={saving}
                                className="flex-1 px-4 py-2 bg-[#0D2137] text-white text-sm rounded-lg disabled:opacity-50">
                                {saving ? 'Saving…' : 'Save'}
                            </button>
                        </div>
                    </div>
                ) : (
                    <dl className="grid grid-cols-1 gap-3">
                        {[
                            ['Scope Summary', certificate.scope_summary],
                            ['Pressure Tests', certificate.pressure_tests_status],
                            ['Materials', certificate.materials_summary],
                            ['Lessons Learnt', certificate.lessons_learnt_summary],
                            ['Client', certificate.client_name],
                        ].map(([label, val]) => val ? (
                            <div key={label as string}>
                                <dt className="text-xs font-medium text-gray-400">{label as string}</dt>
                                <dd className="text-sm text-gray-800 mt-0.5">{val as string}</dd>
                            </div>
                        ) : null)}
                        {!certificate.scope_summary && !certificate.client_name && (
                            <p className="text-sm text-gray-400 italic">No narrative entered yet</p>
                        )}
                    </dl>
                )}
            </div>

            {/* Multi-party sign-off */}
            <div className="rounded-xl border border-gray-200 p-5 bg-white">
                <h3 className="text-sm font-semibold text-gray-700 mb-4">Sign-off</h3>
                <div className="flex flex-col gap-3">
                    {SIGN_ROLES.map((role) => {
                        const signed = Boolean(certificate[role.atField]);
                        return (
                            <div key={role.key} className={`flex items-center justify-between p-3 rounded-lg border ${signed ? 'bg-green-50 border-green-200' : 'border-gray-200'}`}>
                                <div>
                                    <p className="text-sm font-medium text-gray-800">{role.label}</p>
                                    {signed && <p className="text-xs text-gray-400 mt-0.5">Signed {new Date(certificate[role.atField]!).toLocaleString()}</p>}
                                </div>
                                {!readOnly && !signed && (
                                    <button
                                        id={`jcc-sign-${role.key}`}
                                        onClick={() => void signRole(role.key)}
                                        disabled={signing === role.key}
                                        className="px-3 py-1.5 bg-[#0D2137] text-white text-xs font-medium rounded-lg hover:bg-[#1a3a5c] disabled:opacity-50"
                                    >
                                        {signing === role.key ? '…' : '✍ Sign'}
                                    </button>
                                )}
                                {signed && <span className="text-green-600 text-sm font-medium">✓ Signed</span>}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
