/**
 * M7.6D — Dashboard Viewer Page
 *
 * Route: /ois/view/[dashboardId]
 * Read-only dashboard with live data, variable bar, cross-filtering.
 */

'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { DashboardGrid } from '@/components/ois/DashboardGrid';
import { DashboardVariableBar } from '@/components/ois/DashboardVariableBar';
import { CrossFilterBreadcrumb } from '@/components/ois/CrossFilterBreadcrumb';
import { DashboardVariableService } from '@/core/ois/DashboardVariableService';
import { CrossFilterEngine } from '@/core/ois/CrossFilterEngine';
import type { WidgetData } from '@/core/ois/WidgetSDK';

interface DashboardViewerData {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  organization_id: string;
  theme: string;
  layout_config: Record<string, any>;
  widgets: Array<{
    id: string;
    widget_definition_id: string;
    grid_x: number;
    grid_y: number;
    grid_w: number;
    grid_h: number;
    title_override: string | null;
    subtitle: string | null;
    provider_params: Record<string, any>;
    visualization_config: Record<string, any>;
    widget_definition: {
      slug: string;
      name: string;
      icon: string;
      provider_key: string;
      visualization_type: string;
      default_config: Record<string, any>;
      refresh_interval: number;
    };
  }>;
}

export default function DashboardViewerPage({ params }: { params: { dashboardId: string } }) {
  const [dashboard, setDashboard] = useState<DashboardViewerData | null>(null);
  const [widgetData, setWidgetData] = useState<Record<string, WidgetData>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const variableService = useMemo(() => new DashboardVariableService(), []);
  const crossFilter = useMemo(() => new CrossFilterEngine(), []);

  // Load dashboard
  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const res = await fetch(`/api/ois/dashboards/${params.dashboardId}?include=widgets`);
        if (!res.ok) throw new Error(`Failed to load: ${res.status}`);
        const json = await res.json();
        setDashboard(json.data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboard();
  }, [params.dashboardId]);

  // Fetch widget data
  const fetchWidgetData = useCallback(async () => {
    if (!dashboard) return;

    const variableParams = variableService.resolveParams();
    const crossFilterParams = crossFilter.getDrilldownParams();

    const newData: Record<string, WidgetData> = {};

    await Promise.allSettled(
      dashboard.widgets.map(async (widget) => {
        const mergedParams = {
          ...variableParams,
          ...crossFilterParams,
          ...widget.provider_params,
        };
        try {
          const res = await fetch(
            `/api/ois/widgets/${widget.widget_definition.slug}/data?` +
            new URLSearchParams({
              orgId: dashboard.organization_id,
              ...Object.fromEntries(Object.entries(mergedParams).filter(([, v]) => v != null).map(([k, v]) => [k, String(v)])),
            }).toString()
          );
          if (res.ok) {
            const json = await res.json();
            newData[widget.id] = { loading: false, ...json.data };
          } else {
            newData[widget.id] = { loading: false, error: `HTTP ${res.status}` };
          }
        } catch (err: any) {
          newData[widget.id] = { loading: false, error: err.message };
        }
      })
    );

    setWidgetData(newData);
  }, [dashboard, variableService, crossFilter]);

  useEffect(() => {
    fetchWidgetData();
  }, [fetchWidgetData]);

  // Subscribe to variable changes to refetch
  useEffect(() => {
    return variableService.subscribe(() => {
      fetchWidgetData();
    });
  }, [variableService, fetchWidgetData]);

  // Subscribe to cross-filter changes
  useEffect(() => {
    return crossFilter.subscribe(() => {
      fetchWidgetData();
    });
  }, [crossFilter, fetchWidgetData]);

  // Auto-refresh
  useEffect(() => {
    if (!dashboard) return;
    const minInterval = Math.min(
      300,
      ...dashboard.widgets.map((w) => w.widget_definition.refresh_interval || 300)
    );
    const timer = setInterval(fetchWidgetData, minInterval * 1000);
    return () => clearInterval(timer);
  }, [dashboard, fetchWidgetData]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0F172A' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>📊</div>
          <div style={{ color: '#94A3B8', fontSize: '14px' }}>Loading Dashboard...</div>
        </div>
      </div>
    );
  }

  if (error || !dashboard) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0F172A' }}>
        <div style={{ color: '#EF4444', textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
          <div>{error ?? 'Dashboard not found'}</div>
        </div>
      </div>
    );
  }

  const isDark = dashboard.theme === 'dark';

  return (
    <div style={{
      minHeight: '100vh',
      background: isDark ? '#0F172A' : '#F8FAFC',
      color: isDark ? '#E2E8F0' : '#1E293B',
    }}>
      {/* Header */}
      <div style={{
        padding: '16px 24px',
        borderBottom: `1px solid ${isDark ? '#1E293B' : '#E2E8F0'}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 700 }}>
            {dashboard.icon && <span style={{ marginRight: '8px' }}>{dashboard.icon}</span>}
            {dashboard.name}
          </h1>
          {dashboard.description && (
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: isDark ? '#94A3B8' : '#64748B' }}>
              {dashboard.description}
            </p>
          )}
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => window.open(`/ois/builder/${dashboard.id}`, '_self')}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              border: `1px solid ${isDark ? '#334155' : '#E2E8F0'}`,
              background: 'transparent',
              color: isDark ? '#94A3B8' : '#64748B',
              fontSize: '12px',
              cursor: 'pointer',
            }}
          >
            ✏️ Edit
          </button>
          <button
            onClick={fetchWidgetData}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              border: `1px solid ${isDark ? '#334155' : '#E2E8F0'}`,
              background: 'transparent',
              color: isDark ? '#94A3B8' : '#64748B',
              fontSize: '12px',
              cursor: 'pointer',
            }}
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* Variable bar */}
      <DashboardVariableBar
        variableService={variableService}
        organizationId={dashboard.organization_id}
      />

      {/* Cross-filter breadcrumb */}
      <CrossFilterBreadcrumb crossFilter={crossFilter} />

      {/* Dashboard Grid */}
      <div style={{ padding: '16px 24px' }}>
        <DashboardGrid
          widgets={dashboard.widgets.map((w) => ({
            id: w.id,
            title: w.title_override ?? w.widget_definition.name,
            icon: w.widget_definition.icon,
            visualizationType: w.widget_definition.visualization_type,
            config: { ...w.widget_definition.default_config, ...w.visualization_config },
            data: widgetData[w.id] ?? { loading: true },
            gridX: w.grid_x,
            gridY: w.grid_y,
            gridW: w.grid_w,
            gridH: w.grid_h,
          }))}
          gridColumns={12}
          gridRowHeight={80}
        />
      </div>
    </div>
  );
}
