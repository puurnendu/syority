import { resolveVariables } from '@/lib/printVariables';
import type { ZoneItem, Zone, HeaderFooterZones } from '@/types/printSettings.types';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function renderZoneItemHtml(
  item: ZoneItem,
  workpack: Record<string, unknown>,
  pageNum?: string,
  totalPages?: string
): string {
  if (item.type === 'text') {
    return `<span style="
      font-size: ${item.fontSize ?? 11}px;
      font-weight: ${item.fontWeight ?? 'normal'};
      font-style: ${item.fontStyle ?? 'normal'};
      color: ${item.color ?? 'inherit'};
      opacity: ${item.opacity ?? 1};
    ">${escapeHtml(item.text ?? '')}</span>`;
  }

  if (item.type === 'variable') {
    const code = item.variableCode ?? '';
    if (code === '{page}') {
      return `<span class="pageNumber" style="font-size: ${item.fontSize ?? 11}px; font-weight: ${item.fontWeight ?? 'normal'}; font-style: ${item.fontStyle ?? 'normal'}; color: ${item.color ?? 'inherit'};"></span>`;
    }
    if (code === '{total_pages}') {
      return `<span class="totalPages" style="font-size: ${item.fontSize ?? 11}px; font-weight: ${item.fontWeight ?? 'normal'}; font-style: ${item.fontStyle ?? 'normal'}; color: ${item.color ?? 'inherit'};"></span>`;
    }
    const resolved = resolveVariables(
      code,
      workpack as Parameters<typeof resolveVariables>[1],
      pageNum != null ? parseInt(pageNum, 10) : undefined,
      totalPages != null ? parseInt(totalPages, 10) : undefined
    );
    return `<span style="
      font-size: ${item.fontSize ?? 11}px;
      font-weight: ${item.fontWeight ?? 'normal'};
      font-style: ${item.fontStyle ?? 'normal'};
      color: ${item.color ?? 'inherit'};
    ">${escapeHtml(resolved)}</span>`;
  }

  if (item.type === 'image') {
    if (!item.imageUrl) return '';
    return `<img
      src="${escapeHtml(item.imageUrl)}"
      alt="${escapeHtml(item.imageName ?? '')}"
      style="
        width: ${item.imageWidthPx ?? 80}px;
        height: ${item.imageHeightPx ?? 28}px;
        object-fit: ${item.imageObjectFit ?? 'contain'};
        display: block;
      "
    />`;
  }

  return '';
}

type BandSettings = {
  bg_color: string;
  text_color: string;
  height_mm: number;
  border_color?: string;
  show_border?: boolean;
};

export function renderBandHtml(
  zones: HeaderFooterZones,
  settings: BandSettings,
  workpack: Record<string, unknown>,
  pageNum?: string,
  totalPages?: string
): string {
  const alignMap = {
    left: 'flex-start',
    center: 'center',
    right: 'flex-end',
  };

  const renderZone = (zone: Zone | undefined, align: 'left' | 'center' | 'right') => {
    const items = zone?.items ?? [];
    const itemsHtml = items
      .map((item) => renderZoneItemHtml(item, workpack, pageNum, totalPages))
      .filter(Boolean)
      .join('');
    return `
      <div style="
        flex: 1;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: ${alignMap[align]};
        text-align: ${align};
        padding: 0 4px;
        overflow: hidden;
        color: ${settings.text_color};
      ">
        ${itemsHtml}
      </div>
    `;
  };

  const borderStyle =
    settings.show_border && settings.border_color
      ? `border-bottom: 2px solid ${settings.border_color};`
      : '';

  return `
    <div style="
      width: 100%;
      height: ${settings.height_mm}mm;
      background-color: ${settings.bg_color};
      background: ${settings.bg_color};
      color: ${settings.text_color};
      display: flex;
      align-items: center;
      padding: 0 15mm;
      font-family: Arial, sans-serif;
      box-sizing: border-box;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      ${borderStyle}
    ">
      ${renderZone(zones.left, 'left')}
      ${renderZone(zones.center, 'center')}
      ${renderZone(zones.right, 'right')}
    </div>
  `;
}
