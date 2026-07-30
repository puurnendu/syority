/**
 * M7.6D — Cockpit Library Page
 *
 * Route: /ois/cockpits
 * Browse and deploy pre-built cockpit templates.
 */

'use client';

import React, { useMemo, useState } from 'react';
import { CockpitLibraryService, type CockpitCategory, type CockpitTemplate } from '@/core/ois/CockpitLibraryService';

const CATEGORIES: { key: CockpitCategory | 'all'; label: string; icon: string }[] = [
  { key: 'all', label: 'All', icon: '📊' },
  { key: 'planning', label: 'Planning', icon: '📅' },
  { key: 'execution', label: 'Execution', icon: '⚡' },
  { key: 'safety', label: 'Safety', icon: '🛡️' },
  { key: 'workforce', label: 'Workforce', icon: '👷' },
  { key: 'shutdown', label: 'Shutdown', icon: '🔧' },
  { key: 'management', label: 'Management', icon: '📈' },
  { key: 'executive', label: 'Executive', icon: '🏢' },
];

export default function CockpitLibraryPage() {
  const library = useMemo(() => new CockpitLibraryService(), []);
  const [category, setCategory] = useState<CockpitCategory | 'all'>('all');
  const [search, setSearch] = useState('');
  const [deploying, setDeploying] = useState<string | null>(null);

  const cockpits = useMemo(() => {
    let results = category === 'all' ? library.getAll() : library.getByCategory(category);
    if (search) {
      results = results.filter((c) =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.description.toLowerCase().includes(search.toLowerCase())
      );
    }
    return results;
  }, [library, category, search]);

  const handleDeploy = async (cockpit: CockpitTemplate) => {
    setDeploying(cockpit.slug);
    try {
      const res = await fetch('/api/ois/dashboards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: cockpit.name,
          description: cockpit.description,
          category: cockpit.category,
          icon: cockpit.icon,
          theme: cockpit.defaultTheme,
          template_slug: cockpit.slug,
          pages: cockpit.pages,
        }),
      });
      if (res.ok) {
        const json = await res.json();
        window.location.href = `/ois/builder/${json.data.id}`;
      }
    } catch { /* ignore */ }
    setDeploying(null);
  };

  return (
    <div style={{ minHeight: '100vh', background: '#F8FAFC', padding: '24px' }}>
      {/* Header */}
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 800, color: '#111827', marginBottom: '4px' }}>
          📊 Cockpit Library
        </h1>
        <p style={{ fontSize: '14px', color: '#6B7280', marginBottom: '24px' }}>
          Pre-built dashboard templates for turnaround, shutdown, and maintenance operations.
        </p>

        {/* Search + Filter */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
          <input
            style={{
              padding: '10px 16px',
              border: '1px solid #E5E7EB',
              borderRadius: '8px',
              fontSize: '14px',
              width: '300px',
              outline: 'none',
            }}
            placeholder="Search cockpits..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div style={{ display: 'flex', gap: '4px' }}>
            {CATEGORIES.map((cat) => (
              <button
                key={cat.key}
                onClick={() => setCategory(cat.key)}
                style={{
                  padding: '8px 14px',
                  borderRadius: '8px',
                  border: category === cat.key ? '2px solid #3B82F6' : '1px solid #E5E7EB',
                  background: category === cat.key ? '#EFF6FF' : '#FFF',
                  color: category === cat.key ? '#3B82F6' : '#6B7280',
                  fontSize: '12px',
                  fontWeight: category === cat.key ? 600 : 400,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {cat.icon} {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
          gap: '20px',
        }}>
          {cockpits.map((cockpit) => (
            <div
              key={cockpit.slug}
              style={{
                background: '#FFF',
                borderRadius: '16px',
                border: '1px solid #E5E7EB',
                overflow: 'hidden',
                transition: 'box-shadow 0.2s, transform 0.2s',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLDivElement).style.boxShadow = '0 8px 32px rgba(0,0,0,0.08)';
                (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLDivElement).style.boxShadow = 'none';
                (e.currentTarget as HTMLDivElement).style.transform = 'none';
              }}
            >
              {/* Thumbnail area */}
              <div style={{
                height: '120px',
                background: `linear-gradient(135deg, ${cockpit.category === 'safety' ? '#DC2626' : cockpit.category === 'workforce' ? '#F59E0B' : cockpit.category === 'executive' ? '#6366F1' : '#3B82F6'}20, ${cockpit.category === 'safety' ? '#DC2626' : '#3B82F6'}10)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '48px',
              }}>
                {cockpit.icon}
              </div>

              {/* Content */}
              <div style={{ padding: '16px' }}>
                <div style={{ fontSize: '16px', fontWeight: 700, color: '#111827', marginBottom: '4px' }}>
                  {cockpit.name}
                </div>
                <div style={{ fontSize: '12px', color: '#6B7280', lineHeight: 1.5, marginBottom: '12px' }}>
                  {cockpit.description}
                </div>

                {/* Meta */}
                <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '10px', padding: '3px 8px', borderRadius: '4px', background: '#F3F4F6', color: '#6B7280' }}>
                    {cockpit.pages.length} page{cockpit.pages.length > 1 ? 's' : ''}
                  </span>
                  <span style={{ fontSize: '10px', padding: '3px 8px', borderRadius: '4px', background: '#F3F4F6', color: '#6B7280' }}>
                    {cockpit.pages.reduce((s, p) => s + p.widgets.length, 0)} widgets
                  </span>
                  {cockpit.supportedModes.map((m) => (
                    <span key={m} style={{ fontSize: '10px', padding: '3px 8px', borderRadius: '4px', background: '#F0FDF4', color: '#059669' }}>
                      {m === 'tv' ? '📺 TV' : m === 'meeting' ? '📋 Meeting' : m === 'pdf' ? '📄 PDF' : '👁️ View'}
                    </span>
                  ))}
                </div>

                <button
                  onClick={() => handleDeploy(cockpit)}
                  disabled={deploying === cockpit.slug}
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '8px',
                    border: 'none',
                    background: deploying === cockpit.slug ? '#D1D5DB' : 'linear-gradient(135deg, #3B82F6, #8B5CF6)',
                    color: '#FFF',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: deploying === cockpit.slug ? 'wait' : 'pointer',
                  }}
                >
                  {deploying === cockpit.slug ? '⏳ Deploying...' : '🚀 Deploy'}
                </button>
              </div>
            </div>
          ))}
        </div>

        {cockpits.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px', color: '#9CA3AF' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔍</div>
            <div style={{ fontSize: '16px' }}>No cockpits match your search.</div>
          </div>
        )}
      </div>
    </div>
  );
}
