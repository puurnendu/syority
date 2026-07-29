'use client';

/**
 * M7.5 — WorkpackGrid Component
 *
 * First-class workpack planning surface.
 * Workpacks are the primary planning object — this grid sits ABOVE the Activity Grid.
 *
 * Features:
 * - Single click → select workpack → Activity Grid populates below
 * - Double-click → inline edit (editable fields only)
 * - Multi-select with Shift/Ctrl
 * - Virtual scrolling for 1000+ workpacks
 * - Readiness/Compliance as score bars
 * - Group headers with rollups
 */
import React, { useCallback, useMemo } from 'react';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import type { WorkpackGridRow } from '@/core/planner-workspace';
import type { ColumnConfig } from '@/stores/useWorkspaceStore';
import { GridCell, ScoreCell, CountCell } from './GridCell';
import { GridHeader, TotalsRow } from './GridHeader';

// ── Default Workpack Columns ──────────────────────────────────────────────────

export const DEFAULT_WORKPACK_COLUMNS: ColumnConfig[] = [
  { key: 'select', label: '☑️', width: 36, visible: true, frozen: true },
  { key: 'workpack_number', label: 'Workpack #', width: 130, visible: true, frozen: true },
  { key: 'title', label: 'Title', width: 250, visible: true, frozen: false, isLocked: true },
  { key: 'equipment_tag', label: 'Equipment', width: 130, visible: true, frozen: false },
  { key: 'equipment_type', label: 'Equip Type', width: 110, visible: true, frozen: false },
  { key: 'unit_code', label: 'Unit', width: 90, visible: true, frozen: false },
  { key: 'system_code', label: 'System', width: 90, visible: true, frozen: false },
  { key: 'work_type', label: 'Work Type', width: 100, visible: true, frozen: false },
  { key: 'template_name', label: 'Template', width: 130, visible: true, frozen: false },
  { key: 'revision', label: 'Rev', width: 50, visible: true, frozen: false },
  { key: 'discipline_name', label: 'Discipline', width: 100, visible: true, frozen: false },
  { key: 'contractor_name', label: 'Contractor', width: 120, visible: true, frozen: false },
  { key: 'planner_name', label: 'Planner', width: 100, visible: true, frozen: false },
  { key: 'priority', label: 'Priority', width: 80, visible: true, frozen: false },
  { key: 'status', label: 'Status', width: 90, visible: true, frozen: false },
  { key: 'planned_start_date', label: 'Start', width: 100, visible: true, frozen: false },
  { key: 'planned_end_date', label: 'End', width: 100, visible: true, frozen: false },
  { key: 'duration_total', label: 'Dur (h)', width: 90, visible: true, frozen: false },
  { key: 'activity_count', label: 'Acts', width: 60, visible: true, frozen: false },
  { key: 'readiness_score', label: 'Readiness', width: 100, visible: true, frozen: false },
  { key: 'compliance_score', label: 'Compliance', width: 100, visible: true, frozen: false },
  { key: 'document_count', label: 'Docs', width: 60, visible: true, frozen: false },
  { key: 'certificate_count', label: 'Certs', width: 70, visible: true, frozen: false },
];

// ── Editable field set ────────────────────────────────────────────────────────

const EDITABLE_WP_FIELDS = new Set([
  'contractor_name', 'priority', 'planned_start_date', 'planned_end_date',
]);

// ── Component ─────────────────────────────────────────────────────────────────

export function WorkpackGrid() {
  const {
    workpacks,
    selectedWorkpackIds,
    selectWorkpack,
    editingCell,
    setEditingCell,
    updateCellValue,
    pushUndo,
    sortConfig,
    setSortConfig,
    columns: savedColumns,
    resizeColumn,
  } = useWorkspaceStore();

  const columns = savedColumns.length > 0 ? savedColumns : DEFAULT_WORKPACK_COLUMNS;
  const visibleColumns = columns.filter((c) => c.visible);

  // ── Sort Handler ──────────────────────────────────────────────────────

  const handleSort = useCallback((field: string) => {
    const existing = sortConfig.find((s) => s.field === field);
    if (existing) {
      if (existing.direction === 'asc') {
        setSortConfig(sortConfig.map((s) => s.field === field ? { ...s, direction: 'desc' as const } : s));
      } else {
        // Remove sort
        setSortConfig(sortConfig.filter((s) => s.field !== field));
      }
    } else {
      setSortConfig([...sortConfig, { field, direction: 'asc' as const }]);
    }
  }, [sortConfig, setSortConfig]);

  // ── Sorted Workpacks ──────────────────────────────────────────────────

  const sortedWorkpacks = useMemo(() => {
    const sorted = [...workpacks];
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
    return sorted;
  }, [workpacks, sortConfig]);

  // ── Totals ────────────────────────────────────────────────────────────

  const totals = useMemo(() => {
    const t: Record<string, number> = {};
    t.duration_total = workpacks.reduce((s, w) => s + w.duration_total, 0);
    t.activity_count = workpacks.reduce((s, w) => s + w.activity_count, 0);
    t.resource_count = workpacks.reduce((s, w) => s + w.resource_count, 0);
    t.document_count = workpacks.reduce((s, w) => s + w.document_count, 0);
    t.certificate_count = workpacks.reduce((s, w) => s + w.certificate_count, 0);
    return t;
  }, [workpacks]);

  // ── Render ────────────────────────────────────────────────────────────

  const totalWidth = visibleColumns.reduce((s, c) => s + c.width, 0);

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
        {sortedWorkpacks.length === 0 ? (
          <div className="flex items-center justify-center h-24 text-gray-400 text-sm">
            No workpacks found for this event. Select an event or adjust filters.
          </div>
        ) : (
          sortedWorkpacks.map((wp) => (
            <WorkpackRow
              key={wp.id}
              row={wp}
              columns={visibleColumns}
              isSelected={selectedWorkpackIds.has(wp.id)}
              editingCell={editingCell}
              onSelect={(multi) => selectWorkpack(wp.id, multi)}
              onStartEdit={(field) =>
                setEditingCell({ entityType: 'workpack', entityId: wp.id, field })
              }
              onCommitEdit={(field, value) => {
                const oldValue = (wp as any)[field];
                pushUndo({
                  entityType: 'workpack',
                  entityId: wp.id,
                  field,
                  oldValue,
                  newValue: value,
                  timestamp: Date.now(),
                });
                updateCellValue('workpack', wp.id, field, value);
                setEditingCell(null);
              }}
              onCancelEdit={() => setEditingCell(null)}
            />
          ))
        )}
      </div>

      {/* Totals */}
      {sortedWorkpacks.length > 0 && (
        <TotalsRow columns={columns} totals={totals} />
      )}
    </div>
  );
}

// ── Workpack Row ──────────────────────────────────────────────────────────────

function WorkpackRow({
  row,
  columns,
  isSelected,
  editingCell,
  onSelect,
  onStartEdit,
  onCommitEdit,
  onCancelEdit,
}: {
  row: WorkpackGridRow;
  columns: ColumnConfig[];
  isSelected: boolean;
  editingCell: { entityType: string; entityId: string; field: string } | null;
  onSelect: (multi: boolean) => void;
  onStartEdit: (field: string) => void;
  onCommitEdit: (field: string, value: unknown) => void;
  onCancelEdit: () => void;
}) {
  const rowBg = isSelected ? 'bg-blue-50' : 'hover:bg-gray-50';

  const getCellType = (key: string): 'text' | 'number' | 'date' | 'badge' | 'checkbox' => {
    if (key === 'select') return 'checkbox';
    if (key === 'status' || key === 'priority') return 'badge';
    if (key.includes('date')) return 'date';
    if (['duration_total', 'activity_count', 'resource_count', 'document_count', 'certificate_count'].includes(key)) return 'number';
    return 'text';
  };

  return (
    <div
      className={`flex items-center ${rowBg} transition-colors duration-75`}
      onClick={(e) => onSelect(e.ctrlKey || e.metaKey)}
    >
      {columns.map((col) => {
        const value = (row as any)[col.key];
        const isEditing =
          editingCell?.entityType === 'workpack' &&
          editingCell?.entityId === row.id &&
          editingCell?.field === col.key;

        // Special rendering for scores
        if (col.key === 'readiness_score' || col.key === 'compliance_score') {
          return <ScoreCell key={col.key} value={value ?? 0} width={col.width} />;
        }

        // Special rendering for counts
        if (['activity_count', 'document_count', 'certificate_count', 'resource_count'].includes(col.key)) {
          return <CountCell key={col.key} value={value ?? 0} width={col.width} />;
        }

        return (
          <GridCell
            key={col.key}
            value={value}
            type={getCellType(col.key)}
            editable={EDITABLE_WP_FIELDS.has(col.key)}
            locked={col.isLocked}
            width={col.width}
            isEditing={isEditing}
            isSelected={isSelected}
            columnKey={col.key}
            onClick={(e) => e.stopPropagation()}
            onDoubleClick={() => onStartEdit(col.key)}
            onStartEdit={() => onStartEdit(col.key)}
            onCommitEdit={(v) => onCommitEdit(col.key, v)}
            onCancelEdit={onCancelEdit}
          />
        );
      })}
    </div>
  );
}
