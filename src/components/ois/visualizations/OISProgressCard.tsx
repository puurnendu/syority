/**
 * OIS Progress Card Visualization
 */
'use client';

import React from 'react';
import type { VisualizationProps } from '../WidgetRenderer';

export function OISProgressCard({ data, config }: VisualizationProps) {
  const kpis = data.kpis ?? [];
  const rows = data.rows ?? [];
  const showPercentage = config.showPercentage ?? true;
  const barHeight = config.barHeight ?? 8;
  const barColor = config.barColor ?? '#3B82F6';

  // If we have KPIs with percentage values, render them as progress bars
  const progressItems = kpis.length > 0
    ? kpis.map((k) => {
        const raw = typeof k.value === 'number' ? k.value : parseFloat(String(k.value).replace('%', ''));
        const pct = isNaN(raw) ? 0 : Math.min(100, Math.max(0, raw));
        return { label: k.label, value: pct, color: k.color ?? barColor };
      })
    : rows.map((r) => {
        const keys = Object.keys(r);
        const label = r[keys[0]] ?? 'Item';
        const raw = Number(r[keys[1]] ?? 0);
        const pct = Math.min(100, Math.max(0, raw));
        return { label: String(label), value: pct, color: barColor };
      });

  if (progressItems.length === 0) {
    return <div style={{ color: '#9CA3AF', textAlign: 'center', padding: '20px' }}>No progress data</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {progressItems.map((item, i) => (
        <div key={i}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span style={{ fontSize: '12px', fontWeight: 500, color: '#374151' }}>{item.label}</span>
            {showPercentage && (
              <span style={{ fontSize: '12px', fontWeight: 600, color: item.color }}>{item.value.toFixed(0)}%</span>
            )}
          </div>
          <div style={{
            height: `${barHeight}px`,
            borderRadius: `${barHeight / 2}px`,
            background: '#E5E7EB',
            overflow: 'hidden',
          }}>
            <div style={{
              height: '100%',
              width: `${item.value}%`,
              borderRadius: `${barHeight / 2}px`,
              background: item.color,
              transition: 'width 0.6s ease-out',
            }} />
          </div>
        </div>
      ))}
    </div>
  );
}
