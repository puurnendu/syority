'use client';

/**
 * M8.8 — Schedule Control Dashboard
 *
 * Integrates all M8.8 intelligence into the planner workspace:
 * - Schedule Health Card (SHI)
 * - Baseline Control Panel
 * - Variance Panel
 * - Forecast Panel
 * - Critical Path Panel
 * - Resource/Schedule Risk Panel
 * - Change Control Panel
 *
 * INVARIANT: UI must visually distinguish
 *   CURRENT / BASELINE / FORECAST / PROPOSED / APPLIED
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { ScheduleGantt } from '@/components/Schedule/ScheduleGantt';

// ── Types ──────────────────────────────────────────────────────────────

interface ComponentScore {
  name: string;
  score: number;
  weight: number;
  weighted: number;
  detail: string;
}

interface HealthData {
  shi: number;
  classification: string;
  components: ComponentScore[];
  event_id: string;
  computed_at: string;
}

interface BaselineData {
  id: string;
  name: string;
  created_at: string;
  is_current: boolean;
  description: string | null;
  activity_count: number;
}

interface VarianceItem {
  activity_id: string;
  activity_number: string | null;
  description: string;
  start_variance_days: number | null;
  finish_variance_days: number | null;
  duration_variance_hours: number;
  float_erosion: number | null;
  criticality_changed: boolean;
}

interface ForecastItem {
  activity_id: string;
  description: string;
  planned_end: string | null;
  forecast_finish: string | null;
  variance_from_plan_days: number | null;
  forecast_method: string;
}

interface CriticalActivity {
  activity_id: string;
  activity_number: string | null;
  description: string;
  status: string | null;
  total_float_hours: number | null;
  downstream_impact: number;
}

interface ChangeRequest {
  id: string;
  title: string;
  status: string;
  change_type: string;
  activities_affected: number;
  submitted_at: string;
  submitted_by: string;
  reviewed_at: string | null;
  applied_at: string | null;
}

// ── Constants ──────────────────────────────────────────────────────────

const SHI_COLORS: Record<string, string> = {
  GREEN: '#22c55e',
  YELLOW: '#eab308',
  ORANGE: '#f97316',
  RED: '#ef4444',
};

const STATUS_COLORS: Record<string, string> = {
  proposed: '#3b82f6',
  review: '#f59e0b',
  approved: '#22c55e',
  rejected: '#ef4444',
  applied: '#8b5cf6',
  superseded: '#6b7280',
};

const TAB_KEYS = ['health', 'gantt', 'baselines', 'variance', 'forecast', 'critpath', 'risks', 'changes'] as const;
type TabKey = typeof TAB_KEYS[number];
const TAB_LABELS: Record<TabKey, { label: string; icon: string }> = {
  health: { label: 'Health', icon: '🏥' },
  gantt: { label: 'Execution Gantt', icon: '📊' },
  baselines: { label: 'Baselines', icon: '📌' },
  variance: { label: 'Variance', icon: '📊' },
  forecast: { label: 'Forecast', icon: '🔮' },
  critpath: { label: 'Critical Path', icon: '⚡' },
  risks: { label: 'Risks', icon: '⚠️' },
  changes: { label: 'Changes', icon: '📋' },
};

// ── Main Component ─────────────────────────────────────────────────────

export function ScheduleControlDashboard() {
  const { selectedEventId } = useWorkspaceStore();
  const [activeTab, setActiveTab] = useState<TabKey>('health');

  // Data state
  const [health, setHealth] = useState<HealthData | null>(null);
  const [baselines, setBaselines] = useState<BaselineData[]>([]);
  const [variance, setVariance] = useState<VarianceItem[]>([]);
  const [forecast, setForecast] = useState<ForecastItem[]>([]);
  const [critPath, setCritPath] = useState<any>(null);
  const [changes, setChanges] = useState<ChangeRequest[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // ── Fetch data ───────────────────────────────────────────────────────

  const fetchAll = useCallback(async () => {
    if (!selectedEventId) return;
    setLoading(true);
    setError(null);

    try {
      const base = `/api/events/${selectedEventId}/schedule`;
      const results = await Promise.allSettled([
        fetch(`${base}/health`).then(r => r.json()),
        fetch(`${base}/baselines`).then(r => r.json()),
        fetch(`${base}/variance`).then(r => r.json()),
        fetch(`${base}/forecast`).then(r => r.json()),
        fetch(`${base}/critical-path`).then(r => r.json()),
        fetch(`${base}/change-requests`).then(r => r.json()),
      ]);

      if (results[0].status === 'fulfilled' && results[0].value.data) setHealth(results[0].value.data);
      if (results[1].status === 'fulfilled' && results[1].value.data) setBaselines(results[1].value.data);
      if (results[2].status === 'fulfilled' && results[2].value.data) {
        const vd = results[2].value.data;
        setVariance(vd.activities || []);
      }
      if (results[3].status === 'fulfilled' && results[3].value.data) {
        const fd = results[3].value.data;
        setForecast(fd.activities || []);
      }
      if (results[4].status === 'fulfilled' && results[4].value.data) setCritPath(results[4].value.data);
      if (results[5].status === 'fulfilled' && results[5].value.data) setChanges(results[5].value.data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [selectedEventId]);

  useEffect(() => { fetchAll(); }, [fetchAll, refreshKey]);

  const refresh = () => setRefreshKey(k => k + 1);

  // ── No event selected ───────────────────────────────────────────────

  if (!selectedEventId) {
    return (
      <div className="p-6 text-center text-gray-500 dark:text-gray-400">
        Select an event to view Schedule Control.
      </div>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
          Schedule Control
        </h2>
        <div className="flex items-center gap-2">
          {health && (
            <span
              className="px-2 py-0.5 rounded text-xs font-bold text-white"
              style={{ backgroundColor: SHI_COLORS[health.classification] || '#6b7280' }}
            >
              SHI: {health.shi}
            </span>
          )}
          <button
            onClick={refresh}
            className="text-xs px-2 py-1 rounded bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400"
            disabled={loading}
          >
            {loading ? '⏳' : '🔄'} Refresh
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
        {TAB_KEYS.map(key => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`px-3 py-1.5 text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${
              activeTab === key
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
            }`}
          >
            {TAB_LABELS[key].icon} {TAB_LABELS[key].label}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="mx-4 mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
          {error}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {activeTab === 'health' && <HealthPanel data={health} loading={loading} />}
        {activeTab === 'gantt' && <ScheduleGantt mode="execution" eventId={selectedEventId} />}
        {activeTab === 'baselines' && (
          <BaselinePanel
            baselines={baselines}
            eventId={selectedEventId}
            onRefresh={refresh}
          />
        )}
        {activeTab === 'variance' && <VariancePanel data={variance} />}
        {activeTab === 'forecast' && <ForecastPanel data={forecast} />}
        {activeTab === 'critpath' && <CriticalPathPanel data={critPath} />}
        {activeTab === 'risks' && <RiskPanel health={health} critPath={critPath} />}
        {activeTab === 'changes' && <ChangeControlPanel changes={changes} eventId={selectedEventId} onRefresh={refresh} />}
      </div>
    </div>
  );
}

// ── Health Panel ─────────────────────────────────────────────────────

function HealthPanel({ data, loading }: { data: HealthData | null; loading: boolean }) {
  if (loading) return <div className="text-xs text-gray-500">Loading health data...</div>;
  if (!data) return <div className="text-xs text-gray-500">No health data available.</div>;

  return (
    <div className="space-y-4">
      {/* SHI Header */}
      <div className="flex items-center gap-4 p-4 rounded-lg bg-gray-50 dark:bg-gray-800">
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center text-white font-bold text-lg"
          style={{ backgroundColor: SHI_COLORS[data.classification] || '#6b7280' }}
        >
          {data.shi}
        </div>
        <div>
          <div className="text-lg font-semibold text-gray-800 dark:text-gray-100">
            Schedule Health Index
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Classification: <span className="font-bold">{data.classification}</span>
          </div>
          <div className="text-xs text-gray-400">
            Computed: {new Date(data.computed_at).toLocaleString()}
          </div>
        </div>
      </div>

      {/* Component scores */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {data.components.map(c => (
          <div key={c.name} className="p-3 rounded border border-gray-200 dark:border-gray-700">
            <div className="text-xs font-medium text-gray-600 dark:text-gray-400">{c.name}</div>
            <div className="text-lg font-bold text-gray-800 dark:text-gray-100">{c.score}</div>
            <div className="text-[10px] text-gray-500">Weight: {(c.weight * 100).toFixed(0)}% | Weighted: {c.weighted.toFixed(1)}</div>
            <div className="text-[10px] text-gray-400 mt-1">{c.detail}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Baseline Panel ───────────────────────────────────────────────────

function BaselinePanel({
  baselines,
  eventId,
  onRefresh,
}: {
  baselines: BaselineData[];
  eventId: string;
  onRefresh: () => void;
}) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');

  const handleCreate = async () => {
    if (!name.trim()) return;
    setCreating(true);
    try {
      await fetch(`/api/events/${eventId}/schedule/baselines`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), description: desc.trim() || undefined }),
      });
      setName('');
      setDesc('');
      onRefresh();
    } finally {
      setCreating(false);
    }
  };

  const handleAssign = async (baselineId: string) => {
    await fetch(`/api/events/${eventId}/schedule/baselines/${baselineId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'assign' }),
    });
    onRefresh();
  };

  const current = baselines.find(b => b.is_current);

  return (
    <div className="space-y-4">
      {/* Active baseline */}
      <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
        <div className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-1">Active Baseline</div>
        {current ? (
          <div>
            <div className="font-semibold text-sm text-gray-800 dark:text-gray-100">{current.name}</div>
            <div className="text-xs text-gray-500">{new Date(current.created_at).toLocaleDateString()}</div>
            {current.description && <div className="text-xs text-gray-400 mt-1">{current.description}</div>}
          </div>
        ) : (
          <div className="text-xs text-gray-500">No baseline assigned</div>
        )}
      </div>

      {/* Create baseline */}
      <div className="p-3 rounded border border-gray-200 dark:border-gray-700">
        <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Create Baseline</div>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Baseline name..."
          className="w-full text-xs px-2 py-1 border rounded mb-1 dark:bg-gray-800 dark:border-gray-600"
        />
        <input
          type="text"
          value={desc}
          onChange={e => setDesc(e.target.value)}
          placeholder="Description (optional)..."
          className="w-full text-xs px-2 py-1 border rounded mb-2 dark:bg-gray-800 dark:border-gray-600"
        />
        <button
          onClick={handleCreate}
          disabled={creating || !name.trim()}
          className="text-xs px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
        >
          {creating ? 'Creating...' : '📸 Snapshot Current Schedule'}
        </button>
      </div>

      {/* Baseline list */}
      <div>
        <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">All Baselines</div>
        {baselines.length === 0 ? (
          <div className="text-xs text-gray-500">No baselines created yet.</div>
        ) : (
          <div className="space-y-1">
            {baselines.map(b => (
              <div
                key={b.id}
                className={`flex items-center justify-between p-2 rounded border text-xs ${
                  b.is_current
                    ? 'border-blue-300 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-700'
                    : 'border-gray-200 dark:border-gray-700'
                }`}
              >
                <div>
                  <span className="font-medium">{b.name}</span>
                  {b.is_current && <span className="ml-1 text-blue-600 dark:text-blue-400">(active)</span>}
                  <span className="ml-2 text-gray-400">
                    {new Date(b.created_at).toLocaleDateString()}
                  </span>
                </div>
                {!b.is_current && (
                  <button
                    onClick={() => handleAssign(b.id)}
                    className="px-2 py-0.5 text-blue-600 hover:bg-blue-100 rounded dark:text-blue-400"
                  >
                    Set Active
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Variance Panel ───────────────────────────────────────────────────

function VariancePanel({ data }: { data: VarianceItem[] }) {
  if (data.length === 0) {
    return <div className="text-xs text-gray-500">No variance data. Assign a baseline first.</div>;
  }

  return (
    <div>
      <div className="text-xs text-gray-500 mb-2">
        Comparing CURRENT schedule vs BASELINE (immutable snapshot)
      </div>
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-700 text-left text-gray-500">
            <th className="py-1 px-2">Activity</th>
            <th className="py-1 px-2">Start Δ</th>
            <th className="py-1 px-2">Finish Δ</th>
            <th className="py-1 px-2">Duration Δ</th>
            <th className="py-1 px-2">Float Erosion</th>
            <th className="py-1 px-2">Crit Change</th>
          </tr>
        </thead>
        <tbody>
          {data.map(v => (
            <tr key={v.activity_id} className="border-b border-gray-100 dark:border-gray-800">
              <td className="py-1 px-2">{v.activity_number || v.description?.slice(0, 30)}</td>
              <td className={`py-1 px-2 ${(v.start_variance_days ?? 0) > 0 ? 'text-red-500' : 'text-green-500'}`}>
                {v.start_variance_days != null ? `${v.start_variance_days > 0 ? '+' : ''}${v.start_variance_days}d` : '—'}
              </td>
              <td className={`py-1 px-2 ${(v.finish_variance_days ?? 0) > 0 ? 'text-red-500' : 'text-green-500'}`}>
                {v.finish_variance_days != null ? `${v.finish_variance_days > 0 ? '+' : ''}${v.finish_variance_days}d` : '—'}
              </td>
              <td className="py-1 px-2">{v.duration_variance_hours}h</td>
              <td className={`py-1 px-2 ${(v.float_erosion ?? 0) > 0 ? 'text-orange-500' : ''}`}>
                {v.float_erosion != null ? `${v.float_erosion}h` : '—'}
              </td>
              <td className="py-1 px-2">{v.criticality_changed ? '⚠️' : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Forecast Panel ───────────────────────────────────────────────────

function ForecastPanel({ data }: { data: ForecastItem[] }) {
  if (data.length === 0) {
    return <div className="text-xs text-gray-500">No forecast data available.</div>;
  }

  return (
    <div>
      <div className="text-xs text-gray-500 mb-2">
        FORECAST dates are estimates, not approved schedule dates
      </div>
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-700 text-left text-gray-500">
            <th className="py-1 px-2">Activity</th>
            <th className="py-1 px-2">Planned End</th>
            <th className="py-1 px-2">Forecast End</th>
            <th className="py-1 px-2">Variance</th>
            <th className="py-1 px-2">Method</th>
          </tr>
        </thead>
        <tbody>
          {data.map(f => (
            <tr key={f.activity_id} className="border-b border-gray-100 dark:border-gray-800">
              <td className="py-1 px-2">{f.description?.slice(0, 30)}</td>
              <td className="py-1 px-2">{f.planned_end ? new Date(f.planned_end).toLocaleDateString() : '—'}</td>
              <td className="py-1 px-2 italic text-blue-600 dark:text-blue-400">
                {f.forecast_finish ? new Date(f.forecast_finish).toLocaleDateString() : '—'}
              </td>
              <td className={`py-1 px-2 ${(f.variance_from_plan_days ?? 0) > 0 ? 'text-red-500' : 'text-green-500'}`}>
                {f.variance_from_plan_days != null ? `${f.variance_from_plan_days > 0 ? '+' : ''}${f.variance_from_plan_days}d` : '—'}
              </td>
              <td className="py-1 px-2 text-gray-400">{f.forecast_method}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Critical Path Panel ──────────────────────────────────────────────

function CriticalPathPanel({ data }: { data: any }) {
  if (!data) return <div className="text-xs text-gray-500">No critical path data available.</div>;

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Total Activities" value={data.total_activities} />
        <StatCard label="Critical" value={data.critical_count} color="text-red-500" />
        <StatCard label="Near-Critical" value={data.near_critical_count} color="text-orange-500" />
        <StatCard label="Critical %" value={`${data.critical_percent}%`} />
      </div>

      {/* Float distribution */}
      {data.float_distribution && (
        <div className="p-3 rounded border border-gray-200 dark:border-gray-700">
          <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Float Distribution</div>
          <div className="grid grid-cols-5 gap-2 text-xs">
            <div>Zero: <span className="font-bold text-red-500">{data.float_distribution.zero_float}</span></div>
            <div>Low: <span className="font-bold text-orange-500">{data.float_distribution.low_float}</span></div>
            <div>Moderate: <span className="font-bold text-yellow-500">{data.float_distribution.moderate_float}</span></div>
            <div>High: <span className="font-bold text-green-500">{data.float_distribution.high_float}</span></div>
            <div>No Data: <span className="font-bold text-gray-400">{data.float_distribution.no_data}</span></div>
          </div>
        </div>
      )}

      {/* Critical activities */}
      {data.critical_activities && data.critical_activities.length > 0 && (
        <div>
          <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Critical Activities</div>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {data.critical_activities.slice(0, 20).map((a: CriticalActivity) => (
              <div key={a.activity_id} className="flex justify-between items-center p-1.5 rounded border border-red-100 dark:border-red-900/30 text-xs">
                <div>
                  <span className="font-medium">{a.activity_number || a.description.slice(0, 30)}</span>
                  <span className="ml-2 text-gray-400">{a.status}</span>
                </div>
                <div className="text-gray-500">
                  Float: {a.total_float_hours ?? '—'}h | Impact: {a.downstream_impact}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Risk Panel ───────────────────────────────────────────────────────

function RiskPanel({ health, critPath }: { health: HealthData | null; critPath: any }) {
  const resourceScore = health?.components.find(c => c.name === 'Resource Overload');
  const critPathScore = health?.components.find(c => c.name === 'Critical Path');

  return (
    <div className="space-y-4">
      {/* Resource overload detail */}
      <div className="p-3 rounded border border-gray-200 dark:border-gray-700">
        <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Resource Overload</div>
        {resourceScore ? (
          <div>
            <div className="text-lg font-bold">{resourceScore.score}</div>
            <div className="text-xs text-gray-500">{resourceScore.detail}</div>
          </div>
        ) : (
          <div className="text-xs text-gray-500">No resource data available.</div>
        )}
      </div>

      {/* Critical path risk */}
      <div className="p-3 rounded border border-gray-200 dark:border-gray-700">
        <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Critical Path Risk</div>
        {critPathScore ? (
          <div>
            <div className="text-lg font-bold">{critPathScore.score}</div>
            <div className="text-xs text-gray-500">{critPathScore.detail}</div>
          </div>
        ) : (
          <div className="text-xs text-gray-500">No critical path data available.</div>
        )}
      </div>

      {/* High downstream impact */}
      {critPath?.high_downstream_impact?.length > 0 && (
        <div className="p-3 rounded border border-gray-200 dark:border-gray-700">
          <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Highest Downstream Impact</div>
          <div className="space-y-1">
            {critPath.high_downstream_impact.slice(0, 5).map((a: CriticalActivity) => (
              <div key={a.activity_id} className="flex justify-between text-xs">
                <span>{a.activity_number || a.description.slice(0, 25)}</span>
                <span className="text-red-500 font-bold">{a.downstream_impact} dependents</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Change Control Panel ─────────────────────────────────────────────

function ChangeControlPanel({
  changes,
  eventId,
  onRefresh,
}: {
  changes: ChangeRequest[];
  eventId: string;
  onRefresh: () => void;
}) {
  // Group by status
  const grouped: Record<string, ChangeRequest[]> = {};
  for (const cr of changes) {
    if (!grouped[cr.status]) grouped[cr.status] = [];
    grouped[cr.status].push(cr);
  }

  const statusOrder = ['proposed', 'review', 'approved', 'rejected', 'applied', 'superseded'];

  return (
    <div className="space-y-4">
      {/* Summary counts */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
        {statusOrder.map(s => (
          <div key={s} className="p-2 rounded border border-gray-200 dark:border-gray-700 text-center">
            <div className="text-lg font-bold" style={{ color: STATUS_COLORS[s] }}>
              {grouped[s]?.length || 0}
            </div>
            <div className="text-[10px] text-gray-500 capitalize">{s}</div>
          </div>
        ))}
      </div>

      {/* Change request list */}
      <div>
        {changes.length === 0 ? (
          <div className="text-xs text-gray-500">No change requests.</div>
        ) : (
          <div className="space-y-1">
            {changes.map(cr => (
              <div key={cr.id} className="flex items-center justify-between p-2 rounded border border-gray-200 dark:border-gray-700 text-xs">
                <div>
                  <span className="font-medium">{cr.title}</span>
                  <span className="ml-2 text-gray-400">{cr.change_type}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-gray-400">{cr.activities_affected} activities</span>
                  <span
                    className="px-1.5 py-0.5 rounded text-white text-[10px] font-bold"
                    style={{ backgroundColor: STATUS_COLORS[cr.status] || '#6b7280' }}
                  >
                    {cr.status.toUpperCase()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Helper ───────────────────────────────────────────────────────────

function StatCard({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="p-3 rounded border border-gray-200 dark:border-gray-700 text-center">
      <div className={`text-xl font-bold ${color || 'text-gray-800 dark:text-gray-100'}`}>{value}</div>
      <div className="text-[10px] text-gray-500">{label}</div>
    </div>
  );
}
