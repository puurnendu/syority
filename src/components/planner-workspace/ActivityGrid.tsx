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
  { key: 'wbs_code', label: 'WBS', width: 90, visible: true, frozen: false },
  { key: 'discipline_code', label: 'Discipline', width: 90, visible: true, frozen: false, isLocked: true },
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
  { key: 'status', label: 'Status', width: 80, visible: true, frozen: false },
  { key: 'hold_point_type', label: 'HP', width: 50, visible: true, frozen: false, isLocked: true },
  { key: 'notes', label: 'Notes', width: 200, visible: true, frozen: false },
];

// ── Editable fields ───────────────────────────────────────────────────────────

const EDITABLE_ACTIVITY_FIELDS = new Set([
  'duration_hours', 'planned_start', 'planned_end',
  'manpower_count', 'manpower_type', 'priority',
  'notes', 'wbs_code', 'predecessors', 'successors',
]);

// ── Component ─────────────────────────────────────────────────────────────────

export function ActivityGrid() {
  const {
    activities,
    selectedActivityIds,
    selectActivity,
    editingCell,
    setEditingCell,
    updateCellValue,
    pushUndo,
    sortConfig,
    setSortConfig,
    resizeColumn,
  } = useWorkspaceStore();

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

  // ── Sort activities ───────────────────────────────────────────────────

  const sortedActivities = useMemo(() => {
    const sorted = [...activities];
    if (sortConfig.length === 0) {
      // Default: sort by sequence number
      sorted.sort((a, b) => (a.sequence_number ?? 0) - (b.sequence_number ?? 0));
    } else {
      for (const sc of [...sortConfig].reverse()) {
        sorted.sort((a, b) => {
          const aVal = (a as any)[sc.field];
          const bVal = (b as any)[sc.field];
          if (aVal == null && bVal == null) return 0;
          if (aVal == null) return 1;
          if (bVal == null) return -1;
          const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
          return sc.direction === 'desc' ? -cmp : cmp;
        });
      }
    }
    return sorted;
  }, [activities, sortConfig]);

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
      {/* Header */}
      <GridHeader
        columns={columns}
        sortConfig={sortConfig}
        frozenColumnCount={2}
        onSort={handleSort}
        onResize={resizeColumn}
      />

      {/* Rows */}
      <div className="flex-1 overflow-auto" style={{ maxHeight: '100%' }}>
        {sortedActivities.length === 0 ? (
          <div className="flex items-center justify-center h-24 text-gray-400 text-sm">
            {activities.length === 0
              ? 'Select a workpack to view activities.'
              : 'No activities match current filters.'}
          </div>
        ) : (
          sortedActivities.map((act) => (
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
                updateCellValue('activity', act.id, field, value);
                setEditingCell(null);
              }}
              onCancelEdit={() => setEditingCell(null)}
            />
          ))
        )}
      </div>

      {/* Totals */}
      {sortedActivities.length > 0 && (
        <TotalsRow columns={columns} totals={totals} />
      )}
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
    if (['duration_hours', 'total_float', 'free_float', 'manpower_count', 'sequence_number'].includes(key)) return 'number';
    return 'text';
  };

  const getCellValue = (key: string): unknown => {
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
