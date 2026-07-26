'use client';

import { useState, useEffect } from 'react';

export function SystemLineList({ systemId }: { systemId: string }) {
  const [lines, setLines] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/line-lists?system_id=${systemId}`).then((r) => r.json()).then((d) => setLines(d.data ?? [])).finally(() => setLoading(false));
  }, [systemId]);

  if (loading) return <div className="text-gray-500">Loading…</div>;

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Line No</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fluid</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Class</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Design P</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Design T</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Test P</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Joints</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {lines.length === 0 ? (
            <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">No lines for this system.</td></tr>
          ) : (
            lines.map((l) => (
              <tr key={l.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm font-medium text-gray-900">{l.line_number}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{l.fluid_service_code ?? '—'}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{l.pipe_class ?? '—'}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{l.design_pressure_barg ?? '—'}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{l.design_temp_c ?? '—'}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{l.test_pressure_barg ?? '—'}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{l.total_joint_count ?? 0}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
