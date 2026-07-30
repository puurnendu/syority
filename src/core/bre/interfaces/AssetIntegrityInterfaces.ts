/**
 * M7.6E — Asset Integrity Interfaces
 *
 * TypeScript interfaces ONLY — no implementation.
 * Reserves provider keys and defines data contracts for future
 * Asset Integrity Management module.
 *
 * These interfaces define the shape of data that will flow through
 * ProviderRegistry once the Asset Integrity module is implemented.
 */

// ─── Equipment Health ───────────────────────────────────────────────────────

export interface EquipmentHealthData {
  equipmentId: string;
  equipmentTag: string;
  equipmentType: string;
  healthScore: number;        // 0-100
  healthStatus: 'good' | 'fair' | 'poor' | 'critical';
  lastInspectionDate: Date | null;
  nextInspectionDue: Date | null;
  remainingLife: number | null; // months
  failureProbability: number;  // 0-1
  riskRating: 'low' | 'medium' | 'high' | 'very_high';
}

// ─── Inspection Due ─────────────────────────────────────────────────────────

export interface InspectionDueData {
  inspectionId: string;
  equipmentTag: string;
  inspectionType: string;     // 'visual' | 'thickness' | 'mpi' | 'ut' | 'rt' | 'pressure_test'
  dueDate: Date;
  overdueByDays: number;
  lastResult: string | null;
  inspector: string | null;
  priority: 'routine' | 'priority' | 'critical' | 'shutdown_required';
}

// ─── Corrosion ──────────────────────────────────────────────────────────────

export interface CorrosionData {
  circuitId: string;
  equipmentTag: string;
  corrosionRate: number;      // mm/year
  nominalThickness: number;   // mm
  currentThickness: number;   // mm
  minimumThickness: number;   // mm (retirement)
  remainingLife: number;      // years
  lastMeasurementDate: Date | null;
  mechanism: string;          // 'general' | 'localized' | 'erosion' | 'mic' | 'cui'
}

// ─── Vibration ──────────────────────────────────────────────────────────────

export interface VibrationData {
  equipmentTag: string;
  measurementPoint: string;
  velocity: number;           // mm/s
  acceleration: number;       // g
  displacement: number;       // µm
  severityLevel: 'good' | 'acceptable' | 'alert' | 'danger';
  trend: 'stable' | 'increasing' | 'decreasing' | 'erratic';
  lastMeasurementDate: Date;
}

// ─── Lubrication ────────────────────────────────────────────────────────────

export interface LubricationData {
  equipmentTag: string;
  lubricantType: string;
  lastServiceDate: Date | null;
  nextServiceDue: Date | null;
  oilCondition: 'good' | 'acceptable' | 'marginal' | 'critical';
  contaminationLevel: number; // ppm
  viscosity: number;
}

// ─── Oil Analysis ───────────────────────────────────────────────────────────

export interface OilAnalysisData {
  sampleId: string;
  equipmentTag: string;
  sampleDate: Date;
  ironPpm: number;
  copperPpm: number;
  leadPpm: number;
  waterContent: number;       // %
  tbn: number;                // Total Base Number
  viscosity40: number;        // cSt @ 40°C
  overallCondition: 'normal' | 'abnormal' | 'critical';
}

// ─── Thickness Monitoring ───────────────────────────────────────────────────

export interface ThicknessMonitoringData {
  circuitId: string;
  cmlId: string;             // Condition Monitoring Location
  equipmentTag: string;
  nominalThickness: number;
  currentThickness: number;
  minimumThickness: number;
  corrosionRate: number;
  remainingLife: number;
  lastReadingDate: Date;
  readings: Array<{ date: Date; thickness: number }>;
}

// ─── Reliability ────────────────────────────────────────────────────────────

export interface ReliabilityData {
  equipmentTag: string;
  mtbf: number;               // Mean Time Between Failures (hours)
  mttr: number;               // Mean Time To Repair (hours)
  availability: number;       // 0-1
  failureCount12m: number;    // Last 12 months
  lastFailureDate: Date | null;
  failureMode: string | null;
}

// ─── FMEA ───────────────────────────────────────────────────────────────────

export interface FMEAData {
  equipmentTag: string;
  failureMode: string;
  effect: string;
  severity: number;           // 1-10
  occurrence: number;         // 1-10
  detection: number;          // 1-10
  rpn: number;                // Risk Priority Number = S × O × D
  mitigationAction: string | null;
  responsibleParty: string | null;
}

// ─── RCM ────────────────────────────────────────────────────────────────────

export interface RCMData {
  equipmentTag: string;
  function: string;
  functionalFailure: string;
  failureMode: string;
  failureEffect: string;
  consequence: 'hidden' | 'safety' | 'operational' | 'non_operational';
  maintenanceStrategy: 'condition_based' | 'time_based' | 'failure_finding' | 'redesign' | 'run_to_failure';
  taskDescription: string;
  interval: string;
}

// ─── Predictive Maintenance ─────────────────────────────────────────────────

export interface PredictiveMaintenanceData {
  equipmentTag: string;
  predictionModel: string;
  predictedFailureDate: Date | null;
  confidence: number;         // 0-1
  leadTimeDays: number;
  recommendedAction: string;
  dataInputs: string[];       // ['vibration', 'temperature', 'oil_analysis']
}

// ─── Condition Monitoring ───────────────────────────────────────────────────

export interface ConditionMonitoringData {
  equipmentTag: string;
  parameterName: string;      // 'temperature' | 'pressure' | 'flow' | 'level'
  currentValue: number;
  unit: string;
  normalRange: { min: number; max: number };
  alarmRange: { min: number; max: number };
  status: 'normal' | 'pre_alarm' | 'alarm' | 'trip';
  trend: 'stable' | 'increasing' | 'decreasing';
}

// ─── Reserved Provider Keys ─────────────────────────────────────────────────

/**
 * Provider keys reserved for Asset Integrity Management.
 * These will be registered in ProviderRegistry when the module is implemented.
 */
export const ASSET_INTEGRITY_PROVIDER_KEYS = {
  EQUIPMENT_HEALTH: 'asset_integrity.equipment_health',
  INSPECTION_DUE: 'asset_integrity.inspection_due',
  CORROSION: 'asset_integrity.corrosion',
  VIBRATION: 'asset_integrity.vibration',
  LUBRICATION: 'asset_integrity.lubrication',
  OIL_ANALYSIS: 'asset_integrity.oil_analysis',
  THICKNESS_MONITORING: 'asset_integrity.thickness_monitoring',
  RELIABILITY: 'asset_integrity.reliability',
  FMEA: 'asset_integrity.fmea',
  RCM: 'asset_integrity.rcm',
  PREDICTIVE_MAINTENANCE: 'asset_integrity.predictive_maintenance',
  CONDITION_MONITORING: 'asset_integrity.condition_monitoring',
} as const;
