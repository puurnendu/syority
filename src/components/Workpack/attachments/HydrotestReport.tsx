'use client';
import { useState } from 'react';

interface HydrotestContent {
  equipmentTag:  string;
  reportNumber:  string;
  testDate:      string;
  fluid:         string;
  temp:          string;
  dur:           string;
  shellSide: {
    designPr:    string;
    testPr:      string;
    gauge1:      string;
    gauge2:      string;
    status:      'passed' | 'failed' | '';
  };
  tubeSide: {
    designPr:    string;
    testPr:      string;
    gauge1:      string;
    gauge2:      string;
    status:      'passed' | 'failed' | '';
  };
  inspector:     string;
  ownerRep:      string;
  remarks:       string;
}

export function HydrotestReport({
  workpackId,
  content: initialContent,
  onSave,
}: {
  workpackId: string;
  content: HydrotestContent;
  onSave: (content: unknown) => Promise<void>;
}) {
  const [content, setContent] = useState<HydrotestContent>(initialContent);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const update = (path: string, value: string) => {
    const parts = path.split('.');
    if (parts.length === 1) {
        setContent(c => ({ ...c, [path]: value }));
    } else {
        const [side, field] = parts;
        setContent(c => ({
            ...c,
            [side]: { ...((c as any)[side]), [field]: value }
        }));
    }
  };

  const syncFromTechData = async () => {
    setSyncing(true);
    try {
        const res = await fetch(`/api/workpacks/${workpackId}`);
        const data = await res.json();
        const techData = data.equipment_technical_data?.hydrotest;
        if (techData) {
            setContent(c => ({
                ...c,
                shellSide: {
                    ...c.shellSide,
                    designPr: String(techData.shellSideDesignPressure ?? c.shellSide.designPr),
                    testPr:   String(techData.shellSideTestPressure   ?? c.shellSide.testPr),
                },
                tubeSide: {
                    ...c.tubeSide,
                    designPr: String(techData.tubeSideDesignPressure ?? c.tubeSide.designPr),
                    testPr:   String(techData.tubeSideTestPressure   ?? c.tubeSide.testPr),
                }
            }));
        }
    } finally {
        setSyncing(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in zoom-in-95 duration-500">
      <div className="flex items-center justify-between bg-white border border-gray-100 p-6 rounded-3xl shadow-sm">
         <div className="flex items-center gap-4">
            <div className="bg-indigo-600 text-white p-3 rounded-2xl shadow-lg shadow-indigo-200">
               <span className="text-xl">💧</span>
            </div>
            <div>
               <h3 className="text-sm font-black text-gray-900 uppercase tracking-tight">Hydrotest / Pressure Test Report</h3>
               <p className="text-[10px] text-gray-400 font-bold mt-0.5">Official certification and leakage verification</p>
            </div>
         </div>
         <div className="flex gap-3">
            <button onClick={syncFromTechData} disabled={syncing}
               className="px-4 py-2 text-[10px] font-black uppercase tracking-widest border border-gray-200 bg-white hover:bg-gray-50 rounded-xl transition-all">
               {syncing ? '...' : 'SYNC TECH DATA'}
            </button>
            <button onClick={async () => { setLoading(true); await onSave(content); setLoading(false); }}
               className="px-6 py-2 bg-gray-900 hover:bg-black text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-gray-200">
               {loading ? 'Saving...' : 'VALIDATE & SAVE'}
            </button>
         </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: 'EQUIPMENT TAG', value: content.equipmentTag, field: 'equipmentTag' },
          { label: 'REPORT NO.',    value: content.reportNumber, field: 'reportNumber' },
          { label: 'TEST DATE',     value: content.testDate,     field: 'testDate', type: 'date' },
          { label: 'TEST FLUID',    value: content.fluid,        field: 'fluid' },
        ].map(f => (
          <div key={f.label} className="bg-gray-50/50 border border-gray-100 p-4 rounded-2xl">
             <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">{f.label}</p>
             <input type={f.type ?? 'text'} value={f.value} onChange={e => update(f.field, e.target.value)}
                className="w-full text-xs font-bold text-gray-900 bg-transparent border-none focus:ring-0 p-0" />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {['shellSide', 'tubeSide'].map(side => (
          <div key={side} className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm overflow-hidden relative">
            <div className="absolute top-0 right-0 p-4">
                <select 
                    value={(content as any)[side].status} 
                    onChange={e => update(`${side}.status`, e.target.value)}
                    className={`text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-xl border appearance-none transition-all ${
                        (content as any)[side].status === 'passed' ? 'bg-green-500 text-white border-green-400' : 
                        (content as any)[side].status === 'failed' ? 'bg-red-500 text-white border-red-400' : 'bg-gray-50 text-gray-400 border-gray-100'
                    }`}
                >
                    <option value="">Pending</option>
                    <option value="passed">✅ PASSED</option>
                    <option value="failed">❌ FAILED</option>
                </select>
            </div>
            <h4 className="text-xs font-black uppercase tracking-widest text-indigo-500 mb-6">{side === 'shellSide' ? 'Shell Side' : 'Tube Side'} Parameters</h4>
            
            <div className="grid grid-cols-2 gap-6">
                <div className="space-y-4">
                    <div>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Design Pressure</p>
                        <input value={(content as any)[side].designPr} onChange={e => update(`${side}.designPr`, e.target.value)}
                           className="text-sm font-black text-gray-900 border-b border-gray-100 focus:border-indigo-400 w-full" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Test Pressure</p>
                        <input value={(content as any)[side].testPr} onChange={e => update(`${side}.testPr`, e.target.value)}
                           className="text-sm font-black text-gray-900 border-b border-gray-100 focus:border-indigo-400 w-full" />
                    </div>
                </div>
                <div className="space-y-4">
                    <div>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Gauge 1 (Serial)</p>
                        <input value={(content as any)[side].gauge1} onChange={e => update(`${side}.gauge1`, e.target.value)}
                           className="text-sm font-bold text-gray-600 border-b border-gray-100 focus:border-indigo-400 w-full" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Gauge 2 (Serial)</p>
                        <input value={(content as any)[side].gauge2} onChange={e => update(`${side}.gauge2`, e.target.value)}
                           className="text-sm font-bold text-gray-600 border-b border-gray-100 focus:border-indigo-400 w-full" />
                    </div>
                </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-4 bg-gray-50/50 p-6 rounded-3xl border border-gray-100">
             <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Signatories</p>
             <div className="flex gap-4">
                <div className="flex-1">
                   <p className="text-[9px] font-black text-indigo-400 uppercase mb-1">Third Party / Inspector</p>
                   <input value={content.inspector} onChange={e => update('inspector', e.target.value)}
                      className="w-full text-xs font-bold border-b border-gray-200 bg-transparent py-2" />
                </div>
                <div className="flex-1">
                   <p className="text-[9px] font-black text-indigo-400 uppercase mb-1">Owner Representative</p>
                   <input value={content.ownerRep} onChange={e => update('ownerRep', e.target.value)}
                      className="w-full text-xs font-bold border-b border-gray-200 bg-transparent py-2" />
                </div>
             </div>
          </div>
          <div className="bg-gray-50/50 p-6 rounded-3xl border border-gray-100">
             <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Final Remarks</p>
             <textarea value={content.remarks} onChange={e => update('remarks', e.target.value)} rows={3}
                placeholder="Observation notes, leak points, re-test requirements..."
                className="w-full text-xs font-medium text-gray-600 bg-transparent border-none focus:ring-0 resize-none p-0" />
          </div>
      </div>
    </div>
  );
}
