'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import useSWR from 'swr';

const fetcher = async (url: string) => {
  const res = await fetch(url);
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || `Failed (${res.status})`);
  return data;
};

export default function PlanningTemplatesPage() {
  const [library, setLibrary] = useState('ALL');
  const [status, setStatus] = useState('ALL');
  const [q, setQ] = useState('');
  const qs = useMemo(() => {
    const p = new URLSearchParams();
    if (library !== 'ALL') p.set('library', library);
    if (status !== 'ALL') p.set('status', status);
    if (q.trim()) p.set('q', q.trim());
    return p.toString();
  }, [library, status, q]);

  const { data, error, isLoading, mutate } = useSWR(
    `/api/planning/templates?${qs}`,
    fetcher
  );
  const items = Array.isArray(data?.items) ? data.items : [];

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Workpack Template Library</h1>
          <p className="mt-1 text-sm text-slate-600">
            Platform, Tenant, and Knowledge libraries. Draft → Publish → Version. Instantiation
            never mutates the template.
          </p>
        </div>
        <Link
          href="/planning/templates/new"
          className="rounded bg-slate-900 px-3 py-2 text-sm text-white hover:bg-slate-800"
        >
          New draft template
        </Link>
      </div>

      <div className="flex flex-wrap gap-2">
        <select
          value={library}
          onChange={(e) => setLibrary(e.target.value)}
          className="rounded border border-slate-300 px-2 py-1.5 text-sm"
        >
          <option value="ALL">All libraries</option>
          <option value="PLATFORM">Platform Library</option>
          <option value="TENANT">Tenant Library</option>
          <option value="KNOWLEDGE">Knowledge Engine Library</option>
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded border border-slate-300 px-2 py-1.5 text-sm"
        >
          <option value="ALL">All statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="PUBLISHED">Published</option>
          <option value="DEPRECATED">Deprecated</option>
        </select>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name / equipment / job"
          className="min-w-[220px] rounded border border-slate-300 px-2 py-1.5 text-sm"
        />
        <button
          type="button"
          onClick={() => mutate()}
          className="rounded border border-slate-300 px-2 py-1.5 text-sm"
        >
          Refresh
        </button>
      </div>

      {error && (
        <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {(error as Error).message}
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Library</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Rev</th>
              <th className="px-3 py-2">Equipment</th>
              <th className="px-3 py-2">Job</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-slate-500">
                  Loading…
                </td>
              </tr>
            )}
            {!isLoading && items.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-slate-500">
                  No templates match filters.
                </td>
              </tr>
            )}
            {items.map((t: any) => (
              <tr key={t.id} className="border-t border-slate-100">
                <td className="px-3 py-2 font-medium text-slate-900">{t.name}</td>
                <td className="px-3 py-2 text-slate-600">{t.library_scope}</td>
                <td className="px-3 py-2 text-slate-600">{t.lifecycle_status}</td>
                <td className="px-3 py-2 text-slate-600">
                  r{t.revision}
                  {t.version_label ? ` (${t.version_label})` : ''}
                </td>
                <td className="px-3 py-2 text-slate-600">{t.equipment_type}</td>
                <td className="px-3 py-2 text-slate-600">{t.job_type}</td>
                <td className="px-3 py-2 text-right">
                  <Link
                    href={`/planning/templates/${t.id}`}
                    className="text-sky-700 hover:underline"
                  >
                    Open
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
