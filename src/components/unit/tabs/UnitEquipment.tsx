'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

type Group = {
  systemId: string;
  systemCode: string;
  systemName: string;
  equipment: Array<{
    id: string;
    tag: string;
    equipmentName: string;
    system: string;
    type: string;
    standard: string;
    designPressure: number | null;
    designTemp: number | null;
    linkedWp: { id: string; code: string | null; title: string } | null;
    status: string;
  }>;
};

export function UnitEquipment({ unitId }: { unitId: string }) {
  const [data, setData] = useState<{ grouped: Group[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetch(`/api/units/${unitId}/equipment`)
      .then((r) => r.json())
      .then((d) => setData(d.data ?? { grouped: [] }))
      .finally(() => setLoading(false));
  }, [unitId]);

  const toggleGroup = (systemId: string) => {
    setOpenGroups((prev) => ({ ...prev, [systemId]: !prev[systemId] }));
  };

  if (loading) return <div className="text-gray-500 text-sm">Loading equipment…</div>;

  const grouped = data?.grouped ?? [];
  if (grouped.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-500 text-sm">
        No equipment in this unit. Equipment is populated from the Asset register (linked to systems).
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-500 mb-4">
        Read-only view from Asset register. Grouped by system.
      </p>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {grouped.map((grp) => {
          const isOpen = openGroups[grp.systemId] !== false;
          return (
            <div key={grp.systemId} className="border-b border-gray-100 last:border-b-0">
              <button
                type="button"
                onClick={() => toggleGroup(grp.systemId)}
                className="w-full px-4 py-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100 text-left"
              >
                <span className="font-medium text-sm text-gray-900">
                  {grp.systemName} ({grp.systemCode})
                </span>
                <span className="text-xs text-gray-500">
                  {grp.equipment.length} item{grp.equipment.length !== 1 ? 's' : ''}
                </span>
              </button>
              {isOpen && (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Tag</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Equipment Name</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">System</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Standard</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Design Press</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Design Temp</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Linked WP</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {grp.equipment.map((eq) => (
                        <tr key={eq.id} className="hover:bg-gray-50">
                          <td className="px-4 py-2 text-sm">
                            <Link href={`/asset-register/${eq.id}`} className="text-blue-600 hover:underline font-mono">
                              {eq.tag}
                            </Link>
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-900">{eq.equipmentName}</td>
                          <td className="px-4 py-2 text-sm text-gray-600">{eq.system}</td>
                          <td className="px-4 py-2 text-sm text-gray-600">{eq.type || '—'}</td>
                          <td className="px-4 py-2 text-sm text-gray-600">{eq.standard || '—'}</td>
                          <td className="px-4 py-2 text-sm text-gray-600">{eq.designPressure ?? '—'}</td>
                          <td className="px-4 py-2 text-sm text-gray-600">{eq.designTemp ?? '—'}</td>
                          <td className="px-4 py-2 text-sm">
                            {eq.linkedWp ? (
                              <Link href={`/workpacks/${eq.linkedWp.id}`} className="text-blue-600 hover:underline">
                                {eq.linkedWp.code ?? eq.linkedWp.title}
                              </Link>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-600">{eq.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
