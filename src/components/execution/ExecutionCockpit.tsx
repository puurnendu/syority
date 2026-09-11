'use client';

import React, { useState, useEffect } from 'react';
import { useActiveShutdown } from '@/context/ActiveShutdownContext';
import {
  ExecutionSummaryDTO,
  ActivityExecutionDTO,
} from '@/core/execution/FieldExecutionService';
import {
  Play,
  CheckCircle,
  AlertTriangle,
  Clock,
  Users,
  ShieldCheck,
  Filter,
  Search,
  FileText,
  RefreshCw,
  PlusCircle,
  ChevronRight,
  TrendingUp,
  X,
  Calendar,
} from 'lucide-react';
import { ExecutionHistoryTimeline } from './ExecutionHistoryTimeline';

export function ExecutionCockpit() {
  const { activeShutdown, activeSite, isLoading: contextLoading } = useActiveShutdown();

  const [summary, setSummary] = useState<ExecutionSummaryDTO | null>(null);
  const [board, setBoard] = useState<ActivityExecutionDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'board' | 'manpower' | 'delays' | 'handover' | 'report'>('board');
  const [shiftType, setShiftType] = useState<'day' | 'night'>('day');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Modals state
  const [selectedActivity, setSelectedActivity] = useState<ActivityExecutionDTO | null>(null);
  const [progressModalOpen, setProgressModalOpen] = useState(false);
  const [delayModalOpen, setDelayModalOpen] = useState(false);
  const [actionProgress, setActionProgress] = useState(50);
  const [actionNotes, setActionNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Sub-items state
  const [expandedActivityId, setExpandedActivityId] = useState<string | null>(null);
  const [subItemsLoading, setSubItemsLoading] = useState(false);
  const [subJoints, setSubJoints] = useState<any[]>([]);
  const [subBlinds, setSubBlinds] = useState<any[]>([]);

  // Delay form state
  const [delayCategory, setDelayCategory] = useState('permit');
  const [delaySeverity, setDelaySeverity] = useState('medium');
  const [delayTitle, setDelayTitle] = useState('');
  const [delayDescription, setDelayDescription] = useState('');
  const [delayTargetDate, setDelayTargetDate] = useState('');

  // Manpower form state
  const [manpowerHeadcount, setManpowerHeadcount] = useState(45);
  const [manpowerHours, setManpowerHours] = useState(360);
  const [ptwCount, setPtwCount] = useState(12);
  const [safetyNotes, setSafetyNotes] = useState('');
  const [manpowerSaved, setManpowerSaved] = useState(false);

  const fetchData = async () => {
    if (!activeShutdown?.id) return;
    setLoading(true);
    try {
      const [sumRes, boardRes] = await Promise.all([
        fetch(`/api/execution/summary?event_id=${activeShutdown.id}`).then((r) => r.json()),
        fetch(`/api/execution/board?event_id=${activeShutdown.id}`).then((r) => r.json()),
      ]);
      setSummary(sumRes.data || null);
      setBoard(boardRes.data || []);
    } catch (err) {
      console.error('Failed to load execution data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeShutdown?.id]);

  useEffect(() => {
    if (!expandedActivityId) {
      setSubJoints([]);
      setSubBlinds([]);
      return;
    }
    const loadSubItems = async () => {
      setSubItemsLoading(true);
      const act = board.find(a => a.id === expandedActivityId);
      if (!act || !act.workpack_id) {
         setSubItemsLoading(false);
         return;
      }
      try {
        const [jRes, bRes] = await Promise.all([
          fetch(`/api/workpacks/${act.workpack_id}/joints`).then(r => r.json()),
          fetch(`/api/workpacks/${act.workpack_id}/blinds`).then(r => r.json())
        ]);
        const joints = jRes.data || [];
        const blinds = bRes.data || [];
        
        const filteredJoints = joints.filter((j: any) => 
          j.activity_id === act.id || j.construct_operation_id === act.id || j.destruct_operation_id === act.id
        );
        const filteredBlinds = blinds.filter((b: any) => 
          b.insert_activity_id === act.id || b.remove_activity_id === act.id
        );
        
        setSubJoints(filteredJoints);
        setSubBlinds(filteredBlinds);
      } catch (err) {
        console.error(err);
      } finally {
        setSubItemsLoading(false);
      }
    };
    loadSubItems();
  }, [expandedActivityId, board]);

  const handleJointAction = async (jointId: string, wpId: string, action: string) => {
    try {
       const res = await fetch(`/api/workpacks/${wpId}/joints/${jointId}`, {
         method: 'PATCH',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ action })
       });
       if (res.ok) {
         const currentId = expandedActivityId;
         setExpandedActivityId(null);
         setTimeout(() => setExpandedActivityId(currentId), 50);
       }
    } catch (err) { console.error(err); }
  };

  const handleBlindAction = async (blindId: string, wpId: string, action: string) => {
    try {
       const res = await fetch(`/api/workpacks/${wpId}/blinds`, {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ id: blindId, action })
       });
       if (res.ok) {
         const currentId = expandedActivityId;
         setExpandedActivityId(null);
         setTimeout(() => setExpandedActivityId(currentId), 50);
       }
    } catch (err) { console.error(err); }
  };

  const handleStart = async (act: ActivityExecutionDTO) => {
    try {
      setSubmitting(true);
      const res = await fetch('/api/execution/activity-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activityId: act.id,
          action: 'START',
          execution_date: new Date().toISOString(),
          shift: shiftType,
        }),
      });
      if (res.ok) {
        await fetchData();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateProgressSubmit = async () => {
    if (!selectedActivity) return;
    try {
      setSubmitting(true);
      const res = await fetch('/api/execution/activity-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activityId: selectedActivity.id,
          action: 'UPDATE_PROGRESS',
          progress: actionProgress,
          notes: actionNotes,
          execution_date: new Date().toISOString(),
          shift: shiftType,
        }),
      });
      if (res.ok) {
        setProgressModalOpen(false);
        setActionNotes('');
        await fetchData();
      }
    } catch (err) {
      console.error(err);
      alert('Network error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAction = async (act: ActivityExecutionDTO, action: string, extraParams: any = {}) => {
    try {
      setSubmitting(true);
      const res = await fetch('/api/execution/activity-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activityId: act.id,
          action,
          execution_date: new Date().toISOString(),
          shift: shiftType,
          ...extraParams
        }),
      });
      if (!res.ok) {
        const error = await res.json();
        alert(error.error || `Failed to ${action.toLowerCase()}`);
      } else {
        await fetchData();
      }
    } catch (err) {
      console.error(err);
      alert('Network error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleComplete = (act: ActivityExecutionDTO) => handleAction(act, 'COMPLETE');
  const handleRelease = (act: ActivityExecutionDTO) => handleAction(act, 'RELEASE');
  const handleVerify = (act: ActivityExecutionDTO) => handleAction(act, 'VERIFY');
  const handleClose = (act: ActivityExecutionDTO) => handleAction(act, 'CLOSE');
  const handleResume = (act: ActivityExecutionDTO) => handleAction(act, 'RESUME');
  // Hold will be handled by a modal if we need hold reason, or a prompt
  const handleHoldPrompt = (act: ActivityExecutionDTO) => {
    const reason = window.prompt("Enter Hold Reason:");
    if (reason) {
      handleAction(act, 'HOLD', { hold_reason: reason, notes: reason });
    }
  };

  const handleReportDelaySubmit = async () => {
    if (!selectedActivity) return;
    try {
      setSubmitting(true);
      const res = await fetch('/api/execution/activity-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activityId: selectedActivity.id,
          action: 'REPORT_DELAY',
          delayDetails: {
            category: delayCategory,
            severity: delaySeverity,
            title: delayTitle || `Delay: ${selectedActivity.description}`,
            description: delayDescription,
            target_resolution: delayTargetDate || undefined,
          },
        }),
      });
      if (res.ok) {
        setDelayModalOpen(false);
        setDelayTitle('');
        setDelayDescription('');
        await fetchData();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveManpower = async () => {
    if (!activeShutdown?.id) return;
    try {
      setSubmitting(true);
      const res = await fetch('/api/execution/shifts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_id: activeShutdown.id,
          log_date: new Date().toISOString().slice(0, 10),
          shift: shiftType,
          manpower_actual: manpowerHeadcount,
          manhours_worked: manpowerHours,
          ptw_issued: ptwCount,
          safety_notes: safetyNotes,
        }),
      });
      if (res.ok) {
        setManpowerSaved(true);
        setTimeout(() => setManpowerSaved(false), 3000);
        await fetchData();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  // Filtered activities
  const filteredActivities = board.filter((act) => {
    const matchesSearch =
      act.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (act.workpack_number && act.workpack_number.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (act.activity_number && act.activity_number.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchesSearch) return false;
    if (statusFilter === 'all') return true;
    if (statusFilter === 'in_progress') return act.status === 'in_progress' || (act.progress_percent > 0 && act.progress_percent < 100);
    if (statusFilter === 'completed') return act.status === 'completed' || act.progress_percent === 100;
    if (statusFilter === 'not_started') return act.status === 'not_started' && act.progress_percent === 0;
    if (statusFilter === 'delayed') return Boolean(act.delay_reason);
    if (statusFilter === 'critical') return act.is_critical;
    return true;
  });

  const todayStr = new Date().toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return (
    <div className="flex-1 bg-slate-900 text-slate-100 min-h-screen flex flex-col">
      {/* 1. Header Banner */}
      <div className="border-b border-slate-800 bg-slate-950 px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-cyan-400">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Field Execution Control Center
            </div>
            <div className="flex items-center gap-3 mt-1">
              <h1 className="text-2xl font-bold text-white tracking-tight">
                {activeShutdown?.name || 'Active Shutdown Event'}
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-cyan-950 text-cyan-400 border border-cyan-800">
                {activeShutdown?.code || 'TA-ACTIVE'}
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-800 text-slate-300">
                {activeSite?.name || 'Site Complex'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Shift selector */}
            <div className="flex items-center bg-slate-900 border border-slate-700 rounded-xl p-1">
              <button
                onClick={() => setShiftType('day')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  shiftType === 'day'
                    ? 'bg-amber-500 text-slate-950 shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                ☀️ Day Shift (07-19)
              </button>
              <button
                onClick={() => setShiftType('night')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  shiftType === 'night'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                🌙 Night Shift (19-07)
              </button>
            </div>

            <div className="flex items-center gap-2 text-xs font-medium text-slate-400 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2">
              <Calendar className="w-4 h-4 text-cyan-400" />
              {todayStr}
            </div>

            <button
              onClick={fetchData}
              disabled={loading}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
              title="Refresh Live Data"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto w-full p-6 flex-1 flex flex-col space-y-6">
        {/* 2. Top Execution KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Progress Card */}
          <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-4 shadow-sm relative overflow-hidden">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Overall Progress</div>
            <div className="text-3xl font-black text-cyan-400 mt-1">
              {summary?.overall_progress ?? 0}%
            </div>
            <div className="w-full bg-slate-700 h-1.5 rounded-full mt-2 overflow-hidden">
              <div
                className="bg-cyan-400 h-full rounded-full transition-all duration-500"
                style={{ width: `${summary?.overall_progress ?? 0}%` }}
              ></div>
            </div>
          </div>

          {/* Planned Today */}
          <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-4 shadow-sm">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Planned Today</div>
            <div className="text-3xl font-black text-white mt-1">
              {summary?.activities_planned_today ?? 0}
            </div>
            <div className="text-xs text-slate-500 mt-1">Activities scheduled</div>
          </div>

          {/* In Progress */}
          <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-4 shadow-sm">
            <div className="text-xs font-semibold text-amber-400 uppercase tracking-wider">In Progress</div>
            <div className="text-3xl font-black text-amber-400 mt-1">
              {summary?.activities_in_progress ?? 0}
            </div>
            <div className="text-xs text-slate-500 mt-1">Currently executing</div>
          </div>

          {/* Completed */}
          <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-4 shadow-sm">
            <div className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">Completed</div>
            <div className="text-3xl font-black text-emerald-400 mt-1">
              {summary?.activities_completed ?? 0}
            </div>
            <div className="text-xs text-slate-500 mt-1">Tasks signed off</div>
          </div>

          {/* Delayed */}
          <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-4 shadow-sm">
            <div className="text-xs font-semibold text-rose-400 uppercase tracking-wider">Delays / Overdue</div>
            <div className="text-3xl font-black text-rose-400 mt-1">
              {summary?.delayed_activities ?? 0}
            </div>
            <div className="text-xs text-slate-500 mt-1">{summary?.open_constraints ?? 0} open constraints</div>
          </div>

          {/* Manpower */}
          <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-4 shadow-sm">
            <div className="text-xs font-semibold text-indigo-400 uppercase tracking-wider">Shift Manpower</div>
            <div className="text-3xl font-black text-indigo-300 mt-1">
              {summary?.total_manpower ?? 45} <span className="text-sm font-normal text-slate-400">pax</span>
            </div>
            <div className="text-xs text-slate-500 mt-1">{summary?.total_manhours ?? 360} total hours</div>
          </div>
        </div>

        {/* 3. Navigation Tabs */}
        <div className="border-b border-slate-800 flex items-center gap-2">
          <button
            onClick={() => setActiveTab('board')}
            className={`px-4 py-2.5 text-sm font-bold border-b-2 transition-all ${
              activeTab === 'board'
                ? 'border-cyan-400 text-cyan-400 bg-cyan-950/30'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            📋 Today's Execution Board
          </button>
          <button
            onClick={() => setActiveTab('manpower')}
            className={`px-4 py-2.5 text-sm font-bold border-b-2 transition-all ${
              activeTab === 'manpower'
                ? 'border-cyan-400 text-cyan-400 bg-cyan-950/30'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            👥 Manpower Logging
          </button>
          <button
            onClick={() => setActiveTab('delays')}
            className={`px-4 py-2.5 text-sm font-bold border-b-2 transition-all ${
              activeTab === 'delays'
                ? 'border-cyan-400 text-cyan-400 bg-cyan-950/30'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            ⚠️ Delays & Constraints ({summary?.open_constraints ?? 0})
          </button>
          <button
            onClick={() => setActiveTab('handover')}
            className={`px-4 py-2.5 text-sm font-bold border-b-2 transition-all ${
              activeTab === 'handover'
                ? 'border-cyan-400 text-cyan-400 bg-cyan-950/30'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            🔄 Shift Handover
          </button>
          <button
            onClick={() => setActiveTab('report')}
            className={`px-4 py-2.5 text-sm font-bold border-b-2 transition-all ${
              activeTab === 'report'
                ? 'border-cyan-400 text-cyan-400 bg-cyan-950/30'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            📑 Daily Execution Report
          </button>
        </div>

        {/* 4. Tab Contents */}
        {activeTab === 'board' && (
          <div className="space-y-4">
            {/* Filter & Search Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-950 border border-slate-800 p-3 rounded-2xl">
              <div className="relative flex-1 w-full">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search activity, description, workpack..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-300 focus:outline-none focus:border-cyan-500"
                >
                  <option value="all">All Statuses</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                  <option value="not_started">Not Started</option>
                  <option value="delayed">Delayed Only</option>
                  <option value="critical">Critical Path</option>
                </select>
              </div>
            </div>

            {/* Execution Table */}
            <div className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-300">
                  <thead className="bg-slate-900/90 text-xs font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="py-3.5 px-4">Activity / Workpack</th>
                      <th className="py-3.5 px-4">Discipline</th>
                      <th className="py-3.5 px-4">Planned Window</th>
                      <th className="py-3.5 px-4">Actual Window</th>
                      <th className="py-3.5 px-4">Progress</th>
                      <th className="py-3.5 px-4">Status & Gates</th>
                      <th className="py-3.5 px-4 text-right">Quick Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-sans">
                    {filteredActivities.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center py-12 text-slate-500">
                          No activities found matching criteria.
                        </td>
                      </tr>
                    ) : (
                      filteredActivities.map((act) => (
                        <React.Fragment key={act.id}>
                        <tr className="hover:bg-slate-900/50 transition cursor-pointer" onClick={() => setExpandedActivityId(expandedActivityId === act.id ? null : act.id)}>
                          <td className="py-3 px-4">
                            <div className="font-bold text-white flex items-center gap-2">
                              {act.description}
                              {act.is_critical && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-rose-950 text-rose-400 border border-rose-800">
                                  CRITICAL
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-2">
                              <span>WP: {act.workpack_number || 'Standalone'}</span>
                              {act.unit_code && <span>• Unit: {act.unit_code}</span>}
                              {act.activity_number && <span>• #{act.activity_number}</span>}
                            </div>
                          </td>

                          <td className="py-3 px-4">
                            <span
                              className="px-2 py-0.5 rounded text-xs font-bold inline-block"
                              style={{
                                backgroundColor: `${act.discipline_color || '#3B82F6'}20`,
                                color: act.discipline_color || '#60A5FA',
                                border: `1px solid ${act.discipline_color || '#3B82F6'}40`,
                              }}
                            >
                              {act.discipline_name || 'General'}
                            </span>
                          </td>

                          <td className="py-3 px-4 text-xs">
                            <div className="text-slate-300">
                              {act.planned_start || '--'} → {act.planned_end || '--'}
                            </div>
                            <div className="text-slate-500">{act.duration_hours}h duration</div>
                          </td>

                          <td className="py-3 px-4 text-xs">
                            <div className={act.actual_start ? 'text-cyan-400 font-semibold' : 'text-slate-600'}>
                              {act.actual_start || 'Not started'} → {act.actual_end || '--'}
                            </div>
                          </td>

                          <td className="py-3 px-4">
                            <div className="w-28">
                              <div className="flex justify-between text-xs font-bold mb-1">
                                <span>{act.progress_percent}%</span>
                              </div>
                              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all ${
                                    act.progress_percent === 100
                                      ? 'bg-emerald-500'
                                      : act.progress_percent > 0
                                      ? 'bg-cyan-500'
                                      : 'bg-transparent'
                                  }`}
                                  style={{ width: `${act.progress_percent}%` }}
                                ></div>
                              </div>
                            </div>
                          </td>

                          <td className="py-3 px-4 text-xs space-y-1">
                            <div>
                              {act.status === 'completed' ? (
                                <span className="inline-flex items-center gap-1 text-emerald-400 font-bold">
                                  <CheckCircle className="w-3.5 h-3.5" /> Completed
                                </span>
                              ) : act.status === 'in_progress' ? (
                                <span className="inline-flex items-center gap-1 text-amber-400 font-bold">
                                  <Clock className="w-3.5 h-3.5" /> In Progress
                                </span>
                              ) : (
                                <span className="text-slate-500 font-medium">Not Started</span>
                              )}
                            </div>

                            {act.has_hold_point && (
                              <div>
                                {act.hold_point_cleared ? (
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-800">
                                    QA CLEARED
                                  </span>
                                ) : (
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-950 text-amber-400 border border-amber-800">
                                    QA HOLD POINT
                                  </span>
                                )}
                              </div>
                            )}

                            {act.is_ready_to_start === false && (
                              <div className="text-[11px] text-rose-400 font-bold space-y-0.5 bg-rose-950/30 p-1.5 rounded border border-rose-900/50">
                                {act.blocking_reasons?.map((reason, i) => (
                                  <div key={i}>🚫 {reason}</div>
                                ))}
                              </div>
                            )}

                            {act.permit_status && act.permit_status !== 'None Required' && (
                              <div className="text-[11px] text-slate-400 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800 inline-block">
                                Permits: <span className={act.permit_status === 'Missing/Expired' ? 'text-rose-400 font-bold' : 'text-emerald-400'}>{act.permit_status}</span>
                              </div>
                            )}

                            {act.delay_reason && (
                              <div className="text-[11px] text-amber-400 truncate max-w-[180px]" title={act.delay_reason}>
                                ⚠️ {act.delay_reason}
                              </div>
                            )}
                          </td>

                          <td className="py-3 px-4 text-right space-x-1 whitespace-nowrap">
                            {act.status !== 'closed' && (
                              <>
                                {act.status === 'not_started' && (
                                  <button
                                    onClick={() => handleRelease(act)}
                                    disabled={submitting || act.is_ready_to_start === false}
                                    className="px-2.5 py-1 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition disabled:opacity-50"
                                  >
                                    Release
                                  </button>
                                )}
                                {(act.status === 'not_started' || act.status === 'released') && (
                                  <button
                                    onClick={() => handleStart(act)}
                                    disabled={submitting || (act.status === 'not_started' && act.is_ready_to_start === false)}
                                    className="px-2.5 py-1 rounded-lg text-xs font-bold bg-cyan-600 hover:bg-cyan-500 text-white transition disabled:opacity-50"
                                  >
                                    Start
                                  </button>
                                )}

                                {['in_progress', 'on_hold', 'held'].includes(act.status) && (
                                  <button
                                    onClick={() => {
                                      setSelectedActivity(act);
                                      setActionProgress(act.progress_percent);
                                      setProgressModalOpen(true);
                                    }}
                                    className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
                                  >
                                    Update %
                                  </button>
                                )}

                                {act.status === 'in_progress' && (
                                  <>
                                    <button
                                      onClick={() => handleComplete(act)}
                                      disabled={submitting}
                                      className="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition disabled:opacity-50"
                                    >
                                      Complete
                                    </button>
                                    <button
                                      onClick={() => handleHoldPrompt(act)}
                                      disabled={submitting}
                                      className="px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white transition disabled:opacity-50"
                                    >
                                      Hold
                                    </button>
                                  </>
                                )}

                                {['on_hold', 'held'].includes(act.status) && (
                                  <button
                                    onClick={() => handleResume(act)}
                                    disabled={submitting}
                                    className="px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white transition disabled:opacity-50"
                                  >
                                    Resume
                                  </button>
                                )}

                                {act.status === 'completed' && (
                                  <button
                                    onClick={() => handleVerify(act)}
                                    disabled={submitting}
                                    className="px-2.5 py-1 rounded-lg text-xs font-bold bg-teal-600 hover:bg-teal-500 text-white transition disabled:opacity-50"
                                  >
                                    Verify
                                  </button>
                                )}

                                {act.status === 'verified' && (
                                  <button
                                    onClick={() => handleClose(act)}
                                    disabled={submitting}
                                    className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-700 hover:bg-slate-600 text-white transition disabled:opacity-50"
                                  >
                                    Close
                                  </button>
                                )}

                                {['not_started', 'released', 'in_progress'].includes(act.status) && (
                                  <button
                                    onClick={() => {
                                      setSelectedActivity(act);
                                      setDelayTitle(`Delay on ${act.description}`);
                                      setDelayModalOpen(true);
                                    }}
                                    className="px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-800 transition disabled:opacity-50"
                                  >
                                    Delay
                                  </button>
                                )}
                              </>
                            )}
                          </td>
                        </tr>
                        {expandedActivityId === act.id && (
                          <tr key={`${act.id}-subitems`} className="bg-slate-900 border-t border-slate-800">
                            <td colSpan={7} className="px-6 py-4">
                              {subItemsLoading ? (
                                <div className="text-center text-xs text-slate-400 py-4"><RefreshCw className="w-4 h-4 animate-spin mx-auto" /></div>
                              ) : (
                                <div className="space-y-4">
                                  {subJoints.length > 0 && (
                                    <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
                                      <h4 className="text-xs font-bold text-slate-300 uppercase mb-2">Linked Joints ({subJoints.length})</h4>
                                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                        {subJoints.map(j => (
                                          <div key={j.id} className="bg-slate-900 border border-slate-700 rounded-lg p-3 text-xs">
                                            <div className="flex justify-between items-center mb-1">
                                              <span className="font-bold text-cyan-400">{j.joint_number}</span>
                                              <span className="px-1.5 py-0.5 rounded-sm bg-slate-800 text-slate-300 uppercase text-[10px] border border-slate-700">{j.status}</span>
                                            </div>
                                            <div className="text-slate-400 space-y-0.5 mb-2">
                                              <div>Size/Rating: {j.flange_size || '--'} / {j.rating || '--'}</div>
                                              <div>Method: {j.tightening_method || '--'}</div>
                                            </div>
                                            {(act.workpack_status === 'issued' || act.workpack_status === 'in_execution') && act.workpack_id && (
                                              <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t border-slate-800">
                                                {j.status === 'pending' && <button onClick={() => handleJointAction(j.id, act.workpack_id!, 'assemble')} className="px-2 py-1 bg-cyan-900 hover:bg-cyan-800 text-cyan-100 rounded">Assemble</button>}
                                                {j.status === 'assembled' && <button onClick={() => handleJointAction(j.id, act.workpack_id!, 'inspect')} className="px-2 py-1 bg-indigo-900 hover:bg-indigo-800 text-indigo-100 rounded">Inspect</button>}
                                                {j.status === 'inspected' && <button onClick={() => handleJointAction(j.id, act.workpack_id!, 'sign-off')} className="px-2 py-1 bg-emerald-900 hover:bg-emerald-800 text-emerald-100 rounded">Sign-Off</button>}
                                                <button onClick={() => handleJointAction(j.id, act.workpack_id!, 'dismantle')} className="px-2 py-1 bg-rose-900 hover:bg-rose-800 text-rose-100 rounded">Dismantle</button>
                                              </div>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                  {subBlinds.length > 0 && (
                                    <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
                                      <h4 className="text-xs font-bold text-slate-300 uppercase mb-2">Linked Blinds ({subBlinds.length})</h4>
                                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                        {subBlinds.map(b => (
                                          <div key={b.id} className="bg-slate-900 border border-slate-700 rounded-lg p-3 text-xs">
                                            <div className="flex justify-between items-center mb-1">
                                              <span className="font-bold text-amber-400">{b.blind_number}</span>
                                              <span className="px-1.5 py-0.5 rounded-sm bg-slate-800 text-slate-300 uppercase text-[10px] border border-slate-700">{b.status}</span>
                                            </div>
                                            <div className="text-slate-400 space-y-0.5 mb-2">
                                              <div>Type: {b.blind_type || '--'}</div>
                                              <div>Size/Rating: {b.flange_size || '--'} / {b.rating || '--'}</div>
                                            </div>
                                            {(act.workpack_status === 'issued' || act.workpack_status === 'in_execution') && act.workpack_id && (
                                              <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t border-slate-800">
                                                {b.status === 'pending' && <button onClick={() => handleBlindAction(b.id, act.workpack_id!, 'insert')} className="px-2 py-1 bg-amber-900 hover:bg-amber-800 text-amber-100 rounded">Insert</button>}
                                                {b.status === 'inserted' && b.pressure_test_required && <button onClick={() => handleBlindAction(b.id, act.workpack_id!, 'pressure-test')} className="px-2 py-1 bg-indigo-900 hover:bg-indigo-800 text-indigo-100 rounded">Pressure Test</button>}
                                                {(b.status === 'inserted' || b.status === 'pressure_tested') && <button onClick={() => handleBlindAction(b.id, act.workpack_id!, 'remove')} className="px-2 py-1 bg-emerald-900 hover:bg-emerald-800 text-emerald-100 rounded">Remove</button>}
                                              </div>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                  {subJoints.length === 0 && subBlinds.length === 0 && (
                                    <div className="text-slate-500 text-xs italic">No execution sub-items linked to this activity.</div>
                                  )}
                                  <div className="bg-white/5 border border-slate-700/50 rounded-xl p-4 mt-4 text-slate-200">
                                    <h4 className="text-xs font-bold text-slate-300 uppercase mb-4">Execution History</h4>
                                    <ExecutionHistoryTimeline activityId={act.id} />
                                  </div>
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))
                  )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Manpower Tab */}
        {activeTab === 'manpower' && (
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white">Daily Shift Manpower & Hours Capture</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Record active contractor headcount, hours worked, and permit counts for {shiftType.toUpperCase()} shift.
                </p>
              </div>
              {manpowerSaved && (
                <span className="text-xs font-bold text-emerald-400 bg-emerald-950 px-3 py-1.5 rounded-xl border border-emerald-800">
                  ✓ Manpower Saved Successfully
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase">
                  Shift Headcount (Pax)
                </label>
                <input
                  type="number"
                  value={manpowerHeadcount}
                  onChange={(e) => {
                    const hc = Number(e.target.value);
                    setManpowerHeadcount(hc);
                    setManpowerHours(hc * (shiftType === 'day' ? 10 : 8));
                  }}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-white font-bold focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase">
                  Total Manhours Worked
                </label>
                <input
                  type="number"
                  value={manpowerHours}
                  onChange={(e) => setManpowerHours(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-white font-bold focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase">
                  PTW Permits Issued
                </label>
                <input
                  type="number"
                  value={ptwCount}
                  onChange={(e) => setPtwCount(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-white font-bold focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase">
                Supervisor Shift Safety Notes & Observations
              </label>
              <textarea
                rows={3}
                value={safetyNotes}
                onChange={(e) => setSafetyNotes(e.target.value)}
                placeholder="Toolbox talk held, critical lifts inspected, no incidents recorded..."
                className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-slate-200 focus:outline-none focus:border-cyan-500"
              ></textarea>
            </div>

            <div className="flex justify-end">
              <button
                onClick={handleSaveManpower}
                disabled={submitting}
                className="px-6 py-2.5 rounded-xl text-sm font-bold bg-cyan-600 hover:bg-cyan-500 text-white transition shadow-lg shadow-cyan-900/30"
              >
                Save Shift Manpower
              </button>
            </div>
          </div>
        )}

        {/* Delays Tab */}
        {activeTab === 'delays' && (
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
            <div>
              <h2 className="text-lg font-bold text-white">Active Field Delays & Constraints</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                All reported field constraints impacting execution activities. Schedule recalculations are kept strictly separate.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {board
                .filter((b) => b.delay_reason)
                .map((b) => (
                  <div key={b.id} className="p-4 bg-slate-900/80 border border-rose-900/50 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-0.5 rounded text-xs font-bold bg-rose-950 text-rose-400 border border-rose-800 uppercase">
                        DELAY
                      </span>
                      <span className="text-xs text-slate-400 font-mono">WP: {b.workpack_number}</span>
                    </div>
                    <div className="font-bold text-white text-sm">{b.description}</div>
                    <p className="text-xs text-rose-300">{b.delay_reason}</p>
                  </div>
                ))}
              {board.filter((b) => b.delay_reason).length === 0 && (
                <div className="col-span-2 text-center py-10 text-slate-500">
                  ✓ No open field delays recorded for this shift.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Shift Handover Tab */}
        {activeTab === 'handover' && (
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
            <div>
              <h2 className="text-lg font-bold text-white">Shift Handover Summary</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Standard operational handover notes between outgoing and incoming shift supervisors.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-400">Activities in Progress (Handoff)</h3>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {board
                    .filter((b) => b.status === 'in_progress')
                    .map((b) => (
                      <div key={b.id} className="text-xs p-2 bg-slate-950 rounded border border-slate-800 flex justify-between">
                        <span>{b.description}</span>
                        <span className="font-bold text-amber-400">{b.progress_percent}%</span>
                      </div>
                    ))}
                </div>
              </div>

              <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-rose-400">Open Constraints & Hold Points</h3>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {board
                    .filter((b) => b.delay_reason || (b.has_hold_point && !b.hold_point_cleared))
                    .map((b) => (
                      <div key={b.id} className="text-xs p-2 bg-slate-950 rounded border border-slate-800 flex justify-between">
                        <span>{b.description}</span>
                        <span className="text-rose-400 font-bold">
                          {b.delay_reason ? 'Delay' : 'QA Hold Point'}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Daily Report Tab */}
        {activeTab === 'report' && (
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h2 className="text-xl font-bold text-white">Daily Execution Shift Report</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  {activeSite?.name || 'Refinery Complex'} • {activeShutdown?.code} • {todayStr} • {shiftType.toUpperCase()} SHIFT
                </p>
              </div>
              <button
                onClick={() => window.print()}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
              >
                🖨️ Print / Export PDF
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
                <div className="text-xs text-slate-400">Total Activities</div>
                <div className="text-xl font-bold text-white mt-1">{board.length}</div>
              </div>
              <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
                <div className="text-xs text-slate-400">Completed</div>
                <div className="text-xl font-bold text-emerald-400 mt-1">
                  {board.filter((b) => b.status === 'completed').length}
                </div>
              </div>
              <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
                <div className="text-xs text-slate-400">In Progress</div>
                <div className="text-xl font-bold text-amber-400 mt-1">
                  {board.filter((b) => b.status === 'in_progress').length}
                </div>
              </div>
              <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
                <div className="text-xs text-slate-400">Overall Progress</div>
                <div className="text-xl font-bold text-cyan-400 mt-1">{summary?.overall_progress ?? 0}%</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Progress Modal */}
      {progressModalOpen && selectedActivity && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-950 border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-white text-lg">Update Progress</h3>
              <button
                onClick={() => setProgressModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <div className="text-xs text-slate-400">Activity</div>
              <div className="font-bold text-slate-200 mt-0.5">{selectedActivity.description}</div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-semibold text-slate-400 mb-1">
                <span>Progress Percentage</span>
                <span className="text-cyan-400 font-bold">{actionProgress}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={actionProgress}
                onChange={(e) => setActionProgress(Number(e.target.value))}
                className="w-full accent-cyan-500 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-500 mt-1 font-mono">
                <span>0%</span>
                <span>25%</span>
                <span>50%</span>
                <span>75%</span>
                <span>100%</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">
                Field Progress Comment
              </label>
              <textarea
                rows={2}
                value={actionNotes}
                onChange={(e) => setActionNotes(e.target.value)}
                placeholder="e.g., Coupling aligned, torque values verified..."
                className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
              ></textarea>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setProgressModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white bg-slate-900"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateProgressSubmit}
                disabled={submitting}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-cyan-600 hover:bg-cyan-500 text-white"
              >
                Save Progress
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delay Modal */}
      {delayModalOpen && selectedActivity && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-950 border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-white text-lg">Report Field Delay / Constraint</h3>
              <button
                onClick={() => setDelayModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <div className="text-xs text-slate-400">Activity</div>
              <div className="font-bold text-slate-200 mt-0.5">{selectedActivity.description}</div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Category</label>
                <select
                  value={delayCategory}
                  onChange={(e) => setDelayCategory(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-xs text-slate-200"
                >
                  <option value="material">Material Shortage</option>
                  <option value="permit">PTW Permit Delay</option>
                  <option value="scaffold">Scaffolding / Rigging</option>
                  <option value="access">Site / Crane Access</option>
                  <option value="weather">Adverse Weather</option>
                  <option value="inspection">QA Inspector Unavailable</option>
                  <option value="manpower">Contractor Crew Shortage</option>
                  <option value="other">Other Constraint</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Severity</label>
                <select
                  value={delaySeverity}
                  onChange={(e) => setDelaySeverity(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-xs text-slate-200"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical (Blocking)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Delay Description</label>
              <textarea
                rows={3}
                value={delayDescription}
                onChange={(e) => setDelayDescription(e.target.value)}
                placeholder="Describe impediment, root cause, and immediate action..."
                className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
              ></textarea>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setDelayModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white bg-slate-900"
              >
                Cancel
              </button>
              <button
                onClick={handleReportDelaySubmit}
                disabled={submitting}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white"
              >
                Log Delay
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
