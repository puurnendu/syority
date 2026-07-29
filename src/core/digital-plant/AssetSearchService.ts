/**
 * AssetSearchService — Cross-entity search across assets, documents, and tags.
 * M7.1 — Digital Plant Builder.
 */

import { prisma } from '@/lib/prisma';

// ── Types ──────────────────────────────────────────

export type SearchInput = {
  organizationId: string;
  query: string;
  assetType?: string;
  siteId?: string;
  plantId?: string;
  unitId?: string;
  systemId?: string;
  page?: number;
  pageSize?: number;
};

export type SearchResult = {
  assets: AssetSearchHit[];
  total: number;
  page: number;
  pageSize: number;
};

type AssetSearchHit = {
  id: string;
  tag_number: string;
  name: string;
  asset_type: string | null;
  description: string | null;
  manufacturer: string | null;
  model_number: string | null;
  site_name: string;
  plant_name: string | null;
  unit_name: string | null;
  system_name: string | null;
  document_count: number;
  created_at: Date;
};

// ── Service ────────────────────────────────────────

export class AssetSearchService {
  /**
   * Full-text search across asset fields.
   */
  static async searchAssets(input: SearchInput): Promise<SearchResult> {
    const page = input.page ?? 1;
    const pageSize = Math.min(input.pageSize ?? 25, 100);

    const where: any = {
      organization_id: input.organizationId,
      deleted_at: null,
    };

    // Hierarchy filters
    if (input.siteId) where.site_id = input.siteId;
    if (input.plantId) where.plant_id = input.plantId;
    if (input.unitId) where.unit_id = input.unitId;
    if (input.systemId) where.system_id = input.systemId;
    if (input.assetType) where.asset_type = input.assetType;

    // Text search across multiple fields
    if (input.query) {
      where.OR = [
        { tag_number: { contains: input.query, mode: 'insensitive' } },
        { name: { contains: input.query, mode: 'insensitive' } },
        { description: { contains: input.query, mode: 'insensitive' } },
        { manufacturer: { contains: input.query, mode: 'insensitive' } },
        { model_number: { contains: input.query, mode: 'insensitive' } },
        { serial_number: { contains: input.query, mode: 'insensitive' } },
        { service_description: { contains: input.query, mode: 'insensitive' } },
        { sap_equipment_number: { contains: input.query, mode: 'insensitive' } },
        { ga_drawing_number: { contains: input.query, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.asset.findMany({
        where,
        include: {
          Site: { select: { name: true } },
          plant: { select: { name: true } },
          unit: { select: { name: true } },
          system: { select: { name: true } },
          _count: { select: { asset_document_links: true } },
        },
        orderBy: { tag_number: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.asset.count({ where }),
    ]);

    const assets: AssetSearchHit[] = items.map((a) => ({
      id: a.id,
      tag_number: a.tag_number,
      name: a.name,
      asset_type: a.asset_type,
      description: a.description,
      manufacturer: a.manufacturer,
      model_number: a.model_number,
      site_name: a.Site.name,
      plant_name: a.plant?.name ?? null,
      unit_name: a.unit?.name ?? null,
      system_name: a.system?.name ?? null,
      document_count: a._count.asset_document_links,
      created_at: a.created_at,
    }));

    return { assets, total, page, pageSize };
  }

  /**
   * Get a single asset with all linked documents (Document Intelligence).
   */
  static async getAssetWithDocuments(organizationId: string, assetId: string) {
    const asset = await prisma.asset.findFirst({
      where: { id: assetId, organization_id: organizationId, deleted_at: null },
      include: {
        Site: { select: { id: true, name: true, code: true } },
        plant: { select: { id: true, name: true, code: true } },
        unit: { select: { id: true, name: true, code: true } },
        system: { select: { id: true, name: true, code: true } },
        nozzles: { where: { deleted_at: null }, orderBy: { sequence_number: 'asc' } },
        asset_document_links: {
          include: {
            document: {
              select: {
                id: true,
                document_type: true,
                drawing_number: true,
                title: true,
                revision: true,
                discipline: true,
                original_filename: true,
                storage_path: true,
                created_at: true,
              },
            },
          },
          orderBy: { created_at: 'desc' },
        },
      },
    });
    if (!asset) return null;

    // Group documents by type
    const documentsByType: Record<string, typeof asset.asset_document_links> = {};
    for (const link of asset.asset_document_links) {
      const type = link.link_type;
      if (!documentsByType[type]) documentsByType[type] = [];
      documentsByType[type].push(link);
    }

    return {
      ...asset,
      documents_by_type: documentsByType,
      total_documents: asset.asset_document_links.length,
    };
  }

  /**
   * Get distinct asset types for faceted search.
   */
  static async getAssetTypes(organizationId: string) {
    const types = await prisma.asset.groupBy({
      by: ['asset_type'],
      where: { organization_id: organizationId, deleted_at: null, asset_type: { not: null } },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
    });

    return types.map((t) => ({ type: t.asset_type, count: t._count.id }));
  }
}
