'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';

type Scope = { id: string; name: string; status: string };
type DashboardData = {
  scope: Scope;
  summary: {
    total_scope_items: number;
    items_with_workpack: number;
    items_pending: number;
    total_workpacks: number;
    avg_readiness: number;
    avg_compliance: number;
    by_status: Record<string, number>;
  };
  workpacks: Array<{
    id: string; title: string; workpack_number: string | null;
    status: string; readiness_score: number | null; compliance_score: number | null;
    asset: { tag_number: string; name: string } | null;
    strategy: { name: string; code: string } | null;
    instantiation: { activities_created: number; resources_created: number; materials_created: number; certificates_created: number; documents_attached: number } | null;
  }>;
};

export default function WorkpackIntelligenceDashboard() {
  const [scopes, setScopes] = useState<Scope[]>([]);
  const [selectedScopeId, setSelectedScopeId] = useState('');
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('/api/shutdown-scope/scopes?status=approved')
      .then(r => r.json())
      .then(d => {
        const items = d.data?.data || d.data || [];
        setScopes(items);
        // Also fetch frozen scopes
        fetch('/api/shutdown-scope/scopes?status=frozen')
          .then(r => r.json())
          .then(d2 => {
            const frozen = d2.data?.data || d2.data || [];
            setScopes(prev => [...prev, ...frozen]);
          });
      });
  }, []);

  const loadDashboard = async (scopeId: string) => {
    if (!scopeId) return;
    setSelectedScopeId(scopeId);
    setLoading(true);
    try {
      const res = await fetch(`/api/workpack-intelligence/scopes/${scopeId}/intelligence-dashboard`);
      const d = await res.json();
      setDashboard(d.data);
    } catch { /* ignore */ }
    setLoading(false);
  };

  const statusColor = (s: string) => {
    switch (s) {
      case 'draft': return '#6b7280';
      case 'under_review': return '#f59e0b';
      case 'approved': return '#10b981';
      case 'issued': return '#3b82f6';
      case 'closed': return '#8b5cf6';
      default: return '#6b7280';
    }
  };

  const readinessColor = (s: number | null) => {
    if (!s) return '#ef4444';
    if (s >= 80) return '#10b981';
    if (s >= 50) return '#f59e0b';
    return '#ef4444';
  };

  return (
    <div style={{ padding: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>⚡ Workpack Intelligence Engine</h1>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <Link href="/workpack-intelligence/strategies" style={{ padding: '0.5rem 1rem', background: '#6366f1', color: 'white', borderRadius: '6px', textDecoration: 'none', fontSize: '0.875rem' }}>
            📚 Strategy Library
          </Link>
        </div>
      </div>

      {/* Scope selector */}
      <div style={{ marginBottom: '1.5rem', background: '#f8fafc', borderRadius: '8px', padding: '1rem', border: '1px solid #e2e8f0' }}>
        <label style={{ fontWeight: 600, marginRight: '0.75rem' }}>Select Shutdown Scope:</label>
        <select
          value={selectedScopeId}
          onChange={e => loadDashboard(e.target.value)}
          style={{ padding: '0.5rem 1rem', borderRadius: '6px', border: '1px solid #d1d5db', minWidth: '300px' }}
        >
          <option value="">-- Choose Scope --</option>
          {scopes.map(s => (
            <option key={s.id} value={s.id}>{s.name} ({s.status})</option>
          ))}
        </select>
      </div>

      {loading && <p>Loading dashboard...</p>}

      {dashboard && (
        <>
          {/* Summary cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
            {[
              { label: 'Scope Items', value: dashboard.summary.total_scope_items, color: '#3b82f6' },
              { label: 'With Workpack', value: dashboard.summary.items_with_workpack, color: '#10b981' },
              { label: 'Pending', value: dashboard.summary.items_pending, color: '#f59e0b' },
              { label: 'Total Workpacks', value: dashboard.summary.total_workpacks, color: '#6366f1' },
              { label: 'Avg Readiness', value: `${dashboard.summary.avg_readiness}%`, color: readinessColor(dashboard.summary.avg_readiness) },
              { label: 'Avg Compliance', value: `${dashboard.summary.avg_compliance}%`, color: readinessColor(dashboard.summary.avg_compliance) },
            ].map((card, i) => (
              <div key={i} style={{ background: 'white', borderRadius: '8px', padding: '1rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', borderLeft: `4px solid ${card.color}` }}>
                <div style={{ fontSize: '0.75rem', color: '#6b7280', textTransform: 'uppercase' }}>{card.label}</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: card.color }}>{card.value}</div>
              </div>
            ))}
          </div>

          {/* Status breakdown */}
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
            {Object.entries(dashboard.summary.by_status).map(([status, count]) => (
              <span key={status} style={{ padding: '0.25rem 0.75rem', borderRadius: '12px', fontSize: '0.75rem', background: statusColor(status), color: 'white' }}>
                {status}: {count}
              </span>
            ))}
          </div>

          {/* Workpack table */}
          <div style={{ background: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f1f5f9', fontSize: '0.75rem', textTransform: 'uppercase', color: '#64748b' }}>
                  <th style={{ padding: '0.75rem', textAlign: 'left' }}>WP #</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left' }}>Title</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left' }}>Asset</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left' }}>Strategy</th>
                  <th style={{ padding: '0.75rem', textAlign: 'center' }}>Status</th>
                  <th style={{ padding: '0.75rem', textAlign: 'center' }}>Readiness</th>
                  <th style={{ padding: '0.75rem', textAlign: 'center' }}>Compliance</th>
                  <th style={{ padding: '0.75rem', textAlign: 'center' }}>Acts</th>
                  <th style={{ padding: '0.75rem', textAlign: 'center' }}>Res</th>
                  <th style={{ padding: '0.75rem', textAlign: 'center' }}>Mat</th>
                  <th style={{ padding: '0.75rem', textAlign: 'center' }}>Cert</th>
                  <th style={{ padding: '0.75rem', textAlign: 'center' }}>Docs</th>
                </tr>
              </thead>
              <tbody>
                {dashboard.workpacks.map(wp => (
                  <tr key={wp.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '0.75rem', fontFamily: 'monospace', fontSize: '0.8rem' }}>{wp.workpack_number || '—'}</td>
                    <td style={{ padding: '0.75rem', fontWeight: 500 }}>
                      <Link href={`/workpacks/${wp.id}`} style={{ color: '#3b82f6', textDecoration: 'none' }}>{wp.title}</Link>
                    </td>
                    <td style={{ padding: '0.75rem', fontSize: '0.85rem' }}>{wp.asset?.tag_number || '—'}</td>
                    <td style={{ padding: '0.75rem', fontSize: '0.85rem' }}>{wp.strategy?.name || '—'}</td>
                    <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                      <span style={{ padding: '0.2rem 0.5rem', borderRadius: '12px', fontSize: '0.7rem', background: statusColor(wp.status), color: 'white' }}>{wp.status}</span>
                    </td>
                    <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                      <span style={{ fontWeight: 700, color: readinessColor(wp.readiness_score) }}>{wp.readiness_score ?? 0}%</span>
                    </td>
                    <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                      <span style={{ fontWeight: 700, color: readinessColor(wp.compliance_score) }}>{wp.compliance_score ?? 100}%</span>
                    </td>
                    <td style={{ padding: '0.75rem', textAlign: 'center', fontSize: '0.85rem' }}>{wp.instantiation?.activities_created ?? 0}</td>
                    <td style={{ padding: '0.75rem', textAlign: 'center', fontSize: '0.85rem' }}>{wp.instantiation?.resources_created ?? 0}</td>
                    <td style={{ padding: '0.75rem', textAlign: 'center', fontSize: '0.85rem' }}>{wp.instantiation?.materials_created ?? 0}</td>
                    <td style={{ padding: '0.75rem', textAlign: 'center', fontSize: '0.85rem' }}>{wp.instantiation?.certificates_created ?? 0}</td>
                    <td style={{ padding: '0.75rem', textAlign: 'center', fontSize: '0.85rem' }}>{wp.instantiation?.documents_attached ?? 0}</td>
                  </tr>
                ))}
                {dashboard.workpacks.length === 0 && (
                  <tr><td colSpan={12} style={{ padding: '2rem', textAlign: 'center', color: '#9ca3af' }}>No workpacks created yet. Use the Scope Builder to instantiate workpacks from scope items.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {!selectedScopeId && !loading && (
        <div style={{ textAlign: 'center', padding: '4rem', color: '#9ca3af' }}>
          <p style={{ fontSize: '1.25rem' }}>Select an approved or frozen Shutdown Scope to view the Intelligence Dashboard</p>
        </div>
      )}
    </div>
  );
}
