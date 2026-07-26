'use client';
import { useState } from 'react';

interface BoxupRow {
  jointNumber:    string;
  nozzleMark:     string;
  flangeType:     string;
  size:           string;
  rating:         string;
  gasketSpec:     string;
  gasketChecked:  'yes' | 'no' | '';
  studsChecked:   'yes' | 'no' | '';
  alignChecked:   'yes' | 'no' | '';
  cleanChecked:   'yes' | 'no' | '';
  handTight:      'yes' | 'no' | '';
  inspectedBy:    string;
  inspectedDate:  string;
  remarks:        string;
}

type CheckField = 'gasketChecked' | 'studsChecked' | 'alignChecked' | 'cleanChecked' | 'handTight';

function YesNoCell({ value, onChange }: { value: 'yes' | 'no' | ''; onChange: (v: 'yes' | 'no') => void }) {
  return (
    <div className="flex gap-1.5 justify-center">
      {(['yes', 'no'] as const).map(opt => (
        <button key={opt} onClick={() => onChange(opt)}
          className={`w-8 h-8 text-[10px] rounded-xl font-black transition-all border shadow-sm ${
            value === opt
              ? opt === 'yes' ? 'bg-green-500 text-white border-green-400 scale-110' : 'bg-red-500 text-white border-red-400 scale-110'
              : 'bg-white border-gray-100 text-gray-300 hover:border-gray-300'
          }`}>
          {opt === 'yes' ? '✓' : '✗'}
        </button>
      ))}
    </div>
  );
}

export function FlangeBoxupChecklist({
  workpackId,
  content: initialContent,
  onSave,
}: {
  workpackId: string;
  content: { title: string; rows: BoxupRow[] };
  onSave: (content: unknown) => Promise<void>;
}) {
  const [rows, setRows] = useState<BoxupRow[]>(initialContent.rows ?? []);
  const [populating, setPopulating] = useState(false);
  const [saving, setSaving] = useState(false);

  const updateCell = (rowIdx: number, field: keyof BoxupRow, value: string) => {
    setRows(prev => prev.map((r, i) => i === rowIdx ? { ...r, [field]: value } : r));
  };

  const populateFromJoints = async () => {
    setPopulating(true);
    try {
        const res = await fetch(`/api/workpacks/${workpackId}/joints`);
        const data = await res.json();
        const joints = data.joints ?? data ?? [];
        setRows(joints.map((j: any) => ({
            jointNumber:   j.joint_number ?? '',
            nozzleMark:    j.nozzle_mark  ?? '',
            flangeType:    j.flange_type  ?? '',
            size:          j.size  ?? '',
            rating:        j.rating ?? '',
            gasketSpec:    j.gasket_spec ?? '',
            gasketChecked: '', studsChecked: '', alignChecked: '',
            cleanChecked: '', handTight: '',
            inspectedBy: '', inspectedDate: '', remarks: '',
        })));
    } finally {
        setPopulating(false);
    }
  };

  const completedCount = rows.filter(r =>
    ['gasketChecked','studsChecked','alignChecked','cleanChecked','handTight'].every(f => r[f as CheckField] === 'yes')
  ).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between bg-gray-900 text-white p-6 rounded-2xl shadow-xl">
        <div>
          <h3 className="text-lg font-black uppercase tracking-tight">2.4 — Flange Joint Box-up Checklist</h3>
          <div className="flex items-center gap-3 mt-1.5">
             <div className="bg-white/10 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest text-indigo-400">
                Assembly Verification
             </div>
             {rows.length > 0 && (
                <span className="text-xs text-gray-400 font-bold">{completedCount} of {rows.length} joints fully verified</span>
             )}
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={populateFromJoints} disabled={populating}
            className="px-4 py-2 text-[10px] font-black uppercase tracking-widest bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl transition-all disabled:opacity-50">
            {populating ? '⟳' : '↓ SYNC JOINTS'}
          </button>
          <button onClick={async () => { setSaving(true); await onSave({ title: initialContent.title, rows }); setSaving(false); }}
            className="px-6 py-2 bg-indigo-500 hover:bg-indigo-400 text-xs font-black uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-indigo-500/20">
            {saving ? '...' : 'SAVE DATA'}
          </button>
        </div>
      </div>

      <div className="overflow-x-auto border border-gray-100 rounded-3xl shadow-sm bg-white">
        <table className="min-w-full text-xs">
          <thead>
            <tr className="bg-gray-50/50 border-b border-gray-100 text-[10px] font-black text-gray-400 uppercase tracking-widest">
              <th className="px-4 py-4 text-left border-r border-gray-50">Joint ID</th>
              <th className="px-3 py-4 text-center border-r border-gray-50">Nozzle</th>
              <th className="px-3 py-4 text-left border-r border-gray-50">Flange Details</th>
              <th className="px-3 py-4 text-center border-r border-gray-50">Gasket</th>
              <th className="px-3 py-4 text-center border-r border-gray-50">Studs</th>
              <th className="px-3 py-4 text-center border-r border-gray-50">Align</th>
              <th className="px-3 py-4 text-center border-r border-gray-50">Clean</th>
              <th className="px-3 py-4 text-center border-r border-gray-50">Tight</th>
              <th className="px-4 py-4 text-left">Inspector / Remarks</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {rows.map((row, i) => {
              const allOk = ['gasketChecked','studsChecked','alignChecked','cleanChecked','handTight'].every(f => row[f as CheckField] === 'yes');
              return (
                <tr key={i} className={`transition-colors ${allOk ? 'bg-green-50/50' : 'hover:bg-gray-50/50'}`}>
                  <td className="px-4 py-3 font-black text-indigo-600 border-r border-gray-50">{row.jointNumber}</td>
                  <td className="px-3 py-3 text-center font-mono font-bold text-gray-400 border-r border-gray-50">{row.nozzleMark}</td>
                  <td className="px-3 py-3 border-r border-gray-50">
                    <div className="flex flex-col gap-0.5">
                        <span className="font-bold text-gray-900">{row.flangeType}</span>
                        <span className="text-[10px] text-gray-400 font-bold uppercase">{row.size} · {row.rating}</span>
                    </div>
                  </td>
                  {(['gasketChecked','studsChecked','alignChecked','cleanChecked','handTight'] as CheckField[]).map(f => (
                    <td key={f} className="px-3 py-3 border-r border-gray-50">
                      <YesNoCell value={row[f]} onChange={v => updateCell(i, f, v)} />
                    </td>
                  ))}
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1.5">
                        <input value={row.inspectedBy} onChange={e => updateCell(i, 'inspectedBy', e.target.value)}
                           placeholder="Inspector Name"
                           className="w-full text-[10px] font-bold border-b border-gray-100 focus:outline-none focus:border-indigo-400 bg-transparent py-0.5" />
                        <input value={row.remarks} onChange={e => updateCell(i, 'remarks', e.target.value)}
                           placeholder="Add remarks..."
                           className="w-full text-[10px] text-gray-400 border-b border-gray-100 focus:outline-none bg-transparent py-0.5" />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
