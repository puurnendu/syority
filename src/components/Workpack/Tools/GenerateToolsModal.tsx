'use client';

import { useState } from 'react';

export type GeneratedTool = {
  category: string;
  name: string;
  description?: string | null;
  quantity: number;
  unit: string;
  toolType: string;
  certRequired: boolean;
  notes?: string | null;
};

interface GenerateToolsModalProps {
  open: boolean;
  onClose: () => void;
  workpackId: string;
  equipmentType?: string | null;
  equipmentTag?: string | null;
  activityCount?: number;
  documents?: { id: string; original_filename: string }[];
  onGenerated: (tools: GeneratedTool[]) => void;
}

export function GenerateToolsModal({
  open,
  onClose,
  workpackId,
  equipmentType = '',
  equipmentTag = '',
  activityCount = 0,
  documents = [],
  onGenerated,
}: GenerateToolsModalProps) {
  const [useRiggingPlan, setUseRiggingPlan] = useState(false);
  const [selectedDocId, setSelectedDocId] = useState('');
  const [useActivities, setUseActivities] = useState(true);
  const [useEquipment, setUseEquipment] = useState(true);
  const [weightKg, setWeightKg] = useState('');
  const [heaviestLiftKg, setHeaviestLiftKg] = useState('');
  const [workHeightM, setWorkHeightM] = useState('');
  const [confinedSpace, setConfinedSpace] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGenerate = async () => {
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`/api/workpacks/${workpackId}/tools/generate-with-ai`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          useRiggingPlan,
          documentId: useRiggingPlan && selectedDocId ? selectedDocId : undefined,
          useActivities,
          equipmentTag: useEquipment ? equipmentTag : undefined,
          equipmentType: useEquipment ? equipmentType : undefined,
          weightKg: weightKg.trim() || undefined,
          heaviestLiftKg: heaviestLiftKg.trim() || undefined,
          workHeightM: workHeightM.trim() || undefined,
          confinedSpace,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Request failed (${res.status})`);
      }
      const data = await res.json();
      const tools = Array.isArray(data.tools) ? data.tools : [];
      onGenerated(tools);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Generation failed');
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  const pdfDocs = documents.filter((d) => d.original_filename?.toLowerCase().endsWith('.pdf'));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden />
      <div className="relative bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 sticky top-0 bg-white">
          <h3 className="text-lg font-semibold text-gray-900">Generate Tool List with AI</h3>
          <button type="button" onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded">✕</button>
        </div>
        <div className="p-4 space-y-4">
          <p className="text-sm font-medium text-gray-700">Source (select all that apply):</p>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={useRiggingPlan}
              onChange={(e) => setUseRiggingPlan(e.target.checked)}
              className="rounded"
            />
            <span className="text-sm text-gray-800">Rigging Plan (attached to this workpack)</span>
          </label>
          {useRiggingPlan && pdfDocs.length > 0 && (
            <div className="ml-6">
              <select
                value={selectedDocId}
                onChange={(e) => setSelectedDocId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="">Select document…</option>
                {pdfDocs.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.original_filename}
                  </option>
                ))}
              </select>
            </div>
          )}
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={useActivities} onChange={(e) => setUseActivities(e.target.checked)} className="rounded" />
            <span className="text-sm text-gray-800">Activities ({activityCount} activities)</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={useEquipment} onChange={(e) => setUseEquipment(e.target.checked)} className="rounded" />
            <span className="text-sm text-gray-800">Equipment data ({equipmentType || '—'} {equipmentTag || ''})</span>
          </label>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Equipment weight (kg)</label>
            <input
              type="text"
              value={weightKg}
              onChange={(e) => setWeightKg(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              placeholder="e.g. 18500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Heaviest lift (kg)</label>
            <input
              type="text"
              value={heaviestLiftKg}
              onChange={(e) => setHeaviestLiftKg(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              placeholder="e.g. 12000"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Work height (m)</label>
            <input
              type="text"
              value={workHeightM}
              onChange={(e) => setWorkHeightM(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              placeholder="e.g. 4.5"
            />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={confinedSpace} onChange={(e) => setConfinedSpace(e.target.checked)} className="rounded" />
            <span className="text-sm text-gray-800">Confined space entry required</span>
          </label>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
          )}
        </div>
        <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-200">
          <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200">
            Cancel
          </button>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={loading}
            className="px-4 py-2 bg-[#0D2137] text-white text-sm font-medium rounded-lg hover:bg-[#1a3a5c] disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? (
              <>
                <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                Generating…
              </>
            ) : (
              'Generate Tool List →'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
