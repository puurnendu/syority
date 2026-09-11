/**
 * AssetRelationshipService — CRUD for typed engineering connections between assets.
 *
 * NOT for physical containment — use parent_asset_id on Asset for hierarchy.
 * These are engineering connections: connected_to, feeds, protects, mounted_on, etc.
 *
 * Architecture ref: M8.6_ASSET_REGISTER_FINAL_ARCHITECTURE.md §6 (R2.1)
 */

import { prisma } from '@/lib/prisma';
import { AuditService } from '@/lib/audit';

// ── Constants ─────────────────────────────────────────────────────────────────

export const RELATIONSHIP_TYPES = [
  'connected_to',
  'feeds',
  'protects',
  'mounted_on',
  'drives',
  'cools',
  'heats',
  'associated_with',
] as const;

export type RelationshipType = typeof RELATIONSHIP_TYPES[number];

// ── Types ─────────────────────────────────────────────────────────────────────

export type CreateRelationshipInput = {
  organization_id: string;
  source_asset_id: string;
  target_asset_id?: string | null;
  target_line_id?: string | null;
  relationship_type: string;
  description?: string | null;
  nozzle_id?: string | null;
  created_by?: string | null;
};

// ── Service ───────────────────────────────────────────────────────────────────

export class AssetRelationshipService {
  /**
   * Get all relationships for an asset (as source or target).
   * Tenant-scoped: filters by organization_id.
   */
  static async getRelationships(assetId: string, organizationId: string) {
    const [asSource, asTarget] = await Promise.all([
      prisma.assetRelationship.findMany({
        where: { source_asset_id: assetId, organization_id: organizationId, is_active: true },
        include: {
          target_asset: { select: { id: true, tag_number: true, name: true, asset_type: true } },
        },
      }),
      prisma.assetRelationship.findMany({
        where: { target_asset_id: assetId, organization_id: organizationId, is_active: true },
        include: {
          source_asset: { select: { id: true, tag_number: true, name: true, asset_type: true } },
        },
      }),
    ]);

    return { as_source: asSource, as_target: asTarget };
  }

  /**
   * Create a new engineering relationship.
   */
  static async createRelationship(input: CreateRelationshipInput) {
    if (!input.target_asset_id && !input.target_line_id) {
      throw new Error('At least one of target_asset_id or target_line_id must be provided');
    }

    const rel = await prisma.assetRelationship.create({
      data: {
        organization_id: input.organization_id,
        source_asset_id: input.source_asset_id,
        target_asset_id: input.target_asset_id ?? null,
        target_line_id: input.target_line_id ?? null,
        relationship_type: input.relationship_type,
        description: input.description ?? null,
        nozzle_id: input.nozzle_id ?? null,
        created_by: input.created_by ?? null,
      },
    });

    await AuditService.log({
      organization_id: input.organization_id,
      user_id: input.created_by ?? 'system',
      action: 'created',
      model_name: 'AssetRelationship',
      model_id: rel.id,
      new_values: { relationship_type: input.relationship_type, source: input.source_asset_id, target: input.target_asset_id },
    });

    return rel;
  }

  /**
   * Soft-delete a relationship (set is_active = false).
   * Tenant-scoped: verifies organization_id before deletion.
   */
  static async deleteRelationship(relationshipId: string, userId: string, organizationId: string) {
    const existing = await prisma.assetRelationship.findFirst({
      where: { id: relationshipId, organization_id: organizationId },
    });
    if (!existing) throw new Error('Relationship not found');

    const updated = await prisma.assetRelationship.update({
      where: { id: relationshipId },
      data: { is_active: false },
    });

    await AuditService.log({
      organization_id: organizationId,
      user_id: userId,
      action: 'deleted',
      model_name: 'AssetRelationship',
      model_id: relationshipId,
      old_values: { is_active: true },
      new_values: { is_active: false },
    });

    return updated;
  }
}
