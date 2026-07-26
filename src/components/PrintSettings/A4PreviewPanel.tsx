'use client';

import { useRef, useState, useEffect } from 'react';
import { resolveVariables, getSampleWorkpack } from '@/lib/printVariables';
import type { HeaderFooterZones, ZoneItem } from '@/types/printSettings.types';

const A4_WIDTH_PX = 794;
const A4_HEIGHT_PX = 1123;

type Settings = {
  cover_show?: boolean;
  cover_image_path?: string | null;
  cover_image_opacity?: number;
  cover_title_variable?: string;
  cover_subtitle_variable?: string;
  cover_accent_color?: string;
  cover_bg_color?: string;
  header_bg_color?: string;
  header_text_color?: string;
  header_height_mm?: number;
  header_show_border?: boolean;
  header_border_color?: string;
  footer_bg_color?: string;
  footer_text_color?: string;
  footer_height_mm?: number;
  footer_show_border?: boolean;
  footer_border_color?: string;
};

export type ScaleMode = 'fit' | '75' | '100';

function getAbsoluteImageUrl(url: string | undefined | null): string {
  if (!url) return '';
  if (typeof window !== 'undefined' && url.startsWith('/')) {
    return `${window.location.origin}${url}`;
  }
  return url;
}

type Props = {
  headerZones: HeaderFooterZones;
  footerZones: HeaderFooterZones;
  settings: Settings;
  coverImageUrl: string | null;
  orgName: string;
  orgLogoUrl?: string | null;
  previewPage: 1 | 2;
  scaleMode: ScaleMode;
  onPreviewPageChange?: (page: 1 | 2) => void;
  onScaleModeChange?: (mode: ScaleMode) => void;
};

function resolveItemContent(item: ZoneItem, sample: Record<string, unknown>, page: string, total: string): string {
  if (item.type === 'text') return item.text ?? '';
  if (item.type === 'variable') {
    return resolveVariables(
      item.variableCode ?? '',
      sample as Parameters<typeof resolveVariables>[1],
      parseInt(page, 10),
      parseInt(total, 10)
    );
  }
  return '';
}

export function A4PreviewPanel({
  headerZones,
  footerZones,
  settings,
  coverImageUrl,
  orgName,
  orgLogoUrl,
  previewPage,
  scaleMode,
  onPreviewPageChange,
  onScaleModeChange,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [fitScale, setFitScale] = useState(1);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width: containerWidth, height: containerHeight } = entry.contentRect;
        const scaleByWidth = (containerWidth - 48) / A4_WIDTH_PX;
        const scaleByHeight = (containerHeight - 48) / A4_HEIGHT_PX;
        const newFitScale = Math.min(scaleByWidth, scaleByHeight, 1);
        setFitScale(newFitScale);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const currentScale =
    scaleMode === 'fit' ? fitScale :
    scaleMode === '75' ? 0.75 : 1;
  const scaledHeight = A4_HEIGHT_PX * currentScale;

  const sample = getSampleWorkpack(orgName, '2', '24');
  const page = previewPage.toString();
  const total = '24';
  const mmToPx = (mm: number) => (mm / 25.4) * 96;
  const headerHeightPx = mmToPx(settings.header_height_mm ?? 18);
  const footerHeightPx = mmToPx(settings.footer_height_mm ?? 12);

  const renderZoneItems = (items: ZoneItem[], align: 'left' | 'center' | 'right') => (
    <div
      className="flex flex-col gap-0.5"
      style={{
        flex: 1,
        alignItems: align === 'left' ? 'flex-start' : align === 'right' ? 'flex-end' : 'center',
        textAlign: align,
        overflow: 'hidden',
      }}
    >
      {items.map((item) => {
        if (item.type === 'image') {
          const logoUrl = item.imageUrl || orgLogoUrl;
          const src = getAbsoluteImageUrl(logoUrl);
          return (
            <div
              key={item.id}
              style={{
                width: Math.min(item.imageWidthPx ?? 80, 60),
                height: Math.min(item.imageHeightPx ?? 28, 20),
                backgroundColor: src ? 'transparent' : '#e5e7eb',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 6,
                color: '#9ca3af',
              }}
            >
              {src ? (
                <img
                  src={src}
                  alt="Logo"
                  style={{ width: '100%', height: '100%', objectFit: item.imageObjectFit ?? 'contain' }}
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    const parent = target.parentElement;
                    if (parent) {
                      const fallback = document.createElement('span');
                      fallback.style.cssText = 'color:white;font-size:10px;font-weight:700;letter-spacing:0.5px;';
                      fallback.textContent = `[Logo: ${(item.imageName as string) || 'image not found'}]`;
                      parent.appendChild(fallback);
                    }
                  }}
                />
              ) : (
                <span style={{ fontSize: 10, fontWeight: 900, color: 'white', letterSpacing: 1 }}>{orgName || 'AURIANOA'}</span>
              )}
            </div>
          );
        }
        const text = resolveItemContent(item, sample, page, total);
        return (
          <span
            key={item.id}
            style={{
              fontSize: `${Math.max(6, (item.fontSize ?? 11) - 2)}px`,
              fontWeight: item.fontWeight ?? 'normal',
              fontStyle: item.fontStyle ?? 'normal',
              color: item.color ?? 'inherit',
              opacity: item.opacity ?? 1,
            }}
          >
            {text || (item.type === 'variable' ? item.variableCode : '')}
          </span>
        );
      })}
    </div>
  );

  return (
    <div ref={containerRef} className="preview-panel flex flex-col h-full min-h-0 bg-[#F3F4F6] border-l border-gray-200">
      <div className="flex-none p-4 pb-2 flex flex-col gap-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Live preview</span>
          <div className="flex gap-1 bg-gray-100 p-0.5 rounded-md">
            <button
              type="button"
              onClick={() => onPreviewPageChange?.(1)}
              className={`px-2.5 py-1 text-xs rounded transition-colors ${previewPage === 1 ? 'bg-white text-gray-800 shadow-sm font-medium' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Cover
            </button>
            <button
              type="button"
              onClick={() => onPreviewPageChange?.(2)}
              className={`px-2.5 py-1 text-xs rounded transition-colors ${previewPage === 2 ? 'bg-white text-gray-800 shadow-sm font-medium' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Page 2+
            </button>
          </div>
        </div>
        <div className="flex gap-0.5 rounded-lg border border-gray-200 bg-white p-0.5">
          {(['fit', '75', '100'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => onScaleModeChange?.(mode)}
              className={`flex-1 py-1.5 px-2 text-xs font-medium rounded-md transition-colors ${
                scaleMode === mode
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-50 border border-transparent'
              }`}
            >
              {mode === 'fit' ? 'Fit Width' : mode === '75' ? '75%' : '100%'}
            </button>
          ))}
        </div>
        <p className="text-xs text-amber-600">Header &amp; footer visible from page 2</p>
      </div>

      <div
        className="preview-scale-container flex-1 overflow-auto min-h-0"
        style={{
          height: scaledHeight + 48,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'flex-start',
          padding: '24px',
        }}
      >
        <div
          className="a4-card bg-white flex-shrink-0 rounded overflow-hidden"
          style={{
            width: A4_WIDTH_PX,
            height: A4_HEIGHT_PX,
            transform: `scale(${currentScale})`,
            transformOrigin: 'top center',
            flexShrink: 0,
            background: 'white',
            boxShadow: '0 4px 24px rgba(0,0,0,0.15)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {previewPage === 1 ? (
            <>
              <div
                className="relative"
                style={{
                  minHeight: 120,
                  backgroundImage: coverImageUrl ? `url(${coverImageUrl})` : undefined,
                  backgroundColor: settings.cover_bg_color ?? '#0D2137',
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }}
              />
              <div style={{ height: 4, backgroundColor: settings.cover_accent_color ?? '#E8701A' }} />
              <div style={{ flex: 1, padding: 12, backgroundColor: '#fff' }}>
                <div style={{ fontSize: 9, color: '#6B7280', marginBottom: 4, letterSpacing: 1, textTransform: 'uppercase' }}>
                  WP-2026-001 · R1
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#0D2137', marginBottom: 4 }}>
                  {resolveVariables(settings.cover_title_variable ?? '{title}', sample as Parameters<typeof resolveVariables>[1])}
                </div>
                <div style={{ fontSize: 10, color: '#4B5563' }}>
                  {resolveVariables(settings.cover_subtitle_variable ?? '{org_name} | {site_name}', sample as Parameters<typeof resolveVariables>[1])}
                </div>
              </div>
            </>
          ) : (
            <>
              <div
                style={{
                  width: '100%',
                  height: headerHeightPx,
                  backgroundColor: settings.header_bg_color ?? '#0D2137',
                  color: settings.header_text_color ?? '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  padding: '0 10px',
                  fontSize: 8,
                  boxSizing: 'border-box',
                  borderBottom: settings.header_show_border ? `2px solid ${settings.header_border_color ?? '#E8701A'}` : undefined,
                }}
              >
                {renderZoneItems(headerZones.left.items, 'left')}
                {renderZoneItems(headerZones.center.items, 'center')}
                {renderZoneItems(headerZones.right.items, 'right')}
              </div>
              <div style={{ flex: 1, padding: 12, fontSize: 9, color: '#6B7280' }}>
                Page content appears here.
              </div>
              <div
                style={{
                  width: '100%',
                  height: footerHeightPx,
                  backgroundColor: settings.footer_bg_color ?? '#0D2137',
                  color: settings.footer_text_color ?? '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  padding: '0 10px',
                  fontSize: 7,
                  borderTop: settings.footer_show_border ? `2px solid ${settings.footer_border_color ?? '#E8701A'}` : undefined,
                }}
              >
                {renderZoneItems(footerZones.left.items, 'left')}
                {renderZoneItems(footerZones.center.items, 'center')}
                {renderZoneItems(footerZones.right.items, 'right')}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
