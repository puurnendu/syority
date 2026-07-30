/**
 * M7.6D — Composite Widget
 *
 * One widget that contains multiple sub-visualizations:
 * KPI + Mini Trend + Progress Bar + Table + Status Indicator + AI Summary.
 *
 * Layout is configurable by the planner.
 * Sub-widgets resize intelligently within the composite container.
 */

'use client';

import React from 'react';
import { WidgetRenderer } from '../WidgetRenderer';
import type { WidgetData, VisualizationType } from '@/core/ois/WidgetSDK';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface CompositeSlot {
  id: string;
  type: VisualizationType | 'ai_summary';
  title?: string;
  config: Record<string, any>;
  /** Grid position within the composite */
  gridArea: string; // e.g. "1 / 1 / 2 / 3"
  /** Data key override — if set, uses this key from the parent data */
  dataKey?: string;
}

interface OISCompositeWidgetProps {
  data: WidgetData;
  config: {
    slots: CompositeSlot[];
    gridTemplate?: string;
    gridTemplateRows?: string;
    gridTemplateColumns?: string;
    gap?: number;
  };
  height: number;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function OISCompositeWidget({ data, config, height }: OISCompositeWidgetProps) {
  const slots = config.slots ?? [];
  const gap = config.gap ?? 8;

  // Extract sub-data for each slot
  function getSlotData(slot: CompositeSlot): WidgetData {
    if (slot.dataKey && data.metadata?.[slot.dataKey]) {
      return { loading: false, ...data.metadata[slot.dataKey] };
    }
    return data;
  }

  if (slots.length === 0) {
    return (
      <div style={{
        height,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#9CA3AF',
        fontSize: '13px',
      }}>
        Configure composite widget slots
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'grid',
        gridTemplate: config.gridTemplate ?? undefined,
        gridTemplateRows: config.gridTemplateRows ?? `repeat(auto-fill, minmax(80px, 1fr))`,
        gridTemplateColumns: config.gridTemplateColumns ?? 'repeat(2, 1fr)',
        gap: `${gap}px`,
        height,
        overflow: 'hidden',
        padding: '4px',
      }}
    >
      {slots.map((slot) => {
        const slotData = getSlotData(slot);

        // AI Summary slot — special render
        if (slot.type === 'ai_summary') {
          return (
            <div
              key={slot.id}
              style={{
                gridArea: slot.gridArea,
                background: 'linear-gradient(135deg, #F0F9FF, #E0F2FE)',
                borderRadius: '8px',
                padding: '12px',
                overflow: 'auto',
              }}
            >
              <div style={{ fontSize: '11px', fontWeight: 600, color: '#0369A1', marginBottom: '6px' }}>
                🤖 {slot.title ?? 'AI Summary'}
              </div>
              <div style={{ fontSize: '12px', color: '#1E40AF', lineHeight: 1.5 }}>
                {slotData.summary ?? 'AI summary will be generated from the dashboard data.'}
              </div>
            </div>
          );
        }

        return (
          <div
            key={slot.id}
            style={{
              gridArea: slot.gridArea,
              borderRadius: '8px',
              overflow: 'hidden',
              border: '1px solid #F3F4F6',
              position: 'relative',
            }}
          >
            {slot.title && (
              <div style={{
                fontSize: '10px',
                fontWeight: 600,
                color: '#6B7280',
                padding: '4px 8px',
                background: '#F9FAFB',
                borderBottom: '1px solid #F3F4F6',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}>
                {slot.title}
              </div>
            )}
            <WidgetRenderer
              visualizationType={slot.type as VisualizationType}
              data={slotData}
              config={slot.config}
              height={undefined}
            />
          </div>
        );
      })}
    </div>
  );
}
