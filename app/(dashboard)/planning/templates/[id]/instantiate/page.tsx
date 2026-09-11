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

export default function InstantiateTemplatePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: tpl } = useSWR(id ? `/api/planning/templates/${id}` : null, fetcher);
  const { data: eventsData } = useSWR('/api/events', fetcher);
  const events = Array.isArray(eventsData?.items) ? eventsData.items : [];

  const [title, setTitle] = useState('');
  const [eventId, setEventId] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!eventId) {
      setError('Shutdown event is required — activities need event context for CPM and execution.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const site_id = events.find((ev: any) => ev.id === eventId)?.site_id;
      const res = await fetch(`/api/planning/templates/${id}/instantiate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title || tpl?.name,
          event_id: eventId || undefined,
          site_id,
          planned_start_date: start || undefined,
          planned_end_date: end || undefined,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Instantiate failed');
      router.push(`/workpacks/${body.workpack_id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-4 p-6">
      <Link href={`/planning/templates/${id}`} className="text-sm text-sky-700 hover:underline">
        ← Back to template
      </Link>
      <h1 className="text-2xl font-semibold text-slate-900">Create Workpack from Template</h1>
      <p className="text-sm text-slate-600">
        Template <strong>{tpl?.name}</strong> (r{tpl?.revision}) stays immutable. A new workpack is
        created with copied planning content.
      </p>
      <form onSubmit={submit} className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
        <label className="block text-sm">
          <span className="text-slate-600">Workpack title</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={tpl?.name || 'Title'}
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          <span className="text-slate-600">Shutdown event <span className="text-red-500">*</span></span>
          <select
            value={eventId}
            onChange={(e) => setEventId(e.target.value)}
            required
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
          >
            <option value="">— Select event —</option>
            {events.map((ev: any) => (
              <option key={ev.id} value={ev.id}>
                {ev.code} — {ev.name}
              </option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="block text-sm">
            <span className="text-slate-600">Planned start</span>
            <input
              type="date"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-600">Planned end</span>
            <input
              type="date"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
            />
          </label>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={busy || tpl?.lifecycle_status !== 'PUBLISHED'}
          className="rounded bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-50"
        >
          {busy ? 'Creating…' : 'Instantiate'}
        </button>
      </form>
    </div>
  );
}
