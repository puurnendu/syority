'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

type DashboardStats = {
  total: number;
  matched: number;
  unmatched: number;
  pending_review: number;
  duplicates: number;
  resolved: number;
  rejected: number;
  by_department: Array<{ department: string | null; count: number }>;
  by_discipline: Array<{ discipline: string | null; count: number }>;
  by_priority: Array<{ priority: string; count: number }>;
  by_status: Array<{ status: string; count: number }>;
  recent_batches: Array<{ id: string; name: string; source_type: string; total_rows: number; created_at: string }>;
};

const PRIORITY_COLORS: Record<string, string> = {
  critical: 'bg-red-100 text-red-800',
  high: 'bg-orange-100 text-orange-800',
  medium: 'bg-amber-100 text-amber-800',
  low: 'bg-green-100 text-green-800',
  unclassified: 'bg-gray-100 text-gray-600',
};

const SOURCE_ICONS: Record<string, string> = {
  excel: '📊', csv: '📄', pdf: '📑', word: '📝', email: '📧',
  whatsapp: '💬', api: '🔌', cmms: '🔧', sap: '⚙️', maximo: '🏭',
  manual: '✍️', inspection: '🔍',
};

export default function EngineeringIssuesDashboard() {
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/engineering-issues/dashboard/stats')
      .then((r) => r.json())
      .then((d) => { setStats(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-20 text-gray-400">
        <svg className="animate-spin w-6 h-6 mr-2" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        Loading...
      </div>
    );
  }

  const s = stats!;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            🔧 Engineering Scope Intelligence
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Departments report → AI organizes → Planner validates → Planner decides scope
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/engineering-issues/import"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 shadow-sm"
          >
            📥 Import Issues
          </Link>
          <button
            onClick={() => router.push('/engineering-issues/manual')}
            className="px-4 py-2.5 border border-gray-300 text-gray-700 text-sm font-semibold rounded-lg hover:bg-gray-50"
          >
            ✍️ Manual Entry
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-8">
        {[
          { label: 'Total', value: s.total, color: 'text-gray-900', bg: 'bg-white' },
          { label: 'Matched', value: s.matched, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Unmatched', value: s.unmatched, color: 'text-red-500', bg: 'bg-red-50' },
          { label: 'Pending', value: s.pending_review, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Duplicates', value: s.duplicates, color: 'text-purple-600', bg: 'bg-purple-50' },
          { label: 'Resolved', value: s.resolved, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Rejected', value: s.rejected, color: 'text-gray-500', bg: 'bg-gray-50' },
        ].map((stat) => (
          <div key={stat.label} className={`${stat.bg} rounded-xl border border-gray-200 p-4 shadow-sm`}>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{stat.label}</p>
            <p className={`text-2xl font-bold mt-1 ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* By Department */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">By Department</h3>
          {s.by_department.length === 0 ? (
            <p className="text-sm text-gray-400">No data yet</p>
          ) : (
            <div className="space-y-2">
              {s.by_department.map((d) => (
                <div key={d.department} className="flex items-center justify-between">
                  <span className="text-sm text-gray-700">{d.department || 'Unknown'}</span>
                  <span className="text-sm font-semibold text-gray-900 bg-gray-100 px-2 py-0.5 rounded-full">
                    {d.count}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* By Discipline */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">By Discipline</h3>
          {s.by_discipline.length === 0 ? (
            <p className="text-sm text-gray-400">Run AI classification to populate</p>
          ) : (
            <div className="space-y-2">
              {s.by_discipline.map((d) => (
                <div key={d.discipline} className="flex items-center justify-between">
                  <span className="text-sm text-gray-700">{d.discipline || 'Unknown'}</span>
                  <span className="text-sm font-semibold text-gray-900 bg-gray-100 px-2 py-0.5 rounded-full">
                    {d.count}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* By Priority */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">By Priority</h3>
          {s.by_priority.length === 0 ? (
            <p className="text-sm text-gray-400">No data yet</p>
          ) : (
            <div className="space-y-2">
              {s.by_priority.map((p) => (
                <div key={p.priority} className="flex items-center justify-between">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${PRIORITY_COLORS[p.priority] || 'bg-gray-100 text-gray-600'}`}>
                    {p.priority}
                  </span>
                  <span className="text-sm font-semibold text-gray-900">{p.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent Batches */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-gray-900">Recent Imports</h3>
          <Link href="/engineering-issues/import" className="text-sm text-blue-600 hover:text-blue-800 font-medium">
            View All →
          </Link>
        </div>

        {s.recent_batches.length === 0 ? (
          <div className="text-center py-16 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
            <div className="text-5xl mb-4">📋</div>
            <p className="text-gray-600 font-medium">No issue batches imported yet</p>
            <p className="text-sm text-gray-400 mt-1">Import from Excel, PDF, Email, WhatsApp, CMMS, or enter manually</p>
            <Link
              href="/engineering-issues/import"
              className="mt-4 inline-block px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700"
            >
              Import Issues
            </Link>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                <tr>
                  <th className="px-4 py-3 text-left">Batch</th>
                  <th className="px-4 py-3 text-left">Source</th>
                  <th className="px-4 py-3 text-right">Issues</th>
                  <th className="px-4 py-3 text-left">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {s.recent_batches.map((b) => (
                  <tr
                    key={b.id}
                    onClick={() => router.push(`/engineering-issues/${b.id}`)}
                    className="hover:bg-gray-50 cursor-pointer"
                  >
                    <td className="px-4 py-3 font-medium text-gray-900">{b.name}</td>
                    <td className="px-4 py-3 text-gray-600">
                      <span className="mr-1">{SOURCE_ICONS[b.source_type] || '📄'}</span>
                      {b.source_type}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-900 font-semibold">{b.total_rows}</td>
                    <td className="px-4 py-3 text-gray-500">
                      {new Date(b.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
