/**
 * M7.6D — Dashboard Variable Service
 *
 * Dashboard-level variables that automatically propagate to every widget.
 * Supports cascading hierarchy filters and formula references.
 *
 * Variables are resolved at render time — widgets receive merged params
 * (their own providerParams + active dashboard variables).
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export type VariableType =
  | 'event'
  | 'site'
  | 'unit'
  | 'area'
  | 'system'
  | 'equipment'
  | 'contractor'
  | 'discipline'
  | 'planner'
  | 'user'
  | 'shift'
  | 'date'
  | 'week'
  | 'month'
  | 'date_range'
  | 'text'
  | 'number'
  | 'boolean'
  | 'custom';

export interface DashboardVariable {
  /** Variable key (used in formulas and param binding) */
  key: string;
  /** Display label */
  label: string;
  /** Variable type — determines UI control */
  type: VariableType;
  /** Current value */
  value: any;
  /** Default value */
  defaultValue: any;
  /** Whether this variable is visible in the variable bar */
  isVisible: boolean;
  /** Whether this variable auto-cascades child variables */
  cascadeChildren: string[];
  /** Data source for dropdown options (provider key or static list) */
  optionsSource?: string;
  /** Static options (if not using a provider) */
  staticOptions?: Array<{ label: string; value: any }>;
  /** Parameter key to inject into widget params */
  paramKey: string;
  /** Sort order in the variable bar */
  sortOrder: number;
}

export interface VariableChangeEvent {
  key: string;
  oldValue: any;
  newValue: any;
  cascadedChanges: Array<{ key: string; value: any }>;
}

// ─── Preset Variables ───────────────────────────────────────────────────────

/** Factory for the standard variable set */
export function createDefaultVariables(): DashboardVariable[] {
  return [
    { key: 'event', label: 'Current Event', type: 'event', value: null, defaultValue: null, isVisible: true, cascadeChildren: ['site', 'unit', 'area', 'system'], paramKey: 'event', sortOrder: 1 },
    { key: 'site', label: 'Current Site', type: 'site', value: null, defaultValue: null, isVisible: true, cascadeChildren: ['unit', 'area'], paramKey: 'site', sortOrder: 2 },
    { key: 'unit', label: 'Current Unit', type: 'unit', value: null, defaultValue: null, isVisible: true, cascadeChildren: ['area', 'system'], paramKey: 'unit', sortOrder: 3 },
    { key: 'area', label: 'Current Area', type: 'area', value: null, defaultValue: null, isVisible: true, cascadeChildren: ['system', 'equipment'], paramKey: 'area', sortOrder: 4 },
    { key: 'system', label: 'Current System', type: 'system', value: null, defaultValue: null, isVisible: true, cascadeChildren: ['equipment'], paramKey: 'system', sortOrder: 5 },
    { key: 'equipment', label: 'Current Equipment', type: 'equipment', value: null, defaultValue: null, isVisible: true, cascadeChildren: [], paramKey: 'equipment', sortOrder: 6 },
    { key: 'contractor', label: 'Current Contractor', type: 'contractor', value: null, defaultValue: null, isVisible: true, cascadeChildren: [], paramKey: 'contractor', sortOrder: 7 },
    { key: 'discipline', label: 'Current Discipline', type: 'discipline', value: null, defaultValue: null, isVisible: true, cascadeChildren: [], paramKey: 'discipline', sortOrder: 8 },
    { key: 'planner', label: 'Current Planner', type: 'planner', value: null, defaultValue: null, isVisible: false, cascadeChildren: [], paramKey: 'planner', sortOrder: 9 },
    { key: 'shift', label: 'Current Shift', type: 'shift', value: null, defaultValue: null, isVisible: true, cascadeChildren: [], paramKey: 'shift', sortOrder: 10, staticOptions: [{ label: 'Day', value: 'day' }, { label: 'Night', value: 'night' }, { label: 'All', value: null }] },
    { key: 'date', label: 'Current Date', type: 'date', value: null, defaultValue: null, isVisible: true, cascadeChildren: [], paramKey: 'date', sortOrder: 11 },
    { key: 'dateRange', label: 'Date Range', type: 'date_range', value: null, defaultValue: null, isVisible: false, cascadeChildren: [], paramKey: 'dateRange', sortOrder: 12 },
    { key: 'week', label: 'Current Week', type: 'week', value: null, defaultValue: null, isVisible: false, cascadeChildren: [], paramKey: 'week', sortOrder: 13 },
    { key: 'month', label: 'Current Month', type: 'month', value: null, defaultValue: null, isVisible: false, cascadeChildren: [], paramKey: 'month', sortOrder: 14 },
  ];
}

// ─── Computed Variables (not user-selectable) ───────────────────────────────

export function computeTimeVariables(): Record<string, any> {
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 3600_000);
  const tomorrow = new Date(now.getTime() + 24 * 3600_000);
  const in72h = new Date(now.getTime() + 72 * 3600_000);
  const ago72h = new Date(now.getTime() - 72 * 3600_000);
  const dayOfWeek = now.getDay();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - dayOfWeek);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  return {
    currentDate: now.toISOString().slice(0, 10),
    previousDay: yesterday.toISOString().slice(0, 10),
    nextDay: tomorrow.toISOString().slice(0, 10),
    last24h: { from: yesterday.toISOString(), to: now.toISOString() },
    last72h: { from: ago72h.toISOString(), to: now.toISOString() },
    next24h: { from: now.toISOString(), to: tomorrow.toISOString() },
    next72h: { from: now.toISOString(), to: in72h.toISOString() },
    currentWeek: startOfWeek.toISOString().slice(0, 10),
    currentMonth: startOfMonth.toISOString().slice(0, 10),
  };
}

// ─── Service ────────────────────────────────────────────────────────────────

export class DashboardVariableService {
  private variables: Map<string, DashboardVariable> = new Map();
  private listeners: Set<(event: VariableChangeEvent) => void> = new Set();

  constructor(initialVariables?: DashboardVariable[]) {
    const vars = initialVariables ?? createDefaultVariables();
    vars.forEach((v) => this.variables.set(v.key, { ...v }));
  }

  // ── Subscriptions ───────────────────────────────────────────────────────

  subscribe(fn: (event: VariableChangeEvent) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private notify(event: VariableChangeEvent) {
    this.listeners.forEach((fn) => fn(event));
  }

  // ── Get / Set ───────────────────────────────────────────────────────────

  get(key: string): any {
    return this.variables.get(key)?.value ?? null;
  }

  getVariable(key: string): DashboardVariable | undefined {
    return this.variables.get(key);
  }

  getAll(): DashboardVariable[] {
    return Array.from(this.variables.values()).sort((a, b) => a.sortOrder - b.sortOrder);
  }

  getVisibleVariables(): DashboardVariable[] {
    return this.getAll().filter((v) => v.isVisible);
  }

  /**
   * Set a variable value with cascading.
   * Returns the set of changed keys.
   */
  set(key: string, value: any): string[] {
    const variable = this.variables.get(key);
    if (!variable) return [];

    const oldValue = variable.value;
    if (oldValue === value) return [];

    variable.value = value;
    const cascadedChanges: Array<{ key: string; value: any }> = [];

    // Cascade: reset children
    if (variable.cascadeChildren.length > 0) {
      for (const childKey of variable.cascadeChildren) {
        const child = this.variables.get(childKey);
        if (child && child.value !== null) {
          cascadedChanges.push({ key: childKey, value: null });
          child.value = null;
        }
      }
    }

    this.notify({ key, oldValue, newValue: value, cascadedChanges });
    return [key, ...cascadedChanges.map((c) => c.key)];
  }

  /**
   * Batch set multiple variables (e.g. restoring from URL or saved state).
   */
  batchSet(values: Record<string, any>) {
    for (const [key, value] of Object.entries(values)) {
      const variable = this.variables.get(key);
      if (variable) variable.value = value;
    }
  }

  reset() {
    this.variables.forEach((v) => { v.value = v.defaultValue; });
  }

  // ── Param Resolution ────────────────────────────────────────────────────

  /**
   * Resolve all active variables into a provider params object.
   * This is merged with each widget's own providerParams.
   */
  resolveParams(): Record<string, any> {
    const params: Record<string, any> = {};
    for (const v of this.variables.values()) {
      if (v.value !== null && v.value !== undefined && v.value !== '') {
        params[v.paramKey] = v.value;
      }
    }
    // Add computed time variables
    const timeVars = computeTimeVariables();
    Object.assign(params, timeVars);
    return params;
  }

  /**
   * Merge dashboard variables with widget-specific params.
   * Widget params take precedence over dashboard variables.
   */
  mergeWithWidgetParams(widgetParams: Record<string, any>): Record<string, any> {
    const dashboardParams = this.resolveParams();
    return { ...dashboardParams, ...widgetParams };
  }

  // ── Serialization ───────────────────────────────────────────────────────

  serialize(): Record<string, any> {
    const state: Record<string, any> = {};
    this.variables.forEach((v) => {
      if (v.value !== null && v.value !== v.defaultValue) {
        state[v.key] = v.value;
      }
    });
    return state;
  }

  restore(state: Record<string, any>) {
    this.batchSet(state);
  }

  // ── Variable Configuration ──────────────────────────────────────────────

  addVariable(variable: DashboardVariable) {
    this.variables.set(variable.key, { ...variable });
  }

  removeVariable(key: string) {
    this.variables.delete(key);
  }

  updateVariable(key: string, patch: Partial<DashboardVariable>) {
    const existing = this.variables.get(key);
    if (existing) {
      this.variables.set(key, { ...existing, ...patch });
    }
  }

  destroy() {
    this.listeners.clear();
  }
}
