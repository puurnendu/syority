'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

type TemplateRow = {
    id: string;
    name: string;
    description?: string | null;
    equipment_type: string;
    job_type: string;
    library_scope: string;
    lifecycle_status: string;
    revision: number;
    version_label?: string | null;
    category?: string | null;
    knowledge_asset_id?: string | null;
    published_at?: string | null;
    ai_metadata_json?: any;
};

type Stats = {
    byScope: Record<string, number>;
    byStatus: Record<string, number>;
    knowledgeImported: number;
};

type Tab = 'PLATFORM' | 'KNOWLEDGE' | 'TENANT';

export default function PlatformWorkpackTemplatesPage() {
    const [templates, setTemplates] = useState<TemplateRow[]>([]);
    const [stats, setStats] = useState<Stats | null>(null);
    const [tab, setTab] = useState<Tab>('PLATFORM');
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        Promise.all([
            fetch(`/api/planning/templates?library=${tab}&latest=1${search ? `&q=${encodeURIComponent(search)}` : ''}`)
                .then((r) => r.json())
                .then((d) => setTemplates(d.items || d || [])),
            fetch('/api/planning/templates/stats')
                .then((r) => r.json())
                .then(setStats)
                .catch(() => setStats(null)),
        ]).finally(() => setLoading(false));
    }, [tab, search]);

    const tabItems: { key: Tab; label: string; icon: string }[] = [
        { key: 'PLATFORM', label: 'Platform Standards', icon: '🏗️' },
        { key: 'KNOWLEDGE', label: 'Knowledge Queue', icon: '🧠' },
        { key: 'TENANT', label: 'Tenant Libraries', icon: '🏢' },
    ];

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Platform Workpack Templates</h1>
                    <p className="text-sm text-gray-500 mt-1">Enterprise-grade standard library for workpack templates across all tenants.</p>
                </div>
                <Link
                    href="/planning/templates/new"
                    className="px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-all active:scale-95 shadow-lg shadow-blue-500/20"
                >
                    + New Template
                </Link>
            </div>

            {/* Stats Cards */}
            {stats && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <StatCard label="Published" value={stats.byStatus.PUBLISHED || 0} icon="✅" color="emerald" />
                    <StatCard label="Deprecated" value={stats.byStatus.DEPRECATED || 0} icon="🚫" color="amber" />
                    <StatCard label="Knowledge Imported" value={stats.knowledgeImported} icon="🧠" color="purple" />
                    <StatCard label="Total Templates" value={Object.values(stats.byScope).reduce((a, b) => a + b, 0)} icon="📋" color="blue" />
                </div>
            )}

            {/* Tabs */}
            <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
                {tabItems.map((t) => (
                    <button
                        key={t.key}
                        onClick={() => { setTab(t.key); setLoading(true); }}
                        className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                            tab === t.key
                                ? 'bg-white text-gray-900 shadow-sm'
                                : 'text-gray-500 hover:text-gray-700'
                        }`}
                    >
                        {t.icon} {t.label}
                        {stats && <span className="ml-1.5 text-xs opacity-60">({stats.byScope[t.key] || 0})</span>}
                    </button>
                ))}
            </div>

            {/* Search */}
            <div className="relative max-w-md">
                <input
                    type="text"
                    placeholder="Search name, equipment type, description, category..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <span className="absolute left-3 top-2.5 text-gray-400">🔍</span>
            </div>

            {/* Template Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {loading ? (
                    [1, 2, 3].map((i) => (
                        <div key={i} className="h-52 bg-gray-100 animate-pulse rounded-2xl border border-gray-100 shadow-sm" />
                    ))
                ) : templates.length === 0 ? (
                    <div className="col-span-full py-20 text-center bg-gray-50/50 rounded-3xl border-2 border-dashed border-gray-100">
                        <span className="text-5xl mb-4 block opacity-30">📋</span>
                        <p className="text-gray-400 font-medium">No templates found in {tabItems.find((t) => t.key === tab)?.label}.</p>
                    </div>
                ) : (
                    templates.map((t) => (
                        <Link
                            href={`/planning/templates/${t.id}`}
                            key={t.id}
                            className="group h-full bg-white p-6 rounded-2xl border border-gray-100 shadow-sm transition-all hover:shadow-xl hover:-translate-y-1 hover:border-blue-200"
                        >
                            <div className="flex items-start justify-between mb-3">
                                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-lg font-bold group-hover:bg-blue-600 group-hover:text-white transition-all">
                                    {t.name[0]}
                                </div>
                                <div className="flex gap-1.5">
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                        t.lifecycle_status === 'PUBLISHED' ? 'bg-emerald-100 text-emerald-700' :
                                        t.lifecycle_status === 'DEPRECATED' ? 'bg-amber-100 text-amber-700' :
                                        'bg-gray-100 text-gray-500'
                                    }`}>{t.lifecycle_status}</span>
                                    {t.knowledge_asset_id && (
                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-purple-100 text-purple-700">KE</span>
                                    )}
                                </div>
                            </div>
                            <h3 className="text-base font-bold text-gray-900 mb-1 truncate">{t.name}</h3>
                            <p className="text-sm text-gray-500 line-clamp-2 h-10 mb-3">{t.description || 'No description provided.'}</p>
                            <div className="flex flex-wrap gap-2 mb-3">
                                <span className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-gray-50 text-gray-600 border border-gray-100">{t.equipment_type}</span>
                                <span className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-gray-50 text-gray-600 border border-gray-100">{t.job_type}</span>
                                {t.category && (
                                    <span className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-blue-50 text-blue-600 border border-blue-100">{t.category}</span>
                                )}
                            </div>
                            <div className="flex items-center justify-between pt-3 border-t border-gray-50 text-xs font-semibold">
                                <span className="text-gray-400">v{t.version_label || t.revision}</span>
                                <span className="text-gray-400 group-hover:text-blue-500 transition-colors">View →</span>
                            </div>
                        </Link>
                    ))
                )}
            </div>
        </div>
    );
}

function StatCard({ label, value, icon, color }: { label: string; value: number; icon: string; color: string }) {
    const colorMap: Record<string, string> = {
        emerald: 'from-emerald-50 to-emerald-100/50 text-emerald-700',
        amber: 'from-amber-50 to-amber-100/50 text-amber-700',
        purple: 'from-purple-50 to-purple-100/50 text-purple-700',
        blue: 'from-blue-50 to-blue-100/50 text-blue-700',
    };
    return (
        <div className={`bg-gradient-to-br ${colorMap[color] || colorMap.blue} p-5 rounded-2xl border border-gray-100`}>
            <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">{icon}</span>
                <span className="text-xs font-medium opacity-70 uppercase tracking-wider">{label}</span>
            </div>
            <p className="text-3xl font-bold">{value}</p>
        </div>
    );
}
