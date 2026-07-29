# M6.6 — Enterprise Asset Hierarchy Audit

## Status: 🔍 AUDIT COMPLETE — Awaiting Plan Approval

---

## 1. AUTHORITATIVE HIERARCHY (Target)

```
Platform
  └─ Company (Organization / Tenant)
       └─ Site / Plant
            └─ Area (optional)
                 └─ Unit
                      └─ System
                           └─ Equipment (Asset)
                                └─ Workpack
                                     └─ Activity
```

---

## 2. PRISMA SCHEMA STATUS

### Active Schema: `prisma/schema.prisma` (3180 lines)

| Model | Exists | Parent FK | Notes |
|-------|--------|-----------|-------|
| `Organization` | ✅ L916 | — (root) | Tenant model. Has `feature_flags Json?`, `settings Json?` |
| `Site` | ✅ L1343 | `organization_id` | ✅ Correct parent |
| `Plant` | ✅ L1055 | `organization_id`, `site_id` | ✅ Correct: Site → Plant |
| `Area` | ✅ L1080 | `organization_id`, `site_id`, `plant_id` | ✅ Correct: Plant → Area |
| `Unit` | ✅ L1416 | `organization_id`, `site_id`, `plant_id`, **`area_id?`** | ✅ Has optional `area_id` — Area support exists |
| `System` | ✅ L1393 | `organization_id`, `site_id`, `unit_id` | ✅ Correct: Unit → System |
| `Asset` | ✅ L421 | `organization_id`, `site_id`, `system_id?` | ⚠️ Missing `plant_id`, `unit_id`, `area_id` |
| `Equipment` | ✅ L726 | `projectId`, `unitId?`, `equipmentTypeId?` | 🔴 **Duplicate of Asset**, uses old `project` pattern, no `organization_id` |
| `Workpack` | ✅ L72 | `organization_id`, `site_id`, `unit_id?`, `system_id?`, `asset_id?`, `plant_id?`, `event_id?` | ✅ Full hierarchy FKs |
| `Activity` | ✅ L9 | `workpack_id` | ✅ Correct: Workpack → Activity |

### Second Schema: `prisma/schema_server_105kb.prisma` (2843 lines)

This appears to be an older copy. Key difference: the `Unit` model here has **no `area_id`** field (L384-406). The `Area` model doesn't exist in this file. The active schema (`schema.prisma`) is authoritative.

### Schema Inconsistencies

| # | Issue | Severity |
|---|-------|----------|
| S1 | **`Equipment` model is a dead duplicate of `Asset`** — references `projectId` not `organization_id`, has no tenant scoping. Not used by any service or page. | 🔴 HIGH |
| S2 | **`Asset` model lacks `plant_id`, `unit_id`, `area_id`** — Only has `site_id` and `system_id`. HierarchyService compensates by looking up through System→Unit→Plant in code, but the columns aren't persisted. | ⚠️ MEDIUM |
| S3 | **`schema_server_105kb.prisma` is stale** — missing `Area` model, `Unit` lacks `area_id`. Not the active schema but could cause confusion. | ⚠️ MEDIUM |
| S4 | `KnowledgeAsset` model stores **no hierarchy references** — no `site_id`, `area_id`, `unit_id`, `system_id`, `equipment_type`, `equipment_category`. Cannot support hierarchy-scoped AI recommendations. | ⚠️ MEDIUM |

---

## 3. HIERARCHY SERVICE

### `src/core/hierarchy/HierarchyService.ts` (841 lines)

| Entity | list | create | update | softDelete | restore | Status |
|--------|------|--------|--------|------------|---------|--------|
| Site | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ Complete |
| Plant | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ Complete |
| Area | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ Complete |
| Unit | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ Complete — supports optional `area_id` |
| System | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ Complete |
| Asset | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ Complete — derives hierarchy from System |

**Assessment: HierarchyService is the Single Source of Truth for CRUD. Full tenant scoping, audit logging, code uniqueness validation.**

### `src/core/hierarchy/HierarchyImport.ts` (366 lines)
- ✅ Supports import of all 6 entity types
- ✅ Uses names for parent resolution (not UUIDs)
- ✅ Validation report before commit

### `src/core/hierarchy/apiHelpers.ts` (53 lines)
- ✅ Permission guards for all hierarchy levels
- ✅ Shared list parameter parsing

---

## 4. API ROUTES

| API Route | Method | Service | Status |
|-----------|--------|---------|--------|
| `/api/hierarchy` | GET | Direct Prisma | ⚠️ Loads full tree (Plant→Unit→System→Asset) — **no lazy loading**, **no Area level** |
| `/api/hierarchy/sites` | GET, POST | HierarchyService | ✅ |
| `/api/hierarchy/sites/[id]` | GET, PUT, DELETE | HierarchyService | ✅ |
| `/api/hierarchy/plants` | GET, POST | HierarchyService | ✅ |
| `/api/hierarchy/areas` | GET, POST | HierarchyService | ✅ |
| `/api/hierarchy/areas/[id]` | GET, PUT, DELETE | HierarchyService | ✅ |
| `/api/hierarchy/units` | GET, POST | HierarchyService | ✅ |
| `/api/hierarchy/systems` | GET, POST | HierarchyService | ✅ |
| `/api/hierarchy/assets` | GET, POST | HierarchyService | ✅ |
| `/api/hierarchy/[type]` | GET, POST | Dynamic routing | ✅ |
| `/api/hierarchy/[type]/[id]` | GET, PUT, DELETE | Dynamic routing | ✅ |
| `/api/hierarchy/import` | POST | HierarchyImport | ✅ |
| `/api/settings/sites` | GET, POST | Direct Prisma | ⚠️ **Parallel API** — duplicates `/api/hierarchy/sites` |

### API Issues

| # | Issue | Severity |
|---|-------|----------|
| A1 | `/api/hierarchy` (root route) loads **full nested tree eagerly** — no pagination, no lazy loading. Will degrade at scale. | ⚠️ MEDIUM |
| A2 | `/api/hierarchy` **skips Area level** — goes Plant→Unit directly. Areas are invisible in cascading selectors that use this endpoint. | 🔴 HIGH |
| A3 | `/api/settings/sites` is a **parallel site API** — some pages use this, others use `/api/hierarchy/sites`. Should consolidate. | ⚠️ MEDIUM |

---

## 5. UI PAGES — HIERARCHY MANAGEMENT

### Settings → Asset Hierarchy

| Page | File | Status |
|------|------|--------|
| Sites | `settings/hierarchy/sites/page.tsx` | ✅ Uses `HierarchyCrudPage` |
| Plants | `settings/hierarchy/plants/page.tsx` | ✅ Uses `HierarchyCrudPage` |
| **Areas** | `settings/hierarchy/areas/page.tsx` | ✅ Uses `HierarchyCrudPage` |
| Units | `settings/hierarchy/units/page.tsx` | ✅ Uses `HierarchyCrudPage` |
| Systems | `settings/hierarchy/systems/page.tsx` | ✅ Uses `HierarchyCrudPage` |
| Assets | `settings/hierarchy/assets/page.tsx` | ✅ Uses `HierarchyCrudPage` |

**Assessment: Full CRUD for all 6 levels exists. Navigation is correctly ordered: Sites → Plants → Areas → Units → Systems → Assets.**

### `HierarchyCrudPage` Component (662 lines)
- ✅ Generic component handling all 6 entity types
- ✅ Parent selector dropdowns (no UUID exposure)
- ✅ Search, pagination, status filtering, archive/restore
- ⚠️ Units config uses `parentLabel: 'Plant'` — does NOT show Area selector on the Unit form. A unit is always created under a Plant, but there's no optional Area dropdown.

---

## 6. UI PAGES — FORMS USING HIERARCHY

### Cascading Selectors

| Page | Hierarchy Used | Missing Levels |
|------|---------------|----------------|
| Event Create (`events/new`) | Site only | ⚠️ No cascading below site |
| Event Edit | Site dropdown | ⚠️ No cascading |
| Workpack Create | Site → Plant → Unit → System → Asset | 🔴 **Missing Area** in cascade |
| Asset Import | Site → Unit (cascading via `/api/hierarchy`) | 🔴 **Missing Plant, Area** levels |
| Asset Register Tree | Site → Plant → Unit → System → Asset | 🔴 **Missing Area** |
| New System | Site → Unit | ⚠️ Skips Plant, Area |
| New Unit | Site → Plant | ⚠️ No Area option |

### Selector Issues

| # | Issue | Severity |
|---|-------|----------|
| U1 | **No reusable `HierarchySelector` component** — each page builds its own cascading dropdown chain with duplicated fetch logic. | 🔴 HIGH |
| U2 | **Area level skipped in all cascading selectors** — WorkpackCreateForm, RegisterTreeClient, and asset import all skip Plant→Area→Unit. | 🔴 HIGH |
| U3 | `/api/hierarchy` endpoint (used by WorkpackCreateForm) fetches **full tree eagerly** without Areas. | ⚠️ MEDIUM |

---

## 7. KNOWLEDGE ENGINE

| Aspect | Status |
|--------|--------|
| `KnowledgeAsset` model | 🔴 **No hierarchy references** — no site_id, area_id, unit_id, system_id, equipment_type, equipment_category |
| `KnowledgeReviewService` | ⚠️ Captures equipment_type and job_type from workpacks but not hierarchy location |
| AI recommendations | ⚠️ Cannot scope by hierarchy level |

---

## 8. WORKPACKS & ACTIVITIES

| Aspect | Status |
|--------|--------|
| Workpack hierarchy FKs | ✅ Has `site_id`, `plant_id?`, `unit_id?`, `system_id?`, `asset_id?` |
| Workpack → Equipment/System | ✅ Can attach to either |
| Activity → Workpack | ✅ Correct parent |
| Template independence | ✅ Templates are equipment-independent unless explicitly linked |

---

## 9. IMPORT/EXPORT

| Feature | Status |
|---------|--------|
| Hierarchy Import | ✅ `HierarchyImport.ts` supports all 6 levels with name-based parent resolution |
| Excel template columns | ⚠️ Uses Code/Name/Parent — no explicit hierarchy column structure (Company/Site/Area/Unit/System/Equipment) |
| Asset Import (`/asset-register/import`) | ⚠️ Only has Site→Unit cascade, no Plant/Area/System levels |
| Line List Import | ✅ Uses site_id + unit_id |

---

## 10. SECURITY & PERMISSIONS

| Permission | Exists |
|------------|--------|
| `site.view` / `site.manage` | ✅ |
| `plant.view` / `plant.manage` | ✅ |
| `area.view` / `area.manage` | ✅ |
| `unit.view` / `unit.manage` | ✅ |
| `system.view` / `system.manage` | ✅ |
| `asset.view` / `asset.manage` | ✅ |
| Platform users browse all companies | ✅ Via `isPlatformRole()` check |
| Tenant users scoped to own org | ✅ Via `organization_id` in all queries |

---

## 11. NAVIGATION & BREADCRUMBS

| Aspect | Status |
|--------|--------|
| Settings sidebar | ✅ Full hierarchy nav: Sites → Plants → Areas → Units → Systems → Assets |
| Breadcrumbs | 🔴 **No hierarchy breadcrumbs** on any operational page |
| Lazy loading | 🔴 **Not implemented** — `/api/hierarchy` loads full tree |

---

## 12. "AREA OPTIONAL" CONFIGURATION

| Aspect | Status |
|--------|--------|
| `area_id` on Unit model | ✅ Optional (`String?`) in `schema.prisma` |
| `HierarchyService.createUnit` | ✅ Handles optional `area_id` with parent validation |
| `Organization.feature_flags` | ✅ Exists as `Json?` — can store `use_areas: true/false` |
| **Actual `use_areas` flag** | 🔴 **Not implemented** — no code reads this flag to toggle Area level in cascading selectors |
| Settings UI for toggle | 🔴 **Missing** |

---

## 13. SUMMARY SCORECARD

| Category | Score | Notes |
|----------|-------|-------|
| **Prisma Models** | 🟡 80% | Area exists, hierarchy chain correct. `Equipment` model is dead duplicate. `Asset` missing `plant_id`/`unit_id`/`area_id` columns. |
| **HierarchyService** | 🟢 95% | Full CRUD, audit logging, code uniqueness, optional Area. Gold standard. |
| **API Routes** | 🟡 75% | All entity routes exist. Root `/api/hierarchy` skips Areas and loads eagerly. Parallel `/api/settings/sites`. |
| **CRUD Pages** | 🟢 90% | All 6 levels have management pages via `HierarchyCrudPage`. |
| **Cascading Selectors** | 🔴 40% | No reusable component. Area level skipped everywhere. Each page has its own fetch logic. |
| **Knowledge Engine** | 🔴 20% | No hierarchy references on `KnowledgeAsset`. |
| **Import/Export** | 🟡 70% | Hierarchy import works. Asset import missing Plant/Area cascade. |
| **Breadcrumbs** | 🔴 0% | Not implemented. |
| **Area Toggle** | 🔴 10% | Schema supports it, code doesn't use it. |
| **Lazy Loading** | 🔴 10% | Root hierarchy API loads full tree. |

---

## 14. MUST-DO ITEMS FOR M6.6

| # | Item | Priority | Scope |
|---|------|----------|-------|
| 1 | Create reusable `HierarchySelector` component with lazy-loaded cascading dropdowns | P0 | New component |
| 2 | Add Area level to `/api/hierarchy` root endpoint | P0 | API fix |
| 3 | Replace all inline cascading selectors with `HierarchySelector` | P0 | Multiple pages |
| 4 | Implement `use_areas` feature flag in Organization settings | P1 | Settings page + flag logic |
| 5 | Add hierarchy breadcrumbs component | P1 | New component |
| 6 | Add `plant_id`, `unit_id`, `area_id` to `Asset` model (schema migration) | P2 | Schema + migration |
| 7 | Add hierarchy references to `KnowledgeAsset` model | P2 | Schema + service |
| 8 | Remove dead `Equipment` model | P2 | Schema cleanup |
| 9 | Consolidate `/api/settings/sites` into `/api/hierarchy/sites` | P2 | API consolidation |
| 10 | Lazy-load hierarchy API (level-by-level) | P1 | API refactor |
| 11 | Add hierarchy filtering to report pages | P3 | Reports |
| 12 | Update Excel import templates with full hierarchy columns | P2 | Import |
