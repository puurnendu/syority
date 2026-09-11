'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useActiveShutdown } from '@/context/ActiveShutdownContext';
import type { ScheduleCalculationResult, CalculatedActivity } from '@/lib/scheduleEngine';

type ZoomLevel = 'day' | 'week' | 'month';

interface ScheduleGanttProps {
  mode?: 'planning' | 'execution';
  eventId?: string;
}

export function ScheduleGantt({ mode = 'planning', eventId: externalEventId }: ScheduleGanttProps) {
  const { activeEventId: contextEventId, activeShutdown: contextShutdown } = useActiveShutdown();
  
  const activeEventId = externalEventId || contextEventId;
  const activeShutdown = externalEventId ? { code: 'WKS', name: 'Workspace Schedule', site: { name: 'Site' } } : contextShutdown;

  const [scheduleData, setScheduleData] = useState<ScheduleCalculationResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [zoomLevel, setZoomLevel] = useState<ZoomLevel>('day');
  const [criticalOnly, setCriticalOnly] = useState(false);
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null);
  const [whatIfModalOpen, setWhatIfModalOpen] = useState(false);

  const leftTableRef = useRef<HTMLDivElement>(null);
  const rightGanttRef = useRef<HTMLDivElement>(null);

  // Load schedule calculation
  const loadSchedule = useCallback(async () => {
    if (!activeEventId) {
      setScheduleData(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const res = await fetch('/api/schedule/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_id: activeEventId }),
      });
      const json = await res.json();
      if (json.data) {
        setScheduleData(json.data);
      }
    } catch (err) {
      console.error('Failed to load schedule calculation:', err);
    } finally {
      setLoading(false);
    }
  }, [activeEventId]);

  useEffect(() => {
    loadSchedule();
  }, [loadSchedule]);

  // Recalculate schedule handler
  const handleRecalculate = async (persist = false) => {
    if (!activeEventId) return;

    try {
      setCalculating(true);
      const res = await fetch('/api/schedule/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_id: activeEventId, persist }),
      });
      const json = await res.json();
      if (json.data) {
        setScheduleData(json.data);
      }
    } catch (err) {
      console.error('Failed to recalculate schedule:', err);
    } finally {
      setCalculating(false);
    }
  };

  // Synchronize vertical scroll between left table and right Gantt chart
  const handleLeftScroll = () => {
    if (leftTableRef.current && rightGanttRef.current) {
      rightGanttRef.current.scrollTop = leftTableRef.current.scrollTop;
    }
  };

  const handleRightScroll = () => {
    if (leftTableRef.current && rightGanttRef.current) {
      leftTableRef.current.scrollTop = rightGanttRef.current.scrollTop;
    }
  };

  // Filter activities
  const displayedActivities = useMemo(() => {
    if (!scheduleData?.activities) return [];
    if (criticalOnly) {
      return scheduleData.activities.filter((a) => a.is_critical);
    }
    return scheduleData.activities;
  }, [scheduleData, criticalOnly]);

  // Timeline scale calculation
  const { minDate, totalTimelineDays, dayWidth } = useMemo(() => {
    if (!scheduleData?.project_start || !scheduleData?.project_finish) {
      return { minDate: new Date(), totalTimelineDays: 30, dayWidth: 40 };
    }

    const start = new Date(scheduleData.project_start);
    const finish = new Date(scheduleData.project_finish);
    const diff = Math.max(14, Math.ceil((finish.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 5);

    let width = 40;
    if (zoomLevel === 'day') width = 44;
    else if (zoomLevel === 'week') width = 20;
    else if (zoomLevel === 'month') width = 8;

    return { minDate: start, totalTimelineDays: diff, dayWidth: width };
  }, [scheduleData, zoomLevel]);

  // Days array for header ruler
  const timelineDays = useMemo(() => {
    const days: Date[] = [];
    for (let i = 0; i < totalTimelineDays; i++) {
      const d = new Date(minDate);
      d.setDate(d.getDate() + i);
      days.push(d);
    }
    return days;
  }, [minDate, totalTimelineDays]);

  if (!activeEventId) {
    return (
      <div className="p-12 text-center bg-white rounded-2xl border border-gray-200 shadow-sm max-w-2xl mx-auto my-12">
        <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center text-2xl mx-auto mb-4">
          📈
        </div>
        <h3 className="text-lg font-black text-gray-900 mb-1">No Active Shutdown Selected</h3>
        <p className="text-sm text-gray-500 mb-6">
          Please select an active turnaround campaign from the top bar to view its Critical Path Method schedule and interactive Gantt chart.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] bg-white overflow-hidden select-none">
      {/* ── Active Shutdown Schedule Header Banner ── */}
      <div className="px-6 py-4 border-b border-gray-200 bg-gray-50/70 flex flex-wrap items-center justify-between gap-4 flex-shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
              {activeShutdown?.code || 'SHUTDOWN'}
            </span>
            <h1 className="text-xl font-black text-gray-900 tracking-tight">
              {activeShutdown?.name || 'Turnaround Execution Schedule'}
            </h1>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            {activeShutdown?.site?.name || 'Site'} • Scheduled Finish:{' '}
            <strong className="text-gray-800">{scheduleData?.project_finish || '—'}</strong> • Duration:{' '}
            <strong className="text-gray-800">{scheduleData?.total_duration_days || 0} days</strong> • Critical Path:{' '}
            <strong className="text-red-600">{scheduleData?.critical_path_ids?.length || 0} tasks</strong>
          </p>
        </div>

        {/* Toolbar Actions */}
        <div className="flex items-center gap-2">
          {/* Zoom controls */}
          <div className="flex items-center bg-white border border-gray-200 rounded-xl p-0.5 shadow-sm text-xs font-bold text-gray-600">
            <button
              type="button"
              onClick={() => setZoomLevel('day')}
              className={`px-3 py-1 rounded-lg transition-all ${zoomLevel === 'day' ? 'bg-blue-600 text-white' : 'hover:bg-gray-100'}`}
            >
              Day
            </button>
            <button
              type="button"
              onClick={() => setZoomLevel('week')}
              className={`px-3 py-1 rounded-lg transition-all ${zoomLevel === 'week' ? 'bg-blue-600 text-white' : 'hover:bg-gray-100'}`}
            >
              Week
            </button>
            <button
              type="button"
              onClick={() => setZoomLevel('month')}
              className={`px-3 py-1 rounded-lg transition-all ${zoomLevel === 'month' ? 'bg-blue-600 text-white' : 'hover:bg-gray-100'}`}
            >
              Month
            </button>
          </div>

          <button
            type="button"
            onClick={() => setCriticalOnly(!criticalOnly)}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-xl border shadow-sm transition-all ${
              criticalOnly ? 'bg-red-50 border-red-300 text-red-700' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            🔥 {criticalOnly ? 'Show All Tasks' : 'Critical Path Only'}
          </button>

          <button
            type="button"
            onClick={() => handleRecalculate(true)}
            disabled={calculating}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-sm transition-all"
          >
            {calculating ? 'Calculating CPM...' : '⚡ Recalculate CPM'}
          </button>
        </div>
      </div>

      {/* ── Main Gantt Split Container ── */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Activity List Pane */}
        <div
          ref={leftTableRef}
          onScroll={handleLeftScroll}
          className="w-[450px] flex-shrink-0 border-r border-gray-300 overflow-y-auto bg-white shadow-sm z-10"
        >
          {/* Table Header */}
          <div className="sticky top-0 z-20 flex bg-gray-100 border-b border-gray-300 font-bold text-[11px] text-gray-700 uppercase tracking-wider h-[38px] shadow-sm">
            <div className="w-24 px-3 py-2 border-r border-gray-200">Activity #</div>
            <div className="flex-1 px-3 py-2 border-r border-gray-200">Description</div>
            <div className="w-16 px-2 py-2 border-r border-gray-200 text-right">Dur</div>
            <div className="w-20 px-2 py-2 border-r border-gray-200">Float</div>
            <div className="w-12 px-1 py-2 text-center">Crit</div>
          </div>

          {/* Table Body */}
          {loading ? (
            <div className="p-8 text-center text-gray-400 text-xs font-medium">Calculating schedule...</div>
          ) : displayedActivities.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-xs">No activities found in schedule.</div>
          ) : (
            displayedActivities.map((act) => (
              <div
                key={act.id}
                onClick={() => setSelectedActivityId(act.id)}
                className={`flex items-center h-[38px] border-b border-gray-200 text-xs cursor-pointer transition-colors ${
                  selectedActivityId === act.id
                    ? 'bg-blue-50'
                    : act.is_critical
                    ? 'bg-red-50/40 hover:bg-red-50/70'
                    : 'hover:bg-gray-50'
                }`}
              >
                <div className="w-24 px-3 font-mono font-bold text-gray-800 truncate border-r border-gray-200">
                  {act.activity_number || '—'}
                </div>
                <div className="flex-1 px-3 font-medium text-gray-900 truncate border-r border-gray-200" title={act.description}>
                  {act.description}
                </div>
                <div className="w-16 px-2 text-right font-mono text-gray-600 border-r border-gray-200">
                  {act.duration_days}d
                </div>
                <div className="w-20 px-2 font-mono text-gray-600 border-r border-gray-200">
                  {act.total_float_days}d
                </div>
                <div className="w-12 px-1 text-center">
                  {act.is_critical && (
                    <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-500 shadow-sm" title="Critical Path" />
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Right Gantt Chart Pane */}
        <div
          ref={rightGanttRef}
          onScroll={handleRightScroll}
          className="flex-1 overflow-auto bg-gray-50/50 relative"
        >
          {/* Gantt Timeline Header Ruler */}
          <div
            style={{ width: `${totalTimelineDays * dayWidth}px` }}
            className="sticky top-0 z-20 flex bg-gray-100 border-b border-gray-300 font-mono text-[10px] text-gray-600 h-[38px] shadow-sm"
          >
            {timelineDays.map((d, idx) => {
              const isWeekend = d.getDay() === 0 || d.getDay() === 6;
              return (
                <div
                  key={idx}
                  style={{ width: `${dayWidth}px` }}
                  className={`flex-shrink-0 flex flex-col items-center justify-center border-r border-gray-200 font-bold ${
                    isWeekend ? 'bg-gray-200/60 text-gray-500' : ''
                  }`}
                >
                  <span>{d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                </div>
              );
            })}
          </div>

          {/* Gantt Chart Rows */}
          <div style={{ width: `${totalTimelineDays * dayWidth}px` }} className="relative">
            {/* Background Grid Columns */}
            <div className="absolute inset-0 flex pointer-events-none">
              {timelineDays.map((d, idx) => {
                const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                return (
                  <div
                    key={idx}
                    style={{ width: `${dayWidth}px` }}
                    className={`flex-shrink-0 border-r border-gray-200/50 h-full ${isWeekend ? 'bg-gray-100/30' : ''}`}
                  />
                );
              })}
            </div>

            {/* Gantt Bars */}
            {displayedActivities.map((act) => {
              const startOffsetDays = Math.max(0, (new Date(act.early_start).getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24));
              const barLeft = startOffsetDays * dayWidth;
              const barWidth = Math.max(dayWidth * 0.8, act.duration_days * dayWidth);
              const floatWidth = Math.max(0, act.total_float_days * dayWidth);

              const getBarColorClasses = (act: any) => {
                if (mode === 'execution' && act.status) {
                  switch(act.status) {
                    case 'completed':
                    case 'verified':
                    case 'closed':
                      return 'bg-emerald-200 border border-emerald-700';
                    case 'in_progress':
                      return act.is_critical ? 'bg-red-200 border border-red-700' : 'bg-cyan-200 border border-cyan-700';
                    case 'on_hold':
                    case 'held':
                      return 'bg-amber-200 border border-amber-700';
                    default:
                      break;
                  }
                }
                return act.is_critical ? 'bg-red-200 border border-red-700' : 'bg-blue-200 border border-blue-700';
              };
              
              const getProgressColorClasses = (act: any) => {
                if (mode === 'execution' && act.status) {
                  switch(act.status) {
                    case 'completed':
                    case 'verified':
                    case 'closed':
                      return 'bg-gradient-to-r from-emerald-600 to-emerald-500';
                    case 'in_progress':
                      return act.is_critical ? 'bg-gradient-to-r from-red-600 to-rose-500' : 'bg-gradient-to-r from-cyan-600 to-cyan-500';
                    case 'on_hold':
                    case 'held':
                      return 'bg-gradient-to-r from-amber-600 to-amber-500';
                    default:
                      break;
                  }
                }
                return act.is_critical ? 'bg-gradient-to-r from-red-600 to-rose-500' : 'bg-gradient-to-r from-blue-600 to-indigo-500';
              };

              return (
                <div
                  key={act.id}
                  onClick={() => setSelectedActivityId(act.id)}
                  className="h-[38px] flex items-center relative border-b border-gray-200/40"
                >
                  {/* Total Float Bar */}
                  {floatWidth > 0 && (
                    <div
                      style={{
                        left: `${barLeft + barWidth}px`,
                        width: `${floatWidth}px`,
                      }}
                      className="absolute h-1.5 bg-gray-300 rounded-r opacity-60 pointer-events-none"
                      title={`Total Float: ${act.total_float_days} days`}
                    />
                  )}

                  {/* Activity Gantt Bar */}
                  <div
                    style={{
                      left: `${barLeft}px`,
                      width: `${barWidth}px`,
                    }}
                    className={`absolute h-6 rounded-lg overflow-hidden flex items-center text-[11px] font-bold text-white shadow-sm cursor-pointer transition-all hover:scale-[1.01] ${getBarColorClasses(act)}`}
                    title={`${act.activity_number || ''}: ${act.description}\nStart: ${act.early_start}\nFinish: ${act.early_finish}\nDuration: ${act.duration_days}d\nFloat: ${act.total_float_days}d\nProgress: ${act.progress || 0}%`}
                  >
                    {/* Progress Fill */}
                    <div
                      style={{ width: `${act.progress || 0}%` }}
                      className={`h-full absolute left-0 top-0 ${getProgressColorClasses(act)}`}
                    />
                    
                    {/* Text Layer */}
                    <span className="truncate px-2 relative z-10 text-gray-900 drop-shadow-sm" style={{ textShadow: '0 0 2px white' }}>
                        {act.activity_number || act.description}
                        {mode === 'execution' && ` (${act.progress || 0}%)`}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
