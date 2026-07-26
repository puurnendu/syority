'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

export default function NewEventPage() {
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    event_type: 'turnaround',
    site_id: '',
    planned_start: '',
    planned_end: '',
    budget_manhours: '',
    budget_cost: ''
  });
  const [sites, setSites] = useState<any[]>([]);
  const [status, setStatus] = useState<'idle' | 'submitting' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    // Fetch sites for the dropdown
    // Note: Since this is a simple page, we might just assume we have an API to get sites or we handle it gracefully.
    // For this implementation, we will mock a fetch or just allow a text input for site_id if no sites are loaded.
    fetch('/api/admin/sites')
      .then(res => res.ok ? res.json() : [])
      .then(data => {
        if (Array.isArray(data)) setSites(data);
      })
      .catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('submitting');
    setErrorMsg('');

    try {
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create event');
      }

      const newEvent = await res.json();
      window.location.href = `/events/${newEvent.id}`;
    } catch (e: any) {
      setErrorMsg(e.message);
      setStatus('error');
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6 flex items-center gap-4">
        <Link href="/events" className="text-gray-500 hover:text-gray-700 text-sm">← Events</Link>
        <h1 className="text-2xl font-bold text-gray-900">Create New Event</h1>
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
                placeholder="e.g. 2026 Spring Turnaround"
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
                placeholder="e.g. TA-2026-SP"
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Site *</label>
              {sites.length > 0 ? (
                <select
                  required
                  value={formData.site_id}
                  onChange={e => setFormData({ ...formData, site_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
                >
                  <option value="">Select a Site...</option>
                  {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              ) : (
                <input
                  required
                  type="text"
                  value={formData.site_id}
                  onChange={e => setFormData({ ...formData, site_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
                  placeholder="Enter Site UUID"
                />
              )}
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
                placeholder="e.g. 50000"
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
                placeholder="e.g. 1500000.00"
              />
            </div>
          </div>

          <div className="pt-4 flex gap-3 border-t border-gray-100">
            <button
              type="submit"
              disabled={status === 'submitting'}
              className="bg-blue-600 text-white px-6 py-2 rounded-md font-medium hover:bg-blue-700 transition disabled:opacity-50"
            >
              {status === 'submitting' ? 'Creating...' : 'Create Event'}
            </button>
            <Link
              href="/events"
              className="bg-gray-100 text-gray-700 px-6 py-2 rounded-md font-medium hover:bg-gray-200 transition"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
