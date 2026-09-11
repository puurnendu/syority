/**
 * M16-R4 — M15 decision-intelligence tools.
 *
 * Thin wrappers around m15ToToolResult. Trusted ctx only.
 * RECORD_MANAGEMENT_DECISION is a journal write, not EWS.
 */

import { M16Intent } from '../intents';
import { ActionRiskLevel } from '../risk';
import { registerTool, getTool } from './ToolRegistry';
import type { ToolParams, ToolResult } from './ToolRegistry';
import type { M16InteractionContext } from '../types';
import type { WhatIfKind, ManagementDecisionValue } from '@/core/m15/types';

async function m15() {
  const { m15ToToolResult } = await import('@/core/m15/m16Adapter');
  return m15ToToolResult;
}

function trusted(ctx: M16InteractionContext) {
  return {
    organizationId: ctx.organizationId,
    eventId: ctx.eventId || '',
    userId: ctx.userId,
    sourceChannel: ctx.channel,
  };
}

function wrap(result: {
  status: string;
  data: unknown;
  summary: string;
  authority: string;
}): ToolResult {
  const status =
    result.status === 'SUCCESS'
      ? 'SUCCESS'
      : result.status === 'DENIED'
        ? 'DENIED'
        : result.status === 'NOT_FOUND'
          ? 'NOT_FOUND'
          : 'ERROR';
  return {
    status,
    data: result.data,
    summary: result.summary,
    authority: result.authority,
  };
}

export function inferWhatIfKind(text: string | undefined): WhatIfKind | undefined {
  if (!text) return undefined;
  const t = text.toLowerCase();
  if (/crew|manpower|additional (people|resources)/.test(t)) return 'ADDITIONAL_CREWS';
  if (/level/.test(t)) return 'RESOURCE_LEVELING_SIMULATION';
  if (/scope/.test(t)) return 'SCOPE_CHANGE';
  if (/constraint/.test(t)) return 'CONSTRAINT_REMOVAL';
  if (/delay/.test(t)) return 'DELAYED_START';
  if (/slip|duration|longer/.test(t)) return 'DURATION_SLIP';
  return undefined;
}

export function inferDecision(text: string | undefined): ManagementDecisionValue | undefined {
  if (!text) return undefined;
  const t = text.toLowerCase();
  if (/\breject/.test(t)) return 'REJECT';
  if (/\bdefer/.test(t)) return 'DEFER';
  if (/more information|need more info/.test(t)) return 'REQUEST_MORE_INFORMATION';
  if (/\baccept/.test(t)) return 'ACCEPT';
  return undefined;
}

function extractRecommendationId(text: string | undefined): string | undefined {
  if (!text) return undefined;
  const m = text.match(/m15-rec:[0-9a-f-]+:[^\s]+/i);
  return m?.[0];
}

/** Singular conversational reference — never used for "show recommendations" lists. */
function isSingularRecommendationReference(text: string | undefined): boolean {
  if (!text) return false;
  const t = text.toLowerCase();
  if (extractRecommendationId(text)) return true;
  if (/\brecommendations\b/.test(t) && !/\b(this|that)\b/.test(t)) return false;
  if (/recommend/.test(t) && /\b(this|that)\b/.test(t)) return true;
  if (/the recommendation (for|about|concerning|on)\b/.test(t)) return true;
  if (/recommendation you just/.test(t)) return true;
  if (/show (me )?(the )?recommendation\b/.test(t)) return true;
  return false;
}

async function executeGetRecommendations(ctx: M16InteractionContext, params: ToolParams): Promise<ToolResult> {
  const fn = await m15();
  if (
    params.activityId ||
    params.equipmentTag ||
    params.workpackNumber ||
    extractRecommendationId(params.rawUserText) ||
    isSingularRecommendationReference(params.rawUserText)
  ) {
    const one = await fn(trusted(ctx), 'getRecommendation', {
      recommendationId: extractRecommendationId(params.rawUserText),
      activityId: params.activityId,
      equipmentTag: params.equipmentTag,
      workpackNumber: params.workpackNumber,
      text: params.rawUserText,
      conversationRecommendationIds: params.conversationRecommendationIds,
      organizationId: 'spoof',
      eventId: 'spoof',
    });
    if (one.status === 'SUCCESS' || (one.data && (one.data as { status?: string }).status === 'AMBIGUOUS')) {
      return wrap(one);
    }
  }
  return wrap(
    await fn(trusted(ctx), 'getRecommendations', {
      activityId: params.activityId,
      organizationId: 'llm-spoof-ignored',
      eventId: 'llm-spoof-ignored',
    })
  );
}

async function executeGetRecommendation(ctx: M16InteractionContext, params: ToolParams): Promise<ToolResult> {
  const fn = await m15();
  return wrap(
    await fn(trusted(ctx), 'getRecommendation', {
      recommendationId: extractRecommendationId(params.rawUserText),
      activityId: params.activityId,
      equipmentTag: params.equipmentTag,
      workpackNumber: params.workpackNumber,
      text: params.rawUserText,
      conversationRecommendationIds: params.conversationRecommendationIds,
      organizationId: 'spoof',
      eventId: 'spoof',
    })
  );
}

async function executeGetRecommendationEvidence(ctx: M16InteractionContext, params: ToolParams): Promise<ToolResult> {
  const fn = await m15();
  return wrap(
    await fn(trusted(ctx), 'getRecommendationEvidence', {
      recommendationId: extractRecommendationId(params.rawUserText),
      activityId: params.activityId,
      equipmentTag: params.equipmentTag,
      workpackNumber: params.workpackNumber,
      text: params.rawUserText,
      conversationRecommendationIds: params.conversationRecommendationIds,
      organizationId: 'spoof',
      eventId: 'spoof',
    })
  );
}

async function executeGetManagementRisks(ctx: M16InteractionContext, _params: ToolParams): Promise<ToolResult> {
  const fn = await m15();
  return wrap(await fn(trusted(ctx), 'getManagementRisks', { organizationId: 'x', eventId: 'y' }));
}

async function executeGetForecast(ctx: M16InteractionContext, _params: ToolParams): Promise<ToolResult> {
  const fn = await m15();
  return wrap(await fn(trusted(ctx), 'getForecast'));
}

async function executeGetImpact(ctx: M16InteractionContext, params: ToolParams): Promise<ToolResult> {
  const fn = await m15();
  return wrap(
    await fn(trusted(ctx), 'getImpact', {
      activityId: params.activityId,
      slipHours: 0,
    })
  );
}

async function executeRunWhatIf(ctx: M16InteractionContext, params: ToolParams): Promise<ToolResult> {
  const fn = await m15();
  const kind = inferWhatIfKind(params.rawUserText) ?? (params.filter?.kind as WhatIfKind | undefined);
  return wrap(
    await fn(trusted(ctx), 'runWhatIf', {
      kind,
      activityId: params.activityId,
      slipHours: params.filter?.slipHours ? Number(params.filter.slipHours) : undefined,
      organizationId: 'spoof',
      eventId: 'spoof',
    })
  );
}

async function executeRecordDecision(ctx: M16InteractionContext, params: ToolParams): Promise<ToolResult> {
  const fn = await m15();
  return wrap(
    await fn(trusted(ctx), 'recordManagementDecision', {
      recommendationId: extractRecommendationId(params.rawUserText),
      decision: inferDecision(params.rawUserText),
      rationale: params.rawUserText,
      activityId: params.activityId,
      equipmentTag: params.equipmentTag,
      workpackNumber: params.workpackNumber,
      text: params.rawUserText,
      conversationRecommendationIds: params.conversationRecommendationIds,
      userId: 'llm-spoof-ignored',
      organizationId: 'spoof',
      eventId: 'spoof',
      authorizesExecution: true,
    })
  );
}

export function registerM15DecisionTools(): void {
  if (getTool('getRecommendations')) return;

  registerTool({
    name: 'getRecommendations',
    description: 'Advisory management recommendations (not execution)',
    authority: 'M15 DecisionIntelligenceService',
    permission: null,
    riskLevel: ActionRiskLevel.READ,
    readWrite: 'read',
    eventScoped: true,
    intents: [M16Intent.GET_RECOMMENDATIONS],
    execute: executeGetRecommendations,
  });
  registerTool({
    name: 'getRecommendation',
    description: 'Resolve one advisory recommendation in the trusted event',
    authority: 'M15 DecisionIntelligenceService',
    permission: null,
    riskLevel: ActionRiskLevel.READ,
    readWrite: 'read',
    eventScoped: true,
    intents: [],
    execute: executeGetRecommendation,
  });
  registerTool({
    name: 'getRecommendationEvidence',
    description: 'Evidence for one advisory recommendation',
    authority: 'M15 DecisionIntelligenceService',
    permission: null,
    riskLevel: ActionRiskLevel.READ,
    readWrite: 'read',
    eventScoped: true,
    intents: [],
    execute: executeGetRecommendationEvidence,
  });
  registerTool({
    name: 'getManagementRisks',
    description: 'Management risks composed from M13/M8',
    authority: 'M15 DecisionIntelligenceService',
    permission: null,
    riskLevel: ActionRiskLevel.READ,
    readWrite: 'read',
    eventScoped: true,
    intents: [M16Intent.GET_MANAGEMENT_RISKS],
    execute: executeGetManagementRisks,
  });
  registerTool({
    name: 'getManagementForecast',
    description: 'Named M15 forecasts',
    authority: 'M15 DecisionIntelligenceService',
    permission: null,
    riskLevel: ActionRiskLevel.READ,
    readWrite: 'read',
    eventScoped: true,
    intents: [M16Intent.GET_MANAGEMENT_FORECAST],
    execute: executeGetForecast,
  });
  registerTool({
    name: 'getManagementImpact',
    description: 'Typed impact (count vs hours)',
    authority: 'M15 DecisionIntelligenceService',
    permission: null,
    riskLevel: ActionRiskLevel.READ,
    readWrite: 'read',
    eventScoped: true,
    intents: [M16Intent.GET_MANAGEMENT_IMPACT],
    execute: executeGetImpact,
  });
  registerTool({
    name: 'runWhatIf',
    description: 'Hypothetical M8.9 / leveling simulation',
    authority: 'M15 / M8.9',
    permission: null,
    riskLevel: ActionRiskLevel.READ,
    readWrite: 'read',
    eventScoped: true,
    intents: [M16Intent.RUN_WHAT_IF],
    execute: executeRunWhatIf,
  });
  registerTool({
    name: 'recordManagementDecision',
    description: 'Record ACCEPT/REJECT/DEFER — not EWS',
    authority: 'M15 ManagementDecisionService',
    permission: null,
    riskLevel: ActionRiskLevel.READ,
    readWrite: 'read',
    eventScoped: true,
    intents: [M16Intent.RECORD_MANAGEMENT_DECISION],
    execute: executeRecordDecision,
  });
}
