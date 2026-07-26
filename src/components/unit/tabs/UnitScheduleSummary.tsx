'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

function progressBarColor(pct: number): string {
  if (pct === 0) return '#475569';
  if (pct < 50) return '#D97706';
  if (pct < 90) return '#2563EB';
  if (pct < 100) return '#7C3AED';
  return '#059669';
}

function statusBadgeClass(status: string): string {
  if (status === 'Planned') return 'bg-green-100 text-green-800';
  if (status === 'In Planning') return 'bg-amber-100 text-amber-800';
  return 'bg-gray-100 text-gray-700';
}

type ScheduleRow = {
  systemId: string;
  systemCode: string;
  systemName: string;
  planningProgress: number;
  workpackCount: number;
  activityCount: number;
  dateRange: { earliestStart: string; latestFinish: string } | null;
  status: string;
};

export function UnitScheduleSummary({ unitId }: { unitId: string }) {
  const [rows, setRows] = useState<ScheduleRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/units/${unitId}/schedule`)
      .then((r) => r.json())
      .then((d) => setRows(d.data ?? []))
      .finally(() => setLoading(false));
  }, [unitId]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <Link
          href="/schedule"
          className="text-sm font-medium text-blue-600 hover:underline"
        >
          Open Full TA Schedule →
        </Link>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                System name
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                Planning Progress %
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                Workpack count
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                Activity count
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Date range
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500 text-sm">
                  Loading…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500 text-sm">
                  No systems in this unit.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.systemId} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link
                      href={`/planning/systems/${row.systemId}`}
                      className="text-sm font-medium text-blue-600 hover:underline"
                    >
                      {row.systemName}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-24 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${row.planningProgress}%`,
                            backgroundColor: progressBarColor(row.planningProgress),
                          }}
                        />
                      </div>
                      <span className="text-sm text-gray-700">{row.planningProgress}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-gray-600">
                    {row.workpackCount}
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-gray-600">
                    {row.activityCount}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {row.dateRange
                      ? `${new Date(row.dateRange.earliestStart).toLocaleDateString('en-GB')} → ${new Date(row.dateRange.latestFinish).toLocaleDateString('en-GB')}`
                      : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusBadgeClass(row.status)}`}
                    >
                      {row.status}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
