'use client';

import { useState, useEffect } from 'react';

interface Props {
    workpack: any;
}

export function JobCompletionPanel({ workpack }: Props) {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchData();
    }, [workpack.id]);

    const fetchData = async () => {
        const res = await fetch(`/api/workpacks/${workpack.id}/jcc`);
        setData(await res.json());
        setLoading(false);
    };

    const handleGenerate = async () => {
        setSaving(true);
        setError(null);
        try {
            const res = await fetch(`/api/workpacks/${workpack.id}/jcc`, { method: 'POST' });
            const result = await res.json();
            if (result.error) {
                setError(result.error);
            } else {
                fetchData();
            }
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="p-8">Analyzing workpack status…</div>;

    const { certificate, validation } = data;

    if (!certificate) {
        return (
            <div className="space-y-8">
                {error && (
                    <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                        <span>⚠</span><span>{error}</span><button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600">✕</button>
                    </div>
                )}
                <div className="bg-white p-10 rounded-[2.5rem] border border-gray-100 shadow-2xl">
                    <h2 className="text-3xl font-black text-gray-900 tracking-tighter uppercase italic mb-6">Completion Gate Check</h2>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                        <GateItem
                            label="Activities"
                            status={validation.incompleteActivities === 0 ? 'passed' : 'failed'}
                            detail={validation.incompleteActivities === 0 ? 'All tasks finished' : `${validation.incompleteActivities} pending`}
                        />
                        <GateItem
                            label="Cat A Punch"
                            status={validation.openCatA === 0 ? 'passed' : 'failed'}
                            detail={validation.openCatA === 0 ? 'Zero critical items' : `${validation.openCatA} open items`}
                        />
                        <GateItem
                            label="Clearances"
                            status={validation.pendingSignOffs === 0 ? 'passed' : 'failed'}
                            detail={validation.pendingSignOffs === 0 ? 'All parties signed' : `${validation.pendingSignOffs} pending`}
                        />
                    </div>

                    <div className="p-6 bg-gray-50 rounded-2xl border border-gray-100 flex items-center justify-between">
                        <div>
                            <p className="text-sm font-bold text-gray-900">Ready for Transfer?</p>
                            <p className="text-xs text-gray-500 mt-1">Generate the Job Completion Certificate (JCC) to finalize this workpack.</p>
                        </div>
                        <button
                            onClick={handleGenerate}
                            disabled={!validation.isValid || saving}
                            className={`px-8 py-3 rounded-xl text-sm font-black uppercase tracking-widest transition-all shadow-xl ${validation.isValid ? 'bg-gray-900 text-white hover:bg-black shadow-gray-900/20' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
                        >
                            {saving ? 'Generating…' : 'Generate JCC'}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8 pt-2">
            <div className="bg-white p-12 rounded-[3.5rem] border-[6px] border-double border-gray-900 shadow-2xl relative">
                <div className="absolute top-10 right-10 opacity-10 scale-150 grayscale pointer-events-none">🏛️</div>

                <div className="text-center mb-16 border-b-2 border-gray-100 pb-12">
                    <h1 className="text-5xl font-black text-gray-900 tracking-tighter uppercase italic leading-none">Job Completion</h1>
                    <p className="text-sm font-bold text-gray-400 uppercase tracking-[0.4em] mt-4 italic">Mechanical Completion Certificate (MC-A)</p>
                </div>

                <div className="grid grid-cols-2 gap-12 mb-16 px-6">
                    <div className="space-y-6">
                        <CertField label="Certificate Number" value={certificate.certificate_number} />
                        <CertField label="Workpack Ref" value={workpack.workpack_number} />
                        <CertField label="Unit / System" value={`${workpack.unit?.name || 'N/A'} - ${workpack.system?.name || 'N/A'}`} />
                    </div>
                    <div className="space-y-6 text-right">
                        <CertField label="Issue Date" value={new Date(certificate.created_at).toLocaleDateString()} />
                        <CertField label="Punch List Status" value={`Cat B: ${certificate.open_punch_cat_b} / Cat C: ${certificate.open_punch_cat_c}`} />
                        <CertField label="Status" value="PROVISIONALLY ACCEPTED" highlight />
                    </div>
                </div>

                <div className="p-10 bg-gray-50 border-2 border-dashed border-gray-200 rounded-[2.5rem] mb-12">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-6 text-center italic">Digital Endorsement Panel</p>
                    <div className="grid grid-cols-3 gap-8">
                        <SignBox role="Maintenance Engineer" />
                        <SignBox role="Operations Manager" />
                        <SignBox role="QA/QC Authority" />
                    </div>
                </div>

                <p className="text-[10px] text-gray-300 font-mono text-center tracking-widest mt-4 uppercase">Generated by AURIANOA Production v5.0.1 Stable Release</p>
            </div>
        </div>
    );
}

function GateItem({ label, status, detail }: any) {
    const isPassed = status === 'passed';
    return (
        <div className={`p-6 rounded-[2rem] border-2 transition-all ${isPassed ? 'bg-green-50/50 border-green-100 ring-4 ring-green-50/20' : 'bg-red-50/50 border-red-100 ring-4 ring-red-50/20'}`}>
            <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">{label}</span>
                <span className={`w-2 h-2 rounded-full ${isPassed ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
            </div>
            <p className={`text-lg font-black tracking-tight ${isPassed ? 'text-green-700' : 'text-red-700'}`}>{isPassed ? 'PASSED' : 'BLOCKED'}</p>
            <p className="text-xs text-gray-500 font-medium mt-1">{detail}</p>
        </div>
    );
}

function CertField({ label, value, highlight }: any) {
    return (
        <div>
            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1 italic">{label}</p>
            <p className={`text-sm font-black tracking-tighter uppercase ${highlight ? 'text-blue-600' : 'text-gray-900'}`}>{value}</p>
        </div>
    );
}

function SignBox({ role }: any) {
    return (
        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center justify-center min-h-[100px]">
            <p className="text-[8px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4">{role}</p>
            <div className="w-full border-b border-gray-100 mb-2" />
            <p className="text-[9px] font-bold text-gray-300 uppercase tracking-widest italic">Digital Placeholder</p>
        </div>
    );
}
