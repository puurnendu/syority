'use client';

import React, { useState } from 'react';
import { ShiftDefinition } from './types';

export function ShiftConfigurationPanel({
  eventId,
  shifts,
  onClose,
  onShiftsChanged
}: {
  eventId: string;
  shifts: ShiftDefinition[];
  onClose: () => void;
  onShiftsChanged: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editShift, setEditShift] = useState<Partial<ShiftDefinition> | null>(null);

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this shift?')) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/events/${eventId}/shifts/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to delete shift');
      }
      onShiftsChanged();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editShift) return;
    setLoading(true);
    setError(null);
    try {
      const isNew = !editShift.id;
      const url = isNew ? `/api/events/${eventId}/shifts` : `/api/events/${eventId}/shifts/${editShift.id}`;
      const method = isNew ? 'POST' : 'PUT';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editShift.name,
          start_time: editShift.start_time,
          end_time: editShift.end_time,
          description: editShift.description || ''
        })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to save shift');
      }
      setEditShift(null);
      onShiftsChanged();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl w-[700px] flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50 rounded-t-lg">
          <h2 className="text-lg font-bold text-gray-800">Shift Configuration</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl font-light">&times;</button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded flex items-center gap-2">⚠️ {error}</div>}

          {editShift ? (
            <form onSubmit={handleSave} className="bg-blue-50 border border-blue-200 p-4 rounded mb-6">
              <h3 className="font-semibold text-blue-800 mb-3">{editShift.id ? 'Edit Shift' : 'Create New Shift'}</h3>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Shift Name *</label>
                  <input 
                    type="text" 
                    required 
                    value={editShift.name || ''} 
                    onChange={e => setEditShift({ ...editShift, name: e.target.value })}
                    className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                    placeholder="e.g. Day Shift"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Description</label>
                  <input 
                    type="text" 
                    value={editShift.description || ''} 
                    onChange={e => setEditShift({ ...editShift, description: e.target.value })}
                    className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Start Time (HH:mm) *</label>
                  <input 
                    type="time" 
                    required 
                    value={editShift.start_time || ''} 
                    onChange={e => setEditShift({ ...editShift, start_time: e.target.value })}
                    className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">End Time (HH:mm) *</label>
                  <input 
                    type="time" 
                    required 
                    value={editShift.end_time || ''} 
                    onChange={e => setEditShift({ ...editShift, end_time: e.target.value })}
                    className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                  />
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => setEditShift(null)} className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
                <button type="submit" disabled={loading} className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700">Save</button>
              </div>
            </form>
          ) : (
            <button 
              onClick={() => setEditShift({ start_time: '06:00', end_time: '18:00' })}
              className="mb-4 px-4 py-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded text-sm font-medium flex items-center gap-2 border border-blue-200"
            >
              <span>+</span> Create New Shift
            </button>
          )}

          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-xs uppercase text-gray-500 border-b border-gray-200">
                <th className="pb-2">Name</th>
                <th className="pb-2">Time</th>
                <th className="pb-2">Description</th>
                <th className="pb-2 w-24">Actions</th>
              </tr>
            </thead>
            <tbody>
              {shifts.length === 0 ? (
                <tr><td colSpan={4} className="py-4 text-center text-gray-500">No shifts configured for this event.</td></tr>
              ) : (
                shifts.map(s => (
                  <tr key={s.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                    <td className="py-3 font-medium text-gray-800">{s.name}</td>
                    <td className="py-3 text-gray-600">{s.start_time} - {s.end_time}</td>
                    <td className="py-3 text-gray-500 text-sm">{s.description || '-'}</td>
                    <td className="py-3">
                      <div className="flex gap-2">
                        <button onClick={() => setEditShift(s)} className="text-blue-500 hover:text-blue-700 text-sm">Edit</button>
                        <button onClick={() => handleDelete(s.id)} className="text-red-500 hover:text-red-700 text-sm">Delete</button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
