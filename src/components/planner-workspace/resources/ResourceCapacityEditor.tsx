'use client';

import React, { useState } from 'react';
import { ResourceCapacity, ContractorSummary, ShiftDefinition } from './types';

export function ResourceCapacityEditor({
  eventId,
  date,
  resourceTypeId,
  resourceTypeName,
  contractors,
  shifts,
  existingCapacities,
  onClose,
  onSaved
}: {
  eventId: string;
  date: string;
  resourceTypeId: string;
  resourceTypeName: string;
  contractors: ContractorSummary[];
  shifts: ShiftDefinition[];
  existingCapacities: ResourceCapacity[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [entries, setEntries] = useState<{ id?: string, shiftId: string, contractorId: string, capacity: number }[]>(() => {
    if (existingCapacities.length === 0) {
      return [{ shiftId: 'null', contractorId: 'null', capacity: 0 }];
    }
    return existingCapacities.map(c => ({
      id: c.id,
      shiftId: c.shift_id || 'null',
      contractorId: c.contractor_id || 'null',
      capacity: Number(c.capacity_limit)
    }));
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addRow = () => {
    setEntries([...entries, { shiftId: 'null', contractorId: 'null', capacity: 0 }]);
  };

  const updateRow = (index: number, field: string, value: any) => {
    const newEntries = [...entries];
    (newEntries[index] as any)[field] = value;
    setEntries(newEntries);
  };

  const removeRow = async (index: number) => {
    const row = entries[index];
    if (row.id) {
      // Delete existing
      setLoading(true);
      try {
        const res = await fetch(`/api/events/${eventId}/resource-capacity/${row.id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Failed to delete capacity');
      } catch (err: any) {
        setError(err.message);
        setLoading(false);
        return;
      }
      setLoading(false);
    }
    const newEntries = [...entries];
    newEntries.splice(index, 1);
    setEntries(newEntries);
  };

  const handleSave = async () => {
    setLoading(true);
    setError(null);
    try {
      for (const row of entries) {
        if (row.capacity < 0) continue; // skip invalid

        // The Phase 2D.2 backend provides a POST endpoint to upsert.
        const res = await fetch(`/api/events/${eventId}/resource-capacity`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            resource_type_id: resourceTypeId,
            target_date: date,
            shift_id: row.shiftId === 'null' ? null : row.shiftId,
            contractor_id: row.contractorId === 'null' ? null : row.contractorId,
            capacity_limit: row.capacity,
            notes: ''
          })
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || 'Failed to save capacity limit');
        }
      }
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  const dateStr = new Date(date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  const totalCapacity = entries.reduce((acc, row) => acc + (Number(row.capacity) || 0), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl w-[600px] flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50 rounded-t-lg">
          <div>
            <h2 className="text-lg font-bold text-gray-800">Resource Capacity Editor</h2>
            <p className="text-sm text-gray-600">{resourceTypeName} — {dateStr}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl font-light">&times;</button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1">
          {error && <div className="mb-4 p-2 bg-red-50 border border-red-200 text-red-600 text-sm rounded">{error}</div>}

          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-xs uppercase text-gray-500 border-b border-gray-200">
                <th className="pb-2 w-1/3">Shift</th>
                <th className="pb-2 w-1/3">Contractor</th>
                <th className="pb-2 w-1/4">Capacity Limit</th>
                <th className="pb-2 w-12"></th>
              </tr>
            </thead>
            <tbody>
              {entries.map((row, idx) => (
                <tr key={idx} className="border-b border-gray-100 last:border-0">
                  <td className="py-2 pr-2">
                    <select 
                      value={row.shiftId} 
                      onChange={e => updateRow(idx, 'shiftId', e.target.value)}
                      className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                    >
                      <option value="null">Daily (Aggregate)</option>
                      {shifts.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </td>
                  <td className="py-2 pr-2">
                    <select 
                      value={row.contractorId} 
                      onChange={e => updateRow(idx, 'contractorId', e.target.value)}
                      className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                    >
                      <option value="null">Internal / Unassigned</option>
                      {contractors.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </td>
                  <td className="py-2 pr-2">
                    <input 
                      type="number" 
                      min="0"
                      value={row.capacity} 
                      onChange={e => updateRow(idx, 'capacity', Number(e.target.value))}
                      className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                    />
                  </td>
                  <td className="py-2 text-right">
                    <button onClick={() => removeRow(idx)} className="text-red-500 hover:text-red-700 text-sm font-medium">✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <button onClick={addRow} className="mt-4 text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1">
            <span>+</span> Add capacity split
          </button>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-lg flex justify-between items-center">
          <div className="text-sm">
            <span className="text-gray-500">Total Capacity for day: </span>
            <span className="font-bold text-gray-800 text-lg ml-1">{totalCapacity}</span>
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} disabled={loading} className="px-4 py-2 border border-gray-300 rounded bg-white text-gray-700 text-sm hover:bg-gray-50">Cancel</button>
            <button onClick={handleSave} disabled={loading} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm font-medium disabled:opacity-50 flex items-center gap-2">
              {loading && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>}
              Save Capacity
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
