/**
 * One-off migration: copy Consumable rows into item_catalog and point
 * WorkpackMaterial, ActivityResource, AiSuggestedItem to the new rows.
 *
 * OBSOLETE: Consumable model has been removed. This script is kept for reference
 * only. Do not run — it will fail against the current schema.
 */
// @ts-nocheck
import { prisma, disconnect } from './seed-client';

function mapCategory(category: string | null): string {
  if (!category) return 'consumable';
  const c = category.toLowerCase();
  if (c === 'gasket') return 'gasket';
  if (c === 'bolt') return 'bolt';
  if (c === 'blind') return 'blind';
  return 'consumable';
}

async function main() {
  const consumables = await prisma.consumable.findMany({
    where: { deleted_at: null },
    orderBy: { created_at: 'asc' },
  });

  console.log(`Found ${consumables.length} Consumable(s) to migrate.`);
  if (consumables.length === 0) {
    console.log('Nothing to do.');
    return;
  }

  const consumableIdToItemCatalogId = new Map<string, string>();
  const seenCodes = new Map<string, Set<string>>(); // orgId -> Set of item_code

  for (const c of consumables) {
    const itemCode =
      (c.material_number && c.material_number.trim()) ||
      `CON-${c.id.slice(0, 8).toUpperCase()}`;
    const baseCode = itemCode.slice(0, 50);
    let itemCodeFinal = baseCode;
    let suffix = 0;
    const orgCodes = seenCodes.get(c.organization_id) ?? new Set<string>();
    while (orgCodes.has(itemCodeFinal)) {
      suffix += 1;
      itemCodeFinal = `${baseCode}-${suffix}`.slice(0, 50);
    }
    orgCodes.add(itemCodeFinal);
    seenCodes.set(c.organization_id, orgCodes);

    const existing = await prisma.itemCatalog.findUnique({
      where: {
        organization_id_item_code: {
          organization_id: c.organization_id,
          item_code: itemCodeFinal,
        },
      },
      select: { id: true },
    });

    let itemCatalogId: string;
    if (existing) {
      itemCatalogId = existing.id;
    } else {
      const created = await prisma.itemCatalog.create({
        data: {
          organization_id: c.organization_id,
          item_code: itemCodeFinal,
          description: c.name,
          item_category: mapCategory(c.category),
          sub_category: c.sub_category ?? null,
          unit_of_measure: c.unit_of_measure ?? 'EA',
          specification: c.specifications ?? null,
          manufacturer: c.manufacturer ?? null,
          manufacturer_part_no: c.manufacturer_part_number ?? null,
          unit_cost: c.reference_unit_cost != null ? Number(c.reference_unit_cost) : null,
          is_active: c.is_active ?? true,
        },
      });
      itemCatalogId = created.id;
    }
    consumableIdToItemCatalogId.set(c.id, itemCatalogId);
  }

  console.log(`Migrated ${consumableIdToItemCatalogId.size} consumable(s) to item_catalog.`);

  const wmRows = await prisma.workpackMaterial.findMany({
    where: { consumable_id: { not: null } },
    select: { id: true, consumable_id: true },
  });
  let wmCount = 0;
  for (const row of wmRows) {
    const newId = row.consumable_id ? consumableIdToItemCatalogId.get(row.consumable_id) : null;
    if (newId) {
      await prisma.workpackMaterial.update({
        where: { id: row.id },
        data: { item_catalog_id: newId },
      });
      wmCount += 1;
    }
  }
  console.log(`Updated ${wmCount} WorkpackMaterial row(s) with item_catalog_id.`);

  const arRows = await prisma.activityResource.findMany({
    where: { consumable_id: { not: null } },
    select: { id: true, consumable_id: true },
  });
  let arCount = 0;
  for (const row of arRows) {
    const newId = row.consumable_id ? consumableIdToItemCatalogId.get(row.consumable_id) : null;
    if (newId) {
      await prisma.activityResource.update({
        where: { id: row.id },
        data: { item_catalog_id: newId },
      });
      arCount += 1;
    }
  }
  console.log(`Updated ${arCount} ActivityResource row(s) with item_catalog_id.`);

  const aiRows = await prisma.aiSuggestedItem.findMany({
    where: { resolved_consumable_id: { not: null } },
    select: { id: true, resolved_consumable_id: true },
  });
  let aiCount = 0;
  for (const row of aiRows) {
    const newId = row.resolved_consumable_id
      ? consumableIdToItemCatalogId.get(row.resolved_consumable_id)
      : null;
    if (newId) {
      await prisma.aiSuggestedItem.update({
        where: { id: row.id },
        data: { resolved_item_catalog_id: newId },
      });
      aiCount += 1;
    }
  }
  console.log(`Updated ${aiCount} AiSuggestedItem row(s) with resolved_item_catalog_id.`);

  console.log('Done. You can now remove consumable_id / Consumable from schema and run:');
  console.log('  npx prisma migrate dev --name consolidate_material_catalog');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => disconnect());
