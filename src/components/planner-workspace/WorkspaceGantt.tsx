'use client';

/**
 * M12 V1 Phase 2 — WorkspaceGantt Component
 *
 * P6-style planned-vs-actual Gantt chart.
 *
 * PRESENTATION LAYER ONLY. This component:
 *   - Reads M11 schedule data (early_start, early_finish) for planned bars
 *   - Reads M12 execution data (actual_start, actual_end, status) for actual bars
 *   - Does NOT calculate CPM, float, or critical path
 *   - Does NOT invoke scheduleEngine or CalendarEngine
 *   - Does NOT modify planned dates or relationships
 *
 * AUTHORITY BOUNDARIES:
 *   - M11 = planned schedule (read-only display)
 *   - M12 = execution facts (read-only display)
 *   - M8.13 = progress (read-only display)
 */

import React, { useState, useMemo, useRef, useCallback } from 'react';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';

type ZoomLevel = 'day' | 'week' | 'month';

const ZOOM_DAY_WIDTH: Record<ZoomLevel, number> = { day: 44, week: 20, month: 8 };
const ROW_HEIGHT = 36;

/** Status → color mapping for actual bars */
const STATUS_COLORS: Record<string, { bg: string; fill: string }> = {
  in_progress: { bg: 'bg-emerald-200', fill: 'bg-gradient-to-r from-emerald-600 to-emerald-400' },
  completed: { bg: 'bg-emerald-300', fill: 'bg-gradient-to-r from-emerald-700 to-emerald-500' },
  on_hold: { bg: 'bg-amber-200', fill: 'bg-gradient-to-r from-amber-600 to-amber-400' },
  not_started: { bg: 'bg-gray-200', fill: 'bg-gray-400' },
};

export function WorkspaceGantt() {
  const {
    activities,
    selectedActivityIds,
    selectActivity,
    isLoading,
    selectedEventName,
  } = useWorkspaceStore();

  const [zoomLevel, setZoomLevel] = useState<ZoomLevel>('day');
  const [showPlanned, setShowPlanned] = useState(true);
  const [showActual, setShowActual] = useState(true);

  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);

  // ── Vertical scroll synchronization ──────────────────────────────────
  const handleLeftScroll = useCallback(() => {
    if (leftRef.current && rightRef.current) {
      rightRef.current.scrollTop = leftRef.current.scrollTop;
    }
  }, []);

  const handleRightScroll = useCallback(() => {
    if (leftRef.current && rightRef.current) {
      leftRef.current.scrollTop = rightRef.current.scrollTop;
    }
  }, []);

  // ── Timeline computation ─────────────────────────────────────────────
  const { minDate, totalDays, dayWidth, timelineDays, todayOffset } = useMemo(() => {
    const dw = ZOOM_DAY_WIDTH[zoomLevel];
    const now = new Date();

    if (activities.length === 0) {
      return { minDate: now, totalDays: 30, dayWidth: dw, timelineDays: [], todayOffset: 0 };
    }

    // Scan all dates to find timeline bounds
    let earliest = Infinity;
    let latest = -Infinity;

    for (const act of activities) {
      for (const d of [act.early_start, act.early_finish, act.planned_start, act.planned_end, act.actual_start, act.actual_end]) {
        if (d) {
          const t = new Date(d).getTime();
          if (t < earliest) earliest = t;
          if (t > latest) latest = t;
        }
      }
    }

    // Include today in the range
    const nowTime = now.getTime();
    if (nowTime < earliest) earliest = nowTime;
    if (nowTime > latest) latest = nowTime;

    // Add padding
    const startDate = new Date(earliest);
    startDate.setDate(startDate.getDate() - 3);
    const endDate = new Date(latest);
    endDate.setDate(endDate.getDate() + 7);

    const diffDays = Math.max(14, Math.ceil((endDate.getTime() - startDate.getTime()) / (86400000)) + 1);

    const days: Date[] = [];
    for (let i = 0; i < diffDays; i++) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      days.push(d);
    }

    const todayOff = (nowTime - startDate.getTime()) / 86400000;

    return { minDate: startDate, totalDays: diffDays, dayWidth: dw, timelineDays: days, todayOffset: todayOff };
  }, [activities, zoomLevel]);

  // ── Helper: date → pixel offset ──────────────────────────────────────
  const dateToOffset = useCallback((dateStr: string | null | undefined): number | null => {
    if (!dateStr) return null;
    const t = new Date(dateStr).getTime();
    const days = (t - minDate.getTime()) / 86400000;
    return days * dayWidth;
  }, [minDate, dayWidth]);

  // ── No data state ────────────────────────────────────────────────────
  if (activities.length === 0 && !isLoading) {
    return (
      <div className="flex items-center justify-center h-full bg-white">
        <div className="text-center p-8">
          <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center text-2xl mx-auto mb-4">📊</div>
          <h3 className="text-lg font-black text-gray-900 mb-1">No Activities to Display</h3>
          <p className="text-sm text-gray-500">Select an event and workpack to view the Gantt chart.</p>
        </div>
      </div>
    );
  }

  const totalTimelineWidth = totalDays * dayWidth;

  return (
    <div className="flex flex-col h-full bg-white overflow-hidden select-none">
      {/* ── Gantt Header Bar ── */}
      <div className="px-4 py-2.5 border-b border-gray-200 bg-gray-50/70 flex items-center justify-between gap-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold uppercase tracking-wider text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
            GANTT
          </span>
          <h2 className="text-sm font-bold text-gray-900">
            {selectedEventName || 'Execution Schedule'}
          </h2>
          <span className="text-xs text-gray-500">
            {activities.length} activities
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Planned / Actual toggles */}
          <button
            onClick={() => setShowPlanned(!showPlanned)}
            className={`px-2.5 py-1 text-xs font-bold rounded-lg border transition-all ${
              showPlanned ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-gray-300 text-gray-400'
            }`}
          >
            ▬ Planned
          </button>
          <button
            onClick={() => setShowActual(!showActual)}
            className={`px-2.5 py-1 text-xs font-bold rounded-lg border transition-all ${
              showActual ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'bg-white border-gray-300 text-gray-400'
            }`}
          >
            ▬ Actual
          </button>

          <div className="w-px h-5 bg-gray-300 mx-1" />

          {/* Zoom controls */}
          <div className="flex items-center bg-white border border-gray-200 rounded-xl p-0.5 shadow-sm text-xs font-bold text-gray-600">
            {(['day', 'week', 'month'] as ZoomLevel[]).map((z) => (
              <button
                key={z}
                onClick={() => setZoomLevel(z)}
                className={`px-3 py-1 rounded-lg transition-all capitalize ${
                  zoomLevel === z ? 'bg-blue-600 text-white' : 'hover:bg-gray-100'
                }`}
              >
                {z}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Split Pane Container ── */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Activity List */}
        <div
          ref={leftRef}
          onScroll={handleLeftScroll}
          className="w-[380px] flex-shrink-0 border-r border-gray-300 overflow-y-auto bg-white z-10"
        >
          {/* Table Header */}
          <div className="sticky top-0 z-20 flex bg-gray-100 border-b border-gray-300 font-bold text-[11px] text-gray-700 uppercase tracking-wider shadow-sm"
               style={{ height: ROW_HEIGHT }}>
            <div className="w-24 px-3 py-2 border-r border-gray-200 flex items-center">Activity #</div>
            <div className="flex-1 px-3 py-2 border-r border-gray-200 flex items-center">Description</div>
            <div className="w-14 px-2 py-2 border-r border-gray-200 text-right flex items-center justify-end">Dur</div>
            <div className="w-16 px-2 py-2 flex items-center justify-center">Status</div>
          </div>

          {/* Activity Rows */}
          {isLoading ? (
            <div className="p-8 text-center text-gray-400 text-xs">Loading activities...</div>
          ) : (
            activities.map((act) => {
              const isSelected = selectedActivityIds.has(act.id);
              const statusColor = act.status === 'on_hold' ? 'text-amber-600 bg-amber-50' :
                                  act.status === 'completed' ? 'text-emerald-600 bg-emerald-50' :
                                  act.status === 'in_progress' ? 'text-blue-600 bg-blue-50' :
                                  'text-gray-500 bg-gray-50';
              return (
                <div
                  key={act.id}
                  onClick={() => selectActivity(act.id)}
                  className={`flex items-center border-b border-gray-200 text-xs cursor-pointer transition-colors ${
                    isSelected ? 'bg-blue-50 border-l-2 border-l-blue-500' :
                    act.is_critical ? 'bg-red-50/30 hover:bg-red-50/60' :
                    'hover:bg-gray-50'
                  }`}
                  style={{ height: ROW_HEIGHT }}
                >
                  <div className="w-24 px-3 font-mono font-bold text-gray-800 truncate border-r border-gray-200">
                    {act.activity_id || '—'}
                  </div>
                  <div className="flex-1 px-3 font-medium text-gray-900 truncate border-r border-gray-200" title={act.description}>
                    {act.description}
                  </div>
                  <div className="w-14 px-2 text-right font-mono text-gray-600 border-r border-gray-200">
                    {act.duration_hours ? `${Math.round(Number(act.duration_hours) / 8)}d` : '—'}
                  </div>
                  <div className="w-16 px-1 flex items-center justify-center">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${statusColor}`}>
                      {act.status === 'in_progress' ? 'IP' :
                       act.status === 'completed' ? 'DONE' :
                       act.status === 'on_hold' ? 'HOLD' :
                       act.status === 'not_started' ? 'NS' : act.status || 'NS'}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Right: Gantt Chart */}
        <div
          ref={rightRef}
          onScroll={handleRightScroll}
          className="flex-1 overflow-auto bg-gray-50/50 relative"
        >
          {/* Timeline Header Ruler */}
          <div
            style={{ width: totalTimelineWidth }}
            className="sticky top-0 z-20 flex bg-gray-100 border-b border-gray-300 font-mono text-[10px] text-gray-600 shadow-sm"
          >
            {timelineDays.map((d, idx) => {
              const isWeekend = d.getDay() === 0 || d.getDay() === 6;
              const isToday = d.toDateString() === new Date().toDateString();
              return (
                <div
                  key={idx}
                  style={{ width: dayWidth, height: ROW_HEIGHT }}
                  className={`flex-shrink-0 flex flex-col items-center justify-center border-r border-gray-200 font-bold ${
                    isToday ? 'bg-red-100 text-red-700' :
                    isWeekend ? 'bg-gray-200/60 text-gray-500' : ''
                  }`}
                >
                  <span>{d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                </div>
              );
            })}
          </div>

          {/* Gantt Rows */}
          <div style={{ width: totalTimelineWidth }} className="relative">
            {/* Background Grid */}
            <div className="absolute inset-0 flex pointer-events-none">
              {timelineDays.map((d, idx) => {
                const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                return (
                  <div
                    key={idx}
                    style={{ width: dayWidth }}
                    className={`flex-shrink-0 border-r border-gray-200/50 h-full ${isWeekend ? 'bg-gray-100/30' : ''}`}
                  />
                );
              })}
            </div>

            {/* Today Marker */}
            <div
              style={{ left: todayOffset * dayWidth }}
              className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-10 pointer-events-none"
            >
              <div className="absolute -top-0 -left-1.5 w-3.5 h-3.5 bg-red-500 rounded-full border-2 border-white shadow" />
            </div>

            {/* Activity Bars */}
            {activities.map((act) => {
              const isSelected = selectedActivityIds.has(act.id);
              const statusColors = STATUS_COLORS[act.status || 'not_started'] || STATUS_COLORS.not_started;

              // Planned bar (M11 authority — read-only)
              const plannedLeft = dateToOffset(act.early_start || act.planned_start);
              const plannedRight = dateToOffset(act.early_finish || act.planned_end);
              const plannedWidth = (plannedLeft !== null && plannedRight !== null) ? Math.max(dayWidth * 0.5, plannedRight - plannedLeft) : 0;

              // Actual bar (M12 execution facts — read-only)
              const actualLeft = dateToOffset(act.actual_start);
              let actualRight: number | null = dateToOffset(act.actual_end);
              // In-progress: extend to today
              if (act.actual_start && !act.actual_end && (act.status === 'in_progress' || act.status === 'on_hold')) {
                actualRight = todayOffset * dayWidth;
              }
              const actualWidth = (actualLeft !== null && actualRight !== null) ? Math.max(dayWidth * 0.3, actualRight - actualLeft) : 0;

              // Progress percentage for fill
              const progress = Number((act as any).progress ?? (act as any).progress_percent ?? 0);

              return (
                <div
                  key={act.id}
                  onClick={() => selectActivity(act.id)}
                  className={`flex items-center relative border-b cursor-pointer transition-colors ${
                    isSelected ? 'bg-blue-50/60 border-blue-200' : 'border-gray-200/40 hover:bg-gray-50/40'
                  }`}
                  style={{ height: ROW_HEIGHT }}
                >
                  {/* Planned Bar (top half of row) */}
                  {showPlanned && plannedLeft !== null && plannedWidth > 0 && (
                    <div
                      style={{ left: plannedLeft, width: plannedWidth, top: 4 }}
                      className={`absolute h-[12px] rounded border ${
                        act.is_critical ? 'border-red-400 bg-red-100' : 'border-blue-400 bg-blue-100'
                      }`}
                      title={`Planned: ${act.early_start || act.planned_start} → ${act.early_finish || act.planned_end}`}
                    >
                      <span className="truncate px-1 text-[9px] font-bold text-gray-700 leading-[12px]">
                        {act.activity_id || ''}
                      </span>
                    </div>
                  )}

                  {/* Actual Bar (bottom half of row) */}
                  {showActual && actualLeft !== null && actualWidth > 0 && (
                    <div
                      style={{ left: actualLeft, width: actualWidth, bottom: 4 }}
                      className={`absolute h-[12px] rounded overflow-hidden ${statusColors.bg} border ${
                        act.status === 'on_hold' ? 'border-amber-400' :
                        act.status === 'completed' ? 'border-emerald-500' : 'border-emerald-400'
                      }`}
                      title={`Actual: ${act.actual_start} → ${act.actual_end || 'ongoing'} (${progress}%)`}
                    >
                      {/* Progress fill */}
                      <div
                        style={{ width: `${progress}%` }}
                        className={`h-full absolute left-0 top-0 ${statusColors.fill}`}
                      />
                      {/* On-hold indicator */}
                      {act.status === 'on_hold' && (
                        <div className="absolute right-0.5 top-0 bottom-0 flex items-center">
                          <span className="text-[8px]">⏸</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Legend ── */}
      <div className="px-4 py-1.5 border-t border-gray-200 bg-gray-50 flex items-center gap-4 text-[10px] text-gray-500 flex-shrink-0">
        <span className="flex items-center gap-1"><span className="w-4 h-1.5 bg-blue-200 border border-blue-400 rounded inline-block" /> Planned (M11)</span>
        <span className="flex items-center gap-1"><span className="w-4 h-1.5 bg-emerald-300 border border-emerald-400 rounded inline-block" /> Actual</span>
        <span className="flex items-center gap-1"><span className="w-4 h-1.5 bg-amber-200 border border-amber-400 rounded inline-block" /> On Hold</span>
        <span className="flex items-center gap-1"><span className="w-4 h-1.5 bg-red-200 border border-red-400 rounded inline-block" /> Critical</span>
        <span className="flex items-center gap-1"><span className="w-0.5 h-3 bg-red-500 inline-block" /> Today</span>
      </div>
    </div>
  );
}
