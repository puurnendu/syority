/**
 * M7.6D — Designer Toolbar
 *
 * Full toolbar for the dashboard designer with:
 * Undo/Redo, Save/Publish, Add Widget, Responsive Preview,
 * Alignment, Distribution, Layer, Lock, Group controls.
 */

'use client';

import React from 'react';
import type { DesignerStateManager, ResponsiveBreakpoint } from '@/core/ois/DesignerStateManager';

interface DesignerToolbarProps {
  designer: DesignerStateManager;
  onSave: () => void;
  onPublish: () => void;
  onAddWidget: () => void;
  onPreview: () => void;
  onExport: () => void;
  isSaving?: boolean;
  dashboardName: string;
}

const BREAKPOINTS: { key: ResponsiveBreakpoint; icon: string; label: string }[] = [
  { key: 'desktop', icon: '🖥️', label: 'Desktop' },
  { key: 'tablet', icon: '📱', label: 'Tablet' },
  { key: 'mobile', icon: '📲', label: 'Mobile' },
  { key: 'tv', icon: '📺', label: 'TV' },
  { key: 'print', icon: '🖨️', label: 'Print' },
];

export function DesignerToolbar({
  designer,
  onSave,
  onPublish,
  onAddWidget,
  onPreview,
  onExport,
  isSaving = false,
  dashboardName,
}: DesignerToolbarProps) {
  const [, forceUpdate] = React.useReducer((x: number) => x + 1, 0);

  React.useEffect(() => {
    return designer.subscribe(forceUpdate);
  }, [designer]);

  const config = designer.getConfig();
  const bp = designer.getBreakpoint();
  const selCount = designer.selectionCount;

  const btnStyle = (active = false, disabled = false): React.CSSProperties => ({
    padding: '6px 10px',
    borderRadius: '6px',
    border: '1px solid',
    borderColor: active ? '#3B82F6' : '#E5E7EB',
    background: active ? '#EFF6FF' : disabled ? '#F9FAFB' : '#FFF',
    color: active ? '#3B82F6' : disabled ? '#D1D5DB' : '#374151',
    fontSize: '12px',
    cursor: disabled ? 'not-allowed' : 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    fontWeight: active ? 600 : 400,
    transition: 'all 0.15s',
    lineHeight: 1,
  });

  const sepStyle: React.CSSProperties = {
    width: '1px',
    height: '24px',
    background: '#E5E7EB',
    margin: '0 4px',
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      padding: '8px 16px',
      background: '#FFFFFF',
      borderBottom: '1px solid #E5E7EB',
      flexWrap: 'wrap',
      minHeight: '48px',
    }}>
      {/* Dashboard name */}
      <div style={{ fontWeight: 700, fontSize: '14px', color: '#111827', marginRight: '8px', whiteSpace: 'nowrap' }}>
        {dashboardName}
      </div>

      {/* Save indicator */}
      {designer.dirty && (
        <span style={{ fontSize: '10px', color: '#F59E0B', fontWeight: 500 }}>● Unsaved</span>
      )}

      <div style={sepStyle} />

      {/* ── History ─────────────────────────────────────────────────── */}
      <button style={btnStyle(false, !designer.canUndo)} onClick={() => designer.undo()} disabled={!designer.canUndo} title="Undo (Ctrl+Z)">↩️</button>
      <button style={btnStyle(false, !designer.canRedo)} onClick={() => designer.redo()} disabled={!designer.canRedo} title="Redo (Ctrl+Y)">↪️</button>

      <div style={sepStyle} />

      {/* ── Widget ──────────────────────────────────────────────────── */}
      <button style={btnStyle()} onClick={onAddWidget} title="Add Widget">➕ Widget</button>

      <div style={sepStyle} />

      {/* ── Selection Actions ──────────────────────────────────────── */}
      <button style={btnStyle(false, selCount === 0)} onClick={() => designer.copy()} disabled={selCount === 0} title="Copy (Ctrl+C)">📋</button>
      <button style={btnStyle(false, selCount === 0)} onClick={() => designer.duplicate()} disabled={selCount === 0} title="Duplicate (Ctrl+D)">📑</button>
      <button style={btnStyle(false, selCount === 0)} onClick={() => designer.deleteSelected()} disabled={selCount === 0} title="Delete (Del)">🗑️</button>

      <div style={sepStyle} />

      {/* ── Lock ────────────────────────────────────────────────────── */}
      <button style={btnStyle(false, selCount === 0)} onClick={() => designer.lockSelected()} disabled={selCount === 0} title="Lock (Ctrl+L)">🔒</button>
      <button style={btnStyle(false, selCount === 0)} onClick={() => designer.unlockSelected()} disabled={selCount === 0} title="Unlock">🔓</button>

      <div style={sepStyle} />

      {/* ── Grouping ────────────────────────────────────────────────── */}
      <button style={btnStyle(false, selCount < 2)} onClick={() => designer.groupSelected()} disabled={selCount < 2} title="Group (Ctrl+G)">🔗</button>
      <button style={btnStyle(false, selCount === 0)} onClick={() => designer.ungroupSelected()} disabled={selCount === 0} title="Ungroup (Ctrl+Shift+G)">⛓️‍💥</button>

      <div style={sepStyle} />

      {/* ── Alignment ──────────────────────────────────────────────── */}
      <button style={btnStyle(false, selCount < 2)} onClick={() => designer.alignSelected('left')} disabled={selCount < 2} title="Align Left">⬅️</button>
      <button style={btnStyle(false, selCount < 2)} onClick={() => designer.alignSelected('center')} disabled={selCount < 2} title="Align Center">↔️</button>
      <button style={btnStyle(false, selCount < 2)} onClick={() => designer.alignSelected('right')} disabled={selCount < 2} title="Align Right">➡️</button>
      <button style={btnStyle(false, selCount < 2)} onClick={() => designer.alignSelected('top')} disabled={selCount < 2} title="Align Top">⬆️</button>
      <button style={btnStyle(false, selCount < 2)} onClick={() => designer.alignSelected('middle')} disabled={selCount < 2} title="Align Middle">↕️</button>
      <button style={btnStyle(false, selCount < 2)} onClick={() => designer.alignSelected('bottom')} disabled={selCount < 2} title="Align Bottom">⬇️</button>

      <div style={sepStyle} />

      {/* ── Distribution ───────────────────────────────────────────── */}
      <button style={btnStyle(false, selCount < 3)} onClick={() => designer.distributeSelected('horizontal')} disabled={selCount < 3} title="Distribute Horizontal">⇔</button>
      <button style={btnStyle(false, selCount < 3)} onClick={() => designer.distributeSelected('vertical')} disabled={selCount < 3} title="Distribute Vertical">⇕</button>

      <div style={sepStyle} />

      {/* ── Z-Order ────────────────────────────────────────────────── */}
      <button style={btnStyle(false, selCount !== 1)} onClick={() => { if (selCount === 1) designer.bringForward(designer.selection[0]); }} disabled={selCount !== 1} title="Bring Forward (Ctrl+])">🔼</button>
      <button style={btnStyle(false, selCount !== 1)} onClick={() => { if (selCount === 1) designer.sendBackward(designer.selection[0]); }} disabled={selCount !== 1} title="Send Backward (Ctrl+[)">🔽</button>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* ── Grid controls ──────────────────────────────────────────── */}
      <button style={btnStyle(config.showGrid)} onClick={() => designer.toggleGrid()} title="Toggle Grid">⊞</button>
      <button style={btnStyle(config.snapToGrid)} onClick={() => designer.toggleSnap()} title="Toggle Snap">🧲</button>

      <div style={sepStyle} />

      {/* ── Responsive Preview ─────────────────────────────────────── */}
      {BREAKPOINTS.map((b) => (
        <button key={b.key} style={btnStyle(bp === b.key)} onClick={() => designer.setBreakpoint(b.key)} title={b.label}>
          {b.icon}
        </button>
      ))}

      <div style={sepStyle} />

      {/* ── Actions ────────────────────────────────────────────────── */}
      <button style={btnStyle()} onClick={onPreview} title="Preview">👁️ Preview</button>
      <button style={btnStyle()} onClick={onExport} title="Export">📤</button>
      <button
        style={{
          ...btnStyle(),
          background: isSaving ? '#D1D5DB' : '#FFF',
        }}
        onClick={onSave}
        disabled={isSaving}
        title="Save (Ctrl+S)"
      >
        💾 {isSaving ? 'Saving...' : 'Save'}
      </button>
      <button
        style={{
          padding: '6px 14px',
          borderRadius: '6px',
          border: 'none',
          background: 'linear-gradient(135deg, #3B82F6, #8B5CF6)',
          color: '#FFF',
          fontSize: '12px',
          fontWeight: 600,
          cursor: 'pointer',
        }}
        onClick={onPublish}
        title="Publish"
      >
        🚀 Publish
      </button>
    </div>
  );
}
