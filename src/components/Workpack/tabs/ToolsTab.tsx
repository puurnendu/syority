'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { hasPermission } from '@/lib/permissions';
import { GenerateToolsModal, type GeneratedTool } from '@/components/Workpack/Tools/GenerateToolsModal';
import { ToolReviewTable } from '@/components/Workpack/Tools/ToolReviewTable';
import { AiGeneratedBanner } from '@/components/Workpack/AiGeneratedBanner';
import { EmptyStateWithAI } from '@/components/Workpack/EmptyStateWithAI';

type ViewFilter = 'by_category' | 'all' | 'special' | 'hired';

const TOOL_TYPE_LABELS: Record<string, string> = {
  Standard: 'Standard',
  Special: 'Special',
  Hired: 'Hired',
  Consumable: 'Consumable',
};

const STATUS_LABELS: Record<string, string> = {
  Required: 'Required',
  Confirmed: 'Confirmed',
  'On Site': 'On Site',
  Returned: 'Returned',
};

export function ToolsTab({
  workpack,
}: {
  workpack: {
    id: string;
    equipment_type?: string | null;
    asset?: { tag?: string; name?: string } | null;
    activities?: unknown[];
    workpack_documents?: { id: string; original_filename: string }[];
  };
}) {
  const { data: session } = useSession();
  const role = (session?.user as { role?: string; roles?: string[] })?.role ?? (session?.user as { role?: string; roles?: string[] })?.roles?.[0];
  const canEdit = hasPermission(role, 'workpacks.edit');

  const workpackId = workpack.id;
  const [data, setData] = useState<{ tools?: any[]; summary?: { total: number; special: number; hired: number } } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<ViewFilter>('by_category');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [showReviewTable, setShowReviewTable] = useState(false);
  const [generatedTools, setGeneratedTools] = useState<GeneratedTool[]>([]);
  const [newTool, setNewTool] = useState({ name: '', category: 'General', quantity: 1, tool_type: 'Standard', description: '', notes: '' });
  const [adding, setAdding] = useState(false);
  const [aiBannerDismissed, setAiBannerDismissed] = useState(false);

  useEffect(() => {
    loadTools();
  }, [workpackId]);

  async function loadTools() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/workpacks/${workpackId}/tools`);
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? res.statusText);
      }
      setData(await res.json());
    } catch (e: unknown) {
      setError('Failed to load tools: ' + (e instanceof Error ? e.message : 'Unknown error'));
    } finally {
      setLoading(false);
    }
  }

  async function addTool() {
    if (!newTool.name.trim()) return;
    setAdding(true);
    setError(null);
    try {
      const res = await fetch(`/api/workpacks/${workpackId}/tools`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newTool.name.trim(),
          category: newTool.category,
          quantity: newTool.quantity,
          tool_type: newTool.tool_type,
          description: newTool.description.trim() || undefined,
          notes: newTool.notes.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? res.statusText);
      }
      setNewTool({ name: '', category: 'General', quantity: 1, tool_type: 'Standard', description: '', notes: '' });
      setShowAddModal(false);
      await loadTools();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Add failed');
    } finally {
      setAdding(false);
    }
  }

  async function deleteTool(toolId: string) {
    setError(null);
    try {
      const res = await fetch(`/api/workpacks/${workpackId}/tools/${toolId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      await loadTools();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Delete failed');
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-gray-400">
        <div className="animate-spin w-5 h-5 border-2 border-gray-300 border-t-blue-600 rounded-full mr-3" />
        Loading tools...
      </div>
    );
  }

  const { tools = [], summary = { total: 0, special: 0, hired: 0 } } = data ?? {};
  const aiGeneratedCount = (tools as { ai_generated?: boolean }[]).filter((t) => t.ai_generated).length;
  const filteredTools =
    view === 'special'
      ? tools.filter((t: any) => t.tool_type === 'Special')
      : view === 'hired'
        ? tools.filter((t: any) => t.tool_type === 'Hired')
        : tools;

  const byCategory = view === 'by_category'
    ? (filteredTools as any[]).reduce<Record<string, any[]>>((acc, t) => {
        const cat = t.category ?? 'General';
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(t);
        return acc;
      }, {})
    : null;

  return (
    <div className="space-y-4">
      {aiGeneratedCount > 0 && !aiBannerDismissed && (
        <AiGeneratedBanner
          count={aiGeneratedCount}
          entityName="tools"
          onDismiss={() => setAiBannerDismissed(true)}
          onRegenerate={() => setShowGenerateModal(true)}
        />
      )}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <span>⚠</span>
          <span className="flex-1">{error}</span>
          <button type="button" onClick={() => setError(null)}>✕</button>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white border border-gray-200 rounded-xl p-3 text-center">
          <div className="text-2xl font-bold text-gray-900">{summary.total}</div>
          <div className="text-xs text-gray-500 mt-0.5">Total Tools</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-3 text-center">
          <div className="text-2xl font-bold text-gray-900">{summary.special}</div>
          <div className="text-xs text-gray-500 mt-0.5">Special Tools</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-3 text-center">
          <div className="text-2xl font-bold text-gray-900">{summary.hired}</div>
          <div className="text-xs text-gray-500 mt-0.5">Hired Tools</div>
        </div>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex bg-gray-100 rounded-lg p-1 gap-1">
          {[
            { key: 'by_category' as const, label: 'By Category' },
            { key: 'all' as const, label: 'All Tools' },
            { key: 'special' as const, label: 'Special Tools' },
            { key: 'hired' as const, label: 'Hired' },
          ].map((v) => (
            <button
              key={v.key}
              type="button"
              onClick={() => setView(v.key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                view === v.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
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
                onClick={() => setShowAddModal(true)}
                className="px-3 py-1.5 bg-[#0D2137] text-white text-sm font-medium rounded-lg hover:bg-[#1a3a5c] flex items-center gap-1.5"
              >
                + Add Tool
              </button>
            </>
          )}
        </div>
      </div>

      {canEdit && showAddModal && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
          <h4 className="text-sm font-semibold text-gray-800">Add Tool</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="text-xs text-gray-500 mb-1 block">Tool name *</label>
              <input
                type="text"
                value={newTool.name}
                onChange={(e) => setNewTool((p) => ({ ...p, name: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                placeholder="e.g. Mobile Crane 50T"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Category</label>
              <select
                value={newTool.category}
                onChange={(e) => setNewTool((p) => ({ ...p, category: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              >
                {['Rigging', 'Lifting', 'Mechanical', 'Electrical', 'Safety', 'Cleaning', 'Welding', 'Scaffolding', 'General'].map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Type</label>
              <select
                value={newTool.tool_type}
                onChange={(e) => setNewTool((p) => ({ ...p, tool_type: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              >
                {['Standard', 'Special', 'Hired', 'Consumable'].map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Quantity</label>
              <input
                type="number"
                min={1}
                value={newTool.quantity}
                onChange={(e) => setNewTool((p) => ({ ...p, quantity: parseInt(e.target.value, 10) || 1 }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={addTool}
              disabled={adding || !newTool.name.trim()}
              className="px-4 py-2 bg-[#0D2137] text-white text-sm rounded-lg hover:bg-[#1a3a5c] disabled:opacity-40"
            >
              {adding ? 'Adding...' : 'Add Tool'}
            </button>
            <button type="button" onClick={() => setShowAddModal(false)} className="text-sm text-gray-500 hover:text-gray-700">
              Cancel
            </button>
          </div>
        </div>
      )}

      <GenerateToolsModal
        open={showGenerateModal}
        onClose={() => setShowGenerateModal(false)}
        workpackId={workpackId}
        equipmentType={workpack.equipment_type}
        equipmentTag={workpack.asset?.tag ?? workpack.asset?.name}
        activityCount={workpack.activities?.length ?? 0}
        documents={workpack.workpack_documents ?? []}
        onGenerated={(list) => {
          setGeneratedTools(list);
          setShowReviewTable(true);
        }}
      />
      <ToolReviewTable
        open={showReviewTable}
        onClose={() => {
          setShowReviewTable(false);
          setGeneratedTools([]);
        }}
        tools={generatedTools}
        workpackId={workpackId}
        onSaved={() => loadTools()}
        onRegenerate={() => {
          setShowReviewTable(false);
          setShowGenerateModal(true);
        }}
      />

      {view === 'by_category' && byCategory && Object.keys(byCategory).length > 0 && (
        <div className="space-y-4">
          {Object.entries(byCategory).map(([category, list]) => (
            <div key={category} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-4 py-2.5 bg-gray-50 border-b flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-800">{category}</span>
                <span className="text-xs text-gray-500">{list.length} items</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-xs text-gray-500 uppercase tracking-wider">
                      <th className="text-left px-4 py-2 font-medium">Tool</th>
                      <th className="text-right px-4 py-2 font-medium w-16">Qty</th>
                      <th className="text-left px-4 py-2 font-medium w-24">Type</th>
                      <th className="text-left px-4 py-2 font-medium w-20">Cert</th>
                      <th className="text-left px-4 py-2 font-medium w-20">Source</th>
                      <th className="text-left px-4 py-2 font-medium w-24">Status</th>
                      {canEdit && <th className="w-10 px-2 py-2" />}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {list.map((tool: any) => (
                      <tr key={tool.id} className="hover:bg-gray-50/50">
                        <td className="px-4 py-2.5">
                          <div className="font-medium text-gray-900">{tool.name}</div>
                          {tool.description && (
                            <div className="text-xs text-gray-500 mt-0.5">{tool.description}</div>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-right text-gray-700">
                          {tool.quantity != null ? tool.quantity : <span className="text-gray-400 text-xs">TBD</span>}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-gray-600">{TOOL_TYPE_LABELS[tool.tool_type] ?? tool.tool_type}</td>
                        <td className="px-4 py-2.5">{tool.cert_required ? '✓' : '—'}</td>
                        <td className="px-4 py-2.5 text-xs text-gray-500 capitalize">{tool.source ?? '—'}</td>
                        <td className="px-4 py-2.5 text-xs text-gray-600">{STATUS_LABELS[tool.status] ?? tool.status}</td>
                        {canEdit && (
                          <td className="px-2 py-2">
                            <button
                              type="button"
                              onClick={() => deleteTool(tool.id)}
                              className="text-gray-300 hover:text-red-500 text-xs"
                              title="Delete"
                            >
                              ✕
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {(view !== 'by_category' || !byCategory || Object.keys(byCategory).length === 0) && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs text-gray-500 uppercase tracking-wider">
                  <th className="text-left px-4 py-2 font-medium">Category</th>
                  <th className="text-left px-4 py-2 font-medium">Tool</th>
                  <th className="text-right px-4 py-2 font-medium w-16">Qty</th>
                  <th className="text-left px-4 py-2 font-medium w-24">Type</th>
                  <th className="text-left px-4 py-2 font-medium w-20">Cert</th>
                  <th className="text-left px-4 py-2 font-medium w-20">Source</th>
                  <th className="text-left px-4 py-2 font-medium w-24">Status</th>
                  {canEdit && <th className="w-10 px-2 py-2" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredTools.length === 0 && (
                  <tr>
                    <td colSpan={canEdit ? 8 : 7} className="px-4 py-8 text-center text-gray-400">
                      No tools yet. Use &quot;Generate with AI&quot; or &quot;+ Add Tool&quot; to build the list.
                    </td>
                  </tr>
                )}
                {filteredTools.map((tool: any) => (
                  <tr key={tool.id} className="hover:bg-gray-50/50">
                    <td className="px-4 py-2.5 text-xs text-gray-600">{tool.category}</td>
                    <td className="px-4 py-2.5">
                      <div className="font-medium text-gray-900">{tool.name}</div>
                      {tool.description && (
                        <div className="text-xs text-gray-500 mt-0.5">{tool.description}</div>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right text-gray-700">
                      {tool.quantity != null ? tool.quantity : <span className="text-gray-400 text-xs">TBD</span>}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-gray-600">{TOOL_TYPE_LABELS[tool.tool_type] ?? tool.tool_type}</td>
                    <td className="px-4 py-2.5">{tool.cert_required ? '✓' : '—'}</td>
                    <td className="px-4 py-2.5 text-xs text-gray-500 capitalize">{tool.source ?? '—'}</td>
                    <td className="px-4 py-2.5 text-xs text-gray-600">{STATUS_LABELS[tool.status] ?? tool.status}</td>
                    {canEdit && (
                      <td className="px-2 py-2">
                        <button
                          type="button"
                          onClick={() => deleteTool(tool.id)}
                          className="text-gray-300 hover:text-red-500 text-xs"
                          title="Delete"
                        >
                          ✕
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tools.length === 0 && !showAddModal && canEdit && (
        <EmptyStateWithAI
          tabName="tools"
          workpackId={workpackId}
          icon="🔧"
          emptyText="No tools yet"
          onGenerated={() => loadTools()}
        />
      )}
      {tools.length === 0 && !showAddModal && !canEdit && (
        <div className="text-center py-12 text-gray-500 text-sm">No tools yet.</div>
      )}
    </div>
  );
}
