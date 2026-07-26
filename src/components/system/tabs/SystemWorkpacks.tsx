'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export function SystemWorkpacks({ systemId }: { systemId: string }) {
  const [workpacks, setWorkpacks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/workpacks?system_id=${systemId}`)
      .then((r) => r.json())
      .then((d) => setWorkpacks(d.data ?? []))
      .finally(() => setLoading(false));
  }, [systemId]);

  if (loading) return <div className="text-gray-500">Loading…</div>;

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">WP ID</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Title</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Discipline</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Progress</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {workpacks.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-4 py-8 text-center text-gray-500">No workpacks for this system.</td>
            </tr>
          ) : (
            workpacks.map((w) => (
              <tr key={w.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm font-medium text-gray-900">
                  <Link href={`/workpacks/${w.id}`} className="text-blue-600 hover:underline">
                    {w.workpack_id_code ?? w.id.slice(0, 8)}
                  </Link>
                </td>
                <td className="px-4 py-3 text-sm text-gray-700">{w.title}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{w.discipline?.name ?? '—'}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{w.status}</td>
                <td className="px-4 py-3">
                  <div className="w-24 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full" style={{ width: `${w.overall_progress ?? 0}%` }} />
                  </div>
                  <span className="text-xs text-gray-500">{(w.overall_progress ?? 0)}%</span>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
