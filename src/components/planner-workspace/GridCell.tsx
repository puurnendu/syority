'use client';

/**
 * M7.5 — GridCell Component
 *
 * Renders a single cell in the Workpack or Activity grid.
 * Supports: text, number, date, dropdown, badge, checkbox, locked cells.
 *
 * Key behaviors:
 * - Click to select, Double-click/Enter to edit
 * - Tab moves to next editable cell
 * - Locked cells (template-controlled) render with grey background + 🔒
 * - UDF cells render identically to native cells
 */
import React, { useRef, useState, useCallback, useEffect } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

export type CellType = 'text' | 'number' | 'date' | 'dropdown' | 'badge' | 'checkbox';

export interface DropdownOption {
  value: string;
  label: string;
}

export interface GridCellProps {
  value: unknown;
  type: CellType;
  editable: boolean;
  locked?: boolean;
  isUdf?: boolean;
  isContractorEditable?: boolean;
  width: number;
  /** Dropdown options for select-type cells */
  options?: DropdownOption[];
  /** Badge color map: value → color */
  badgeColors?: Record<string, string>;
  /** Is this cell currently being edited */
  isEditing: boolean;
  /** Is this cell selected (focused) */
  isSelected: boolean;
  /** Callbacks */
  onStartEdit: () => void;
  onCommitEdit: (value: unknown) => void;
  onCancelEdit: () => void;
  onClick: (e: React.MouseEvent) => void;
  onDoubleClick: () => void;
  /** Number formatting */
  decimalPlaces?: number;
  /** Date format */
  dateFormat?: string;
  /** Column key for identification */
  columnKey: string;
}

// ── Badge Color Defaults ──────────────────────────────────────────────────────

const DEFAULT_STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  in_progress: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  approved: 'bg-emerald-100 text-emerald-700',
  not_started: 'bg-gray-100 text-gray-600',
  on_hold: 'bg-amber-100 text-amber-700',
  cancelled: 'bg-red-100 text-red-700',
  critical: 'bg-red-100 text-red-700',
  high: 'bg-orange-100 text-orange-700',
  medium: 'bg-amber-100 text-amber-700',
  low: 'bg-blue-100 text-blue-700',
  Normal: 'bg-gray-100 text-gray-600',
};

// ── Component ─────────────────────────────────────────────────────────────────

export function GridCell({
  value,
  type,
  editable,
  locked = false,
  isUdf = false,
  isContractorEditable = false,
  width,
  options,
  badgeColors = DEFAULT_STATUS_COLORS,
  isEditing,
  isSelected,
  onStartEdit,
  onCommitEdit,
  onCancelEdit,
  onClick,
  onDoubleClick,
  decimalPlaces = 2,
  columnKey,
}: GridCellProps) {
  const inputRef = useRef<HTMLInputElement | HTMLSelectElement>(null);
  const [editValue, setEditValue] = useState<string>('');

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      if (inputRef.current instanceof HTMLInputElement) {
        inputRef.current.select();
      }
    }
  }, [isEditing]);

  // Initialize edit value
  useEffect(() => {
    if (isEditing) {
      setEditValue(value != null ? String(value) : '');
    }
  }, [isEditing, value]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitValue();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancelEdit();
    } else if (e.key === 'Tab') {
      // Let the grid handle tab navigation
      commitValue();
    }
  }, [editValue, type]);

  const commitValue = () => {
    let finalValue: unknown = editValue;
    if (type === 'number') {
      finalValue = editValue === '' ? null : Number(editValue);
    } else if (type === 'checkbox') {
      finalValue = !value;
    } else if (type === 'date') {
      finalValue = editValue || null;
    }
    onCommitEdit(finalValue);
  };

  // ── Cell base classes ───────────────────────────────────────────────────

  const baseClasses = [
    'flex items-center px-2 h-8 text-sm border-r border-b border-gray-200',
    'truncate select-none transition-colors duration-75',
  ];

  if (locked) {
    baseClasses.push('bg-gray-50 text-gray-500');
  } else if (isSelected) {
    baseClasses.push('bg-blue-50 ring-2 ring-inset ring-blue-400');
  } else if (isUdf) {
    baseClasses.push('bg-white');
  } else {
    baseClasses.push('bg-white');
  }

  if (editable && !locked) {
    baseClasses.push('cursor-cell');
  } else {
    baseClasses.push('cursor-default');
  }

  // ── Render: Edit Mode ─────────────────────────────────────────────────

  if (isEditing && editable && !locked) {
    if (type === 'dropdown' && options) {
      return (
        <div className={baseClasses.join(' ')} style={{ width, minWidth: width }}>
          <select
            ref={inputRef as React.RefObject<HTMLSelectElement>}
            value={editValue}
            onChange={(e) => {
              setEditValue(e.target.value);
              onCommitEdit(e.target.value);
            }}
            onKeyDown={handleKeyDown}
            onBlur={() => onCommitEdit(editValue)}
            className="w-full h-full bg-transparent text-sm outline-none"
          >
            <option value="">—</option>
            {options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      );
    }

    if (type === 'date') {
      return (
        <div className={baseClasses.join(' ')} style={{ width, minWidth: width }}>
          <input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            type="date"
            value={editValue?.slice(0, 10) ?? ''}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={() => commitValue()}
            className="w-full h-full bg-transparent text-sm outline-none"
          />
        </div>
      );
    }

    return (
      <div
        className={baseClasses.join(' ') + ' ring-2 ring-blue-500'}
        style={{ width, minWidth: width }}
      >
        <input
          ref={inputRef as React.RefObject<HTMLInputElement>}
          type={type === 'number' ? 'number' : 'text'}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => commitValue()}
          step={type === 'number' ? 'any' : undefined}
          className="w-full h-full bg-transparent text-sm outline-none"
        />
      </div>
    );
  }

  // ── Render: Display Mode ──────────────────────────────────────────────

  let displayContent: React.ReactNode = null;

  switch (type) {
    case 'checkbox':
      displayContent = (
        <input
          type="checkbox"
          checked={!!value}
          readOnly={!editable || locked}
          onChange={() => editable && !locked && onCommitEdit(!value)}
          className="h-4 w-4 rounded border-gray-300 text-blue-600"
        />
      );
      break;

    case 'badge': {
      const strVal = String(value ?? '');
      const colorClass = badgeColors[strVal] ?? 'bg-gray-100 text-gray-600';
      displayContent = strVal ? (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colorClass}`}>
          {strVal.replace(/_/g, ' ')}
        </span>
      ) : null;
      break;
    }

    case 'number':
      displayContent = (
        <span className="text-right w-full tabular-nums">
          {value != null ? Number(value).toLocaleString(undefined, {
            minimumFractionDigits: 0,
            maximumFractionDigits: decimalPlaces,
          }) : ''}
        </span>
      );
      break;

    case 'date':
      displayContent = value ? (
        <span className="tabular-nums">
          {new Date(String(value)).toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          })}
        </span>
      ) : null;
      break;

    case 'dropdown':
      displayContent = (
        <span>
          {options?.find((o) => o.value === String(value))?.label ?? String(value ?? '')}
        </span>
      );
      break;

    default:
      displayContent = <span>{String(value ?? '')}</span>;
  }

  return (
    <div
      className={baseClasses.join(' ')}
      style={{ width, minWidth: width }}
      onClick={onClick}
      onDoubleClick={() => editable && !locked ? onDoubleClick() : undefined}
      title={locked ? 'Template-controlled — edit the template to modify' : undefined}
    >
      {locked && <span className="mr-1 text-xs opacity-50">🔒</span>}
      {displayContent}
    </div>
  );
}

// ── Score Cell ────────────────────────────────────────────────────────────────

export function ScoreCell({ value, width }: { value: number; width: number }) {
  const color =
    value >= 75 ? 'bg-green-500' :
    value >= 50 ? 'bg-amber-500' :
    value >= 25 ? 'bg-orange-500' :
    'bg-red-500';

  return (
    <div
      className="flex items-center gap-1.5 px-2 h-8 text-sm border-r border-b border-gray-200 bg-white"
      style={{ width, minWidth: width }}
    >
      <div className="w-12 h-2 bg-gray-200 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${value}%` }} />
      </div>
      <span className="text-xs tabular-nums font-medium">{value}%</span>
    </div>
  );
}

// ── Count Cell ────────────────────────────────────────────────────────────────

export function CountCell({ value, width, icon }: { value: number; width: number; icon?: string }) {
  return (
    <div
      className="flex items-center justify-center px-2 h-8 text-sm border-r border-b border-gray-200 bg-white tabular-nums"
      style={{ width, minWidth: width }}
    >
      {icon && <span className="mr-1 text-xs">{icon}</span>}
      {value}
    </div>
  );
}
