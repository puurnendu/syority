'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface HistogramSeries {
    disciplineCode: string;
    disciplineName: string;
    color: string;
    values: number[];
}

interface HistogramData {
    dates: string[];
    series: HistogramSeries[];
}

interface ResourceHistogramProps {
    eventId?: string;
}

const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function formatDateLabel(dateStr: string): { day: string; date: string; isWeekend: boolean; isMonthStart: boolean } {
    const d = new Date(dateStr + 'T00:00:00');
    const dow = d.getDay();
    return {
        day: DAY_LABELS[dow],
        date: d.getDate().toString(),
        isWeekend: dow === 0 || dow === 6,
        isMonthStart: d.getDate() === 1,
    };
}

function formatMonthHeader(dateStr: string): string {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
}

export function ResourceHistogram({ eventId }: ResourceHistogramProps) {
    const [data, setData] = useState<HistogramData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
    const [tooltip, setTooltip] = useState<{ x: number; y: number } | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Date range window — last 7 days to next 90 days
    const [startDate] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() - 7);
        return d.toISOString().slice(0, 10);
    });
    const [endDate] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() + 90);
        return d.toISOString().slice(0, 10);
    });

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams({ startDate, endDate });
            if (eventId) params.set('eventId', eventId);
            const res = await fetch(`/api/schedule/resource-histogram?${params}`);
            if (!res.ok) throw new Error('Failed to load resource data');
            const json = await res.json();
            setData(json);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }, [startDate, endDate, eventId]);

    useEffect(() => { fetchData(); }, [fetchData]);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
                <span className="animate-pulse">Loading resource histogram…</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                <span>⚠</span><span>{error}</span>
                <button onClick={fetchData} className="ml-auto text-xs text-red-500 hover:underline">Retry</button>
            </div>
        );
    }

    if (!data || data.dates.length === 0) {
        return (
            <div className="flex items-center justify-center h-40 text-gray-400 text-sm">
                No activities with dates found in the next 90 days.
            </div>
        );
    }

    const { dates, series } = data;

    // Calculate stacked totals per day
    const totals = dates.map((_, i) => series.reduce((sum, s) => sum + s.values[i], 0));
    const maxTotal = Math.max(...totals, 1);

    // Bar dimensions
    const BAR_WIDTH = 28;
    const MAX_BAR_HEIGHT = 120;
    const PADDING_X = 48;

    // Today index
    const todayStr = new Date().toISOString().slice(0, 10);
    const todayIdx = dates.indexOf(todayStr);

    // Group dates by month for header
    const monthGroups: { label: string; startIdx: number; count: number }[] = [];
    dates.forEach((d, i) => {
        const label = formatMonthHeader(d);
        const last = monthGroups[monthGroups.length - 1];
        if (last && last.label === label) {
            last.count++;
        } else {
            monthGroups.push({ label, startIdx: i, count: 1 });
        }
    });

    const totalWidth = dates.length * BAR_WIDTH + PADDING_X * 2;

    return (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                <div>
                    <h3 className="text-sm font-semibold text-gray-900">Resource Histogram</h3>
                    <p className="text-xs text-gray-400 mt-0.5">
                        Daily headcount by discipline — next 90 days
                    </p>
                </div>
                <button
                    onClick={fetchData}
                    className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1 rounded hover:bg-gray-100"
                >
                    ↻ Refresh
                </button>
            </div>

            {/* Legend */}
            {series.length > 0 && (
                <div className="px-4 py-2 flex items-center gap-3 flex-wrap border-b border-gray-100 bg-gray-50">
                    {series.map(s => (
                        <span key={s.disciplineCode} className="flex items-center gap-1.5 text-xs text-gray-600">
                            <span
                                className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                                style={{ backgroundColor: s.color || '#6B7280' }}
                            />
                            {s.disciplineCode}
                            {s.disciplineName !== s.disciplineCode && (
                                <span className="text-gray-400">({s.disciplineName})</span>
                            )}
                        </span>
                    ))}
                    <span className="ml-auto text-xs text-gray-400">
                        Peak: <strong className="text-gray-700">{maxTotal}</strong> people/day
                    </span>
                </div>
            )}

            {/* Chart area */}
            <div
                ref={containerRef}
                className="overflow-x-auto"
                style={{ maxHeight: '260px' }}
            >
                <div style={{ width: totalWidth, minWidth: '100%', position: 'relative' }}>
                    {/* SVG chart */}
                    <svg
                        width={totalWidth}
                        height={MAX_BAR_HEIGHT + 48}
                        style={{ display: 'block' }}
                    >
                        {/* Y-axis grid lines */}
                        {[0.25, 0.5, 0.75, 1].map(pct => {
                            const y = MAX_BAR_HEIGHT - pct * MAX_BAR_HEIGHT + 4;
                            const val = Math.round(pct * maxTotal);
                            return (
                                <g key={pct}>
                                    <line
                                        x1={PADDING_X} y1={y} x2={totalWidth - 4} y2={y}
                                        stroke="#e5e7eb" strokeWidth={1} strokeDasharray="3,3"
                                    />
                                    <text
                                        x={PADDING_X - 4} y={y + 4}
                                        textAnchor="end" fontSize={9} fill="#9ca3af"
                                    >
                                        {val}
                                    </text>
                                </g>
                            );
                        })}

                        {/* Month separator lines + labels */}
                        {monthGroups.map((mg, mi) => {
                            const x = PADDING_X + mg.startIdx * BAR_WIDTH;
                            return (
                                <g key={mi}>
                                    {mi > 0 && (
                                        <line
                                            x1={x} y1={0} x2={x} y2={MAX_BAR_HEIGHT + 20}
                                            stroke="#d1d5db" strokeWidth={1}
                                        />
                                    )}
                                    <text
                                        x={x + (mg.count * BAR_WIDTH) / 2}
                                        y={MAX_BAR_HEIGHT + 40}
                                        textAnchor="middle"
                                        fontSize={9}
                                        fill="#6b7280"
                                        fontWeight="600"
                                    >
                                        {mg.label}
                                    </text>
                                </g>
                            );
                        })}

                        {/* Today line */}
                        {todayIdx >= 0 && (
                            <line
                                x1={PADDING_X + todayIdx * BAR_WIDTH + BAR_WIDTH / 2}
                                y1={0}
                                x2={PADDING_X + todayIdx * BAR_WIDTH + BAR_WIDTH / 2}
                                y2={MAX_BAR_HEIGHT + 20}
                                stroke="#3b82f6"
                                strokeWidth={1.5}
                                strokeDasharray="4,3"
                            />
                        )}

                        {/* Bars */}
                        {dates.map((dateStr, i) => {
                            const x = PADDING_X + i * BAR_WIDTH;
                            const { day, date, isWeekend } = formatDateLabel(dateStr);
                            const total = totals[i];
                            const isHovered = hoveredIdx === i;

                            let stackY = MAX_BAR_HEIGHT + 4;
                            return (
                                <g
                                    key={dateStr}
                                    onMouseEnter={(e) => {
                                        setHoveredIdx(i);
                                        setTooltip({ x: e.clientX, y: e.clientY });
                                    }}
                                    onMouseLeave={() => { setHoveredIdx(null); setTooltip(null); }}
                                    style={{ cursor: 'pointer' }}
                                >
                                    {/* Hover background */}
                                    {isHovered && (
                                        <rect
                                            x={x} y={0}
                                            width={BAR_WIDTH}
                                            height={MAX_BAR_HEIGHT + 20}
                                            fill="#f0f9ff"
                                        />
                                    )}

                                    {/* Weekend shade */}
                                    {isWeekend && (
                                        <rect
                                            x={x} y={0}
                                            width={BAR_WIDTH}
                                            height={MAX_BAR_HEIGHT + 20}
                                            fill="rgba(0,0,0,0.025)"
                                        />
                                    )}

                                    {/* Stacked segments */}
                                    {series.map(s => {
                                        const val = s.values[i];
                                        if (val === 0) return null;
                                        const barH = Math.max(2, (val / maxTotal) * MAX_BAR_HEIGHT);
                                        stackY -= barH;
                                        return (
                                            <rect
                                                key={s.disciplineCode}
                                                x={x + 2}
                                                y={stackY}
                                                width={BAR_WIDTH - 4}
                                                height={barH}
                                                fill={s.color || '#6B7280'}
                                                rx={total > 0 && stackY === MAX_BAR_HEIGHT + 4 - barH ? 0 : 2}
                                                opacity={isHovered ? 1 : 0.85}
                                            />
                                        );
                                    })}

                                    {/* Day label */}
                                    <text
                                        x={x + BAR_WIDTH / 2}
                                        y={MAX_BAR_HEIGHT + 14}
                                        textAnchor="middle"
                                        fontSize={8}
                                        fill={isWeekend ? '#9ca3af' : '#6b7280'}
                                        fontWeight={dateStr === todayStr ? '700' : '400'}
                                    >
                                        {date}
                                    </text>
                                    <text
                                        x={x + BAR_WIDTH / 2}
                                        y={MAX_BAR_HEIGHT + 24}
                                        textAnchor="middle"
                                        fontSize={7}
                                        fill={isWeekend ? '#d1d5db' : '#9ca3af'}
                                    >
                                        {day}
                                    </text>

                                    {/* Total label on bar if high enough */}
                                    {total > 0 && (total / maxTotal) * MAX_BAR_HEIGHT > 16 && (
                                        <text
                                            x={x + BAR_WIDTH / 2}
                                            y={stackY + 10}
                                            textAnchor="middle"
                                            fontSize={8}
                                            fill="white"
                                            fontWeight="600"
                                        >
                                            {total}
                                        </text>
                                    )}
                                </g>
                            );
                        })}
                    </svg>
                </div>
            </div>

            {/* Tooltip */}
            {hoveredIdx !== null && tooltip && data.dates[hoveredIdx] && (
                <div
                    className="fixed z-50 pointer-events-none bg-white border border-gray-200 rounded-xl shadow-xl p-3 text-xs min-w-[160px]"
                    style={{ left: tooltip.x + 12, top: tooltip.y - 10 }}
                >
                    <p className="font-semibold text-gray-800 mb-2">
                        {new Date(data.dates[hoveredIdx] + 'T00:00:00').toLocaleDateString('en-GB', {
                            weekday: 'short', day: '2-digit', month: 'short',
                        })}
                    </p>
                    {series.filter(s => s.values[hoveredIdx] > 0).length === 0 ? (
                        <p className="text-gray-400">No resources scheduled</p>
                    ) : (
                        series
                            .filter(s => s.values[hoveredIdx] > 0)
                            .map(s => (
                                <div key={s.disciplineCode} className="flex items-center gap-2 py-0.5">
                                    <span
                                        className="w-2 h-2 rounded-sm flex-shrink-0"
                                        style={{ backgroundColor: s.color }}
                                    />
                                    <span className="text-gray-600 flex-1">{s.disciplineCode}</span>
                                    <span className="font-bold text-gray-800">{s.values[hoveredIdx]}</span>
                                </div>
                            ))
                    )}
                    <div className="border-t border-gray-100 mt-2 pt-2 flex justify-between">
                        <span className="text-gray-400">Total</span>
                        <span className="font-bold text-gray-900">{totals[hoveredIdx]}</span>
                    </div>
                </div>
            )}

            {/* Zero-state note */}
            {series.length === 0 && (
                <div className="px-4 py-3 text-xs text-gray-400 text-center border-t border-gray-100">
                    Assign resources to activities to see the histogram populate.
                    Set <strong>manpower_count</strong> or add <strong>Activity Resources</strong> per activity.
                </div>
            )}
        </div>
    );
}
