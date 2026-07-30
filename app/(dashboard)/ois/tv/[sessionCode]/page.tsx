/**
 * M7.6D — TV Mode Page
 *
 * Route: /ois/tv/[sessionCode]
 * Fullscreen TV display with auto-rotation, branding, clock.
 */

'use client';

import React, { useEffect, useState } from 'react';
import { TVDisplay } from '@/components/ois/TVDisplay';
import type { WidgetData } from '@/core/ois/WidgetSDK';

export default function TVModePage({ params }: { params: { sessionCode: string } }) {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [breEmergencyBanner, setBreEmergencyBanner] = useState<string | null>(null);

  useEffect(() => {
    const fetchSession = async () => {
      try {
        const res = await fetch(`/api/ois/tv/${params.sessionCode}`);
        if (!res.ok) throw new Error(`Session not found: ${res.status}`);
        const json = await res.json();
        setSession(json.data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchSession();

    // Periodic refresh
    const interval = setInterval(fetchSession, 60000);
    return () => clearInterval(interval);
  }, [params.sessionCode]);

  // BRE emergency banner polling (every 15s)
  useEffect(() => {
    const fetchBanner = async () => {
      try {
        const res = await fetch('/api/bre/alerts?action=emergency_banner');
        if (res.ok) {
          const data = await res.json();
          setBreEmergencyBanner(data.banner ?? null);
        }
      } catch { /* non-critical */ }
    };
    fetchBanner();
    const interval = setInterval(fetchBanner, 15000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0F172A', color: '#94A3B8' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '64px', marginBottom: '16px' }}>📺</div>
          <div style={{ fontSize: '18px' }}>Connecting to TV Session...</div>
          <div style={{ fontSize: '14px', marginTop: '8px', opacity: 0.7 }}>Code: {params.sessionCode}</div>
        </div>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0F172A', color: '#FFF' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '64px', marginBottom: '16px' }}>📡</div>
          <div style={{ fontSize: '18px', color: '#EF4444', marginBottom: '8px' }}>Session Not Found</div>
          <div style={{ fontSize: '14px', color: '#94A3B8' }}>Code "{params.sessionCode}" is invalid or expired.</div>
        </div>
      </div>
    );
  }

  // Build pages from session data
  const pages = (session.dashboard?.pages ?? [{ title: 'Main', widgets: session.dashboard?.widgets ?? [] }]).map((p: any) => ({
    title: p.title ?? 'Dashboard',
    widgets: (p.widgets ?? session.dashboard?.widgets ?? []).map((w: any) => ({
      id: w.id,
      title: w.title_override ?? w.widget_definition?.name ?? 'Widget',
      icon: w.widget_definition?.icon,
      visualizationType: w.widget_definition?.visualization_type ?? 'kpi_card',
      config: { ...w.widget_definition?.default_config, ...w.visualization_config },
      data: { loading: false, kpis: [], rows: [] } as WidgetData,
      gridX: w.grid_x ?? 0,
      gridY: w.grid_y ?? 0,
      gridW: w.grid_w ?? 3,
      gridH: w.grid_h ?? 3,
    })),
  }));

  return (
    <TVDisplay
      sessionCode={params.sessionCode}
      dashboardName={session.dashboard?.name ?? 'Dashboard'}
      organizationName={session.organizationName ?? ''}
      brandingLogo={session.brandingLogo}
      brandingColor={session.brandingColor ?? '#1E40AF'}
      theme={session.theme ?? 'dark'}
      autoRotateIntervalSec={session.rotation_interval_sec ?? 30}
      pages={pages}
      orientation={session.orientation ?? 'landscape'}
      emergencyBanner={breEmergencyBanner ?? session.emergency_banner}
      showQR={session.show_qr ?? true}
    />
  );
}
