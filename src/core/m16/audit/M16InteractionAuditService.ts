/**
 * M16 — Interaction Audit Service
 *
 * Records every governed M16 interaction to the m16_interaction_logs table.
 *
 * PURPOSE:
 *   Records the INTERACTION and GOVERNANCE DECISION — not a second
 *   execution/progress source. Does NOT duplicate:
 *   - AuditLog authority
 *   - ProgressLog authority
 *   - Execution history authority
 *
 * AUTHORITY:
 *   This is the ONLY Prisma write in M16 code (besides whatsapp_sessions.event_id).
 *   M16 does NOT write to activity, workpack, progress_log, or any domain table.
 */

import { prisma } from '@/lib/prisma';
import type { M16InteractionContext, AuthorizationResult, M16ResolvedEntities } from '../types';
import type { M16Intent, M16IntentCategory } from '../intents';
import type { ActionRiskLevel } from '../risk';

// ── Log Entry ─────────────────────────────────────────────────────────────────

export interface M16InteractionLogEntry {
  /** Trusted context */
  ctx: M16InteractionContext;
  /** Classified intent */
  intent: M16Intent | null;
  intentCategory: M16IntentCategory | null;
  /** Original user message (for audit trail) */
  rawMessage: string | null;
  /** Resolved entities */
  resolvedEntities: M16ResolvedEntities | null;
  /** Risk classification */
  riskLevel: ActionRiskLevel | null;
  /** Authorization result */
  authorization: 'authorized' | 'denied' | 'not_required';
  deniedReason: string | null;
  /** Confirmation state */
  confirmation: 'not_required' | 'pending' | 'confirmed' | 'rejected' | null;
  /** Interaction result */
  result: 'success' | 'failure' | 'ambiguous' | 'rejected';
  resultDetail: string | null;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Log an M16 interaction to the audit table.
 *
 * This is the ONLY Prisma mutation in M16 core code (besides session event_id).
 */
export async function logInteraction(entry: M16InteractionLogEntry): Promise<string> {
  const record = await prisma.m16_interaction_logs.create({
    data: {
      organization_id: entry.ctx.organizationId,
      user_id: entry.ctx.userId,
      event_id: entry.ctx.eventId,
      channel: entry.ctx.channel,
      conversation_id: entry.ctx.conversationId,
      message_id: entry.ctx.messageId,
      intent: entry.intent,
      intent_category: entry.intentCategory,
      raw_message: entry.rawMessage,
      resolved_entity: entry.resolvedEntities ? serializeEntities(entry.resolvedEntities) : null,
      action_risk_level: entry.riskLevel,
      authorization: entry.authorization,
      denied_reason: entry.deniedReason,
      confirmation: entry.confirmation,
      result: entry.result,
      result_detail: entry.resultDetail,
      identity_source: entry.ctx.identitySource,
      source_channel: entry.ctx.channel,
    },
  });

  return record.id;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function serializeEntities(entities: M16ResolvedEntities): object {
  return {
    equipment: entities.equipment
      ? {
          outcome: entities.equipment.outcome,
          assetId: entities.equipment.assetId || null,
          tagNumber: entities.equipment.tagNumber || null,
        }
      : null,
    workpack: entities.workpack
      ? {
          outcome: entities.workpack.outcome,
          workpackId: entities.workpack.workpackId || null,
          workpackNumber: entities.workpack.workpackNumber || null,
        }
      : null,
    activity: entities.activity
      ? {
          outcome: entities.activity.outcome,
          activityId: entities.activity.activityId || null,
          activityNumber: entities.activity.activityNumber || null,
        }
      : null,
  };
}
