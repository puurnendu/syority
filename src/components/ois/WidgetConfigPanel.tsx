/**
 * M7.6D — Widget Configuration Panel
 *
 * Professional property panel with 5 tabs:
 * General | Data | Visualization | Interaction | Export
 *
 * Similar to Power BI / Grafana property panels.
 */

'use client';

import React, { useState, useEffect } from 'react';
import type { VisualizationType, ThresholdConfig } from '@/core/ois/WidgetSDK';

// ─── Types ──────────────────────────────────────────────────────────────────

interface WidgetConfig {
  id: string;
  widgetDefinitionSlug: string;
  title: string;
  subtitle: string;
  description: string;
  category: string;
  icon: string;
  isVisible: boolean;
  tags: string[];
  // Data
  providerKey: string;
  providerParams: Record<string, any>;
  refreshInterval: number;
  cacheTtlSeconds: number;
  // Visualization
  visualizationType: VisualizationType;
  visualizationConfig: Record<string, any>;
  thresholdConfig?: ThresholdConfig;
  numberFormat: string;
  dateFormat: string;
  colorOverride: string;
  // Interaction
  drilldownEnabled: boolean;
  crossFilterEnabled: boolean;
  crossFilterField: string;
  clickAction: string;
  deepLinkTarget: string;
  // Export
  includeInPdf: boolean;
  includeInExcel: boolean;
  includeInCsv: boolean;
  includeInSnapshot: boolean;
}

type ConfigTab = 'general' | 'data' | 'visualization' | 'interaction' | 'export';

interface WidgetConfigPanelProps {
  config: WidgetConfig;
  onChange: (patch: Partial<WidgetConfig>) => void;
  onClose: () => void;
  isOpen: boolean;
  availableProviders?: Array<{ key: string; name: string; category: string }>;
}

// ─── Tab Config ─────────────────────────────────────────────────────────────

const TABS: { key: ConfigTab; label: string; icon: string }[] = [
  { key: 'general', label: 'General', icon: '⚙️' },
  { key: 'data', label: 'Data', icon: '📊' },
  { key: 'visualization', label: 'Visual', icon: '🎨' },
  { key: 'interaction', label: 'Interact', icon: '🖱️' },
  { key: 'export', label: 'Export', icon: '📤' },
];

const VIZ_TYPES: { value: VisualizationType; label: string }[] = [
  { value: 'kpi_card', label: 'KPI Card' },
  { value: 'data_table', label: 'Data Table' },
  { value: 'line', label: 'Line Chart' },
  { value: 'area', label: 'Area Chart' },
  { value: 'bar', label: 'Bar Chart' },
  { value: 'stacked_bar', label: 'Stacked Bar' },
  { value: 'pie', label: 'Pie Chart' },
  { value: 'donut', label: 'Donut Chart' },
  { value: 'gauge', label: 'Gauge' },
  { value: 'progress_card', label: 'Progress Card' },
  { value: 'status_card', label: 'Status Card' },
  { value: 'heatmap', label: 'Heatmap' },
  { value: 'scurve', label: 'S-Curve' },
  { value: 'evm', label: 'Earned Value' },
  { value: 'timeline', label: 'Timeline' },
  { value: 'matrix', label: 'Matrix' },
  { value: 'hierarchy_table', label: 'Hierarchy Table' },
  { value: 'pivot_table', label: 'Pivot Table' },
  { value: 'tree_grid', label: 'Tree Grid' },
  { value: 'gantt_summary', label: 'Gantt Summary' },
];

const CLICK_ACTIONS = [
  { value: '', label: 'None' },
  { value: 'cross_filter', label: 'Cross Filter' },
  { value: 'drilldown', label: 'Drill Down' },
  { value: 'open_workpack', label: 'Open Workpack' },
  { value: 'open_activity', label: 'Open Activity' },
  { value: 'open_equipment', label: 'Open Equipment' },
  { value: 'open_drawing', label: 'Open Drawing' },
  { value: 'open_certificate', label: 'Open Certificate' },
  { value: 'open_issue', label: 'Open Issue' },
  { value: 'navigate', label: 'Navigate to URL' },
];

// ─── Helpers ────────────────────────────────────────────────────────────────

const fieldStyle: React.CSSProperties = {
  marginBottom: '14px',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '11px',
  fontWeight: 600,
  color: '#6B7280',
  marginBottom: '4px',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  border: '1px solid #E5E7EB',
  borderRadius: '6px',
  fontSize: '13px',
  outline: 'none',
  background: '#FFF',
};

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  appearance: 'auto' as any,
};

const toggleStyle = (active: boolean): React.CSSProperties => ({
  width: '36px',
  height: '20px',
  borderRadius: '10px',
  border: 'none',
  background: active ? '#3B82F6' : '#D1D5DB',
  position: 'relative',
  cursor: 'pointer',
  transition: 'background 0.2s',
});

const toggleDotStyle = (active: boolean): React.CSSProperties => ({
  width: '16px',
  height: '16px',
  borderRadius: '50%',
  background: '#FFF',
  position: 'absolute',
  top: '2px',
  left: active ? '18px' : '2px',
  transition: 'left 0.2s',
  boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
});

// ─── Component ──────────────────────────────────────────────────────────────

export function WidgetConfigPanel({
  config,
  onChange,
  onClose,
  isOpen,
  availableProviders = [],
}: WidgetConfigPanelProps) {
  const [activeTab, setActiveTab] = useState<ConfigTab>('general');

  if (!isOpen) return null;

  const Toggle = ({ value, onToggle }: { value: boolean; onToggle: (v: boolean) => void }) => (
    <button type="button" onClick={() => onToggle(!value)} style={toggleStyle(value)}>
      <div style={toggleDotStyle(value)} />
    </button>
  );

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      right: 0,
      width: '380px',
      height: '100vh',
      background: '#FFFFFF',
      borderLeft: '1px solid #E5E7EB',
      boxShadow: '-4px 0 24px rgba(0,0,0,0.08)',
      zIndex: 50,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '14px 20px',
        borderBottom: '1px solid #E5E7EB',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <h2 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#111827' }}>
          🛠️ Widget Properties
        </h2>
        <button
          onClick={onClose}
          style={{
            width: '28px', height: '28px', borderRadius: '6px',
            border: 'none', background: '#F3F4F6', cursor: 'pointer', fontSize: '14px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          ✕
        </button>
      </div>

      {/* Tab bar */}
      <div style={{
        display: 'flex', borderBottom: '1px solid #E5E7EB',
      }}>
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              flex: 1,
              padding: '10px 4px',
              border: 'none',
              background: 'transparent',
              color: activeTab === tab.key ? '#3B82F6' : '#9CA3AF',
              fontSize: '11px',
              fontWeight: activeTab === tab.key ? 600 : 400,
              cursor: 'pointer',
              borderBottom: activeTab === tab.key ? '2px solid #3B82F6' : '2px solid transparent',
              textAlign: 'center',
            }}
          >
            {tab.icon}<br />{tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: '16px 20px' }}>

        {/* ── General Tab ──────────────────────────────────────────── */}
        {activeTab === 'general' && (
          <>
            <div style={fieldStyle}>
              <label style={labelStyle}>Title</label>
              <input style={inputStyle} value={config.title} onChange={(e) => onChange({ title: e.target.value })} />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Subtitle</label>
              <input style={inputStyle} value={config.subtitle} onChange={(e) => onChange({ subtitle: e.target.value })} />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Description</label>
              <textarea style={{ ...inputStyle, minHeight: '60px', resize: 'vertical' }} value={config.description} onChange={(e) => onChange({ description: e.target.value })} />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Category</label>
              <select style={selectStyle} value={config.category} onChange={(e) => onChange({ category: e.target.value })}>
                <option value="safety">Safety</option>
                <option value="planning">Planning</option>
                <option value="execution">Execution</option>
                <option value="shutdown">Shutdown</option>
                <option value="workforce">Workforce</option>
                <option value="management">Management</option>
                <option value="custom">Custom</option>
              </select>
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Icon</label>
              <input style={inputStyle} value={config.icon} onChange={(e) => onChange({ icon: e.target.value })} placeholder="Emoji or icon class" />
            </div>
            <div style={{ ...fieldStyle, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <label style={{ ...labelStyle, marginBottom: 0 }}>Visible</label>
              <Toggle value={config.isVisible} onToggle={(v) => onChange({ isVisible: v })} />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Tags</label>
              <input style={inputStyle} value={config.tags.join(', ')} onChange={(e) => onChange({ tags: e.target.value.split(',').map((t) => t.trim()).filter(Boolean) })} placeholder="tag1, tag2, tag3" />
            </div>
          </>
        )}

        {/* ── Data Tab ─────────────────────────────────────────────── */}
        {activeTab === 'data' && (
          <>
            <div style={fieldStyle}>
              <label style={labelStyle}>Data Provider</label>
              <select style={selectStyle} value={config.providerKey} onChange={(e) => onChange({ providerKey: e.target.value })}>
                <option value="">Select provider...</option>
                {availableProviders.map((p) => (
                  <option key={p.key} value={p.key}>[{p.category}] {p.name}</option>
                ))}
              </select>
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Refresh Interval (sec)</label>
              <input style={inputStyle} type="number" min={0} value={config.refreshInterval} onChange={(e) => onChange({ refreshInterval: Number(e.target.value) })} />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Cache TTL (sec)</label>
              <input style={inputStyle} type="number" min={0} value={config.cacheTtlSeconds} onChange={(e) => onChange({ cacheTtlSeconds: Number(e.target.value) })} />
            </div>
            <div style={{ padding: '12px', background: '#F9FAFB', borderRadius: '8px', fontSize: '12px', color: '#6B7280' }}>
              <strong>Provider Parameters</strong>
              <p style={{ margin: '8px 0 0', fontSize: '11px' }}>
                Parameters are merged with Dashboard Variables at render time. Widget-specific params override dashboard variables.
              </p>
              <div style={{ marginTop: '8px' }}>
                {Object.entries(config.providerParams).map(([key, value]) => (
                  <div key={key} style={{ display: 'flex', gap: '6px', marginBottom: '6px', alignItems: 'center' }}>
                    <input style={{ ...inputStyle, width: '40%' }} value={key} readOnly />
                    <input style={{ ...inputStyle, width: '60%' }} value={String(value)} onChange={(e) => onChange({ providerParams: { ...config.providerParams, [key]: e.target.value } })} />
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* ── Visualization Tab ────────────────────────────────────── */}
        {activeTab === 'visualization' && (
          <>
            <div style={fieldStyle}>
              <label style={labelStyle}>Chart Type</label>
              <select style={selectStyle} value={config.visualizationType} onChange={(e) => onChange({ visualizationType: e.target.value as VisualizationType })}>
                {VIZ_TYPES.map((vt) => (
                  <option key={vt.value} value={vt.value}>{vt.label}</option>
                ))}
              </select>
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Color Override</label>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input type="color" value={config.colorOverride || '#3B82F6'} onChange={(e) => onChange({ colorOverride: e.target.value })} style={{ width: '36px', height: '36px', border: 'none', borderRadius: '6px', cursor: 'pointer' }} />
                <input style={inputStyle} value={config.colorOverride} onChange={(e) => onChange({ colorOverride: e.target.value })} placeholder="#3B82F6" />
              </div>
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Number Format</label>
              <select style={selectStyle} value={config.numberFormat} onChange={(e) => onChange({ numberFormat: e.target.value })}>
                <option value="">Default</option>
                <option value="0,0">1,000</option>
                <option value="0,0.0">1,000.0</option>
                <option value="0,0.00">1,000.00</option>
                <option value="0.0%">10.0%</option>
                <option value="0%">10%</option>
              </select>
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Date Format</label>
              <select style={selectStyle} value={config.dateFormat} onChange={(e) => onChange({ dateFormat: e.target.value })}>
                <option value="">Default</option>
                <option value="DD MMM YYYY">25 Jul 2026</option>
                <option value="YYYY-MM-DD">2026-07-25</option>
                <option value="DD/MM/YYYY">25/07/2026</option>
                <option value="MMM DD">Jul 25</option>
              </select>
            </div>

            {/* Thresholds */}
            <div style={{ padding: '12px', background: '#F9FAFB', borderRadius: '8px', marginTop: '8px' }}>
              <label style={labelStyle}>Thresholds</label>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '6px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ ...labelStyle, fontSize: '10px' }}>Warning</label>
                  <input style={inputStyle} type="number" value={config.thresholdConfig?.warning ?? ''} onChange={(e) => onChange({ thresholdConfig: { ...config.thresholdConfig, warning: Number(e.target.value), direction: config.thresholdConfig?.direction ?? 'above' } })} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ ...labelStyle, fontSize: '10px' }}>Danger</label>
                  <input style={inputStyle} type="number" value={config.thresholdConfig?.danger ?? ''} onChange={(e) => onChange({ thresholdConfig: { ...config.thresholdConfig, danger: Number(e.target.value), direction: config.thresholdConfig?.direction ?? 'above' } })} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ ...labelStyle, fontSize: '10px' }}>Target</label>
                  <input style={inputStyle} type="number" value={config.thresholdConfig?.target ?? ''} onChange={(e) => onChange({ thresholdConfig: { ...config.thresholdConfig, target: Number(e.target.value), direction: config.thresholdConfig?.direction ?? 'above' } })} />
                </div>
              </div>
              <div>
                <label style={{ ...labelStyle, fontSize: '10px' }}>Direction</label>
                <select style={selectStyle} value={config.thresholdConfig?.direction ?? 'above'} onChange={(e) => onChange({ thresholdConfig: { ...config.thresholdConfig, direction: e.target.value as 'above' | 'below' } })}>
                  <option value="above">Above = Bad</option>
                  <option value="below">Below = Bad</option>
                </select>
              </div>
            </div>
          </>
        )}

        {/* ── Interaction Tab ──────────────────────────────────────── */}
        {activeTab === 'interaction' && (
          <>
            <div style={{ ...fieldStyle, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <label style={{ ...labelStyle, marginBottom: 0 }}>Enable Drill-down</label>
              <Toggle value={config.drilldownEnabled} onToggle={(v) => onChange({ drilldownEnabled: v })} />
            </div>
            <div style={{ ...fieldStyle, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <label style={{ ...labelStyle, marginBottom: 0 }}>Enable Cross-Filter</label>
              <Toggle value={config.crossFilterEnabled} onToggle={(v) => onChange({ crossFilterEnabled: v })} />
            </div>
            {config.crossFilterEnabled && (
              <div style={fieldStyle}>
                <label style={labelStyle}>Cross-Filter Field</label>
                <input style={inputStyle} value={config.crossFilterField} onChange={(e) => onChange({ crossFilterField: e.target.value })} placeholder="e.g., contractor_id" />
              </div>
            )}
            <div style={fieldStyle}>
              <label style={labelStyle}>Click Action</label>
              <select style={selectStyle} value={config.clickAction} onChange={(e) => onChange({ clickAction: e.target.value })}>
                {CLICK_ACTIONS.map((a) => (
                  <option key={a.value} value={a.value}>{a.label}</option>
                ))}
              </select>
            </div>
            {(config.clickAction.startsWith('open_') || config.clickAction === 'navigate') && (
              <div style={fieldStyle}>
                <label style={labelStyle}>Deep Link Target</label>
                <input style={inputStyle} value={config.deepLinkTarget} onChange={(e) => onChange({ deepLinkTarget: e.target.value })} placeholder="URL or entity field" />
              </div>
            )}
            <div style={{ padding: '12px', background: '#F9FAFB', borderRadius: '8px', fontSize: '11px', color: '#6B7280' }}>
              <strong>Drill-down Hierarchy</strong>
              <p style={{ margin: '6px 0 0' }}>
                Company → Site → Unit → Area → System → Equipment → Workpack → Activity → Certificate → Drawing → Issue → Photos
              </p>
            </div>
          </>
        )}

        {/* ── Export Tab ───────────────────────────────────────────── */}
        {activeTab === 'export' && (
          <>
            {[
              { key: 'includeInPdf', label: 'Include in PDF Export' },
              { key: 'includeInExcel', label: 'Include in Excel Export' },
              { key: 'includeInCsv', label: 'Include in CSV Export' },
              { key: 'includeInSnapshot', label: 'Include in Dashboard Snapshot' },
            ].map(({ key, label }) => (
              <div key={key} style={{ ...fieldStyle, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <label style={{ ...labelStyle, marginBottom: 0 }}>{label}</label>
                <Toggle value={(config as any)[key]} onToggle={(v) => onChange({ [key]: v })} />
              </div>
            ))}
            <div style={{ padding: '12px', background: '#F9FAFB', borderRadius: '8px', fontSize: '11px', color: '#6B7280', marginTop: '8px' }}>
              <strong>Export uses existing Report Engine</strong>
              <p style={{ margin: '6px 0 0' }}>
                PDF/Excel/CSV exports are rendered via the Report Engine with BrandingService applied. Scheduled exports use the Notification Platform.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
