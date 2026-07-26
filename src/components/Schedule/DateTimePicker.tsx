'use client';

import React, { useState, useEffect, useRef } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DateTimePickerProps {
    value: string;                         // ISO string (controlled)
    onChange: (iso: string) => void;       // fires on every day click / time change
    onCommit: () => void;                  // fires when user clicks Select
    onCancel: () => void;
    anchorRect: DOMRect;
    siteTimezone?: string;                 // IANA timezone or 'local' (default: local)
}

/** Decompose a Date into site-timezone components (shared with ScheduleContainer) */
function getPartsInTz(d: Date, tz: string) {
    const res = (!tz || tz === 'local') ? Intl.DateTimeFormat().resolvedOptions().timeZone : tz;
    try {
        const p = new Intl.DateTimeFormat('en-US', {
            timeZone: res,
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', hour12: false,
        }).formatToParts(d).reduce((acc, x) => ({ ...acc, [x.type]: x.value }), {} as Record<string, string>);
        return {
            year:   parseInt(p.year,   10),
            month:  parseInt(p.month,  10) - 1,
            day:    parseInt(p.day,    10),
            hour:   parseInt(p.hour === '24' ? '0' : p.hour, 10),
            minute: parseInt(p.minute, 10),
        };
    } catch {
        return {
            year: d.getUTCFullYear(), month: d.getUTCMonth(), day: d.getUTCDate(),
            hour: d.getUTCHours(),    minute: d.getUTCMinutes(),
        };
    }
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
];
const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function parseValue(v: string): Date {
    if (!v) return new Date();
    const d = new Date(v);
    return isNaN(d.getTime()) ? new Date() : d;
}

function toTimeInput(d: Date) {
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// ─── Controlled DateTimePicker ────────────────────────────────────────────────
// Does NOT manage its own date value — the parent controls it via `value` + `onChange`.
// Internal state is only for calendar navigation (which month to show).

export default function DateTimePicker({
    value,
    onChange,
    onCommit,
    onCancel,
    anchorRect,
    siteTimezone = 'local',
}: DateTimePickerProps) {
    const ref     = useRef<HTMLDivElement>(null);
    const current = parseValue(value);
    const currParts = getPartsInTz(current, siteTimezone);

    // Navigation state — which month/year to show in the calendar
    const [viewYear,  setViewYear]  = useState(currParts.year);
    const [viewMonth, setViewMonth] = useState(currParts.month);

    // Keep calendar view in sync when value changes externally (e.g. typed in cell)
    useEffect(() => {
        const d  = parseValue(value);
        const p  = getPartsInTz(d, siteTimezone);
        setViewYear(p.year);
        setViewMonth(p.month);
    }, [value, siteTimezone]);

    // ── Calendar grid ─────────────────────────────────────────────────
    const firstDayOfMonth = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth     = new Date(viewYear, viewMonth + 1, 0).getDate();
    const calCells: (number | null)[] = [
        ...Array(firstDayOfMonth).fill(null),
        ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
    ];

    // ── Navigation ────────────────────────────────────────────────────
    function prevMonth() {
        if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
        else setViewMonth(m => m - 1);
    }
    function nextMonth() {
        if (viewMonth === 11) { setViewMonth(0);  setViewYear(y => y + 1); }
        else setViewMonth(m => m + 1);
    }

    // ── Day click → update the controlled value ───────────────────────
    function selectDay(day: number) {
        // Store as "YYYY-MM-DDT00:00:00.000Z" (UTC midnight for this calendar date).
        // @db.Date only stores the date portion, so the time component is irrelevant.
        const iso = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}T00:00:00.000Z`;
        onChange(iso);
    }

    // ── Time change → update controlled value ─────────────────────────
    function onTimeChange(e: React.ChangeEvent<HTMLInputElement>) {
        const [h, m] = e.target.value.split(':').map(Number);
        const d = new Date(current);
        d.setHours(isNaN(h) ? 0 : h);
        d.setMinutes(isNaN(m) ? 0 : m);
        onChange(d.toISOString());
    }

    // ── Cell helpers ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
    const todayParts = getPartsInTz(new Date(), siteTimezone);
    const isSel   = (d: number) => currParts.year === viewYear && currParts.month === viewMonth && currParts.day === d;
    const isToday = (d: number) => todayParts.year === viewYear && todayParts.month === viewMonth && todayParts.day === d;
    // Time input: show current site system time when value is midnight-UTC (date-only stored)
    const isMidnightUTC = current.getUTCHours() === 0 && current.getUTCMinutes() === 0;
    const nowParts = getPartsInTz(new Date(), siteTimezone);
    const displayHour   = isMidnightUTC ? nowParts.hour   : currParts.hour;
    const displayMinute = isMidnightUTC ? nowParts.minute : currParts.minute;
    const timeStr = `${String(displayHour).padStart(2, '0')}:${String(displayMinute).padStart(2, '0')}`;

    // ── Click outside → cancel ────────────────────────────────────────
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) onCancel();
        };
        const t = setTimeout(() => document.addEventListener('mousedown', handler), 150);
        return () => { clearTimeout(t); document.removeEventListener('mousedown', handler); };
    }, [onCancel]);

    // ── Escape key ────────────────────────────────────────────────────
    useEffect(() => {
        const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
        document.addEventListener('keydown', h);
        return () => document.removeEventListener('keydown', h);
    }, [onCancel]);

    // ── Smart positioning ─────────────────────────────────────────────
    const W = 256, H = 358;
    let top  = anchorRect.bottom + 2;
    let left = anchorRect.left;
    if (top + H > window.innerHeight - 8)  top  = anchorRect.top - H - 2;
    if (left + W > window.innerWidth  - 8) left = window.innerWidth - W - 8;
    left = Math.max(4, left);

    // ──────────────────────────────────────────────────────────────────

    return (
        <div
            ref={ref}
            style={{ position: 'fixed', top, left, width: W, zIndex: 9999 }}
            className="bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden"
            onMouseDown={e => e.stopPropagation()}
        >
            {/* Month navigation header */}
            <div className="flex items-center justify-between px-3 py-2.5 bg-[#1e3a5f]">
                <button onClick={prevMonth} className="p-1 text-white/50 hover:text-white hover:bg-white/10 rounded-lg transition">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7"/>
                    </svg>
                </button>
                <span className="text-[13px] font-bold text-white tracking-tight">
                    {MONTH_NAMES[viewMonth]} {viewYear}
                </span>
                <button onClick={nextMonth} className="p-1 text-white/50 hover:text-white hover:bg-white/10 rounded-lg transition">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7"/>
                    </svg>
                </button>
            </div>

            {/* Day-of-week headers */}
            <div className="grid grid-cols-7 px-2 pt-2 pb-0.5">
                {DAY_LABELS.map(d => (
                    <div key={d} className="text-center text-[10px] font-bold text-gray-400">{d}</div>
                ))}
            </div>

            {/* Calendar day grid */}
            <div className="grid grid-cols-7 px-2 pb-1.5 gap-y-0.5">
                {calCells.map((day, i) =>
                    day === null ? (
                        <div key={`b${i}`} />
                    ) : (
                        <button
                            key={day}
                            onClick={() => selectDay(day)}
                            className={`w-full aspect-square flex items-center justify-center text-[12px] rounded-full font-medium transition-colors
                                ${isSel(day)
                                    ? 'bg-blue-600 text-white shadow'
                                    : isToday(day)
                                    ? 'border-2 border-blue-500 text-blue-600 font-bold'
                                    : 'text-gray-700 hover:bg-blue-50 hover:text-blue-600'
                                }`}
                        >
                            {day}
                        </button>
                    )
                )}
            </div>

            {/* Time input */}
            <div className="flex items-center gap-2 px-3 py-2 border-t border-gray-100 bg-gray-50/80">
                <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                <span className="text-[10px] font-semibold text-gray-500">Time</span>
                <input
                    type="time"
                    value={timeStr}
                    onChange={onTimeChange}
                    className="flex-1 text-[12px] border border-gray-200 rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-blue-400 font-mono bg-white"
                />
            </div>

            {/* Action buttons */}
            <div className="flex gap-2 px-3 py-2.5 border-t border-gray-100">
                <button
                    onClick={onCommit}
                    className="flex-1 py-1.5 bg-blue-600 text-white text-[12px] font-bold rounded-xl hover:bg-blue-700 transition-colors shadow-sm"
                >
                    Select
                </button>
                <button
                    onClick={onCancel}
                    className="flex-1 py-1.5 bg-gray-100 text-gray-600 text-[12px] font-semibold rounded-xl hover:bg-gray-200 transition-colors"
                >
                    Cancel
                </button>
            </div>
        </div>
    );
}
