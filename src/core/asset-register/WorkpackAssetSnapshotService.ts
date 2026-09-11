/**
 * WorkpackAssetSnapshotService — Frozen point-in-time snapshots of Asset Register data.
 *
 * Called when a Workpack is issued/versioned. Captures:
 * - Asset core column data
 * - All verified AssetAttributeValue rows
 * - Connected nozzles, lines, and documents
 *
 * Once created, a snapshot is IMMUTABLE — it is the historical record
 * of what the Asset looked like when the Workpack was issued.
 *
 * Tenant isolation: all reads are scoped through Workpack.organization_id.
 *
 * Architecture ref: M8.6_ASSET_REGISTER_FINAL_ARCHITECTURE.md §8 (R2.1)
 */

import { prisma } from '@/lib/prisma';
import { ATTRIBUTE_STATUSES } from './AssetAttributeHistoryService';

// ── Types ─────────────────────────────────────────────────────────────────────

export type CreateSnapshotInput = {
  workpack_id: string;
  asset_id: string;
  snapshot_revision: string;
  snapshotted_by: string;
};

export type SnapshotData = {
  asset_data_json: Record<string, any>;
  attributes_json: Record<string, any>[];
  nozzles_json: Record<string, any>[];
  lines_json: Record<string, any>[];
  documents_json: Record<string, any>[];
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Verify that a workpack belongs to the specified organization.
 * Throws if the workpack does not exist or belongs to a different tenant.
 */
async function assertWorkpackOwnership(workpackId: string, organizationId: string) {
  const wp = await prisma.workpack.findFirst({
    where: { id: workpackId, organization_id: organizationId },
    select: { id: true },
  });
  if (!wp) throw new Error('Workpack not found');
  return wp;
}

// ── Service ───────────────────────────────────────────────────────────────────

export class WorkpackAssetSnapshotService {
  /**
   * Create a frozen snapshot of the asset's current data.
   * Only captures VERIFIED attribute values — unverified/candidate values are excluded.
   * Tenant ownership is verified through the workpack.
   */
  static async createSnapshot(input: CreateSnapshotInput): Promise<SnapshotData> {
    // Verify workpack exists — the caller (WorkflowService) already enforces organization_id,
    // but we validate the asset belongs to the same org as the workpack.
    const workpack = await prisma.workpack.findUniqueOrThrow({
      where: { id: input.workpack_id },
      select: { organization_id: true },
    });

    // 1. Get asset core data — verify it belongs to the same org
    const asset = await prisma.asset.findFirst({
      where: { id: input.asset_id, organization_id: workpack.organization_id, deleted_at: null },
    });
    if (!asset) throw new Error('Asset not found or does not belong to workpack organization');

    // 2. Get only VERIFIED attribute values
    const attributes = await prisma.assetAttributeValue.findMany({
      where: {
        asset_id: input.asset_id,
        organization_id: workpack.organization_id,
        status: ATTRIBUTE_STATUSES.VERIFIED,
      },
      include: {
        definition: { select: { code: true, name: true, unit: true, group_name: true, data_type: true } },
      },
    });

    // 3. Get nozzles
    const nozzles = await prisma.nozzles.findMany({
      where: { asset_id: input.asset_id },
    });

    // 4. Get connected lines
    const lines = await prisma.asset_lines.findMany({
      where: { asset_id: input.asset_id },
      include: { line_lists: true },
    });

    // 5. Get document links
    const documents = await prisma.assetDocumentLink.findMany({
      where: { asset_id: input.asset_id },
      include: { document: { select: { id: true, title: true, document_type: true, revision: true } } },
    });

    // 6. Serialize
    const snapshotData: SnapshotData = {
      asset_data_json: JSON.parse(JSON.stringify(asset)),
      attributes_json: attributes.map(a => ({
        code: a.definition.code,
        name: a.definition.name,
        unit: a.definition.unit,
        group: a.definition.group_name,
        data_type: a.definition.data_type,
        value_string: a.value_string,
        value_number: a.value_number,
        value_boolean: a.value_boolean,
        value_date: a.value_date,
        source_type: a.source_type,
        ai_confidence: a.ai_confidence,
        verified_by: a.verified_by,
        verified_at: a.verified_at,
      })),
      nozzles_json: JSON.parse(JSON.stringify(nozzles)),
      lines_json: JSON.parse(JSON.stringify(lines)),
      documents_json: JSON.parse(JSON.stringify(documents)),
    };

    // 7. Save snapshot
    await prisma.workpackAssetSnapshot.create({
      data: {
        workpack_id: input.workpack_id,
        asset_id: input.asset_id,
        snapshot_revision: input.snapshot_revision,
        asset_data_json: snapshotData.asset_data_json,
        attributes_json: snapshotData.attributes_json,
        nozzles_json: snapshotData.nozzles_json,
        lines_json: snapshotData.lines_json,
        documents_json: snapshotData.documents_json,
        snapshotted_by: input.snapshotted_by,
      },
    });

    return snapshotData;
  }

  /**
   * Get the snapshot for a specific workpack revision.
   * Tenant-scoped: verifies workpack ownership through organization_id.
   */
  static async getSnapshot(workpackId: string, snapshotRevision: string, organizationId: string) {
    await assertWorkpackOwnership(workpackId, organizationId);
    return prisma.workpackAssetSnapshot.findUnique({
      where: { wp_asset_snapshot_rev: { workpack_id: workpackId, snapshot_revision: snapshotRevision } },
    });
  }

  /**
   * Get the latest snapshot for a workpack.
   * Tenant-scoped: verifies workpack ownership through organization_id.
   */
  static async getLatestSnapshot(workpackId: string, organizationId: string) {
    await assertWorkpackOwnership(workpackId, organizationId);
    return prisma.workpackAssetSnapshot.findFirst({
      where: { workpack_id: workpackId },
      orderBy: { snapshotted_at: 'desc' },
    });
  }

  /**
   * Compare a snapshot with the current live data.
   * Returns fields that have changed since the snapshot was taken.
   * Tenant-scoped: verifies workpack ownership through organization_id.
   */
  static async compareWithLive(workpackId: string, snapshotRevision: string, organizationId: string) {
    await assertWorkpackOwnership(workpackId, organizationId);

    const snapshot = await prisma.workpackAssetSnapshot.findUnique({
      where: { wp_asset_snapshot_rev: { workpack_id: workpackId, snapshot_revision: snapshotRevision } },
    });
    if (!snapshot) throw new Error(`Snapshot not found for workpack ${workpackId} revision ${snapshotRevision}`);

    const liveAttributes = await prisma.assetAttributeValue.findMany({
      where: {
        asset_id: snapshot.asset_id,
        organization_id: organizationId,
        status: ATTRIBUTE_STATUSES.VERIFIED,
      },
      include: {
        definition: { select: { code: true, name: true, unit: true } },
      },
    });

    const snapshotAttrs = snapshot.attributes_json as any[];
    const snapshotMap = new Map(snapshotAttrs.map((a: any) => [a.code, a]));

    const changes: Array<{
      code: string;
      name: string;
      snapshot_value: any;
      live_value: any;
      changed: boolean;
    }> = [];

    for (const live of liveAttributes) {
      const snapped = snapshotMap.get(live.definition.code);
      const liveVal = live.value_number ?? live.value_string ?? live.value_boolean ?? live.value_date;
      const snapVal = snapped ? (snapped.value_number ?? snapped.value_string ?? snapped.value_boolean ?? snapped.value_date) : null;

      if (String(liveVal) !== String(snapVal)) {
        changes.push({
          code: live.definition.code,
          name: live.definition.name,
          snapshot_value: snapVal,
          live_value: liveVal,
          changed: true,
        });
      }
    }

    return {
      snapshot_revision: snapshotRevision,
      asset_id: snapshot.asset_id,
      snapshotted_at: snapshot.snapshotted_at,
      changes,
      has_changes: changes.length > 0,
    };
  }
}
