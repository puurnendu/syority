/**
 * M7.6D — Cross-Filter Breadcrumb
 *
 * Breadcrumb navigation showing the current drill-down path
 * with clickable back links. Displays when drill-down is active.
 */

'use client';

import React from 'react';
import { CrossFilterEngine, DRILLDOWN_LEVELS, type DrilldownBreadcrumb } from '@/core/ois/CrossFilterEngine';

interface CrossFilterBreadcrumbProps {
  crossFilter: CrossFilterEngine;
}

const LEVEL_ICONS: Record<string, string> = {
  company: '🏢',
  site: '📍',
  unit: '🏭',
  area: '📐',
  system: '⚙️',
  equipment: '🔧',
  workpack: '📦',
  activity: '📋',
  certificate: '📜',
  drawing: '📄',
  issue: '⚠️',
  photos: '📸',
};

export function CrossFilterBreadcrumb({ crossFilter }: CrossFilterBreadcrumbProps) {
  const [, forceUpdate] = React.useReducer((x: number) => x + 1, 0);

  React.useEffect(() => {
    return crossFilter.subscribe(() => forceUpdate());
  }, [crossFilter]);

  const path = crossFilter.getDrilldownPath();

  if (path.length === 0) return null;

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '4px',
      padding: '8px 24px',
      background: '#EFF6FF',
      borderBottom: '1px solid #BFDBFE',
      fontSize: '13px',
    }}>
      {/* Home */}
      <button
        onClick={() => crossFilter.resetDrilldown()}
        style={{
          background: 'none',
          border: 'none',
          color: '#3B82F6',
          cursor: 'pointer',
          fontSize: '13px',
          padding: '2px 6px',
          borderRadius: '4px',
        }}
      >
        🏠 All
      </button>

      {path.map((crumb, idx) => (
        <React.Fragment key={idx}>
          <span style={{ color: '#93C5FD' }}>›</span>
          <button
            onClick={() => crossFilter.navigateTo(idx)}
            style={{
              background: idx === path.length - 1 ? '#DBEAFE' : 'none',
              border: 'none',
              color: idx === path.length - 1 ? '#1D4ED8' : '#3B82F6',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: idx === path.length - 1 ? 600 : 400,
              padding: '2px 8px',
              borderRadius: '4px',
            }}
          >
            {LEVEL_ICONS[crumb.level] ?? '📁'} {crumb.label}
          </button>
        </React.Fragment>
      ))}

      {/* Current level indicator */}
      <span style={{ marginLeft: 'auto', fontSize: '11px', color: '#6B7280' }}>
        Level: {crossFilter.getCurrentLevel()}
      </span>

      {/* Back button */}
      <button
        onClick={() => crossFilter.drillUp()}
        style={{
          padding: '4px 10px',
          borderRadius: '6px',
          border: '1px solid #BFDBFE',
          background: '#FFF',
          color: '#3B82F6',
          fontSize: '11px',
          cursor: 'pointer',
          fontWeight: 500,
        }}
      >
        ← Back
      </button>

      {/* Clear all */}
      <button
        onClick={() => crossFilter.resetDrilldown()}
        style={{
          padding: '4px 10px',
          borderRadius: '6px',
          border: '1px solid #BFDBFE',
          background: '#FFF',
          color: '#6B7280',
          fontSize: '11px',
          cursor: 'pointer',
        }}
      >
        ✕ Clear
      </button>
    </div>
  );
}
