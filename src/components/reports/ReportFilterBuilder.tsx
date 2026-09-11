'use client';

/**
 * M14-R5 — Report Filter Builder Component
 *
 * Provides a business-friendly, multi-dimensional filter configuration UI
 * strictly consuming DimensionRegistry and ControlledValueResolver.
 *
 * Prevents arbitrary free-text entry for controlled master dimensions.
 * Dynamically surfaces tenant UDF dimensions with their controlled options.
 * ZERO business calculations. ZERO metric recalculations.
 */

import React, { useEffect, useState, useMemo } from 'react';
import type { DimensionDefinition } from '@/core/dimensions/types';

export interface FilterState {
  event?: string;
  area?: string;
  unit?: string;
  system?: string;
  equipment?: string;
  equipment_type?: string;
  discipline?: string;
  contractor?: string;
  priority?: string;
  criticality?: string;
  status?: string;
  horizon?: string;
  [udfKey: string]: any;
}

export interface ReportFilterBuilderProps {
  value: FilterState;
  onChange: (filters: FilterState) => void;
  disabled?: boolean;
  onReset?: () => void;
  onSaveTemplate?: () => void;
  showSaveButton?: boolean;
}

const CONTROLLED_PRIORITIES = [
  { value: 'P1', label: 'P1 — Immediate Emergency / Critical Path' },
  { value: 'P2', label: 'P2 — High Impact / Lookahead Priority' },
  { value: 'P3', label: 'P3 — Medium Operational Priority' },
  { value: 'P4', label: 'P4 — Low / Routine Turnaround Scope' },
];

const CONTROLLED_CRITICALITIES = [
  { value: 'CRITICAL', label: 'Critical' },
  { value: 'HIGH', label: 'High' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'LOW', label: 'Low' },
];

const CONTROLLED_STATUSES = [
  { value: 'not_started', label: 'Not Started' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'delayed', label: 'Delayed' },
  { value: 'on_hold', label: 'On Hold' },
  { value: 'cancelled', label: 'Cancelled' },
];

export function ReportFilterBuilder({
  value,
  onChange,
  disabled = false,
  onReset,
  onSaveTemplate,
  showSaveButton = false,
}: ReportFilterBuilderProps) {
  const [dimensions, setDimensions] = useState<DimensionDefinition[]>([]);
  const [events, setEvents] = useState<Array<{ id: string; name: string; code: string }>>([]);
  const [areas, setAreas] = useState<Array<{ id: string; name: string }>>([]);
  const [units, setUnits] = useState<Array<{ id: string; name: string }>>([]);
  const [disciplines, setDisciplines] = useState<Array<{ id: string; name: string; code: string }>>([]);
  const [contractors, setContractors] = useState<Array<{ id: string; name: string; code: string }>>([]);
  const [equipmentTypes, setEquipmentTypes] = useState<Array<{ id: string; name: string; code: string }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    Promise.all([
      fetch('/api/workspace/dimensions').then((r) => r.json()).catch(() => []),
      fetch('/api/events').then((r) => r.json()).catch(() => ({ items: [] })),
      fetch('/api/disciplines').then((r) => r.json()).catch(() => ({ data: [] })),
      fetch('/api/report-builder/parameters/area/options').then((r) => r.json()).catch(() => ({ options: [] })),
      fetch('/api/report-builder/parameters/unit/options').then((r) => r.json()).catch(() => ({ options: [] })),
      fetch('/api/report-builder/parameters/contractor/options').then((r) => r.json()).catch(() => ({ options: [] })),
    ]).then(([dims, evts, discs, areaOpts, unitOpts, contOpts]) => {
      if (!isMounted) return;
      setDimensions(Array.isArray(dims) ? dims : []);
      setEvents(evts?.items ?? []);
      setDisciplines(Array.isArray(discs) ? discs : discs?.data ?? []);
      setAreas(areaOpts?.options ?? []);
      setUnits(unitOpts?.options ?? []);
      setContractors(contOpts?.options ?? []);
      setLoading(false);
    });

    return () => {
      isMounted = false;
    };
  }, []);

  // Separate tenant UDF dimensions from standard dimensions
  const tenantUdfDimensions = useMemo(() => {
    return dimensions.filter((d) => d.isUdf && d.isFilterable);
  }, [dimensions]);

  const handleChange = (key: string, val: any) => {
    const updated = { ...value };
    if (val === '' || val === null || val === undefined) {
      delete updated[key];
    } else {
      updated[key] = val;
    }
    onChange(updated);
  };

  const handleClearAll = () => {
    onChange({});
    if (onReset) onReset();
  };

  const activeFilterEntries = Object.entries(value).filter(
    ([k, v]) => v !== undefined && v !== '' && v !== null && k !== 'event'
  );

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-4">
      {/* Header & Quick Actions */}
      <div className="flex items-center justify-between border-b border-gray-100 pb-3">
        <div className="flex items-center gap-2">
          <span className="text-base">🔍</span>
          <h3 className="text-sm font-bold text-gray-900">Governed Filter & Dimension Builder</h3>
          <span className="text-[10px] font-semibold bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full border border-blue-200">
            DimensionRegistry + ControlledValueResolver
          </span>
        </div>
        <div className="flex items-center gap-2">
          {activeFilterEntries.length > 0 && (
            <button
              type="button"
              disabled={disabled}
              className="text-xs text-red-600 hover:text-red-800 font-medium transition"
              onClick={handleClearAll}
            >
              Clear Filters ({activeFilterEntries.length})
            </button>
          )}
          {showSaveButton && onSaveTemplate && (
            <button
              type="button"
              disabled={disabled}
              className="text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-gray-800 px-2.5 py-1 rounded transition"
              onClick={onSaveTemplate}
            >
              Save View
            </button>
          )}
        </div>
      </div>

      {/* Standard Master Dimensions Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Turnaround Event */}
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">
            Turnaround Event <span className="text-red-500">*</span>
          </label>
          <select
            disabled={disabled}
            className="w-full text-xs rounded-lg border border-gray-300 px-2.5 py-2 bg-white text-gray-900 focus:ring-1 focus:ring-blue-500"
            value={value.event || ''}
            onChange={(e) => handleChange('event', e.target.value)}
          >
            <option value="">Select Event...</option>
            {events.map((evt) => (
              <option key={evt.id} value={evt.id}>
                {evt.code ? `[${evt.code}] ` : ''}{evt.name}
              </option>
            ))}
          </select>
        </div>

        {/* Process Area */}
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">Plant Area</label>
          <select
            disabled={disabled}
            className="w-full text-xs rounded-lg border border-gray-300 px-2.5 py-2 bg-white text-gray-900 focus:ring-1 focus:ring-blue-500"
            value={value.area || ''}
            onChange={(e) => handleChange('area', e.target.value)}
          >
            <option value="">All Areas</option>
            {areas.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>

        {/* Process Unit */}
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">Process Unit</label>
          <select
            disabled={disabled}
            className="w-full text-xs rounded-lg border border-gray-300 px-2.5 py-2 bg-white text-gray-900 focus:ring-1 focus:ring-blue-500"
            value={value.unit || ''}
            onChange={(e) => handleChange('unit', e.target.value)}
          >
            <option value="">All Units</option>
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </div>

        {/* Engineering Discipline */}
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">Discipline</label>
          <select
            disabled={disabled}
            className="w-full text-xs rounded-lg border border-gray-300 px-2.5 py-2 bg-white text-gray-900 focus:ring-1 focus:ring-blue-500"
            value={value.discipline || ''}
            onChange={(e) => handleChange('discipline', e.target.value)}
          >
            <option value="">All Disciplines</option>
            {disciplines.map((d) => (
              <option key={d.id} value={d.code}>
                {d.code} — {d.name}
              </option>
            ))}
          </select>
        </div>

        {/* Contractor */}
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">Contractor</label>
          <select
            disabled={disabled}
            className="w-full text-xs rounded-lg border border-gray-300 px-2.5 py-2 bg-white text-gray-900 focus:ring-1 focus:ring-blue-500"
            value={value.contractor || ''}
            onChange={(e) => handleChange('contractor', e.target.value)}
          >
            <option value="">All Contractors</option>
            {contractors.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        {/* Priority (Controlled Master) */}
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">Priority</label>
          <select
            disabled={disabled}
            className="w-full text-xs rounded-lg border border-gray-300 px-2.5 py-2 bg-white text-gray-900 focus:ring-1 focus:ring-blue-500"
            value={value.priority || ''}
            onChange={(e) => handleChange('priority', e.target.value)}
          >
            <option value="">All Priorities</option>
            {CONTROLLED_PRIORITIES.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>

        {/* Criticality (Controlled Master) */}
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">Criticality</label>
          <select
            disabled={disabled}
            className="w-full text-xs rounded-lg border border-gray-300 px-2.5 py-2 bg-white text-gray-900 focus:ring-1 focus:ring-blue-500"
            value={value.criticality || ''}
            onChange={(e) => handleChange('criticality', e.target.value)}
          >
            <option value="">All Criticalities</option>
            {CONTROLLED_CRITICALITIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        {/* Execution Status */}
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">Execution Status</label>
          <select
            disabled={disabled}
            className="w-full text-xs rounded-lg border border-gray-300 px-2.5 py-2 bg-white text-gray-900 focus:ring-1 focus:ring-blue-500"
            value={value.status || ''}
            onChange={(e) => handleChange('status', e.target.value)}
          >
            <option value="">All Statuses</option>
            {CONTROLLED_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Dynamic Tenant UDF Dimensions Section */}
      {tenantUdfDimensions.length > 0 && (
        <div className="pt-3 border-t border-gray-100">
          <div className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
            <span>🏷️</span>
            <span>Tenant Custom UDF Dimensions ({tenantUdfDimensions.length})</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {tenantUdfDimensions.map((udf) => (
              <div key={udf.id}>
                <label className="block text-xs font-medium text-gray-600 mb-1">{udf.label}</label>
                {udf.options && udf.options.length > 0 ? (
                  <select
                    disabled={disabled}
                    className="w-full text-xs rounded-lg border border-gray-300 px-2.5 py-2 bg-white text-gray-900 focus:ring-1 focus:ring-blue-500"
                    value={value[udf.key] || ''}
                    onChange={(e) => handleChange(udf.key, e.target.value)}
                  >
                    <option value="">All {udf.label}</option>
                    {udf.options.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type={udf.dataType === 'number' ? 'number' : 'text'}
                    disabled={disabled}
                    placeholder={`Filter by ${udf.label}...`}
                    className="w-full text-xs rounded-lg border border-gray-300 px-2.5 py-2 bg-white text-gray-900 focus:ring-1 focus:ring-blue-500"
                    value={value[udf.key] || ''}
                    onChange={(e) => handleChange(udf.key, e.target.value)}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active Filter Chips & Summary */}
      {activeFilterEntries.length > 0 && (
        <div className="pt-3 border-t border-gray-100 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-gray-400 font-medium">Active Filters:</span>
          {activeFilterEntries.map(([k, v]) => (
            <span
              key={k}
              className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-800 border border-blue-200 px-2.5 py-1 rounded-full text-[11px] font-medium"
            >
              <span>{k.replace(/_/g, ' ')}:</span>
              <strong className="font-semibold">{String(v)}</strong>
              <button
                type="button"
                disabled={disabled}
                className="hover:text-blue-950 font-bold ml-0.5"
                onClick={() => handleChange(k, null)}
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
