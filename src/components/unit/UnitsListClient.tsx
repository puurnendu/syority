'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

type UnitRow = {
  id: string;
  code: string | null;
  name: string;
  plant: { id: string; name: string; code: string | null } | null;
  site: { id: string; name: string; code: string | null } | null;
  systems_count: number;
  equipment_count: number;
  workpacks_count: number;
  planning_progress: number;
  status: string;
};

type EventRow = { id: string; name: string; code: string; status: string };
type SiteRow = { id: string; name: string; code: string | null };
type PlantRow = { id: string; name: string; code: string | null };

export function UnitsListClient({
  events,
  sites,
  plants,
  canCreate,
}: {
  events: EventRow[];
  sites: SiteRow[];
  plants: PlantRow[];
  canCreate: boolean;
}) {
  const [units, setUnits] = useState<UnitRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [eventId, setEventId] = useState('');
  const [siteId, setSiteId] = useState('');
  const [plantId, setPlantId] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (eventId) params.set('event_id', eventId);
    if (siteId) params.set('site_id', siteId);
    if (plantId) params.set('plant_id', plantId);
    if (statusFilter) params.set('status', statusFilter);
    if (search.trim()) params.set('search', search.trim());
    const res = await fetch(`/api/units?${params.toString()}`);
    if (res.ok) {
      const j = await res.json();
      setUnits(j.data ?? []);
    }
    setLoading(false);
  }, [eventId, siteId, plantId, statusFilter, search]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="Search units..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm w-48"
        />
        <select
          value={eventId}
          onChange={(e) => setEventId(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="">All events</option>
          {events.map((e) => (
            <option key={e.id} value={e.id}>
              {e.code ?? e.name}
            </option>
          ))}
        </select>
        <select
          value={siteId}
          onChange={(e) => setSiteId(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="">All sites</option>
          {sites.map((s) => (
            <option key={s.id} value={s.id}>
              {s.code ?? s.name}
            </option>
          ))}
        </select>
        <select
          value={plantId}
          onChange={(e) => setPlantId(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="">All plants</option>
          {plants.map((p) => (
            <option key={p.id} value={p.id}>
              {p.code ?? p.name}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="">All statuses</option>
          <option value="Not Started">Not Started</option>
          <option value="In Planning">In Planning</option>
          <option value="Planned">Planned</option>
        </select>
        {canCreate && (
          <Link
            href="/planning/units/new"
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
          >
            + New Unit
          </Link>
        )}
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500 text-sm">Loading units...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Unit Code
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Unit Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Plant
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Systems Count
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Equipment Count
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Workpacks Count
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
              <tbody className="divide-y divide-gray-100">
                {units.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-gray-900">{u.code ?? '—'}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">{u.name}</td>
                    <td className="px-4 py-3 text-gray-600">{u.plant?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{u.systems_count}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{u.equipment_count}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{u.workpacks_count}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full bg-blue-500"
                            style={{ width: `${u.planning_progress}%` }}
                          />
                        </div>
                        <span className="text-gray-700">{u.planning_progress}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                          u.status === 'Planned'
                            ? 'bg-green-100 text-green-800'
                            : u.status === 'In Planning'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {u.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/planning/units/${u.id}`}
                        className="text-blue-600 hover:underline text-xs font-medium"
                      >
                        View →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!loading && units.length === 0 && (
          <div className="p-8 text-center text-gray-500 text-sm">No units found.</div>
        )}
      </div>
    </div>
  );
}
