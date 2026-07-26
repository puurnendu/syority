'use client';

import { useMemo, useState } from 'react';

type Activity = {
    id: string;
    activity_code: string | null;
    description: string | null;
    discipline: string | null;
    planned_start: string | null;
    planned_end: string | null;
    progress_percent: number | null;
    status: string | null;
    duration_hours: number | null;
    is_critical: boolean | null;
};

const STATUS_COLOUR: Record<string, string> = {
    completed: 'bg-green-500',
    complete: 'bg-green-500',
    in_progress: 'bg-blue-500',
    on_hold: 'bg-amber-400',
    not_started: 'bg-gray-300',
    cancelled: 'bg-gray-400',
};

export function GanttChart({
    activities,
    workpackStart,
    workpackEnd,
}: {
    activities: Activity[];
    workpackStart: string | null;
    workpackEnd: string | null;
}) {
    const [zoom, setZoom] = useState<'week' | 'month' | 'quarter'>('month');

    const { minDate, maxDate, totalDays } = useMemo(() => {
        const dates = activities
            .flatMap((a) => [a.planned_start, a.planned_end])
            .filter(Boolean)
            .map((d) => new Date(d!).getTime());

        if (workpackStart) dates.push(new Date(workpackStart).getTime());
        if (workpackEnd) dates.push(new Date(workpackEnd).getTime());
        if (dates.length === 0) {
            const now = Date.now();
            return {
                minDate: now,
                maxDate: now + 30 * 86_400_000,
                totalDays: 30,
            };
        }
        const min = Math.min(...dates);
        const max = Math.max(...dates);
        const totalDays = Math.max(7, Math.ceil((max - min) / 86_400_000) + 2);
        return { minDate: min, maxDate: max, totalDays };
    }, [activities, workpackStart, workpackEnd]);

    const PX_PER_DAY: Record<string, number> = {
        week: 28,
        month: 14,
        quarter: 7,
    };
    const ppd = PX_PER_DAY[zoom];

    const headerCols = useMemo(() => {
        const cols: Array<{ label: string; start: number; width: number }> = [];

        if (zoom === 'week') {
            for (let i = 0; i <= totalDays; i++) {
                const d = new Date(minDate + i * 86_400_000);
                cols.push({
                    label: d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' }),
                    start: i * ppd,
                    width: ppd,
                });
            }
        } else if (zoom === 'month') {
            for (let i = 0; i <= totalDays; i += 7) {
                const d = new Date(minDate + i * 86_400_000);
                cols.push({
                    label: d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
                    start: i * ppd,
                    width: 7 * ppd,
                });
            }
        } else {
            let d = new Date(minDate);
            d.setDate(1);
            while (d.getTime() <= maxDate + 31 * 86_400_000) {
                const start = Math.max(0, (d.getTime() - minDate) / 86_400_000);
                const nextMonth = new Date(d);
                nextMonth.setMonth(nextMonth.getMonth() + 1);
                const days = Math.ceil((nextMonth.getTime() - d.getTime()) / 86_400_000);
                cols.push({
                    label: d.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }),
                    start: start * ppd,
                    width: days * ppd,
                });
                d = nextMonth;
            }
        }
        return cols;
    }, [zoom, totalDays, minDate, maxDate, ppd]);

    const todayOffset = ((Date.now() - minDate) / 86_400_000) * ppd;

    function barStyle(act: Activity): { left: number; width: number } | null {
        if (!act.planned_start) return null;
        const start = new Date(act.planned_start).getTime();
        const end = act.planned_end
            ? new Date(act.planned_end).getTime()
            : start + 8 * 3_600_000;
        const left = ((start - minDate) / 86_400_000) * ppd;
        const width = Math.max(ppd, ((end - start) / 86_400_000) * ppd);
        return { left, width };
    }

    const LABEL_W = 220;

    return (
        <div className="space-y-3">
            <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">Zoom:</span>
                {(['week', 'month', 'quarter'] as const).map((z) => (
                    <button
                        key={z}
                        type="button"
                        onClick={() => setZoom(z)}
                        className={`text-xs px-3 py-1 rounded-lg font-medium capitalize transition-colors ${
                            zoom === z ? 'bg-[#0D2137] text-white' : 'border border-gray-300 text-gray-600'
                        }`}
                    >
                        {z}
                    </button>
                ))}
                <button
                    type="button"
                    onClick={async () => {
                        const projectId = (activities[0] as any)?.workpack?.project_id;
                        if (!projectId) return alert('Cannot find project ID');
                        const res = await fetch(`/api/projects/${projectId}/schedule`, { method: 'POST' });
                        if (res.ok) {
                            alert('CPM Calculation complete! Please refresh to see changes.');
                            window.location.reload();
                        }
                    }}
                    className="ml-2 text-xs px-3 py-1 rounded-lg font-medium bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 transition-colors"
                >
                    Calculate Critical Path
                </button>
                <span className="ml-auto text-xs text-gray-400">{activities.length} activities</span>
            </div>

            <div className="border border-gray-200 rounded-2xl overflow-hidden bg-white">
                <div className="flex">
                    <div className="flex-none" style={{ width: LABEL_W }}>
                        <div className="h-9 border-b border-r border-gray-200 bg-gray-50" />
                        {activities.map((act, idx) => (
                            <div
                                key={act.id}
                                className={`h-10 flex items-center px-3 border-b border-r border-gray-100 text-xs text-gray-700 gap-2 ${
                                    idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'
                                } ${act.is_critical ? 'border-l-4 border-l-red-500 bg-red-50/30' : ''}`}
                            >
                                {act.activity_code && (
                                    <span className="font-mono text-gray-400 flex-none">
                                        {act.activity_code}
                                    </span>
                                )}
                                <span className="truncate">
                                    {act.description ?? `Activity ${idx + 1}`}
                                </span>
                                {act.is_critical && (
                                    <span className="inline-flex items-center text-[10px] font-bold text-red-600 bg-red-50 border border-red-200 rounded-full px-1.5 py-0.5 ml-1 flex-shrink-0">
                                        🔴 Critical
                                    </span>
                                )}
                            </div>
                        ))}
                    </div>

                    <div className="flex-1 overflow-x-auto">
                        <div style={{ width: totalDays * ppd + ppd, position: 'relative' }}>
                            <div className="h-9 border-b border-gray-200 bg-gray-50 flex items-end relative">
                                {headerCols.map((col, i) => (
                                    <div
                                        key={i}
                                        className="absolute bottom-0 text-xs text-gray-400 border-r border-gray-200 truncate px-1 pb-1"
                                        style={{ left: col.start, width: col.width }}
                                    >
                                        {col.label}
                                    </div>
                                ))}
                                {todayOffset >= 0 && todayOffset <= totalDays * ppd && (
                                    <div
                                        className="absolute top-0 bottom-0 w-px bg-red-400 z-10"
                                        style={{ left: todayOffset }}
                                    />
                                )}
                            </div>

                            {activities.map((act, idx) => {
                                const bar = barStyle(act);
                                const pct = act.progress_percent ?? 0;
                                const baseColour = act.is_critical ? 'bg-red-500' : (STATUS_COLOUR[act.status ?? ''] ?? 'bg-gray-300');
                                const colour = baseColour;

                                return (
                                    <div
                                        key={act.id}
                                        className={`h-10 relative border-b border-gray-100 ${
                                            idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'
                                        }`}
                                    >
                                        {todayOffset >= 0 && todayOffset <= totalDays * ppd && (
                                            <div
                                                className="absolute top-0 bottom-0 w-px bg-red-200 z-0"
                                                style={{ left: todayOffset }}
                                            />
                                        )}

                                        {bar && (
                                            <div
                                                className={`absolute top-2 h-6 rounded-full z-10 flex items-center overflow-hidden shadow-sm ring-1 ${
                                                    act.is_critical ? 'ring-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]' : 'ring-black/10'
                                                }`}
                                                style={{
                                                    left: bar.left,
                                                    width: bar.width,
                                                    backgroundColor: act.is_critical ? '#ef4444' : undefined,
                                                }}
                                                title={`${act.description}\n${pct}% complete${act.is_critical ? ' [CRITICAL]' : ''}`}
                                            >
                                                <div
                                                    className={`absolute inset-0 ${colour} opacity-30`}
                                                />
                                                <div
                                                    className={`absolute left-0 top-0 bottom-0 ${colour} opacity-80`}
                                                    style={{ width: `${pct}%` }}
                                                />
                                                {bar.width > 40 && (
                                                    <span className="relative z-10 text-xs text-white font-medium px-2 truncate drop-shadow">
                                                        {pct > 0 ? `${pct}%` : ''}
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-4 px-4 py-2 border-t border-gray-100 bg-gray-50 flex-wrap">
                    {[
                        { colour: 'bg-green-500', label: 'Complete' },
                        { colour: 'bg-blue-500', label: 'In Progress' },
                        { colour: 'bg-amber-400', label: 'On Hold' },
                        { colour: 'bg-gray-300', label: 'Not Started' },
                        { colour: 'ring-2 ring-red-500 bg-white', label: 'Critical Path' },
                    ].map((l) => (
                        <span
                            key={l.label}
                            className="flex items-center gap-1.5 text-xs text-gray-500"
                        >
                            <span className={`w-3 h-3 rounded-full ${l.colour}`} />
                            {l.label}
                        </span>
                    ))}
                    <span className="flex items-center gap-1.5 text-xs text-gray-400 ml-auto">
                        <span className="w-px h-3 bg-red-400" />
                        Today
                    </span>
                </div>
            </div>
        </div>
    );
}
