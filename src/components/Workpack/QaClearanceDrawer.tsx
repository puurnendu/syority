'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ActivityMaterialsInline } from './ActivityMaterialsInline';

interface Props {
    open: boolean;
    onClose: () => void;
    activity: any;
    workpackId: string;
}

export function QaClearanceDrawer({ open, onClose, activity, workpackId }: Props) {
    const router = useRouter();
    const [parties, setParties] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (open) {
            fetch('/api/admin/clearance-parties')
                .then(r => r.json())
                .then(d => setParties(d.data || d))
                .catch(() => { });
        }
    }, [open]);

    if (!open || !activity) return null;

    const handleClear = async (partyId: string) => {
        setSaving(true);
        try {
            const res = await fetch(`/api/workpacks/${workpackId}/activities/${activity.id}/clearance`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    party_id: partyId,
                    cleared_at: new Date().toISOString(),
                    notes: 'Cleared via UI'
                })
            });
            if (!res.ok) throw new Error('Failed to clear');
            router.refresh();
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error clearing');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] overflow-hidden">
            <div className="absolute inset-0 bg-black/30 backdrop-blur-sm transition-opacity" onClick={onClose} />
            <div className="absolute inset-y-0 right-0 flex max-w-full pl-10">
                <div className="w-screen max-w-md transform transition-transform duration-500 ease-in-out">
                    <div className="flex h-full flex-col overflow-y-scroll bg-white shadow-2xl">
                        <div className="px-6 py-6 sm:px-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                            <div>
                                <h2 className="text-base font-semibold text-gray-900">QA Clearance</h2>
                                <p className="text-xs text-gray-500 mt-0.5">#{activity.sequence_number} — {activity.description}</p>
                            </div>
                            <button onClick={onClose} className="rounded-full p-2 text-gray-400 hover:text-gray-500 hover:bg-white border border-transparent hover:border-gray-200 transition-all">✕</button>
                        </div>

                        <div className="relative flex-1 px-6 py-6">
                            {error && (
                                <div className="mb-4 flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                                    <span>⚠</span><span>{error}</span><button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600">✕</button>
                                </div>
                            )}
                            {/* Hold Point Info */}
                            <div className="mb-8 p-4 bg-amber-50 rounded-xl border border-amber-100">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="text-amber-600">⚠️</span>
                                    <span className="text-xs font-bold text-amber-900 uppercase tracking-wider">Mandatory Hold Point</span>
                                </div>
                                <p className="text-sm text-amber-800 font-medium">{activity.hold_point_description || 'Clearance from authorized party required before proceeding.'}</p>
                            </div>

                            {/* Status Section */}
                            <div className="mb-8">
                                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Clearance Status</h3>
                                {activity.qa_clearances?.length > 0 ? (
                                    <div className="space-y-3">
                                        {activity.qa_clearances.map((c: any) => (
                                            <div key={c.id} className="p-3 bg-green-50 border border-green-100 rounded-lg flex items-center justify-between">
                                                <div>
                                                    <p className="text-sm font-semibold text-green-900">{c.party?.name || 'Authorized Party'}</p>
                                                    <p className="text-[10px] text-green-600 mt-0.5">Cleared at: {new Date(c.cleared_at).toLocaleString()}</p>
                                                </div>
                                                <span className="text-green-500 italic text-xs">Verified ✓</span>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="p-10 border-2 border-dashed border-gray-100 rounded-xl flex flex-col items-center justify-center text-center">
                                        <span className="text-3xl mb-3 opacity-20">🛡️</span>
                                        <p className="text-sm text-gray-400">Waiting for clearance</p>
                                    </div>
                                )}
                            </div>

                            {/* Action Section */}
                            <div className="mb-4">
                                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Provide Clearance</h3>
                                <div className="space-y-3">
                                    {parties.map((p: any) => {
                                        const isCleared = activity.qa_clearances?.some((c: any) => c.party_id === p.id);
                                        return (
                                            <button
                                                key={p.id}
                                                disabled={saving || isCleared}
                                                onClick={() => handleClear(p.id)}
                                                className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all text-left group
                          ${isCleared
                                                        ? 'bg-gray-50 border-gray-100 text-gray-400 cursor-not-allowed'
                                                        : 'bg-white border-gray-200 hover:border-blue-500 hover:shadow-md active:scale-95 text-gray-700'
                                                    }`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold
                                ${isCleared ? 'bg-gray-200 text-gray-400' : 'bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors'}`}>
                                                        {p.code || p.name[0]}
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-bold">{p.name}</p>
                                                        <p className="text-[10px] text-gray-400">{p.description || 'Full representative'}</p>
                                                    </div>
                                                </div>
                                                {!isCleared && <span className="text-xs text-blue-600 font-medium opacity-0 group-hover:opacity-100 transition-all">Clear Point →</span>}
                                                {isCleared && <span className="text-xs text-green-500 font-medium italic">Already Cleared</span>}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            <ActivityMaterialsInline
                                workpackId={workpackId}
                                activityId={activity.id}
                            />
                        </div>

                        <div className="px-6 py-6 border-t border-gray-100 bg-gray-50">
                            <button
                                onClick={onClose}
                                className="w-full py-2.5 bg-white border border-gray-200 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-50 shadow-sm transition-all"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
