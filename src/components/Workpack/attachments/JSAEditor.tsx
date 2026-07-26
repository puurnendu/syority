'use client';
import { useState } from 'react';
import { JSA_TEMPLATES, JSATemplateKey } from '@/lib/attachments/jsaTemplates';

const RISK_COLORS: Record<string, string> = {
  Critical: 'bg-red-600 text-white',
  High:     'bg-orange-500 text-white',
  Medium:   'bg-yellow-400 text-gray-900',
  Low:      'bg-green-200 text-green-900',
};

export function JSASelector({
  workpackId,
  existingJSAs,
  onAdded,
}: {
  workpackId: string;
  existingJSAs: string[];
  onAdded: () => void;
}) {
  const [adding, setAdding] = useState<string | null>(null);

  const addJSA = async (key: JSATemplateKey) => {
    setAdding(key);
    const template = JSA_TEMPLATES[key];
    await fetch(`/api/workpacks/${workpackId}/attachments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        group:          'jsas',
        title:          template.title,
        attachmentType: 'template',
        templateKey:    key,
        content:        template,
        isActive:       true,
      }),
    });
    setAdding(null);
    onAdded();
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {(Object.entries(JSA_TEMPLATES) as [JSATemplateKey, typeof JSA_TEMPLATES[JSATemplateKey]][]).map(([key, tmpl]) => {
        const alreadyAdded = existingJSAs.includes(key);
        return (
          <button key={key} onClick={() => !alreadyAdded && addJSA(key)} disabled={alreadyAdded || adding === key}
            className={`flex flex-col gap-3 p-5 rounded-2xl border text-left transition-all group ${
              alreadyAdded 
                ? 'border-green-100 bg-green-50/50 cursor-default shadow-sm' 
                : 'border-gray-100 bg-white hover:border-indigo-300 hover:shadow-xl hover:-translate-y-1'
            }`}>
            <div className="flex items-center justify-between w-full">
               <span className={`text-xl p-2 rounded-xl border ${alreadyAdded ? 'bg-green-500 border-green-400' : 'bg-gray-50 border-gray-100 group-hover:bg-indigo-50 group-hover:border-indigo-100'}`}>
                    {alreadyAdded ? '✅' : '🛡️'}
               </span>
               <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{(tmpl.hazards as unknown as any[]).length} hazards identified</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-black uppercase tracking-tight ${alreadyAdded ? 'text-green-800' : 'text-gray-900'}`}>{tmpl.title}</p>
              <p className="text-[10px] text-gray-400 font-bold mt-1 line-clamp-2 leading-relaxed">{tmpl.jobDescription}</p>
            </div>
            {!alreadyAdded && (
                 <div className="mt-2 text-[10px] font-black text-indigo-500 uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
                    {adding === key ? 'Adding to index...' : 'Add to Workpack →'}
                 </div>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function JSAViewer({ content }: { content: typeof JSA_TEMPLATES[JSATemplateKey] }) {
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="bg-gray-900 text-white rounded-2xl p-6 shadow-xl">
        <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-2">Job Description & Scope</p>
        <p className="text-sm font-bold text-gray-300 leading-relaxed">{content.jobDescription}</p>
      </div>

      {/* Hazard table */}
      <div>
        <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Risk Assessment Matrix</h4>
        <div className="border border-gray-100 rounded-2xl overflow-hidden shadow-sm bg-white">
          <table className="w-full text-xs">
            <thead className="bg-gray-50/50 border-b border-gray-100">
              <tr className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                <th className="px-4 py-3 text-left w-1/4 border-r border-gray-100">Hazardous Activity</th>
                <th className="px-3 py-3 text-center w-24 border-r border-gray-100">Likelihood</th>
                <th className="px-3 py-3 text-center w-24 border-r border-gray-100">Severity</th>
                <th className="px-3 py-3 text-center w-24 border-r border-gray-100">Rating</th>
                <th className="px-4 py-3 text-left">Control Measures & Safety Protocols</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {(content.hazards as unknown as any[]).map((h, i) => (
                <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-3 font-bold text-gray-900 border-r border-gray-100">{h.hazard}</td>
                  <td className="px-3 py-3 text-center text-gray-500 font-medium border-r border-gray-100">{h.likelihood}</td>
                  <td className="px-3 py-3 text-center text-gray-500 font-medium border-r border-gray-100">{h.severity}</td>
                  <td className="px-3 py-3 text-center border-r border-gray-100">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest leading-none ${RISK_COLORS[h.riskRating] ?? 'bg-gray-100'}`}>
                      {h.riskRating}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600 font-medium leading-relaxed">{h.controls}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* PPE + Permits + Emergency */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Mandatory PPE</p>
          <div className="flex flex-wrap gap-2">
              {(content.ppe as unknown as string[]).map(p => (
                  <span key={p} className="text-[10px] font-bold bg-gray-50 text-gray-600 px-3 py-1.5 rounded-lg border border-gray-100 flex items-center gap-2">
                       <span className="text-sm">🦺</span> {p}
                  </span>
              ))}
          </div>
        </div>
        <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Required Permits</p>
          <div className="flex flex-wrap gap-2">
              {(content.permits as unknown as string[]).map(p => (
                  <span key={p} className="text-[10px] font-bold bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-lg border border-indigo-100 flex items-center gap-2">
                       <span className="text-sm">🔏</span> {p}
                  </span>
              ))}
          </div>
        </div>
        <div className="bg-red-50 border border-red-100 rounded-2xl p-6 shadow-sm">
          <p className="text-[10px] font-black text-red-400 uppercase tracking-widest mb-4">Emergency Protocol</p>
          <div className="flex gap-4">
              <span className="text-3xl">⚠️</span>
              <p className="text-xs text-red-800 font-bold leading-relaxed">{content.emergency as string}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
