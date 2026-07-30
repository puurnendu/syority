/**
 * M7.6D — Cross-Filter Engine
 *
 * Manages widget-to-widget filtering, hierarchical drill-down,
 * and breadcrumb navigation state.
 *
 * Flow: User clicks chart segment → CrossFilterEngine → propagate filter
 *       to all linked widgets → WidgetDataService refetches with new params.
 *
 * Drill-down hierarchy:
 *   Company → Site → Unit → Area → System → Equipment →
 *   Workpack → Activity → Certificate → Drawing → Issue → Photos
 */

// ─── Drill-down Hierarchy ───────────────────────────────────────────────────

export const DRILLDOWN_LEVELS = [
  'company', 'site', 'unit', 'area', 'system', 'equipment',
  'workpack', 'activity', 'certificate', 'drawing', 'issue', 'photos',
] as const;

export type DrilldownLevel = typeof DRILLDOWN_LEVELS[number];

export interface DrilldownBreadcrumb {
  level: DrilldownLevel;
  entityId: string;
  label: string;
}

// ─── Cross-Filter Types ─────────────────────────────────────────────────────

export interface CrossFilterLink {
  /** Source widget ID (the one that was clicked) */
  sourceWidgetId: string;
  /** Target widget IDs to filter */
  targetWidgetIds: string[];
  /** Field to filter on */
  filterField: string;
  /** Type of interaction */
  interactionType: 'filter' | 'highlight';
}

export interface ActiveFilter {
  sourceWidgetId: string;
  field: string;
  value: any;
  operator: 'eq' | 'in' | 'gt' | 'lt' | 'gte' | 'lte' | 'contains';
}

export interface CrossFilterState {
  activeFilters: ActiveFilter[];
  drilldownPath: DrilldownBreadcrumb[];
  currentLevel: DrilldownLevel;
}

// ─── Engine ─────────────────────────────────────────────────────────────────

export class CrossFilterEngine {
  private links: Map<string, CrossFilterLink[]> = new Map();
  private activeFilters: ActiveFilter[] = [];
  private drilldownPath: DrilldownBreadcrumb[] = [];
  private listeners: Set<(state: CrossFilterState) => void> = new Set();

  // ── Subscriptions ───────────────────────────────────────────────────────

  subscribe(fn: (state: CrossFilterState) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private notify() {
    const state = this.getState();
    this.listeners.forEach((fn) => fn(state));
  }

  getState(): CrossFilterState {
    return {
      activeFilters: [...this.activeFilters],
      drilldownPath: [...this.drilldownPath],
      currentLevel: this.getCurrentLevel(),
    };
  }

  // ── Link Management ─────────────────────────────────────────────────────

  registerLink(link: CrossFilterLink) {
    const existing = this.links.get(link.sourceWidgetId) ?? [];
    existing.push(link);
    this.links.set(link.sourceWidgetId, existing);
  }

  removeLink(sourceWidgetId: string, filterField?: string) {
    if (filterField) {
      const existing = this.links.get(sourceWidgetId) ?? [];
      this.links.set(sourceWidgetId, existing.filter((l) => l.filterField !== filterField));
    } else {
      this.links.delete(sourceWidgetId);
    }
  }

  removeWidgetLinks(widgetId: string) {
    this.links.delete(widgetId);
    // Also remove as target
    this.links.forEach((links, key) => {
      this.links.set(key, links.map((l) => ({
        ...l,
        targetWidgetIds: l.targetWidgetIds.filter((t) => t !== widgetId),
      })));
    });
  }

  clearAllLinks() {
    this.links.clear();
  }

  getLinksForWidget(widgetId: string): CrossFilterLink[] {
    return this.links.get(widgetId) ?? [];
  }

  // ── Filter Application ──────────────────────────────────────────────────

  /**
   * Apply a cross-filter from a source widget.
   * Returns the set of widget IDs that should be refetched.
   */
  applyFilter(filter: ActiveFilter): string[] {
    // Remove any existing filter from this source + field
    this.activeFilters = this.activeFilters.filter(
      (f) => !(f.sourceWidgetId === filter.sourceWidgetId && f.field === filter.field)
    );
    this.activeFilters.push(filter);

    // Find affected widgets
    const links = this.links.get(filter.sourceWidgetId) ?? [];
    const affectedIds = new Set<string>();
    for (const link of links) {
      if (link.filterField === filter.field || link.filterField === '*') {
        link.targetWidgetIds.forEach((id) => affectedIds.add(id));
      }
    }

    this.notify();
    return Array.from(affectedIds);
  }

  /**
   * Remove all filters from a source widget.
   */
  clearFilter(sourceWidgetId: string): string[] {
    const links = this.links.get(sourceWidgetId) ?? [];
    const affectedIds = new Set<string>();
    links.forEach((link) => link.targetWidgetIds.forEach((id) => affectedIds.add(id)));

    this.activeFilters = this.activeFilters.filter((f) => f.sourceWidgetId !== sourceWidgetId);

    this.notify();
    return Array.from(affectedIds);
  }

  clearAllFilters() {
    this.activeFilters = [];
    this.notify();
  }

  /**
   * Get merged filter params for a target widget.
   * Merges all active filters that target this widget.
   */
  getFiltersForWidget(widgetId: string): Record<string, any> {
    const params: Record<string, any> = {};

    for (const filter of this.activeFilters) {
      const links = this.links.get(filter.sourceWidgetId) ?? [];
      for (const link of links) {
        if (link.targetWidgetIds.includes(widgetId)) {
          params[filter.field] = filter.value;
        }
      }
    }

    // Add drilldown context
    for (const crumb of this.drilldownPath) {
      params[crumb.level] = crumb.entityId;
    }

    return params;
  }

  // ── Drill-down ──────────────────────────────────────────────────────────

  getCurrentLevel(): DrilldownLevel {
    if (this.drilldownPath.length === 0) return 'company';
    const last = this.drilldownPath[this.drilldownPath.length - 1];
    const idx = DRILLDOWN_LEVELS.indexOf(last.level);
    return DRILLDOWN_LEVELS[Math.min(idx + 1, DRILLDOWN_LEVELS.length - 1)];
  }

  drillDown(level: DrilldownLevel, entityId: string, label: string): string[] {
    this.drilldownPath.push({ level, entityId, label });
    this.notify();
    return this.getAllLinkedWidgetIds();
  }

  drillUp(): string[] {
    this.drilldownPath.pop();
    this.notify();
    return this.getAllLinkedWidgetIds();
  }

  navigateTo(levelIndex: number): string[] {
    this.drilldownPath = this.drilldownPath.slice(0, levelIndex + 1);
    this.notify();
    return this.getAllLinkedWidgetIds();
  }

  resetDrilldown(): string[] {
    this.drilldownPath = [];
    this.notify();
    return this.getAllLinkedWidgetIds();
  }

  getDrilldownPath(): DrilldownBreadcrumb[] {
    return [...this.drilldownPath];
  }

  getDrilldownParams(): Record<string, string> {
    const params: Record<string, string> = {};
    for (const crumb of this.drilldownPath) {
      params[crumb.level] = crumb.entityId;
    }
    return params;
  }

  // ── Helpers ─────────────────────────────────────────────────────────────

  private getAllLinkedWidgetIds(): string[] {
    const ids = new Set<string>();
    this.links.forEach((links) => {
      links.forEach((l) => {
        ids.add(l.sourceWidgetId);
        l.targetWidgetIds.forEach((id) => ids.add(id));
      });
    });
    return Array.from(ids);
  }

  destroy() {
    this.listeners.clear();
    this.links.clear();
    this.activeFilters = [];
    this.drilldownPath = [];
  }
}
