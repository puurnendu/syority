/**
 * M15 decision intelligence types.
 *
 * Operational/management risk is NOT M16 ActionRiskLevel.
 * Evidence explains why M15 said something; it is not a second calculation engine.
 * Layers: FACT | CALCULATION | INTELLIGENCE | RECOMMENDATION
 */

export type ManagementRiskSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export type ManagementRiskKind = 'EXCEPTION' | 'RESOURCE';

export type ForecastType =
  | 'EXECUTION_FINISH_FORECAST'
  | 'SCHEDULE_SCENARIO_FINISH'
  | 'EAC_COST_FORECAST';

export type ImpactKind = 'SLIP_IMPACT' | 'NETWORK_IMPACT' | 'RESOURCE_IMPACT';

export type EvidenceLayer = 'FACT' | 'CALCULATION' | 'INTELLIGENCE' | 'RECOMMENDATION';

export type ForecastConfidence = 'NOT_AVAILABLE';

export interface IntelligenceEvidence {
  entityType: string;
  entityId: string;
  entityLabel?: string;
  metric: string;
  value: string | number | boolean | null;
  unit?: string;
  sourceAuthority: string;
  sourceService: string;
  sourceRecord?: string;
  observedAt?: string;
  explanation?: string;
  layer: EvidenceLayer;
}

export interface DecisionResultBase {
  organizationId: string;
  eventId: string;
  sourceAuthority: string;
  sourceService: string;
  calculatedAt: string;
  asOf: string;
  calculationType: EvidenceLayer;
  evidence: IntelligenceEvidence[];
}

export interface AffectedEntity {
  entityType: string;
  entityId: string;
  label?: string;
}

export interface RankingModelRef {
  id: string;
  version: string;
}

export interface ManagementRisk extends DecisionResultBase {
  id: string;
  kind: ManagementRiskKind;
  riskType: string;
  /** M15 management significance — not M13 exception severity. */
  priority: ManagementRiskSeverity;
  /** Alias of priority for R1 consumers. */
  severity: ManagementRiskSeverity;
  /** Raw M13 P1–P4 when this risk is composed from an exception. */
  exceptionSeverity?: string;
  title: string;
  statement: string;
  exceptionCode?: string;
  activityId?: string;
  workpackId?: string;
  affectedEntities: AffectedEntity[];
  impactSummary: string;
  forecastImpact: string | null;
  sourceAuthorities: string[];
  rankingScore: number;
  rankingModel: RankingModelRef;
}

export interface IntelligenceCompleteness {
  readinessComplete: boolean;
  readinessNotStartedCount: number | null;
  readinessEvaluatedCount: number | null;
  exceptionsTruncated: boolean;
  exceptionsReturned: number;
  exceptionsTotal: number | null;
}

export interface ManagementRiskResult {
  organizationId: string;
  eventId: string;
  asOf: string;
  rankingModel: RankingModelRef;
  completeness: IntelligenceCompleteness;
  risks: ManagementRisk[];
}

export interface ForecastAssumption {
  name: string;
  value: string | number | boolean | null;
  sourceAuthority: string;
}

export interface ForecastQuality {
  dataAsOf: string;
  actualProgressAvailable: boolean | null;
  baselineAvailable: boolean | null;
  cpmAvailable: boolean | null;
  resourceDataAvailable: boolean | null;
  scenarioAssumptionsPresent: boolean | null;
  confidence: ForecastConfidence;
}

export interface ForecastResult extends DecisionResultBase {
  forecastType: ForecastType;
  value: string | number | null;
  unit: string;
  explanation: string;
  assumptions: ForecastAssumption[];
  quality: ForecastQuality;
}

export interface ImpactSlice extends DecisionResultBase {
  impactKind: ImpactKind;
  activityId: string;
  value: string | number | null;
  unit: string;
  explanation: string;
}

export interface ImpactResult {
  organizationId: string;
  eventId: string;
  activityId: string;
  slipHours: number;
  slip: ImpactSlice;
  network: ImpactSlice;
  resource: ImpactSlice;
  /** Explicit count — never treat as hours. */
  downstreamActivityCount: number;
  /**
   * CPM network finish impact in hours.
   * Null unless produced by M8.9 scenario calculation. Never inferred from activity count.
   */
  networkCompletionImpactHours: number | null;
  calculatedAt: string;
  asOf: string;
}

export type RecommendationCategory =
  | 'SCHEDULE'
  | 'RESOURCE'
  | 'READINESS'
  | 'CONSTRAINT'
  | 'EXECUTION';

export type RecommendationStatus = 'ADVISORY' | 'INSUFFICIENT_EVIDENCE';

export type ConsequenceType = 'QUALITATIVE' | 'SCENARIO_DERIVED' | 'NONE';

export interface ManagementRecommendation {
  recommendationId: string;
  organizationId: string;
  eventId: string;
  category: RecommendationCategory;
  priority: ManagementRiskSeverity;
  title: string;
  problem: string;
  implication: string;
  recommendation: string;
  rationale: string;
  evidence: IntelligenceEvidence[];
  assumptions: ForecastAssumption[];
  expectedConsequence: string;
  consequenceType: ConsequenceType;
  estimatedImpact: { value: string | number | null; unit: string; sourceAuthority: string } | null;
  affectedEntities: AffectedEntity[];
  sourceAuthorities: string[];
  generatedAt: string;
  asOf: string;
  modelVersion: string;
  status: RecommendationStatus;
  calculationType: 'RECOMMENDATION';
  sourceRiskId: string;
}

export interface ManagementRecommendationResult {
  organizationId: string;
  eventId: string;
  asOf: string;
  rankingModel: RankingModelRef;
  recommendationModel: RankingModelRef;
  completeness: IntelligenceCompleteness & { recommendationsTruncated: boolean; recommendationsReturned: number };
  recommendations: ManagementRecommendation[];
}

export type WhatIfKind =
  | 'DURATION_SLIP'
  | 'DURATION_CHANGE'
  | 'DELAYED_START'
  | 'RESOURCE_LEVELING_SIMULATION'
  | 'ADDITIONAL_CREWS'
  | 'CONSTRAINT_REMOVAL'
  | 'SCOPE_CHANGE';

export interface WhatIfInput {
  kind: WhatIfKind;
  activityId?: string;
  slipHours?: number;
  durationHours?: number;
  delayDays?: number;
}

export type WhatIfResult =
  | {
      status: 'CALCULATED';
      kind: WhatIfKind;
      hypothetical: true;
      organizationId: string;
      eventId: string;
      asOf: string;
      assumptions: ForecastAssumption[];
      forecasts: ForecastResult[];
      snapshotFinish: string | null;
      baselineFinishDeltaDays: number | null;
      scenarioId?: string;
      levelingSimulation?: {
        proposedChangeCount: number;
        projectFinishBefore: string | null;
        projectFinishAfter: string | null;
        projectFinishImpact: number | null;
        constraintsResolved: number;
        note: string;
      };
      explanation: string;
    }
  | {
      status: 'NOT_SUPPORTED' | 'INSUFFICIENT_DATA';
      kind: WhatIfKind;
      hypothetical: true;
      organizationId: string;
      eventId: string;
      asOf: string;
      reason: string;
    };

export type ManagementDecisionValue = 'ACCEPT' | 'REJECT' | 'DEFER' | 'REQUEST_MORE_INFORMATION';

export interface ManagementDecisionRecord {
  decisionId: string;
  organizationId: string;
  eventId: string;
  recommendationId: string;
  decidedBy: string;
  decision: ManagementDecisionValue;
  rationale: string | null;
  decidedAt: string;
  sourceChannel: string;
  relatedScenarioId: string | null;
  evidenceSnapshot: unknown;
  status: 'RECORDED';
  /** Explicit: this record is not authorization and not an execution mutation. */
  authorizesExecution: false;
  calculationType: 'MANAGEMENT_DECISION';
}

export class DecisionContextError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'EVENT_REQUIRED'
      | 'EVENT_NOT_FOUND'
      | 'ACTIVITY_NOT_FOUND'
      | 'SCENARIO_NOT_FOUND'
      | 'HUMAN_REQUIRED'
      | 'RECOMMENDATION_NOT_FOUND'
      | 'INVALID_DECISION'
  ) {
    super(message);
    this.name = 'DecisionContextError';
  }
}
