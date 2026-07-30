/**
 * M7.6D — Meeting Mode Page
 *
 * Route: /ois/meeting/[dashboardId]
 * Presenter view with live dashboard + meeting panel sidebar.
 * Snapshot before meeting, action register, notes, export minutes.
 */

'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { DashboardGrid } from '@/components/ois/DashboardGrid';
import { MeetingPanel } from '@/components/ois/MeetingPanel';
import { DashboardVariableBar } from '@/components/ois/DashboardVariableBar';
import { DashboardVariableService } from '@/core/ois/DashboardVariableService';
import type { WidgetData } from '@/core/ois/WidgetSDK';

export default function MeetingModePage({ params }: { params: { dashboardId: string } }) {
  const [dashboard, setDashboard] = useState<any>(null);
  const [widgetData, setWidgetData] = useState<Record<string, WidgetData>>({});
  const [loading, setLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [meetingId] = useState(`meeting_${Date.now()}`);
  const variableService = useMemo(() => new DashboardVariableService(), []);

  useEffect(() => {
    const fetch_ = async () => {
      try {
        const res = await fetch(`/api/ois/dashboards/${params.dashboardId}?include=widgets`);
        if (res.ok) {
          const json = await res.json();
          setDashboard(json.data);
        }
      } catch { /* ignore */ }
      setLoading(false);
    };
    fetch_();
  }, [params.dashboardId]);

  // Take snapshot before meeting
  useEffect(() => {
    if (!dashboard) return;
    fetch(`/api/ois/dashboards/${params.dashboardId}/export`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ format: 'pdf', exportedBy: 'meeting_mode', metadata: { meetingId, type: 'pre_meeting_snapshot' } }),
    }).catch(() => {});
  }, [dashboard, params.dashboardId, meetingId]);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  }, []);

  const handleExportMinutes = useCallback(async () => {
    try {
      await fetch(`/api/ois/meetings/${meetingId}/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dashboardId: params.dashboardId, format: 'pdf' }),
      });
    } catch { /* ignore */ }
  }, [meetingId, params.dashboardId]);

  const handleEmailMinutes = useCallback(async () => {
    try {
      await fetch(`/api/ois/meetings/${meetingId}/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dashboardId: params.dashboardId, format: 'pdf', sendEmail: true }),
      });
    } catch { /* ignore */ }
  }, [meetingId, params.dashboardId]);

  const handleCompare = useCallback((type: 'previous_shift' | 'previous_day') => {
    console.log('Compare:', type);
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#F8FAFC' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>📋</div>
          <div style={{ fontSize: '15px', color: '#6B7280' }}>Preparing Meeting Mode...</div>
        </div>
      </div>
    );
  }

  if (!dashboard) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <div style={{ color: '#EF4444' }}>Dashboard not found</div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* Main Content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Meeting Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 24px',
          background: '#1E293B',
          color: '#FFF',
        }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>
              📋 {dashboard.name} — Meeting Mode
            </h1>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <div style={{ fontSize: '20px', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
              {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
            <button
              onClick={toggleFullscreen}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                border: '1px solid #475569',
                background: 'transparent',
                color: '#94A3B8',
                fontSize: '12px',
                cursor: 'pointer',
              }}
            >
              {isFullscreen ? '⊡ Exit' : '⊞ Fullscreen'}
            </button>
          </div>
        </div>

        {/* Variable Bar */}
        <DashboardVariableBar
          variableService={variableService}
          organizationId={dashboard.organization_id}
        />

        {/* Dashboard */}
        <div style={{ flex: 1, overflow: 'auto', padding: '16px 24px' }}>
          <DashboardGrid
            widgets={(dashboard.widgets ?? []).map((w: any) => ({
              id: w.id,
              title: w.title_override ?? w.widget_definition?.name ?? 'Widget',
              icon: w.widget_definition?.icon,
              visualizationType: w.widget_definition?.visualization_type ?? 'kpi_card',
              config: { ...w.widget_definition?.default_config, ...w.visualization_config },
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

      {/* Meeting Panel Sidebar */}
      <MeetingPanel
        meetingId={meetingId}
        dashboardId={params.dashboardId}
        onExportMinutes={handleExportMinutes}
        onEmailMinutes={handleEmailMinutes}
        onCompare={handleCompare}
      />
    </div>
  );
}
