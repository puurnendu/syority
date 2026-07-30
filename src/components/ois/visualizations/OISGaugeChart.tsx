/**
 * OIS Gauge Chart Visualization
 */
'use client';

import React from 'react';
import type { VisualizationProps } from '../WidgetRenderer';

export function OISGaugeChart({ data, config, thresholdConfig }: VisualizationProps) {
  const kpis = data.kpis ?? [];
  const valueKey = config.valueKey;
  const kpi = valueKey ? kpis.find((k) => k.label.toLowerCase().includes(valueKey.toLowerCase())) : kpis[0];
  const rawValue = kpi ? (typeof kpi.value === 'number' ? kpi.value : parseFloat(String(kpi.value))) : 0;
  const value = isNaN(rawValue) ? 0 : rawValue;

  const min = config.min ?? 0;
  const max = config.max ?? 100;
  const unit = config.unit ?? kpi?.unit ?? '';
  const normalizedValue = Math.min(Math.max((value - min) / (max - min), 0), 1);
  const angle = normalizedValue * 180; // 0 to 180 degrees

  // Color based on segments or threshold
  let gaugeColor = '#3B82F6';
  if (config.segments?.length) {
    for (const seg of config.segments) {
      if (value >= seg.from && value < seg.to) {
        gaugeColor = seg.color;
        break;
      }
    }
  } else if (thresholdConfig) {
    const { warning, danger, direction } = thresholdConfig;
    if (direction === 'above') {
      if (danger !== undefined && value >= danger) gaugeColor = '#DC2626';
      else if (warning !== undefined && value >= warning) gaugeColor = '#F59E0B';
      else gaugeColor = '#10B981';
    } else {
      if (danger !== undefined && value <= danger) gaugeColor = '#DC2626';
      else if (warning !== undefined && value <= warning) gaugeColor = '#F59E0B';
      else gaugeColor = '#10B981';
    }
  }

  const cx = 50;
  const cy = 55;
  const r = 40;
  const arcWidth = config.arcWidth ?? 8;

  // SVG arc helper
  const polarToCartesian = (cx: number, cy: number, r: number, angleDeg: number) => {
    const rad = ((angleDeg - 180) * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  };

  const describeArc = (cx: number, cy: number, r: number, startAngle: number, endAngle: number) => {
    const start = polarToCartesian(cx, cy, r, endAngle);
    const end = polarToCartesian(cx, cy, r, startAngle);
    const largeArc = endAngle - startAngle > 180 ? 1 : 0;
    return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
      <svg viewBox="0 0 100 65" style={{ width: '100%', maxWidth: '200px' }}>
        {/* Background arc */}
        <path d={describeArc(cx, cy, r, 0, 180)} fill="none" stroke="#E5E7EB" strokeWidth={arcWidth} strokeLinecap="round" />
        {/* Value arc */}
        {angle > 0.5 && (
          <path d={describeArc(cx, cy, r, 0, Math.min(angle, 179.5))} fill="none" stroke={gaugeColor} strokeWidth={arcWidth} strokeLinecap="round" />
        )}
      </svg>
      <div style={{ textAlign: 'center', marginTop: '-10px' }}>
        <div style={{ fontSize: '28px', fontWeight: 700, color: gaugeColor, lineHeight: 1 }}>
          {typeof value === 'number' ? (Number.isInteger(value) ? value : value.toFixed(2)) : value}
        </div>
        {unit && <div style={{ fontSize: '11px', color: '#9CA3AF', marginTop: '2px' }}>{unit}</div>}
        {kpi?.label && <div style={{ fontSize: '11px', color: '#6B7280', marginTop: '4px' }}>{kpi.label}</div>}
      </div>
    </div>
  );
}
