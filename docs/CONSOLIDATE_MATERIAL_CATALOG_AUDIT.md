# Consolidate Material Master Data — Audit & Steps

## Audit results

### 1. Tables (material catalog related)

Run in your DB (or use `scripts/audit-catalog-tables.sql` with `npx prisma db execute --stdin`):

- **Consumable** — Prisma model `Consumable` (no `@@map`), so table name is `"Consumable"`. This is the single legacy catalog table; gaskets, bolts, consumables, and blinds are rows with different `category` values.
- **item_catalog** — Target unified table (`ItemCatalog` with `@@map("item_catalog")`).

There are no separate `gaskets`, `bolts`, `blind_templates`, or `blinds_catalog` tables.

### 2. Row counts (run per table)

```sql
SELECT COUNT(*) FROM "Consumable";
SELECT COUNT(*) FROM item_catalog;
```

- If `Consumable` has rows → run the data migration script, then remove the model.
- If `Consumable` is empty → you can drop it directly (no migration script needed).

### 3. Settings pages (found)

- `app/(dashboard)/settings/items/page.tsx` — Item Catalog (unified).
- `app/(dashboard)/settings/master-data/activity-codes/page.tsx`
- `app/(dashboard)/settings/master-data/blinds/page.tsx` — **replaced with redirect** → `/settings/items?category=blind`
- `app/(dashboard)/settings/master-data/bolts/page.tsx` — **replaced with redirect** → `/settings/items?category=bolt`
- `app/(dashboard)/settings/master-data/consumables/page.tsx` — **replaced with redirect** → `/settings/items?category=consumable`
- `app/(dashboard)/settings/master-data/gaskets/page.tsx` — **replaced with redirect** → `/settings/items?category=gasket`
- `app/(dashboard)/settings/master-data/disciplines/page.tsx`
- `app/(dashboard)/settings/master-data/resources/page.tsx`

### 4. Settings sidebar

- **SettingsNavItems.tsx** — Master Data: Activity Codes, Disciplines, Resources, **Item Catalog** (single entry). Removed: Consumables, Gaskets, Bolts, Blinds.
- **SettingsSidebar.tsx** — Master Data: Activity Codes, Disciplines, Resources, **Item Catalog**. Removed: Consumables, Gaskets, Bolts, Blinds.

### 5. Schema models (Prisma)

- **Consumable** (line ~512) — Legacy catalog; to be removed after data is migrated.
- **Blind** (line ~1507) — Workpack blind **register** (instances per workpack). **Do not remove.**
- **ItemCatalog**, **GasketBoltLookup** — Keep.
- **WorkpackMaterial** — Had `consumable_id`; **item_catalog_id** added for consolidation.
- **ActivityResource** — Had `consumable_id`; **item_catalog_id** added.
- **AiSuggestedItem** — Had `resolved_consumable_id`; **resolved_item_catalog_id** added.

---

## Steps already done in code

1. **Redirects** — Gaskets, Bolts, Consumables, Blinds settings pages now redirect to `/settings/items?category=<gasket|bolt|consumable|blind>`.
2. **Sidebar** — Single “Item Catalog” under Master Data in both nav components.
3. **Item Catalog page** — Category from URL (`?category=`), category tabs with counts, `/api/master-data/items/counts` for badges.
4. **Schema** — `item_catalog_id` / `resolved_item_catalog_id` added on WorkpackMaterial, ActivityResource, AiSuggestedItem.
5. **Data migration script** — `prisma/migrate-consumable-to-item-catalog.ts` (run after first migration).

---

## What you need to run

### A. First migration (add new FKs)

```bash
npx prisma migrate dev --name add_item_catalog_id_for_consolidation
```

### B. Migrate Consumable data into item_catalog

```bash
npm run migrate:consumable-to-catalog
```

(Or: `npx tsx prisma/migrate-consumable-to-item-catalog.ts`.)

### C. Remove Consumable model and old FKs

After the script has run and you’ve confirmed data in `item_catalog` and updated FKs:

1. In `prisma/schema.prisma`:
   - Remove the entire **Consumable** model.
   - Remove **consumable_id** and **consumable** from **WorkpackMaterial**.
   - Remove **consumable_id** and **consumable** from **ActivityResource**.
   - Remove **resolved_consumable_id** and **consumable** from **AiSuggestedItem**.
   - On **Organization**, **Site**, **User**: remove the `consumables` / `created_consumables` / `updated_consumables` relations that point to Consumable.

2. Then run:

```bash
npx prisma migrate dev --name consolidate_material_catalog
```

### D. Optional cleanup

- Point any remaining code (e.g. `ConsumableService`, `/api/settings/master-data/consumables`) to Item Catalog or remove if unused.

---

## Verify

- Old catalog URLs redirect: `/settings/master-data/gaskets` → `/settings/items?category=gasket`, etc.
- Sidebar shows one “Item Catalog” under Master Data.
- Item Catalog tabs show counts and filter by category.
- After migration and schema cleanup: table `"Consumable"` is dropped; `item_catalog` has all categories (e.g. `SELECT item_category, COUNT(*) FROM item_catalog GROUP BY item_category`).
