'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { HeaderFooterZones } from '@/types/printSettings.types';
import { DEFAULT_HEADER_ZONES, DEFAULT_FOOTER_ZONES, PRINT_VARIABLES } from '@/types/printSettings.types';
import { ZoneBandEditor } from '@/components/PrintSettings/ZoneBandEditor';
import { A4PreviewPanel, type ScaleMode } from '@/components/PrintSettings/A4PreviewPanel';
import { resolveVariables, getSampleWorkpack } from '@/lib/printVariables';

type Tab = 'page' | 'margins' | 'header' | 'footer' | 'cover' | 'lastPage';

export interface CoverPageSettings {
  heroBgColor: string;
  heroHeightPercent: number;
  showLogo: boolean;
  logoPosition: 'left' | 'center' | 'right';
  logoSize: number;
  showTitle: boolean;
  titleColor: string;
  titleSize: number;
  titleWeight: 'normal' | 'bold' | 'black';
  titlePosition: 'left' | 'center';
  showSubtitle: boolean;
  subtitleText: string;
  subtitleColor: string;
  subtitleSize: number;
  showMeta: boolean;
  metaColor: string;
  metaSize: number;
  showScopePreview: boolean;
  showWpNumber: boolean;
  wpNumberColor: string;
  wpNumberSize: number;
}

export interface LastPageSettings {
  enabled: boolean;
  bgColor: string;
  showGeneratedDate: boolean;
  showControlledNote: boolean;
  controlledNoteText: string;
  showQrCode: boolean;
  showSignatureBlock: boolean;
  signatureLabel1: string;
  signatureLabel2: string;
  signatureLabel3: string;
  customText: string;
  customTextSize: number;
  customTextColor: string;
  logoOnLastPage: boolean;
  logoPosition: 'left' | 'center';
}

const DEFAULT_COVER_PAGE: CoverPageSettings = {
  heroBgColor: '#1e3a5f',
  heroHeightPercent: 60,
  showLogo: true,
  logoPosition: 'left',
  logoSize: 48,
  showTitle: true,
  titleColor: '#ffffff',
  titleSize: 32,
  titleWeight: 'black',
  titlePosition: 'center',
  showSubtitle: true,
  subtitleText: '{org_name} | {site_name}',
  subtitleColor: '#ffffff',
  subtitleSize: 14,
  showMeta: true,
  metaColor: '#ffffff',
  metaSize: 11,
  showScopePreview: false,
  showWpNumber: true,
  wpNumberColor: '#1e3a5f',
  wpNumberSize: 16,
};

const DEFAULT_LAST_PAGE: LastPageSettings = {
  enabled: true,
  bgColor: '#1e3a5f',
  showGeneratedDate: true,
  showControlledNote: true,
  controlledNoteText: 'Controlled when printed — verify against live system',
  showQrCode: false,
  showSignatureBlock: true,
  signatureLabel1: 'Prepared by',
  signatureLabel2: 'Reviewed by',
  signatureLabel3: 'Approved by',
  customText: '',
  customTextSize: 11,
  customTextColor: '#666666',
  logoOnLastPage: true,
  logoPosition: 'center',
};

function parseCoverPageSettings(v: unknown): CoverPageSettings {
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    return {
      ...DEFAULT_COVER_PAGE,
      ...(o.heroBgColor != null && { heroBgColor: String(o.heroBgColor) }),
      ...(o.heroHeightPercent != null && { heroHeightPercent: Number(o.heroHeightPercent) }),
      ...(o.showLogo != null && { showLogo: Boolean(o.showLogo) }),
      ...(o.logoPosition != null && { logoPosition: o.logoPosition as CoverPageSettings['logoPosition'] }),
      ...(o.logoSize != null && { logoSize: Number(o.logoSize) }),
      ...(o.showTitle != null && { showTitle: Boolean(o.showTitle) }),
      ...(o.titleColor != null && { titleColor: String(o.titleColor) }),
      ...(o.titleSize != null && { titleSize: Number(o.titleSize) }),
      ...(o.titleWeight != null && { titleWeight: o.titleWeight as CoverPageSettings['titleWeight'] }),
      ...(o.titlePosition != null && { titlePosition: o.titlePosition as CoverPageSettings['titlePosition'] }),
      ...(o.showSubtitle != null && { showSubtitle: Boolean(o.showSubtitle) }),
      ...(o.subtitleText != null && { subtitleText: String(o.subtitleText) }),
      ...(o.subtitleColor != null && { subtitleColor: String(o.subtitleColor) }),
      ...(o.subtitleSize != null && { subtitleSize: Number(o.subtitleSize) }),
      ...(o.showMeta != null && { showMeta: Boolean(o.showMeta) }),
      ...(o.metaColor != null && { metaColor: String(o.metaColor) }),
      ...(o.metaSize != null && { metaSize: Number(o.metaSize) }),
      ...(o.showScopePreview != null && { showScopePreview: Boolean(o.showScopePreview) }),
      ...(o.showWpNumber != null && { showWpNumber: Boolean(o.showWpNumber) }),
      ...(o.wpNumberColor != null && { wpNumberColor: String(o.wpNumberColor) }),
      ...(o.wpNumberSize != null && { wpNumberSize: Number(o.wpNumberSize) }),
    };
  }
  return { ...DEFAULT_COVER_PAGE };
}

function parseLastPageSettings(v: unknown): LastPageSettings {
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    return {
      ...DEFAULT_LAST_PAGE,
      ...(o.enabled != null && { enabled: Boolean(o.enabled) }),
      ...(o.bgColor != null && { bgColor: String(o.bgColor) }),
      ...(o.showGeneratedDate != null && { showGeneratedDate: Boolean(o.showGeneratedDate) }),
      ...(o.showControlledNote != null && { showControlledNote: Boolean(o.showControlledNote) }),
      ...(o.controlledNoteText != null && { controlledNoteText: String(o.controlledNoteText) }),
      ...(o.showQrCode != null && { showQrCode: Boolean(o.showQrCode) }),
      ...(o.showSignatureBlock != null && { showSignatureBlock: Boolean(o.showSignatureBlock) }),
      ...(o.signatureLabel1 != null && { signatureLabel1: String(o.signatureLabel1) }),
      ...(o.signatureLabel2 != null && { signatureLabel2: String(o.signatureLabel2) }),
      ...(o.signatureLabel3 != null && { signatureLabel3: String(o.signatureLabel3) }),
      ...(o.customText != null && { customText: String(o.customText) }),
      ...(o.customTextSize != null && { customTextSize: Number(o.customTextSize) }),
      ...(o.customTextColor != null && { customTextColor: String(o.customTextColor) }),
      ...(o.logoOnLastPage != null && { logoOnLastPage: Boolean(o.logoOnLastPage) }),
      ...(o.logoPosition != null && { logoPosition: o.logoPosition as LastPageSettings['logoPosition'] }),
    };
  }
  return { ...DEFAULT_LAST_PAGE };
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
        checked ? 'bg-blue-600' : 'bg-gray-200'
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition ${
          checked ? 'translate-x-5' : 'translate-x-1'
        }`}
      />
    </button>
  );
}

function CoverPageMiniPreview({
  settings,
  logoDataUrl,
  sampleTitle,
  sampleSubtitle,
  sampleWpNumber,
}: {
  settings: CoverPageSettings;
  logoDataUrl: string | null;
  sampleTitle: string;
  sampleSubtitle: string;
  sampleWpNumber: string;
}) {
  const heroH = settings.heroHeightPercent;
  return (
    <div
      className="rounded-lg border border-gray-200 overflow-hidden shadow-sm w-full"
      style={{ minHeight: 140 }}
    >
      <div
        style={{
          height: `${heroH}%`,
          backgroundColor: settings.heroBgColor,
          padding: '8px 10px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: settings.titlePosition === 'center' ? 'center' : 'flex-start',
        }}
      >
        {settings.showLogo && logoDataUrl && (
          <div className="mb-1" style={{ textAlign: settings.logoPosition }}>
            <img
              src={logoDataUrl}
              alt=""
              style={{ height: Math.min(settings.logoSize, 28), maxWidth: 80, objectFit: 'contain' }}
            />
          </div>
        )}
        {settings.showTitle && (
          <div
            className="truncate w-full"
            style={{
              fontSize: Math.min(settings.titleSize, 14),
              fontWeight: settings.titleWeight === 'black' ? 900 : settings.titleWeight === 'bold' ? 700 : 400,
              color: settings.titleColor,
              textAlign: settings.titlePosition,
            }}
          >
            {sampleTitle}
          </div>
        )}
        {settings.showSubtitle && (
          <div
            className="truncate w-full text-opacity-85"
            style={{ fontSize: Math.min(settings.subtitleSize, 10), color: settings.subtitleColor, textAlign: settings.titlePosition }}
          >
            {sampleSubtitle}
          </div>
        )}
        {settings.showMeta && (
          <div
            className="truncate w-full opacity-70"
            style={{ fontSize: Math.min(settings.metaSize, 8), color: settings.metaColor }}
          >
            REV · PRIORITY · CONTRACTOR
          </div>
        )}
      </div>
      <div style={{ height: 4, background: 'linear-gradient(90deg, #f97316 0%, #ea580c 100%)' }} />
      <div className="bg-white px-2 py-1.5">
        {settings.showWpNumber && (
          <div style={{ fontSize: Math.min(settings.wpNumberSize, 10), fontWeight: 700, color: settings.wpNumberColor }}>
            {sampleWpNumber}
          </div>
        )}
      </div>
    </div>
  );
}

type SettingsRecord = {
  id?: string;
  cover_show?: boolean;
  cover_image_path?: string | null;
  cover_image_opacity?: number;
  cover_title_variable?: string;
  cover_subtitle_variable?: string;
  cover_accent_color?: string;
  cover_bg_color?: string;
  header_zones?: unknown;
  header_bg_color?: string;
  header_text_color?: string;
  header_height_mm?: number;
  header_show_border?: boolean;
  header_border_color?: string;
  footer_zones?: unknown;
  footer_bg_color?: string;
  footer_text_color?: string;
  footer_height_mm?: number;
  footer_show_border?: boolean;
  footer_border_color?: string;
  page_size?: string;
  margin_top_mm?: number;
  margin_bottom_mm?: number;
  margin_left_mm?: number;
  margin_right_mm?: number;
  watermark_text?: string | null;
  watermark_draft_only?: boolean;
  logo_library?: unknown;
  cover_page_settings?: unknown;
  last_page_settings?: unknown;
};

function parseZones(v: unknown): HeaderFooterZones {
  if (v && typeof v === 'object' && 'left' in v && 'center' in v && 'right' in v) {
    const o = v as Record<string, unknown>;
    return {
      left: (o.left as HeaderFooterZones['left']) ?? DEFAULT_HEADER_ZONES.left,
      center: (o.center as HeaderFooterZones['center']) ?? DEFAULT_HEADER_ZONES.center,
      right: (o.right as HeaderFooterZones['right']) ?? DEFAULT_HEADER_ZONES.right,
    };
  }
  return DEFAULT_HEADER_ZONES;
}

const PAPER_SIZES: { id: string; label: string; w: number; h: number }[] = [
  { id: 'A4', label: 'A4', w: 210, h: 297 },
  { id: 'Letter', label: 'Letter', w: 216, h: 279 },
  { id: 'A3', label: 'A3', w: 297, h: 420 },
];

type Props = {
  settings: SettingsRecord | null;
  orgName: string;
  orgLogoPath: string | null;
  orgId: string;
};

export function PrintSettingsDesigner({ settings: initialSettings, orgName, orgLogoPath, orgId }: Props) {
  const [settings, setSettings] = useState<SettingsRecord | null>(initialSettings);
  const [headerZones, setHeaderZones] = useState<HeaderFooterZones>(() =>
    parseZones(initialSettings?.header_zones ?? DEFAULT_HEADER_ZONES)
  );
  const [footerZones, setFooterZones] = useState<HeaderFooterZones>(() =>
    parseZones(initialSettings?.footer_zones ?? DEFAULT_FOOTER_ZONES)
  );
  const [tab, setTab] = useState<Tab>('page');
  const [previewPage, setPreviewPage] = useState<1 | 2>(1);
  const [scaleMode, setScaleMode] = useState<ScaleMode>('fit');
  const [settingsWidth, setSettingsWidth] = useState(() => {
    if (typeof window === 'undefined') return 480;
    return Math.min(700, Math.max(360, parseInt(localStorage.getItem('pdf-settings-width') ?? '480', 10)));
  });
  const [isDragging, setIsDragging] = useState(false);
  const [coverPageSettings, setCoverPageSettings] = useState<CoverPageSettings>(() =>
    parseCoverPageSettings(initialSettings?.cover_page_settings ?? null)
  );
  const [lastPageSettings, setLastPageSettings] = useState<LastPageSettings>(() =>
    parseLastPageSettings(initialSettings?.last_page_settings ?? null)
  );
  const containerRef = useRef<HTMLDivElement>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [selectedZone, setSelectedZone] = useState<{ band: 'header' | 'footer'; position: 'left' | 'center' | 'right' } | null>(null);
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null);
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [logoLibrary, setLogoLibrary] = useState<{ id: string; name: string; s3_path: string; url: string }[]>(() => {
    const lib = initialSettings?.logo_library;
    if (Array.isArray(lib)) return lib as { id: string; name: string; s3_path: string; url: string }[];
    return [];
  });

  useEffect(() => {
    localStorage.setItem('pdf-settings-width', String(settingsWidth));
  }, [settingsWidth]);

  useEffect(() => {
    setSettings(initialSettings);
    if (initialSettings) {
      setHeaderZones(parseZones(initialSettings.header_zones));
      setFooterZones(parseZones(initialSettings.footer_zones));
      setCoverPageSettings(parseCoverPageSettings(initialSettings.cover_page_settings ?? null));
      setLastPageSettings(parseLastPageSettings(initialSettings.last_page_settings ?? null));
      const lib = initialSettings.logo_library;
      if (Array.isArray(lib)) setLogoLibrary(lib as { id: string; name: string; s3_path: string; url: string }[]);
    }
  }, [initialSettings]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setMessage(null);
    try {
      const pageSize = settings?.page_size === 'A3' ? 'A4' : settings?.page_size;
      const payload = {
        ...settings,
        page_size: pageSize ?? 'A4',
        header_zones: headerZones,
        footer_zones: footerZones,
        cover_show: settings?.cover_show ?? true,
        cover_title_variable: settings?.cover_title_variable ?? '{workpack_number} — {title}',
        cover_subtitle_variable: settings?.cover_subtitle_variable ?? '{org_name} | {site_name}',
        header_bg_color: settings?.header_bg_color ?? '#0D2137',
        header_text_color: settings?.header_text_color ?? '#FFFFFF',
        header_height_mm: settings?.header_height_mm ?? 18,
        footer_bg_color: settings?.footer_bg_color ?? '#0D2137',
        footer_text_color: settings?.footer_text_color ?? '#FFFFFF',
        footer_height_mm: settings?.footer_height_mm ?? 12,
        logo_library: logoLibrary,
        cover_page_settings: coverPageSettings,
        last_page_settings: lastPageSettings,
      };
      const res = await fetch('/api/settings/print-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save');
      setSettings(data);
      setMessage({ type: 'success', text: 'Print settings saved — applies to all future PDFs' });
    } catch (e: unknown) {
      setMessage({ type: 'error', text: e instanceof Error ? e.message : 'Failed to save' });
    } finally {
      setSaving(false);
    }
  }, [settings, headerZones, footerZones, logoLibrary, coverPageSettings, lastPageSettings]);

  const [uploadedOrgLogoUrl, setUploadedOrgLogoUrl] = useState<string | null>(null);

  const handleUploadLogo = useCallback(
    async (file: File, name: string): Promise<{ id: string; name: string; s3_path: string; url: string }> => {
      const form = new FormData();
      form.append('file', file);
      form.append('name', name);
      const res = await fetch('/api/settings/print-settings/upload-logo', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      setLogoLibrary((prev) => [...prev, { id: data.id, name: data.name, s3_path: data.s3_path, url: data.url }]);
      setUploadedOrgLogoUrl(data.url);
      return data;
    },
    []
  );

  const effectiveOrgLogoPath = uploadedOrgLogoUrl ?? orgLogoPath ?? null;

  const insertVariable = (field: 'cover_title_variable' | 'cover_subtitle_variable', code: string) => {
    const current = (settings?.[field] as string) ?? '';
    setSettings((s) => (s ? { ...s, [field]: current + code } : s));
  };

  if (!settings) return <div className="p-6">Loading…</div>;

  const tabs: { id: Tab; label: string }[] = [
    { id: 'page', label: 'Page' },
    { id: 'margins', label: 'Margins' },
    { id: 'header', label: 'Header' },
    { id: 'footer', label: 'Footer' },
    { id: 'cover', label: 'Cover Page' },
    { id: 'lastPage', label: 'Last Page' },
  ];

  const settingsForPreview = {
    cover_show: settings.cover_show,
    cover_image_path: settings.cover_image_path,
    cover_image_opacity: settings.cover_image_opacity ?? 0.9,
    cover_title_variable: settings.cover_title_variable,
    cover_subtitle_variable: settings.cover_subtitle_variable,
    cover_accent_color: settings.cover_accent_color,
    cover_bg_color: settings.cover_bg_color,
    header_bg_color: settings.header_bg_color,
    header_text_color: settings.header_text_color,
    header_height_mm: settings.header_height_mm,
    header_show_border: settings.header_show_border,
    header_border_color: settings.header_border_color,
    footer_bg_color: settings.footer_bg_color,
    footer_text_color: settings.footer_text_color,
    footer_height_mm: settings.footer_height_mm,
    footer_show_border: settings.footer_show_border,
    footer_border_color: settings.footer_border_color,
  };

  const currentPaper = PAPER_SIZES.find((p) => p.id === (settings.page_size || 'A4')) ?? PAPER_SIZES[0];
  const marginTop = Number(settings.margin_top_mm ?? 15);
  const marginBottom = Number(settings.margin_bottom_mm ?? 15);
  const marginLeft = Number(settings.margin_left_mm ?? 15);
  const marginRight = Number(settings.margin_right_mm ?? 15);
  const sample = getSampleWorkpack(orgName, '2', '24');

  const startDrag = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsDragging(true);
      const startX = e.clientX;
      const startW = settingsWidth;

      function onMove(ev: MouseEvent) {
        const newW = Math.max(360, Math.min(700, startW + (ev.clientX - startX)));
        setSettingsWidth(newW);
      }

      function onUp() {
        setIsDragging(false);
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
      }

      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    },
    [settingsWidth]
  );

  return (
    <div
      ref={containerRef}
      className="flex flex-row h-[calc(100vh-64px)] overflow-hidden bg-[#F9FAFB]"
      style={{ cursor: isDragging ? 'col-resize' : 'default' }}
    >
      <div
        style={{ width: settingsWidth, flexShrink: 0 }}
        className="overflow-y-auto h-full border-r border-gray-200 flex flex-col"
      >
        <div className="p-6 flex flex-col min-h-0">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Print &amp; PDF Design</h1>
            <p className="text-sm text-gray-500 mt-0.5">Configure cover, header, footer and page layout for PDFs</p>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <a
              href="/api/settings/print-settings/preview"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              Preview PDF
            </a>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>

        {message && (
          <div
            className={`mb-4 rounded-lg px-4 py-2 text-sm ${
              message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
            }`}
          >
            {message.text}
          </div>
        )}

        <div className="border-b border-gray-200 mb-6">
          <div className="flex gap-0">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`relative px-4 py-3 text-sm font-medium transition-colors ${
                  tab === t.id ? 'text-blue-600' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {t.label}
                {tab === t.id && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-t" />
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6 min-h-0">
          {tab === 'page' && (
            <div className="space-y-8">
              <section>
                <h2 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">Orientation</h2>
                <div className="flex gap-4">
                  <button
                    type="button"
                    onClick={() => setOrientation('portrait')}
                    className={`flex flex-col items-center justify-center rounded-xl border-2 p-6 w-40 h-28 transition-colors ${
                      orientation === 'portrait' ? 'border-blue-500 bg-blue-50/50' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <span className="text-3xl mb-2">A</span>
                    <span className="text-sm font-medium text-gray-900">Portrait</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setOrientation('landscape')}
                    className={`flex flex-col items-center justify-center rounded-xl border-2 p-6 w-40 h-28 transition-colors ${
                      orientation === 'landscape' ? 'border-blue-500 bg-blue-50/50' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <span className="text-3xl mb-2 rotate-90">A</span>
                    <span className="text-sm font-medium text-gray-700">Landscape</span>
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-2">Landscape mainly for schedule PDFs</p>
              </section>
              <section>
                <h2 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">Paper size</h2>
                <select
                  value={settings.page_size || 'A4'}
                  onChange={(e) => setSettings((s) => (s ? { ...s, page_size: e.target.value } : s))}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white"
                >
                  {PAPER_SIZES.map((p) => (
                    <option key={p.id} value={p.id}>{p.label}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-2">{currentPaper.w} × {currentPaper.h} mm</p>
              </section>
            </div>
          )}

          {tab === 'margins' && (
            <div className="flex flex-col items-center py-6">
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-4">Margin diagram</p>
              <div className="flex flex-col items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 w-16">Top:</span>
                  <input
                    type="number"
                    min={5}
                    max={50}
                    value={marginTop}
                    onChange={(e) => setSettings((s) => (s ? { ...s, margin_top_mm: Number(e.target.value) } : s))}
                    className="w-16 rounded border border-gray-300 px-2 py-1.5 text-sm"
                  />
                  <span className="text-xs text-gray-500">mm</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex flex-col items-center gap-2">
                    <span className="text-xs text-gray-500">Left:</span>
                    <input
                      type="number"
                      min={5}
                      max={50}
                      value={marginLeft}
                      onChange={(e) => setSettings((s) => (s ? { ...s, margin_left_mm: Number(e.target.value) } : s))}
                      className="w-16 rounded border border-gray-300 px-2 py-1.5 text-sm"
                    />
                    <span className="text-xs text-gray-500">mm</span>
                  </div>
                  <div className="relative rounded bg-[#F3F4F6]" style={{ width: 260, height: 320 }}>
                    <div
                      className="absolute rounded border-2 border-dashed border-gray-400 bg-white flex items-center justify-center text-xs text-gray-500"
                      style={{
                        left: Math.min(marginLeft * 2, 120),
                        top: Math.min(marginTop * 2, 120),
                        right: Math.min(marginRight * 2, 120),
                        bottom: Math.min(marginBottom * 2, 120),
                      }}
                    >
                      Content area
                    </div>
                  </div>
                  <div className="flex flex-col items-center gap-2">
                    <span className="text-xs text-gray-500">Right:</span>
                    <input
                      type="number"
                      min={5}
                      max={50}
                      value={marginRight}
                      onChange={(e) => setSettings((s) => (s ? { ...s, margin_right_mm: Number(e.target.value) } : s))}
                      className="w-16 rounded border border-gray-300 px-2 py-1.5 text-sm"
                    />
                    <span className="text-xs text-gray-500">mm</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 w-16">Bottom:</span>
                  <input
                    type="number"
                    min={5}
                    max={50}
                    value={marginBottom}
                    onChange={(e) => setSettings((s) => (s ? { ...s, margin_bottom_mm: Number(e.target.value) } : s))}
                    className="w-16 rounded border border-gray-300 px-2 py-1.5 text-sm"
                  />
                  <span className="text-xs text-gray-500">mm</span>
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-6">Header/footer height is included in margins</p>
            </div>
          )}

          {tab === 'header' && (
            <ZoneBandEditor
              kind="header"
              zones={headerZones}
              onChange={setHeaderZones}
              selectedZone={selectedZone?.band === 'header' ? selectedZone : null}
              onSelectZone={(_, pos) => setSelectedZone({ band: 'header', position: pos })}
              bgColor={settings.header_bg_color ?? '#0D2137'}
              textColor={settings.header_text_color ?? '#FFFFFF'}
              heightMm={settings.header_height_mm ?? 18}
              showBorder={settings.header_show_border ?? false}
              borderColor={settings.header_border_color ?? '#E8701A'}
              onAppearanceChange={(u) =>
                setSettings((s) =>
                  s
                    ? {
                        ...s,
                        ...(u.bgColor !== undefined && { header_bg_color: u.bgColor }),
                        ...(u.textColor !== undefined && { header_text_color: u.textColor }),
                        ...(u.heightMm !== undefined && { header_height_mm: u.heightMm }),
                        ...(u.showBorder !== undefined && { header_show_border: u.showBorder }),
                        ...(u.borderColor !== undefined && { header_border_color: u.borderColor }),
                      }
                    : s
                )
              }
              orgLogoUrl={effectiveOrgLogoPath}
              logoLibrary={logoLibrary}
              onUploadLogo={handleUploadLogo}
            />
          )}

          {tab === 'footer' && (
            <ZoneBandEditor
              kind="footer"
              zones={footerZones}
              onChange={setFooterZones}
              selectedZone={selectedZone?.band === 'footer' ? selectedZone : null}
              onSelectZone={(_, pos) => setSelectedZone({ band: 'footer', position: pos })}
              bgColor={settings.footer_bg_color ?? '#0D2137'}
              textColor={settings.footer_text_color ?? '#FFFFFF'}
              heightMm={settings.footer_height_mm ?? 12}
              showBorder={settings.footer_show_border ?? true}
              borderColor={settings.footer_border_color ?? '#E8701A'}
              onAppearanceChange={(u) =>
                setSettings((s) =>
                  s
                    ? {
                        ...s,
                        ...(u.bgColor !== undefined && { footer_bg_color: u.bgColor }),
                        ...(u.textColor !== undefined && { footer_text_color: u.textColor }),
                        ...(u.heightMm !== undefined && { footer_height_mm: u.heightMm }),
                        ...(u.showBorder !== undefined && { footer_show_border: u.showBorder }),
                        ...(u.borderColor !== undefined && { footer_border_color: u.borderColor }),
                      }
                    : s
                )
              }
              orgLogoUrl={effectiveOrgLogoPath}
              logoLibrary={logoLibrary}
              onUploadLogo={handleUploadLogo}
            />
          )}

          {tab === 'cover' && (
            <div className="space-y-6 p-4">
              <CoverPageMiniPreview
                settings={coverPageSettings}
                logoDataUrl={effectiveOrgLogoPath}
                sampleTitle={resolveVariables('{workpack_number} — {title}', sample as Parameters<typeof resolveVariables>[1])}
                sampleSubtitle={resolveVariables(coverPageSettings.subtitleText || '{org_name} | {site_name}', sample as Parameters<typeof resolveVariables>[1])}
                sampleWpNumber={resolveVariables('{workpack_number}', sample as Parameters<typeof resolveVariables>[1])}
              />
              <section>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Hero Band</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-600">Background colour</label>
                    <input
                      type="color"
                      value={coverPageSettings.heroBgColor}
                      onChange={(e) => setCoverPageSettings((s) => ({ ...s, heroBgColor: e.target.value }))}
                      className="mt-1 h-8 w-full rounded border border-gray-300 cursor-pointer"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-600">Height: {coverPageSettings.heroHeightPercent}%</label>
                    <input
                      type="range"
                      min={40}
                      max={80}
                      step={5}
                      value={coverPageSettings.heroHeightPercent}
                      onChange={(e) => setCoverPageSettings((s) => ({ ...s, heroHeightPercent: parseInt(e.target.value, 10) }))}
                      className="mt-2 w-full"
                    />
                  </div>
                </div>
              </section>
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Logo</h3>
                  <Toggle checked={coverPageSettings.showLogo} onChange={(v) => setCoverPageSettings((s) => ({ ...s, showLogo: v }))} />
                </div>
                {coverPageSettings.showLogo && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-gray-600">Position</label>
                      <select
                        value={coverPageSettings.logoPosition}
                        onChange={(e) => setCoverPageSettings((s) => ({ ...s, logoPosition: e.target.value as 'left' | 'center' | 'right' }))}
                        className="mt-1 w-full text-sm border border-gray-300 rounded px-2 py-1"
                      >
                        <option value="left">Left</option>
                        <option value="center">Center</option>
                        <option value="right">Right</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-gray-600">Size: {coverPageSettings.logoSize}px</label>
                      <input
                        type="range"
                        min={24}
                        max={120}
                        step={4}
                        value={coverPageSettings.logoSize}
                        onChange={(e) => setCoverPageSettings((s) => ({ ...s, logoSize: parseInt(e.target.value, 10) }))}
                        className="mt-2 w-full"
                      />
                    </div>
                  </div>
                )}
              </section>
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Title</h3>
                  <Toggle checked={coverPageSettings.showTitle} onChange={(v) => setCoverPageSettings((s) => ({ ...s, showTitle: v }))} />
                </div>
                {coverPageSettings.showTitle && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-gray-600">Colour</label>
                      <input
                        type="color"
                        value={coverPageSettings.titleColor}
                        onChange={(e) => setCoverPageSettings((s) => ({ ...s, titleColor: e.target.value }))}
                        className="mt-1 h-8 w-full rounded border border-gray-300 cursor-pointer"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-600">Size: {coverPageSettings.titleSize}px</label>
                      <input
                        type="range"
                        min={18}
                        max={48}
                        step={2}
                        value={coverPageSettings.titleSize}
                        onChange={(e) => setCoverPageSettings((s) => ({ ...s, titleSize: parseInt(e.target.value, 10) }))}
                        className="mt-2 w-full"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-600">Weight</label>
                      <select
                        value={coverPageSettings.titleWeight}
                        onChange={(e) => setCoverPageSettings((s) => ({ ...s, titleWeight: e.target.value as 'normal' | 'bold' | 'black' }))}
                        className="mt-1 w-full text-sm border border-gray-300 rounded px-2 py-1"
                      >
                        <option value="normal">Normal</option>
                        <option value="bold">Bold</option>
                        <option value="black">Black (900)</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-gray-600">Alignment</label>
                      <select
                        value={coverPageSettings.titlePosition}
                        onChange={(e) => setCoverPageSettings((s) => ({ ...s, titlePosition: e.target.value as 'left' | 'center' }))}
                        className="mt-1 w-full text-sm border border-gray-300 rounded px-2 py-1"
                      >
                        <option value="center">Center</option>
                        <option value="left">Left</option>
                      </select>
                    </div>
                  </div>
                )}
              </section>
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Subtitle</h3>
                  <Toggle checked={coverPageSettings.showSubtitle} onChange={(v) => setCoverPageSettings((s) => ({ ...s, showSubtitle: v }))} />
                </div>
                {coverPageSettings.showSubtitle && (
                  <div className="space-y-2">
                    <div>
                      <label className="text-xs text-gray-600">Text (use {'{org_name}'}, {'{site_name}'})</label>
                      <input
                        type="text"
                        value={coverPageSettings.subtitleText}
                        onChange={(e) => setCoverPageSettings((s) => ({ ...s, subtitleText: e.target.value }))}
                        placeholder="{org_name} | {site_name}"
                        className="mt-1 w-full text-sm border border-gray-300 rounded px-2 py-1.5"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-gray-600">Colour</label>
                        <input
                          type="color"
                          value={coverPageSettings.subtitleColor}
                          onChange={(e) => setCoverPageSettings((s) => ({ ...s, subtitleColor: e.target.value }))}
                          className="mt-1 h-8 w-full rounded border border-gray-300 cursor-pointer"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-600">Size: {coverPageSettings.subtitleSize}px</label>
                        <input
                          type="range"
                          min={10}
                          max={22}
                          step={1}
                          value={coverPageSettings.subtitleSize}
                          onChange={(e) => setCoverPageSettings((s) => ({ ...s, subtitleSize: parseInt(e.target.value, 10) }))}
                          className="mt-2 w-full"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </section>
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Meta Row (Revision · Priority · Contractor)</h3>
                  <Toggle checked={coverPageSettings.showMeta} onChange={(v) => setCoverPageSettings((s) => ({ ...s, showMeta: v }))} />
                </div>
                {coverPageSettings.showMeta && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-gray-600">Text colour</label>
                      <input
                        type="color"
                        value={coverPageSettings.metaColor}
                        onChange={(e) => setCoverPageSettings((s) => ({ ...s, metaColor: e.target.value }))}
                        className="mt-1 h-8 w-full rounded border border-gray-300 cursor-pointer"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-600">Size: {coverPageSettings.metaSize}px</label>
                      <input
                        type="range"
                        min={8}
                        max={16}
                        step={1}
                        value={coverPageSettings.metaSize}
                        onChange={(e) => setCoverPageSettings((s) => ({ ...s, metaSize: parseInt(e.target.value, 10) }))}
                        className="mt-2 w-full"
                      />
                    </div>
                  </div>
                )}
              </section>
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">White Area (below hero)</h3>
                </div>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={coverPageSettings.showWpNumber}
                      onChange={(e) => setCoverPageSettings((s) => ({ ...s, showWpNumber: e.target.checked }))}
                    />
                    Show WP number
                  </label>
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={coverPageSettings.showScopePreview}
                      onChange={(e) => setCoverPageSettings((s) => ({ ...s, showScopePreview: e.target.checked }))}
                    />
                    Show scope preview (first 2 lines)
                  </label>
                </div>
              </section>
              <p className="text-xs text-gray-400 italic">
                Orange accent line below hero band always included. Header and footer are always hidden on the cover page.
              </p>
              <button
                type="button"
                onClick={handleSave}
                className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded"
              >
                Save Cover Page Settings
              </button>
            </div>
          )}

          {tab === 'lastPage' && (
            <div className="space-y-6 p-4">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                <div>
                  <p className="text-sm font-medium text-gray-800">Include last page</p>
                  <p className="text-xs text-gray-500 mt-0.5">Closing page appended after all content</p>
                </div>
                <Toggle checked={lastPageSettings.enabled} onChange={(v) => setLastPageSettings((s) => ({ ...s, enabled: v }))} />
              </div>
              {lastPageSettings.enabled && (
                <>
                  <section>
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Background</h3>
                    <div>
                      <label className="text-xs text-gray-600">Colour</label>
                      <input
                        type="color"
                        value={lastPageSettings.bgColor}
                        onChange={(e) => setLastPageSettings((s) => ({ ...s, bgColor: e.target.value }))}
                        className="mt-1 h-8 w-full rounded border border-gray-300 cursor-pointer"
                      />
                    </div>
                  </section>
                  <section>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Logo</h3>
                      <Toggle checked={lastPageSettings.logoOnLastPage} onChange={(v) => setLastPageSettings((s) => ({ ...s, logoOnLastPage: v }))} />
                    </div>
                    {lastPageSettings.logoOnLastPage && (
                      <div>
                        <label className="text-xs text-gray-600">Position</label>
                        <select
                          value={lastPageSettings.logoPosition}
                          onChange={(e) => setLastPageSettings((s) => ({ ...s, logoPosition: e.target.value as 'left' | 'center' }))}
                          className="mt-1 w-full text-sm border border-gray-300 rounded px-2 py-1"
                        >
                          <option value="center">Center</option>
                          <option value="left">Left</option>
                        </select>
                      </div>
                    )}
                  </section>
                  <section>
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Custom Text</h3>
                    <textarea
                      value={lastPageSettings.customText}
                      onChange={(e) => setLastPageSettings((s) => ({ ...s, customText: e.target.value }))}
                      placeholder="Optional message on closing page..."
                      rows={3}
                      className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 resize-none"
                    />
                    <div className="grid grid-cols-2 gap-3 mt-2">
                      <div>
                        <label className="text-xs text-gray-600">Text colour</label>
                        <input
                          type="color"
                          value={lastPageSettings.customTextColor}
                          onChange={(e) => setLastPageSettings((s) => ({ ...s, customTextColor: e.target.value }))}
                          className="mt-1 h-8 w-full rounded border border-gray-300 cursor-pointer"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-600">Size: {lastPageSettings.customTextSize}px</label>
                        <input
                          type="range"
                          min={8}
                          max={18}
                          step={1}
                          value={lastPageSettings.customTextSize}
                          onChange={(e) => setLastPageSettings((s) => ({ ...s, customTextSize: parseInt(e.target.value, 10) }))}
                          className="mt-2 w-full"
                        />
                      </div>
                    </div>
                  </section>
                  <section>
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Footer Notes</h3>
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 text-sm text-gray-700">
                        <input
                          type="checkbox"
                          checked={lastPageSettings.showGeneratedDate}
                          onChange={(e) => setLastPageSettings((s) => ({ ...s, showGeneratedDate: e.target.checked }))}
                        />
                        Show generated date
                      </label>
                      <label className="flex items-center gap-2 text-sm text-gray-700">
                        <input
                          type="checkbox"
                          checked={lastPageSettings.showControlledNote}
                          onChange={(e) => setLastPageSettings((s) => ({ ...s, showControlledNote: e.target.checked }))}
                        />
                        Show controlled document note
                      </label>
                      {lastPageSettings.showControlledNote && (
                        <input
                          type="text"
                          value={lastPageSettings.controlledNoteText}
                          onChange={(e) => setLastPageSettings((s) => ({ ...s, controlledNoteText: e.target.value }))}
                          className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 mt-1"
                        />
                      )}
                    </div>
                  </section>
                  <section>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Signature Block</h3>
                      <Toggle checked={lastPageSettings.showSignatureBlock} onChange={(v) => setLastPageSettings((s) => ({ ...s, showSignatureBlock: v }))} />
                    </div>
                    {lastPageSettings.showSignatureBlock && (
                      <div className="space-y-2">
                        {[
                          { key: 'signatureLabel1' as const, placeholder: 'Prepared by' },
                          { key: 'signatureLabel2' as const, placeholder: 'Reviewed by' },
                          { key: 'signatureLabel3' as const, placeholder: 'Approved by' },
                        ].map(({ key, placeholder }) => (
                          <div key={key}>
                            <label className="text-xs text-gray-600">{placeholder}</label>
                            <input
                              type="text"
                              value={lastPageSettings[key]}
                              onChange={(e) => setLastPageSettings((s) => ({ ...s, [key]: e.target.value }))}
                              placeholder={placeholder}
                              className="mt-0.5 w-full text-sm border border-gray-300 rounded px-2 py-1"
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                  <button
                    type="button"
                    onClick={handleSave}
                    className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded"
                  >
                    Save Last Page Settings
                  </button>
                </>
              )}
            </div>
          )}

        </div>
        </div>
      </div>

      <div
        role="separator"
        aria-label="Resize preview"
        onMouseDown={startDrag}
        onDoubleClick={() => setSettingsWidth(480)}
        title="Drag to resize · Double-click to reset"
        className={`flex-none w-1.5 cursor-col-resize select-none flex flex-col items-center justify-center gap-1 transition-colors ${
          isDragging ? 'bg-blue-500' : 'bg-gray-200 hover:bg-blue-400'
        }`}
      >
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="w-0.5 h-0.5 rounded-full bg-gray-400" />
        ))}
      </div>

      <div className="flex-1 overflow-hidden flex flex-col min-w-0 min-h-0 bg-gray-100">
        <div className="flex-none flex items-center gap-2 px-3 py-2 border-b border-gray-200 bg-gray-50">
          <span className="text-xs font-semibold text-gray-500 tracking-wide uppercase">Live preview</span>
        </div>
        <div className="flex-1 overflow-auto min-h-0">
          <A4PreviewPanel
            headerZones={headerZones}
            footerZones={footerZones}
            settings={settingsForPreview}
            coverImageUrl={coverImageUrl}
            orgName={orgName}
            orgLogoUrl={effectiveOrgLogoPath ?? undefined}
            previewPage={previewPage}
            scaleMode={scaleMode}
            onPreviewPageChange={setPreviewPage}
            onScaleModeChange={setScaleMode}
          />
        </div>
      </div>
    </div>
  );
}
