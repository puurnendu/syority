/**
 * OIS Pie Chart Visualization
 */
'use client';

import React, { useMemo } from 'react';
import type { VisualizationProps } from '../WidgetRenderer';

export function OISPieChart({ data, config }: VisualizationProps) {
  const chartData = data.chartData ?? data.rows ?? [];
  const kpis = data.kpis ?? [];
  const colors = config.colorPalette ?? ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4', '#F97316', '#14B8A6'];

  const items = useMemo(() => {
    if (kpis.length > 0) {
      return kpis.map((k) => ({
        label: k.label,
        value: typeof k.value === 'number' ? k.value : parseFloat(String(k.value)),
      })).filter((k) => !isNaN(k.value) && k.value > 0);
    }
    if (chartData.length > 0) {
      const keys = Object.keys(chartData[0]);
      return chartData.map((r: any) => ({
        label: String(r[keys[0]]),
        value: Number(r[keys[1]] ?? 0),
      })).filter((k: any) => k.value > 0);
    }
    return [];
  }, [kpis, chartData]);

  if (items.length === 0) {
    return <div style={{ color: '#9CA3AF', textAlign: 'center', padding: '20px' }}>No data</div>;
  }

  const total = items.reduce((s, i) => s + i.value, 0);
  const cx = 50, cy = 50, r = 40;
  const innerRadius = config.innerRadius ?? 0;

  // Calculate pie slices
  let currentAngle = -90;
  const slices = items.map((item, i) => {
    const angle = (item.value / total) * 360;
    const startAngle = currentAngle;
    const endAngle = currentAngle + angle;
    currentAngle = endAngle;

    const startRad = (startAngle * Math.PI) / 180;
    const endRad = (endAngle * Math.PI) / 180;
    const largeArc = angle > 180 ? 1 : 0;

    const x1 = cx + r * Math.cos(startRad);
    const y1 = cy + r * Math.sin(startRad);
    const x2 = cx + r * Math.cos(endRad);
    const y2 = cy + r * Math.sin(endRad);

    let path: string;
    if (innerRadius > 0) {
      const ix1 = cx + innerRadius * Math.cos(startRad);
      const iy1 = cy + innerRadius * Math.sin(startRad);
      const ix2 = cx + innerRadius * Math.cos(endRad);
      const iy2 = cy + innerRadius * Math.sin(endRad);
      path = `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} L ${ix2} ${iy2} A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${ix1} ${iy1} Z`;
    } else {
      path = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
    }

    return { path, color: colors[i % colors.length], label: item.label, value: item.value, pct: ((item.value / total) * 100).toFixed(1) };
  });

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', height: '100%' }}>
      <svg viewBox="0 0 100 100" style={{ width: '60%', maxWidth: '180px' }}>
        {slices.map((s, i) => (
          <path key={i} d={s.path} fill={s.color} stroke="#FFF" strokeWidth="0.5" />
        ))}
      </svg>
      {config.showLegend !== false && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
          {slices.map((s, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: s.color, flexShrink: 0 }} />
              <span style={{ color: '#374151', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.label}</span>
              <span style={{ color: '#9CA3AF', fontWeight: 500 }}>{s.pct}%</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
