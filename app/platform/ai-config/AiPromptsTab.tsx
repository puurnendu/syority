'use client';

import { useState, useEffect, useCallback } from 'react';

const JOB_TYPE_LABELS: Record<string, { label: string; description: string }> = {
  workpack_generation: {
    label: 'Workpack Generation',
    description: 'Used when AI generates a full workpack from a scope description.',
  },
  document_parameter_extraction: {
    label: 'Document Parameter Extraction',
    description: 'Vision AI prompt for extracting parameters from PDFs and engineering drawings.',
  },
  lessons_suggestion: {
    label: 'Lessons Learned Suggestion',
    description: 'AI prompt for suggesting lessons learned from a completed workpack.',
  },
  whatsapp_extraction: {
    label: 'WhatsApp Data Extraction',
    description: 'Extracts structured progress data from field WhatsApp messages.',
  },
  whatsapp_report: {
    label: 'WhatsApp Shift Report',
    description: 'Generates shift summary reports from WhatsApp conversations.',
  },
  document_vision: {
    label: 'Document Vision (P&ID)',
    description: 'Identifies equipment, tags, and connections in engineering diagrams.',
  },
};

type PromptRecord = {
  job_type: string;
  id: string | null;
  prompt_template: string;
  is_active: boolean;
  is_customized: boolean;
  version: number;
  updated_at: string | null;
};

export default function AiPromptsTab() {
  const [prompts, setPrompts] = useState<PromptRecord[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/ai-prompts');
      const json = await res.json();
      setPrompts(json.data ?? []);
      if (!selected && json.data?.length) {
        setSelected(json.data[0].job_type);
        setEditValue(json.data[0].prompt_template);
      }
    } finally {
      setLoading(false);
    }
  }, [selected]);

  useEffect(() => { load(); }, [load]);

  const current = prompts.find((p) => p.job_type === selected);

  function selectPrompt(jobType: string) {
    setSelected(jobType);
    const p = prompts.find((x) => x.job_type === jobType);
    setEditValue(p?.prompt_template ?? '');
    setSavedMsg('');
  }

  async function handleSave() {
    if (!selected) return;
    setSaving(true);
    try {
      const res = await fetch('/api/ai-prompts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job_type: selected, prompt_template: editValue }),
      });
      if (!res.ok) throw new Error('Save failed');
      setSavedMsg('Saved successfully!');
      await load();
    } catch {
      setSavedMsg('Failed to save. Please try again.');
    } finally {
      setSaving(false);
      setTimeout(() => setSavedMsg(''), 3000);
    }
  }

  async function handleReset() {
    if (!selected || !confirm('Reset this prompt to the system default? Your custom version will be lost.')) return;
    setResetting(true);
    try {
      await fetch('/api/ai-prompts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job_type: selected, reset: true }),
      });
      setSavedMsg('Reset to default!');
      await load();
    } finally {
      setResetting(false);
      setTimeout(() => setSavedMsg(''), 3000);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        <div className="animate-pulse">Loading prompts…</div>
      </div>
    );
  }

  return (
    <div className="flex gap-0 rounded-xl border border-gray-700 overflow-hidden" style={{ minHeight: 560 }}>
      {/* Sidebar */}
      <aside className="w-64 flex-shrink-0 border-r border-gray-700 bg-gray-900">
        <div className="p-4 border-b border-gray-700">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Prompt Templates</p>
        </div>
        <nav className="py-2">
          {prompts.map((p) => {
            const meta = JOB_TYPE_LABELS[p.job_type] ?? { label: p.job_type, description: '' };
            const active = p.job_type === selected;
            return (
              <button
                key={p.job_type}
                onClick={() => selectPrompt(p.job_type)}
                className={`w-full text-left px-4 py-3 transition-colors ${
                  active
                    ? 'bg-indigo-500/20 border-r-2 border-indigo-400 text-indigo-300'
                    : 'text-gray-300 hover:bg-gray-800'
                }`}
              >
                <div className="text-sm font-medium leading-tight">{meta.label}</div>
                {p.is_customized && (
                  <span className="mt-1 inline-block text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 font-medium">
                    Customized
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Editor */}
      <div className="flex-1 flex flex-col bg-gray-950">
        {current && (
          <>
            <div className="p-5 border-b border-gray-700 flex items-center justify-between gap-4 flex-wrap">
              <div>
                <h3 className="text-base font-semibold text-white">
                  {JOB_TYPE_LABELS[current.job_type]?.label ?? current.job_type}
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  {JOB_TYPE_LABELS[current.job_type]?.description}
                </p>
                {current.is_customized && (
                  <p className="text-xs text-amber-400 mt-1">
                    Version {current.version} · Last saved:{' '}
                    {current.updated_at ? new Date(current.updated_at).toLocaleString() : '—'}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {current.is_customized && (
                  <button
                    onClick={handleReset}
                    disabled={resetting}
                    className="px-3 py-1.5 text-xs rounded-lg border border-gray-600 text-gray-300 hover:bg-gray-800 transition disabled:opacity-50"
                  >
                    {resetting ? 'Resetting…' : 'Reset to Default'}
                  </button>
                )}
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-4 py-1.5 text-xs rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition disabled:opacity-60"
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
                {savedMsg && (
                  <span className={`text-xs ${savedMsg.includes('Failed') ? 'text-red-400' : 'text-green-400'}`}>
                    {savedMsg}
                  </span>
                )}
              </div>
            </div>

            {/* Template variables hint */}
            <div className="px-5 py-2 bg-gray-900/50 border-b border-gray-700">
              <p className="text-xs text-gray-500">
                <span className="text-indigo-400 font-medium">Template variables:</span>{' '}
                <code className="text-gray-400">{'{{title}}'}</code>{' '}
                <code className="text-gray-400">{'{{scope_of_work}}'}</code>{' '}
                <code className="text-gray-400">{'{{work_type}}'}</code>{' '}
                <code className="text-gray-400">{'{{drawings_description}}'}</code>{' '}
                <code className="text-gray-400">{'{{operational_context}}'}</code>{' '}
                <code className="text-gray-400">{'{{context}}'}</code>
              </p>
            </div>

            <textarea
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="flex-1 w-full p-5 font-mono text-sm bg-transparent text-gray-100 resize-none outline-none leading-relaxed"
              spellCheck={false}
              placeholder="Enter prompt template…"
            />
          </>
        )}
      </div>
    </div>
  );
}
