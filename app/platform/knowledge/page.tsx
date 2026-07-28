'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import useSWR from 'swr';

const fetcher = async (url: string) => {
  const res = await fetch(url);
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
  return data;
};

type KnowledgeAsset = {
  id: string;
  status: string;
  category: string;
  asset_type: string;
  title: string;
  source_industry: string | null;
  similarity_score: number | null;
  ai_recommendation: string | null;
  ai_suggestion: string | null;
  times_seen: number;
  times_used: number;
  first_seen_at: string;
  last_seen_at: string;
  matched_asset?: { id: string; title: string; status: string } | null;
};

const PIPELINE = [
  { key: 'INCOMING', label: 'Incoming' },
  { key: 'AI_ANALYSIS', label: 'AI Analysis' },
  { key: 'REVIEW_QUEUE', label: 'Review Queue' },
  { key: 'APPROVED', label: 'Approved Library' },
  { key: 'REJECTED', label: 'Rejected' },
] as const;

export default function KnowledgeEnginePage() {
  const [status, setStatus] = useState<string>('REVIEW_QUEUE');
  const [category, setCategory] = useState<string>('');
  const qs = useMemo(() => {
    const p = new URLSearchParams();
    if (status) p.set('status', status);
    if (category) p.set('category', category);
    return p.toString();
  }, [status, category]);

  const { data, error, isLoading, mutate } = useSWR(
    `/api/platform/knowledge?${qs}`,
    fetcher,
    { refreshInterval: 15000 }
  );

  const items: KnowledgeAsset[] = Array.isArray(data?.items) ? data.items : [];
  const stats: Record<string, number> = data?.stats || {};

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Knowledge Engine</h1>
          <p className="mt-1 text-sm text-slate-600">
            Collect sanitized knowledge assets from tenants. Improve the Platform Standard Library
            without interrupting tenant operations.
          </p>
        </div>
        <button
          type="button"
          onClick={() => mutate()}
          className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
        >
          Refresh
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {PIPELINE.map((stage) => (
          <button
            key={stage.key}
            type="button"
            onClick={() => setStatus(stage.key)}
            className={`rounded-lg border p-3 text-left transition ${
              status === stage.key
                ? 'border-sky-500 bg-sky-50'
                : 'border-slate-200 bg-white hover:border-slate-300'
            }`}
          >
            <div className="text-xs uppercase tracking-wide text-slate-500">{stage.label}</div>
            <div className="mt-1 text-2xl font-semibold text-slate-900">
              {stats[stage.key] ?? 0}
            </div>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="rounded border border-slate-300 px-3 py-1.5 text-sm"
        >
          <option value="">All categories</option>
          <option value="ACTIVITY_CODE">Activity Codes</option>
          <option value="UDF_DEFINITION">UDF Definitions</option>
          <option value="WORKPACK_TEMPLATE">Workpack Templates</option>
          <option value="EQUIPMENT_TYPE">Equipment Types</option>
          <option value="RESOURCE_TYPE">Resource Types</option>
          <option value="CERTIFICATE_TEMPLATE">Certificate Templates</option>
          <option value="PRINT_SETTINGS">Print Settings</option>
          <option value="QA_QC_TEMPLATE">QA/QC Templates</option>
          <option value="SAFETY_TEMPLATE">Safety Templates</option>
        </select>
        <Link
          href="/platform/knowledge/review"
          className="rounded bg-slate-900 px-3 py-1.5 text-sm text-white hover:bg-slate-800"
        >
          Open Review Queue
        </Link>
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
              <th className="px-3 py-2">Title</th>
              <th className="px-3 py-2">Category</th>
              <th className="px-3 py-2">Industry</th>
              <th className="px-3 py-2">Similarity</th>
              <th className="px-3 py-2">AI</th>
              <th className="px-3 py-2">Seen</th>
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
                  No assets in this stage.
                </td>
              </tr>
            )}
            {items.map((item) => (
              <tr key={item.id} className="border-t border-slate-100">
                <td className="px-3 py-2 font-medium text-slate-900">{item.title}</td>
                <td className="px-3 py-2 text-slate-600">{item.category}</td>
                <td className="px-3 py-2 text-slate-600">{item.source_industry || '—'}</td>
                <td className="px-3 py-2 text-slate-600">
                  {item.similarity_score != null
                    ? `${(item.similarity_score * 100).toFixed(0)}%`
                    : '—'}
                </td>
                <td className="px-3 py-2 text-slate-600">{item.ai_recommendation || '—'}</td>
                <td className="px-3 py-2 text-slate-600">
                  {item.times_seen} / used {item.times_used}
                </td>
                <td className="px-3 py-2 text-right">
                  <Link
                    href={`/platform/knowledge/${item.id}`}
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
