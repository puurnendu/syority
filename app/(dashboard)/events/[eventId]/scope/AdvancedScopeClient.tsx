'use client';

import React, { useState, DragEvent } from 'react';
import { useRouter } from 'next/navigation';

type System = { id: string; name: string; code: string };
type Unit = { id: string; name: string; code: string; systems: System[] };

export function AdvancedScopeClient({
  eventId,
  siteUnits,
  initialEventUnits,
  initialEventSystems,
  canManage,
}: {
  eventId: string;
  siteUnits: Unit[];
  initialEventUnits: string[];
  initialEventSystems: string[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [selectedUnits, setSelectedUnits] = useState<Set<string>>(new Set(initialEventUnits));
  const [selectedSystems, setSelectedSystems] = useState<Set<string>>(new Set(initialEventSystems));
  const [status, setStatus] = useState<'idle' | 'saving' | 'error'>('idle');

  // Drag and Drop handlers
  const handleDragStart = (e: DragEvent, type: 'unit' | 'system', id: string) => {
    if (!canManage) {
      e.preventDefault();
      return;
    }
    e.dataTransfer.setData('text/plain', JSON.stringify({ type, id }));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDropToScope = (e: DragEvent) => {
    e.preventDefault();
    if (!canManage) return;
    
    try {
      const data = JSON.parse(e.dataTransfer.getData('text/plain'));
      if (data.type === 'unit') {
        setSelectedUnits(prev => new Set([...prev, data.id]));
      } else if (data.type === 'system') {
        setSelectedSystems(prev => new Set([...prev, data.id]));
        // Optionally auto-add the parent unit so the system has a home in the UI
        const parentUnit = siteUnits.find(u => u.systems.some(s => s.id === data.id));
        if (parentUnit) {
          setSelectedUnits(prev => new Set([...prev, parentUnit.id]));
        }
      }
    } catch (err) {}
  };

  const handleDropToInventory = (e: DragEvent) => {
    e.preventDefault();
    if (!canManage) return;
    
    try {
      const data = JSON.parse(e.dataTransfer.getData('text/plain'));
      if (data.type === 'unit') {
        setSelectedUnits(prev => {
          const next = new Set(prev);
          next.delete(data.id);
          return next;
        });
        // Also remove all systems belonging to this unit
        const unit = siteUnits.find(u => u.id === data.id);
        if (unit) {
          setSelectedSystems(prev => {
            const next = new Set(prev);
            unit.systems.forEach(s => next.delete(s.id));
            return next;
          });
        }
      } else if (data.type === 'system') {
        setSelectedSystems(prev => {
          const next = new Set(prev);
          next.delete(data.id);
          return next;
        });
      }
    } catch (err) {}
  };

  const handleSave = async () => {
    setStatus('saving');
    try {
      const res = await fetch(`/api/events/${eventId}/scope`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          unit_ids: Array.from(selectedUnits),
          system_ids: Array.from(selectedSystems),
        }),
      });

      if (!res.ok) throw new Error('Failed to save scope');
      setStatus('idle');
      router.refresh();
      alert('Scope saved successfully!');
    } catch (e: any) {
      console.error(e);
      setStatus('error');
      alert('Failed to save scope.');
    }
  };

  return (
    <div className="h-full flex flex-col gap-4">
      <div className="flex justify-end mb-2">
        {canManage && (
          <button
            onClick={handleSave}
            disabled={status === 'saving'}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {status === 'saving' ? 'Saving...' : 'Save Scope Configuration'}
          </button>
        )}
      </div>

      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-6 min-h-[500px]">
        
        {/* Left Column: Inventory */}
        <div 
          className="flex flex-col bg-gray-50 border border-gray-200 rounded-xl overflow-hidden"
          onDragOver={handleDragOver}
          onDrop={handleDropToInventory}
        >
          <div className="bg-gray-100 px-4 py-3 border-b border-gray-200">
            <h2 className="font-semibold text-gray-800">Site Inventory</h2>
            <p className="text-xs text-gray-500">Available Units and Systems</p>
          </div>
          <div className="flex-1 p-4 overflow-y-auto space-y-4">
            {siteUnits.filter(u => !selectedUnits.has(u.id)).map(unit => (
              <div 
                key={unit.id} 
                className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden"
              >
                <div 
                  draggable={canManage}
                  onDragStart={(e) => handleDragStart(e, 'unit', unit.id)}
                  className={`px-3 py-2 bg-slate-50 border-b border-gray-100 flex items-center justify-between ${canManage ? 'cursor-grab active:cursor-grabbing' : ''}`}
                >
                  <span className="font-medium text-sm text-slate-800">🏗️ {unit.code ?? unit.name}</span>
                  <span className="text-xs text-gray-400">Drag Unit ⭢</span>
                </div>
                {unit.systems.length > 0 && (
                  <div className="p-2 space-y-1">
                    {unit.systems.filter(s => !selectedSystems.has(s.id)).map(sys => (
                      <div
                        key={sys.id}
                        draggable={canManage}
                        onDragStart={(e) => handleDragStart(e, 'system', sys.id)}
                        className={`text-sm px-3 py-1.5 bg-gray-50 rounded border border-gray-100 hover:border-blue-200 flex items-center justify-between ${canManage ? 'cursor-grab active:cursor-grabbing' : ''}`}
                      >
                        <span className="text-gray-700">⚙️ {sys.code ?? sys.name}</span>
                        <span className="text-xs text-gray-400">Drag ⭢</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
            
            {/* Show standalone systems if their unit is selected but the system is not */}
            {siteUnits.filter(u => selectedUnits.has(u.id)).map(unit => {
              const availableSystems = unit.systems.filter(s => !selectedSystems.has(s.id));
              if (availableSystems.length === 0) return null;
              return (
                <div key={`rem-${unit.id}`} className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden opacity-75">
                  <div className="px-3 py-2 bg-slate-50 border-b border-gray-100">
                    <span className="font-medium text-sm text-slate-500">Remaining in {unit.code ?? unit.name}</span>
                  </div>
                  <div className="p-2 space-y-1">
                    {availableSystems.map(sys => (
                      <div
                        key={sys.id}
                        draggable={canManage}
                        onDragStart={(e) => handleDragStart(e, 'system', sys.id)}
                        className={`text-sm px-3 py-1.5 bg-gray-50 rounded border border-gray-100 hover:border-blue-200 flex items-center justify-between ${canManage ? 'cursor-grab active:cursor-grabbing' : ''}`}
                      >
                        <span className="text-gray-700">⚙️ {sys.code ?? sys.name}</span>
                        <span className="text-xs text-gray-400">Drag ⭢</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Event Scope */}
        <div 
          className="flex flex-col bg-blue-50/30 border-2 border-dashed border-blue-200 rounded-xl overflow-hidden"
          onDragOver={handleDragOver}
          onDrop={handleDropToScope}
        >
          <div className="bg-blue-100/50 px-4 py-3 border-b border-blue-200">
            <h2 className="font-semibold text-blue-900">Event Scope</h2>
            <p className="text-xs text-blue-600">Drop Units and Systems here</p>
          </div>
          <div className="flex-1 p-4 overflow-y-auto space-y-4">
            {siteUnits.filter(u => selectedUnits.has(u.id)).length === 0 ? (
              <div className="h-full flex items-center justify-center text-gray-400 text-sm italic">
                Empty Scope. Drag items here.
              </div>
            ) : (
              siteUnits.filter(u => selectedUnits.has(u.id)).map(unit => (
                <div 
                  key={unit.id} 
                  className="bg-white border border-blue-200 rounded-lg shadow-sm overflow-hidden"
                >
                  <div 
                    draggable={canManage}
                    onDragStart={(e) => handleDragStart(e, 'unit', unit.id)}
                    className={`px-3 py-2 bg-blue-50 border-b border-blue-100 flex items-center justify-between ${canManage ? 'cursor-grab active:cursor-grabbing' : ''}`}
                  >
                    <span className="font-medium text-sm text-blue-900">🏗️ {unit.code ?? unit.name}</span>
                    <span className="text-xs text-blue-400">⭠ Drag out to remove</span>
                  </div>
                  {unit.systems.filter(s => selectedSystems.has(s.id)).length > 0 ? (
                    <div className="p-2 space-y-1">
                      {unit.systems.filter(s => selectedSystems.has(s.id)).map(sys => (
                        <div
                          key={sys.id}
                          draggable={canManage}
                          onDragStart={(e) => handleDragStart(e, 'system', sys.id)}
                          className={`text-sm px-3 py-1.5 bg-blue-50/50 rounded border border-blue-100 hover:border-red-200 flex items-center justify-between ${canManage ? 'cursor-grab active:cursor-grabbing' : ''}`}
                        >
                          <span className="text-gray-800">⚙️ {sys.code ?? sys.name}</span>
                          <span className="text-xs text-gray-400">⭠ Drag out</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="px-3 py-2 text-xs text-gray-400 italic bg-gray-50">
                      No specific systems selected.
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
