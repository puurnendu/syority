/**
 * M7.5 — Planner Workspace Store (Zustand)
 *
 * Centralized state management for the planner workspace.
 * Manages: event selection, tree state, grid data, filters, groups,
 * column layouts, undo/redo, validation, panel visibility.
 */
import { create } from 'zustand';
import type {
  TreeNode,
  WorkpackGridRow,
  ActivityGridRow,
  ValidationIssue,
} from '@/core/planner-workspace';
import type { RollupValues, HierarchyRollup } from '@/core/planner-workspace/RollupEngine';

// ── Filter & Group Types ────────────────────────────────────────────────────

export type FilterOperator =
  | 'equals' | 'not_equals' | 'contains' | 'starts_with' | 'ends_with'
  | 'greater_than' | 'less_than' | 'between'
  | 'in' | 'is_empty' | 'is_not_empty'
  | 'before' | 'after' | 'today' | 'this_week' | 'this_month'
  | 'is_true' | 'is_false';

export interface FilterCondition {
  field: string;
  operator: FilterOperator;
  value: unknown;
}

export interface FilterGroup {
  operator: 'AND' | 'OR';
  conditions: (FilterCondition | FilterGroup)[];
}

export interface GroupLevel {
  field: string;
  direction: 'asc' | 'desc';
}

export interface SortConfig {
  field: string;
  direction: 'asc' | 'desc';
}

export interface ColumnConfig {
  key: string;
  label: string;
  width: number;
  visible: boolean;
  frozen: boolean;
  /** UDF column (dynamically added) */
  isUdf?: boolean;
  udfCode?: string;
  udfType?: string;
  /** Contractor editable UDF */
  isContractorEditable?: boolean;
  /** Template-controlled (locked) */
  isLocked?: boolean;
}

export interface SavedLayout {
  id: string;
  name: string;
  columns: ColumnConfig[];
  groups: GroupLevel[];
  sort: SortConfig[];
  scope: 'personal' | 'organization' | 'predefined';
}

export interface SavedFilter {
  id: string;
  name: string;
  filter: FilterGroup;
  scope: 'personal' | 'shared' | 'quick';
}

// ── Undo/Redo ────────────────────────────────────────────────────────────────

export interface UndoEntry {
  entityType: 'activity' | 'workpack';
  entityId: string;
  field: string;
  oldValue: unknown;
  newValue: unknown;
  timestamp: number;
}

// ── View Types ───────────────────────────────────────────────────────────────

export type WorkspaceView =
  | 'hierarchy' | 'workpacks' | 'activities' | 'schedule'
  | 'relationships' | 'resources' | 'contractor_quantities'
  | 'documents' | 'qaqc' | 'certificates' | 'calendar' | 'logic';

// ── Store State ──────────────────────────────────────────────────────────────

interface WorkspaceState {
  // ── Event Context ───────────────────────────────────────────────────────
  selectedEventId: string | null;
  selectedEventName: string | null;

  // ── View ────────────────────────────────────────────────────────────────
  activeView: WorkspaceView;
  setActiveView: (view: WorkspaceView) => void;

  // ── Hierarchy Tree ──────────────────────────────────────────────────────
  treeNodes: TreeNode[];
  treeExpandedIds: Set<string>;
  selectedTreeNodeId: string | null;
  setTreeNodes: (nodes: TreeNode[]) => void;
  toggleTreeNode: (id: string) => void;
  selectTreeNode: (id: string | null) => void;

  // ── Workpack Grid ───────────────────────────────────────────────────────
  workpacks: WorkpackGridRow[];
  selectedWorkpackIds: Set<string>;
  setWorkpacks: (rows: WorkpackGridRow[]) => void;
  selectWorkpack: (id: string, multi?: boolean) => void;
  clearWorkpackSelection: () => void;

  // ── Activity Grid ───────────────────────────────────────────────────────
  activities: ActivityGridRow[];
  selectedActivityIds: Set<string>;
  setActivities: (rows: ActivityGridRow[]) => void;
  selectActivity: (id: string, multi?: boolean) => void;
  clearActivitySelection: () => void;

  // ── Inline Editing ──────────────────────────────────────────────────────
  editingCell: { entityType: 'activity' | 'workpack'; entityId: string; field: string } | null;
  setEditingCell: (cell: WorkspaceState['editingCell']) => void;
  updateCellValue: (entityType: 'activity' | 'workpack', entityId: string, field: string, value: unknown) => void;

  // ── Filter ──────────────────────────────────────────────────────────────
  activeFilter: FilterGroup | null;
  savedFilters: SavedFilter[];
  setActiveFilter: (filter: FilterGroup | null) => void;

  // ── Group & Sort ────────────────────────────────────────────────────────
  groupLevels: GroupLevel[];
  sortConfig: SortConfig[];
  showGroupTotals: boolean;
  setGroupLevels: (levels: GroupLevel[]) => void;
  setSortConfig: (config: SortConfig[]) => void;
  setShowGroupTotals: (show: boolean) => void;

  // ── Column Layout ───────────────────────────────────────────────────────
  columns: ColumnConfig[];
  frozenColumnCount: number;
  setColumns: (cols: ColumnConfig[]) => void;
  setFrozenColumnCount: (count: number) => void;
  toggleColumnVisibility: (key: string) => void;
  resizeColumn: (key: string, width: number) => void;

  // ── Layouts ─────────────────────────────────────────────────────────────
  savedLayouts: SavedLayout[];
  activeLayoutId: string | null;
  setActiveLayout: (id: string | null) => void;

  // ── Validation ──────────────────────────────────────────────────────────
  validationIssues: ValidationIssue[];
  setValidationIssues: (issues: ValidationIssue[]) => void;

  // ── Rollups ─────────────────────────────────────────────────────────────
  eventRollup: RollupValues | null;
  unitRollups: HierarchyRollup[];
  setRollups: (event: RollupValues, units: HierarchyRollup[]) => void;

  // ── Undo/Redo ───────────────────────────────────────────────────────────
  undoStack: UndoEntry[];
  redoStack: UndoEntry[];
  pushUndo: (entry: UndoEntry) => void;
  undo: () => UndoEntry | null;
  redo: () => UndoEntry | null;

  // ── Panel Visibility ────────────────────────────────────────────────────
  showInspector: boolean;
  showBottomPanel: boolean;
  showTree: boolean;
  toggleInspector: () => void;
  toggleBottomPanel: () => void;
  toggleTree: () => void;

  // ── Search ──────────────────────────────────────────────────────────────
  searchQuery: string;
  setSearchQuery: (q: string) => void;

  // ── Loading ─────────────────────────────────────────────────────────────
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;

  // ── Event Selection ─────────────────────────────────────────────────────
  setSelectedEvent: (id: string | null, name: string | null) => void;

  // ── Theme ───────────────────────────────────────────────────────────────
  theme: 'light' | 'dark' | 'system';
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
}

// ── Store Implementation ─────────────────────────────────────────────────────

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  // ── Event Context ─────────────────────────────────────────────────────────
  selectedEventId: null,
  selectedEventName: null,
  setSelectedEvent: (id, name) =>
    set({
      selectedEventId: id,
      selectedEventName: name,
      // Reset dependents when event changes
      workpacks: [],
      activities: [],
      treeNodes: [],
      selectedWorkpackIds: new Set(),
      selectedActivityIds: new Set(),
      validationIssues: [],
    }),

  // ── View ──────────────────────────────────────────────────────────────────
  activeView: 'hierarchy',
  setActiveView: (view) => set({ activeView: view }),

  // ── Hierarchy Tree ────────────────────────────────────────────────────────
  treeNodes: [],
  treeExpandedIds: new Set(),
  selectedTreeNodeId: null,
  setTreeNodes: (nodes) => set({ treeNodes: nodes }),
  toggleTreeNode: (id) =>
    set((state) => {
      const next = new Set(state.treeExpandedIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { treeExpandedIds: next };
    }),
  selectTreeNode: (id) => set({ selectedTreeNodeId: id }),

  // ── Workpack Grid ─────────────────────────────────────────────────────────
  workpacks: [],
  selectedWorkpackIds: new Set(),
  setWorkpacks: (rows) => set({ workpacks: rows }),
  selectWorkpack: (id, multi = false) =>
    set((state) => {
      if (multi) {
        const next = new Set(state.selectedWorkpackIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return { selectedWorkpackIds: next };
      }
      return { selectedWorkpackIds: new Set([id]) };
    }),
  clearWorkpackSelection: () => set({ selectedWorkpackIds: new Set() }),

  // ── Activity Grid ─────────────────────────────────────────────────────────
  activities: [],
  selectedActivityIds: new Set(),
  setActivities: (rows) => set({ activities: rows }),
  selectActivity: (id, multi = false) =>
    set((state) => {
      if (multi) {
        const next = new Set(state.selectedActivityIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return { selectedActivityIds: next };
      }
      return { selectedActivityIds: new Set([id]) };
    }),
  clearActivitySelection: () => set({ selectedActivityIds: new Set() }),

  // ── Inline Editing ────────────────────────────────────────────────────────
  editingCell: null,
  setEditingCell: (cell) => set({ editingCell: cell }),
  updateCellValue: (entityType, entityId, field, value) =>
    set((state) => {
      if (entityType === 'activity') {
        const activities = state.activities.map((a) =>
          a.id === entityId ? { ...a, [field]: value } : a
        );
        return { activities };
      } else {
        const workpacks = state.workpacks.map((w) =>
          w.id === entityId ? { ...w, [field]: value } : w
        );
        return { workpacks };
      }
    }),

  // ── Filter ────────────────────────────────────────────────────────────────
  activeFilter: null,
  savedFilters: [],
  setActiveFilter: (filter) => set({ activeFilter: filter }),

  // ── Group & Sort ──────────────────────────────────────────────────────────
  groupLevels: [],
  sortConfig: [],
  showGroupTotals: true,
  setGroupLevels: (levels) => set({ groupLevels: levels }),
  setSortConfig: (config) => set({ sortConfig: config }),
  setShowGroupTotals: (show) => set({ showGroupTotals: show }),

  // ── Column Layout ─────────────────────────────────────────────────────────
  columns: [],
  frozenColumnCount: 2,
  setColumns: (cols) => set({ columns: cols }),
  setFrozenColumnCount: (count) => set({ frozenColumnCount: count }),
  toggleColumnVisibility: (key) =>
    set((state) => ({
      columns: state.columns.map((c) =>
        c.key === key ? { ...c, visible: !c.visible } : c
      ),
    })),
  resizeColumn: (key, width) =>
    set((state) => ({
      columns: state.columns.map((c) =>
        c.key === key ? { ...c, width: Math.max(width, 40) } : c
      ),
    })),

  // ── Layouts ───────────────────────────────────────────────────────────────
  savedLayouts: [],
  activeLayoutId: null,
  setActiveLayout: (id) => set({ activeLayoutId: id }),

  // ── Validation ────────────────────────────────────────────────────────────
  validationIssues: [],
  setValidationIssues: (issues) => set({ validationIssues: issues }),

  // ── Rollups ───────────────────────────────────────────────────────────────
  eventRollup: null,
  unitRollups: [],
  setRollups: (event, units) => set({ eventRollup: event, unitRollups: units }),

  // ── Undo/Redo ─────────────────────────────────────────────────────────────
  undoStack: [],
  redoStack: [],
  pushUndo: (entry) =>
    set((state) => ({
      undoStack: [...state.undoStack.slice(-99), entry],
      redoStack: [], // Clear redo on new edit
    })),
  undo: () => {
    const state = get();
    const entry = state.undoStack[state.undoStack.length - 1];
    if (!entry) return null;
    set({
      undoStack: state.undoStack.slice(0, -1),
      redoStack: [...state.redoStack, entry],
    });
    // Caller must apply the old value
    return entry;
  },
  redo: () => {
    const state = get();
    const entry = state.redoStack[state.redoStack.length - 1];
    if (!entry) return null;
    set({
      redoStack: state.redoStack.slice(0, -1),
      undoStack: [...state.undoStack, entry],
    });
    // Caller must apply the new value
    return entry;
  },

  // ── Panel Visibility ──────────────────────────────────────────────────────
  showInspector: true,
  showBottomPanel: true,
  showTree: true,
  toggleInspector: () => set((s) => ({ showInspector: !s.showInspector })),
  toggleBottomPanel: () => set((s) => ({ showBottomPanel: !s.showBottomPanel })),
  toggleTree: () => set((s) => ({ showTree: !s.showTree })),

  // ── Search ────────────────────────────────────────────────────────────────
  searchQuery: '',
  setSearchQuery: (q) => set({ searchQuery: q }),

  // ── Loading ───────────────────────────────────────────────────────────────
  isLoading: false,
  setIsLoading: (loading) => set({ isLoading: loading }),

  // ── Theme ─────────────────────────────────────────────────────────────────
  theme: 'system',
  setTheme: (theme) => set({ theme }),
}));
