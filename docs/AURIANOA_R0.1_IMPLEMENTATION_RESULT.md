# AURIANOA R0.1 — IMPLEMENTATION RESULT

**Name:** Activity Identity Creation Authority & Validation  
**Date:** 2026-09-08  
**Status:** AMBER

---

## 1. Objective

Establish one authoritative, validated Activity creation command and connect existing governance (`ControlledValueResolver`) to the actual write paths. Correct template instantiation so generated activities receive deterministically known identity relationships. Do not create a new identity engine, backfill production data, or change M8.13 / M11 / M12 authority.

---

## 2. Files changed

- `src/core/activity/ActivityCreationCommand.ts` *(created)*
- `src/core/activity/ActivityIdentityError.ts` *(created)*
- `src/core/activity/__tests__/r01-activity-identity-creation.test.ts` *(created)*
- `src/core/progress/__tests__/r01-progress-sat-loader.test.ts` *(created)*
- `src/modules/Activity/Services/ActivityService.ts`
- `src/core/planning/TemplateLibraryService.ts`
- `src/core/master-data/services/WorkpackTemplateService.ts`
- `src/modules/Workpack/Services/WorkpackService.ts` (`cloneWorkpack` only)
- `src/core/progress/ProgressAggregationService.ts` (select `standard_activity_type_id`; remove `as any`)
- `app/api/workpacks/[id]/activities/route.ts`
- `app/api/activities/route.ts`
- `app/api/activities/bulk/route.ts`
- `app/api/projects/[id]/schedule/activities/route.ts`
- `app/api/workpacks/ai-generate/route.ts`
- `prisma/schema.prisma` (additive `Activity` index only)
- `prisma/migrations/20260908_r01_activity_event_index/migration.sql` *(created; not applied in this run)*
- `src/core/execution/__tests__/m12-final-balance.test.ts` (related: bulk create now lives in the command)
- `docs/AURIANOA_R0_IDENTITY_PROPAGATION_FORENSIC_AND_IMPLEMENTATION_SCOPE.md` (pointer only)

---

## 3. Files created

- `src/core/activity/ActivityCreationCommand.ts`
- `src/core/activity/ActivityIdentityError.ts`
- `src/core/activity/__tests__/r01-activity-identity-creation.test.ts`
- `src/core/progress/__tests__/r01-progress-sat-loader.test.ts`
- `prisma/migrations/20260908_r01_activity_event_index/migration.sql`
- `docs/AURIANOA_R0.1_IMPLEMENTATION_RESULT.md`

---

## 4. Files intentionally untouched

- `ScopeChangeProposalService.ts` / `ScopeChangeApplicationService.ts` — R0.3
- `ProjectBranchingService.ts` — baseline copy, not new business creation
- `SeedPackService.ts`, `prisma/seeds/validation-plant-seed.ts` — seed exceptions
- `ProgressCalculationService.ts` — M8.13 math unchanged
- `ExecutionWriteService.ts` — M12 unchanged
- CPM / calendar / schedule engine
- Factory methodology beyond routing instantiate through the command
- UI screens and navigation
- M13 / M14 / M15 / M16
- Event bus architecture
- No production `UPDATE` / backfill

---

## 5. New Activity authority

`createActivity(context, input, db?)` in `src/core/activity/ActivityCreationCommand.ts` is the sole business writer.

Context carries tenant, user, source channel, and an event *hint*. Input carries business fields. Tenant and event identity are never trusted from the client as write values.

`ActivityService.createActivity` is a compatibility adapter. It does not write Activity rows itself.

When `db` is omitted the persist step runs in `prisma.$transaction`. Callers already inside a transaction (template instantiate, bulk, clone) pass that client.

---

## 6. Validation integration

The command calls existing `ControlledValueResolver` methods. It does not copy their lookup logic.

| Check | Resolver / rule |
|---|---|
| Discipline | `resolveDiscipline` |
| Equipment type | `resolveEquipmentType` (explicit id fails; string lookup is inferred and does not guess) |
| Asset | `resolveAsset` when supplied; reject cross-tenant or workpack conflict |
| Contractor | `resolveContractor` when supplied (not stored on Activity) |
| Standard activity | `resolveStandardActivity` when explicit; inferred from `activity_code` only if unique |
| Hierarchy | `validateHierarchy` when plant/unit/system are present |
| Workpack / event | org-scoped ownership + `Activity.event_id === Workpack.event_id` |

A resolver miss throws. There is no `first()` fallback and no silent drop of a supplied identity field.

---

## 7. Template path correction

`TemplateLibraryService.instantiate` no longer calls `tx.activity.create` with a partial payload.

It now:

1. Creates the workpack with `event_id` (previously only patched later)
2. Resolves `activity_library_id` from template `activity_code`
3. Calls `createActivity(..., tx)` for each template activity

Workpack Factory / `WorkpackIntelligenceService.instantiateFromScope` already called this method, so factory-created activities inherit the same identity write.

`WorkpackTemplateService.applyTemplate` no longer uses an invalid Prisma `include: { activities }` (there is no such relation). It loads `workpack_template_activities` and creates through the command.

---

## 8. Standard Activity correction

- Explicit `standardActivityType` / `standardActivityTypeId` must resolve or the create fails.
- Template `activity_code` is offered to `resolveStandardActivity` when an equipment type is known. Library codes that are not SAT codes stay unclassified (`null`) — they are a different namespace, not a guess.
- Explicit SAT without equipment context is rejected (`INVALID_STANDARD_ACTIVITY`).
- `ProgressAggregationService.loadEventActivities` now selects `standard_activity_type_id` and reads it without `as any`.

---

## 9. Event identity handling

`Activity.event_id` remains a **nullable denormalized FK**. It was not made `NOT NULL` (workpack-less and historical rows exist; backfill is R0.2).

Server rule:

- Workpack present → `Activity.event_id = Workpack.event_id` (may be null)
- Caller event hint that disagrees with the workpack → `EVENT_MISMATCH`
- Loose activity (`allowLoose`) → event must belong to the caller tenant
- Clients cannot independently establish event identity

Additive index only: `Activity_org_event_deleted_idx` on `(organization_id, event_id, deleted_at)`. Migration file written, not applied in this run.

---

## 10. Equipment identity handling

`asset_id` was **not** added to Activity.

- Equipment-specific workpack: equipment stays on `Workpack.asset_id`. An explicit activity asset must match or the create fails.
- System / unit / area workpack: no equipment FK is required or invented.

---

## 11. Discipline handling

Supplied discipline id/code is resolved through `resolveDiscipline`. If the caller omits it, the workpack discipline is derived. Free-text that does not resolve is rejected. The AI generate path no longer assigns `disciplines[0]`.

---

## 12. Tenant isolation

Workpack and event are loaded by id first, then compared to `context.organizationId`. Cross-tenant parents throw `CROSS_TENANT_WORKPACK` / `CROSS_TENANT_EVENT` (HTTP 403). Controlled values are resolved inside the caller org.

Scope-change item `activity_id` ownership was **not** changed (R0.3).

---

## 13. Transaction behaviour

Validation failure occurs before `activity.create`. A thrown error inside a shared transaction (template, bulk) rolls back activities already written in that transaction. Audit uses the existing `AuditService.log(..., db)` helper.

---

## 14. Test results

| ID | Result |
|---|---|
| R01-01 authoritative create | PASS |
| R01-02 template instantiate identity | PASS |
| R01-03 SAT populated | PASS |
| R01-04 invalid SAT | PASS |
| R01-05 cross-tenant workpack | PASS |
| R01-06 cross-tenant event | PASS |
| R01-07 event mismatch TA-2027 / TA-2028 | PASS |
| R01-08 invalid hierarchy | PASS |
| R01-09 equipment-specific workpack | PASS |
| R01-10 system-level activity | PASS |
| R01-11 ambiguous / unresolvable SAT | PASS |
| R01-12 no partial row | PASS |
| R01-13 audit / source channel | PASS |
| R01-14 tenant A vs workpack B | PASS |
| R01-15 ActivityService same rules | PASS |
| M8.13 SAT loader | PASS |

---

## 15. Regression results

| Suite | Result |
|---|---|
| R0.1 + ControlledValueResolver | PASS (27) |
| M9 factory | PASS |
| M10 planning / planning foundation | PASS |
| Governance demonstration | PASS |
| M12 final balance / tenant isolation / R01 P0 / hold-resume / bulk-readiness | PASS after related bulk-route assertion update |
| M8.13 `tests/progress-calculation.test.ts` | PASS |
| M11 cross-event / schedule view / import deprecation / ScheduleOrchestration | PASS |
| Workpack module tests | PASS |
| Equipment 360 / tenant-event isolation reports | PASS |

No unrelated failing tests were rewritten. The M12 bulk string assertion was updated because the create write moved to the command; the invariant (creates start `not_started` / `progress_percent: 0`; planning bulk cannot set execution fields) is unchanged.

---

## 16. Remaining R0 defects

| Item | Class | Phase |
|---|---|---|
| Scope-change `activity_id` write / mutate without ownership | P0 | R0.3 |
| Existing activities missing `event_id` / SAT (no backfill this run) | P0 | R0.2 |
| Factory URL `scope_item_id` ignored by `/workpacks/new` | P1 | later R0 UI |
| `ProjectBranchingService` copies still bypass the command | P2 | later / exception |
| Seed activity writers still broken / bypass | P3 | seed |
| `Workpack.event_id` still unindexed | P2 | later |
| `Activity.event` Prisma relation still undeclared | P2 | later |
| M8.13 still groups equipment type from `workpack.equipment_type` string | P2 | later |

---

## 17. Deferred R0.2 / R0.3 work

**R0.2** — controlled backfill of `event_id`, discipline, and standard activity on existing rows. Not started.

**R0.3** — ScopeChange proposal/application tenant and event guards. Not started.

---

## 18. Known limitations

- `Activity.event_id` remains nullable. New workpack-backed rows inherit a null event if the workpack has no event.
- Standard activity is populated only when equipment type + SAT ref resolve. Template library codes such as `ACT-MECH-0010` stay unclassified.
- AI generate still creates the workpack before activities; a later SAT/discipline failure can leave an empty workpack (pre-existing non-atomic factory).
- Legacy `POST /api/projects/[id]/schedule/activities` may create a loose activity with `project_id` and no event. `project_id` is never used as `event_id`.
- The new Activity index is not applied until migrate deploy.
- Browser / live factory click-through was not run in this session.

---

## 19. Definition of Done

- [x] One authoritative Activity creation command exists
- [x] Normal production create paths converge on it, or are documented as deferred
- [x] `ControlledValueResolver` is called by the write path
- [x] No duplicate validation engine
- [x] `TemplateLibraryService.instantiate` uses the command
- [x] Template activities receive deterministically known identity
- [x] `standard_activity_type_id` populated when resolvable
- [x] M8.13 can read `standard_activity_type_id`
- [x] Cross-tenant create rejected
- [x] Cross-event mismatch rejected
- [x] Invalid hierarchy rejected
- [x] No identity guessing
- [x] No partial Activity after validation failure
- [x] Existing audit/provenance preserved (`source_channel`, `template_id`)
- [x] Behavioural tests prove the above
- [x] No production data backfilled
- [x] No CPM / progress / execution authority duplicated or altered

---

## 20. Final verdict

**R0.1 STATUS: AMBER**

The write authority is in place and the primary factory → template path uses it. Remaining redness is existing-data orphans and the deferred scope-change security hole — both explicitly out of this run.

### Prisma Activity.create census (after R0.1)

| Location | Class |
|---|---|
| `ActivityCreationCommand.createActivity` | AUTHORITATIVE |
| `ActivityService.createActivity` | MUST ROUTE — now adapter |
| `TemplateLibraryService.instantiate` | MUST ROUTE — now routed |
| `WorkpackTemplateService.applyTemplate` | MUST ROUTE — now routed |
| `WorkpackService.cloneWorkpack` | MUST ROUTE — now routed |
| `POST /api/activities` | MUST ROUTE — now routed |
| `POST /api/activities/bulk` | MUST ROUTE — now routed |
| `POST /api/workpacks/[id]/activities` | MUST ROUTE — now routed |
| `POST /api/workpacks/ai-generate` | MUST ROUTE — now routed |
| `POST /api/projects/[id]/schedule/activities` | MUST ROUTE — now routed (legacy loose) |
| `ScopeChangeApplicationService` | LEGACY / DEFERRED R0.3 |
| `ProjectBranchingService` | LEGACY baseline copy |
| `SeedPackService` / validation-plant-seed | SEED |

### P0 remaining

2 — existing orphan activities (R0.2); scope-change cross-tenant mutation (R0.3)

### P1 remaining

Factory `/workpacks/new` query-param drop; SAT namespace gap on library codes; UI enter-once screens

### P2 remaining

Undeclared Prisma event relation; unindexed `Workpack.event_id`; baseline copy bypass; equipment-type string in M8.13

### P3 remaining

Broken seed writers

---

## Question

**Can the primary STO Workpack Factory create an Activity once and preserve its authoritative identity relationships without requiring downstream manual re-entry?**

**PARTIALLY**

Why:

- Factory instantiate already goes through `WorkpackIntelligenceService` → `TemplateLibraryService.instantiate`. That path now writes `organization_id`, `workpack_id`, derived `event_id`, derived/resolved `discipline_id`, and `standard_activity_type_id` when the template SAT is governed and the equipment type is known. Equipment remains on the workpack. The planner does not re-type those identities on the factory instantiate screen.
- M8.13 can now read `standard_activity_type_id`. M11 / M8.13 / M12 event-scoped queries can see **new** factory activities that carry `event_id`.
- Existing activities created before this run still lack those fields (no backfill). Template library codes that are not SAT codes stay unclassified. Manual `/workpacks/new` still ignores factory URL params. Those gaps prevent a full YES.

---

## Next recommended step

**R0.2 — controlled backfill** of `event_id` (from workpack), then discipline / SAT where uniquely derivable, with audit and rollback. Do not start R0.3 until R0.2 scope is agreed.

Do not automatically start R0.2 from this run.
