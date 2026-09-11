'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

type Row = {
  id: string;
  workpack_number: string | null;
  title: string;
  organization_name: string | null;
  site_name: string | null;
  status: string;
  work_type: string | null;
  equipment: string | null;
  unit: string | null;
  system: string | null;
  discipline: string | null;
  planned_start_date: string | null;
  planned_end_date: string | null;
  classification: string;
  candidate_event: string;
  review_state: string;
  priority: string;
};

export default function IdentityReviewQueueClient() {
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    classification: '',
    review_state: '',
    status: '',
    work_type: '',
    priority: '',
  });

  useEffect(() => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v) params.set(k, v);
    });
    fetch(`/api/workpacks/identity-review?${params}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.error) setError(j.error);
        else setRows(j.data ?? []);
      })
      .catch(() => setError('Unable to load Event review queue'));
  }, [filters]);

  const classifications = useMemo(() => [...new Set(rows.map((r) => r.classification))], [rows]);

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Workpack Event Review</h1>
        <p className="text-sm text-gray-500 mt-1">
          Review Event-less Workpacks. Candidates are hints only. Event assignment requires an explicit
          human decision. Nothing is assigned automatically.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
        <select className="border rounded px-2 py-1 text-sm" value={filters.classification} onChange={(e) => setFilters({ ...filters, classification: e.target.value })}>
          <option value="">Classification</option>
          {classifications.map((c) => <option key={c} value={c}>{c}</option>)}
          <option value="CONFLICTING_CHILD_EVENT">CONFLICTING_CHILD_EVENT</option>
          <option value="INSUFFICIENT">INSUFFICIENT</option>
          <option value="NON_STO">NON_STO</option>
        </select>
        <select className="border rounded px-2 py-1 text-sm" value={filters.review_state} onChange={(e) => setFilters({ ...filters, review_state: e.target.value })}>
          <option value="">Review status</option>
          {['UNREVIEWED', 'CANDIDATE', 'HUMAN_CONFIRMED', 'APPLIED', 'REJECTED', 'QUARANTINED', 'DEFERRED'].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <input className="border rounded px-2 py-1 text-sm" placeholder="Work type" value={filters.work_type} onChange={(e) => setFilters({ ...filters, work_type: e.target.value })} />
        <input className="border rounded px-2 py-1 text-sm" placeholder="Workpack status" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })} />
        <select className="border rounded px-2 py-1 text-sm" value={filters.priority} onChange={(e) => setFilters({ ...filters, priority: e.target.value })}>
          <option value="">Priority</option>
          <option value="P0">P0</option>
          <option value="P1">P1</option>
          <option value="P2">P2</option>
        </select>
      </div>

      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

      <div className="bg-white shadow rounded-lg overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              {['Priority', 'Workpack No.', 'Title', 'Organisation', 'Site', 'Status', 'Work Type', 'Equipment', 'Unit', 'System', 'Discipline', 'Planned Start', 'Planned Finish', 'Classification', 'Candidate Event', 'Review Status'].map((h) => (
                <th key={h} className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.length === 0 ? (
              <tr><td colSpan={16} className="px-3 py-8 text-center text-gray-500">No Event-less Workpacks in this organisation.</td></tr>
            ) : rows.map((r) => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="px-3 py-2 font-medium">{r.priority}</td>
                <td className="px-3 py-2">{r.workpack_number || '—'}</td>
                <td className="px-3 py-2">
                  <Link className="text-blue-700 hover:underline" href={`/workpacks/identity-review/${r.id}`}>{r.title}</Link>
                </td>
                <td className="px-3 py-2">{r.organization_name || '—'}</td>
                <td className="px-3 py-2">{r.site_name || '—'}</td>
                <td className="px-3 py-2">{r.status}</td>
                <td className="px-3 py-2">{r.work_type || '—'}</td>
                <td className="px-3 py-2">{r.equipment || '—'}</td>
                <td className="px-3 py-2">{r.unit || '—'}</td>
                <td className="px-3 py-2">{r.system || '—'}</td>
                <td className="px-3 py-2">{r.discipline || '—'}</td>
                <td className="px-3 py-2 whitespace-nowrap">{r.planned_start_date ? String(r.planned_start_date).slice(0, 10) : '—'}</td>
                <td className="px-3 py-2 whitespace-nowrap">{r.planned_end_date ? String(r.planned_end_date).slice(0, 10) : '—'}</td>
                <td className="px-3 py-2">{r.classification}</td>
                <td className="px-3 py-2">{r.candidate_event}</td>
                <td className="px-3 py-2">{r.review_state}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
