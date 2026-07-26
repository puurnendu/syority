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

export function UnitOverview({
  unitId,
  initialUnit,
  canEdit,
}: {
  unitId: string;
  initialUnit: any;
  canEdit: boolean;
}) {
  const [systems, setSystems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/units/${unitId}/systems`)
      .then((r) => r.json())
      .then((d) => setSystems(d.data ?? []))
      .finally(() => setLoading(false));
  }, [unitId]);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900">Unit engineering data</h3>
        </div>
        <div className="p-6">
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <dt className="text-xs font-medium text-gray-500 uppercase">Code</dt>
              <dd className="mt-1 text-sm text-gray-900">{initialUnit?.code ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-gray-500 uppercase">Name</dt>
              <dd className="mt-1 text-sm text-gray-900">{initialUnit?.name ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-gray-500 uppercase">Plant</dt>
              <dd className="mt-1 text-sm text-gray-900">{initialUnit?.plant?.name ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-gray-500 uppercase">Site</dt>
              <dd className="mt-1 text-sm text-gray-900">{initialUnit?.site?.name ?? '—'}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs font-medium text-gray-500 uppercase">Description</dt>
              <dd className="mt-1 text-sm text-gray-700">{initialUnit?.description ?? '—'}</dd>
            </div>
          </dl>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900">System summary</h3>
        </div>
        <div className="p-6">
          {loading ? (
            <div className="text-gray-500 text-sm">Loading systems…</div>
          ) : systems.length === 0 ? (
            <p className="text-sm text-gray-500">No systems in this unit.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {systems.map((s) => {
                const barColor = progressBarColor(s.planningProgress ?? 0);
                return (
                  <Link
                    key={s.systemId}
                    href={`/planning/systems/${s.systemId}`}
                    className="block border border-gray-200 rounded-xl p-4 hover:border-blue-300 hover:shadow-sm transition-all"
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <span className="font-mono text-sm font-semibold text-gray-900">
                        {s.systemCode || '—'}
                      </span>
                      <span className="text-xs text-gray-400">→</span>
                    </div>
                    <p className="text-sm font-medium text-gray-800 mb-3">{s.systemName}</p>
                    <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden mb-2">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${s.planningProgress ?? 0}%`,
                          backgroundColor: barColor,
                        }}
                      />
                    </div>
                    <p className="text-xs text-gray-600 mb-2">{s.planningProgress ?? 0}% Planning</p>
                    <div className="flex items-center gap-2 flex-wrap text-xs text-gray-500">
                      <span>{s.workpackCount ?? 0} WPs</span>
                      <span>·</span>
                      <span>{s.activityCount ?? 0} Activities</span>
                      <span
                        className={`px-2 py-0.5 rounded-full font-medium ${statusBadgeClass(s.status ?? '')}`}
                      >
                        {s.status ?? '—'}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
