'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';

type SystemRow = {
  id: string;
  code: string | null;
  name: string;
  unit: { id: string; name: string; code: string | null };
  site: { id: string; name: string; code: string | null };
  criticality: string | null;
  status: string;
  _count: { blinds: number; gaskets: number; workpacks: number };
};

type EventRow = { id: string; name: string; code: string; status: string };
type SiteRow = { id: string; name: string; code: string | null };

export function SystemsListClient({
  initialSystems,
  events,
  sites,
  eventSystemMap,
  canCreate,
}: {
  initialSystems: SystemRow[];
  events: EventRow[];
  sites: SiteRow[];
  eventSystemMap: Record<string, string[]>;
  canCreate: boolean;
}) {
  const [search, setSearch] = useState('');
  const [unitFilter, setUnitFilter] = useState('');
  const [criticalityFilter, setCriticalityFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [eventFilter, setEventFilter] = useState('');
  const [sortKey, setSortKey] = useState<'code' | 'name' | 'unit' | 'criticality' | 'blinds' | 'workpacks'>('code');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const units = useMemo(() => {
    const set = new Map<string, string>();
    initialSystems.forEach((s) => {
      if (s.unit?.name) set.set(s.unit.id, s.unit.name);
    });
    return [...set.entries()].map(([id, name]) => ({ id, name }));
  }, [initialSystems]);

  const filtered = useMemo(() => {
    let list = [...initialSystems];
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (s) =>
          (s.code ?? '').toLowerCase().includes(q) ||
          s.name.toLowerCase().includes(q) ||
          (s.unit?.name ?? '').toLowerCase().includes(q)
      );
    }
    if (unitFilter) list = list.filter((s) => s.unit?.id === unitFilter);
    if (criticalityFilter) list = list.filter((s) => (s.criticality ?? '') === criticalityFilter);
    if (statusFilter) list = list.filter((s) => s.status === statusFilter);
    if (eventFilter) {
      const systemIds = eventSystemMap[eventFilter];
      if (systemIds?.length) list = list.filter((s) => systemIds.includes(s.id));
      else list = [];
    }
    list.sort((a, b) => {
      let va: string | number = '';
      let vb: string | number = '';
      if (sortKey === 'code') {
        va = a.code ?? '';
        vb = b.code ?? '';
      } else if (sortKey === 'name') {
        va = a.name;
        vb = b.name;
      } else if (sortKey === 'unit') {
        va = a.unit?.name ?? '';
        vb = b.unit?.name ?? '';
      } else if (sortKey === 'criticality') {
        va = a.criticality ?? '';
        vb = b.criticality ?? '';
      } else if (sortKey === 'blinds') {
        va = a._count.blinds;
        vb = b._count.blinds;
      } else {
        va = a._count.workpacks;
        vb = b._count.workpacks;
      }
      const cmp = typeof va === 'number' ? va - (vb as number) : String(va).localeCompare(String(vb));
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [initialSystems, search, unitFilter, criticalityFilter, statusFilter, eventFilter, sortKey, sortDir, eventSystemMap]);

  const th = (key: typeof sortKey, label: string) => (
    <th
      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
      onClick={() => {
        setSortKey(key);
        setSortDir((d) => (sortKey === key ? (d === 'asc' ? 'desc' : 'asc') : 'asc'));
      }}
    >
      {label} {sortKey === key ? (sortDir === 'asc' ? '↑' : '↓') : ''}
    </th>
  );

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap gap-3 items-center">
        <input
          type="text"
          placeholder="Search code, name, unit..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm w-64"
        />
        <select
          value={unitFilter}
          onChange={(e) => setUnitFilter(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="">All units</option>
          {units.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
        <select
          value={eventFilter}
          onChange={(e) => setEventFilter(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="">All events</option>
          {events.map((e) => (
            <option key={e.id} value={e.id}>
              {e.code} – {e.name}
            </option>
          ))}
        </select>
        <select
          value={criticalityFilter}
          onChange={(e) => setCriticalityFilter(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="">All criticality</option>
          <option value="High">High</option>
          <option value="Medium">Medium</option>
          <option value="Low">Low</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="">All status</option>
          <option value="Active">Active</option>
          <option value="Inactive">Inactive</option>
        </select>
      </div>
      <div className="bg-white shadow rounded-xl overflow-hidden border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {th('code', 'Code')}
              {th('name', 'Name')}
              {th('unit', 'Unit')}
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Criticality</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              {th('blinds', 'Blinds')}
              {th('workpacks', 'Workpacks')}
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Gaskets</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                  No systems match filters.
                </td>
              </tr>
            ) : (
              filtered.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                    <Link href={`/planning/systems/${s.id}`} className="text-blue-600 hover:underline">
                      {s.code ?? '—'}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">{s.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{s.unit?.name ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                        s.criticality === 'High'
                          ? 'bg-red-100 text-red-800'
                          : s.criticality === 'Medium'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {s.criticality ?? '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{s.status}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{s._count.blinds}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{s._count.workpacks}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{s._count.gaskets}</td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/planning/systems/${s.id}`}
                      className="text-blue-600 hover:underline text-sm font-medium"
                    >
                      Open
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
