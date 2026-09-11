'use client';

import React, { useState, useEffect } from 'react';
import { useActiveShutdown } from '@/context/ActiveShutdownContext';
import { LookaheadItemDTO } from '@/core/execution/FieldExecutionService';
import {
  Clock,
  AlertTriangle,
  CheckCircle,
  Filter,
  Search,
  RefreshCw,
  ShieldCheck,
  Calendar,
} from 'lucide-react';

export function LookaheadView() {
  const { activeShutdown, activeSite } = useActiveShutdown();
  const [items, setItems] = useState<LookaheadItemDTO[]>([]);
  const [windowHours, setWindowHours] = useState<number>(24);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const fetchData = async () => {
    if (!activeShutdown?.id) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/execution/lookahead?event_id=${activeShutdown.id}&hours=${windowHours}`
      ).then((r) => r.json());
      setItems(res.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeShutdown?.id, windowHours]);

  const filteredItems = items.filter((item) => {
    const matchesSearch =
      item.description.toLowerCase().includes(search.toLowerCase()) ||
      (item.workpack_number && item.workpack_number.toLowerCase().includes(search.toLowerCase())) ||
      (item.activity_number && item.activity_number.toLowerCase().includes(search.toLowerCase()));

    if (!matchesSearch) return false;
    if (categoryFilter === 'all') return true;
    return item.categories.includes(categoryFilter as any);
  });

  const categoryCounts = {
    STARTING: items.filter((i) => i.categories.includes('STARTING')).length,
    CONTINUING: items.filter((i) => i.categories.includes('CONTINUING')).length,
    FINISHING: items.filter((i) => i.categories.includes('FINISHING')).length,
    OVERDUE: items.filter((i) => i.categories.includes('OVERDUE')).length,
    BLOCKED: items.filter((i) => i.categories.includes('BLOCKED')).length,
    CRITICAL: items.filter((i) => i.categories.includes('CRITICAL')).length,
  };

  return (
    <div className="flex-1 bg-slate-900 text-slate-100 min-h-screen p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-cyan-400">
            Operational Schedule Forecast
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight mt-1">
            Dynamic Lookahead Engine ({windowHours} Hours)
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            {activeSite?.name || 'Site'} • {activeShutdown?.name || 'Active Shutdown'} ({activeShutdown?.code})
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* 24h / 72h Toggle */}
          <div className="flex items-center bg-slate-950 border border-slate-700 rounded-xl p-1">
            <button
              onClick={() => setWindowHours(24)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                windowHours === 24 ? 'bg-cyan-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              ⏱️ 24-Hour Lookahead
            </button>
            <button
              onClick={() => setWindowHours(72)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                windowHours === 72 ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              📅 72-Hour Lookahead
            </button>
          </div>

          <button
            onClick={fetchData}
            disabled={loading}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Categorization Badges */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <button
          onClick={() => setCategoryFilter(categoryFilter === 'STARTING' ? 'all' : 'STARTING')}
          className={`p-3 rounded-2xl border text-left transition ${
            categoryFilter === 'STARTING'
              ? 'bg-cyan-950 border-cyan-500 shadow-md'
              : 'bg-slate-950 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="text-[11px] font-bold text-cyan-400 uppercase">Starting</div>
          <div className="text-2xl font-bold text-white mt-0.5">{categoryCounts.STARTING}</div>
        </button>

        <button
          onClick={() => setCategoryFilter(categoryFilter === 'CONTINUING' ? 'all' : 'CONTINUING')}
          className={`p-3 rounded-2xl border text-left transition ${
            categoryFilter === 'CONTINUING'
              ? 'bg-amber-950 border-amber-500 shadow-md'
              : 'bg-slate-950 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="text-[11px] font-bold text-amber-400 uppercase">Continuing</div>
          <div className="text-2xl font-bold text-amber-400 mt-0.5">{categoryCounts.CONTINUING}</div>
        </button>

        <button
          onClick={() => setCategoryFilter(categoryFilter === 'FINISHING' ? 'all' : 'FINISHING')}
          className={`p-3 rounded-2xl border text-left transition ${
            categoryFilter === 'FINISHING'
              ? 'bg-emerald-950 border-emerald-500 shadow-md'
              : 'bg-slate-950 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="text-[11px] font-bold text-emerald-400 uppercase">Finishing</div>
          <div className="text-2xl font-bold text-emerald-400 mt-0.5">{categoryCounts.FINISHING}</div>
        </button>

        <button
          onClick={() => setCategoryFilter(categoryFilter === 'OVERDUE' ? 'all' : 'OVERDUE')}
          className={`p-3 rounded-2xl border text-left transition ${
            categoryFilter === 'OVERDUE'
              ? 'bg-rose-950 border-rose-500 shadow-md'
              : 'bg-slate-950 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="text-[11px] font-bold text-rose-400 uppercase">Overdue</div>
          <div className="text-2xl font-bold text-rose-400 mt-0.5">{categoryCounts.OVERDUE}</div>
        </button>

        <button
          onClick={() => setCategoryFilter(categoryFilter === 'BLOCKED' ? 'all' : 'BLOCKED')}
          className={`p-3 rounded-2xl border text-left transition ${
            categoryFilter === 'BLOCKED'
              ? 'bg-purple-950 border-purple-500 shadow-md'
              : 'bg-slate-950 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="text-[11px] font-bold text-purple-400 uppercase">Blocked / QA</div>
          <div className="text-2xl font-bold text-purple-300 mt-0.5">{categoryCounts.BLOCKED}</div>
        </button>

        <button
          onClick={() => setCategoryFilter(categoryFilter === 'CRITICAL' ? 'all' : 'CRITICAL')}
          className={`p-3 rounded-2xl border text-left transition ${
            categoryFilter === 'CRITICAL'
              ? 'bg-red-950 border-red-500 shadow-md'
              : 'bg-slate-950 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="text-[11px] font-bold text-red-400 uppercase">Critical Path</div>
          <div className="text-2xl font-bold text-red-400 mt-0.5">{categoryCounts.CRITICAL}</div>
        </button>
      </div>

      {/* Search */}
      <div className="bg-slate-950 border border-slate-800 p-3 rounded-2xl">
        <div className="relative w-full">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search lookahead activities..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-cyan-500"
          />
        </div>
      </div>

      {/* Lookahead Table */}
      <div className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-900/90 text-xs font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-800">
              <tr>
                <th className="py-3.5 px-4">Activity / Workpack</th>
                <th className="py-3.5 px-4">Discipline</th>
                <th className="py-3.5 px-4">Schedule Window</th>
                <th className="py-3.5 px-4">Progress</th>
                <th className="py-3.5 px-4">Lookahead Categories</th>
                <th className="py-3.5 px-4">Float</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-sans">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-500">
                    No lookahead activities match the active filter.
                  </td>
                </tr>
              ) : (
                filteredItems.map((act) => (
                  <tr key={act.id} className="hover:bg-slate-900/50 transition">
                    <td className="py-3 px-4">
                      <div className="font-bold text-white flex items-center gap-2">
                        {act.description}
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        WP: {act.workpack_number || 'Standalone'} {act.unit_code && `• Unit ${act.unit_code}`}
                      </div>
                    </td>

                    <td className="py-3 px-4 text-xs">
                      <span className="px-2 py-0.5 rounded font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                        {act.discipline_name || 'General'}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-xs font-mono text-slate-300">
                      <div>{act.planned_start || '--'} → {act.planned_end || '--'}</div>
                      <div className="text-slate-500">{act.duration_hours}h</div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="w-20">
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

                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1">
                        {act.categories.map((cat) => (
                          <span
                            key={cat}
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              cat === 'CRITICAL'
                                ? 'bg-red-950 text-red-400 border border-red-800'
                                : cat === 'BLOCKED'
                                ? 'bg-purple-950 text-purple-300 border border-purple-800'
                                : cat === 'OVERDUE'
                                ? 'bg-rose-950 text-rose-400 border border-rose-800'
                                : cat === 'STARTING'
                                ? 'bg-cyan-950 text-cyan-400 border border-cyan-800'
                                : cat === 'CONTINUING'
                                ? 'bg-amber-950 text-amber-400 border border-amber-800'
                                : 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                            }`}
                          >
                            {cat}
                          </span>
                        ))}
                      </div>
                    </td>

                    <td className="py-3 px-4 text-xs font-mono">
                      {act.total_float !== null ? (
                        <span className={act.total_float <= 0 ? 'text-rose-400 font-bold' : 'text-slate-400'}>
                          {act.total_float}h
                        </span>
                      ) : (
                        <span className="text-slate-600">--</span>
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
