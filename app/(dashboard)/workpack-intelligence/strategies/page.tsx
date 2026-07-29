'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';

type Strategy = {
  id: string; name: string; code: string; description: string | null;
  equipment_types: string[]; maintenance_category: string | null;
  approval_status: string; revision: number;
  estimated_duration_hrs: number | null; estimated_crew_size: number | null;
  discipline: string | null; complexity: string | null;
  default_template_name: string | null;
  _count: { workpacks: number; instantiations: number };
};

export default function StrategyLibrary() {
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', code: '', description: '', equipment_types: '', maintenance_category: '', discipline: '', estimated_duration_hrs: '', estimated_crew_size: '' });
  const [loading, setLoading] = useState(true);

  const loadStrategies = () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (filter) params.set('status', filter);
    fetch(`/api/workpack-intelligence/strategies?${params}`)
      .then(r => r.json())
      .then(d => { setStrategies(d.data || []); setLoading(false); });
  };

  useEffect(() => { loadStrategies(); }, [search, filter]);

  const handleCreate = async () => {
    await fetch('/api/workpack-intelligence/strategies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.name,
        code: form.code,
        description: form.description || undefined,
        equipment_types: form.equipment_types ? form.equipment_types.split(',').map(s => s.trim()) : [],
        maintenance_category: form.maintenance_category || undefined,
        discipline: form.discipline || undefined,
        estimated_duration_hrs: form.estimated_duration_hrs ? parseInt(form.estimated_duration_hrs) : undefined,
        estimated_crew_size: form.estimated_crew_size ? parseInt(form.estimated_crew_size) : undefined,
      }),
    });
    setShowCreate(false);
    setForm({ name: '', code: '', description: '', equipment_types: '', maintenance_category: '', discipline: '', estimated_duration_hrs: '', estimated_crew_size: '' });
    loadStrategies();
  };

  const handleApprove = async (id: string) => {
    await fetch(`/api/workpack-intelligence/strategies/${id}/approve`, { method: 'POST' });
    loadStrategies();
  };

  const statusBadge = (s: string) => {
    const colors: Record<string, string> = { draft: '#6b7280', submitted: '#f59e0b', approved: '#10b981', deprecated: '#ef4444' };
    return { padding: '0.2rem 0.6rem', borderRadius: '12px', fontSize: '0.7rem', background: colors[s] || '#6b7280', color: 'white', fontWeight: 600 };
  };

  return (
    <div style={{ padding: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>📚 Maintenance Strategy Library</h1>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <Link href="/workpack-intelligence" style={{ padding: '0.5rem 1rem', background: '#e2e8f0', borderRadius: '6px', textDecoration: 'none', color: '#374151', fontSize: '0.875rem' }}>
            ← Dashboard
          </Link>
          <button onClick={() => setShowCreate(true)} style={{ padding: '0.5rem 1rem', background: '#6366f1', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.875rem' }}>
            + New Strategy
          </button>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search strategies..."
          style={{ padding: '0.5rem 1rem', borderRadius: '6px', border: '1px solid #d1d5db', flex: 1 }}
        />
        <select value={filter} onChange={e => setFilter(e.target.value)} style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid #d1d5db' }}>
          <option value="">All Status</option>
          <option value="draft">Draft</option>
          <option value="approved">Approved</option>
          <option value="deprecated">Deprecated</option>
        </select>
      </div>

      {/* Create form */}
      {showCreate && (
        <div style={{ background: 'white', borderRadius: '8px', padding: '1.5rem', marginBottom: '1.5rem', border: '2px solid #6366f1' }}>
          <h3 style={{ marginBottom: '1rem', fontWeight: 600 }}>New Maintenance Strategy</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Strategy Name *" style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid #d1d5db' }} />
            <input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} placeholder="Code (e.g. PUMP-OH) *" style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid #d1d5db' }} />
            <input value={form.equipment_types} onChange={e => setForm(f => ({ ...f, equipment_types: e.target.value }))} placeholder="Equipment Types (comma-separated)" style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid #d1d5db' }} />
            <input value={form.maintenance_category} onChange={e => setForm(f => ({ ...f, maintenance_category: e.target.value }))} placeholder="Category (Overhaul, Inspection...)" style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid #d1d5db' }} />
            <input value={form.discipline} onChange={e => setForm(f => ({ ...f, discipline: e.target.value }))} placeholder="Discipline" style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid #d1d5db' }} />
            <input value={form.estimated_duration_hrs} onChange={e => setForm(f => ({ ...f, estimated_duration_hrs: e.target.value }))} placeholder="Est. Duration (hrs)" type="number" style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid #d1d5db' }} />
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Description" rows={2} style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid #d1d5db', gridColumn: 'span 2' }} />
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
            <button onClick={handleCreate} disabled={!form.name || !form.code} style={{ padding: '0.5rem 1rem', background: '#10b981', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>Create</button>
            <button onClick={() => setShowCreate(false)} style={{ padding: '0.5rem 1rem', background: '#e2e8f0', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Table */}
      <div style={{ background: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f1f5f9', fontSize: '0.75rem', textTransform: 'uppercase', color: '#64748b' }}>
              <th style={{ padding: '0.75rem', textAlign: 'left' }}>Code</th>
              <th style={{ padding: '0.75rem', textAlign: 'left' }}>Name</th>
              <th style={{ padding: '0.75rem', textAlign: 'left' }}>Category</th>
              <th style={{ padding: '0.75rem', textAlign: 'left' }}>Equipment Types</th>
              <th style={{ padding: '0.75rem', textAlign: 'left' }}>Template</th>
              <th style={{ padding: '0.75rem', textAlign: 'center' }}>Status</th>
              <th style={{ padding: '0.75rem', textAlign: 'center' }}>Used</th>
              <th style={{ padding: '0.75rem', textAlign: 'center' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {strategies.map(s => (
              <tr key={s.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                <td style={{ padding: '0.75rem', fontFamily: 'monospace', fontSize: '0.8rem', fontWeight: 600 }}>{s.code}</td>
                <td style={{ padding: '0.75rem', fontWeight: 500 }}>{s.name}</td>
                <td style={{ padding: '0.75rem', fontSize: '0.85rem', color: '#6b7280' }}>{s.maintenance_category || '—'}</td>
                <td style={{ padding: '0.75rem' }}>
                  <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                    {s.equipment_types.slice(0, 3).map(t => (
                      <span key={t} style={{ padding: '0.1rem 0.4rem', background: '#eef2ff', borderRadius: '4px', fontSize: '0.7rem', color: '#6366f1' }}>{t}</span>
                    ))}
                    {s.equipment_types.length > 3 && <span style={{ fontSize: '0.7rem', color: '#9ca3af' }}>+{s.equipment_types.length - 3}</span>}
                  </div>
                </td>
                <td style={{ padding: '0.75rem', fontSize: '0.8rem', color: '#6b7280' }}>{s.default_template_name || '—'}</td>
                <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                  <span style={statusBadge(s.approval_status)}>{s.approval_status}</span>
                </td>
                <td style={{ padding: '0.75rem', textAlign: 'center', fontSize: '0.85rem' }}>{s._count.instantiations}</td>
                <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                  {s.approval_status === 'draft' && (
                    <button onClick={() => handleApprove(s.id)} style={{ padding: '0.25rem 0.5rem', background: '#10b981', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem' }}>
                      Approve
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {strategies.length === 0 && !loading && (
              <tr><td colSpan={8} style={{ padding: '2rem', textAlign: 'center', color: '#9ca3af' }}>No strategies found. Create your first maintenance strategy.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
