import { prisma } from '@/lib/prisma';
import { ItemCatalog, ItemCatalogStatus, SapSyncStatus } from '@prisma/client';

export interface ExtractedItemData {
  description: string;
  size?: string | null;
  rating?: string | null;
  specification?: string | null;
  category: string;
}

export class ItemMatchingService {
  /**
   * Normalizes strings for robust matching (e.g. "4\"" -> "4INCH", "150#" -> "150LB")
   */
  private static normalize(val: string | null | undefined): string {
    if (!val) return '';
    return val.toLowerCase()
      .trim()
      .replace(/["”]/g, 'inch')
      .replace(/#/g, 'lb')
      .replace(/\s+/g, '');
  }

  /**
   * Attempts to match an extracted item against the ItemCatalog.
   * If no match is found, creates a new entry with MISSING_SAP status.
   */
  static async matchOrCreateItem(
    orgId: string,
    data: ExtractedItemData
  ): Promise<{ item: ItemCatalog; isNew: boolean }> {
    const normDesc = this.normalize(data.description);
    const normSize = this.normalize(data.size);
    const normRating = this.normalize(data.rating);

    // 1. Try to find existing match
    // Note: This is an expensive scan if we don't have normalized columns, 
    // for now we'll do a basic exact match on the raw fields or filtered set.
    const existingItems = await prisma.itemCatalog.findMany({
      where: {
        organization_id: orgId,
        item_category: data.category,
        deleted_at: null,
      },
    });

    const match = existingItems.find(item => {
      const matchDesc = this.normalize(item.description) === normDesc || this.normalize(item.item_code) === normDesc;
      const matchSize = !normSize || this.normalize(item.pipe_size) === normSize;
      const matchRating = !normRating || this.normalize(item.pressure_rating) === normRating;
      return matchDesc && matchSize && matchRating;
    });

    if (match) {
      return { item: match, isNew: false };
    }

    // 2. No match found -> Create new Master Consumable record
    const timestamp = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const cleanName = data.description.substring(0, 20).replace(/[^a-zA-Z0-9]/g, '');
    const generatedCode = `EXT-${timestamp}-${cleanName}`.toUpperCase();

    const newItem = await prisma.itemCatalog.create({
      data: {
        organization_id: orgId,
        item_code: generatedCode,
        description: data.description,
        pipe_size: data.size,
        pressure_rating: data.rating,
        specification: data.specification,
        item_category: data.category,
        status: 'MISSING_SAP',
        sap_sync_status: 'NOT_CREATED',
        is_active: false, // Draft state
      },
    });

    return { item: newItem, isNew: true };
  }
}
