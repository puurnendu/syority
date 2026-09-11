# AURIANOA R0.3 — SCOPE CHANGE TENANT / EVENT / ACTIVITY IDENTITY SECURITY

**Name:** Scope Change Identity Ownership Remediation  
**Date:** 2026-09-09  
**Predecessor:** R0 forensic §1.4f / R0-FIX-005b; R0.1 left Scope Change untouched; R0.2 did not change Scope Change  
**Status:** GREEN

---

## 1. Executive Summary

Scope Change could previously attach and then mutate an Activity by primary key after only proving that the *Scope Change* belonged to the caller’s organisation. A syntactically valid Activity or Workpack UUID was treated as authorization.

R0.3 adds a shared server-side ownership proof (`ScopeChangeOwnership`) at the **service** boundary, not only the route guard. Every referenced Activity and Workpack is resolved from the database and checked against:

- the authenticated session `organization_id`
- the Scope Change’s own `event_id`
- the Workpack’s `organization_id` and `event_id` when a Workpack is present
- Activity ↔ Workpack event agreement when both are set

Cross-tenant and nonexistent UUIDs return the same generic not-found message. Cross-event references on the same tenant are rejected. `remove_activity` no longer writes `status: 'cancelled'`. `new_activity` is created through `ActivityCreationCommand`.

**Final security statement:** a correctly authenticated tenant **cannot** use Scope Change to mutate another tenant’s Activity or an Activity outside the authorized Event.

---

## 2. Original P0 Finding

Recorded in `docs/AURIANOA_R0_IDENTITY_PROPAGATION_FORENSIC_AND_IMPLEMENTATION_SCOPE.md` §1.4f and R0-FIX-005b:

| Defect | Evidence before R0.3 |
|---|---|
| `ScopeChangeProposalService.addItem` wrote `activity_id` / `workpack_id` from the request after only checking that the Scope Change belonged to the caller org | Pre-change `addItem` (~184–206) |
| `updateItem` could retarget `activity_id` / `workpack_id` the same way | Pre-change `updateItem` |
| `ScopeChangeApplicationService.apply` `modify_activity` used `tx.activity.update({ where: { id } })` | PK-only update |
| `remove_activity` used `tx.activity.update({ where: { id }, data: { status: 'cancelled' } })` | PK-only **and** an M12 execution-field write |
| `new_activity` used `tx.activity.create` and bypassed `ActivityCreationCommand` | R0.1 authority gap |
| Item / apply API routes ignored URL `eventId` | Same-org user could operate on a 2027 Scope Change via a 2029 URL if they knew the Scope Change UUID |

A UUID identified an object. It did not prove tenant or event ownership.

---

## 3. Scope Change Architecture

M8.11 remains the Scope Change workflow. R0.3 does not create a second engine.

```
UI (ScopeChangeDashboard — lifecycle only)
  → withTenantGuard + guardApi('nav.schedule')
  → ScopeChangeProposalService   (draft / analyze / submit / approve / reject / items)
  → ScopeChangeImpactService     (read schedule context; write impact JSON only)
  → ScopeChangeApplicationService.apply  (approved → applied)
        → ScopeChangeOwnership (tenant / event / workpack proof)
        → ActivityCreationCommand (new_activity only)
        → activity.updateMany (modify planning fields only)
        → AuditLog (existing AuditService / tx.auditLog)
```

Authorities unchanged:

| Authority | Owner | R0.3 action |
|---|---|---|
| Activity creation | `ActivityCreationCommand` | Reused for `new_activity` |
| Execution facts | M12 `ExecutionWriteService` | Not called; cancel refused |
| Progress math | M8.13 | Untouched |
| CPM / planned-date orchestration | M11 | Untouched |
| Identity backfill | R0.2 | No data written |

`src/core/shutdown-scope/ScopeChangeService.ts` is a **different** M6 frozen-scope change-request flow. It mutates `scopeItem`, not `Activity`. It is out of M8.11 R0.3 mutation scope.

---

## 4. Current Data Flow

```
Authenticated user
        ↓
session.user.organization_id          ← tenant authority (not client body)
        ↓
URL eventId                           ← operational context (bound at service)
        ↓
ScheduleScopeChange (id + org [+ event])
        ↓
ScheduleScopeChangeItem
        ↓
resolve Activity / Workpack from DB
        ↓
prove:
  Activity.organization_id == ScopeChange.organization_id
  Activity.event_id == ScopeChange.event_id   (when Activity.event_id is set)
  Workpack.organization_id == ScopeChange.organization_id
  Workpack.event_id == ScopeChange.event_id
  Activity.event_id == Workpack.event_id      (when both set)
        ↓
proposal write  OR  apply transaction  OR  reject
        ↓
AuditLog
```

`project_id` is never used as tenant, event, or authorization.

---

## 5. Current Authorization Flow

| Layer | Mechanism | Sufficient alone? |
|---|---|---|
| Session | `withTenantGuard` | No — another caller can invoke the service |
| Route permission | `guardApi('nav.schedule')` | No |
| Service tenant | `organization_id` from session, never from client body as authority | Required |
| Service event | URL `eventId` must match `ScopeChange.event_id` | Required |
| Service ownership | `ScopeChangeOwnership` resolves referenced rows | Required |

Create uses `organization_id` from the session and `event_id` from the URL, then proves `Event.organization_id == org`.

---

## 6. All Scope Change Write Paths

### 6.1 Operation matrix

| Operation | UI | Route | Service | DB mutation | Tenant | Event | Workpack | Authorization | Audit | Result |
|---|---|---|---|---|---|---|---|---|---|---|
| Create SC | Dashboard create / API | `POST /api/events/[eventId]/scope-changes` | `ProposalService.create` | `scheduleScopeChange.create` | Event ∈ org | URL event | n/a | `nav.schedule` | none on SC row | Allowed if event ∈ org |
| Update SC header | Dashboard | `PATCH …/[id]` default | `ProposalService.update` | SC update | SC ∈ org | URL event | n/a | same | none | Draft only |
| Add item | **API only** | `POST …/[id]/items` | `ProposalService.addItem` | item create | SC + referenced objects | URL + SC event | resolved if present | same + ownership | rejection audit | Allowed only if proof passes |
| Update item | API only | `PATCH …/items/[itemId]` | `ProposalService.updateItem` | item update | same | same | same | same | rejection audit | Cannot retarget to foreign UUID |
| Delete item | API only | `DELETE …/items/[itemId]` | `ProposalService.deleteItem` | item delete | SC ∈ org | URL event + SC id | n/a | same | none | Draft/analyzing |
| Analyze | Dashboard | `PATCH` `action=analyze` | `ImpactService.analyze` | SC impact fields | SC ∈ org | URL event; event lookup now org-scoped | none | same | none | Read + impact JSON |
| Submit | Dashboard | `PATCH` `action=submit` | `ProposalService.submit` | SC status | SC ∈ org | URL event; items re-proved | items re-proved | same | none | Refuses poisoned items |
| Approve / reject | Dashboard | `PATCH` | `approve` / `reject` | SC status | SC ∈ org | URL event | n/a | same | none | No Activity write |
| Apply `new_workpack` | Dashboard apply | `PATCH` `action=apply` | `ApplicationService.apply` | `workpack.create` | org + SC event | SC event | created in that event | same + proof | `SCOPE_CHANGE_APPLIED` | Allowed |
| Apply `new_activity` | Dashboard apply | same | `createActivity` | `activity.create` via command | command + ownership | derived from workpack / SC | proved or auto-created in-event | same | command audit + apply audit | Allowed |
| Apply `modify_activity` | Dashboard apply | same | `activity.updateMany` | planning fields only | `id + organization_id` | pre-proved | pre-proved | same | apply audit | Allowed |
| Apply `remove_activity` | Dashboard apply | same | **refused** | **none** | proved then refuse | proved then refuse | n/a | same | rejection audit | **Blocked (P1 → M12 CANCEL)** |
| Discovery create/assess | Dashboard | `/discoveries` | `DiscoveryWorkService` | discovery rows | org + event | URL event | n/a | same | none | No Activity write |
| M6 scope change request | Shutdown scope UI | `/api/shutdown-scope/…` | `shutdown-scope/ScopeChangeService` | `scopeItem` / `scopeChangeRequest` | scope ∈ org | n/a (scope, not Event) | n/a | separate | `scopeAuditLog` | Not M8.11 Activity path |

### 6.2 Activity writer inventory (repository search)

| Writer | Operation | Scope Change related? | Authority | Tenant checked | Event checked | Status |
|---|---|---|---|---|---|---|
| `ScopeChangeApplicationService` | `activity.updateMany` planning fields | Yes | M8.11 planning apply | Yes (`organization_id` + prior resolve) | Yes (resolve) | **Fixed** |
| `ScopeChangeApplicationService` | `createActivity` | Yes | R0.1 creation | Yes | Yes (from workpack / SC) | **Fixed** (was raw `activity.create`) |
| `ScopeChangeApplicationService` | `activity.update` status cancelled | Yes (removed) | Was M12 bypass | — | — | **Removed** |
| `ScopeChangeProposalService` | item `activity_id` write | Yes | Proposal only | Yes (resolve before write) | Yes | **Fixed** |
| `DiscoveryWorkService` | none on Activity | Adjacent | Discovery | org/event on discovery | event on create | No Activity mutation |
| `shutdown-scope/ScopeChangeService` | `scopeItem` | Name collision only | M6 | scope ∈ org | n/a | Not in R0.3 Activity scope |
| `ActivityCreationCommand` | create | Called by apply | R0.1 | Yes | Yes | Unchanged authority |
| `ExecutionWriteService` | execution fields | No | M12 | existing | existing | Unchanged |
| Other planning writers | various | No | existing | — | — | Not modified |

No `activity.delete` / `deleteMany` / `updateMany` existed in Scope Change besides the apply path. After R0.3 the only Scope Change Activity writes are `createActivity` and planning `updateMany`.

---

## 7. Tenant Boundary Analysis

| Check | Where | Failure |
|---|---|---|
| SC belongs to session org | `loadScopeChange` | Generic “Scope change not found” |
| Activity `organization_id` == session org | `resolveActivityForScopeChange` | Generic “Referenced activity was not found” |
| Workpack `organization_id` == session org | `resolveWorkpackForScopeChange` | Generic “Referenced workpack was not found” |
| Event `organization_id` == session org | `assertEventInTenant` / `create` | “Event not found” |
| Client `organization_id` | Ignored as authority | Session org is used |

Cross-tenant existence is not disclosed. Tenant B’s Activity is looked up by id, compared, and reported as not found — the same message as a random UUID.

---

## 8. Event Boundary Analysis

The business model does **not** support silent cross-event scope changes. R0.3 does not invent that operation.

| Case | Result |
|---|---|
| `Activity.event_id` set and ≠ `ScopeChange.event_id` | Reject (`Activity does not belong to this event`) |
| Workpack `event_id` ≠ Scope Change event | Reject (`Workpack does not belong to this event`) |
| URL `eventId` ≠ `ScopeChange.event_id` | Generic Scope Change not found |
| Create SC with another org’s event | Event not found |
| Explicit governed reparent (old event → new event + impact) | **Not implemented.** Would be a separate governed operation. |

Same-tenant TA-2027 Scope Change + TA-2029 Activity is rejected.

---

## 9. Workpack Boundary Analysis

Ownership is not inferred from `Activity.organization_id` alone.

When `Activity.workpack_id` is set, the Workpack is loaded. If it is missing, deleted, or other-tenant, the Activity reference fails as generic not-found (the Activity is not usable without a valid package). If the Workpack exists in-tenant but its event ≠ Scope Change event, the operation fails.

`new_activity` with a client `workpack_id` must pass `resolveWorkpackForScopeChange` at add, submit, and apply. Auto-created workpacks are written with the Scope Change’s `organization_id`, `event_id`, and the Event’s `site_id`.

---

## 10. UUID Handling

| Surface | Manual UUID entry? |
|---|---|
| `ScopeChangeDashboard.tsx` | **No.** Lifecycle actions (analyze / submit / approve / reject / apply) and discovery assess. No add-item form. No activity/workpack/event/org UUID fields. |
| Scope Change APIs | UUIDs in JSON / path as integration contract |
| Activity grid / inspector | Display of `activity_id` (business code), not a Scope Change entry workaround |

**R0/UI defect (not redesigned in R0.3):** there is no Event → Equipment → Workpack → Activity search/select to attach items. Normal users currently cannot complete add-item through the dashboard at all; items are API-only. That is a missing relationship UX, not a UUID-entry workaround. Do not treat API JSON as a business-user screen.

---

## 11. Cross-Tenant Attack Scenario

Tenant A: `SC-A`, `ACT-A`  
Tenant B: `SC-B`, `ACT-B`

| Attempt | Result |
|---|---|
| `SC-A` + `ACT-B` add/modify/remove | Fail, generic activity not found |
| `SC-A` apply with a stored item pointing at `ACT-B` (poisoned pre-R0.3 row) | Fail at pre-flight; `ACT-B` unchanged; `SC-A` not applied |
| `SC-A` + `WP-B` | Fail, generic workpack not found |
| `SC-A` created on `EVENT-B` | Fail, event not found |
| Org B session + `SC-A` | Fail, scope change not found |
| Predecessor `ACT-B` on an A item | Fail, generic activity not found |
| Retarget item `activity_id` to `ACT-B` | Fail; stored item still `ACT-A` |

Proven behaviour: Tenant B Activity unchanged, Tenant A item list not poisoned, no `SCOPE_CHANGE_APPLIED` audit, rejection audit written on **caller** org only.

---

## 12. Cross-Event Attack Scenario

Same tenant, Event TA-2027 Scope Change, Activity/Workpack on TA-2029.

| Attempt | Result |
|---|---|
| Add/modify 2029 Activity on 2027 SC | Reject event mismatch |
| Add 2029 Workpack on 2027 SC | Reject workpack event mismatch |
| Call add/apply with URL event 2029 against a 2027 SC | Generic Scope Change not found |

No silent reparent. `Activity.event_id` is not rewritten to “fix” the mismatch.

---

## 13. Loose Activity Handling

R0.2 left legitimate and unresolved loose rows. R0.3 does **not** backfill or delete them.

| Activity shape | Scope Change participation |
|---|---|
| Event set, no Workpack, event == SC event | **Allowed** (event-scoped loose) |
| Event null, Workpack present, Workpack.event == SC event | **Allowed** (R0.2 leftover; Workpack proves context) |
| Event null, Workpack null | **Rejected** — cannot prove operational context |
| Event set ≠ Workpack event | **Rejected** — identity contradiction |
| Missing Discipline / SAT | **Allowed** — not inferred; not an R0.3 security axis |
| Soft-deleted Activity | Treated as not found |

The 72 unclassified Activities and 4 unresolved-event Activities from R0.2 were not modified.

---

## 14. Authorization Analysis

| Question | Answer |
|---|---|
| Required permission | `nav.schedule` (unchanged) |
| Route guard | `withTenantGuard` + `guardApi` (unchanged) |
| Role model | Existing; not replaced |
| Service-level ownership | **Now present** — `ScopeChangeOwnership` |
| Can the service be called without the route? | Yes. Ownership still applies. |
| Client org / event as authority | No |

Route authorization remains necessary and is insufficient by itself.

---

## 15. Transaction Analysis

`apply` still uses `prisma.$transaction`.

Order:

1. Pre-flight: load SC, prove event ∈ tenant, prove every item, refuse `remove_activity` — **before** status `applying`
2. Inside TX: mark applying → per-item re-proof → planning writes / `createActivity` → `auditLog.create` → mark applied → close discovery if any

If audit or a later item fails, the transaction rolls back. Tests prove: Activity planning fields revert, SC remains `approved`, no applied audit.

`remove_activity` fails in pre-flight, so apply never enters a partial “applying” state for that case.

Proposal `addItem` is not in the same transaction as Activity mutation (it only writes an item). A rejected add writes no item.

---

## 16. Audit Analysis

Existing `AuditService` / `AuditLog` only. No parallel table.

| Event | When | Contents |
|---|---|---|
| `R0.3_SCOPE_CHANGE_SECURITY` / `result: rejected` | Failed ownership proof on add/update/apply | Caller org, user, SC id, `reason` code (e.g. `ACTIVITY_NOT_FOUND`). No secrets. No foreign-tenant payload. |
| `SCOPE_CHANGE_APPLIED` | Successful apply | Counts + change number; `source: R0.3_SCOPE_CHANGE_SECURITY` |
| Activity `created` | `new_activity` via command | Existing R0.1 audit |

Rejected cross-tenant attempts do **not** write a success audit against Tenant B.

---

## 17. Execution Authority Analysis

| Field | Scope Change after R0.3 |
|---|---|
| `status` | Not written (cancel path removed) |
| `progress_percent` | Not written on modify; create remains `0` via command |
| `actual_start` / `actual_end` | Not written |
| HOLD / RESUME / COMPLETE / START | Not invoked |

`ExecutionWriteService.applyAction` still has no `CANCEL`. R0-FIX-005b’s “route cancellation through EWS” cannot be completed without expanding M12. R0.3 therefore **refuses** `remove_activity` apply rather than inventing a second cancel writer.

Modify is restricted to `duration_hours`, `budgeted_cost`, `planned_start`, `planned_end`, `description`.

---

## 18. Planning Authority Analysis

Scope Change does not calculate `early_start`, `early_finish`, `total_float`, critical path, or successor dates. Impact analysis remains the existing heuristic hours/crew estimate (M8.11), not M11 CPM.

Legitimate planning-input changes (`duration_hours`, planned dates) are written as inputs only. M11 orchestration is not called from R0.3. Schedule recalculation is out of scope.

---

## 19. Database Constraints

Inspected; **no schema change** in R0.3.

| Relationship | FK today | Note |
|---|---|---|
| `ScheduleScopeChange.organization_id` | Yes → Organization | Sound |
| `ScheduleScopeChange.event_id` | Yes → Event | Sound; does not by itself bind items |
| `ScheduleScopeChangeItem.activity_id` | **No FK** | UUID column only |
| `ScheduleScopeChangeItem.workpack_id` | **No FK** | UUID column only |
| `Activity.organization_id` | Yes | Sound |
| `Activity.workpack_id` | Yes | Nullable |
| `Activity.event_id` | DB FK / no Prisma `@relation` (known R0 drift) | Denormalized; validated in application |
| `Workpack.organization_id` / `event_id` | Yes | Sound |
| Composite (SC org, item activity org) | **None** | Application invariant; propose separately if required |
| Indexes | Existing SC item `scope_change_id`; Activity org/event/deleted from R0.1 | No new index |

A composite ownership constraint is **not** added speculatively. Application-level proof is the R0.3 control.

---

## 20. Remediation Performed

1. Added `src/core/scope-change/ScopeChangeOwnership.ts` — resolve + prove + generic errors + rejection audit helper.
2. `addItem` / `updateItem` / `submit` prove Activity, Workpack, and predecessors before write.
3. `update` / `approve` / `reject` / `deleteItem` / `getById` bind optional URL `eventId`.
4. `apply` pre-proves every item; `modify_activity` uses `updateMany` with `id + organization_id + deleted_at: null`; `new_activity` calls `createActivity`; `remove_activity` throws `REMOVE_ACTIVITY_M12`.
5. API routes pass `eventId` and `userId`; HTTP status from `AppError.statusCode`.
6. Impact event lookup now includes `organization_id`.
7. Behavioral tests in `src/core/scope-change/__tests__/r03-scope-change-security.test.ts`.
8. No R0.2 data backfill. No M8.13 / M11 / M12 / identity-engine changes.

---

## 21. Files Changed

**Created**

- `src/core/scope-change/ScopeChangeOwnership.ts`
- `src/core/scope-change/__tests__/r03-scope-change-security.test.ts`
- `docs/AURIANOA_R0.3_SCOPE_CHANGE_SECURITY_RESULT.md`

**Modified**

- `src/core/scope-change/ScopeChangeProposalService.ts`
- `src/core/scope-change/ScopeChangeApplicationService.ts`
- `src/core/scope-change/ScopeChangeImpactService.ts`
- `src/core/scope-change/index.ts`
- `app/api/events/[eventId]/scope-changes/route.ts`
- `app/api/events/[eventId]/scope-changes/[id]/route.ts`
- `app/api/events/[eventId]/scope-changes/[id]/items/route.ts`
- `app/api/events/[eventId]/scope-changes/[id]/items/[itemId]/route.ts`
- `docs/AURIANOA_R0_IDENTITY_PROPAGATION_FORENSIC_AND_IMPLEMENTATION_SCOPE.md` (pointer only)

**Intentionally untouched**

- `ActivityCreationCommand` implementation (called, not rewritten)
- `ExecutionWriteService` / M12
- `ProgressCalculationService` / M8.13
- M11 CPM / calendar
- R0.2 backfill services and the 72 / 4 leftover Activity rows
- `shutdown-scope/ScopeChangeService.ts`
- `ScopeChangeDashboard.tsx` (no UUID redesign)
- Prisma schema / migrations
- Project → Event consolidation

---

## 22. Behavioral Tests

File: `src/core/scope-change/__tests__/r03-scope-change-security.test.ts`

These execute proposal and apply against an in-memory Prisma mock. They do not grep source for `organization_id` or `validateOwnership`.

| ID | Contract | Assertion |
|---|---|---|
| R03-01 | Same tenant + same event, authorized | Add + apply modify succeeds; planning fields change; `status` / `progress` / `actual_start` unchanged; apply audit written |
| R03-02 | Wrong tenant + valid UUID | Generic not-found; B Activity unchanged; A items empty; rejection audit on A only |
| R03-03 | Poisoned apply (B UUID already on A item) | Apply fails; B unchanged; SC stays approved |
| R03-04 | Same tenant + wrong event | Event mismatch; 2029 Activity unchanged |
| R03-05 | Wrong tenant vs nonexistent UUID | Identical generic message; no “Tenant B” leak |
| R03-06 | Missing Activity | Generic not-found |
| R03-07 | Cross-tenant Workpack | Generic workpack not-found |
| R03-08 | Cross-event Workpack | Workpack event mismatch |
| R03-09 | Missing Workpack | Generic workpack not-found |
| R03-10 | Loose + event, no workpack | Allowed |
| R03-11 | Loose, no event, no workpack | Rejected |
| R03-12 | Null event + matching workpack event | Allowed |
| R03-13 | Activity event ≠ Workpack event | Rejected |
| R03-14 | Unauthorized org on foreign SC | Scope change not found |
| R03-15 | Wrong event URL | Scope change not found |
| R03-16 | Tenant B Event on Tenant A create | Event not found |
| R03-17 | Foreign predecessor | Generic activity not-found |
| R03-18 | `remove_activity` apply | Refused; status not `cancelled`; no `activity.update` |
| R03-19 | Authorized `new_activity` | Created via command identity; `not_started` / 0 |
| R03-20 | Duplicate add | Allowed (current proposal design, not invented idempotency) |
| R03-21 | Transaction failure | Activity and SC rolled back |
| R03-22 | `updateItem` retarget to B | Fail; stored id remains A |
| R03-23 | Remove B via add | Fail; B unchanged |
| R03-24 | Submit poisoned item | Stay draft |

---

## 23. Regression Tests

Intended suite after R0.3 (must remain green; not weakened):

| Suite | Why |
|---|---|
| `src/core/activity/__tests__/r01-activity-identity-creation.test.ts` | Creation authority |
| `src/core/activity/__tests__/r02-identity-backfill.test.ts` | Backfill unchanged |
| `tests/progress-calculation.test.ts` | M8.13 |
| `tests/m11-cross-event-safety.test.ts` | M11 event isolation |
| `src/core/execution/__tests__/m12-final-balance.test.ts` | Execution field boundary |
| `src/core/execution/__tests__/m12-r01-p0-remediation.test.ts` | Writer classification (`updateMany` is not `activity.update`) |

| Suite | Result |
|---|---|
| R0.3 `r03-scope-change-security.test.ts` | **24 / 24 passed** (confirm re-run after snapshot fix) |
| R0.1 identity creation | **15 / 15 passed** |
| R0.2 identity backfill | **16 / 16 passed** |
| M8.13 `progress-calculation.test.ts` | **47 / 47 passed** |
| M11 `m11-cross-event-safety.test.ts` | **14 / 14 passed** |
| M12 `m12-final-balance.test.ts` | 14/15 then **15/15** on re-run (Excel event-isolation 5s timeout flake, unrelated to R0.3) |
| M12 `m12-r01-p0-remediation.test.ts` | **42 / 42 passed** |

---

## 24. Security Invariants

1. A UUID is an identifier, not an authorization token.
2. Tenant is the session organisation, never a client-supplied `organization_id`.
3. Event context is the Scope Change’s event, bound to the URL event when present.
4. Workpack ownership is proved independently of Activity.organization_id.
5. Activity.event_id must agree with Workpack.event_id when both are set.
6. Cross-tenant and missing references share a generic not-found.
7. Scope Change must not write execution facts.
8. Scope Change must not compute CPM.
9. `new_activity` goes through `ActivityCreationCommand`.
10. Service-level proof is mandatory even if the route guard is bypassed.
11. No second identity engine.
12. No R0.2 data repair in this phase.

---

## 25. Remaining Defects

| ID | Severity | Defect | Route |
|---|---|---|---|
| R03-P1-001 | **P1** | `remove_activity` apply is refused. There is no M12 CANCEL action. Users can record the intent on a draft item but cannot apply cancellation through Scope Change. | Future M12 CANCEL + explicit Scope Change disposition |
| R03-P2-001 | P2 | `ScheduleScopeChangeItem.activity_id` / `workpack_id` have no FK. Application proof is the control. | Optional later constraint proposal |
| R03-P2-002 | P2 | Dashboard has no search/select to attach Activities (API-only items). | R0/UI — not redesigned here |
| R03-P2-003 | P2 | `DiscoveryWorkService` still does not tenant-check `asset_id` (no Activity mutation). | Separate harden |
| R03-P2-004 | P2 | Impact baseline lookup remains org + `is_current` (pre-existing M15 note). Event duration lookup is now org-scoped. | M15 / impact follow-up |
| R03-P2-005 | P2 | Live `syority` `"Activity"` historically lacked `project_id` / `schedule_source`. `createActivity` writes those Prisma fields. Apply of `new_activity` against that live shape may fail until schema alignment. Not a cross-tenant hole. | Schema drift (known R0.1/R0.2) |
| R03-P3-001 | P3 | Item `discipline` remains a free string; apply resolution uses R0.1 CVR. | Existing |

No remaining **P0** on the Scope Change Activity mutation path.

---

## 26. Known Limitations

- Duplicate modify items for the same Activity are still allowed (pre-existing proposal design).
- Cross-event movement is not a product feature; it is rejected.
- Project is not an authorization axis; legacy Project references were not migrated.
- M6 `ScopeChangeService` is a different bounded context.
- Rejection audit requires a `userId`; service calls without a user still throw but may not write the rejection row.
- Impact analysis is still heuristic, not CPM.

---

## 27. Before / After Matrix

| Path | Before | After |
|---|---|---|
| addItem `activity_id` | Written if SC ∈ org | Written only after tenant/event/workpack proof |
| updateItem retarget | Same hole | Same proof; foreign UUID fails; stored id unchanged |
| apply modify | `update` by PK | `updateMany` + org + prior resolve; planning fields only |
| apply remove | `status: cancelled` by PK | Refused; no status write |
| apply new activity | Raw `activity.create` | `ActivityCreationCommand` |
| URL eventId | Ignored on item/apply | Must match SC.event_id |
| Cross-tenant UUID | Could mutate B | Generic not-found; B unchanged |
| Cross-event UUID | Could mutate other event | Rejected |
| Loose no context | Could be attached | Rejected |
| Information leak | Possible “exists” distinction | Same message as missing |
| Execution fields | Cancel wrote status | No execution writes |
| CPM | None | None |
| R0.2 rows | — | Unchanged |

---

## 28. Final Verdict

**Status: GREEN**

Every Scope Change Activity reference is tenant-validated at the service boundary. Applicable Event and Workpack relationships are validated. Cross-tenant and unauthorized-event mutation through Scope Change is rejected. Route guards remain; they are no longer the only control. Execution facts are not written. Progress math and CPM were not introduced. No second identity engine. No R0.2 backfill. Transactions roll back on apply failure. Audit uses the existing log.

`remove_activity` apply is an explicit governed refusal (P1), not a silent cancel. That refusal is what keeps the execution-authority invariant true.

Behavioral file: **24 / 24 passed**. R0.1 / R0.2 / M8.13 / M11 / M12-R01 passed. M12 final-balance passed on re-run after one unrelated 5s Excel isolation timeout.

### Required security statement

> Can a correctly authenticated user/tenant use Scope Change to mutate an Activity belonging to another tenant or unauthorized Event?

## **NO.**

**What was proven**

- Tenant A + ACT-B is rejected at add, update, submit, and apply; ACT-B is unchanged; SC-A is not poisoned or applied.
- Event 2027 + Activity/Workpack 2029 is rejected; the 2029 Activity is unchanged.
- Authorized same-tenant same-event modify and create succeed with planning-only / command identity.
- Foreign and nonexistent Activity UUIDs return the same generic message.
- `remove_activity` does not write `status`.

**What was changed**

- Ownership module, proposal/apply/impact services, Scope Change API event binding, behavioral tests, this document.

**What was not changed**

- M8.13, M11, M12, R0.1 command internals, R0.2 data, UI redesign, schema constraints, Project→Event, Discipline/SAT creation.

**Remaining risks**

- Cancellation is not product-complete until M12 CANCEL exists (P1).
- Item UUID columns remain unconstrained at the database (P2).
- Attach-item UX is missing (P2).
- Live schema drift can still fail `new_activity` apply on `syority` (P2, not a tenant bypass).

**Next recommended remediation (do not start automatically)**

1. M12 CANCEL (or an explicit non-execution disposition) if product requires apply-time removal.
2. Optional composite FK / constraint proposal for item `activity_id` / `workpack_id`.
3. Scope Change attach UX (search/select) — R0/UI.
4. Discovery `asset_id` tenant proof (separate, small).

R0.4 is **not** started.

---

### Test run record

**R0.3 file (confirm re-run):** **24 passed, 0 failed.** Duration ~526ms.

First run was 23/24. R03-18 failed because `JSON.parse(JSON.stringify)` turned `actual_start` into a string while the live row still held a `Date`. Apply was already refused (`REMOVE_ACTIVITY_M12` / 422; status not `cancelled`; SC stayed `approved`; `prisma.activity.update` not called). After `cloneRow` / `expectUnchanged`, R03-18 passed.

**Regressions:** 148 passed + 1 Excel isolation 5s timeout, then **149 passed, 0 failed** on the same suite. The timeout is unrelated to R0.3 writers.
