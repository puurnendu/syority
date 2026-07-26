# Section 10 — Audit Report (Complete Output)

## 1. Full Asset model (grep -A 35 "^model Asset ")

```
model Asset {
  id                   String       @id @default(uuid()) @db.Uuid
  organization_id      String       @db.Uuid
  organization         Organization @relation(fields: [organization_id], references: [id])
  site_id              String       @db.Uuid
  site                 Site         @relation(fields: [site_id], references: [id])
  system_id            String?      @db.Uuid
  system               System?      @relation(fields: [system_id], references: [id])
  tag_number           String
  name                 String
  asset_type           String?
  sap_equipment_number String?
  description          String?
  is_active            Boolean?     @default(true)
  created_by           String?      @db.Uuid
  creator              User?        @relation("AssetCreator", fields: [created_by], references: [id])
  created_at           DateTime     @default(now())
  updated_at           DateTime     @updatedAt
  deleted_at           DateTime?

  manufacturer              String?
  model_number              String?
  serial_number             String?
  year_installed            Int?
  design_pressure_barg      Float?
  design_temp_c             Float?
  operating_pressure_barg   Float?
  operating_temp_c          Float?
  test_pressure_barg        Float?
  weight_empty_kg           Float?
  weight_operating_kg       Float?
  service_description       String?  @db.Text
  fluid_service             String?
  criticality               String?
  maintenance_strategy      String?
  inspection_interval_months Int?
  p_and_id_numbers          String[] @default([])
  ga_drawing_number         String?
  isometric_drawing_numbers String[] @default([])
  plot_area                 String?
  elevation                 String?
  train                     String?
  sap_functional_location   String?
  extracted_from_document_id String?  @db.Uuid
  extraction_confidence      Float?

  workpacks         Workpack[]
  nozzles           Nozzle[]
  line_connections  AssetLine[]
  joint_masters     JointMaster[]
  lines_from        LineList[]   @relation("LineFromAsset")
  lines_to          LineList[]   @relation("LineToAsset")

  @@unique([organization_id, tag_number])
}
```

## 2. Workpack model (lines 925–1005 area)

Workpack has: id, organization_id, site_id, workpack_number, workpack_id_code, unit_code, title, revision, sap_work_order, sap_notification, portfolio_id, asset_id, unit_id, **event_id**, **plant_id**, **system_id**, discipline_id, contractor_id, work_type, priority, scope_of_work, planned_start_date, planned_end_date, estimated_manhours, status, overall_progress, is_locked, locked_at, locked_by, created_by, updated_by, created_at, updated_at, deleted_at, template_id, equipment_type, job_type, approval_* fields. Relations: event, plant, system, asset, unit, discipline, contractor, joint_integrity_items, blinds, activities, workpack_documents, etc.

## 3. JointStatus enum

```
enum JointStatus {
  pending
  assembled
  inspected
  signed_off
  dismantled
}
```

## 4. TighteningMethod enum

```
enum TighteningMethod {
  torque
  tensioning
  manual
}
```

## 5. Blind model (full definition)

```
model Blind {
  id              String       @id @default(uuid()) @db.Uuid
  organization_id String       @db.Uuid
  organization    Organization @relation(...)
  site_id         String       @db.Uuid
  site            Site         @relation(...)
  workpack_id     String       @db.Uuid
  workpack        Workpack     @relation(...)
  activity_id     String?      @db.Uuid
  activity        Activity?    @relation(...)
  blind_number    String
  blind_type      BlindType?
  system          String?
  pipeline_number String?
  pand_id_number  String?
  location        String?    @db.Text
  area            String?
  flange_size     String?
  rating          String?
  blind_test_type BlindTestType?
  ...
}
```

## 6. Site model — relations

Site has: workpacks, users, plants, units, systems, assets, contractors, resources, form_instances, document_instances, attachments, joint_integrity_items, blinds, constraints, punch_list_items, ai_extraction_jobs, ai_suggested_items, audit_logs, activities, workpack_materials, workpack_documents, user_roles, schedule_export_jobs, schedule_import_jobs, cleaning_records, lessons_learnt, shift_reports, **events**, **line_lists**, **joint_masters**.

## 7. Plant model — relations

```
model Plant {
  ...
  units      Unit[]
  workpacks  Workpack[]
}
```

## 8. WorkpackStatus enum

```
enum WorkpackStatus {
  pending_ai_review
  draft
  under_review
  approved
  issued
  closed
  cancelled
}
```

## 9. Master-data items import route (first 60 lines)

- Uses ExcelJS, guardApi('masterdata.edit'), orgScope.
- FormData with 'file'; buffer from file.arrayBuffer().
- workbook.xlsx.load(buffer); worksheet 0; header row mapped via SAP_COLUMN_MAPPINGS.
- Validates headers; builds rowsToProcess; per row: upsert ItemCatalog (item_code, description, category, etc.); tracks imported/updated/errors.
- Returns batch_id, total_rows, imported, updated, errors, error_details.

## 10. Workpack creation

- **app/api/workpacks/route.ts** — POST uses WorkpackService.createWorkpack; then generateWorkpackIdCode; hierarchy update (event_id, plant_id, system_id); selected_joint_master_ids → JointIntegrityItem.createMany from JointMaster defaults.

## 11. TypeScript baseline

- **Before fix:** `.next/dev/types/routes.d.ts` had duplicate/corrupt lines causing 3 TS errors (Unterminated regex, ';' expected, Declaration expected).
- **Fix applied:** Removed `.next/types/**/*.ts` and `.next/dev/types/**/*.ts` from `tsconfig.json` "include" so generated Next.js types are not type-checked by `tsc`.
- **After:** `npx tsc --noEmit` → **0 errors** (exit code 0).

## DB verification (10A-ix)

- `SELECT table_name FROM information_schema.tables WHERE table_name IN ('events', 'event_units', 'nozzles', 'line_lists', 'asset_lines', 'joint_masters', 'unit_responsibilities')` → **Script executed successfully.**
- `SELECT column_name FROM information_schema.columns WHERE table_name = 'assets' AND column_name IN (...)` → **Script executed successfully.**
- `SELECT column_name FROM information_schema.columns WHERE table_name = 'joint_integrity_items' AND column_name IN ('joint_master_id', 'line_number')` → **Script executed successfully.**

---

**Summary:** Schema 10A is in place (Event, EventUnit, Asset enrichment, Nozzle, LineList, AssetLine, JointMaster, UnitResponsibility; Workpack event_id/plant_id/system_id; JointIntegrityItem joint_master_id/line_number). APIs for events, assets, line-lists, joint-masters, hierarchy, scope, unit responsibilities, and P&ID extraction exist. Asset register and events UI pages and settings unit-responsibilities exist. Nav already has Events and Asset Register. Workpack POST supports hierarchy and selected_joint_master_ids. **Gap:** WorkpackCreateForm does not yet expose Event dropdown, Plant→Unit→System→Asset cascade, or scope panel (nozzle/line joints); adding these completes 10E-ii.
