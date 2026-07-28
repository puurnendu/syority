'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import useSWR from 'swr';

const fetcher = async (url: string) => {
  const res = await fetch(url);
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || `Failed (${res.status})`);
  return data;
};

const SECTIONS = [
  'General',
  'Planning',
  'Activities',
  'Logic',
  'Resources',
  'Materials',
  'Safety',
  'QA/QC',
  'References',
  'AI Metadata',
] as const;

export default function TemplateDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data, error, mutate, isLoading } = useSWR(
    id ? `/api/planning/templates/${id}` : null,
    fetcher
  );
  const [tab, setTab] = useState<(typeof SECTIONS)[number]>('General');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function action(path: string, label: string) {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/planning/templates/${id}/${path}`, { method: 'POST' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `${label} failed`);
      setMsg(`${label} OK`);
      if (body.id && body.id !== id) router.push(`/planning/templates/${body.id}`);
      else mutate();
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : `${label} failed`);
    } finally {
      setBusy(false);
    }
  }

  if (isLoading) return <div className="p-6 text-sm text-slate-500">Loading…</div>;
  if (error) return <div className="p-6 text-sm text-red-700">{(error as Error).message}</div>;
  if (!data) return null;

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div>
        <Link href="/planning/templates" className="text-sm text-sky-700 hover:underline">
          ← Template Library
        </Link>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">{data.name}</h1>
        <p className="text-sm text-slate-600">
          {data.library_scope} · {data.lifecycle_status} · revision {data.revision}
          {data.version_label ? ` (${data.version_label})` : ''} · {data.equipment_type} /{' '}
          {data.job_type}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {data.lifecycle_status === 'DRAFT' && (
          <button
            type="button"
            disabled={busy}
            onClick={() => action('publish', 'Publish')}
            className="rounded bg-emerald-700 px-3 py-1.5 text-sm text-white"
          >
            Publish
          </button>
        )}
        {data.lifecycle_status === 'PUBLISHED' && (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={() => action('version', 'New revision')}
              className="rounded bg-sky-700 px-3 py-1.5 text-sm text-white"
            >
              New revision
            </button>
            <Link
              href={`/planning/templates/${id}/instantiate`}
              className="rounded bg-slate-900 px-3 py-1.5 text-sm text-white"
            >
              Create Workpack
            </Link>
            <button
              type="button"
              disabled={busy}
              onClick={() => action('deprecate', 'Deprecate')}
              className="rounded border border-amber-400 px-3 py-1.5 text-sm text-amber-800"
            >
              Deprecate
            </button>
          </>
        )}
        <button
          type="button"
          disabled={busy}
          onClick={() => action('clone', 'Clone to tenant')}
          className="rounded border border-slate-300 px-3 py-1.5 text-sm"
        >
          Clone to Tenant
        </button>
      </div>
      {msg && <p className="text-sm text-slate-600">{msg}</p>}

      <div className="flex flex-wrap gap-1 border-b border-slate-200 pb-2">
        {SECTIONS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setTab(s)}
            className={`rounded px-2.5 py-1 text-xs ${
              tab === s ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
        {tab === 'General' && (
          <dl className="grid gap-2 sm:grid-cols-2">
            <Field label="Category" value={data.category} />
            <Field label="Equipment class" value={data.equipment_class} />
            <Field label="Family ID" value={data.template_family_id} />
            <Field label="Description" value={data.description} />
          </dl>
        )}
        {tab === 'Planning' && <Pre value={data.planning_json} />}
        {tab === 'Activities' && (
          <ol className="list-decimal space-y-1 pl-5">
            {(data.activities || []).map((a: any) => (
              <li key={a.id}>
                <span className="font-medium">{a.description}</span>
                {a.activity_code ? ` (${a.activity_code})` : ''} · {String(a.duration_hours ?? 0)}h
                {a.hold_point_type ? ` · ${a.hold_point_type}` : ''}
              </li>
            ))}
          </ol>
        )}
        {tab === 'Logic' && <Pre value={data.logic_links} />}
        {tab === 'Resources' && <Pre value={data.resources_json} />}
        {tab === 'Materials' && <Pre value={data.materials_json} />}
        {tab === 'Safety' && <Pre value={data.safety_json} />}
        {tab === 'QA/QC' && <Pre value={data.qaqc_json} />}
        {tab === 'References' && <Pre value={data.references_json} />}
        {tab === 'AI Metadata' && <Pre value={data.ai_metadata_json} />}
      </div>

      {Array.isArray(data.family_revisions) && data.family_revisions.length > 1 && (
        <div>
          <h2 className="text-sm font-semibold text-slate-800">Family revisions</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {data.family_revisions.map((r: any) => (
              <li key={r.id}>
                <Link href={`/planning/templates/${r.id}`} className="text-sky-700 hover:underline">
                  r{r.revision} — {r.lifecycle_status}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: unknown }) {
  return (
    <div>
      <dt className="text-xs uppercase text-slate-500">{label}</dt>
      <dd className="text-slate-800">{value != null && value !== '' ? String(value) : '—'}</dd>
    </div>
  );
}

function Pre({ value }: { value: unknown }) {
  return (
    <pre className="max-h-96 overflow-auto text-xs text-slate-700">
      {JSON.stringify(value ?? null, null, 2)}
    </pre>
  );
}
