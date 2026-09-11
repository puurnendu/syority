'use client';

import React, { useState, useEffect } from 'react';
import { useActiveShutdown } from '@/context/ActiveShutdownContext';
import { PlanVsActualDTO } from '@/core/execution/FieldExecutionService';
import {
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Clock,
  Search,
  Filter,
  RefreshCw,
  ArrowRight,
} from 'lucide-react';

export function PlanVsActualView() {
  const { activeShutdown, activeSite } = useActiveShutdown();
  const [items, setItems] = useState<PlanVsActualDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'delayed' | 'critical' | 'on_track'>('all');

  const fetchData = async () => {
    if (!activeShutdown?.id) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/execution/plan-vs-actual?event_id=${activeShutdown.id}`).then((r) => r.json());
      setItems(res.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeShutdown?.id]);

  const filteredItems = items.filter((item) => {
    const matchesSearch =
      item.description.toLowerCase().includes(search.toLowerCase()) ||
      (item.workpack_number && item.workpack_number.toLowerCase().includes(search.toLowerCase())) ||
      (item.activity_number && item.activity_number.toLowerCase().includes(search.toLowerCase()));

    if (!matchesSearch) return false;
    if (filter === 'delayed') return item.is_delayed;
    if (filter === 'critical') return item.is_critical;
    if (filter === 'on_track') return !item.is_delayed && item.status !== 'not_started';
    return true;
  });

  const delayedCount = items.filter((i) => i.is_delayed).length;
  const onTrackCount = items.filter((i) => !i.is_delayed && (i.status === 'in_progress' || i.status === 'completed')).length;

  return (
    <div className="flex-1 bg-slate-900 text-slate-100 min-h-screen p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-cyan-400">
            Schedule vs Reality Analysis
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight mt-1">
            Plan vs. Actual Variance Engine
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            {activeSite?.name || 'Site'} • {activeShutdown?.name || 'Active Shutdown'} ({activeShutdown?.code})
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchData}
            disabled={loading}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4">
          <div className="text-xs font-semibold text-slate-400 uppercase">Total Activities</div>
          <div className="text-2xl font-bold text-white mt-1">{items.length}</div>
        </div>
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4">
          <div className="text-xs font-semibold text-emerald-400 uppercase">On Track</div>
          <div className="text-2xl font-bold text-emerald-400 mt-1">{onTrackCount}</div>
        </div>
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4">
          <div className="text-xs font-semibold text-rose-400 uppercase">Delayed / Overdue</div>
          <div className="text-2xl font-bold text-rose-400 mt-1">{delayedCount}</div>
        </div>
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4">
          <div className="text-xs font-semibold text-cyan-400 uppercase">Critical Path Tasks</div>
          <div className="text-2xl font-bold text-cyan-400 mt-1">
            {items.filter((i) => i.is_critical).length}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-950 border border-slate-800 p-3 rounded-2xl">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search activity, workpack..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-cyan-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
              filter === 'all' ? 'bg-cyan-600 text-white' : 'bg-slate-900 text-slate-400 hover:text-white'
            }`}
          >
            All ({items.length})
          </button>
          <button
            onClick={() => setFilter('delayed')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
              filter === 'delayed' ? 'bg-rose-600 text-white' : 'bg-slate-900 text-slate-400 hover:text-white'
            }`}
          >
            Delayed ({delayedCount})
          </button>
          <button
            onClick={() => setFilter('critical')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
              filter === 'critical' ? 'bg-indigo-600 text-white' : 'bg-slate-900 text-slate-400 hover:text-white'
            }`}
          >
            Critical
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-900/90 text-xs font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-800">
              <tr>
                <th className="py-3.5 px-4">Activity Description</th>
                <th className="py-3.5 px-4">Planned Baseline</th>
                <th className="py-3.5 px-4">Actual Execution</th>
                <th className="py-3.5 px-4">Start Variance</th>
                <th className="py-3.5 px-4">Finish Variance</th>
                <th className="py-3.5 px-4">Progress %</th>
                <th className="py-3.5 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-sans">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-500">
                    No activities match criteria.
                  </td>
                </tr>
              ) : (
                filteredItems.map((act) => (
                  <tr key={act.id} className="hover:bg-slate-900/50 transition">
                    <td className="py-3 px-4">
                      <div className="font-bold text-white flex items-center gap-2">
                        {act.description}
                        {act.is_critical && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-rose-950 text-rose-400 border border-rose-800">
                            CRITICAL
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        WP: {act.workpack_number || 'Standalone'} • {act.discipline_name || 'General'}
                      </div>
                    </td>

                    <td className="py-3 px-4 text-xs font-mono text-slate-300">
                      <div>{act.planned_start || '--'} → {act.planned_end || '--'}</div>
                      <div className="text-slate-500">{act.duration_hours}h duration</div>
                    </td>

                    <td className="py-3 px-4 text-xs font-mono">
                      <div className={act.actual_start ? 'text-cyan-400' : 'text-slate-600'}>
                        {act.actual_start || 'Not started'} → {act.actual_end || '--'}
                      </div>
                      <div className="text-slate-500">{act.actual_duration_hours}h actual</div>
                    </td>

                    <td className="py-3 px-4 text-xs">
                      {act.start_variance_hours !== null ? (
                        <span
                          className={`font-bold ${
                            act.start_variance_hours > 0
                              ? 'text-rose-400'
                              : act.start_variance_hours < 0
                              ? 'text-emerald-400'
                              : 'text-slate-400'
                          }`}
                        >
                          {act.start_variance_hours > 0 ? `+${act.start_variance_hours}h delay` : `${act.start_variance_hours}h early`}
                        </span>
                      ) : (
                        <span className="text-slate-600">--</span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-xs">
                      {act.finish_variance_hours !== null ? (
                        <span
                          className={`font-bold ${
                            act.finish_variance_hours > 0
                              ? 'text-rose-400'
                              : act.finish_variance_hours < 0
                              ? 'text-emerald-400'
                              : 'text-slate-400'
                          }`}
                        >
                          {act.finish_variance_hours > 0 ? `+${act.finish_variance_hours}h delay` : `${act.finish_variance_hours}h early`}
                        </span>
                      ) : (
                        <span className="text-slate-600">--</span>
                      )}
                    </td>

                    <td className="py-3 px-4">
                      <div className="w-24">
                        <div className="text-xs font-bold mb-1">{act.progress_percent}%</div>
                        <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              act.progress_percent === 100 ? 'bg-emerald-500' : 'bg-cyan-500'
                            }`}
                            style={{ width: `${act.progress_percent}%` }}
                          ></div>
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-4 text-xs">
                      {act.is_delayed ? (
                        <span className="px-2 py-1 rounded-lg text-xs font-bold bg-rose-950 text-rose-400 border border-rose-800">
                          Delayed
                        </span>
                      ) : act.status === 'completed' ? (
                        <span className="px-2 py-1 rounded-lg text-xs font-bold bg-emerald-950 text-emerald-400 border border-emerald-800">
                          Completed
                        </span>
                      ) : act.status === 'in_progress' ? (
                        <span className="px-2 py-1 rounded-lg text-xs font-bold bg-amber-950 text-amber-400 border border-amber-800">
                          In Progress
                        </span>
                      ) : (
                        <span className="text-slate-500">Planned</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
