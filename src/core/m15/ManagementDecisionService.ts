/**
 * M15-R4 — Append-only management decision journal.
 *
 * Records ACCEPT / REJECT / DEFER / REQUEST_MORE_INFORMATION.
 * Does NOT execute, authorize execution, call EWS, or mutate Activity.
 */

import { prisma } from '@/lib/prisma';
import { AuditService } from '@/lib/audit';
import { DecisionContextError } from './types';
import type { ManagementDecisionRecord, ManagementDecisionValue } from './types';

const DECISIONS: ManagementDecisionValue[] = [
  'ACCEPT',
  'REJECT',
  'DEFER',
  'REQUEST_MORE_INFORMATION',
];

export function recommendationBelongsToEvent(recommendationId: string, eventId: string): boolean {
  return recommendationId.startsWith(`m15-rec:${eventId}:`);
}

export class ManagementDecisionService {
  static async record(input: {
    organizationId: string;
    eventId: string;
    userId: string;
    recommendationId: string;
    decision: ManagementDecisionValue;
    rationale?: string | null;
    sourceChannel: string;
    relatedScenarioId?: string | null;
    evidenceSnapshot?: unknown;
  }): Promise<ManagementDecisionRecord> {
    if (!input.userId) {
      throw new DecisionContextError(
        'A human-authenticated user is required to record a management decision.',
        'HUMAN_REQUIRED'
      );
    }
    if (!DECISIONS.includes(input.decision)) {
      throw new DecisionContextError('Invalid management decision value.', 'INVALID_DECISION');
    }
    if (!recommendationBelongsToEvent(input.recommendationId, input.eventId)) {
      throw new DecisionContextError(
        'Recommendation does not belong to the trusted event.',
        'RECOMMENDATION_NOT_FOUND'
      );
    }
    if (input.decision === 'REJECT' && !input.rationale?.trim()) {
      throw new DecisionContextError('Rationale is required to reject a recommendation.', 'INVALID_DECISION');
    }

    const row = await prisma.m15_management_decisions.create({
      data: {
        organization_id: input.organizationId,
        event_id: input.eventId,
        recommendation_id: input.recommendationId,
        decided_by: input.userId,
        decision: input.decision,
        rationale: input.rationale?.trim() || null,
        source_channel: input.sourceChannel,
        related_scenario_id: input.relatedScenarioId ?? null,
        evidence_snapshot: (input.evidenceSnapshot ?? null) as object | undefined,
        status: 'RECORDED',
      },
    });

    await AuditService.log({
      organization_id: input.organizationId,
      user_id: input.userId,
      action: 'm15.management_decision.recorded',
      model_name: 'm15_management_decisions',
      model_id: row.id,
      new_values: {
        decision: input.decision,
        recommendation_id: input.recommendationId,
        event_id: input.eventId,
        authorizes_execution: false,
      },
    });

    return toRecord(row);
  }

  static async list(organizationId: string, eventId: string): Promise<ManagementDecisionRecord[]> {
    const rows = await prisma.m15_management_decisions.findMany({
      where: { organization_id: organizationId, event_id: eventId },
      orderBy: { created_at: 'desc' },
      take: 100,
    });
    return rows.map(toRecord);
  }
}

function toRecord(row: {
  id: string;
  organization_id: string;
  event_id: string;
  recommendation_id: string;
  decided_by: string;
  decision: string;
  rationale: string | null;
  created_at: Date;
  source_channel: string;
  related_scenario_id: string | null;
  evidence_snapshot: unknown;
  status: string;
}): ManagementDecisionRecord {
  return {
    decisionId: row.id,
    organizationId: row.organization_id,
    eventId: row.event_id,
    recommendationId: row.recommendation_id,
    decidedBy: row.decided_by,
    decision: row.decision as ManagementDecisionValue,
    rationale: row.rationale,
    decidedAt: row.created_at.toISOString(),
    sourceChannel: row.source_channel,
    relatedScenarioId: row.related_scenario_id,
    evidenceSnapshot: row.evidence_snapshot,
    status: 'RECORDED',
    authorizesExecution: false,
    calculationType: 'MANAGEMENT_DECISION',
  };
}
