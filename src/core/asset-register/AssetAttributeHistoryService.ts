/**
 * AssetAttributeHistoryService — Strict Append-Only History
 *
 * R2.1 INVARIANT: No row in asset_attribute_history is EVER updated or deleted.
 * This service has ZERO update() or delete() calls — by design.
 *
 * Every event — AI extraction, planner decision, manual entry, verification,
 * superseded — is recorded as a separate immutable row.
 *
 * Planner decisions about AI extractions are linked via refers_to_history_id.
 *
 * Architecture ref: M8.6_ASSET_REGISTER_FINAL_ARCHITECTURE.md §3 (R2.1)
 */

import { prisma } from '@/lib/prisma';
import type { PrismaTransactionClient } from '@/lib/prismaTypes';

// ── Action Constants ──────────────────────────────────────────────────────────

export const HISTORY_ACTIONS = {
  AI_EXTRACTED:   'ai_extracted',
  AI_ACCEPTED:    'ai_accepted',
  AI_MODIFIED:    'ai_modified',
  AI_REJECTED:    'ai_rejected',
  MANUAL_ENTERED: 'manual_entered',
  VERIFIED:       'verified',
  SUPERSEDED:     'superseded',
} as const;

export type HistoryAction = typeof HISTORY_ACTIONS[keyof typeof HISTORY_ACTIONS];

// ── Status Constants ──────────────────────────────────────────────────────────

export const ATTRIBUTE_STATUSES = {
  UNVERIFIED:    'unverified',
  AI_CANDIDATE:  'ai_candidate',
  VERIFIED:      'verified',
} as const;

export type AttributeStatus = typeof ATTRIBUTE_STATUSES[keyof typeof ATTRIBUTE_STATUSES];

// ── Input Types ───────────────────────────────────────────────────────────────

export type ValueFields = {
  value_string?: string | null;
  value_number?: number | null;
  value_boolean?: boolean | null;
  value_date?: Date | null;
};

export type ProvenanceFields = {
  source_type: string;
  source_document_id?: string | null;
  source_doc_revision?: string | null;
  source_page?: number | null;
  source_region?: string | null;
};

export type AiProvenanceFields = {
  ai_model?: string | null;
  ai_confidence?: number | null;
  extraction_job_id?: string | null;
};

export type RecordAiExtractionInput = {
  organization_id: string;
  asset_id: string;
  definition_id: string;
  value_id?: string | null;
  performed_by: string;
  reason?: string | null;
} & ValueFields & ProvenanceFields & AiProvenanceFields;

export type RecordAiDecisionInput = {
  organization_id: string;
  asset_id: string;
  definition_id: string;
  value_id?: string | null;
  action: 'ai_accepted' | 'ai_modified' | 'ai_rejected';
  refers_to_history_id: string;
  performed_by: string;
  reason?: string | null;
} & ValueFields & ProvenanceFields;

export type RecordManualEntryInput = {
  organization_id: string;
  asset_id: string;
  definition_id: string;
  value_id?: string | null;
  performed_by: string;
  reason?: string | null;
} & ValueFields & ProvenanceFields;

export type RecordVerificationInput = {
  organization_id: string;
  asset_id: string;
  definition_id: string;
  value_id?: string | null;
  performed_by: string;
  reason?: string | null;
} & ValueFields & ProvenanceFields;

export type RecordSupersededInput = {
  organization_id: string;
  asset_id: string;
  definition_id: string;
  value_id?: string | null;
  performed_by: string;
  reason?: string | null;
} & ValueFields & ProvenanceFields;

// ── Service ───────────────────────────────────────────────────────────────────

export class AssetAttributeHistoryService {
  // ═══════════════════════════════════════════════════════════════════════════
  // INSERT-ONLY METHODS — no update(), no delete(), no updateMany()
  // All write methods accept an optional `db` parameter for transaction support.
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Record an AI extraction event.
   * This is always the FIRST event for a new AI-extracted value.
   * refers_to_history_id is always null (this IS the original event).
   */
  static async recordAiExtraction(input: RecordAiExtractionInput, db: PrismaTransactionClient = prisma) {
    return (db as any).assetAttributeHistory.create({
      data: {
        organization_id:      input.organization_id,
        asset_id:             input.asset_id,
        definition_id:        input.definition_id,
        value_id:             input.value_id ?? null,
        // Value
        value_string:         input.value_string ?? null,
        value_number:         input.value_number ?? null,
        value_boolean:        input.value_boolean ?? null,
        value_date:           input.value_date ?? null,
        // Provenance
        source_type:          input.source_type,
        source_document_id:   input.source_document_id ?? null,
        source_doc_revision:  input.source_doc_revision ?? null,
        source_page:          input.source_page ?? null,
        source_region:        input.source_region ?? null,
        // AI fields
        ai_model:             input.ai_model ?? null,
        ai_confidence:        input.ai_confidence ?? null,
        extraction_job_id:    input.extraction_job_id ?? null,
        // Action
        action:               HISTORY_ACTIONS.AI_EXTRACTED,
        status_at_time:       ATTRIBUTE_STATUSES.AI_CANDIDATE,
        // Linkage — null for original events
        refers_to_history_id: null,
        // Who
        performed_by:         input.performed_by,
        reason:               input.reason ?? null,
      },
    });
  }

  /**
   * Record a planner decision about an AI extraction.
   * ALWAYS a separate row — the original AI extraction row is NEVER modified.
   * refers_to_history_id MUST point to the original ai_extracted row.
   */
  static async recordAiDecision(input: RecordAiDecisionInput, db: PrismaTransactionClient = prisma) {
    if (!input.refers_to_history_id) {
      throw new Error('R2.1 violation: AI decision must reference the original AI extraction via refers_to_history_id');
    }

    const statusAtTime = input.action === HISTORY_ACTIONS.AI_REJECTED
      ? ATTRIBUTE_STATUSES.AI_CANDIDATE   // rejected values stay as candidate
      : ATTRIBUTE_STATUSES.VERIFIED;      // accepted/modified → verified

    return (db as any).assetAttributeHistory.create({
      data: {
        organization_id:      input.organization_id,
        asset_id:             input.asset_id,
        definition_id:        input.definition_id,
        value_id:             input.value_id ?? null,
        // Value — for ai_modified this is the CORRECTED value
        value_string:         input.value_string ?? null,
        value_number:         input.value_number ?? null,
        value_boolean:        input.value_boolean ?? null,
        value_date:           input.value_date ?? null,
        // Provenance
        source_type:          input.source_type,
        source_document_id:   input.source_document_id ?? null,
        source_doc_revision:  input.source_doc_revision ?? null,
        source_page:          input.source_page ?? null,
        source_region:        input.source_region ?? null,
        // AI fields — null for decision events (AI metadata lives on the original extraction)
        ai_model:             null,
        ai_confidence:        null,
        extraction_job_id:    null,
        // Action
        action:               input.action,
        status_at_time:       statusAtTime,
        // Linkage — MUST point to the AI extraction being decided
        refers_to_history_id: input.refers_to_history_id,
        // Who
        performed_by:         input.performed_by,
        reason:               input.reason ?? null,
      },
    });
  }

  /**
   * Record a manual entry event (non-AI, direct user input).
   */
  static async recordManualEntry(input: RecordManualEntryInput, db: PrismaTransactionClient = prisma) {
    return (db as any).assetAttributeHistory.create({
      data: {
        organization_id:      input.organization_id,
        asset_id:             input.asset_id,
        definition_id:        input.definition_id,
        value_id:             input.value_id ?? null,
        value_string:         input.value_string ?? null,
        value_number:         input.value_number ?? null,
        value_boolean:        input.value_boolean ?? null,
        value_date:           input.value_date ?? null,
        source_type:          input.source_type,
        source_document_id:   input.source_document_id ?? null,
        source_doc_revision:  input.source_doc_revision ?? null,
        source_page:          input.source_page ?? null,
        source_region:        input.source_region ?? null,
        ai_model:             null,
        ai_confidence:        null,
        extraction_job_id:    null,
        action:               HISTORY_ACTIONS.MANUAL_ENTERED,
        status_at_time:       ATTRIBUTE_STATUSES.UNVERIFIED,
        refers_to_history_id: null,
        performed_by:         input.performed_by,
        reason:               input.reason ?? null,
      },
    });
  }

  /**
   * Record a verification event (planner verifies a non-AI value).
   */
  static async recordVerification(input: RecordVerificationInput, db: PrismaTransactionClient = prisma) {
    return (db as any).assetAttributeHistory.create({
      data: {
        organization_id:      input.organization_id,
        asset_id:             input.asset_id,
        definition_id:        input.definition_id,
        value_id:             input.value_id ?? null,
        value_string:         input.value_string ?? null,
        value_number:         input.value_number ?? null,
        value_boolean:        input.value_boolean ?? null,
        value_date:           input.value_date ?? null,
        source_type:          input.source_type,
        source_document_id:   input.source_document_id ?? null,
        source_doc_revision:  input.source_doc_revision ?? null,
        source_page:          input.source_page ?? null,
        source_region:        input.source_region ?? null,
        ai_model:             null,
        ai_confidence:        null,
        extraction_job_id:    null,
        action:               HISTORY_ACTIONS.VERIFIED,
        status_at_time:       ATTRIBUTE_STATUSES.VERIFIED,
        refers_to_history_id: null,
        performed_by:         input.performed_by,
        reason:               input.reason ?? null,
      },
    });
  }

  /**
   * Record a superseded event (old verified value being replaced).
   */
  static async recordSuperseded(input: RecordSupersededInput, db: PrismaTransactionClient = prisma) {
    return (db as any).assetAttributeHistory.create({
      data: {
        organization_id:      input.organization_id,
        asset_id:             input.asset_id,
        definition_id:        input.definition_id,
        value_id:             input.value_id ?? null,
        value_string:         input.value_string ?? null,
        value_number:         input.value_number ?? null,
        value_boolean:        input.value_boolean ?? null,
        value_date:           input.value_date ?? null,
        source_type:          input.source_type,
        source_document_id:   input.source_document_id ?? null,
        source_doc_revision:  input.source_doc_revision ?? null,
        source_page:          input.source_page ?? null,
        source_region:        input.source_region ?? null,
        ai_model:             null,
        ai_confidence:        null,
        extraction_job_id:    null,
        action:               HISTORY_ACTIONS.SUPERSEDED,
        status_at_time:       ATTRIBUTE_STATUSES.VERIFIED,
        refers_to_history_id: null,
        performed_by:         input.performed_by,
        reason:               input.reason ?? null,
      },
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // READ-ONLY METHODS — all tenant-scoped via organization_id
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get full history for a specific attribute on a specific asset.
   * Ordered newest-first for UI display.
   * Tenant-scoped: only returns rows matching organizationId.
   */
  static async getHistory(assetId: string, definitionId: string, organizationId: string) {
    return prisma.assetAttributeHistory.findMany({
      where: { asset_id: assetId, definition_id: definitionId, organization_id: organizationId },
      orderBy: { performed_at: 'desc' },
    });
  }

  /**
   * Get full history for ALL attributes on a specific asset.
   * Ordered newest-first for the asset-wide history timeline.
   * Tenant-scoped: only returns rows matching organizationId.
   */
  static async getFullAssetHistory(assetId: string, organizationId: string, opts?: { limit?: number; offset?: number }) {
    return prisma.assetAttributeHistory.findMany({
      where: { asset_id: assetId, organization_id: organizationId },
      orderBy: { performed_at: 'desc' },
      take: opts?.limit ?? 100,
      skip: opts?.offset ?? 0,
      include: {
        definition: { select: { code: true, name: true, unit: true, group_name: true } },
      },
    });
  }

  /**
   * Find AI extractions that have NO decision row yet (pending planner review).
   * Uses the refers_to_history_id join pattern — NOT planner_decision field (R2.1).
   *
   * Logic: Find all ai_extracted rows WHERE there is NO row with
   * action IN (ai_accepted, ai_modified, ai_rejected)
   * AND refers_to_history_id = this.id
   *
   * Tenant-scoped: only returns rows matching organizationId.
   */
  static async getPendingAiExtractions(assetId: string, organizationId: string) {
    // Get all ai_extracted history rows for this asset
    const aiExtractions = await prisma.assetAttributeHistory.findMany({
      where: {
        asset_id: assetId,
        organization_id: organizationId,
        action: HISTORY_ACTIONS.AI_EXTRACTED,
      },
      orderBy: { performed_at: 'desc' },
      include: {
        definition: { select: { code: true, name: true, unit: true, group_name: true } },
      },
    });

    if (aiExtractions.length === 0) return [];

    // Get all decision rows that reference any of these extractions
    const extractionIds = aiExtractions.map(e => e.id);
    const decisions = await prisma.assetAttributeHistory.findMany({
      where: {
        refers_to_history_id: { in: extractionIds },
        action: { in: [HISTORY_ACTIONS.AI_ACCEPTED, HISTORY_ACTIONS.AI_MODIFIED, HISTORY_ACTIONS.AI_REJECTED] },
      },
      select: { refers_to_history_id: true },
    });

    const decidedIds = new Set(decisions.map(d => d.refers_to_history_id));

    // Return only extractions that have NO decision
    return aiExtractions.filter(e => !decidedIds.has(e.id));
  }

  /**
   * Check if a specific AI extraction has been decided.
   * Accepts optional `db` parameter for transaction support.
   */
  static async hasDecision(aiExtractionHistoryId: string, db: PrismaTransactionClient = prisma): Promise<boolean> {
    const decision = await (db as any).assetAttributeHistory.findFirst({
      where: {
        refers_to_history_id: aiExtractionHistoryId,
        action: { in: [HISTORY_ACTIONS.AI_ACCEPTED, HISTORY_ACTIONS.AI_MODIFIED, HISTORY_ACTIONS.AI_REJECTED] },
      },
      select: { id: true },
    });
    return decision !== null;
  }
}
