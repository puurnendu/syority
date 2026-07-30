/**
 * OIS Status Card Visualization
 */
'use client';

import React from 'react';
import type { VisualizationProps } from '../WidgetRenderer';

const STATUS_COLORS: Record<string, string> = {
  open: '#3B82F6',
  active: '#10B981',
  closed: '#6B7280',
  suspended: '#F59E0B',
  overdue: '#DC2626',
  completed: '#10B981',
  pending: '#F59E0B',
  critical: '#DC2626',
};

export function OISStatusCard({ data }: VisualizationProps) {
  const kpis = data.kpis ?? [];

  if (kpis.length === 0) {
    return <div style={{ color: '#9CA3AF', textAlign: 'center', padding: '20px' }}>No status data</div>;
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '10px' }}>
      {kpis.map((kpi, i) => {
        const statusKey = kpi.label.toLowerCase();
        const color = kpi.color ?? STATUS_COLORS[statusKey] ?? '#3B82F6';
        return (
          <div key={i} style={{
            textAlign: 'center',
            padding: '12px 8px',
            borderRadius: '10px',
            background: `${color}08`,
            border: `1px solid ${color}20`,
          }}>
            <div style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              background: color,
              margin: '0 auto 8px',
              boxShadow: `0 0 8px ${color}40`,
            }} />
            <div style={{ fontSize: '20px', fontWeight: 700, color }}>{kpi.value}</div>
            <div style={{ fontSize: '10px', color: '#6B7280', marginTop: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {kpi.label}
            </div>
          </div>
        );
      })}
    </div>
  );
}
