# M16-R0.1 — Entity Resolution Audit

**Date:** 2026-09-07  
**Status:** FORENSIC RECONCILIATION — no code modified

---

## 1. Complete Entity Resolution Inventory

### Current Entity Resolution (AI/WhatsApp/Voice)

| Entity | Current Resolver | File | Method | Raw String? | DimensionRegistry? | ControlledValueResolver? | Tenant Scoped? | Event Scoped? | Ambiguity Handling |
|--------|-----------------|------|--------|-------------|-------------------|------------------------|---------------|--------------|-------------------|
| **Event** | ❌ NOT RESOLVED | — | — | N/A | ❌ | ❌ | N/A | N/A | ❌ NONE — event context is never determined |
| **Plant** | ❌ NOT RESOLVED | — | — | N/A | ❌ | ❌ | N/A | N/A | ❌ NOT EXTRACTED |
| **Area** | ❌ NOT RESOLVED | — | — | N/A | ❌ | ❌ | N/A | N/A | ❌ NOT EXTRACTED |
| **Unit** | `DbMatcher.ts` L63-70 | [`DbMatcher.ts`](file:///c:/DEV/STO/src/services/whatsapp/DbMatcher.ts#L63-L70) | `String.includes()` substring match on unit name/code | ✅ YES | ❌ | ❌ | ✅ Indirect (via asset→system→unit) | ❌ | ❌ Only validates extracted unit against asset's unit |
| **System** | ❌ NOT RESOLVED | — | — | N/A | ❌ | ❌ | N/A | N/A | ❌ NOT EXTRACTED |
| **Equipment** (tag) | `DbMatcher.ts` L48-57 | [`DbMatcher.ts`](file:///c:/DEV/STO/src/services/whatsapp/DbMatcher.ts#L48-L57) | `prisma.asset.findFirst({ tag_number: equals, mode: insensitive })` | ✅ YES | ❌ | ❌ | ✅ `organization_id: orgId` | ❌ | ❌ Returns first match only |
| **Equipment Type** | ❌ NOT RESOLVED | — | — | N/A | ❌ | ❌ | N/A | N/A | ❌ NOT EXTRACTED by GPT prompt |
| **Workpack** | `DbMatcher.ts` L86-104 | [`DbMatcher.ts`](file:///c:/DEV/STO/src/services/whatsapp/DbMatcher.ts#L86-L104) | `prisma.workpack.findMany({ asset_id, status in [...] })` | Asset-linked | ❌ | ❌ | ✅ `organization_id: orgId` | ❌ `event_id` NOT filtered | ⚠️ Returns up to 5 workpacks across ALL events |
| **Activity** | `DbMatcher.ts` L122-153 | [`DbMatcher.ts`](file:///c:/DEV/STO/src/services/whatsapp/DbMatcher.ts#L122-L153) | Word overlap scoring: `jdWords.filter(w => ad.includes(w))` | ✅ YES | ❌ | ❌ | ✅ Indirect (via workpack) | ❌ | ⚠️ Ambiguity detected if top 2 scores differ by <0.1 |
| **Standard Activity** | ❌ NOT RESOLVED | — | — | N/A | ❌ | ❌ | N/A | N/A | ❌ NOT LINKED |
| **Discipline** | ❌ NOT RESOLVED | — | — | N/A | ❌ | ❌ | N/A | N/A | ❌ NOT EXTRACTED by GPT prompt |
| **Contractor** | ❌ NOT RESOLVED | — | — | N/A | ❌ | ❌ | N/A | N/A | ❌ NOT EXTRACTED |
| **Priority** | ❌ NOT RESOLVED | — | — | N/A | ❌ | ❌ | N/A | N/A | ❌ NOT EXTRACTED |
| **Criticality** | ❌ NOT RESOLVED | — | — | N/A | ❌ | ❌ | N/A | N/A | ❌ NOT EXTRACTED |
| **Activity Code** | ❌ NOT RESOLVED | — | — | N/A | ❌ | ❌ | N/A | N/A | ❌ NOT EXTRACTED |
| **UDF** | ❌ NOT RESOLVED | — | — | N/A | ❌ | ❌ | N/A | N/A | ❌ NOT EXTRACTED |

### QueryHandler Entity Resolution

| Entity | Resolver | File | Method | Tenant Scoped? | Event Scoped? |
|--------|----------|------|--------|---------------|--------------|
| Workpack (by code/title) | `QueryHandler.ts` L25-33 | [`QueryHandler.ts`](file:///c:/DEV/STO/src/services/whatsapp/QueryHandler.ts#L25-L33) | `prisma.workpack.findFirst({ workpack_number: equals OR title: contains })` | ✅ `organization_id: orgId` | ❌ NO |
| Equipment (by tag) | `QueryHandler.ts` L69-88 | [`QueryHandler.ts`](file:///c:/DEV/STO/src/services/whatsapp/QueryHandler.ts#L69-L88) | `prisma.asset.findFirst({ tag_number: equals })` | ✅ `organization_id: orgId` | ❌ NO |
| Activity (my_jobs) | `QueryHandler.ts` L110-132 | [`QueryHandler.ts`](file:///c:/DEV/STO/src/services/whatsapp/QueryHandler.ts#L110-L132) | `prisma.activity.findMany({ responsible: contains userName })` | ✅ `organization_id: orgId` via workpack | ❌ NO |

---

## 2. "Start HX-204 bundle pullout" Resolution Test

### Intended Resolution Chain

```
"Start HX-204 bundle pullout"
         ↓
HX-204 → Equipment → ??? → Workpack → Activity → ??? → Event
```

### Actual Resolution (Current Code)

| Step | Required | Current | Status | Evidence |
|------|----------|---------|--------|----------|
| 1. Extract "HX-204" as equipment_tag | ✅ | ✅ GPT-4o Mini extracts `equipment_tag: "HX-204"` | ✅ | [`FieldExtractor.ts`](file:///c:/DEV/STO/src/services/whatsapp/FieldExtractor.ts#L37-L41) L38: "equipment_tag (E-101A, P-201... always English)" |
| 2. Extract "bundle pullout" as job_description | ✅ | ✅ GPT-4o Mini extracts `job_description` | ✅ | Same prompt |
| 3. Detect "Start" intent | ❌ | ❌ Intent model only has `update | query | unknown` | **MISSING** | [`FieldExtractor.ts`](file:///c:/DEV/STO/src/services/whatsapp/FieldExtractor.ts#L28) L28: `detected_intent: 'update' | 'query' | 'unknown'` |
| 4. Resolve HX-204 → Equipment | ✅ | ✅ `prisma.asset.findFirst({ tag_number: 'HX-204' })` | ✅ tenant-scoped | [`DbMatcher.ts`](file:///c:/DEV/STO/src/services/whatsapp/DbMatcher.ts#L48-L57) |
| 5. Resolve Equipment → Equipment Type | ❌ | ❌ NOT RESOLVED | **MISSING** | Not in code |
| 6. Resolve Equipment → Workpack(s) | ✅ | ⚠️ `prisma.workpack.findMany({ asset_id })` — **returns workpacks from ALL events** | **UNSAFE** | [`DbMatcher.ts`](file:///c:/DEV/STO/src/services/whatsapp/DbMatcher.ts#L86-L104) — no `event_id` filter |
| 7. Resolve Workpack → Activity | ⚠️ | ⚠️ Word overlap on "bundle pullout" vs activity descriptions | **FRAGILE** | [`DbMatcher.ts`](file:///c:/DEV/STO/src/services/whatsapp/DbMatcher.ts#L125-L131) |
| 8. Resolve Activity → Standard Activity | ❌ | ❌ NOT RESOLVED | **MISSING** | Not in code |
| 9. Resolve context → Event | ❌ | ❌ NOT RESOLVED | **MISSING** | No `event_id` anywhere in WhatsApp code |

### Cross-Tenant/Event Collision Scenarios

| Scenario | Can it happen? | Evidence | Severity |
|----------|---------------|----------|----------|
| **Another tenant's HX-204** | ❌ NO | `organization_id: orgId` in `DbMatcher.ts` L50 | ✅ SAFE |
| **Another event's HX-204** | ✅ YES | No `event_id` filter in `DbMatcher.ts` L86-104 | **P1 — UNSAFE** |
| **Multiple matching equipment** | ❌ NO (within tenant) | `tag_number` is unique per org (functionally) + `findFirst` | ✅ SAFE |
| **Wrong workpack** | ✅ YES | Returns up to 5 workpacks for same asset across events | **P1 — UNSAFE** |
| **Wrong activity** | ✅ YES | Word overlap scoring is fragile — "bundle pullout" could match wrong activity if multiple events have similar descriptions | **P1 — UNSAFE** |
| **Wrong standard activity** | N/A | Standard activity not resolved at all | N/A |

---

## 3. DimensionRegistry as Single Resolver — Feasibility

### Current DimensionRegistry Capabilities

| Capability | Available | Method | Notes |
|------------|-----------|--------|-------|
| List all dimensions for tenant | ✅ | `DimensionRegistry.getDefinitions(orgId)` | Returns system + UDF dimensions |
| Get dimension by code | ✅ | `DimensionRegistry.getDefinition(orgId, code)` | Returns definition with options |
| Resolve controlled value | ✅ | `ControlledValueResolver.resolveDiscipline(orgId, ref)` | Validates against master data |
| Resolve equipment type | ✅ | `ControlledValueResolver.resolveEquipmentType(orgId, ref)` | Validates against master data |
| Resolve UDF option | ✅ | `ControlledValueResolver.resolveUdfOption(orgId, code, ref)` | Validates against tenant options |
| Validate hierarchy | ✅ | `ControlledValueResolver.validateHierarchy(orgId, row)` | Cross-field validation |
| Validate import row | ✅ | `ControlledValueResolver.validateImportRow(orgId, type, row)` | Full row validation |
| Get suggested activities for equipment | ✅ | `ControlledValueResolver.getSuggestedActivitiesForEquipment(typeCode)` | Returns `ActivityDefaults[]` |
| **Resolve equipment tag → asset** | ❌ | NOT a DimensionRegistry concern | Asset lookup is a domain query |
| **Resolve asset → workpack** | ❌ | NOT a DimensionRegistry concern | Workpack lookup is a domain query |
| **Resolve workpack → activity** | ❌ | NOT a DimensionRegistry concern | Activity lookup is a domain query |

### Can DimensionRegistry Become the Single Resolver?

**NO — and it SHOULD NOT.**

DimensionRegistry resolves **dimension values** (discipline, equipment type, UDF options). It does NOT resolve **domain entities** (equipment, workpack, activity).

The M16 entity resolution architecture requires TWO layers:

1. **DimensionRegistry / ControlledValueResolver** — for controlled classification values (discipline, equipment type, priority, UDFs)
2. **M16 Entity Resolver** (new) — for domain entity lookup (equipment → workpack → activity), scoped by tenant AND event

### Schema/API Limitations Preventing Full Resolution

| Limitation | Impact | Resolution |
|------------|--------|------------|
| `DbMatcher` queries workpacks without `event_id` filter | Wrong-event collision | Add `event_id` filter (requires event context) |
| `FieldExtractor` does not extract discipline/equipment_type | Cannot validate controlled values | Extend extraction prompt or post-processing |
| No `event_id` on `whatsapp_sessions` or `whatsapp_updates` | Cannot track event context | Schema change required |
| User model has no `active_event_id` | Cannot determine user's current event | Schema or session change required |
| `FieldExtractor` intent model is `update|query|unknown` | Cannot detect START, HOLD, RESUME etc. | Extend intent taxonomy |

### Classification

**P1 for M16-R1** — Entity resolution must be fixed before M16 can safely resolve entities across multi-event organizations. This is not P0 because the current system is tenant-safe (organization_id is always filtered), but it IS event-unsafe.

---

## 4. Conclusions

### Safe Resolvers
- **Equipment tag lookup** (tenant-scoped, exact match) — SAFE within single-event orgs
- **Unit cross-check** (validates extracted unit against asset's unit) — SAFE but fragile

### Unsafe Resolvers
- **Workpack lookup** — returns workpacks across ALL events for same asset
- **Activity matching** — word overlap scoring with no event filter
- **Query status lookup** — returns first matching workpack across all events

### DimensionRegistry Cannot Be the Single Resolver
DimensionRegistry handles classification dimensions, not domain entity chains. M16 needs a new Entity Resolver that:
1. Uses `event_id` context in all domain lookups
2. Delegates controlled value validation to `ControlledValueResolver`
3. Uses `DimensionRegistry` for dimension metadata

### Schema Limitations
- `whatsapp_sessions` and `whatsapp_updates` lack `event_id`
- `User` model lacks `active_event_id`
- `FieldExtractor` intent taxonomy is too narrow (`update|query|unknown`)

### Final Classification: **P1 for M16-R1**
Must be fixed before M16-R1 can safely support multi-event organizations.
