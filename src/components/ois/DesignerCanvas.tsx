/**
 * M7.6D — Designer Canvas
 *
 * Grid-based canvas using CSS Grid with drag, resize, multi-select.
 * Wraps the existing DashboardGrid with designer-mode interactions.
 * Integrates with DesignerStateManager for state, WidgetRenderer for rendering.
 */

'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { WidgetRenderer } from './WidgetRenderer';
import type { DesignerStateManager, WidgetLayout, ResponsiveBreakpoint } from '@/core/ois/DesignerStateManager';
import type { WidgetData } from '@/core/ois/WidgetSDK';

// ─── Types ──────────────────────────────────────────────────────────────────

interface DesignerCanvasProps {
  designer: DesignerStateManager;
  widgetData: Record<string, WidgetData>;
  widgetMeta: Record<string, {
    name: string;
    icon?: string;
    visualizationType: string;
    defaultConfig: Record<string, any>;
  }>;
  onWidgetClick?: (widgetId: string) => void;
  onWidgetDoubleClick?: (widgetId: string) => void;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function DesignerCanvas({
  designer,
  widgetData,
  widgetMeta,
  onWidgetClick,
  onWidgetDoubleClick,
}: DesignerCanvasProps) {
  const [, forceUpdate] = React.useReducer((x: number) => x + 1, 0);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [dragState, setDragState] = useState<{
    widgetId: string;
    startX: number;
    startY: number;
    offsetX: number;
    offsetY: number;
  } | null>(null);
  const [resizeState, setResizeState] = useState<{
    widgetId: string;
    startX: number;
    startY: number;
    startW: number;
    startH: number;
  } | null>(null);
  const [selectRect, setSelectRect] = useState<{
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
  } | null>(null);

  useEffect(() => {
    return designer.subscribe(forceUpdate);
  }, [designer]);

  const config = designer.getConfig();
  const layouts = designer.getPageLayouts();
  const gridColumns = designer.getBreakpointColumns();
  const colWidth = 100 / gridColumns; // percentage

  // ── Keyboard Shortcuts ──────────────────────────────────────────────────

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey;

      if (ctrl && e.key === 'z' && !e.shiftKey) { e.preventDefault(); designer.undo(); }
      else if (ctrl && e.key === 'y') { e.preventDefault(); designer.redo(); }
      else if (ctrl && e.key === 'z' && e.shiftKey) { e.preventDefault(); designer.redo(); }
      else if (ctrl && e.key === 'c') { e.preventDefault(); designer.copy(); }
      else if (ctrl && e.key === 'v') { e.preventDefault(); designer.paste(); }
      else if (ctrl && e.key === 'd') { e.preventDefault(); designer.duplicate(); }
      else if (e.key === 'Delete' || e.key === 'Backspace') { designer.deleteSelected(); }
      else if (ctrl && e.key === 'a') { e.preventDefault(); designer.selectAll(); }
      else if (e.key === 'Escape') { designer.clearSelection(); }
      else if (ctrl && e.key === 'g' && !e.shiftKey) { e.preventDefault(); designer.groupSelected(); }
      else if (ctrl && e.key === 'g' && e.shiftKey) { e.preventDefault(); designer.ungroupSelected(); }
      else if (ctrl && e.key === 'l') { e.preventDefault(); designer.lockSelected(); }
      else if (ctrl && e.key === ']') { e.preventDefault(); const sel = designer.selection; if (sel.length === 1) designer.bringForward(sel[0]); }
      else if (ctrl && e.key === '[') { e.preventDefault(); const sel = designer.selection; if (sel.length === 1) designer.sendBackward(sel[0]); }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [designer]);

  // ── Drag Handling ───────────────────────────────────────────────────────

  const handleWidgetMouseDown = useCallback((e: React.MouseEvent, layout: WidgetLayout) => {
    if (layout.isLocked) return;
    e.stopPropagation();

    // Select
    if (!designer.isSelected(layout.id)) {
      designer.select(layout.id, e.shiftKey);
    }

    // Start drag
    setDragState({
      widgetId: layout.id,
      startX: e.clientX,
      startY: e.clientY,
      offsetX: 0,
      offsetY: 0,
    });
  }, [designer]);

  const handleResizeMouseDown = useCallback((e: React.MouseEvent, layout: WidgetLayout) => {
    if (layout.isLocked) return;
    e.stopPropagation();
    e.preventDefault();

    setResizeState({
      widgetId: layout.id,
      startX: e.clientX,
      startY: e.clientY,
      startW: layout.w,
      startH: layout.h,
    });
  }, []);

  // ── Mouse Move (drag / resize / select-rect) ───────────────────────────

  useEffect(() => {
    if (!dragState && !resizeState && !selectRect) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (dragState && canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect();
        const cellW = rect.width / gridColumns;
        const cellH = config.gridRowHeight;
        const dx = Math.round((e.clientX - dragState.startX) / cellW);
        const dy = Math.round((e.clientY - dragState.startY) / cellH);

        if (dx !== dragState.offsetX || dy !== dragState.offsetY) {
          const layout = designer.getLayout(dragState.widgetId);
          if (layout) {
            designer.updateLayout(dragState.widgetId, {
              x: Math.max(0, Math.min(gridColumns - layout.w, layout.x + dx - dragState.offsetX)),
              y: Math.max(0, layout.y + dy - dragState.offsetY),
            });
            setDragState((prev) => prev ? { ...prev, offsetX: dx, offsetY: dy } : null);
          }
        }
      }

      if (resizeState && canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect();
        const cellW = rect.width / gridColumns;
        const cellH = config.gridRowHeight;
        const dw = Math.round((e.clientX - resizeState.startX) / cellW);
        const dh = Math.round((e.clientY - resizeState.startY) / cellH);
        const newW = Math.max(1, resizeState.startW + dw);
        const newH = Math.max(1, resizeState.startH + dh);
        designer.updateLayout(resizeState.widgetId, { w: newW, h: newH });
      }

      if (selectRect) {
        setSelectRect((prev) => prev ? { ...prev, currentX: e.clientX, currentY: e.clientY } : null);
      }
    };

    const handleMouseUp = () => {
      setDragState(null);
      setResizeState(null);
      setSelectRect(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState, resizeState, selectRect, designer, config, gridColumns]);

  // ── Canvas Click (deselect or start select-rect) ────────────────────────

  const handleCanvasMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.target === canvasRef.current) {
      designer.clearSelection();
      setSelectRect({
        startX: e.clientX,
        startY: e.clientY,
        currentX: e.clientX,
        currentY: e.clientY,
      });
    }
  }, [designer]);

  // ── Render ──────────────────────────────────────────────────────────────

  const maxRow = layouts.reduce((max, l) => Math.max(max, l.y + l.h), 0);

  return (
    <div
      ref={canvasRef}
      className="ois-designer-canvas"
      onMouseDown={handleCanvasMouseDown}
      style={{
        position: 'relative',
        display: 'grid',
        gridTemplateColumns: `repeat(${gridColumns}, 1fr)`,
        gridAutoRows: `${config.gridRowHeight}px`,
        gap: `${config.margin[1]}px ${config.margin[0]}px`,
        padding: `${config.containerPadding[1]}px ${config.containerPadding[0]}px`,
        minHeight: `${Math.max(maxRow + 4, 8) * config.gridRowHeight}px`,
        background: config.showGrid
          ? `repeating-linear-gradient(0deg, transparent, transparent ${config.gridRowHeight - 1}px, #F3F4F6 ${config.gridRowHeight}px),
             repeating-linear-gradient(90deg, transparent, transparent calc(${colWidth}% - 1px), #F3F4F6 calc(${colWidth}%))`
          : '#F9FAFB',
        borderRadius: '8px',
        overflow: 'auto',
        cursor: selectRect ? 'crosshair' : 'default',
      }}
    >
      {layouts.map((layout) => {
        const meta = widgetMeta[layout.widgetDefinitionSlug] ?? { name: 'Widget', visualizationType: 'kpi_card', defaultConfig: {} };
        const data = widgetData[layout.widgetInstanceId] ?? { loading: true };
        const isSelected = designer.isSelected(layout.id);

        return (
          <div
            key={layout.id}
            onMouseDown={(e) => handleWidgetMouseDown(e, layout)}
            onClick={() => onWidgetClick?.(layout.id)}
            onDoubleClick={() => onWidgetDoubleClick?.(layout.id)}
            style={{
              gridColumn: `${layout.x + 1} / span ${layout.w}`,
              gridRow: `${layout.y + 1} / span ${layout.h}`,
              position: 'relative',
              zIndex: layout.zIndex,
              outline: isSelected ? '2px solid #3B82F6' : 'none',
              outlineOffset: '2px',
              borderRadius: '12px',
              opacity: layout.isVisible ? 1 : 0.4,
              cursor: layout.isLocked ? 'not-allowed' : 'grab',
              transition: 'outline 0.1s',
              userSelect: 'none',
            }}
          >
            <WidgetRenderer
              visualizationType={meta.visualizationType as any}
              data={data}
              config={meta.defaultConfig}
              title={meta.name}
              icon={meta.icon}
              height={layout.h * config.gridRowHeight + (layout.h - 1) * config.margin[1]}
            />

            {/* Lock indicator */}
            {layout.isLocked && (
              <div style={{
                position: 'absolute', top: 4, left: 4, fontSize: '12px',
                background: 'rgba(0,0,0,0.6)', color: '#FFF', borderRadius: '4px', padding: '2px 4px',
              }}>
                🔒
              </div>
            )}

            {/* Group indicator */}
            {layout.groupId && (
              <div style={{
                position: 'absolute', top: 4, right: 28, fontSize: '10px',
                background: '#8B5CF6', color: '#FFF', borderRadius: '4px', padding: '2px 6px',
              }}>
                🔗
              </div>
            )}

            {/* Resize handle */}
            {!layout.isLocked && (
              <div
                onMouseDown={(e) => handleResizeMouseDown(e, layout)}
                style={{
                  position: 'absolute',
                  bottom: 0,
                  right: 0,
                  width: '16px',
                  height: '16px',
                  cursor: 'se-resize',
                  background: isSelected ? 'linear-gradient(135deg, transparent 50%, #3B82F6 50%)' : 'transparent',
                  borderRadius: '0 0 12px 0',
                }}
              />
            )}

            {/* Selection border dots */}
            {isSelected && !layout.isLocked && (
              <>
                {[
                  { top: -4, left: -4 }, { top: -4, right: -4 },
                  { bottom: -4, left: -4 }, { bottom: -4, right: -4 },
                ].map((pos, i) => (
                  <div key={i} style={{
                    position: 'absolute', ...pos,
                    width: '8px', height: '8px', borderRadius: '50%',
                    background: '#3B82F6', border: '2px solid #FFF',
                  }} />
                ))}
              </>
            )}
          </div>
        );
      })}

      {/* Selection rectangle */}
      {selectRect && (
        <div style={{
          position: 'fixed',
          left: Math.min(selectRect.startX, selectRect.currentX),
          top: Math.min(selectRect.startY, selectRect.currentY),
          width: Math.abs(selectRect.currentX - selectRect.startX),
          height: Math.abs(selectRect.currentY - selectRect.startY),
          border: '1px dashed #3B82F6',
          background: 'rgba(59, 130, 246, 0.05)',
          pointerEvents: 'none',
          zIndex: 1000,
        }} />
      )}

      {/* Empty state */}
      {layouts.length === 0 && (
        <div style={{
          gridColumn: '1 / -1',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          minHeight: '400px', color: '#9CA3AF',
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '56px', marginBottom: '16px' }}>📊</div>
            <div style={{ fontSize: '18px', fontWeight: 600, color: '#6B7280' }}>Start Building</div>
            <div style={{ fontSize: '13px', marginTop: '8px' }}>Click "➕ Widget" to add your first widget</div>
          </div>
        </div>
      )}
    </div>
  );
}
