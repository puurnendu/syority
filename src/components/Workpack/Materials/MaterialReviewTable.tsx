'use client';

import { useState, useCallback } from 'react';
import type { GeneratedMaterial } from './GenerateMaterialsModal';

const CATEGORY_FILTERS = [
  'All',
  'Gaskets',
  'Bolts & Nuts',
  'Blind Gaskets',
  'Welding Consumables',
  'Cleaning Consumables',
  'Inspection Materials',
  'Misc',
  'Chemicals',
];

type EditableMaterial = GeneratedMaterial & { _selected?: boolean };

interface MaterialReviewTableProps {
  open: boolean;
  onClose: () => void;
  materials: GeneratedMaterial[];
  workpackId: string;
  sourceLabel?: string;
  onSaved: () => void;
  onRegenerate: () => void;
}

export function MaterialReviewTable({
  open,
  onClose,
  materials: initialMaterials,
  workpackId,
  sourceLabel = 'AI — Joints + Blinds + Activities',
  onSaved,
  onRegenerate,
}: MaterialReviewTableProps) {
  const [rows, setRows] = useState<EditableMaterial[]>(() =>
    initialMaterials.map((m) => ({ ...m, _selected: true }))
  );
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const updateRow = useCallback((index: number, field: keyof GeneratedMaterial, value: string | number | null) => {
    setRows((prev) => {
      const next = [...prev];
      const r = { ...next[index]! };
      (r as Record<string, unknown>)[field] = value;
      next[index] = r;
      return next;
    });
  }, []);

  const toggleRow = useCallback((index: number) => {
    setRows((prev) => {
      const next = [...prev];
      next[index] = { ...next[index]!, _selected: !next[index]!._selected };
      return next;
    });
  }, []);

  const toggleAll = useCallback((checked: boolean) => {
    setRows((prev) => prev.map((r) => ({ ...r, _selected: checked })));
  }, []);

  const handleSave = async () => {
    const toSave = rows.filter((r) => r._selected !== false).map(({ _selected, ...m }) => m);
    if (toSave.length === 0) {
      setError('Select at least one material to add.');
      return;
    }
    setError('');
    setSaving(true);
    try {
      const res = await fetch(`/api/workpacks/${workpackId}/materials/bulk-create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ materials: toSave, skipDuplicates: true }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Request failed (${res.status})`);
      }
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  const filtered =
    categoryFilter === 'All'
      ? rows
      : rows.filter((r) => r.category === categoryFilter);
  const selectedCount = rows.filter((r) => r._selected).length;
  const allSelected = rows.length > 0 && rows.every((r) => r._selected);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden />
      <div className="relative bg-white rounded-xl shadow-xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 flex-shrink-0">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              Review Generated Materials ({rows.length} items)
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">Source: {sourceLabel}</p>
          </div>
          <button type="button" onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded">✕</button>
        </div>
        <div className="flex items-center gap-2 p-3 border-b border-gray-100 flex-wrap">
          <span className="text-xs text-gray-500">Filter:</span>
          {CATEGORY_FILTERS.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategoryFilter(cat)}
              className={`px-2.5 py-1 text-xs font-medium rounded-lg ${
                categoryFilter === cat
                  ? 'bg-[#0D2137] text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
        <div className="overflow-auto flex-1 p-4">
          <p className="text-xs text-gray-500 mb-2">
            All rows editable inline. Uncheck to exclude from list.
          </p>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-gray-200 text-xs text-gray-500 uppercase tracking-wider">
                <th className="py-2 pr-2 text-left font-medium w-10">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={(e) => toggleAll(e.target.checked)}
                    className="rounded"
                  />
                </th>
                <th className="py-2 pr-2 text-left font-medium" style={{ minWidth: 100 }}>Category</th>
                <th className="py-2 pr-2 text-left font-medium" style={{ minWidth: 260 }}>Description</th>
                <th className="py-2 pr-2 text-right font-medium w-20">Qty</th>
                <th className="py-2 pr-2 text-left font-medium w-14">Unit</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row, i) => {
                const globalIndex = rows.indexOf(row);
                if (globalIndex < 0) return null;
                return (
                  <tr
                    key={globalIndex}
                    className={`border-b border-gray-100 ${row._selected === false ? 'opacity-60' : ''}`}
                  >
                    <td className="py-1.5 pr-2">
                      <input
                        type="checkbox"
                        checked={row._selected !== false}
                        onChange={() => toggleRow(globalIndex)}
                        className="rounded"
                      />
                    </td>
                    <td className="py-1.5 pr-2">
                      <input
                        value={row.category}
                        onChange={(e) => updateRow(globalIndex, 'category', e.target.value)}
                        className="w-full px-2 py-1 border border-gray-200 rounded text-xs"
                      />
                    </td>
                    <td className="py-1.5 pr-2">
                      <input
                        value={row.description}
                        onChange={(e) => updateRow(globalIndex, 'description', e.target.value)}
                        className="w-full px-2 py-1 border border-gray-200 rounded text-xs"
                      />
                    </td>
                    <td className="py-1.5 pr-2 text-right">
                      <input
                        type="number"
                        min={0.01}
                        step={0.01}
                        value={row.quantity}
                        onChange={(e) => updateRow(globalIndex, 'quantity', parseFloat(e.target.value) || 0)}
                        className="w-16 px-2 py-1 border border-gray-200 rounded text-xs text-right"
                      />
                    </td>
                    <td className="py-1.5 pr-2">
                      <input
                        value={row.unit}
                        onChange={(e) => updateRow(globalIndex, 'unit', e.target.value)}
                        className="w-full px-2 py-1 border border-gray-200 rounded text-xs"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {error && (
            <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
          )}
        </div>
        <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-200 flex-shrink-0">
          <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200">
            Cancel
          </button>
          <button
            type="button"
            onClick={onRegenerate}
            className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200"
          >
            Regenerate
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || selectedCount === 0}
            className="px-4 py-2 bg-[#0D2137] text-white text-sm font-medium rounded-lg hover:bg-[#1a3a5c] disabled:opacity-50"
          >
            {saving ? 'Saving…' : `✓ Add ${selectedCount} Items to Material List`}
          </button>
        </div>
      </div>
    </div>
  );
}
