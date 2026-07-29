/**
 * ReviewService — Planner review of extraction candidates.
 * Every action creates CandidateReviewAction (AI learning signal).
 * Approve → creates permanent Asset + AssetDocumentLink.
 * M7.1 — Digital Plant Builder.
 */

import { prisma } from '@/lib/prisma';
import { randomUUID } from 'crypto';
import { DigitalPlantService } from './DigitalPlantService';

// ── Types ──────────────────────────────────────────

export type ApproveInput = {
  organizationId: string;
  candidateId: string;
  userId: string;
  /** Optional field-level edits before approval */
  edits?: Record<string, string>;
  reviewNotes?: string;
};

export type RejectInput = {
  organizationId: string;
  candidateId: string;
  userId: string;
  reason: string;
};

export type MergeInput = {
  organizationId: string;
  candidateId: string;
  existingAssetId: string;
  userId: string;
  /** Fields to update on the existing asset */
  fieldsToMerge?: Record<string, unknown>;
  reviewNotes?: string;
};

export type EditCandidateInput = {
  organizationId: string;
  candidateId: string;
  userId: string;
  corrections: Record<string, string>;
};

// ── Service ────────────────────────────────────────

export class ReviewService {
  /**
   * Approve a candidate → creates a permanent Asset.
   */
  static async approveCandidate(input: ApproveInput) {
    const candidate = await prisma.extractionCandidate.findFirst({
      where: {
        id: input.candidateId,
        organization_id: input.organizationId,
        status: 'pending_review',
      },
      include: {
        project: {
          select: { site_id: true, plant_id: true, unit_id: true, system_id: true },
        },
        source_document: { select: { id: true } },
      },
    });
    if (!candidate) throw new Error('Candidate not found or already reviewed');

    const attrs = (candidate.extracted_attributes ?? {}) as Record<string, unknown>;

    // Apply edits if provided
    if (input.edits) {
      for (const [field, value] of Object.entries(input.edits)) {
        // Record each edit as a review action
        await prisma.candidateReviewAction.create({
          data: {
            id: randomUUID(),
            candidate_id: input.candidateId,
            user_id: input.userId,
            action: 'edit',
            field_name: field,
            original_value: String(attrs[field] ?? candidate[field as keyof typeof candidate] ?? ''),
            corrected_value: value,
          },
        });
        attrs[field] = value;
      }
    }

    // Create permanent Asset
    const asset = await prisma.asset.create({
      data: {
        organization_id: input.organizationId,
        site_id: candidate.project.site_id,
        plant_id: candidate.project.plant_id,
        unit_id: candidate.project.unit_id,
        system_id: candidate.project.system_id,
        tag_number: input.edits?.tag_number || candidate.tag_number,
        name: (input.edits?.description || candidate.description || candidate.tag_number),
        asset_type: candidate.candidate_type,
        description: candidate.description,
        manufacturer: (attrs.manufacturer as string) || null,
        model_number: (attrs.model as string) || null,
        serial_number: (attrs.serial as string) || null,
        design_pressure_barg: attrs.design_pressure ? Number(attrs.design_pressure) : null,
        design_temp_c: attrs.design_temp ? Number(attrs.design_temp) : null,
        service_description: (attrs.service as string) || null,
        extracted_from_document_id: candidate.source_document.id,
        extraction_confidence: candidate.confidence_score,
        created_by: input.userId,
      },
    });

    // Create AssetDocumentLink (source drawing)
    await prisma.assetDocumentLink.create({
      data: {
        id: randomUUID(),
        asset_id: asset.id,
        document_id: candidate.source_document.id,
        link_type: 'source',
        created_by: input.userId,
      },
    });

    // Record approve action
    await prisma.candidateReviewAction.create({
      data: {
        id: randomUUID(),
        candidate_id: input.candidateId,
        user_id: input.userId,
        action: 'approve',
        confidence_before: candidate.confidence_score,
      },
    });

    // Update candidate status
    await prisma.extractionCandidate.update({
      where: { id: input.candidateId },
      data: {
        status: 'approved',
        approved_asset_id: asset.id,
        reviewed_by: input.userId,
        reviewed_at: new Date(),
        review_notes: input.reviewNotes,
      },
    });

    // Update project counters
    await DigitalPlantService.incrementCounters(candidate.project_id, 'approved_count');

    return { asset, candidate_id: input.candidateId };
  }

  /**
   * Reject a candidate.
   */
  static async rejectCandidate(input: RejectInput) {
    const candidate = await prisma.extractionCandidate.findFirst({
      where: { id: input.candidateId, organization_id: input.organizationId, status: 'pending_review' },
    });
    if (!candidate) throw new Error('Candidate not found or already reviewed');

    await prisma.candidateReviewAction.create({
      data: {
        id: randomUUID(),
        candidate_id: input.candidateId,
        user_id: input.userId,
        action: 'reject',
        reason: input.reason,
        confidence_before: candidate.confidence_score,
      },
    });

    await prisma.extractionCandidate.update({
      where: { id: input.candidateId },
      data: {
        status: 'rejected',
        reviewed_by: input.userId,
        reviewed_at: new Date(),
        review_notes: input.reason,
      },
    });

    await DigitalPlantService.incrementCounters(candidate.project_id, 'rejected_count');

    return { candidate_id: input.candidateId, status: 'rejected' };
  }

  /**
   * Merge candidate into an existing asset.
   */
  static async mergeCandidate(input: MergeInput) {
    const candidate = await prisma.extractionCandidate.findFirst({
      where: { id: input.candidateId, organization_id: input.organizationId, status: 'pending_review' },
      include: { source_document: { select: { id: true } } },
    });
    if (!candidate) throw new Error('Candidate not found or already reviewed');

    const existingAsset = await prisma.asset.findFirst({
      where: { id: input.existingAssetId, organization_id: input.organizationId },
    });
    if (!existingAsset) throw new Error('Target asset not found');

    // Update existing asset with merged fields if provided
    if (input.fieldsToMerge && Object.keys(input.fieldsToMerge).length > 0) {
      await prisma.asset.update({
        where: { id: input.existingAssetId },
        data: input.fieldsToMerge as any,
      });
    }

    // Create AssetDocumentLink (link new drawing to existing asset)
    await prisma.assetDocumentLink.upsert({
      where: {
        asset_id_document_id_link_type: {
          asset_id: input.existingAssetId,
          document_id: candidate.source_document.id,
          link_type: 'source',
        },
      },
      create: {
        id: randomUUID(),
        asset_id: input.existingAssetId,
        document_id: candidate.source_document.id,
        link_type: 'source',
        created_by: input.userId,
      },
      update: {},
    });

    // Record merge action
    await prisma.candidateReviewAction.create({
      data: {
        id: randomUUID(),
        candidate_id: input.candidateId,
        user_id: input.userId,
        action: 'merge',
        original_value: existingAsset.tag_number,
        corrected_value: candidate.tag_number,
        reason: input.reviewNotes,
        confidence_before: candidate.confidence_score,
      },
    });

    // Update candidate
    await prisma.extractionCandidate.update({
      where: { id: input.candidateId },
      data: {
        status: 'merged',
        merge_target_id: input.existingAssetId,
        reviewed_by: input.userId,
        reviewed_at: new Date(),
        review_notes: input.reviewNotes,
      },
    });

    await DigitalPlantService.incrementCounters(candidate.project_id, 'approved_count');

    return { candidate_id: input.candidateId, merged_into_asset: input.existingAssetId };
  }

  /**
   * Edit candidate attributes (corrections tracked for AI learning).
   */
  static async editCandidate(input: EditCandidateInput) {
    const candidate = await prisma.extractionCandidate.findFirst({
      where: { id: input.candidateId, organization_id: input.organizationId },
    });
    if (!candidate) throw new Error('Candidate not found');

    const attrs = (candidate.extracted_attributes ?? {}) as Record<string, unknown>;

    for (const [field, value] of Object.entries(input.corrections)) {
      await prisma.candidateReviewAction.create({
        data: {
          id: randomUUID(),
          candidate_id: input.candidateId,
          user_id: input.userId,
          action: 'edit',
          field_name: field,
          original_value: String(attrs[field] ?? ''),
          corrected_value: value,
        },
      });
      attrs[field] = value;
    }

    // Also allow tag_number and description edits
    const updateData: any = { extracted_attributes: attrs, status: 'edited' as const };
    if (input.corrections.tag_number) updateData.tag_number = input.corrections.tag_number;
    if (input.corrections.description) updateData.description = input.corrections.description;

    await prisma.extractionCandidate.update({
      where: { id: input.candidateId },
      data: updateData,
    });

    return { candidate_id: input.candidateId, corrections_applied: Object.keys(input.corrections).length };
  }

  /**
   * Bulk approve multiple candidates.
   */
  static async bulkApprove(organizationId: string, candidateIds: string[], userId: string) {
    const results = [];
    for (const id of candidateIds) {
      try {
        const result = await ReviewService.approveCandidate({
          organizationId,
          candidateId: id,
          userId,
        });
        results.push({ id, status: 'approved', asset_id: result.asset.id });
      } catch (e: unknown) {
        results.push({ id, status: 'error', error: e instanceof Error ? e.message : String(e) });
      }
    }
    return results;
  }

  /**
   * Bulk reject multiple candidates.
   */
  static async bulkReject(organizationId: string, candidateIds: string[], userId: string, reason: string) {
    const results = [];
    for (const id of candidateIds) {
      try {
        await ReviewService.rejectCandidate({ organizationId, candidateId: id, userId, reason });
        results.push({ id, status: 'rejected' });
      } catch (e: unknown) {
        results.push({ id, status: 'error', error: e instanceof Error ? e.message : String(e) });
      }
    }
    return results;
  }
}
