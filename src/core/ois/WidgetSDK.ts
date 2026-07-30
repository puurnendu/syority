/**
 * M7.6C/D — Widget SDK
 *
 * Defines the Widget metadata interface, visualization types,
 * and the widget definition registry.
 * Every widget is described by its WidgetMeta — the contract between
 * the Widget Framework and the Visualization Engine.
 *
 * M7.6D additions: composite type, DrilldownLevel, DashboardVariable,
 * CrossFilterConfig, CompositeWidgetSlot.
 */

// ─── Visualization Types ────────────────────────────────────────────────────

export type VisualizationType =
  | 'line'
  | 'area'
  | 'bar'
  | 'stacked_bar'
  | 'pie'
  | 'donut'
  | 'gauge'
  | 'matrix'
  | 'heatmap'
  | 'timeline'
  | 'kpi_card'
  | 'progress_card'
  | 'status_card'
  | 'data_table'
  | 'hierarchy_table'
  | 'pivot_table'
  | 'tree_grid'
  | 'scurve'
  | 'evm'
  | 'gantt_summary'
  | 'composite';

// ─── Widget Categories ──────────────────────────────────────────────────────

export type WidgetCategory =
  | 'planning'
  | 'execution'
  | 'safety'
  | 'management'
  | 'workforce'
  | 'shutdown'
  | 'platform'
  | 'custom';

// ─── Dashboard Types ────────────────────────────────────────────────────────

export type DashboardType = 'dashboard' | 'cockpit' | 'tv' | 'meeting';

// ─── Widget Metadata ────────────────────────────────────────────────────────

export interface WidgetMeta {
  /** Unique slug: "safety_trir_gauge", "planning_lookahead_table" */
  slug: string;
  /** Display name: "TRIR Gauge", "24hr Look Ahead" */
  name: string;
  /** Description for marketplace */
  description: string;
  /** Category for grouping */
  category: WidgetCategory | string;
  /** Icon (emoji or icon class) */
  icon?: string;
  /** ProviderRegistry key — the data source */
  providerKey: string;
  /** Visualization type — determines which renderer is used */
  visualizationType: VisualizationType;
  /** Default visualization config (chart options, table columns, etc.) */
  defaultConfig: Record<string, any>;
  /** Supported filter keys */
  supportedFilters: string[];
  /** Default refresh interval in seconds */
  refreshInterval: number;
  /** Widget capabilities */
  supportsAi: boolean;
  supportsExport: boolean;
  supportsPrint: boolean;
  supportsDrilldown: boolean;
  supportsThreshold: boolean;
  /** Version for marketplace */
  version: number;
  /** Author for marketplace */
  author: string;
  /** Required permissions to view */
  permissionsRequired: string[];
}

// ─── Widget Instance Config ─────────────────────────────────────────────────

/** The runtime configuration for a widget instance on a dashboard */
export interface WidgetInstanceConfig {
  /** Widget definition ID */
  widgetDefinitionId: string;
  /** Grid position (react-grid-layout compatible) */
  grid: {
    x: number;
    y: number;
    w: number;
    h: number;
    minW?: number;
    minH?: number;
  };
  /** Display overrides */
  titleOverride?: string;
  subtitle?: string;
  iconOverride?: string;
  colorOverride?: string;
  /** Provider parameters (filter values) */
  providerParams: Record<string, any>;
  /** Visualization-specific config */
  visualizationConfig: Record<string, any>;
  /** Threshold configuration */
  thresholdConfig?: {
    warning?: number;
    danger?: number;
    target?: number;
    direction?: 'above' | 'below';
  };
  /** Conditional colors */
  conditionalColors?: Array<{
    field: string;
    operator: 'eq' | 'gt' | 'lt' | 'gte' | 'lte' | 'contains';
    value: string | number;
    color: string;
  }>;
  /** Formatting */
  numberFormat?: string;
  dateFormat?: string;
  /** Display toggles */
  showHeader: boolean;
  showFooter: boolean;
  footerHtml?: string;
  /** Refresh override */
  refreshIntervalOverride?: number;
}

// ─── Threshold Config ───────────────────────────────────────────────────────

export interface ThresholdConfig {
  warning?: number;
  danger?: number;
  target?: number;
  direction: 'above' | 'below';
  warningColor?: string;
  dangerColor?: string;
  normalColor?: string;
}

// ─── Dashboard Layout Config ────────────────────────────────────────────────

export interface DashboardLayoutConfig {
  gridColumns: number;
  gridRowHeight: number;
  breakpoints?: Record<string, number>;
  compactType?: 'vertical' | 'horizontal' | null;
  margin?: [number, number];
  containerPadding?: [number, number];
}

// ─── Dashboard Schedule Frequency ───────────────────────────────────────────

export type ScheduleFrequency =
  | 'manual'
  | 'hourly'
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'event_triggered';

// ─── Export Formats ─────────────────────────────────────────────────────────

export type ExportFormat = 'pdf' | 'html' | 'excel' | 'csv' | 'png';

// ─── Widget Data (from ProviderRegistry) ────────────────────────────────────

export interface WidgetData {
  loading: boolean;
  error?: string;
  rows?: any[];
  kpis?: Array<{
    label: string;
    value: string | number;
    unit?: string;
    trend?: 'up' | 'down' | 'flat';
    color?: string;
  }>;
  chartData?: any;
  tables?: Record<string, { rows: any[]; columns?: Array<{ key: string; label: string }> }>;
  summary?: string;
  metadata?: Record<string, any>;
  fetchedAt?: string;
}
