/**
 * Deterministic M15 recommendation composition (v1).
 *
 * Assembles CONSIDER text from existing ManagementRisk evidence.
 * Does not persist BRE rows, invent numeric slip reductions, or execute actions.
 */

import type {
  ManagementRecommendation,
  ManagementRisk,
  RecommendationCategory,
} from './types';

export const RECOMMENDATION_COMPOSE_MODEL = {
  id: 'm15-recommendation-compose',
  version: '1.0',
} as const;

interface Template {
  category: RecommendationCategory;
  recommendation: string;
  implication: string;
  expectedConsequence: string;
}

function templateFor(risk: ManagementRisk): Template {
  const code = risk.exceptionCode;

  if (risk.kind === 'RESOURCE') {
    return {
      category: 'RESOURCE',
      recommendation:
        'Management should consider reallocating or augmenting the affected resource pool. A leveling simulation may be run as a what-if only — do not apply leveling from this recommendation.',
      implication:
        'Resource shortage on listed activities can delay work even when the schedule network still shows float.',
      expectedConsequence:
        'Capacity or assignment changes may reduce resource-risk records; numeric finish improvement is unknown unless an M8.9 or leveling simulation is run.',
    };
  }

  if (code === 'READINESS_BLOCKED') {
    return {
      category: 'READINESS',
      recommendation:
        'Management should consider assigning an owner and target date for the blocking readiness item before releasing the activity.',
      implication:
        'M12 execution readiness currently reports this activity as not ready to start.',
      expectedConsequence:
        'Activity release may remain blocked until the readiness condition is satisfied. No schedule-hour reduction is claimed without a scenario.',
    };
  }

  if (code === 'CONSTRAINT_BLOCKED') {
    return {
      category: 'CONSTRAINT',
      recommendation:
        'Management should consider resolving the open critical constraint before the next control point.',
      implication:
        'An open critical workpack constraint is blocking or threatening this activity.',
      expectedConsequence:
        'Work may remain constrained until the constraint is closed. Numeric slip reduction is not invented.',
    };
  }

  if (code === 'ON_HOLD') {
    return {
      category: 'EXECUTION',
      recommendation:
        'Management should consider reviewing the hold reason and the conditions required to resume, without treating this recommendation as a RESUME instruction.',
      implication: 'The activity is in an on-hold execution state (M12 fact).',
      expectedConsequence:
        'The activity stays on hold until an authorized M12 resume. M15 will not resume it.',
    };
  }

  if (code === 'CRITICAL_LATE' || code === 'LATE' || code === 'CRITICAL' || code === 'PROGRESS_LAG' || code === 'UPCOMING_RISK' || code === 'LOW_FLOAT') {
    return {
      category: 'SCHEDULE',
      recommendation:
        'Management should consider prioritising the affected workpack and resolving identified constraints before the next control point.',
      implication:
        'This M13 exception is management-significant given persisted M11 criticality/float and downstream activity count (count, not hours).',
      expectedConsequence:
        'Potential reduction in forecast schedule slip if the blocking condition is removed. No numeric reduction is stated without an M8.9 scenario.',
    };
  }

  return {
    category: 'EXECUTION',
    recommendation:
      'Management should consider reviewing this exception with the responsible supervisor. This is not an execution command.',
    implication: risk.statement,
    expectedConsequence:
      'Consequence is qualitative until an authoritative scenario or execution change is recorded.',
  };
}

export function composeRecommendation(risk: ManagementRisk): ManagementRecommendation {
  const generatedAt = risk.asOf;
  const tpl = templateFor(risk);
  const hasEvidence = risk.evidence.length > 0;
  const status = hasEvidence ? 'ADVISORY' : 'INSUFFICIENT_EVIDENCE';

  return {
    recommendationId: `m15-rec:${risk.eventId}:${risk.id}`,
    organizationId: risk.organizationId,
    eventId: risk.eventId,
    category: tpl.category,
    priority: risk.priority,
    title: risk.title,
    problem: risk.statement,
    implication: tpl.implication,
    recommendation:
      status === 'INSUFFICIENT_EVIDENCE'
        ? 'Insufficient evidence to form a management recommendation.'
        : tpl.recommendation,
    rationale: `Composed from ${risk.sourceAuthority} (${risk.exceptionCode ?? risk.kind}) using ${RECOMMENDATION_COMPOSE_MODEL.id}@${RECOMMENDATION_COMPOSE_MODEL.version}. Ranking score ${risk.rankingScore} is M15 intelligence, not an M13 severity change.`,
    evidence: risk.evidence,
    assumptions: [
      {
        name: 'does_not_execute',
        value: true,
        sourceAuthority: 'M15',
      },
      {
        name: 'requires_m16_then_ews_for_execution',
        value: true,
        sourceAuthority: 'M16',
      },
    ],
    expectedConsequence: tpl.expectedConsequence,
    consequenceType: 'QUALITATIVE',
    estimatedImpact: null,
    affectedEntities: risk.affectedEntities,
    sourceAuthorities: [...new Set([...risk.sourceAuthorities, 'M15'])],
    generatedAt,
    asOf: risk.asOf,
    modelVersion: `${RECOMMENDATION_COMPOSE_MODEL.id}@${RECOMMENDATION_COMPOSE_MODEL.version}`,
    status,
    calculationType: 'RECOMMENDATION',
    sourceRiskId: risk.id,
  };
}
