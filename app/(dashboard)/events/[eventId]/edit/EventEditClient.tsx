'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function EventEditClient({ event, sites }: { event: any, sites: any[] }) {
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
    planned_start: formatDate(event.planned_start),
    planned_end: formatDate(event.planned_end),
    budget_manhours: event.budget_manhours?.toString() || '',
    budget_cost: event.budget_cost?.toString() || '',
    scope_notes: event.scope_notes || ''
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
        body: JSON.stringify(formData),
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
        <Link href={`/events/${event.id}`} className="text-gray-500 hover:text-gray-700 text-sm">← Back to Event</Link>
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
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Event Code *</label>
              <input
                required
                type="text"
                value={formData.code}
                onChange={e => setFormData({ ...formData, code: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Event Type *</label>
              <select
                required
                value={formData.event_type}
                onChange={e => setFormData({ ...formData, event_type: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
              >
                <option value="turnaround">Turnaround</option>
                <option value="shutdown">Shutdown</option>
                <option value="pitstop">Pitstop</option>
                <option value="campaign">Maintenance Campaign</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Planned Start</label>
              <input
                type="date"
                value={formData.planned_start}
                onChange={e => setFormData({ ...formData, planned_start: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Planned End</label>
              <input
                type="date"
                value={formData.planned_end}
                onChange={e => setFormData({ ...formData, planned_end: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Budget Manhours</label>
              <input
                type="number"
                value={formData.budget_manhours}
                onChange={e => setFormData({ ...formData, budget_manhours: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Budget Cost</label>
              <input
                type="number"
                step="0.01"
                value={formData.budget_cost}
                onChange={e => setFormData({ ...formData, budget_cost: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Scope Notes</label>
            <textarea
              value={formData.scope_notes}
              onChange={e => setFormData({ ...formData, scope_notes: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
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
