'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ChecklistPasteModal, type ChecklistItemInput } from './ChecklistPasteModal';

interface Props {
    workpack: any;
}

export function DroppingBoxupPanel({ workpack }: Props) {
    const router = useRouter();
    const [checklist, setChecklist] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [showPasteModal, setShowPasteModal] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetch(`/api/workpacks/${workpack.id}/checklists/dropping`)
            .then(async (r) => {
                const ct = r.headers.get('content-type');
                if (ct?.includes('application/json')) {
                    const text = await r.text();
                    return text ? JSON.parse(text) : null;
                }
                return null;
            })
            .then((d) => {
                setChecklist(d ?? null);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, [workpack.id]);

    const handleCreate = async () => {
        setSaving(true);
        try {
            const res = await fetch(`/api/workpacks/${workpack.id}/checklists/dropping`, {
                method: 'POST'
            });
            let data: any = null;
            const contentType = res.headers.get('content-type');
            if (contentType?.includes('application/json')) {
                try {
                    const text = await res.text();
                    data = text ? JSON.parse(text) : null;
                } catch (e) {
                    console.error('[DroppingBoxupPanel] Failed to parse response JSON:', e);
                    if (!res.ok) throw new Error(`Server error ${res.status}`);
                }
            } else if (!res.ok) {
                const text = await res.text().catch(() => '');
                throw new Error(`Server error ${res.status}: ${text || 'No details'}`);
            }
            if (data?.error) throw new Error(data.error);
            if (data) setChecklist(data);
        } catch (err: unknown) {
            console.error('[DroppingBoxupPanel] Create failed:', err);
            setError(err instanceof Error ? err.message : 'Failed to create checklist');
        } finally {
            setSaving(false);
        }
    };

    const refetchChecklist = () => {
        fetch(`/api/workpacks/${workpack.id}/checklists/dropping`)
            .then(async (r) => (r.headers.get('content-type')?.includes('application/json') ? r.json() : null))
            .then((d) => setChecklist(d ?? null));
    };

    const handlePasteImport = async (items: ChecklistItemInput[]) => {
        if (!checklist?.id || items.length === 0) return;
        setSaving(true);
        try {
            const existingCount = (checklist.items ?? []).length;
            const res = await fetch(`/api/workpacks/${workpack.id}/checklists/dropping/items`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    items: items.map((item, i) => ({
                        description: item.description,
                        responsible_party: item.responsible_party ?? '',
                        sequence_number: existingCount + i + 1,
                    })),
                }),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || 'Failed to add items');
            }
            const data = await res.json();
            if (data) setChecklist(data);
            else refetchChecklist();
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to import items');
        } finally {
            setSaving(false);
        }
    };

    const handleSignOff = async (role: string) => {
        setSaving(true);
        try {
            await fetch(`/api/workpacks/${workpack.id}/checklists/dropping/sign-off`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ role })
            });
            refetchChecklist();
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="p-8 animate-pulse space-y-4">
        <div className="h-12 bg-gray-100 rounded-xl w-1/3" />
        <div className="h-64 bg-gray-50 rounded-2xl w-full" />
    </div>;

    if (!checklist) {
        return (
            <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-dashed border-gray-200">
                {error && (
                    <div className="mb-4 flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 w-full max-w-md">
                        <span>⚠</span><span>{error}</span><button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600">✕</button>
                    </div>
                )}
                <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center text-3xl mb-4">📦</div>
                <h3 className="text-lg font-bold text-gray-900">No Dropping/Boxup Checklist</h3>
                <p className="text-sm text-gray-500 mt-1 mb-6 text-center max-w-xs">Initialize the industrial checklist for this workpack to begin sign-offs.</p>
                <button
                    onClick={handleCreate}
                    disabled={saving}
                    className="px-6 py-2.5 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20 active:scale-95 disabled:opacity-50"
                >
                    {saving ? 'Initializing…' : 'Create Checklist'}
                </button>
            </div>
        );
    }

    const roles = [
        { id: 'supervisor', label: 'Supervisor', icon: '👷' },
        { id: 'qa_qc', label: 'QA/QC Inspector', icon: '🔍' },
        { id: 'client', label: 'Client / Owner', icon: '🤝' },
    ];

    return (
        <div className="space-y-6">
            {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                    <span>⚠</span><span>{error}</span><button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600">✕</button>
                </div>
            )}
            <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-xl shadow-gray-200/50">
                <div className="flex justify-between items-start mb-8">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <button
                                type="button"
                                onClick={() => setShowPasteModal(true)}
                                className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 border border-gray-200 rounded-lg hover:bg-gray-200"
                            >
                                📋 Paste from Excel/Word
                            </button>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-blue-600 border border-blue-100 italic">V5 Mechanical Protocol</span>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${(checklist as any).status === 'completed' ? 'bg-green-50 text-green-600' : 'bg-amber-50 text-amber-600'}`}>
                                {(checklist as any).status ?? 'draft'}
                            </span>
                        </div>
                        <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight">Dropping & Boxup Checklist</h2>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    {roles.map(role => {
                        const signOff = (checklist as any).sign_offs?.find((s: any) => s.role === role.id);
                        return (
                            <div key={role.id} className={`p-6 rounded-2xl border transition-all ${signOff ? 'bg-green-50/50 border-green-100' : 'bg-gray-50/50 border-gray-100'}`}>
                                <div className="flex items-center gap-3 mb-4">
                                    <span className="text-xl">{role.icon}</span>
                                    <span className="text-sm font-bold text-gray-900">{role.label}</span>
                                </div>
                                {signOff ? (
                                    <div className="space-y-1">
                                        <p className="text-xs font-bold text-green-700 flex items-center gap-1.5">
                                            <span className="w-4 h-4 rounded-full bg-green-500 text-white flex items-center justify-center text-[8px]">✓</span>
                                            Digitally Signed
                                        </p>
                                        <p className="text-sm font-medium text-gray-900">{signOff.user.name}</p>
                                        <p className="text-[10px] text-gray-400 font-mono italic">{new Date(signOff.signed_at).toLocaleString()}</p>
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => handleSignOff(role.id)}
                                        disabled={saving}
                                        className="w-full py-2 bg-white border border-gray-200 text-gray-700 text-xs font-bold rounded-xl hover:border-blue-400 hover:text-blue-600 transition-all shadow-sm"
                                    >
                                        Sign Off
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>

                <div className="pt-8 border-t border-gray-50">
                    <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-6">Checklist Items</h3>
                    <div className="space-y-4">
                        {((checklist.items?.length
                            ? checklist.items
                            : [
                                "Verify flange face cleanliness and condition",
                                "Confirm gasket type and orientation per specification",
                                "Validate bolt lubrication and threading",
                                "Final inspection of internal cleanliness (Clean-out)",
                                "Ensure no tools or foreign objects remain inside"
                            ].map((desc, idx) => ({ id: `static-${idx}`, description: desc, responsible_party: null }))
                        ) as any[]).map((item: any, idx: number) => (
                            <div key={item.id ?? idx} className="flex items-center gap-4 p-4 bg-gray-50/30 rounded-2xl border border-gray-50 hover:bg-white transition-all group">
                                <div className="w-6 h-6 rounded-lg border-2 border-gray-200 flex items-center justify-center text-white font-bold group-hover:border-blue-500 transition-all">✓</div>
                                <span className="text-sm text-gray-700 font-medium">{typeof item === 'string' ? item : item.description}</span>
                                {item.responsible_party && (
                                    <span className="text-xs text-gray-500">— {item.responsible_party}</span>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {showPasteModal && (
                <ChecklistPasteModal
                    onImport={handlePasteImport}
                    onClose={() => setShowPasteModal(false)}
                />
            )}
        </div>
    );
}
