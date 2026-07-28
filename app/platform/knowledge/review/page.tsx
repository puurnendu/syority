'use client';

import Link from 'next/link';
import useSWR from 'swr';

const fetcher = async (url: string) => {
  const res = await fetch(url);
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
  return data;
};

export default function KnowledgeReviewQueuePage() {
  const { data, error, isLoading, mutate } = useSWR(
    '/api/platform/knowledge?status=REVIEW_QUEUE',
    fetcher,
    { refreshInterval: 10000 }
  );
  const items = Array.isArray(data?.items) ? data.items : [];

  async function decide(id: string, decision: string) {
    const res = await fetch(`/api/platform/knowledge/${id}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      alert(body.error || 'Review failed');
      return;
    }
    mutate();
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <Link href="/platform/knowledge" className="text-sm text-sky-700 hover:underline">
            ← Knowledge Engine
          </Link>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">Review Queue</h1>
          <p className="text-sm text-slate-600">
            Approve, merge, reject, or request internal revision.
          </p>
        </div>
        <button
          type="button"
          onClick={() => mutate()}
          className="rounded border border-slate-300 px-3 py-1.5 text-sm"
        >
          Refresh
        </button>
      </div>

      {error && (
        <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {(error as Error).message}
        </div>
      )}

      {isLoading && <p className="text-sm text-slate-500">Loading…</p>}

      <div className="space-y-3">
        {items.map((item: any) => (
          <div key={item.id} className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="font-medium text-slate-900">{item.title}</div>
                <div className="mt-0.5 text-xs text-slate-500">
                  {item.category} · {item.source_industry || 'Industry n/a'} · similarity{' '}
                  {item.similarity_score != null
                    ? `${(item.similarity_score * 100).toFixed(0)}%`
                    : 'n/a'}
                </div>
                {item.ai_suggestion && (
                  <p className="mt-2 text-sm text-slate-700">{item.ai_suggestion}</p>
                )}
                {item.matched_asset && (
                  <p className="mt-1 text-xs text-slate-500">
                    Match: {item.matched_asset.title} ({item.matched_asset.status})
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => decide(item.id, 'APPROVE')}
                  className="rounded bg-emerald-700 px-2.5 py-1 text-xs text-white"
                >
                  Approve
                </button>
                <button
                  type="button"
                  onClick={() => decide(item.id, 'MERGE')}
                  className="rounded bg-sky-700 px-2.5 py-1 text-xs text-white"
                  disabled={!item.matched_asset_id && !item.matched_asset}
                >
                  Merge
                </button>
                <button
                  type="button"
                  onClick={() => decide(item.id, 'REQUEST_REVISION')}
                  className="rounded border border-amber-400 px-2.5 py-1 text-xs text-amber-800"
                >
                  Request revision
                </button>
                <button
                  type="button"
                  onClick={() => decide(item.id, 'REJECT')}
                  className="rounded border border-red-300 px-2.5 py-1 text-xs text-red-700"
                >
                  Reject
                </button>
                <Link
                  href={`/platform/knowledge/${item.id}`}
                  className="rounded border border-slate-300 px-2.5 py-1 text-xs text-slate-700"
                >
                  Details
                </Link>
              </div>
            </div>
          </div>
        ))}
        {!isLoading && items.length === 0 && (
          <p className="text-sm text-slate-500">Review queue is empty.</p>
        )}
      </div>
    </div>
  );
}
