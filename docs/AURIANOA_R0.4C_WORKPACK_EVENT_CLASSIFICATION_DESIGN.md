# AURIANOA R0.4-C — 177 EVENT-LESS WORKPACKS
## Controlled Event Classification & Data Remediation Design

**Programme:** R0 identity / operational-container correction  
**Phase:** CLASSIFICATION AND REMEDIATION DESIGN ONLY — not implementation  
**Date:** 2026-09-09  
**Database:** local Postgres `syority`  
**Re-census:** 2026-09-09 07:44 UTC (session `BEGIN READ ONLY`; `SET default_transaction_read_only = on`; SELECT only; ROLLBACK)  
**Primary evidence:** this live re-census plus  
`docs/AURIANOA_R0.4_PROJECT_EVENT_CONSOLIDATION_FORENSIC_AUDIT.md`,  
`docs/AURIANOA_R0.4B_EVENT_AUTHORITY_DECISION.md`

**Governing principle:** ENTER ONCE / STORE ONCE / DERIVE ONCE / REUSE EVERYWHERE.

No Event was assigned. No row was updated. No schema, API, UI, or engine was changed.

---

## 1. Executive Summary

The 177 Event-less Workpacks are **not** 177 unattached Turnaround packages waiting for a Project→Event map. There are still **0** STO `Project` rows and **0** Workpacks with `project_id`.

Independent re-census matches R0.4 exactly: **195** Workpacks, **18** with Event, **177** without, **0** with Project, **0** soft-deleted Workpacks.

All eight implemented Event-identity paths were inspected. On Event-less Workpacks:

| Path | Schema | Live hits |
|---|---|---|
| `Workpack.scope_item_id` → `scope_items` → `shutdown_scopes` → Event | Exists | **0** |
| `scope_items.workpack_id` → `shutdown_scopes` → Event | Exists | **0** |
| `workpack_instantiations.event_id` → Event | Exists | **0** (`workpack_instantiations` = **0 rows**) |
| Child `Activity.event_id` | Exists | **1** Workpack |
| `Workpack.unit_id` → `event_units` → Event | Exists | **0** (`event_units` = **0 rows**) |
| `Workpack.system_id` → `event_systems` → Event | Exists | **0** (`event_systems` = **0 rows**) |
| `Workpack.asset_id` → `scope_items.asset_id` → Event | Exists | **0** (`scope_items` = **0 rows**) |
| Activity → `BaselineActivity` → `ScheduleBaseline.event_id` | Exists | **1** Workpack (same as the Activity hit) |

`shutdown_scopes` is also **0 rows**. The Scope→Event graph is empty on this database. DIRECT candidates cannot appear until Scope or Instantiation data exists.

**Exclusive classification of the 177 (sums to 177):**

| Class | Count | Meaning |
|---|---:|---|
| DIRECT | **0** | No Scope / Instantiation Event path |
| STRONG | **0** | No single-Event activity convergence |
| WEAK | **0** | No unique unit/system/asset-scope hint |
| AMBIGUOUS | **0** | No multi-Event weak hints |
| CONFLICTING_CHILD_EVENT | **1** | One issued test Workpack; children point at **three** Events |
| INSUFFICIENT | **2** | “Overhaul Exchanger A” — assets present, no Event graph |
| NON_STO | **174** | Isolated approval-fixture / test titles; no Event candidate |
| DUPLICATE (overlay) | **0** | No org+number / org+SAP / org+title+asset collision |

**Assigned this phase: 0.**

The 177 can be **safely classified**. They cannot be **safely given Event candidates** except for one conflicting test package. Trusted identity here means leaving 176 without an Event, not manufacturing 176 assignments.

---

## 2. Scope

**In scope**

- Independent live re-census of Workpacks / Events / Activities
- Forensic review record for every Event-less Workpack
- Trace of every real FK / governed path to Event
- Exclusive evidence classification
- Human review, security, audit, assignment transaction, rollback, and module impact **design**

**Out of scope / not done**

- Writing `Workpack.event_id`
- Creating review tables or UI
- Changing M8.13 / M10 / M11 / M12 / R0.1
- Deleting or renaming Project
- Starting R0.4-D implementation

---

## 3. R0.4 / R0.4-B Binding Decisions

These are frozen and were **not** reopened:

| ID | Decision |
|---|---|
| DEC-001 | Event is the sole STO operational campaign container |
| DEC-002 | STO `Project` is deprecated as a business authority |
| DEC-003 | No `project_id → event_id` automatic mapping |
| DEC-004 | Future STO Workpacks must have Event context |
| DEC-005 | The 177 are UNRESOLVED until controlled classification |
| DEC-006 | Activity Event derives from Workpack / R0.1 — command not redesigned |
| DEC-012 / 013 | DigitalPlantProject and P6/MS Project remain different objects |
| DEC-014 | UUIDs are not business inputs or authorization |
| DEC-015 | Project retirement is staged, not deletion |

Also frozen: dates, plant, unit, equipment, and title text are **not** identity.

---

## 4. Read-Only Compliance

| Action | Done? |
|---|---|
| Modify source code / schema / migrations | No |
| UPDATE / INSERT / DELETE / backfill | No |
| Assign any Event / change `Workpack.event_id` | No |
| Create classification tables or UI | No |
| Change APIs, navigation, or engines | No |
| Files created | **Only this document** |
| Temporary census artefact | `%TEMP%\r04c-live.json` (outside repo; not a product artefact) |

---

## 5. Live Database Re-Census

Connection: `.env` `DATABASE_URL` → `postgresql://postgres:***@localhost:5432/syority`. Transaction read-only.

| Object | Live | R0.4 §30 | Δ |
|---|---:|---:|---:|
| `"Workpack"` total | **195** | 195 | **0** |
| Workpack `deleted_at` null | **195** | — | — |
| Workpack soft-deleted | **0** | — | — |
| Workpack `event_id` set | **18** | 18 | **0** |
| Workpack `event_id` null | **177** | 177 | **0** |
| Workpack `project_id` set | **0** | 0 | **0** |
| Workpack neither Event nor Project | **177** | 177 | **0** |
| Event-less and active | **177** | — | — |
| Event-less and deleted | **0** | — | — |
| `events` total / active / deleted | **51 / 51 / 0** | 51 | **0** |
| `"Project"` rows | **0** | 0 | **0** |
| `"Activity"` total | **73** | 73 | **0** |
| Activity live / soft-deleted | **72 / 1** | — | — |
| Activity `event_id` set | **69** | 69 | **0** |
| Activity `event_id` null | **4** | 4 | **0** |
| Activity `project_id` column | **missing** | missing | same |
| `"ScheduleBaseline"` | **10** (Event 9 / Project 1) | same | **0** |

The 177-Workpack review population is **unchanged**. Every Event-less Workpack is active. Soft-deleted Workpacks are distinguished: there are none.

---

## 6. 177 Workpack Population

The 177 are **not** one tenant’s missing Event attachments.

| Organisation | Org UUIDs | Event-less WPs | Exclusive class |
|---|---:|---:|---|
| Test Org | 44 | 44 | NON_STO — title `Test Submit WP` / draft |
| Test Org 2 | 43 | 43 | NON_STO — title `Test Approve WP` / under_review |
| Test Org 3 | 43 | 43 | NON_STO — title `Test Reject WP` / under_review |
| Test Org 4 | 43 | 43 | NON_STO — title `Test Issue WP` / approved |
| M86_Test_Org_A | 1 | 2 | INSUFFICIENT — `Overhaul Exchanger A` / issued |
| SYORITY CORPORATION PVT LTD | 1 | 2 | CONFLICTING 1 + NON_STO 1 |
| **Total** | **175** | **177** | **177** |

**173** of the 177 are one Workpack per isolated test tenant (approval-workflow fixtures). That is why EventUnit / Scope / Instantiation joins are empty on this population: those tenants never received a campaign graph.

The **18** Event-linked Workpacks (already assigned, **not** in this review set) sit on other Events (including TA-EVM-2026, TA2027V, TA2027B, EVT-TEST-1, L-A). Candidate ≠ assigned. Those 18 are out of R0.4-C assignment scope.

---

## 7. Workpack Identity Evidence

Field fill on the **177** (not invented; null stays null):

| Evidence | Count | % of 177 | Use |
|---|---:|---:|---|
| `scope_item_id` | 0 | 0 | DIRECT path unused |
| Asset | 2 | 1.1 | Display / weak filter only |
| Unit | 0 | 0 | Filter only; table `event_units` empty |
| System | 0 | 0 | Filter only; table `event_systems` empty |
| Plant | 0 | 0 | Filter only |
| SAP work order | 0 | 0 | — |
| Template | 0 | 0 | — |
| Instantiation row | 0 | 0 | Table empty |
| Workpack documents | 0 | 0 | — |
| Live child Activities | 1 | 0.6 | Strong / conflict evidence |
| Soft-deleted | 0 | 0 | — |

Workpack columns inspected: id, number, code, title, `scope_of_work`, status, `work_type`, `job_type`, priority, planned dates, created/updated, creator, organisation, site, plant, unit, system, asset, discipline, contractor, equipment type, SAP refs, template, `scope_item_id`, `deleted_at`, `event_id`, `project_id`.

Related-object inspection: ScopeItem, ShutdownScope, Asset, Unit, System, Plant, EventUnit, EventSystem, WorkpackInstantiation, WorkpackDocument, Activities, ScheduleBaseline (via BaselineActivity). Permits / punch / constraints were queried where tables exist; they did not create an Event path.

**Not present — not invented:** area, client terminology, Project name/code (0 Project rows), source-file provenance on these 177.

---

## 8. Event Candidate Sources

| Source | Strength if unique + same org | Strength if many Events | Live on the 177 |
|---|---|---|---|
| `scope_item_id` → ShutdownScope.event_id | DIRECT | CONFLICTING | 0 |
| `scope_items.workpack_id` → ShutdownScope.event_id | DIRECT | CONFLICTING | 0 |
| Instantiation `event_id` (Event row exists, org match) | DIRECT | CONFLICTING | 0 |
| Child Activities all one `event_id` | STRONG | CONFLICTING_CHILD_EVENT | 1 WP, **3** Events |
| BaselineActivity → ScheduleBaseline.event_id | STRONG (with Activity) | CONFLICTING | 1 WP, **2** Events |
| EventUnit / EventSystem | WEAK | AMBIGUOUS | 0 (tables empty) |
| Asset in a ScopeItem of an Event | WEAK | AMBIGUOUS | 0 (`scope_items` empty) |
| Same site / plant | Filter only | Never a candidate | Not used as identity |
| Planned dates | Context only | Never a candidate | Not used as identity |
| Title / “TA” text | Contextual only | Never a candidate | Used only as NON_STO *hint* for test tokens |
| `project_id` | **Forbidden** | Forbidden | 0 rows |

No score such as “85% = assign” is authorised. Categories are deterministic. Any numeric score later may **prioritise the review queue only**.

---

## 9. Relationship Traceability

Implemented paths (code/schema). None were assumed beyond an actual FK or stored id.

```
A. Workpack.scope_item_id → scope_items.id → shutdown_scopes.event_id → events.id
   + events.organization_id = Workpack.organization_id

B. scope_items.workpack_id = Workpack.id → shutdown_scopes → events
   (reverse of A; both inspected)

C. workpack_instantiations.workpack_id = Workpack.id → event_id → events
   (column exists; Prisma @relation to Event is absent — still a stored id)

D. Activity.workpack_id = Workpack.id → Activity.event_id
   (denormalised; R0.1 writes this from Workpack/context — not a Workpack FK)

E. Workpack.unit_id → event_units.unit_id → events
   Workpack.system_id → event_systems.system_id → events
   (same organisation only)

F. Workpack.asset_id → scope_items.asset_id → shutdown_scopes → events
   (asset can appear in many TAs)

G. Activity → BaselineActivity → ScheduleBaseline.event_id

NOT a path:
  Project / project_id
  DigitalPlantProject
  first Event in the tenant
  date overlap
  plant name
  title contains "TA"
```

Asset has **no** `event_id`. ScheduleBaseline has **no** `workpack_id`. Those facts were not invented around.

---

## 10. Direct Evidence

**DIRECT** requires a stored Scope or Instantiation chain to exactly one Event, organisation match, and no conflicting governed Event.

Live: **0**.

Cause: `scope_items` = 0, `shutdown_scopes` = 0, `workpack_instantiations` = 0, and every Event-less Workpack has `scope_item_id` null.

R0.4-B still forbids silent assignment even if DIRECT were 177. DIRECT on a future database is **CANDIDATE → HUMAN CONFIRMED**, not a write.

---

## 11. Strong Indirect Evidence

**STRONG** requires no DIRECT path, but governed children (Activities and/or baselines) converging on **exactly one** Event, organisation match.

Live: **0**.

The only Workpack with child Event ids has **three** Activity Events (and two baseline Events). That is CONFLICTING, not STRONG.

---

## 12. Weak Evidence

**WEAK** = exactly one Event from EventUnit / EventSystem / asset-in-scope, and no DIRECT/STRONG path.

Live: **0**.

`event_units` and `event_systems` are empty. The two asset-linked Workpacks have no `scope_items` for those assets.

Weak evidence, if it appears later, is a hint only.

---

## 13. Ambiguity

**AMBIGUOUS** = two or more Events from weak sources only (for example the same unit in TA-2027 and TA-2028).

Live: **0**.

The one multi-Event case is **child Activity conflict**, classified CONFLICTING_CHILD_EVENT (stronger, exclusive).

---

## 14. Insufficient Data

**INSUFFICIENT** = no governed or weak Event candidate, and title/number is not a test/demo/seed token.

Live: **2** — both `M86_Test_Org_A`, status `issued`, no activities, no scope, no Event.

| id | Title | Asset tag | Site |
|---|---|---|---|
| `7bec67b4-e2bf-4cf7-92b1-6f0842b87e69` | Overhaul Exchanger A | E-101-A-5087 | Site A |
| `a87e5f8f-4fd4-4ef0-92ea-4527c7fbc9ca` | Overhaul Exchanger A | E-101-A-7528 | Site A |

Same title, **different** `asset_id` → not DUPLICATE. Organisation name contains “Test”; Workpack title does not. Exclusive class remains INSUFFICIENT so a human must choose Event, quarantine, or leave unresolved. **No Event is guessable from FKs.**

---

## 15. Non-STO / Obsolete Candidates

**NON_STO** = no Event candidate **and** title or number matches test/demo/seed/validation/dummy/obsolete/legacy/sample.

Live: **174**. Token actually seen: **test** only.

| Pattern | Count | Status | Notes |
|---|---:|---|---|
| `Test Submit WP` | 44 | draft | One WP per “Test Org” UUID |
| `Test Approve WP` | 43 | under_review | “Test Org 2” |
| `Test Reject WP` | 43 | under_review | “Test Org 3” |
| `Test Issue WP` | 43 | approved | “Test Org 4” |
| `Phase 2C Test WP` / `TEST-WP-PH2C` | 1 | draft | SYORITY; 0 activities |

These are **quarantine review candidates**, not auto-quarantine. R0.4-C does not delete or hide them.

The issued SYORITY `Phase 2C Test WP` (`TEST-WP-PH2C-1788013251870`) would have been NON_STO if it had no Event signal. It has conflicting child Events, so exclusive class is CONFLICTING.

---

## 16. Duplicate Candidates

Formal DUPLICATE overlay (same organisation **and** same workpack number, **or** same SAP, **or** same title+asset): **0 groups**.

Reported separately (not a class, not a merge):

| Observation | Action |
|---|---|
| 173 fixtures share four titles across **different org UUIDs** | Not duplicates — isolated tenants |
| Two `Overhaul Exchanger A` in one org, different assets | Title collision; keep both; human may relate them |
| Two SYORITY `Phase 2C Test WP` (draft `TEST-WP-PH2C` vs issued `TEST-WP-PH2C-1788013251870`) | Possible test clone; numbers differ; do not merge |

Do not delete or merge.

---

## 17. Conflicting Child Events

**1 Workpack.**

| Field | Value |
|---|---|
| id | `cb290c59-4bdd-45a5-a153-8bc8ecd43fd8` |
| number | `TEST-WP-PH2C-1788013251870` |
| title | Phase 2C Test WP |
| status | **issued** |
| org | SYORITY CORPORATION PVT LTD |
| site | Syority HQ |
| unit / system / asset / scope | null / absent |
| `Workpack.event_id` | **null** |
| live Activities | **11** (7 with `event_id`, 4 null) |

| Candidate Event code | Name | Sources |
|---|---|---|
| `74d4d272` | Scenario Test Event | Activity + baseline |
| `M89-DEMO` | M8.9 Production Scenario Event | Activity + baseline |
| `c602b2d6` | Scenario Test Event | Activity only |

Child Activities (summary): ACT-001/002/003 → `M89-DEMO`; four “Test Act 1” rows split across `74d4d272` and `c602b2d6`; TEST-ACT-1/2 and two further rows have **null** `event_id`.

**Rule:** never copy one child’s Event onto the Workpack. Classification = CONFLICTING_CHILD_EVENT. Human review only. After a future Workpack assignment, **do not auto-repair** the disagreeing Activities in this phase.

---

## 18. Candidate Event Matrix (examples)

Candidate ≠ assigned. `Workpack.event_id` remains null for all 177.

| Workpack | Candidate(s) | Evidence | Strength | Recommended status |
|---|---|---|---|---|
| `cb290c59-…` Phase 2C issued | TA-like test Events `74d4d272` / `M89-DEMO` / `c602b2d6` | 7 Activities + baselines; 3 Events | CONFLICTING | Human review — do not assign |
| `d695567a-…` Phase 2C draft | None | Test number/title; 0 children | NON_STO | Quarantine review |
| `7bec67b4-…` Overhaul Exchanger A | None | Asset E-101-A-5087; no scope graph | INSUFFICIENT | Human review |
| `a87e5f8f-…` Overhaul Exchanger A | None | Asset E-101-A-7528; no scope graph | INSUFFICIENT | Human review |
| 173 Test Submit/Approve/Reject/Issue WP | None | Isolated test orgs; no FKs | NON_STO | Batch quarantine review |

---

## 19. Human Review Model

One Workpack, one eventual decision:

| Decision | Meaning | Database write? |
|---|---|---|
| ASSIGN TO EVENT | Human selected exactly one same-tenant Event | Later authorised apply only |
| AMBIGUOUS — HUMAN REVIEW | Still more than one plausible Event, or conflict unresolved | No |
| QUARANTINE | Deliberately not attached to a live Event | No Event write |

There is no operational state “probably TA-2027”.

Change-control states (logical, not schema):

```
UNREVIEWED
   → CANDIDATE          (system hint; NO WRITE)
   → HUMAN CONFIRMED    (explicit select; PENDING APPLY)
   → APPLIED            (later phase writes Workpack.event_id + audit)
   → REJECTED           (candidate refused)
   → QUARANTINED        (not attached)
```

On **this** database the first human work is almost entirely QUARANTINE disposition (174) plus two INSUFFICIENT reviews plus one CONFLICTING review. There is **no** DIRECT/STRONG confirm queue.

---

## 20. Reviewer Evidence Screen (design only)

Do not implement.

**Left — Workpack identity**

- Number / code, title, scope of work, status, work type, job type
- Equipment tag/name, unit, system, plant, site, organisation
- Discipline, contractor, planned dates, created/updated, creator
- SAP refs, template, document filenames **if present**
- Soft-deleted flag (none today)

**Centre — Evidence (show empties; do not hide)**

- ScopeItem → ShutdownScope → Event (today: none)
- Instantiation Event (today: none)
- Child Activity Events (today: only the Phase 2C issued WP)
- Baseline Events
- Asset / EventUnit / EventSystem
- Conflicts listed explicitly

**Right — Candidate Events**

- Restricted to **session organisation** and Events the reviewer may view
- Code, name, site, planned start/end, status, matched units/systems
- **No pre-selected Event** as if authoritative
- If zero candidates: show “No governed Event candidate” — not a default Event

---

## 21. Candidate Explanation

Every listed Event must show why it appeared.

Example (the only live multi-candidate Workpack):

```
Candidate: M89-DEMO — M8.9 Production Scenario Event
  ✓ Same organisation
  ✓ 3 child Activities (ACT-001, ACT-002, ACT-003)
  ✓ 3 BaselineActivity rows
  ⚠ Workpack.event_id is null
  ⚠ Other children belong to 74d4d272 and c602b2d6
  ⚠ 4 children have no Event

Candidate: 74d4d272 — Scenario Test Event
  ✓ Same organisation
  ✓ 2 child Activities + baseline rows
  ⚠ Conflicts with M89-DEMO and c602b2d6

Candidate: c602b2d6 — Scenario Test Event
  ✓ Same organisation
  ✓ 2 child Activities
  ⚠ Conflicts with the other two Events
```

Never hide the warning lines.

---

## 22. Security Model

```
Authenticated Organisation
        ↓
Events the reviewer may view (events.view + org match)
        ↓
Workpacks in that organisation (workpacks.view + org match)
        ↓
Candidate generation inside that organisation only
        ↓
Permission for confirm / approve / quarantine
```

- UUID is not authorization.
- Do not list cross-tenant Event names, Workpacks, Assets, or Activities.
- Generic not-found if a UUID is not in the session org (R0.3 pattern).
- `project_id` is not a security boundary.
- `event_id` is not valid without organisation proof.

On this database, 173 fixtures live in **one-WP test tenants**. A reviewer in SYORITY must not see those tenants’ Workpacks or Events.

---

## 23. Permissions

No new authorization system. Reuse `src/lib/permissions.ts`.

| Review action | Existing permission | Typical roles |
|---|---|---|
| View 177 queue (own org) | `workpacks.view` + `events.view` | planner, lead_planner, scheduler, project_manager, tenant_administrator |
| Recommend a candidate (no write) | `workpacks.edit` | planner, scheduler, lead_planner, project_manager |
| Confirm Event (PENDING APPLY) | `workpacks.edit` + `events.view` | lead_planner, project_manager |
| Approve high-risk / CONFLICTING / AMBIGUOUS apply | `workpacks.approve` | lead_planner, tenant_administrator, project_manager, qa_qc_inspector |
| Quarantine NON_STO / obsolete | `workpacks.approve` | lead_planner, tenant_administrator |
| Apply write (later phase) | `workpacks.edit` + `workpacks.approve` + org/Event proof | lead_planner or tenant_administrator |

Contractor / viewer: view only if already allowed `workpacks.view`; they must not confirm assignment.

Platform roles do not become a second tenant bypass. Proxy / existing tenant shell remains.

---

## 24. Audit Model

Logical assignment audit (table **not** created):

| Field | Required |
|---|---|
| workpack_id | Yes |
| previous_event_id | Yes (null if none) |
| new_event_id | Yes (null if quarantine) |
| organization_id | Yes |
| reviewer_id | Yes |
| approver_id | Yes (may equal reviewer if policy allows, except CONFLICTING) |
| timestamp | Yes |
| reason | Yes |
| evidence (structured: paths, Event ids, category) | Yes |
| source | `HUMAN` / later `RULE` |
| decision | ASSIGN / REJECT / QUARANTINE |

If candidate generation is automated later:

| Field | Required |
|---|---|
| rule_id | Yes |
| rule_version | Yes |
| candidate_evidence | Yes |
| category (not a hidden %) | Yes |

Reuse existing `AuditLog` / `AuditService` patterns (`source` like `R0.3_SCOPE_CHANGE_SECURITY`, `R0.2_IDENTITY_BACKFILL`). Do not invent a second audit product.

---

## 25. Assignment Transaction Design

Do not implement. Future atomic apply:

```
BEGIN TRANSACTION

  Validate session organisation
  Validate Workpack.organization_id = session org
  Validate Workpack.deleted_at IS NULL
  Validate Event.organization_id = session org
  Validate Event.deleted_at IS NULL
  Validate reviewer permissions (view + edit + approve as required)
  Validate explicit human confirmation token (not a defaulted candidate)
  Validate evidence category still matches (optimistic lock)
  Validate no unresolved CONFLICTING_CHILD_EVENT
       unless approver recorded a conflict-acceptance reason
  Validate Workpack.event_id is still NULL (or still the reviewed previous)
  WRITE Workpack.event_id = confirmed Event
  WRITE audit record (previous, new, reason, evidence, who, when)
  (domain event only AFTER COMMIT)

COMMIT

On any failure: ROLLBACK. No partial Workpack write.
```

R0.4-C does not authorise this transaction to run.

---

## 26. Rollback Design

Incorrect assignment is reversed by a **new** audited write, not by deleting history.

| Field preserved | Meaning |
|---|---|
| previous_event_id | Value before the bad apply (often null here) |
| new_event_id | Value being undone |
| rollback_to_event_id | Restored value (null or prior Event) |
| reason / who / when | New audit row |

Do not UPDATE the original audit row. Append. Same transaction shape as assign, with `source = HUMAN_ROLLBACK`.

---

## 27. Post-Assignment Validation

After a future apply, **check** (do not silently repair):

| Check | Rule |
|---|---|
| Tenant | `Workpack.organization_id` = `Event.organization_id` |
| Workpack Event | `Workpack.event_id` = confirmed Event |
| Scope (if `scope_item_id` set) | ShutdownScope.event_id equals Workpack Event, or flag SCOPE_MISMATCH |
| Instantiation (if row exists) | Instantiation.event_id null or equals Workpack Event, or flag |
| Child Activities | Each live Activity.event_id is null, equals Workpack Event, or **CONFLICTING_CHILD_REMAINS** |
| M11 visibility | Activities with matching `event_id` now enter `calculateEventSchedule` |
| M8.13 visibility | Same Event filter as M11 |

Conflicting children stay visible as exceptions. R0.1 remains the only Activity identity writer if a later phase repairs them.

---

## 28. M11 Impact

Do not run CPM.

M11 loads Activities with `organization_id` + `event_id` (`ScheduleOrchestrationService.calculateEventSchedule`). It does **not** require `Workpack.event_id`.

| Population | Count | Visible to Event-scoped M11? |
|---|---:|---|
| Event-less Workpacks | 177 | Not as Event packages |
| Event-less WPs with 0 live Activities | 176 | Invisible |
| Event-less WPs with Activity.event_id set | 1 | **Partial / wrong** — 7 Activities split across 3 Events |
| Activities on Event-less WPs with null event_id | 4 | Invisible |
| Already Event-linked Workpacks | 18 | Package Event already set (out of this queue) |

Assigning an Event to the 176 empty packages would **not** by itself create schedulable Activities. Assigning an Event to the Phase 2C issued WP would **not** make M11 consistent until child Activity Events agree — and this phase forbids auto-propagating a child’s Event.

`enqueueRecalculate` still keys on `project_id` (R04-P1-001). That is an R0.4-D+ consumer defect, not solved by classifying the 177.

---

## 29. M12 Impact

Do not execute.

`ExecutionWriteService` loads Activity by org; Event bind is:

- if `options.eventId` and `Activity.event_id` set → must match
- if `options.eventId` and `Workpack.event_id` set → must match
- if `Workpack.event_id` is **null**, the Workpack check is skipped

| Population | M12 Event isolation |
|---|---|
| 176 Event-less WPs, 0 activities | No execution target |
| Phase 2C issued WP (`issued`) | **Can enter M12** today; Event isolation only as strong as each Activity.event_id |
| 4 children with null Activity.event_id | Event option does not bind them |
| 7 children with 3 different Events | Can execute under three Event contexts |

Missing Workpack Event is an isolation gap, not a second execution engine. Project is not an execution context (DEC-009).

---

## 30. M8.13 Impact

Do not calculate progress.

`ProgressAggregationService` queries `organization_id` + `event_id` + `deleted_at` null.

| Population | In Event progress? |
|---|---|
| 176 Event-less WPs / 0 activities | Excluded |
| 7 Activities with Event on the conflicting WP | **Included in three different Events** — fragmented, not one package |
| 4 Activities with null Event | Excluded |

Do not change M8.13 math.

---

## 31. M13 / M14 / M15 / M16 Impact

All four are Event-scoped in the modern stack (R0.4). Project leftover URLs are not used as authority (R0.4-B).

| Module | Event-less 176 (no activities) | Conflicting 1 WP (7 Activities / 3 Events) |
|---|---|---|
| M13 Control Tower | **Invisible** | **Incorrectly classified** — fragments under three Events; S-curve still Project-URL defective (R04-P1-004) |
| M14 Reporting | **Invisible** | Partial / split across Event filters |
| M15 Management | **Invisible** | Same Event split |
| M16 AI | **Invisible** unless user names a Workpack; Event resolver will not attach these packages | May surface Activities under the Event the user named, hiding the Workpack-level null |

No module change in R0.4-C.

---

## 32. Remediation Workflow

```
Census (this document)
  ↓
Candidate generation (paths A–G; no Project map; no date/plant/unit/title identity)
  ↓
Human review (queue by priority)
  ↓
Confirmation (explicit Event or Quarantine)
  ↓
Approval where required (CONFLICTING / AMBIGUOUS / cross-hint)
  ↓
Atomic assignment (later authorised phase only)
  ↓
Audit append
  ↓
Consistency validation (report exceptions)
  ↓
Event-scoped downstream verification (M11/M12/M8.13 visibility — no engine rewrite)
```

Forbidden: `UPDATE "Workpack" SET event_id = …` without the review + audit path.

On **this** database the expected first apply set is **empty**. The expected first human batch is quarantine disposition of fixtures.

---

## 33. Review Priority

Prompt default vs **this database** (change justified by evidence):

| Priority | Prompt default | Live population | This-DB order |
|---|---|---|---|
| P0 | Conflicting Event evidence | **1** | **Keep P0** — issued WP, M12-capable, 3 Events |
| P1 | Strong single Event candidate | **0** | Skip |
| P2 | Ambiguous multiple Events | **0** | Skip |
| P3 | Insufficient data | **2** | **Promote to P1** — only possible real STO packages |
| P4 | Obsolete / test / duplicate | **174** | **P2 batch** — quarantine review by title pattern + org, not 174 unique Event hunts |

Do not spend planner time inventing Events for `Test Submit WP`.

---

## 34. Data Quality Matrix

Exclusive classes. Counts **add to 177**.

| Category | Count | % of 177 | Examples | Action |
|---|---:|---:|---|---|
| Direct Event candidate | **0** | 0 | — | None to confirm |
| Strong convergence | **0** | 0 | — | None to confirm |
| Ambiguous (weak multi-Event) | **0** | 0 | — | — |
| Insufficient data | **2** | 1.1 | Overhaul Exchanger A ×2 (`7bec67b4-…`, `a87e5f8f-…`) | Human review — no FK Event |
| Non-STO candidate | **174** | 98.3 | Test Submit/Approve/Reject/Issue WP; draft Phase 2C | Quarantine **review** (not auto) |
| Duplicate candidate (overlay) | **0** | 0 | — | — |
| Conflicting child Event | **1** | 0.6 | `cb290c59-…` Phase 2C issued | Human review; no auto-assign |

`0+0+0+2+174+0+1 = 177`.

---

## 35. Event Candidate Distribution

Candidate ≠ assigned. Assigned Event on these 177 = **0**.

| Event code | Event name | Workpacks (candidate) | Direct | Strong | Weak | Ambiguous | Conflicting |
|---|---|---:|---:|---:|---:|---:|---:|
| `74d4d272` | Scenario Test Event | 1 | 0 | 0 | 0 | 0 | 1 |
| `M89-DEMO` | M8.9 Production Scenario Event | 1 | 0 | 0 | 0 | 0 | 1 |
| `c602b2d6` | Scenario Test Event | 1 | 0 | 0 | 0 | 0 | 1 |

No other Event is a candidate for an Event-less Workpack.

Already-assigned (the 18, **not** candidates): TA-EVM-2026, TA2027V, TA2027B, EVT-TEST-1, L-A and similar — listed only so they are not mistaken for this queue.

---

## 36. Logical Review Record

Logical design only — **no schema authorised**.

```
WorkpackReview
    workpackId
    currentEventId              // null for all 177
    candidateEvents[]           // { eventId, code, name, sources[], strength }
    evidence[]                  // path, orgMatch, siteMatch, detail
    classification              // DIRECT | STRONG | WEAK | AMBIGUOUS |
                                // INSUFFICIENT | NON_STO | CONFLICTING_CHILD_EVENT
    duplicateFlag               // overlay
    conflict                    // text / child Event ids
    reviewer
    decision                    // ASSIGN | REJECT | QUARANTINE | DEFER
    reason
    timestamp
```

---

## 37. Risks

| Risk | Fact | Mitigation |
|---|---|---|
| Treating 177 as “needs Event backfill” | 174 are test fixtures; 2 have no Event graph; 1 conflicts | Classification above; no blanket UPDATE |
| Empty Scope / EventUnit tables | DIRECT/WEAK paths cannot fire | Do not invent Scope just to assign Event |
| Title “Overhaul Exchanger A” looks operational | Org is `M86_Test_Org_A`; no Event | INSUFFICIENT, not auto-Event |
| Issued Phase 2C WP in M12 | `issued` + null Workpack Event | P0 human review; no child Event copy |
| M8.13/M11 fragment leak | 7 Activities / 3 Events | Report; do not pick a winner |
| Creating a scoring engine | Would hide conflict | Categories only |
| Project mapping temptation | 0 Project rows | DEC-003 remains |

---

## 38. Acceptance Criteria

| Criterion | Met? |
|---|---|
| Population independently re-censused | Yes — Δ vs R0.4 = 0 |
| Every Event-less Workpack exactly once | Yes — 177 exclusive classes |
| Soft-deleted distinguished | Yes — 0 |
| All real Event paths inspected | Yes — §8–9; empty tables reported |
| ScopeItem → ShutdownScope → Event inspected | Yes — 0 rows / 0 hits |
| WorkpackInstantiation inspected | Yes — 0 rows |
| Child Activity Event inspected | Yes — 1 WP, 3 Events |
| EventUnit / EventSystem inspected | Yes — 0 rows |
| Schedule / baseline inspected | Yes — same 1 WP |
| No invented relationships | Yes |
| Exactly one exclusive class each | Yes — §34 |
| No Event assigned / no data change | Yes |
| No Project→Event, date, plant, unit, UUID assignment | Yes |
| Same-tenant candidates; existing RBAC | Yes — §22–23 |
| Human review, audit, rollback, atomic apply, post-check designed | Yes — not implemented |

---

## 39. Governing Question

> Can the 177 Event-less Workpacks be safely classified into Event candidates using existing authoritative relationships without inventing identity or silently assigning data?

## **PARTIALLY**

**Why not YES.** Authoritative relationships do **not** produce a single Event candidate for 176 of 177 Workpacks. Scope, Instantiation, EventUnit, and EventSystem have **no live rows**. The remaining Workpack has **three** child Events. There is no safe Event-assignment set on this database.

**Why not NO.** The population was independently verified. Every Event-less Workpack has an exclusive evidence class. The one Event-bearing Workpack is correctly CONFLICTING. Nothing was assigned. No Project map, date map, plant map, or first-Event guess was used.

A correct result is: **we cannot safely determine the Event for 176 of 177 Workpacks, and we must not invent one.**

---

## 40. R0.4-C Decision

R0.4-C DECISION

The 177 Event-less Workpacks have been classified
for controlled human Event review.

No Event assignment has been performed.

No Project→Event inference is permitted.

No automatic Event assignment is authorised.

Only explicit human-confirmed Event assignment,
through a later authorised implementation phase,
may write Workpack.event_id.

**R0.4-C STATUS: GREEN — CLASSIFICATION DESIGN COMPLETE**

R0.4-D may design the implementation of the controlled human review and assignment workflow.

R0.4-D must not treat “implementation” as a backfill of 177 Events. On live `syority` the first workflow is:

1. P0 conflict review of `cb290c59-…` (no auto-pick among three Events).
2. P1 human Event-or-quarantine for the two `Overhaul Exchanger A` rows.
3. P2 batch quarantine review of 174 test fixtures.

No implementation is started by this document.

---

## 41. Next Phase

**Not started.** If requested: R0.4-D — design (still not a silent write) of the review queue, confirmation, approval, atomic apply, and audit — using this classification, existing permissions, and existing Event/Workpack authorities.

Do not start R0.5, Discipline/SAT creation, Project deletion, or a second identity engine.
