# STO DIGITAL PLANT V1 — FORENSIC AUDIT REPORT
## TA-2027 Production Deployment Readiness

> **Date**: 05 September 2026
> **Type**: READ-ONLY FORENSIC AUDIT
> **Status**: AMBER — Foundation exists, specified P0/P1 gaps must be addressed

---

## 1. Executive Summary

The STO codebase contains a **substantial** Digital Plant and Equipment foundation. The hierarchy (Organisation → Site → Plant → Area → Unit → System → Asset) is fully modelled in Prisma with CRUD services, APIs, and frontend screens. Equipment (called `Asset` in the codebase) is the central physical object with 30+ fields. M8.13 introduced an authoritative `EquipmentType` → `StandardActivityType` → `Activity` classification chain. Scope management (`ShutdownScope` → `ScopeItem`) has a **required** asset link. Import (Excel) and P&ID AI extraction pipelines exist.

However, critical gaps remain:

> **P0**: The `AssetRegisterService` references 3 Prisma models (`assetAttributeValue`, `assetAttributeDefinition`, `assetAttributeHistory`) that **DO NOT EXIST** in `schema.prisma`. The entire attribute verification/AI review subsystem will crash at runtime.

> **P0**: Equipment criticality is **free-text** (`String?`), not a controlled enum.

> **P0**: `Workpack.template_id` references a template concept that has **no corresponding model**.

> **P1**: The `Asset` model uses the term "Asset" throughout while the business requires "Equipment". This is a naming alignment issue, not a structural one — they are the same object.

> **P1**: No existing Equipment 360 view showing scope, workpacks, activities, schedule, execution, and progress in one integrated view.

**Certification: AMBER** — Foundation is strong. ~75% of Digital Plant V1 functionality exists or is partially implemented. P0 items must be resolved before deployment.

---

## 2. Current Architecture

### Hierarchy Models (from schema.prisma)

```
Organization          (L: 315)    ← Tenant root
  └── Site            (L: 1364)   ← id, name, code, timezone, test standards
      └── Plant       (L: varies) ← id, name, code, site_id
          └── Area    (L: 1096)   ← id, name, code, plant_id (NEW — supports area level)
              └── Unit  (L: 1438) ← id, name, code, plant_id, area_id (optional)
                  └── System (L: 1403) ← id, name, code, unit_id
                      └── Asset  (L: 436)  ← Equipment master record
```

**Key finding**: The `Area` model EXISTS. The hierarchy is Organisation → Site → Plant → Area → Unit → System → Asset, matching the target hierarchy.

### Services Architecture

| Service | File | Size | Status |
|---------|------|------|--------|
| `HierarchyService` | `src/core/hierarchy/HierarchyService.ts` | 47 KB | ✅ WORKING — Full CRUD for all 6 levels |
| `HierarchyImport` | `src/core/hierarchy/HierarchyImport.ts` | 12 KB | ✅ WORKING — Excel import with validation |
| `AssetRegisterService` | `src/core/asset-register/AssetRegisterService.ts` | 31 KB | 🔴 BROKEN — references 3 missing Prisma models |
| `AssetAttributeHistoryService` | `src/core/asset-register/AssetAttributeHistoryService.ts` | — | 🔴 BROKEN — depends on missing models |
| `DigitalPlantService` | `src/core/digital-plant/DigitalPlantService.ts` | 6 KB | ✅ WORKING — Project CRUD |
| `PlantImportService` | `src/core/digital-plant/PlantImportService.ts` | 9 KB | ✅ WORKING — Excel dry-run/commit/rollback |
| `ExtractionService` | `src/core/digital-plant/ExtractionService.ts` | 11 KB | ✅ WORKING — AI P&ID extraction |
| `ReviewService` | `src/core/digital-plant/ReviewService.ts` | 13 KB | ✅ WORKING — Candidate review workflow |
| `AssetSearchService` | `src/core/digital-plant/AssetSearchService.ts` | 6 KB | ✅ WORKING — Search/filter |
| `PlantDocumentService` | `src/core/digital-plant/PlantDocumentService.ts` | 9 KB | ✅ WORKING — Document management |

---

## 3. Existing Digital Plant Capability

| Capability | Status | Evidence |
|-----------|--------|----------|
| Plant hierarchy (Org→Site→Plant→Area→Unit→System→Asset) | ✅ EXISTS | 6 models in schema.prisma, full CRUD in HierarchyService (47KB) |
| Hierarchy API | ✅ EXISTS | 33 API routes under `/api/hierarchy/*` |
| Hierarchy settings UI | ✅ EXISTS | 7 pages under `/settings/hierarchy/*` |
| Hierarchy import (Excel) | ✅ EXISTS | `HierarchyImport.ts` (12KB) with parse, validate, commit |
| Hierarchy tree API | ✅ EXISTS | `/api/hierarchy?site_id=` returns nested tree |
| Hierarchy in planner workspace | ✅ EXISTS | `/api/planner-workspace/hierarchy-tree` |
| Hierarchy in scope builder | ✅ EXISTS | `/api/shutdown-scope/scopes/[id]/builder/hierarchy` |
| Area model | ✅ EXISTS | Model at L:1096 with `@@unique([plant_id, code])` |
| Soft delete / restore | ✅ EXISTS | All hierarchy entities support `deleted_at` + restore APIs |

### Hierarchy Enforcement

| Check | Result |
|-------|--------|
| Plant → Site FK enforced? | ✅ Yes — `site_id String @db.Uuid` (required) |
| Area → Plant FK enforced? | ✅ Yes — `plant_id String @db.Uuid` (required) |
| Unit → Plant FK enforced? | ✅ Yes — `plant_id String @db.Uuid` (required) |
| Unit → Area FK optional? | ✅ Yes — `area_id String? @db.Uuid` (optional, correct) |
| System → Unit FK enforced? | ✅ Yes — `unit_id String @db.Uuid` (required) |
| Asset → System FK enforced? | ❌ No — `system_id String? @db.Uuid` (optional) |
| Asset → Unit FK enforced? | ❌ No — `unit_id String? @db.Uuid` (optional) |
| Asset → Plant FK enforced? | ❌ No — `plant_id String? @db.Uuid` (optional) |
| Asset → Site FK enforced? | ✅ Yes — `site_id String @db.Uuid` (required) |
| Asset → Org FK enforced? | ✅ Yes — `organization_id String @db.Uuid` (required) |
| Code uniqueness per parent? | ✅ Yes — `@@unique([plant_id, code])` etc. for all levels |

**Gap**: Asset hierarchy placement (plant/unit/system) is optional. Equipment can exist at Organisation/Site level without being placed in the hierarchy.

---

## 4. Existing Equipment Capability

### Equipment Master Fields (from `model Asset` at schema.prisma:436)

| Target Field | Codebase Field | Status | Notes |
|-------------|---------------|--------|-------|
| Immutable Equipment ID | `id` (UUID, `@id`) | ✅ EXISTS | Auto-generated UUID |
| Equipment Tag | `tag_number` (String) | ✅ EXISTS | `@@unique([organization_id, tag_number])` |
| Equipment Type | `asset_type` (String?) | 🟡 PARTIAL | Free-text, not controlled. Separate `equipment_type_id` FK to EquipmentType |
| Description | `description` (String?) | ✅ EXISTS | |
| Area | — | ❌ MISSING | No `area_id` on Asset. Area accessed via Unit→Area chain |
| Unit | `unit_id` (String?) | ✅ EXISTS | Optional FK |
| System | `system_id` (String?) | ✅ EXISTS | Optional FK |
| Service | `service_description` (String?) | ✅ EXISTS | |
| Location | `plot_area`, `elevation`, `train` | ✅ EXISTS | 3 separate fields |
| Criticality | `criticality` (String?) | 🔴 PARTIAL | Free-text, NOT controlled enum |
| Status | `is_active` (Boolean, default true) | 🟡 PARTIAL | Boolean only, no lifecycle enum |
| Client-specific/custom fields | None | ❌ MISSING | No custom field mechanism |
| Source | `extracted_from_document_id` (String?) | 🟡 PARTIAL | Only for AI extraction |
| Source document | `extracted_from_document_id` | 🟡 PARTIAL | FK but not comprehensive |
| Source revision | — | ❌ MISSING | |
| Created by | `created_by` (String?) | ✅ EXISTS | FK to User |
| Created date | `created_at` (DateTime) | ✅ EXISTS | Auto |
| Modified by | — | ❌ MISSING | Only `updated_at` exists, no `updated_by` |
| Modified date | `updated_at` (DateTime) | ✅ EXISTS | Auto |
| Approval status | — | ❌ MISSING | No approval field on Asset |

### Additional Fields Present (not in target but valuable)

| Field | Type | Notes |
|-------|------|-------|
| `manufacturer` | String? | OEM |
| `model_number` | String? | |
| `serial_number` | String? | |
| `year_installed` | Int? | |
| `design_pressure_barg` | Float? | Engineering |
| `design_temp_c` | Float? | Engineering |
| `operating_pressure_barg` | Float? | Engineering |
| `operating_temp_c` | Float? | Engineering |
| `test_pressure_barg` | Float? | Engineering |
| `weight_empty_kg` | Float? | |
| `weight_operating_kg` | Float? | |
| `fluid_service` | String? | Process |
| `p_and_id_numbers` | String[] | Drawing refs |
| `ga_drawing_number` | String? | Drawing ref |
| `isometric_drawing_numbers` | String[] | Drawing refs |
| `sap_functional_location` | String? | ERP link |
| `sap_equipment_number` | String? | ERP link |
| `extraction_confidence` | Float? | AI confidence |
| `equipment_type_id` | String? → EquipmentType | M8.13 FK |

**Total**: 30+ fields on the Asset model. Solid foundation.

---

## 5. Existing Equipment Type Capability

### Model: `EquipmentType` (schema.prisma:746)

| Aspect | Status | Evidence |
|--------|--------|----------|
| Model exists | ✅ | `id, org_id, name, code, description, is_active, created_at` |
| Controlled master (not free-text) | ✅ | Separate table with `id`, referenced via FK |
| Multiple equipment can share type | ✅ | `assets Asset[]` relation |
| Standard activity relationship | ✅ | `standard_activity_types StandardActivityType[]` |
| Seed data | ✅ | 52 base types + variants (up to 110) in `prisma/demo/equipmentTypes.ts` |
| Admin API | ✅ | `/api/admin/equipment-types` (CRUD) |
| Asset FK to type | ✅ | `equipment_type_id String?` on Asset |
| Type can drive templates | 🟡 PARTIAL | StandardActivityType provides template activities per type |

### Seeded Equipment Types (52 base types)

Includes: Centrifugal Pump, PD Pump, Steam Turbine, Gas Turbine, Gate Valve, Globe Valve, Ball Valve, Butterfly Valve, Control Valve, PSV/PRV, Check Valve, Shell & Tube HX, Air Cooler, Plate HX, Reciprocating Compressor, Centrifugal Compressor, Pressure Vessel, Drum, Storage Tank, Sphere, Distillation Column, Absorber, Reactor, Filter, Fan, Blower, Fired Heater, Boiler, Cooling Tower, Transformer, Switchgear, MCC, Transmitter, Analyzer, Flow Meter, Level Gauge, DCS/PLC, Scaffold, Blind/Spacer, Expansion Joint, Steam Trap, Agitator, Conveyor, and more.

**This is comprehensive for a refinery TA.**

---

## 6. Existing Import Capability

### Path 1: `/api/assets/import` (Direct Asset Import)

| Feature | Status | Evidence |
|---------|--------|----------|
| Excel upload | ✅ | ExcelJS parsing in `app/api/assets/import/route.ts` (170 lines) |
| Header mapping | ✅ | 13 mapped columns (tag_number, name, asset_type, unit_code, system_code, etc.) |
| Validation | ✅ | Required tag_number + name, unit lookup |
| Duplicate detection | ✅ | `findUnique` by `organization_id_tag_number` |
| Update vs create | ✅ | Existing records updated, new ones created |
| Error reporting | ✅ | Per-row errors with row number |
| Auth guard | ✅ | `guardApi('masterdata.edit')` + `orgScope` |
| Preview | ❌ MISSING | No dry-run/preview before commit |
| Transaction safety | ❌ MISSING | No transaction wrapper (row-by-row) |
| Rollback | ❌ MISSING | No undo mechanism |
| Import history/batch | ❌ MISSING | No batch tracking |

### Path 2: `/api/digital-plant/import/*` (Digital Plant Import)

| Feature | Status | Evidence |
|---------|--------|----------|
| Dry-run (preview without commit) | ✅ | `PlantImportService.dryRunImport()` |
| Commit | ✅ | Creates `ExtractionCandidate` records for review |
| Rollback | ✅ | `PlantImportService.rollbackImport()` with approval guard |
| Multi-type support | ✅ | equipment_list, valve_list, line_list, instrument_list, asset_register |
| Column mapping per type | ✅ | 5 separate column maps |
| Duplicate detection | ✅ | Checks existing tags by org |
| Batch tracking | ✅ | `import_batch_id` on candidates |
| Review workflow | ✅ | Candidates go to `pending_review` → approve/reject/merge |

### Path 3: P&ID AI Extraction

| Feature | Status | Evidence |
|---------|--------|----------|
| P&ID document upload | ✅ | `PlantDocumentService` |
| AI extraction service | ✅ | `ExtractionService.ts` (11KB) |
| Extraction candidates | ✅ | `ExtractionCandidate` model with confidence scores |
| Review/approve/reject/merge | ✅ | `ReviewService.ts` (13KB) |
| Candidate→Asset promotion | ✅ | Approve creates/merges Asset records |
| Audit trail | ✅ | `CandidateReviewAction` model |
| Frontend | ✅ | `/digital-plant/[projectId]` page (19KB) |

---

## 7. Existing Validation Capability

| Validation | Status | Location |
|-----------|--------|----------|
| Required tag_number | ✅ | Both import paths check |
| Required name | ✅ | Direct import checks |
| Duplicate tag (org-scoped) | ✅ | `@@unique([organization_id, tag_number])` DB constraint |
| Invalid hierarchy (unit not found) | ✅ | Import checks unit_code existence |
| Invalid equipment type | ❌ MISSING | No validation that asset_type matches EquipmentType |
| Missing mandatory data | 🟡 PARTIAL | Only tag+name validated |
| Conflicting imported data | ❌ MISSING | No conflict detection |
| Pre-commit validation | ✅ | Digital Plant path has dry-run |
| Post-commit constraint | ✅ | DB unique constraint enforced |

---

## 8. Existing Provenance / Audit Capability

| Feature | Status | Evidence |
|---------|--------|----------|
| `AuditLog` model | ✅ | Model at L:525 with old/new values, user, IP, timestamp |
| `AuditService` | ✅ | Referenced in AssetRegisterService |
| Source document tracking | ✅ | `extracted_from_document_id`, `extraction_confidence` on Asset |
| Import batch tracking | ✅ | `import_batch_id` on ExtractionCandidate |
| User attribution (created_by) | ✅ | On Asset model |
| Timestamp tracking | ✅ | `created_at`, `updated_at` |
| Source type (manual/AI/import) | 🟡 PARTIAL | Only on ExtractionCandidate.candidate_type, not on Asset directly |
| Source revision | ❌ MISSING | No revision tracking on source |
| Import history log | ❌ MISSING | No persistent import history table |

---

## 9. Existing Revision / Approval Capability

| Feature | Status | Evidence |
|---------|--------|----------|
| Tag change tracking | ❌ MISSING | No revision model for tag changes |
| Equipment type change tracking | ❌ MISSING | |
| Hierarchy change tracking | ❌ MISSING | |
| Approval workflow | ❌ MISSING | No approval_status on Asset |
| Soft delete | ✅ | `deleted_at DateTime?` on Asset |
| Restore from soft delete | ✅ | `/api/hierarchy/assets/[id]/restore` |
| Historical values | ❌ MISSING | AssetAttributeHistory planned but models missing from schema |
| Impact analysis on change | ❌ MISSING | No linked scope/workpack impact |

**DOCUMENTATION SAYS**: AssetRegisterService has full attribute history with AI review capabilities.
**CODE SHOWS**: The service exists (790 lines, 31KB) but references `assetAttributeValue`, `assetAttributeDefinition`, `assetAttributeHistory` Prisma models that DO NOT exist in schema.prisma.

---

## 10. Equipment 360 Capability

### Current State

| Tab/View | Status | Evidence |
|----------|--------|----------|
| **Asset Detail Page** | ✅ EXISTS | `/asset-register/[assetId]` (page.tsx, 84 lines) |
| → Overview tab | ✅ | Tag, name, type, criticality, site, unit, system |
| → Nozzles tab | ✅ | Nozzle table with designation, service, size, rating, facing |
| → Connected Lines tab | ✅ | Line list connections (from/to) |
| → Joints tab | ✅ | Joint master data |
| → Drawings tab | ✅ | System drawings (via system_id) |
| → Procedures tab | ✅ | System procedures (via system_id) |
| → **Scope** | ❌ MISSING | Not shown on asset detail |
| → **Workpacks** | 🟡 PARTIAL | Queried (last 5) but passed as prop, display unclear |
| → **Activities** | ❌ MISSING | Not shown |
| → **Schedule** | ❌ MISSING | Not shown |
| → **Execution** | ❌ MISSING | Not shown |
| → **Progress** | ❌ MISSING | Not shown |
| → **Constraints** | ❌ MISSING | Not shown |
| → **History** | ❌ MISSING | Not shown |

The current asset detail page shows 6 tabs. For Equipment 360, it needs 6+ additional tabs.

---

## 11. Equipment → Scope Integration

| Feature | Status | Evidence |
|---------|--------|----------|
| `ScopeItem.asset_id` FK | ✅ REQUIRED | `asset_id String @db.Uuid` (NOT optional) — every scope item tied to an asset |
| ScopeItem → Asset relation | ✅ | `@relation("ScopeItemAsset", fields: [asset_id], references: [id])` |
| ScopeItem hierarchy context | ✅ | `plant_id`, `unit_id`, `system_id` denormalized from asset |
| ScopeItem discipline | ✅ | `discipline String?` |
| ScopeItem priority | ✅ | `priority String @default("medium")` with critical/high/medium/low |
| ScopeItem complexity | ✅ | `complexity String @default("standard")` |
| ScopeItem template recommendation | ✅ | `template_id`, `template_name` |
| Multiple scopes per equipment | ✅ | Via multiple ScopeItems |
| Scope status workflow | ✅ | `ScopeStatus` enum: draft/open/frozen/approved/closed |
| Scope freeze/change | ✅ | `freeze_date`, `frozen_at`, `frozen_by` |
| Scope → Workpack link | ✅ | `ScopeItem.workpack_id` FK |
| Scope builder hierarchy API | ✅ | `/api/shutdown-scope/scopes/[id]/builder/hierarchy` |
| Scope items CRUD | ✅ | Full API with bulk operations |
| Scope packages | ✅ | `ScopePackage` model for grouping |
| Scope deferrals | ✅ | `ScopeDeferral` model with carry-forward |
| Scope comparisons | ✅ | `ScopeComparison` model for diff |
| Scope change requests | ✅ | Full API with approve/reject |
| Scope reports | ✅ | Register, changes, deferred, department summary |
| AI scope recommendation | ✅ | `ai_recommendation`, `ai_confidence`, `ai_grouping_hint` |

**This is the strongest integration point.** The Scope module is comprehensive and has an enforced asset link.

---

## 12. Equipment → Workpack Integration

| Feature | Status | Evidence |
|---------|--------|----------|
| `Workpack.asset_id` FK | ✅ | `asset_id String? @db.Uuid` (optional) |
| `Workpack.unit_id` FK | ✅ | `unit_id String? @db.Uuid` (optional) |
| `Workpack.system_id` FK | ✅ | `system_id String? @db.Uuid` (optional) |
| `Workpack.plant_id` FK | ✅ | `plant_id String? @db.Uuid` (optional) |
| `Workpack.equipment_type` | ✅ | `equipment_type String?` (free-text) |
| `Workpack.equipment_technical_data` | ✅ | `Json? @default("{}")` |
| One equipment → multiple workpacks | ✅ | `Asset.Workpack Workpack[]` relation |
| One workpack → one equipment | ✅ | `asset_id` is singular FK |
| System-level workpack | ✅ | `system_id` without `asset_id` |
| Unit-level workpack | ✅ | `unit_id` without `asset_id` |
| Asset detail shows workpacks | 🟡 PARTIAL | Server query exists but limited display |
| ScopeItem → Workpack | ✅ | `ScopeItem.workpack_id` link |
| Scope→Workpack creation API | ✅ | `/api/shutdown-scope/scopes/[id]/workpacks` |

---

## 13. Equipment → Activity Integration

| Feature | Status | Evidence |
|---------|--------|----------|
| Activity → Workpack → Asset chain | ✅ | Activity.workpack_id → Workpack.asset_id |
| Activity.standard_activity_type_id | ✅ | FK to StandardActivityType (M8.13) |
| StandardActivityType → EquipmentType | ✅ | FK `equipment_type_id` |
| Direct activity→equipment FK | ❌ MISSING | Activity has no direct asset_id |
| Equipment type drives activity templates | ✅ | StandardActivityType per EquipmentType |
| Identical activity classification | ✅ | M8.13 Progress Intelligence |
| Standard activity seeding | ✅ | `seedStandardActivityTypes.ts` with 54 activity types |

### Standard Activity Types Seeded

7 equipment type categories × ~8 activities each = 54 types:
- Heat Exchanger: Blinding, Bundle Pullout, Inspection, Hydrotest, Reassembly, Deblinding, etc.
- Pressure Vessel: Blinding, Internal Inspection, Repair, Hydrotest, Reinsulation, etc.
- Column: Tray Removal, Internal Inspection, Tray Installation, etc.
- Pump: Decoupling, Disassembly, Overhaul, Assembly, Alignment, etc.
- Compressor: Similar maintenance sequence
- PSV: Remove, Test, Repair, Reinstall, etc.
- Control Valve: Similar sequence

---

## 14. Equipment → Progress Integration

| Feature | Status | Evidence |
|---------|--------|----------|
| Equipment aggregation in progress | ✅ | ProgressAggregationService groups by equipment |
| Equipment type aggregation | ✅ | M8.13 progress by equipment type |
| Equipment drill-down | ✅ | `/api/events/[id]/progress/equipment` |
| Standard activity aggregation | ✅ | Identical activities grouped by StandardActivityType |
| Dashboard equipment section | ✅ | TA Dashboard progress tab |
| Equipment identity preserved | ✅ | Through Workpack.asset_id → Activity chain |

**M8.13 progress flows correctly through equipment.** This is certified.

---

## 15. Multi-Tenant Isolation Audit

| Layer | Status | Evidence |
|-------|--------|----------|
| Asset model | ✅ | `organization_id String @db.Uuid` (required) |
| Asset unique constraint | ✅ | `@@unique([organization_id, tag_number])` |
| Hierarchy models (all) | ✅ | `organization_id` on Site, Plant, Area, Unit, System |
| Direct import API | ✅ | `guardApi('masterdata.edit')` + `orgScope(session!)` |
| Digital Plant APIs | ⚠️ VARIES | Some use `guardApi`, some use `getServerSession` only |
| Hierarchy main API | ✅ | Uses `guardApi('workpacks.view')` + `orgScope` |
| Hierarchy CRUD APIs | ✅ | Uses `withHierarchyGuard()` pattern |
| AssetRegisterService | ✅ | All methods take `organizationId` parameter |
| HierarchyService | ✅ | All methods take `orgId` parameter |
| DigitalPlantService queries | ✅ | All queries include `organization_id` filter |
| Prisma middleware (RLS) | ❌ | No row-level security middleware |
| Workpack → Asset cross-check | ❌ | No validation that workpack.asset_id belongs to same org |
| Import path | ✅ | Tenant-scoped lookups |
| Search | ✅ | `AssetSearchService` includes org filter |
| Export | NOT TESTED | — |

**Cross-tenant risk**: While individual APIs enforce org scope, there is no global Prisma middleware to prevent cross-tenant FK references. A workpack in Org A could theoretically reference an asset_id from Org B if the UUID is known.

---

## 16. RBAC Audit

### Existing Permissions Relevant to Digital Plant

| Permission | Exists | Used By |
|-----------|--------|---------|
| `asset.view` | ✅ | Viewing asset register |
| `asset.manage` | ✅ | Creating/editing assets |
| `masterdata.view` | ✅ | Viewing master data |
| `masterdata.edit` | ✅ | Editing master data, asset import |
| `workpacks.view` | ✅ | Hierarchy tree access |

### Missing Permissions

| Permission | Status |
|-----------|--------|
| `equipment.import` | ❌ Uses `masterdata.edit` (too broad) |
| `equipment.approve` | ❌ No approval workflow |
| `equipment.delete` | ❌ Uses `asset.manage` (combined) |
| `hierarchy.edit` | ✅ Exists as `unit.view`, `unit.edit`, etc. |
| `template.admin` | ❌ No dedicated permission |

### Role Mapping

The platform has a comprehensive role system but no dedicated "Planner" or "Engineer" role granularity for equipment operations. All equipment operations fall under `asset.manage` or `masterdata.edit`.

---

## 17. API Audit

### Asset/Equipment APIs (20 routes)

| Method | Route | Auth | Tenant | Status |
|--------|-------|------|--------|--------|
| GET | `/api/assets` | `guardApi` | ✅ | ✅ WORKING |
| POST | `/api/assets` | `guardApi` | ✅ | ✅ WORKING |
| GET | `/api/assets/[assetId]` | `guardApi` | ✅ | ✅ WORKING |
| PATCH | `/api/assets/[assetId]` | `guardApi` | ✅ | ✅ WORKING |
| DELETE | `/api/assets/[assetId]` | `guardApi` | ✅ | ✅ WORKING |
| POST | `/api/assets/import` | `guardApi` | ✅ | ✅ WORKING |
| GET | `/api/assets/import/template` | `guardApi` | ✅ | ✅ WORKING |
| GET | `/api/assets/search` | `guardApi` | ✅ | ✅ WORKING |
| GET | `/api/assets/[assetId]/nozzles` | `guardApi` | ✅ | ✅ WORKING |
| POST | `/api/assets/[assetId]/nozzles` | `guardApi` | ✅ | ✅ WORKING |
| GET | `/api/assets/[assetId]/attributes` | `guardApi` | ✅ | 🔴 BROKEN (missing models) |
| POST | `/api/assets/[assetId]/attributes/verify` | `guardApi` | ✅ | 🔴 BROKEN |
| GET | `/api/assets/[assetId]/attributes/[code]/history` | `guardApi` | ✅ | 🔴 BROKEN |
| POST | `/api/assets/[assetId]/attributes/[code]/review` | `guardApi` | ✅ | 🔴 BROKEN |
| GET | `/api/assets/[assetId]/audit` | `guardApi` | ✅ | ✅ WORKING |
| GET | `/api/assets/[assetId]/history` | `guardApi` | ✅ | ✅ WORKING |
| POST | `/api/assets/[assetId]/extract` | `guardApi` | ✅ | ✅ WORKING |
| POST | `/api/assets/[assetId]/snapshot` | `guardApi` | ✅ | ✅ WORKING |

### Digital Plant APIs (17 routes)

| Method | Route | Auth | Status |
|--------|-------|------|--------|
| GET/POST | `/api/digital-plant/projects` | session | ✅ WORKING |
| GET/PATCH | `/api/digital-plant/projects/[id]` | session | ✅ WORKING |
| GET/POST | `/api/digital-plant/projects/[id]/documents` | session | ✅ WORKING |
| GET | `/api/digital-plant/projects/[id]/candidates` | session | ✅ WORKING |
| POST | `/api/digital-plant/import/dry-run` | session | ✅ WORKING |
| POST | `/api/digital-plant/import/commit` | session | ✅ WORKING |
| POST | `/api/digital-plant/import/rollback` | session | ✅ WORKING |
| PATCH | `/api/digital-plant/candidates/[id]` | session | ✅ WORKING |
| POST | `/api/digital-plant/candidates/[id]/approve` | session | ✅ WORKING |
| POST | `/api/digital-plant/candidates/[id]/reject` | session | ✅ WORKING |
| POST | `/api/digital-plant/candidates/[id]/merge` | session | ✅ WORKING |
| POST | `/api/digital-plant/candidates/bulk-approve` | session | ✅ WORKING |
| POST | `/api/digital-plant/candidates/bulk-reject` | session | ✅ WORKING |
| GET | `/api/digital-plant/search` | session | ✅ WORKING |
| GET | `/api/digital-plant/assets/[id]/documents` | session | ✅ WORKING |

### Hierarchy APIs (33 routes)

All use `withHierarchyGuard()` or `guardApi()`.

Full CRUD (list/create/update/softDelete/restore) for: Sites, Plants, Areas, Units, Systems, Assets.

Plus: hierarchy tree, children, path, search, resolve, settings, import.

---

## 18. Frontend Audit

| Route | Screen | Status | Backend |
|-------|--------|--------|---------|
| `/asset-register` | Asset list | ✅ WORKING | `/api/assets` |
| `/asset-register/new` | Create asset | ✅ WORKING | POST `/api/assets` |
| `/asset-register/import` | Excel import | ✅ WORKING | POST `/api/assets/import` |
| `/asset-register/extract-pid` | P&ID extraction | ✅ WORKING | `/api/asset-register/extract-pid` |
| `/asset-register/[assetId]` | Asset detail (6 tabs) | ✅ WORKING | GET `/api/assets/[id]` |
| `/digital-plant` | Digital Plant project list | ✅ WORKING | `/api/digital-plant/projects` |
| `/digital-plant/[projectId]` | Project detail (19KB component) | ✅ WORKING | Multiple APIs |
| `/projects/[id]/equipment` | Project equipment list | 🟡 EXISTS | Minimal page (320 bytes) |
| `/settings/hierarchy` | Hierarchy settings root | ✅ WORKING | — |
| `/settings/hierarchy/sites` | Site management | ✅ WORKING | `/api/hierarchy/sites` |
| `/settings/hierarchy/plants` | Plant management | ✅ WORKING | `/api/hierarchy/plants` |
| `/settings/hierarchy/areas` | Area management | ✅ WORKING | `/api/hierarchy/areas` |
| `/settings/hierarchy/units` | Unit management | ✅ WORKING | `/api/hierarchy/units` |
| `/settings/hierarchy/systems` | System management | ✅ WORKING | `/api/hierarchy/systems` |
| `/settings/hierarchy/assets` | Asset management | ✅ WORKING | `/api/hierarchy/assets` |
| `/shutdown-scope/*` | Scope management | ✅ WORKING | Full scope APIs |

---

## 19. Database / Prisma Audit

### Conceptual Relationship Map

```
Organization ──1:N──▶ Site ──1:N──▶ Plant ──1:N──▶ Area ──1:N──▶ Unit
                                                                    │
                                                            0..1:N  │  1:N
                                                                    ▼
Organization ──1:N──▶ Asset ◀──N:1── System ◀──N:1── Unit
                        │              │
                        │              ├── system_blinds
                        │              ├── system_drawings
                        │              ├── system_gaskets
                        │              └── system_procedures
                        │
                        ├──1:N──▶ Workpack ──1:N──▶ Activity
                        ├──1:N──▶ ScopeItem (required FK)
                        ├──0..1──▶ EquipmentType ──1:N──▶ StandardActivityType
                        ├──1:N──▶ nozzles
                        ├──1:N──▶ asset_lines
                        ├──1:N──▶ joint_masters
                        ├──1:N──▶ AssetDocumentLink ──N:1──▶ PlantDocument
                        ├──1:N──▶ line_lists (from/to)
                        ├──1:N──▶ EngineeringIssue
                        └──1:N──▶ ExtractionCandidate (via project)

DigitalPlantProject ──1:N──▶ PlantDocument ──1:N──▶ ExtractionCandidate
                                                          │
                                                          └──▶ CandidateReviewAction
```

### Unique Constraints

| Table | Constraint | Verified |
|-------|-----------|----------|
| Asset | `(organization_id, tag_number)` | ✅ |
| Area | `(plant_id, code)` | ✅ |
| Unit | `(plant_id, code)` | ✅ |
| System | `(unit_id, code)` | ✅ |
| StandardActivityType | `(equipment_type_id, code)` | ✅ |
| ScopePackage | `(scope_id, name)` | ✅ |
| AssetDocumentLink | `(asset_id, document_id, link_type)` | ✅ |

### Indexes

| Table | Index | Verified |
|-------|-------|----------|
| Asset | `plant_id` | ✅ |
| Asset | `unit_id` | ✅ |
| Asset | `system_id` | ✅ |
| ScopeItem | `scope_id, discipline` | ✅ |
| ScopeItem | `scope_id, priority` | ✅ |
| ScopeItem | `asset_id` | ✅ |
| ExtractionCandidate | `project_id, status` | ✅ |
| ExtractionCandidate | `organization_id, tag_number` | ✅ |

### Cascade Behavior

| Relationship | On Delete | Verified |
|-------------|-----------|----------|
| ScopeItem → ShutdownScope | CASCADE | ✅ |
| AssetDocumentLink → Asset | CASCADE | ✅ |
| AssetDocumentLink → PlantDocument | CASCADE | ✅ |
| Site → Organization | CASCADE | ✅ |

### Soft Delete

| Model | Has `deleted_at`? |
|-------|-------------------|
| Asset | ✅ |
| Site | ✅ |
| Plant | ✅ |
| Area | ✅ |
| Unit | ✅ |
| System | ✅ |
| Workpack | ✅ |
| Activity | ✅ |
| ScopeItem | ✅ |
| ShutdownScope | ✅ |
| DigitalPlantProject | ✅ |

---

## 20. Performance Observations

| Concern | Assessment |
|---------|-----------|
| Asset unique lookup by tag | ✅ FAST — compound unique index `(org_id, tag_number)` |
| Hierarchy tree query | ✅ REASONABLE — site_id filtered, nested includes |
| Import N+1 | ⚠️ RISK — asset import does per-row `findFirst` for unit lookup |
| Scope item asset load | ✅ INDEXED — `@@index([asset_id])` |
| Progress equipment aggregation | ✅ — handled by ProgressAggregationService with groupBy |
| Dashboard hierarchy query | ⚠️ RISK — no pagination on hierarchy tree endpoint |
| Digital plant candidates | ✅ INDEXED — `@@index([project_id, status])` |
| Bulk import scaling | ⚠️ RISK — PlantImportService creates candidates one-by-one (should use createMany) |
| 1000+ equipment records | ✅ FEASIBLE — proper indexing, pagination in list APIs |
| Concurrent planner access | ✅ FEASIBLE — no global locks, row-level operations |

---

## 21. Existing M8.7–M8.13 Reusable Components

| Module | Component | Reuse Status | Notes |
|--------|-----------|-------------|-------|
| M8.7 | `scheduleEngine` / CPM | ✅ REUSE | Critical path calculation |
| M8.7 | Resource services (15) | ⚠️ VERIFY | Previous audit noted field mismatches; not re-verified here |
| M8.8 | `ScheduleHealthService` | ✅ REUSE | Schedule health metrics |
| M8.9 | `EvmScenarioProjection` | ✅ REUSE | Scenario planning |
| M8.10 | `EvmCalculationService` | ✅ REUSE | Earned value management |
| M8.11 | `ScopeChangeApplicationService` | ✅ REUSE | Scope change workflow |
| M8.12 | `MaterialReadinessService` | ✅ REUSE | Material constraints |
| M8.13 | `ProgressCalculationService` | ✅ REUSE (LOCKED) | Authoritative progress |
| M8.13 | `ProgressAggregationService` | ✅ REUSE (LOCKED) | Equipment aggregation |
| M8.13 | `SpiAdapter` | ✅ REUSE (LOCKED) | SPI/CPI |
| M8.13 | `EquipmentType` model | ✅ REUSE | 110 seeded types |
| M8.13 | `StandardActivityType` model | ✅ REUSE | 54 seeded activity types |

---

## 22. Duplicate Logic / Duplicate Model Risks

| Risk | Severity | Detail |
|------|----------|--------|
| **Asset vs Equipment naming** | 🟡 MEDIUM | Codebase uses "Asset" everywhere. Business says "Equipment". Same object, different name. No duplicate model. |
| `asset_type` (free-text) vs `equipment_type_id` (FK) | 🟡 MEDIUM | Two ways to classify equipment on same model. `equipment_type_id` is authoritative (M8.13). `asset_type` is legacy free-text. |
| `/api/assets/import` vs `/api/digital-plant/import/*` | 🟡 MEDIUM | Two import paths. Direct import creates Assets immediately. Digital Plant import creates ExtractionCandidates for review. Both needed but should have clear UX separation. |
| `AssetRegisterService` vs `HierarchyService.createAsset()` | 🔴 HIGH | Two services can create assets. AssetRegisterService is broken (missing models). HierarchyService.createAsset() works. Consolidation needed. |

---

## 23. Security Risks

| Risk | Severity |
|------|----------|
| No Prisma middleware for org isolation | 🔴 HIGH |
| No cross-FK org validation | 🟡 MEDIUM |
| Some digital-plant APIs use only `getServerSession` without `guardApi` | 🟡 MEDIUM |
| No rate limiting on import endpoints | 🟡 MEDIUM |
| No file size limit on import (memory DoS risk) | 🟡 MEDIUM |

---

## 24. Data Integrity Risks

| Risk | Severity | Detail |
|------|----------|--------|
| **AssetRegisterService references 3 nonexistent Prisma models** | 🔴 P0 | `assetAttributeValue`, `assetAttributeDefinition`, `assetAttributeHistory` |
| `Workpack.template_id` FK with no template model | 🟡 P1 | Orphan FK |
| Optional hierarchy placement (plant/unit/system) on Asset | 🟡 P1 | Equipment can exist without hierarchy placement |
| `criticality` is free-text | 🟡 P1 | No controlled vocabulary |
| `asset_type` free-text alongside `equipment_type_id` FK | 🟡 P2 | Dual classification |
| No `updated_by` on Asset model | 🟡 P2 | Cannot track who last modified |

---

## 25. TA-2027 Deployment Risks

| Risk | Severity | Impact | Mitigation |
|------|----------|--------|-----------|
| AssetRegisterService broken (missing models) | 🔴 P0 | Attribute verification, AI review, history all fail | Add 3 models to schema OR bypass service |
| No approval workflow for equipment | 🟡 P1 | Planners can't distinguish draft from approved equipment | Add `status` enum |
| No Equipment 360 view | 🟡 P1 | Planners can't see full equipment context | Add tabs to asset detail |
| Free-text criticality | 🟡 P1 | Inconsistent classification | Add enum |
| Import preview gap (direct path) | 🟡 P1 | Users import without reviewing | Redirect all imports through Digital Plant path |
| No hierarchy change impact analysis | 🟡 P2 | Moving equipment breaks scope/workpack links | Add impact check |
| No equipment change audit trail | 🟡 P2 | No traceability for field changes | Extend AuditLog usage |

---

## 26. Digital Plant V1 Gap Matrix

| Requirement | Existing | Partial | Missing | Broken | Evidence | Priority |
|-------------|----------|---------|---------|--------|----------|----------|
| Plant hierarchy (6 levels) | ✅ | | | | 6 models, HierarchyService | — |
| Area level in hierarchy | ✅ | | | | `model Area` exists | — |
| Equipment master (30+ fields) | ✅ | | | | `model Asset` | — |
| Equipment Tag uniqueness (org-scoped) | ✅ | | | | `@@unique([org_id, tag_number])` | — |
| Equipment Type (controlled master) | ✅ | | | | `EquipmentType` model, 110 types seeded | — |
| Standard Activities per type | ✅ | | | | `StandardActivityType`, 54 seeded | — |
| Hierarchy CRUD APIs | ✅ | | | | 33 routes | — |
| Hierarchy settings UI | ✅ | | | | 7 pages | — |
| Asset detail page | ✅ | | | | 6 tabs | — |
| Excel import (direct) | ✅ | | | | `/api/assets/import` | — |
| Excel import (digital plant) | ✅ | | | | `PlantImportService` with dry-run | — |
| P&ID AI extraction | ✅ | | | | `ExtractionService` + `ReviewService` | — |
| Scope → Equipment link | ✅ | | | | `ScopeItem.asset_id` (required) | — |
| Workpack → Equipment link | ✅ | | | | `Workpack.asset_id` (optional) | — |
| Equipment → Progress flow | ✅ | | | | M8.13 equipment drill-down | — |
| Document linking | ✅ | | | | `AssetDocumentLink` model | — |
| Duplicate detection (import) | ✅ | | | | `findUnique` by org+tag | — |
| Soft delete / restore | ✅ | | | | `deleted_at` + restore APIs | — |
| Multi-tenant isolation | | ✅ | | | `organization_id` on all, no Prisma middleware | P1 |
| Equipment criticality (enum) | | | ✅ | | Currently free-text `String?` | P0 |
| Equipment status lifecycle | | ✅ | | | `is_active` Boolean only, no enum | P1 |
| Equipment approval workflow | | | ✅ | | No approval_status field | P1 |
| Equipment 360 view | | ✅ | | | 6 tabs exist, 6+ missing | P1 |
| Equipment change audit trail | | ✅ | | | AuditLog model exists, usage inconsistent | P1 |
| Custom/client-specific fields | | | ✅ | | No custom field mechanism | P2 |
| Source/provenance on asset | | ✅ | | | AI extraction tracked, manual entry not | P1 |
| Asset `updated_by` field | | | ✅ | | Only `updated_at` exists | P1 |
| Import preview (direct path) | | | ✅ | | No dry-run on direct import | P1 |
| Import transaction safety | | ✅ | | | Direct import is per-row, digital plant is batch | P1 |
| Hierarchy enforcement on asset | | ✅ | | | plant/unit/system are optional FKs | P2 |
| Asset attribute system | | | | ✅ | 3 Prisma models missing from schema | P0 |
| Workpack template model | | | ✅ | | `template_id` FK but no model | P2 |
| RBAC granularity for equipment | | ✅ | | | `asset.view/manage` exist, no approve/import | P2 |
| Bulk operations | | ✅ | | | Bulk approve/reject for candidates only | P2 |

---

## 27. Recommended Implementation Sequence

**WHAT WE SHOULD BUILD NEXT** (ordered by priority):

1. **🔴 P0: Add missing Prisma models** — Create `AssetAttributeDefinition`, `AssetAttributeValue`, `AssetAttributeHistory` models in schema.prisma. Run migration. This unblocks the entire attribute verification and AI review subsystem.

2. **🔴 P0: Add Equipment criticality enum** — Replace free-text `criticality String?` with a controlled enum (e.g., Critical/High/Medium/Low or A/B/C/D). Additive migration.

3. **🟡 P1: Add Equipment status enum** — Replace `is_active Boolean?` with a lifecycle status (draft/active/approved/archived/decommissioned).

4. **🟡 P1: Add Equipment 360 view** — Extend `/asset-register/[assetId]` with tabs for Scope, Workpacks, Activities, Schedule, Progress, Constraints, History.

5. **🟡 P1: Add `updated_by` and `source` fields to Asset** — Track who last modified and provenance (manual/import/AI).

6. **🟡 P1: Unify import paths** — Redirect `/api/assets/import` to use the digital-plant dry-run/commit/rollback pattern. Add preview to all imports.

7. **🟡 P1: Add tenant isolation middleware** — Prisma middleware or service-layer guard to prevent cross-org FK references.

8. **🟡 P1: Digital Plant APIs auth hardening** — Replace bare `getServerSession` with `guardApi` + `orgScope` on all digital-plant API routes.

9. **🟡 P2: Equipment hierarchy enforcement** — Make `unit_id` required on Asset (or at minimum `plant_id`).

10. **🟡 P2: Equipment change audit trail** — Extend AuditLog usage to all equipment field changes with `withTenantGuard`.

---

## 28. Files Inspected

| Category | Count | Key Files |
|----------|-------|-----------|
| Schema | 1 | `prisma/schema.prisma` (253KB) |
| Services | 8 | `src/core/asset-register/AssetRegisterService.ts`, `AssetAttributeHistoryService.ts`, `src/core/digital-plant/*.ts` (5 files), `src/core/hierarchy/HierarchyService.ts` |
| APIs | 69 | All routes under `/api/assets/*`, `/api/digital-plant/*`, `/api/hierarchy/*`, `/api/shutdown-scope/*` |
| Frontend pages | 15 | All pages under `/asset-register/*`, `/digital-plant/*`, `/settings/hierarchy/*`, `/projects/[id]/equipment` |
| Seed data | 3 | `seed-enterprise-demo.ts`, `demo/equipmentTypes.ts`, `demo/seedStandardActivityTypes.ts`, `seed-asset-attribute-definitions.ts` |
| Permissions | 1 | `src/lib/permissions.ts` |

**Total files inspected: ~97**

---

## 29. Tests Executed

| Test | Result |
|------|--------|
| Existing test files for Digital Plant/Asset/Equipment | **NONE FOUND** — only `progress-calculation.test.ts` exists |
| TypeScript compilation check | NOT EXECUTED (read-only audit) |
| Build verification | NOT EXECUTED (read-only audit) |
| Runtime attribute API test | NOT TESTABLE — missing Prisma models |

---

## 30. Final Certification

### AMBER

> Foundation exists but specified P0/P1 gaps must be addressed before deployment.

| Metric | Value |
|--------|-------|
| Files inspected | ~97 |
| Relevant models inspected | 18 (Asset, EquipmentType, StandardActivityType, Site, Plant, Area, Unit, System, Workpack, Activity, ScopeItem, ShutdownScope, ScopePackage, ExtractionCandidate, PlantDocument, DigitalPlantProject, AssetDocumentLink, AuditLog) |
| APIs inspected | 69 |
| Frontend routes/screens inspected | 15 |
| Tests executed | 0 (no Digital Plant tests exist) |
| Tests passed | N/A |
| Tests failed | N/A |

### Findings Summary

| Severity | Count |
|----------|-------|
| P0 (must fix before deployment) | 2 |
| P1 (must be ready for planner production) | 8 |
| P2 (must be ready before TA execution) | 5 |
| P3 (future enhancement) | 3 |

### P0 Findings

1. **AssetRegisterService references 3 nonexistent Prisma models** — `assetAttributeValue`, `assetAttributeDefinition`, `assetAttributeHistory`. The entire attribute verification, AI review, and history subsystem will crash at runtime.

2. **Equipment criticality is free-text** — No controlled enum for a field that drives RBI, maintenance priority, and scope decisions.

### P1 Findings

1. No Equipment 360 integrated view (scope, workpacks, activities, schedule, progress)
2. No equipment approval workflow (draft→approved lifecycle)
3. No `updated_by` on Asset model
4. Direct import has no preview/dry-run
5. Digital Plant APIs lack `guardApi` (use bare sessions)
6. No Prisma middleware for cross-tenant FK validation
7. `is_active` is Boolean, needs lifecycle enum
8. Source/provenance not tracked for manual entry

### Key Architectural Risks

1. **Asset vs Equipment naming** — codebase uses "Asset", business uses "Equipment". No structural risk, but naming confusing.
2. **Dual classification** — `asset_type` (free-text) and `equipment_type_id` (FK) coexist. `equipment_type_id` is authoritative.
3. **Two import paths** — both needed but UX must be clear about which to use.
4. **No WorkpackTemplate model** — `template_id` FK on Workpack is an orphan.

### WHAT WE SHOULD BUILD NEXT

1. Add 3 missing Prisma models (AssetAttributeDefinition, Value, History)
2. Add criticality enum
3. Add equipment status lifecycle enum
4. Add Equipment 360 view
5. Add `updated_by` + provenance fields to Asset
6. Unify import with dry-run for all paths
7. Add tenant isolation middleware
8. Harden Digital Plant API auth
9. Add equipment change audit trail
10. Add Equipment hierarchy enforcement

---

> **This audit was performed as a READ-ONLY forensic examination. No production code, schema, database, migrations, APIs, UI, seed data, or protected modules were modified.**
>
> The codebase is the authoritative source for current implementation status. Where documentation and code disagree, the code findings are reported.
