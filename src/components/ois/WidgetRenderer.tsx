/**
 * M7.6C — Widget Renderer
 *
 * Universal widget renderer — the bridge between WidgetSDK and React.
 * Takes a widget definition + data → dispatches to the correct visualization.
 * Used by: DashboardGrid, CockpitViewer, TVMode, MeetingMode.
 *
 * ONE renderer for the entire platform.
 */

'use client';

import React, { useMemo } from 'react';
import type { VisualizationType, WidgetData, ThresholdConfig } from '@/core/ois/WidgetSDK';
import {
  getVisualizationSpec,
  evaluateThreshold,
  getThresholdColor,
} from '@/core/ois/VisualizationEngine';

// ─── Dynamic Visualizations ─────────────────────────────────────────────────

import { OISKpiCard } from './visualizations/OISKpiCard';
import { OISDataTable } from './visualizations/OISDataTable';
import { OISLineChart } from './visualizations/OISLineChart';
import { OISBarChart } from './visualizations/OISBarChart';
import { OISGaugeChart } from './visualizations/OISGaugeChart';
import { OISProgressCard } from './visualizations/OISProgressCard';
import { OISStatusCard } from './visualizations/OISStatusCard';
import { OISAreaChart } from './visualizations/OISAreaChart';
import { OISPieChart } from './visualizations/OISPieChart';

// ─── Component Map ──────────────────────────────────────────────────────────

const COMPONENT_MAP: Record<string, React.ComponentType<VisualizationProps>> = {
  kpi_card: OISKpiCard,
  data_table: OISDataTable,
  line: OISLineChart,
  area: OISAreaChart,
  bar: OISBarChart,
  stacked_bar: OISBarChart,
  gauge: OISGaugeChart,
  progress_card: OISProgressCard,
  status_card: OISStatusCard,
  pie: OISPieChart,
  donut: OISPieChart,
  // Fallback renderers — these use the table or KPI card as defaults
  heatmap: OISDataTable,
  matrix: OISDataTable,
  hierarchy_table: OISDataTable,
  pivot_table: OISDataTable,
  tree_grid: OISDataTable,
  timeline: OISLineChart,
  scurve: OISLineChart,
  evm: OISLineChart,
  gantt_summary: OISDataTable,
};

// ─── Types ──────────────────────────────────────────────────────────────────

export interface VisualizationProps {
  data: WidgetData;
  config: Record<string, any>;
  thresholdConfig?: ThresholdConfig;
  colorOverride?: string;
  numberFormat?: string;
  dateFormat?: string;
  height?: number;
}

interface WidgetRendererProps {
  /** Visualization type from the widget definition */
  visualizationType: VisualizationType;
  /** Widget data from the provider */
  data: WidgetData;
  /** Merged visualization config (default + overrides) */
  config: Record<string, any>;
  /** Widget display props */
  title: string;
  subtitle?: string;
  icon?: string;
  /** Styling */
  colorOverride?: string;
  showHeader?: boolean;
  showFooter?: boolean;
  footerHtml?: string;
  /** Threshold */
  thresholdConfig?: ThresholdConfig;
  /** Formatting */
  numberFormat?: string;
  dateFormat?: string;
  /** Grid height (for responsive sizing) */
  height?: number;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function WidgetRenderer({
  visualizationType,
  data,
  config,
  title,
  subtitle,
  icon,
  colorOverride,
  showHeader = true,
  showFooter = false,
  footerHtml,
  thresholdConfig,
  numberFormat,
  dateFormat,
  height,
}: WidgetRendererProps) {
  const VisualizationComponent = useMemo(() => {
    return COMPONENT_MAP[visualizationType] ?? OISKpiCard;
  }, [visualizationType]);

  const thresholdState = useMemo(() => {
    if (!thresholdConfig || !data.kpis?.[0]) return null;
    const value = typeof data.kpis[0].value === 'number' ? data.kpis[0].value : parseFloat(String(data.kpis[0].value));
    if (isNaN(value)) return null;
    return evaluateThreshold(value, thresholdConfig);
  }, [thresholdConfig, data.kpis]);

  const borderColor = thresholdState
    ? getThresholdColor(thresholdState, thresholdConfig)
    : colorOverride ?? 'transparent';

  return (
    <div
      className="ois-widget"
      style={{
        height: height ? `${height}px` : '100%',
        display: 'flex',
        flexDirection: 'column',
        background: '#FFFFFF',
        borderRadius: '12px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)',
        border: `1px solid ${thresholdState ? borderColor : '#E5E7EB'}`,
        borderTop: thresholdState ? `3px solid ${borderColor}` : undefined,
        overflow: 'hidden',
        transition: 'box-shadow 0.2s, border-color 0.2s',
      }}
    >
      {/* Header */}
      {showHeader && (
        <div style={{
          padding: '14px 16px 8px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          borderBottom: '1px solid #F3F4F6',
        }}>
          {icon && <span style={{ fontSize: '18px' }}>{icon}</span>}
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 style={{
              margin: 0,
              fontSize: '14px',
              fontWeight: 600,
              color: '#111827',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}>
              {title}
            </h3>
            {subtitle && (
              <p style={{
                margin: 0,
                fontSize: '11px',
                color: '#9CA3AF',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}>
                {subtitle}
              </p>
            )}
          </div>
          {data.loading && (
            <div style={{
              width: '14px',
              height: '14px',
              border: '2px solid #E5E7EB',
              borderTop: '2px solid #3B82F6',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
            }} />
          )}
        </div>
      )}

      {/* Content */}
      <div style={{ flex: 1, padding: '12px 16px', overflow: 'auto', minHeight: 0 }}>
        {data.error ? (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            color: '#DC2626',
            fontSize: '13px',
          }}>
            ⚠️ {data.error}
          </div>
        ) : data.loading ? (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
          }}>
            <div style={{
              display: 'flex',
              gap: '6px',
            }}>
              {[0, 1, 2].map((i) => (
                <div key={i} style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: '#D1D5DB',
                  animation: `pulse 1.5s ease-in-out ${i * 0.2}s infinite`,
                }} />
              ))}
            </div>
          </div>
        ) : (
          <VisualizationComponent
            data={data}
            config={config}
            thresholdConfig={thresholdConfig}
            colorOverride={colorOverride}
            numberFormat={numberFormat}
            dateFormat={dateFormat}
            height={height ? height - (showHeader ? 56 : 0) - (showFooter ? 40 : 0) - 24 : undefined}
          />
        )}
      </div>

      {/* Footer */}
      {showFooter && footerHtml && (
        <div
          style={{
            padding: '8px 16px',
            borderTop: '1px solid #F3F4F6',
            fontSize: '11px',
            color: '#9CA3AF',
          }}
          dangerouslySetInnerHTML={{ __html: footerHtml }}
        />
      )}
    </div>
  );
}
