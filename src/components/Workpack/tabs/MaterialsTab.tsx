'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { hasPermission } from '@/lib/permissions';
import { PROCUREMENT_STATUSES } from '@/lib/materials/constants';
import { AutocompleteItemInput } from '@/components/ui/AutocompleteItemInput';
import { GenerateMaterialsModal, type GeneratedMaterial } from '@/components/Workpack/Materials/GenerateMaterialsModal';
import { MaterialReviewTable } from '@/components/Workpack/Materials/MaterialReviewTable';
import { AiGeneratedBanner } from '@/components/Workpack/AiGeneratedBanner';
import { EmptyStateWithAI } from '@/components/Workpack/EmptyStateWithAI';
import { MaterialsByDiscipline } from '@/components/Workpack/Materials/MaterialsByDiscipline';

type ViewMode = 'by_source' | 'consolidated' | 'by_category' | 'by_discipline';

export function MaterialsTab({
  workpack,
}: {
  workpack: {
    id: string;
    equipment_type?: string | null;
    asset?: { tag?: string; name?: string; tag_number?: string } | null;
    joint_integrity_items?: unknown[];
    blinds?: unknown[];
    activities?: unknown[];
    scope_of_work?: string | null;
  };
}) {
  const { data: session } = useSession();
  const role = (session?.user as any)?.role ?? (session?.user as any)?.roles?.[0];
  const canEdit = hasPermission(role, 'workpacks.edit');

  const workpackId = workpack.id;
  const [data, setData] = useState<{
    lines?: any[];
    consolidated?: any[];
    summary?: Record<string, number>;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<ViewMode>('by_source');
  const [showAddDirect, setShowAddDirect] = useState(false);
  const [newLine, setNewLine] = useState({
    description: '',
    item_catalog_id: '',
    quantity_required: '1',
    unit_of_measure: 'EA',
    sap_material_number: '',
    item_code: '',
    material_category: 'mechanical',
  });
  const [addingLine, setAddingLine] = useState(false);
  const [exportLoading, setExportLoading] = useState<string | null>(null);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [showReviewTable, setShowReviewTable] = useState(false);
  const [generatedMaterials, setGeneratedMaterials] = useState<GeneratedMaterial[]>([]);
  const [aiBannerDismissed, setAiBannerDismissed] = useState(false);
  const [regenConfirmOpen, setRegenConfirmOpen] = useState(false);
  const [regenLoading, setRegenLoading] = useState(false);
  const [regenSuccess, setRegenSuccess] = useState<string | null>(null);

  useEffect(() => {
    loadMaterials();
  }, [workpackId]);

  useEffect(() => {
    const handler = () => setRegenConfirmOpen(true);
    window.addEventListener('trigger-regen-materials', handler);
    return () => window.removeEventListener('trigger-regen-materials', handler);
  }, []);

  async function runRegenerate() {
    setRegenConfirmOpen(false);
    setRegenLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/workpacks/${workpackId}/materials/generate-with-ai`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          regenerate: true,
          autoSave: true,
          equipmentType: workpack.equipment_type ?? 'Equipment',
          scopeHint: workpack.scope_of_work ?? '',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error ?? 'Regenerate failed');
      await loadMaterials();
      const n = (data as { count?: number }).count ?? 0;
      setRegenSuccess(`✓ Materials regenerated — ${n} AI items replaced. Manual items preserved.`);
      setTimeout(() => setRegenSuccess(null), 5000);
    } catch (e: any) {
      setError('Regenerate failed: ' + (e?.message ?? 'Unknown error'));
    } finally {
      setRegenLoading(false);
    }
  }

  async function loadMaterials() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/workpacks/${workpackId}/materials`);
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? res.statusText);
      }
      setData(await res.json());
    } catch (e: any) {
      setError('Failed to load materials: ' + (e?.message ?? 'Unknown error'));
    } finally {
      setLoading(false);
    }
  }

  async function addDirectLine() {
    if (!newLine.description.trim()) return;
    setAddingLine(true);
    setError(null);
    const body = {
      ...newLine,
      quantity_required: parseFloat(newLine.quantity_required) || 1,
    };
    try {
      const res = await fetch(`/api/workpacks/${workpackId}/materials`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? res.statusText);
      }
      if (!body.item_catalog_id && body.description.trim()) {
        fetch('/api/master-data/items/draft', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            description: body.description.trim(),
            unit_of_measure: body.unit_of_measure,
            source_workpack: workpackId,
          }),
        }).catch(() => {
          console.warn('[Materials] Draft catalog save failed');
        });
      }
      setNewLine({
        description: '',
        item_catalog_id: '',
        quantity_required: '1',
        unit_of_measure: 'EA',
        sap_material_number: '',
        item_code: '',
        material_category: 'mechanical',
      });
      setShowAddDirect(false);
      await loadMaterials();
    } catch (e: any) {
      setError('Failed to add item: ' + (e?.message ?? 'Unknown error'));
    } finally {
      setAddingLine(false);
    }
  }

  async function deleteLine(lineId: string) {
    setError(null);
    try {
      const res = await fetch(
        `/api/workpacks/${workpackId}/materials/${lineId}`,
        { method: 'DELETE' }
      );
      if (!res.ok) throw new Error('Delete failed');
      await loadMaterials();
    } catch (e: any) {
      setError('Failed to remove line: ' + (e?.message ?? 'Unknown error'));
    }
  }

  async function downloadExport(format: string) {
    setExportLoading(format);
    setError(null);
    try {
      const res = await fetch(
        `/api/workpacks/${workpackId}/materials/export?format=${format}`
      );
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const cd = res.headers.get('content-disposition') ?? '';
      const fname =
        cd.match(/filename="([^"]+)"/)?.[1] ??
        `materials.${format === 'excel' ? 'xlsx' : 'csv'}`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fname;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setError('Export failed: ' + (e?.message ?? 'Unknown error'));
    } finally {
      setExportLoading(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-gray-400">
        <div className="animate-spin w-5 h-5 border-2 border-gray-300 border-t-blue-600 rounded-full mr-3" />
        Loading materials...
      </div>
    );
  }

  const { lines = [], consolidated = [], summary = {} } = data ?? {};
  const aiGeneratedCount = (lines as { ai_generated?: boolean }[]).filter((l) => l.ai_generated).length;
  const statusConfig = Object.fromEntries(
    PROCUREMENT_STATUSES.map((s) => [s.value, s])
  );

  const SOURCES = [
    { key: 'joint', label: 'From Joint Register', color: 'bg-blue-50 border-blue-200', badge: 'bg-blue-100 text-blue-700', icon: '🔩' },
    { key: 'activity', label: 'From Activities', color: 'bg-green-50 border-green-200', badge: 'bg-green-100 text-green-700', icon: '📝' },
    { key: 'blind', label: 'From Blind Register', color: 'bg-yellow-50 border-yellow-200', badge: 'bg-yellow-100 text-yellow-700', icon: '🔲' },
    { key: 'ai', label: 'AI Generated', color: 'bg-purple-50 border-purple-200', badge: 'bg-purple-100 text-purple-700', icon: '🤖' },
    { key: 'direct', label: 'Direct Additions', color: 'bg-gray-50 border-gray-200', badge: 'bg-gray-100 text-gray-600', icon: '➕' },
  ];

  return (
    <div className="space-y-4">
      {aiGeneratedCount > 0 && !aiBannerDismissed && (
        <AiGeneratedBanner
          count={aiGeneratedCount}
          entityName="material lines"
          message="Review quantities and specs before ordering."
          onDismiss={() => setAiBannerDismissed(true)}
          onRegenerate={() => setShowGenerateModal(true)}
        />
      )}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <span>⚠</span>
          <span className="flex-1">{error}</span>
          <button type="button" onClick={() => setError(null)}>
            ✕
          </button>
        </div>
      )}
      {regenSuccess && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
          {regenSuccess}
        </div>
      )}

      {regenConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <p className="text-sm text-gray-800 mb-4">
              This will replace the current AI-generated materials list. Any manually added items will be preserved. Continue?
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setRegenConfirmOpen(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={runRegenerate}
                disabled={regenLoading}
                className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                {regenLoading ? 'Regenerating…' : 'Regenerate'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Total Lines', value: summary.total_lines ?? 0 },
          { label: 'From Joints', value: summary.from_joints ?? 0 },
          { label: 'From Blinds', value: summary.from_blinds ?? 0 },
          { label: 'From Activities', value: summary.from_activities ?? 0 },
          { label: 'AI Generated', value: summary.from_ai ?? 0 },
          { label: 'Direct', value: summary.direct ?? 0 },
        ].map((s) => (
          <div
            key={s.label}
            className="bg-white border border-gray-200 rounded-xl p-3 text-center"
          >
            <div className="text-2xl font-bold text-gray-900">{s.value}</div>
            <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex bg-gray-100 rounded-lg p-1 gap-1">
          {[
            { key: 'by_source' as const, label: 'By Source' },
            { key: 'consolidated' as const, label: 'Consolidated' },
            { key: 'by_category' as const, label: 'By Category' },
            { key: 'by_discipline' as const, label: 'Section J (by discipline)' },
          ].map((v) => (
            <button
              key={v.key}
              type="button"
              onClick={() => setView(v.key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${view === v.key
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
                }`}
            >
              {v.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <div className="relative group">
            <button
              type="button"
              className="px-3 py-1.5 bg-white border border-gray-300 text-sm rounded-lg hover:bg-gray-50 flex items-center gap-1.5"
            >
              ⬇ Export
              <span className="text-gray-400">▾</span>
            </button>
            <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 py-1 min-w-[180px] hidden group-hover:block">
              {[
                { format: 'excel', label: '📊 Full Excel (.xlsx)' },
                { format: 'sap_csv', label: '🏭 SAP CSV (for PR)' },
                {
                  format: 'consolidated_csv',
                  label: '📋 Consolidated CSV',
                },
              ].map((e) => (
                <button
                  key={e.format}
                  type="button"
                  onClick={() => downloadExport(e.format)}
                  disabled={exportLoading !== null}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  {exportLoading === e.format ? '⏳ Generating...' : e.label}
                </button>
              ))}
            </div>
          </div>

          {canEdit && (
            <>
              <button
                type="button"
                onClick={() => setShowGenerateModal(true)}
                className="px-3 py-1.5 bg-white border border-gray-300 text-sm font-medium rounded-lg hover:bg-gray-50 flex items-center gap-1.5"
              >
                Generate with AI
              </button>
              <button
                type="button"
                onClick={() => setRegenConfirmOpen(true)}
                className="px-3 py-1.5 text-xs border border-indigo-200 text-indigo-600 rounded-lg hover:bg-indigo-50 flex items-center gap-1.5"
                title="Replace AI-generated materials; manual items preserved"
              >
                ↻ Regenerate Materials
              </button>
              <button
                type="button"
                onClick={() => setShowAddDirect(true)}
                className="px-3 py-1.5 bg-[#0D2137] text-white text-sm font-medium rounded-lg hover:bg-[#1a3a5c] flex items-center gap-1.5"
              >
                + Add Item
              </button>
            </>
          )}
        </div>
      </div>

      {canEdit && showAddDirect && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
          <h4 className="text-sm font-semibold text-gray-800">
            Add Material
          </h4>
          <AutocompleteItemInput
            onSelect={(item) => {
              setNewLine((prev) => ({
                ...prev,
                description: item.description,
                item_catalog_id: item.id,
                unit_of_measure: item.unit_of_measure,
                sap_material_number: item.sap_material_number ?? '',
                item_code: item.item_code ?? '',
              }));
            }}
            onFreeText={(text) => {
              setNewLine((prev) => ({
                ...prev,
                description: text,
                item_catalog_id: '',
              }));
            }}
          />
          {newLine.description && (
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <label className="text-xs text-gray-500 mb-1 block">
                  Quantity *
                </label>
                <input
                  type="number"
                  value={newLine.quantity_required}
                  onChange={(e) =>
                    setNewLine((prev) => ({
                      ...prev,
                      quantity_required: e.target.value,
                    }))
                  }
                  min={0.01}
                  step={0.01}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
              <div className="w-28">
                <label className="text-xs text-gray-500 mb-1 block">
                  UOM
                </label>
                <select
                  value={newLine.unit_of_measure}
                  onChange={(e) =>
                    setNewLine((prev) => ({
                      ...prev,
                      unit_of_measure: e.target.value,
                    }))
                  }
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none"
                >
                  {['EA', 'SET', 'BOX', 'ROLL', 'DRUM', 'KG', 'G', 'L', 'ML', 'M'].map(
                    (u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    )
                  )}
                </select>
              </div>
              <div className="w-32">
                <label className="text-xs text-gray-500 mb-1 block">
                  Category
                </label>
                <select
                  value={newLine.material_category}
                  onChange={(e) =>
                    setNewLine((prev) => ({
                      ...prev,
                      material_category: e.target.value,
                    }))
                  }
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none"
                >
                  <option value="mechanical">Mechanical</option>
                  <option value="electrical">Electrical</option>
                  <option value="instrumentation">Inst.</option>
                  <option value="civil">Civil</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="flex-none pt-5">
                <button
                  type="button"
                  onClick={addDirectLine}
                  disabled={
                    addingLine ||
                    !newLine.description.trim() ||
                    !newLine.quantity_required
                  }
                  className="px-4 py-2 bg-[#0D2137] text-white text-sm rounded-lg hover:bg-[#1a3a5c] disabled:opacity-40"
                >
                  {addingLine ? 'Adding...' : '+ Add'}
                </button>
              </div>
            </div>
          )}
          {newLine.description && !newLine.item_catalog_id && (
            <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              <span>ℹ️</span>
              <span>
                This item is not in your catalog. It will be saved as a{' '}
                <strong>draft</strong> for admin review. Once approved it will
                appear in future searches.
              </span>
            </div>
          )}
          <button
            type="button"
            onClick={() => {
              setShowAddDirect(false);
              setNewLine({
                description: '',
                item_catalog_id: '',
                quantity_required: '1',
                unit_of_measure: 'EA',
                sap_material_number: '',
                item_code: '',
                material_category: 'mechanical',
              });
            }}
            className="text-xs text-gray-500 hover:text-gray-700"
          >
            Cancel
          </button>
        </div>
      )}

      {view === 'by_source' && (
        <div className="space-y-3">
          {SOURCES.map((src) => {
            const srcLines = lines.filter(
              (l: any) => l.source_type === src.key
            );
            if (srcLines.length === 0) return null;
            return (
              <div
                key={src.key}
                className={`border rounded-xl overflow-hidden ${src.color}`}
              >
                <div className="flex items-center gap-2 px-4 py-2.5 border-b">
                  <span>{src.icon}</span>
                  <span className="text-sm font-semibold text-gray-800">
                    {src.label}
                  </span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${src.badge}`}
                  >
                    {srcLines.length} lines
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-white/60">
                        <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">
                          Category
                        </th>
                        <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">
                          SAP #
                        </th>
                        <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">
                          Description
                        </th>
                        <th className="text-right px-4 py-2 text-xs font-medium text-gray-500 w-16">
                          Qty
                        </th>
                        <th className="text-left px-4 py-2 text-xs font-medium text-gray-500 w-14">
                          UOM
                        </th>
                        <th className="text-left px-4 py-2 text-xs font-medium text-gray-500 w-24">
                          Spec
                        </th>
                        <th className="text-left px-4 py-2 text-xs font-medium text-gray-500 w-20">
                          Source
                        </th>
                        <th className="text-left px-4 py-2 text-xs font-medium text-gray-500 w-24">
                          Linked to
                        </th>
                        <th className="text-left px-4 py-2 text-xs font-medium text-gray-500 w-28">
                          Status
                        </th>
                        {canEdit && (
                          <th className="w-8 px-2 py-2" />
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/60">
                      {srcLines.map((line: any) => {
                        const st =
                          statusConfig[line.procurement_status];
                        return (
                          <tr key={line.id} className="hover:bg-white/40">
                            <td className="px-4 py-2 text-xs text-gray-600">
                              {line.category ?? '—'}
                            </td>
                            <td className="px-4 py-2 font-mono text-xs text-gray-500">
                              {line.sap_material_number ??
                                line.item_catalog?.sap_material_number ??
                                line.item_code ??
                                '—'}
                            </td>
                            <td className="px-4 py-2">
                              <div className="text-gray-900">
                                {line.description}
                              </div>
                              {line.is_critical && (
                                <span className="text-xs font-bold text-red-600">
                                  ⚠ CRITICAL
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-2 text-right font-medium text-gray-900">
                              {line.quantity_required}
                            </td>
                            <td className="px-4 py-2 text-gray-500 text-xs">
                              {line.unit_of_measure}
                            </td>
                            <td className="px-4 py-2 text-xs text-gray-500">
                              {line.specification ??
                                line.item_catalog?.specification ??
                                '—'}
                            </td>
                            <td className="px-4 py-2 text-xs text-gray-500 capitalize">
                              {line.source_type ?? '—'}
                            </td>
                            <td className="px-4 py-2 text-xs text-gray-500 font-mono">
                              {line.linked_to ?? '—'}
                            </td>
                            <td className="px-4 py-2">
                              {st && (
                                <span
                                  className={`text-xs px-2 py-0.5 rounded-full font-medium ${st.color}`}
                                >
                                  {st.label}
                                </span>
                              )}
                            </td>
                            {canEdit && (
                              <td className="px-2 py-2">
                                <button
                                  type="button"
                                  onClick={() => deleteLine(line.id)}
                                  className="text-gray-300 hover:text-red-500 text-xs"
                                  title="Delete"
                                >
                                  ✕
                                </button>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {view === 'consolidated' && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-800">
              Consolidated Materials List
            </span>
            <span className="text-xs text-gray-500">
              {consolidated.length} unique items
              {(summary.estimated_cost ?? 0) > 0 && (
                <span className="ml-3 font-medium text-gray-700">
                  Est. Total:{' '}
                  {(summary.estimated_cost ?? 0).toLocaleString('en-AU', {
                    style: 'currency',
                    currency: 'AUD',
                  })}
                </span>
              )}
            </span>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">
                  SAP Material No.
                </th>
                <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">
                  Description
                </th>
                <th className="text-right px-4 py-2 text-xs font-medium text-gray-500 w-16">
                  Total Qty
                </th>
                <th className="text-left px-4 py-2 text-xs font-medium text-gray-500 w-12">
                  UOM
                </th>
                <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">
                  Sources
                </th>
                <th className="text-right px-4 py-2 text-xs font-medium text-gray-500 w-24">
                  Total Cost
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {consolidated.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-sm text-gray-400"
                  >
                    No materials assigned yet
                  </td>
                </tr>
              )}
              {consolidated.map((row: any, idx: number) => (
                <tr key={idx} className="hover:bg-gray-50/50">
                  <td className="px-4 py-2.5 font-mono text-xs text-gray-500">
                    {row.sap_number ?? '—'}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="font-medium text-gray-900">
                      {row.description}
                    </div>
                    {row.specification && (
                      <div className="text-xs text-gray-400">
                        {row.specification}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right font-semibold text-gray-900">
                    {row.quantity}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-gray-500">
                    {row.unit_of_measure}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex gap-1 flex-wrap">
                      {(row.sources as string[]).map((s) => (
                        <span
                          key={s}
                          className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 capitalize"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-right text-sm text-gray-700">
                    {row.total_cost != null
                      ? row.total_cost.toLocaleString('en-AU', {
                        style: 'currency',
                        currency: row.currency ?? 'AUD',
                      })
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {view === 'by_category' && (
        <div className="space-y-3">
          {[
            'gasket',
            'bolt',
            'nut',
            'seal',
            'bearing',
            'consumable',
            'chemical',
            'lubricant',
            'tool',
            'other',
          ].map((cat) => {
            const catLines = lines.filter(
              (l: any) =>
                (l.item_catalog?.item_category ?? 'other') === cat
            );
            if (catLines.length === 0) return null;
            return (
              <div
                key={cat}
                className="bg-white border border-gray-200 rounded-xl overflow-hidden"
              >
                <div className="px-4 py-2.5 bg-gray-50 border-b flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-800 capitalize">
                    {cat.replace('_', ' ')}
                  </span>
                  <span className="text-xs text-gray-500">
                    {catLines.length} items
                  </span>
                </div>
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-gray-100">
                    {catLines.map((line: any) => (
                      <tr key={line.id} className="hover:bg-gray-50/50">
                        <td className="px-4 py-2.5">{line.description}</td>
                        <td className="px-4 py-2.5 text-right text-gray-700 w-20">
                          {line.quantity_required} {line.unit_of_measure}
                        </td>
                        <td className="px-4 py-2.5 w-32 text-xs text-gray-500">
                          {line.source_type}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      )}

      {view === 'by_discipline' && (
        <MaterialsByDiscipline workpackId={workpackId} />
      )}

      <GenerateMaterialsModal
        open={showGenerateModal}
        onClose={() => setShowGenerateModal(false)}
        workpackId={workpackId}
        equipmentType={workpack.equipment_type}
        equipmentTag={workpack.asset?.tag_number ?? workpack.asset?.tag ?? workpack.asset?.name}
        scopeHint={workpack.scope_of_work}
        jointCount={workpack.joint_integrity_items?.length ?? 0}
        blindCount={workpack.blinds?.length ?? 0}
        activityCount={workpack.activities?.length ?? 0}
        onGenerated={(materials) => {
          setGeneratedMaterials(materials);
          setShowReviewTable(true);
        }}
      />
      <MaterialReviewTable
        open={showReviewTable}
        onClose={() => {
          setShowReviewTable(false);
          setGeneratedMaterials([]);
        }}
        materials={generatedMaterials}
        workpackId={workpackId}
        onSaved={() => loadMaterials()}
        onRegenerate={() => {
          setShowReviewTable(false);
          setShowGenerateModal(true);
        }}
      />

      {lines.length === 0 && !showAddDirect && canEdit && (
        <EmptyStateWithAI
          tabName="materials"
          workpackId={workpackId}
          icon="📦"
          emptyText="No materials yet"
          onGenerated={() => loadMaterials()}
        />
      )}
      {lines.length === 0 && !showAddDirect && !canEdit && (
        <div className="text-center py-12 text-gray-500 text-sm">No materials yet.</div>
      )}
    </div>
  );
}
