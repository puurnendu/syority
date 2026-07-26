'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

type ConstraintRow = {
  id: string;
  constraint_number: string | null;
  type: string | null;
  title: string;
  raised: string | null;
  status: string | null;
  owner: { id: string; name: string | null; email: string | null } | null;
  workpack: { id: string; workpack_id_code: string | null; title: string } | null;
  system: { id: string; code: string | null; name: string } | null;
  dueDate: string | null;
};

export function UnitConstraints({ unitId }: { unitId: string }) {
  const [constraints, setConstraints] = useState<ConstraintRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/units/${unitId}/constraints`)
      .then((r) => r.json())
      .then((d) => setConstraints(d.data ?? []))
      .finally(() => setLoading(false));
  }, [unitId]);

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-gray-900">Open constraints in this unit</h3>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Raised</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Owner</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Workpack</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">System</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Due Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-gray-500 text-sm">
                  Loading…
                </td>
              </tr>
            ) : constraints.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-gray-500 text-sm">
                  No open constraints in this unit.
                </td>
              </tr>
            ) : (
              constraints.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs text-gray-900">
                    {c.constraint_number ?? c.id.slice(0, 8)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{c.type ?? '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {c.raised ? new Date(c.raised).toLocaleDateString('en-GB') : '—'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{c.status ?? '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {c.owner?.name ?? c.owner?.email ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {c.workpack ? (
                      <Link href={`/workpacks/${c.workpack.id}`} className="text-blue-600 hover:underline">
                        {c.workpack.workpack_id_code ?? c.workpack.title}
                      </Link>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {c.system?.name ?? c.system?.code ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {c.dueDate ? new Date(c.dueDate).toLocaleDateString('en-GB') : '—'}
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
