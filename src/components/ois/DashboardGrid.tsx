/**
 * M7.6C — Dashboard Grid
 *
 * Grid-based dashboard layout renderer.
 * Renders widgets in a CSS Grid layout matching the grid position from DB.
 * Used by: Dashboard Viewer, Cockpit, TV Mode, Meeting Mode.
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { WidgetRenderer } from './WidgetRenderer';
import type { WidgetData } from '@/core/ois/WidgetSDK';

// ─── Types ──────────────────────────────────────────────────────────────────

interface DashboardWidget {
  id: string;
  grid_x: number;
  grid_y: number;
  grid_w: number;
  grid_h: number;
  title_override?: string | null;
  subtitle?: string | null;
  icon_override?: string | null;
  color_override?: string | null;
  show_header: boolean;
  show_footer: boolean;
  footer_html?: string | null;
  provider_params?: any;
  visualization_config?: any;
  threshold_config?: any;
  number_format?: string | null;
  date_format?: string | null;
  refresh_interval_override?: number | null;
  widget_definition: {
    slug: string;
    name: string;
    icon?: string | null;
    provider_key: string;
    visualization_type: string;
    default_config: any;
    refresh_interval_sec: number;
  };
}

interface DashboardGridProps {
  widgets: DashboardWidget[];
  widgetData: Record<string, WidgetData>;
  gridColumns?: number;
  gridRowHeight?: number;
  isEditing?: boolean;
  onLayoutChange?: (layouts: Array<{ id: string; gridX: number; gridY: number; gridW: number; gridH: number }>) => void;
  theme?: 'light' | 'dark';
}

// ─── Component ──────────────────────────────────────────────────────────────

export function DashboardGrid({
  widgets,
  widgetData,
  gridColumns = 12,
  gridRowHeight = 80,
  isEditing = false,
  theme = 'light',
}: DashboardGridProps) {

  // Find max row to determine grid height
  const maxRow = widgets.reduce((max, w) => {
    const bottom = w.grid_y + w.grid_h;
    return bottom > max ? bottom : max;
  }, 0);

  const isDark = theme === 'dark';

  return (
    <div
      className="ois-dashboard-grid"
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${gridColumns}, 1fr)`,
        gridAutoRows: `${gridRowHeight}px`,
        gap: '16px',
        padding: '16px',
        minHeight: `${maxRow * gridRowHeight + (maxRow - 1) * 16 + 32}px`,
        background: isDark ? '#111827' : '#F3F4F6',
        borderRadius: '12px',
        position: 'relative',
      }}
    >
      {widgets.map((widget) => {
        const data = widgetData[widget.id] ?? { loading: true };
        const config = {
          ...(widget.widget_definition.default_config ?? {}),
          ...(widget.visualization_config ?? {}),
        };

        return (
          <div
            key={widget.id}
            style={{
              gridColumn: `${widget.grid_x + 1} / span ${widget.grid_w}`,
              gridRow: `${widget.grid_y + 1} / span ${widget.grid_h}`,
              position: 'relative',
              transition: 'box-shadow 0.2s',
            }}
            className={isEditing ? 'ois-widget-editable' : ''}
          >
            <WidgetRenderer
              visualizationType={widget.widget_definition.visualization_type as any}
              data={data}
              config={config}
              title={widget.title_override ?? widget.widget_definition.name}
              subtitle={widget.subtitle ?? undefined}
              icon={widget.icon_override ?? widget.widget_definition.icon ?? undefined}
              colorOverride={widget.color_override ?? undefined}
              showHeader={widget.show_header}
              showFooter={widget.show_footer}
              footerHtml={widget.footer_html ?? undefined}
              thresholdConfig={widget.threshold_config as any}
              numberFormat={widget.number_format ?? undefined}
              dateFormat={widget.date_format ?? undefined}
              height={widget.grid_h * gridRowHeight + (widget.grid_h - 1) * 16}
            />
            {isEditing && (
              <div style={{
                position: 'absolute',
                top: 0,
                right: 0,
                padding: '4px',
                display: 'flex',
                gap: '4px',
                zIndex: 10,
              }}>
                <button
                  style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '6px',
                    border: 'none',
                    background: 'rgba(0,0,0,0.6)',
                    color: '#FFF',
                    cursor: 'pointer',
                    fontSize: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  title="Configure widget"
                >
                  ⚙️
                </button>
              </div>
            )}
          </div>
        );
      })}

      {/* Empty state */}
      {widgets.length === 0 && (
        <div style={{
          gridColumn: '1 / -1',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '300px',
          color: '#9CA3AF',
          fontSize: '16px',
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📊</div>
            <div style={{ fontWeight: 600, color: '#6B7280' }}>No widgets yet</div>
            <div style={{ fontSize: '13px', marginTop: '4px' }}>
              {isEditing ? 'Drag widgets from the palette to get started' : 'This dashboard is empty'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
