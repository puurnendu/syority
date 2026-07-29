'use client';

/**
 * M7.5 — GridHeader Component
 *
 * Renders column headers for both Workpack Grid and Activity Grid.
 * Features: sortable, resizable, frozen columns, lock indicator for template fields.
 */
import React, { useCallback, useRef, useState } from 'react';
import type { ColumnConfig, SortConfig } from '@/stores/useWorkspaceStore';

interface GridHeaderProps {
  columns: ColumnConfig[];
  sortConfig: SortConfig[];
  frozenColumnCount: number;
  onSort: (field: string) => void;
  onResize: (key: string, width: number) => void;
  /** Total grid width for scroll sync */
  scrollLeft?: number;
}

export function GridHeader({
  columns,
  sortConfig,
  frozenColumnCount,
  onSort,
  onResize,
  scrollLeft = 0,
}: GridHeaderProps) {
  const visibleColumns = columns.filter((c) => c.visible);

  return (
    <div className="flex sticky top-0 z-10 bg-gray-100 border-b-2 border-gray-300">
      {visibleColumns.map((col, idx) => (
        <HeaderCell
          key={col.key}
          column={col}
          sortDir={sortConfig.find((s) => s.field === col.key)?.direction}
          isFrozen={idx < frozenColumnCount}
          onSort={() => onSort(col.key)}
          onResize={(w) => onResize(col.key, w)}
        />
      ))}
    </div>
  );
}

// ── Individual Header Cell ────────────────────────────────────────────────────

function HeaderCell({
  column,
  sortDir,
  isFrozen,
  onSort,
  onResize,
}: {
  column: ColumnConfig;
  sortDir?: 'asc' | 'desc';
  isFrozen: boolean;
  onSort: () => void;
  onResize: (width: number) => void;
}) {
  const resizeRef = useRef<HTMLDivElement>(null);
  const [isResizing, setIsResizing] = useState(false);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    const startX = e.clientX;
    const startWidth = column.width;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientX - startX;
      onResize(Math.max(40, startWidth + delta));
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, [column.width, onResize]);

  const frozenClass = isFrozen ? 'sticky z-20 bg-gray-100' : '';
  const lockIcon = column.isLocked ? '🔒 ' : '';
  const udfIcon = column.isUdf ? '📋 ' : '';
  const contractorIcon = column.isContractorEditable ? '🔧 ' : '';

  return (
    <div
      className={`relative flex items-center h-8 px-2 text-xs font-semibold text-gray-600 
        uppercase tracking-wider border-r border-gray-300 cursor-pointer 
        hover:bg-gray-200 select-none ${frozenClass}`}
      style={{ width: column.width, minWidth: column.width }}
      onClick={onSort}
      title={[
        column.label,
        column.isLocked ? '(Template-controlled)' : '',
        column.isUdf ? `(UDF: ${column.udfCode})` : '',
        column.isContractorEditable ? '(Contractor Editable)' : '',
      ].filter(Boolean).join(' ')}
    >
      <span className="truncate">
        {lockIcon}{udfIcon}{contractorIcon}{column.label}
      </span>

      {/* Sort indicator */}
      {sortDir && (
        <span className="ml-1 text-blue-600">
          {sortDir === 'asc' ? '↑' : '↓'}
        </span>
      )}

      {/* Resize handle */}
      <div
        ref={resizeRef}
        className={`absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-400 
          ${isResizing ? 'bg-blue-500' : ''}`}
        onMouseDown={handleMouseDown}
      />
    </div>
  );
}

// ── Group Header Row ──────────────────────────────────────────────────────────

export interface GroupHeaderProps {
  groupField: string;
  groupValue: string;
  level: number;
  isExpanded: boolean;
  rollups: {
    activityCount?: number;
    workpackCount?: number;
    totalDuration?: number;
    totalCrew?: number;
    udfRollups?: Record<string, number>;
  };
  onToggle: () => void;
  totalWidth: number;
}

export function GroupHeaderRow({
  groupField,
  groupValue,
  level,
  isExpanded,
  rollups,
  onToggle,
  totalWidth,
}: GroupHeaderProps) {
  return (
    <div
      className="flex items-center h-8 bg-indigo-50 border-b border-indigo-200 cursor-pointer hover:bg-indigo-100"
      style={{ width: totalWidth, paddingLeft: level * 16 + 8 }}
      onClick={onToggle}
    >
      <span className="mr-2 text-indigo-600 font-mono text-xs">
        {isExpanded ? '▼' : '▶'}
      </span>
      <span className="text-sm font-semibold text-indigo-800">
        {groupField}: {groupValue}
      </span>
      
      {/* Rollup badges */}
      <div className="ml-auto flex items-center gap-3 pr-4 text-xs text-indigo-600">
        {rollups.workpackCount != null && (
          <span>📦 {rollups.workpackCount} WPs</span>
        )}
        {rollups.activityCount != null && (
          <span>📝 {rollups.activityCount} activities</span>
        )}
        {rollups.totalDuration != null && (
          <span>⏱ {rollups.totalDuration.toLocaleString()}h</span>
        )}
        {rollups.totalCrew != null && (
          <span>👥 {rollups.totalCrew}</span>
        )}
        {rollups.udfRollups && Object.entries(rollups.udfRollups).map(([code, val]) => (
          <span key={code}>{code}: {val.toLocaleString()}</span>
        ))}
      </div>
    </div>
  );
}

// ── Totals Row ────────────────────────────────────────────────────────────────

export interface TotalsRowProps {
  columns: ColumnConfig[];
  totals: Record<string, number>;
}

export function TotalsRow({ columns, totals }: TotalsRowProps) {
  const visibleColumns = columns.filter((c) => c.visible);

  return (
    <div className="flex items-center h-8 bg-gray-100 border-t-2 border-gray-400 font-semibold text-sm">
      {visibleColumns.map((col, idx) => {
        const val = totals[col.key];
        return (
          <div
            key={col.key}
            className="flex items-center px-2 h-8 border-r border-gray-300 tabular-nums"
            style={{ width: col.width, minWidth: col.width }}
          >
            {idx === 0 ? (
              <span className="text-gray-600 font-bold">TOTALS</span>
            ) : val != null ? (
              <span className="text-right w-full">{val.toLocaleString()}</span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
