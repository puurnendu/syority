'use client';

import { useEffect, useState } from 'react';

interface ElectricalItem {
  description: string;
  uom: string;
  quantity: number;
  justification: string;
  activityCodes: string[];
}

export function ElectricalRequirementsSection({ workpackId }: { workpackId: string }) {
  const [items, setItems] = useState<ElectricalItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/workpacks/${workpackId}/electrical-requirements`)
      .then((r) => r.json())
      .then((data) => {
        setItems(data.items ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [workpackId]);

  if (loading) return <div className="p-4 text-sm text-gray-500">Loading electrical requirements...</div>;
  if (!items.length)
    return (
      <div className="p-6 text-center text-gray-400 text-sm">
        No electrical materials found. Tag materials as &quot;Electrical&quot; category in your activities to populate this section.
      </div>
    );

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-gray-900">Section I — Electrical Requirements</h3>
        <span className="text-xs text-gray-500">
          {items.length} item(s) · auto-populated from activity materials
        </span>
      </div>
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-2 text-left font-medium text-gray-700 w-8">S.No</th>
            <th className="px-4 py-2 text-left font-medium text-gray-700">Electrical Item / Equipment</th>
            <th className="px-4 py-2 text-left font-medium text-gray-700 w-20">UOM</th>
            <th className="px-4 py-2 text-left font-medium text-gray-700 w-20">Qty</th>
            <th className="px-4 py-2 text-left font-medium text-gray-700">Requirement Note</th>
            <th className="px-4 py-2 text-left font-medium text-gray-700 w-32">Activity Ref</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-100">
          {items.map((item, i) => (
            <tr key={i} className="hover:bg-gray-50">
              <td className="px-4 py-2 text-gray-500">{i + 1}</td>
              <td className="px-4 py-2 font-medium text-gray-900">{item.description}</td>
              <td className="px-4 py-2 text-gray-600">{item.uom}</td>
              <td className="px-4 py-2 text-gray-600">{item.quantity}</td>
              <td className="px-4 py-2 text-gray-500 text-xs italic">{item.justification}</td>
              <td className="px-4 py-2 text-gray-400 text-xs">{item.activityCodes.join(', ') || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
