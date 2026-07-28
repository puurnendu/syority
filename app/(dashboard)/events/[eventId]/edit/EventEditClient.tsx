'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

type Opt = { id: string; name: string; code?: string | null };

export default function EventEditClient({
  event,
  sites,
  calendars,
  disciplines,
  parentEvents,
}: {
  event: any;
  sites: Opt[];
  calendars: Opt[];
  disciplines: Opt[];
  parentEvents: Opt[];
}) {
  const router = useRouter();

  const formatDate = (d: any) => {
    if (!d) return '';
    const date = new Date(d);
    return date.toISOString().split('T')[0];
  };

  const [formData, setFormData] = useState({
    name: event.name || '',
    code: event.code || '',
    event_type: event.event_type || 'turnaround',
    status: event.status || 'planning',
    planned_start: formatDate(event.planned_start),
    planned_end: formatDate(event.planned_end),
    budget_manhours: event.budget_manhours?.toString() || '',
    budget_cost: event.budget_cost?.toString() || '',
    scope_notes: event.scope_notes || '',
    description: event.description || '',
    calendar_id: event.calendar_id || '',
    discipline_id: event.discipline_id || '',
    parent_event_id: event.parent_event_id || '',
  });

  const [status, setStatus] = useState<'idle' | 'submitting' | 'deleting' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('submitting');
    setErrorMsg('');

    try {
      const res = await fetch(`/api/events/${event.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          calendar_id: formData.calendar_id || null,
          discipline_id: formData.discipline_id || null,
          parent_event_id: formData.parent_event_id || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update event');
      }

      router.push(`/events/${event.id}`);
      router.refresh();
    } catch (e: any) {
      setErrorMsg(e.message);
      setStatus('error');
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this event? This action cannot be undone.')) return;
    setStatus('deleting');
    setErrorMsg('');

    try {
      const res = await fetch(`/api/events/${event.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete event');
      }
      router.push('/events');
      router.refresh();
    } catch (e: any) {
      setErrorMsg(e.message);
      setStatus('error');
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6 flex items-center gap-4">
        <Link href={`/events/${event.id}`} className="text-gray-500 hover:text-gray-700 text-sm">
          ← Back to Event
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Edit Event</h1>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
        {errorMsg && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Event Name *</label>
              <input
                required
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Event Code *</label>
              <input
                required
                type="text"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Event Type *</label>
              <select
                required
                value={formData.event_type}
                onChange={(e) => setFormData({ ...formData, event_type: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              >
                <option value="turnaround">Turnaround</option>
                <option value="shutdown">Shutdown</option>
                <option value="pitstop">Pitstop</option>
                <option value="campaign">Maintenance Campaign</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              >
                <option value="planning">Planning</option>
                <option value="ready">Ready</option>
                <option value="active">Active</option>
                <option value="closed">Closed</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Calendar</label>
              <select
                value={formData.calendar_id}
                onChange={(e) => setFormData({ ...formData, calendar_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              >
                <option value="">None</option>
                {calendars.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Discipline</label>
              <select
                value={formData.discipline_id}
                onChange={(e) => setFormData({ ...formData, discipline_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              >
                <option value="">None</option>
                {disciplines.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.code ? `${d.code} — ` : ''}
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Parent event (multi-shutdown)
              </label>
              <select
                value={formData.parent_event_id}
                onChange={(e) => setFormData({ ...formData, parent_event_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              >
                <option value="">None (top-level)</option>
                {parentEvents
                  .filter((ev) => ev.id !== event.id)
                  .map((ev) => (
                    <option key={ev.id} value={ev.id}>
                      {ev.code ? `${ev.code} — ` : ''}
                      {ev.name}
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Site</label>
              <select
                disabled
                value={event.site_id}
                className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm bg-gray-50 text-gray-500"
              >
                {sites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Planned Start</label>
              <input
                type="date"
                value={formData.planned_start}
                onChange={(e) => setFormData({ ...formData, planned_start: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Planned End</label>
              <input
                type="date"
                value={formData.planned_end}
                onChange={(e) => setFormData({ ...formData, planned_end: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Budget Manhours</label>
              <input
                type="number"
                value={formData.budget_manhours}
                onChange={(e) => setFormData({ ...formData, budget_manhours: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Budget Cost</label>
              <input
                type="number"
                step="0.01"
                value={formData.budget_cost}
                onChange={(e) => setFormData({ ...formData, budget_cost: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              rows={2}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Scope Notes</label>
            <textarea
              value={formData.scope_notes}
              onChange={(e) => setFormData({ ...formData, scope_notes: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              rows={3}
            />
          </div>

          <div className="pt-4 flex items-center justify-between border-t border-gray-100">
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={status === 'submitting' || status === 'deleting'}
                className="bg-blue-600 text-white px-6 py-2 rounded-md font-medium hover:bg-blue-700 transition disabled:opacity-50"
              >
                {status === 'submitting' ? 'Saving...' : 'Save Changes'}
              </button>
              <Link
                href={`/events/${event.id}`}
                className="bg-gray-100 text-gray-700 px-6 py-2 rounded-md font-medium hover:bg-gray-200 transition"
              >
                Cancel
              </Link>
            </div>
            <button
              type="button"
              onClick={handleDelete}
              disabled={status === 'submitting' || status === 'deleting'}
              className="text-red-600 hover:text-red-800 text-sm font-medium disabled:opacity-50"
            >
              {status === 'deleting' ? 'Deleting...' : 'Delete Event'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
