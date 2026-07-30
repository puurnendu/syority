/**
 * OIS KPI Card Visualization
 */
'use client';

import React from 'react';
import type { VisualizationProps } from '../WidgetRenderer';

export function OISKpiCard({ data, config }: VisualizationProps) {
  const kpis = data.kpis ?? [];
  const layout = config.layout ?? 'grid';
  const maxCards = config.maxCards ?? 12;
  const displayKpis = kpis.slice(0, maxCards);

  if (displayKpis.length === 0) {
    return <div style={{ color: '#9CA3AF', textAlign: 'center', padding: '20px' }}>No KPIs available</div>;
  }

  const gridCols = displayKpis.length <= 2 ? displayKpis.length : displayKpis.length <= 4 ? 2 : displayKpis.length <= 6 ? 3 : 4;

  return (
    <div style={{
      display: layout === 'horizontal' ? 'flex' : 'grid',
      gridTemplateColumns: layout === 'grid' ? `repeat(${gridCols}, 1fr)` : undefined,
      gap: '12px',
      flexWrap: layout === 'horizontal' ? 'wrap' : undefined,
    }}>
      {displayKpis.map((kpi, i) => (
        <div key={i} style={{
          background: '#F9FAFB',
          borderRadius: '10px',
          padding: '14px 16px',
          minWidth: layout === 'horizontal' ? '140px' : undefined,
          flex: layout === 'horizontal' ? '1 1 0' : undefined,
          transition: 'transform 0.15s',
        }}>
          <div style={{
            fontSize: '11px',
            fontWeight: 500,
            color: '#6B7280',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            marginBottom: '6px',
          }}>
            {kpi.label}
          </div>
          <div style={{
            fontSize: '22px',
            fontWeight: 700,
            color: kpi.color ?? '#111827',
            lineHeight: 1.2,
          }}>
            {kpi.value}
            {kpi.unit && (
              <span style={{ fontSize: '12px', fontWeight: 400, color: '#9CA3AF', marginLeft: '4px' }}>
                {kpi.unit}
              </span>
            )}
          </div>
          {kpi.trend && (
            <div style={{
              marginTop: '4px',
              fontSize: '11px',
              color: kpi.trend === 'up' ? '#10B981' : kpi.trend === 'down' ? '#DC2626' : '#9CA3AF',
            }}>
              {kpi.trend === 'up' ? '▲' : kpi.trend === 'down' ? '▼' : '━'} {kpi.trend}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
