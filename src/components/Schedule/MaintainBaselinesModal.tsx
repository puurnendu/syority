import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, RotateCcw, Save, AlertCircle } from 'lucide-react';

interface Baseline {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  actualSdDate: string | null;
}

interface MaintainBaselinesModalProps {
  projectId?: string;
  projects?: any[];
  isOpen: boolean;
  onClose: () => void;
}

export default function MaintainBaselinesModal({ projectId: initialProjectId, projects = [], isOpen, onClose }: MaintainBaselinesModalProps) {
  const [selectedProjectId, setSelectedProjectId] = useState<string>(initialProjectId || '');
  const [baselines, setBaselines] = useState<Baseline[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (initialProjectId) setSelectedProjectId(initialProjectId);
  }, [initialProjectId]);

  useEffect(() => {
    if (isOpen && selectedProjectId) {
      fetchBaselines(selectedProjectId);
    } else {
      setBaselines([]);
    }
  }, [isOpen, selectedProjectId]);

  const fetchBaselines = async (pid: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${pid}/baselines`);
      const data = await res.json();
      setBaselines(data.baselines || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!selectedProjectId) {
        alert('Please select a project first.');
        return;
    }
    const name = prompt('Enter Baseline Name:', `New Baseline - ${new Date().toLocaleDateString()}`);
    if (!name) return;

    setBusy(true);
    try {
      const res = await fetch(`/api/projects/${selectedProjectId}/baselines`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'snapshot', name }),
      });
      if (!res.ok) throw new Error('Failed to create baseline');
      fetchBaselines(selectedProjectId);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error creating baseline');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedId || !selectedProjectId) return;
    if (!confirm('Are you sure you want to delete this baseline snapshot? This action cannot be undone.')) return;

    setBusy(true);
    try {
      const res = await fetch(`/api/projects/${selectedProjectId}/baselines?baselineId=${selectedId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      setSelectedId(null);
      fetchBaselines(selectedProjectId);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error deleting baseline');
    } finally {
      setBusy(false);
    }
  };

  const handleRestore = async () => {
    if (!selectedId || !selectedProjectId) return;
    if (!confirm('This will create a NEW standalone project based on this baseline snapshot. Proceed?')) return;

    setBusy(true);
    try {
      const res = await fetch(`/api/projects/${selectedProjectId}/baselines`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'restore', baselineId: selectedId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Restore failed');
      
      alert(`Project successfully restored as a new project. You can find it in your project dashboard.`);
      window.location.href = `/projects/${data.newProjectId}/schedule`;
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error restoring baseline');
    } finally {
      setBusy(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-4xl border border-blue-200 overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200">
        {/* P6-style Header */}
        <div className="bg-[#005a9e] text-white px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-red-600 text-white text-[10px] font-bold px-1 rounded">P6</div>
            <h2 className="text-sm font-semibold tracking-wide flex items-center gap-3">
               Maintain Baselines
               {!initialProjectId && (
                 <select 
                    value={selectedProjectId}
                    onChange={(e) => setSelectedProjectId(e.target.value)}
                    className="bg-white/10 border border-white/20 text-white text-[11px] px-2 py-0.5 rounded outline-none focus:bg-white/20 transition cursor-pointer"
                 >
                    <option value="" className="text-gray-800">Select Project...</option>
                    {projects.map(p => (
                      <option key={p.id} value={p.id} className="text-gray-800">{p.name}</option>
                    ))}
                 </select>
               )}
            </h2>
          </div>
          <button onClick={onClose} className="hover:bg-white/10 p-1 rounded transition text-blue-100"><X size={18} /></button>
        </div>

        <div className="flex-1 flex min-h-[400px]">
          {/* Main List Table */}
          <div className="flex-1 border-r border-gray-200 flex flex-col">
            <div className="bg-gray-100 flex border-b border-gray-200 text-[11px] font-bold text-gray-600">
               <div className="flex-1 px-3 py-2 border-r border-gray-200">Project Name/Baseline Name</div>
               <div className="w-32 px-3 py-2 border-r border-gray-200">Data Date</div>
               <div className="w-32 px-3 py-2 border-r border-gray-200">Date Added</div>
               <div className="w-32 px-3 py-2">Last Update Date</div>
            </div>
            
            <div className="flex-1 overflow-auto bg-blue-50/10">
              {loading ? (
                <div className="p-8 text-center text-gray-400 text-sm">Loading baselines...</div>
              ) : baselines.length === 0 ? (
                <div className="p-8 text-center text-gray-400 text-sm italic">No baselines found for this project.</div>
              ) : (
                baselines.map(b => (
                  <div 
                    key={b.id} 
                    onClick={() => setSelectedId(b.id)}
                    className={`flex border-b border-gray-100 text-[12px] cursor-pointer transition-colors ${selectedId === b.id ? 'bg-orange-100/60' : 'hover:bg-blue-50 bg-white'}`}
                  >
                    <div className="flex-1 px-3 py-2 border-r border-gray-100 truncate flex items-center gap-2">
                      <div className="w-4 h-4 rounded-sm bg-blue-100 border border-blue-300 flex items-center justify-center">
                        <Save size={10} className="text-blue-600" />
                      </div>
                      {b.name}
                    </div>
                    <div className="w-32 px-3 py-2 border-r border-gray-100 text-gray-500">{b.actualSdDate ? new Date(b.actualSdDate).toLocaleDateString() : '—'}</div>
                    <div className="w-32 px-3 py-2 border-r border-gray-100 text-gray-500">{new Date(b.createdAt).toLocaleDateString()}</div>
                    <div className="w-32 px-3 py-2 text-gray-500">{new Date(b.updatedAt).toLocaleDateString()}</div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Action Sidebar */}
          <div className="w-48 bg-gray-50 p-4 space-y-2 flex flex-col shadow-[inset_4px_0_10px_-5px_rgba(0,0,0,0.05)]">
             <button 
               onClick={onClose}
               className="w-full px-4 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-800 text-xs font-semibold rounded border border-gray-400 shadow-sm flex items-center justify-center gap-2 transition"
             >
                Close
             </button>
             <div className="h-4" />
             <button 
               onClick={handleAdd}
               disabled={busy}
               className="w-full px-4 py-1.5 bg-white hover:bg-gray-50 text-gray-700 text-xs font-semibold rounded border border-gray-300 shadow-sm flex items-center justify-center gap-2 transition disabled:opacity-50"
             >
                <Plus size={14} className="text-blue-600" /> Add
             </button>
             <button 
               onClick={handleDelete}
               disabled={!selectedId || busy}
               className="w-full px-4 py-1.5 bg-white hover:bg-gray-50 text-gray-700 text-xs font-semibold rounded border border-gray-300 shadow-sm flex items-center justify-center gap-2 transition disabled:opacity-40"
             >
                <Trash2 size={14} className="text-red-500" /> Delete
             </button>
             <button className="w-full px-4 py-1.5 bg-white hover:bg-gray-50 text-gray-700 text-xs font-semibold rounded border border-gray-300 shadow-sm flex items-center justify-center gap-2 transition opacity-50 cursor-not-allowed">
               Copy
             </button>
             <button className="w-full px-4 py-1.5 bg-white hover:bg-gray-50 text-gray-700 text-xs font-semibold rounded border border-gray-300 shadow-sm flex items-center justify-center gap-2 transition opacity-50 cursor-not-allowed">
               Update...
             </button>
             <button 
               onClick={handleRestore}
               disabled={!selectedId || busy}
               className="w-full px-4 py-1.5 bg-white hover:bg-gray-50 text-gray-700 text-xs font-semibold rounded border border-gray-300 shadow-sm flex items-center justify-center gap-2 transition disabled:opacity-40"
             >
                <RotateCcw size={14} className="text-green-600" /> Restore
             </button>
          </div>
        </div>

        {/* Bottom Status Bar */}
        <div className="bg-gray-100 border-t border-gray-300 p-4 space-y-4">
           {selectedId ? (
             <div className="grid grid-cols-2 gap-x-8 gap-y-3">
                <div className="space-y-1">
                   <label className="text-[10px] font-bold text-gray-500 uppercase">Baseline Name</label>
                   <input 
                     type="text" 
                     value={baselines.find(b => b.id === selectedId)?.name || ''} 
                     readOnly
                     className="w-full px-2 py-1 text-xs border border-gray-300 bg-white outline-none rounded"
                   />
                </div>
                <div className="space-y-1">
                   <label className="text-[10px] font-bold text-gray-500 uppercase">Baseline Type</label>
                   <select className="w-full px-2 py-1 text-xs border border-gray-300 bg-white outline-none rounded">
                      <option>&lt;None&gt;</option>
                      <option>Customer Sign-off</option>
                      <option>Initial Planning Baseline</option>
                      <option>Management Sign-off</option>
                   </select>
                </div>
                <div className="space-y-1">
                   <label className="text-[10px] font-bold text-gray-500 uppercase">Data Date</label>
                   <input type="text" value={baselines.find(b => b.id === selectedId)?.actualSdDate || '—'} readOnly className="w-full px-2 py-1 text-xs border border-gray-300 bg-gray-50 outline-none rounded text-gray-500" />
                </div>
                <div className="space-y-1">
                   <label className="text-[10px] font-bold text-gray-500 uppercase">Last Update Date</label>
                   <input type="text" value={baselines.find(b => b.id === selectedId)?.updatedAt ? new Date(baselines.find(b => b.id === selectedId)!.updatedAt).toLocaleDateString() : ''} readOnly className="w-full px-2 py-1 text-xs border border-gray-300 bg-gray-50 outline-none rounded text-gray-500" />
                </div>
             </div>
           ) : (
             <div className="h-24 flex items-center justify-center text-gray-400 text-xs bg-gray-50/50 border border-dashed border-gray-300 rounded">
                Select a baseline to view and edit properties
             </div>
           )}
        </div>
      </div>
    </div>
  );
}
