'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Milestone = {
  id: string;
  name: string;
  code: string | null;
  milestone_type: string;
  planned_date: string | null;
  status: string;
};

export default function EventMilestonesClient({
  eventId,
  initial,
}: {
  eventId: string;
  initial: Milestone[];
}) {
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [plannedDate, setPlannedDate] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/events/${eventId}/milestones`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          code: code.trim() || undefined,
          planned_date: plannedDate || null,
          sort_order: items.length,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to add milestone');
      setItems((prev) => [...prev, data]);
      setName('');
      setCode('');
      setPlannedDate('');
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this milestone?')) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/events/${eventId}/milestones?id=${id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to delete');
      setItems((prev) => prev.filter((m) => m.id !== id));
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mt-6 bg-white rounded-lg border border-gray-200 p-6">
      <h2 className="text-sm font-semibold text-gray-700 mb-3">Milestones</h2>
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
      {items.length === 0 ? (
        <p className="text-sm text-gray-500 mb-4">No milestones yet.</p>
      ) : (
        <ul className="mb-4 divide-y divide-gray-100">
          {items.map((m) => (
            <li key={m.id} className="flex items-center justify-between py-2 text-sm">
              <div>
                <span className="font-medium text-gray-900">{m.name}</span>
                {m.code ? <span className="ml-2 text-gray-500">({m.code})</span> : null}
                <span className="ml-2 text-xs text-gray-500">{m.status}</span>
                {m.planned_date ? (
                  <span className="ml-2 text-xs text-gray-500">
                    {new Date(m.planned_date).toLocaleDateString()}
                  </span>
                ) : null}
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => remove(m.id)}
                className="text-xs text-red-600 hover:underline disabled:opacity-50"
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={add} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Name *</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            placeholder="e.g. Mechanical completion"
            required
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Code</label>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            placeholder="MC"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Planned date</label>
          <input
            type="date"
            value={plannedDate}
            onChange={(e) => setPlannedDate(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
          />
        </div>
        <button
          type="submit"
          disabled={busy}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          {busy ? 'Saving…' : 'Add milestone'}
        </button>
      </form>
    </section>
  );
}
