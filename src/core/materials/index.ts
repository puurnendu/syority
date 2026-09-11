/**
 * M8.12 — Material & Supply Chain Services
 *
 * Barrel export for all material-related services.
 */
export { MaterialReadinessService } from './MaterialReadinessService';
export type {
  ReadinessStatus,
  MaterialReadinessResult,
  ActivityReadinessResult,
  EventReadinessSummary,
} from './MaterialReadinessService';

export { MaterialConstraintService } from './MaterialConstraintService';
export type {
  CreateSupplyRecordInput,
  UpdateSupplyRecordInput,
  MaterialDashboardData,
} from './MaterialConstraintService';

export { MaterialScheduleIntegrationService } from './MaterialScheduleIntegrationService';
export type {
  MaterialConstraintAdjustment,
  MaterialIntegrationResult,
} from './MaterialScheduleIntegrationService';
