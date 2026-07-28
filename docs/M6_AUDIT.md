# M6 Audit Report

**Date:** 2026-07-28  
**Scope:** Full codebase audit for M6.1–M6.4 readiness  
**Auditor:** Lead Software Architect  
**Status:** COMPLETE — awaiting user review before implementation

---

## 1. Implemented ✅

### 1.1 Prisma Schema (3180 lines)

| Model | Status | Location |
|-------|--------|----------|
| `workpack_templates` | ✅ Full M6 schema | L2728–2769 — family/revision/lifecycle/scope + 7 JSON section columns |
| `workpack_template_activities` | ✅ Full | L2698–2714 — sequence, code, duration, hold points, predecessor sequences |
| `workpack_template_logic_links` | ✅ Full | L2771–2784 — predecessor/successor + FS/SS/FF/SF + lag |
| `knowledge_assets` | ✅ Full | L3130–3166 — 9 categories, 5-stage pipeline, similarity, AI hints |
| `knowledge_review_logs` | ✅ Full | L3168–3179 — 4 decisions (Approve/Merge/Reject/Revision) |
| Enums: `TemplateLibraryScope` | ✅ | PLATFORM / TENANT / KNOWLEDGE |
| Enums: `TemplateLifecycleStatus` | ✅ | DRAFT / PUBLISHED / DEPRECATED |
| Enums: `KnowledgeAssetCategory` | ✅ | 9 categories including WORKPACK_TEMPLATE |
| Enums: `KnowledgeAssetStatus` | ✅ | INCOMING / AI_ANALYSIS / REVIEW_QUEUE / APPROVED / REJECTED |
| Enums: `KnowledgeReviewDecision` | ✅ | APPROVE / MERGE / REJECT / REQUEST_REVISION |
| `Event` extensions | ✅ | parent_event_id, description, calendar_id, discipline_id |
| `EventMilestone` | ✅ | L1925–1943 |

### 1.2 Knowledge Engine (Core)

| Component | Status | Path |
|-----------|--------|------|
| `KnowledgeCaptureService` | ✅ Full | `src/core/knowledge-engine/KnowledgeCaptureService.ts` (94 lines) |
| `KnowledgeAnalysisService` | ✅ Full | `src/core/knowledge-engine/KnowledgeAnalysisService.ts` (151 lines) |
| `KnowledgeReviewService` | ✅ Full | `src/core/knowledge-engine/KnowledgeReviewService.ts` (282 lines) |
| Sanitizer | ✅ Full | `src/core/knowledge-engine/sanitize.ts` — strips 24 tenant-ID keys, emails, UUID fields |
| Similarity engine | ✅ Full | `src/core/knowledge-engine/similarity.ts` — Jaccard + payload hybrid scoring |
| Capture helper | ✅ Full | `src/core/knowledge-engine/capture.ts` — fire-and-forget enqueue |
| Types | ✅ Full | `src/core/knowledge-engine/types.ts` — 9 categories, 10 forbidden, AiRecommendation |
| `FORBIDDEN_KNOWLEDGE_COLLECT` | ✅ | Blocks WORKPACK, EQUIPMENT_TAG, SCHEDULE, COST, CONTRACTOR, etc. |
| Barrel exports | ✅ | `src/core/knowledge-engine/index.ts` |

### 1.3 Knowledge Engine (APIs)

| Endpoint | Method | Guard | Status |
|----------|--------|-------|--------|
| `/api/platform/knowledge` | GET | `guardPlatformApi('knowledge.view')` | ✅ List + stats |
| `/api/platform/knowledge/[id]` | GET | `guardPlatformApi('knowledge.view')` | ✅ Detail |
| `/api/platform/knowledge/[id]/review` | POST | `guardPlatformApi('knowledge.review')` | ✅ 4 decisions |
| `/api/platform/knowledge/analyze` | POST | `guardPlatformApi('knowledge.admin')` | ✅ Re-queue/inline |

### 1.4 Knowledge Engine (UI)

| Page | Status | Path |
|------|--------|------|
| `/platform/knowledge` | ✅ | Pipeline hub, 5-stage card stats, category filter, asset table |
| `/platform/knowledge/review` | ✅ | Review queue actions |
| `/platform/knowledge/[id]` | ✅ | Detail + sanitized payload + decision history |

### 1.5 Knowledge Engine (Promotion)

| Category | Promote to Platform Library | Status |
|----------|-----------------------------|--------|
| ACTIVITY_CODE | `ActivityLibrary` row | ✅ |
| EQUIPMENT_TYPE | `EquipmentType` row | ✅ |
| RESOURCE_TYPE | `ResourceType` row | ✅ |
| UDF_DEFINITION | `ActivityUdfDefinition` row | ✅ |
| WORKPACK_TEMPLATE | Approved Library entry (canonical KA row) | ✅ Correct — no-op on table (needs `created_by`) |
| CERTIFICATE_TEMPLATE | Same pattern | ✅ |
| PRINT_SETTINGS | Same pattern | ✅ |
| QA_QC_TEMPLATE | Same pattern | ✅ |
| SAFETY_TEMPLATE | Same pattern | ✅ |

### 1.6 Template Library Service (M6.1–M6.2 Enterprise Engine)

| Method | Status | Purpose |
|--------|--------|---------|
| `list()` | ✅ | Multi-library browsing (Platform/Tenant/Knowledge), latest-only dedup |
| `get()` | ✅ | Full detail + activities + logic links + family revision history |
| `createDraft()` | ✅ | New family v1 draft with 7 JSON sections + children |
| `updateDraft()` | ✅ | DRAFT-only in-place edit; section JSON + children replace |
| `publish()` | ✅ | DRAFT → PUBLISHED (immutable freeze) |
| `deprecate()` | ✅ | PUBLISHED/DRAFT → DEPRECATED (blocks instantiation) |
| `createRevision()` | ✅ | Published → new family revision draft (deep copy) |
| `cloneToTenant()` | ✅ | Platform/Knowledge → new Tenant family v1 draft |
| `compare()` | ✅ | Section-by-section diff (general, activities, 7 JSON, logic) |
| `instantiate()` | ✅ | PUBLISHED → new Workpack + activities + section snapshot |

### 1.7 Template Library APIs (M6.1–M6.2)

| Endpoint | Method | Guard | Status |
|----------|--------|-------|--------|
| `/api/planning/templates` | GET | `guardApi('settings.templates.view')` | ✅ |
| `/api/planning/templates` | POST | `guardApi('settings.templates.edit')` | ✅ |
| `/api/planning/templates/[id]` | GET/PUT | `guardApi` | ✅ |
| `/api/planning/templates/[id]/publish` | POST | `guardApi` | ✅ |
| `/api/planning/templates/[id]/deprecate` | POST | `guardApi` | ✅ |
| `/api/planning/templates/[id]/version` | POST | `guardApi` | ✅ |
| `/api/planning/templates/[id]/clone` | POST | `guardApi` | ✅ |
| `/api/planning/templates/[id]/instantiate` | POST | `guardApi` | ✅ |
| `/api/planning/templates/compare` | POST | `guardApi` | ✅ |

### 1.8 Template Library UI (M6.1–M6.2)

| Page | Status | Path |
|------|--------|------|
| `/planning/templates` | ✅ | Library browser (scope/status filters) |
| `/planning/templates/new` | ✅ | Create draft wizard |
| `/planning/templates/[id]` | ✅ | 10-section viewer + lifecycle actions |
| `/planning/templates/[id]/instantiate` | ✅ | Create Workpack wizard |

### 1.9 Event Planning (M6.1)

| Feature | Status |
|---------|--------|
| Event model with parent/child (multi-shutdown) | ✅ |
| Calendar, Discipline, WBS relations | ✅ |
| Event milestones CRUD | ✅ |
| `EventPlanningService` | ✅ (`src/core/planning/EventPlanningService.ts`) |

### 1.10 Authorization (M5.3 — Frozen)

| Component | Status |
|-----------|--------|
| `src/lib/permissions.ts` — 706 lines, 38 roles, 79 permissions | ✅ |
| Platform-only: `knowledge.view`, `knowledge.review`, `knowledge.admin` | ✅ |
| Tenant roles NEVER receive `knowledge.*` or `nav.admin` or `nav.billing` | ✅ |
| `guardPlatformApi` / `guardApi` / `guardTenantApi` | ✅ |
| Role catalog frozen (`src/security/roleCatalog.ts`) | ✅ |

### 1.11 Existing Workpack Module (Operational — DO NOT REWRITE)

| Component | Status | Size |
|-----------|--------|------|
| `WorkpackService` | ✅ | 18,224 bytes |
| `WorkflowService` | ✅ | 7,904 bytes |
| `WorkpackMaterialService` | ✅ | 6,645 bytes |
| `WorkpackVersionService` | ✅ | 1,686 bytes |
| `PdfService` | ✅ | 95,166 bytes |
| 31 sub-route directories under `/api/workpacks/[id]/` | ✅ | |
| Workpack list/create API `/api/workpacks/route.ts` | ✅ | |

### 1.12 Migrations

| Migration | Status |
|-----------|--------|
| `20260726180000_knowledge_engine` | ✅ Applied |
| `20260726190000_planning_foundation` | ✅ Applied |
| `20260724120000_enterprise_org_hierarchy` | ✅ Applied |
| 14 earlier migrations (baseline through webhooks) | ✅ Applied |

### 1.13 Background Workers

| Worker | Status |
|--------|--------|
| `knowledge-engine` queue | ✅ (`src/lib/queues.ts`) |
| Knowledge Engine worker | ✅ (`src/workers/knowledgeEngineWorker.ts`) |

### 1.14 Capture Hooks (Verified)

| Asset Category | Hook Location | Status |
|----------------|---------------|--------|
| Activity Codes | `ActivityLibraryService` create/update | ✅ |
| UDF Definitions | `/api/settings/udf-definitions` POST/PUT | ✅ |
| Workpack Templates | Legacy `WorkpackTemplateService` create/update | ✅ |
| Equipment Types | `/api/admin/equipment-types` POST/PATCH | ✅ |
| Resource Types | `/api/settings/master-data/resource-types` POST | ✅ |
| Certificate Templates | settings certificate-templates POST/PATCH | ✅ |
| Print Settings | `/api/settings/print-settings` POST | ✅ |
| QA/QC & Safety | `FormTemplateService` (form_type → category) | ✅ |

### 1.15 Tests

| Test Suite | Status |
|------------|--------|
| `sanitize.test.ts` | ✅ (Knowledge engine sanitizer) |
| `planningFoundation.test.ts` | ✅ (Template CRUD + lifecycle) |
| `roleCatalog.isolation.test.ts` | ✅ (Platform/Tenant isolation) |

---

## 2. Partial ⚠️

### 2.1 Legacy Template System (Superseded but Still Active)

| Component | Issue |
|-----------|-------|
| `src/core/master-data/services/WorkpackTemplateService.ts` | **Legacy** — uses old Prisma accessor `prisma.workpackTemplate` (PascalCase alias). Still serves `/api/admin/templates` GET/POST and the platform-data workpack-templates page. Should be deprecated in favor of `TemplateLibraryService`. |
| `/api/admin/templates` route | **No guardApi** — uses raw `getServerSession` instead of `guardApi('settings.templates.edit')`. Guards are weaker. |
| `/app/platform-data/workpack-templates/page.tsx` | **References legacy API** (`/api/admin/templates`) instead of `/api/planning/templates`. Links to `/admin/templates/[id]` (old route pattern). |
| Legacy `applyTemplate()` merge | **Still available** — merges activities into existing workpack. Valid use case but different from M6 `instantiate()`. Needs documentation to distinguish. |

### 2.2 Knowledge Engine — WORKPACK_TEMPLATE Promotion

| Component | Issue |
|-----------|-------|
| `promoteToPlatformLibrary` → case `WORKPACK_TEMPLATE` | **No-op** — comment says shapes require `created_by` / unique constraints. When knowledge engine approves a workpack template, it does NOT create a `workpack_templates` row in the platform org. M6.4 should implement this promotion path. |

### 2.3 Template Capture on Publish

| Component | Issue |
|-----------|-------|
| `TemplateLibraryService.publish()` | **Missing knowledge capture hook**. The legacy `WorkpackTemplateService.createTemplate/updateTemplate` calls `enqueueKnowledgeCapture`, but the new `TemplateLibraryService` does NOT capture on publish. M6.4 spec says capture occurs on tenant template **publish**. |

### 2.4 Platform-Data Hub Navigation

| Component | Issue |
|-----------|-------|
| `/app/platform-data/page.tsx` | Hub page shows cards linking to sub-pages. Currently exists but links may need updating to include M6 planning templates. |

---

## 3. Missing ❌

### 3.1 M6.3 — Workpack Instantiation Wizard (Tenant UI)

| Component | What's Missing |
|-----------|---------------|
| Tenant-facing template browser | No dedicated **tenant dashboard** page to browse published templates (Platform + Tenant + Knowledge libraries). Current browse is only under `/planning/templates` which uses `guardApi('settings.templates.view')` — correct guard, but needs to be accessible from the workpack creation flow. |
| "New Workpack from Template" flow | The `/planning/templates/[id]/instantiate` page exists, but there's no entry point from the main workpack list (e.g., "Create from Template" button on `/workpacks`). |
| Instantiation wizard — asset/equipment binding | `instantiate()` service accepts `asset_id`, `unit_id`, but the UI wizard may not expose these bindings fully. |

### 3.2 M6.4 — Knowledge Engine Extensions

| Component | What's Missing |
|-----------|---------------|
| Knowledge capture on `TemplateLibraryService.publish()` | No `enqueueKnowledgeCapture` call when tenant publishes a template. |
| Knowledge promotion → `workpack_templates` | Approved knowledge asset with category=WORKPACK_TEMPLATE does not materialize as a Platform Standard `workpack_templates` row. |
| Template usage stats → knowledge `times_used` | When a template is instantiated, `knowledge_assets.times_used` is not incremented for the corresponding KA (if one exists). |
| Platform reviewer "Promote to Standard Library" → create template revision | When platform approves a knowledge asset of category WORKPACK_TEMPLATE, it should optionally create a new `workpack_templates` revision in the PLATFORM library scope. |

### 3.3 AI Metadata Section (M6.2)

| Component | What's Missing |
|-----------|---------------|
| AI metadata authoring UI | The `ai_metadata_json` column exists and is stored, but there is no dedicated editor in the template detail page to populate AI-driven suggestions, quality indicators, or ML-based recommendations. |

---

## 4. Technical Debt 🔧

### 4.1 Dual Template Systems

**Severity:** High  
**Files:** `src/core/master-data/services/WorkpackTemplateService.ts` (legacy) vs `src/core/planning/TemplateLibraryService.ts` (M6)

Two independent template services coexist:
- Legacy: `WorkpackTemplateService` — serves `/api/admin/templates`, uses `prisma.workpackTemplate` (PascalCase alias), includes `applyTemplate()` merge path.
- M6: `TemplateLibraryService` — serves `/api/planning/templates`, uses `prisma.workpack_templates` (snake_case), includes versioning + instantiation.

Both query the same database table but use different Prisma accessor patterns and different API routes. The platform-data UI page (`/platform-data/workpack-templates`) still calls the legacy API.

**Recommendation:** Route `/api/admin/templates` should delegate to `TemplateLibraryService` or be deprecated. Keep `applyTemplate()` as a distinct "merge" path (documented separately from "instantiate").

### 4.2 Guard Inconsistency

**Severity:** Medium  
**File:** `/api/admin/templates/route.ts`

Uses raw `getServerSession(authOptions)` with no role/permission check — any authenticated user can list/create templates via the admin API. Should use `guardApi('settings.templates.edit')` or `guardPlatformApi`.

### 4.3 Prisma Accessor Inconsistency

**Severity:** Low  
Legacy code uses `prisma.workpackTemplate` (PascalCase model name). M6 code uses `prisma.workpack_templates` (the `@@map` name). Both resolve to the same table, but different Prisma client accessors. Should standardize on one.

### 4.4 KE Worker Reliability

**Severity:** Low  
**File:** `src/core/knowledge-engine/KnowledgeCaptureService.ts`

When Redis is down, the inline `import('./KnowledgeAnalysisService')` fallback runs analysis synchronously in the tenant's request path (though wrapped in `void`). This is correctly fire-and-forget, but if analysis is slow, it may consume server resources. Current design is acceptable but should be monitored.

### 4.5 Missing Integration Tests

**Severity:** Medium  
Only two test files exist for the M6 subsystem:
- `sanitize.test.ts` — Knowledge Engine sanitizer unit tests
- `planningFoundation.test.ts` — Template CRUD lifecycle

Missing:
- Instantiation end-to-end test
- Knowledge capture → analysis → review → promote integration test
- Template compare test
- Multi-library visibility test (tenant sees Platform + own, not other tenants')

### 4.6 Unused `knowledge_asset_id` Column

**Severity:** Low  
**Location:** `workpack_templates.knowledge_asset_id` (L2764)

Column exists but is never set. Should be populated when a knowledge asset is promoted to create a Platform Standard template, establishing the bidirectional link.

---

## 5. Dependency Map

```
TemplateLibraryService (M6)
  ├── prisma.workpack_templates (schema)
  ├── prisma.workpack_template_activities (schema)
  ├── prisma.workpack_template_logic_links (schema)
  ├── WorkpackService.createWorkpack() (instantiation target)
  └── prisma.activity (instantiation → create activities)

WorkpackTemplateService (Legacy)
  ├── prisma.workpackTemplate (alias → same table)
  ├── AuditService.log()
  ├── eventBus
  └── enqueueKnowledgeCapture() → KnowledgeCaptureService

KnowledgeCaptureService
  ├── prisma.knowledgeAsset
  ├── sanitizeObject() / contentHash() / hashOrgId()
  ├── knowledgeEngineQueue.add() (Redis)
  └── KnowledgeAnalysisService.analyzeAsset() (inline fallback)

KnowledgeAnalysisService
  ├── payloadSimilarity() + recommendFromScore()
  ├── tryAiEnrichment() → callSyorityAI()
  └── prisma.knowledgeAsset.update() → REVIEW_QUEUE

KnowledgeReviewService
  ├── prisma.knowledgeAsset (decide/list/get/stats)
  ├── prisma.knowledgeReviewLog (audit)
  └── promoteToPlatformLibrary() → ActivityLibrary / EquipmentType / ResourceType / UdfDefinition
```

---

## 6. Summary Matrix

| M6 Sub-milestone | Description | Status |
|------------------|-------------|--------|
| **M6.1** Standard Workpack Library | Schema, service, API, UI for template CRUD + versioning | ✅ **Implemented** |
| **M6.2** Workpack Template Engine | Sections (7 JSON), activities, logic links, compare, lifecycle | ✅ **Implemented** |
| **M6.3** Workpack Instantiation Wizard | Service method exists; UI exists at `/planning/templates/[id]/instantiate` | ⚠️ **Partial** — Missing entry point from workpack list, tenant-facing browse UX |
| **M6.4** Knowledge Engine Extensions | Full collect→analyze→review pipeline works; Approved Library works for 4 of 9 categories | ⚠️ **Partial** — Missing: capture on publish, WORKPACK_TEMPLATE promotion, usage stats, `knowledge_asset_id` link |

---

## 7. M6 Implementation Scope (Remaining Work)

Based on this audit, the **remaining work** to fully complete M6 is:

### Must-Do (Functional Gaps)

1. **Add knowledge capture hook** to `TemplateLibraryService.publish()` for tenant templates.
2. **Implement `WORKPACK_TEMPLATE` promotion** in `KnowledgeReviewService` — when approved, create a PLATFORM-scoped `workpack_templates` revision (or link to existing family).
3. **Set `knowledge_asset_id`** on promoted template rows for bidirectional traceability.
4. **Increment `times_used`** on corresponding knowledge asset when template is instantiated.
5. **Add "Create from Template" entry point** on the main workpack list page.

### Should-Do (Quality / Debt)

6. **Deprecate or redirect** `/api/admin/templates` to use `TemplateLibraryService` (or add proper `guardApi` at minimum).
7. **Update `/platform-data/workpack-templates`** to call `/api/planning/templates` instead of legacy API.
8. **Add integration tests** for instantiation, knowledge pipeline, and multi-library visibility.
9. **Standardize** Prisma accessor to snake_case (`prisma.workpack_templates`).

### Won't-Do (Out of M6 Scope)

- AI metadata authoring UI (P3/P4 per design doc)
- Full safety template model refactor (maps from `FormTemplate.form_type` — acceptable)
- Legacy `applyTemplate()` removal (valid merge use case, different from instantiate)
