'use client';

import { useState, useEffect, useCallback } from 'react';

type SignOff = {
    id: string;
    party_name: string;
    condition: string;
    signed_by: string | null;
    signed_at: string | null;
    notes: string | null;
};

type Clearance = { id: string; created_at: string; sign_offs: SignOff[] };

function parseWaiver(notes: string | null): { is_waiver: boolean; reason?: string; authoriser?: string; expiry?: string } {
    if (!notes?.startsWith('[WAIVER]')) return { is_waiver: false };
    const parts = notes.replace('[WAIVER] ', '').split(' | ');
    const get = (key: string) => parts.find((p) => p.startsWith(`${key}:`))?.replace(`${key}: `, '');
    return { is_waiver: true, reason: get('reason'), authoriser: get('authoriser'), expiry: get('expiry') };
}

export function ClearanceSignOffPanel({ workpackId, readOnly = false }: { workpackId: string; readOnly?: boolean }) {
    const [clearance, setClearance] = useState<Clearance | null>(null);
    const [loading, setLoading] = useState(true);
    const [initializing, setInitializing] = useState(false);
    const [error, setError] = useState('');

    const [signModal, setSignModal] = useState<{ signOffId: string; partyName: string } | null>(null);
    const [signNotes, setSignNotes] = useState('');
    const [signing, setSigning] = useState(false);

    const [waiverModal, setWaiverModal] = useState<{ signOffId: string; partyName: string } | null>(null);
    const [waiverForm, setWaiverForm] = useState({ reason: '', authoriser_name: '', expiry_date: '' });
    const [waiverSaving, setWaiverSaving] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        const res = await fetch(`/api/workpacks/${workpackId}/clearance-boxup`);
        if (res.ok) setClearance(await res.json());
        setLoading(false);
    }, [workpackId]);

    useEffect(() => { void load(); }, [load]);

    const initClearance = async () => {
        setInitializing(true); setError('');
        try {
            const res = await fetch(`/api/workpacks/${workpackId}/clearance-boxup`, { method: 'POST' });
            if (!res.ok) throw new Error((await res.json()).error ?? 'Failed');
            await load();
        } catch (e) { setError(e instanceof Error ? e.message : 'Failed'); }
        finally { setInitializing(false); }
    };

    const handleSign = async () => {
        if (!signModal) return;
        setSigning(true);
        try {
            await fetch(`/api/workpacks/${workpackId}/clearance-boxup/sign-off/${signModal.signOffId}`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ notes: signNotes.trim() || undefined }),
            });
            setSignModal(null); setSignNotes('');
            await load();
        } finally { setSigning(false); }
    };

    const handleWaiver = async () => {
        if (!waiverModal) return;
        setWaiverSaving(true); setError('');
        try {
            const res = await fetch(`/api/workpacks/${workpackId}/clearance-boxup/sign-off/${waiverModal.signOffId}/waiver`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(waiverForm),
            });
            if (!res.ok) throw new Error((await res.json()).error ?? 'Failed');
            setWaiverModal(null); setWaiverForm({ reason: '', authoriser_name: '', expiry_date: '' });
            await load();
        } catch (e) { setError(e instanceof Error ? e.message : 'Waiver failed'); }
        finally { setWaiverSaving(false); }
    };

    if (loading) return <div className="flex items-center justify-center h-40 text-sm text-gray-400">Loading clearance…</div>;

    if (!clearance) {
        return (
            <div className="flex flex-col items-center justify-center h-56 gap-4">
                <div className="text-5xl">✍️</div>
                <p className="text-gray-500 text-sm text-center max-w-xs">No clearance record initialised for this workpack yet.</p>
                {!readOnly && (
                    <button id="init-clearance-btn" onClick={initClearance} disabled={initializing}
                        className="px-5 py-2.5 bg-[#0D2137] text-white text-sm font-medium rounded-xl hover:bg-[#1a3a5c] disabled:opacity-50">
                        {initializing ? 'Initialising…' : '+ Initialise Clearance'}
                    </button>
                )}
                {error && <p className="text-sm text-red-600">{error}</p>}
            </div>
        );
    }

    const signedCount = clearance.sign_offs.filter((s) => s.signed_at).length;
    const allSigned = clearance.sign_offs.length > 0 && signedCount === clearance.sign_offs.length;

    return (
        <div className="flex flex-col gap-4">
            <div className={`flex items-center gap-3 p-3 rounded-xl border text-sm font-medium ${allSigned ? 'bg-green-50 border-green-200 text-green-700' : 'bg-amber-50 border-amber-200 text-amber-700'}`}>
                <span>{allSigned ? '✅' : '⏳'}</span>
                {allSigned ? 'All parties have signed — clearance complete' : `${signedCount}/${clearance.sign_offs.length} parties signed`}
            </div>

            <div className="flex flex-col gap-2">
                {clearance.sign_offs.map((so) => {
                    const { is_waiver, reason, authoriser } = parseWaiver(so.notes);
                    return (
                        <div key={so.id} className={`rounded-xl border p-4 ${so.signed_at ? (is_waiver ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200') : 'bg-white border-gray-200'}`}>
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex-1">
                                    <p className="font-semibold text-gray-900 text-sm">{so.party_name}</p>
                                    <p className="text-xs text-gray-500 mt-0.5">{so.condition}</p>
                                    {so.signed_at && (
                                        <p className="text-xs mt-1 text-gray-400">
                                            {is_waiver ? `⚠️ Waiver — ${reason ?? ''} (by ${authoriser ?? 'unknown'})` : `✓ Signed`} · {new Date(so.signed_at).toLocaleString()}
                                        </p>
                                    )}
                                </div>
                                {!readOnly && !so.signed_at && (
                                    <div className="flex gap-2 shrink-0">
                                        <button id={`sign-off-btn-${so.id}`} onClick={() => setSignModal({ signOffId: so.id, partyName: so.party_name })}
                                            className="px-3 py-1.5 bg-[#0D2137] text-white text-xs font-medium rounded-lg hover:bg-[#1a3a5c]">
                                            ✍ Sign Off
                                        </button>
                                        <button id={`waiver-btn-${so.id}`} onClick={() => setWaiverModal({ signOffId: so.id, partyName: so.party_name })}
                                            className="px-3 py-1.5 bg-amber-500 text-white text-xs font-medium rounded-lg hover:bg-amber-600">
                                            ⚠ Waiver
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Sign modal */}
            {signModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/40" onClick={() => setSignModal(null)} />
                    <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 flex flex-col gap-4">
                        <h4 className="text-lg font-semibold text-gray-900">Sign Off — {signModal.partyName}</h4>
                        <label className="flex flex-col gap-1">
                            <span className="text-xs font-medium text-gray-500">Notes (optional)</span>
                            <textarea value={signNotes} onChange={(e) => setSignNotes(e.target.value)} rows={3}
                                className="px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#0D2137] resize-none" />
                        </label>
                        <div className="flex gap-3">
                            <button onClick={() => setSignModal(null)} className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg">Cancel</button>
                            <button onClick={() => void handleSign()} disabled={signing}
                                className="flex-1 px-4 py-2 bg-[#0D2137] text-white text-sm rounded-lg hover:bg-[#1a3a5c] disabled:opacity-50">
                                {signing ? 'Signing…' : '✍ Confirm Sign Off'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Waiver modal */}
            {waiverModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/40" onClick={() => setWaiverModal(null)} />
                    <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 flex flex-col gap-4">
                        <h4 className="text-lg font-semibold text-gray-900">Grant Waiver — {waiverModal.partyName}</h4>
                        <p className="text-xs text-amber-600">A waiver bypasses the sign-off requirement. This will be fully logged for audit.</p>
                        {[['Reason *', 'reason', 'Why is the sign-off being waived?'], ['Authoriser Name *', 'authoriser_name', 'Name of approving authority']].map(([l, f, p]) => (
                            <label key={f} className="flex flex-col gap-1">
                                <span className="text-xs font-medium text-gray-500">{l}</span>
                                <input value={waiverForm[f as keyof typeof waiverForm]} onChange={(e) => setWaiverForm({ ...waiverForm, [f]: e.target.value })}
                                    placeholder={p} className="px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-amber-500" />
                            </label>
                        ))}
                        <label className="flex flex-col gap-1">
                            <span className="text-xs font-medium text-gray-500">Waiver Expiry Date</span>
                            <input type="date" value={waiverForm.expiry_date} onChange={(e) => setWaiverForm({ ...waiverForm, expiry_date: e.target.value })}
                                className="px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-amber-500" />
                        </label>
                        {error && <p className="text-sm text-red-600">{error}</p>}
                        <div className="flex gap-3">
                            <button onClick={() => setWaiverModal(null)} className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg">Cancel</button>
                            <button onClick={() => void handleWaiver()} disabled={waiverSaving || !waiverForm.reason || !waiverForm.authoriser_name}
                                className="flex-1 px-4 py-2 bg-amber-500 text-white text-sm rounded-lg hover:bg-amber-600 disabled:opacity-50">
                                {waiverSaving ? 'Saving…' : '⚠ Grant Waiver'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
