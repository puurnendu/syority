/**
 * M7.6C — OIS Dashboard Library Page
 *
 * Lists all dashboards, templates, and cockpits for the organization.
 * Entry point into the OIS module.
 */

'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

// ─── Types ──────────────────────────────────────────────────────────────────

interface Dashboard {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  dashboard_type: string;
  category: string | null;
  icon: string | null;
  is_template: boolean;
  is_published: boolean;
  is_system: boolean;
  theme: string;
  updated_at: string;
  _count?: { widgets: number; pages: number };
}

type ViewTab = 'dashboards' | 'cockpits' | 'templates' | 'tv';

// ─── Component ──────────────────────────────────────────────────────────────

export default function OISPage() {
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ViewTab>('dashboards');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createType, setCreateType] = useState('dashboard');

  useEffect(() => {
    setIsLoading(true);
    fetch('/api/ois/dashboards?includeTemplates=true&pageSize=100')
      .then((res) => res.json())
      .then((json) => setDashboards(json.data ?? []))
      .catch(() => setDashboards([]))
      .finally(() => setIsLoading(false));
  }, []);

  const filtered = dashboards.filter((d) => {
    switch (activeTab) {
      case 'dashboards': return d.dashboard_type === 'dashboard' && !d.is_template;
      case 'cockpits': return d.dashboard_type === 'cockpit' && !d.is_template;
      case 'templates': return d.is_template;
      case 'tv': return d.dashboard_type === 'tv' || d.dashboard_type === 'meeting';
      default: return true;
    }
  });

  const handleCreate = async () => {
    if (!createName.trim()) return;
    const slug = createName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const res = await fetch('/api/ois/dashboards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: createName, slug, dashboardType: createType }),
    });
    if (res.ok) {
      const json = await res.json();
      window.location.href = `/ois/builder/${json.data.id}`;
    }
  };

  const handleClone = async (id: string, name: string) => {
    const newName = `${name} (Copy)`;
    const slug = newName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const res = await fetch(`/api/ois/dashboards/${id}/clone`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName, slug }),
    });
    if (res.ok) {
      const json = await res.json();
      window.location.href = `/ois/builder/${json.data.id}`;
    }
  };

  const TYPE_ICON: Record<string, string> = {
    dashboard: '📊', cockpit: '🎛️', tv: '📺', meeting: '☀️',
  };

  const TABS: { key: ViewTab; label: string; icon: string }[] = [
    { key: 'dashboards', label: 'Dashboards', icon: '📊' },
    { key: 'cockpits', label: 'Cockpits', icon: '🎛️' },
    { key: 'templates', label: 'Templates', icon: '📋' },
    { key: 'tv', label: 'TV & Meeting', icon: '📺' },
  ];

  return (
    <div style={{ padding: '32px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 800, color: '#111827' }}>
            🧠 Operational Intelligence Studio
          </h1>
          <p style={{ margin: '8px 0 0', fontSize: '14px', color: '#6B7280' }}>
            Build, customize, and publish enterprise dashboards, cockpits, and live displays.
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          style={{
            padding: '10px 20px',
            borderRadius: '10px',
            border: 'none',
            background: 'linear-gradient(135deg, #3B82F6, #8B5CF6)',
            color: '#FFF',
            fontSize: '14px',
            fontWeight: 600,
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(59,130,246,0.3)',
            transition: 'transform 0.15s',
          }}
        >
          + New Dashboard
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '24px', borderBottom: '1px solid #E5E7EB', paddingBottom: '0' }}>
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '10px 18px',
              border: 'none',
              background: 'transparent',
              color: activeTab === tab.key ? '#3B82F6' : '#6B7280',
              fontSize: '14px',
              fontWeight: activeTab === tab.key ? 600 : 400,
              cursor: 'pointer',
              borderBottom: activeTab === tab.key ? '2px solid #3B82F6' : '2px solid transparent',
              marginBottom: '-1px',
              transition: 'color 0.15s',
            }}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Grid */}
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: '#9CA3AF' }}>Loading dashboards...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px', color: '#9CA3AF' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>📭</div>
          <div style={{ fontSize: '16px', fontWeight: 600, color: '#6B7280' }}>No {activeTab} yet</div>
          <div style={{ fontSize: '13px', marginTop: '8px' }}>Click "New Dashboard" to create one, or explore templates.</div>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: '20px',
        }}>
          {filtered.map((d) => (
            <div
              key={d.id}
              style={{
                background: '#FFFFFF',
                borderRadius: '14px',
                border: '1px solid #E5E7EB',
                padding: '20px',
                cursor: 'pointer',
                transition: 'box-shadow 0.2s, border-color 0.2s',
                position: 'relative',
              }}
            >
              {/* Type badge */}
              <div style={{
                position: 'absolute',
                top: '12px',
                right: '12px',
                fontSize: '10px',
                fontWeight: 500,
                padding: '2px 8px',
                borderRadius: '4px',
                background: d.is_template ? '#F3F4F6' : d.is_published ? '#D1FAE5' : '#FEF3C7',
                color: d.is_template ? '#6B7280' : d.is_published ? '#065F46' : '#92400E',
              }}>
                {d.is_template ? 'Template' : d.is_published ? 'Published' : 'Draft'}
              </div>

              {/* Card content */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '12px' }}>
                <span style={{ fontSize: '28px' }}>{d.icon ?? TYPE_ICON[d.dashboard_type] ?? '📊'}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#111827' }}>{d.name}</h3>
                  {d.description && (
                    <p style={{
                      margin: '4px 0 0',
                      fontSize: '12px',
                      color: '#9CA3AF',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {d.description}
                    </p>
                  )}
                </div>
              </div>

              {/* Meta */}
              <div style={{ display: 'flex', gap: '16px', fontSize: '11px', color: '#9CA3AF', marginBottom: '14px' }}>
                {d.category && <span>📁 {d.category}</span>}
                {d._count?.widgets !== undefined && <span>🧩 {d._count.widgets} widgets</span>}
                {d._count?.pages !== undefined && <span>📄 {d._count.pages} pages</span>}
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: '8px' }}>
                {d.is_template ? (
                  <button
                    onClick={() => handleClone(d.id, d.name)}
                    style={{
                      flex: 1,
                      padding: '8px',
                      borderRadius: '8px',
                      border: '1px solid #3B82F6',
                      background: '#EFF6FF',
                      color: '#3B82F6',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    📋 Use Template
                  </button>
                ) : (
                  <>
                    <Link
                      href={`/ois/builder/${d.id}`}
                      style={{
                        flex: 1,
                        padding: '8px',
                        borderRadius: '8px',
                        border: '1px solid #3B82F6',
                        background: '#EFF6FF',
                        color: '#3B82F6',
                        fontSize: '12px',
                        fontWeight: 600,
                        textAlign: 'center',
                        textDecoration: 'none',
                      }}
                    >
                      ✏️ Edit
                    </Link>
                    <Link
                      href={`/ois/view/${d.id}`}
                      style={{
                        flex: 1,
                        padding: '8px',
                        borderRadius: '8px',
                        border: '1px solid #10B981',
                        background: '#ECFDF5',
                        color: '#065F46',
                        fontSize: '12px',
                        fontWeight: 600,
                        textAlign: 'center',
                        textDecoration: 'none',
                      }}
                    >
                      👁️ View
                    </Link>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.4)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
        }}>
          <div style={{
            background: '#FFF',
            borderRadius: '16px',
            padding: '28px',
            width: '420px',
            boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
          }}>
            <h2 style={{ margin: '0 0 20px', fontSize: '18px', fontWeight: 700 }}>Create New Dashboard</h2>

            <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>
              Name
            </label>
            <input
              type="text"
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              placeholder="e.g., Safety Overview"
              style={{
                width: '100%',
                padding: '10px 14px',
                border: '1px solid #D1D5DB',
                borderRadius: '8px',
                fontSize: '14px',
                marginBottom: '16px',
                outline: 'none',
              }}
              autoFocus
            />

            <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>
              Type
            </label>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
              {(['dashboard', 'cockpit', 'tv', 'meeting'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setCreateType(type)}
                  style={{
                    flex: 1,
                    padding: '10px 8px',
                    borderRadius: '8px',
                    border: '1px solid',
                    borderColor: createType === type ? '#3B82F6' : '#E5E7EB',
                    background: createType === type ? '#EFF6FF' : '#FFF',
                    color: createType === type ? '#3B82F6' : '#6B7280',
                    fontSize: '12px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    textAlign: 'center',
                  }}
                >
                  {TYPE_ICON[type]} {type.charAt(0).toUpperCase() + type.slice(1)}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowCreateModal(false)}
                style={{
                  padding: '10px 18px',
                  borderRadius: '8px',
                  border: '1px solid #E5E7EB',
                  background: '#FFF',
                  color: '#6B7280',
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={!createName.trim()}
                style={{
                  padding: '10px 24px',
                  borderRadius: '8px',
                  border: 'none',
                  background: createName.trim() ? 'linear-gradient(135deg, #3B82F6, #8B5CF6)' : '#D1D5DB',
                  color: '#FFF',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: createName.trim() ? 'pointer' : 'not-allowed',
                }}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
