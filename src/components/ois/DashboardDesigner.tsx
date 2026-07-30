/**
 * M7.6D — Dashboard Designer
 *
 * Main designer layout assembling:
 * - DesignerToolbar (top)
 * - DashboardPageBar (below toolbar)
 * - DashboardVariableBar (filter bar)
 * - WidgetPalette (left sidebar)
 * - DesignerCanvas (center)
 * - WidgetConfigPanel (right sidebar)
 *
 * Integrates DesignerStateManager, CrossFilterEngine, DashboardVariableService.
 */

'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DesignerStateManager, type WidgetLayout } from '@/core/ois/DesignerStateManager';
import { CrossFilterEngine } from '@/core/ois/CrossFilterEngine';
import { DashboardVariableService } from '@/core/ois/DashboardVariableService';
import { DesignerToolbar } from './DesignerToolbar';
import { DesignerCanvas } from './DesignerCanvas';
import { WidgetPalette } from './WidgetPalette';
import { WidgetConfigPanel } from './WidgetConfigPanel';
import { DashboardPageBar } from './DashboardPageBar';
import { DashboardVariableBar } from './DashboardVariableBar';
import type { WidgetData } from '@/core/ois/WidgetSDK';

// ─── Types ──────────────────────────────────────────────────────────────────

interface DashboardDesignerProps {
  dashboardId: string;
  dashboardName: string;
  organizationId: string;
  userId: string;
  initialLayouts?: WidgetLayout[];
  initialPages?: Array<{ id: string; title: string; pageNumber: number; icon?: string }>;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function DashboardDesigner({
  dashboardId,
  dashboardName,
  organizationId,
  userId,
  initialLayouts = [],
  initialPages = [{ id: 'page_default', title: 'Main', pageNumber: 1 }],
}: DashboardDesignerProps) {
  // ── Core State Managers ─────────────────────────────────────────────────
  const designer = useMemo(() => new DesignerStateManager(), []);
  const crossFilter = useMemo(() => new CrossFilterEngine(), []);
  const variableService = useMemo(() => new DashboardVariableService(), []);

  // ── UI State ────────────────────────────────────────────────────────────
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [selectedWidgetConfig, setSelectedWidgetConfig] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [widgetData, setWidgetData] = useState<Record<string, WidgetData>>({});
  const [widgetMeta, setWidgetMeta] = useState<Record<string, any>>({});
  const [providers, setProviders] = useState<Array<{ key: string; name: string; category: string }>>([]);

  // ── Initialize ──────────────────────────────────────────────────────────

  useEffect(() => {
    designer.initialize({
      layouts: initialLayouts,
      pages: initialPages,
    });

    // Start autosave
    designer.startAutosave(handleSave);

    return () => {
      designer.destroy();
      crossFilter.destroy();
      variableService.destroy();
    };
  }, [dashboardId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch widget definitions for the palette
  useEffect(() => {
    const fetchWidgetDefs = async () => {
      try {
        const res = await fetch(`/api/ois/widgets?orgId=${organizationId}`);
        if (res.ok) {
          const data = await res.json();
          const meta: Record<string, any> = {};
          (data.data ?? []).forEach((w: any) => {
            meta[w.slug] = {
              name: w.name,
              icon: w.icon,
              visualizationType: w.visualization_type,
              defaultConfig: w.default_config,
            };
          });
          setWidgetMeta(meta);
        }
      } catch { /* ignore */ }
    };
    fetchWidgetDefs();
  }, [organizationId]);

  // ── Save Handler ────────────────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      const layouts = designer.toLayoutUpdates();
      await fetch(`/api/ois/dashboards/${dashboardId}/layout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ layouts }),
      });
      designer.markClean();
    } catch (err) {
      console.error('Failed to save dashboard layout:', err);
    } finally {
      setIsSaving(false);
    }
  }, [dashboardId, designer]);

  // ── Publish Handler ─────────────────────────────────────────────────────

  const handlePublish = useCallback(async () => {
    await handleSave();
    try {
      await fetch(`/api/ois/dashboards/${dashboardId}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'publish', publishedBy: userId }),
      });
    } catch (err) {
      console.error('Failed to publish dashboard:', err);
    }
  }, [dashboardId, userId, handleSave]);

  // ── Add Widget Handler ──────────────────────────────────────────────────

  const handleAddWidget = useCallback((slug: string) => {
    const meta = widgetMeta[slug];
    if (!meta) return;

    designer.addWidget({
      id: `w_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      x: 0,
      y: 0,
      w: 3,
      h: 3,
      minW: 1,
      minH: 1,
      widgetDefinitionSlug: slug,
      widgetInstanceId: '', // Created on save
      pageId: designer.getActivePage(),
    });

    setPaletteOpen(false);
  }, [designer, widgetMeta]);

  // ── Widget Click → Open Config Panel ────────────────────────────────────

  const handleWidgetClick = useCallback((widgetId: string) => {
    const layout = designer.getLayout(widgetId);
    if (!layout) return;

    designer.select(widgetId);
    const meta = widgetMeta[layout.widgetDefinitionSlug];

    setSelectedWidgetConfig({
      id: widgetId,
      widgetDefinitionSlug: layout.widgetDefinitionSlug,
      title: meta?.name ?? 'Widget',
      subtitle: '',
      description: meta?.description ?? '',
      category: meta?.category ?? 'custom',
      icon: meta?.icon ?? '📊',
      isVisible: layout.isVisible,
      tags: [],
      providerKey: meta?.providerKey ?? '',
      providerParams: {},
      refreshInterval: 300,
      cacheTtlSeconds: 300,
      visualizationType: meta?.visualizationType ?? 'kpi_card',
      visualizationConfig: meta?.defaultConfig ?? {},
      thresholdConfig: undefined,
      numberFormat: '',
      dateFormat: '',
      colorOverride: '',
      drilldownEnabled: false,
      crossFilterEnabled: false,
      crossFilterField: '',
      clickAction: '',
      deepLinkTarget: '',
      includeInPdf: true,
      includeInExcel: true,
      includeInCsv: true,
      includeInSnapshot: true,
    });
    setConfigOpen(true);
  }, [designer, widgetMeta]);

  const handleConfigChange = useCallback((patch: any) => {
    setSelectedWidgetConfig((prev: any) => prev ? { ...prev, ...patch } : null);
  }, []);

  // ── Preview Handler ─────────────────────────────────────────────────────

  const handlePreview = useCallback(() => {
    window.open(`/ois/view/${dashboardId}`, '_blank');
  }, [dashboardId]);

  // ── Export Handler ──────────────────────────────────────────────────────

  const handleExport = useCallback(async () => {
    try {
      await fetch(`/api/ois/dashboards/${dashboardId}/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ format: 'pdf', exportedBy: userId }),
      });
    } catch (err) {
      console.error('Failed to export dashboard:', err);
    }
  }, [dashboardId, userId]);

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      background: '#F3F4F6',
      overflow: 'hidden',
    }}>
      {/* Toolbar */}
      <DesignerToolbar
        designer={designer}
        onSave={handleSave}
        onPublish={handlePublish}
        onAddWidget={() => setPaletteOpen(!paletteOpen)}
        onPreview={handlePreview}
        onExport={handleExport}
        isSaving={isSaving}
        dashboardName={dashboardName}
      />

      {/* Page bar */}
      <DashboardPageBar designer={designer} />

      {/* Variable bar */}
      <DashboardVariableBar
        variableService={variableService}
        organizationId={organizationId}
      />

      {/* Main area */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Widget Palette (left sidebar) */}
        {paletteOpen && (
          <div style={{
            width: '300px',
            borderRight: '1px solid #E5E7EB',
            background: '#FFF',
            overflow: 'auto',
          }}>
            <WidgetPalette
              onSelect={handleAddWidget}
              organizationId={organizationId}
            />
          </div>
        )}

        {/* Canvas */}
        <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
          <DesignerCanvas
            designer={designer}
            widgetData={widgetData}
            widgetMeta={widgetMeta}
            onWidgetClick={handleWidgetClick}
            onWidgetDoubleClick={(id) => {
              handleWidgetClick(id);
              setConfigOpen(true);
            }}
          />
        </div>
      </div>

      {/* Widget Config Panel (right sidebar) */}
      {selectedWidgetConfig && (
        <WidgetConfigPanel
          config={selectedWidgetConfig}
          onChange={handleConfigChange}
          onClose={() => { setConfigOpen(false); setSelectedWidgetConfig(null); }}
          isOpen={configOpen}
          availableProviders={providers}
        />
      )}
    </div>
  );
}
