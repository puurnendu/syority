/**
 * M7.6D — Designer State Manager
 *
 * Client-side state engine for the OIS Dashboard Designer.
 * Implements: Undo/Redo, Multi-select, Copy/Paste, Autosave,
 * Snap Grid, Z-ordering, Group/Ungroup, Keyboard Shortcuts.
 *
 * This is a pure state manager — no React, no DOM, no Prisma.
 * The React components consume this via hooks.
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export interface WidgetLayout {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
  maxW?: number;
  maxH?: number;
  /** Z-index for layering */
  zIndex: number;
  /** Lock prevents drag/resize */
  isLocked: boolean;
  /** Visibility toggle */
  isVisible: boolean;
  /** Group membership */
  groupId: string | null;
  /** Widget definition slug (for palette reference) */
  widgetDefinitionSlug: string;
  /** Widget DB ID (for persistence) */
  widgetInstanceId: string;
  /** Page ID */
  pageId: string;
}

export interface DashboardPage {
  id: string;
  title: string;
  pageNumber: number;
  icon?: string;
}

export interface WidgetGroup {
  id: string;
  label: string;
  memberIds: string[];
}

export interface DesignerCommand {
  type: string;
  payload: any;
  timestamp: number;
}

export type ResponsiveBreakpoint = 'desktop' | 'tablet' | 'mobile' | 'tv' | 'print';

export interface DesignerSnapshot {
  layouts: WidgetLayout[];
  pages: DashboardPage[];
  groups: WidgetGroup[];
  variables: Record<string, any>;
}

export interface DesignerConfig {
  gridColumns: number;
  gridRowHeight: number;
  snapToGrid: boolean;
  showGrid: boolean;
  compactType: 'vertical' | 'horizontal' | null;
  margin: [number, number];
  containerPadding: [number, number];
  maxUndoStack: number;
  autosaveIntervalMs: number;
}

// ─── Default Config ─────────────────────────────────────────────────────────

const DEFAULT_CONFIG: DesignerConfig = {
  gridColumns: 12,
  gridRowHeight: 80,
  snapToGrid: true,
  showGrid: true,
  compactType: 'vertical',
  margin: [16, 16],
  containerPadding: [16, 16],
  maxUndoStack: 50,
  autosaveIntervalMs: 5000,
};

// ─── State Manager ──────────────────────────────────────────────────────────

export class DesignerStateManager {
  // ── State ───────────────────────────────────────────────────────────────
  private layouts: Map<string, WidgetLayout> = new Map();
  private pages: DashboardPage[] = [];
  private groups: Map<string, WidgetGroup> = new Map();
  private selectedIds: Set<string> = new Set();
  private clipboard: WidgetLayout[] = [];
  private undoStack: DesignerSnapshot[] = [];
  private redoStack: DesignerSnapshot[] = [];
  private config: DesignerConfig;
  private activePage: string = '';
  private activeBreakpoint: ResponsiveBreakpoint = 'desktop';
  private isDirty: boolean = false;
  private autosaveTimer: ReturnType<typeof setInterval> | null = null;
  private nextZIndex: number = 1;
  private listeners: Set<() => void> = new Set();

  constructor(config?: Partial<DesignerConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ── Subscriptions ───────────────────────────────────────────────────────

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private notify() {
    this.listeners.forEach((fn) => fn());
  }

  // ── Initialization ──────────────────────────────────────────────────────

  initialize(data: {
    layouts: WidgetLayout[];
    pages: DashboardPage[];
    groups?: WidgetGroup[];
  }) {
    this.layouts.clear();
    this.groups.clear();
    this.pages = [...data.pages];
    data.layouts.forEach((l) => this.layouts.set(l.id, { ...l }));
    (data.groups ?? []).forEach((g) => this.groups.set(g.id, { ...g }));
    this.activePage = this.pages[0]?.id ?? '';
    this.nextZIndex = Math.max(0, ...data.layouts.map((l) => l.zIndex)) + 1;
    this.isDirty = false;
    this.undoStack = [];
    this.redoStack = [];
    this.notify();
  }

  // ── Snapshot (for undo/redo) ────────────────────────────────────────────

  private snapshot(): DesignerSnapshot {
    return {
      layouts: Array.from(this.layouts.values()).map((l) => ({ ...l })),
      pages: this.pages.map((p) => ({ ...p })),
      groups: Array.from(this.groups.values()).map((g) => ({ ...g, memberIds: [...g.memberIds] })),
      variables: {},
    };
  }

  private pushUndo() {
    this.undoStack.push(this.snapshot());
    if (this.undoStack.length > this.config.maxUndoStack) {
      this.undoStack.shift();
    }
    this.redoStack = [];
    this.isDirty = true;
  }

  private restoreSnapshot(snap: DesignerSnapshot) {
    this.layouts.clear();
    snap.layouts.forEach((l) => this.layouts.set(l.id, { ...l }));
    this.pages = snap.pages.map((p) => ({ ...p }));
    this.groups.clear();
    snap.groups.forEach((g) => this.groups.set(g.id, { ...g, memberIds: [...g.memberIds] }));
    this.nextZIndex = Math.max(0, ...snap.layouts.map((l) => l.zIndex)) + 1;
    this.isDirty = true;
    this.notify();
  }

  // ── Undo / Redo ─────────────────────────────────────────────────────────

  undo() {
    if (this.undoStack.length === 0) return;
    this.redoStack.push(this.snapshot());
    const prev = this.undoStack.pop()!;
    this.restoreSnapshot(prev);
  }

  redo() {
    if (this.redoStack.length === 0) return;
    this.undoStack.push(this.snapshot());
    const next = this.redoStack.pop()!;
    this.restoreSnapshot(next);
  }

  get canUndo(): boolean { return this.undoStack.length > 0; }
  get canRedo(): boolean { return this.redoStack.length > 0; }

  // ── Selection ───────────────────────────────────────────────────────────

  select(id: string, multi = false) {
    if (!multi) this.selectedIds.clear();
    this.selectedIds.add(id);
    // If selecting a group member, select the whole group
    const layout = this.layouts.get(id);
    if (layout?.groupId) {
      const group = this.groups.get(layout.groupId);
      group?.memberIds.forEach((mid) => this.selectedIds.add(mid));
    }
    this.notify();
  }

  deselect(id: string) {
    this.selectedIds.delete(id);
    this.notify();
  }

  selectAll() {
    const pageLayouts = this.getPageLayouts();
    pageLayouts.forEach((l) => this.selectedIds.add(l.id));
    this.notify();
  }

  clearSelection() {
    this.selectedIds.clear();
    this.notify();
  }

  get selection(): string[] { return Array.from(this.selectedIds); }
  get selectionCount(): number { return this.selectedIds.size; }

  isSelected(id: string): boolean { return this.selectedIds.has(id); }

  // ── Widget Operations ───────────────────────────────────────────────────

  addWidget(layout: Omit<WidgetLayout, 'zIndex' | 'isLocked' | 'isVisible' | 'groupId'>): WidgetLayout {
    this.pushUndo();
    const full: WidgetLayout = {
      ...layout,
      zIndex: this.nextZIndex++,
      isLocked: false,
      isVisible: true,
      groupId: null,
    };
    this.layouts.set(full.id, full);
    this.isDirty = true;
    this.notify();
    return full;
  }

  removeWidgets(ids: string[]) {
    if (ids.length === 0) return;
    this.pushUndo();
    ids.forEach((id) => {
      this.layouts.delete(id);
      this.selectedIds.delete(id);
    });
    // Clean up groups
    this.groups.forEach((g) => {
      g.memberIds = g.memberIds.filter((mid) => !ids.includes(mid));
      if (g.memberIds.length < 2) this.groups.delete(g.id);
    });
    this.isDirty = true;
    this.notify();
  }

  deleteSelected() {
    this.removeWidgets(this.selection);
  }

  updateLayout(id: string, patch: Partial<WidgetLayout>) {
    const existing = this.layouts.get(id);
    if (!existing || existing.isLocked) return;
    this.pushUndo();
    this.layouts.set(id, { ...existing, ...patch });
    this.isDirty = true;
    this.notify();
  }

  batchUpdateLayouts(updates: Array<{ id: string; x: number; y: number; w: number; h: number }>) {
    this.pushUndo();
    for (const u of updates) {
      const existing = this.layouts.get(u.id);
      if (existing && !existing.isLocked) {
        this.layouts.set(u.id, { ...existing, x: u.x, y: u.y, w: u.w, h: u.h });
      }
    }
    this.isDirty = true;
    this.notify();
  }

  // ── Copy / Paste / Duplicate ────────────────────────────────────────────

  copy() {
    this.clipboard = this.selection
      .map((id) => this.layouts.get(id))
      .filter(Boolean) as WidgetLayout[];
  }

  paste() {
    if (this.clipboard.length === 0) return;
    this.pushUndo();
    const newIds: string[] = [];
    for (const src of this.clipboard) {
      const id = `w_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const cloned: WidgetLayout = {
        ...src,
        id,
        x: src.x + 1,
        y: src.y + 1,
        zIndex: this.nextZIndex++,
        groupId: null,
        widgetInstanceId: '', // needs DB creation
        pageId: this.activePage,
      };
      this.layouts.set(id, cloned);
      newIds.push(id);
    }
    this.selectedIds.clear();
    newIds.forEach((id) => this.selectedIds.add(id));
    this.isDirty = true;
    this.notify();
  }

  duplicate() {
    this.copy();
    this.paste();
  }

  // ── Lock / Unlock ───────────────────────────────────────────────────────

  lockSelected() {
    this.pushUndo();
    for (const id of this.selectedIds) {
      const l = this.layouts.get(id);
      if (l) this.layouts.set(id, { ...l, isLocked: true });
    }
    this.notify();
  }

  unlockSelected() {
    this.pushUndo();
    for (const id of this.selectedIds) {
      const l = this.layouts.get(id);
      if (l) this.layouts.set(id, { ...l, isLocked: false });
    }
    this.notify();
  }

  // ── Z-Order ─────────────────────────────────────────────────────────────

  bringForward(id: string) {
    this.pushUndo();
    const l = this.layouts.get(id);
    if (l) this.layouts.set(id, { ...l, zIndex: this.nextZIndex++ });
    this.notify();
  }

  sendBackward(id: string) {
    this.pushUndo();
    const l = this.layouts.get(id);
    if (l) this.layouts.set(id, { ...l, zIndex: Math.max(0, l.zIndex - 1) });
    this.notify();
  }

  bringToFront(id: string) {
    this.bringForward(id);
  }

  sendToBack(id: string) {
    this.pushUndo();
    const l = this.layouts.get(id);
    if (l) this.layouts.set(id, { ...l, zIndex: 0 });
    this.notify();
  }

  // ── Grouping ────────────────────────────────────────────────────────────

  groupSelected(label?: string) {
    if (this.selectedIds.size < 2) return;
    this.pushUndo();
    const groupId = `grp_${Date.now()}`;
    const memberIds = [...this.selectedIds];
    this.groups.set(groupId, { id: groupId, label: label ?? 'Group', memberIds });
    for (const mid of memberIds) {
      const l = this.layouts.get(mid);
      if (l) this.layouts.set(mid, { ...l, groupId });
    }
    this.isDirty = true;
    this.notify();
  }

  ungroupSelected() {
    this.pushUndo();
    const groupIds = new Set<string>();
    for (const id of this.selectedIds) {
      const l = this.layouts.get(id);
      if (l?.groupId) groupIds.add(l.groupId);
    }
    for (const gid of groupIds) {
      const group = this.groups.get(gid);
      if (group) {
        group.memberIds.forEach((mid) => {
          const l = this.layouts.get(mid);
          if (l) this.layouts.set(mid, { ...l, groupId: null });
        });
        this.groups.delete(gid);
      }
    }
    this.isDirty = true;
    this.notify();
  }

  // ── Alignment ───────────────────────────────────────────────────────────

  alignSelected(direction: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') {
    const sel = this.selection.map((id) => this.layouts.get(id)).filter(Boolean) as WidgetLayout[];
    if (sel.length < 2) return;
    this.pushUndo();

    switch (direction) {
      case 'left': {
        const minX = Math.min(...sel.map((l) => l.x));
        sel.forEach((l) => this.layouts.set(l.id, { ...l, x: minX }));
        break;
      }
      case 'right': {
        const maxRight = Math.max(...sel.map((l) => l.x + l.w));
        sel.forEach((l) => this.layouts.set(l.id, { ...l, x: maxRight - l.w }));
        break;
      }
      case 'center': {
        const minX = Math.min(...sel.map((l) => l.x));
        const maxRight = Math.max(...sel.map((l) => l.x + l.w));
        const centerX = (minX + maxRight) / 2;
        sel.forEach((l) => this.layouts.set(l.id, { ...l, x: Math.round(centerX - l.w / 2) }));
        break;
      }
      case 'top': {
        const minY = Math.min(...sel.map((l) => l.y));
        sel.forEach((l) => this.layouts.set(l.id, { ...l, y: minY }));
        break;
      }
      case 'bottom': {
        const maxBottom = Math.max(...sel.map((l) => l.y + l.h));
        sel.forEach((l) => this.layouts.set(l.id, { ...l, y: maxBottom - l.h }));
        break;
      }
      case 'middle': {
        const minY = Math.min(...sel.map((l) => l.y));
        const maxBottom = Math.max(...sel.map((l) => l.y + l.h));
        const centerY = (minY + maxBottom) / 2;
        sel.forEach((l) => this.layouts.set(l.id, { ...l, y: Math.round(centerY - l.h / 2) }));
        break;
      }
    }
    this.isDirty = true;
    this.notify();
  }

  distributeSelected(direction: 'horizontal' | 'vertical') {
    const sel = this.selection.map((id) => this.layouts.get(id)).filter(Boolean) as WidgetLayout[];
    if (sel.length < 3) return;
    this.pushUndo();

    if (direction === 'horizontal') {
      const sorted = [...sel].sort((a, b) => a.x - b.x);
      const minX = sorted[0].x;
      const maxX = sorted[sorted.length - 1].x;
      const step = (maxX - minX) / (sorted.length - 1);
      sorted.forEach((l, i) => this.layouts.set(l.id, { ...l, x: Math.round(minX + i * step) }));
    } else {
      const sorted = [...sel].sort((a, b) => a.y - b.y);
      const minY = sorted[0].y;
      const maxY = sorted[sorted.length - 1].y;
      const step = (maxY - minY) / (sorted.length - 1);
      sorted.forEach((l, i) => this.layouts.set(l.id, { ...l, y: Math.round(minY + i * step) }));
    }
    this.isDirty = true;
    this.notify();
  }

  // ── Pages ───────────────────────────────────────────────────────────────

  addPage(title: string): DashboardPage {
    this.pushUndo();
    const page: DashboardPage = {
      id: `page_${Date.now()}`,
      title,
      pageNumber: this.pages.length + 1,
    };
    this.pages.push(page);
    this.isDirty = true;
    this.notify();
    return page;
  }

  removePage(pageId: string) {
    if (this.pages.length <= 1) return; // Must have at least 1 page
    this.pushUndo();
    this.pages = this.pages.filter((p) => p.id !== pageId);
    // Remove widgets on that page
    this.layouts.forEach((l, id) => {
      if (l.pageId === pageId) this.layouts.delete(id);
    });
    if (this.activePage === pageId) this.activePage = this.pages[0]?.id ?? '';
    this.isDirty = true;
    this.notify();
  }

  renamePage(pageId: string, title: string) {
    this.pushUndo();
    this.pages = this.pages.map((p) => p.id === pageId ? { ...p, title } : p);
    this.isDirty = true;
    this.notify();
  }

  reorderPages(orderedIds: string[]) {
    this.pushUndo();
    const map = new Map(this.pages.map((p) => [p.id, p]));
    this.pages = orderedIds.map((id, i) => ({ ...map.get(id)!, pageNumber: i + 1 }));
    this.isDirty = true;
    this.notify();
  }

  setActivePage(pageId: string) {
    this.activePage = pageId;
    this.selectedIds.clear();
    this.notify();
  }

  getActivePage(): string { return this.activePage; }
  getPages(): DashboardPage[] { return [...this.pages]; }

  // ── Responsive Breakpoints ──────────────────────────────────────────────

  setBreakpoint(bp: ResponsiveBreakpoint) {
    this.activeBreakpoint = bp;
    this.notify();
  }

  getBreakpoint(): ResponsiveBreakpoint { return this.activeBreakpoint; }

  getBreakpointColumns(): number {
    switch (this.activeBreakpoint) {
      case 'mobile': return 4;
      case 'tablet': return 8;
      case 'tv': return 16;
      case 'print': return 12;
      default: return this.config.gridColumns;
    }
  }

  // ── Grid Config ─────────────────────────────────────────────────────────

  toggleGrid() { this.config.showGrid = !this.config.showGrid; this.notify(); }
  toggleSnap() { this.config.snapToGrid = !this.config.snapToGrid; this.notify(); }
  getConfig(): Readonly<DesignerConfig> { return this.config; }
  updateConfig(patch: Partial<DesignerConfig>) { this.config = { ...this.config, ...patch }; this.notify(); }

  // ── Queries ─────────────────────────────────────────────────────────────

  getLayout(id: string): WidgetLayout | undefined { return this.layouts.get(id); }

  getAllLayouts(): WidgetLayout[] { return Array.from(this.layouts.values()); }

  getPageLayouts(pageId?: string): WidgetLayout[] {
    const pid = pageId ?? this.activePage;
    return Array.from(this.layouts.values())
      .filter((l) => l.pageId === pid)
      .sort((a, b) => a.zIndex - b.zIndex);
  }

  getGroups(): WidgetGroup[] { return Array.from(this.groups.values()); }

  // ── Dirty / Autosave ────────────────────────────────────────────────────

  get dirty(): boolean { return this.isDirty; }

  markClean() { this.isDirty = false; }

  startAutosave(saveFn: () => Promise<void>) {
    this.stopAutosave();
    this.autosaveTimer = setInterval(async () => {
      if (this.isDirty) {
        await saveFn();
        this.isDirty = false;
      }
    }, this.config.autosaveIntervalMs);
  }

  stopAutosave() {
    if (this.autosaveTimer) {
      clearInterval(this.autosaveTimer);
      this.autosaveTimer = null;
    }
  }

  // ── Serialization ───────────────────────────────────────────────────────

  serialize(): DesignerSnapshot { return this.snapshot(); }

  toLayoutUpdates(): Array<{ id: string; gridX: number; gridY: number; gridW: number; gridH: number }> {
    return Array.from(this.layouts.values()).map((l) => ({
      id: l.widgetInstanceId || l.id,
      gridX: l.x,
      gridY: l.y,
      gridW: l.w,
      gridH: l.h,
    }));
  }

  destroy() {
    this.stopAutosave();
    this.listeners.clear();
  }
}

// ─── Keyboard Shortcut Map ──────────────────────────────────────────────────

export const DESIGNER_SHORTCUTS: Record<string, { key: string; ctrl?: boolean; shift?: boolean; description: string }> = {
  undo:          { key: 'z', ctrl: true, description: 'Undo' },
  redo:          { key: 'y', ctrl: true, description: 'Redo' },
  redoAlt:       { key: 'z', ctrl: true, shift: true, description: 'Redo (Alt)' },
  copy:          { key: 'c', ctrl: true, description: 'Copy' },
  paste:         { key: 'v', ctrl: true, description: 'Paste' },
  duplicate:     { key: 'd', ctrl: true, description: 'Duplicate' },
  delete:        { key: 'Delete', description: 'Delete selected' },
  deleteAlt:     { key: 'Backspace', description: 'Delete selected (Alt)' },
  selectAll:     { key: 'a', ctrl: true, description: 'Select all' },
  escape:        { key: 'Escape', description: 'Deselect all' },
  group:         { key: 'g', ctrl: true, description: 'Group selected' },
  ungroup:       { key: 'g', ctrl: true, shift: true, description: 'Ungroup selected' },
  lock:          { key: 'l', ctrl: true, description: 'Lock selected' },
  bringForward:  { key: ']', ctrl: true, description: 'Bring forward' },
  sendBackward:  { key: '[', ctrl: true, description: 'Send backward' },
  save:          { key: 's', ctrl: true, description: 'Save' },
  toggleGrid:    { key: "'", ctrl: true, description: 'Toggle grid' },
};
