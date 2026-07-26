import React, { useState, useEffect } from 'react';
import { X, Check, HelpCircle } from 'lucide-react';

interface Baseline {
  id: string;
  name: string;
}

interface AssignBaselinesModalProps {
  projectId?: string;
  projects?: any[];
  isOpen: boolean;
  onClose: () => void;
}

export default function AssignBaselinesModal({ projectId: initialProjectId, projects = [], isOpen, onClose }: AssignBaselinesModalProps) {
  const [selectedProjectId, setSelectedProjectId] = useState<string>(initialProjectId || '');
  const [baselines, setBaselines] = useState<Baseline[]>([]);
  const [primaryId, setPrimaryId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (initialProjectId) setSelectedProjectId(initialProjectId);
  }, [initialProjectId]);

  useEffect(() => {
    if (isOpen && selectedProjectId) {
      fetchBaselines(selectedProjectId);
    } else {
      setBaselines([]);
      setPrimaryId(null);
    }
  }, [isOpen, selectedProjectId]);

  const fetchBaselines = async (pid: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${pid}/baselines`);
      const data = await res.json();
      setBaselines(data.baselines || []);
      setPrimaryId(data.primaryBaselineId || null);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async () => {
    if (!selectedProjectId) {
        alert('Please select a project first.');
        return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/projects/${selectedProjectId}/baselines`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'assign', baselineId: primaryId }),
      });
      if (!res.ok) throw new Error('Failed to assign baseline');
      onClose();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error assigning baseline');
    } finally {
      setBusy(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
      <div className="bg-white rounded shadow-2xl w-full max-w-md border border-gray-200 overflow-hidden animate-in fade-in zoom-in duration-200">
        {/* P6-style Header */}
        <div className="bg-[#f0f0f0] text-gray-800 px-4 py-1.5 flex items-center justify-between border-b border-gray-300">
           <h2 className="text-[11px] font-semibold text-gray-700 flex items-center gap-3">
              Assign Baselines
              {!initialProjectId && (
                <select 
                   value={selectedProjectId}
                   onChange={(e) => setSelectedProjectId(e.target.value)}
                   className="bg-white border border-gray-300 text-gray-600 text-[10px] px-2 py-0.5 rounded outline-none focus:ring-1 focus:ring-blue-500 transition cursor-pointer"
                >
                   <option value="">Select Project...</option>
                   {projects.map(p => (
                     <option key={p.id} value={p.id}>{p.name}</option>
                   ))}
                </select>
              )}
           </h2>
           <button onClick={onClose} className="hover:bg-gray-200 p-0.5 rounded transition text-gray-500"><X size={14} /></button>
        </div>

        <div className="p-4 space-y-6">
           <div className="space-y-4">
              <div className="space-y-1">
                 <label className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-1">
                   Project Baseline
                 </label>
                 <div className="flex gap-1">
                    <select 
                      value={primaryId || ''} 
                      onChange={(e) => setPrimaryId(e.target.value || null)}
                      className="flex-1 px-3 py-1.5 text-xs border border-gray-300 rounded bg-white shadow-sm focus:ring-1 focus:ring-blue-500 outline-none"
                    >
                       <option value="">&lt;Current Project&gt;</option>
                       {baselines.map(b => (
                         <option key={b.id} value={b.id}>{b.name}</option>
                       ))}
                    </select>
                    <button className="px-2 py-1.5 bg-gray-50 border border-gray-300 rounded hover:bg-gray-100 text-gray-500 transition">
                       ...
                    </button>
                 </div>
              </div>

              <div className="pt-4 border-t border-gray-100">
                 <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">User Baselines</h3>
                 <div className="space-y-3">
                    <div className="space-y-1">
                       <label className="text-[10px] font-bold text-gray-500">Primary</label>
                       <select className="w-full px-3 py-1.5 text-xs border border-gray-300 rounded bg-gray-50 text-gray-400 cursor-not-allowed outline-none" disabled>
                          <option>&lt;Current Project&gt;</option>
                       </select>
                    </div>
                    <div className="space-y-1">
                       <label className="text-[10px] font-bold text-gray-500">Secondary</label>
                       <select className="w-full px-3 py-1.5 text-xs border border-gray-300 rounded bg-gray-50 text-gray-400 cursor-not-allowed outline-none" disabled>
                          <option>&lt;None&gt;</option>
                       </select>
                    </div>
                 </div>
              </div>
           </div>
        </div>

        {/* Buttons */}
        <div className="bg-gray-50 p-4 border-t border-gray-200 flex justify-end gap-2">
           <button 
             onClick={onClose}
             className="px-6 py-1.5 bg-white border border-gray-300 rounded text-xs font-bold text-gray-700 hover:bg-gray-50 shadow-sm transition"
           >
              Cancel
           </button>
           <button 
             onClick={handleApply}
             disabled={busy}
             className="px-6 py-1.5 bg-[#005a9e] text-white rounded text-xs font-bold hover:bg-[#004a82] shadow-sm transition disabled:opacity-50"
           >
              {busy ? 'Saving...' : 'OK'}
           </button>
        </div>
      </div>
    </div>
  );
}
