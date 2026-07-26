'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function TemplatesPage() {
    const [templates, setTemplates] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/admin/templates')
            .then((r) => r.json())
            .then((d) => {
                const list = Array.isArray(d) ? d : Array.isArray(d?.data) ? d.data : [];
                setTemplates(list);
                setLoading(false);
            })
            .catch(() => {
                setTemplates([]);
                setLoading(false);
            });
    }, []);

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center bg-white p-6 rounded-2xl border border-gray-100 shadow-sm transition-all hover:shadow-md">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Workpack Templates</h1>
                    <p className="text-sm text-gray-500 mt-1">Standardize your engineering and maintenance workflows with reusable templates.</p>
                </div>
                <button className="px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-all active:scale-95 shadow-lg shadow-blue-500/20">
                    + New Template
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {loading ? (
                    [1, 2, 3].map(i => <div key={i} className="h-48 bg-gray-100 animate-pulse rounded-2xl border border-gray-100 shadow-sm" />)
                ) : templates.length === 0 ? (
                    <div className="col-span-full py-20 text-center bg-gray-50/50 rounded-3xl border-2 border-dashed border-gray-100">
                        <span className="text-5xl mb-4 block opacity-30">📋</span>
                        <p className="text-gray-400 font-medium">No templates found. Create your first engineering template to begin.</p>
                    </div>
                ) : (
                    templates.map((t) => (
                        <Link href={`/admin/templates/${t.id}`} key={t.id} className="group h-full bg-white p-6 rounded-2xl border border-gray-100 shadow-sm transition-all hover:shadow-xl hover:-translate-y-1 hover:border-blue-200">
                            <div className="flex items-start justify-between mb-4">
                                <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-xl font-bold group-hover:bg-blue-600 group-hover:text-white transition-all">
                                    {t.name[0]}
                                </div>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-gray-100 text-gray-500">{t.equipment_type || 'General'}</span>
                            </div>
                            <h3 className="text-base font-bold text-gray-900 mb-2 truncate">{t.name}</h3>
                            <p className="text-sm text-gray-500 line-clamp-2 h-10 mb-4">{t.description || 'No description provided.'}</p>
                            <div className="flex items-center justify-between pt-4 border-t border-gray-50 text-xs font-semibold">
                                <span className="text-blue-600">{t._count.activities} Activities</span>
                                <span className="text-gray-400 group-hover:text-blue-500 transition-colors">Manage →</span>
                            </div>
                        </Link>
                    ))
                )}
            </div>
        </div>
    );
}
