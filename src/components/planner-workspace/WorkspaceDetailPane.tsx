'use client';

/**
 * M12 V1 Phase 2 — WorkspaceDetailPane Component
 *
 * Comprehensive execution inspector panel. Displays:
 *   - Identity (Activity ID, Equipment, WBS, Area, Unit, System, etc.)
 *   - Planning (read-only M11 schedule fields)
 *   - Execution (M12 execution state + action buttons)
 *   - Readiness (M10 readiness checks)
 *   - Predecessors / Successors
 *   - Constraints (replaces placeholder)
 *   - UDF values
 *
 * AUTHORITY BOUNDARIES:
 *   - Planning fields are READ-ONLY (M11 authority)
 *   - Execution actions go through ExecutionWriteService (M12 authority)
 *   - Progress is NEVER calculated here (M8.13 authority)
 *   - Readiness data is read from M10 (PlanningReadinessService)
 */
import React, { useState, useCallback, useEffect } from 'react';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';

const TABS = [
  { key: 'details', label: 'Details', icon: '📝' },
  { key: 'execution', label: 'Execution', icon: '▶️' },
  { key: 'predecessors', label: 'Preds', icon: '🔙' },
  { key: 'successors', label: 'Succs', icon: '🔜' },
  { key: 'readiness', label: 'Readiness', icon: '🟢' },
  { key: 'constraints', label: 'Constraints', icon: '🚧' },
  { key: 'udf', label: 'UDF', icon: '📋' },
] as const;

type TabKey = typeof TABS[number]['key'];

export function WorkspaceDetailPane() {
  const { selectedActivityIds, activities } = useWorkspaceStore();
  const [activeTab, setActiveTab] = useState<TabKey>('details');

  const selectedActId = [...selectedActivityIds][0] ?? null;
  const entity = selectedActId ? activities.find((a) => a.id === selectedActId) : null;

  return (
    <div className="flex flex-col h-full bg-white border-l border-gray-200">
      {/* Tab Bar */}
      <div className="flex border-b border-gray-200 bg-gray-50 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1 px-2 py-1.5 text-xs font-medium whitespace-nowrap
              border-b-2 transition-colors
              ${activeTab === tab.key
                ? 'border-blue-500 text-blue-700 bg-white'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-100'
              }`}
          >
            <span>{tab.icon}</span>
            <span className="hidden xl:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-3 flex flex-col">
        {!entity ? (
          <div className="text-center text-gray-400 text-sm py-8">
            Select an activity to view details
          </div>
        ) : (
          <TabContent tab={activeTab} entity={entity} />
        )}
      </div>
    </div>
  );
}

// ── Tab Content ───────────────────────────────────────────────────────────────

function TabContent({ tab, entity }: { tab: TabKey; entity: any }) {
  switch (tab) {
    case 'details':
      return <DetailsTab entity={entity} />;
    case 'execution':
      return <ExecutionTab entity={entity} />;
    case 'predecessors':
      return <RelationshipsTab entity={entity} type="Predecessors" />;
    case 'successors':
      return <RelationshipsTab entity={entity} type="Successors" />;
    case 'readiness':
      return <ReadinessTab entity={entity} />;
    case 'constraints':
      return <ConstraintsTab entity={entity} />;
    case 'udf':
      return <UdfTab entity={entity} />;
    default:
      return null;
  }
}

// ── Field Row Helper ──────────────────────────────────────────────────────────

function FieldRow({ label, value, mono }: { label: string; value: string | number | null | undefined; mono?: boolean }) {
  return (
    <div className="flex flex-col sm:flex-row sm:justify-between text-xs gap-0.5 sm:gap-0 py-0.5">
      <span className="text-gray-500 font-medium">{label}</span>
      <span className={`text-gray-800 sm:text-right sm:max-w-[60%] truncate ${mono ? 'font-mono' : ''}`}>
        {value != null && value !== '' ? String(value) : '—'}
      </span>
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return <h3 className="text-[11px] font-bold uppercase tracking-wider text-gray-500 mt-3 mb-1.5 first:mt-0">{title}</h3>;
}

function formatDate(d: string | null | undefined): string {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString(); } catch { return '—'; }
}

// ── Details Tab (Identity + Planning) ─────────────────────────────────────────

function DetailsTab({ entity }: { entity: any }) {
  const dimVals = entity.udf_values ?? {};
  return (
    <div className="space-y-1">
      {/* Identity */}
      <SectionHeader title="Identity" />
      <FieldRow label="Activity ID" value={entity.activity_id} mono />
      <FieldRow label="Description" value={entity.description} />
      <FieldRow label="WBS" value={entity.wbs_code || dimVals['WBS_CODE']} mono />
      <FieldRow label="Discipline" value={entity.discipline_name || entity.discipline_code || dimVals['DISCIPLINE']} />
      <FieldRow label="Unit" value={dimVals['UNIT']} />
      <FieldRow label="System" value={dimVals['SYSTEM']} />
      <FieldRow label="Equipment" value={dimVals['EQUIPMENT']} />
      <FieldRow label="Equipment Type" value={dimVals['EQUIPMENT_TYPE']} />
      <FieldRow label="Area" value={dimVals['AREA']} />
      <FieldRow label="Workpack" value={dimVals['WORKPACK']} />
      <FieldRow label="Contractor" value={dimVals['CONTRACTOR']} />
      <FieldRow label="Sequence" value={entity.sequence_number} />

      {/* Planning (M11 read-only) */}
      <SectionHeader title="Planning (M11 — Read Only)" />
      <FieldRow label="Planned Start" value={formatDate(entity.planned_start)} />
      <FieldRow label="Planned Finish" value={formatDate(entity.planned_end)} />
      <FieldRow label="Duration" value={entity.duration_hours ? `${entity.duration_hours}h` : null} />
      <FieldRow label="Early Start" value={formatDate(entity.early_start)} />
      <FieldRow label="Early Finish" value={formatDate(entity.early_finish)} />
      <FieldRow label="Total Float" value={entity.total_float != null ? `${entity.total_float}h` : null} />
      <FieldRow label="Critical" value={entity.is_critical ? '🔴 Yes' : 'No'} />
      <FieldRow label="Predecessors" value={entity.predecessors?.length ? entity.predecessors.join(', ') : null} />
      <FieldRow label="Successors" value={entity.successors?.length ? entity.successors.join(', ') : null} />

      {/* Execution Summary */}
      <SectionHeader title="Execution Summary" />
      <FieldRow label="Status" value={entity.status} />
      <FieldRow label="Progress" value={`${entity.progress ?? (entity as any).progress_percent ?? 0}%`} />
      <FieldRow label="Actual Start" value={formatDate(entity.actual_start)} />
      <FieldRow label="Actual End" value={formatDate(entity.actual_end)} />
      <FieldRow label="Remaining Duration" value={(entity as any).remaining_duration ? `${(entity as any).remaining_duration}h` : null} />
    </div>
  );
}

// ── Execution Tab ─────────────────────────────────────────────────────────────

function ExecutionTab({ entity }: { entity: any }) {
  return (
    <div className="space-y-4">
      {/* Execution State */}
      <div>
        <SectionHeader title="Execution State" />
        <FieldRow label="Status" value={entity.status} />
        <FieldRow label="Progress" value={`${entity.progress ?? (entity as any).progress_percent ?? 0}%`} />
        <FieldRow label="Actual Start" value={formatDate(entity.actual_start)} />
        <FieldRow label="Actual End" value={formatDate(entity.actual_end)} />
        <FieldRow label="Remaining Duration" value={(entity as any).remaining_duration ? `${(entity as any).remaining_duration}h` : null} />
        <FieldRow label="Hold Point" value={entity.hold_point_type || null} />
        <FieldRow label="Notes" value={entity.notes} />
        <FieldRow label="Remarks" value={(entity as any).remarks} />
      </div>

      {/* Execution Actions */}
      <ExecutionActions entity={entity} />
    </div>
  );
}

// ── Execution Actions ─────────────────────────────────────────────────────────

function ExecutionActions({ entity }: { entity: any }) {
  const { updateCellValue, fetchWorkspaceGrid } = useWorkspaceStore();
  const [progressInput, setProgressInput] = useState<string>('');
  const [holdReason, setHoldReason] = useState('');
  const [showProgress, setShowProgress] = useState(false);
  const [showHold, setShowHold] = useState(false);
  const [actionPending, setActionPending] = useState(false);

  const currentStatus = entity.status || 'not_started';
  const isNotStarted = currentStatus === 'not_started';
  const isInProgress = currentStatus === 'in_progress';
  const isCompleted = currentStatus === 'completed';
  const isOnHold = currentStatus === 'on_hold';
  const isCancelled = currentStatus === 'cancelled';

  const handleAction = useCallback(async (action: string, extra: Record<string, any> = {}) => {
    setActionPending(true);
    try {
      const payload: any = { activityId: entity.id, action, ...extra };
      const res = await fetch('/api/execution/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        alert(`Execution Action Failed: ${data.error}`);
      } else {
        // Optimistic update
        if (action === 'START') updateCellValue('activity', entity.id, 'status', 'in_progress');
        else if (action === 'COMPLETE') {
          updateCellValue('activity', entity.id, 'status', 'completed');
          updateCellValue('activity', entity.id, 'progress', 100);
        }
        else if (action === 'HOLD') updateCellValue('activity', entity.id, 'status', 'on_hold');
        else if (action === 'RESUME') updateCellValue('activity', entity.id, 'status', 'in_progress');
        else if (action === 'UPDATE_PROGRESS' && extra.progress != null) {
          updateCellValue('activity', entity.id, 'progress', extra.progress);
        }

        setShowProgress(false);
        setShowHold(false);

        // Trigger grid refresh to get server-authoritative data
        fetchWorkspaceGrid();
      }
    } catch (err: any) {
      alert(`Network error: ${err.message}`);
    } finally {
      setActionPending(false);
    }
  }, [entity.id, updateCellValue, fetchWorkspaceGrid]);

  return (
    <div className="p-3 bg-gray-50 border border-gray-200 rounded space-y-3">
      <h3 className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Execution Control</h3>

      {/* Status badge */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500">Current:</span>
        <StatusBadge status={currentStatus} />
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => handleAction('START')}
          disabled={!isNotStarted || actionPending}
          className="px-3 py-1.5 bg-blue-600 text-white text-xs font-bold rounded hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          title={!isNotStarted ? `Cannot start: status is ${currentStatus}` : 'Start this activity'}
        >
          ▶ Start
        </button>

        <button
          onClick={() => setShowProgress(!showProgress)}
          disabled={!isInProgress || actionPending}
          className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          title={!isInProgress ? `Cannot update: status is ${currentStatus}` : 'Update progress'}
        >
          📊 Update
        </button>

        <button
          onClick={() => setShowHold(!showHold)}
          disabled={!isInProgress || actionPending}
          className="px-3 py-1.5 bg-amber-600 text-white text-xs font-bold rounded hover:bg-amber-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          title={!isInProgress ? `Cannot hold: status is ${currentStatus}` : 'Place activity on hold'}
        >
          ⏸ Hold
        </button>

        <button
          onClick={() => handleAction('RESUME')}
          disabled={!isOnHold || actionPending}
          className="px-3 py-1.5 bg-teal-600 text-white text-xs font-bold rounded hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          title={!isOnHold ? `Cannot resume: status is ${currentStatus}` : 'Resume from hold'}
        >
          ▶️ Resume
        </button>

        <button
          onClick={() => handleAction('COMPLETE')}
          disabled={!isInProgress || actionPending}
          className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          title={!isInProgress ? `Cannot complete: status is ${currentStatus}` : 'Complete this activity'}
        >
          ✅ Complete
        </button>

        <button
          onClick={() => {
            const reason = prompt('Delay details:\nFormat: Category | Severity | Description');
            if (reason) {
              const parts = reason.split('|').map(s => s.trim());
              handleAction('REPORT_DELAY', {
                delayDetails: {
                  category: parts[0] || 'general',
                  severity: parts[1] || 'medium',
                  title: `Delay: ${entity.activity_id || entity.description}`,
                  description: parts[2] || reason,
                },
              });
            }
          }}
          disabled={isCompleted || isCancelled || actionPending}
          className="px-3 py-1.5 bg-red-600 text-white text-xs font-bold rounded hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
        >
          🚨 Delay
        </button>
      </div>

      {/* Progress Input */}
      {showProgress && (
        <div className="flex items-center gap-2 p-2 bg-white border border-indigo-200 rounded">
          <input
            type="range"
            min="0"
            max="100"
            step="5"
            value={progressInput || entity.progress || 0}
            onChange={(e) => setProgressInput(e.target.value)}
            className="flex-1"
          />
          <span className="text-xs font-bold text-gray-700 w-10 text-right">{progressInput || entity.progress || 0}%</span>
          <button
            onClick={() => handleAction('UPDATE_PROGRESS', { progress: Number(progressInput || entity.progress || 0) })}
            disabled={actionPending}
            className="px-2 py-1 bg-indigo-600 text-white text-[10px] font-bold rounded"
          >
            Apply
          </button>
        </div>
      )}

      {/* Hold Reason Input */}
      {showHold && (
        <div className="flex items-center gap-2 p-2 bg-white border border-amber-200 rounded">
          <input
            type="text"
            value={holdReason}
            onChange={(e) => setHoldReason(e.target.value)}
            placeholder="Hold reason (required)..."
            className="flex-1 text-xs border border-gray-300 rounded px-2 py-1"
          />
          <button
            onClick={() => {
              if (!holdReason.trim()) { alert('A hold reason is required.'); return; }
              handleAction('HOLD', { hold_reason: holdReason, notes: holdReason });
            }}
            disabled={!holdReason.trim() || actionPending}
            className="px-2 py-1 bg-amber-600 text-white text-[10px] font-bold rounded disabled:opacity-40"
          >
            Confirm Hold
          </button>
        </div>
      )}

      {/* State Machine Guide */}
      <div className="text-[10px] text-gray-400 mt-1">
        {isNotStarted && 'Ready to start. Click ▶ Start to begin execution.'}
        {isInProgress && 'In progress. Update progress, hold, or complete.'}
        {isOnHold && 'On hold. Click ▶️ Resume to continue execution.'}
        {isCompleted && 'Activity is complete. No further actions available.'}
        {isCancelled && 'Activity is cancelled.'}
      </div>
    </div>
  );
}

// ── Status Badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    not_started: 'bg-gray-100 text-gray-600 border-gray-300',
    in_progress: 'bg-blue-50 text-blue-700 border-blue-300',
    completed: 'bg-emerald-50 text-emerald-700 border-emerald-300',
    on_hold: 'bg-amber-50 text-amber-700 border-amber-300',
    cancelled: 'bg-red-50 text-red-700 border-red-300',
  };
  return (
    <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded border ${colors[status] || colors.not_started}`}>
      {status.replace('_', ' ')}
    </span>
  );
}

// ── Readiness Tab ─────────────────────────────────────────────────────────────

function ReadinessTab({ entity }: { entity: any }) {
  const [readiness, setReadiness] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!entity.workpack_id) return;
    setLoading(true);
    fetch(`/api/planner-workspace/readiness?workpackId=${entity.workpack_id}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => setReadiness(data))
      .catch(() => setReadiness(null))
      .finally(() => setLoading(false));
  }, [entity.workpack_id]);

  if (!entity.workpack_id) {
    return <div className="text-center text-gray-400 text-xs py-8">No workpack associated with this activity.</div>;
  }
  if (loading) {
    return <div className="text-center text-gray-400 text-xs py-8">Loading readiness data...</div>;
  }

  // Readiness checklist
  const checks = readiness?.checks ?? [
    { key: 'equipment', label: 'Equipment Available', passed: null },
    { key: 'isolation', label: 'Isolation Complete', passed: null },
    { key: 'permit', label: 'Permits Valid', passed: null },
    { key: 'material', label: 'Materials On Site', passed: null },
    { key: 'manpower', label: 'Manpower Assigned', passed: null },
    { key: 'tools', label: 'Tools Available', passed: null },
    { key: 'predecessor', label: 'Predecessors Complete', passed: null },
    { key: 'documents', label: 'Documents Issued', passed: null },
    { key: 'qaqc', label: 'QA/QC Cleared', passed: null },
    { key: 'safety', label: 'Safety Briefing', passed: null },
  ];

  return (
    <div className="space-y-2">
      <SectionHeader title="Execution Readiness" />
      {readiness?.readiness_score != null && (
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs text-gray-500">Score:</span>
          <span className="text-sm font-bold text-gray-800">{readiness.readiness_score}%</span>
        </div>
      )}
      <div className="space-y-1">
        {checks.map((check: any) => (
          <div key={check.key || check.label} className="flex items-center justify-between text-xs py-1 px-2 rounded bg-gray-50 border border-gray-100">
            <span className="text-gray-700">{check.label}</span>
            <span>
              {check.passed === true ? '🟢' : check.passed === false ? '🔴' : '⚪'}
            </span>
          </div>
        ))}
      </div>
      <p className="text-[10px] text-gray-400 mt-2">Readiness data from M10 PlanningReadinessService (read-only).</p>
    </div>
  );
}

// ── Constraints Tab ───────────────────────────────────────────────────────────

function ConstraintsTab({ entity }: { entity: any }) {
  const [constraints, setConstraints] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!entity.workpack_id) return;
    setLoading(true);
    fetch(`/api/planner-workspace/constraints?workpackId=${entity.workpack_id}`)
      .then((r) => r.ok ? r.json() : [])
      .then((data) => setConstraints(Array.isArray(data) ? data : data.constraints ?? []))
      .catch(() => setConstraints([]))
      .finally(() => setLoading(false));
  }, [entity.workpack_id]);

  if (!entity.workpack_id) {
    return <div className="text-center text-gray-400 text-xs py-8">No workpack associated.</div>;
  }
  if (loading) {
    return <div className="text-center text-gray-400 text-xs py-8">Loading constraints...</div>;
  }
  if (constraints.length === 0) {
    return <div className="text-center text-gray-400 text-xs py-8">No constraints found for this workpack.</div>;
  }

  return (
    <div className="space-y-2">
      <SectionHeader title={`Constraints (${constraints.length})`} />
      {constraints.map((c: any) => (
        <div key={c.id} className={`p-2 rounded border text-xs ${
          c.status === 'open' ? 'bg-red-50 border-red-200' :
          c.status === 'resolved' ? 'bg-green-50 border-green-200' :
          'bg-gray-50 border-gray-200'
        }`}>
          <div className="flex justify-between items-start">
            <span className="font-bold text-gray-800">{c.constraint_number || c.title}</span>
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
              c.status === 'open' ? 'bg-red-100 text-red-700' :
              c.status === 'resolved' ? 'bg-green-100 text-green-700' :
              'bg-gray-100 text-gray-600'
            }`}>{c.status}</span>
          </div>
          {c.description && <p className="text-gray-600 mt-1">{c.description}</p>}
          {c.target_resolution_date && (
            <p className="text-gray-400 mt-0.5">Target: {formatDate(c.target_resolution_date)}</p>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Relationships Tab ─────────────────────────────────────────────────────────

function RelationshipsTab({ entity, type }: { entity: any; type: 'Predecessors' | 'Successors' }) {
  const rels = type === 'Predecessors' ? entity.predecessors : entity.successors;

  if (!rels || rels.length === 0) {
    return (
      <div className="text-center text-gray-400 text-xs py-8">
        No {type.toLowerCase()} found.
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <SectionHeader title={type} />
      {rels.map((r: string, idx: number) => (
        <div key={idx} className="flex justify-between text-xs p-2 bg-gray-50 border border-gray-200 rounded">
          <span className="text-gray-800 font-medium font-mono">{r}</span>
        </div>
      ))}
    </div>
  );
}

// ── UDF Tab ───────────────────────────────────────────────────────────────────

function UdfTab({ entity }: { entity: any }) {
  const udfValues = entity.udf_values ?? {};
  const udfEntries = Object.entries(udfValues);

  if (udfEntries.length === 0) {
    return <div className="text-center text-gray-400 text-xs py-8">No UDF values for this activity.</div>;
  }

  return (
    <div className="space-y-1">
      <SectionHeader title="User Defined Fields" />
      {udfEntries.map(([code, value]) => (
        <FieldRow key={code} label={code} value={String(value ?? '—')} mono />
      ))}
    </div>
  );
}
