# Phase 2 Materials Module — Full Audit Report

## 1. Existing schema (materials-related models)

- **ItemCatalog**: EXISTS at prisma/schema.prisma (Phase 2). Fields: id, organization_id, sap_material_number, sap_plant, sap_storage_location, sap_material_group, item_code, description, long_description, item_category, sub_category, unit_of_measure, manufacturer, manufacturer_part_no, specification, standard_reference, material_grade, pipe_size, pressure_rating, flange_type, bolt_nominal_size, bolt_length_mm, unit_cost, currency, last_sap_sync, import_batch_id, is_active, deleted_at, created_at, updated_at. Relations: material_lines, gasket_lookups, bolt_lookups, nut_lookups, washer_lookups, joint_gasket_items, joint_bolt_items. @@map("item_catalog").
- **GasketBoltLookup**: EXISTS. pipe_size, pressure_class, flange_type, gasket_item_id, gasket_description, bolt_item_id, bolt_description, bolt_count, bolt_length_mm, nut_item_id, nut_description, washer_item_id, washer_description, notes, is_active. @@unique(organization_id, pipe_size, pressure_class, flange_type). @@map("gasket_bolt_lookup").
- **WorkpackMaterialLine**: EXISTS. source_type, source_id, item_catalog_id, sap_material_number, item_code, description, specification, unit_of_measure, quantity_required/issued/used/returned, procurement_status, is_critical, lead_time_days, required_by_date, unit_cost, total_cost, notes, sort_order, deleted_at. workpack + item_catalog relations. @@map("workpack_material_lines").
- **WorkpackMaterial** (legacy): EXISTS — different model (workpack_materials), used by current MaterialsPanel.
- **ItemCatalogImportLog**: EXISTS. batch_id, imported_by, filename, total_rows, imported_count, updated_count, error_count, errors (Json), status, created_at. @@map("item_catalog_import_logs").
- **JointIntegrityItem**: Has gasket_item_id, bolt_item_id (relations to ItemCatalog). Fields used for lookup: flange_size, rating, flange_type (not "size"/"pressure_rating" in schema).
- **Blind**: Has flange_size, rating (no BlindRegisterItem; model is Blind).
- **Workpack**: Has material_lines (WorkpackMaterialLine[]) and workpack_materials (WorkpackMaterial[]).

## 2. Current workpack detail tabs

- **Location**: src/components/Workpack/WorkpackTabs.tsx (single file; no app/ tab files).
- **TABS array**: overview, activities, joints, blinds, constraints, **materials**, punch, dropping, clearance, cert-boxup, cert-torque, cert-hydro, cleaning, jcc, lessons, documents, audit, workflow.
- **Materials tab**: Currently renders MaterialsPanel which uses workpack.workpack_materials (legacy WorkpackMaterial).

## 3. Workpack detail page

- **Page**: app/(dashboard)/workpacks/[id]/page.tsx — does not define tabs; it renders WorkpackHeader and WorkpackTabs(workpack, udfDefinitions). Tabs and content are in WorkpackTabs.tsx.

## 4. Joint register model (JointIntegrityItem)

- **POD 2**: flange_material, flange_reference_standard, gasket_material, gasket_reference_standard, flange_type, gasket_item_id, bolt_item_id.
- **POD 1**: flange_size, rating (used for sizing; spec "size" = flange_size, "pressure_rating" = rating).
- No gasket_spec/bolt_spec/bolt_count text fields in schema; UI may use gasket_material/gasket_reference_standard and bolt_*.

## 5. Blind model

- **Blind** (not BlindRegisterItem): blind_number, blind_type, flange_size, rating, pipeline_number, pand_id_number, status, etc. createBlind accepts size?, rating?; prisma.blind.create spreads data — schema has flange_size, rating.

## 6. Workpack model relations

- material_lines: WorkpackMaterialLine[]
- workpack_materials: WorkpackMaterial[]
- joint_integrity_items, blinds, activities, etc.

## 7. Existing master-data API routes

- app/api/master-data/udf-definitions/route.ts
- app/api/master-data/udf-definitions/reorder/route.ts
- app/api/master-data/udf-definitions/[id]/route.ts
- app/api/master-data/udf-definitions/[id]/options/route.ts
- **No** items, gasket-lookup, or items/import routes yet.

## 8. Existing settings / master-data pages

- Settings: app/(dashboard)/settings/* (sites, print-settings, roles, users, audit-logs, assets, system, integrations, notifications, billing, organization, clearance-parties, udf-definitions, templates, ai-config).
- Master-data: activity-codes, disciplines, resources, consumables, gaskets, bolts, blinds.
- **No** settings/items (Item Catalog) page yet.

## 9. Settings sidebar

- **Layout**: app/(dashboard)/settings/layout.tsx — sidebar uses SettingsNavItems.
- **Nav**: app/(dashboard)/settings/SettingsNavItems.tsx — NAV_GROUPS with Organisation, Workpack Config, Master Data (Activity Codes, Disciplines, Resources, Consumables, Gaskets, Bolts, Blinds), System. **Item Catalog not in sidebar.**

## 10. npm packages

- **exceljs**: ^4.4.0 (present).
- **@types/node**: ^20 (present).
- No xlsx/sheetjs/papaparse in package.json; csv helper is inline (src/lib/materials/csvHelper.ts).

## 11. TypeScript baseline

- `npx tsc --noEmit` → exit 0 (no errors reported).

## 12. DB tables

- Not run (requires DATABASE_URL). Schema defines item_catalog, gasket_bolt_lookup, workpack_material_lines, item_catalog_import_logs.

## Summary for implementation

- Schema and helpers (constants, materialLineGenerator, csvHelper) already exist. Seed script seed-gasket-lookup.ts exists.
- Add: master-data items (GET/POST), items/[itemId] (PATCH/DELETE), items/import (POST), items/import/log (GET), gasket-lookup (GET/POST).
- Replace workpacks/[id]/materials route with WorkpackMaterialLine-based GET/POST; add materials/[lineId] (PATCH/DELETE) and materials/export (GET).
- Wire joint create and blind create to generate material lines (map flange_size→pipe_size, rating→pressure_class).
- Replace MaterialsPanel with new MaterialsTab (fetch lines/consolidated/summary from API).
- Add settings/items page (Item Catalog, Gasket-Bolt Lookup, Import History), sidebar link, and import log API.
- Add PDF materials section, MS Project XML materials, feature flags, Activity materials inline, Joint auto-suggest.
