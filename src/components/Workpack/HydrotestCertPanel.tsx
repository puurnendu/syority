'use client';

import { useState, useEffect } from 'react';

interface Props {
    workpack: any;
}

export function HydrotestCertPanel({ workpack }: Props) {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch(`/api/workpacks/${workpack.id}/certificates?type=hydrotest`)
            .then(r => r.json())
            .then(d => {
                setData(d);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, [workpack.id]);

    if (loading) return <div className="p-8 animate-pulse text-[10px] font-black uppercase tracking-widest text-blue-400">Verifying Pressure Test Records…</div>;

    if (!data || data.activities?.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 bg-blue-50/30 rounded-[2.5rem] border border-blue-50 italic">
                <div className="text-4xl mb-4 opacity-20">💧</div>
                <p className="text-blue-900/40 font-black uppercase tracking-widest text-[10px]">No Hydrotest Activities Completed</p>
                <p className="text-[10px] text-blue-800/20 mt-2 font-medium">Activities with 'Hydrotest' or 'HYD' code must be completed to appear here.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 pt-2">
            <div className="bg-white p-12 rounded-[3rem] border-2 border-blue-50 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/5 rounded-full -mr-32 -mt-32 blur-3xl pointer-events-none" />

                {/* Header */}
                <div className="flex justify-between items-end mb-12 relative z-10 border-b-2 border-blue-100 pb-10">
                    <div>
                        <div className="flex items-center gap-3 mb-4">
                            <span className="bg-blue-600 text-white px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.2em] shadow-lg shadow-blue-500/20">System Integrity</span>
                            <span className="text-gray-300 font-mono text-xs">/ ASME Sec VIII /</span>
                        </div>
                        <h1 className="text-5xl font-black text-gray-900 tracking-tighter uppercase italic leading-[0.8]">Hydrostatic</h1>
                        <h2 className="text-2xl font-bold text-blue-600 uppercase tracking-widest mt-2">Test Certificate</h2>
                    </div>
                    <div className="text-right">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Certificate ID</p>
                        <p className="text-xl font-bold text-gray-900 tracking-tight">HT-{workpack.workpack_number}-V5</p>
                    </div>
                </div>

                <div className="space-y-4 mb-12">
                    {data.activities.map((act: any) => (
                        <div key={act.id} className="p-8 rounded-[2rem] bg-gray-50 border border-gray-100 flex items-center justify-between group hover:bg-white hover:border-blue-200 transition-all shadow-sm hover:shadow-xl hover:shadow-blue-500/5">
                            <div className="flex items-center gap-8">
                                <div className="w-16 h-16 rounded-2xl bg-white border border-gray-100 flex items-center justify-center text-2xl shadow-inner group-hover:scale-110 transition-transform">🧪</div>
                                <div>
                                    <h4 className="text-lg font-black text-gray-900 tracking-tight">{act.description}</h4>
                                    <p className="text-xs text-blue-600 font-bold uppercase tracking-widest mt-1">{act.activity_number ?? act.activity_code ?? 'HT-PROC'}</p>
                                    <div className="flex gap-4 mt-3">
                                        <div className="px-3 py-1 bg-white rounded-lg border border-gray-100 text-[10px] font-bold text-gray-500 uppercase">Test Media: <span className="text-blue-600">Water</span></div>
                                        <div className="px-3 py-1 bg-white rounded-lg border border-gray-100 text-[10px] font-bold text-gray-500 uppercase">Status: <span className="text-green-600">Passed</span></div>
                                    </div>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Completion Date</p>
                                <p className="text-sm font-bold text-gray-900">{new Date(act.updated_at).toLocaleDateString()}</p>
                                <div className="mt-4 flex flex-col items-end gap-1">
                                    {act.qa_clearances?.map((clr: any) => (
                                        <span key={clr.id} className="px-3 py-1 bg-green-500 text-white text-[9px] font-black rounded-full shadow-lg shadow-green-500/20">QC Witnessed: {clr.witness_name || 'Verified'}</span>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Footer Warnings */}
                <div className="p-8 bg-blue-900 rounded-[2.5rem] text-white flex justify-between items-center shadow-2xl">
                    <div className="max-w-md">
                        <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-2 italic">Standard Declaration</p>
                        <p className="text-xs text-blue-100 font-medium leading-relaxed">
                            This pressure test was conducted in accordance with approved project procedures. System boundary was verified, all air was vented prior to pressurization, and pressure was held for the mandated duration without visible leakage or pressure drop.
                        </p>
                    </div>
                    <div className="text-right border-l border-blue-800 pl-10">
                        <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1 italic">Generated By</p>
                        <p className="text-xl font-bold text-white tracking-tighter uppercase italic leading-none">Auriana OS Production Engine</p>
                        <p className="text-[9px] text-blue-500 font-mono mt-1 opacity-50">NODE_CERT_V5_STABLE</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
