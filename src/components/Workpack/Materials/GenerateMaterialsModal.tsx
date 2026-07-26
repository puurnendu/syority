'use client';

import { useState } from 'react';

export type GeneratedMaterial = {
  category: string;
  itemCode: string | null;
  description: string;
  quantity: number;
  unit: string;
  spec: string | null;
  linkedJointNo: string | null;
  source: string;
  notes: string | null;
};

interface GenerateMaterialsModalProps {
  open: boolean;
  onClose: () => void;
  workpackId: string;
  equipmentType?: string | null;
  equipmentTag?: string | null;
  scopeHint?: string | null;
  jointCount?: number;
  blindCount?: number;
  activityCount?: number;
  onGenerated: (materials: GeneratedMaterial[]) => void;
}

export function GenerateMaterialsModal({
  open,
  onClose,
  workpackId,
  equipmentType = '',
  equipmentTag = '',
  scopeHint: initialScopeHint = '',
  jointCount = 0,
  blindCount = 0,
  activityCount = 0,
  onGenerated,
}: GenerateMaterialsModalProps) {
  const [useJoints, setUseJoints] = useState(true);
  const [useBlinds, setUseBlinds] = useState(true);
  const [useActivities, setUseActivities] = useState(true);
  const [useUpload, setUseUpload] = useState(false);
  const [scopeHint, setScopeHint] = useState(initialScopeHint || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGenerate = async () => {
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`/api/workpacks/${workpackId}/materials/generate-with-ai`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          useJoints,
          useBlinds,
          useActivities,
          scopeHint: scopeHint.trim() || undefined,
          equipmentType: equipmentType || undefined,
          equipmentTag: equipmentTag || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Request failed (${res.status})`);
      }
      const data = await res.json();
      const items =
        data.items ?? data.materials ?? data.data ?? data ?? [];
      const materials = Array.isArray(items) ? items : [];
      onGenerated(materials);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Generation failed');
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden />
      <div className="relative bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 sticky top-0 bg-white">
          <h3 className="text-lg font-semibold text-gray-900">Generate Material List with AI</h3>
          <button type="button" onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded">✕</button>
        </div>
        <div className="p-4 space-y-4">
          <p className="text-sm font-medium text-gray-700">Source (select all that apply):</p>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={useJoints} onChange={(e) => setUseJoints(e.target.checked)} className="rounded" />
            <span className="text-sm text-gray-800">Joint Register ({jointCount} joints detected)</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={useBlinds} onChange={(e) => setUseBlinds(e.target.checked)} className="rounded" />
            <span className="text-sm text-gray-800">Blind Register ({blindCount} blinds detected)</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={useActivities} onChange={(e) => setUseActivities(e.target.checked)} className="rounded" />
            <span className="text-sm text-gray-800">Activities ({activityCount} activities detected)</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer opacity-60">
            <input type="checkbox" checked={useUpload} onChange={(e) => setUseUpload(e.target.checked)} className="rounded" disabled />
            <span className="text-sm text-gray-600">Upload additional document (BOM, spec sheet) — coming soon</span>
          </label>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Equipment type</label>
            <input
              type="text"
              value={equipmentType ?? ''}
              readOnly
              className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-700 text-sm"
              placeholder="e.g. Heat Exchanger"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Equipment tag</label>
            <input
              type="text"
              value={equipmentTag ?? ''}
              readOnly
              className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-700 text-sm"
              placeholder="e.g. E-435"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Scope hint (optional)</label>
            <input
              type="text"
              value={scopeHint}
              onChange={(e) => setScopeHint(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="e.g. Retubing — full bundle replacement"
            />
          </div>

          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
            ⚠ AI will generate gaskets, bolts, consumables, chemicals and misc items. Review before saving.
          </div>

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
              'Generate Materials →'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
