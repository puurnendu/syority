'use client';
import { useState } from 'react';

const PencilIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
  </svg>
);

interface MethodStep {
  step: number;
  description: string;
  responsible: string;
  safetyNote?: string;
}

interface MethodStatementContent {
  title: string;
  revision: string;
  equipmentTag: string;
  equipmentDescription: string;
  scope: string;
  resources: {
    manpower:  { role: string; quantity: number }[];
    equipment: { item: string; quantity: string | number }[];
    materials: { item: string; quantity: string }[];
  };
  preSdSteps:    MethodStep[];
  shutdownSteps: MethodStep[];
  postSdSteps:   MethodStep[];
  testProcedure: { shellSideSteps: string[]; tubeSideSteps: string[] };
  references: string[];
}

function StepTable({
  phase,
  steps,
  phaseLabel,
  onEdit,
}: {
  phase: 'preSdSteps' | 'shutdownSteps' | 'postSdSteps';
  steps: MethodStep[];
  phaseLabel: string;
  onEdit: (phase: string, stepIndex: number, field: string, value: string) => void;
}) {
  const PHASE_COLORS: Record<string, string> = {
    preSdSteps:    'bg-blue-700',
    shutdownSteps: 'bg-red-700',
    postSdSteps:   'bg-green-700',
  };

  return (
    <div className="mb-6">
      <div className={`${PHASE_COLORS[phase]} text-white px-4 py-2 rounded-t-lg flex items-center justify-between`}>
        <div className="flex items-center gap-2">
           <span className="text-sm font-semibold">{phaseLabel}</span>
           <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded font-bold">{steps.length} steps</span>
        </div>
      </div>
      <table className="w-full border-x border-b border-gray-200 rounded-b-lg overflow-hidden text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-3 py-2 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest w-12 border-r border-gray-100">Step</th>
            <th className="px-3 py-2 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest border-r border-gray-100">Description</th>
            <th className="px-3 py-2 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest w-32 border-r border-gray-100">Responsible</th>
            <th className="px-3 py-2 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest w-48">Safety Note</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {steps.map((step, i) => (
            <tr key={i} className="hover:bg-gray-50/50">
              <td className="px-3 py-2 text-gray-400 font-mono text-xs border-r border-gray-100">{step.step}</td>
              <td className="px-3 py-2 border-r border-gray-100">
                <EditableText
                  value={step.description}
                  onSave={v => onEdit(phase, i, 'description', v)}
                  multiline
                />
              </td>
              <td className="px-3 py-2 border-r border-gray-100">
                <EditableText
                  value={step.responsible}
                  onSave={v => onEdit(phase, i, 'responsible', v)}
                />
              </td>
              <td className="px-3 py-2">
                <EditableText
                  value={step.safetyNote ?? ''}
                  onSave={v => onEdit(phase, i, 'safetyNote', v)}
                  className="text-xs text-amber-700 font-medium italic"
                  placeholder="Add safety note..."
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EditableText({
  value,
  onSave,
  multiline = false,
  className = '',
  placeholder = 'Click to edit...',
}: {
  value: string;
  onSave: (v: string) => void;
  multiline?: boolean;
  className?: string;
  placeholder?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft]     = useState(value);

  const save = () => { onSave(draft); setEditing(false); };

  if (editing) {
    return multiline ? (
      <textarea
        autoFocus rows={3}
        value={draft} onChange={e => setDraft(e.target.value)}
        onBlur={save}
        className="w-full text-sm border-2 border-indigo-400 rounded-lg px-3 py-2 focus:outline-none resize-none bg-white shadow-lg z-10"
      />
    ) : (
      <input
        autoFocus
        value={draft} onChange={e => setDraft(e.target.value)}
        onBlur={save}
        onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }}
        className={`w-full text-sm border-2 border-indigo-400 rounded-lg px-3 py-1 focus:outline-none bg-white shadow-lg z-10 ${className}`}
      />
    );
  }

  return (
    <div
      onClick={() => { setDraft(value); setEditing(true); }}
      className={`cursor-pointer hover:bg-indigo-50/50 rounded-lg px-2 py-1.5 group flex items-start gap-2 transition-colors ${className}`}
      title="Click to edit"
    >
      <span className={`flex-1 ${!value ? 'text-gray-300 italic text-xs' : 'text-gray-700'}`}>
        {value || placeholder}
      </span>
      <PencilIcon className="w-3.5 h-3.5 text-gray-300 group-hover:text-indigo-400 flex-shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />
    </div>
  );
}

export function MethodStatementEditor({
  workpackId,
  content: initialContent,
  onSave,
}: {
  workpackId: string;
  content: MethodStatementContent;
  onSave: (content: MethodStatementContent) => Promise<void>;
}) {
  const [content, setContent] = useState(initialContent);
  const [saving, setSaving]   = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  const editStep = (phase: string, stepIndex: number, field: string, value: string) => {
    setContent(prev => {
      const steps = [...(prev[phase as keyof typeof prev] as MethodStep[])];
      steps[stepIndex] = { ...steps[stepIndex], [field]: value };
      return { ...prev, [phase]: steps };
    });
  };

  const regenerate = async () => {
    setRegenerating(true);
    try {
        const res = await fetch(`/api/workpacks/${workpackId}/attachments/generate-method-statement`, { method: 'POST' });
        const data = await res.json();
        if (data.content) setContent(data.content as MethodStatementContent);
    } finally {
        setRegenerating(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
        await onSave(content);
    } finally {
        setSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between bg-gray-900 text-white p-6 rounded-2xl shadow-xl">
        <div>
          <h2 className="text-xl font-black tracking-tight">{content.title}</h2>
          <div className="flex items-center gap-3 mt-1.5">
             <span className="text-[10px] font-black bg-indigo-500 px-2 py-0.5 rounded tracking-widest uppercase">{content.revision}</span>
             <span className="text-xs text-gray-400 font-bold">{content.equipmentTag} · {content.equipmentDescription}</span>
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={regenerate} disabled={regenerating}
            className="px-4 py-2 text-xs font-black uppercase tracking-widest bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl transition-all disabled:opacity-50 flex items-center gap-2">
            {regenerating ? '⟳ Regenerating...' : '✨ REGENERATE'}
          </button>
          <button onClick={handleSave} disabled={saving}
            className="px-6 py-2 bg-indigo-500 hover:bg-indigo-400 text-xs font-black uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-indigo-500/20 disabled:opacity-50">
            {saving ? 'Saving...' : 'SAVE CHANGES'}
          </button>
        </div>
      </div>

      {/* Scope */}
      <div className="bg-indigo-50/50 border border-indigo-100 rounded-2xl p-6">
        <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-3">Scope of Work</p>
        <EditableText value={content.scope} onSave={v => setContent(c => ({ ...c, scope: v }))} multiline className="text-sm font-medium leading-relaxed" />
      </div>

      {/* Resources */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
             <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Manpower</p>
             <div className="space-y-2">
                {content.resources.manpower.map((m, i) => (
                    <div key={i} className="flex items-center justify-between text-xs bg-gray-50 px-3 py-2 rounded-lg font-bold">
                        <span className="text-gray-600">{m.role}</span>
                        <span className="text-indigo-600">{m.quantity}</span>
                    </div>
                ))}
             </div>
          </div>
          <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
             <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Equipment & Tools</p>
             <div className="space-y-2">
                {content.resources.equipment.map((e, i) => (
                    <div key={i} className="flex items-center justify-between text-xs bg-gray-50 px-3 py-2 rounded-lg font-bold">
                        <span className="text-gray-600">{e.item}</span>
                        <span className="text-indigo-600">{e.quantity}</span>
                    </div>
                ))}
             </div>
          </div>
          <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
             <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Materials</p>
             <div className="space-y-2">
                {content.resources.materials.map((m, i) => (
                    <div key={i} className="flex items-center justify-between text-xs bg-gray-50 px-3 py-2 rounded-lg font-bold">
                        <span className="text-gray-600">{m.item}</span>
                        <span className="text-indigo-600">{m.quantity}</span>
                    </div>
                ))}
             </div>
          </div>
      </div>

      {/* Step tables */}
      <div className="space-y-4">
        <StepTable phase="preSdSteps"    steps={content.preSdSteps}    phaseLabel="Phase 1: Pre-Shutdown Preparation"    onEdit={editStep} />
        <StepTable phase="shutdownSteps" steps={content.shutdownSteps} phaseLabel="Phase 2: Shutdown Activities"        onEdit={editStep} />
        <StepTable phase="postSdSteps"   steps={content.postSdSteps}   phaseLabel="Phase 3: Post-Shutdown / Commissioning"   onEdit={editStep} />
      </div>

      {/* Hydrotest procedure */}
      {content.testProcedure && (
        <div className="border border-indigo-100 rounded-2xl overflow-hidden shadow-sm bg-white">
          <div className="bg-gray-900 text-white px-6 py-3 border-b border-gray-800">
            <span className="text-xs font-black uppercase tracking-widest">Hydrotest Procedure</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-gray-100">
            {[
              { label: 'Shell Side', steps: content.testProcedure.shellSideSteps },
              { label: 'Tube Side',  steps: content.testProcedure.tubeSideSteps },
            ].map(({ label, steps }) => (
              <div key={label} className="p-6">
                <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-4">{label}</p>
                <ol className="space-y-3">
                  {steps.map((step, i) => (
                    <li key={i} className="flex gap-3 group">
                      <span className="text-[10px] font-black text-gray-300 w-5 flex-shrink-0 mt-2">{i + 1}</span>
                      <EditableText value={step} onSave={v => {
                        const updated = [...steps];
                        updated[i] = v;
                        const fieldName = `${label.toLowerCase().replace(' ', '')}Steps` as 'shellSideSteps' | 'tubeSideSteps';
                        setContent(c => ({
                          ...c,
                          testProcedure: { ...c.testProcedure, [fieldName]: updated }
                        }));
                      }} className="text-sm font-medium" />
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* References */}
      <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Codes & Standards References</p>
          <div className="flex flex-wrap gap-2">
              {content.references.map((r, i) => (
                  <span key={i} className="bg-white border border-gray-200 px-3 py-1.5 rounded-lg text-xs font-bold text-gray-600 shadow-sm">
                      {r}
                  </span>
              ))}
          </div>
      </div>
    </div>
  );
}
