/**
 * M7.6C — Operational Intelligence Studio (OIS)
 *
 * Enterprise visualization platform.
 * Thin orchestration layer above:
 *   ProviderRegistry → WidgetDataService → VisualizationEngine → DashboardService
 *
 * Reuses: BrandingService, ArtifactService, NotificationPlatform, RollupEngine.
 */

// ─── Core SDK ───────────────────────────────────────────────────────────────
export type {
  VisualizationType,
  WidgetCategory,
  DashboardType,
  WidgetMeta,
  WidgetInstanceConfig,
  ThresholdConfig,
  DashboardLayoutConfig,
  ScheduleFrequency,
  ExportFormat,
  WidgetData,
} from './WidgetSDK';

// ─── Visualization Engine ───────────────────────────────────────────────────
export {
  VISUALIZATION_REGISTRY,
  getVisualizationSpec,
  evaluateThreshold,
  getThresholdColor,
  getAvailableVisualizationTypes,
} from './VisualizationEngine';
export type {
  ChartConfig,
  TableConfig,
  KpiCardConfig,
  GaugeConfig,
  ProgressCardConfig,
} from './VisualizationEngine';

// ─── Services ───────────────────────────────────────────────────────────────
export { WidgetDataService } from './WidgetDataService';
export { DashboardService } from './DashboardService';
export { DashboardSnapshotService } from './DashboardSnapshotService';
export { DashboardScheduleService } from './DashboardScheduleService';
export { TVModeService } from './TVModeService';

// ─── M7.6D — Designer & Intelligence ────────────────────────────────────────
export { DesignerStateManager, DESIGNER_SHORTCUTS } from './DesignerStateManager';
export type { WidgetLayout, DashboardPage, WidgetGroup, DesignerConfig, ResponsiveBreakpoint } from './DesignerStateManager';
export { CrossFilterEngine, DRILLDOWN_LEVELS } from './CrossFilterEngine';
export type { DrilldownLevel, DrilldownBreadcrumb, CrossFilterLink, ActiveFilter } from './CrossFilterEngine';
export { DashboardVariableService, createDefaultVariables, computeTimeVariables } from './DashboardVariableService';
export type { DashboardVariable, VariableType, VariableChangeEvent } from './DashboardVariableService';

