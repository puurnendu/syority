'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

function statusBadgeClass(status: string): string {
  if (status === 'Planned') return 'bg-green-100 text-green-800';
  if (status === 'In Planning') return 'bg-amber-100 text-amber-800';
  return 'bg-gray-100 text-gray-700';
}

export function UnitSystems({ unitId, canManage }: { unitId: string; canManage: boolean }) {
  const [systems, setSystems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/units/${unitId}/systems`)
      .then((r) => r.json())
      .then((d) => setSystems(d.data ?? []))
      .finally(() => setLoading(false));
  }, [unitId]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">Systems in this unit</h3>
        {canManage && (
          <Link
            href={`/planning/systems/new?unit_id=${unitId}`}
            className="text-sm font-medium text-blue-600 hover:underline"
          >
            + New System
          </Link>
        )}
      </div>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                System Code
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                System Name
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Criticality
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                Workpacks
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                Activities
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                Planning Progress %
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-gray-500 text-sm">
                  Loading…
                </td>
              </tr>
            ) : systems.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-gray-500 text-sm">
                  No systems in this unit.
                </td>
              </tr>
            ) : (
              systems.map((s) => (
                <tr key={s.systemId} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-sm text-gray-900">{s.systemCode ?? '—'}</td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                    <Link href={`/planning/systems/${s.systemId}`} className="text-blue-600 hover:underline">
                      {s.systemName}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{s.criticality ?? '—'}</td>
                  <td className="px-4 py-3 text-sm text-right text-gray-600">{s.workpackCount ?? 0}</td>
                  <td className="px-4 py-3 text-sm text-right text-gray-600">{s.activityCount ?? 0}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-blue-500"
                          style={{ width: `${s.planningProgress ?? 0}%` }}
                        />
                      </div>
                      <span className="text-sm text-gray-700">{s.planningProgress ?? 0}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusBadgeClass(s.status ?? '')}`}>
                      {s.status ?? '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/planning/systems/${s.systemId}`}
                      className="text-xs font-medium text-blue-600 hover:underline"
                    >
                      View →
                    </Link>
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
