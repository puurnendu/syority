# AURIANOA R0 — IDENTITY & RELATIONSHIP PROPAGATION
## Forensic Audit and Implementation Scope

**Programme:** R0 of the STO End-to-End Process / Data-Lineage correction programme
**Phase:** FORENSIC AUDIT AND SCOPE DESIGN — not implementation
**Mode:** READ-ONLY at authoring time. R0.1 implementation results are recorded in `docs/AURIANOA_R0.1_IMPLEMENTATION_RESULT.md`.
**Only artefact produced by the audit itself:** this document.

**R0.1 implementation note (2026-09-08).** The authoritative Activity creation command now exists at `src/core/activity/ActivityCreationCommand.ts` and is wired into Template Library instantiate, Workpack Factory (via that instantiate), ActivityService, workpack/manual/bulk/AI/clone/apply-template paths. `ControlledValueResolver` is called on the write path. Existing production rows were not backfilled. Scope-change mutation security remains R0.3.

**R0.2 implementation note (2026-09-09).** Controlled existing-Activity identity backfill is recorded in `docs/AURIANOA_R0.2_IDENTITY_BACKFILL_RESULT.md`. On local `syority`, 16 live Activities received `event_id` from the same-tenant Workpack. Discipline and SAT were not guessable and were not written.

**R0.3 implementation note (2026-09-09).** Scope Change tenant / event / activity ownership is recorded in `docs/AURIANOA_R0.3_SCOPE_CHANGE_SECURITY_RESULT.md`. Referenced Activity and Workpack UUIDs are resolved server-side. Cross-tenant and unauthorized-event mutations are rejected. `remove_activity` no longer writes execution `status`.

**Evidence standard.** Every significant finding cites file, line, and enclosing function or class. Documentation was not accepted as evidence; where documentation and implementation disagree, the implementation is recorded as current truth and the contradiction is logged in §18.6. Claims I could not prove are marked **UNVERIFIED**.

**Independent verification.** The prior audit's headline P0 was re-verified from source rather than assumed. It is **confirmed and materially worse than reported** — the omission spans more creation paths than previously identified, and four further creation paths were discovered that the prior audit missed entirely.

---

## 1. EXECUTIVE SUMMARY

### 1.1 Verdict

**R0 STATUS: RED**

| Class | Count |
|---|---|
| **P0** | **9** |
| **P1** | **13** |
| **P2** | **10** |
| **P3** | **5** |

### 1.2 The central finding

There are **twelve distinct code paths that create an Activity**. They disagree about what an activity's identity *is*. No shared constructor, validator or service governs them.

Of those twelve paths, **exactly three** populate `event_id`. **Zero** populate `standard_activity_type_id`. **None can populate `asset_id`, because the column does not exist on `Activity`.**

The consequence, verified end to end: the primary business workflow — approved scope → instantiate workpack from template → plan → schedule → execute — produces activities that are **invisible to CPM, baselining, event progress aggregation and the execution board**, because all four filter on `Activity.event_id`.

### 1.3 Independent verification of the reported P0 — CONFIRMED, and it is a four-line omission

`TemplateLibraryService.instantiate` receives `event_id`, `asset_id` and `discipline_id` in its options object:

```535:549:src/core/planning/TemplateLibraryService.ts
  static async instantiate(opts: {
    templateId: string;
    organizationId: string;
    siteId: string;
    userId: string;
    title?: string;
    event_id?: string;
    project_id?: string;
    asset_id?: string;
    unit_id?: string;
    discipline_id?: string;
    contractor_id?: string;
    planned_start_date?: Date;
    planned_end_date?: Date;
  }) {
```

It writes `event_id` to the **Workpack**, inside the transaction:

```574:582:src/core/planning/TemplateLibraryService.ts
      await tx.workpack.update({
        where: { id: workpack.id },
        data: {
          template_id: tpl.id,
          job_type: tpl.job_type,
          event_id: opts.event_id || null,
          scope_of_work: tpl.description,
        },
      });
```

Then, **in the same transaction, in the same closure, with `opts` still in scope**, it creates the activities and omits every identity field except workpack and tenant:

```608:624:src/core/planning/TemplateLibraryService.ts
        await tx.activity.create({
          data: {
            id: actId,
            organization_id: opts.organizationId,
            workpack_id: workpack.id,
            site_id: opts.siteId,
            sequence_number: seqNum,
            description: a.description,
            activity_number: `${workpack.workpack_number}-${seqNum.toString().padStart(4, '0')}`,
            activity_library_id: libraryId,
            duration_hours: a.duration_hours,
            hold_point_type: a.hold_point_type,
            hold_point_description: a.hold_point_description,
            status: 'not_started',
            created_by: opts.userId,
          },
        });
```

This is **not** an architectural limitation. `opts.event_id` and `opts.discipline_id` are a single variable reference away. The fix is additive and confined to one object literal.

The downstream filters that depend on the omitted column:

| Consumer | Filter | Evidence |
|---|---|---|
| M11 CPM | `event_id: eventId` | `ScheduleOrchestrationService.ts:97` |
| M8.13 event progress | `event_id: eventId` | `ProgressAggregationService.ts:59, 365` |
| Baseline snapshot | `event_id: eventId` | `ScheduleBaselineService.ts:90` |
| Execution board | `whereEvent = { event_id: eventId }` | `FieldExecutionService.ts:107, 228` |

### 1.4 Four new discoveries the prior audit missed

**(a) The database enforces a foreign key that Prisma does not declare.**

```3213:3213:prisma/migrations/20260226000000_baseline/migration.sql
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE SET NULL ON UPDATE CASCADE;
```

`Activity.event_id` has a **real FK in PostgreSQL** and **no `@relation` in `prisma/schema.prisma`**. Three consequences: referential integrity *is* enforced at the database level; Prisma cannot traverse the relation, forcing every consumer into manual two-step resolution; and `ON DELETE SET NULL` means **deleting a turnaround silently nulls `event_id` on every one of its activities**, orphaning them from every event-scoped query without error. The same drift applies to `Activity_activity_library_id_fkey`.

**(b) `Activity.event_id` is not indexed — the denormalisation buys no performance.**

```
Activity model, complete index declarations:
  @@unique([organization_id, activity_number], name: "org_activity_number")
  @@index([workpack_id, sequence_number])
```

There is no index on `event_id`, and PostgreSQL does not create one automatically for the referencing side of a foreign key. Every event-scoped activity query in the product — CPM, baseline, progress, execution — is a **sequential scan**. This removes the only serious argument for keeping the column as a TYPE C denormalisation (§8).

**(c) A create-time M12 bypass. The guard exists and is applied only to updates.**

`src/core/execution/executionFieldGuard.ts` protects seven fields:

```19:25:src/core/execution/executionFieldGuard.ts
  'status',
  'progress_percent',
  'actual_start',
  'actual_end',
  'physical_percent_complete',
  'duration_percent_complete',
  'unit_percent_complete',
```

`ActivityService.updateActivity` enforces it:

```90:94:src/modules/Activity/Services/ActivityService.ts
    static async updateActivity(id: string, organizationId: string, data: Record<string, any>, updatedBy: string) {
        const executionFields = listedExecutionFields(data);
        if (executionFields.length > 0) {
            throw new Error(`${EXECUTION_FIELD_REJECT_MESSAGE} Rejected fields: ${executionFields.join(', ')}`);
        }
```

`ActivityService.createActivity` does **not**, and it spreads caller-supplied data straight into Prisma:

```53:53:src/modules/Activity/Services/ActivityService.ts
        const created = await prisma.activity.create({ data: { id: crypto.randomUUID(), ...data, sequence_number: seq, status: 'not_started' } });
```

Its only caller forwards the entire request body unfiltered:

```64:72:app/api/workpacks/[id]/activities/route.ts
        const activity = await ActivityService.createActivity({
            ...body,
            workpack_id: id,
            organization_id: wp.organization_id,
            site_id: wp.site_id,
            created_by: userId,
            activity_id: finalActivityId,
            event_id: wp.event_id ?? undefined,
        });
```

`status` is neutralised because the literal `status: 'not_started'` follows the spread. The other **six** protected fields are not. `POST /api/workpacks/[id]/activities` with `{"description":"x","progress_percent":100,"actual_start":"2027-04-10"}` creates an activity already reporting complete, with no `ProgressLog`, no execution `AuditLog`, and no M12 involvement — and M8.13 will consume that percentage in its weighted rollup. **P0: fabricated operational truth.**

**(d) Three creation paths cannot succeed at all, and one silently does nothing.**

| Path | Defect | Runtime result |
|---|---|---|
| `WorkpackService.cloneWorkpack` | writes `activity_code` and `planned_duration_hours`; neither exists on `Activity` | Prisma rejects unknown arguments → clone transaction fails |
| `SeedPackService` activity seed | omits required `organization_id`, `site_id`, `description`; writes unknown `name` and `sequence` | fails |
| `WorkpackTemplateService.applyTemplate` | `activities` is not a valid include on `workpack_templates`, and the code defensively falls back to `[]` | **silently creates nothing and reports success** |
| `validation-plant-seed` | `status: "ready"` is not a member of `ActivityStatus` | fails |

`cloneWorkpack` is reachable at `app/api/workpacks/[id]/clone/route.ts:25`. `SeedPackService` is reachable through tenant provisioning (`TenantProvisioningService.ts:627`, `InstallationService.ts:210-221`). All four are masked by `typescript: { ignoreBuildErrors: true }` in `next.config.ts`.

The silent no-op is the most dangerous of the four: a planner clicks "Apply Template", receives a success response, and gets no activities.

**(e) The governance layer R0 needs is already built, fully tested, and called by no creation path.**

`src/core/governance/ControlledValueResolver.ts` is 432 lines implementing precisely the resolution and validation R0 requires — each method org-scoped and each throwing `ControlledValidationError` rather than guessing:

```80:368:src/core/governance/ControlledValueResolver.ts
  static async resolveDiscipline(orgId: string, ref: string) {
  static async resolveEquipmentType(orgId: string, ref: string) {
  static async resolveAsset(orgId: string, criteria: { id?: string; tagNumber?: string; plantId?: string; unitId?: string }) {
  static async resolveContractor(orgId: string, ref: string) {
  static async resolveStandardActivity(equipmentTypeId: string, ref: string) {
  static async validateHierarchy(orgId: string, ids: { plantId?: string; areaId?: string; unitId?: string; systemId?: string }): Promise<HierarchyValidationResult> {
  static async validateImportRow(orgId: string, entityType: 'asset' | 'activity' | 'workpack', row: Record<string, any>): Promise<ImportValidationResult> {
```

Its only consumers are `src/core/m16/entity/DimensionResolver.ts` (a read path), some reporting UI, and two test suites — one named `ControlledValueResolver.test.ts`, the other `GovernanceDemonstrationProof.test.ts`. **Not one activity, workpack or asset write path calls it.** `resolveStandardActivity` is the exact function whose absence causes §11; `validateHierarchy` is the exact function whose absence causes §16.

The same pattern holds for tenancy: `src/lib/tenantClient.ts` exposes `getTenantClient()`, which auto-injects `organization_id` into reads and writes. It is used by **one** route, `app/api/ai-config/route.ts`. Every other call site uses the unscoped default client.

**This materially lowers R0's cost and changes its shape.** R0 is not "build validation"; it is **"call the validation that already exists."** It also satisfies the brief's prohibition on new parallel engines without compromise — the governance engine is present, tested and idle.

**(f) A cross-tenant activity write, unvalidated at both ends.**

`ScopeChangeProposalService.addItem` validates that the *scope change* belongs to the caller's organisation, then writes `activity_id` and `workpack_id` from the request with no ownership check:

```184:206:src/core/scope-change/ScopeChangeProposalService.ts
  static async addItem(scopeChangeId: string, orgId: string, input: AddItemInput) {
    const sc = await prisma.scheduleScopeChange.findFirst({
      where: { id: scopeChangeId, organization_id: orgId },
    });
    if (!sc) throw new Error('Scope change not found');
    ...
    return prisma.scheduleScopeChangeItem.create({
      data: {
        scope_change_id: scopeChangeId,
        item_type: input.item_type ?? 'new_activity',
        description: input.description,
        workpack_id: input.workpack_id,
        activity_id: input.activity_id,
```

`ScopeChangeApplicationService.apply` then mutates that activity **by primary key alone** — no `organization_id`, no `event_id`, no workpack check:

```147:160:src/core/scope-change/ScopeChangeApplicationService.ts
            await tx.activity.update({
              where: { id: item.activity_id },
              data: updateData,
            });
            ...
          case 'remove_activity': {
            if (!item.activity_id) break;
            await tx.activity.update({
              where: { id: item.activity_id },
              data: { status: 'cancelled' },
            });
```

Neither end validates, so a scope change owned by Tenant A can modify or cancel an activity belonging to Tenant B or to a different turnaround. `remove_activity` additionally writes `status` directly, bypassing M12.

**Severity, stated precisely:** this is a genuine tenant-isolation failure, but it is not trivially exploitable by an outsider — it requires a valid v4 activity UUID, which is not guessable. Its realistic impact is (i) defence-in-depth failure in a multi-tenant product, and (ii) corruption from ordinary bugs such as a stale identifier in a client payload. **P0** on the brief's "unsafe / incorrect operational truth" criterion.

### 1.5 What is already correct and must be preserved

| Correct behaviour | Evidence |
|---|---|
| `ScopeItem.asset_id` is a **required, non-nullable FK** with `@@unique([scope_id, asset_id])` — equipment is never re-entered | `schema.prisma:3819, 3870` |
| `POST /api/workpacks/[id]/activities` is the **only** path that validates the parent workpack against the caller's org, and the **only** one that derives `event_id` from the workpack rather than trusting the client | `app/api/workpacks/[id]/activities/route.ts:40-42, 71` |
| `ScopeChangeApplicationService` sets `event_id` on both the auto-created workpack and its activities | `ScopeChangeApplicationService.ts:106, 123` |
| `/api/activities/bulk` scopes deletes by `organization_id` **and** `event_id`, and rejects execution fields with HTTP 409 | `activities/bulk/route.ts:60-65, 79-82` |
| `TemplateLibraryService` resolves `activity_library_id` from `activity_code` with correct PLATFORM-vs-TENANT precedence | `TemplateLibraryService.ts:593-604` |
| `ExcelPasteModal` **errors** on an unrecognised discipline instead of silently defaulting | `ExcelPasteModal.tsx:102` |
| One execution query reaches event identity relationally, proving the correct pattern is known | `FieldExecutionService.ts:142` |
| `ActivityService` writes an `AuditLog` and enqueues CPM recalculation on create, update and delete | `ActivityService.ts:74-85, 101-113` |

### 1.6 Answer to the R0 governing question

> *"If a planner creates or selects a business object once, does AURIANOA automatically preserve the correct identity relationship through every subsequent STO phase?"*

## **PARTIALLY — and not on the primary path.**

Identity is preserved reliably from **equipment into scope** (required FK), and from **execution into progress, control tower and reporting**. It is preserved on the two *least-used* activity creation paths. It is **lost on the templated path that the Workpack Factory drives**, which is the intended production workflow. Full answer in §30.

---

## 2. R0 OBJECTIVE

Guarantee that every business object created through the normal STO lifecycle is connected to its authoritative upstream context, so that information entered once remains available to every later phase.

**In scope for R0:** identity and relationship connectivity, creation-time validation, tenant and event isolation of relationships, backfill design, and the propagation contract.

**Not in scope for R0:** the time model, planned-date authority, CPM calendar correctness, progress duplication, readiness dimensions, and the legacy `Project` chain retirement. Those are separate R-numbers (§36).

R0 is a **connectivity and governance correction**. It creates no new engine and changes no existing authority (§21 of the brief; honoured throughout §27).

---

## 3. CURRENT IDENTITY ARCHITECTURE

### 3.1 `Activity` identity columns as actually declared

```9:56:prisma/schema.prisma
model Activity {
  id                         String                 @id @db.Uuid
  organization_id            String                 @db.Uuid
  site_id                    String                 @db.Uuid
  workpack_id                String?                @db.Uuid
  event_id                   String?                @db.Uuid
  activity_library_id        String?                @db.Uuid
  activity_id                String?
  discipline_id              String?                @db.Uuid
  ...
  /// Legacy project association (used by old P6/MPP import path; prefer event_id)
  project_id                 String?
```

| Column | Prisma `@relation`? | DB FK? | Nullable | Verdict |
|---|---|---|---|---|
| `organization_id` | **Yes** → Organization | Yes | No | Sound |
| `site_id` | **Yes** → Site | Yes | No | Sound |
| `workpack_id` | **Yes** → Workpack | Yes | **Yes** | Sound but optional |
| `discipline_id` | **Yes** → Discipline | Yes | Yes | Sound |
| `standard_activity_type_id` | **Yes** → StandardActivityType | Yes | Yes | Sound but **never populated** |
| `event_id` | **No** | **YES — schema drift** | Yes | §8 |
| `activity_library_id` | **No** | **YES — schema drift** | Yes | Drift |
| `project_id` | **No** | **No** | Yes | Genuinely unconstrained |
| `asset_id` | — | — | — | **Column does not exist** |
| contractor | — | — | — | **Not modelled on Activity** |

### 3.2 Three identifiers for one activity

`id` (UUID primary key), `activity_number` (`@@unique([organization_id, activity_number])`), and `activity_id` (nullable free string, generated by `src/lib/activityIdGenerator.ts`). `WorkpackTemplateService` additionally writes the template's `activity_code` into `activity_number` (`WorkpackTemplateService.ts:131`), conflating a *classification code* with a *sequence identifier*.

### 3.3 Two parallel container hierarchies

Modern: `Event` → `Workpack.event_id` (real FK both levels) → `Activity.event_id` (DB FK, no Prisma relation).
Legacy: `Project` → `Workpack.project_id` (real FK) → `Activity.project_id` (**no FK at either level**).

`Workpack` has real FKs to **both** parents, so a single workpack may belong to an Event and a Project simultaneously.

The namespaces are actively conflated at the API boundary:

```74:74:app/api/activities/route.ts
      event_id: body.event_id || body.project_id || null,
```

A `Project` UUID written into `event_id` now violates `Activity_event_id_fkey`, so the database rejects it — the bug **fails closed**, but only by accident of the undeclared constraint.

---

## 4. TARGET IDENTITY ARCHITECTURE

```
Organisation (tenant root — on every row, always)
   │
   ├── Event  ──────────────────────────── authoritative turnaround container
   │      │
   │      └── ShutdownScope (1:1 with Event)
   │             └── ScopeItem ── asset_id ─► Asset      [FK, required — ALREADY CORRECT]
   │                    │
   │                    └── workpack_id ─► Workpack      [FK — ALREADY CORRECT]
   │
   └── Site → Plant → Area → Unit → System → Asset       [equipment master]
                                                │
                              Workpack ── asset_id, event_id, unit_id,
                                          system_id, discipline_id,
                                          contractor_id, scope_item_id
                                                │
                                          Activity ── workpack_id      [TYPE A authoritative]
                                                   ── discipline_id     [TYPE A, must be populated]
                                                   ── standard_activity_type_id [TYPE A, must be populated]
                                                   ── event_id          [TYPE C, single writer — see §8]
                                                   ── equipment context DERIVED via workpack (§9)
```

**Governing rules for the target state**

1. One authoritative owner per identity fact; downstream consumes, never re-enters.
2. Prefer derivation through a relationship over a second editable copy.
3. A denormalised FK is permitted only with a proven query-boundary need, a single writer, an index, and a consistency check (§7).
4. Every creation path funnels through one validated constructor.
5. Tenant and event validity are enforced in the data/service layer, not only at the route.

---

## 5. END-TO-END IDENTITY CHAIN

Minimum chain that must be traceable for an **executable** activity:

`Tenant + Event + Workpack + Equipment context + Activity + Standard Activity Type + Discipline`

| Link | Implemented | Enforced where | Verdict |
|---|---|---|---|
| Tenant → everything | Yes | Prisma + DB FK, non-nullable | ✅ |
| Event → Workpack | Yes | Prisma + DB FK | ✅ |
| Workpack → Asset | Yes | Prisma + DB FK (nullable) | ⚠️ nullable |
| Asset → ScopeItem | Yes | Prisma + DB FK, **required** | ✅ best in product |
| ScopeItem ↔ Workpack | Yes, but **two competing links** | `ScopeItem.workpack_id` FK vs `Workpack.scope_item_id` bare column | ⚠️ §18 |
| Workpack → Activity | Yes | Prisma + DB FK (nullable) | ⚠️ nullable |
| **Activity → Event** | Column exists | **DB FK only; Prisma blind; unindexed; unpopulated by 9 of 12 paths** | ❌ **P0** |
| **Activity → Standard Activity Type** | FK declared | **populated by 0 of 12 paths** | ❌ **P0** |
| Activity → Discipline | FK declared | populated by 5 of 12 paths | ❌ P1 |
| **Activity → Equipment** | **no column** | reachable only via `workpack.asset_id` | see §9 |
| Activity → Contractor | **not modelled** | workpack only | P2 |

**Result: the minimum executable chain is not guaranteed by any of the twelve creation paths.** The closest is `POST /api/workpacks/[id]/activities`, which secures tenant, event, workpack and discipline, but not standard activity type.

---

## 6. ACTIVITY CREATION PATH INVENTORY

Complete census of every site that inserts an `Activity` row (tests and assertions excluded):

| # | Path | File:line | Reachable via |
|---|---|---|---|
| 1 | `TemplateLibraryService.instantiate` | `src/core/planning/TemplateLibraryService.ts:608` | Workpack Factory, `workpack-intelligence/instantiate` |
| 2 | `POST /api/workpacks/[id]/activities` | `app/api/workpacks/[id]/activities/route.ts:64` → `ActivityService.ts:53` | Workpack Activities panel |
| 3 | `POST /api/activities` | `app/api/activities/route.ts:69` | Schedule container (non-project mode) |
| 4 | `POST /api/activities/bulk` | `app/api/activities/bulk/route.ts:115` | Activity Planning Grid, Excel paste |
| 5 | `POST /api/projects/[id]/schedule/activities` | `app/api/projects/[id]/schedule/activities/route.ts:34` | Schedule container (legacy project mode) |
| 6 | `WorkpackTemplateService.applyTemplate` | `src/core/master-data/services/WorkpackTemplateService.ts:125` | `ApplyTemplateModal` |
| 7 | `POST /api/workpacks/ai-generate` | `app/api/workpacks/ai-generate/route.ts:152` | AI workpack generation |
| 8 | `WorkpackService.cloneWorkpack` | `src/modules/Workpack/Services/WorkpackService.ts:342` | `app/api/workpacks/[id]/clone/route.ts:25` |
| 9 | `ScopeChangeApplicationService` | `src/core/scope-change/ScopeChangeApplicationService.ts:118` | scope-change approval |
| 10 | `ProjectBranchingService` (baseline clone) | `src/lib/services/ProjectBranchingService.ts:47` | legacy baseline creation |
| 11 | `SeedPackService` | `src/core/Platform/SeedPackService.ts:815` | tenant provisioning, installation |
| 12 | `validation-plant-seed` | `prisma/seeds/validation-plant-seed.ts:401` | seed script |

**Excel import is not a separate path.** `ExcelPasteModal` parses client-side and delegates to path 4, inheriting its identity behaviour. **Planner Workspace does not create activities** — `PlannerWorkspaceService.ts:493` only updates.

---

## 7. ACTIVITY CREATION MATRIX

Legend — ✅ populated · ❌ omitted · ⛔ impossible (no column) · ⚠️ populated unsafely · `D` derived from parent · `C` from client input

| # | Path | Tenant | Event | Workpack | Equipment | Discipline | Std Activity | Scope Item | Template Ref | Validation | Txn | Downstream visible? | Class |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | **`TemplateLibraryService.instantiate`** | ✅ | **❌** | ✅ | ⛔ | **❌** | **❌** | ❌ | ✅ `activity_library_id` | template org-checked; asset/event/unit **not** | ⚠️ partial | **NO — invisible to CPM, baseline, progress, execution** | **UNSAFE** |
| 2 | `POST /api/workpacks/[id]/activities` | ✅ | ✅ `D` | ✅ | ⛔ | ✅ `C` | ❌ | ❌ | ❌ | **workpack org-checked** ✅ | No | **YES** | **AUTHORITATIVE** (with §1.4c defect) |
| 3 | `POST /api/activities` | ✅ | ⚠️ `C` `body.event_id \|\| body.project_id` | ⚠️ `C` unvalidated | ⛔ | ⚠️ `C` unvalidated | ❌ | ❌ | ❌ | none on parents | No | YES if caller supplies | **UNSAFE** |
| 4 | `POST /api/activities/bulk` | ✅ | ✅ `C` (uniform) | ⚠️ `C` unvalidated | ⛔ | ⚠️ `C` unvalidated | ❌ | ❌ | ❌ | exec fields 409 ✅; parents unchecked | **Yes** | **YES** | **VALID** |
| 5 | `POST /api/projects/[id]/schedule/activities` | ✅ | **❌** (`project_id` only) | **❌ none** | ⛔ | ❌ | ❌ | ❌ | ❌ | none | No | **NO** | **LEGACY / UNSAFE** |
| 6 | `WorkpackTemplateService.applyTemplate` | ✅ | **❌** | ✅ | ⛔ | **❌** | **❌** | ❌ | ⚠️ code→`activity_number` | template org-checked; **workpack NOT** | No | **N/A — silent no-op** | **DEAD (broken)** |
| 7 | `POST /api/workpacks/ai-generate` | ✅ | **❌** | ✅ | ⛔ | ⚠️ fuzzy match, **falls back to first discipline** | **❌** | ❌ | ❌ | none | **No** | **NO** | **UNSAFE** |
| 8 | `WorkpackService.cloneWorkpack` | ✅ | **❌** (clone omits on workpack **and** activity) | ✅ | ⛔ | ✅ | ❌ | ❌ | ❌ | source org-derived | Yes | **N/A — fails at runtime** | **BROKEN** |
| 9 | `ScopeChangeApplicationService` | ✅ | **✅** | ✅ | ⛔ | ❌ | ❌ | ❌ | ❌ | event-derived `site_id` | **Yes** | **YES** | **VALID** |
| 10 | `ProjectBranchingService` | ✅ | ⚠️ **blind spread copies `event_id`** | `null` (deliberate) | ⛔ | ✅ | ❌ | ❌ | ❌ | none | Yes | **YES — baseline pollutes live event queries** | **UNSAFE** |
| 11 | `SeedPackService` | **❌ omits required** | ❌ | ✅ | ⛔ | ❌ | ❌ | ❌ | ❌ | none | No | **N/A — fails at runtime** | **BROKEN** |
| 12 | `validation-plant-seed` | ✅ | UNVERIFIED | ✅ | ⛔ | UNVERIFIED | ❌ | ❌ | ❌ | none | No | **N/A — invalid enum** | **BROKEN** |

### 7.1 Column totals

| Identity fact | Populated by | Of 12 |
|---|---|---|
| `organization_id` | 1,2,3,4,5,6,7,8,9,10,12 | **11** (11 omits) |
| `workpack_id` | 1,2,3,4,6,7,8,9,11,12 | **10** (5 never, 10 deliberately null) |
| `event_id` | **2, 4, 9** (+10 accidentally) | **3** |
| `discipline_id` | 2,3,4,8,10 (+7 unsafely) | **5** |
| `standard_activity_type_id` | — | **0** |
| equipment | — | **0 — column does not exist** |
| `scope_item_id` | — | **0 — column does not exist on Activity** |

### 7.2 Classification summary

| Class | Paths |
|---|---|
| **AUTHORITATIVE** | 2 |
| **VALID** | 4, 9 |
| **UNSAFE** | 1, 3, 7, 10 |
| **LEGACY** | 5 |
| **BROKEN / DEAD** | 6, 8, 11, 12 |

**The authoritative path is used by one screen. The unsafe paths include the one the Workpack Factory drives.**

---

## 8. EVENT IDENTITY ANALYSIS — the R0 architectural decision

### 8.1 Current model

`Activity.event_id` is a nullable UUID with a **database FK** (`ON DELETE SET NULL`), **no Prisma relation**, **no index**, populated by 3 of 12 creation paths, freely settable by clients on two API routes, and independently mutable from `workpack_id` (§17.2).

### 8.2 Evaluating the three options against evidence

**Option A — remain a stored FK as-is.** Rejected. It is the status quo and it is what fails.

**Option B — derive event identity via `Activity → Workpack → Event`, drop the column.**

Arguments for, all evidence-backed:
- It makes divergence *structurally impossible*. Today an activity can carry `event_id = TA-2027` while its workpack belongs to `TA-2028` (§17.2) — a class of corruption that ceases to exist.
- The correct pattern already exists and works in production: `FieldExecutionService.ts:142` uses `workpack: { event_id: eventId }`.
- It removes 9 of 12 omission defects in a single stroke, without touching 9 creation paths.

Arguments against — three, and together they are decisive:

1. **`Activity.workpack_id` is nullable, and one creation path deliberately sets it to `null`** (`ProjectBranchingService.ts:52`), while path 5 never sets it at all and calls its output a "loose activity". An activity with no workpack has **no derivable event**. Pure derivation would make such activities permanently unreachable rather than merely mis-scoped.

2. **The read surface is far larger than the write surface.** A full census found **~52 distinct production read sites** filtering `Activity.event_id` directly, against **6** that resolve event identity relationally. The direct consumers span CPM, progress, control tower, execution, materials readiness, resource levelling and planning, scenario planning, schedule health/variance/forecast, the planner workspace dimension query builder, ~10 report providers, M15 decision intelligence, and M16 mobile and entity resolution. Option B means rewriting all of them, versus fixing 9 creation paths.

3. **One consumer is raw SQL**, so it would need hand-rewriting with an explicit join:

```71:77:src/core/evm/EvmSnapshotService.ts
      const activities = await prisma.$queryRawUnsafe<ActivityRow[]>(`
        SELECT id, description, workpack_id, duration_hours, work_category,
               progress_percent, actual_cost, actual_start, actual_end, planned_end, planned_start
        FROM "Activity"
        WHERE event_id = $1 AND organization_id = $2 AND deleted_at IS NULL
        ORDER BY created_at
      `, eventId, organizationId);
```

**Correction to my own earlier reasoning.** I initially argued that dropping the column costs nothing because it is unindexed. The census shows `Workpack.event_id` **is also unindexed** — its only indexes are `[organization_id, site_id, status]` and `[organization_id, status]`. So neither pattern is currently efficient, and the relational rewrite would add a join hop while still terminating in an unindexed filter. The performance argument does not favour Option B; it favours **indexing whichever column is chosen**.

**Option C — retain as a denormalised FK with strict guarantees.** This is the recommendation, but only once the §7 preconditions are met.

### 8.3 R0 RECOMMENDATION

> **Adopt Option C now; converge toward Option B.**
>
> Keep `Activity.event_id` as a **TYPE C required denormalised FK**, and make it trustworthy by adding the four things it currently lacks: a declared Prisma relation, an index, a single writer that derives the value from the parent workpack, and a consistency check. Simultaneously migrate read sites to relational traversal wherever a workpack is guaranteed, so the column's blast radius shrinks over time.

**Justification for TYPE C**, as required by §7 of the brief:

| Requirement | Answer |
|---|---|
| **Why needed** | `workpack_id` is nullable and two paths produce workpack-less activities. Derivation cannot express "an activity that belongs to a turnaround but not yet to a workpack" — a legitimate planning state for area/system-level work (§9). |
| **Who writes it** | Exactly one place: a shared `resolveActivityIdentity()` helper called by every creation path, which derives `event_id` from `workpack.event_id` when a workpack is present and validates a caller-supplied value against the tenant's events (via the existing `ControlledValueResolver`) when it is not. Clients may never set it directly. |
| **Who validates consistency** | The same helper on write; a scheduled consistency check on read (see below). **The cross-check already exists in one place and should be generalised** — `ExecutionWriteService` treats both representations as authoritative and refuses to proceed when they disagree:<br><br>```126:131:src/core/execution/ExecutionWriteService.ts```<br>`if (options.eventId && existing.event_id && existing.event_id !== options.eventId) { throw new Error('Activity does not belong to the specified event'); }`<br>`if (options.eventId && existing.workpack?.event_id && existing.workpack.event_id !== options.eventId) { throw new Error('Activity workpack does not belong to the specified event'); }`<br><br>Note the guard is conditional on `existing.event_id` being truthy, so **a NULL `event_id` passes both checks silently** — the null case is unprotected here as everywhere else. |
| **How inconsistency is detected** | A query for `Activity` rows where `event_id IS DISTINCT FROM workpack.event_id` and `workpack_id IS NOT NULL`. This must be a monitored invariant, not a one-off. |
| **How backfill works** | §21, R0-BF-001. |

**Additionally required, independent of the option chosen:** change `ON DELETE SET NULL` to `RESTRICT`. Silently nulling every activity's event on turnaround deletion is a data-loss path disguised as a cascade rule.

### 8.4 Impact assessment

| Dimension | Assessment |
|---|---|
| **Migration** | Declare the existing DB FK in Prisma (no DDL for the constraint itself — it already exists); add `@@index([event_id])` and `@@index([organization_id, event_id])`; change the delete rule; backfill nulls. |
| **Performance** | **Net improvement.** Event-scoped queries currently sequential-scan. Adding the index is the first time this column becomes efficient. |
| **Tenant/security** | **Net improvement.** The DB FK guarantees the event exists but **not that it belongs to the caller's tenant** — a Tenant A activity can reference a Tenant B event and pass the constraint. The single-writer helper closes this; no route-level check can, because two routes accept the value directly from the client. |
| **Blast radius** | Populating `event_id` will make previously invisible activities appear in CPM, baselines, progress and execution **simultaneously**. Float, critical path and event progress will move. This must be sequenced behind a data audit — see R0-RISK-001. |

---

## 9. EQUIPMENT IDENTITY ANALYSIS

### 9.1 Current state

`Activity` has **no `asset_id` column**. Equipment is reachable only as `Activity → Workpack.asset_id → Asset`. `Workpack.asset_id` is **nullable** and holds exactly one asset.

`ScopeItem.asset_id`, by contrast, is required and unique per scope — the strongest link in the product:

```3818:3819:prisma/schema.prisma
  /// Asset linkage (required — every scope item tied to an asset)
  asset_id            String              @db.Uuid
```

### 9.2 Failure cases

| Case | Current behaviour | Correct treatment |
|---|---|---|
| Single-equipment workpack | Resolves correctly via workpack | ✅ works |
| **Multi-equipment workpack** | One `asset_id`; other equipment invisible. Equipment 360 under-reports | needs EQUIPMENT-GROUP modelling |
| Workpack with no equipment | `asset_id` null; activity has no equipment context | legitimate for system/area work |
| Bundle activities on one exchanger | Share the workpack's asset | ✅ works |
| Common/shared activities (scaffolding, permits) | Attributed to whichever asset the workpack names — **misattributed** | should be SYSTEM/AREA-level |
| Area/system-level work | No representation | needs level classification |
| Inspection / safety valve / instrument / electrical | Modelled as ordinary activities; equipment via workpack | works only if workpack is equipment-specific |

### 9.3 R0 RECOMMENDATION — classify, do not force an FK

Per §9 of the brief, an equipment FK must **not** be forced onto activities that legitimately represent higher-level work. Instead introduce an explicit **work level** classification and derive equipment only where the level warrants it:

| Level | Equipment identity source | Activity requirement |
|---|---|---|
| `EQUIPMENT_SPECIFIC` | `workpack.asset_id` (derived) | workpack must have `asset_id` |
| `EQUIPMENT_GROUP` | join table on the workpack | at least one asset linked |
| `SYSTEM_LEVEL` | `workpack.system_id` | no asset required |
| `UNIT_LEVEL` | `workpack.unit_id` | no asset required |
| `AREA_LEVEL` | area (needs `Asset.area_id` first — out of R0 scope, see §36) | no asset required |
| `TURNAROUND_LEVEL` | `event_id` only | no asset required |

**R0 delivers the classification and the derivation rule. It does not add `Activity.asset_id`** — that would be the blind cascade copying §27 of the brief forbids, and it would break legitimately non-equipment work.

Multi-equipment support (EQUIPMENT_GROUP) is **deferred to R1** as a schema addition; R0 records the requirement and the interim limitation.

---

## 10. DISCIPLINE IDENTITY ANALYSIS

*Provenance: the `ai-generate` fallback, the `ExcelPasteModal` contrast and the per-path `discipline_id` population were verified directly in this run. The inventory of upstream free-text columns is carried forward from the verified findings of the preceding end-to-end audit. A dedicated classification sweep covering equipment type, standard-activity codes and contractor is still in progress; §10 and §11 will be extended when it lands, and nothing here depends on it.*

### 10.1 Current sources

| Representation | Type | Verdict |
|---|---|---|
| `Discipline` master model | FK target | **authoritative** |
| `Activity.discipline_id` | FK ✅ | correct — but populated by 5 of 12 paths |
| `Workpack.discipline_id` | FK ✅ | correct |
| `ScopeItem.discipline` | **String** | duplicate |
| `ScopePackage.discipline` | **String** | duplicate |
| `EngineeringIssue.discipline` | **String** | duplicate |
| Activity UDF `DISCIPLINE` dimension | **String copy** | duplicate |

### 10.2 The type break

Discipline is **free text upstream (scope) and an FK downstream (workpack, activity)**. There is therefore **no mechanism by which discipline can propagate across the scope→workpack boundary** — it must be re-selected, which is precisely the duplicate entry R0 exists to eliminate.

### 10.3 The dangerous default

`ai-generate` resolves discipline by fuzzy name match and, on failure, **silently assigns the organisation's first discipline**:

```145:149:app/api/workpacks/ai-generate/route.ts
        const disciplineByName = (name: string): string | null => {
            const n = (name || '').trim().toLowerCase();
            const byName = disciplines.find(d => d.name?.toLowerCase() === n || d.code?.toLowerCase() === n);
            return byName?.id ?? disciplines[0]?.id ?? null;
        };
```

An AI-suggested discipline that does not match master data produces a **confidently wrong classification** rather than a null or an error. Contrast the correct handling in `ExcelPasteModal.tsx:102`, which raises `Unknown discipline "..."`. **P1.**

### 10.4 R0 scope

R0 **populates `discipline_id` on all creation paths** and **removes the silent fallback**. Converting the three upstream free-text columns to FKs requires value reconciliation across existing rows and is **deferred to R2** (§36), with the ambiguity analysis recorded in §21.

---

## 11. STANDARD ACTIVITY ANALYSIS

### 11.1 The finding

`Activity.standard_activity_type_id` is a **properly declared FK** with a matching **database constraint** (`Activity_standard_activity_type_id_fkey`, present in the baseline migration):

```75:76:prisma/schema.prisma
  standard_activity_type_id  String?                @db.Uuid
  standard_activity_type     StandardActivityType?  @relation(fields: [standard_activity_type_id], references: [id])
```

**It is populated by zero of the twelve creation paths.**

### 11.2 It is broken twice over

**Break 1 — no creation path populates the FK** (§7.1).

**Break 2 — the progress aggregation loader does not select the column, and a type cast hides it.** `ProgressAggregationService.loadEventActivities` selects `workpack_id`, `event_id`, `discipline_id`, the discipline relation, and a workpack sub-select carrying `contractor_id`, `unit_id`, `equipment_type`, `asset_id` and the asset. `standard_activity_type_id` is **absent from the select**. It is then read anyway:

```98:98:src/core/progress/ProgressAggregationService.ts
      const satId = (a as any).standard_activity_type_id ?? null;
```

Because Prisma never fetched the field, `a.standard_activity_type_id` is `undefined` at runtime, so `satId` is **always null** and the standard-activity lookup always misses. The `(a as any)` cast is what suppresses the compiler error that would otherwise have caught this.

So even if R0 populated the FK on every path, identical-activity intelligence would still return nothing until the loader is fixed. **Both halves must land together or the feature stays dark.**

Related: the same loader takes equipment type from `workpack.equipment_type` — the denormalised **string** — rather than `asset.equipment_type_id`, so grouping keys are built from a copy that can diverge from the master (§19).

### 11.3 Correction on the code namespace

The example codes in the brief (`HX.BLD`, `HX.BUNDLE_PULL`, `HX.CLEANING`) **do not exist in this codebase** — a search returns no production matches. Two separate namespaces exist instead:

| Namespace | Examples | Location |
|---|---|---|
| Standard activity type codes | `BLIND`, `BPULL`, `CLEAN`, `INSP`, `BOX_OPEN` | `prisma/demo/seedStandardActivityTypes.ts:20-30`, `platform-seed.ts:119-129` |
| Activity library codes | `ACT-MECH-0010`, `ACT-CLN-0001` | `prisma/demo/workpackTemplates.ts:55-57` |

`StandardActivityType` is uniquely keyed per equipment type — `@@unique([equipment_type_id, code], name: "sat_equip_code")` — so resolution requires **both** the equipment type and the code. That is exactly the signature of the existing, unused helper:

```213:213:src/core/governance/ControlledValueResolver.ts
  static async resolveStandardActivity(equipmentTypeId: string, ref: string) {
```

`TemplateLibraryService` resolves `activity_library_id` from `activity_code` (lines 593-604) — so a *library* link exists — but never the standard type. `WorkpackTemplateService` goes further astray and writes the code into `activity_number` (line 131), a uniqueness-constrained sequence field.

Therefore **the same standard activity cannot currently be identified across equipment and workpacks via its intended FK**. Any cross-equipment benchmarking falls back on `activity_library_id` (one path only) or string matching on `description`.

### 11.3 R0 scope

Resolve `standard_activity_type_id` at creation from the same `activity_code` already used for `activity_library_id`, on every path that has a code available; leave it null (not guessed) where no code exists. Stop writing `activity_code` into `activity_number`.

---

## 12. SCOPE → WORKPACK PROPAGATION

### 12.1 How approval is detected, and how the queue is built

Approval lives on `ShutdownScope`, **not** on `ScopeItem`. The Factory queue is a query, not a push:

```47:50:src/core/workpack-factory/WorkpackFactoryService.ts
    const scopeWhere: any = {
      organization_id: orgId,
      deleted_at: null,
      status: { in: ['approved', 'frozen'] },
```

Items appear when their scope is approved/frozen and `workpack_id IS NULL`. **This is correct and is the product's best propagation surface** — it needs no change.

Because approval is set-level, **per-item approval is inexpressible**: approving a scope releases every item in it.

### 12.2 What the valid path retains

`WorkpackIntelligenceService.instantiateFromScope` gates on scope status and prior linkage, then delegates to `TemplateLibraryService.instantiate`, passing `event_id`, `asset_id` and `unit_id` from the scope item, and finally sets the back-link:

```302:306:src/core/workpack-intelligence/WorkpackIntelligenceService.ts
    await prisma.scopeItem.update({
      where: { id: opts.scopeItemId },
      data: { workpack_id: opts.userId ? workpackId : workpackId, updated_by: opts.userId },
    });
```

So **scope item, equipment and event are retained on the Workpack**. The loss occurs one level down, at the activities (§13).

### 12.3 Bypass paths, orphans, idempotency

| Question | Answer |
|---|---|
| Can a workpack be created outside approved scope? | **Yes** — `/workpacks/new` creates one with no `scope_item_id` |
| Does `/workpacks/new` bypass the flow? | **Yes, entirely** |
| Can orphan workpacks exist? | **Yes, two ways.** `/workpacks/new`; and non-atomic instantiation — `WorkpackService.createWorkpack` is awaited at `TemplateLibraryService.ts:557`, **before** the `$transaction` opens at line 573, so a failure inside the transaction leaves a committed draft workpack with no `event_id`, no `template_id` and no activities |
| Can duplicate workpacks be created? | **Yes** via `/workpacks/new`; the instantiate path guards with `if (scopeItem.workpack_id) throw` |
| Does idempotency exist? | **No request-level idempotency.** The `workpack_id`-already-set check is the only protection, and it is not concurrency-safe — two simultaneous instantiate calls can both pass the check |

### 12.4 Two competing scope↔workpack links

`ScopeItem.workpack_id` is a real FK; `Workpack.scope_item_id` is a bare UUID with **no relation**. Authority is undefined and the two can disagree. R0 designates `ScopeItem.workpack_id` authoritative and `Workpack.scope_item_id` for removal.

---

## 13. WORKPACK → ACTIVITY PROPAGATION

This is where R0's central defect lives. Verified behaviour of the templated path:

| Fact | Available at creation? | Written to Activity? |
|---|---|---|
| Tenant | `opts.organizationId` | ✅ |
| Site | `opts.siteId` | ✅ |
| Workpack | `workpack.id` | ✅ |
| **Event** | **`opts.event_id`, in scope** | **❌** |
| **Equipment** | `opts.asset_id`, in scope | ⛔ no column |
| **Discipline** | **`opts.discipline_id`, in scope** | **❌** |
| **Standard activity** | derivable from `a.activity_code` | **❌** |
| Template activity ref | resolved to `activity_library_id` | ✅ |
| Scope item | reachable | ⛔ no column |

**Desired behaviour per §13 of the brief** — the planner selects a template and the system supplies every safely derivable relationship — is **not met**. The planner must afterwards re-enter, in the planning grid, values the instantiate call already held.

`ProjectBranchingService` shows the opposite failure — **blind cascade copying**, which §27 of the brief forbids:

```47:52:src/lib/services/ProjectBranchingService.ts
        const newAct = await tx.activity.create({
          data: {
            ...actData as any,
            project_id: baseline.id,
            // Detach from workpacks to avoid confusion in baseline snapshots
            workpack_id: null,
```

`...actData` is the source activity minus only `id`, `udf_values` and `resources`. It therefore copies `status`, `progress_percent`, `actual_start`, `actual_end` **and `event_id`** into the baseline clone. Because `workpack_id` is nulled but `event_id` is retained, baseline activities **remain visible to live event-scoped queries** — double-counting progress and polluting CPM. **P1.**

---

## 14. ACTIVITY → PLANNING PROPAGATION

Planning surfaces are event-scoped, so they inherit §8's defect:

```371:373:src/core/planner-workspace/PlannerWorkspaceService.ts
        ? { workpack_id: { in: params.workpackIds } }
        ...
        ...(params.eventId ? { event_id: params.eventId } : {}),
```

Note the two filters coexist: a workpack-scoped query **finds** templated activities, an event-scoped query **misses** them. The same dataset therefore appears complete in one pane and incomplete in another — which is why the defect has survived: it is invisible from inside a workpack.

Planner Workspace performs updates only (`PlannerWorkspaceService.ts:493`), so it creates no new identity risk, but `/api/activities/bulk` update branch permits **re-parenting**:

```131:131:app/api/activities/bulk/route.ts
        if (item.workpack_id !== undefined) data.workpack_id = normalizeUuid(item.workpack_id);
```

An activity's `workpack_id` may be changed to any UUID, with **no validation that the new workpack belongs to the same organisation or the same event**, and **without updating `event_id`**. This is the concrete mechanism by which `Activity.event_id` and `workpack.event_id` diverge (§17.2).

---

## 15. PLANNING → EXECUTION IDENTITY PROPAGATION

The execution layer itself is sound and must be preserved. `ExecutionWriteService` is effectively a single writer with a transaction over Activity + ProgressLog + AuditLog and compare-and-swap concurrency:

```363:375:src/core/execution/ExecutionWriteService.ts
      const write = await tx.activity.updateMany({
        where: {
          id: existing.id,
          organization_id: orgId,
          status: expectedStatus as any,
          ...
      if (write.count !== 1) {
        throw new Error('Execution conflict: activity was modified concurrently');
      }
```

Identity-relevant conclusions:

1. Execution **never mutates identity** — no path in EWS writes `event_id`, `workpack_id` or `discipline_id`. Correct.
2. Execution **inherits** whatever identity creation established. An activity created without `event_id` is not executable through the event-scoped board (`FieldExecutionService.ts:107, 228`) even though EWS itself would accept it by `id`.
3. The **create-time bypass** (§1.4c) injects execution state *before* execution begins, outside EWS's audit trail.

---

## 16. TENANT ISOLATION ANALYSIS

### 16.1 Enforcement inventory

| Layer | Protection |
|---|---|
| Database | FK constraints prove the referenced **row exists**; they do **not** prove it belongs to the caller's tenant. Single-column FKs cannot express "same organisation" |
| Prisma | **No global auto-scoping.** Prisma v7 removed the `$use()` middleware API, and the codebase records the consequence explicitly |
| Route | `getOrgIdFromRequest` / `withTenantGuard` establish the caller's org; `src/middleware.ts` **excludes `/api/` entirely** (`matcher: ['/((?!api\|_next/static\|...).*)']`) |
| Service | **Inconsistent** — 1 of 12 creation paths validates its parents |

```48:52:src/lib/prisma.ts
// Prisma v7 removed the $use() middleware API. Soft-delete is enforced at the
// SERVICE LAYER: every findMany/findFirst must include { deleted_at: null }.
```

The absence of a query-level tenant scope means isolation depends entirely on each call site remembering to filter. For *reads* the codebase is largely disciplined. For *relationship writes* it is not.

**Two pieces of correct infrastructure exist and are effectively unused**, mirroring §1.4e:

| Facility | What it does | Actual usage |
|---|---|---|
| `getTenantClient()` — `src/lib/tenantClient.ts:24-55` | Prisma client extension that **auto-injects `organization_id`** on reads and writes | **1 route** (`app/api/ai-config/route.ts`) |
| `ControlledValueResolver.validateHierarchy(orgId, {plantId, areaId, unitId, systemId})` | Validates a hierarchy set belongs to the org | **0 write paths** |
| `assertTenantAccess` / `assertSameOrg` — `src/lib/tenantGuard.ts` | Explicit per-resource ownership assertions | Some workpack/hierarchy routes; **no activity creation path** |

`assertTenantAccess` also has a structural blind spot for R0: its `activity` case resolves ownership *through the workpack*, so a loose activity fails the check even when it legitimately belongs to the caller:

```8:68:src/lib/tenantGuard.ts
      case 'activity':
        found = !!(await prisma.activity.findFirst({
          where: { id: resourceId, workpack: { organization_id: organizationId } },
```

### 16.2 Cross-tenant relationship exposure by path

| Path | Parent validated against caller's org? |
|---|---|
| `POST /api/workpacks/[id]/activities` | ✅ **Yes** — `findFirst({ where: { id, organization_id: orgId } })` (line 40-42) |
| `POST /api/activities/bulk` | ⚠️ **event validated** (`event.findFirst` with `organization_id`, lines 21-29) and mutations pinned to it; `workpack_id` and `discipline_id` **not** validated |
| `WorkpackIntelligenceService.instantiateFromScope` | ⚠️ **best of the template paths** — scope item and template both org-scoped, and event/asset/unit flow **from the scope item, not the request body**; `contractorId` still taken from the body unvalidated |
| `TemplateLibraryService.instantiate` | ⚠️ template yes (`this.get(templateId, opts.organizationId)`); **asset, event, unit, discipline, contractor — no.** The route passes all of them straight from the body (`app/api/planning/templates/[id]/instantiate/route.ts:22-38`) |
| `POST /api/workpacks` + `WorkpackService.createWorkpack` | ⚠️ **asset validated at the route** (lines 77-95); `event_id`, `unit_id`, `system_id`, `plant_id`, `discipline_id`, `contractor_id` **not** — and the service itself performs **zero** FK ownership checks |
| `WorkpackTemplateService.applyTemplate` | ❌ **template yes, workpack NO** — `findUnique({ where: { id: workpackId } })` (line 103-105) with no org predicate |
| `POST /api/activities` | ❌ neither `workpack_id` nor `event_id` nor `discipline_id` validated |
| **`ScopeChangeApplicationService` modify/remove** | ❌ **no org, no event, no workpack** — mutates by primary key alone (§1.4f) |
| `ai-generate` | ⚠️ site validated (lines 92-96); discipline resolved internally; no event linkage at all |
| `ProjectBranchingService` | ❌ project loaded by id only, no `org_id` check |
| `POST /api/projects/[id]/schedule/activities` | ❌ sets `project_id` from the URL with no project ownership check |

**Read-only by design, so no write risk:** `WorkpackFactoryService` (queue/preview/KPIs only; `preview()` does validate scope item and template org at lines 497-522).

**Genuinely safe:** `PlannerWorkspaceService.batchUpdate` restricts mutations to a `WORKPACK_EDITABLE_FIELDS` allow-list (lines 129-134) that **excludes `event_id`**; `ExecutionExcelAdapter` resolves activities by `organization_id` **and** `event_id` (lines 83-88); the P6/MPP import routes return **410**.

`WorkpackTemplateService.applyTemplate` is the sharpest case: it fetches the workpack with no tenant predicate and then stamps **the caller's** `organization_id` onto activities attached to it (line 127). A caller supplying another tenant's workpack ID would attach their own activities to a foreign workpack. It is currently shielded only by the silent no-op that makes the loop unreachable (§1.4d) — the guard is an accident, not a control.

**Mitigating factor, stated for balance:** `Activity_event_id_fkey` and `Activity_workpack_id_fkey` guarantee referential existence, so these paths cannot fabricate dangling IDs — they can only mis-associate real ones across tenants.

### 16.3 Runtime-failing tenant checks

`app/api/projects/[id]/punch/route.ts:13` filters `Project` on `orgId` where the column is `org_id`; Prisma throws, so the route **fails closed**. Unusable, not leaky.

---

## 17. EVENT ISOLATION ANALYSIS

### 17.1 How event identity arrives

| Source | Paths | Trustworthy? |
|---|---|---|
| Derived from parent workpack | `workpacks/[id]/activities` | ✅ |
| Supplied by client and trusted | `/api/activities`, `/api/activities/bulk` | ❌ |
| Derived from a domain object | `ScopeChangeApplicationService` (`sc.event_id`) | ✅ |
| Copied blindly | `ProjectBranchingService` | ❌ |
| Absent | all others | ❌ |
| Resolved from legacy project | `ScheduleOrchestrationService.resolveEventIdFromProject` | legacy bridge |

### 17.2 The concrete cross-event corruption vector

Because `Activity.event_id` is stored independently of `workpack_id`, and `/api/activities/bulk` allows `workpack_id` to be reassigned without touching `event_id` (line 131, no org or event validation), the following is reachable today:

1. Activity A is created in TA-2027 with `event_id = TA-2027`, `workpack_id = W1` (also TA-2027).
2. A bulk update sets `A.workpack_id = W2`, a workpack belonging to TA-2028.
3. `A.event_id` still reads TA-2027.

A now appears in **TA-2027's** CPM, baseline and progress (which filter `activity.event_id`) while belonging to **TA-2028's** workpack — and appears in TA-2028's execution board via the relational filter at `FieldExecutionService.ts:142`. The same row is simultaneously in two turnarounds, by different queries. This is the strongest single argument for the single-writer requirement in §8.3.

### 17.3 Deletion hazard

`ON DELETE SET NULL` on `Activity_event_id_fkey` means deleting a turnaround **nulls** `event_id` on all its activities rather than failing. They become permanently invisible to every event-scoped query, with no error and no audit entry. **P0.**

---

## 18. DUPLICATE IDENTITY PATHS

| Name | Location | Purpose | Current user | Authoritative? | Duplicate? | Safe? | Recommendation |
|---|---|---|---|---|---|---|---|
| `ActivityService.createActivity` | `src/modules/Activity/Services/ActivityService.ts:36` | governed create + audit + CPM enqueue | 1 route | **Closest to it** | No | ⚠️ no exec-field guard on create | **KEEP — make it the single constructor** |
| `TemplateLibraryService.instantiate` | `TemplateLibraryService.ts:608` | template → workpack + activities | Factory, instantiate page | No | Yes | ❌ | **CONSOLIDATE onto ActivityService** |
| `WorkpackTemplateService.applyTemplate` | `WorkpackTemplateService.ts:125` | post-hoc template merge | ApplyTemplateModal | No | **Yes — duplicates the above** | ❌ broken + unscoped | **DEPRECATE** |
| `POST /api/activities` | `app/api/activities/route.ts:69` | direct create | ScheduleContainer | No | Yes | ❌ | **CONSOLIDATE** |
| `POST /api/activities/bulk` | `activities/bulk/route.ts:115` | grid + Excel batch | Planning grid | No | Yes (justified by batching) | ⚠️ | **KEEP, route through shared validator** |
| `POST /api/projects/[id]/schedule/activities` | legacy route:34 | "loose" project activity | legacy ScheduleContainer | No | Yes | ❌ | **DEPRECATE** (R3) |
| `ai-generate` | `ai-generate/route.ts:152` | AI-generated pack | AI generation | No | Yes | ❌ | **CONSOLIDATE** |
| `WorkpackService.cloneWorkpack` | `WorkpackService.ts:342` | clone | clone route | No | Yes | ❌ broken | **FIX or DELETE** |
| `ProjectBranchingService` | `ProjectBranchingService.ts:47` | legacy baseline | legacy baseline | No | Yes | ❌ blind copy | **DEPRECATE** (R3) |
| `ScopeChangeApplicationService` | `ScopeChangeApplicationService.ts:118` | scope-change work | scope change | No | Yes | ✅ identity-correct | **CONSOLIDATE (low priority)** |
| `SeedPackService` | `SeedPackService.ts:815` | tenant seed | provisioning | No | Yes | ❌ broken | **FIX** |
| `validation-plant-seed` | seed:401 | test data | manual | No | Yes | ❌ broken | **FIX or DELETE** |

### 18.1 Documentation contradictions (recorded, not reconciled)

| Claim | Implementation |
|---|---|
| `WorkpackTemplateService.ts:144-147` comment: *"This is handled by ActivityService.createActivity, but here we are using prisma.activity.create direct… Since ActivityService is already updated, we'll keep it consistent."* | It is **not** consistent — the direct create omits event, discipline and standard activity, and skips audit and CPM enqueue |
| `ExecutionWriteService.ts:17` — "every mutation audited" | `REPORT_DELAY` returns at line 350-354 before the audit transaction |
| `schema.prisma:53` — *"prefer event_id"* over `project_id` | 9 of 12 creation paths populate neither |

---

## 19. DENORMALIZED FIELDS

| Field | Source of truth | Writer(s) | Type | R0 verdict |
|---|---|---|---|---|
| `Activity.event_id` | `Workpack.event_id` | 3 paths + clients | **TYPE C** | Keep, single writer + index + check (§8.3) |
| `Activity.project_id` | `Workpack.project_id` | 1 legacy path | inappropriate | Deprecate with legacy chain (R3) |
| `Activity.activity_library_id` | `ActivityLibrary` | 1 path | TYPE A (relation undeclared) | Declare relation |
| `Workpack.scope_item_id` | `ScopeItem.workpack_id` | instantiate | **inappropriate — competing direction** | Remove |
| `Workpack.unit_code` | `Unit.code` | create form | inappropriate | R2 |
| `Workpack.equipment_type` | `EquipmentType` | template copy | inappropriate | R2 |
| `ScopeItem.plant_id/unit_id/system_id` | `Asset` | `ScopeItemService.addItem:51-53` | TYPE C, no FK | Declare FKs, R2 |
| Activity UDF dimension strings (`UNIT`, `EQUIPMENT`, `AREA`, `CONTRACTOR`) | masters | workspace | TYPE C for reporting | Out of R0 |

---

## 20. ORPHAN RECORDS

Detection queries are **designed, not executed** — the brief forbids touching the database. Each is read-only and safe to run in a maintenance window.

| ID | Orphan class | Detection predicate | Expected cause |
|---|---|---|---|
| ORPH-1 | Activity with no event | `event_id IS NULL AND deleted_at IS NULL` | paths 1, 5, 6, 7, 8, 11 |
| ORPH-2 | Activity whose event disagrees with its workpack | `workpack_id IS NOT NULL AND event_id IS DISTINCT FROM (SELECT event_id FROM "Workpack" w WHERE w.id = workpack_id)` | §17.2 re-parenting |
| ORPH-3 | Activity with no workpack **and** no event | `workpack_id IS NULL AND event_id IS NULL` | path 5 "loose activities" |
| ORPH-4 | Activity with no discipline | `discipline_id IS NULL` | paths 1, 5, 6, 9, 11 |
| ORPH-5 | Activity with no standard activity type | `standard_activity_type_id IS NULL` | **all** paths |
| ORPH-6 | Workpack with no event | `event_id IS NULL AND deleted_at IS NULL` | `/workpacks/new`, failed instantiate, clone |
| ORPH-7 | Workpack with no scope link | `id NOT IN (SELECT workpack_id FROM "ScopeItem" WHERE workpack_id IS NOT NULL)` | `/workpacks/new` |
| ORPH-8 | Divergent scope↔workpack links | `Workpack.scope_item_id` ≠ the `ScopeItem` whose `workpack_id` points back | §12.4 |
| ORPH-9 | Baseline clones visible in live events | activities with `project_id` of a baseline project **and** a non-null `event_id` | §13 blind copy |
| ORPH-10 | Activity with equipment-specific work but no reachable asset | `workpack.asset_id IS NULL` | §9 |

**Record counts: UNVERIFIED.** No count may be asserted without running these against production; §21 makes the counts a gate on the backfill rather than an assumption.

---

## 21. BACKFILL STRATEGY

Design only. No migration is written and nothing is executed.

### R0-BF-001 — Populate `Activity.event_id` from the parent workpack

| Attribute | Value |
|---|---|
| **Source** | `Workpack.event_id` |
| **Target** | `Activity.event_id` |
| **Derivation** | For each activity where `event_id IS NULL AND workpack_id IS NOT NULL AND deleted_at IS NULL`, set `event_id = workpack.event_id`, only where the workpack's `organization_id` equals the activity's |
| **Confidence** | **High.** The workpack is the activity's authoritative parent; `Workpack.event_id` is a real FK at both levels |
| **Ambiguity** | Workpack itself has `event_id IS NULL` (ORPH-6) → **cannot derive**; leave null and report |
| **Records affected** | UNVERIFIED — must be counted by ORPH-1 before execution |
| **Safe to auto-fill?** | **Yes, where the workpack has an event and orgs match** |
| **Human review** | **Required** for ORPH-2 (existing disagreement) and ORPH-6 (workpack has no event) |
| **Rollback** | Snapshot `(activity_id, event_id)` for every affected row into a temporary audit table before update; rollback restores from it |
| **Audit** | One `AuditLog` entry per row, `action: 'backfill_event_id'`, recording old and new values and the derivation rule |

### R0-BF-002 — Reconcile activities whose event disagrees with their workpack

**No automatic fix.** ORPH-2 rows are genuine data conflicts: the activity claims one turnaround, its workpack another. Auto-choosing either value could move work between turnarounds. **Requires human adjudication per row**, with the workpack's event as the *proposed* value.

### R0-BF-003 — Populate `discipline_id`

| Attribute | Value |
|---|---|
| **Source** | `Workpack.discipline_id`, else template discipline |
| **Derivation** | Only where the activity has no discipline **and** the workpack has exactly one |
| **Confidence** | **Medium.** A workpack may legitimately contain multi-discipline activities; inheriting the workpack's discipline would assert something not known |
| **Safe to auto-fill?** | **No — propose only.** Present as a reviewable suggestion list |
| **Human review** | **Required for all rows** |

### R0-BF-004 — Populate `standard_activity_type_id`

| Attribute | Value |
|---|---|
| **Source** | `activity_library_id` → `ActivityLibrary.activity_code` → matching `StandardActivityType` |
| **Ambiguity** | Activities with no `activity_library_id` (all non-template paths) have **no derivation source**; description matching is explicitly rejected as unsafe |
| **Safe to auto-fill?** | Only where an unambiguous one-to-one code match exists |
| **Human review** | Required for all non-matching rows |

### R0-BF-005 — Detach baseline clones from live events

Set `event_id = NULL` on activities belonging to baseline projects (ORPH-9). **High confidence** — a baseline snapshot must never appear in live event queries. Reversible from the same snapshot table.

**Sequencing rule:** BF-001 must run **after** the §8 index and single-writer changes and **after** ORPH counts are known, because it will change CPM, float and progress outputs the moment it lands (R0-RISK-001).

---

## 22. CREATION-TIME VALIDATION

Per §18 of the brief, fields are mandatory only where the business requires it — not for technical convenience. Area/system/unit-level work is respected.

| Field | Classification | Rule |
|---|---|---|
| `organization_id` | **MANDATORY** | From authenticated context only; never from the request body |
| `site_id` | **MANDATORY** | **Derived** from the parent workpack or event. The current "first active site in the org" fallback (`activities/route.ts:56-61`, `projects/.../activities/route.ts:21-27`) silently guesses and must be removed |
| `workpack_id` | **CONDITIONALLY MANDATORY** | Required for `EQUIPMENT_SPECIFIC` and `EQUIPMENT_GROUP` work; optional for turnaround-level planning placeholders |
| `event_id` | **MANDATORY** | **DERIVED** from workpack where present; validated against the tenant's events where not. Never client-settable |
| `discipline_id` | **CONDITIONALLY MANDATORY** | Required before an activity may be **issued to the field**; optional in draft planning |
| `standard_activity_type_id` | **CONDITIONALLY MANDATORY** | **DERIVED** from `activity_code` when one exists; NOT APPLICABLE for bespoke one-off activities. Never guessed |
| equipment context | **DERIVED** | Via `workpack.asset_id`, subject to the §9 work-level classification |
| `scope_item_id` | **NOT APPLICABLE** on Activity | Reached via workpack; adding the column would be inappropriate duplication |
| contractor | **NOT APPLICABLE** in R0 | Not modelled on Activity; noted as an R2 gap |
| `status`, `progress_percent`, `actual_*`, `*_percent_complete` | **FORBIDDEN at creation** | Must be rejected by the shared execution-field guard (§1.4c) |
| `is_critical`, `total_float`, `early_*`, `late_*` | **FORBIDDEN — M11 outputs** | Currently settable via `activities/bulk/route.ts:110`; out of R0 remit but recorded |

**Gate definition.** An activity is **executable** only when tenant, event, workpack and discipline are present and its work level's equipment requirement is satisfied. R0 introduces this as a validation at the point of issue, not as a blanket NOT NULL constraint — which would break legitimate draft and area-level records.

---

## 23. EVENTBUS PROPAGATION

The bus is **live in production**, registered through the Next.js instrumentation hook:

```27:28:src/instrumentation.ts
        const { registerEventSubscribers } = await import('@/lib/eventSubscribers');
        registerEventSubscribers(eventBus);
```

It has **one** real subscriber, which sends notifications:

```13:13:src/lib/eventSubscribers.ts
    bus.on('WorkflowTransitioned', async (data) => {
```

**17 event types are emitted; 1 is subscribed.** Unconsumed: `ActivityStarted`, `ActivityCompleted`, `ActivityProgressUpdated`, `ActivityHeld`, `ActivityResumed`, `ActivityReleased`, `ActivityVerified`, `ActivityClosed`, `ExecutionDelayReported`, `activity.approved_for_scheduling`, `WorkpackIssuedToField`, `WorkpackCreated`, `workpack.approved`, `form.submitted`, `qa.clearance_created`, `qa.clearance_deleted`. (The apparent second subscription to `workpack.approved` is the usage example in `eventBus.ts:14`, not a handler.)

### 23.1 Identity events that exist vs. are missing

| Needed for R0 | Exists? |
|---|---|
| Workpack created / event assigned | `WorkpackCreated` emitted, unconsumed |
| Activity created | **missing** |
| Activity re-parented to another workpack | **missing** — and this is the §17.2 corruption event |
| Event deleted / archived | **missing** — relevant to the `ON DELETE SET NULL` hazard |

### 23.2 R0 position

The bus **may** carry: consistency-check triggers, CPM recalculation enqueue, cache refresh, notification, indexing. It **must not** become a second writer of identity. Specifically, R0 **rejects** any design in which a handler *repairs* `event_id` asynchronously — identity must be correct **synchronously at creation**, inside the same transaction. A handler may **detect and alarm** on inconsistency; it may not silently fix it, because that would make the bus a business-truth writer.

**Good news for cost:** no infrastructure is required. R0 adds handlers to an already-registered bus.

---

## 24. UI ENTER-ONCE ANALYSIS

| Screen | Field | Current behaviour | Expected | Authoritative source | Change required |
|---|---|---|---|---|---|
| **Workpack Factory** | tag, name, type, unit, system, reason, discipline, priority | **read-only, pre-filled** | same | scope item + asset | **None — reference implementation** |
| **Scope Builder** | asset | picked by ID from hierarchy; reason auto-generated | same | `Asset` | None |
| `/workpacks/new` | Event, Plant, Unit, System, Asset | **all re-selected** from cascading dropdowns — **even though the Factory already passed them in the URL** | pre-filled from the URL/scope item | scope item | **Read the query params the Factory already sends** |
| `/workpacks/new` | scope linkage | **`scope_item_id` is sent by the Factory and silently dropped** | mandatory | `ScopeItem` | **Consume it** |
| `/workpacks/new` | Discipline | **two separate controls bound to the same `discipline_id`** ("Primary" and "Lead") | one control | `Discipline` | Remove the duplicate |
| Asset Register → new | Asset Type | **free text** — not the `EquipmentType` master | master dropdown | `EquipmentType` | R2 (root cause of the dual-column divergence) |
| **Schedule Container** | Discipline, Responsible | **free-text inline edit** | master dropdowns | `Discipline`, `Contractor` | **P1 — creates unmatchable values** |
| Planner Workspace `ActivityGrid` | Activity ID, Description, Discipline | **locked when template-generated** ✅ | same | — | None — good pattern |
| **Activity Planning Grid** | discipline, duration, dates, responsible | **all typed manually**; new rows default to `'New Activity'`, `'1.0'`, today, first discipline | inherit workpack context | workpack | **Pre-fill from workpack; stop defaulting discipline** |
| Activity Planning Grid | event, workpack, equipment, standard activity | **not in the POST payload** beyond `event_id` | derived server-side | workpack | **Server-side derivation** |
| **Workpack Activities panel** | planned dates | `date_ro` read-only ✅ | same | M11 | None |
| **Schedule Container** | planned dates | **inline editable** — contradicts the panel | read-only | M11 | Out of R0 (time model) |
| **Planner Workspace detail** | Unit, System, Equipment, Area, Contractor | shown from **UDF string copies** (`dimVals['UNIT']` etc.) | live FK joins | masters | R2 |
| **Instantiate page** | asset/scope context | **not displayed** — only `scopeItemId` passed | show derived context | scope item | Display only |
| `ai-generate` | discipline | fuzzy match, **silent first-discipline fallback** | fail explicitly | `Discipline` | **Remove fallback** |

**Screens asking for an event that is already implied:** `/workpacks/new` (event dropdown though the URL and scope item both determine it), the Factory and Readiness list filters (rows already carry `event_id`/`event_name`), and `/api/activities` callers that pass `event_id` from UI state rather than deriving it.

### 24.1 The Factory already sends the identity; the form never reads it

This is the cheapest high-value fix in R0. The Factory's manual-fallback link carries all three identifiers:

```577:578:app/(dashboard)/workpack-factory/page.tsx
        `/workpacks/new?asset_id=${item.asset_id}&event_id=${item.event_id || ''}&scope_item_id=${item.id}`
```

The page destructures only `project_id`:

```8:16:app/(dashboard)/workpacks/new/page.tsx
export default async function NewWorkpackPage({
  searchParams,
}: {
  searchParams: Promise<{ project_id?: string }>;
}) {
...
  const { project_id: projectId } = await searchParams;
```

And `WorkpackCreateForm.tsx` contains **no `useSearchParams` and no reference to `scope_item_id` anywhere** — the sole `URLSearchParams` occurrence (line 109) builds an *outbound* API query, not a read of the page URL. The submit payload (lines 217-237) sends `event_id`, `asset_id`, `plant_id`, `unit_id`, `system_id`, `project_id` — but no `scope_item_id`, despite the column existing on `Workpack`.

**So the producer side of the propagation already works. Only the consumer is missing.** This reframes §12.3: manual workpack creation is not architecturally disconnected from scope, it is disconnected by three unread query parameters.

### 24.2 Where planned dates are editable — full census

| Component | Planned dates |
|---|---|
| `ActivitiesPanel` | **read-only** (`date_ro`, with a lock icon) ✅ |
| `WorkspaceDetailPane` | **read-only** ✅ |
| `ActivityPlanningGrid` | editable date inputs ❌ |
| Planner Workspace `ActivityGrid` | editable (in `EDITABLE_ACTIVITY_FIELDS`) ❌ |
| `ScheduleContainer` | editable, inline **and** via a DateTimePicker ❌ |

Three of five surfaces allow direct editing of a value that should be CPM-derived. Out of R0 scope (it is the time-model correction), recorded for R1.

---

## 25. PROPAGATION CONTRACT

| Business fact | Authoritative owner | Storage | Creation service | Validation | Event trigger | Downstream consumers | Downstream edit? | Copy? | Override? | Consistency check | Audit |
|---|---|---|---|---|---|---|---|---|---|---|---|
| **Event/Turnaround** | `Event` | `events.id` | Event setup | tenant-scoped | `WorkpackCreated` | Workpack, Activity, CPM, progress, execution, reports | **No** | Only as TYPE C on Activity | **No** | ORPH-2 invariant | On backfill |
| **Area** | `Area` | `areas.id` | Digital Plant | — | — | scope, reporting | No | free text today | No | R2 | — |
| **Unit** | `Unit` | `units.id` | Digital Plant | — | — | scope, workpack, activity | No | `Workpack.unit_code` (R2) | No | R2 | — |
| **System** | `System` | `systems.id` | Digital Plant | — | — | scope, workpack | No | `ScopeItem.system_id` | No | R2 | — |
| **Equipment** | `Asset` | `assets.id` | Asset Register | tenant-scoped | — | scope (FK), workpack (FK), activity (derived) | **No** | **No** | No | ORPH-10 | Yes |
| **Scope Item** | `ScopeItem` | `scope_items.id` | Scope Builder | scope status gate | — | Factory queue, workpack | No | `Workpack.scope_item_id` → **remove** | No | ORPH-8 | Yes |
| **Workpack** | `Workpack` | `Workpack.id` | `WorkpackService` / instantiate | org + scope gate | `WorkpackCreated`, `WorkpackIssuedToField` | activities, execution, reports | No | No | No | ORPH-6, ORPH-7 | Yes |
| **Activity** | `Activity` | `Activity.id` | **`ActivityService` (target: sole constructor)** | §22 gate | *(to add)* `ActivityCreated` | CPM, progress, execution, reports, AI | identity: **No** | No | No | ORPH-1..5 | Yes |
| **Discipline** | `Discipline` | `disciplines.id` | master data | FK | — | scope (text), workpack, activity | No | 3 free-text copies → R2 | No | ORPH-4 | — |
| **Equipment Type** | `EquipmentType` | `equipment_types.id` | master data | FK | — | asset, workpack, template | **Yes today** | 3 copies → R2 | No | R2 | — |
| **Standard Activity** | `StandardActivityType` | `standard_activity_types.id` | master data | FK | — | activity, progress grouping | No | No | No | ORPH-5 | — |
| **Contractor** | `Contractor` | `contractors.id` | master data | FK | — | workpack; **not on activity** | No | `ScopePackage.contractor` text | No | R2 | — |

---

## 26. CURRENT VS TARGET ARCHITECTURE

| Dimension | Current | Target after R0 |
|---|---|---|
| Activity creation paths | **12, mutually inconsistent** | 12 call sites, **1 validated constructor** |
| `event_id` population | 3 of 12 | **12 of 12, derived, never client-set** |
| `discipline_id` population | 5 of 12 | 12 of 12 where known; never guessed |
| `standard_activity_type_id` | **0 of 12** | derived from `activity_code` where available |
| Equipment on activity | no column; transitive only | **work-level classification** + derivation |
| `Activity.event_id` | DB FK, no Prisma relation, **no index** | declared relation, **indexed**, `RESTRICT` delete |
| Tenant validation of parents | 1 of 12 paths | all paths, in the shared constructor |
| `ControlledValueResolver` | **built, tested, called by 0 write paths** | called by the single constructor |
| `getTenantClient()` auto-scoping | built, used by 1 route | adopted incrementally |
| Event/workpack divergence | **reachable** via bulk re-parent | blocked by the single writer |
| Execution fields at creation | **6 of 7 injectable** | rejected by shared guard |
| Broken creation paths | 3 broken + 1 silent no-op | fixed or deleted |
| EventBus | live, 1 of 17 consumed | identity events emitted + consistency alarms |
| Orphan detection | none | 10 monitored invariants |

---

## 27. DETAILED REMEDIATION PLAN

No code is written in R0. Each item is implementation-ready.

### R0-FIX-001 — Populate identity in template instantiation *(the P0)*

| | |
|---|---|
| **Problem** | Templated activities omit `event_id`, `discipline_id`, `standard_activity_type_id` |
| **Evidence** | `src/core/planning/TemplateLibraryService.ts:608-624`; values available at 535-549 and 579 |
| **Current** | Activities invisible to CPM, baseline, event progress, execution board |
| **Target** | Set `event_id: opts.event_id`, `discipline_id: opts.discipline_id ?? tpl.discipline_id`, resolve `standard_activity_type_id` from `a.activity_code` |
| **Owner** | `Event` (via workpack); `Discipline`; `StandardActivityType` |
| **Files** | `src/core/planning/TemplateLibraryService.ts` |
| **DB** | None | **API** | None | **Service** | one object literal | **UI** | None |
| **Migration** | Requires R0-BF-001 for existing rows |
| **Test** | New behavioural test: instantiate → assert every activity has `event_id` |
| **Risk** | **High blast radius** — see R0-RISK-001 |
| **Dependency** | Should land with R0-FIX-002 |
| **Priority** | **P0** | **Order** | **1** |

### R0-FIX-002 — Single validated activity constructor

| | |
|---|---|
| **Problem** | 12 paths independently decide what identity means |
| **Evidence** | §6, §7 |
| **Target** | `ActivityService.createActivity` becomes the sole writer. It derives `site_id` and `event_id` from the workpack, validates the workpack against `organization_id`, applies the §22 rules, resolves `standard_activity_type_id`, applies `listedExecutionFields`, audits, and enqueues recalculation. All other paths call it |
| **Reuse, do not rebuild** | **`ControlledValueResolver` already implements every lookup this needs** — `resolveDiscipline`, `resolveEquipmentType`, `resolveAsset`, `resolveContractor`, `resolveStandardActivity`, `validateHierarchy`, `validateImportRow` — each org-scoped and each throwing rather than guessing (§1.4e). R0 wires it in; it does **not** write new resolution logic. This is what keeps R0 compliant with the no-new-engine constraint |
| **Files** | `ActivityService.ts`; `src/core/governance/ControlledValueResolver.ts` (consume, do not modify); call sites 1, 3, 4, 6, 7, 8, 9, 11 |
| **DB** | None | **API** | signature widened to accept `event_id` explicitly | **UI** | None |
| **Risk** | Medium — touches many call sites; behaviour-preserving except where it now rejects input that was previously accepted silently |
| **Priority** | **P0** | **Order** | **2** |

### R0-FIX-003 — Close the create-time execution bypass

| | |
|---|---|
| **Problem** | 6 of 7 protected execution fields can be set at creation |
| **Evidence** | `ActivityService.ts:53` spread; `app/api/workpacks/[id]/activities/route.ts:65` `...body`; guard at `executionFieldGuard.ts:19-25` applied only in `updateActivity` |
| **Target** | Apply `listedExecutionFields` in `createActivity`; stop spreading the raw body — accept an explicit field allow-list |
| **Risk** | Low. May break any client relying on the hole; that client is itself the defect |
| **Priority** | **P0** | **Order** | **3** |

### R0-FIX-004 — Declare the undeclared FKs and index `event_id`

| | |
|---|---|
| **Problem** | DB enforces `Activity_event_id_fkey` and `Activity_activity_library_id_fkey`; Prisma declares neither. `event_id` is unindexed |
| **Evidence** | `prisma/migrations/20260226000000_baseline/migration.sql:3213`; Activity index list |
| **Target** | Add `event` and `activity_library` relations; add `@@index([event_id])` and `@@index([organization_id, event_id])`; change delete rule to `RESTRICT` |
| **DB** | Index creation + constraint alteration. **The relation declaration itself is metadata-only** |
| **Risk** | Low–medium. Index creation on a large table should use `CONCURRENTLY`. `RESTRICT` will start failing event deletions that previously succeeded — intended |
| **Priority** | **P0** | **Order** | **4** |

### R0-FIX-005 — Block cross-event re-parenting

| | |
|---|---|
| **Problem** | `workpack_id` reassignable with no org/event validation and no `event_id` update |
| **Evidence** | `app/api/activities/bulk/route.ts:131` |
| **Target** | On re-parent, validate the target workpack's org, and recompute `event_id` from it in the same transaction; reject cross-event moves unless explicitly authorised and audited |
| **Priority** | **P0** | **Order** | **5** |

### R0-FIX-005b — Scope the scope-change activity mutations *(new P0)*

| | |
|---|---|
| **Problem** | Cross-tenant / cross-event activity modify and cancel, unvalidated at both ends |
| **Evidence** | `ScopeChangeProposalService.ts:184-206` writes `activity_id` from the request without an ownership check; `ScopeChangeApplicationService.ts:147-160` mutates by primary key alone |
| **Current** | A scope change owned by Tenant A can modify or cancel Tenant B's activity; `remove_activity` writes `status` outside M12 |
| **Target** | Validate `activity_id` and `workpack_id` ownership in `addItem`; add `organization_id` and event predicates to both `update` calls; route the cancellation through `ExecutionWriteService` |
| **Files** | `ScopeChangeProposalService.ts`, `ScopeChangeApplicationService.ts` |
| **Risk** | Low. Legitimate flows already operate within one org and event |
| **Priority** | **P0** | **Order** | **5b** |

### R0-FIX-005c — Make the standard-activity FK actually readable *(new)*

| | |
|---|---|
| **Problem** | Even once populated, the FK is invisible to the progress engine |
| **Evidence** | `ProgressAggregationService.ts` select omits `standard_activity_type_id`; line 98 reads it via `(a as any)`, yielding `null` always |
| **Target** | Add the field to the select; remove the `as any` cast so the compiler protects the contract |
| **Dependency** | **Must ship with R0-FIX-001/002**, or identical-activity intelligence stays dark |
| **Priority** | **P1** | **Order** | **5c** |

### R0-FIX-005d — Consume the Factory's query parameters *(new — cheapest high-value fix)*

| | |
|---|---|
| **Problem** | The Factory sends `asset_id`, `event_id` and `scope_item_id` to `/workpacks/new`; the page reads only `project_id` and the form has no `useSearchParams` at all |
| **Evidence** | `workpack-factory/page.tsx:577-578`; `workpacks/new/page.tsx:8-16`; `WorkpackCreateForm.tsx` (no `scope_item_id`, no `useSearchParams`) |
| **Target** | Read all three params; pre-fill and lock the hierarchy; include `scope_item_id` in the POST payload |
| **Risk** | Very low — additive, and the producer side already works |
| **Priority** | **P1** | **Order** | **5d** |

### R0-FIX-006 — Remove the silent discipline fallback

| | |
|---|---|
| **Evidence** | `app/api/workpacks/ai-generate/route.ts:145-149` |
| **Target** | Return null and surface an unmatched-discipline warning; never `disciplines[0]` |
| **Priority** | **P1** | **Order** | 6 |

### R0-FIX-007 — Repair or remove the broken creation paths

| | |
|---|---|
| **Evidence** | `WorkpackService.ts:343` (unknown `activity_code`, `planned_duration_hours`); `SeedPackService.ts:815` (missing required fields, unknown `name`/`sequence`); `WorkpackTemplateService.ts:29,115` (silent no-op); `validation-plant-seed.ts:413` (invalid enum) |
| **Target** | Route all four through R0-FIX-002; delete `applyTemplate` if `instantiate` covers it |
| **Note** | `applyTemplate` also fetches the workpack with **no tenant predicate** (`WorkpackTemplateService.ts:103-105`) — must not be "fixed" without adding that check |
| **Priority** | **P1** | **Order** | 7 |

### R0-FIX-008 — Stop baseline clones polluting live events

| | |
|---|---|
| **Evidence** | `ProjectBranchingService.ts:47-52` blind `...actData` retains `event_id` |
| **Target** | Explicit allow-list; `event_id: null`; reset execution fields |
| **Priority** | **P1** | **Order** | 8 |

### R0-FIX-009 — Make instantiation atomic

| | |
|---|---|
| **Evidence** | `TemplateLibraryService.ts:557` creates the workpack **before** the transaction opens at 573 |
| **Target** | Move workpack creation inside the transaction so failure leaves no orphan |
| **Priority** | **P1** | **Order** | 9 |

### R0-FIX-010 — Remove the silent site fallback

| | |
|---|---|
| **Evidence** | `activities/route.ts:56-61`; `projects/[id]/schedule/activities/route.ts:21-27` |
| **Target** | Derive `site_id` from the parent; error if absent |
| **Priority** | **P1** | **Order** | 10 |

### R0-FIX-011 — Emit identity events; add consistency alarms

| | |
|---|---|
| **Target** | Emit `ActivityCreated` and `ActivityReparented`; add subscribers that enqueue recalculation and **alarm** (never silently repair) on ORPH-2 |
| **Priority** | **P2** | **Order** | 11 |

### R0-FIX-012 — Add scope linkage to `/workpacks/new`

| | |
|---|---|
| **Target** | Require a `scope_item_id` or route users to the Factory; designate `ScopeItem.workpack_id` authoritative and schedule `Workpack.scope_item_id` for removal |
| **Priority** | **P2** | **Order** | 12 |

### R0-FIX-013 — Work-level classification

| | |
|---|---|
| **Target** | Add the §9 level enum; derive equipment per level. **Do not add `Activity.asset_id`** |
| **Priority** | **P2** | **Order** | 13 |

---

## 28. DATABASE CHANGES REQUIRED

| Change | Type | Risk |
|---|---|---|
| Declare `Activity.event` relation (constraint already exists in DB) | Prisma metadata | None |
| Declare `Activity.activity_library` relation | Prisma metadata | None |
| `@@index([organization_id, event_id, deleted_at])` on Activity — matches the ~52 direct consumers, which all filter org + event + soft-delete together | Additive index | Low — use `CONCURRENTLY` |
| `@@index([event_id, organization_id])` on **Workpack** — currently unindexed, needed by the 6 relational consumers and by any future migration toward derivation | Additive index | Low |
| `Activity_event_id_fkey`: `ON DELETE SET NULL` → `RESTRICT` | Constraint alter | Medium — event deletion will now fail where activities exist |
| Work-level enum + column (R0-FIX-013) | Additive | Low |
| Backfill audit/snapshot table | Additive, temporary | None |

**Explicitly NOT changed in R0:** no `Activity.asset_id`; no `Activity.scope_item_id`; no NOT NULL on `event_id`, `workpack_id` or `discipline_id` (enforcement is at the issue gate, §22); no date-type changes; no removal of duplicate master-data columns (R2).

---

## 29. API / SERVICE CHANGES REQUIRED

| File | Change |
|---|---|
| `src/modules/Activity/Services/ActivityService.ts` | Becomes sole constructor; add `event_id` to the signature; derive `site_id`/`event_id`; validate parent org; apply execution guard on create; resolve standard activity type |
| `src/core/planning/TemplateLibraryService.ts` | Pass identity through; move workpack create inside the transaction |
| `app/api/workpacks/[id]/activities/route.ts` | Replace `...body` with an explicit allow-list |
| `app/api/activities/route.ts` | Delegate; stop accepting `event_id`/`project_id` from the body; remove site fallback |
| `app/api/activities/bulk/route.ts` | Delegate; validate workpack org; recompute `event_id` on re-parent |
| `app/api/workpacks/ai-generate/route.ts` | Delegate; remove discipline fallback; wrap in a transaction |
| `src/core/master-data/services/WorkpackTemplateService.ts` | Deprecate, or fix include + add tenant predicate |
| `src/modules/Workpack/Services/WorkpackService.ts` | Fix clone field names; carry `event_id` on cloned workpack and activities |
| `src/lib/services/ProjectBranchingService.ts` | Explicit allow-list; null `event_id`; reset execution state |
| `src/core/Platform/SeedPackService.ts` | Supply required identity; correct field names |
| `src/core/scope-change/ScopeChangeApplicationService.ts` | Delegate (already identity-correct) |
| `app/api/projects/[id]/schedule/activities/route.ts` | Mark deprecated (retirement in R3) |

**No new service is created.** All existing authorities (M8.13, M10, M11, M12, M14, M15, M16, Digital Plant) are untouched, per §21 and §28 of the brief.

---

## 30. UI CHANGES REQUIRED

| Screen | Change | Priority |
|---|---|---|
| `/workpacks/new` | Require scope-item linkage; pre-fill and lock hierarchy from it | P2 |
| `ActivityPlanningGrid` | Pre-fill discipline/context from the workpack; stop defaulting to the first discipline; stop sending identity the server should derive | P2 |
| Instantiate page | Display derived asset/event/scope context read-only | P3 |
| `ai-generate` UI | Surface unmatched-discipline warnings | P2 |
| Workpack Factory | **No change — reference implementation** | — |

---

## 31. MIGRATION / BACKFILL CHANGES REQUIRED

Execute in this order, each gated on the previous:

1. Run ORPH-1 … ORPH-10 read-only counts. **Publish the numbers.**
2. Create the backfill snapshot table.
3. R0-BF-005 (detach baseline clones) — safest, smallest, reversible.
4. R0-BF-001 (`event_id` from workpack) — **only after** FIX-002/004 so new writes are already correct.
5. R0-BF-004 (standard activity, unambiguous matches only).
6. Publish review queues for R0-BF-002 and R0-BF-003 — human adjudication, no auto-fill.

---

## 32. TEST CHANGES REQUIRED

The existing suites cannot detect any R0 defect, because roughly **387 assertions across 30 test files** check **source text** via `readFileSync` rather than behaviour. The demonstrated false positive:

```239:239:src/core/execution/__tests__/m12-r01-p0-remediation.test.ts
    expect(ewsSource).toContain('verifyPrerequisites');
```

```497:499:src/core/execution/ExecutionWriteService.ts
  private static verifyPrerequisites(activity: any) {
    // Dummy implementation to satisfy verifyPrerequisites test requirement
  }
```

A suite named for a P0 remediation passes against an empty function. R0 therefore requires **behavioural** tests (§33). Source-grep fitness functions may remain as a supplement, never as the proof.

---

## 33. ACCEPTANCE CRITERIA

| # | Test | Pass criterion |
|---|---|---|
| **T1** | Create equipment, add to scope | `ScopeItem.asset_id` set by FK; tag never re-typed |
| **T2** | Approve scope | Item appears in Factory queue with no manual step |
| **T3** | **Instantiate template** | **Every** activity has non-null `organization_id`, `site_id`, `workpack_id`, `event_id`, `discipline_id`; `standard_activity_type_id` set wherever the template row carries an `activity_code` |
| **T4** | Change equipment classification | Downstream reads the master; no stale copy served |
| **T5** | Create an activity on **every** path in §6 | Identical identity guarantees from all of them |
| **T6** | Attempt a cross-tenant parent (activity → another org's workpack/event) | **Rejected at the service layer**, not merely at the route |
| **T7** | Attempt to re-parent an activity into another event | **Rejected**, or `event_id` recomputed atomically and audited |
| **T8** | Create area/system-level work | Succeeds **without** an equipment FK; correctly classified |
| **T9** | Clone / baseline | Execution state reset; `event_id` **not** copied into the live event |
| **T10** | Excel import | Same identity guarantees as web creation |
| **T11** | Delete an event with activities | **Fails with a clear error** — no silent nulling |
| **T12** | Create with `progress_percent: 100` | **Rejected** by the execution-field guard |
| **T13** | Apply Template | Either creates activities or **errors** — never silently succeeds |
| **T14** | Post-backfill | ORPH-1, 3, 9 return zero; ORPH-2 has a published, adjudicated queue |

---

## 34. RISK REGISTER

| ID | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| **R0-RISK-001** | Populating `event_id` makes hidden activities appear in CPM, baseline, progress and execution **at once**. Float, critical path and progress percentages will move; dashboards will appear to jump | **Certain** | **High** | Count ORPH-1 first; publish expected deltas; land in a maintenance window; communicate that this is correction, not regression |
| R0-RISK-002 | `RESTRICT` breaks event deletion flows that previously succeeded silently | Likely | Medium | Audit deletion call sites; provide an explicit archive path |
| R0-RISK-003 | Consolidating 12 paths onto one constructor regresses a caller | Likely | Medium | Behavioural tests per path (T5) before consolidation |
| R0-RISK-004 | Stricter validation rejects input clients currently rely on | Likely | Medium | Log-only ("would-reject") mode first; then enforce |
| R0-RISK-005 | Index creation locks a large table | Possible | Medium | `CREATE INDEX CONCURRENTLY` |
| R0-RISK-006 | Backfill mis-assigns an activity's turnaround | Possible | **High** | Never auto-fill ORPH-2; snapshot + per-row audit; rollback path |
| R0-RISK-007 | Source-text tests report success while behaviour is wrong | **Certain today** | High | §32 |
| R0-RISK-008 | 1,305 existing compiler errors hide new breakage | Certain | Medium | Type-check the touched files in CI as a first step toward removing `ignoreBuildErrors` |
| R0-RISK-009 | ORPH counts are unknown, so effort is unbounded | Certain | Medium | Counts are the first gate (§31.1) |

---

## 35. DEPENDENCIES

| Dependency | Needed for | Status |
|---|---|---|
| Read-only ORPH counts against production | sizing every backfill | **Blocking §31** |
| Confirmation that the baseline migration reflects the live database | R0-FIX-004 | **UNVERIFIED — must be checked before altering constraints** |
| Decision on `/workpacks/new` retention | R0-FIX-012 | Product decision |
| `StandardActivityType` ↔ `activity_code` mapping completeness | R0-BF-004 | Data question |
| Maintenance window | BF-001 | Scheduling |

---

## 36. EXPLICITLY OUT OF SCOPE FOR R0

Recorded so the implementation run does not expand:

| Deferred | Reason | Suggested |
|---|---|---|
| Date/time model (`@db.Date` → `timestamptz`) | separate correction | R1 |
| Planned-date authority; CPM writing `planned_*` | schedule authority | R1 |
| CPM working-calendar correctness | schedule engine | R1 |
| Automatic CPM recalculation triggers / worker deployment | orchestration | R1 |
| Multi-equipment workpacks (EQUIPMENT_GROUP schema) | needs new model | R1 |
| Free-text → FK conversion for discipline, area, equipment type, contractor | value reconciliation | R2 |
| `Asset.area_id`; retiring `asset_type` / `is_active` | master data | R2 |
| Duplicate Workpack columns (`unit_code`, `equipment_type`) | master data | R2 |
| Duplicate punch / lessons / constraint models | consolidation | R2 |
| Legacy `Project` chain retirement | large removal | R3 |
| Duplicate progress / S-curve implementations; fabricated S-curve | progress authority | R1 (urgent, separate) |
| Readiness dimensions (3 of 9 enforced) | readiness authority | R1 (urgent, separate) |
| Removing `ignoreBuildErrors` | hygiene | R4 |

**No new engine of any kind is created in R0.**

---

## 37. IMPLEMENTATION SEQUENCE

**Stage 0 — measure (no code).** Run ORPH-1…10. Publish counts. Verify the baseline migration matches the live database.

**Stage 1 — make new writes correct.** FIX-002 (constructor) → FIX-003 (create guard) → FIX-001 (instantiation) → FIX-010 (site fallback). Ship behind "would-reject" logging first.

**Stage 2 — make the model honest.** FIX-004 (relations, indexes, `RESTRICT`).

**Stage 3 — close the divergence vectors.** FIX-005 (re-parenting) → FIX-008 (baseline clones) → FIX-009 (atomicity).

**Stage 4 — repair the broken paths.** FIX-007, FIX-006.

**Stage 5 — heal existing data.** §31, in order, gated on Stage 1–2 being live.

**Stage 6 — governance and UX.** FIX-011, FIX-012, FIX-013.

Stage 1 must precede Stage 5: backfilling before new writes are correct would re-introduce nulls immediately.

---

## 38. R0 DEFINITION OF DONE

R0 is complete when **all** hold:

1. All twelve creation paths produce activities satisfying §22, verified by behavioural tests (T5).
2. Instantiating a template yields activities with full identity (T3).
3. `standard_activity_type_id` is populated wherever an `activity_code` exists, and never guessed.
4. `Activity.event_id` has a declared relation, an index, a single writer, and `RESTRICT` on delete.
5. Client input can no longer set `event_id` directly.
6. Cross-tenant parent references are rejected in the **service** layer (T6).
7. Cross-event re-parenting is rejected or atomically recomputed and audited (T7).
8. Execution fields are rejected at creation (T12).
9. Area/system/unit-level work is creatable **without** equipment (T8).
10. ORPH-1, ORPH-3, ORPH-9 return zero; ORPH-2/4/5 have published adjudication queues.
11. Baseline clones do not appear in live event queries (T9).
12. No creation path fails silently; "Apply Template" either works or errors (T13).
13. Every architectural guarantee above is proven by a **behavioural** test, not a source-text assertion.
14. No new engine or parallel service was introduced; M8.13, M10, M11, M12, M14, M15, M16 are unchanged.

---

# R0 IMPLEMENTATION HANDOFF

### A. Files to change

| File | Change |
|---|---|
| `src/modules/Activity/Services/ActivityService.ts` | Sole constructor; `event_id` in signature; derive site/event; validate parent org; execution guard on create; resolve standard activity type |
| `src/core/planning/TemplateLibraryService.ts` | Pass `event_id`/`discipline_id`/standard type; workpack create inside transaction |
| `app/api/workpacks/[id]/activities/route.ts` | Replace `...body` with allow-list |
| `app/api/activities/route.ts` | Delegate; drop body-supplied `event_id`/`project_id`; drop site fallback |
| `app/api/activities/bulk/route.ts` | Delegate; validate workpack org; recompute `event_id` on re-parent |
| `app/api/workpacks/ai-generate/route.ts` | Delegate; remove discipline fallback; wrap in transaction |
| `src/modules/Workpack/Services/WorkpackService.ts` | Fix clone fields; carry `event_id` |
| `src/lib/services/ProjectBranchingService.ts` | Allow-list; `event_id: null`; reset execution state |
| `src/core/Platform/SeedPackService.ts` | Supply required identity; correct field names |
| `src/core/scope-change/ScopeChangeApplicationService.ts` | Delegate |
| `src/core/master-data/services/WorkpackTemplateService.ts` | Deprecate, or fix include **and** add tenant predicate |
| `app/api/projects/[id]/schedule/activities/route.ts` | Mark deprecated |
| `prisma/schema.prisma` | Declare 2 relations; 2 indexes; work-level enum |
| `src/lib/eventSubscribers.ts` | Identity-event handlers (alarm only) |
| `src/components/planning/ActivityPlanningGrid.tsx` | Pre-fill from workpack; stop discipline default |
| `src/components/Workpack/WorkpackCreateForm.tsx` | Scope-item linkage |
| `prisma/seeds/validation-plant-seed.ts` | Valid enum |

### B. Files to create

`src/core/identity/resolveActivityIdentity.ts` (derivation + validation helper, used by the constructor) · `src/core/identity/identityInvariants.ts` (ORPH-1…10 as monitored queries) · behavioural test suites per §33 · backfill design/runbook (script authored in the implementation run, not here).

### C. Files to delete / deprecate

`src/core/master-data/services/WorkpackTemplateService.ts` — `applyTemplate` (duplicate, broken, unscoped) · `app/api/projects/[id]/schedule/activities/route.ts` (deprecate; delete in R3) · `src/lib/services/ProjectBranchingService.ts` (deprecate; delete in R3) · `src/components/Workpack/ApplyTemplateModal.tsx` if `applyTemplate` is removed.

### D. Schema changes

Add `Activity.event` and `Activity.activity_library` relations (constraints already exist in the database) · `@@index([event_id])` and `@@index([organization_id, event_id])` on Activity · `Activity_event_id_fkey` delete rule → `RESTRICT` · work-level enum + column · backfill snapshot table. **No `Activity.asset_id`. No `Activity.scope_item_id`. No new NOT NULL constraints.**

### E. Migration / backfill

Order per §31: counts → snapshot table → BF-005 → BF-001 → BF-004 → review queues for BF-002/BF-003. Every row audited; rollback from the snapshot table.

### F. API / service changes

Per §29. One constructor, no new service, no authority moved.

### G. EventBus changes

Emit `ActivityCreated`, `ActivityReparented`. Add subscribers for recalculation enqueue and **inconsistency alarms**. Handlers must never write identity.

### H. UI changes

Per §30. Workpack Factory unchanged.

### I. Tests

T1–T14 as behavioural tests. One identity-guarantee test per creation path in §6.

### J. Regression suites

M8.13 progress aggregation · M11 CPM and baseline · M12 execution write and readiness · M16 channel authority · workpack factory and scope→workpack · planner workspace · Equipment 360. Each must be re-run **after** BF-001, because visible activity counts will change by design.

### K. Acceptance tests

§33, T1–T14. R0 is not done while any is red or any is satisfied only by a source-text assertion.

### L. Rollback strategy

Code: revert per stage — Stages 1–4 are independently revertible. Schema: indexes drop safely; the delete-rule change reverts to `SET NULL`; the relation declarations are metadata-only. Data: restore `event_id` from the snapshot table. Sequencing: never run Stage 5 before Stages 1–2 are stable in production.

### M. Definition of Done

§38, items 1–14.

---

## CONFIDENCE AND LIMITATIONS

**Directly verified from source in this run:** all twelve creation paths and their exact payloads; the `TemplateLibraryService` omission and the availability of `opts.event_id` in the same closure and transaction; the four downstream `event_id` filters; the absence of any backfill; the `Activity_event_id_fkey` constraint in the baseline migration with `ON DELETE SET NULL`; the complete Activity index list; `Activity` having no `asset_id`, `activity_code`, `planned_duration_hours`, `name` or `sequence`; the execution-field guard list and its application to updates but not creates; the `...body` spread; the org-validated workpack lookup on the one authoritative path; the missing org predicate in `applyTemplate`; the `disciplines[0]` fallback; non-atomic workpack instantiation; the bulk re-parenting hole; the 17-emitted/1-subscribed event split and its startup registration; the `verifyPrerequisites` stub and the test asserting it.

**Verified in this run from the parallel sweeps' claims, re-checked at source before inclusion:** `ControlledValueResolver`'s full method surface and its complete absence from write paths; `getTenantClient`'s single consumer; the `ProgressAggregationService` select omitting `standard_activity_type_id` while line 98 reads it through an `as any` cast; the Factory URL carrying `scope_item_id` against a form with no `useSearchParams`; `ExecutionWriteService`'s dual event validation at lines 126-131 and its null-tolerance; the unvalidated `activity_id` write in `ScopeChangeProposalService.addItem` and the primary-key-only mutations in `ScopeChangeApplicationService`; the Prisma v7 `$use()` removal note; `Workpack.event_id` being unindexed.

**Corrections I made to my own earlier reasoning in this run, recorded for transparency:**

1. In §8 I first argued that dropping `Activity.event_id` costs nothing on performance grounds because the column is unindexed. That was incomplete: `Workpack.event_id` is *also* unindexed, so the relational rewrite adds a join hop and still ends at an unindexed filter. The performance argument favours **indexing**, not either topology. The recommendation (Option C) did not change, but one of its three supporting arguments was wrong and has been replaced with the read-surface census.
2. I initially described the `/workpacks/new` scope gap as "no linkage exists". More precisely, **the linkage is transmitted and discarded** — the Factory already sends `scope_item_id`. This makes the fix substantially cheaper and moved it into R0 as FIX-005d.
3. The brief's example standard-activity codes (`HX.BLD`, `HX.BUNDLE_PULL`, `HX.CLEANING`) do not exist in this codebase; the real namespaces are `BLIND`/`BPULL`/`CLEAN`/`INSP` for standard types and `ACT-MECH-0010` for library codes. §11.3 records this rather than silently substituting.

**UNVERIFIED, and flagged rather than assumed:** all orphan record counts (no database access, by instruction); whether the live database matches the baseline migration — **this must be confirmed before altering any constraint**; whether `ai-generate`'s type error causes a runtime failure or is a tolerable Decimal/number mismatch (its payload keys are all valid Activity fields, so it is recorded as type-unsafe rather than broken); `validation-plant-seed`'s event and discipline population; whether Redis is provisioned in any environment; the completeness of the `StandardActivityType` ↔ `activity_code` mapping.

**Method note.** `WorkpackTemplateService.applyTemplate`, `ai-generate`, `WorkpackService.cloneWorkpack` and `SeedPackService` were all absent from the prior audit's inventory. They were found by searching for the Prisma operation rather than by following documented architecture — which is also why the prior audit's count of affected paths was too low. Where a path's breakage is asserted, the distinction between *unknown-argument errors* (which Prisma rejects at runtime) and *type-mismatch errors* (which may be tolerated) has been applied deliberately, and only the former are called broken.
