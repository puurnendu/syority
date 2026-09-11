/**
 * AssetRegisterService — Core CRUD, verification, and AI review for Asset Register.
 *
 * This is the primary entry point for all Asset Register attribute operations.
 * Delegates immutable history recording to AssetAttributeHistoryService.
 *
 * KEY R2.1 INVARIANTS ENFORCED:
 * - AI NEVER overwrites a verified value
 * - Planner decisions are SEPARATE history rows linked via refers_to_history_id
 * - Original AI extraction rows are NEVER modified
 * - AssetAttributeValue has exactly ONE row per asset+definition pair
 * - Every read/write is tenant-scoped via organization_id
 *
 * Architecture ref: M8.6_ASSET_REGISTER_FINAL_ARCHITECTURE.md §7 (R2.1)
 */

import { prisma } from '@/lib/prisma';
import { AuditService } from '@/lib/audit';
import type { PrismaTransactionClient } from '@/lib/prismaTypes';
import {
  AssetAttributeHistoryService,
  HISTORY_ACTIONS,
  ATTRIBUTE_STATUSES,
  type ValueFields,
  type ProvenanceFields,
  type AiProvenanceFields,
} from './AssetAttributeHistoryService';

// ── Types ─────────────────────────────────────────────────────────────────────

export type SetValueContext = {
  organization_id: string;
  user_id: string;
  source_type: string;
  source_document_id?: string | null;
  source_doc_revision?: string | null;
  source_page?: number | null;
  source_region?: string | null;
  ai_model?: string | null;
  ai_confidence?: number | null;
  extraction_job_id?: string | null;
  reason?: string | null;
};

export type AttributeInput = {
  code: string;
} & ValueFields;

export type ReviewDecision = 'accept' | 'modify' | 'reject';

export type ReviewOpts = {
  corrected_value?: ValueFields;
  reason?: string | null;
};

export type VerifiedAttributeData = {
  value: string | number | boolean | Date | null;
  unit: string | null;
  status: string;
  source_type: string;
  source_document_title: string | null;
  ai_confidence: number | null;
  verified_by_name: string | null;
  verified_at: Date | null;
  has_pending_ai_candidate: boolean;
  history_count: number;
};

export type VerifiedAssetData = {
  id: string;
  tag_number: string;
  name: string;
  asset_type: string | null;
  attributes: Record<string, VerifiedAttributeData>;
  nozzles: any[];
  connected_lines: any[];
  documents: any[];
  children: any[];
  parent: any | null;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractValue(row: ValueFields): string | number | boolean | Date | null {
  if (row.value_number !== null && row.value_number !== undefined) return row.value_number;
  if (row.value_string !== null && row.value_string !== undefined) return row.value_string;
  if (row.value_boolean !== null && row.value_boolean !== undefined) return row.value_boolean;
  if (row.value_date !== null && row.value_date !== undefined) return row.value_date;
  return null;
}

// ── Service ───────────────────────────────────────────────────────────────────

export class AssetRegisterService {
  // ═══════════════════════════════════════════════════════════════════════════
  // TENANT ISOLATION — shared ownership guard
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Verify that the asset belongs to the specified organization.
   * Throws if the asset does not exist or belongs to a different tenant.
   */
  private static async assertAssetOwnership(assetId: string, organizationId: string) {
    const asset = await prisma.asset.findFirst({
      where: { id: assetId, organization_id: organizationId, deleted_at: null },
      select: { id: true, organization_id: true },
    });
    if (!asset) throw new Error('Asset not found');
    return asset;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // getCurrentVerifiedAssetData — the canonical retrieval function (§7)
  // Tenant-scoped: verifies asset ownership before returning data.
  // ═══════════════════════════════════════════════════════════════════════════

  static async getCurrentVerifiedAssetData(assetId: string, organizationId: string): Promise<VerifiedAssetData> {
    // 0. Tenant guard
    await AssetRegisterService.assertAssetOwnership(assetId, organizationId);

    // 1. Get the Asset core data
    const asset = await prisma.asset.findUniqueOrThrow({
      where: { id: assetId },
      include: {
        nozzles: true,
        asset_lines: { include: { line_lists: true } },
        asset_document_links: { include: { document: { select: { id: true, title: true, document_type: true } } } },
        children: { select: { id: true, tag_number: true, name: true, asset_type: true } },
        parent: { select: { id: true, tag_number: true, name: true, asset_type: true } },
      },
    });

    // 2. Get all attribute values (one row per definition)
    const values = await prisma.assetAttributeValue.findMany({
      where: { asset_id: assetId, organization_id: organizationId },
      include: {
        definition: { select: { code: true, name: true, unit: true, group_name: true } },
        _count: { select: { history: true } },
      },
    });

    // 3. Get pending AI extractions using refers_to_history_id join (R2.1)
    const pendingExtractions = await AssetAttributeHistoryService.getPendingAiExtractions(assetId, organizationId);
    const pendingDefinitionIds = new Set(pendingExtractions.map(e => e.definition_id));

    // 4. Build attribute map
    const attributes: Record<string, VerifiedAttributeData> = {};
    for (const val of values) {
      attributes[val.definition.code] = {
        value: extractValue(val),
        unit: val.definition.unit,
        status: val.status,
        source_type: val.source_type,
        source_document_title: null, // Would need document join
        ai_confidence: val.ai_confidence,
        verified_by_name: null, // Would need user join
        verified_at: val.verified_at,
        has_pending_ai_candidate: pendingDefinitionIds.has(val.definition_id),
        history_count: val._count.history,
      };
    }

    return {
      id: asset.id,
      tag_number: asset.tag_number,
      name: asset.name,
      asset_type: asset.asset_type,
      attributes,
      nozzles: (asset as any).nozzles ?? [],
      connected_lines: (asset as any).asset_lines ?? [],
      documents: (asset as any).asset_document_links ?? [],
      children: (asset as any).children ?? [],
      parent: (asset as any).parent ?? null,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ATTRIBUTE CRUD — all tenant-scoped
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get all attribute values for an asset, grouped by definition group.
   * Tenant-scoped: filters by organization_id.
   */
  static async getAttributeValues(assetId: string, organizationId: string) {
    await AssetRegisterService.assertAssetOwnership(assetId, organizationId);

    return prisma.assetAttributeValue.findMany({
      where: { asset_id: assetId, organization_id: organizationId },
      include: {
        definition: true,
        _count: { select: { history: true } },
      },
      orderBy: [
        { definition: { group_sort_order: 'asc' } },
        { definition: { sort_order: 'asc' } },
      ],
    });
  }

  /**
   * Get a single attribute value by code.
   * Tenant-scoped: filters by organization_id.
   */
  static async getAttributeValue(assetId: string, code: string, organizationId: string) {
    await AssetRegisterService.assertAssetOwnership(assetId, organizationId);

    return prisma.assetAttributeValue.findFirst({
      where: {
        asset_id: assetId,
        organization_id: organizationId,
        definition: { code },
      },
      include: { definition: true },
    });
  }

  /**
   * Set a single attribute value (manual entry by user).
   * Creates or updates AssetAttributeValue + inserts history row.
   * Definition lookup is tenant-scoped (platform OR tenant definitions).
   */
  static async setAttributeValue(
    assetId: string,
    code: string,
    value: ValueFields,
    ctx: SetValueContext
  ) {
    // 0. Tenant guard — enforce asset ownership at the service level (defense-in-depth)
    await AssetRegisterService.assertAssetOwnership(assetId, ctx.organization_id);

    // Resolve definition — tenant-scoped (platform + tenant)
    const definition = await prisma.assetAttributeDefinition.findFirst({
      where: {
        code,
        is_active: true,
        OR: [
          { organization_id: null },               // Platform definitions
          { organization_id: ctx.organization_id }, // Tenant definitions
        ],
      },
    });
    if (!definition) throw new Error(`Attribute definition not found: ${code}`);

    // Check for existing value
    const existing = await prisma.assetAttributeValue.findUnique({
      where: { asset_attr_unique: { asset_id: assetId, definition_id: definition.id } },
    });

    // ── AI PROTECTION RULE ──────────────────────────────────────────────
    // If source is AI and existing value is verified, DO NOT overwrite.
    // Only insert a history row for the AI extraction.
    if (ctx.source_type === 'ai_extraction' && existing?.status === ATTRIBUTE_STATUSES.VERIFIED) {
      const historyRow = await AssetAttributeHistoryService.recordAiExtraction({
        organization_id: ctx.organization_id,
        asset_id: assetId,
        definition_id: definition.id,
        value_id: existing.id,
        ...value,
        source_type: ctx.source_type,
        source_document_id: ctx.source_document_id,
        source_doc_revision: ctx.source_doc_revision,
        source_page: ctx.source_page,
        source_region: ctx.source_region,
        ai_model: ctx.ai_model,
        ai_confidence: ctx.ai_confidence,
        extraction_job_id: ctx.extraction_job_id,
        performed_by: ctx.user_id,
        reason: ctx.reason,
      });
      return { value: existing, history: historyRow, pending_review: true };
    }

    // Determine status
    const isAi = ctx.source_type === 'ai_extraction';
    const status = isAi ? ATTRIBUTE_STATUSES.AI_CANDIDATE : ATTRIBUTE_STATUSES.UNVERIFIED;

    // Create or update the value
    const valueRow = await prisma.assetAttributeValue.upsert({
      where: { asset_attr_unique: { asset_id: assetId, definition_id: definition.id } },
      create: {
        organization_id: ctx.organization_id,
        asset_id: assetId,
        definition_id: definition.id,
        ...value,
        source_type: ctx.source_type,
        source_document_id: ctx.source_document_id ?? null,
        source_doc_revision: ctx.source_doc_revision ?? null,
        source_page: ctx.source_page ?? null,
        source_region: ctx.source_region ?? null,
        ai_model: ctx.ai_model ?? null,
        ai_confidence: ctx.ai_confidence ?? null,
        extraction_job_id: ctx.extraction_job_id ?? null,
        status,
        entered_by: ctx.user_id,
      },
      update: {
        ...value,
        source_type: ctx.source_type,
        source_document_id: ctx.source_document_id ?? null,
        source_doc_revision: ctx.source_doc_revision ?? null,
        source_page: ctx.source_page ?? null,
        source_region: ctx.source_region ?? null,
        ai_model: ctx.ai_model ?? null,
        ai_confidence: ctx.ai_confidence ?? null,
        extraction_job_id: ctx.extraction_job_id ?? null,
        status,
      },
    });

    // Record history
    const historyAction = isAi ? HISTORY_ACTIONS.AI_EXTRACTED : HISTORY_ACTIONS.MANUAL_ENTERED;
    const historyFn = isAi
      ? AssetAttributeHistoryService.recordAiExtraction
      : AssetAttributeHistoryService.recordManualEntry;

    const historyRow = await historyFn({
      organization_id: ctx.organization_id,
      asset_id: assetId,
      definition_id: definition.id,
      value_id: valueRow.id,
      ...value,
      source_type: ctx.source_type,
      source_document_id: ctx.source_document_id,
      source_doc_revision: ctx.source_doc_revision,
      source_page: ctx.source_page,
      source_region: ctx.source_region,
      ai_model: ctx.ai_model,
      ai_confidence: ctx.ai_confidence,
      extraction_job_id: ctx.extraction_job_id,
      performed_by: ctx.user_id,
      reason: ctx.reason,
    });

    // Audit log
    await AuditService.log({
      organization_id: ctx.organization_id,
      user_id: ctx.user_id,
      action: existing ? 'updated' : 'created',
      model_name: 'AssetAttributeValue',
      model_id: valueRow.id,
      old_values: existing ? { value: extractValue(existing), status: existing.status } : null,
      new_values: { value: extractValue(valueRow), status: valueRow.status },
    });

    return { value: valueRow, history: historyRow, pending_review: false };
  }

  /**
   * Batch set multiple attribute values for an asset.
   */
  static async batchSetAttributeValues(
    assetId: string,
    values: (AttributeInput & ValueFields)[],
    ctx: SetValueContext
  ) {
    // 0. Early tenant guard
    await AssetRegisterService.assertAssetOwnership(assetId, ctx.organization_id);

    const results = [];
    for (const input of values) {
      const result = await AssetRegisterService.setAttributeValue(
        assetId,
        input.code,
        { value_string: input.value_string, value_number: input.value_number, value_boolean: input.value_boolean, value_date: input.value_date },
        ctx
      );
      results.push(result);
    }
    return results;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // VERIFICATION — tenant-scoped
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Verify a single attribute (non-AI: planner marks an unverified value as verified).
   * Definition lookup is tenant-scoped.
   */
  static async verifyAttribute(
    assetId: string,
    code: string,
    userId: string,
    organizationId: string,
    notes?: string
  ) {
    await AssetRegisterService.assertAssetOwnership(assetId, organizationId);

    // Tenant-scoped definition lookup
    const definition = await prisma.assetAttributeDefinition.findFirst({
      where: {
        code,
        is_active: true,
        OR: [
          { organization_id: null },
          { organization_id: organizationId },
        ],
      },
    });
    if (!definition) throw new Error(`Attribute definition not found: ${code}`);

    const existing = await prisma.assetAttributeValue.findUnique({
      where: { asset_attr_unique: { asset_id: assetId, definition_id: definition.id } },
    });
    if (!existing) throw new Error(`No attribute value exists for ${code} on asset ${assetId}`);

    if (existing.status === ATTRIBUTE_STATUSES.VERIFIED) {
      return existing; // Already verified, no-op
    }

    const updated = await prisma.assetAttributeValue.update({
      where: { id: existing.id },
      data: {
        status: ATTRIBUTE_STATUSES.VERIFIED,
        verified_by: userId,
        verified_at: new Date(),
        verification_notes: notes ?? null,
      },
    });

    await AssetAttributeHistoryService.recordVerification({
      organization_id: organizationId,
      asset_id: assetId,
      definition_id: definition.id,
      value_id: existing.id,
      value_string: existing.value_string,
      value_number: existing.value_number,
      value_boolean: existing.value_boolean,
      value_date: existing.value_date,
      source_type: existing.source_type,
      source_document_id: existing.source_document_id,
      performed_by: userId,
      reason: notes,
    });

    await AuditService.log({
      organization_id: organizationId,
      user_id: userId,
      action: 'updated',
      model_name: 'AssetAttributeValue',
      model_id: existing.id,
      old_values: { status: existing.status },
      new_values: { status: ATTRIBUTE_STATUSES.VERIFIED },
    });

    return updated;
  }

  /**
   * Batch verify multiple attributes.
   */
  static async batchVerifyAttributes(
    assetId: string,
    codes: string[],
    userId: string,
    organizationId: string
  ) {
    const results = [];
    for (const code of codes) {
      const result = await AssetRegisterService.verifyAttribute(assetId, code, userId, organizationId);
      results.push(result);
    }
    return results;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // AI REVIEW — R2.1 CRITICAL PATH
  // Wrapped in $transaction for atomicity (P0-004).
  // Tenant-scoped: verifies history row belongs to organization.
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Review an AI extraction — accept, modify, or reject.
   *
   * R2.1 INVARIANTS:
   * - The original AI extraction history row is NEVER modified.
   * - Accept/modify/reject are SEPARATE INSERT rows linked via refers_to_history_id.
   * - Accept/modify update AssetAttributeValue; reject does NOT.
   * - All operations within a single $transaction — zero global prisma calls escape.
   */
  static async reviewAiExtraction(
    historyId: string,
    decision: ReviewDecision,
    userId: string,
    organizationId: string,
    opts?: ReviewOpts
  ) {
    // 1. Load the AI extraction history row (read-only — we never modify it)
    const aiRow = await prisma.assetAttributeHistory.findUniqueOrThrow({
      where: { id: historyId },
    });

    // Tenant isolation: verify the history row belongs to the caller's organization
    if (aiRow.organization_id !== organizationId) {
      throw new Error('Asset not found');
    }

    if (aiRow.action !== HISTORY_ACTIONS.AI_EXTRACTED) {
      throw new Error(`History row ${historyId} is not an AI extraction (action=${aiRow.action})`);
    }

    // 2. Check if already decided (outside tx — read-only)
    const alreadyDecided = await AssetAttributeHistoryService.hasDecision(historyId);
    if (alreadyDecided) {
      throw new Error(`AI extraction ${historyId} has already been decided`);
    }

    // 3. Determine the value for the decision row
    const decisionValue: ValueFields = decision === 'modify' && opts?.corrected_value
      ? opts.corrected_value
      : { value_string: aiRow.value_string, value_number: aiRow.value_number, value_boolean: aiRow.value_boolean, value_date: aiRow.value_date };

    const actionMap: Record<ReviewDecision, string> = {
      accept: HISTORY_ACTIONS.AI_ACCEPTED,
      modify: HISTORY_ACTIONS.AI_MODIFIED,
      reject: HISTORY_ACTIONS.AI_REJECTED,
    };

    // 4. Execute all mutations inside a single transaction
    await prisma.$transaction(async (tx: PrismaTransactionClient) => {
      // 4a. If accepting or modifying, handle current value
      if (decision === 'accept' || decision === 'modify') {
        const existingValue = await (tx as any).assetAttributeValue.findUnique({
          where: { asset_attr_unique: { asset_id: aiRow.asset_id, definition_id: aiRow.definition_id } },
        });

        // Record superseded if there's an existing verified value
        if (existingValue && existingValue.status === ATTRIBUTE_STATUSES.VERIFIED) {
          await AssetAttributeHistoryService.recordSuperseded({
            organization_id: organizationId,
            asset_id: aiRow.asset_id,
            definition_id: aiRow.definition_id,
            value_id: existingValue.id,
            value_string: existingValue.value_string,
            value_number: existingValue.value_number,
            value_boolean: existingValue.value_boolean,
            value_date: existingValue.value_date,
            source_type: existingValue.source_type,
            source_document_id: existingValue.source_document_id,
            performed_by: userId,
            reason: opts?.reason,
          }, tx);
        }

        // Update AssetAttributeValue with the accepted/modified value
        await (tx as any).assetAttributeValue.upsert({
          where: { asset_attr_unique: { asset_id: aiRow.asset_id, definition_id: aiRow.definition_id } },
          create: {
            organization_id: organizationId,
            asset_id: aiRow.asset_id,
            definition_id: aiRow.definition_id,
            ...decisionValue,
            source_type: decision === 'modify' ? 'manual' : aiRow.source_type,
            source_document_id: aiRow.source_document_id,
            source_doc_revision: aiRow.source_doc_revision,
            status: ATTRIBUTE_STATUSES.VERIFIED,
            entered_by: userId,
            verified_by: userId,
            verified_at: new Date(),
            verification_notes: opts?.reason ?? null,
          },
          update: {
            ...decisionValue,
            source_type: decision === 'modify' ? 'manual' : aiRow.source_type,
            status: ATTRIBUTE_STATUSES.VERIFIED,
            verified_by: userId,
            verified_at: new Date(),
            verification_notes: opts?.reason ?? null,
          },
        });
      }

      // 4b. Record the decision as a SEPARATE history row (R2.1)
      // The original aiRow is UNTOUCHED — this is a NEW row linked via refers_to_history_id
      await AssetAttributeHistoryService.recordAiDecision({
        organization_id: organizationId,
        asset_id: aiRow.asset_id,
        definition_id: aiRow.definition_id,
        action: actionMap[decision] as 'ai_accepted' | 'ai_modified' | 'ai_rejected',
        refers_to_history_id: historyId,
        ...decisionValue,
        source_type: decision === 'modify' ? 'manual' : aiRow.source_type,
        source_document_id: aiRow.source_document_id,
        performed_by: userId,
        reason: opts?.reason,
      }, tx);

      // 4c. Audit log — inside the transaction
      await AuditService.log({
        organization_id: organizationId,
        user_id: userId,
        action: 'updated',
        model_name: 'AssetAttributeHistory',
        model_id: historyId,
        old_values: null,
        new_values: { decision, reason: opts?.reason },
      }, tx);
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HISTORY (delegates to AssetAttributeHistoryService)
  // All tenant-scoped via organizationId.
  // ═══════════════════════════════════════════════════════════════════════════

  static async getAttributeHistory(assetId: string, code: string, organizationId: string) {
    await AssetRegisterService.assertAssetOwnership(assetId, organizationId);

    // Tenant-scoped definition lookup
    const definition = await prisma.assetAttributeDefinition.findFirst({
      where: {
        code,
        is_active: true,
        OR: [
          { organization_id: null },
          { organization_id: organizationId },
        ],
      },
    });
    if (!definition) throw new Error(`Attribute definition not found: ${code}`);
    return AssetAttributeHistoryService.getHistory(assetId, definition.id, organizationId);
  }

  static async getFullAssetHistory(assetId: string, organizationId: string, opts?: { limit?: number; offset?: number }) {
    await AssetRegisterService.assertAssetOwnership(assetId, organizationId);
    return AssetAttributeHistoryService.getFullAssetHistory(assetId, organizationId, opts);
  }

  static async getPendingAiExtractions(assetId: string, organizationId: string) {
    await AssetRegisterService.assertAssetOwnership(assetId, organizationId);
    return AssetAttributeHistoryService.getPendingAiExtractions(assetId, organizationId);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ATTRIBUTE DEFINITIONS — already tenant-scoped
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get attribute definitions filtered by equipment type.
   * Returns platform-level + organization-level definitions.
   */
  static async getAttributeDefinitions(organizationId: string, equipmentType?: string) {
    const where: any = {
      is_active: true,
      OR: [
        { organization_id: null },          // Platform scope
        { organization_id: organizationId }, // Tenant scope
      ],
    };

    if (equipmentType) {
      where.OR = where.OR.map((clause: any) => ({
        ...clause,
        OR: [
          { equipment_types: { has: equipmentType } },
          { equipment_types: { isEmpty: true } },  // empty = all types
        ],
      }));
    }

    return prisma.assetAttributeDefinition.findMany({
      where,
      orderBy: [{ group_sort_order: 'asc' }, { sort_order: 'asc' }],
    });
  }

  /**
   * Create a new attribute definition (tenant-scoped).
   */
  static async createAttributeDefinition(data: {
    organization_id: string;
    code: string;
    name: string;
    data_type: string;
    unit?: string;
    equipment_types?: string[];
    group_name?: string;
    group_sort_order?: number;
    sort_order?: number;
    is_required?: boolean;
    is_design_basis?: boolean;
    validation_rule?: any;
    select_options?: any;
    description?: string;
    created_by?: string;
  }) {
    return prisma.assetAttributeDefinition.create({
      data: {
        organization_id: data.organization_id,
        code: data.code,
        name: data.name,
        description: data.description ?? null,
        data_type: data.data_type,
        unit: data.unit ?? null,
        equipment_types: data.equipment_types ?? [],
        group_name: data.group_name ?? null,
        group_sort_order: data.group_sort_order ?? 0,
        sort_order: data.sort_order ?? 0,
        is_required: data.is_required ?? false,
        is_design_basis: data.is_design_basis ?? false,
        validation_rule: data.validation_rule ?? undefined,
        select_options: data.select_options ?? undefined,
        scope: 'TENANT',
        created_by: data.created_by ?? null,
      },
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SEARCH — unified Asset Register search
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Search assets with combined full-text + attribute-level filters.
   *
   * @example searchAssets(orgId, { q: 'E-101', attribute_filters: [{ code: 'shell_design_press_barg', op: 'gte', value: 10 }] })
   */
  static async searchAssets(
    organizationId: string,
    opts: {
      q?: string;
      asset_type?: string;
      system_id?: string;
      attribute_filters?: Array<{ code: string; op: 'eq' | 'gt' | 'gte' | 'lt' | 'lte'; value: number | string }>;
      limit?: number;
      offset?: number;
    } = {}
  ) {
    const { q, asset_type, system_id, attribute_filters = [], limit = 50, offset = 0 } = opts;

    const where: any = {
      organization_id: organizationId,
      deleted_at: null,
    };

    // Full-text filter on tag_number / name / description
    if (q) {
      where.OR = [
        { tag_number: { contains: q, mode: 'insensitive' } },
        { name: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
      ];
    }

    if (asset_type) where.asset_type = asset_type;
    if (system_id) where.system_id = system_id;

    // Attribute-level filters via EAV
    if (attribute_filters.length > 0) {
      where.AND = where.AND || [];
      for (const af of attribute_filters) {
        const attrWhere: any = {
          definition: { code: af.code },
        };

        // Determine which value field to filter on
        if (typeof af.value === 'number') {
          const prismaOp = af.op === 'eq' ? 'equals' : af.op === 'gt' ? 'gt' : af.op === 'gte' ? 'gte' : af.op === 'lt' ? 'lt' : 'lte';
          attrWhere.value_number = { [prismaOp]: af.value };
        } else {
          attrWhere.value_string = { equals: af.value, mode: 'insensitive' };
        }

        where.AND.push({
          attribute_values: { some: attrWhere },
        });
      }
    }

    const [assets, total] = await Promise.all([
      prisma.asset.findMany({
        where,
        include: {
          attribute_values: {
            where: { status: 'verified' },
            include: { definition: { select: { code: true, name: true, unit: true } } },
          },
        },
        take: Math.min(limit, 100),
        skip: offset,
        orderBy: { tag_number: 'asc' },
      }),
      prisma.asset.count({ where }),
    ]);

    return { assets, total, limit, offset };
  }
}
