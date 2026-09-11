'use client';

/**
 * M8.15 — Equipment 360 V1 Client Component
 *
 * Equipment-centric operational traceability view.
 * Answers: "What is happening to this equipment during the shutdown?"
 *
 * Equipment → Scope → Workpack → Activity → Schedule → Execution → M8.13 Progress
 *
 * PROGRESS AUTHORITY: All progress values are READ from the API response,
 * which delegates to M8.13 ProgressAggregationService. This component
 * contains ZERO progress calculation logic.
 */
import React, { useState, useEffect } from 'react';
import Link from 'next/link';

// ─── Types (matching API response) ─────────────────────────────────────────

interface ProgressMetrics {
  weightedProgress: number;
  totalActivities: number;
  completedActivities: number;
  inProgressActivities: number;
  notStartedActivities: number;
  totalDurationHours: number;
  completedDurationHours: number;
  balanceDurationHours: number;
}

interface IdenticalActivityGroup {
  equipmentType: string;
  standardActivityTypeCode: string;
  standardActivityTypeName: string;
  totalInstances: number;
  completedInstances: number;
  inProgressInstances: number;
  notStartedInstances: number;
  completionPercent: number;
  balancePercent: number;
  metrics: ProgressMetrics;
}

interface EventData {
  event: { id: string; name: string; status: string | null };
  scope: { items: any[] };
  workpacks: any[];
  activities: any[];
  schedule: {
    totalActivities: number;
    criticalActivities: number;
    activitiesWithNegativeFloat: number;
    earliestPlannedStart: string | null;
    latestPlannedEnd: string | null;
  };
  execution: { recentLogs: any[]; lastUpdate: string | null };
  progress: { identicalActivities: IdenticalActivityGroup[] };
}

interface Equipment360Data {
  equipment: any;
  events: EventData[];
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function formatDate(d: string | null | undefined): string {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return '—'; }
}

function formatDateTime(d: string | null | undefined): string {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return '—'; }
}

function ProgressBar({ value, size = 'md' }: { value: number; size?: 'sm' | 'md' }) {
  const h = size === 'sm' ? 'h-1.5' : 'h-2.5';
  const color = value >= 100 ? 'bg-emerald-500' : value > 50 ? 'bg-blue-500' : value > 0 ? 'bg-amber-500' : 'bg-gray-300';
  return (
    <div className={`w-full bg-gray-200 rounded-full ${h}`}>
      <div className={`${color} ${h} rounded-full transition-all duration-300`} style={{ width: `${Math.min(100, value)}%` }} />
    </div>
  );
}

function StatusBadge({ status }: { status: string | null }) {
  if (!status) return <span className="text-gray-400">—</span>;
  const colors: Record<string, string> = {
    completed: 'bg-emerald-100 text-emerald-800',
    in_progress: 'bg-blue-100 text-blue-800',
    not_started: 'bg-gray-100 text-gray-600',
    draft: 'bg-amber-100 text-amber-800',
    active: 'bg-emerald-100 text-emerald-800',
    approved: 'bg-emerald-100 text-emerald-800',
    frozen: 'bg-blue-100 text-blue-800',
    closed: 'bg-gray-100 text-gray-500',
    cancelled: 'bg-red-100 text-red-700',
    released: 'bg-blue-100 text-blue-700',
  };
  const cls = colors[status] || 'bg-gray-100 text-gray-600';
  return <span className={`px-2 py-0.5 text-xs font-semibold rounded capitalize ${cls}`}>{status.replace(/_/g, ' ')}</span>;
}

function PriorityBadge({ priority }: { priority: string | null }) {
  if (!priority) return <span className="text-gray-400">—</span>;
  const colors: Record<string, string> = {
    critical: 'bg-red-100 text-red-800',
    high: 'bg-orange-100 text-orange-800',
    medium: 'bg-yellow-100 text-yellow-700',
    low: 'bg-green-100 text-green-700',
    Normal: 'bg-gray-100 text-gray-700',
  };
  const cls = colors[priority] || 'bg-gray-100 text-gray-600';
  return <span className={`px-2 py-0.5 text-xs font-semibold rounded capitalize ${cls}`}>{priority}</span>;
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="py-12 text-center">
      <p className="text-sm text-gray-400 italic">{message}</p>
    </div>
  );
}

function SectionCard({ title, children, count }: { title: string; children: React.ReactNode; count?: number }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <h3 className="text-sm font-bold text-gray-800">{title}</h3>
        {count !== undefined && <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{count}</span>}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

// ─── Tab Components ────────────────────────────────────────────────────────

function OverviewTab({ data, eventData }: { data: Equipment360Data; eventData: EventData }) {
  const eq = data.equipment;
  const totalActivities = eventData.activities.length;
  const completedActivities = eventData.activities.filter((a: any) => a.status === 'completed' || a.progress_percent >= 100).length;
  const inProgressActivities = eventData.activities.filter((a: any) => a.status === 'in_progress' || (a.progress_percent > 0 && a.progress_percent < 100 && a.status !== 'completed')).length;

  return (
    <div className="space-y-6">
      {/* Equipment Identity */}
      <SectionCard title="Equipment Identity">
        <dl className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-4 text-sm">
          <div><dt className="text-gray-400 text-xs font-semibold mb-1">Tag Number</dt><dd className="font-medium">{eq.tag_number}</dd></div>
          <div><dt className="text-gray-400 text-xs font-semibold mb-1">Name</dt><dd className="font-medium">{eq.name}</dd></div>
          <div><dt className="text-gray-400 text-xs font-semibold mb-1">Equipment Type</dt><dd className="font-medium">{eq.asset_type || '—'}</dd></div>
          <div><dt className="text-gray-400 text-xs font-semibold mb-1">Description</dt><dd className="font-medium">{eq.description || '—'}</dd></div>
          <div><dt className="text-gray-400 text-xs font-semibold mb-1">Service</dt><dd className="font-medium">{eq.service_description || '—'}</dd></div>
          <div><dt className="text-gray-400 text-xs font-semibold mb-1">Site</dt><dd className="font-medium">{eq.Site?.name || '—'}</dd></div>
          <div><dt className="text-gray-400 text-xs font-semibold mb-1">Plant</dt><dd className="font-medium">{eq.plant?.name || '—'}</dd></div>
          <div><dt className="text-gray-400 text-xs font-semibold mb-1">Unit</dt><dd className="font-medium">{eq.unit?.name || '—'}</dd></div>
          <div><dt className="text-gray-400 text-xs font-semibold mb-1">System</dt><dd className="font-medium">{eq.system?.name || '—'}</dd></div>
          <div><dt className="text-gray-400 text-xs font-semibold mb-1">Criticality</dt><dd className="font-medium capitalize">{eq.criticality || '—'}</dd></div>
          <div><dt className="text-gray-400 text-xs font-semibold mb-1">Status</dt><dd className="font-medium capitalize">{eq.status || '—'}</dd></div>
          <div><dt className="text-gray-400 text-xs font-semibold mb-1">Data Source</dt><dd className="font-medium">{eq.data_source || 'manual'}</dd></div>
          <div><dt className="text-gray-400 text-xs font-semibold mb-1">Last Updated</dt><dd className="font-medium">{formatDateTime(eq.updated_at)}</dd></div>
          <div><dt className="text-gray-400 text-xs font-semibold mb-1">Manufacturer</dt><dd className="font-medium">{eq.manufacturer || '—'}</dd></div>
        </dl>
      </SectionCard>

      {/* Summary Strip */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-white border border-gray-200 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-gray-900">{eventData.scope.items.length}</div>
          <div className="text-xs text-gray-500 font-medium">Scope Items</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-gray-900">{eventData.workpacks.length}</div>
          <div className="text-xs text-gray-500 font-medium">Workpacks</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-gray-900">{totalActivities}</div>
          <div className="text-xs text-gray-500 font-medium">Activities</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-emerald-600">{completedActivities}</div>
          <div className="text-xs text-gray-500 font-medium">Completed</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-blue-600">{inProgressActivities}</div>
          <div className="text-xs text-gray-500 font-medium">In Progress</div>
        </div>
      </div>
    </div>
  );
}

function ScopeTab({ eventData }: { eventData: EventData }) {
  const items = eventData.scope.items;
  if (items.length === 0) return <EmptyState message="No shutdown scope linked to this equipment." />;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wider">
          <tr>
            <th className="px-3 py-2">Scope</th>
            <th className="px-3 py-2">Reason</th>
            <th className="px-3 py-2">Discipline</th>
            <th className="px-3 py-2">Priority</th>
            <th className="px-3 py-2">Complexity</th>
            <th className="px-3 py-2">Est. Hours</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Created</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {items.map((item: any) => (
            <tr key={item.id} className="hover:bg-gray-50">
              <td className="px-3 py-2 font-medium">{item.scope_name || '—'}</td>
              <td className="px-3 py-2 max-w-xs truncate">{item.reason}</td>
              <td className="px-3 py-2">{item.discipline || '—'}</td>
              <td className="px-3 py-2"><PriorityBadge priority={item.priority} /></td>
              <td className="px-3 py-2 capitalize">{item.complexity || '—'}</td>
              <td className="px-3 py-2 text-right">{item.estimated_hours || 0}</td>
              <td className="px-3 py-2"><StatusBadge status={item.scope_status} /></td>
              <td className="px-3 py-2 text-gray-500">{formatDate(item.created_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function WorkpacksTab({ eventData }: { eventData: EventData }) {
  const wps = eventData.workpacks;
  if (wps.length === 0) return <EmptyState message="No workpacks linked to this equipment." />;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wider">
          <tr>
            <th className="px-3 py-2">Workpack ID</th>
            <th className="px-3 py-2">Title</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Discipline</th>
            <th className="px-3 py-2">Contractor</th>
            <th className="px-3 py-2">Planned Start</th>
            <th className="px-3 py-2">Planned End</th>
            <th className="px-3 py-2">Progress (M8.13)</th>
            <th className="px-3 py-2">Readiness</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {wps.map((wp: any) => {
            const progress = wp.progress?.weightedProgress ?? wp.overall_progress ?? 0;
            return (
              <tr key={wp.id} className="hover:bg-gray-50">
                <td className="px-3 py-2">
                  <Link href={`/workpacks`} className="text-blue-600 hover:text-blue-800 font-medium">
                    {wp.workpack_id_code || wp.id.slice(0, 8)}
                  </Link>
                </td>
                <td className="px-3 py-2 font-medium max-w-xs truncate">{wp.title}</td>
                <td className="px-3 py-2"><StatusBadge status={wp.status} /></td>
                <td className="px-3 py-2">{wp.discipline?.name || '—'}</td>
                <td className="px-3 py-2">{wp.contractor?.name || '—'}</td>
                <td className="px-3 py-2 text-gray-500">{formatDate(wp.planned_start_date)}</td>
                <td className="px-3 py-2 text-gray-500">{formatDate(wp.planned_end_date)}</td>
                <td className="px-3 py-2 w-36">
                  <div className="flex items-center gap-2">
                    <ProgressBar value={progress} size="sm" />
                    <span className="text-xs font-semibold text-gray-700 w-8 text-right">{progress}%</span>
                  </div>
                </td>
                <td className="px-3 py-2 text-center">
                  {wp.readiness_score != null ? <span className="text-xs font-semibold">{wp.readiness_score}%</span> : '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ActivitiesTab({ eventData }: { eventData: EventData }) {
  const acts = eventData.activities;
  if (acts.length === 0) return <EmptyState message="No activities linked to this equipment." />;

  // Group by standard activity type for the summary view
  const byType = new Map<string, any[]>();
  for (const a of acts) {
    const typeName = a.standard_activity_type?.name || 'Unclassified';
    const list = byType.get(typeName) || [];
    list.push(a);
    byType.set(typeName, list);
  }

  return (
    <div className="space-y-4">
      {/* Activity type summary */}
      {byType.size > 1 && (
        <div className="bg-gray-50 rounded-lg p-3">
          <h4 className="text-xs font-bold text-gray-600 uppercase mb-2">By Standard Activity Type</h4>
          <div className="flex flex-wrap gap-2">
            {Array.from(byType.entries()).map(([type, typeActs]) => (
              <span key={type} className="px-2 py-1 bg-white border border-gray-200 rounded text-xs font-medium">
                {type}: {typeActs.length}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Activity table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wider">
            <tr>
              <th className="px-3 py-2">Activity ID</th>
              <th className="px-3 py-2">Standard Activity Type</th>
              <th className="px-3 py-2">Description</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Planned Start</th>
              <th className="px-3 py-2">Planned End</th>
              <th className="px-3 py-2">Actual Start</th>
              <th className="px-3 py-2">Actual End</th>
              <th className="px-3 py-2">Progress</th>
              <th className="px-3 py-2">Float</th>
              <th className="px-3 py-2">Discipline</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {acts.map((a: any) => (
              <tr key={a.id} className={`hover:bg-gray-50 ${a.is_critical ? 'border-l-2 border-l-red-400' : ''}`}>
                <td className="px-3 py-2 font-mono text-xs">{a.activity_number || a.id.slice(0, 8)}</td>
                <td className="px-3 py-2">
                  {a.standard_activity_type ? (
                    <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 text-xs font-medium rounded">
                      {a.standard_activity_type.name}
                    </span>
                  ) : <span className="text-gray-400">—</span>}
                </td>
                <td className="px-3 py-2 max-w-xs truncate">{a.description}</td>
                <td className="px-3 py-2"><StatusBadge status={a.status} /></td>
                <td className="px-3 py-2 text-gray-500 text-xs">{formatDate(a.planned_start)}</td>
                <td className="px-3 py-2 text-gray-500 text-xs">{formatDate(a.planned_end)}</td>
                <td className="px-3 py-2 text-gray-500 text-xs">{formatDate(a.actual_start)}</td>
                <td className="px-3 py-2 text-gray-500 text-xs">{formatDate(a.actual_end)}</td>
                <td className="px-3 py-2 w-28">
                  <div className="flex items-center gap-2">
                    <ProgressBar value={a.progress_percent ?? 0} size="sm" />
                    <span className="text-xs font-semibold w-8 text-right">{a.progress_percent ?? 0}%</span>
                  </div>
                </td>
                <td className="px-3 py-2 text-xs">
                  {a.total_float !== null ? (
                    <span className={Number(a.total_float) < 0 ? 'text-red-600 font-semibold' : 'text-gray-600'}>
                      {Number(a.total_float).toFixed(0)}
                    </span>
                  ) : '—'}
                </td>
                <td className="px-3 py-2 text-xs">{a.discipline?.name || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ScheduleTab({ eventData }: { eventData: EventData }) {
  const { schedule, activities } = eventData;
  if (activities.length === 0) return <EmptyState message="No schedule information available for this equipment." />;

  const acts = activities.filter((a: any) => a.planned_start || a.planned_end);

  return (
    <div className="space-y-4">
      {/* Schedule KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-white border border-gray-200 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-gray-900">{schedule.totalActivities}</div>
          <div className="text-xs text-gray-500">Total Activities</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-red-600">{schedule.criticalActivities}</div>
          <div className="text-xs text-gray-500">Critical Path</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-orange-600">{schedule.activitiesWithNegativeFloat}</div>
          <div className="text-xs text-gray-500">Negative Float</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-3 text-center">
          <div className="text-sm font-medium text-gray-700">{formatDate(schedule.earliestPlannedStart)}</div>
          <div className="text-xs text-gray-500">Earliest Start</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-3 text-center">
          <div className="text-sm font-medium text-gray-700">{formatDate(schedule.latestPlannedEnd)}</div>
          <div className="text-xs text-gray-500">Latest End</div>
        </div>
      </div>

      {/* Schedule table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wider">
            <tr>
              <th className="px-3 py-2">Activity</th>
              <th className="px-3 py-2">Description</th>
              <th className="px-3 py-2">Planned Start</th>
              <th className="px-3 py-2">Planned End</th>
              <th className="px-3 py-2">Actual Start</th>
              <th className="px-3 py-2">Actual End</th>
              <th className="px-3 py-2 text-center">Critical</th>
              <th className="px-3 py-2">Total Float</th>
              <th className="px-3 py-2">Early Start</th>
              <th className="px-3 py-2">Late Finish</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {acts.map((a: any) => (
              <tr key={a.id} className={`hover:bg-gray-50 ${a.is_critical ? 'bg-red-50/50' : ''}`}>
                <td className="px-3 py-2 font-mono text-xs">{a.activity_number || a.id.slice(0, 8)}</td>
                <td className="px-3 py-2 max-w-xs truncate">{a.description}</td>
                <td className="px-3 py-2 text-xs">{formatDate(a.planned_start)}</td>
                <td className="px-3 py-2 text-xs">{formatDate(a.planned_end)}</td>
                <td className="px-3 py-2 text-xs">{formatDate(a.actual_start)}</td>
                <td className="px-3 py-2 text-xs">{formatDate(a.actual_end)}</td>
                <td className="px-3 py-2 text-center">
                  {a.is_critical ? <span className="text-red-600 font-bold">●</span> : <span className="text-gray-300">○</span>}
                </td>
                <td className="px-3 py-2 text-xs">
                  {a.total_float !== null ? (
                    <span className={Number(a.total_float) < 0 ? 'text-red-600 font-bold' : 'text-gray-600'}>
                      {Number(a.total_float).toFixed(1)}
                    </span>
                  ) : '—'}
                </td>
                <td className="px-3 py-2 text-xs text-gray-500">{formatDate(a.early_start)}</td>
                <td className="px-3 py-2 text-xs text-gray-500">{formatDate(a.late_finish)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ExecutionTab({ eventData }: { eventData: EventData }) {
  const logs = eventData.execution.recentLogs;
  if (logs.length === 0) return <EmptyState message="No execution updates recorded for this equipment." />;

  return (
    <div className="space-y-4">
      <div className="bg-gray-50 rounded-lg px-4 py-3">
        <div className="text-xs text-gray-500 font-medium">Last Update</div>
        <div className="text-sm font-semibold text-gray-800">{formatDateTime(eventData.execution.lastUpdate)}</div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wider">
            <tr>
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">Activity</th>
              <th className="px-3 py-2">Progress</th>
              <th className="px-3 py-2">Remarks</th>
              <th className="px-3 py-2">Recorded At</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {logs.map((log: any) => (
              <tr key={log.id} className="hover:bg-gray-50">
                <td className="px-3 py-2 text-xs">{formatDate(log.log_date)}</td>
                <td className="px-3 py-2 font-mono text-xs">{log.activity_id.slice(0, 8)}</td>
                <td className="px-3 py-2">
                  <span className="font-semibold">{Number(log.progress_percent)}%</span>
                </td>
                <td className="px-3 py-2 max-w-xs truncate text-gray-600">{log.remarks || '—'}</td>
                <td className="px-3 py-2 text-xs text-gray-500">{formatDateTime(log.recorded_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ProgressIntelligenceTab({ eventData, assetTag }: { eventData: EventData; assetTag: string }) {
  const identical = eventData.progress.identicalActivities;
  const workpacks = eventData.workpacks;

  return (
    <div className="space-y-6">
      {/* Equipment activity progress (from workpacks — M8.13 data) */}
      <SectionCard title={`${assetTag} — Activity Progress`} count={eventData.activities.length}>
        {eventData.activities.length === 0 ? (
          <EmptyState message="No activities to display." />
        ) : (
          <div className="space-y-2">
            {eventData.activities.map((a: any) => (
              <div key={a.id} className="flex items-center gap-3">
                <span className="w-48 text-sm font-medium truncate">
                  {a.standard_activity_type?.name || a.description}
                </span>
                <div className="flex-1">
                  <ProgressBar value={a.progress_percent ?? 0} size="sm" />
                </div>
                <span className="w-10 text-right text-sm font-semibold">{a.progress_percent ?? 0}%</span>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* Workpack-level M8.13 progress */}
      {workpacks.length > 0 && (
        <SectionCard title="Workpack Progress (M8.13 Authoritative)" count={workpacks.length}>
          <div className="space-y-3">
            {workpacks.map((wp: any) => {
              const metrics: ProgressMetrics | null = wp.progress;
              return (
                <div key={wp.id} className="bg-gray-50 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold">{wp.workpack_id_code || wp.title}</span>
                    <span className="text-sm font-bold">{metrics?.weightedProgress ?? wp.overall_progress ?? 0}%</span>
                  </div>
                  <ProgressBar value={metrics?.weightedProgress ?? wp.overall_progress ?? 0} />
                  {metrics && (
                    <div className="flex gap-4 mt-2 text-xs text-gray-500">
                      <span>Total: {metrics.totalActivities}</span>
                      <span className="text-emerald-600">Done: {metrics.completedActivities}</span>
                      <span className="text-blue-600">In Progress: {metrics.inProgressActivities}</span>
                      <span>Not Started: {metrics.notStartedActivities}</span>
                      <span>{metrics.totalDurationHours}h planned</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </SectionCard>
      )}

      {/* Identical Activity Intelligence (M8.13) */}
      {identical.length > 0 && (
        <SectionCard title="Identical Activity Intelligence (M8.13)" count={identical.length}>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-3 py-2">Activity Type</th>
                  <th className="px-3 py-2">Equipment Type</th>
                  <th className="px-3 py-2">Total</th>
                  <th className="px-3 py-2">Done</th>
                  <th className="px-3 py-2">In Progress</th>
                  <th className="px-3 py-2">Not Started</th>
                  <th className="px-3 py-2">Completion</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {identical.map((group, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-3 py-2 font-medium">{group.standardActivityTypeName}</td>
                    <td className="px-3 py-2 text-gray-600">{group.equipmentType}</td>
                    <td className="px-3 py-2 text-center">{group.totalInstances}</td>
                    <td className="px-3 py-2 text-center text-emerald-600 font-semibold">{group.completedInstances}</td>
                    <td className="px-3 py-2 text-center text-blue-600">{group.inProgressInstances}</td>
                    <td className="px-3 py-2 text-center text-gray-500">{group.notStartedInstances}</td>
                    <td className="px-3 py-2 w-32">
                      <div className="flex items-center gap-2">
                        <ProgressBar value={group.completionPercent} size="sm" />
                        <span className="text-xs font-semibold w-8 text-right">{group.completionPercent}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'scope', label: 'Scope' },
  { id: 'workpacks', label: 'Workpacks' },
  { id: 'activities', label: 'Activities' },
  { id: 'schedule', label: 'Schedule' },
  { id: 'execution', label: 'Execution' },
  { id: 'progress', label: 'Progress Intelligence' },
];

export default function Equipment360Client({ assetId, assetTag }: { assetId: string; assetTag: string }) {
  const [data, setData] = useState<Equipment360Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedEventIdx, setSelectedEventIdx] = useState(0);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/assets/${assetId}/360`);
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `HTTP ${res.status}`);
        }
        const json = await res.json();
        setData(json);
      } catch (err: any) {
        setError(err.message || 'Failed to load Equipment 360 data');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [assetId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        <span className="ml-3 text-gray-500 text-sm">Loading Equipment 360...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <div className="text-red-500 text-sm font-medium">⚠ {error}</div>
        <button
          onClick={() => window.location.reload()}
          className="text-sm text-blue-600 hover:text-blue-800 underline"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!data) return null;

  const emptyEvent: EventData = {
    event: { id: 'none', name: 'No Active Event', status: null },
    scope: { items: [] },
    workpacks: [],
    activities: [],
    schedule: {
      totalActivities: 0,
      criticalActivities: 0,
      activitiesWithNegativeFloat: 0,
      earliestPlannedStart: null,
      latestPlannedEnd: null,
    },
    execution: { recentLogs: [], lastUpdate: null },
    progress: { identicalActivities: [] },
  };

  const currentEvent = (data?.events && data.events.length > 0)
    ? (data.events[selectedEventIdx] || data.events[0])
    : emptyEvent;

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Event selector (if multiple events) */}
      {data.events.length > 1 && (
        <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
          <span className="text-xs font-semibold text-gray-500">EVENT:</span>
          {data.events.map((ev, idx) => (
            <button
              key={ev.event.id}
              onClick={() => setSelectedEventIdx(idx)}
              className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                idx === selectedEventIdx
                  ? 'bg-blue-600 text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-100'
              }`}
            >
              {ev.event.name}
            </button>
          ))}
        </div>
      )}

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-gray-200 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`pb-2 px-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === tab.id
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {activeTab === 'overview' && <OverviewTab data={data} eventData={currentEvent} />}
        {activeTab === 'scope' && <ScopeTab eventData={currentEvent} />}
        {activeTab === 'workpacks' && <WorkpacksTab eventData={currentEvent} />}
        {activeTab === 'activities' && <ActivitiesTab eventData={currentEvent} />}
        {activeTab === 'schedule' && <ScheduleTab eventData={currentEvent} />}
        {activeTab === 'execution' && <ExecutionTab eventData={currentEvent} />}
        {activeTab === 'progress' && <ProgressIntelligenceTab eventData={currentEvent} assetTag={assetTag} />}
      </div>
    </div>
  );
}
