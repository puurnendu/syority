'use client';

import { useState, useEffect } from 'react';

type PromptConfig = {
  job_type: string;
  prompt_template: string;
  is_custom: boolean;
  version?: number;
};

export function AiPromptsClient() {
  const [prompts, setPrompts] = useState<PromptConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadPrompts();
  }, []);

  const loadPrompts = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/ai-prompts');
      const json = await res.json();
      if (json.data) {
        setPrompts(json.data);
      } else {
        setError(json.error || 'Failed to load prompts');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (p: PromptConfig) => {
    setSelectedType(p.job_type);
    setEditText(p.prompt_template);
    setError('');
  };

  const handleSave = async () => {
    if (!selectedType) return;
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/ai-prompts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job_type: selectedType, prompt_template: editText }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to save');
      }
      await loadPrompts();
      alert('Prompt saved successfully.');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!selectedType) return;
    if (!confirm('Are you sure you want to reset this prompt to its default template?')) return;
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/ai-prompts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job_type: selectedType, reset: true }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to reset');
      }
      await loadPrompts();
      const updated = prompts.find(p => p.job_type === selectedType);
      // Let it re-select implicitly or explicitly
      setSelectedType(null); 
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading && prompts.length === 0) return <div className="text-gray-500 py-8">Loading prompts...</div>;

  const selectedPrompt = prompts.find(p => p.job_type === selectedType);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="md:col-span-1 bg-white border border-gray-200 rounded-xl overflow-hidden flex flex-col">
        <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
          <h3 className="font-semibold text-gray-800 text-sm">Available Prompts</h3>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {prompts.map((p) => (
            <button
              key={p.job_type}
              onClick={() => handleSelect(p)}
              className={`w-full text-left px-3 py-2 text-sm rounded-lg border ${
                selectedType === p.job_type 
                ? 'bg-blue-50 border-blue-200 text-blue-800' 
                : 'border-transparent text-gray-700 hover:bg-gray-50'
              }`}
            >
              <div className="font-medium capitalize">{p.job_type.replace(/_/g, ' ')}</div>
              <div className="text-xs mt-0.5 flex items-center justify-between">
                <span className={p.is_custom ? 'text-amber-600' : 'text-gray-400'}>
                  {p.is_custom ? 'Customized' : 'System Default'}
                </span>
                {p.version && <span className="text-gray-400">v{p.version}</span>}
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="md:col-span-2">
        {error && <div className="mb-4 rounded-lg bg-red-50 border border-red-200 text-red-700 px-4 py-2 text-sm">{error}</div>}
        
        {!selectedType ? (
          <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-gray-500">
            Select a prompt from the list to view and edit its template.
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl flex flex-col h-full min-h-[400px]">
            <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex justify-between items-center">
              <div>
                <h3 className="font-semibold text-gray-800 text-sm capitalize">{selectedType.replace(/_/g, ' ')}</h3>
                {selectedPrompt?.is_custom && (
                  <span className="text-xs text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded mt-1 inline-block">Customized (v{selectedPrompt.version})</span>
                )}
              </div>
              <div className="flex gap-2">
                {selectedPrompt?.is_custom && (
                  <button
                    onClick={handleReset}
                    disabled={saving}
                    className="px-3 py-1.5 border border-gray-300 text-gray-700 text-xs font-medium rounded-lg hover:bg-gray-50 disabled:opacity-50"
                  >
                    Reset to Default
                  </button>
                )}
                <button
                  onClick={handleSave}
                  disabled={saving || editText === selectedPrompt?.prompt_template}
                  className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
            <div className="flex-1 p-4">
              <textarea
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                className="w-full h-full min-h-[300px] font-mono text-sm p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
                spellCheck={false}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
