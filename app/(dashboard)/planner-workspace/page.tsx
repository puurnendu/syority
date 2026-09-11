'use client';

/**
 * M7.5 — Planner Workspace Page
 *
 * 5-pane layout: Toolbar + Tree + WorkpackGrid + ActivityGrid + Inspector + BottomPanel
 *
 * CSS Grid layout with resizable dividers.
 * Panels toggle on/off via toolbar shortcuts.
 *
 * Data flow:
 * 1. Select event → load hierarchy tree, workpack grid, rollups
 * 2. Click tree node → filter workpack grid
 * 3. Click workpack → load activity grid
 * 4. Select anything → inspector synchronizes
 *
 * Keyboard: Alt+T (tree), Alt+I (inspector), Alt+B (bottom), Alt+1-0 (views)
 */
import React, { useCallback, useEffect, useState } from 'react';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { HierarchyTreePanel } from '@/components/planner-workspace/HierarchyTreePanel';
import { WorkpackGrid } from '@/components/planner-workspace/WorkpackGrid';
import { ActivityGrid } from '@/components/planner-workspace/ActivityGrid';
import { WorkspaceDetailPane } from '@/components/planner-workspace/WorkspaceDetailPane';
import { BottomPanel } from '@/components/planner-workspace/BottomPanel';
import { WorkspaceToolbar } from '@/components/planner-workspace/WorkspaceToolbar';
import { ResourcePlanningDashboard } from '@/components/planner-workspace/resources/ResourcePlanningDashboard';
import { ScheduleControlDashboard } from '@/components/planner-workspace/resources/ScheduleControlDashboard';
import { ScenarioControlDashboard } from '@/components/planner-workspace';
import { CostControlDashboard } from '@/components/planner-workspace/evm/CostControlDashboard';
import { ScopeChangeDashboard } from '@/components/planner-workspace/ScopeChangeDashboard';
import { MaterialReadinessDashboard } from '@/components/planner-workspace/MaterialReadinessDashboard';
import { WorkspaceGantt } from '@/components/planner-workspace/WorkspaceGantt';

export default function PlannerWorkspacePage() {
  const {
    showTree,
    showInspector,
    showBottomPanel,
    selectedEventId,
    setSelectedEvent,
    setTreeNodes,
    setWorkpacks,
    setActivities,
    setValidationIssues,
    setRollups,
    setIsLoading,
    isLoading,
    selectedWorkpackIds,
    selectedTreeNodeId,
    toggleTree,
    toggleInspector,
    toggleBottomPanel,
    activeView,
    setActiveView,
  } = useWorkspaceStore();

  const [events, setEvents] = useState<{ id: string; name: string }[]>([]);
  const [treeWidth, setTreeWidth] = useState(240);
  const [inspectorWidth, setInspectorWidth] = useState(280);
  const [bottomHeight, setBottomHeight] = useState(200);

  // ── Load events list ──────────────────────────────────────────────────

  useEffect(() => {
    fetch('/api/events?limit=50')
      .then((r) => r.ok ? r.json() : { events: [] })
      .then((data) => {
        const evts = (data.items ?? data.events ?? data ?? []).map((e: any) => ({
          id: e.id,
          name: e.event_name ?? e.name ?? 'Event',
        }));
        setEvents(evts);
        // Auto-select first event if none selected
        if (evts.length > 0 && !selectedEventId) {
          handleEventSelect(evts[0].id, evts[0].name);
        }
      })
      .catch(() => {});
  }, []);

  // ── Event selection → load tree + workpack grid ───────────────────────

  const handleEventSelect = useCallback(async (eventId: string, eventName: string) => {
    setSelectedEvent(eventId, eventName);
    await loadEventData(eventId);
  }, []);

  const loadEventData = useCallback(async (eventId: string) => {
    setIsLoading(true);
    try {
      const [treeRes, wpRes, rollupRes] = await Promise.all([
        fetch(`/api/planner-workspace/hierarchy-tree?eventId=${eventId}`),
        fetch(`/api/planner-workspace/workpack-grid?eventId=${eventId}`),
        fetch(`/api/planner-workspace/rollups?eventId=${eventId}`),
      ]);

      if (treeRes.ok) {
        const treeData = await treeRes.json();
        setTreeNodes(treeData);
      }

      if (wpRes.ok) {
        const wpData = await wpRes.json();
        setWorkpacks(wpData);
      }

      if (rollupRes.ok) {
        const rollupData = await rollupRes.json();
        setRollups(rollupData.event, rollupData.units);
      }
    } catch (err) {
      console.error('Failed to load event data:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ── Workpack selection → load activities ──────────────────────────────

  useEffect(() => {
    if (selectedWorkpackIds.size > 0) {
      const ids = [...selectedWorkpackIds].join(',');
      fetch(`/api/planner-workspace/activity-grid?workpackId=${ids}`)
        .then((r) => r.ok ? r.json() : [])
        .then((data) => setActivities(data))
        .catch(() => setActivities([]));
    } else if (selectedEventId) {
      // Show all activities when no workpack is selected
      fetch(`/api/planner-workspace/activity-grid?eventId=${selectedEventId}`)
        .then((r) => r.ok ? r.json() : [])
        .then((data) => setActivities(data))
        .catch(() => setActivities([]));
    }
  }, [selectedWorkpackIds, selectedEventId]);

  // ── Validate ──────────────────────────────────────────────────────────

  const handleValidate = useCallback(async () => {
    if (!selectedEventId) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/planner-workspace/validate?eventId=${selectedEventId}`);
      if (res.ok) {
        const data = await res.json();
        setValidationIssues(data.issues);
      }
    } catch (err) {
      console.error('Validation failed:', err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedEventId]);

  // ── Refresh ───────────────────────────────────────────────────────────

  const handleRefresh = useCallback(() => {
    if (selectedEventId) loadEventData(selectedEventId);
  }, [selectedEventId, loadEventData]);

  // ── Keyboard shortcuts ────────────────────────────────────────────────

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.altKey) {
        const views = ['hierarchy', 'workpacks', 'activities', 'schedule', 'relationships',
          'resources', 'contractor_quantities', 'documents', 'qaqc', 'certificates'] as const;
        const num = parseInt(e.key);
        if (num >= 0 && num <= 9) {
          e.preventDefault();
          const idx = num === 0 ? 9 : num - 1;
          if (views[idx]) setActiveView(views[idx]);
        }
        if (e.key.toLowerCase() === 't') { e.preventDefault(); toggleTree(); }
        if (e.key.toLowerCase() === 'i') { e.preventDefault(); toggleInspector(); }
        if (e.key.toLowerCase() === 'b') { e.preventDefault(); toggleBottomPanel(); }
      }
      // Ctrl+Shift+V → Validate
      if (e.ctrlKey && e.shiftKey && e.key === 'V') {
        e.preventDefault();
        handleValidate();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleValidate]);

  // ── Resize handlers ───────────────────────────────────────────────────

  const handleTreeResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = treeWidth;

    const onMove = (me: MouseEvent) => {
      setTreeWidth(Math.max(160, Math.min(400, startWidth + me.clientX - startX)));
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [treeWidth]);

  const handleInspectorResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = inspectorWidth;

    const onMove = (me: MouseEvent) => {
      setInspectorWidth(Math.max(200, Math.min(450, startWidth - (me.clientX - startX))));
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [inspectorWidth]);

  const handleBottomResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const startHeight = bottomHeight;

    const onMove = (me: MouseEvent) => {
      setBottomHeight(Math.max(100, Math.min(500, startHeight - (me.clientY - startY))));
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [bottomHeight]);

  // ── CSS Grid layout ───────────────────────────────────────────────────

  const gridTemplate = {
    gridTemplateColumns: [
      showTree ? `${treeWidth}px` : '',
      showTree ? '4px' : '',
      '1fr',
      showInspector ? '4px' : '',
      showInspector ? `${inspectorWidth}px` : '',
    ].filter(Boolean).join(' '),
  };

  return (
    <div className="flex flex-col h-screen bg-gray-100">
      {/* Toolbar */}
      <WorkspaceToolbar onValidate={handleValidate} onRefresh={handleRefresh} />

      {/* Event selector bar (if no event selected) */}
      {!selectedEventId && events.length > 0 && (
        <div className="flex items-center gap-2 px-4 py-3 bg-amber-50 border-b border-amber-200">
          <span className="text-sm text-amber-800 font-medium">Select an event to begin:</span>
          <select
            onChange={(e) => {
              const evt = events.find((ev) => ev.id === e.target.value);
              if (evt) handleEventSelect(evt.id, evt.name);
            }}
            className="text-sm border border-amber-300 rounded px-2 py-1 bg-white"
          >
            <option value="">Choose event...</option>
            {events.map((evt) => (
              <option key={evt.id} value={evt.id}>{evt.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Loading indicator */}
      {isLoading && (
        <div className="h-0.5 bg-blue-500 animate-pulse" />
      )}

      {/* Main Content */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden flex flex-col relative">
        {/* Upper section: Tree + Grids + Inspector */}
        <div
          className="flex-1 min-w-[1024px] lg:min-w-0 overflow-hidden h-full"
          style={{
            display: 'grid',
            ...gridTemplate,
            gridTemplateRows: '1fr',
          }}
        >
          {/* Tree Panel */}
          {showTree && (
            <>
              <div className="overflow-hidden">
                <HierarchyTreePanel />
              </div>
              {/* Tree resize handle */}
              <div
                className="cursor-col-resize bg-gray-200 hover:bg-blue-400 active:bg-blue-500 transition-colors"
                onMouseDown={handleTreeResize}
              />
            </>
          )}

          {/* Center: Workpack Grid + Activity Grid (stacked) */}
          <div className="flex flex-col overflow-hidden">
            {activeView === 'resources' ? (
              <ResourcePlanningDashboard />
            ) : activeView === 'schedule' ? (
              <ScheduleControlDashboard />
            ) : activeView === 'scenarios' ? (
              <ScenarioControlDashboard eventId={selectedEventId!} />
            ) : activeView === 'cost' ? (
              <CostControlDashboard />
            ) : activeView === 'scope_changes' ? (
              <ScopeChangeDashboard />
            ) : activeView === 'material_readiness' ? (
              <MaterialReadinessDashboard />
            ) : activeView === 'gantt' ? (
              <WorkspaceGantt />
            ) : (
              <>
                {/* Workpack Grid — upper half */}
                <div className="flex-1 min-h-0 overflow-auto border-b border-gray-300">
                  <WorkpackGrid />
                </div>
                {/* Activity Grid — lower half */}
                <div className="flex-1 min-h-0 overflow-auto">
                  <ActivityGrid />
                </div>
              </>
            )}
          </div>

          {/* Inspector Panel */}
          {showInspector && (
            <>
              {/* Inspector resize handle */}
              <div
                className="cursor-col-resize bg-gray-200 hover:bg-blue-400 active:bg-blue-500 transition-colors"
                onMouseDown={handleInspectorResize}
              />
              <div className="overflow-hidden">
                <WorkspaceDetailPane />
              </div>
            </>
          )}
        </div>

        {/* Bottom Panel */}
        {showBottomPanel && (
          <>
            {/* Bottom resize handle */}
            <div
              className="h-1 cursor-row-resize bg-gray-300 hover:bg-blue-400 active:bg-blue-500 transition-colors"
              onMouseDown={handleBottomResize}
            />
            <div style={{ height: bottomHeight }} className="overflow-hidden flex-shrink-0">
              <BottomPanel />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
