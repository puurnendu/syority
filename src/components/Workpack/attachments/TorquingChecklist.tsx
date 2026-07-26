'use client';
import { useState } from 'react';

interface JointTorqueRow {
  jointNumber:   string;
  nozzleMark:    string;
  location:      string;
  studSpec:      string;
  studSize:      string;
  studQty:       number;
  specTorque:    string;
  pass1:         string;
  pass2:         string;
  pass3:         string;
  finalCheck:    string;
  completedBy:   string;
  completedDate: string;
  remarks:       string;
}

function TorqueCell({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  if (editing) return (
    <input autoFocus value={draft}
      onChange={e => setDraft(e.target.value)}
      onBlur={() => { onSave(draft); setEditing(false); }}
      onKeyDown={e => { if (e.key === 'Enter') { onSave(draft); setEditing(false); } }}
      className="w-full text-xs border-2 border-indigo-400 rounded px-2 py-0.5 focus:outline-none bg-white shadow-lg"
    />
  );

  return (
    <div onClick={() => { setDraft(value); setEditing(true); }}
      className={`cursor-pointer text-xs px-2 py-1.5 rounded-lg min-h-[1.5rem] transition-colors ${value ? 'text-gray-900 font-bold bg-gray-50/50' : 'text-gray-300 italic hover:bg-gray-100'}`}>
      {value || '—'}
    </div>
  );
}

export function TorquingChecklist({
  workpackId,
  content: initialContent,
  onSave,
}: {
  workpackId: string;
  content: { title: string; rows: JointTorqueRow[] };
  onSave: (content: unknown) => Promise<void>;
}) {
  const [rows, setRows] = useState<JointTorqueRow[]>(initialContent.rows ?? []);
  const [loading, setLoading] = useState(false);
  const [populating, setPopulating] = useState(false);

  const updateCell = (rowIdx: number, field: keyof JointTorqueRow, value: string) => {
    setRows(prev => prev.map((r, i) => i === rowIdx ? { ...r, [field]: value } : r));
  };

  const populateFromJoints = async () => {
    setPopulating(true);
    try {
        const res = await fetch(`/api/workpacks/${workpackId}/joints`);
        const data = await res.json();
        const joints = data.joints ?? data ?? [];
        const newRows: JointTorqueRow[] = joints.map((j: any) => ({
            jointNumber:   j.joint_number ?? '',
            nozzleMark:    j.nozzle_mark  ?? '',
            location:      j.location     ?? '',
            studSpec:      j.stud_spec    ?? 'As per spec',
            studSize:      j.stud_size    ?? '',
            studQty:       j.stud_quantity ?? 0,
            specTorque:    j.torque_value  ?? '',
            pass1: '', pass2: '', pass3: '', finalCheck: '',
            completedBy: '', completedDate: '', remarks: '',
        }));
        setRows(newRows);
    } finally {
        setPopulating(false);
    }
  };

  const save = async () => {
    setLoading(true);
    try {
        await onSave({ title: initialContent.title, rows });
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between bg-gray-50 p-4 rounded-2xl border border-gray-100">
        <div>
           <h3 className="text-sm font-black text-gray-900 uppercase tracking-tight">2.5 — Torquing / Bolt Tensioning Checklist</h3>
           <p className="text-[10px] text-gray-400 font-bold mt-0.5">Sequential cross-pattern tightening verification</p>
        </div>
        <div className="flex gap-3">
          <button onClick={populateFromJoints} disabled={populating}
            className="px-4 py-2 text-[10px] font-black uppercase tracking-widest border border-gray-200 bg-white hover:bg-gray-50 rounded-xl transition-all disabled:opacity-50 flex items-center gap-2">
            {populating ? '⟳' : '↓ SYNC JOINTS'}
          </button>
          <button onClick={save} disabled={loading}
            className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-indigo-600/20 disabled:opacity-50">
            {loading ? '...' : 'SAVE DATA'}
          </button>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-gray-100 rounded-3xl bg-gray-50/30">
          <div className="text-4xl mb-4 grayscale opacity-20">🔩</div>
          <p className="text-sm font-bold text-gray-400">Joint list is currently empty</p>
          <button onClick={populateFromJoints}
            className="mt-4 text-[10px] font-black uppercase tracking-widest text-indigo-500 hover:text-indigo-600 px-4 py-2 rounded-xl border border-indigo-100 bg-indigo-50/50">
            ↓ Populate from Joint Register
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto border border-gray-100 rounded-2xl shadow-sm bg-white">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="bg-gray-900 text-white text-[10px] font-black uppercase tracking-widest">
                <th className="px-4 py-4 text-left border-r border-white/10">Joint No.</th>
                <th className="px-3 py-4 text-center border-r border-white/10">Nozzle</th>
                <th className="px-3 py-4 text-left border-r border-white/10">Spec/Size</th>
                <th className="px-2 py-4 text-center border-r border-white/10">Qty</th>
                <th className="px-3 py-4 text-center border-r border-white/10 text-amber-400">Spec Torque</th>
                <th className="px-3 py-4 text-center border-r border-white/10">Pass 1</th>
                <th className="px-3 py-4 text-center border-r border-white/10">Pass 2</th>
                <th className="px-3 py-4 text-center border-r border-white/10">Pass 3</th>
                <th className="px-3 py-4 text-center border-r border-white/10">Final</th>
                <th className="px-4 py-4 text-left">Inspector / Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows.map((row, i) => (
                <tr key={i} className="hover:bg-indigo-50/30 transition-colors">
                  <td className="px-4 py-2 font-black text-indigo-600 border-r border-gray-50">{row.jointNumber}</td>
                  <td className="px-3 py-2 text-center font-mono font-bold text-gray-500 border-r border-gray-50">{row.nozzleMark}</td>
                  <td className="px-3 py-2 border-r border-gray-50">
                      <div className="flex flex-col gap-0.5">
                          <TorqueCell value={row.studSpec} onSave={v => updateCell(i, 'studSpec', v)} />
                          <TorqueCell value={row.studSize} onSave={v => updateCell(i, 'studSize', v)} />
                      </div>
                  </td>
                  <td className="px-2 py-2 text-center font-black text-gray-400 border-r border-gray-50">{row.studQty}</td>
                  <td className="px-3 py-2 text-center border-r border-gray-50">
                      <div className="bg-amber-50 text-amber-700 font-black rounded-lg py-1 px-2 border border-amber-100">
                        <TorqueCell value={row.specTorque} onSave={v => updateCell(i, 'specTorque', v)} />
                      </div>
                  </td>
                  {(['pass1','pass2','pass3','finalCheck'] as const).map(p => (
                    <td key={p} className="px-3 py-2 border-r border-gray-50">
                      <TorqueCell value={row[p]} onSave={v => updateCell(i, p, v)} />
                    </td>
                  ))}
                  <td className="px-4 py-2">
                    <div className="flex flex-col gap-1">
                        <TorqueCell value={row.completedBy} onSave={v => updateCell(i, 'completedBy', v)} />
                        <TorqueCell value={row.completedDate} onSave={v => updateCell(i, 'completedDate', v)} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
