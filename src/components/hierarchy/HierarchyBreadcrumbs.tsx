'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { HierarchyLevel } from './HierarchySelector';

// ── Types ─────────────────────────────────────────────────────────────────────

type PathSegment = {
  level: HierarchyLevel;
  id: string;
  name: string;
  code?: string | null;
};

interface HierarchyBreadcrumbsProps {
  /** Entity type to trace upward from */
  entityType: HierarchyLevel;
  /** Entity UUID */
  entityId: string;
  /** If true, prepend tenant/company name */
  showCompany?: boolean;
  /** CSS class for the nav element */
  className?: string;
}

// ── URL mapping ───────────────────────────────────────────────────────────────

const LEVEL_URLS: Record<HierarchyLevel, string> = {
  site: '/settings/hierarchy/sites',
  plant: '/settings/hierarchy/plants',
  area: '/settings/hierarchy/areas',
  unit: '/settings/hierarchy/units',
  system: '/settings/hierarchy/systems',
  asset: '/settings/hierarchy/assets',
};

const LEVEL_ICONS: Record<HierarchyLevel, string> = {
  site: '📍',
  plant: '🏭',
  area: '🗺️',
  unit: '⚙️',
  system: '🔗',
  asset: '🏷️',
};

// ── Component ─────────────────────────────────────────────────────────────────

export function HierarchyBreadcrumbs({
  entityType,
  entityId,
  showCompany = false,
  className,
}: HierarchyBreadcrumbsProps) {
  const [path, setPath] = useState<PathSegment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!entityId || !entityType) {
      setLoading(false);
      return;
    }

    const params = new URLSearchParams({ type: entityType, id: entityId });
    fetch(`/api/hierarchy/path?${params}`)
      .then((r) => (r.ok ? r.json() : { path: [] }))
      .then((data) => setPath(data.path ?? []))
      .catch(() => setPath([]))
      .finally(() => setLoading(false));
  }, [entityType, entityId]);

  if (loading) {
    return (
      <nav className={`flex items-center gap-1 text-xs text-gray-400 animate-pulse ${className ?? ''}`}>
        <span className="bg-gray-200 rounded h-4 w-20" />
        <span>›</span>
        <span className="bg-gray-200 rounded h-4 w-16" />
        <span>›</span>
        <span className="bg-gray-200 rounded h-4 w-24" />
      </nav>
    );
  }

  if (path.length === 0) return null;

  return (
    <nav className={`flex items-center flex-wrap gap-1 text-xs ${className ?? ''}`}>
      {path.map((segment, idx) => {
        const isLast = idx === path.length - 1;
        const label = segment.code || segment.name;
        const icon = LEVEL_ICONS[segment.level] || '';

        return (
          <span key={segment.id} className="flex items-center gap-1">
            {idx > 0 && (
              <span className="text-gray-300 mx-0.5" aria-hidden>›</span>
            )}
            {isLast ? (
              <span className="font-semibold text-gray-900">
                {icon && <span className="mr-0.5">{icon}</span>}
                {label}
              </span>
            ) : (
              <Link
                href={LEVEL_URLS[segment.level] || '#'}
                className="text-gray-500 hover:text-indigo-600 transition-colors"
                title={`${segment.level}: ${segment.name}`}
              >
                {icon && <span className="mr-0.5">{icon}</span>}
                {label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
