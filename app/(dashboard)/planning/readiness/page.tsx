'use client';

/**
 * M10 — Planning Readiness Workspace
 *
 * The planner's Schedule Readiness Control Tower.
 *
 * Shows per-workpack readiness with actionable evidence so planners
 * managing ~200 workpacks can immediately see which are schedule-ready,
 * which are not, and exactly what must be fixed.
 *
 * Architecture:
 *   - Reads from GET /api/planning/readiness (PlanningReadinessService)
 *   - Reuses existing ReadinessScoreService criteria (via cached readiness_score)
 *   - Does NOT calculate CPM, progress, material readiness, or SPI/EVM
 *   - Links to existing workpack/schedule/planner pages for editing
 */
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';

// ── Types ──────────────────────────────────────────────────────────────────────

interface ReadinessCheck {
  key: string;
  label: string;
  passed: boolean;
  evidence: string;
}

interface WorkpackReadiness {
  id: string;
  workpack_number: string | null;
  title: string;
  status: string;
  priority: string | null;
  equipment_tag: string | null;
  equipment_type: string | null;
  unit_name: string | null;
  system_name: string | null;
  discipline_name: string | null;
  discipline_code: string | null;
  event_name: string | null;
  event_id: string | null;
  activity_count: number;
  activities_with_duration: number;
  activities_with_logic: number;
  activities_with_resources: number;
  activities_scheduled: number;
  readiness_score: number;
  material_total: number;
  material_ready: number;
  material_status: string;
  open_constraints: number;
  critical_constraints: number;
  document_count: number;
  planned_start: string | null;
  planned_end: string | null;
  has_schedule_dates: boolean;
  has_baseline: boolean;
  planning_state: 'NOT_READY' | 'READY' | 'SCHEDULED' | 'BASELINED';
  checks: ReadinessCheck[];
}

interface ReadinessKpis {
  total: number;
  ready: number;
  not_ready: number;
  scheduled: number;
  baselined: number;
  critical_blockers: number;
}

type PlanningState = 'NOT_READY' | 'READY' | 'SCHEDULED' | 'BASELINED';

// ── State colors ───────────────────────────────────────────────────────────────

const STATE_CONFIG: Record<PlanningState, { label: string; bg: string; text: string; border: string; dot: string }> = {
  NOT_READY: { label: 'Not Ready', bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', dot: 'bg-red-500' },
  READY: { label: 'Ready', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500' },
  SCHEDULED: { label: 'Scheduled', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', dot: 'bg-blue-500' },
  BASELINED: { label: 'Baselined', bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', dot: 'bg-purple-500' },
};

// ── Page Component ─────────────────────────────────────────────────────────────

export default function PlanningReadinessPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [kpis, setKpis] = useState<ReadinessKpis>({ total: 0, ready: 0, not_ready: 0, scheduled: 0, baselined: 0, critical_blockers: 0 });
  const [workpacks, setWorkpacks] = useState<WorkpackReadiness[]>([]);

  // Filters
  const [events, setEvents] = useState<{ id: string; name: string }[]>([]);
  const [selectedEvent, setSelectedEvent] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [stateFilter, setStateFilter] = useState<PlanningState | ''>('');
  const [priorityFilter, setPriorityFilter] = useState('');

  // Detail panel
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Debounce ref for search
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Load events ─────────────────────────────────────────────────────────────

  useEffect(() => {
    fetch('/api/events')
      .then(r => r.ok ? r.json() : [])
      .then(data => {
        const raw = Array.isArray(data)
          ? data
          : (data.items || data.events || []);
        const evts = raw.map((e: any) => ({ id: e.id, name: e.name }));
        setEvents(evts);
        // Auto-select first event if available
        if (evts.length > 0 && !selectedEvent) {
          setSelectedEvent(evts[0].id);
        }
      })
      .catch(() => setEvents([]));
  }, []);

  // ── Load readiness data ─────────────────────────────────────────────────────

  const loadReadiness = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (selectedEvent) params.set('event_id', selectedEvent);
      if (searchQuery) params.set('search', searchQuery);
      if (stateFilter) params.set('readiness_state', stateFilter);
      if (priorityFilter) params.set('priority', priorityFilter);

      const res = await fetch(`/api/planning/readiness?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setKpis(data.kpis);
      setWorkpacks(data.workpacks);
    } catch (err: any) {
      setError(err.message || 'Failed to load planning readiness');
      setWorkpacks([]);
    } finally {
      setLoading(false);
    }
  }, [selectedEvent, searchQuery, stateFilter, priorityFilter]);

  useEffect(() => {
    if (selectedEvent) {
      loadReadiness();
    } else if (events.length === 0) {
      // No events loaded yet — wait
    } else {
      loadReadiness();
    }
  }, [selectedEvent, stateFilter, priorityFilter, loadReadiness]);

  // Debounced search
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      loadReadiness();
    }, 350);
  };

  // ── Column helpers ──────────────────────────────────────────────────────────

  const pct = (n: number, total: number) => total > 0 ? Math.round((n / total) * 100) : 0;

  const statusIndicator = (passed: boolean, label: string) => (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${passed ? 'text-emerald-600' : 'text-amber-600'}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${passed ? 'bg-emerald-500' : 'bg-amber-500'}`} />
      {label}
    </span>
  );

  // ── Sorted/filtered workpacks ───────────────────────────────────────────────

  const sortedWorkpacks = useMemo(() => {
    return [...workpacks].sort((a, b) => {
      // Not Ready first, then Ready, Scheduled, Baselined
      const stateOrder: Record<PlanningState, number> = { NOT_READY: 0, READY: 1, SCHEDULED: 2, BASELINED: 3 };
      const diff = stateOrder[a.planning_state] - stateOrder[b.planning_state];
      if (diff !== 0) return diff;
      return (a.workpack_number ?? '').localeCompare(b.workpack_number ?? '');
    });
  }, [workpacks]);

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full min-h-0 bg-gray-50">
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="px-6 py-4 bg-white border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <span className="text-xl">🎯</span> Planning Readiness
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">
              Prepare workpacks for schedule integration and baseline
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={loadReadiness}
              disabled={loading}
              className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              {loading ? '↻ Loading…' : '↻ Refresh'}
            </button>
          </div>
        </div>
      </div>

      {/* ── KPI Bar ───────────────────────────────────────────────────────── */}
      <div className="px-6 py-3 bg-white border-b border-gray-100">
        <div className="grid grid-cols-6 gap-3">
          <KpiCard label="Total Workpacks" value={kpis.total} color="gray" />
          <KpiCard label="Ready" value={kpis.ready} color="emerald" />
          <KpiCard label="Not Ready" value={kpis.not_ready} color="red" />
          <KpiCard label="Scheduled" value={kpis.scheduled} color="blue" />
          <KpiCard label="Baselined" value={kpis.baselined} color="purple" />
          <KpiCard label="Critical Blockers" value={kpis.critical_blockers} color="orange" />
        </div>
      </div>

      {/* ── Filters ───────────────────────────────────────────────────────── */}
      <div className="px-6 py-2.5 bg-white border-b border-gray-100 flex items-center gap-3 flex-wrap">
        {/* Event selector */}
        <div className="flex items-center gap-1.5">
          <label className="text-xs font-medium text-gray-500">Event:</label>
          <select
            value={selectedEvent}
            onChange={(e) => setSelectedEvent(e.target.value)}
            className="text-xs border border-gray-300 rounded-md px-2 py-1.5 bg-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500 min-w-[180px]"
          >
            <option value="">All Events</option>
            {events.map(e => (
              <option key={e.id} value={e.id}>{e.name}</option>
            ))}
          </select>
        </div>

        {/* Readiness state */}
        <div className="flex items-center gap-1.5">
          <label className="text-xs font-medium text-gray-500">Readiness:</label>
          <select
            value={stateFilter}
            onChange={(e) => setStateFilter(e.target.value as PlanningState | '')}
            className="text-xs border border-gray-300 rounded-md px-2 py-1.5 bg-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">All States</option>
            <option value="NOT_READY">Not Ready</option>
            <option value="READY">Ready</option>
            <option value="SCHEDULED">Scheduled</option>
            <option value="BASELINED">Baselined</option>
          </select>
        </div>

        {/* Priority */}
        <div className="flex items-center gap-1.5">
          <label className="text-xs font-medium text-gray-500">Priority:</label>
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="text-xs border border-gray-300 rounded-md px-2 py-1.5 bg-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">All</option>
            <option value="Critical">Critical</option>
            <option value="High">High</option>
            <option value="Normal">Normal</option>
            <option value="Low">Low</option>
          </select>
        </div>

        {/* Search */}
        <div className="flex items-center gap-1.5 ml-auto">
          <input
            type="text"
            placeholder="Search workpack # or title…"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="text-xs border border-gray-300 rounded-md px-3 py-1.5 w-56 bg-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      {/* ── Main Content ──────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 overflow-auto px-6 py-3">
        {error && (
          <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            ⚠ {error}
          </div>
        )}

        {loading && workpacks.length === 0 ? (
          <div className="flex items-center justify-center h-40 text-gray-400 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
              Loading planning readiness…
            </div>
          </div>
        ) : workpacks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-gray-400 text-sm gap-2">
            <span className="text-3xl">📋</span>
            <span>No workpacks found{selectedEvent ? ' for this event' : ''}.</span>
            <span className="text-xs">Select an event or adjust your filters.</span>
          </div>
        ) : (
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-3 py-2 font-semibold text-gray-600 w-8"></th>
                <th className="text-left px-3 py-2 font-semibold text-gray-600 min-w-[110px]">Workpack</th>
                <th className="text-left px-3 py-2 font-semibold text-gray-600">Equipment</th>
                <th className="text-left px-3 py-2 font-semibold text-gray-600">Discipline</th>
                <th className="text-center px-3 py-2 font-semibold text-gray-600">Activities</th>
                <th className="text-center px-3 py-2 font-semibold text-gray-600">Logic</th>
                <th className="text-center px-3 py-2 font-semibold text-gray-600">Resources</th>
                <th className="text-center px-3 py-2 font-semibold text-gray-600">Materials</th>
                <th className="text-center px-3 py-2 font-semibold text-gray-600">Constraints</th>
                <th className="text-center px-3 py-2 font-semibold text-gray-600 min-w-[90px]">Readiness</th>
                <th className="text-center px-3 py-2 font-semibold text-gray-600 min-w-[90px]">State</th>
                <th className="text-center px-3 py-2 font-semibold text-gray-600">Action</th>
              </tr>
            </thead>
            <tbody>
              {sortedWorkpacks.map((wp) => {
                const isExpanded = expandedId === wp.id;
                const logicPct = pct(wp.activities_with_logic, wp.activity_count);
                const resPct = pct(wp.activities_with_resources, wp.activity_count);
                const matPct = wp.material_total > 0 ? pct(wp.material_ready, wp.material_total) : -1;
                const sc = STATE_CONFIG[wp.planning_state];
                const failedChecks = wp.checks.filter(c => !c.passed);

                return (
                  <React.Fragment key={wp.id}>
                    <tr
                      className={`border-b border-gray-100 hover:bg-blue-50/30 cursor-pointer transition-colors ${isExpanded ? 'bg-blue-50/40' : ''}`}
                      onClick={() => setExpandedId(isExpanded ? null : wp.id)}
                    >
                      {/* Expand arrow */}
                      <td className="px-2 py-2 text-gray-400">
                        <span className={`inline-block transition-transform ${isExpanded ? 'rotate-90' : ''}`}>▸</span>
                      </td>

                      {/* Workpack */}
                      <td className="px-3 py-2">
                        <div className="font-semibold text-gray-900">{wp.workpack_number || '—'}</div>
                        <div className="text-[10px] text-gray-500 truncate max-w-[180px]" title={wp.title}>{wp.title}</div>
                      </td>

                      {/* Equipment */}
                      <td className="px-3 py-2">
                        <div className="text-gray-700">{wp.equipment_tag || '—'}</div>
                        {wp.equipment_type && <div className="text-[10px] text-gray-400">{wp.equipment_type}</div>}
                      </td>

                      {/* Discipline */}
                      <td className="px-3 py-2">
                        {wp.discipline_code ? (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-600">
                            {wp.discipline_code}
                          </span>
                        ) : <span className="text-gray-300">—</span>}
                      </td>

                      {/* Activities */}
                      <td className="text-center px-3 py-2">
                        {wp.activity_count > 0 ? (
                          <span className="text-gray-700 font-medium">{wp.activity_count}</span>
                        ) : (
                          <span className="text-red-500 font-medium">0</span>
                        )}
                      </td>

                      {/* Logic */}
                      <td className="text-center px-3 py-2">
                        {wp.activity_count === 0 ? (
                          <span className="text-gray-300">—</span>
                        ) : (
                          <CompactPct value={logicPct} threshold={80} />
                        )}
                      </td>

                      {/* Resources */}
                      <td className="text-center px-3 py-2">
                        {wp.activity_count === 0 ? (
                          <span className="text-gray-300">—</span>
                        ) : (
                          <CompactPct value={resPct} threshold={50} />
                        )}
                      </td>

                      {/* Materials */}
                      <td className="text-center px-3 py-2">
                        {matPct < 0 ? (
                          <span className="text-gray-300 text-[10px]">N/R</span>
                        ) : (
                          <CompactPct value={matPct} threshold={100} />
                        )}
                      </td>

                      {/* Constraints */}
                      <td className="text-center px-3 py-2">
                        {wp.open_constraints > 0 ? (
                          <span className="inline-flex items-center gap-0.5 text-amber-600 font-medium">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                            {wp.open_constraints}
                          </span>
                        ) : (
                          <span className="text-emerald-500">✓</span>
                        )}
                      </td>

                      {/* Readiness score */}
                      <td className="text-center px-3 py-2">
                        <ReadinessBar score={wp.readiness_score} />
                      </td>

                      {/* State badge */}
                      <td className="text-center px-3 py-2">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${sc.bg} ${sc.text} ${sc.border}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                          {sc.label}
                        </span>
                      </td>

                      {/* Action */}
                      <td className="text-center px-3 py-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); router.push(`/workpacks/${wp.id}`); }}
                          className="text-[10px] font-medium text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded transition-colors"
                        >
                          View
                        </button>
                      </td>
                    </tr>

                    {/* ── Expanded Detail Panel ─────────────────────────────── */}
                    {isExpanded && (
                      <tr>
                        <td colSpan={12} className="px-0 py-0">
                          <div className="mx-4 my-2 p-4 bg-white border border-gray-200 rounded-lg shadow-sm">
                            <div className="flex items-start justify-between mb-3">
                              <div>
                                <h3 className="text-sm font-bold text-gray-900">
                                  {wp.workpack_number} — Readiness Checklist
                                </h3>
                                <p className="text-[11px] text-gray-500 mt-0.5">
                                  {wp.title} • {wp.event_name ?? 'No event'} • Score: {wp.readiness_score}%
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                <ActionLink label="Open Workpack" href={`/workpacks/${wp.id}`} />
                                <ActionLink label="Schedule" href="/schedule" />
                                <ActionLink label="Planner Workspace" href="/planner-workspace" />
                              </div>
                            </div>

                            {/* Checklist grid */}
                            <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
                              {wp.checks.map((check) => (
                                <div
                                  key={check.key}
                                  className={`flex items-start gap-2 px-2.5 py-1.5 rounded text-xs ${check.passed ? 'bg-emerald-50/60' : 'bg-red-50/60'}`}
                                >
                                  <span className={`mt-0.5 ${check.passed ? 'text-emerald-500' : 'text-red-500'}`}>
                                    {check.passed ? '✅' : '❌'}
                                  </span>
                                  <div className="flex-1 min-w-0">
                                    <div className={`font-medium ${check.passed ? 'text-emerald-700' : 'text-red-700'}`}>
                                      {check.label}
                                    </div>
                                    <div className={`text-[10px] ${check.passed ? 'text-emerald-600' : 'text-red-600'}`}>
                                      {check.evidence}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>

                            {/* Blockers summary */}
                            {failedChecks.length > 0 && (
                              <div className="mt-3 pt-2.5 border-t border-gray-100">
                                <p className="text-[10px] font-semibold text-red-600 uppercase tracking-wide mb-1.5">
                                  ⚠ {failedChecks.length} Blocker{failedChecks.length > 1 ? 's' : ''} — Fix before schedule integration
                                </p>
                                <div className="flex flex-wrap gap-1.5">
                                  {failedChecks.map(c => (
                                    <span key={c.key} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-red-100 text-red-700 text-[10px] font-medium">
                                      ✗ {c.label}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}

                            {failedChecks.length === 0 && (
                              <div className="mt-3 pt-2.5 border-t border-gray-100">
                                <p className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wide">
                                  ✓ All checks passed — Workpack is schedule-ready
                                </p>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Footer status bar ────────────────────────────────────────────── */}
      <div className="px-6 py-1.5 bg-white border-t border-gray-200 text-[10px] text-gray-400 flex items-center justify-between">
        <span>Showing {sortedWorkpacks.length} of {kpis.total} workpacks</span>
        <span>M10 Planning Readiness V1 • Orchestrates existing services • Zero duplicate engines</span>
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function KpiCard({ label, value, color }: { label: string; value: number; color: string }) {
  const colorMap: Record<string, string> = {
    gray: 'bg-gray-50 border-gray-200 text-gray-700',
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    red: 'bg-red-50 border-red-200 text-red-700',
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
    purple: 'bg-purple-50 border-purple-200 text-purple-700',
    orange: 'bg-amber-50 border-amber-200 text-amber-700',
  };
  return (
    <div className={`px-3 py-2 rounded-lg border ${colorMap[color] ?? colorMap.gray}`}>
      <div className="text-lg font-bold leading-tight">{value}</div>
      <div className="text-[10px] font-medium opacity-80 leading-tight">{label}</div>
    </div>
  );
}

function CompactPct({ value, threshold }: { value: number; threshold: number }) {
  const passed = value >= threshold;
  return (
    <span className={`font-medium ${passed ? 'text-emerald-600' : value > 0 ? 'text-amber-600' : 'text-red-500'}`}>
      {value}%
    </span>
  );
}

function ReadinessBar({ score }: { score: number }) {
  const color = score >= 80 ? 'bg-emerald-500' : score >= 50 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-12 h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${Math.min(score, 100)}%` }} />
      </div>
      <span className="text-[10px] font-medium text-gray-600 w-7 text-right">{score}%</span>
    </div>
  );
}

function ActionLink({ label, href }: { label: string; href: string }) {
  return (
    <a
      href={href}
      className="text-[10px] font-medium text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded transition-colors"
    >
      {label}
    </a>
  );
}
