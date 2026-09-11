'use client';

/**
 * M12 V1 Phase 2 — LayoutManager Component
 *
 * Save / Load / Delete / Reset workspace layouts.
 * Uses localStorage for Phase 2 (no schema migration needed).
 *
 * Saved state includes: columns, groupLevels, sortConfig, frozenColumnCount.
 * UDF compatibility is handled via layoutHydration.ts on load.
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import type { ColumnConfig, GroupLevel, SortConfig } from '@/stores/useWorkspaceStore';

const STORAGE_KEY = 'sto_workspace_layouts';

export interface SavedLayoutV2 {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  columns: ColumnConfig[];
  groupLevels: GroupLevel[];
  sortConfig: SortConfig[];
  frozenColumnCount: number;
}

function loadLayouts(): SavedLayoutV2[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLayouts(layouts: SavedLayoutV2[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(layouts));
  } catch (e) {
    console.error('Failed to persist layouts:', e);
  }
}

export function LayoutManager() {
  const {
    columns,
    groupLevels,
    sortConfig,
    frozenColumnCount,
    setColumns,
    setGroupLevels,
    setSortConfig,
    setFrozenColumnCount,
    activeLayoutId,
    setActiveLayout,
    savedLayouts,
  } = useWorkspaceStore();

  const [layouts, setLayoutsState] = useState<SavedLayoutV2[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [newName, setNewName] = useState('');
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Load layouts from localStorage on mount
  useEffect(() => {
    setLayoutsState(loadLayouts());
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── Save ──────────────────────────────────────────────────────────────
  const handleSave = useCallback(() => {
    if (!newName.trim()) return;
    const now = new Date().toISOString();
    const layout: SavedLayoutV2 = {
      id: `layout_${Date.now().toString(36)}`,
      name: newName.trim(),
      createdAt: now,
      updatedAt: now,
      columns: columns.map(c => ({ ...c })),
      groupLevels: [...groupLevels],
      sortConfig: [...sortConfig],
      frozenColumnCount,
    };
    const updated = [...layouts, layout];
    setLayoutsState(updated);
    saveLayouts(updated);
    setActiveLayout(layout.id);
    setNewName('');
    setShowSaveDialog(false);
  }, [newName, columns, groupLevels, sortConfig, frozenColumnCount, layouts, setActiveLayout]);

  // ── Overwrite current ─────────────────────────────────────────────────
  const handleOverwrite = useCallback(() => {
    if (!activeLayoutId) { setShowSaveDialog(true); return; }
    const now = new Date().toISOString();
    const updated = layouts.map(l =>
      l.id === activeLayoutId
        ? { ...l, updatedAt: now, columns: columns.map(c => ({ ...c })), groupLevels: [...groupLevels], sortConfig: [...sortConfig], frozenColumnCount }
        : l
    );
    setLayoutsState(updated);
    saveLayouts(updated);
  }, [activeLayoutId, columns, groupLevels, sortConfig, frozenColumnCount, layouts]);

  // ── Load ──────────────────────────────────────────────────────────────
  const handleLoad = useCallback((layout: SavedLayoutV2) => {
    // Hydrate: apply saved columns, handling UDF additions/removals
    const hydratedColumns = hydrateColumns(columns, layout.columns);
    setColumns(hydratedColumns);
    setGroupLevels(layout.groupLevels || []);
    setSortConfig(layout.sortConfig || []);
    setFrozenColumnCount(layout.frozenColumnCount ?? 2);
    setActiveLayout(layout.id);
    setShowDropdown(false);
  }, [columns, setColumns, setGroupLevels, setSortConfig, setFrozenColumnCount, setActiveLayout]);

  // ── Delete ────────────────────────────────────────────────────────────
  const handleDelete = useCallback((layoutId: string) => {
    if (!confirm('Delete this saved layout?')) return;
    const updated = layouts.filter(l => l.id !== layoutId);
    setLayoutsState(updated);
    saveLayouts(updated);
    if (activeLayoutId === layoutId) setActiveLayout(null);
  }, [layouts, activeLayoutId, setActiveLayout]);

  // ── Reset ─────────────────────────────────────────────────────────────
  const handleReset = useCallback(() => {
    // Reset to default columns — import from ActivityGrid
    setGroupLevels([]);
    setSortConfig([]);
    setFrozenColumnCount(2);
    setActiveLayout(null);
    setShowDropdown(false);
  }, [setGroupLevels, setSortConfig, setFrozenColumnCount, setActiveLayout]);

  const activeLayout = layouts.find(l => l.id === activeLayoutId);

  return (
    <div ref={dropdownRef} className="relative">
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded border border-gray-200"
      >
        <span>📐</span>
        <span>{activeLayout?.name || 'Default Layout'}</span>
        <span className="text-[10px]">▼</span>
      </button>

      {showDropdown && (
        <div className="absolute top-full right-0 mt-1 w-64 bg-white border border-gray-200 rounded-lg shadow-xl z-50 overflow-hidden">
          {/* Header */}
          <div className="px-3 py-2 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
            <span className="text-xs font-bold text-gray-700">Saved Layouts</span>
            <button
              onClick={() => setShowSaveDialog(!showSaveDialog)}
              className="text-[10px] font-bold text-blue-600 hover:text-blue-700"
            >
              + Save New
            </button>
          </div>

          {/* Save New Layout Dialog */}
          {showSaveDialog && (
            <div className="px-3 py-2 bg-blue-50 border-b border-blue-200 flex items-center gap-2">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Layout name..."
                className="flex-1 text-xs border border-gray-300 rounded px-2 py-1 bg-white"
                onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                autoFocus
              />
              <button
                onClick={handleSave}
                disabled={!newName.trim()}
                className="px-2 py-1 bg-blue-600 text-white text-[10px] font-bold rounded disabled:opacity-40"
              >
                Save
              </button>
            </div>
          )}

          {/* Layout List */}
          <div className="max-h-48 overflow-auto">
            {layouts.length === 0 ? (
              <div className="px-3 py-4 text-center text-xs text-gray-400">No saved layouts yet.</div>
            ) : (
              layouts.map((layout) => (
                <div
                  key={layout.id}
                  className={`flex items-center justify-between px-3 py-2 text-xs hover:bg-gray-50 cursor-pointer border-b border-gray-100 ${
                    activeLayoutId === layout.id ? 'bg-blue-50 border-l-2 border-l-blue-500' : ''
                  }`}
                >
                  <span
                    onClick={() => handleLoad(layout)}
                    className="flex-1 font-medium text-gray-800 truncate"
                  >
                    {layout.name}
                  </span>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(layout.id); }}
                    className="text-gray-400 hover:text-red-500 ml-2"
                    title="Delete layout"
                  >
                    ✕
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Footer Actions */}
          <div className="px-3 py-2 bg-gray-50 border-t border-gray-200 flex justify-between">
            <button
              onClick={handleOverwrite}
              disabled={!activeLayoutId}
              className="text-[10px] font-bold text-gray-600 hover:text-blue-600 disabled:opacity-40"
            >
              💾 Save Current
            </button>
            <button
              onClick={handleReset}
              className="text-[10px] font-bold text-gray-600 hover:text-red-600"
            >
              ↺ Reset
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Column Hydration ──────────────────────────────────────────────────────────

/**
 * Merge saved layout columns with current active columns.
 *
 * Handles UDF lifecycle:
 *   - Column exists in both → use saved settings (width, visible, order)
 *   - Column in saved but not current → drop (UDF was deactivated)
 *   - Column in current but not saved → append hidden (new UDF added)
 */
function hydrateColumns(currentColumns: ColumnConfig[], savedColumns: ColumnConfig[]): ColumnConfig[] {
  const savedMap = new Map(savedColumns.map(c => [c.key, c]));
  const currentMap = new Map(currentColumns.map(c => [c.key, c]));

  // Start with saved order, keeping only columns that still exist
  const result: ColumnConfig[] = [];
  for (const saved of savedColumns) {
    if (currentMap.has(saved.key)) {
      result.push({ ...currentMap.get(saved.key)!, ...saved });
    }
    // If not in currentMap, the column was deactivated — skip it
  }

  // Append any new current columns not in saved (new UDFs)
  for (const current of currentColumns) {
    if (!savedMap.has(current.key)) {
      result.push({ ...current, visible: false }); // Hidden by default
    }
  }

  return result;
}
