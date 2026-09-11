'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

/* ────────────────────────────────────────────────────────────────────────────
   M9 — Workpack Factory Floor
   
   The production queue for converting approved Scope Items into Workpacks.

   Business rules (immutable):
     ONE ScopeItem → ONE Workpack
     ONE Workpack  → ONE Primary Equipment

   Architecture:
     - Reads from /api/workpack-factory/queue  (M9.2)
     - Creates via /api/workpack-intelligence/instantiate (existing)
     - Bulk creates via /api/workpack-intelligence/instantiate/bulk (existing)
     - Previews via /api/workpack-factory/preview (M9.2)
     - Manual redirect to /workpacks/new (existing)
──────────────────────────────────────────────────────────────────────────── */

type QueueItem = {
  id: string;
  scope_id: string;
  scope_name: string;
  event_name: string;
  event_id: string;
  asset_id: string;
  tag_number: string;
  asset_name: string;
  asset_type: string | null;
  equipment_type_id: string | null;
  plant_name: string | null;
  unit_name: string | null;
  system_name: string | null;
  reason: string;
  discipline: string | null;
  priority: string;
  complexity: string;
  estimated_hours: number;
  template_id: string | null;
  template_name: string | null;
  factory_status: 'pending' | 'created' | 'deferred';
  is_deferred: boolean;
  is_additional: boolean;
  workpack: {
    id: string;
    workpack_number: string | null;
    title: string;
    status: string;
    readiness_score: number | null;
    compliance_score: number | null;
    created_at: string;
  } | null;
  template_recommendations: Array<{
    templateId: string;
    templateName: string;
    matchReason: string;
    confidence: number;
  }>;
};

type KPIs = {
  approved_scope_items: number;
  workpacks_created: number;
  pending: number;
  deferred: number;
  manual_required: number;
  this_week: number;
  last_week: number;
};

type ScopeInfo = {
  id: string;
  name: string;
  status: string;
  event_id: string;
  event_name: string;
  event_code: string;
};

type PreviewData = {
  scope_item: any;
  asset: any;
  template: any;
  expected_activities: any[];
  expected_resources: any[];
  expected_materials: any[];
  expected_certificates: string[];
};

// ── Styles ─────────────────────────────────────────────────────────────────
const card = {
  background: '#fff',
  border: '1px solid #e5e7eb',
  borderRadius: '12px',
  padding: '1.25rem',
};

const badge = (color: string) => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: '4px',
  padding: '2px 10px',
  borderRadius: '12px',
  fontSize: '0.75rem',
  fontWeight: 600,
  background: `${color}15`,
  color,
  border: `1px solid ${color}30`,
});

const btn = (bg: string, color = '#fff') => ({
  padding: '6px 14px',
  borderRadius: '8px',
  fontSize: '0.8rem',
  fontWeight: 600,
  background: bg,
  color,
  border: 'none',
  cursor: 'pointer',
  transition: 'opacity 0.15s',
});

// ── V1 Configuration Placeholder ────────────────────────────────────────
// These values are deployment-specific defaults for the current STO project.
// They are NOT universal business rules and should be moved to tenant-level
// settings (e.g. Organization.settings JSON or a config API) when the
// platform supports configurable KPI targets.
//
// Current deployment: ~200 workpacks, 2 planners, ~40/month ≈ 10/week.
const PRODUCTION_TARGET = { workpacks_per_week: 10 } as const;

export default function WorkpackFactoryPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // ── State ──────────────────────────────────────────────────────────────
  const [items, setItems] = useState<QueueItem[]>([]);
  const [kpis, setKpis] = useState<KPIs | null>(null);
  const [scopes, setScopes] = useState<ScopeInfo[]>([]);
  const [events, setEvents] = useState<Array<{ id: string; name: string; code: string }>>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [eventId, setEventId] = useState(searchParams.get('event_id') || '');
  const [scopeId, setScopeId] = useState(searchParams.get('scope_id') || '');
  const [discipline, setDiscipline] = useState('');
  const [priority, setPriority] = useState('');
  const [equipmentType, setEquipmentType] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState('');

  // Selection
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Modals
  const [previewItem, setPreviewItem] = useState<QueueItem | null>(null);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [templateSelectItem, setTemplateSelectItem] = useState<QueueItem | null>(null);

  // Bulk creation
  const [bulkRunning, setBulkRunning] = useState(false);
  const [bulkResults, setBulkResults] = useState<{
    total: number;
    created: number;
    failed: number;
    skipped: number;
    results: Array<{ scopeItemId: string; tag: string; workpackNumber?: string; error?: string; status: string }>;
  } | null>(null);
  const [bulkProgress, setBulkProgress] = useState(0);

  // ── Fetch events ───────────────────────────────────────────────────────
  useEffect(() => {
    fetch('/api/events')
      .then((r) => r.json())
      .then((d) => setEvents(d.data || []))
      .catch(() => {});
  }, []);

  // ── Fetch queue ────────────────────────────────────────────────────────
  const fetchQueue = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (eventId) params.set('event_id', eventId);
    if (scopeId) params.set('scope_id', scopeId);
    if (discipline) params.set('discipline', discipline);
    if (priority) params.set('priority', priority);
    if (equipmentType) params.set('equipment_type', equipmentType);
    if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter);
    if (search) params.set('search', search);

    try {
      const res = await fetch(`/api/workpack-factory/queue?${params.toString()}`);
      const data = await res.json();
      if (data.data) {
        setItems(data.data.items || []);
        setKpis(data.data.kpis || null);
        setScopes(data.data.scopes || []);
      }
    } catch {
      // Silently fail — show empty state
    }
    setLoading(false);
  }, [eventId, scopeId, discipline, priority, equipmentType, statusFilter, search]);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  // ── Selection helpers ──────────────────────────────────────────────────
  const toggleSelect = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const selectAllPending = () => {
    const pending = items.filter(
      (i) => i.factory_status === 'pending' && i.template_recommendations.length > 0
    );
    setSelected(new Set(pending.map((i) => i.id)));
  };

  const clearSelection = () => setSelected(new Set());

  // ── Get site_id (cached after first fetch) ─────────────────────────────
  // Required by existing instantiateFromScope() API contract.
  // Not available from session — must be fetched from /api/sites.
  const siteIdRef = useRef<string | null>(null);
  const getSiteId = async () => {
    if (siteIdRef.current) return siteIdRef.current;
    const res = await fetch('/api/sites');
    const data = await res.json();
    const id = data.data?.[0]?.id || null;
    siteIdRef.current = id;
    return id;
  };

  // ── Single create ──────────────────────────────────────────────────────
  const createWorkpack = async (item: QueueItem, templateId: string) => {
    // Idempotency: item already has workpack
    if (item.workpack) {
      alert('This scope item already has a workpack.');
      return;
    }

    const siteId = await getSiteId();
    if (!siteId) {
      alert('No site available.');
      return;
    }

    try {
      const res = await fetch('/api/workpack-intelligence/instantiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scope_item_id: item.id,
          template_id: templateId,
          site_id: siteId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create workpack');
      fetchQueue(); // Refresh
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  // ── Bulk create ────────────────────────────────────────────────────────
  const startBulkCreate = async () => {
    const selectedItems = items.filter((i) => selected.has(i.id));

    // Validate
    const valid = selectedItems.filter(
      (i) => i.factory_status === 'pending' && (i.template_recommendations.length > 0 || i.template_id)
    );
    const invalid = selectedItems.filter(
      (i) => i.factory_status !== 'pending' || (i.template_recommendations.length === 0 && !i.template_id)
    );

    if (valid.length === 0) {
      alert('No valid items to create. Select pending items with template matches.');
      return;
    }

    setBulkRunning(true);
    setBulkResults(null);
    setBulkProgress(0);

    const siteId = await getSiteId();
    if (!siteId) {
      alert('No site available.');
      setBulkRunning(false);
      return;
    }

    // Sequential processing — one at a time for progress tracking
    const results: typeof bulkResults extends null ? never : NonNullable<typeof bulkResults>['results'] = [];
    let created = 0;
    let failed = 0;
    let skipped = 0;

    for (let i = 0; i < valid.length; i++) {
      const item = valid[i];
      const templateId = item.template_id || item.template_recommendations[0]?.templateId;

      if (!templateId) {
        results.push({ scopeItemId: item.id, tag: item.tag_number || '', status: 'skipped', error: 'No template' });
        skipped++;
        setBulkProgress(((i + 1) / valid.length) * 100);
        continue;
      }

      try {
        const res = await fetch('/api/workpack-intelligence/instantiate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            scope_item_id: item.id,
            template_id: templateId,
            site_id: siteId,
          }),
        });
        const data = await res.json();

        if (!res.ok) {
          // Idempotency: already has workpack
          if (data.error?.includes('already has a workpack')) {
            results.push({ scopeItemId: item.id, tag: item.tag_number || '', status: 'skipped', error: 'Already created' });
            skipped++;
          } else {
            results.push({ scopeItemId: item.id, tag: item.tag_number || '', status: 'failed', error: data.error });
            failed++;
          }
        } else {
          results.push({
            scopeItemId: item.id,
            tag: item.tag_number || '',
            status: 'created',
            workpackNumber: data.data?.workpack_id,
          });
          created++;
        }
      } catch (err: any) {
        results.push({ scopeItemId: item.id, tag: item.tag_number || '', status: 'failed', error: err.message });
        failed++;
      }

      setBulkProgress(((i + 1) / valid.length) * 100);
    }

    // Add invalid items as skipped
    for (const item of invalid) {
      results.push({ scopeItemId: item.id, tag: item.tag_number || '', status: 'skipped', error: 'Invalid (already created or no template)' });
      skipped++;
    }

    setBulkResults({ total: selectedItems.length, created, failed, skipped, results });
    setBulkRunning(false);
    setSelected(new Set());
    fetchQueue(); // Refresh
  };

  // ── Preview ────────────────────────────────────────────────────────────
  const openPreview = async (item: QueueItem, templateId: string) => {
    setPreviewItem(item);
    setPreviewLoading(true);
    setPreviewData(null);

    try {
      const res = await fetch('/api/workpack-factory/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope_item_id: item.id, template_id: templateId }),
      });
      const data = await res.json();
      if (res.ok) setPreviewData(data.data);
    } catch {
      // Silent
    }
    setPreviewLoading(false);
  };

  // ── Unique filter values from loaded items ─────────────────────────────
  const disciplines = [...new Set(items.map((i) => i.discipline).filter(Boolean))] as string[];
  const priorities = [...new Set(items.map((i) => i.priority).filter(Boolean))] as string[];
  const assetTypes = [...new Set(items.map((i) => i.asset_type).filter(Boolean))] as string[];

  // ── Computed ───────────────────────────────────────────────────────────
  const pendingItems = items.filter((i) => i.factory_status === 'pending');
  const selectedCount = selected.size;
  const validSelected = items.filter(
    (i) => selected.has(i.id) && i.factory_status === 'pending' && (i.template_recommendations.length > 0 || i.template_id)
  ).length;

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: '1.5rem', maxWidth: '1600px', margin: '0 auto' }}>
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>
            🏭 Workpack Factory
          </h1>
          <p style={{ fontSize: '0.85rem', color: '#6b7280', margin: '4px 0 0' }}>
            Convert approved scope into production workpacks
          </p>
        </div>
        {selectedCount > 0 && (
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', color: '#374151' }}>
              {selectedCount} selected ({validSelected} valid)
            </span>
            <button
              style={btn('#6366f1')}
              onClick={startBulkCreate}
              disabled={bulkRunning || validSelected === 0}
            >
              {bulkRunning ? '⏳ Creating...' : `Create ${validSelected} Workpacks`}
            </button>
            <button style={btn('#e5e7eb', '#374151')} onClick={clearSelection}>
              Clear
            </button>
          </div>
        )}
      </div>

      {/* ── KPI Bar ─────────────────────────────────────────────────────── */}
      {kpis && (
        <div style={{ ...card, marginBottom: '1rem', display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
          <KpiStat label="Approved Scope Items" value={kpis.approved_scope_items} />
          <KpiStat label="Workpacks Created" value={kpis.workpacks_created} color="#059669" />
          <KpiStat label="Pending" value={kpis.pending} color="#d97706" />
          <KpiStat label="Deferred" value={kpis.deferred} color="#6b7280" />
          <KpiStat label="Manual Required" value={kpis.manual_required} color="#dc2626" />
          <div style={{ borderLeft: '1px solid #e5e7eb', paddingLeft: '1rem' }}>
            <KpiStat label="This Week" value={kpis.this_week} />
          </div>
          <KpiStat label="Last Week" value={kpis.last_week} />
          <KpiStat label="Target/Week" value={PRODUCTION_TARGET.workpacks_per_week} color="#6366f1" />
        </div>
      )}

      {/* ── Filters ─────────────────────────────────────────────────────── */}
      <div style={{ ...card, marginBottom: '1rem' }}>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Event */}
          <select
            value={eventId}
            onChange={(e) => { setEventId(e.target.value); setScopeId(''); }}
            style={filterSelect}
          >
            <option value="">All Events</option>
            {events.map((e) => (
              <option key={e.id} value={e.id}>{e.name}</option>
            ))}
          </select>

          {/* Scope */}
          <select value={scopeId} onChange={(e) => setScopeId(e.target.value)} style={filterSelect}>
            <option value="">All Scopes</option>
            {scopes.map((s) => (
              <option key={s.id} value={s.id}>{s.name} ({s.status})</option>
            ))}
          </select>

          {/* Discipline */}
          <select value={discipline} onChange={(e) => setDiscipline(e.target.value)} style={filterSelect}>
            <option value="">All Disciplines</option>
            {disciplines.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>

          {/* Priority */}
          <select value={priority} onChange={(e) => setPriority(e.target.value)} style={filterSelect}>
            <option value="">All Priorities</option>
            {priorities.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>

          {/* Equipment Type */}
          <select value={equipmentType} onChange={(e) => setEquipmentType(e.target.value)} style={filterSelect}>
            <option value="">All Equipment</option>
            {assetTypes.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>

          {/* Status */}
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={filterSelect}>
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="created">Created</option>
            <option value="deferred">Deferred</option>
          </select>

          {/* Search */}
          <input
            type="text"
            placeholder="Search tag / name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ ...filterSelect, minWidth: '180px' }}
          />

          {/* Select All Pending */}
          <button
            style={btn('#eef2ff', '#4f46e5')}
            onClick={selectAllPending}
          >
            Select All Pending
          </button>
        </div>
      </div>

      {/* ── Loading ─────────────────────────────────────────────────────── */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af' }}>
          Loading factory queue...
        </div>
      )}

      {/* ── Empty state ─────────────────────────────────────────────────── */}
      {!loading && items.length === 0 && (
        <div style={{ ...card, textAlign: 'center', padding: '3rem', color: '#6b7280' }}>
          <p style={{ fontSize: '1.1rem', fontWeight: 600 }}>No scope items found</p>
          <p style={{ fontSize: '0.85rem', marginTop: '8px' }}>
            {eventId
              ? 'No approved/frozen scopes with items for this event.'
              : 'Select an event to view its factory queue, or ensure scopes are approved.'}
          </p>
        </div>
      )}

      {/* ── Main Table ──────────────────────────────────────────────────── */}
      {!loading && items.length > 0 && (
        <div style={{ ...card, padding: 0, overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                <th style={th}>
                  <input
                    type="checkbox"
                    checked={pendingItems.length > 0 && selected.size === pendingItems.length}
                    onChange={() =>
                      selected.size === pendingItems.length ? clearSelection() : selectAllPending()
                    }
                  />
                </th>
                <th style={th}>Equipment</th>
                <th style={th}>Type</th>
                <th style={th}>Scope</th>
                <th style={th}>Discipline</th>
                <th style={th}>Priority</th>
                <th style={th}>Template</th>
                <th style={th}>Status</th>
                <th style={th}>Action</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <QueueRow
                  key={item.id}
                  item={item}
                  isSelected={selected.has(item.id)}
                  onToggle={() => toggleSelect(item.id)}
                  onPreview={(templateId) => openPreview(item, templateId)}
                  onCreate={(templateId) => createWorkpack(item, templateId)}
                  onManual={() =>
                    router.push(
                      `/workpacks/new?asset_id=${item.asset_id}&event_id=${item.event_id || ''}&scope_item_id=${item.id}`
                    )
                  }
                  onViewWorkpack={() =>
                    item.workpack && router.push(`/workpacks/${item.workpack.id}`)
                  }
                  onSelectTemplate={() => setTemplateSelectItem(item)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Bulk Progress Modal ──────────────────────────────────────────── */}
      {bulkRunning && (
        <Modal onClose={() => {}}>
          <h3 style={{ fontWeight: 700, marginBottom: '1rem' }}>Creating Workpacks...</h3>
          <div style={{ marginBottom: '1rem' }}>
            <div style={{
              height: '8px', borderRadius: '4px', background: '#e5e7eb', overflow: 'hidden',
            }}>
              <div style={{
                height: '100%',
                width: `${bulkProgress}%`,
                background: '#6366f1',
                borderRadius: '4px',
                transition: 'width 0.3s',
              }} />
            </div>
            <p style={{ fontSize: '0.82rem', color: '#6b7280', marginTop: '4px' }}>
              {Math.round(bulkProgress)}% complete
            </p>
          </div>
        </Modal>
      )}

      {/* ── Bulk Results Modal ───────────────────────────────────────────── */}
      {bulkResults && !bulkRunning && (
        <Modal onClose={() => setBulkResults(null)}>
          <h3 style={{ fontWeight: 700, marginBottom: '1rem' }}>Bulk Creation Results</h3>
          <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1rem' }}>
            <KpiStat label="Created" value={bulkResults.created} color="#059669" />
            <KpiStat label="Skipped" value={bulkResults.skipped} color="#d97706" />
            <KpiStat label="Failed" value={bulkResults.failed} color="#dc2626" />
          </div>
          <div style={{ maxHeight: '300px', overflow: 'auto' }}>
            {bulkResults.results.map((r, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '6px 0',
                  borderBottom: '1px solid #f3f4f6',
                  fontSize: '0.82rem',
                }}
              >
                <span>{r.tag || r.scopeItemId.slice(0, 8)}</span>
                <span style={badge(
                  r.status === 'created' ? '#059669' : r.status === 'skipped' ? '#d97706' : '#dc2626'
                )}>
                  {r.status === 'created' ? '✓ Created' : r.status === 'skipped' ? '⏭ Skipped' : `✗ ${r.error}`}
                </span>
              </div>
            ))}
          </div>
          <button style={{ ...btn('#6366f1'), marginTop: '1rem' }} onClick={() => setBulkResults(null)}>
            Close
          </button>
        </Modal>
      )}

      {/* ── Preview Modal ───────────────────────────────────────────────── */}
      {previewItem && (
        <Modal onClose={() => { setPreviewItem(null); setPreviewData(null); }}>
          <h3 style={{ fontWeight: 700, marginBottom: '0.5rem' }}>
            Preview: {previewItem.tag_number} — {previewItem.asset_name}
          </h3>
          {previewLoading && <p style={{ color: '#9ca3af' }}>Loading preview...</p>}
          {previewData && (
            <div style={{ fontSize: '0.82rem', maxHeight: '500px', overflow: 'auto' }}>
              <div style={{ marginBottom: '1rem' }}>
                <strong>Template:</strong> {previewData.template.name} (R{previewData.template.revision})
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <strong>Expected Activities ({previewData.expected_activities.length}):</strong>
                <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '6px' }}>
                  <thead>
                    <tr style={{ background: '#f9fafb' }}>
                      <th style={miniTh}>#</th>
                      <th style={miniTh}>Description</th>
                      <th style={miniTh}>Hours</th>
                      <th style={miniTh}>Hold Point</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewData.expected_activities.map((a: any, i: number) => (
                      <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td style={miniTd}>{a.sequence_number}</td>
                        <td style={miniTd}>{a.description}</td>
                        <td style={miniTd}>{a.duration_hours || '—'}</td>
                        <td style={miniTd}>{a.hold_point_type || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {(previewData.expected_materials as any[])?.length > 0 && (
                <div style={{ marginBottom: '1rem' }}>
                  <strong>Expected Materials ({(previewData.expected_materials as any[]).length}):</strong>
                  <ul style={{ margin: '4px 0', paddingLeft: '1.2rem' }}>
                    {(previewData.expected_materials as any[]).map((m: any, i: number) => (
                      <li key={i}>{m.description || m.name || JSON.stringify(m)}</li>
                    ))}
                  </ul>
                </div>
              )}
              {previewData.expected_certificates?.length > 0 && (
                <div style={{ marginBottom: '1rem' }}>
                  <strong>Expected Certificates ({previewData.expected_certificates.length}):</strong>
                  <ul style={{ margin: '4px 0', paddingLeft: '1.2rem' }}>
                    {previewData.expected_certificates.map((c: string, i: number) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ul>
                </div>
              )}
              <div style={{ display: 'flex', gap: '8px', marginTop: '1rem' }}>
                <button
                  style={btn('#059669')}
                  onClick={() => {
                    createWorkpack(previewItem!, previewData!.template.id);
                    setPreviewItem(null);
                    setPreviewData(null);
                  }}
                >
                  Create Workpack
                </button>
                <button
                  style={btn('#e5e7eb', '#374151')}
                  onClick={() => { setPreviewItem(null); setPreviewData(null); }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </Modal>
      )}

      {/* ── Template Selection Modal ─────────────────────────────────────── */}
      {templateSelectItem && (
        <Modal onClose={() => setTemplateSelectItem(null)}>
          <h3 style={{ fontWeight: 700, marginBottom: '0.5rem' }}>
            Select Template for {templateSelectItem.tag_number}
          </h3>
          <p style={{ fontSize: '0.82rem', color: '#6b7280', marginBottom: '1rem' }}>
            {templateSelectItem.asset_type} — {templateSelectItem.reason}
          </p>
          <div style={{ maxHeight: '400px', overflow: 'auto' }}>
            {templateSelectItem.template_recommendations.map((rec, i) => (
              <div
                key={rec.templateId}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '10px 12px',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  marginBottom: '6px',
                  cursor: 'pointer',
                  background: i === 0 ? '#f0fdf4' : '#fff',
                }}
                onClick={() => {
                  createWorkpack(templateSelectItem, rec.templateId);
                  setTemplateSelectItem(null);
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                    {i === 0 && '⭐ '}{rec.templateName}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                    {rec.matchReason}
                  </div>
                </div>
                <span style={badge(rec.confidence >= 0.7 ? '#059669' : rec.confidence >= 0.5 ? '#d97706' : '#dc2626')}>
                  {Math.round(rec.confidence * 100)}%
                </span>
              </div>
            ))}
          </div>
          <button
            style={{ ...btn('#e5e7eb', '#374151'), marginTop: '1rem' }}
            onClick={() => setTemplateSelectItem(null)}
          >
            Cancel
          </button>
        </Modal>
      )}
    </div>
  );
}

// ── Sub-Components ─────────────────────────────────────────────────────────

function QueueRow({
  item,
  isSelected,
  onToggle,
  onPreview,
  onCreate,
  onManual,
  onViewWorkpack,
  onSelectTemplate,
}: {
  item: QueueItem;
  isSelected: boolean;
  onToggle: () => void;
  onPreview: (templateId: string) => void;
  onCreate: (templateId: string) => void;
  onManual: () => void;
  onViewWorkpack: () => void;
  onSelectTemplate: () => void;
}) {
  const recs = item.template_recommendations || [];
  const topRec = recs[0];
  const isPending = item.factory_status === 'pending';
  const isCreated = item.factory_status === 'created';
  const isDeferred = item.factory_status === 'deferred';

  return (
    <tr style={{
      borderBottom: '1px solid #f3f4f6',
      background: isSelected ? '#eef2ff' : isCreated ? '#f0fdf4' : isDeferred ? '#fefce8' : '#fff',
    }}>
      {/* Select */}
      <td style={td}>
        {isPending && (
          <input type="checkbox" checked={isSelected} onChange={onToggle} />
        )}
      </td>

      {/* Equipment */}
      <td style={td}>
        <div style={{ fontWeight: 600 }}>{item.tag_number}</div>
        <div style={{ fontSize: '0.72rem', color: '#6b7280' }}>{item.asset_name}</div>
      </td>

      {/* Type */}
      <td style={td}>
        <span style={{ fontSize: '0.78rem' }}>{item.asset_type || '—'}</span>
      </td>

      {/* Scope / Reason */}
      <td style={td}>
        <div style={{ fontSize: '0.78rem' }}>{item.reason}</div>
        <div style={{ fontSize: '0.7rem', color: '#9ca3af' }}>{item.scope_name}</div>
      </td>

      {/* Discipline */}
      <td style={td}>
        <span style={{ fontSize: '0.78rem' }}>{item.discipline || '—'}</span>
      </td>

      {/* Priority */}
      <td style={td}>
        <span style={badge(
          item.priority === 'critical' ? '#dc2626' :
          item.priority === 'high' ? '#d97706' :
          item.priority === 'medium' ? '#2563eb' : '#6b7280'
        )}>
          {item.priority}
        </span>
      </td>

      {/* Template */}
      <td style={td}>
        {item.template_name ? (
          <div style={{ fontSize: '0.78rem' }}>
            <span style={{ fontWeight: 600 }}>{item.template_name}</span>
            <div style={{ fontSize: '0.7rem', color: '#059669' }}>Pre-selected</div>
          </div>
        ) : topRec ? (
          <div style={{ fontSize: '0.78rem' }}>
            <span style={{ fontWeight: 600 }}>{topRec.templateName}</span>
            <div style={{ fontSize: '0.7rem', color: '#059669' }}>
              {Math.round(topRec.confidence * 100)}% match
              {recs.length > 1 && ` · ${recs.length} available`}
            </div>
          </div>
        ) : (
          <span style={{ fontSize: '0.78rem', color: '#dc2626' }}>No suitable template</span>
        )}
      </td>

      {/* Status */}
      <td style={td}>
        {isCreated && item.workpack && (
          <span style={badge('#059669')}>✓ {item.workpack.workpack_number || 'Created'}</span>
        )}
        {isPending && <span style={badge('#d97706')}>⏳ Pending</span>}
        {isDeferred && <span style={badge('#6b7280')}>⏭ Deferred</span>}
      </td>

      {/* Actions */}
      <td style={{ ...td, whiteSpace: 'nowrap' }}>
        {isCreated && (
          <button style={btn('#eef2ff', '#4f46e5')} onClick={onViewWorkpack}>
            View WP
          </button>
        )}
        {isPending && topRec && (
          <div style={{ display: 'flex', gap: '4px' }}>
            <button
              style={btn('#eef2ff', '#4f46e5')}
              onClick={() => onPreview(item.template_id || topRec.templateId)}
            >
              Preview
            </button>
            {recs.length > 1 ? (
              <button style={btn('#059669')} onClick={onSelectTemplate}>
                Select
              </button>
            ) : (
              <button
                style={btn('#059669')}
                onClick={() => onCreate(item.template_id || topRec.templateId)}
              >
                Create
              </button>
            )}
          </div>
        )}
        {isPending && !topRec && !item.template_id && (
          <button style={btn('#f59e0b', '#fff')} onClick={onManual}>
            Manual
          </button>
        )}
      </td>
    </tr>
  );
}

function KpiStat({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div>
      <div style={{ fontSize: '1.25rem', fontWeight: 700, color: color || '#111827' }}>{value}</div>
      <div style={{ fontSize: '0.7rem', color: '#6b7280', whiteSpace: 'nowrap' }}>{label}</div>
    </div>
  );
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.4)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: '16px',
          padding: '1.5rem',
          maxWidth: '700px',
          width: '90%',
          maxHeight: '85vh',
          overflow: 'auto',
          boxShadow: '0 25px 50px rgba(0,0,0,0.25)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

// ── Table Styles ───────────────────────────────────────────────────────────
const th: React.CSSProperties = {
  padding: '10px 12px',
  textAlign: 'left',
  fontSize: '0.72rem',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: '#6b7280',
  whiteSpace: 'nowrap',
};

const td: React.CSSProperties = {
  padding: '10px 12px',
  verticalAlign: 'middle',
};

const miniTh: React.CSSProperties = {
  padding: '6px 8px',
  textAlign: 'left',
  fontSize: '0.7rem',
  fontWeight: 600,
  color: '#6b7280',
};

const miniTd: React.CSSProperties = {
  padding: '4px 8px',
  fontSize: '0.78rem',
};

const filterSelect: React.CSSProperties = {
  padding: '6px 10px',
  borderRadius: '8px',
  border: '1px solid #d1d5db',
  fontSize: '0.82rem',
  background: '#fff',
  color: '#374151',
  minWidth: '120px',
};
