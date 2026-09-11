# AURIANOA R0.4-D — WORKPACK EVENT REVIEW
## Implementation Result

**Programme:** R0 identity / operational-container correction  
**Phase:** Controlled human Event review, assignment, conflict handling, quarantine, audit  
**Date:** 2026-09-09  
**Database:** local Postgres `syority`

**Governing principle:** ENTER ONCE / STORE ONCE / DERIVE ONCE / REUSE EVERYWHERE.

---

## 1. Executive Summary

R0.4-D implements a **human-confirmed** Workpack Event Review workflow. It does **not** backfill the 177 Event-less Workpacks.

Pre-implementation census matched R0.4-C (delta 0). After implementation, live data is unchanged: **195** Workpacks, **18** Event-linked, **177** Event-less, **0** Project-linked, **0** review rows, **0** R0.4-D Event assignments.

A planner can now:

1. Open the Event-less queue (own organisation only).
2. See evidence paths (FOUND / NOT FOUND / CONFLICTING).
3. Decide Assign, Quarantine, Defer, Reject, or Rollback.
4. Write `Workpack.event_id` only inside an audited transaction after explicit confirmation.

No Project→Event path exists. Child Activities are never rewritten. M8.13 / M10 / M11 / M12 / R0.1 were not redesigned.

---

## 2. R0.4-D Scope

**In scope:** review queue, detail workspace, evidence engine, conflict approval, quarantine disposition, atomic Event assignment, AuditLog, rollback, optimistic concurrency, tenant isolation, behavioural tests.

**Out of scope / not done:** automatic assignment of 177, Project retirement, S-curve, M16 URLs, Discipline/SAT, R1 time model, deleting test Workpacks, CPM trigger on assign.

---

## 3. Binding Decisions

R0.4 / R0.4-B / R0.4-C remain frozen. Event is the sole STO container. The 177 stay unresolved until a human decides. Dates, plant, unit, equipment, title, and UUID are not identity.

---

## 4. Pre-implementation Census

Independent read-only re-census before any write:

| Metric | R0.4-C | Pre-R0.4-D | Δ |
|---|---:|---:|---:|
| Workpack total | 195 | 195 | 0 |
| Event-linked | 18 | 18 | 0 |
| Event-less | 177 | 177 | 0 |
| Project-linked | 0 | 0 | 0 |
| Soft-deleted | 0 | 0 | 0 |

Named rows still Event-less: `cb290c59-…` (conflict), `7bec67b4-…` and `a87e5f8f-…` (insufficient). **Proceeded.**

---

## 5. Implementation Inventory (reused)

| Need | Reused |
|---|---|
| Workpack service / model | `Workpack` Prisma model; create path untouched |
| Event list / ownership | `EventPlanningService.list` (org + `deleted_at` null) |
| Permissions | `workpacks.view` / `edit` / `approve`, `events.view` — `src/lib/permissions.ts` |
| Tenant guard | `withTenantGuard` + `guardApi` |
| Audit | `AuditService` + `AuditLog` (append-only) |
| Activity identity | `ActivityCreationCommand` — not called on assign |
| Event context | Existing Event rows; no `EventContextResolver` change |
| Quarantine / review status | **None suitable** on Workpack — dedicated review table |

No second identity engine. No `WorkpackActivityIdentityService`. No `event_assignment_admin` permission.

---

## 6. Database Changes

**New table:** `workpack_identity_reviews`  
**Migration:** `prisma/migrations/20260909_r04d_workpack_identity_review/migration.sql`

| Column | Purpose |
|---|---|
| `organization_id` | Tenant index |
| `workpack_id` | Unique FK to Workpack (cascade) |
| `review_state` | UNREVIEWED / CANDIDATE (display) / APPLIED / REJECTED / QUARANTINED / DEFERRED |
| `classification` | Snapshot at decision |
| `confirmed_event_id` / `previous_event_id` | Assignment history |
| `reason` / `evidence` | Human text + path snapshot |
| `reviewer_id` / `approver_id` | Who decided |
| `conflict_accepted` | Conflict path only |
| `version` | Optimistic concurrency |

**Not changed:** `Workpack.status`, `Workpack.event_id` (no backfill), Project tables.

**Rollback:** `DROP TABLE "workpack_identity_reviews";`

---

## 7. API Changes

| Route | Auth | Behaviour |
|---|---|---|
| `GET /api/workpacks/identity-review` | `workpacks.view` + `events.view` | Event-less queue, session org |
| `GET /api/workpacks/[id]/identity-review` | same | Detail + org Events for picker |
| `POST /api/workpacks/[id]/identity-review/apply` | edit or approve + `events.view` | ASSIGN / QUARANTINE / DEFER / REJECT / ROLLBACK |

Cross-tenant Workpack or Event → generic **Workpack was not found** / **Event was not found** (404). `project_id` / `projectId` in the body → 400.

---

## 8. UI Changes

| Page | Purpose |
|---|---|
| `/workpacks/identity-review` | Queue with R0.4-C live priority (P0 conflict, P1 insufficient, P2 NON_STO) |
| `/workpacks/identity-review/[id]` | Identity, evidence paths, candidates, decisions |
| Nav | **Event Review** (requires `workpacks.view` + `events.view`) |

Business language: Turnaround / Event / Quarantine / Identity Conflict. UUIDs are not shown as labels. Event picker shows code and name.

Conflict Workpack: **Review Conflict** only — normal Assign hidden. NON_STO: **Quarantine Review**. Insufficient: Assign / Quarantine / Defer.

---

## 9. Security / Tenant Isolation / Permissions

- Queue and candidates filtered by `session.organization_id`.
- Event picker = `EventPlanningService.list(org)`.
- UUID is not authorization.
- Existing RBAC only.

| Action | Permission |
|---|---|
| View queue / detail | `workpacks.view` + `events.view` |
| Assign (non-conflict) | `workpacks.edit` + confirmation |
| Conflict assign | `workpacks.edit` + `workpacks.approve` + conflict flag |
| Quarantine / rollback | `workpacks.approve` |

---

## 10. Review State

Review state is **not** `Workpack.status`.

| State | How it appears |
|---|---|
| UNREVIEWED | Default when no review row |
| CANDIDATE | Display-only when DIRECT/STRONG/WEAK/AMBIGUOUS and still unreviewed |
| HUMAN_CONFIRMED | Explicit confirm checkbox on apply (write is APPLIED in the same authorised step) |
| APPLIED | Event written |
| REJECTED / QUARANTINED / DEFERRED | Disposition only; `event_id` unchanged |

---

## 11. Evidence Engine

`WorkpackIdentityEvidence.classifyEvidence` uses only:

Scope → ShutdownScope → Event; Instantiation → Event; Activity → Event; Baseline → Event; EventUnit; EventSystem; Asset → ScopeItem → Event.

**Not used:** Project, `project_id`, dates, plant-as-identity, unit-as-identity, title-as-Event, first Event, UUID similarity.

Empty paths are shown as NOT FOUND.

---

## 12. Candidate Display

Candidates list code, name, site, dates, status, sources, strength. Label is **Candidate**. Nothing is pre-selected as authoritative. Multiple children → CONFLICTING on the Activity path.

---

## 13. Conflict Workflow

`TEST-WP-PH2C-1788013251870` classifies CONFLICTING_CHILD_EVENT when children disagree.

- Normal Assign is blocked.
- Requires `confirm`, `conflict_resolution`, approver permission, reason, evidence.
- After assign, child mismatches are **reported**, not repaired (`CHILD_EVENT_MISMATCH` / `ACTIVITY_EVENT_STILL_MISSING`).

---

## 14. Insufficient / Quarantine Workflows

Insufficient: no candidate; Assign / Quarantine / Defer; Event not preselected.

NON_STO: Quarantine Review. No delete. No hide. `Workpack.status` unchanged.

Quarantine writes review_state `QUARANTINED` + AuditLog `decision: QUARANTINE`. Repeat with stale version → 409.

---

## 15. Event Assignment

Atomic transaction:

```
BEGIN
  validate tenant, Event (org + not deleted), Workpack, permission
  validate confirm === true
  validate version
  validate conflict approval when required
  validate current event_id
  reject Scope Event mismatch (no silent overwrite)
  Workpack.event_id = selected Event
  upsert review APPLIED
  AuditLog
COMMIT
```

Without `confirm: true`, `event_id` stays null (mandatory behavioural test).

Assignment does **not** call CPM, `enqueueRecalculate`, or M11. Recalculation remains the existing governed M11 path (today still Project-keyed enqueue — recorded leftover, not fixed here). **Deferred / queued by existing worker; not invoked by R0.4-D.**

No domain event is emitted before commit. No EventBus emit was added (assignment is not `WorkpackCreated`).

---

## 16. Audit / Rollback / Concurrency

Every assign, quarantine, defer, reject, and rollback appends `AuditLog` with `source: R0.4D_WORKPACK_IDENTITY_REVIEW`. Original rows are never edited.

Rollback creates `HUMAN_ROLLBACK` with `previous_event` / `restored_event`.

Stale `expected_version` or lost `updateMany` race → **409 REVIEW_STATE_CHANGED**.

---

## 17. Child Activity Handling

`Activity.update` is never called. R0.1 `createActivity` remains the Activity identity authority.

Mismatches returned on assign:

- `activity_event_still_missing`
- `execution_identity_exceptions` (Activity Event ≠ Workpack Event)

---

## 18. M11 / M8.13 / M12 Interaction

| Module | Change in R0.4-D | After a future human assign |
|---|---|---|
| M11 | None. `calculateEventSchedule` still loads `Activity.event_id` | Workpack Event does not by itself add Event-less Activities. Those are `ACTIVITY_EVENT_STILL_MISSING` |
| M8.13 | None | Same Event filter; null Activity Event stays excluded |
| M12 | None | Workpack Event now participates in EWS bind; Activity mismatches are `EXECUTION_IDENTITY_EXCEPTION` |

---

## 19. Project Isolation

No Project resolver, candidate, filter, or security. Request `project_id` / `projectId` is rejected. Tests prove Project cannot drive assignment.

---

## 20. Behavioural Tests

`src/core/workpack-identity-review/__tests__/r04d-workpack-identity-review.test.ts` — **15 / 15 passed**.

Covers: queue tenant isolation; classification display; zero-candidate; no confirm → null Event; confirm → TA-2027; cross-tenant Event/Workpack 404; Project rejected; conflict blocks; conflict + approval assigns without child rewrite; quarantine no delete; 409 stale; rollback new audit; transaction rollback on audit failure.

---

## 21. Regression Tests

| Suite | Result |
|---|---|
| R0.1 Activity identity | **15 / 15** |
| R0.3 Scope Change security | **24 / 24** |
| M11 cross-event safety | **14 / 14** |
| M12-R01 P0 | **42 / 42** |
| M8.13 progress calculation | **47 / 47** |
| M8.13 SAT loader | **1 / 1** |
| M10 full planning suite | **Not re-run** (large; no M10 files changed) |

---

## 22. Live Verification

Post-implementation read-only census:

| Metric | Value |
|---|---|
| Workpacks total | **195** |
| Event-linked | **18** (all pre-R0.4-D; no R0.4-D audit) |
| Event-less | **177** |
| Project-linked | **0** |
| Soft-deleted | **0** |
| `workpack_identity_reviews` | **0** |
| R0.4-D Event assignments | **0** |
| Quarantine dispositions | **0** |

No unexplained Event assignment. First human review has not been performed — expected.

Browser click-through of the new pages was **not** run in this environment. Queue/detail behaviour is proven at service/API contract level by tests.

---

## 23. Known Limitations

- `HUMAN_CONFIRMED` is the confirm checkbox on apply, not a separate persisted pause state.
- `CANDIDATE` is computed for the queue, not a stored row.
- M11 enqueue still requires `project_id` (R04-P1-001) — assignment does not fix CPM jobs.
- Control Tower S-curve / M16 Project URLs unchanged.
- Isolated test-org fixtures only appear if the reviewer is **that** tenant (correct isolation). SYORITY users see SYORITY Event-less rows (conflict + draft Phase 2C), not 173 other tenants.

---

## 24. Remaining Defects (recorded, not fixed)

| ID | Note |
|---|---|
| R04-P1-001 | CPM enqueue skips without `workpack.project_id` |
| R04-P1-002 | `resolveEventIdFromProject` still in codebase; unused by this workflow |
| R04-P1-004 | Control Tower S-curve still Project URL |
| R04-P1-005 | M16 `/projects/` navigation |

---

## 25. Acceptance Criteria

| Criterion | Met? |
|---|---|
| Review queue exists | Yes |
| Tenant isolation | Yes (tests) |
| Evidence visible | Yes |
| Candidates explainable / not assignment | Yes |
| Conflict requires special approval | Yes |
| Insufficient explicit disposition | Yes |
| NON_STO quarantine without delete | Yes |
| No automatic assignment | Yes — live 0 assigns; test without confirm |
| Transactional + audited + rollback + 409 | Yes |
| Children not silently modified | Yes |
| Existing authorities unchanged | Yes |
| Project not used | Yes |
| Behavioural + regression tests | Yes |
| No unrelated module changes | Yes |

---

## 26. Final Decision

R0.4-D DECISION

The controlled Workpack Event Review workflow is implemented.

Event assignment is human-confirmed and audited.

No Project→Event inference exists.

No automatic Event assignment exists.

Conflicting Event evidence requires explicit governed resolution.

NON-STO Workpacks are quarantined only through explicit human disposition.

Child Activity Event identity is not silently rewritten.

Event remains the sole STO operational container.

**R0.4-D STATUS: GREEN**

R0.4-D COMPLETE.

The next architectural work may proceed to the already identified Event-only consumer migration / retirement sequence.

Do not start R1 Time & Planning Propagation merely because R0.4-D is green. First verify that the Event-only identity boundary is actually clean enough for the next phase. The leftover Project enqueue, S-curve, and M16 URLs mean that boundary is **not** yet clean for R1.
