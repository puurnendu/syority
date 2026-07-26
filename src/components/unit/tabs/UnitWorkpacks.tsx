'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

export function UnitWorkpacks({ unitId }: { unitId: string }) {
  const [workpacks, setWorkpacks] = useState<any[]>([]);
  const [systems, setSystems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [systemId, setSystemId] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [disciplineId, setDisciplineId] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (systemId) params.set('system_id', systemId);
    if (statusFilter) params.set('status', statusFilter);
    if (disciplineId) params.set('discipline_id', disciplineId);
    fetch(`/api/units/${unitId}/workpacks?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => setWorkpacks(d.data ?? []))
      .finally(() => setLoading(false));
  }, [unitId, systemId, statusFilter, disciplineId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    fetch(`/api/units/${unitId}/systems`)
      .then((r) => r.json())
      .then((d) => setSystems(d.data ?? []))
      .catch(() => {});
  }, [unitId]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={systemId}
          onChange={(e) => setSystemId(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="">All systems</option>
          {systems.map((s) => (
            <option key={s.systemId} value={s.systemId}>
              {s.systemCode ?? s.systemName}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="">All statuses</option>
          <option value="draft">Draft</option>
          <option value="under_review">Under Review</option>
          <option value="approved">Approved</option>
          <option value="issued">Issued</option>
          <option value="closed">Closed</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <input
          type="text"
          placeholder="Discipline ID filter"
          value={disciplineId}
          onChange={(e) => setDisciplineId(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm w-40"
        />
      </div>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">WP ID</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Title</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">System</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Equipment</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Discipline</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Open</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-500 text-sm">
                  Loading…
                </td>
              </tr>
            ) : workpacks.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-500 text-sm">
                  No workpacks in this unit.
                </td>
              </tr>
            ) : (
              workpacks.map((w) => (
                <tr key={w.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-sm text-gray-900">
                    {w.workpack_id_code ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{w.title}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {w.system?.name ?? w.system?.code ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {w.equipment?.tag ?? w.equipment?.name ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {w.discipline?.name ?? w.discipline?.code ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{w.status ?? '—'}</td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/workpacks/${w.id}`}
                      className="text-xs font-medium text-blue-600 hover:underline"
                    >
                      Open →
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
