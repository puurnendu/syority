'use client';

/**
 * M8.11 — ScopeChangeDashboard Component
 *
 * Enterprise Scope Change & Discovery Work management UI.
 * Displays: Dashboard KPIs, Discovery Log, Scope Change Proposals,
 * and lifecycle actions (assess, submit, approve, reject, apply).
 */
import React, { useEffect, useState, useCallback } from 'react';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';

interface Discovery {
  id: string;
  title: string;
  description?: string;
  discovery_type: string;
  source?: string;
  location?: string;
  discipline?: string;
  priority: string;
  estimated_hours: number;
  estimated_cost: number;
  status: string;
  assessed_at?: string;
  assessment_notes?: string;
  discovered_at: string;
}

interface ScopeChangeItem {
  id: string;
  item_type: string;
  description: string;
  discipline?: string;
  estimated_hours: number;
  estimated_cost: number;
  crew_size: number;
  sort_order: number;
}

interface ScopeChange {
  id: string;
  change_number: string;
  title: string;
  description?: string;
  change_category: string;
  justification?: string;
  status: string;
  priority: string;
  discipline?: string;
  schedule_impact_days: number;
  cost_impact: number;
  resource_impact_hours: number;
  critical_path_affected: boolean;
  impact_analysis?: any;
  review_notes?: string;
  items: ScopeChangeItem[];
  created_at: string;
}

interface DashboardSummary {
  discoveries: {
    total: number;
    byStatus: Record<string, number>;
    byPriority: Record<string, number>;
    totalEstimatedHours: number;
    totalEstimatedCost: number;
  };
  scopeChanges: {
    totalChanges: number;
    totalItems: number;
    byStatus: Record<string, number>;
    byCategory: Record<string, number>;
    totalEstimatedHours: number;
    totalEstimatedCost: number;
    totalScheduleImpactDays: number;
    totalCostImpact: number;
  };
}

type TabView = 'dashboard' | 'discoveries' | 'proposals';

// ── Helper Components ─────────────────────────────────────────────────

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const colors: Record<string, string> = {
    discovered: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    assessed: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
    converted: 'bg-green-500/20 text-green-300 border-green-500/30',
    closed: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
    rejected: 'bg-red-500/20 text-red-300 border-red-500/30',
    draft: 'bg-gray-500/20 text-gray-300 border-gray-500/30',
    analyzing: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
    proposed: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    approved: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    applying: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
    applied: 'bg-green-600/20 text-green-300 border-green-600/30',
  };
  return (
    <span className={`px-2 py-0.5 text-xs font-medium rounded-full border ${colors[status] ?? 'bg-gray-600 text-gray-300'}`}>
      {status.replace(/_/g, ' ').toUpperCase()}
    </span>
  );
};

const PriorityBadge: React.FC<{ priority: string }> = ({ priority }) => {
  const colors: Record<string, string> = {
    critical: 'text-red-400',
    high: 'text-orange-400',
    medium: 'text-yellow-400',
    low: 'text-gray-400',
  };
  const icons: Record<string, string> = {
    critical: '🔴',
    high: '🟠',
    medium: '🟡',
    low: '⚪',
  };
  return (
    <span className={`text-xs ${colors[priority] ?? 'text-gray-400'}`}>
      {icons[priority] ?? '⚪'} {priority.toUpperCase()}
    </span>
  );
};

const KPICard: React.FC<{ label: string; value: string | number; icon: string; color?: string }> = ({
  label, value, icon, color = 'text-blue-400',
}) => (
  <div className="bg-gray-800/60 rounded-lg p-4 border border-gray-700/50">
    <div className="flex items-center justify-between mb-2">
      <span className="text-gray-400 text-xs">{label}</span>
      <span className="text-lg">{icon}</span>
    </div>
    <div className={`text-2xl font-bold ${color}`}>{value}</div>
  </div>
);

// ── Main Component ────────────────────────────────────────────────────

export function ScopeChangeDashboard() {
  const { selectedEventId } = useWorkspaceStore();
  const [activeTab, setActiveTab] = useState<TabView>('dashboard');
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [discoveries, setDiscoveries] = useState<Discovery[]>([]);
  const [scopeChanges, setScopeChanges] = useState<ScopeChange[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSC, setSelectedSC] = useState<ScopeChange | null>(null);

  const fetchData = useCallback(async () => {
    if (!selectedEventId) return;
    setLoading(true);
    setError(null);
    try {
      const [dashRes, discRes, scRes] = await Promise.all([
        fetch(`/api/events/${selectedEventId}/scope-changes/dashboard`),
        fetch(`/api/events/${selectedEventId}/scope-changes/discoveries`),
        fetch(`/api/events/${selectedEventId}/scope-changes`),
      ]);

      if (dashRes.ok) {
        const d = await dashRes.json();
        setSummary(d.data);
      }
      if (discRes.ok) {
        const d = await discRes.json();
        setDiscoveries(d.data ?? []);
      }
      if (scRes.ok) {
        const d = await scRes.json();
        setScopeChanges(d.data ?? []);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [selectedEventId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const doAction = async (url: string, body: any) => {
    try {
      const res = await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(`Error: ${err.error}`);
        return false;
      }
      await fetchData();
      return true;
    } catch (err: any) {
      alert(`Error: ${err.message}`);
      return false;
    }
  };

  if (!selectedEventId) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400">
        <div className="text-center">
          <span className="text-4xl mb-4 block">🔄</span>
          <p className="text-lg font-medium">Select an event to manage scope changes</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-900 text-white">
      {/* Tab bar */}
      <div className="flex items-center border-b border-gray-700 px-4">
        {([
          { key: 'dashboard', label: 'Dashboard', icon: '📊' },
          { key: 'discoveries', label: 'Discovery Log', icon: '🔍' },
          { key: 'proposals', label: 'Scope Change Proposals', icon: '📋' },
        ] as const).map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
        <div className="ml-auto">
          <button
            onClick={fetchData}
            disabled={loading}
            className="px-3 py-1.5 text-xs bg-gray-700 hover:bg-gray-600 rounded transition-colors"
          >
            {loading ? '⏳ Loading...' : '🔄 Refresh'}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-900/30 border-b border-red-700/50 px-4 py-2 text-sm text-red-300">
          ⚠️ {error}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {activeTab === 'dashboard' && summary && <DashboardView summary={summary} />}
        {activeTab === 'discoveries' && (
          <DiscoveryListView
            discoveries={discoveries}
            eventId={selectedEventId}
            onAction={doAction}
          />
        )}
        {activeTab === 'proposals' && (
          <ProposalListView
            scopeChanges={scopeChanges}
            eventId={selectedEventId}
            selectedSC={selectedSC}
            onSelectSC={setSelectedSC}
            onAction={doAction}
            onRefresh={fetchData}
          />
        )}
        {activeTab === 'dashboard' && !summary && !loading && (
          <div className="text-center text-gray-500 py-8">No data available</div>
        )}
      </div>
    </div>
  );
}

// ── Dashboard View ────────────────────────────────────────────────────

const DashboardView: React.FC<{ summary: DashboardSummary }> = ({ summary }) => (
  <div className="space-y-6">
    {/* KPI Cards */}
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <KPICard
        label="Discovery Items"
        value={summary.discoveries.total}
        icon="🔍"
        color="text-blue-400"
      />
      <KPICard
        label="Scope Changes"
        value={summary.scopeChanges.totalChanges}
        icon="📋"
        color="text-purple-400"
      />
      <KPICard
        label="Total Schedule Impact"
        value={`${summary.scopeChanges.totalScheduleImpactDays.toFixed(1)} days`}
        icon="📅"
        color="text-orange-400"
      />
      <KPICard
        label="Total Cost Impact"
        value={`$${(summary.scopeChanges.totalCostImpact / 1000).toFixed(1)}K`}
        icon="💰"
        color="text-green-400"
      />
    </div>

    {/* Status distribution */}
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="bg-gray-800/60 rounded-lg p-4 border border-gray-700/50">
        <h3 className="text-sm font-medium text-gray-300 mb-3">Discovery Status</h3>
        <div className="space-y-2">
          {Object.entries(summary.discoveries.byStatus).map(([status, count]) => (
            <div key={status} className="flex items-center justify-between">
              <StatusBadge status={status} />
              <span className="text-sm font-medium text-gray-300">{count}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="bg-gray-800/60 rounded-lg p-4 border border-gray-700/50">
        <h3 className="text-sm font-medium text-gray-300 mb-3">Scope Change Status</h3>
        <div className="space-y-2">
          {Object.entries(summary.scopeChanges.byStatus).map(([status, count]) => (
            <div key={status} className="flex items-center justify-between">
              <StatusBadge status={status} />
              <span className="text-sm font-medium text-gray-300">{count}</span>
            </div>
          ))}
        </div>
      </div>
    </div>

    {/* Estimated totals */}
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <KPICard
        label="Discovery Est. Hours"
        value={summary.discoveries.totalEstimatedHours}
        icon="⏱️"
        color="text-cyan-400"
      />
      <KPICard
        label="Discovery Est. Cost"
        value={`$${(summary.discoveries.totalEstimatedCost / 1000).toFixed(1)}K`}
        icon="💵"
        color="text-cyan-400"
      />
      <KPICard
        label="Change Item Est. Hours"
        value={summary.scopeChanges.totalEstimatedHours}
        icon="⏱️"
        color="text-purple-400"
      />
      <KPICard
        label="Change Item Est. Cost"
        value={`$${(summary.scopeChanges.totalEstimatedCost / 1000).toFixed(1)}K`}
        icon="💵"
        color="text-purple-400"
      />
    </div>
  </div>
);

// ── Discovery List View ───────────────────────────────────────────────

const DiscoveryListView: React.FC<{
  discoveries: Discovery[];
  eventId: string;
  onAction: (url: string, body: any) => Promise<boolean>;
}> = ({ discoveries, eventId, onAction }) => {
  if (discoveries.length === 0) {
    return (
      <div className="text-center text-gray-500 py-8">
        <span className="text-3xl block mb-2">🔍</span>
        No discovery work records found for this event.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold text-gray-200 mb-4">
        🔍 Discovery Work Log ({discoveries.length} items)
      </h2>
      {discoveries.map(d => (
        <div key={d.id} className="bg-gray-800/60 rounded-lg p-4 border border-gray-700/50 hover:border-gray-600 transition-colors">
          <div className="flex items-start justify-between mb-2">
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-gray-200">{d.title}</h3>
              {d.description && <p className="text-xs text-gray-400 mt-1 line-clamp-2">{d.description}</p>}
            </div>
            <div className="flex items-center gap-2 ml-4">
              <PriorityBadge priority={d.priority} />
              <StatusBadge status={d.status} />
            </div>
          </div>
          <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
            {d.discipline && <span>🔧 {d.discipline}</span>}
            {d.location && <span>📍 {d.location}</span>}
            <span>⏱️ {d.estimated_hours}h</span>
            <span>💰 ${d.estimated_cost.toLocaleString()}</span>
            {d.source && <span>📌 {d.source}</span>}
          </div>
          {d.assessment_notes && (
            <div className="mt-2 text-xs text-gray-300 bg-gray-700/30 rounded p-2">
              💬 {d.assessment_notes}
            </div>
          )}
          {/* Actions */}
          <div className="flex gap-2 mt-3">
            {d.status === 'discovered' && (
              <>
                <button
                  onClick={() => onAction(
                    `/api/events/${eventId}/scope-changes/discoveries/${d.id}`,
                    { action: 'assess', assessment_notes: 'Assessed and approved for scope change' }
                  )}
                  className="px-3 py-1 text-xs bg-purple-600 hover:bg-purple-500 rounded transition-colors"
                >
                  ✅ Assess
                </button>
                <button
                  onClick={() => onAction(
                    `/api/events/${eventId}/scope-changes/discoveries/${d.id}`,
                    { action: 'reject', notes: 'Not in TA scope' }
                  )}
                  className="px-3 py-1 text-xs bg-red-600/60 hover:bg-red-500 rounded transition-colors"
                >
                  ❌ Reject
                </button>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

// ── Proposal List View ────────────────────────────────────────────────

const ProposalListView: React.FC<{
  scopeChanges: ScopeChange[];
  eventId: string;
  selectedSC: ScopeChange | null;
  onSelectSC: (sc: ScopeChange | null) => void;
  onAction: (url: string, body: any) => Promise<boolean>;
  onRefresh: () => void;
}> = ({ scopeChanges, eventId, selectedSC, onSelectSC, onAction, onRefresh }) => {
  if (scopeChanges.length === 0) {
    return (
      <div className="text-center text-gray-500 py-8">
        <span className="text-3xl block mb-2">📋</span>
        No scope change proposals found for this event.
      </div>
    );
  }

  const handleAction = async (scId: string, action: string, extra?: any) => {
    const ok = await onAction(
      `/api/events/${eventId}/scope-changes/${scId}`,
      { action, ...extra }
    );
    if (ok) onRefresh();
  };

  return (
    <div className="flex gap-4 h-full">
      {/* List */}
      <div className="w-1/2 space-y-3 overflow-auto">
        <h2 className="text-lg font-semibold text-gray-200 mb-4">
          📋 Scope Change Proposals ({scopeChanges.length})
        </h2>
        {scopeChanges.map(sc => (
          <div
            key={sc.id}
            onClick={() => onSelectSC(sc)}
            className={`bg-gray-800/60 rounded-lg p-4 border cursor-pointer transition-colors ${
              selectedSC?.id === sc.id
                ? 'border-blue-500/50 bg-gray-800'
                : 'border-gray-700/50 hover:border-gray-600'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-gray-500">{sc.change_number}</span>
                <StatusBadge status={sc.status} />
                <PriorityBadge priority={sc.priority} />
              </div>
              {sc.critical_path_affected && (
                <span className="text-xs text-red-400 font-medium">⚠️ CP AFFECTED</span>
              )}
            </div>
            <h3 className="text-sm font-medium text-gray-200">{sc.title}</h3>
            <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
              <span>📅 {sc.schedule_impact_days.toFixed(1)}d impact</span>
              <span>💰 ${sc.cost_impact.toLocaleString()}</span>
              <span>👥 {sc.resource_impact_hours}h</span>
              <span>📝 {sc.items.length} items</span>
            </div>

            {/* Actions */}
            <div className="flex gap-2 mt-3">
              {sc.status === 'draft' && (
                <button
                  onClick={(e) => { e.stopPropagation(); handleAction(sc.id, 'analyze'); }}
                  className="px-3 py-1 text-xs bg-yellow-600 hover:bg-yellow-500 rounded"
                >
                  🔬 Analyze Impact
                </button>
              )}
              {(sc.status === 'draft' || sc.status === 'analyzing') && sc.items.length > 0 && (
                <button
                  onClick={(e) => { e.stopPropagation(); handleAction(sc.id, 'submit'); }}
                  className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-500 rounded"
                >
                  📤 Submit
                </button>
              )}
              {sc.status === 'proposed' && (
                <>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleAction(sc.id, 'approve', { notes: 'Approved' }); }}
                    className="px-3 py-1 text-xs bg-green-600 hover:bg-green-500 rounded"
                  >
                    ✅ Approve
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleAction(sc.id, 'reject', { notes: 'Rejected — insufficient justification' }); }}
                    className="px-3 py-1 text-xs bg-red-600/60 hover:bg-red-500 rounded"
                  >
                    ❌ Reject
                  </button>
                </>
              )}
              {sc.status === 'approved' && (
                <button
                  onClick={(e) => { e.stopPropagation(); handleAction(sc.id, 'apply'); }}
                  className="px-3 py-1 text-xs bg-emerald-600 hover:bg-emerald-500 rounded"
                >
                  🚀 Apply to Schedule
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Detail panel */}
      <div className="w-1/2 overflow-auto">
        {selectedSC ? (
          <SCDetailPanel sc={selectedSC} />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500">
            <div className="text-center">
              <span className="text-3xl block mb-2">👈</span>
              <p className="text-sm">Select a scope change to view details</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ── SC Detail Panel ───────────────────────────────────────────────────

const SCDetailPanel: React.FC<{ sc: ScopeChange }> = ({ sc }) => (
  <div className="bg-gray-800/60 rounded-lg border border-gray-700/50 p-4 space-y-4">
    <div>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-mono text-gray-500">{sc.change_number}</span>
        <StatusBadge status={sc.status} />
        <PriorityBadge priority={sc.priority} />
      </div>
      <h2 className="text-lg font-semibold text-gray-200">{sc.title}</h2>
      {sc.description && <p className="text-sm text-gray-400 mt-1">{sc.description}</p>}
    </div>

    {sc.justification && (
      <div className="bg-gray-700/30 rounded p-3">
        <h4 className="text-xs font-medium text-gray-300 mb-1">Justification</h4>
        <p className="text-sm text-gray-300">{sc.justification}</p>
      </div>
    )}

    {sc.review_notes && (
      <div className="bg-blue-900/20 rounded p-3 border border-blue-700/30">
        <h4 className="text-xs font-medium text-blue-300 mb-1">Review Notes</h4>
        <p className="text-sm text-blue-200">{sc.review_notes}</p>
      </div>
    )}

    {/* Impact Summary */}
    <div className="grid grid-cols-4 gap-3">
      <div className="text-center">
        <div className="text-lg font-bold text-orange-400">{sc.schedule_impact_days.toFixed(1)}</div>
        <div className="text-xs text-gray-500">Days Impact</div>
      </div>
      <div className="text-center">
        <div className="text-lg font-bold text-green-400">${(sc.cost_impact / 1000).toFixed(1)}K</div>
        <div className="text-xs text-gray-500">Cost Impact</div>
      </div>
      <div className="text-center">
        <div className="text-lg font-bold text-blue-400">{sc.resource_impact_hours}</div>
        <div className="text-xs text-gray-500">Hours Impact</div>
      </div>
      <div className="text-center">
        <div className={`text-lg font-bold ${sc.critical_path_affected ? 'text-red-400' : 'text-gray-400'}`}>
          {sc.critical_path_affected ? '⚠️ YES' : '✅ NO'}
        </div>
        <div className="text-xs text-gray-500">CP Affected</div>
      </div>
    </div>

    {/* Items */}
    <div>
      <h3 className="text-sm font-medium text-gray-300 mb-2">
        📝 Line Items ({sc.items.length})
      </h3>
      <div className="space-y-2">
        {sc.items.map((item, idx) => (
          <div key={item.id} className="bg-gray-700/30 rounded p-3 border border-gray-600/30">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">#{idx + 1}</span>
                <span className={`px-2 py-0.5 text-xs rounded ${
                  item.item_type === 'new_workpack' ? 'bg-indigo-500/20 text-indigo-300' :
                  item.item_type === 'new_activity' ? 'bg-blue-500/20 text-blue-300' :
                  item.item_type === 'modify_activity' ? 'bg-yellow-500/20 text-yellow-300' :
                  'bg-red-500/20 text-red-300'
                }`}>
                  {item.item_type.replace(/_/g, ' ').toUpperCase()}
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs text-gray-400">
                {item.estimated_hours > 0 && <span>⏱️ {item.estimated_hours}h</span>}
                {item.estimated_cost > 0 && <span>💰 ${item.estimated_cost.toLocaleString()}</span>}
                {item.crew_size > 1 && <span>👥 {item.crew_size}</span>}
              </div>
            </div>
            <p className="text-sm text-gray-300">{item.description}</p>
            {item.discipline && (
              <span className="text-xs text-gray-500 mt-1 inline-block">🔧 {item.discipline}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  </div>
);
