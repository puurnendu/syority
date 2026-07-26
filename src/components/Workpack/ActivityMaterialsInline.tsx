'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { hasPermission } from '@/lib/permissions';

export function ActivityMaterialsInline({
  workpackId,
  activityId,
}: {
  workpackId: string;
  activityId: string;
}) {
  const { data: session } = useSession();
  const role = (session?.user as any)?.role ?? (session?.user as any)?.roles?.[0];
  const canEdit = hasPermission(role, 'workpacks.edit');

  const [lines, setLines] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [newItem, setNewItem] = useState({
    description: '',
    quantity: '1',
    unit_of_measure: 'EA',
    item_catalog_id: '',
    material_category: 'mechanical',
  });

  useEffect(() => {
    loadLines();
  }, [workpackId, activityId]);

  async function loadLines() {
    setLoading(true);
    try {
      const res = await fetch(`/api/workpacks/${workpackId}/materials`);
      if (!res.ok) {
        setLoading(false);
        return;
      }
      const d = await res.json();
      const activityLines = (d.lines ?? []).filter(
        (l: any) =>
          l.source_type === 'activity' && l.source_id === activityId
      );
      setLines(activityLines);
    } catch {
      setLines([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (search.length < 2) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const r = await fetch(
          `/api/master-data/items?search=${encodeURIComponent(search)}&limit=8`
        );
        if (r.ok) {
          const d = await r.json();
          setResults(d.items ?? []);
        }
      } catch {
        setResults([]);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  async function addLine() {
    if (!newItem.description.trim()) return;
    try {
      await fetch(`/api/workpacks/${workpackId}/materials`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_type: 'activity',
          source_id: activityId,
          description: newItem.description,
          quantity_required: parseFloat(newItem.quantity) || 1,
          unit_of_measure: newItem.unit_of_measure,
          item_catalog_id: newItem.item_catalog_id || null,
          material_category: newItem.material_category,
        }),
      });
      setNewItem({
        description: '',
        quantity: '1',
        unit_of_measure: 'EA',
        item_catalog_id: '',
        material_category: 'mechanical',
      });
      setShowAdd(false);
      setSearch('');
      await loadLines();
    } catch {
      // inline error could be set here
    }
  }

  async function removeLine(lineId: string) {
    try {
      await fetch(
        `/api/workpacks/${workpackId}/materials/${lineId}`,
        { method: 'DELETE' }
      );
      await loadLines();
    } catch {
      // inline error
    }
  }

  return (
    <div className="mt-3 pt-3 border-t border-gray-100">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          Materials
        </span>
        {canEdit && (
          <button
            type="button"
            onClick={() => setShowAdd((s) => !s)}
            className="text-xs text-blue-600 hover:text-blue-800"
          >
            {showAdd ? '✕ Cancel' : '+ Add Material'}
          </button>
        )}
      </div>

      {loading && (
        <p className="text-xs text-gray-400">Loading...</p>
      )}

      {!loading && lines.length === 0 && !showAdd && (
        <p className="text-xs text-gray-400 italic">
          No materials assigned to this activity.
        </p>
      )}

      {lines.length > 0 && (
        <div className="space-y-1">
          {lines.map((line) => (
            <div
              key={line.id}
              className="flex items-center gap-2 text-xs text-gray-700 group"
            >
              <span className="text-gray-400">•</span>
              <span className="flex-1">{line.description}</span>
              <span className="font-medium text-gray-900">
                {line.quantity_required} {line.unit_of_measure}
              </span>
              {(line.sap_material_number ??
                line.item_catalog?.sap_material_number) && (
                <span className="font-mono text-gray-400">
                  {line.sap_material_number ??
                    line.item_catalog?.sap_material_number}
                </span>
              )}
              {canEdit && (
                <button
                  type="button"
                  onClick={() => removeLine(line.id)}
                  className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {showAdd && (
        <div className="mt-2 space-y-2">
          <div className="relative">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search catalog or type description..."
              className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:border-blue-500"
            />
            {results.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-0.5 bg-white border border-gray-200 rounded shadow-lg z-20 max-h-36 overflow-y-auto">
                {results.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setNewItem((prev) => ({
                        ...prev,
                        description: item.description,
                        item_catalog_id: item.id,
                        unit_of_measure: item.unit_of_measure,
                      }));
                      setSearch(item.description);
                      setResults([]);
                    }}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 border-b border-gray-100 last:border-0"
                  >
                    <span className="font-medium text-gray-900">
                      {item.description}
                    </span>
                    {item.sap_material_number && (
                      <span className="ml-2 text-gray-400 font-mono">
                        {item.sap_material_number}
                      </span>
                    )}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    setNewItem((prev) => ({
                      ...prev,
                      description: search,
                      item_catalog_id: '',
                    }));
                    setResults([]);
                  }}
                  className="w-full text-left px-3 py-2 text-xs text-blue-600 bg-blue-50 hover:bg-blue-100"
                >
                  + Use &quot;{search}&quot; as free-text
                </button>
              </div>
            )}
          </div>

          {newItem.description && (
            <div className="bg-gray-50 rounded px-2 py-1.5 text-xs text-gray-700">
              {newItem.description}
              <button
                type="button"
                onClick={() => {
                  setNewItem((prev) => ({
                    ...prev,
                    description: '',
                    item_catalog_id: '',
                  }));
                  setSearch('');
                }}
                className="ml-2 text-gray-400 hover:text-red-500"
              >
                ✕
              </button>
            </div>
          )}

          <div className="flex items-center gap-2">
            <input
              type="number"
              value={newItem.quantity}
              onChange={(e) =>
                setNewItem((prev) => ({ ...prev, quantity: e.target.value }))
              }
              min={0.1}
              step={0.1}
              placeholder="Qty"
              className="w-16 border border-gray-300 rounded px-2 py-1.5 text-xs focus:outline-none"
            />
            <select
              value={newItem.unit_of_measure}
              onChange={(e) =>
                setNewItem((prev) => ({
                  ...prev,
                  unit_of_measure: e.target.value,
                }))
              }
              className="border border-gray-300 rounded px-2 py-1.5 text-xs focus:outline-none"
            >
              {['EA', 'SET', 'BOX', 'KG', 'L', 'M', 'ROLL'].map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
            <select
              value={newItem.material_category}
              onChange={(e) =>
                setNewItem((prev) => ({
                  ...prev,
                  material_category: e.target.value,
                }))
              }
              className="border border-gray-300 rounded px-2 py-1.5 text-xs focus:outline-none w-24"
            >
              <option value="mechanical">Mechanical</option>
              <option value="electrical">Electrical</option>
              <option value="instrumentation">Inst.</option>
              <option value="civil">Civil</option>
              <option value="other">Other</option>
            </select>
            <button
              type="button"
              onClick={addLine}
              disabled={!newItem.description.trim()}
              className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 disabled:opacity-50"
            >
              Add
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
