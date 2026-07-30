/**
 * OIS Area Chart Visualization
 */
'use client';

import React, { useMemo } from 'react';
import type { VisualizationProps } from '../WidgetRenderer';

export function OISAreaChart({ data, config, height }: VisualizationProps) {
  const chartData = data.chartData ?? data.rows ?? [];
  const xKey = config.xAxisKey ?? (chartData[0] ? Object.keys(chartData[0])[0] : 'x');
  const yKeys = config.yAxisKeys ?? (chartData[0] ? Object.keys(chartData[0]).filter((k: string) => k !== xKey) : ['y']);
  const colors = config.colorPalette ?? ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6'];
  const fillOpacity = config.fillOpacity ?? 0.2;
  const chartHeight = height ?? 200;

  const { yMax } = useMemo(() => {
    let yMax = 0;
    for (const row of chartData) {
      for (const key of yKeys) {
        const val = Number(row[key] ?? 0);
        if (val > yMax) yMax = val;
      }
    }
    return { yMax: Math.ceil(yMax * 1.1) || 100 };
  }, [chartData, yKeys]);

  if (chartData.length === 0) {
    return <div style={{ color: '#9CA3AF', textAlign: 'center', padding: '20px' }}>No chart data</div>;
  }

  return (
    <div style={{ height: chartHeight, display: 'flex', flexDirection: 'column' }}>
      <svg viewBox="-5 -5 110 110" style={{ flex: 1, width: '100%' }} preserveAspectRatio="none">
        {config.showGrid !== false && [0, 25, 50, 75, 100].map((y) => (
          <line key={y} x1="0" y1={y} x2="100" y2={y} stroke="#F3F4F6" strokeWidth="0.3" />
        ))}
        {yKeys.map((yKey: string, ki: number) => {
          const pts = chartData.map((row: any, i: number) => {
            const x = (i / Math.max(chartData.length - 1, 1)) * 100;
            const y = 100 - (Number(row[yKey] ?? 0) / yMax) * 100;
            return `${x},${y}`;
          });
          const polygonPts = `0,100 ${pts.join(' ')} 100,100`;
          return (
            <React.Fragment key={yKey}>
              <polygon points={polygonPts} fill={colors[ki % colors.length]} opacity={fillOpacity} />
              <polyline points={pts.join(' ')} fill="none" stroke={colors[ki % colors.length]} strokeWidth="1.5" />
            </React.Fragment>
          );
        })}
      </svg>
      {config.showLegend !== false && (
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '8px', flexWrap: 'wrap' }}>
          {yKeys.map((yKey: string, ki: number) => (
            <div key={yKey} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#6B7280' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: colors[ki % colors.length], opacity: fillOpacity + 0.3 }} />
              {yKey.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
