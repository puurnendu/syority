'use client';

/**
 * M7.5 — ActivityGrid Component
 *
 * Activities originate ONLY from approved Workpack Templates.
 * Template-controlled fields render as locked (grey + 🔒).
 * UDF columns appear inline, identically to native columns.
 *
 * Planner MAY edit: duration, relationships, calendar, constraints, crew, priority, notes, contractor UDF.
 * Planner SHALL NOT: create/delete activities, modify QA/certs/materials/resources/template structure.
 */
import React, { useMemo, useCallback } from 'react';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import type { ActivityGridRow } from '@/core/planner-workspace';
import type { ColumnConfig } from '@/stores/useWorkspaceStore';
import { GridCell } from './GridCell';
import { GridHeader, TotalsRow } from './GridHeader';

// ── Default Activity Columns ──────────────────────────────────────────────────

export const DEFAULT_ACTIVITY_COLUMNS: ColumnConfig[] = [
  { key: 'select', label: '☑️', width: 36, visible: true, frozen: true },
  { key: 'activity_id', label: 'Activity ID', width: 120, visible: true, frozen: true, isLocked: true },
  { key: 'description', label: 'Description', width: 280, visible: true, frozen: false, isLocked: true },
  { key: 'wbs_code', label: 'WBS', width: 90, visible: true, frozen: false, dimensionCode: 'WBS_CODE' },
  { key: 'discipline_code', label: 'Discipline', width: 90, visible: true, frozen: false, isLocked: true, dimensionCode: 'DISCIPLINE' },
  { key: 'duration_hours', label: 'Duration (h)', width: 85, visible: true, frozen: false },
  { key: 'predecessors', label: 'Predecessors', width: 130, visible: true, frozen: false },
  { key: 'successors', label: 'Successors', width: 130, visible: true, frozen: false },
  { key: 'planned_start', label: 'Start', width: 100, visible: true, frozen: false },
  { key: 'planned_end', label: 'End', width: 100, visible: true, frozen: false },
  { key: 'early_start', label: 'ES', width: 100, visible: false, frozen: false },
  { key: 'early_finish', label: 'EF', width: 100, visible: false, frozen: false },
  { key: 'total_float', label: 'TF', width: 70, visible: true, frozen: false },
  { key: 'free_float', label: 'FF', width: 70, visible: false, frozen: false },
  { key: 'is_critical', label: 'Crit', width: 50, visible: true, frozen: false },
  { key: 'manpower_count', label: 'Crew', width: 70, visible: true, frozen: false },
  { key: 'manpower_type', label: 'Crew Type', width: 90, visible: true, frozen: false },
  { key: 'status', label: 'Status', width: 80, visible: true, frozen: false, dimensionCode: 'STATUS' },
  { key: 'progress', label: 'Progress %', width: 80, visible: true, frozen: false },
  { key: 'actual_start', label: 'Actual Start', width: 100, visible: true, frozen: false },
  { key: 'actual_end', label: 'Actual End', width: 100, visible: true, frozen: false },
  { key: 'remarks', label: 'Remarks', width: 200, visible: true, frozen: false },
  { key: 'hold_point_type', label: 'HP', width: 50, visible: true, frozen: false, isLocked: true },
  { key: 'notes', label: 'Notes', width: 200, visible: true, frozen: false },
];


// ── Editable fields ───────────────────────────────────────────────────────────

const EDITABLE_ACTIVITY_FIELDS = new Set([
  'duration_hours', 'planned_start', 'planned_end',
  'manpower_count', 'manpower_type', 'priority',
  'notes', 'wbs_code', 'predecessors', 'successors',
  'status', 'progress', 'actual_start', 'actual_end', 'remarks',
]);

// ── Component ─────────────────────────────────────────────────────────────────

export function ActivityGrid() {
  const {
    activities,
    selectedActivityIds,
    selectActivity,
    clearActivitySelection,
    editingCell,
    setEditingCell,
    updateCellValue,
    pushUndo,
    sortConfig,
    setSortConfig,
    groupLevels,
    resizeColumn,
    page,
    pageSize,
    totalActivities,
    setPage,
    setPageSize,
    isLoading,
    groupingMetadata,
  } = useWorkspaceStore();

  // Track collapsed group headers
  const [collapsedGroups, setCollapsedGroups] = React.useState<Set<string>>(new Set());

  // Use default columns (will be replaced by dynamic columns with UDFs later)
  const columns = DEFAULT_ACTIVITY_COLUMNS;
  const visibleColumns = columns.filter((c) => c.visible);

  // ── Sort ──────────────────────────────────────────────────────────────

  const handleSort = useCallback((field: string) => {
    const existing = sortConfig.find((s) => s.field === field);
    if (existing) {
      if (existing.direction === 'asc') {
        setSortConfig(sortConfig.map((s) => s.field === field ? { ...s, direction: 'desc' as const } : s));
      } else {
        setSortConfig(sortConfig.filter((s) => s.field !== field));
      }
    } else {
      setSortConfig([...sortConfig, { field, direction: 'asc' as const }]);
    }
  }, [sortConfig, setSortConfig]);

  // Sorting is now server-driven; activities come pre-sorted from the API.

  // ── Totals ────────────────────────────────────────────────────────────

  const totals = useMemo(() => {
    const t: Record<string, number> = {};
    t.duration_hours = activities.reduce((s, a) => s + (a.duration_hours ?? 0), 0);
    t.manpower_count = activities.reduce((s, a) => s + (a.manpower_count ?? 0), 0);
    return t;
  }, [activities]);

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col border border-gray-300 bg-white overflow-hidden">
      {/* Bulk Actions Bar */}
      {selectedActivityIds.size > 0 && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 border-b border-blue-200">
          <span className="text-xs font-semibold text-blue-800">
            {selectedActivityIds.size} activities selected
          </span>
          <div className="w-px h-4 bg-blue-300 mx-1" />
          <button
            onClick={async () => {
              const action = prompt('Enter bulk action (e.g. START, COMPLETE):');
              if (!action) return;
              try {
                const res = await fetch('/api/execution/action', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    activityIds: Array.from(selectedActivityIds),
                    action: action.toUpperCase(),
                  }),
                });
                if (!res.ok) {
                  const data = await res.json();
                  alert(`Bulk action failed: ${data.error}`);
                } else {
                  alert('Bulk action applied successfully.');
                  // Optionally trigger a refresh
                }
              } catch (err: any) {
                alert(`Error: ${err.message}`);
              }
            }}
            className="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
          >
            Bulk Action
          </button>
          <button
            onClick={clearActivitySelection}
            className="px-2 py-1 bg-white text-gray-700 border border-gray-300 text-xs rounded hover:bg-gray-50"
          >
            Clear Selection
          </button>
        </div>
      )}

      {/* Header */}
      <GridHeader
        columns={columns}
        sortConfig={sortConfig}
        frozenColumnCount={2}
        onSort={handleSort}
        onResize={resizeColumn}
      />

      {/* Rows */}
      <div className="flex-1 overflow-auto relative" style={{ maxHeight: '100%' }}>
        {isLoading && (
          <div className="absolute inset-0 bg-white/50 flex items-center justify-center z-10">
            <div className="text-sm text-gray-500 font-medium">Loading activities...</div>
          </div>
        )}
        {activities.length === 0 && !isLoading ? (
          <div className="flex items-center justify-center h-24 text-gray-400 text-sm">
            No activities match current filters.
          </div>
        ) : (
          (() => {
            const rowsToRender: React.ReactNode[] = [];
            let currentGroupKey = '';

            // Pre-compute group counts for display
            const groupCounts = new Map<string, number>();
            if (groupLevels.length > 0) {
              for (const act of activities) {
                const groupParts = groupLevels.map(g => {
                  const val = act.udf_values?.[g.field.toUpperCase()] ?? (act as any)[g.field];
                  return val ? String(val) : 'Unassigned';
                });
                const groupKey = groupParts.join(' › ');
                groupCounts.set(groupKey, (groupCounts.get(groupKey) || 0) + 1);
              }
            }

            // Toggle group collapse
            const toggleGroup = (key: string) => {
              setCollapsedGroups(prev => {
                const next = new Set(prev);
                if (next.has(key)) next.delete(key); else next.add(key);
                return next;
              });
            };

            for (const act of activities) {
              if (groupLevels.length > 0) {
                const groupParts = groupLevels.map(g => {
                  const val = act.udf_values?.[g.field.toUpperCase()] ?? (act as any)[g.field];
                  return val ? String(val) : 'Unassigned';
                });
                const groupKey = groupParts.join(' › ');

                if (groupKey !== currentGroupKey) {
                  const isCollapsed = collapsedGroups.has(groupKey);
                  const count = groupCounts.get(groupKey) || 0;
                  const nestingLevel = groupParts.length - 1;

                  rowsToRender.push(
                    <div
                      key={`group-${groupKey}`}
                      onClick={() => toggleGroup(groupKey)}
                      className="flex items-center bg-gray-200 text-gray-800 font-semibold text-xs px-2 py-1.5 border-b border-gray-300 shadow-inner cursor-pointer hover:bg-gray-300 transition-colors select-none"
                      style={{ paddingLeft: `${8 + nestingLevel * 16}px` }}
                    >
                      <span className="mr-1.5 text-[10px] text-gray-500 transition-transform" style={{ transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}>
                        ▼
                      </span>
                      <span className="mr-2">📁</span>
                      {groupParts.map((part, idx) => (
                        <React.Fragment key={idx}>
                          {idx > 0 && <span className="text-gray-400 mx-1">›</span>}
                          <span className={idx === groupParts.length - 1 ? 'font-bold' : 'text-gray-600'}>{part}</span>
                        </React.Fragment>
                      ))}
                      <span className="ml-2 text-[10px] text-gray-500 bg-gray-300 px-1.5 py-0.5 rounded-full font-bold">
                        {count}
                      </span>
                      {/* Show server grouping metadata total if available and differs from page count */}
                      {(() => {
                        // Build server-side total from GroupingMetadata.levels[].groups[]
                        if (!groupingMetadata?.levels) return null;
                        for (const level of groupingMetadata.levels) {
                          for (const grp of level.groups) {
                            if (grp.label === groupParts[groupParts.length - 1] && grp.count !== count) {
                              return (
                                <span className="ml-1 text-[10px] text-blue-500" title="Total count from server">
                                  ({grp.count} total)
                                </span>
                              );
                            }
                          }
                        }
                        return null;
                      })()}
                    </div>
                  );
                  currentGroupKey = groupKey;
                }

                // Skip rendering activities if their group is collapsed
                if (collapsedGroups.has(groupKey)) {
                  continue;
                }
              }

              rowsToRender.push(
                <ActivityRow
                  key={act.id}
                  row={act}
                  columns={visibleColumns}
                  isSelected={selectedActivityIds.has(act.id)}
                  editingCell={editingCell}
                  onSelect={(multi) => selectActivity(act.id, multi)}
                  onStartEdit={(field) =>
                    setEditingCell({ entityType: 'activity', entityId: act.id, field })
                  }
                  onCommitEdit={(field, value) => {
                    const oldValue = (act as any)[field];
                    pushUndo({
                      entityType: 'activity',
                      entityId: act.id,
                      field,
                      oldValue,
                      newValue: value,
                      timestamp: Date.now(),
                    });
                    
                    // Optimistic update
                    updateCellValue('activity', act.id, field, value);
                    setEditingCell(null);

                    // Execution Write Path
                    if (['status', 'progress', 'actual_start', 'actual_end', 'remarks'].includes(field)) {
                      let action = 'UPDATE_PROGRESS';
                      if (field === 'status') {
                        if (value === 'in_progress') action = 'START';
                        else if (value === 'completed') action = 'COMPLETE';
                      }
                      
                      const payload: any = { activityId: act.id, action };
                      if (field === 'progress') payload.progress = Number(value);
                      if (field === 'remarks') payload.notes = value;
                      if (field === 'actual_start' || field === 'actual_end') payload.execution_date = value;

                      fetch('/api/execution/action', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                      }).then(async (res) => {
                        if (!res.ok) {
                          const data = await res.json();
                          alert(`Execution blocked: ${data.error}`);
                          updateCellValue('activity', act.id, field, oldValue);
                        } else {
                          // Optionally refresh the grid here to sync server side calculations
                        }
                      }).catch((err) => {
                        alert(`Network error: ${err.message}`);
                        updateCellValue('activity', act.id, field, oldValue);
                      });
                    }
                  }}
                  onCancelEdit={() => setEditingCell(null)}
                />
              );
            }
            return rowsToRender;
          })()
        )}
      </div>

      {/* Totals */}
      {activities.length > 0 && (
        <TotalsRow columns={columns} totals={totals} />
      )}
      
      {/* Pagination Footer */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-t border-gray-300 text-xs text-gray-600">
        <div>
          Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, totalActivities)} of {totalActivities} entries
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span>Rows per page:</span>
            <select 
              value={pageSize} 
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="border border-gray-300 rounded px-1 py-0.5"
            >
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={200}>200</option>
              <option value={500}>500</option>
            </select>
          </div>
          <div className="flex items-center gap-1">
            <button 
              onClick={() => setPage(page - 1)} 
              disabled={page <= 1}
              className="px-2 py-1 bg-white border border-gray-300 rounded disabled:opacity-50"
            >
              Prev
            </button>
            <span className="px-2">Page {page} of {Math.max(1, Math.ceil(totalActivities / pageSize))}</span>
            <button 
              onClick={() => setPage(page + 1)} 
              disabled={page >= Math.ceil(totalActivities / pageSize)}
              className="px-2 py-1 bg-white border border-gray-300 rounded disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Activity Row ──────────────────────────────────────────────────────────────

function ActivityRow({
  row,
  columns,
  isSelected,
  editingCell,
  onSelect,
  onStartEdit,
  onCommitEdit,
  onCancelEdit,
}: {
  row: ActivityGridRow;
  columns: ColumnConfig[];
  isSelected: boolean;
  editingCell: { entityType: string; entityId: string; field: string } | null;
  onSelect: (multi: boolean) => void;
  onStartEdit: (field: string) => void;
  onCommitEdit: (field: string, value: unknown) => void;
  onCancelEdit: () => void;
}) {
  const isCritical = row.is_critical;
  const rowBg = isSelected
    ? 'bg-blue-50'
    : isCritical
    ? 'bg-red-50/30'
    : 'hover:bg-gray-50';

  const getCellType = (key: string): 'text' | 'number' | 'date' | 'badge' | 'checkbox' => {
    if (key === 'select' || key === 'is_critical') return 'checkbox';
    if (key === 'status') return 'badge';
    if (key.includes('start') || key.includes('end') || key.includes('finish')) return 'date';
    if (['duration_hours', 'total_float', 'free_float', 'manpower_count', 'sequence_number', 'progress'].includes(key)) return 'number';
    return 'text';
  };

  const getCellValue = (key: string): unknown => {
    if (key === 'select') return isSelected;
    if (key === 'predecessors') return row.predecessors.join(', ');
    if (key === 'successors') return row.successors.join(', ');
    return (row as any)[key];
  };

  return (
    <div
      className={`flex items-center ${rowBg} transition-colors duration-75`}
      onClick={(e) => onSelect(e.ctrlKey || e.metaKey)}
    >
      {columns.map((col) => {
        const value = getCellValue(col.key);
        const isEditing =
          editingCell?.entityType === 'activity' &&
          editingCell?.entityId === row.id &&
          editingCell?.field === col.key;

        // Determine if this field is editable
        const isEditable = EDITABLE_ACTIVITY_FIELDS.has(col.key) && !col.isLocked;

        // Template-generated activities: locked columns get grey treatment
        const isLocked = col.isLocked && row.is_template_generated;

        return (
          <GridCell
            key={col.key}
            value={value}
            type={getCellType(col.key)}
            editable={isEditable}
            locked={isLocked}
            width={col.width}
            isEditing={isEditing}
            isSelected={isSelected}
            columnKey={col.key}
            onClick={(e) => e.stopPropagation()}
            onDoubleClick={() => isEditable && onStartEdit(col.key)}
            onStartEdit={() => isEditable && onStartEdit(col.key)}
            onCommitEdit={(v) => onCommitEdit(col.key, v)}
            onCancelEdit={onCancelEdit}
          />
        );
      })}
    </div>
  );
}
