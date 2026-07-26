'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function ScopeManagerClient({ eventId, availableUnits, initialSelectedUnits }: { eventId: string, availableUnits: any[], initialSelectedUnits: string[] }) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedUnits, setSelectedUnits] = useState<Set<string>>(new Set(initialSelectedUnits));
  const [status, setStatus] = useState<'idle' | 'saving' | 'error'>('idle');

  const toggleUnit = (unitId: string) => {
    const next = new Set(selectedUnits);
    if (next.has(unitId)) next.delete(unitId);
    else next.add(unitId);
    setSelectedUnits(next);
  };

  const handleSave = async () => {
    setStatus('saving');
    try {
      const res = await fetch(`/api/events/${eventId}/scope`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ unit_ids: Array.from(selectedUnits) }), // Keeping it simple: just units for now
      });

      if (!res.ok) throw new Error('Failed to save scope');
      
      setIsOpen(false);
      setStatus('idle');
      router.refresh();
    } catch (e: any) {
      console.error(e);
      setStatus('error');
    }
  };

  if (!isOpen) {
    return (
      <button 
        onClick={() => setIsOpen(true)}
        className="mt-2 text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded border border-blue-200 hover:bg-blue-100 font-medium"
      >
        Manage Scope
      </button>
    );
  }

  return (
    <div className="mt-4 p-4 border rounded-md bg-gray-50">
      <h3 className="font-semibold text-sm mb-2">Select Units for this Event</h3>
      <div className="max-h-48 overflow-y-auto space-y-2 mb-4 bg-white p-2 rounded border">
        {availableUnits.map(unit => (
          <label key={unit.id} className="flex items-center space-x-2 text-sm">
            <input 
              type="checkbox" 
              checked={selectedUnits.has(unit.id)}
              onChange={() => toggleUnit(unit.id)}
              className="rounded text-blue-600"
            />
            <span>{unit.name} {unit.code ? `(${unit.code})` : ''}</span>
          </label>
        ))}
        {availableUnits.length === 0 && <span className="text-sm text-gray-500">No units found for this site.</span>}
      </div>
      <div className="flex gap-2">
        <button 
          onClick={handleSave} 
          disabled={status === 'saving'}
          className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {status === 'saving' ? 'Saving...' : 'Save Scope'}
        </button>
        <button 
          onClick={() => { setIsOpen(false); setSelectedUnits(new Set(initialSelectedUnits)); }}
          className="text-xs bg-gray-200 text-gray-800 px-3 py-1.5 rounded font-medium hover:bg-gray-300"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
