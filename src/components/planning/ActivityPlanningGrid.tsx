'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useActiveShutdown } from '@/context/ActiveShutdownContext';
import { ExcelPasteModal, type ParsedPasteRow } from './ExcelPasteModal';
import { PlannedDateOverrideDialog } from '@/components/Schedule/PlannedDateOverrideDialog';

export interface ActivityRow {
  id: string;
  isTemp?: boolean;
  activity_number: string;
  description: string;
  wbs_code: string;
  discipline_id: string;
  discipline_name?: string;
  duration_hours: number;
  planned_start: string;
  planned_end: string;
  planned_derived_start?: string | null;
  planned_derived_end?: string | null;
  planned_override_reason?: string | null;
  status: string;
  progress_percent: number;
  responsible: string;
  notes: string;
  is_critical: boolean;
  isDirty?: boolean;
  hasError?: boolean;
  errorMessage?: string;
}

const ROW_HEIGHT = 38;
const VISIBLE_WINDOW_BUFFER = 15;

export function ActivityPlanningGrid() {
  const { activeEventId, activeShutdown, isLoading: contextLoading } = useActiveShutdown();

  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [disciplines, setDisciplines] = useState<{ id: string; code: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [disciplineFilter, setDisciplineFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Active cell focus
  const [focusedCell, setFocusedCell] = useState<{ rowIdx: number; colKey: string } | null>(null);
  const [editingCell, setEditingCell] = useState<{ rowIdx: number; colKey: string } | null>(null);

  // Deleted IDs queue
  const [deletedIds, setDeletedIds] = useState<string[]>([]);

  // Excel paste modal state
  const [isPasteModalOpen, setIsPasteModalOpen] = useState(false);
  const [overrideTarget, setOverrideTarget] = useState<{
    activityId: string;
    field: 'planned_start' | 'planned_end';
    label: string;
    currentValue: string | null;
    derivedValue: string | null;
  } | null>(null);

  // Virtual scrolling state
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(600);

  // Fetch initial disciplines
  useEffect(() => {
    fetch('/api/platform-data/master-data/disciplines')
      .then((r) => r.json())
      .then((data) => {
        const items = data.items || data.data || [];
        setDisciplines(items);
      })
      .catch(() => {
        // Fallback default disciplines
        setDisciplines([
          { id: 'mech-01', code: 'MECH', name: 'Mechanical' },
          { id: 'elec-01', code: 'ELEC', name: 'Electrical' },
          { id: 'inst-01', code: 'INST', name: 'Instrumentation' },
          { id: 'pipe-01', code: 'PIPE', name: 'Piping' },
          { id: 'civil-01', code: 'CIVIL', name: 'Civil / Scaffolding' },
        ]);
      });
  }, []);

  // Fetch activities when activeEventId changes
  const loadActivities = useCallback(async () => {
    if (!activeEventId) {
      setActivities([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const res = await fetch(`/api/activities?event_id=${activeEventId}`);
      const json = await res.json();
      const raw: any[] = json.data || json.items || [];

      const mapped: ActivityRow[] = raw.map((a, idx) => ({
        id: a.id,
        isTemp: false,
        activity_number: a.activity_number || `ACT-${String(idx + 1).padStart(3, '0')}`,
        description: a.description || '',
        wbs_code: a.wbs_code || '',
        discipline_id: a.discipline_id || '',
        discipline_name: a.discipline?.code || '',
        duration_hours: a.duration_hours ? Number(a.duration_hours) : 8,
        planned_start: a.planned_start ? String(a.planned_start) : '',
        planned_end: a.planned_end ? String(a.planned_end) : '',
        planned_derived_start: a.planned_derived_start ? String(a.planned_derived_start) : null,
        planned_derived_end: a.planned_derived_end ? String(a.planned_derived_end) : null,
        planned_override_reason: a.planned_override_reason ?? null,
        status: a.status || 'not_started',
        progress_percent: a.progress_percent || 0,
        responsible: a.responsible || '',
        notes: a.notes || '',
        is_critical: Boolean(a.is_critical),
        isDirty: false,
      }));

      setActivities(mapped);
      setDeletedIds([]);
    } catch (err) {
      console.error('Failed to load activities:', err);
    } finally {
      setLoading(false);
    }
  }, [activeEventId]);

  useEffect(() => {
    loadActivities();
  }, [loadActivities]);

  // Track container height & scroll
  useEffect(() => {
    const handleResize = () => {
      if (tableContainerRef.current) {
        setContainerHeight(tableContainerRef.current.clientHeight);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  };

  // Filtered rows
  const filteredActivities = useMemo(() => {
    return activities.filter((a) => {
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        const matches =
          a.description.toLowerCase().includes(q) ||
          a.activity_number.toLowerCase().includes(q) ||
          a.wbs_code.toLowerCase().includes(q) ||
          a.responsible.toLowerCase().includes(q);
        if (!matches) return false;
      }
      if (disciplineFilter && a.discipline_id !== disciplineFilter) return false;
      if (statusFilter && a.status !== statusFilter) return false;
      return true;
    });
  }, [activities, searchTerm, disciplineFilter, statusFilter]);

  // Unsaved changes count
  const unsavedCount = useMemo(() => {
    const dirtyRows = activities.filter((a) => a.isDirty || a.isTemp).length;
    return dirtyRows + deletedIds.length;
  }, [activities, deletedIds]);

  // Virtual slice calculation
  const totalRows = filteredActivities.length;
  const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - VISIBLE_WINDOW_BUFFER);
  const visibleCount = Math.ceil(containerHeight / ROW_HEIGHT) + VISIBLE_WINDOW_BUFFER * 2;
  const endIndex = Math.min(totalRows, startIndex + visibleCount);
  const visibleRows = filteredActivities.slice(startIndex, endIndex);
  const offsetY = startIndex * ROW_HEIGHT;

  // Cell change handler
  const handleCellChange = (rowId: string, field: keyof ActivityRow, value: any) => {
    setActivities((prev) =>
      prev.map((row) => {
        if (row.id !== rowId) return row;
        const updated = { ...row, [field]: value, isDirty: true };

        return updated;
      })
    );
  };

  // Add new blank row
  const handleAddRow = () => {
    const newRow: ActivityRow = {
      id: `temp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      isTemp: true,
      activity_number: `ACT-${String(activities.length + 1).padStart(3, '0')}`,
      description: 'New Activity',
      wbs_code: '1.0',
      discipline_id: disciplines[0]?.id || '',
      duration_hours: 8,
      planned_start: '',
      planned_end: '',
      status: 'not_started',
      progress_percent: 0,
      responsible: '',
      notes: '',
      is_critical: false,
      isDirty: true,
    };

    setActivities((prev) => [newRow, ...prev]);
    setFocusedCell({ rowIdx: 0, colKey: 'description' });
    setEditingCell({ rowIdx: 0, colKey: 'description' });
  };

  // Import rows from Excel paste
  const handleImportExcelRows = (rows: ParsedPasteRow[]) => {
    const newItems: ActivityRow[] = rows.map((r, idx) => ({
      id: `temp-paste-${Date.now()}-${idx}`,
      isTemp: true,
      activity_number: r.activity_number || `ACT-${String(activities.length + idx + 1).padStart(3, '0')}`,
      description: r.description,
      wbs_code: r.wbs_code || '1.0',
      discipline_id: r.discipline_id || disciplines[0]?.id || '',
      duration_hours: r.duration_hours ?? 8,
      planned_start: '',
      planned_end: '',
      status: 'not_started',
      progress_percent: 0,
      responsible: r.responsible || '',
      notes: r.notes || '',
      is_critical: false,
      isDirty: true,
    }));

    setActivities((prev) => [...newItems, ...prev]);
  };

  // Delete selected rows
  const handleDeleteSelected = () => {
    if (selectedIds.size === 0) return;
    const realIdsToDelete: string[] = [];

    setActivities((prev) =>
      prev.filter((row) => {
        if (selectedIds.has(row.id)) {
          if (!row.isTemp) {
            realIdsToDelete.push(row.id);
          }
          return false;
        }
        return true;
      })
    );

    setDeletedIds((prev) => [...prev, ...realIdsToDelete]);
    setSelectedIds(new Set());
  };

  // Toggle selection
  const toggleSelectRow = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredActivities.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredActivities.map((a) => a.id)));
    }
  };

  // Bulk Save
  const handleSaveChanges = async () => {
    if (!activeEventId) return;

    const creates = activities
      .filter((a) => a.isTemp)
      .map((a) => ({
        activity_number: a.activity_number,
        description: a.description,
        wbs_code: a.wbs_code,
        discipline_id: a.discipline_id || undefined,
        duration_hours: a.duration_hours,
        responsible: a.responsible || undefined,
        notes: a.notes || undefined,
        is_critical: a.is_critical,
      }));

    const updates = activities
      .filter((a) => !a.isTemp && a.isDirty)
      .map((a) => ({
        id: a.id,
        activity_number: a.activity_number,
        description: a.description,
        wbs_code: a.wbs_code,
        discipline_id: a.discipline_id || undefined,
        duration_hours: a.duration_hours,
        responsible: a.responsible || undefined,
        notes: a.notes || undefined,
        is_critical: a.is_critical,
      }));

    try {
      setIsSaving(true);
      const res = await fetch('/api/activities/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_id: activeEventId,
          creates,
          updates,
          deletes: deletedIds,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to save changes');
      }

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
      await loadActivities();
    } catch (err: any) {
      alert(`Save error: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  if (!activeEventId) {
    return (
      <div className="p-12 text-center bg-white rounded-2xl border border-gray-200 shadow-sm max-w-2xl mx-auto my-12">
        <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center text-2xl mx-auto mb-4">
          🎯
        </div>
        <h3 className="text-lg font-black text-gray-900 mb-1">No Active Shutdown Selected</h3>
        <p className="text-sm text-gray-500 mb-6">
          Please select an active shutdown from the top navigation bar or create one in the Shutdown Hub to begin planning activities.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] bg-white overflow-hidden">
      {/* ── Active Shutdown Workspace Header ── */}
      <div className="px-6 py-4 border-b border-gray-200 bg-gray-50/70 flex flex-wrap items-center justify-between gap-4 flex-shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
              {activeShutdown?.code || 'SHUTDOWN'}
            </span>
            <h1 className="text-xl font-black text-gray-900 tracking-tight">
              {activeShutdown?.name || 'Turnaround Planning Grid'}
            </h1>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            {activeShutdown?.site?.name || 'Primary Site'} • Planned:{' '}
            {activeShutdown?.planned_start ? new Date(activeShutdown.planned_start).toLocaleDateString() : '—'}{' '}
            {activeShutdown?.planned_end ? `→ ${new Date(activeShutdown.planned_end).toLocaleDateString()}` : ''}
          </p>
        </div>

        {/* Action Toolbar */}
        <div className="flex items-center gap-2">
          {unsavedCount > 0 && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold rounded-lg animate-pulse">
              <span>●</span> {unsavedCount} Unsaved
            </span>
          )}

          {saveSuccess && (
            <span className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-lg">
              ✓ Saved
            </span>
          )}

          <button
            type="button"
            onClick={handleAddRow}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all"
          >
            <span>+</span> Add Row
          </button>

          <button
            type="button"
            onClick={() => setIsPasteModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 text-xs font-bold rounded-xl shadow-sm transition-all"
          >
            📋 Paste Excel
          </button>

          {selectedIds.size > 0 && (
            <button
              type="button"
              onClick={handleDeleteSelected}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 text-xs font-bold rounded-xl transition-all"
            >
              🗑️ Delete ({selectedIds.size})
            </button>
          )}

          <button
            type="button"
            onClick={handleSaveChanges}
            disabled={unsavedCount === 0 || isSaving}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-sm transition-all"
          >
            {isSaving ? 'Saving...' : '💾 Save Changes'}
          </button>
        </div>
      </div>

      {/* ── Search & Filter Controls ── */}
      <div className="px-6 py-2.5 border-b border-gray-100 bg-white flex items-center justify-between gap-4 text-xs flex-shrink-0">
        <div className="flex items-center gap-3 flex-1 max-w-xl">
          <input
            type="text"
            placeholder="Search activities, WBS, contractor..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          />

          <select
            value={disciplineFilter}
            onChange={(e) => setDisciplineFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs outline-none"
          >
            <option value="">All Disciplines</option>
            {disciplines.map((d) => (
              <option key={d.id} value={d.id}>
                {d.code} - {d.name}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs outline-none"
          >
            <option value="">All Statuses</option>
            <option value="not_started">Not Started</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="blocked">Blocked</option>
          </select>
        </div>

        <div className="text-gray-400 font-medium">
          Showing {filteredActivities.length} of {activities.length} activities
        </div>
      </div>

      {/* ── Virtualized Spreadsheet Grid ── */}
      <div
        ref={tableContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-auto relative bg-gray-50 font-sans select-none"
      >
        {loading ? (
          <div className="p-12 text-center text-gray-400 font-medium">Loading activities...</div>
        ) : (
          <div style={{ height: `${totalRows * ROW_HEIGHT + 42}px`, minWidth: '1300px' }} className="relative">
            {/* Sticky Table Header */}
            <div className="sticky top-0 z-30 flex bg-gray-100 border-b border-gray-300 font-bold text-[11px] text-gray-700 uppercase tracking-wider h-[38px] shadow-sm">
              <div className="w-10 px-2 py-2 flex items-center justify-center border-r border-gray-200 bg-gray-100">
                <input
                  type="checkbox"
                  checked={selectedIds.size > 0 && selectedIds.size === filteredActivities.length}
                  onChange={toggleSelectAll}
                  className="rounded border-gray-300 text-blue-600 focus:ring-0"
                />
              </div>
              {/* Frozen Col 1 */}
              <div className="sticky left-10 z-20 w-32 px-3 py-2 border-r border-gray-300 bg-gray-100 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                Activity #
              </div>
              {/* Frozen Col 2 */}
              <div className="sticky left-[168px] z-20 w-72 px-3 py-2 border-r border-gray-300 bg-gray-100 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                Activity Description
              </div>
              <div className="w-24 px-3 py-2 border-r border-gray-200">WBS</div>
              <div className="w-32 px-3 py-2 border-r border-gray-200">Discipline</div>
              <div className="w-24 px-3 py-2 border-r border-gray-200 text-right">Dur (h)</div>
              <div className="w-28 px-3 py-2 border-r border-gray-200">Start</div>
              <div className="w-28 px-3 py-2 border-r border-gray-200">Finish</div>
              <div className="w-28 px-3 py-2 border-r border-gray-200">Status</div>
              <div className="w-20 px-3 py-2 border-r border-gray-200 text-right">% Done</div>
              <div className="w-36 px-3 py-2 border-r border-gray-200">Contractor</div>
              <div className="flex-1 px-3 py-2 min-w-[200px]">Notes</div>
            </div>

            {/* Virtualized Rows Container */}
            <div style={{ transform: `translateY(${offsetY}px)` }} className="absolute left-0 right-0">
              {visibleRows.map((row, idx) => {
                const globalRowIdx = startIndex + idx;
                const isSelected = selectedIds.has(row.id);

                return (
                  <div
                    key={row.id}
                    className={`flex items-center h-[38px] border-b border-gray-200 text-xs transition-colors ${
                      row.isTemp ? 'bg-amber-50/40' : isSelected ? 'bg-blue-50' : 'bg-white hover:bg-gray-50'
                    }`}
                  >
                    {/* Checkbox */}
                    <div className="w-10 px-2 h-full flex items-center justify-center border-r border-gray-200">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectRow(row.id)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-0"
                      />
                    </div>

                    {/* Frozen Col 1: Activity Number */}
                    <div className="sticky left-10 z-10 w-32 h-full px-3 flex items-center border-r border-gray-300 font-mono font-bold text-gray-800 bg-inherit shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                      <input
                        type="text"
                        value={row.activity_number}
                        onChange={(e) => handleCellChange(row.id, 'activity_number', e.target.value)}
                        className="w-full bg-transparent border-none outline-none font-mono font-bold text-gray-800"
                      />
                    </div>

                    {/* Frozen Col 2: Activity Description */}
                    <div className="sticky left-[168px] z-10 w-72 h-full px-3 flex items-center border-r border-gray-300 font-medium text-gray-900 bg-inherit shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                      <input
                        type="text"
                        value={row.description}
                        onChange={(e) => handleCellChange(row.id, 'description', e.target.value)}
                        className="w-full bg-transparent border-none outline-none font-sans text-gray-900"
                      />
                    </div>

                    {/* WBS Code */}
                    <div className="w-24 h-full px-3 flex items-center border-r border-gray-200 font-mono text-gray-600">
                      <input
                        type="text"
                        value={row.wbs_code}
                        onChange={(e) => handleCellChange(row.id, 'wbs_code', e.target.value)}
                        className="w-full bg-transparent border-none outline-none font-mono"
                      />
                    </div>

                    {/* Discipline Dropdown */}
                    <div className="w-32 h-full px-2 flex items-center border-r border-gray-200">
                      <select
                        value={row.discipline_id}
                        onChange={(e) => handleCellChange(row.id, 'discipline_id', e.target.value)}
                        className="w-full bg-transparent border-none outline-none text-xs text-gray-700"
                      >
                        <option value="">None</option>
                        {disciplines.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.code}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Duration Hours */}
                    <div className="w-24 h-full px-3 flex items-center border-r border-gray-200">
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        value={row.duration_hours}
                        onChange={(e) => handleCellChange(row.id, 'duration_hours', parseFloat(e.target.value) || 0)}
                        className="w-full bg-transparent border-none outline-none text-right font-mono"
                      />
                    </div>

                    {/* Planned Start — CPM-derived, read-only */}
                    <div className="w-28 h-full px-2 flex items-center border-r border-gray-200 font-mono text-gray-500 text-xs" title="CPM-derived. Override requires a reason.">
                      <span className="truncate">{row.planned_start ? new Date(row.planned_start).toLocaleString() : '—'}</span>
                      {row.planned_override_reason ? <span className="ml-1 text-[9px] text-amber-600">OV</span> : null}
                      {!row.isTemp && (
                        <button
                          type="button"
                          className="ml-auto text-[9px] text-blue-600"
                          onClick={() => setOverrideTarget({
                            activityId: row.id,
                            field: 'planned_start',
                            label: 'Plan Start',
                            currentValue: row.planned_start || null,
                            derivedValue: row.planned_derived_start ?? null,
                          })}
                        >
                          Override
                        </button>
                      )}
                    </div>

                    {/* Planned End — CPM-derived, read-only */}
                    <div className="w-28 h-full px-2 flex items-center border-r border-gray-200 font-mono text-gray-500 text-xs" title="CPM-derived. Override requires a reason.">
                      <span className="truncate">{row.planned_end ? new Date(row.planned_end).toLocaleString() : '—'}</span>
                      {!row.isTemp && (
                        <button
                          type="button"
                          className="ml-auto text-[9px] text-blue-600"
                          onClick={() => setOverrideTarget({
                            activityId: row.id,
                            field: 'planned_end',
                            label: 'Plan End',
                            currentValue: row.planned_end || null,
                            derivedValue: row.planned_derived_end ?? null,
                          })}
                        >
                          Override
                        </button>
                      )}
                    </div>

                    {/* Status */}
                    <div className="w-28 h-full px-2 flex items-center border-r border-gray-200">
                      <select
                        value={row.status}
                        onChange={(e) => handleCellChange(row.id, 'status', e.target.value)}
                        className="w-full bg-transparent border-none outline-none text-[11px] font-bold uppercase"
                      >
                        <option value="not_started">Not Started</option>
                        <option value="in_progress">In Progress</option>
                        <option value="completed">Completed</option>
                        <option value="blocked">Blocked</option>
                        <option value="on_hold">On Hold</option>
                      </select>
                    </div>

                    {/* % Complete */}
                    <div className="w-20 h-full px-3 flex items-center border-r border-gray-200">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={row.progress_percent}
                        onChange={(e) => handleCellChange(row.id, 'progress_percent', parseInt(e.target.value, 10) || 0)}
                        className="w-full bg-transparent border-none outline-none text-right font-mono"
                      />
                    </div>

                    {/* Contractor / Responsible */}
                    <div className="w-36 h-full px-3 flex items-center border-r border-gray-200">
                      <input
                        type="text"
                        value={row.responsible}
                        onChange={(e) => handleCellChange(row.id, 'responsible', e.target.value)}
                        placeholder="Contractor"
                        className="w-full bg-transparent border-none outline-none text-xs"
                      />
                    </div>

                    {/* Notes */}
                    <div className="flex-1 h-full px-3 flex items-center min-w-[200px]">
                      <input
                        type="text"
                        value={row.notes}
                        onChange={(e) => handleCellChange(row.id, 'notes', e.target.value)}
                        placeholder="Remarks..."
                        className="w-full bg-transparent border-none outline-none text-xs text-gray-500"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── Excel Paste Modal ── */}
      <ExcelPasteModal
        isOpen={isPasteModalOpen}
        onClose={() => setIsPasteModalOpen(false)}
        onImport={handleImportExcelRows}
        disciplines={disciplines}
      />
      {overrideTarget && (
        <PlannedDateOverrideDialog
          activityId={overrideTarget.activityId}
          field={overrideTarget.field}
          label={overrideTarget.label}
          currentValue={overrideTarget.currentValue}
          derivedValue={overrideTarget.derivedValue}
          onClose={() => setOverrideTarget(null)}
          onApplied={() => { void loadActivities(); }}
        />
      )}
    </div>
  );
}
