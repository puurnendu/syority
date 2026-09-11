'use client';

/**
 * M14-R5 — Report Table Designer Component
 *
 * Visual configuration panel for table components within the Report Designer.
 * Supports:
 * - Column selection & ordering (reorder up/down)
 * - Custom column labels, text alignments, and widths
 * - Multi-level presentation grouping (e.g. Area -> Unit -> System -> Equipment)
 * - Column visibility toggles
 * - PDF print header repetition and pagination
 *
 * CRITICAL RULE: Grouping and sorting are PRESENTATION ONLY.
 * ZERO independent progress, EVM, or metric derivations.
 */

import React from 'react';

export interface ColumnSetting {
  key: string;
  label: string;
  width?: string;
  align?: 'left' | 'center' | 'right';
  visible: boolean;
}

export interface TableConfig {
  columns: ColumnSetting[];
  groupBy?: string[];
  sortBy?: {
    key: string;
    direction: 'asc' | 'desc';
  };
  pageSize: number;
  repeatHeaderPdf: boolean;
  showTotals: boolean;
}

export interface ReportTableDesignerProps {
  config: TableConfig;
  availableFields?: Array<{ key: string; label: string }>;
  onChange: (config: TableConfig) => void;
  disabled?: boolean;
}

const PRESET_GROUPINGS = [
  { label: 'None (Flat Table)', value: '' },
  { label: 'Area → Unit → System → Equipment', value: 'area,unit,system,equipment' },
  { label: 'Contractor → Discipline → Status', value: 'contractor,discipline,status' },
  { label: 'Equipment Type → Standard Activity', value: 'equipment_type,standard_activity' },
  { label: 'Process Unit → Critical Path Status', value: 'unit,is_critical' },
  { label: 'Discipline → Workpack', value: 'discipline,workpack' },
];

export function ReportTableDesigner({
  config,
  availableFields = [],
  onChange,
  disabled = false,
}: ReportTableDesignerProps) {
  const handleToggleVisibility = (idx: number) => {
    const nextCols = [...config.columns];
    nextCols[idx] = { ...nextCols[idx], visible: !nextCols[idx].visible };
    onChange({ ...config, columns: nextCols });
  };

  const handleMoveColumn = (fromIdx: number, toIdx: number) => {
    if (toIdx < 0 || toIdx >= config.columns.length) return;
    const nextCols = [...config.columns];
    const [moved] = nextCols.splice(fromIdx, 1);
    nextCols.splice(toIdx, 0, moved);
    onChange({ ...config, columns: nextCols });
  };

  const handleUpdateCol = (idx: number, patch: Partial<ColumnSetting>) => {
    const nextCols = [...config.columns];
    nextCols[idx] = { ...nextCols[idx], ...patch };
    onChange({ ...config, columns: nextCols });
  };

  const handleGroupingChange = (val: string) => {
    const groups = val ? val.split(',') : [];
    onChange({ ...config, groupBy: groups });
  };

  const currentGroupingStr = (config.groupBy || []).join(',');

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-5 text-xs text-gray-700">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-100 pb-3">
        <div className="flex items-center gap-2">
          <span className="text-base">📋</span>
          <h3 className="text-sm font-bold text-gray-900">Table Presentation & Layout Designer</h3>
        </div>
        <span className="text-[10px] font-semibold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-200">
          Presentation Only (No Metric Recalculation)
        </span>
      </div>

      {/* Grouping & Pagination Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="block font-semibold text-gray-700 mb-1">Hierarchical Grouping</label>
          <select
            disabled={disabled}
            className="w-full rounded-lg border border-gray-300 px-2.5 py-1.5 bg-white text-gray-900 focus:ring-1 focus:ring-blue-500 text-xs"
            value={currentGroupingStr}
            onChange={(e) => handleGroupingChange(e.target.value)}
          >
            {PRESET_GROUPINGS.map((g) => (
              <option key={g.value} value={g.value}>
                {g.label}
              </option>
            ))}
          </select>
          <p className="text-[11px] text-gray-400 mt-1">Presentation grouping preserves authoritative row metrics.</p>
        </div>

        <div>
          <label className="block font-semibold text-gray-700 mb-1">Page Size (Records / Page)</label>
          <select
            disabled={disabled}
            className="w-full rounded-lg border border-gray-300 px-2.5 py-1.5 bg-white text-gray-900 focus:ring-1 focus:ring-blue-500 text-xs"
            value={config.pageSize}
            onChange={(e) => onChange({ ...config, pageSize: Number(e.target.value) })}
          >
            <option value="25">25 Records</option>
            <option value="50">50 Records (Standard)</option>
            <option value="100">100 Records</option>
            <option value="250">250 Records (Print Optimized)</option>
            <option value="1000">1000 Records (High Volume)</option>
          </select>
        </div>

        <div className="space-y-2 pt-4">
          <label className="flex items-center gap-2 font-medium cursor-pointer">
            <input
              type="checkbox"
              disabled={disabled}
              checked={config.repeatHeaderPdf}
              onChange={(e) => onChange({ ...config, repeatHeaderPdf: e.target.checked })}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span>Repeat Header on PDF Pages</span>
          </label>
          <label className="flex items-center gap-2 font-medium cursor-pointer">
            <input
              type="checkbox"
              disabled={disabled}
              checked={config.showTotals}
              onChange={(e) => onChange({ ...config, showTotals: e.target.checked })}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span>Show Authoritative Summary Row</span>
          </label>
        </div>
      </div>

      {/* Column Config Table */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="font-bold text-gray-800">Column Selection, Ordering & Formatting ({config.columns.length})</span>
          <span className="text-[11px] text-gray-400">Use arrows to adjust column sequence</span>
        </div>
        <div className="border border-gray-200 rounded-lg overflow-hidden max-h-72 overflow-y-auto">
          <table className="min-w-full divide-y divide-gray-200 text-left">
            <thead className="bg-gray-50 sticky top-0">
              <tr className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                <th className="px-3 py-2 w-10">Show</th>
                <th className="px-3 py-2">Field Key</th>
                <th className="px-3 py-2">Display Label</th>
                <th className="px-3 py-2 w-28">Align</th>
                <th className="px-3 py-2 w-24">Width</th>
                <th className="px-3 py-2 w-20 text-center">Order</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {config.columns.map((col, idx) => (
                <tr key={col.key} className={col.visible ? 'hover:bg-gray-50' : 'bg-gray-50/50 opacity-60'}>
                  <td className="px-3 py-1.5 text-center">
                    <input
                      type="checkbox"
                      disabled={disabled}
                      checked={col.visible}
                      onChange={() => handleToggleVisibility(idx)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </td>
                  <td className="px-3 py-1.5 font-mono text-[11px] text-gray-600">{col.key}</td>
                  <td className="px-3 py-1.5">
                    <input
                      type="text"
                      disabled={disabled || !col.visible}
                      value={col.label}
                      onChange={(e) => handleUpdateCol(idx, { label: e.target.value })}
                      className="w-full text-xs px-2 py-1 rounded border border-gray-200 bg-white text-gray-800"
                    />
                  </td>
                  <td className="px-3 py-1.5">
                    <select
                      disabled={disabled || !col.visible}
                      value={col.align || 'left'}
                      onChange={(e) => handleUpdateCol(idx, { align: e.target.value as any })}
                      className="w-full text-xs px-2 py-1 rounded border border-gray-200 bg-white text-gray-800"
                    >
                      <option value="left">Left</option>
                      <option value="center">Center</option>
                      <option value="right">Right</option>
                    </select>
                  </td>
                  <td className="px-3 py-1.5">
                    <input
                      type="text"
                      disabled={disabled || !col.visible}
                      placeholder="auto"
                      value={col.width || ''}
                      onChange={(e) => handleUpdateCol(idx, { width: e.target.value })}
                      className="w-full text-xs px-2 py-1 rounded border border-gray-200 bg-white text-gray-800"
                    />
                  </td>
                  <td className="px-3 py-1.5 text-center">
                    <div className="inline-flex gap-1">
                      <button
                        type="button"
                        disabled={disabled || idx === 0}
                        onClick={() => handleMoveColumn(idx, idx - 1)}
                        className="px-1.5 py-0.5 rounded bg-gray-100 hover:bg-gray-200 disabled:opacity-30"
                      >
                        ▲
                      </button>
                      <button
                        type="button"
                        disabled={disabled || idx === config.columns.length - 1}
                        onClick={() => handleMoveColumn(idx, idx + 1)}
                        className="px-1.5 py-0.5 rounded bg-gray-100 hover:bg-gray-200 disabled:opacity-30"
                      >
                        ▼
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
