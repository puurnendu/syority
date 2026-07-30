'use client';

/**
 * M7.6F — Recommendation Panel Component
 *
 * Displays decision recommendations with accept/reject/defer actions.
 * Integrates with OIS dashboards, TV Mode, Meeting Mode, and Reports.
 */

import React, { useState, useCallback } from 'react';

// ── Types ────────────────────────────────────────────────────────────────────

interface RecommendationAlternative {
  title: string;
  description: string;
  confidence: number;
}

interface RecommendationKPI {
  name: string;
  value: number;
  threshold: number;
}

interface Recommendation {
  id: string;
  slug: string;
  title: string;
  description: string;
  category: string;
  priority: string;
  confidence_score: number;
  reasoning: string;
  expected_impact?: string;
  status: string;
  source_type: string;
  supporting_kpis?: RecommendationKPI[];
  alternatives?: RecommendationAlternative[];
  created_at: string;
  accepted_by?: string;
  accepted_at?: string;
  rejected_at?: string;
  rejection_reason?: string;
  deferred_until?: string;
}

interface RecommendationPanelProps {
  recommendations: Recommendation[];
  onAccept: (id: string, comment?: string) => Promise<void>;
  onReject: (id: string, reason: string) => Promise<void>;
  onDefer: (id: string, deferUntil: Date, comment?: string) => Promise<void>;
  readOnly?: boolean;
  compact?: boolean;
}

// ── Priority Styling ─────────────────────────────────────────────────────────

const priorityConfig: Record<string, { color: string; bg: string; icon: string }> = {
  critical: { color: '#ef4444', bg: '#fef2f2', icon: '🔴' },
  high: { color: '#f59e0b', bg: '#fffbeb', icon: '🟠' },
  medium: { color: '#3b82f6', bg: '#eff6ff', icon: '🔵' },
  low: { color: '#6b7280', bg: '#f9fafb', icon: '⚪' },
};

const statusConfig: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pending', color: '#f59e0b' },
  presented: { label: 'Presented', color: '#3b82f6' },
  accepted: { label: 'Accepted', color: '#10b981' },
  rejected: { label: 'Rejected', color: '#ef4444' },
  deferred: { label: 'Deferred', color: '#8b5cf6' },
  expired: { label: 'Expired', color: '#6b7280' },
  superseded: { label: 'Superseded', color: '#6b7280' },
};

// ── Component ────────────────────────────────────────────────────────────────

export function RecommendationPanel({
  recommendations,
  onAccept,
  onReject,
  onDefer,
  readOnly = false,
  compact = false,
}: RecommendationPanelProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: compact ? '8px' : '16px' }}>
      {recommendations.length === 0 && (
        <div style={{
          textAlign: 'center',
          padding: '32px',
          color: '#9ca3af',
          fontSize: '14px',
        }}>
          No recommendations at this time.
        </div>
      )}
      {recommendations.map((rec) => (
        <RecommendationCard
          key={rec.id}
          recommendation={rec}
          onAccept={onAccept}
          onReject={onReject}
          onDefer={onDefer}
          readOnly={readOnly}
          compact={compact}
        />
      ))}
    </div>
  );
}

// ── Card ─────────────────────────────────────────────────────────────────────

function RecommendationCard({
  recommendation: rec,
  onAccept,
  onReject,
  onDefer,
  readOnly,
  compact,
}: {
  recommendation: Recommendation;
  onAccept: (id: string, comment?: string) => Promise<void>;
  onReject: (id: string, reason: string) => Promise<void>;
  onDefer: (id: string, deferUntil: Date, comment?: string) => Promise<void>;
  readOnly: boolean;
  compact: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [loading, setLoading] = useState(false);

  const priority = priorityConfig[rec.priority] ?? priorityConfig.medium;
  const status = statusConfig[rec.status] ?? statusConfig.pending;
  const isActionable = !readOnly && (rec.status === 'pending' || rec.status === 'presented');
  const confidence = Math.round(Number(rec.confidence_score) * 100);

  const handleAccept = useCallback(async () => {
    setLoading(true);
    try { await onAccept(rec.id); } finally { setLoading(false); }
  }, [rec.id, onAccept]);

  const handleReject = useCallback(async () => {
    if (!rejectReason.trim()) return;
    setLoading(true);
    try {
      await onReject(rec.id, rejectReason);
      setShowRejectInput(false);
    } finally { setLoading(false); }
  }, [rec.id, rejectReason, onReject]);

  const handleDefer = useCallback(async () => {
    setLoading(true);
    const oneWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    try { await onDefer(rec.id, oneWeek); } finally { setLoading(false); }
  }, [rec.id, onDefer]);

  return (
    <div
      style={{
        border: `1px solid ${priority.color}20`,
        borderLeft: `4px solid ${priority.color}`,
        borderRadius: '8px',
        backgroundColor: '#fff',
        padding: compact ? '12px' : '16px',
        transition: 'box-shadow 0.2s',
        cursor: 'pointer',
      }}
      onClick={() => setExpanded(!expanded)}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span>{priority.icon}</span>
            <span style={{
              fontSize: compact ? '13px' : '15px',
              fontWeight: 600,
              color: '#1f2937',
            }}>
              {rec.title}
            </span>
          </div>
          {!compact && (
            <p style={{ fontSize: '13px', color: '#6b7280', margin: '4px 0 0' }}>
              {rec.description}
            </p>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          {/* Confidence Badge */}
          <span style={{
            fontSize: '11px',
            fontWeight: 600,
            padding: '2px 8px',
            borderRadius: '12px',
            backgroundColor: confidence >= 80 ? '#dcfce7' : confidence >= 50 ? '#fef3c7' : '#fef2f2',
            color: confidence >= 80 ? '#166534' : confidence >= 50 ? '#92400e' : '#991b1b',
          }}>
            {confidence}%
          </span>

          {/* Status Badge */}
          <span style={{
            fontSize: '11px',
            fontWeight: 500,
            padding: '2px 8px',
            borderRadius: '12px',
            backgroundColor: `${status.color}15`,
            color: status.color,
          }}>
            {status.label}
          </span>
        </div>
      </div>

      {/* Expanded Details */}
      {expanded && (
        <div style={{ marginTop: '12px', borderTop: '1px solid #f3f4f6', paddingTop: '12px' }}>
          {/* Reasoning */}
          <div style={{ marginBottom: '12px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>Reasoning</span>
            <p style={{ fontSize: '13px', color: '#4b5563', margin: '4px 0' }}>{rec.reasoning}</p>
          </div>

          {/* Expected Impact */}
          {rec.expected_impact && (
            <div style={{ marginBottom: '12px' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>Expected Impact</span>
              <p style={{ fontSize: '13px', color: '#4b5563', margin: '4px 0' }}>{rec.expected_impact}</p>
            </div>
          )}

          {/* Supporting KPIs */}
          {rec.supporting_kpis && rec.supporting_kpis.length > 0 && (
            <div style={{ marginBottom: '12px' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>Supporting KPIs</span>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '4px' }}>
                {rec.supporting_kpis.map((kpi, i) => (
                  <span key={i} style={{
                    fontSize: '11px',
                    padding: '4px 8px',
                    borderRadius: '6px',
                    backgroundColor: '#f3f4f6',
                    color: '#374151',
                  }}>
                    {kpi.name}: {kpi.value} (threshold: {kpi.threshold})
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Alternatives */}
          {rec.alternatives && rec.alternatives.length > 0 && (
            <div style={{ marginBottom: '12px' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>Alternatives</span>
              {rec.alternatives.map((alt, i) => (
                <div key={i} style={{
                  fontSize: '12px',
                  padding: '8px',
                  marginTop: '4px',
                  borderRadius: '6px',
                  backgroundColor: '#f9fafb',
                  border: '1px solid #e5e7eb',
                }}>
                  <strong>{alt.title}</strong> ({Math.round(alt.confidence * 100)}%)
                  <p style={{ margin: '2px 0 0', color: '#6b7280' }}>{alt.description}</p>
                </div>
              ))}
            </div>
          )}

          {/* Reject Input */}
          {showRejectInput && (
            <div style={{ marginBottom: '12px' }} onClick={(e) => e.stopPropagation()}>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Reason for rejection..."
                style={{
                  width: '100%',
                  padding: '8px',
                  borderRadius: '6px',
                  border: '1px solid #d1d5db',
                  fontSize: '13px',
                  resize: 'vertical',
                  minHeight: '60px',
                }}
              />
              <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                <button
                  onClick={handleReject}
                  disabled={loading || !rejectReason.trim()}
                  style={{
                    padding: '6px 16px',
                    borderRadius: '6px',
                    border: 'none',
                    backgroundColor: '#ef4444',
                    color: '#fff',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    opacity: loading || !rejectReason.trim() ? 0.5 : 1,
                  }}
                >
                  Confirm Reject
                </button>
                <button
                  onClick={() => setShowRejectInput(false)}
                  style={{
                    padding: '6px 16px',
                    borderRadius: '6px',
                    border: '1px solid #d1d5db',
                    backgroundColor: '#fff',
                    color: '#374151',
                    fontSize: '12px',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          {isActionable && !showRejectInput && (
            <div
              style={{ display: 'flex', gap: '8px', marginTop: '8px' }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={handleAccept}
                disabled={loading}
                style={{
                  padding: '6px 20px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: '#10b981',
                  color: '#fff',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  opacity: loading ? 0.5 : 1,
                }}
              >
                ✓ Accept
              </button>
              <button
                onClick={() => setShowRejectInput(true)}
                disabled={loading}
                style={{
                  padding: '6px 20px',
                  borderRadius: '6px',
                  border: '1px solid #ef4444',
                  backgroundColor: '#fff',
                  color: '#ef4444',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                ✕ Reject
              </button>
              <button
                onClick={handleDefer}
                disabled={loading}
                style={{
                  padding: '6px 20px',
                  borderRadius: '6px',
                  border: '1px solid #8b5cf6',
                  backgroundColor: '#fff',
                  color: '#8b5cf6',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                ↻ Defer 1 Week
              </button>
            </div>
          )}

          {/* Meta */}
          <div style={{
            display: 'flex',
            gap: '16px',
            marginTop: '12px',
            fontSize: '11px',
            color: '#9ca3af',
          }}>
            <span>Category: {rec.category}</span>
            <span>Source: {rec.source_type}</span>
            <span>Created: {new Date(rec.created_at).toLocaleDateString()}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default RecommendationPanel;
