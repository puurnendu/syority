'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import useSWR from 'swr';

const fetcher = async (url: string) => {
  const res = await fetch(url);
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
  return data;
};

export default function KnowledgeAssetDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { data, error, mutate, isLoading } = useSWR(
    id ? `/api/platform/knowledge/${id}` : null,
    fetcher
  );
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function decide(decision: string) {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/platform/knowledge/${id}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, notes }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(body.error || 'Review failed');
        return;
      }
      setMsg(`Decision recorded: ${decision}`);
      mutate();
    } finally {
      setBusy(false);
    }
  }

  async function reanalyze() {
    setBusy(true);
    try {
      await fetch('/api/platform/knowledge/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assetId: id }),
      });
      setTimeout(() => mutate(), 1500);
    } finally {
      setBusy(false);
    }
  }

  if (isLoading) return <div className="p-6 text-sm text-slate-500">Loading…</div>;
  if (error) {
    return (
      <div className="p-6 text-sm text-red-700">{(error as Error).message}</div>
    );
  }
  if (!data) return null;

  const reviewable = data.status === 'REVIEW_QUEUE' || data.status === 'AI_ANALYSIS';

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div>
        <Link href="/platform/knowledge" className="text-sm text-sky-700 hover:underline">
          ← Knowledge Engine
        </Link>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">{data.title}</h1>
        <p className="text-sm text-slate-600">
          {data.category} · {data.status} · {data.asset_type}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Meta label="Source industry" value={data.source_industry || '—'} />
        <Meta label="Similarity" value={data.similarity_score != null ? `${(data.similarity_score * 100).toFixed(1)}%` : '—'} />
        <Meta label="AI recommendation" value={data.ai_recommendation || '—'} />
        <Meta label="Times seen / used" value={`${data.times_seen} / ${data.times_used}`} />
        <Meta label="First seen" value={new Date(data.first_seen_at).toLocaleString()} />
        <Meta label="Last seen" value={new Date(data.last_seen_at).toLocaleString()} />
      </div>

      {data.ai_suggestion && (
        <div className="rounded border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
          {data.ai_suggestion}
        </div>
      )}

      {data.matched_asset && (
        <div className="text-sm text-slate-600">
          Matched asset:{' '}
          <Link
            href={`/platform/knowledge/${data.matched_asset.id}`}
            className="text-sky-700 hover:underline"
          >
            {data.matched_asset.title}
          </Link>{' '}
          ({data.matched_asset.status})
        </div>
      )}

      <div>
        <h2 className="text-sm font-semibold text-slate-800">Sanitized payload</h2>
        <pre className="mt-2 max-h-96 overflow-auto rounded border border-slate-200 bg-white p-3 text-xs text-slate-700">
          {JSON.stringify(data.sanitized_payload, null, 2)}
        </pre>
      </div>

      {reviewable && (
        <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-800">Platform review</h2>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Reviewer notes (optional)"
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            rows={3}
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => decide('APPROVE')}
              className="rounded bg-emerald-700 px-3 py-1.5 text-sm text-white disabled:opacity-50"
            >
              Approve
            </button>
            <button
              type="button"
              disabled={busy || !data.matched_asset_id}
              onClick={() => decide('MERGE')}
              className="rounded bg-sky-700 px-3 py-1.5 text-sm text-white disabled:opacity-50"
            >
              Merge
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => decide('REQUEST_REVISION')}
              className="rounded border border-amber-400 px-3 py-1.5 text-sm text-amber-800 disabled:opacity-50"
            >
              Request revision
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => decide('REJECT')}
              className="rounded border border-red-300 px-3 py-1.5 text-sm text-red-700 disabled:opacity-50"
            >
              Reject
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={reanalyze}
              className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700 disabled:opacity-50"
            >
              Re-run AI analysis
            </button>
          </div>
          {msg && <p className="text-sm text-slate-600">{msg}</p>}
        </div>
      )}

      {Array.isArray(data.reviews) && data.reviews.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-slate-800">Review history</h2>
          <ul className="mt-2 space-y-2">
            {data.reviews.map((r: any) => (
              <li key={r.id} className="rounded border border-slate-100 px-3 py-2 text-sm">
                <span className="font-medium">{r.decision}</span>
                <span className="text-slate-500">
                  {' '}
                  · {new Date(r.created_at).toLocaleString()}
                </span>
                {r.notes && <div className="text-slate-600">{r.notes}</div>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-slate-200 bg-white px-3 py-2">
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-0.5 text-sm text-slate-900">{value}</div>
    </div>
  );
}
