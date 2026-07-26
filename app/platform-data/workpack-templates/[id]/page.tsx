'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';

export default function TemplateDetailPage() {
    const router = useRouter();
    const { id } = useParams();
    const [template, setTemplate] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (id) {
            fetch(`/api/admin/templates/${id}`)
                .then(r => r.json())
                .then(d => {
                    setTemplate(d);
                    setLoading(false);
                })
                .catch(() => setLoading(false));
        }
    }, [id]);

    if (loading) return <div className="p-10 animate-pulse space-y-4">
        <div className="h-20 bg-gray-100 rounded-2xl w-full" />
        <div className="h-64 bg-gray-50 rounded-2xl w-full" />
    </div>;

    if (!template) return <div className="p-10 text-center">Template not found.</div>;

    return (
        <div className="p-6 space-y-6 max-w-7xl mx-auto">
            <div className="flex items-center gap-4 mb-2">
                <button onClick={() => router.back()} className="p-2 hover:bg-gray-100 rounded-xl transition-all">← Back</button>
                <nav className="text-sm text-gray-500 flex items-center gap-2">
                    <span>Admin</span> / <span>Templates</span> / <span className="text-gray-900 font-bold">{template.name}</span>
                </nav>
            </div>

            <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-xl shadow-gray-200/50">
                <div className="flex justify-between items-start mb-8">
                    <div>
                        <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">{template.name}</h1>
                        <p className="text-base text-gray-500 mt-2 max-w-2xl">{template.description || 'Standard project structure and activities.'}</p>
                    </div>
                    <div className="flex gap-3">
                        <button className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-bold rounded-xl hover:bg-gray-200 transition-all">Edit Header</button>
                        <button className="px-4 py-2 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/30">Apply to Workpack</button>
                    </div>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 p-4 bg-gray-50/50 rounded-2xl border border-gray-100 mb-8">
                    <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Equipment Type</p>
                        <p className="text-sm font-bold text-gray-800">{template.equipment_type || 'General'}</p>
                    </div>
                    <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Job Type</p>
                        <p className="text-sm font-bold text-gray-800">{template.job_type || 'Standard'}</p>
                    </div>
                    <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Discipline</p>
                        <p className="text-sm font-bold text-gray-800">{template.discipline?.name || 'Multi-discipline'}</p>
                    </div>
                    <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Created At</p>
                        <p className="text-sm font-bold text-gray-800">{new Date(template.created_at).toLocaleDateString()}</p>
                    </div>
                </div>

                <div className="pt-6 border-t border-gray-100">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                            Template Activities
                            <span className="bg-blue-100 text-blue-600 px-2 py-0.5 rounded-lg text-xs">{template.activities?.length || 0}</span>
                        </h2>
                        <button className="px-3 py-1.5 bg-gray-900 text-white text-xs font-bold rounded-lg hover:bg-black transition-all">
                            + Add Activity
                        </button>
                    </div>

                    <div className="overflow-hidden border border-gray-100 rounded-2xl shadow-sm">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50">
                                <tr className="text-[11px] text-gray-400 font-bold uppercase tracking-widest">
                                    <th className="px-4 py-3 text-left w-12 text-center">#</th>
                                    <th className="px-4 py-3 text-left">Activity / Code</th>
                                    <th className="px-4 py-3 text-left">Category</th>
                                    <th className="px-4 py-3 text-center">Hrs</th>
                                    <th className="px-4 py-3 text-center">HP</th>
                                    <th className="px-4 py-3 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {template.activities?.map((a: any) => (
                                    <tr key={a.id} className="hover:bg-gray-50 transition-colors group">
                                        <td className="px-4 py-4 text-center text-gray-400 font-mono text-xs">{a.sequence_number}</td>
                                        <td className="px-4 py-4">
                                            <p className="font-bold text-gray-800">{a.description}</p>
                                            <p className="text-xs text-gray-400 font-mono mt-0.5">{a.activity_number || 'No Code'}</p>
                                        </td>
                                        <td className="px-4 py-4 text-gray-500 text-xs font-medium uppercase">{a.work_category || '—'}</td>
                                        <td className="px-4 py-4 text-center font-bold text-gray-700">{a.duration_hours}h</td>
                                        <td className="px-4 py-4 text-center">
                                            {a.hold_point_type ? (
                                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${a.hold_point_type === 'H' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'}`}>
                                                    {a.hold_point_type}
                                                </span>
                                            ) : '—'}
                                        </td>
                                        <td className="px-4 py-4 text-right">
                                            <button className="text-gray-300 hover:text-red-600 transition-colors">🗑️</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
