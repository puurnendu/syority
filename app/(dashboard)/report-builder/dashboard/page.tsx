'use client';

/**
 * M7.6B — Report Engine Execution Dashboard
 *
 * Tenant-level dashboard showing generation metrics, popular reports,
 * active schedules, and recent artifacts.
 */

import { useState, useEffect, useCallback } from 'react';

interface Metrics {
  today: { generated: number; failed: number };
  week: { generated: number; failed: number };
  month: { generated: number };
  avgDurationMs: number;
  pendingQueue: number;
  activeSchedules: number;
}

interface PopularReport {
  definitionId: string;
  name: string;
  category: string;
  count: number;
}

interface TopSchedule {
  id: string;
  name: string;
  frequency: string;
  runCount: number;
  lastRun: string | null;
  definitionName: string;
}

export default function ReportDashboardPage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [popular, setPopular] = useState<PopularReport[]>([]);
  const [schedules, setSchedules] = useState<TopSchedule[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [mRes, pRes] = await Promise.all([
        fetch('/api/report-builder/dashboard/metrics').then((r) => r.json()),
        fetch('/api/report-builder/dashboard/popular').then((r) => r.json()),
      ]);
      setMetrics(mRes.metrics);
      setPopular(pRes.popularReports ?? []);
      setSchedules(pRes.topSchedules ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="p-8 text-center text-gray-400">Loading dashboard…</div>;

  return (
    <div className="space-y-8 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Report Engine Dashboard</h1>
          <p className="text-sm text-gray-400 mt-1">Generation metrics, delivery, and performance</p>
        </div>
        <button onClick={load} className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-sm rounded-lg transition">
          ↻ Refresh
        </button>
      </div>

      {/* Metric Cards */}
      {metrics && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <MetricCard label="Today" value={metrics.today.generated} accent="#3B82F6" />
          <MetricCard label="This Week" value={metrics.week.generated} accent="#8B5CF6" />
          <MetricCard label="This Month" value={metrics.month.generated} accent="#6366F1" />
          <MetricCard label="Avg Duration" value={`${(metrics.avgDurationMs / 1000).toFixed(1)}s`} accent="#059669" />
          <MetricCard label="Queue" value={metrics.pendingQueue} accent={metrics.pendingQueue > 10 ? '#DC2626' : '#F59E0B'} />
          <MetricCard label="Active Schedules" value={metrics.activeSchedules} accent="#0EA5E9" />
        </div>
      )}

      {/* Failure Alert */}
      {metrics && metrics.today.failed > 0 && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm flex items-center gap-2">
          ⚠️ <strong>{metrics.today.failed}</strong> failed generation(s) today.
          <a href="/report-builder/history" className="underline ml-2">View history →</a>
        </div>
      )}

      {/* Popular Reports & Top Schedules */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Popular Reports */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-5">
          <h2 className="text-lg font-semibold text-white mb-4">📊 Most Used Reports (30 days)</h2>
          {popular.length === 0 ? (
            <p className="text-gray-500 text-sm">No reports generated yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 border-b border-white/10">
                  <th className="text-left pb-2">Report</th>
                  <th className="text-left pb-2">Category</th>
                  <th className="text-right pb-2">Count</th>
                </tr>
              </thead>
              <tbody>
                {popular.map((r) => (
                  <tr key={r.definitionId} className="border-b border-white/5 hover:bg-white/5">
                    <td className="py-2 text-white">{r.name}</td>
                    <td className="py-2 text-gray-400">{r.category}</td>
                    <td className="py-2 text-right text-white font-mono">{r.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Top Schedules */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-5">
          <h2 className="text-lg font-semibold text-white mb-4">🕐 Most Active Schedules</h2>
          {schedules.length === 0 ? (
            <p className="text-gray-500 text-sm">No active schedules.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 border-b border-white/10">
                  <th className="text-left pb-2">Schedule</th>
                  <th className="text-left pb-2">Frequency</th>
                  <th className="text-right pb-2">Runs</th>
                </tr>
              </thead>
              <tbody>
                {schedules.map((s) => (
                  <tr key={s.id} className="border-b border-white/5 hover:bg-white/5">
                    <td className="py-2 text-white">{s.name}</td>
                    <td className="py-2">
                      <span className="px-2 py-0.5 text-xs rounded-full bg-blue-500/20 text-blue-400">{s.frequency}</span>
                    </td>
                    <td className="py-2 text-right text-white font-mono">{s.runCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

// ── MetricCard Component ────────────────────────────────────────────────────

function MetricCard({ label, value, accent }: { label: string; value: string | number; accent: string }) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-4 hover:bg-white/[0.07] transition">
      <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">{label}</div>
      <div className="text-2xl font-bold" style={{ color: accent }}>{value}</div>
    </div>
  );
}
