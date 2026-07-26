import type { HeaderFooterZones } from '@/types/printSettings.types';
import { DEFAULT_HEADER_ZONES, DEFAULT_FOOTER_ZONES } from '@/types/printSettings.types';

/**
 * Safely parse header/footer zones from DB (JsonValue may be object or string).
 * Ensures .left.items, .center.items, .right.items are always arrays.
 */
export function parseZones(raw: unknown, defaults: HeaderFooterZones): HeaderFooterZones {
  if (!raw) return defaults;

  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return parseZones(parsed, defaults);
    } catch {
      return defaults;
    }
  }

  if (typeof raw === 'object' && raw !== null && 'left' in raw && 'center' in raw && 'right' in raw) {
    const o = raw as Record<string, unknown>;
    return {
      left: {
        items: Array.isArray((o.left as any)?.items) ? (o.left as any).items : [],
        textAlign: ((o.left as any)?.textAlign as 'left' | 'center' | 'right') ?? 'left',
      },
      center: {
        items: Array.isArray((o.center as any)?.items) ? (o.center as any).items : [],
        textAlign: ((o.center as any)?.textAlign as 'left' | 'center' | 'right') ?? 'center',
      },
      right: {
        items: Array.isArray((o.right as any)?.items) ? (o.right as any).items : [],
        textAlign: ((o.right as any)?.textAlign as 'left' | 'center' | 'right') ?? 'right',
      },
    } as HeaderFooterZones;
  }

  return defaults;
}

export { DEFAULT_HEADER_ZONES, DEFAULT_FOOTER_ZONES };
