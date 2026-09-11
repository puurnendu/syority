/**
 * Thin M16 adapter — no intelligence math.
 * M16 supplies trusted organizationId/eventId from session/phone resolution.
 * It must never pass LLM-derived org/event into these functions.
 */

import { DecisionIntelligenceService } from './DecisionIntelligenceService';
import { DecisionContextError } from './types';
import type { ForecastType } from './types';

export interface M15TrustedContext {
  organizationId: string;
  eventId: string;
  /** Session user id — required for scenario persist and management decisions. */
  userId?: string;
  sourceChannel?: string;
}

export interface M15ToolResult {
  status: 'SUCCESS' | 'NOT_FOUND' | 'DENIED';
  data: unknown;
  summary: string;
  authority: string;
  organizationId: string;
  eventId: string;
  asOf: string | null;
  provenance: {
    sourceAuthorities: string[];
    evidenceRetained: boolean;
    rankingModel?: { id: string; version: string };
    completeness?: unknown;
  };
}

function envelope(
  ctx: M15TrustedContext,
  partial: Omit<M15ToolResult, 'organizationId' | 'eventId' | 'authority'>
): M15ToolResult {
  return {
    ...partial,
    organizationId: ctx.organizationId,
    eventId: ctx.eventId,
    authority: 'M15 DecisionIntelligenceService',
  };
}

export async function m15ToToolResult(
  ctx: M15TrustedContext,
  op:
    | 'getManagementRisks'
    | 'getForecast'
    | 'getImpact'
    | 'runImpactScenario'
    | 'getRecommendations'
    | 'getRecommendation'
    | 'getRecommendationEvidence'
    | 'runWhatIf'
    | 'recordManagementDecision',
  params?: {
    scenarioId?: string;
    forecastType?: ForecastType;
    activityId?: string;
    slipHours?: number;
    durationHours?: number;
    delayDays?: number;
    kind?: import('./types').WhatIfKind;
    priority?: string;
    category?: string;
    recommendationId?: string;
    decision?: import('./types').ManagementDecisionValue;
    rationale?: string;
    text?: string;
    equipmentTag?: string;
    workpackNumber?: string;
    conversationRecommendationIds?: string[];
    /** Ignored if present — LLM/transcript must not override trusted ctx. */
    organizationId?: string;
    eventId?: string;
    userId?: string;
    authorizesExecution?: boolean;
  }
): Promise<M15ToolResult> {
  const org = ctx.organizationId;
  const event = ctx.eventId;

  if (op === 'getManagementRisks') {
    const data = await DecisionIntelligenceService.getManagementRisks(org, event);
    const authorities = [...new Set(data.risks.flatMap((r) => r.sourceAuthorities))];
    return envelope(ctx, {
      status: 'SUCCESS',
      data,
      summary: `${data.risks.length} management risks (M15 composition of M13 exceptions and resource risk). readinessComplete=${data.completeness.readinessComplete}.`,
      asOf: data.asOf,
      provenance: {
        sourceAuthorities: authorities,
        evidenceRetained: true,
        rankingModel: data.rankingModel,
        completeness: data.completeness,
      },
    });
  }
  if (op === 'getForecast') {
    const data = await DecisionIntelligenceService.getForecast(org, event, {
      scenarioId: params?.scenarioId,
      forecastType: params?.forecastType,
    });
    return envelope(ctx, {
      status: 'SUCCESS',
      data,
      summary: data.map((f) => `${f.forecastType}=${f.value} (${f.unit})`).join('; '),
      asOf: data[0]?.asOf ?? null,
      provenance: {
        sourceAuthorities: [...new Set(data.map((f) => f.sourceAuthority))],
        evidenceRetained: true,
      },
    });
  }
  if (op === 'getRecommendations') {
    const data = await DecisionIntelligenceService.getRecommendations(org, event, {
      priority: params?.priority,
      category: params?.category,
      activityId: params?.activityId,
    });
    return envelope(ctx, {
      status: 'SUCCESS',
      data,
      summary: `${data.recommendations.length} advisory recommendations (not executed). truncated=${data.completeness.recommendationsTruncated}.`,
      asOf: data.asOf,
      provenance: {
        sourceAuthorities: [...new Set(data.recommendations.flatMap((r) => r.sourceAuthorities))],
        evidenceRetained: true,
        rankingModel: data.rankingModel,
        completeness: data.completeness,
      },
    });
  }
  if (op === 'getRecommendation' || op === 'getRecommendationEvidence') {
    const rec = params?.recommendationId
      ? await DecisionIntelligenceService.getRecommendation(org, event, params.recommendationId)
      : null;
    if (!rec) {
      const resolved = await DecisionIntelligenceService.resolveRecommendation(org, event, {
        recommendationId: params?.recommendationId,
        activityId: params?.activityId,
        equipmentTag: params?.equipmentTag,
        workpackNumber: params?.workpackNumber,
        text: params?.text,
        conversationRecommendationIds: params?.conversationRecommendationIds,
      });
      if (resolved.status === 'AMBIGUOUS') {
        return envelope(ctx, {
          status: 'NOT_FOUND',
          data: resolved,
          summary: `There are ${resolved.candidates.length} matching recommendations. Which one do you mean? ${resolved.candidates.map((c) => c.title).join('; ')}`,
          asOf: null,
          provenance: { sourceAuthorities: ['M15'], evidenceRetained: true },
        });
      }
      if (resolved.status === 'RESOLVED') {
        const data =
          op === 'getRecommendationEvidence'
            ? {
                recommendationId: resolved.recommendation.recommendationId,
                evidence: resolved.recommendation.evidence,
                asOf: resolved.recommendation.asOf,
              }
            : resolved.recommendation;
        return envelope(ctx, {
          status: 'SUCCESS',
          data,
          summary:
            op === 'getRecommendationEvidence'
              ? `${resolved.recommendation.evidence.length} evidence items (advisory).`
              : `${resolved.recommendation.title}: ${resolved.recommendation.recommendation} This is not an execution command.`,
          asOf: resolved.recommendation.asOf,
          provenance: {
            sourceAuthorities: resolved.recommendation.sourceAuthorities,
            evidenceRetained: true,
          },
        });
      }
    }
    if (!rec) {
      return envelope(ctx, {
        status: 'NOT_FOUND',
        data: null,
        summary: 'Recommendation not found for this organization and event.',
        asOf: null,
        provenance: { sourceAuthorities: ['M15'], evidenceRetained: false },
      });
    }
    const data =
      op === 'getRecommendationEvidence'
        ? { recommendationId: rec.recommendationId, evidence: rec.evidence, asOf: rec.asOf }
        : rec;
    return envelope(ctx, {
      status: 'SUCCESS',
      data,
      summary:
        op === 'getRecommendationEvidence'
          ? `${rec.evidence.length} evidence items for ${rec.recommendationId} (advisory).`
          : `${rec.title}: ${rec.recommendation} This is not an execution command.`,
      asOf: rec.asOf,
      provenance: {
        sourceAuthorities: rec.sourceAuthorities,
        evidenceRetained: true,
      },
    });
  }
  if (op === 'recordManagementDecision') {
    if (!ctx.userId) {
      return envelope(ctx, {
        status: 'DENIED',
        data: null,
        summary: 'A human-authenticated session user is required. LLM text cannot record a decision.',
        asOf: null,
        provenance: { sourceAuthorities: ['M15'], evidenceRetained: false },
      });
    }
    if (!params?.decision) {
      return envelope(ctx, {
        status: 'NOT_FOUND',
        data: null,
        summary: 'decision is required. This does not execute anything.',
        asOf: null,
        provenance: { sourceAuthorities: ['M15'], evidenceRetained: false },
      });
    }
    let recommendationId = params.recommendationId;
    if (!recommendationId) {
      const resolved = await DecisionIntelligenceService.resolveRecommendation(org, event, {
        activityId: params.activityId,
        equipmentTag: params.equipmentTag,
        workpackNumber: params.workpackNumber,
        text: params.text,
        conversationRecommendationIds: params.conversationRecommendationIds,
      });
      if (resolved.status === 'AMBIGUOUS') {
        return envelope(ctx, {
          status: 'NOT_FOUND',
          data: resolved,
          summary: `There are ${resolved.candidates.length} matching recommendations. Which one do you mean? This was not recorded and was not executed.`,
          asOf: null,
          provenance: { sourceAuthorities: ['M15'], evidenceRetained: true },
        });
      }
      if (resolved.status !== 'RESOLVED') {
        return envelope(ctx, {
          status: 'NOT_FOUND',
          data: null,
          summary: resolved.reason + ' This does not execute anything.',
          asOf: null,
          provenance: { sourceAuthorities: ['M15'], evidenceRetained: false },
        });
      }
      recommendationId = resolved.recommendation.recommendationId;
    }
    try {
      const data = await DecisionIntelligenceService.recordManagementDecision(org, event, ctx.userId, {
        recommendationId,
        decision: params.decision,
        rationale: params.rationale,
        sourceChannel: ctx.sourceChannel ?? 'api',
      });
      return envelope(ctx, {
        status: 'SUCCESS',
        data,
        summary: `Management decision ${data.decision} recorded. authorizesExecution=false. M12 EWS was not called.`,
        asOf: data.decidedAt,
        provenance: { sourceAuthorities: ['M15'], evidenceRetained: true },
      });
    } catch (err: unknown) {
      const code = err instanceof DecisionContextError ? err.code : 'ERROR';
      const status = code === 'HUMAN_REQUIRED' ? 'DENIED' : 'NOT_FOUND';
      return envelope(ctx, {
        status,
        data: null,
        summary: err instanceof Error ? err.message : 'Decision was not recorded.',
        asOf: null,
        provenance: { sourceAuthorities: ['M15'], evidenceRetained: false },
      });
    }
  }
  if (op === 'runWhatIf') {
    if (!params?.kind) {
      return envelope(ctx, {
        status: 'NOT_FOUND',
        data: null,
        summary: 'kind is required for runWhatIf.',
        asOf: null,
        provenance: { sourceAuthorities: ['M15'], evidenceRetained: false },
      });
    }
    const data = await DecisionIntelligenceService.runWhatIf(org, event, ctx.userId, {
      kind: params.kind,
      activityId: params.activityId,
      slipHours: params.slipHours,
      durationHours: params.durationHours,
      delayDays: params.delayDays,
    });
    return envelope(ctx, {
      status: 'SUCCESS',
      data,
      summary:
        data.status === 'CALCULATED'
          ? `Hypothetical ${data.kind}; snapshotFinish=${data.snapshotFinish}.`
          : `${data.status}: ${data.reason}`,
      asOf: data.asOf,
      provenance: {
        sourceAuthorities: ['M8.9', 'M11'],
        evidenceRetained: true,
      },
    });
  }
  if (op === 'getImpact') {
    if (!params?.activityId) {
      return envelope(ctx, {
        status: 'NOT_FOUND',
        data: null,
        summary: 'activityId is required for impact.',
        asOf: null,
        provenance: { sourceAuthorities: ['M15'], evidenceRetained: false },
      });
    }
    const data = await DecisionIntelligenceService.getImpact(
      org,
      event,
      params.activityId,
      params.slipHours ?? 0
    );
    return envelope(ctx, {
      status: 'SUCCESS',
      data,
      summary: `Slip ${data.slipHours}h; downstreamActivityCount=${data.downstreamActivityCount}; networkCompletionImpactHours=${data.networkCompletionImpactHours}.`,
      asOf: data.asOf,
      provenance: {
        sourceAuthorities: ['M11', 'ResourceRiskService'],
        evidenceRetained: true,
      },
    });
  }

  if (!ctx.userId) {
    return envelope(ctx, {
      status: 'DENIED',
      data: null,
      summary: 'userId from trusted session is required to run an impact scenario.',
      asOf: null,
      provenance: { sourceAuthorities: ['M15'], evidenceRetained: false },
    });
  }
  if (!params?.activityId) {
    return envelope(ctx, {
      status: 'NOT_FOUND',
      data: null,
      summary: 'activityId is required for runImpactScenario.',
      asOf: null,
      provenance: { sourceAuthorities: ['M15'], evidenceRetained: false },
    });
  }
  const data = await DecisionIntelligenceService.runImpactScenario(
    org,
    event,
    ctx.userId,
    params.activityId,
    params.slipHours ?? 0
  );
  return envelope(ctx, {
    status: 'SUCCESS',
    data,
    summary: `Scenario ${data.scenarioId} snapshot finish=${data.snapshotFinish} (M8.9 simulation only).`,
    asOf: data.forecasts[0]?.asOf ?? null,
    provenance: {
      sourceAuthorities: ['M8.9', 'M11'],
      evidenceRetained: true,
    },
  });
}
