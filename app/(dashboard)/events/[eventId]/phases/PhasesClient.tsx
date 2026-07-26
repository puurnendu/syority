'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function PhasesClient({ eventId, initialPhases }: { eventId: string, initialPhases: any[] }) {
  const router = useRouter();
  
  const [formData, setFormData] = useState({
    name: '',
    planned_start: '',
    planned_end: ''
  });
  
  const [status, setStatus] = useState<'idle' | 'saving' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('saving');
    setErrorMsg('');

    try {
      const res = await fetch(`/api/events/${eventId}/phases`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create phase');
      }

      setFormData({ name: '', planned_start: '', planned_end: '' });
      setStatus('idle');
      router.refresh();
    } catch (e: any) {
      setErrorMsg(e.message);
      setStatus('error');
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="md:col-span-2">
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Event Phases</h2>
          {initialPhases.length === 0 ? (
            <p className="text-sm text-gray-500">No phases defined for this event.</p>
          ) : (
            <table className="w-full text-left text-sm border-collapse">
              <thead className="bg-gray-50 text-gray-700">
                <tr>
                  <th className="p-3 border-b">Phase Name</th>
                  <th className="p-3 border-b">Planned Start</th>
                  <th className="p-3 border-b">Planned End</th>
                  <th className="p-3 border-b">Status</th>
                </tr>
              </thead>
              <tbody>
                {initialPhases.map((phase) => (
                  <tr key={phase.id} className="hover:bg-gray-50">
                    <td className="p-3 border-b font-medium">{phase.name}</td>
                    <td className="p-3 border-b text-gray-600">
                      {phase.planned_start ? new Date(phase.planned_start).toLocaleDateString() : '—'}
                    </td>
                    <td className="p-3 border-b text-gray-600">
                      {phase.planned_end ? new Date(phase.planned_end).toLocaleDateString() : '—'}
                    </td>
                    <td className="p-3 border-b">
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                        {phase.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div>
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Add Phase</h2>
          
          {errorMsg && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phase Name *</label>
              <input
                required
                type="text"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                placeholder="e.g. Pre-Turnaround"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Planned Start</label>
              <input
                type="date"
                value={formData.planned_start}
                onChange={e => setFormData({ ...formData, planned_start: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Planned End</label>
              <input
                type="date"
                value={formData.planned_end}
                onChange={e => setFormData({ ...formData, planned_end: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={status === 'saving'}
              className="w-full bg-blue-600 text-white px-4 py-2 rounded-md font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {status === 'saving' ? 'Adding...' : 'Add Phase'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
