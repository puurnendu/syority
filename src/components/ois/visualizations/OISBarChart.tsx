/**
 * OIS Bar Chart Visualization
 */
'use client';

import React, { useMemo } from 'react';
import type { VisualizationProps } from '../WidgetRenderer';

export function OISBarChart({ data, config, height }: VisualizationProps) {
  const chartData = data.chartData ?? data.rows ?? [];
  const xKey = config.xAxisKey ?? (chartData[0] ? Object.keys(chartData[0])[0] : 'x');
  const yKeys = config.yAxisKeys ?? (chartData[0] ? Object.keys(chartData[0]).filter((k: string) => k !== xKey) : ['y']);
  const colors = config.colorPalette ?? ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6'];
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

  const barGroupWidth = 100 / chartData.length;
  const barWidth = barGroupWidth / (yKeys.length + 1);

  return (
    <div style={{ height: chartHeight, display: 'flex', flexDirection: 'column' }}>
      <svg viewBox="0 0 100 100" style={{ flex: 1, width: '100%' }} preserveAspectRatio="none">
        {config.showGrid !== false && [0, 25, 50, 75, 100].map((y) => (
          <line key={y} x1="0" y1={y} x2="100" y2={y} stroke="#F3F4F6" strokeWidth="0.3" />
        ))}
        {chartData.map((row: any, i: number) => (
          <React.Fragment key={i}>
            {yKeys.map((yKey: string, ki: number) => {
              const val = Number(row[yKey] ?? 0);
              const barH = (val / yMax) * 100;
              const x = i * barGroupWidth + ki * barWidth + barWidth * 0.2;
              return (
                <rect
                  key={`${i}-${yKey}`}
                  x={x}
                  y={100 - barH}
                  width={barWidth * 0.8}
                  height={barH}
                  fill={colors[ki % colors.length]}
                  rx="0.5"
                />
              );
            })}
          </React.Fragment>
        ))}
      </svg>
      {config.showLegend !== false && yKeys.length > 1 && (
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '8px', flexWrap: 'wrap' }}>
          {yKeys.map((yKey: string, ki: number) => (
            <div key={yKey} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#6B7280' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: colors[ki % colors.length] }} />
              {yKey.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
