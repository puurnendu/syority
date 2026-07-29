'use client';

import { useCallback, useEffect, useState } from 'react';
import { useHierarchySettings } from '@/lib/useHierarchySettings';

// ── Types ─────────────────────────────────────────────────────────────────────

export type HierarchyLevel = 'site' | 'plant' | 'area' | 'unit' | 'system' | 'asset';

export type HierarchySelection = {
  site_id: string;
  plant_id: string;
  area_id: string;
  unit_id: string;
  system_id: string;
  asset_id: string;
};

type Option = { id: string; name: string; code?: string | null };

export interface HierarchySelectorProps {
  /** Current selection — parent controls the state */
  value: Partial<HierarchySelection>;
  /** Called when any level changes */
  onChange: (selection: Partial<HierarchySelection>) => void;
  /** Stop cascading at this level (inclusive). Default: 'asset' */
  requiredLevel?: HierarchyLevel;
  /** Override the auto-detected use_areas flag */
  showArea?: boolean;
  /** Disable all dropdowns */
  disabled?: boolean;
  /** CSS class for the container */
  className?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const LEVELS: HierarchyLevel[] = ['site', 'plant', 'area', 'unit', 'system', 'asset'];

function levelIndex(level: HierarchyLevel): number {
  return LEVELS.indexOf(level);
}

function labelFor(option: Option): string {
  return option.code ? `${option.code} — ${option.name}` : option.name;
}

async function fetchChildren(level: HierarchyLevel, parentId?: string): Promise<Option[]> {
  const params = new URLSearchParams({ level });
  if (parentId) params.set('parentId', parentId);
  const res = await fetch(`/api/hierarchy/children?${params}`);
  if (!res.ok) return [];
  const data = await res.json();
  return data.items ?? [];
}

// ── Component ─────────────────────────────────────────────────────────────────

export function HierarchySelector({
  value,
  onChange,
  requiredLevel = 'asset',
  showArea: showAreaProp,
  disabled = false,
  className,
}: HierarchySelectorProps) {
  const { useAreas: orgUseAreas } = useHierarchySettings();
  const showArea = showAreaProp ?? orgUseAreas;

  // Options for each level
  const [siteOpts, setSiteOpts] = useState<Option[]>([]);
  const [plantOpts, setPlantOpts] = useState<Option[]>([]);
  const [areaOpts, setAreaOpts] = useState<Option[]>([]);
  const [unitOpts, setUnitOpts] = useState<Option[]>([]);
  const [systemOpts, setSystemOpts] = useState<Option[]>([]);
  const [assetOpts, setAssetOpts] = useState<Option[]>([]);

  const maxLevel = levelIndex(requiredLevel);

  // Determine which levels to render
  const visibleLevels = LEVELS.filter((l) => {
    if (l === 'area' && !showArea) return false;
    return levelIndex(l) <= maxLevel;
  });

  // ── Auto-load sites on mount ──────────────────────────────────────────

  useEffect(() => {
    fetchChildren('site').then((opts) => {
      setSiteOpts(opts);
      // Auto-select if single option
      if (opts.length === 1 && !value.site_id) {
        onChange({ ...value, site_id: opts[0].id });
      }
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Cascade loaders ───────────────────────────────────────────────────

  const loadLevel = useCallback(
    async (level: HierarchyLevel, parentId: string | undefined) => {
      if (!parentId) return;
      const opts = await fetchChildren(level, parentId);
      switch (level) {
        case 'plant':
          setPlantOpts(opts);
          setAreaOpts([]);
          setUnitOpts([]);
          setSystemOpts([]);
          setAssetOpts([]);
          if (opts.length === 1) {
            onChange({ ...value, plant_id: opts[0].id, area_id: '', unit_id: '', system_id: '', asset_id: '' });
          }
          break;
        case 'area':
          setAreaOpts(opts);
          setUnitOpts([]);
          setSystemOpts([]);
          setAssetOpts([]);
          if (opts.length === 1) {
            onChange({ ...value, area_id: opts[0].id, unit_id: '', system_id: '', asset_id: '' });
          }
          break;
        case 'unit':
          setUnitOpts(opts);
          setSystemOpts([]);
          setAssetOpts([]);
          if (opts.length === 1) {
            onChange({ ...value, unit_id: opts[0].id, system_id: '', asset_id: '' });
          }
          break;
        case 'system':
          setSystemOpts(opts);
          setAssetOpts([]);
          if (opts.length === 1) {
            onChange({ ...value, system_id: opts[0].id, asset_id: '' });
          }
          break;
        case 'asset':
          setAssetOpts(opts);
          if (opts.length === 1) {
            onChange({ ...value, asset_id: opts[0].id });
          }
          break;
      }
    },
    [value, onChange]
  );

  // Cascade effects
  useEffect(() => {
    if (value.site_id && maxLevel >= 1) loadLevel('plant', value.site_id);
  }, [value.site_id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (value.plant_id && showArea) loadLevel('area', value.plant_id);
    if (value.plant_id && !showArea && maxLevel >= 3) loadLevel('unit', value.plant_id);
  }, [value.plant_id, showArea]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (value.area_id && maxLevel >= 3) loadLevel('unit', value.area_id);
  }, [value.area_id]); // eslint-disable-line react-hooks/exhaustive-deps

  // When areas disabled, unit parent is plant; when area selected, unit parent is area
  useEffect(() => {
    if (!showArea && value.plant_id && maxLevel >= 3) {
      // Already handled above
    }
  }, [value.plant_id, showArea]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (value.unit_id && maxLevel >= 4) loadLevel('system', value.unit_id);
  }, [value.unit_id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (value.system_id && maxLevel >= 5) loadLevel('asset', value.system_id);
  }, [value.system_id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Change handlers ───────────────────────────────────────────────────

  const handleChange = (level: HierarchyLevel, id: string) => {
    const next = { ...value };
    switch (level) {
      case 'site':
        next.site_id = id;
        next.plant_id = '';
        next.area_id = '';
        next.unit_id = '';
        next.system_id = '';
        next.asset_id = '';
        break;
      case 'plant':
        next.plant_id = id;
        next.area_id = '';
        next.unit_id = '';
        next.system_id = '';
        next.asset_id = '';
        break;
      case 'area':
        next.area_id = id;
        next.unit_id = '';
        next.system_id = '';
        next.asset_id = '';
        break;
      case 'unit':
        next.unit_id = id;
        next.system_id = '';
        next.asset_id = '';
        break;
      case 'system':
        next.system_id = id;
        next.asset_id = '';
        break;
      case 'asset':
        next.asset_id = id;
        break;
    }
    onChange(next);
  };

  // ── Option maps ───────────────────────────────────────────────────────

  function getOpts(level: HierarchyLevel): Option[] {
    switch (level) {
      case 'site': return siteOpts;
      case 'plant': return plantOpts;
      case 'area': return areaOpts;
      case 'unit': return unitOpts;
      case 'system': return systemOpts;
      case 'asset': return assetOpts;
    }
  }

  function getVal(level: HierarchyLevel): string {
    switch (level) {
      case 'site': return value.site_id ?? '';
      case 'plant': return value.plant_id ?? '';
      case 'area': return value.area_id ?? '';
      case 'unit': return value.unit_id ?? '';
      case 'system': return value.system_id ?? '';
      case 'asset': return value.asset_id ?? '';
    }
  }

  function isLevelDisabled(level: HierarchyLevel): boolean {
    if (disabled) return true;
    if (level === 'site') return false;
    if (level === 'plant') return !value.site_id;
    if (level === 'area') return !value.plant_id;
    if (level === 'unit') return showArea ? !value.area_id && !value.plant_id : !value.plant_id;
    if (level === 'system') return !value.unit_id;
    if (level === 'asset') return !value.system_id;
    return false;
  }

  const LABELS: Record<HierarchyLevel, string> = {
    site: 'Site',
    plant: 'Plant',
    area: 'Area (optional)',
    unit: 'Unit',
    system: 'System',
    asset: 'Equipment / Asset',
  };

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 ${className ?? ''}`}>
      {visibleLevels.map((level) => {
        const opts = getOpts(level);
        const val = getVal(level);
        const isDisabled = isLevelDisabled(level);
        const isRequired = level !== 'area'; // Area is always optional

        return (
          <div key={level}>
            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
              {LABELS[level]}{isRequired && level !== 'area' ? ' *' : ''}
            </label>
            <select
              value={val}
              onChange={(e) => handleChange(level, e.target.value)}
              disabled={isDisabled}
              className={`w-full px-3 py-2 border rounded-lg text-sm transition-colors
                ${isDisabled ? 'bg-gray-50 text-gray-400 border-gray-200 cursor-not-allowed' : 'bg-white text-gray-900 border-gray-300 hover:border-gray-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500'}
              `}
            >
              <option value="">{isDisabled ? '—' : `Select ${LABELS[level].replace(' (optional)', '')}…`}</option>
              {opts.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {labelFor(opt)}
                </option>
              ))}
            </select>
          </div>
        );
      })}
    </div>
  );
}
