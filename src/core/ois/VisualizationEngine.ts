/**
 * M7.6C — Visualization Engine
 *
 * ONE rendering engine for the entire platform.
 * Maps VisualizationType → React component reference.
 * Used by: Dashboard Builder, Cockpit Builder, Reports, TV Mode, Meeting Mode.
 *
 * This is the SERVER-SIDE registry. The client-side WidgetRenderer
 * component uses this map to lazy-load the correct visualization.
 */

import type { VisualizationType, WidgetData, ThresholdConfig } from './WidgetSDK';

// ─── Visualization Config Schemas ───────────────────────────────────────────

export interface ChartConfig {
  xAxisKey?: string;
  yAxisKey?: string;
  yAxisKeys?: string[];
  colorPalette?: string[];
  showGrid?: boolean;
  showLegend?: boolean;
  showTooltip?: boolean;
  stacked?: boolean;
  curved?: boolean;
  fillOpacity?: number;
  barSize?: number;
  innerRadius?: number;
  outerRadius?: number;
}

export interface TableConfig {
  columns?: Array<{
    key: string;
    label: string;
    width?: number;
    sortable?: boolean;
    filterable?: boolean;
    align?: 'left' | 'center' | 'right';
    format?: 'text' | 'number' | 'date' | 'status' | 'percentage';
  }>;
  pageSize?: number;
  showSearch?: boolean;
  showExport?: boolean;
  stickyHeader?: boolean;
  stripedRows?: boolean;
}

export interface KpiCardConfig {
  layout?: 'horizontal' | 'vertical' | 'grid';
  cardStyle?: 'minimal' | 'bordered' | 'elevated' | 'filled';
  showTrend?: boolean;
  showIcon?: boolean;
  maxCards?: number;
}

export interface GaugeConfig {
  min?: number;
  max?: number;
  segments?: Array<{ from: number; to: number; color: string; label?: string }>;
  valueKey?: string;
  labelKey?: string;
  unit?: string;
  arcWidth?: number;
}

export interface ProgressCardConfig {
  valueKey?: string;
  targetKey?: string;
  labelKey?: string;
  showPercentage?: boolean;
  barColor?: string;
  barHeight?: number;
}

// ─── Visualization Registry ─────────────────────────────────────────────────

/**
 * Map from visualization type → the client-side component path.
 * The WidgetRenderer uses this to dynamically import the correct component.
 */
export const VISUALIZATION_REGISTRY: Record<VisualizationType, {
  /** Component import path (relative to @/components/ois/visualizations/) */
  component: string;
  /** Default configuration */
  defaultConfig: Record<string, any>;
  /** Supported data shapes */
  dataShapes: Array<'kpis' | 'rows' | 'chartData' | 'tables'>;
  /** Whether this visualization supports thresholds */
  supportsThreshold: boolean;
  /** Minimum grid dimensions */
  minSize: { w: number; h: number };
  /** Recommended grid dimensions */
  defaultSize: { w: number; h: number };
}> = {
  // ── Charts ──────────────────────────────────────────────────────────────
  line: {
    component: 'OISLineChart',
    defaultConfig: { showGrid: true, showLegend: true, showTooltip: true, curved: false },
    dataShapes: ['chartData', 'rows'],
    supportsThreshold: true,
    minSize: { w: 3, h: 3 },
    defaultSize: { w: 6, h: 4 },
  },
  area: {
    component: 'OISAreaChart',
    defaultConfig: { showGrid: true, showLegend: true, fillOpacity: 0.3, curved: true },
    dataShapes: ['chartData', 'rows'],
    supportsThreshold: true,
    minSize: { w: 3, h: 3 },
    defaultSize: { w: 6, h: 4 },
  },
  bar: {
    component: 'OISBarChart',
    defaultConfig: { showGrid: true, showLegend: true, barSize: 20 },
    dataShapes: ['chartData', 'rows'],
    supportsThreshold: true,
    minSize: { w: 3, h: 3 },
    defaultSize: { w: 6, h: 4 },
  },
  stacked_bar: {
    component: 'OISStackedBarChart',
    defaultConfig: { showGrid: true, showLegend: true, stacked: true },
    dataShapes: ['chartData', 'rows'],
    supportsThreshold: false,
    minSize: { w: 4, h: 3 },
    defaultSize: { w: 6, h: 4 },
  },
  pie: {
    component: 'OISPieChart',
    defaultConfig: { showLegend: true, showTooltip: true },
    dataShapes: ['chartData', 'rows'],
    supportsThreshold: false,
    minSize: { w: 3, h: 3 },
    defaultSize: { w: 4, h: 4 },
  },
  donut: {
    component: 'OISDonutChart',
    defaultConfig: { showLegend: true, innerRadius: 60, outerRadius: 80 },
    dataShapes: ['chartData', 'rows'],
    supportsThreshold: false,
    minSize: { w: 3, h: 3 },
    defaultSize: { w: 4, h: 4 },
  },
  gauge: {
    component: 'OISGaugeChart',
    defaultConfig: { min: 0, max: 100, arcWidth: 20 },
    dataShapes: ['kpis'],
    supportsThreshold: true,
    minSize: { w: 2, h: 2 },
    defaultSize: { w: 3, h: 3 },
  },
  // ── Grids & Tables ────────────────────────────────────────────────────
  matrix: {
    component: 'OISMatrixGrid',
    defaultConfig: { showSearch: false, stripedRows: true },
    dataShapes: ['rows', 'tables'],
    supportsThreshold: false,
    minSize: { w: 4, h: 3 },
    defaultSize: { w: 8, h: 5 },
  },
  heatmap: {
    component: 'OISHeatmapGrid',
    defaultConfig: { colorPalette: ['#10B981', '#F59E0B', '#DC2626'] },
    dataShapes: ['rows', 'chartData'],
    supportsThreshold: true,
    minSize: { w: 4, h: 3 },
    defaultSize: { w: 6, h: 4 },
  },
  data_table: {
    component: 'OISDataTable',
    defaultConfig: { pageSize: 10, showSearch: true, stickyHeader: true, stripedRows: true },
    dataShapes: ['rows', 'tables'],
    supportsThreshold: false,
    minSize: { w: 4, h: 3 },
    defaultSize: { w: 12, h: 5 },
  },
  hierarchy_table: {
    component: 'OISHierarchyTable',
    defaultConfig: { expandLevel: 2 },
    dataShapes: ['rows', 'tables'],
    supportsThreshold: false,
    minSize: { w: 6, h: 4 },
    defaultSize: { w: 12, h: 6 },
  },
  pivot_table: {
    component: 'OISPivotTable',
    defaultConfig: { showTotals: true },
    dataShapes: ['rows', 'tables'],
    supportsThreshold: false,
    minSize: { w: 6, h: 4 },
    defaultSize: { w: 12, h: 6 },
  },
  tree_grid: {
    component: 'OISTreeGrid',
    defaultConfig: { expandLevel: 1 },
    dataShapes: ['rows', 'tables'],
    supportsThreshold: false,
    minSize: { w: 6, h: 4 },
    defaultSize: { w: 12, h: 6 },
  },
  // ── Cards & KPIs ──────────────────────────────────────────────────────
  kpi_card: {
    component: 'OISKpiCard',
    defaultConfig: { layout: 'grid', cardStyle: 'elevated', showTrend: true },
    dataShapes: ['kpis'],
    supportsThreshold: true,
    minSize: { w: 2, h: 2 },
    defaultSize: { w: 4, h: 2 },
  },
  progress_card: {
    component: 'OISProgressCard',
    defaultConfig: { showPercentage: true, barHeight: 8 },
    dataShapes: ['kpis', 'rows'],
    supportsThreshold: true,
    minSize: { w: 2, h: 2 },
    defaultSize: { w: 4, h: 3 },
  },
  status_card: {
    component: 'OISStatusCard',
    defaultConfig: { layout: 'grid' },
    dataShapes: ['kpis', 'rows'],
    supportsThreshold: false,
    minSize: { w: 2, h: 2 },
    defaultSize: { w: 4, h: 3 },
  },
  // ── Timeline & Planning ───────────────────────────────────────────────
  timeline: {
    component: 'OISTimelineChart',
    defaultConfig: { showTooltip: true },
    dataShapes: ['chartData', 'rows'],
    supportsThreshold: false,
    minSize: { w: 4, h: 3 },
    defaultSize: { w: 8, h: 4 },
  },
  scurve: {
    component: 'OISSCurveChart',
    defaultConfig: { showGrid: true, showLegend: true, curved: true },
    dataShapes: ['chartData', 'rows'],
    supportsThreshold: false,
    minSize: { w: 4, h: 3 },
    defaultSize: { w: 8, h: 5 },
  },
  evm: {
    component: 'OISEVMChart',
    defaultConfig: { showGrid: true, showLegend: true },
    dataShapes: ['chartData', 'rows'],
    supportsThreshold: true,
    minSize: { w: 4, h: 3 },
    defaultSize: { w: 8, h: 5 },
  },
  gantt_summary: {
    component: 'OISGanttSummary',
    defaultConfig: { showTooltip: true, barHeight: 24 },
    dataShapes: ['rows'],
    supportsThreshold: false,
    minSize: { w: 6, h: 4 },
    defaultSize: { w: 12, h: 6 },
  },
};

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Get the visualization spec for a given type.
 */
export function getVisualizationSpec(type: VisualizationType) {
  return VISUALIZATION_REGISTRY[type] ?? VISUALIZATION_REGISTRY.kpi_card;
}

/**
 * Evaluate threshold state from a numeric value.
 */
export function evaluateThreshold(
  value: number,
  config: ThresholdConfig,
): 'normal' | 'warning' | 'danger' {
  const { warning, danger, direction } = config;

  if (direction === 'above') {
    if (danger !== undefined && value >= danger) return 'danger';
    if (warning !== undefined && value >= warning) return 'warning';
  } else {
    if (danger !== undefined && value <= danger) return 'danger';
    if (warning !== undefined && value <= warning) return 'warning';
  }

  return 'normal';
}

/**
 * Get threshold color from state.
 */
export function getThresholdColor(
  state: 'normal' | 'warning' | 'danger',
  config?: ThresholdConfig,
): string {
  switch (state) {
    case 'danger':  return config?.dangerColor ?? '#DC2626';
    case 'warning': return config?.warningColor ?? '#F59E0B';
    default:        return config?.normalColor ?? '#10B981';
  }
}

/**
 * Get all available visualization types as an array.
 */
export function getAvailableVisualizationTypes(): VisualizationType[] {
  return Object.keys(VISUALIZATION_REGISTRY) as VisualizationType[];
}
