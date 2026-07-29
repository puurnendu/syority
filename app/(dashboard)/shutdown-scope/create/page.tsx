'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

type Event = { id: string; name: string; code: string; planned_start: string | null; planned_end: string | null; status: string };

export default function CreateScopePage() {
  const router = useRouter();
  const [events, setEvents] = useState<Event[]>([]);
  const [form, setForm] = useState({ event_id: '', name: '', description: '', objectives: '', freeze_date: '', budget_manhours: '', budget_cost: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/events').then((r) => r.json()).then((d) => setEvents(Array.isArray(d) ? d : d.data || []));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/shutdown-scope/scopes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          budget_manhours: form.budget_manhours ? parseInt(form.budget_manhours, 10) : undefined,
          budget_cost: form.budget_cost ? parseFloat(form.budget_cost) : undefined,
        }),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to create scope');
      }
      const scope = await res.json();
      router.push(`/shutdown-scope/${scope.id}`);
    } catch (err: any) {
      setError(err.message);
      setSaving(false);
    }
  };

  const selectedEvent = events.find((e) => e.id === form.event_id);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Create Shutdown Scope</h1>
      <p className="text-sm text-gray-500">Link a scope to a Shutdown Event and define objectives.</p>

      {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-4 bg-white p-6 rounded-xl border">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Shutdown Event *</label>
          <select
            value={form.event_id}
            onChange={(e) => {
              const ev = events.find((x) => x.id === e.target.value);
              setForm({ ...form, event_id: e.target.value, name: ev ? `${ev.code} Shutdown Scope` : '' });
            }}
            className="w-full px-3 py-2 border rounded-lg text-sm"
            required
          >
            <option value="">Select event...</option>
            {events.map((ev) => (
              <option key={ev.id} value={ev.id}>{ev.name} ({ev.code})</option>
            ))}
          </select>
        </div>

        {selectedEvent && (
          <div className="p-3 bg-blue-50 rounded-lg text-sm">
            <strong>{selectedEvent.name}</strong> — {selectedEvent.status}
            {selectedEvent.planned_start && <span> | Start: {new Date(selectedEvent.planned_start).toLocaleDateString()}</span>}
            {selectedEvent.planned_end && <span> – {new Date(selectedEvent.planned_end).toLocaleDateString()}</span>}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Scope Name *</label>
          <input
            type="text" value={form.name} required
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg text-sm"
            placeholder="e.g. TA-2028 Shutdown Scope"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Objectives</label>
          <textarea
            value={form.objectives}
            onChange={(e) => setForm({ ...form, objectives: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg text-sm" rows={3}
            placeholder="Define the shutdown objectives..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg text-sm" rows={2}
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Freeze Date</label>
            <input
              type="date" value={form.freeze_date}
              onChange={(e) => setForm({ ...form, freeze_date: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Budget (Manhours)</label>
            <input
              type="number" value={form.budget_manhours}
              onChange={(e) => setForm({ ...form, budget_manhours: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Budget (Cost)</label>
            <input
              type="number" step="0.01" value={form.budget_cost}
              onChange={(e) => setForm({ ...form, budget_cost: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg text-sm"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <button type="button" onClick={() => router.back()} className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">Cancel</button>
          <button type="submit" disabled={saving} className="px-6 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {saving ? 'Creating...' : 'Create Scope'}
          </button>
        </div>
      </form>
    </div>
  );
}
