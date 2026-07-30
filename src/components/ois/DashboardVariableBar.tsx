/**
 * M7.6D — Dashboard Variable Bar
 *
 * Variable control bar displayed above the dashboard canvas.
 * Dropdowns for: Event, Site, Unit, Area, System, Contractor, Discipline, Shift, Date.
 * Variables cascade automatically (selecting Event resets Site/Unit/Area/System).
 */

'use client';

import React, { useEffect, useState } from 'react';
import { DashboardVariableService, type DashboardVariable, type VariableType } from '@/core/ois/DashboardVariableService';

interface DashboardVariableBarProps {
  variableService: DashboardVariableService;
  /** Optional: fetch options from API for entity-type variables */
  organizationId?: string;
}

/** Variable control renderers by type */
function VariableControl({
  variable,
  onChange,
  options,
}: {
  variable: DashboardVariable;
  onChange: (value: any) => void;
  options: Array<{ label: string; value: any }>;
}) {
  const baseStyle: React.CSSProperties = {
    padding: '6px 10px',
    border: '1px solid #E5E7EB',
    borderRadius: '6px',
    fontSize: '12px',
    background: '#FFF',
    outline: 'none',
    minWidth: '120px',
    maxWidth: '180px',
  };

  switch (variable.type) {
    case 'date':
      return (
        <input
          type="date"
          value={variable.value ?? ''}
          onChange={(e) => onChange(e.target.value || null)}
          style={baseStyle}
        />
      );

    case 'shift':
      return (
        <select
          value={variable.value ?? ''}
          onChange={(e) => onChange(e.target.value || null)}
          style={baseStyle}
        >
          <option value="">All Shifts</option>
          {(variable.staticOptions ?? []).map((opt) => (
            <option key={opt.label} value={opt.value ?? ''}>{opt.label}</option>
          ))}
        </select>
      );

    case 'boolean':
      return (
        <button
          onClick={() => onChange(!variable.value)}
          style={{
            ...baseStyle,
            background: variable.value ? '#EFF6FF' : '#FFF',
            borderColor: variable.value ? '#3B82F6' : '#E5E7EB',
            color: variable.value ? '#3B82F6' : '#6B7280',
            cursor: 'pointer',
            fontWeight: variable.value ? 600 : 400,
          }}
        >
          {variable.value ? '✓ On' : 'Off'}
        </button>
      );

    case 'text':
    case 'number':
      return (
        <input
          type={variable.type === 'number' ? 'number' : 'text'}
          value={variable.value ?? ''}
          onChange={(e) => onChange(e.target.value || null)}
          placeholder={variable.label}
          style={baseStyle}
        />
      );

    default:
      // Entity selectors (event, site, unit, etc.)
      return (
        <select
          value={variable.value ?? ''}
          onChange={(e) => onChange(e.target.value || null)}
          style={{
            ...baseStyle,
            color: variable.value ? '#111827' : '#9CA3AF',
          }}
        >
          <option value="">All {variable.label.replace('Current ', '')}</option>
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      );
  }
}

export function DashboardVariableBar({
  variableService,
  organizationId,
}: DashboardVariableBarProps) {
  const [, forceUpdate] = React.useReducer((x: number) => x + 1, 0);
  const [entityOptions, setEntityOptions] = useState<Record<string, Array<{ label: string; value: any }>>>({});

  useEffect(() => {
    return variableService.subscribe(() => forceUpdate());
  }, [variableService]);

  // Fetch entity options for dropdown variables
  useEffect(() => {
    if (!organizationId) return;

    const fetchOptions = async () => {
      const optionsMap: Record<string, Array<{ label: string; value: any }>> = {};

      // Fetch events
      try {
        const res = await fetch(`/api/events?orgId=${organizationId}&status=active`);
        if (res.ok) {
          const data = await res.json();
          optionsMap.event = (data.data ?? []).map((e: any) => ({ label: e.title ?? e.event_number, value: e.id }));
        }
      } catch { /* ignore */ }

      // Fetch sites
      try {
        const res = await fetch(`/api/sites?orgId=${organizationId}`);
        if (res.ok) {
          const data = await res.json();
          optionsMap.site = (data.data ?? []).map((s: any) => ({ label: s.name ?? s.code, value: s.id }));
        }
      } catch { /* ignore */ }

      // Fetch contractors
      try {
        const res = await fetch(`/api/contractors?orgId=${organizationId}`);
        if (res.ok) {
          const data = await res.json();
          optionsMap.contractor = (data.data ?? []).map((c: any) => ({ label: c.name, value: c.id }));
        }
      } catch { /* ignore */ }

      setEntityOptions(optionsMap);
    };

    fetchOptions();
  }, [organizationId]);

  const variables = variableService.getVisibleVariables();

  if (variables.length === 0) return null;

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      padding: '10px 16px',
      background: '#FAFBFC',
      borderBottom: '1px solid #E5E7EB',
      overflowX: 'auto',
      flexWrap: 'wrap',
    }}>
      <span style={{
        fontSize: '11px',
        fontWeight: 600,
        color: '#6B7280',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        whiteSpace: 'nowrap',
      }}>
        🎛️ Filters
      </span>

      {variables.map((variable) => (
        <div key={variable.key} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <label style={{
            fontSize: '11px',
            fontWeight: 500,
            color: '#6B7280',
            whiteSpace: 'nowrap',
          }}>
            {variable.label.replace('Current ', '')}:
          </label>
          <VariableControl
            variable={variable}
            onChange={(value) => variableService.set(variable.key, value)}
            options={entityOptions[variable.key] ?? variable.staticOptions ?? []}
          />
        </div>
      ))}

      {/* Reset button */}
      <button
        onClick={() => variableService.reset()}
        style={{
          padding: '6px 10px',
          borderRadius: '6px',
          border: '1px solid #E5E7EB',
          background: '#FFF',
          color: '#9CA3AF',
          fontSize: '11px',
          cursor: 'pointer',
          whiteSpace: 'nowrap',
        }}
      >
        ↻ Reset
      </button>
    </div>
  );
}
