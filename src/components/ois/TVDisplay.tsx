/**
 * M7.6D — TV Display Component
 *
 * Fullscreen TV renderer with company branding header,
 * clock, shift indicator, auto-rotation, emergency banner.
 */

'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { DashboardGrid } from '@/components/ois/DashboardGrid';
import type { WidgetData } from '@/core/ois/WidgetSDK';

interface TVDisplayProps {
  sessionCode: string;
  dashboardName: string;
  organizationName: string;
  brandingLogo?: string;
  brandingColor?: string;
  theme: 'light' | 'dark';
  autoRotateIntervalSec: number;
  pages: Array<{
    title: string;
    widgets: Array<{
      id: string;
      title: string;
      icon?: string;
      visualizationType: string;
      config: Record<string, any>;
      data: WidgetData;
      gridX: number;
      gridY: number;
      gridW: number;
      gridH: number;
    }>;
  }>;
  orientation: 'landscape' | 'portrait';
  emergencyBanner?: string;
  showQR: boolean;
}

export function TVDisplay({
  sessionCode,
  dashboardName,
  organizationName,
  brandingLogo,
  brandingColor = '#1E40AF',
  theme,
  autoRotateIntervalSec,
  pages,
  orientation,
  emergencyBanner,
  showQR,
}: TVDisplayProps) {
  const [currentPage, setCurrentPage] = useState(0);
  const [clock, setClock] = useState(new Date());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Clock
  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Auto-rotation
  useEffect(() => {
    if (autoRotateIntervalSec > 0 && pages.length > 1) {
      timerRef.current = setInterval(() => {
        setCurrentPage((prev) => (prev + 1) % pages.length);
      }, autoRotateIntervalSec * 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [autoRotateIntervalSec, pages.length]);

  const isDark = theme === 'dark';
  const bg = isDark ? '#0F172A' : '#F8FAFC';
  const textColor = isDark ? '#E2E8F0' : '#1E293B';
  const headerBg = brandingColor;
  const currentShift = clock.getHours() >= 6 && clock.getHours() < 18 ? '☀️ Day Shift' : '🌙 Night Shift';
  const page = pages[currentPage];

  // Fullscreen on mount
  useEffect(() => {
    const el = document.documentElement;
    if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
  }, []);

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      background: bg,
      color: textColor,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      fontFamily: 'Inter, system-ui, sans-serif',
    }}>
      {/* Emergency Banner */}
      {emergencyBanner && (
        <div style={{
          background: '#DC2626',
          color: '#FFF',
          padding: '8px 24px',
          textAlign: 'center',
          fontWeight: 700,
          fontSize: '16px',
          animation: 'pulse 2s infinite',
        }}>
          ⚠️ {emergencyBanner}
        </div>
      )}

      {/* Header */}
      <div style={{
        background: `linear-gradient(135deg, ${headerBg}, ${headerBg}dd)`,
        color: '#FFF',
        padding: '12px 32px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        minHeight: '64px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {brandingLogo && (
            <img src={brandingLogo} alt={organizationName} style={{ height: '40px', objectFit: 'contain' }} />
          )}
          <div>
            <div style={{ fontSize: '18px', fontWeight: 700 }}>{dashboardName}</div>
            <div style={{ fontSize: '12px', opacity: 0.8 }}>{organizationName}</div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '24px', fontSize: '14px' }}>
          <div>{currentShift}</div>
          <div style={{ fontSize: '24px', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
            {clock.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </div>
          <div style={{ fontSize: '12px', opacity: 0.7 }}>
            {clock.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
          </div>
        </div>
      </div>

      {/* Page indicator */}
      {pages.length > 1 && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          padding: '8px',
          background: isDark ? '#1E293B' : '#F1F5F9',
        }}>
          {pages.map((p, i) => (
            <div
              key={i}
              onClick={() => setCurrentPage(i)}
              style={{
                width: i === currentPage ? '24px' : '8px',
                height: '8px',
                borderRadius: '4px',
                background: i === currentPage ? brandingColor : (isDark ? '#475569' : '#CBD5E1'),
                transition: 'all 0.3s',
                cursor: 'pointer',
              }}
            />
          ))}
          <span style={{ fontSize: '11px', color: isDark ? '#94A3B8' : '#64748B', marginLeft: '12px' }}>
            {page?.title ?? ''} ({currentPage + 1}/{pages.length})
          </span>
        </div>
      )}

      {/* Dashboard Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: '16px 24px' }}>
        {page && (
          <DashboardGrid
            widgets={page.widgets}
            gridColumns={orientation === 'portrait' ? 8 : 16}
            gridRowHeight={orientation === 'portrait' ? 60 : 80}
          />
        )}
      </div>

      {/* Footer */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 32px',
        background: isDark ? '#1E293B' : '#F1F5F9',
        fontSize: '11px',
        color: isDark ? '#94A3B8' : '#64748B',
      }}>
        <div>Session: {sessionCode}</div>
        {showQR && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            📱 Scan QR to join
          </div>
        )}
        <div>Auto-refresh: {autoRotateIntervalSec}s</div>
      </div>
    </div>
  );
}
