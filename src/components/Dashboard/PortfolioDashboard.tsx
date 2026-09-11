'use client';

import { useState, useEffect } from 'react';
import { SystemProgressGrid } from './SystemProgressGrid';
import { SCurveChart } from '@/components/Schedule/SCurveChart';
import ConstraintHeatmap from './ConstraintHeatmap';
import type { SystemProgressItem } from './SystemProgressCard';

type Stats = {
    summary: {
        total_workpacks: number;
        avg_progress: number;
        overdue: number;
        starting_this_week: number;
        open_constraints: number;
        pending_certs: number;
        recent_lessons: number;
        systems_active: number;
        systems_planned: number;
        materials_total?: number;
        materials_not_requested?: number;
        joints_total?: number;
        blinds_total?: number;
        workpacks_draft?: number;
        workpacks_no_activities?: number;
        spi?: number;
        cpi?: number;
    };
    activities_by_status: Record<string, number>;
    constraints_by_severity: Record<string, number>;
    workpacks_by_status: Record<string, number>;
    overdue_workpacks: Array<{
        id: string;
        workpack_id_code: string | null;
        title: string;
        planned_end_date: string;
        overall_progress: number | null;
        days_overdue: number;
    }>;
};

function StatCard({
    label,
    value,
    sub,
    colour,
    href,
}: {
    label: string;
    value: string | number;
    sub?: string;
    colour?: string;
    href?: string;
}) {
    const inner = (
        <div
            className={`bg-white border border-gray-200 rounded-2xl px-5 py-4 hover:shadow-sm transition-shadow ${href ? 'cursor-pointer' : ''}`}
        >
            <p className={`text-3xl font-bold ${colour ?? 'text-gray-900'}`}>{value}</p>
            <p className="text-sm text-gray-600 mt-1">{label}</p>
            {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
        </div>
    );
    return href ? <a href={href}>{inner}</a> : inner;
}

function MiniBar({
    label,
    value,
    max,
    colour,
}: {
    label: string;
    value: number;
    max: number;
    colour: string;
}) {
    const pct = max > 0 ? (value / max) * 100 : 0;
    return (
        <div className="flex items-center gap-3">
            <span className="w-24 text-xs text-gray-500 text-right flex-none truncate">
                {label}
            </span>
            <div className="flex-1 bg-gray-100 rounded-full h-2">
                <div className={`h-2 rounded-full ${colour}`} style={{ width: `${pct}%` }} />
            </div>
            <span className="w-8 text-xs font-medium text-gray-700 flex-none">{value}</span>
        </div>
    );
}

export function PortfolioDashboard() {
    const [stats, setStats] = useState<Stats | null>(null);
    const [systemProgress, setSystemProgress] = useState<SystemProgressItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [period, setPeriod] = useState('30');
    const [eventId, setEventId] = useState<string>('');
    const [error, setError] = useState<string | null>(null);

    const load = async () => {
        try {
            setLoading(true);
            setError(null);
            
            const statsParams = new URLSearchParams({ period });
            if (eventId) statsParams.set('event_id', eventId);
            
            const progressParams = new URLSearchParams();
            if (eventId) progressParams.set('event_id', eventId);

            const [statsRes, progressRes] = await Promise.all([
                fetch(`/api/dashboard/portfolio-stats?${statsParams.toString()}`),
                fetch(`/api/dashboard/system-progress?${progressParams.toString()}`)
            ]);

            if (!statsRes.ok) throw new Error(`Stats API failed: ${statsRes.status}`);
            if (!progressRes.ok) throw new Error(`Progress API failed: ${progressRes.status}`);

            const s = await statsRes.json();
            const p = await progressRes.json();
            
            setStats(s);
            setSystemProgress(p.data ?? []);
        } catch (err: any) {
            console.error('Failed to load dashboard data:', err);
            setError(err.message || 'An unexpected error occurred');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void load();
    }, [period, eventId]);

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-red-500 gap-4">
                <div className="text-sm font-medium">Error loading dashboard</div>
                <div className="text-xs text-gray-500">{error}</div>
                <button 
                    onClick={() => void load()}
                    className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md text-xs transition-colors"
                >
                    Retry
                </button>
            </div>
        );
    }

    if (loading || !stats)
        return (
            <div className="flex items-center justify-center py-20 text-gray-400 text-sm gap-2">
                <div className="w-5 h-5 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
                Loading portfolio data...
            </div>
        );

    const s = stats.summary;
    const actMax = Math.max(1, ...Object.values(stats.activities_by_status));
    const sevMax = Math.max(1, ...Object.values(stats.constraints_by_severity));

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-3">
                <h2 className="text-lg font-bold text-gray-900">Portfolio Overview</h2>
                <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">Activity window:</span>
                    {[
                        { v: '7', l: '7 days' },
                        { v: '30', l: '30 days' },
                        { v: '90', l: '90 days' },
                    ].map((p) => (
                        <button
                            key={p.v}
                            onClick={() => setPeriod(p.v)}
                            className={`text-xs px-3 py-1.5 rounded-xl font-medium transition-colors ${
                                period === p.v ? 'bg-[#0D2137] text-white' : 'border border-gray-300 text-gray-600'
                            }`}
                        >
                            {p.l}
                        </button>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                <StatCard label="Total Workpacks" value={s.total_workpacks} href="/workpacks" />
                <StatCard
                    label="Avg Progress"
                    value={`${s.avg_progress}%`}
                    colour={
                        s.avg_progress >= 75
                            ? 'text-green-600'
                            : s.avg_progress >= 40
                              ? 'text-blue-600'
                              : 'text-gray-900'
                    }
                />
                <StatCard
                    label="Overdue"
                    value={s.overdue}
                    colour={s.overdue > 0 ? 'text-red-600' : 'text-green-600'}
                    href="/workpacks"
                />
                <StatCard
                    label="Starting This Week"
                    value={s.starting_this_week}
                    colour="text-blue-600"
                    href="/workpacks"
                />
                <StatCard
                    label="Open Constraints"
                    value={s.open_constraints}
                    sub="Critical + High"
                    colour={s.open_constraints > 0 ? 'text-red-600' : 'text-green-600'}
                    href="/constraints"
                />
                <StatCard
                    label="Materials"
                    value={s.materials_total ?? 0}
                    sub={s.materials_not_requested != null && s.materials_not_requested > 0 ? `${s.materials_not_requested} not requested` : undefined}
                    colour="text-indigo-600"
                    href="/workpacks"
                />
                <StatCard
                    label="Joints"
                    value={s.joints_total ?? 0}
                    colour="text-slate-600"
                    href="/planning/joints"
                />
                <StatCard
                    label="Blinds Count"
                    value={s.blinds_total ?? 0}
                    colour="text-orange-600"
                    href="/planning/blinds"
                />
                <StatCard
                    label="Systems Active"
                    value={s.systems_active}
                    sub="In Planning"
                    colour="text-blue-600"
                    href="/planning/systems"
                />
                <StatCard
                    label="Systems Planned"
                    value={s.systems_planned}
                    sub="100% planning"
                    colour="text-green-600"
                    href="/planning/systems"
                />
                <StatCard
                    label="Pending Certs"
                    value={s.pending_certs}
                    colour={s.pending_certs > 0 ? 'text-amber-600' : 'text-green-600'}
                />
                <StatCard
                    label="New Lessons"
                    value={s.recent_lessons}
                    sub={`Last ${period} days`}
                    colour="text-blue-600"
                    href="/lessons"
                />
                {(s.workpacks_draft ?? 0) > 0 && (
                    <StatCard
                        label="Draft Workpacks"
                        value={s.workpacks_draft ?? 0}
                        colour="text-amber-600"
                        href="/workpacks"
                    />
                )}
                {(s.workpacks_no_activities ?? 0) > 0 && (
                    <StatCard
                        label="No Activities"
                        value={s.workpacks_no_activities ?? 0}
                        sub="Needs schedule"
                        colour="text-orange-600"
                        href="/workpacks"
                    />
                )}
                {eventId && (
                    <>
                        <StatCard 
                            label="SPI (Schedule)" 
                            value={s.spi ?? '—'} 
                            sub="Schedule Performance"
                            colour={(s.spi ?? 1) < 0.9 ? 'text-red-600' : (s.spi ?? 1) < 1.0 ? 'text-amber-600' : 'text-green-600'}
                        />
                        <StatCard 
                            label="CPI (Cost/HR)" 
                            value={s.cpi ?? '—'} 
                            sub="Cost Performance"
                            colour={(s.cpi ?? 1) < 0.9 ? 'text-red-600' : (s.cpi ?? 1) < 1.0 ? 'text-amber-600' : 'text-green-600'}
                        />
                    </>
                )}
            </div>

            {eventId && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="md:col-span-2">
                        <SCurveChart eventId={eventId} />
                    </div>
                    <div>
                        <ConstraintHeatmap />
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white border border-gray-200 rounded-2xl p-5">
                    <h3 className="text-sm font-semibold text-gray-900 mb-4">Workpacks by Status</h3>
                    <div className="space-y-3">
                        {Object.entries(stats.workpacks_by_status)
                            .sort((a, b) => b[1] - a[1])
                            .map(([status, count]) => (
                                <MiniBar
                                    key={status}
                                    label={status.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                                    value={count}
                                    max={s.total_workpacks}
                                    colour={
                                        status === 'closed' || status === 'issued'
                                            ? 'bg-green-500'
                                            : status === 'approved' || status === 'under_review'
                                              ? 'bg-blue-500'
                                              : status === 'draft'
                                                ? 'bg-amber-500'
                                                : 'bg-gray-400'
                                    }
                                />
                            ))}
                    </div>
                </div>

                <div className="bg-white border border-gray-200 rounded-2xl p-5">
                    <h3 className="text-sm font-semibold text-gray-900 mb-4">Activities by Status</h3>
                    <div className="space-y-3">
                        {Object.entries(stats.activities_by_status)
                            .sort((a, b) => b[1] - a[1])
                            .map(([status, count]) => (
                                <MiniBar
                                    key={status}
                                    label={status.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                                    value={count}
                                    max={actMax}
                                    colour={
                                        status === 'completed'
                                            ? 'bg-green-500'
                                            : status === 'in_progress'
                                              ? 'bg-blue-500'
                                              : status === 'on_hold'
                                                ? 'bg-amber-500'
                                                : 'bg-gray-300'
                                    }
                                />
                            ))}
                    </div>
                </div>

                <div className="bg-white border border-gray-200 rounded-2xl p-5">
                    <h3 className="text-sm font-semibold text-gray-900 mb-4">Open Constraints by Severity</h3>
                    {Object.keys(stats.constraints_by_severity).length === 0 ? (
                        <div className="text-center py-8">
                            <p className="text-2xl mb-1">✅</p>
                            <p className="text-sm text-green-600 font-medium">No open constraints</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {(['critical', 'high', 'medium', 'low'] as const).map((sev) => {
                                const count = stats.constraints_by_severity[sev] ?? 0;
                                if (count === 0) return null;
                                return (
                                    <MiniBar
                                        key={sev}
                                        label={sev.charAt(0).toUpperCase() + sev.slice(1)}
                                        value={count}
                                        max={sevMax}
                                        colour={
                                            sev === 'critical'
                                                ? 'bg-red-600'
                                                : sev === 'high'
                                                  ? 'bg-orange-500'
                                                  : sev === 'medium'
                                                    ? 'bg-yellow-400'
                                                    : 'bg-gray-400'
                                        }
                                    />
                                );
                            })}
                        </div>
                    )}
                    {s.open_constraints > 0 && (
                        <a
                            href="/constraints"
                            className="block mt-4 text-xs text-center text-blue-600 hover:underline"
                        >
                            View all in register →
                        </a>
                    )}
                </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-2xl p-5">
                <SystemProgressGrid items={systemProgress} />
            </div>

            {stats.overdue_workpacks.length > 0 && (
                <div className="bg-white border border-red-200 rounded-2xl overflow-hidden">
                    <div className="flex items-center justify-between px-5 py-3 border-b border-red-100 bg-red-50">
                        <h3 className="text-sm font-semibold text-red-800">
                            ⚠️ Overdue Workpacks ({stats.overdue_workpacks.length})
                        </h3>
                        <a href="/workpacks" className="text-xs text-red-600 hover:underline">
                            View all →
                        </a>
                    </div>
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-gray-50 border-b">
                                {['ID', 'Title', 'Planned End', 'Days Overdue', 'Progress'].map((h) => (
                                    <th
                                        key={h}
                                        className="text-left px-4 py-2 text-xs font-medium text-gray-500"
                                    >
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {stats.overdue_workpacks.map((w) => (
                                <tr key={w.id} className="hover:bg-red-50/30">
                                    <td className="px-4 py-2.5">
                                        <a
                                            href={`/workpacks/${w.id}`}
                                            className="font-mono text-xs text-blue-600 hover:underline"
                                        >
                                            {w.workpack_id_code ?? '—'}
                                        </a>
                                    </td>
                                    <td className="px-4 py-2.5 font-medium text-gray-900 max-w-xs truncate">
                                        {w.title}
                                    </td>
                                    <td className="px-4 py-2.5 text-xs text-red-600 whitespace-nowrap">
                                        {new Date(w.planned_end_date).toLocaleDateString('en-GB')}
                                    </td>
                                    <td className="px-4 py-2.5">
                                        <span className="text-xs font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded-full">
                                            +{w.days_overdue}d
                                        </span>
                                    </td>
                                    <td className="px-4 py-2.5">
                                        <div className="flex items-center gap-2">
                                            <div className="w-20 bg-gray-100 rounded-full h-1.5">
                                                <div
                                                    className="h-1.5 rounded-full bg-blue-500"
                                                    style={{
                                                        width: `${Math.min(100, w.overall_progress ?? 0)}%`,
                                                    }}
                                                />
                                            </div>
                                            <span className="text-xs text-gray-500">
                                                {Math.round(w.overall_progress ?? 0)}%
                                            </span>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
