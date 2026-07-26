'use client';
import { useState } from 'react';

interface DORRow {
  activityId:   string;
  description:  string;
  discipline:   string;
  manpower:     'ready' | 'pending' | 'n/a';
  tools:        'ready' | 'pending' | 'n/a';
  materials:    'ready' | 'pending' | 'n/a';
  permits:      'ready' | 'pending' | 'n/a';
  access:       'ready' | 'pending' | 'n/a';
  overall:      'green' | 'yellow' | 'red';
}

function StatusBadge({ 
    value, 
    onChange 
}: { 
    value: 'ready' | 'pending' | 'n/a' | 'green' | 'yellow' | 'red'; 
    onChange: (v: any) => void 
}) {
  const STYLES: Record<string, string> = {
    ready:   'bg-green-100 text-green-700 border-green-200 hover:bg-green-200',
    pending: 'bg-yellow-100 text-yellow-700 border-yellow-200 hover:bg-yellow-200',
    'n/a':   'bg-gray-100 text-gray-400 border-gray-200 hover:bg-gray-200',
    green:   'bg-green-600 text-white border-green-500 shadow-sm shadow-green-100',
    yellow:  'bg-yellow-500 text-white border-yellow-400 shadow-sm shadow-yellow-100',
    red:     'bg-red-500 text-white border-red-400 shadow-sm shadow-red-100',
  };

  const cycleStatus = () => {
    if (['green', 'yellow', 'red'].includes(value)) {
        const next: Record<string, string> = { green: 'yellow', yellow: 'red', red: 'green' };
        onChange(next[value]);
    } else {
        const next: Record<string, string> = { ready: 'pending', pending: 'n/a', 'n/a': 'ready' };
        onChange(next[value as string]);
    }
  };

  return (
    <button onClick={cycleStatus}
       className={`w-full py-2 px-2 rounded-xl text-[10px] font-black uppercase tracking-tight transition-all border ${STYLES[value]}`}>
       {value === 'n/a' ? 'N/A' : value}
    </button>
  );
}

export function DORTable({
  workpackId,
  content: initialContent,
  onSave,
}: {
  workpackId: string;
  content: { title: string; rows: DORRow[] };
  onSave: (content: unknown) => Promise<void>;
}) {
  const [rows, setRows] = useState<DORRow[]>(initialContent.rows ?? []);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const update = (idx: number, field: keyof DORRow, value: any) => {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));
  };

  const syncFromActivities = async () => {
    setSyncing(true);
    try {
        const res = await fetch(`/api/workpacks/${workpackId}/activities`);
        const data = await res.json();
        const acts = data.activities ?? data ?? [];
        setRows(acts.map((a: any) => ({
            activityId:  a.id,
            description: a.name || a.description,
            discipline:  a.discipline || 'Mechanical',
            manpower: 'pending', tools: 'pending', materials: 'pending', permits: 'pending', access: 'pending',
            overall: 'yellow'
        })));
    } finally {
        setSyncing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between bg-indigo-50 border border-indigo-100 p-6 rounded-3xl">
        <div>
           <h3 className="text-sm font-black text-indigo-900 uppercase tracking-tight">DOR — Degree of Readiness Table</h3>
           <p className="text-[10px] text-indigo-400 font-bold mt-0.5">Critical activity readiness and resource availability check</p>
        </div>
        <div className="flex gap-3">
          <button onClick={syncFromActivities} disabled={syncing}
            className="px-4 py-2 text-[10px] font-black uppercase tracking-widest bg-white hover:bg-gray-50 border border-indigo-200 text-indigo-600 rounded-xl transition-all shadow-sm">
            {syncing ? '...' : 'REFRESH ACTIVITIES'}
          </button>
          <button onClick={async () => { setLoading(true); await onSave({ title: initialContent.title, rows }); setLoading(false); }}
            className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-indigo-600/20">
            {loading ? '...' : 'FREEZE READINESS'}
          </button>
        </div>
      </div>

      <div className="overflow-x-auto border border-gray-100 rounded-3xl shadow-sm bg-white">
        <table className="min-w-full text-xs">
          <thead>
            <tr className="bg-gray-900 text-white text-[10px] font-black uppercase tracking-widest">
              <th className="px-6 py-4 text-left border-r border-white/10">Activity Description</th>
              <th className="px-3 py-4 text-center border-r border-white/10">Discipline</th>
              <th className="px-3 py-4 text-center border-r border-white/10">Manpower</th>
              <th className="px-3 py-4 text-center border-r border-white/10">Tools</th>
              <th className="px-3 py-4 text-center border-r border-white/10">Materials</th>
              <th className="px-3 py-4 text-center border-r border-white/10">Permits</th>
              <th className="px-3 py-4 text-center border-r border-white/10">Access</th>
              <th className="px-4 py-4 text-center">Readiness</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {rows.map((row, i) => (
              <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                <td className="px-6 py-3 font-bold text-gray-900 border-r border-gray-50">{row.description}</td>
                <td className="px-3 py-3 text-center border-r border-gray-50">
                    <span className="text-[10px] font-black bg-gray-100 text-gray-500 px-2 py-0.5 rounded uppercase">{row.discipline}</span>
                </td>
                {(['manpower','tools','materials','permits','access'] as const).map(f => (
                  <td key={f} className="px-3 py-3 border-r border-gray-50 w-24">
                    <StatusBadge value={row[f]} onChange={v => update(i, f, v)} />
                  </td>
                ))}
                <td className="px-4 py-3 w-32">
                  <StatusBadge value={row.overall} onChange={v => update(i, 'overall', v)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      <div className="flex gap-6 mt-4">
          <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500 shadow-sm"></div>
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Ready for STO</span>
          </div>
          <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-yellow-500 shadow-sm"></div>
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Final Prep Underway</span>
          </div>
          <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500 shadow-sm"></div>
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Critical Gaps Exist</span>
          </div>
      </div>
    </div>
  );
}
