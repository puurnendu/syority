'use client';

import React, { useState, useRef, useCallback } from 'react';
import type { HeaderFooterZones, Zone, ZoneItem } from '@/types/printSettings.types';
import { ZoneItemPicker } from './ZoneItemPicker';

type BandKind = 'header' | 'footer';
type ZonePos = 'left' | 'center' | 'right';

const POS_LABELS: Record<ZonePos, string> = { left: 'Section 1', center: 'Section 2', right: 'Section 3' };

type Props = {
  kind: BandKind;
  zones: HeaderFooterZones;
  onChange: (zones: HeaderFooterZones) => void;
  selectedZone: { band: BandKind; position: ZonePos } | null;
  onSelectZone: (band: BandKind, position: ZonePos) => void;
  bgColor: string;
  textColor: string;
  heightMm: number;
  showBorder: boolean;
  borderColor: string;
  onAppearanceChange: (updates: {
    bgColor?: string;
    textColor?: string;
    heightMm?: number;
    showBorder?: boolean;
    borderColor?: string;
  }) => void;
  orgLogoUrl?: string | null;
  logoLibrary: { id: string; name: string; s3_path: string; url: string }[];
  onUploadLogo?: (file: File, name: string) => Promise<{ id: string; name: string; s3_path: string; url: string }>;
};

function itemLabel(item: ZoneItem): string {
  if (item.type === 'text') return item.text ? `Text: ${item.text.slice(0, 20)}${item.text.length > 20 ? '…' : ''}` : 'Text';
  if (item.type === 'variable') return item.variableLabel ?? item.variableCode ?? 'Variable';
  return item.imageName ?? 'Logo';
}

export function ZoneBandEditor({
  kind,
  zones,
  onChange,
  selectedZone,
  onSelectZone,
  bgColor,
  textColor,
  heightMm,
  showBorder,
  borderColor,
  onAppearanceChange,
  orgLogoUrl,
  logoLibrary,
  onUploadLogo,
}: Props) {
  const [sectionWidths, setSectionWidths] = useState<[number, number, number]>([33.33, 33.33, 33.34]);
  const [dragging, setDragging] = useState<0 | 1 | null>(null);
  const bandRef = useRef<HTMLDivElement>(null);

  const updateZone = useCallback(
    (position: ZonePos, updater: (z: Zone) => Zone) => {
      const next = { ...zones, [position]: updater(zones[position]) };
      onChange(next);
    },
    [zones, onChange]
  );

  const addItem = useCallback(
    (position: ZonePos, item: ZoneItem) => {
      updateZone(position, (z) => ({ ...z, items: [...z.items, item] }));
    },
    [updateZone]
  );

  const removeItem = useCallback(
    (position: ZonePos, index: number) => {
      updateZone(position, (z) => ({ ...z, items: z.items.filter((_, i) => i !== index) }));
    },
    [updateZone]
  );

  const clearSection = useCallback(
    (position: ZonePos) => {
      updateZone(position, (z) => ({ ...z, items: [] }));
    },
    [updateZone]
  );

  const handleDividerMove = useCallback(
    (dividerIndex: 0 | 1, clientX: number) => {
      const el = bandRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const x = clientX - rect.left;
      const total = rect.width;
      const pct = Math.max(0, Math.min(100, (x / total) * 100));
      if (dividerIndex === 0) {
        const left = Math.max(10, Math.min(60, pct));
        const rest = 100 - left;
        const center = rest / 2;
        const right = rest - center;
        setSectionWidths([left, center, right]);
      } else {
        const left = sectionWidths[0];
        const center = Math.max(10, Math.min(80, pct - left));
        const right = 100 - left - center;
        if (right >= 10) setSectionWidths([left, center, right]);
      }
    },
    [sectionWidths]
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (dragging === null) return;
      handleDividerMove(dragging, e.clientX);
    },
    [dragging, handleDividerMove]
  );
  const handleMouseUp = useCallback(() => setDragging(null), []);

  React.useEffect(() => {
    if (dragging === null) return;
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragging, handleMouseMove, handleMouseUp]);

  const label = kind === 'header' ? 'Header' : 'Footer';
  const positions: ZonePos[] = ['left', 'center', 'right'];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <span className="text-gray-500">Divide into:</span>
        <span className="font-medium text-gray-700">3 sections</span>
        <span className="text-gray-300">|</span>
        <span className="text-gray-500">Include on:</span>
        <select className="rounded border border-gray-300 px-2 py-1.5 text-sm bg-white" defaultValue="all">
          <option value="all">All Pages</option>
        </select>
        <span className="text-gray-300">|</span>
        <span className="text-gray-500">Height:</span>
        <input
          type="number"
          min={8}
          max={40}
          value={heightMm}
          onChange={(e) => onAppearanceChange({ heightMm: Number(e.target.value) })}
          className="w-14 rounded border border-gray-300 px-2 py-1.5 text-sm"
        />
        <span className="text-gray-500">mm</span>
        <span className="text-gray-300">|</span>
        <span className="text-gray-500">Background:</span>
        <input
          type="color"
          value={bgColor}
          onChange={(e) => onAppearanceChange({ bgColor: e.target.value })}
          className="h-7 w-9 rounded border border-gray-300 cursor-pointer"
        />
        <label className="flex items-center gap-2 text-gray-600">
          <input
            type="checkbox"
            checked={showBorder}
            onChange={(e) => onAppearanceChange({ showBorder: e.target.checked })}
            className="rounded border-gray-300"
          />
          Show border
        </label>
        {showBorder && (
          <>
            <span className="text-gray-500">Border colour:</span>
            <input
              type="color"
              value={borderColor}
              onChange={(e) => onAppearanceChange({ borderColor: e.target.value })}
              className="h-7 w-9 rounded border border-gray-300 cursor-pointer"
            />
          </>
        )}
      </div>

      <p className="text-xs text-gray-500 uppercase tracking-wider">↔ drag dividers to resize sections</p>
      <div
        ref={bandRef}
        className="rounded-lg border-2 border-gray-200 overflow-hidden"
        style={{
          backgroundColor: bgColor,
          color: textColor,
          borderBottom: showBorder ? `3px solid ${borderColor}` : undefined,
        }}
      >
        <div className="flex" style={{ height: `${Math.max(48, heightMm * 2)}px` }}>
          {positions.map((pos, i) => (
            <React.Fragment key={pos}>
              <div
                role="button"
                tabIndex={0}
                onClick={() => onSelectZone(kind, pos)}
                onKeyDown={(e) => e.key === 'Enter' && onSelectZone(kind, pos)}
                className={`flex flex-col justify-center px-3 cursor-pointer transition-colors ${
                  selectedZone?.band === kind && selectedZone?.position === pos
                    ? 'ring-2 ring-blue-500 ring-inset'
                    : 'hover:bg-white/10'
                }`}
                style={{ width: `${sectionWidths[i]}%`, minWidth: 60 }}
              >
                <span className="text-xs font-medium opacity-80">{POS_LABELS[pos]} ({(sectionWidths[i] | 0)}%)</span>
                <span className="text-xs opacity-70 truncate">
                  {zones[pos].items.length === 0
                    ? 'Text/Logo'
                    : zones[pos].items.map((it) => itemLabel(it)).join(', ')}
                </span>
              </div>
              {i < 2 && (
                <div
                  role="button"
                  tabIndex={0}
                  onMouseDown={() => setDragging(i as 0 | 1)}
                  className="w-2 flex-shrink-0 cursor-col-resize bg-black/20 hover:bg-blue-500 transition-colors flex items-center justify-center"
                  aria-label="Resize section"
                >
                  <span className="text-white text-xs opacity-70">⋮</span>
                </div>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {selectedZone?.band === kind && (
        <div className="border border-gray-200 rounded-lg bg-white p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">
              Editing: {POS_LABELS[selectedZone.position]}
            </h3>
            <button
              type="button"
              onClick={() => clearSection(selectedZone.position)}
              className="text-xs text-red-600 hover:text-red-700 font-medium"
            >
              Clear section
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {zones[selectedZone.position].items.map((item, idx) => (
              <div
                key={item.id}
                className="rounded border border-gray-200 bg-gray-50 px-3 py-2 text-xs flex items-center gap-2"
              >
                <span className="text-gray-500">
                  {item.type === 'text' && 'T'}
                  {item.type === 'variable' && '{}'}
                  {item.type === 'image' && '🖼'}
                </span>
                <span className="truncate max-w-[160px]">{itemLabel(item)}</span>
                <button
                  type="button"
                  onClick={() => removeItem(selectedZone.position, idx)}
                  className="text-gray-400 hover:text-red-600"
                  aria-label="Remove"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <ZoneItemPicker
            defaultTextColor={textColor}
            onAdd={(item) => addItem(selectedZone.position, item)}
            orgLogoUrl={orgLogoUrl}
            logoLibrary={logoLibrary}
            onUploadLogo={onUploadLogo}
          />
        </div>
      )}
    </div>
  );
}
