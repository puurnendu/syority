'use client';

import { useState, useEffect } from 'react';

interface Props {
    workpack: any;
}

export function FlangeBoxupCertPanel({ workpack }: Props) {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch(`/api/workpacks/${workpack.id}/certificates?type=boxup`)
            .then(r => r.json())
            .then(d => {
                setData(d);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, [workpack.id]);

    if (loading) return <div className="p-8 animate-pulse">Loading Certificate…</div>;

    if (!data || data.joints?.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 bg-gray-50 rounded-3xl border border-gray-100 italic">
                <p className="text-gray-400">No signed-off joints found for this workpack.</p>
                <p className="text-[10px] text-gray-300 mt-2">Joints must be marked as 'Signed Off' to appear in this certificate.</p>
            </div>
        );
    }

    return (
        <div className="space-y-8 print:p-0 print:bg-white pt-2">
            <div className="bg-white p-12 rounded-[2rem] border border-gray-100 shadow-xl print:shadow-none print:border-none">
                {/* Certificate Header */}
                <div className="flex justify-between items-center border-b-4 border-gray-900 pb-8 mb-8">
                    <div>
                        <h1 className="text-4xl font-black text-gray-900 tracking-tighter uppercase italic">Flange Boxup</h1>
                        <h2 className="text-xl font-bold text-gray-400 uppercase tracking-widest mt-1">Compliance Certificate</h2>
                    </div>
                    <div className="text-right">
                        <p className="text-sm font-black text-gray-900">CERT NO: FB-{workpack.workpack_number}</p>
                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1">Ref: {data.generated_at ? new Date(data.generated_at).toLocaleDateString() : 'N/A'}</p>
                    </div>
                </div>

                {/* Workpack Info */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12 bg-gray-50 p-6 rounded-2xl border border-gray-100">
                    <div>
                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Workpack</p>
                        <p className="text-sm font-bold text-gray-900">{workpack.workpack_number}</p>
                    </div>
                    <div>
                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Unit / System</p>
                        <p className="text-sm font-bold text-gray-900">{workpack.unit?.name || 'N/A'} / {workpack.system?.name || 'N/A'}</p>
                    </div>
                    <div>
                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Equipment</p>
                        <p className="text-sm font-bold text-gray-900">{workpack.equipment_number || 'N/A'}</p>
                    </div>
                    <div>
                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Export Status</p>
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-green-50 text-green-600 border border-green-200">Production Verified</span>
                    </div>
                </div>

                {/* Table */}
                <table className="w-full text-left border-collapse mb-12">
                    <thead>
                        <tr className="bg-gray-900 text-white">
                            <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest border border-gray-800">Joint No</th>
                            <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest border border-gray-800">Tag ID</th>
                            <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest border border-gray-800">Spec / Rating</th>
                            <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest border border-gray-800">Assembled By</th>
                            <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest border border-gray-800">Date</th>
                            <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest border border-gray-800 text-center">QC</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {data.joints.map((j: any) => (
                            <tr key={j.id} className="hover:bg-gray-50/50">
                                <td className="px-4 py-4 text-sm font-black text-gray-900 border border-gray-50">{j.joint_number}</td>
                                <td className="px-4 py-4 text-sm font-medium text-gray-600 border border-gray-50">{j.tag_id || 'N/A'}</td>
                                <td className="px-4 py-4 text-xs font-bold text-gray-500 border border-gray-50 uppercase">{j.specification || '--'} / {j.rating || '--'}</td>
                                <td className="px-4 py-4 text-sm font-bold text-gray-900 border border-gray-50">{j.assembler?.name || '---'}</td>
                                <td className="px-4 py-4 text-xs font-mono text-gray-400 border border-gray-50">{j.assembled_at ? new Date(j.assembled_at).toLocaleDateString() : 'N/A'}</td>
                                <td className="px-4 py-4 text-center border border-gray-50">
                                    <span className="text-green-500 font-black">✔</span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                <div className="pt-12 border-t-2 border-dashed border-gray-100 grid grid-cols-2 gap-20">
                    <div className="space-y-4">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Quality Assurance Statement</p>
                        <p className="text-xs text-gray-500 leading-relaxed italic">
                            This is to certify that the above mentioned joints have been inspected and found to be in accordance with the specified requirements and standards. No foreign objects were found during final internal inspection.
                        </p>
                    </div>
                    <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100 flex flex-col justify-between min-h-[120px]">
                        <div>
                            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-4 italic underline decoration-blue-500/30">Auriana OS Digital Signature</p>
                            <p className="text-sm font-black text-gray-900 uppercase tracking-tighter">System Generated Verification</p>
                        </div>
                        <div className="flex justify-between items-end border-t border-gray-200 pt-4 mt-4">
                            <span className="text-[10px] font-mono text-gray-300">ID: {workpack.id.slice(0, 8)}...AUT</span>
                            <span className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">PRODUCTION GRADE</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
