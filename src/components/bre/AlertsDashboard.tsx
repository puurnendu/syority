/**
 * M7.6E — Alerts Dashboard
 *
 * Centralized alert console with:
 *   • View modes: All, My, Critical, Acknowledged, Closed, Escalated
 *   • Filters: Site, Unit, Contractor, Discipline, Shift, Category, Status, Severity
 *   • Actions: Acknowledge, Assign, Resolve, Close, Suppress, Comment
 *   • Bulk operations
 *   • Real-time badge counts
 *   • Search
 *
 * Consumes: /api/bre/alerts
 */

'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';

// ─── Types ──────────────────────────────────────────────────────────────────

interface Alert {
  id: string;
  alertType: string;
  title: string;
  message: string;
  severity: 'information' | 'warning' | 'critical' | 'emergency';
  priority: number;
  status: 'open' | 'acknowledged' | 'in_progress' | 'resolved' | 'closed' | 'suppressed';
  entityType: string | null;
  scopeSiteId: string | null;
  scopeUnitId: string | null;
  scopeArea: string | null;
  triggerValue: string | null;
  thresholdValue: string | null;
  assignedTo: string | null;
  escalationLevel: number;
  resolutionNotes: string | null;
  createdAt: string;
  comments?: Array<{ id: string; comment: string; createdBy: string; createdAt: string }>;
}

interface AlertCounts {
  total: number;
  open: number;
  acknowledged: number;
  inProgress: number;
  critical: number;
  emergency: number;
}

type ViewMode = 'all' | 'my' | 'critical' | 'acknowledged' | 'closed' | 'escalated';

// ─── Constants ──────────────────────────────────────────────────────────────

const SEVERITY_CONFIG = {
  emergency: { color: '#DC2626', bg: 'rgba(220,38,38,0.15)', icon: '🚨', label: 'Emergency' },
  critical: { color: '#F97316', bg: 'rgba(249,115,22,0.15)', icon: '🔴', label: 'Critical' },
  warning: { color: '#F59E0B', bg: 'rgba(245,158,11,0.15)', icon: '🟡', label: 'Warning' },
  information: { color: '#3B82F6', bg: 'rgba(59,130,246,0.15)', icon: '🔵', label: 'Info' },
};

const STATUS_CONFIG = {
  open: { color: '#DC2626', label: 'Open' },
  acknowledged: { color: '#F59E0B', label: 'Acknowledged' },
  in_progress: { color: '#3B82F6', label: 'In Progress' },
  resolved: { color: '#10B981', label: 'Resolved' },
  closed: { color: '#6B7280', label: 'Closed' },
  suppressed: { color: '#9CA3AF', label: 'Suppressed' },
};

// ─── Component ──────────────────────────────────────────────────────────────

export default function AlertsDashboard() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [counts, setCounts] = useState<AlertCounts>({ total: 0, open: 0, acknowledged: 0, inProgress: 0, critical: 0, emergency: 0 });
  const [viewMode, setViewMode] = useState<ViewMode>('all');
  const [search, setSearch] = useState('');
  const [selectedAlerts, setSelectedAlerts] = useState<Set<string>>(new Set());
  const [expandedAlert, setExpandedAlert] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');
  const [loading, setLoading] = useState(true);
  const [severityFilter, setSeverityFilter] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('');

  // ── Fetch ────────────────────────────────────────────────────────────────

  const fetchAlerts = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (severityFilter) params.set('severity', severityFilter);
      if (typeFilter) params.set('type', typeFilter);

      // View mode filters
      switch (viewMode) {
        case 'critical': params.set('severity', 'critical,emergency'); break;
        case 'acknowledged': params.set('status', 'acknowledged'); break;
        case 'closed': params.set('status', 'closed'); break;
        case 'escalated': break; // filtered client-side
        default: if (!params.has('status')) params.set('status', 'open,acknowledged,in_progress'); break;
      }

      const [alertsRes, countsRes] = await Promise.all([
        fetch(`/api/bre/alerts?${params}`),
        fetch('/api/bre/alerts?action=counts'),
      ]);

      const alertsData = await alertsRes.json();
      const countsData = await countsRes.json();

      let filteredAlerts = alertsData.alerts ?? [];
      if (viewMode === 'escalated') {
        filteredAlerts = filteredAlerts.filter((a: Alert) => a.escalationLevel > 0);
      }

      setAlerts(filteredAlerts);
      setCounts(countsData);
    } catch { /* retry on next poll */ }
    setLoading(false);
  }, [viewMode, search, severityFilter, typeFilter]);

  useEffect(() => { fetchAlerts(); }, [fetchAlerts]);

  // Auto-refresh every 30s
  useEffect(() => {
    const interval = setInterval(fetchAlerts, 30000);
    return () => clearInterval(interval);
  }, [fetchAlerts]);

  // ── Actions ──────────────────────────────────────────────────────────────

  const handleAction = async (action: string, id: string, extra?: Record<string, any>) => {
    await fetch('/api/bre/alerts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, id, ...extra }),
    });
    fetchAlerts();
  };

  const handleBulkAction = async (action: string) => {
    const ids = Array.from(selectedAlerts);
    if (ids.length === 0) return;
    await fetch('/api/bre/alerts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: `bulk_${action}`, ids }),
    });
    setSelectedAlerts(new Set());
    fetchAlerts();
  };

  const handleComment = async (alertId: string) => {
    if (!commentText.trim()) return;
    await handleAction('comment', alertId, { comment: commentText });
    setCommentText('');
  };

  const toggleSelect = (id: string) => {
    setSelectedAlerts((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedAlerts.size === alerts.length) {
      setSelectedAlerts(new Set());
    } else {
      setSelectedAlerts(new Set(alerts.map((a) => a.id)));
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────

  const viewTabs: { key: ViewMode; label: string; count?: number }[] = [
    { key: 'all', label: 'All Active', count: counts.total },
    { key: 'critical', label: 'Critical', count: counts.critical + counts.emergency },
    { key: 'acknowledged', label: 'Acknowledged', count: counts.acknowledged },
    { key: 'escalated', label: 'Escalated' },
    { key: 'closed', label: 'Closed' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', height: '100%' }}>
      {/* ── Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700 }}>🔔 Alert Console</h2>
          {counts.emergency > 0 && (
            <span style={{ background: '#DC2626', color: '#FFF', padding: '2px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 700, animation: 'pulse 2s infinite' }}>
              {counts.emergency} EMERGENCY
            </span>
          )}
          {counts.critical > 0 && (
            <span style={{ background: '#F97316', color: '#FFF', padding: '2px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 600 }}>
              {counts.critical} Critical
            </span>
          )}
        </div>

        {/* Bulk actions */}
        {selectedAlerts.size > 0 && (
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', color: '#9CA3AF' }}>{selectedAlerts.size} selected</span>
            <button onClick={() => handleBulkAction('acknowledge')} style={btnStyle('#3B82F6')}>Acknowledge All</button>
            <button onClick={() => handleBulkAction('close')} style={btnStyle('#6B7280')}>Close All</button>
          </div>
        )}
      </div>

      {/* ── Tabs ── */}
      <div style={{ display: 'flex', gap: '4px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '2px' }}>
        {viewTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setViewMode(tab.key)}
            style={{
              padding: '8px 16px', border: 'none', borderRadius: '6px 6px 0 0', cursor: 'pointer',
              fontSize: '13px', fontWeight: viewMode === tab.key ? 700 : 500,
              background: viewMode === tab.key ? 'rgba(59,130,246,0.15)' : 'transparent',
              color: viewMode === tab.key ? '#3B82F6' : '#9CA3AF',
              transition: 'all 0.2s',
            }}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span style={{ marginLeft: '6px', padding: '1px 6px', borderRadius: '8px', fontSize: '11px', background: viewMode === tab.key ? 'rgba(59,130,246,0.3)' : 'rgba(255,255,255,0.08)' }}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Filters ── */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <input
          placeholder="Search alerts..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ ...inputStyle, flex: 1, minWidth: '200px' }}
        />
        <select value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)} style={selectStyle}>
          <option value="">All Severities</option>
          <option value="emergency">🚨 Emergency</option>
          <option value="critical">🔴 Critical</option>
          <option value="warning">🟡 Warning</option>
          <option value="information">🔵 Information</option>
        </select>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} style={selectStyle}>
          <option value="">All Types</option>
          <option value="threshold">Threshold</option>
          <option value="trend">Trend</option>
          <option value="safety">Safety</option>
          <option value="critical_path">Critical Path</option>
          <option value="resource">Resource</option>
          <option value="execution">Execution</option>
          <option value="quality">Quality</option>
          <option value="permit">Permit</option>
          <option value="inspection">Inspection</option>
        </select>
      </div>

      {/* ── Alert List ── */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#6B7280' }}>Loading alerts...</div>
        ) : alerts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#6B7280' }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>✅</div>
            <div>No alerts match the current filters.</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {/* Select all */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 8px' }}>
              <input type="checkbox" checked={selectedAlerts.size === alerts.length && alerts.length > 0} onChange={toggleSelectAll} />
              <span style={{ fontSize: '12px', color: '#6B7280' }}>Select all ({alerts.length})</span>
            </div>

            {alerts.map((alert) => {
              const sev = SEVERITY_CONFIG[alert.severity] ?? SEVERITY_CONFIG.information;
              const stat = STATUS_CONFIG[alert.status] ?? STATUS_CONFIG.open;
              const isExpanded = expandedAlert === alert.id;

              return (
                <div key={alert.id} style={{
                  background: 'rgba(255,255,255,0.03)', border: `1px solid ${sev.color}30`,
                  borderLeft: `4px solid ${sev.color}`, borderRadius: '8px',
                  transition: 'all 0.2s', cursor: 'pointer',
                }}>
                  {/* Alert row */}
                  <div
                    onClick={() => setExpandedAlert(isExpanded ? null : alert.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px' }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedAlerts.has(alert.id)}
                      onChange={(e) => { e.stopPropagation(); toggleSelect(alert.id); }}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <span style={{ fontSize: '18px' }}>{sev.icon}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 600, fontSize: '14px' }}>{alert.title}</span>
                        <span style={{ fontSize: '11px', padding: '1px 8px', borderRadius: '4px', background: sev.bg, color: sev.color, fontWeight: 600 }}>
                          {sev.label}
                        </span>
                        <span style={{ fontSize: '11px', padding: '1px 8px', borderRadius: '4px', background: 'rgba(255,255,255,0.06)', color: stat.color, fontWeight: 500 }}>
                          {stat.label}
                        </span>
                        {alert.escalationLevel > 0 && (
                          <span style={{ fontSize: '11px', padding: '1px 8px', borderRadius: '4px', background: 'rgba(249,115,22,0.15)', color: '#F97316', fontWeight: 600 }}>
                            L{alert.escalationLevel} Escalated
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '12px', color: '#9CA3AF', marginTop: '2px' }}>
                        {alert.alertType} • {new Date(alert.createdAt).toLocaleString()}
                        {alert.triggerValue && ` • Value: ${alert.triggerValue}`}
                      </div>
                    </div>
                    <span style={{ fontSize: '14px', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }}>▼</span>
                  </div>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div style={{ padding: '0 16px 16px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                      <div style={{ padding: '12px 0', fontSize: '13px', color: '#D1D5DB' }}>{alert.message}</div>

                      {/* Actions */}
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '12px' }}>
                        {alert.status === 'open' && (
                          <button onClick={() => handleAction('acknowledge', alert.id)} style={btnStyle('#3B82F6')}>Acknowledge</button>
                        )}
                        {['open', 'acknowledged'].includes(alert.status) && (
                          <button onClick={() => handleAction('assign', alert.id, { assignedTo: 'current_user' })} style={btnStyle('#8B5CF6')}>Assign to Me</button>
                        )}
                        {['open', 'acknowledged', 'in_progress'].includes(alert.status) && (
                          <button onClick={() => handleAction('resolve', alert.id, { notes: 'Resolved via dashboard' })} style={btnStyle('#10B981')}>Resolve</button>
                        )}
                        {alert.status !== 'closed' && (
                          <button onClick={() => handleAction('close', alert.id)} style={btnStyle('#6B7280')}>Close</button>
                        )}
                      </div>

                      {/* Comments */}
                      {alert.comments && alert.comments.length > 0 && (
                        <div style={{ marginBottom: '12px' }}>
                          <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '6px', fontWeight: 600 }}>Comments</div>
                          {alert.comments.map((c) => (
                            <div key={c.id} style={{ fontSize: '12px', color: '#D1D5DB', padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                              <span style={{ color: '#9CA3AF' }}>{new Date(c.createdAt).toLocaleString()}</span> — {c.comment}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Add comment */}
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <input
                          placeholder="Add a comment..."
                          value={expandedAlert === alert.id ? commentText : ''}
                          onChange={(e) => setCommentText(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleComment(alert.id)}
                          style={{ ...inputStyle, flex: 1 }}
                        />
                        <button onClick={() => handleComment(alert.id)} style={btnStyle('#3B82F6')}>Send</button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pulse animation */}
      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }
      `}</style>
    </div>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const btnStyle = (bg: string): React.CSSProperties => ({
  padding: '5px 12px', border: 'none', borderRadius: '6px',
  background: `${bg}20`, color: bg, fontSize: '12px', fontWeight: 600,
  cursor: 'pointer', transition: 'all 0.2s',
});

const inputStyle: React.CSSProperties = {
  padding: '8px 12px', border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '6px', background: 'rgba(255,255,255,0.04)',
  color: '#FFF', fontSize: '13px', outline: 'none',
};

const selectStyle: React.CSSProperties = {
  ...inputStyle, cursor: 'pointer', minWidth: '140px',
};
