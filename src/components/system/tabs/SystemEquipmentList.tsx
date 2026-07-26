'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export function SystemEquipmentList({ systemId }: { systemId: string }) {
  const [assets, setAssets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/assets?system_id=${systemId}`).then((r) => r.json()).then((d) => setAssets(d.data ?? [])).finally(() => setLoading(false));
  }, [systemId]);

  if (loading) return <div className="text-gray-500">Loading…</div>;

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tag</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Design P</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Design T</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {assets.length === 0 ? (
            <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">No equipment for this system.</td></tr>
          ) : (
            assets.map((a) => (
              <tr key={a.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm font-medium text-gray-900">
                  <Link href={`/asset-register/${a.id}`} className="text-blue-600 hover:underline">{a.tag_number}</Link>
                </td>
                <td className="px-4 py-3 text-sm text-gray-700">{a.name}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{a.asset_type ?? '—'}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{a.design_pressure_barg ?? '—'}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{a.design_temp_c ?? '—'}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{a.is_active !== false ? 'Active' : 'Inactive'}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
