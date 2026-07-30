/**
 * M7.6C — Widget Palette
 *
 * Sidebar palette for browsing and adding widgets to a dashboard.
 * Groups by category, shows visualization preview.
 */

'use client';

import React, { useState, useEffect, useMemo } from 'react';
import type { WidgetCategory } from '@/core/ois/WidgetSDK';

// ─── Types ──────────────────────────────────────────────────────────────────

interface WidgetDefinition {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  category: string;
  icon: string | null;
  visualization_type: string;
  provider_key: string;
}

interface WidgetPaletteProps {
  onAddWidget: (widgetDef: WidgetDefinition) => void;
  isOpen: boolean;
  onClose: () => void;
}

// ─── Category Config ────────────────────────────────────────────────────────

const CATEGORY_META: Record<string, { label: string; icon: string; color: string }> = {
  safety: { label: 'Safety', icon: '🦺', color: '#DC2626' },
  planning: { label: 'Planning', icon: '📋', color: '#3B82F6' },
  execution: { label: 'Execution', icon: '📈', color: '#10B981' },
  shutdown: { label: 'Shutdown', icon: '🔧', color: '#F59E0B' },
  workforce: { label: 'Workforce', icon: '👷', color: '#8B5CF6' },
  management: { label: 'Management', icon: '📊', color: '#EC4899' },
  platform: { label: 'Platform', icon: '⚙️', color: '#6B7280' },
  custom: { label: 'Custom', icon: '🎨', color: '#14B8A6' },
};

// ─── Component ──────────────────────────────────────────────────────────────

export function WidgetPalette({ onAddWidget, isOpen, onClose }: WidgetPaletteProps) {
  const [widgets, setWidgets] = useState<WidgetDefinition[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch widget definitions
  useEffect(() => {
    if (!isOpen) return;
    setIsLoading(true);
    fetch('/api/ois/widgets')
      .then((res) => res.json())
      .then((json) => setWidgets(json.data ?? []))
      .catch(() => setWidgets([]))
      .finally(() => setIsLoading(false));
  }, [isOpen]);

  const categories = useMemo(() => {
    const cats = new Set(widgets.map((w) => w.category));
    return Array.from(cats).sort();
  }, [widgets]);

  const filteredWidgets = useMemo(() => {
    let filtered = widgets;
    if (selectedCategory) filtered = filtered.filter((w) => w.category === selectedCategory);
    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (w) =>
          w.name.toLowerCase().includes(lower) ||
          w.category.toLowerCase().includes(lower) ||
          (w.description ?? '').toLowerCase().includes(lower),
      );
    }
    return filtered;
  }, [widgets, selectedCategory, searchTerm]);

  const grouped = useMemo(() => {
    const groups: Record<string, WidgetDefinition[]> = {};
    for (const w of filteredWidgets) {
      if (!groups[w.category]) groups[w.category] = [];
      groups[w.category].push(w);
    }
    return groups;
  }, [filteredWidgets]);

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      right: 0,
      width: '360px',
      height: '100vh',
      background: '#FFFFFF',
      borderLeft: '1px solid #E5E7EB',
      boxShadow: '-4px 0 24px rgba(0,0,0,0.1)',
      zIndex: 50,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '16px 20px',
        borderBottom: '1px solid #E5E7EB',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#111827' }}>
          📊 Widget Palette
        </h2>
        <button
          onClick={onClose}
          style={{
            width: '28px',
            height: '28px',
            borderRadius: '6px',
            border: 'none',
            background: '#F3F4F6',
            cursor: 'pointer',
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          ✕
        </button>
      </div>

      {/* Search */}
      <div style={{ padding: '12px 20px' }}>
        <input
          type="text"
          placeholder="Search widgets..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            width: '100%',
            padding: '8px 12px',
            border: '1px solid #E5E7EB',
            borderRadius: '8px',
            fontSize: '13px',
            outline: 'none',
          }}
        />
      </div>

      {/* Category Filters */}
      <div style={{ padding: '0 20px 12px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        <button
          onClick={() => setSelectedCategory(null)}
          style={{
            padding: '4px 10px',
            borderRadius: '6px',
            border: '1px solid',
            borderColor: !selectedCategory ? '#3B82F6' : '#E5E7EB',
            background: !selectedCategory ? '#EFF6FF' : '#FFF',
            color: !selectedCategory ? '#3B82F6' : '#6B7280',
            fontSize: '11px',
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          All
        </button>
        {categories.map((cat) => {
          const meta = CATEGORY_META[cat] ?? { label: cat, icon: '📊', color: '#6B7280' };
          const active = selectedCategory === cat;
          return (
            <button
              key={cat}
              onClick={() => setSelectedCategory(active ? null : cat)}
              style={{
                padding: '4px 10px',
                borderRadius: '6px',
                border: '1px solid',
                borderColor: active ? meta.color : '#E5E7EB',
                background: active ? `${meta.color}10` : '#FFF',
                color: active ? meta.color : '#6B7280',
                fontSize: '11px',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              {meta.icon} {meta.label}
            </button>
          );
        })}
      </div>

      {/* Widget List */}
      <div style={{ flex: 1, overflow: 'auto', padding: '0 20px 20px' }}>
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#9CA3AF' }}>Loading widgets...</div>
        ) : Object.keys(grouped).length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#9CA3AF' }}>No widgets found</div>
        ) : (
          Object.entries(grouped).map(([cat, catWidgets]) => {
            const meta = CATEGORY_META[cat] ?? { label: cat, icon: '📊', color: '#6B7280' };
            return (
              <div key={cat} style={{ marginBottom: '20px' }}>
                <h3 style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#6B7280',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  margin: '0 0 8px',
                }}>
                  {meta.icon} {meta.label}
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {catWidgets.map((w) => (
                    <button
                      key={w.id}
                      onClick={() => onAddWidget(w)}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '10px',
                        padding: '10px 12px',
                        borderRadius: '8px',
                        border: '1px solid #E5E7EB',
                        background: '#FFF',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'border-color 0.15s, box-shadow 0.15s',
                        width: '100%',
                      }}
                    >
                      <span style={{ fontSize: '20px', flexShrink: 0 }}>{w.icon ?? '📊'}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: '#111827' }}>{w.name}</div>
                        <div style={{
                          fontSize: '11px',
                          color: '#9CA3AF',
                          marginTop: '2px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}>
                          {w.description ?? w.visualization_type}
                        </div>
                        <div style={{
                          fontSize: '10px',
                          color: meta.color,
                          marginTop: '4px',
                          fontWeight: 500,
                        }}>
                          {w.visualization_type.replace(/_/g, ' ')}
                        </div>
                      </div>
                      <span style={{ fontSize: '16px', color: '#D1D5DB', alignSelf: 'center' }}>+</span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
