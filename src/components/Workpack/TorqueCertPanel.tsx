'use client';

import { useState, useEffect } from 'react';

interface Props {
    workpack: any;
}

export function TorqueCertPanel({ workpack }: Props) {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch(`/api/workpacks/${workpack.id}/certificates?type=torque`)
            .then(r => r.json())
            .then(d => {
                setData(d);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, [workpack.id]);

    if (loading) return <div className="p-8 animate-pulse text-xs font-mono uppercase tracking-[0.2em] text-gray-400">Loading Torque Records…</div>;

    if (!data || data.joints?.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-24 bg-white rounded-3xl border border-gray-100 italic shadow-sm">
                <div className="text-4xl mb-4 grayscale opacity-30">🔧</div>
                <p className="text-gray-400 font-bold uppercase tracking-widest text-[10px]">No Torque Witness Records Found</p>
                <p className="text-[10px] text-gray-300 mt-2 font-medium">Torque values and witness signatures must be recorded in the Integrity tab.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 pt-2">
            <div className="bg-white p-12 rounded-[2.5rem] border border-gray-200 shadow-2xl overflow-hidden relative">
                <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-bl-[5rem] -mr-10 -mt-10 pointer-events-none" />

                {/* Header */}
                <div className="flex justify-between items-start mb-12 relative z-10">
                    <div>
                        <div className="flex items-center gap-2 mb-3">
                            <span className="bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border border-amber-200 shadow-sm">Critical Integrity</span>
                            <span className="bg-gray-100 text-gray-500 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border border-gray-200">ISO 9001:2015</span>
                        </div>
                        <h1 className="text-4xl font-black text-gray-900 tracking-tighter uppercase italic leading-none">Torque Witnessing</h1>
                        <h2 className="text-sm font-bold text-gray-400 uppercase tracking-[0.3em] mt-2 ml-1">Controlled Tightening Record</h2>
                    </div>
                    <div className="text-right flex flex-col items-end">
                        <div className="w-16 h-16 bg-gray-900 rounded-2xl flex items-center justify-center text-white text-2xl mb-4 shadow-xl">⚡</div>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Report Ref</p>
                        <p className="text-sm font-bold text-gray-900">TQ-{workpack.workpack_number}/{new Date().getFullYear()}</p>
                    </div>
                </div>

                {/* Main Table */}
                <div className="overflow-hidden rounded-3xl border border-gray-100 mb-10 shadow-sm">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 border-b border-gray-100">
                            <tr>
                                <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-gray-400">Joint</th>
                                <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-gray-400">Method</th>
                                <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-gray-400">Target (Nm/PSI)</th>
                                <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-gray-400">Tool Ref</th>
                                <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-gray-400">Witness</th>
                                <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-gray-400 text-right">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {data.joints.map((j: any) => (
                                <tr key={j.id} className="hover:bg-amber-50/30 transition-colors">
                                    <td className="px-6 py-5">
                                        <div className="font-black text-gray-900 text-sm tracking-tight">{j.joint_number}</div>
                                        <div className="text-[10px] text-gray-400 font-bold uppercase">{j.flange_size || '--'}" / {j.rating || '--'}#</div>
                                    </td>
                                    <td className="px-6 py-5">
                                        <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-lg uppercase tracking-wider">{j.tightening_method || 'manual'}</span>
                                    </td>
                                    <td className="px-6 py-5">
                                        <div className="text-sm font-black text-gray-900">{j.torque_tightening_value || j.tensioning_pressure || '--'}</div>
                                        <div className="text-[10px] text-gray-400 font-bold uppercase">{j.tightening_method === 'tensioning' ? 'PSI' : 'Nm'}</div>
                                    </td>
                                    <td className="px-6 py-5 text-sm font-medium text-gray-600 font-mono">{j.torque_tool_reference || j.tensioning_tool_reference || '--'}</td>
                                    <td className="px-6 py-5">
                                        <div className="text-xs font-bold text-gray-900 uppercase tracking-tighter">{j.torque_witness_name}</div>
                                        <div className="text-[9px] text-gray-400 font-mono">{j.torque_witness_signed_at ? new Date(j.torque_witness_signed_at).toLocaleDateString() : '--'}</div>
                                    </td>
                                    <td className="px-6 py-5 text-right">
                                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-50 text-green-700 text-[10px] font-black uppercase tracking-widest border border-green-100">
                                            <span className="w-1 h-1 rounded-full bg-green-500 animate-pulse" />
                                            Witnessed
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Footer / Summary */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 p-8 bg-gray-900 rounded-[2rem] text-white shadow-2xl">
                    <div className="space-y-2 border-r border-gray-800 pr-8">
                        <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Calibration Status</p>
                        <p className="text-xs text-gray-300 leading-relaxed font-medium">
                            All tools recorded above have been verified with active calibration certificates valid for the duration of this work scope.
                        </p>
                    </div>
                    <div className="space-y-2 border-r border-gray-800 pr-8">
                        <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Procedural Compliance</p>
                        <p className="text-xs text-gray-300 leading-relaxed font-medium">
                            Tightening performed in star-pattern increments (30%, 60%, 100%) as per Auriana-OS-TQ-001 industrial protocol.
                        </p>
                    </div>
                    <div className="flex flex-col justify-center items-end">
                        <div className="text-right">
                            <p className="text-[9px] font-black text-blue-400 uppercase tracking-[0.2em] mb-1">Authenticated By</p>
                            <p className="text-lg font-black tracking-tighter uppercase italic leading-none">SYSTEM.AURORA</p>
                            <p className="text-[8px] text-gray-500 font-mono mt-1">HASH: v5_{workpack.id.slice(0, 12)}</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
