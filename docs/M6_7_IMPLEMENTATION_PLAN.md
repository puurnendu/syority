# M6.7 — Enterprise Hierarchy Stabilization: Implementation Plan

## Status: 📋 AWAITING APPROVAL

---

## 1. AUDIT SUMMARY

### What's Already Working (Do NOT Touch)

| Component | Status | Lines |
|-----------|--------|-------|
| `HierarchyService` | ✅ Full CRUD for all 6 levels (Site→Plant→Area→Unit→System→Asset), audit logging, code uniqueness | 841 |
| `HierarchyImport` | ✅ Excel/CSV import with name-based parent resolution, validation, dry-run | 366 |
| `apiHelpers` | ✅ Permission guards, shared parsing | 53 |
| `HierarchyCrudPage` | ✅ Generic CRUD for all 6 levels, including optional Area on Unit form | 662 |
| Settings nav | ✅ Full hierarchy: Sites→Plants→Areas→Units→Systems→Assets | — |
| All entity API routes | ✅ `/api/hierarchy/{sites,plants,areas,units,systems,assets}` | — |
| Permissions | ✅ `{site,plant,area,unit,system,asset}.{view,manage}` all exist | — |
| Prisma models | ✅ All 6 models exist, `Unit.area_id` is optional, relationships correct | — |

### Classified Issues

| # | Issue | Severity | Source |
|---|-------|----------|--------|
| 1 | **No reusable `HierarchySelector` component** — 4+ pages duplicate cascade logic | CRITICAL | M6.6 U1 |
| 2 | **`/api/hierarchy` root skips Area level**, loads full tree eagerly | CRITICAL | M6.6 A1, A2 |
| 3 | **No hierarchy breadcrumbs** on any operational page | HIGH | M6.6 §11 |
| 4 | **`use_areas` toggle not implemented** — schema supports it, no UI reads it | HIGH | M6.6 §12 |
| 5 | **No `loadChildren()`, `loadPath()`, `getBreadcrumb()`** on HierarchyService | HIGH | M6.7 Step 3 |
| 6 | **`/api/settings/sites` parallel API** — 6 consumers use it instead of hierarchy API | MEDIUM | M6.6 A3 |
| 7 | **KnowledgeAsset has no hierarchy refs** — can't scope AI by location | MEDIUM | M6.6 §7 |
| 8 | **Dead `Equipment` model** in schema — references `projectId`, no tenant scoping | MEDIUM | M6.6 S1 |
| 9 | **No hierarchy search API** | MEDIUM | M6.7 Step 9 |
| 10 | **No ADR for hierarchy decisions** | LOW | M6.7 Step 14 |
| 11 | **Report pages have no hierarchy filters** | LOW | M6.7 Step 7 |
| 12 | **Asset model missing `plant_id`, `unit_id`, `area_id`** — HierarchyService derives at runtime | LOW | M6.6 S2 — Keep normalized per Step 12 |

---

## 2. FROZEN HIERARCHY (SINGLE SOURCE OF TRUTH)

```
Platform
    │
Company (Organization)
    │
Site
    │
Plant
    │
Area (optional, per-tenant toggle)
    │
Unit
    │
System
    │
Asset
    │
Workpack
    │
Activity
```

### Normalization Decision (Step 12)

Asset belongs to System. System derives Unit→Plant→Site. We keep the hierarchy **normalized** — Asset stores only `site_id` + `system_id`. The Workpack model's denormalized `plant_id`, `unit_id`, `system_id`, `asset_id` are **justified** for query performance (workpacks are the primary operational entity and require fast multi-level filtering).

---

## 3. IMPLEMENTATION PHASES

### Phase A — HierarchyService Extensions (Step 3)

#### [MODIFY] [HierarchyService.ts](file:///c:/DEV/STO/src/core/hierarchy/HierarchyService.ts)

Add missing methods to the existing service (no rewrite):

```ts
// New methods to add:
static async loadChildren(orgId, level, parentId?)    // Lazy: returns only immediate children
static async loadPath(orgId, entityType, entityId)    // Returns full ancestry path
static async getBreadcrumb(orgId, entityType, entityId)  // Returns formatted breadcrumb array
static async searchHierarchy(orgId, query, levels?)   // Cross-level name/code search
static async resolveNamesToIds(orgId, names: {site?, plant?, area?, unit?, system?, asset?})
static async getOrgSettings(orgId)  // Returns { use_areas: boolean }
```

These build on existing `listSites/listPlants/...` — no duplication.

---

### Phase B — Universal Hierarchy API (Step 5)

#### [MODIFY] [app/api/hierarchy/route.ts](file:///c:/DEV/STO/app/api/hierarchy/route.ts)

Refactor root endpoint to:
- Add Area level between Plant and Unit
- Support `?lazy=true` for level-by-level loading (returns only direct children)
- Default behavior unchanged for backward compat (full nested tree)

#### [NEW] `app/api/hierarchy/children/route.ts`
- `GET /api/hierarchy/children?level=plants&parentId=X` → lazy loads one level
- Delegates to `HierarchyService.loadChildren()`

#### [NEW] `app/api/hierarchy/path/route.ts`
- `GET /api/hierarchy/path?type=system&id=X` → returns full ancestry
- Delegates to `HierarchyService.loadPath()`

#### [NEW] `app/api/hierarchy/search/route.ts`
- `GET /api/hierarchy/search?q=CDU&levels=unit,system` → cross-level search
- Delegates to `HierarchyService.searchHierarchy()`

#### [NEW] `app/api/hierarchy/resolve/route.ts`
- `POST /api/hierarchy/resolve` with `{site: "Bathinda", plant: "Refinery", unit: "CDU"}`
- Delegates to `HierarchyService.resolveNamesToIds()`

#### [NEW] `app/api/hierarchy/settings/route.ts`
- `GET` returns `{ use_areas }` for current tenant
- `PUT` updates `Organization.feature_flags.use_areas`

#### [MODIFY] Consolidate `/api/settings/sites` consumers
- Redirect `/api/settings/sites` → `/api/hierarchy/sites` internally (keep old route for compat)
- Do NOT delete old route — 6 consumers still reference it

---

### Phase C — Universal HierarchySelector (Step 4)

#### [NEW] [src/components/hierarchy/HierarchySelector.tsx](file:///c:/DEV/STO/src/components/hierarchy/HierarchySelector.tsx)

Single reusable cascading component:

```tsx
<HierarchySelector
  value={{ site_id, plant_id, area_id, unit_id, system_id, asset_id }}
  onChange={(selection) => ...}
  requiredLevel="system"   // Stop cascading at this level
  showArea={use_areas}     // From tenant settings
  disabled={false}
/>
```

Implementation:
- Each dropdown fetches via `/api/hierarchy/children?level=X&parentId=Y`
- Auto-selects when only one option exists
- User sees `"name (code)"` — never UUIDs
- Permission-aware: hides levels the user can't see
- Tenant-aware: auto-fetches `use_areas` from `/api/hierarchy/settings`

#### Replace inline cascading selectors in:

| Page | Current Pattern | New |
|------|----------------|-----|
| `events/new/page.tsx` | Manual site dropdown | `<HierarchySelector requiredLevel="site" />` |
| `WorkpackCreateForm.tsx` | 5-level inline fetch chain | `<HierarchySelector requiredLevel="asset" />` |
| `asset-register/import/page.tsx` | Site→Unit (M6.5 dropdowns) | `<HierarchySelector requiredLevel="unit" />` |
| `RegisterTreeClient.tsx` | Inline Site→Plant→Unit→System→Asset | Use children API for tree expansion |

---

### Phase D — Breadcrumbs (Step 8 + Step 11)

#### [NEW] [src/components/hierarchy/HierarchyBreadcrumbs.tsx](file:///c:/DEV/STO/src/components/hierarchy/HierarchyBreadcrumbs.tsx)

```tsx
<HierarchyBreadcrumbs entityType="system" entityId="uuid" />
// Renders: HMEL > Bathinda > Refinery > Process Area > CDU > Fractionation
```

- Single API call to `/api/hierarchy/path?type=X&id=Y`
- Each segment is a clickable link
- Skips Area if `use_areas=false`

#### Add breadcrumbs to:
- Workpack detail page
- Asset detail page
- System detail page (planning)
- Unit detail page (planning)

#### [NEW] Asset Path utility (Step 11)

```ts
// In HierarchyService — computed, never stored
static formatPath(ancestors: {name: string}[]): string
// Returns: "HMEL / Bathinda / Refinery / Process Area / CDU / Fractionation / P-101A"
```

---

### Phase E — `use_areas` Toggle (Step 13)

#### [MODIFY] Organization settings page
- Add toggle: "Enable Areas in asset hierarchy"
- Writes to `Organization.feature_flags.use_areas`
- `HierarchySelector` reads this and shows/hides Area level

#### [NEW] `src/lib/useHierarchySettings.ts`
- Client-side hook: `const { useAreas } = useHierarchySettings()`
- Fetches once from `/api/hierarchy/settings` and caches via SWR

---

### Phase F — Knowledge Engine Metadata (Step 10)

#### [MODIFY] `src/core/knowledge-engine/capture.ts`

Extend `enqueueKnowledgeCapture()` input to accept optional hierarchy metadata:

```ts
export function enqueueKnowledgeCapture(input: {
  organizationId: string;
  category: KnowledgeAssetCategory;
  assetType: string;
  title: string;
  payload: Record<string, unknown>;
  // NEW: optional hierarchy context
  hierarchy?: {
    industry?: string;
    equipment_type?: string;
    equipment_category?: string;
    discipline?: string;
  };
}): void
```

This enriches the `sanitized_payload` with hierarchy context for better AI matching — **no schema migration needed** since `sanitized_payload` is already `Json`.

---

### Phase G — ADR & Documentation (Step 14 + Step 16)

#### [NEW] `docs/adr/ADR-0007-Enterprise-Hierarchy.md`

Covers:
- Why this hierarchy was selected
- Why UUIDs never appear in UI
- Why imports use names not IDs
- Why Area is optional (per-tenant)
- Why selectors are lazy-loaded
- Why hierarchy remains normalized (Asset → System only)
- Why Workpack FKs are denormalized (query perf)

#### [MODIFY] `docs/M6_7_IMPLEMENTATION_PLAN.md` → Final completion report

---

## 4. FILES CHANGED

| File | Action | Phase |
|------|--------|-------|
| `src/core/hierarchy/HierarchyService.ts` | MODIFY — add 6 new methods | A |
| `app/api/hierarchy/route.ts` | MODIFY — add Area level + lazy flag | B |
| `app/api/hierarchy/children/route.ts` | NEW | B |
| `app/api/hierarchy/path/route.ts` | NEW | B |
| `app/api/hierarchy/search/route.ts` | NEW | B |
| `app/api/hierarchy/resolve/route.ts` | NEW | B |
| `app/api/hierarchy/settings/route.ts` | NEW | B, E |
| `src/components/hierarchy/HierarchySelector.tsx` | NEW | C |
| `src/lib/useHierarchySettings.ts` | NEW | C, E |
| `app/(dashboard)/events/new/page.tsx` | MODIFY — use HierarchySelector | C |
| `src/components/Workpack/WorkpackCreateForm.tsx` | MODIFY — use HierarchySelector | C |
| `app/(dashboard)/asset-register/import/page.tsx` | MODIFY — use HierarchySelector | C |
| `src/components/hierarchy/HierarchyBreadcrumbs.tsx` | NEW | D |
| `docs/adr/ADR-0007-Enterprise-Hierarchy.md` | NEW | G |

---

## 5. WHAT IS NOT CHANGING

| Item | Reason |
|------|--------|
| Prisma schema | No migrations — hierarchy is correct, Asset stays normalized (Step 12) |
| `HierarchyCrudPage` | Already handles all 6 levels including Area — working code |
| `HierarchyImport` | Already supports name-based resolution — working code |
| All `/api/hierarchy/{entity}` routes | Already use HierarchyService — working APIs |
| Permissions model | Already complete for all 6 levels |
| Dead `Equipment` model | Deferred — needs migration verification, low risk (unused) |
| Report hierarchy filters | Deferred to M7 — report framework itself needs design first |

---

## 6. VERIFICATION PLAN

### Build
- `npm run build` — zero TypeScript errors

### Grep Checks
- `grep -ri "placeholder.*uuid"` → 0 results
- `grep -r "api/admin/sites"` → 0 results (fixed in M6.5)

### Manual Testing
1. `/settings/hierarchy/*` — all 6 CRUD pages work
2. `/events/new` — `HierarchySelector` for site
3. `/workpacks/new` — full cascade: Site→Plant→(Area)→Unit→System→Asset
4. `/asset-register/import` — cascade uses `HierarchySelector`
5. Toggle `use_areas` off → Area dropdown disappears from all selectors
6. Workpack detail → breadcrumbs show full path
7. `/api/hierarchy/search?q=CDU` → returns matching units/systems
8. `/api/hierarchy/children?level=units&parentId=X` → returns only units under plant X

### No Regressions
- All existing routes respond with same shape
- `/api/hierarchy?site_id=X` still returns nested tree (backward compat)
- `/api/settings/sites` still works (delegates to hierarchy internally)
