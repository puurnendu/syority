/**
 * M7.6D — Dashboard Builder Page
 *
 * Route: /ois/builder/[dashboardId]
 * Loads dashboard data and renders the DashboardDesigner.
 */

'use client';

import React, { useEffect, useState } from 'react';
import { DashboardDesigner } from '@/components/ois/DashboardDesigner';
import type { WidgetLayout } from '@/core/ois/DesignerStateManager';

interface DashboardData {
  id: string;
  name: string;
  organization_id: string;
  pages: Array<{ id: string; title: string; page_number: number; icon?: string }>;
  widgets: Array<{
    id: string;
    widget_definition_id: string;
    page_id: string | null;
    grid_x: number;
    grid_y: number;
    grid_w: number;
    grid_h: number;
    z_index: number;
    is_locked: boolean;
    is_visible: boolean;
    group_id: string | null;
    widget_definition: {
      slug: string;
    };
  }>;
}

export default function DashboardBuilderPage({ params }: { params: { dashboardId: string } }) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const res = await fetch(`/api/ois/dashboards/${params.dashboardId}?include=widgets,pages`);
        if (!res.ok) throw new Error(`Failed to load dashboard: ${res.status}`);
        const json = await res.json();
        setData(json.data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboard();
  }, [params.dashboardId]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#F3F4F6' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px', animation: 'spin 1s linear infinite' }}>⚙️</div>
          <div style={{ fontSize: '15px', color: '#6B7280', fontWeight: 500 }}>Loading Dashboard Designer...</div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#F3F4F6' }}>
        <div style={{ textAlign: 'center', padding: '40px', background: '#FFF', borderRadius: '12px', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
          <div style={{ fontSize: '16px', fontWeight: 600, color: '#DC2626', marginBottom: '8px' }}>Failed to Load</div>
          <div style={{ fontSize: '13px', color: '#6B7280' }}>{error ?? 'Dashboard not found'}</div>
        </div>
      </div>
    );
  }

  // Convert DB widgets to WidgetLayout[]
  const layouts: WidgetLayout[] = (data.widgets ?? []).map((w) => ({
    id: `w_${w.id}`,
    x: w.grid_x,
    y: w.grid_y,
    w: w.grid_w,
    h: w.grid_h,
    zIndex: w.z_index ?? 1,
    isLocked: w.is_locked ?? false,
    isVisible: w.is_visible ?? true,
    groupId: w.group_id ?? null,
    widgetDefinitionSlug: w.widget_definition?.slug ?? '',
    widgetInstanceId: w.id,
    pageId: w.page_id ?? data.pages?.[0]?.id ?? 'page_default',
  }));

  const pages = (data.pages ?? []).length > 0
    ? data.pages.map((p) => ({
        id: p.id,
        title: p.title,
        pageNumber: p.page_number,
        icon: p.icon,
      }))
    : [{ id: 'page_default', title: 'Main', pageNumber: 1 }];

  return (
    <DashboardDesigner
      dashboardId={params.dashboardId}
      dashboardName={data.name}
      organizationId={data.organization_id}
      userId="" // filled by session in production
      initialLayouts={layouts}
      initialPages={pages}
    />
  );
}
