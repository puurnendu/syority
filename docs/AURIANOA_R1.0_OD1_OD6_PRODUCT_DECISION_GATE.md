# AURIANOA R1.0-C — OD1 + OD6 PRODUCT DECISION GATE

**Phase:** R1.0-C — product/architecture decision gate closing the two AMBER items from D8/D10
**Date:** 2026-09-10
**Mode:** READ-ONLY INSPECTION + PRODUCT DECISION. No code, schema, migration, test, seed or database write.
**Decides:** OD1 (Workpack "Execution Calendar") · OD6 (governed constraint / override policy)
**Predecessor:** `docs/AURIANOA_R1.0_D8_D9_D10_TIME_SEMANTIC_DECISION.md` (read completely)

---

## 1. Executive Summary

> # 🟢 GREEN — OD1 AND OD6 BOTH CLOSE. C1 IS FREEZABLE. C2 REMAINS BLOCKED ON OD9.

| Item | Verdict | One-sentence decision |
|---|---|---|
| **OD1** | 🟢 **GREEN** | The Workpack "Execution Calendar" is **not** a separately authored business fact; `Workpack.planned_start_date` / `planned_end_date` are retired in favour of a derived read-only schedule span, and the authored campaign window remains `Event.planned_start` / `planned_end`. |
| **OD6** | 🟢 **GREEN** | A planner-imposed date is stored **only** as an explicit, audited constraint that M11 consumes as input (Pattern 1); direct mutation of a calculated date is prohibited, and the **three** production services that do it today are re-pointed at the constraint carrier. |
| **D8** | 🟢 **GREEN** | Span derived (previously settled) + OD1 now closed. |
| **D9** | 🟢 **GREEN** | Unchanged and **not reopened**. Nothing found contradicts it; §17 shows it *forces* the calendar answer. |
| **D10** | 🟢 **GREEN** | Constraint model settled, type set reduced to **two** on evidence, override policy = OD6. |
| **C1** | ✅ **FREEZABLE** | All nine §20 conditions met (§28). |
| **C2** | ⛔ **BLOCKED** | On **OD9** + B1–B3. Not on any semantic question (§24). |

### Why OD1 moved from AMBER to GREEN — new evidence, not a change of mind

The previous gate left OD1 open because the only evidence found was **a label** ("Execution
Calendar") and **an 8% score weight**, which together looked like somebody deliberately modelling
a distinct planning deliverable. Reading the actual check logic and the product's own commitment
mechanism reverses that reading. Two findings are new to this task and both are decisive:

1. **In M10 the "Execution Calendar" check gates nothing.** `PlanningReadinessService.ts:487-497`
   derives `planningState` from `mandatoryChecks` (`activities`, `durations`, `logic`, `scope`)
   and `planningPrereqKeys` (those four plus `resources`, `materials`, `constraints`). The
   `calendar` check is **in neither list**. It is a displayed checklist row with **no effect on
   READY / SCHEDULED / BASELINED**. [SOURCE]
2. **The product's own commitment mechanism excludes Workpack dates entirely.**
   `ScheduleBaselineService.createBaseline` freezes **Activity** `planned_start`/`planned_end` plus
   the **Event** window as `project_start` / `project_finish` (`:121-122`, `:150-151`). It does not
   snapshot Workpack dates in any form. **If the Execution Calendar were a commitment, the baseline
   would freeze it. It does not.** [SOURCE]

### The seven findings that matter most

1. **OD1 is answered by six independent evidence strands that all point the same way** (§9.1).
   Never authored (0/199), gates nothing in M10, is a *completeness checkbox* of identical shape
   to eleven sibling checks where it does have weight, its only population affordance **copies the
   derived span into it**, the baseline mechanism excludes it, and **no commitment vocabulary
   exists at workpack scope anywhere in schema, code or UI** — while the same product models
   "required by" readily at issue, punch, incident, constraint, material-line and event-milestone
   scope (§9.1a). The absence is a choice pattern, not an oversight.
2. **OD6 needs no new governance machinery — the product already has three of them, and all three
   use the wrong pattern.** `ResourceLevelingApplyService.ts:118-124`,
   `ScheduleChangeControlService.ts:271-279` and `ScopeChangeApplicationService.ts:182-183,
   199-200` all **write `Activity.planned_start` / `planned_end` directly**, two of them behind a
   mandatory approval gate and with full `AuditLog` before/after snapshots. Pattern 2 is not
   hypothetical here; it is shipped three times, tested and audited (§13.1).
3. **And Pattern 2 is already silently broken in production.** Resource leveling writes
   `planned_start` for a non-critical activity, then recalculates CPM — but CPM only reads
   `planned_start` for activities **with no predecessor** (`scheduleEngine.ts:251-262`). For any
   levelled activity that *has* a predecessor, the leveling delay is written to `planned_start`
   and then **completely ignored** by `early_start`. The UI reads one, CPM computes the other, and
   they diverge with no warning (§13.2). **This is the concrete cost of Pattern 2, observed in
   live code, not argued from principle.**
4. **`MaterialScheduleIntegrationService` never touches the database** — correcting the previous
   gate's characterisation. It is a pure in-memory transform of `ScheduleActivityInput[]` before
   `calculateSchedule()` (`:78-138`). It is therefore **not** a second *writer*; it is an
   unaudited, invisible **constraint injection**, and it works only because `planned_start` is
   currently the implicit SNET seed (§13.4). That makes it the closest thing in the codebase to a
   correct Pattern-1 mechanism — built against the wrong carrier.
5. **D9's frozen `× 1440` rule forces the calendar answer.** Lag *must* be wall-clock elapsed
   time, because making it working-time would invalidate the `lag_minutes = lag_days × 1440`
   migration rule that D9 already closed GREEN. The calendar question is therefore **derived, not
   chosen** (§17.2).
6. **The governed path has no UI; the ungoverned one has a button.** `promoteScenario` does the
   structurally correct thing — it emits a `ScheduleChangeRequest` rather than writing dates
   (§13.5a) — but the change-request UI is **read-only with no approve or apply controls**, so
   approval is API-only. Meanwhile `ResourceLevelingApplyService` ships an "Approve & Apply
   Scenario" button that bypasses change control entirely. **OD6 therefore cannot be settled by
   observing what users currently do**, because the correct path is the one they cannot reach.
7. **A complete working-day scheduler exists and nothing calls it.**
   `SchedulingService.calculateProjectSchedule` is the sole consumer of
   `CalendarEngine.addWorkingDays` and `hoursToDays`, and it has **zero callers of its own**
   (§13.6), while the live CPM path uses flat 24-hour arithmetic. That raises the
   built-and-unwired count to **five** — one of them an entire scheduling service — and it means
   the working-day logic C4 needs already exists and is already correct.

### Two date fabrications found (recorded, not fixed)

`ScheduleBaselineService.ts:150-151` writes `act.planned_start ?? new Date()` — **a baseline of
an unscheduled activity records "now" as its baseline date.** Combined with the MS Project export
`now()` fallback already recorded at D8 §3.3.2, that is two places where a missing date becomes a
fabricated one. Both are out of scope here and belong in the R1.0-C defect register.

---

## 2. Scope / Non-Scope

### In scope

Resolving OD1 and OD6 using repository evidence and explicit product semantics; specifying the
combined time-authority model, the enter-once propagation contract, C2's eventual required
changes, and the C1 freeze recommendation.

### Explicitly NOT in scope, and verified untouched

No application code, Prisma schema, migration, database row, seed, test or UI was modified.
Nothing discovered during this task was "fixed" (§22 verification). **D9 was not reopened** — no
evidence contradicting it was found, and §17.2 shows the D9 contract *constrains* this task's
calendar decision rather than the reverse.

### Numbering correction carried from the previous gate

The previous document used **OD6** for *"lift the freeze on `ActivityCreationCommand` and M11 for
C4/C5"* — a governance authorisation. This task's instruction assigns **OD6** to the
constraint/override **policy** question. To avoid silently losing the governance item, it is
renumbered here:

| Previous ID | Subject | ID in this document |
|---|---|---|
| OD6 | Constraint/override policy — *previously tracked as OD3 + OD4 + §12.3 O1–O3* | **OD6** (this task's meaning) — **CLOSED, §20** |
| OD6 | Freeze lift for `ActivityCreationCommand` + M11 | **OD10** — still open, governance only (§26) |
| OD9 | Re-declare three lost Prisma models | **OD9** — unchanged, still required (§24) |

---

## 3. Evidence Sources

### 3.1 Documents

| Document | Read | Contradicted by current code? |
|---|---|---|
| `docs/AURIANOA_R1.0_D8_D9_D10_TIME_SEMANTIC_DECISION.md` | Completely | **Yes, in two places** — §13.4 (material service does not persist) and §5.3 (the 8% criterion belongs to a different module than stated) |

Per §2 of the instruction, documentation was not preferred over source. Two of this task's
findings correct the predecessor document, which was itself authored by this program — the same
standard applies to it as to any other audit artefact.

### 3.2 Source inspected directly and completely

`src/core/workpack-intelligence/ReadinessScoreService.ts` ·
`src/core/materials/MaterialScheduleIntegrationService.ts` ·
`src/core/resources/ResourceLevelingApplyService.ts` ·
`src/core/resources/ScheduleChangeControlService.ts` ·
`src/core/resources/ScheduleBaselineService.ts` (create path) ·
`src/core/planning/PlanningReadinessService.ts` (checks + state derivation) ·
`src/core/planning/EventPlanningService.ts` (window authorship) ·
`app/api/workpacks/[id]/activities/date-range/route.ts` ·
`src/components/Workpack/WorkpackTabs.tsx` (sync path)

Carried forward as already-established source evidence from the predecessor gate:
`src/lib/scheduleEngine.ts` (complete), `src/core/schedule/ScheduleOrchestrationService.ts`,
`prisma/schema.prisma`, the fourteen Workpack planned-date entry points, and the twenty-mechanism
constraint inventory.

### 3.3 Evidence classification used throughout

Per §21 of the instruction, every load-bearing claim carries one of:

| Tag | Meaning |
|---|---|
| **[EXECUTED]** | Proven by executed behavioural evidence (this task inherits, and does not repeat, the predecessor gate's executed probes) |
| **[SOURCE]** | Proven by reading current source or schema |
| **[INFERENCE]** | Strong inference from converging evidence — explicitly *not* called proven |
| **[PRODUCT]** | A product decision made in this document, with its basis stated |
| **[OPEN]** | Not decided here |

No inference is described as proven anywhere in this document.

---

## 4. OD1 Question

> **Is Workpack "Execution Calendar" a genuine separately authored business artefact, or was it
> only a workaround for the absence of a derived schedule span?**

The previous gate established **five** live semantics on `Workpack.planned_start_date` /
`planned_end_date`: human work-order intent, contractual deadline, Gantt span bounds, the named
"Execution Calendar" readiness artefact, and the destination of a manual "Sync" copy.

The question is *not* which of those is architecturally cleanest. It is whether the business has
a fact — "the window in which this workpack is required to be executed" — that is **authored by a
person and knowable independently of the activity schedule.** If yes, it needs its own field. If
no, the columns are a defect.

---

## 5. OD1 Business Concepts

Five candidate concepts, each answered against the fourteen required questions. Where a row says
"does not exist", that is a proven absence, not an omission.

### 5.1 Concept A — Activity schedule span (the workpack's roll-up)

| Question | Answer |
|---|---|
| Real business fact? | **Yes** — "when is this workpack's work scheduled to run" |
| Author | **Nobody.** It is a consequence of activity dates |
| First known | Only after activities exist **and** CPM has run |
| Can change after scheduling? | **Yes, constantly** — every activity move changes it |
| Derived or authored? | **Derived** — `MIN(planned_start)` / `MAX(planned_end)` |
| Owning entity | `Workpack` (as a derived attribute or a view) |
| Writer | **M11**, as part of the CPM persistence transaction |
| Read-only consumers | Gantt bounds, workpack list/header, planner grid, PDF/print, reports, M10 display |
| Conflict with CPM dates | **Impossible by construction** — it *is* the CPM dates |
| Affect readiness? | Yes — as *evidence that scheduling has happened* |
| Affect overdue/forecast? | Only as the "actual plan" side of a comparison |
| Affect CPM? | **No — never.** It is output |
| Affect reporting? | Yes, read-only |
| Affect MS Project export? | Yes — it is the correct source for a workpack-level summary bar |

### 5.2 Concept B — Workpack execution window (an authored per-workpack commitment)

| Question | Answer |
|---|---|
| Real business fact? | **NOT EVIDENCED.** See §9.1 — five independent strands say the product does not have this concept |
| Author | Would be a planner |
| First known | Would be at scope definition, before activities |
| Can change? | Would require change control |
| Derived or authored? | Would be authored |
| Owning entity | Would be `Workpack` |
| Writer | Would need a dedicated audited service |
| Everything else | **Moot** — the concept is not evidenced |

### 5.3 Concept C — Contractual / commitment deadline

| Question | Answer |
|---|---|
| Real business fact? | **Yes — but at Event scope, not Workpack scope.** A turnaround is contracted as a campaign window, and that window exists, is authored, and is populated |
| Author | Event planner / TA manager, via `EventPlanningService.createEvent` (`:116-117`) and `updateEvent` (`:173-178`) [SOURCE] |
| First known | At campaign definition — **before any workpack or activity exists** |
| Can change after scheduling? | Yes, and it is the one date whose change *should* invalidate the plan |
| Derived or authored? | **Authored** |
| Owning entity | **`Event`** — `planned_start` / `planned_end`, populated on **49 of 51** rows [EXECUTED] |
| Writer | `EventPlanningService` |
| Read-only consumers | M11 (as `project_start_date`), baseline metadata, M13/M14/M15, portfolio KPIs |
| Conflict with CPM dates | **This is the whole point** — plan finish beyond window finish must produce negative float. Unreachable today (§10.3 of the predecessor gate) |
| Affect readiness? | Yes, legitimately |
| Affect overdue/forecast? | **Yes — this is the correct basis for "overdue"** |
| Affect CPM? | **Yes, as a bounded input**: start → `project_start_date` (wired), finish → `target_finish_date` (**not wired**) |
| Affect reporting? | Yes |
| Affect MS Project export? | **Yes — this is the correct project `<StartDate>`/`<FinishDate>`**, replacing today's `now()` fallback |

### 5.4 Concept D — Event / TA shutdown window

**Same carrier as Concept C.** In this product the contractual commitment *is* the shutdown
window: one authored pair on `Event`, serving both the CPM datum and the commercial boundary.
Splitting them would create two authored windows on the same entity with no evidence that they
ever differ. **Not split.** [PRODUCT]

### 5.5 Concept E — Readiness evidence that the planner completed calendar planning

| Question | Answer |
|---|---|
| Real business fact? | **Yes, as a process fact** — "has the planning step been completed" is legitimate and the product measures many such facts |
| But is *this* the right test for it? | **No.** As implemented the test is `!!planned_start_date && !!planned_end_date` (`ReadinessScoreService.ts:65`) — it measures whether two fields were typed into, and those fields have no other consumer that treats them as authoritative. **It is circular** [SOURCE] |
| Correct replacement test | *"Do this workpack's activities have calculated schedule dates"* — which M10 **already computes independently** as the `schedule` / "Schedule Calculated" check (`PlanningReadinessService.ts:466-474`) |
| Consequence | The readiness *intent* survives; only its evidence source changes, from a typed field to a derived one |

### 5.6 The three meanings that must never be conflated

| Distinct fact | Carrier after this decision | Authority |
|---|---|---|
| **When the work is scheduled** | Activity `planned_start`/`planned_end`; Workpack **derived span** | **M11** (derived) |
| **When the work is required** | **`Event.planned_start` / `planned_end`** | **Event** (authored) |
| **Whether the planner finished the calendar planning step** | M10's existing `schedule` check, reading Activity `early_start` | **M10** (derived, read-only) |

Today all three are partly served by two never-populated Workpack columns. After this decision
each has exactly one carrier, one authority, and one writer.

---

## 6. OD1 Existing Implementation

### 6.1 Where the columns are actually consumed, and with what force

| Consumer | Location | Force |
|---|---|---|
| M10 `calendar` / "Execution Calendar" check | `PlanningReadinessService.ts:476-485` | **Display only** — see §6.2 |
| `execution_calendar` score criterion | `ReadinessScoreService.ts:17`, `:65` | **8 of 100 points** — the only functional consumer |
| Portfolio overdue KPI | `portfolio-stats/route.ts:196-217` | Real logic, **structurally cannot fire** (0/199) |
| Gantt bounds | `ActivitiesPanel.tsx:968-969`, `GanttChart.tsx:44-45` | Display |
| "Sync" button | `WorkpackTabs.tsx:183-193` | **Writes the derived span into them** |
| MS Project project window | `export/ms-project/route.ts:60-61, 151` | Real, with a `now()` fallback that always fires |
| Display/report surfaces | PDF, print, planner grid, list, Equipment 360, identity review | Display |

### 6.2 The M10 check gates nothing — [SOURCE]

```487:497:src/core/planning/PlanningReadinessService.ts
      // ── Derive planning state ─────────────────────────────────────────
      // Mandatory for READY: scope, activities, durations, logic
      const mandatoryChecks = checks.filter(c =>
        ['activities', 'durations', 'logic', 'scope'].includes(c.key)
      );
      const allMandatoryPassed = mandatoryChecks.every(c => c.passed);

      // Planning prerequisites: mandatory + resources + materials + constraints
      const planningPrereqKeys = ['scope', 'activities', 'durations', 'logic', 'resources', 'materials', 'constraints'];
      const planningPrereqs = checks.filter(c => planningPrereqKeys.includes(c.key));
      const allPrereqsPassed = planningPrereqs.every(c => c.passed);
```

`calendar` appears in **neither** list. `planningState` resolves to `BASELINED` (if a baseline
exists), `SCHEDULED` (if `hasScheduleDates && allMandatoryPassed`) or the prerequisite ladder — so
**a workpack reaches SCHEDULED with both Workpack dates NULL**, which is exactly what all 199 live
workpacks would do. The label "Execution Calendar" is doing far more rhetorical work than the code
behind it.

### 6.3 Where it *does* have weight, it is a completeness checkbox — [SOURCE]

The criterion lives in **`src/core/workpack-intelligence/`**, not in M10's `src/core/planning/`.
That matters: it is part of a generic 12-item planning-completeness score, not part of the
readiness authority.

```55:68:src/core/workpack-intelligence/ReadinessScoreService.ts
    const checks: Record<string, boolean> = {
      template_selected:    !!wp.template_id,
      activities_generated: wp.activities.length > 0,
      documents_attached:   wp.workpack_documents.length > 0,
      resources_assigned:   resourceCount > 0,
      materials_available:  wp.workpack_materials.length === 0 || wp.workpack_materials.some(m => m.status !== 'pending'),
      qa_package:           qaCount > 0 || wp.form_instances.length > 0,
      certificates:         wp.certificateInstances.length > 0,
      permits:              wp.form_instances.length > 0 || wp.certificateInstances.some(c => c),
      isolation_plan:       wp.blinds.length > 0,
      execution_calendar:   !!wp.planned_start_date && !!wp.planned_end_date,
      crew_assigned:        crewCount > 0,
      approval:             wp.approval_status === 'approved',
    };
```

Every one of the twelve is *"has this planning artefact been produced?"*. `execution_calendar` is
structurally identical to `template_selected` and `documents_attached` — a presence test. **It
asserts that filling in two fields is a planning deliverable; it does not assert that those fields
mean anything.** [SOURCE] That is the difference between a business fact and a checklist row, and
it is why the 8% weight is not evidence of a distinct business concept.

### 6.4 The commitment mechanism that already exists excludes them — [SOURCE]

`ScheduleBaselineService.createBaseline` is the product's mechanism for freezing a plan as a
commitment. It captures:

- **Event** window → `metadata.project_start` / `project_finish` (`:121-122`)
- **Activity** `planned_start` / `planned_end` → `BaselineActivity` (`:150-151`), plus every CPM
  field (`:154-160`)
- **Workpack dates: nothing.** No Workpack field is selected, snapshotted or referenced.

It also refuses to baseline an event with no activities (`:112-113`) — the commitment is defined
by activities, not by workpack-level windows. **A concept the product declines to baseline is not
a commitment in that product.** [INFERENCE — strong, from an intentional exclusion]

---

## 7. OD1 User Journeys

All six required journeys, traced against current code. "Overwritten" means a value a user
supplied is destroyed or contradicted by the system.

### Journey A — Planner creates Workpack → enters start/end → creates activities → schedules → CPM runs

| Stage | Today | After decision |
|---|---|---|
| User enters | Workpack start/end (`WorkpackCreateForm.tsx:83-84`) | **Nothing at workpack level** |
| System derives | Nothing | Nothing yet |
| Stored | Two `@db.Date` values | — |
| Then activities created | Activity `planned_start` typed separately | Planner sets duration + logic; optionally a **constraint** |
| CPM runs | Writes `early_*` only; workpack dates untouched | M11 writes Activity `planned_*` **and** the workpack derived span |
| **Overwritten** | **Nothing — and that is the defect.** The typed workpack window and the computed activity schedule coexist, unreconciled and never compared (the mismatch banner cannot fire, §3.2.1 of the predecessor gate) | Nothing is overwritten because nothing was authored |
| Downstream sees | A typed window and a separate activity schedule that may disagree by any amount | One span, always consistent |

**The defect this journey exposes:** the user is asked for a fact in step 1 that the system will
independently compute in step 5, and no reconciliation ever occurs.

### Journey B — Activities scheduled first, Workpack dates empty, readiness evaluated

| Stage | Today | After decision |
|---|---|---|
| User enters | Activities + logic only | Same |
| Stored | Workpack dates stay NULL — **this is the state of all 199 live workpacks** | — |
| M10 result | `planningState` = **SCHEDULED** (calendar check is not a gate, §6.2), but the checklist shows "Execution Calendar ✗ No planned start/end dates set" | Span present; the calendar row is replaced by schedule evidence, so the checklist matches reality |
| Score result | **Loses 8 points** for a workpack that is fully planned and scheduled | Scores on derived evidence |
| Downstream sees | A fully scheduled workpack flagged as incomplete | Consistent |

**This is the journey that decides OD1.** The product's normal, universal state — schedule
authored at activity level, workpack window blank — is penalised by 8 points and labelled
incomplete for failing to duplicate information the system already holds. That is the signature
of a redundant field, not a missing business input.

### Journey C — Activities move later; the workpack span changes

| Stage | Today | After decision |
|---|---|---|
| System derives | Nothing automatically. `date-range` endpoint recomputes **only when the tab is opened** | M11 recomputes the span in the same transaction as the CPM persist |
| Stored | Workpack dates unchanged — stale if previously synced | Span updated |
| **Overwritten** | Only if a user clicks **"Sync"** — a manual, one-shot copy | Automatic; no user action |
| Should remain independent | **Nothing.** A span cannot be independent of its members | — |
| Downstream sees | Stale window vs moved activities, with the mismatch banner unable to fire | Correct span |

### Journey D — Activity schedule finishes after a business-required execution window

| Stage | Today | After decision |
|---|---|---|
| Where is the requirement? | Only `Event.planned_end` — populated 49/51, and **never compared to anything** | Same carrier, now wired to `target_finish_date` |
| Detection | **Impossible.** `target_finish_date` has no caller, so `baseLateFinishOffset = maxProjectFinishOffset` and negative float is unreachable [EXECUTED, predecessor gate §10.3] | Negative float appears; the overrun is visible |
| Downstream sees | Nothing. 3 live activities already end after their event window with no flag | Float-based overrun signal |

**This journey proves Concept C is real and Concept B is not.** The business requirement that
matters is the campaign window; the product just fails to enforce it. Adding a *workpack* window
would not have detected this overrun either — it would have added a third unenforced date.

### Journey E — Execution Calendar exists but differs from the eventual CPM schedule

| Stage | Today |
|---|---|
| Stored | Two contradictory windows, both persisted |
| Which wins? | **Neither — and nothing decides.** M10 scores the typed one; the Gantt draws bounds from the typed one but bars from activity dates; MS Project exports the typed one as the project window and activity dates as tasks |
| User remedy | Click **"Sync"**, which resolves the conflict by **discarding the typed value** — the product's own answer to this journey is *"the derived value wins"* |
| Downstream sees | An export whose project window and task rows disagree |

**The existence and behaviour of the Sync button is the product's own verdict on Journey E.** When
the authored and derived values conflict, the shipped remedy overwrites the authored one. That is
not how a commitment behaves. [INFERENCE — strong, from a shipped UI affordance]

### Journey F — Empty workpack, no activities

| Stage | Today | After decision |
|---|---|---|
| Stored | Whatever a human typed, or NULL | **NULL span** |
| Scale | **182 of 199 workpacks (91%) have zero activities** [EXECUTED] | 91% would show NULL |
| Score | 8 points obtainable by typing two dates into a workpack with no work in it | Not obtainable — correctly, since nothing is scheduled |
| MS Project export | `now()` fabricated as the project window | Event window used |
| Downstream sees | A window implying work is planned when none exists | Honest absence |

**Journey F is the strongest argument against Concept B being useful even if it were real:** a
typed window on an empty workpack is unfalsifiable and earns readiness credit for nothing.

---

## 8. OD1 Options

| Criterion | **A — genuine authored fact** | **B — it is the derived span** | **C — separate both explicitly** | **D — move window ownership to another entity** |
|---|---|---|---|---|
| Semantic correctness | ❌ Asserts a fact with no evidence; keeps a name that means five things | ⚠️ Correct for the span; silently drops the commitment reading | ✅ Correct **if** both facts exist | ✅ Correct — and both facts *do* exist, at different scopes |
| Workflow usefulness | ❌ Re-entry of derivable data (Journey A) | ✅ Zero re-entry | ⚠️ Useful only if planners genuinely commit per workpack — unevidenced | ✅ Commitment authored once per campaign, span derived per workpack |
| Scheduling impact | ❌ A second authored window above activity level | ✅ None — output only | ⚠️ Two windows to reconcile | ✅ Event window becomes a real CPM bound (`target_finish_date`) |
| Readiness impact | ⚠️ Keeps a circular test | ⚠️ Loses the criterion unless re-pointed | ✅ Both testable | ✅ Criterion re-points to schedule evidence; **intent preserved, circularity removed** |
| Reporting impact | Unchanged | Span replaces typed values | Two columns to explain | ✅ Reports gain a working overdue basis |
| Migration impact | 0/199 → trivial either way | Trivial | One new authored column | ✅ Trivial: retire 2 columns, wire 1 existing field |
| UI impact | Keeps a form field users never fill | Remove field, remove Sync | Two fields, two labels | ✅ Remove workpack fields; Event window already has UI |
| **Risk of duplicate truth** | 🔴 **High — it is the current defect** | 🟢 None | 🟠 Medium — needs a hard comparison rule | 🟢 **None — different scopes, different authorities** |
| M10 / M11 / M13 / M14 / M15 / M16 compatibility | M10 keeps a meaningless check | M10 needs re-pointing | All modules must learn two concepts | ✅ M11 gains a bound; M10 re-points; M13–M16 already read Activity/Event dates only (proven absence of Workpack-date readers in EVM, Control Tower, report-builder, generic export) |

### Recommendation — OPTION D, with B as its span half

**Option D is the only one that keeps every real fact and removes every duplicate.** It is not a
compromise between A and B; it is the recognition that the two facts sit at **different scopes**:

- The **commitment** is a campaign-level fact. It already exists on `Event`, is already authored
  by a human, is already populated on 49/51 rows, and is already the CPM datum. It needs
  **wiring**, not modelling.
- The **span** is a workpack-level derived fact. It already has a MIN/MAX implementation and a UI
  affordance. It needs **promoting**, not inventing.
- The **process check** is a readiness fact. It already has a correct implementation in M10's
  `schedule` check. It needs **re-pointing**, not deleting.

Nothing in this recommendation requires a new business concept, and no capability is lost.

### Precise names — no reuse of ambiguous terms

| Fact | Name | Entity | Notes |
|---|---|---|---|
| Campaign commitment window | `Event.planned_start` / `Event.planned_end` | `Event` | **Existing names retained.** Unambiguous at Event scope — there is exactly one window per campaign |
| Workpack schedule span | `schedule_start` / `schedule_finish` | `Workpack` (derived) | **Deliberately NOT `planned_*`.** Displayed as "Schedule Start" / "Schedule Finish" |
| Activity calculated dates | `planned_start` / `planned_end` | `Activity` | Retained, but M11-owned (D4) |
| Planner-imposed bound | `constraint_type` / `constraint_date` | `Activity` | §14 |
| *(future, only if evidenced)* | ⚠️ **not** `required_by_date` — see below | `EventMilestone` preferred | **Must not reuse `planned_*_date`** |

⚠️ **Name-collision hazard.** `workpack_material_lines.required_by_date` already exists
(`schema:2832`) and is dead in application code (§9.1a). Introducing a second `required_by_date`
in the workpack domain would create exactly the kind of same-name/different-meaning ambiguity this
decision exists to remove. **If an intermediate dated commitment is ever required, use
`EventMilestone`** — a live, authored, health-scored mechanism (§9.1a) — rather than a new
workpack column. If a workpack column is genuinely unavoidable, it must be named distinctly (e.g.
`commitment_finish`) and the dead material-line field retired in the same migration.

`planned_start_date` / `planned_end_date` on `Workpack` are **retired outright** — not renamed,
not repurposed. Any future workpack-level commitment must arrive as a new, differently named,
audited field so that the five-semantic conflation cannot silently reassemble itself.

---

## 9. OD1 Decision

> # OD1 = 🟢 GREEN

**Decision:** The Workpack "Execution Calendar" is **not** a genuine separately authored business
artefact. `Workpack.planned_start_date` and `planned_end_date` are retired; the workpack schedule
span becomes a **derived, read-only** `MIN`/`MAX` rollup owned by M11; the authored commitment
window remains `Event.planned_start` / `planned_end` and is wired into CPM as `target_finish_date`;
and the `execution_calendar` readiness criterion is re-pointed at schedule evidence.

### 9.1 Evidence — six independent strands, all converging

| # | Strand | Class |
|---|---|---|
| 1 | **Never authored.** 0 of 199 workpacks populated; no seed sets them; `WorkpackService.ts:363` *deliberately omits* them when cloning | [EXECUTED] + [SOURCE] |
| 2 | **Gates nothing where it claims authority.** The M10 `calendar` check is absent from both `mandatoryChecks` and `planningPrereqKeys`, so `planningState` is independent of it (§6.2) | [SOURCE] |
| 3 | **A completeness checkbox where it has weight.** `execution_calendar: !!a && !!b` is structurally identical to eleven sibling presence tests in a generic 12-item score, in a different module from M10 (§6.3) | [SOURCE] |
| 4 | **Its only population affordance copies the derived value in.** The "Sync" button PATCHes `MIN`/`MAX` into the columns and reports *"Dates synced to activity schedule"* — the product's own conflict resolution discards the authored value (§7 Journey E) | [SOURCE] |
| 5 | **The commitment mechanism excludes it.** `ScheduleBaselineService` freezes Activity dates and the Event window; Workpack dates appear nowhere in the baseline (§6.4) | [SOURCE] |
| 6 | **No commitment vocabulary exists at workpack scope — anywhere.** An exhaustive identifier and UI-string search found **no** Workpack field or label named `required_by`, `due_date`, `deadline`, `commitment`, `contractual`, `sla`, `promise`, `target_finish`, `must_start`, `must_finish` or `need_by`, and **no UI form, screen or report exposes a workpack-level date under any label other than "Planned Start/End"** (or their abbreviations "Start"/"End"). The only non-planned labels near a workpack are *"Target Resolution Date"* (`ConstraintsTab.tsx:349` — a constraint register field) and *"Freeze Date"* (scope, not workpack) | [SOURCE — proven absence] |

Supporting: no actual-date counterpart exists (proven absence), so the pair cannot be
plan-versus-actual; the overdue KPI they feed **cannot fire**; and no reader exists in EVM,
Control Tower, report-builder or generic export.

### 9.1a Where the business *does* express "required by" — and it is never the workpack

The search that produced strand 6 did find a genuine commitment vocabulary, which makes its
absence at workpack scope more meaningful rather than less:

| Carrier | Field | Status |
|---|---|---|
| `EngineeringIssue` | `due_date`, imported from a column literally mapped as **"Required By"** (`IssueService.ts:84`; import map `:29`) | **Live** |
| `EngineeringIssue` | `target_ta` — free-text target turnaround, UI column *"Target TA"* | **Live** |
| `PunchListItem` | `target_close_date` (`schema:1239`) | Accepted by `PunchListService` |
| `SafetyIncident` | `action_due_date` (`schema:1335`) | Written via API, shown in reports |
| `ConstraintLog` | `target_resolution` (`schema:1918`) | **Live** — UI *"Target Resolution Date"* |
| `Constraint` | `target_resolution_date` (`schema:689`) | Written by `deferConstraint` |
| **`EventMilestone`** | `planned_date` — **a fully live dated-target mechanism with variance scoring** (`ScheduleHealthService.ts:262-265, 403-405`), 0 rows | **Live mechanism** |
| `workpack_material_lines` | **`required_by_date`** (`schema:2832`) — **zero references in `src/**`** | **DEAD** |

**Two conclusions.** First, this product models "required by" readily and repeatedly — at issue,
punch, incident, constraint, material-line and **event-milestone** scope. Its complete absence at
workpack scope is therefore a *choice pattern*, not an oversight. Second, if intermediate dated
commitments inside a campaign are ever needed, **`EventMilestone` is the existing carrier** — live,
authored, health-scored, and empty — which is a far better home than reviving two Workpack columns.

**This also corrects the predecessor gate**, which recorded milestones as "moot / 0 rows".
Zero rows, yes — but the mechanism is complete and its output feeds schedule-health scoring.

### 9.2 Counter-evidence, stated and addressed

| Counter-evidence | Why it does not survive |
|---|---|
| The deliberate label **"Execution Calendar"** | A label is an intent, not an implementation. The code behind it gates nothing (§6.2) |
| The **8% score weight** | Real, but it weights a *presence test*, not a business date (§6.3). Re-pointing it to schedule evidence preserves the intent and removes the circularity |
| The **portfolio overdue KPI** treats `planned_end_date` as a deadline | A genuine semantic on a column that is empty in every row. It is re-based on the Event window, which is populated and authored — the KPI becomes functional for the first time |
| MS Project export uses them as the project window | It falls back to `now()` in 199/199 cases, so today it exports a fabrication. Event window is strictly better |

### 9.3 What is deliberately *not* claimed

This decision does **not** claim that no business anywhere needs a workpack-level commitment date.
It claims that **this product has no evidence of one**: no populated data, no enforcing logic, no
baseline participation, no authoring workflow that survives contact with the Sync button. If the
business asserts the requirement later, §8 specifies that it arrives as a new `required_by_date`
with its own audit — **never by reviving `planned_*_date`.** That is a forward-looking note, not
an open decision, because nothing today depends on the answer. [PRODUCT]

---

## 10. OD1 Authority Map

| Fact | Authority | Input / Derived | Writer | Read-only consumers |
|---|---|---|---|---|
| Campaign commitment window | **Event** | **Input** (authored) | `EventPlanningService` only | M11 (`project_start_date` + `target_finish_date`), baseline metadata, portfolio KPIs, M13–M16, MS Project project window |
| Workpack schedule span | **M11** | **Derived** | M11, in the CPM persist transaction | Gantt bounds, workpack header/list, planner grid, PDF/print, M10 display, reports |
| Activity planned dates | **M11** | **Derived** | M11 only (after D4) | Everything downstream |
| Planner-imposed bound | **Planner** (authors), **M11** (consumes) | **Input** | Constraint service, audited | M11 only; UI shows it *beside* the derived date |
| Readiness "calendar planning done" | **M10** | **Derived** | M10 computes, stores nothing authoritative | Readiness UI, score |
| Actual dates | **M12** | Input (execution fact) | `ExecutionWriteService` only — **unchanged** | M8.13, M13–M15 |
| Progress | **M8.13** | Derived | M8.13 only — **unchanged** | All downstream |

**Zero facts have two writers.** That is the test OD1 had to pass.

---

## 11. OD1 Downstream Impact

| Module | Impact | Class |
|---|---|---|
| **M10** readiness | `calendar` check re-points to activity schedule evidence (or is merged into the existing `schedule` check). `planningState` logic **unchanged** — it never used these columns | MUST CHANGE (small) |
| **Workpack intelligence** score | `execution_calendar` criterion re-points to the derived span or to `activities_scheduled`. Weight (8) retained | MUST CHANGE |
| **M11** | Gains the span rollup in its persist transaction; gains `target_finish_date` from `Event.planned_end` | MUST CHANGE |
| **M12** | **No impact.** Actual-date authority untouched | MUST NOT CHANGE |
| **M13** Control Tower | **No impact** — proven absence of Workpack planned-date readers | MUST NOT CHANGE |
| **M14** reporting | `ShutdownProviders.ts:117,125` re-points to the derived span; report-builder unaffected (proven absence) | MAY CHANGE |
| **M15** intelligence | **No impact** — reads Activity dates | MUST NOT CHANGE |
| **M16** interaction | **No impact** | MUST NOT CHANGE |
| **Portfolio dashboard** | Overdue re-based on Event window vs derived span; "starting this week" re-based on span | MUST CHANGE |
| **MS Project export** | Project window ← Event window; **`now()` fallback removed** | MUST CHANGE |
| **UI** | Remove workpack date inputs from create form, header, planner grid allow-list; remove the Sync button and mismatch banner; relabel display to "Schedule Start/Finish" | MUST CHANGE |
| **Baseline** | **No impact** — already excludes these columns | MUST NOT CHANGE |
| **Migration** | Drop 2 columns, **0 of 199 populated** | Zero data risk |

---

## 12. OD6 Question

> **What is the governed planner override / constraint policy, such that a planner-imposed date
> never becomes a second planned-date authority?**

The predecessor gate established the problem: `Activity.planned_start` **is** an implicit
start-no-earlier-than constraint for the 80.6% of activities that have no predecessor
(`scheduleEngine.ts:251-262`), while simultaneously being CPM's output column. D4 makes M11 the
writer of that column. Unless input and output are separated first, CPM consumes its own output.

The future model must distinguish six things that are currently entangled: planner-authored
constraint, CPM-derived planned date, execution actual date, external availability constraint,
manual override, and shutdown/Event boundary.

---

## 13. OD6 Existing Mechanisms

### 13.1 Three production services already overwrite calculated dates — [SOURCE]

This is the central new finding for OD6. **Pattern 2 is not a hypothetical temptation in this
codebase; it is shipped three times, with audit.**

**(a) `ResourceLevelingApplyService` — writes dates, then recalculates CPM**

```118:124:src/core/resources/ResourceLevelingApplyService.ts
        await tx.activity.update({
          where: { id: rec.activity_id },
          data: {
            planned_start: new Date(rec.proposed_start),
            planned_end: new Date(rec.proposed_end),
          }
        });
```

Reachable at `app/api/events/[eventId]/schedule/level-resources/apply/route.ts:17`. It has
genuinely good governance: staleness/baseline-drift detection (`:70-84`), a refusal to delay
critical activities (`:86-88`), a full `AuditLog` entry with `old_values` / `new_values`, reason,
float before/after and `simulation_id` (`:127-152`), and it then delegates recalculation to
`ScheduleOrchestrationService.calculateEventSchedule` (`:162-166`) rather than persisting CPM
fields itself — an architecture asserted by tests at `tests/m11-v1-schedule-view.test.ts:842-1066`.
**No approval step.**

**(b) `ScheduleChangeControlService` — approval-gated, writes dates, does *not* recalculate**

```270:279:src/core/resources/ScheduleChangeControlService.ts
            const updateData: any = {};
            if (change.new_start !== undefined) updateData.planned_start = new Date(change.new_start);
            if (change.new_end !== undefined) updateData.planned_end = new Date(change.new_end);
            if (change.new_duration !== undefined) updateData.duration_hours = change.new_duration;

            if (Object.keys(updateData).length > 0) {
              await tx.activity.update({
                where: { id: change.activity_id },
                data: updateData,
              });
```

Full lifecycle `proposed → review → approved → applied`, plus `rejected` and `superseded` (`:17`);
change types `date_shift`, `duration_change`, `resource_reallocation`, `leveling_apply` (`:18`);
**approval mandatory** (`:216-218`); tenant + event ownership validation (`:234-257`);
before/after snapshots to `AuditLog` as `SCHEDULE_CHANGE_APPLIED` (`:315-330`); competing requests
auto-superseded (`:304-312`).

**(c) `ScopeChangeApplicationService` — approval-gated, writes dates on both create and modify**

Requires `status === 'approved'` (`:61-63`), then writes `planned_start` / `planned_end` via
`createActivity` for `new_activity` items (`:182-183`) and directly for `modify_activity` items
(`:199-200`, `:213-219`). Reachable via
`app/api/events/[eventId]/scope-changes/[id]/route.ts:64` (action `apply`) and
`ScopeChangeDashboard.tsx:543`. Lifecycle `draft → analyzing → proposed → approved → applying →
applied | rejected`. The proposal items carry their own dates
(`ScheduleScopeChangeItem.planned_start` / `planned_end`, `schema:5957-5958`).

**Three governance postures for the same act.** Two require approval, one does not. One
recalculates CPM afterwards, two do not. That inconsistency is itself part of what OD6 must
settle — and it is why the answer is a single carrier rather than a fourth governance mechanism.

### 13.1.1 A misleading comment that must not be trusted

`ScheduleChangeControlService.ts:10` declares *"Uses ResourceLevelingApplyService for actual
schedule mutations (when source is leveling)."* **This is false.** The file neither imports nor
calls that service; it performs its own `tx.activity.update` at `:277`. The two mechanisms are
independent, which is precisely why they diverged on approval and recalculation. Recorded because
a reader relying on that comment would conclude the governance is unified when it is not.

### 13.2 Pattern 2 is already silently broken — [SOURCE] + [EXECUTED]

Resource leveling exists to delay **non-critical** activities into their float. But CPM reads
`planned_start` **only** for activities with no predecessor (`scheduleEngine.ts:251-262`, executed
and measured in the predecessor gate: 58 of 72 activities predecessor-less, 14 with predecessors).

Therefore, for a levelled activity that **has** a predecessor:

1. Leveling writes the delayed date into `planned_start` ✅
2. `calculateEventSchedule` runs and computes `early_start` **purely from the predecessor** —
   ignoring the delay entirely ✅
3. `planned_start` (delayed) and `early_start` (not delayed) now disagree, permanently
4. The UI reads `planned_start`, so the user sees the delay; float and criticality are computed
   from `early_start`, so the engine does not
5. **No warning is raised.**

The levelling decision is simultaneously honoured in the display and discarded in the
calculation. **This is the concrete, in-production cost of overwriting a calculated date rather
than constraining its input** — and it is the single strongest piece of evidence for OD6's answer,
because it was found in shipped code rather than argued from architecture.

### 13.3 `ScheduleChangeRequest` is a reusable governance asset — [SOURCE]

`ScheduleChangeControlService` provides, already built and tenant-safe: a state machine, mandatory
approval, reviewer identity and notes, `simulation_data` for the proposed change set, impact
metrics (`activities_affected`, `float_consumed`, `project_finish_delta`,
`constraints_resolved`), before/after audit snapshots, and supersession of competing requests.

**OD6 should not build a second approval mechanism.** It should change what "applied" *writes*.

### 13.4 CORRECTION — `MaterialScheduleIntegrationService` never persists — [SOURCE]

The predecessor gate stated that wiring this service "would make material ETA a second writer of
`planned_start`". **That is wrong and is corrected here.** The service performs **no database
write of any kind**. It transforms CPM's in-memory input:

```106:109:src/core/materials/MaterialScheduleIntegrationService.ts
        return {
          ...act,
          planned_start: constraintDate.toISOString().slice(0, 10),
        };
```

`applyConstraints` returns a new `ScheduleActivityInput[]`; `integrateForEvent` (`:143`) composes
it with `loadBindingConstraints` and is called by nothing.

**This changes its classification, not its disposition.** It is the closest thing in the codebase
to a correct Pattern-1 mechanism — a constraint applied as CPM *input* — but it is built against
the wrong carrier (`planned_start`, which only works because that column is the implicit SNET
seed) and with no audit, no visibility and date-only truncation (`.slice(0, 10)`). Under the target
model it must inject `constraint_date`, or better, material ETAs must materialise as constraint
rows so they are visible and attributable (OD8).

### 13.5 Full mechanism inventory, classified A–G

Per §9 of the instruction. Nothing is called a constraint merely because it is named one.

| Mechanism | Location | Class | Basis |
|---|---|---|---|
| `Activity.planned_start` | `schema:25`; engine `:251-262` | **F — DUPLICATE/CONFLICTING** | Simultaneously CPM input (SNET seed, 45 activities) and CPM output. **The defect D4+D10 exist to fix** |
| `Activity.planned_end` | `schema:26`; engine `:420` | **B — DERIVED OUTPUT** | Passed to CPM, never used for scheduling, echoed back |
| `Event.planned_start` | `schema:2014`, 49/51 | **A — AUTHORITATIVE INPUT** | Authored (`EventPlanningService.ts:116`), consumed as `project_start_date` |
| `Event.planned_end` | `schema:2015`, 49/51 | **A — AUTHORITATIVE INPUT, unwired** | Authored; selected then discarded. Must become `target_finish_date` |
| `ActivityRelationship` type + lag | `schema:262-270`, 20 rows | **A — AUTHORITATIVE INPUT** | The only constraint CPM genuinely consumes |
| `ScenarioActivityOverride.planned_start/end/duration` | `schema:5847-5849` | **D — SCENARIO-ONLY** | Sandbox rows. **No direct scenario→Activity commit exists** (searched `promote`, `apply.*scenario`, `commit`, `merge`, `adopt`); the only route to the live plan is §13.5a |
| `ScenarioPlanningService.promoteScenario` | `:214-276`, esp. `:248-253` | **A — governance wrapper (correct shape)** | Builds `simulation_data.changes` and creates a `ScheduleChangeRequest` — **it does not touch `Activity`**. §13.5a |
| `ScopeChangeApplicationService` | `:182-183`, `:199-200`, `:213-219` | **F — DUPLICATE/CONFLICTING** | Third live Pattern-2 writer, approval-gated, **no CPM recalculation** (§13.1c) |
| `PlannerWorkspaceService.batchUpdate` | `:119-120` | **F — DUPLICATE/CONFLICTING (latent)** | API accepts `planned_start`/`planned_end`; **no UI caller** for `batch-update`. Reachable, unexercised |
| `SchedulingService.calculateProjectSchedule` | `:97`, `:167` | **E — DEAD SECOND CPM PATH** | The **only** caller of `CalendarEngine.addWorkingDays`, and itself has **zero callers**. A complete working-day-aware scheduler, unreachable (§13.6) |
| Legacy `ConstraintService` | `src/modules/Constraints/Services/ConstraintService.ts` | **E — LEGACY/DEAD** | No importers anywhere |
| `ScenarioActivityOverride.early_start_constraint` | `schema:5851` | **E — LEGACY/DEAD** | Identifier occurs **once** repository-wide — its own schema line |
| `MaterialScheduleIntegrationService` | `:78-158` | **C — EXTERNAL CONSTRAINT, dead** | Zero callers; in-memory only (§13.4) |
| `MaterialConstraint.constraint_date` | `schema:6011`, 0 rows | **C — EXTERNAL CONSTRAINT** | Computed from supply chain by `MaterialReadinessService` |
| `ResourceLevelingApplyService` | `:118-124` | **F — DUPLICATE/CONFLICTING** | Live Pattern-2 writer; effect discarded for activities with predecessors (§13.2) |
| `ScheduleChangeControlService` | `:271-279` | **F — DUPLICATE/CONFLICTING** | Live Pattern-2 writer, approval-gated, **no CPM recalculation** |
| `ScheduleChangeRequest` lifecycle | `:17`, `:200-336` | **A — governance wrapper (reusable)** | Keep the wrapper, change the payload (§13.3) |
| `override_start_date` | `ScheduleOrchestrationService:39,145` | **F — DUPLICATE/CONFLICTING** | Moves an entire event's datum, unaudited, no reason |
| `ScheduleCalendar.work_days` / `exceptions` | `schema:1429-1439`, **0 rows** | **A — AUTHORITATIVE INPUT, unwired** | Loaded then discarded; only `hours_per_day` reaches CPM |
| `CalendarEngine` | `src/lib/CalendarEngine.ts` | **A — correct, unwired** | Working-day logic exists; CPM never calls it |
| `ShiftDefinition` (6 rows) | DB only — **not in schema** | **A — AUTHORITATIVE INPUT, unreachable** | Real 2 × 12 h shifts; B7/OD9 |
| `ResourceCapacity` (30 rows) | DB only — **not in schema** | **C — EXTERNAL CONSTRAINT, unreachable** | B7/OD9 |
| `Constraint` register (1 row) | `schema:677-705` | **E — not a schedule constraint** | raise→own→resolve→close issue register; enum values are *causes of delay* |
| `ConstraintLog`, `project_constraints`, `constraint_attachments` | `schema:1904, 2402, 1893` | **E — LEGACY/DEAD** | 0 rows |
| `Activity.is_approved_for_scheduling` | `schema:38` | **E — readiness gate, no CPM read** | Set on approval; never consumed |
| `ShutdownScope.freeze_date` | `schema:3805` | **E — unenforced governance metadata** | Stored, editable, enforced nowhere |
| `Workpack.is_locked` | `schema:114-116`, 0 locked | **E — edit lock, not a date constraint** | — |
| `EventMilestone.planned_date` / `actual_date` | `schema:2062-2080`, **0 rows** | **A — AUTHORITATIVE INPUT (dated target), fully live mechanism** | **Corrects the predecessor gate's "moot" framing.** Written by `EventPlanningService.upsertMilestone:232-233, 248-249` and `milestones/route.ts:39`; UI form label *"Planned date"* (`EventMilestonesClient.tsx:130-136`); **read for variance scoring** by `ScheduleHealthService.ts:262-265, 403-405`. Zero rows, but the mechanism is complete. `actual_date` is API-writable with no UI writer |
| `Activity.window` (text) | `schema:24`, 0 of 72 | **E — LEGACY/DEAD** | Name-collision hazard; must not be repurposed |
| `BaselineActivity` snapshots | `ScheduleBaselineService:144-164` | **B — DERIVED OUTPUT (frozen copy)** | Records results; not an input. `?? new Date()` fabrication at `:150-151` |
| Client-computed planned dates | `ScheduleContainer.tsx:832-847`, `ActivityPlanningGrid.tsx:181-190` | **F — DUPLICATE/CONFLICTING** | Two divergent browser algorithms |

**Class G (undecided): none.** Every mechanism is classifiable on current evidence.

**Count of live Pattern-2 date writers: six** — `ResourceLevelingApplyService`,
`ScheduleChangeControlService`, **`ScopeChangeApplicationService`**, `override_start_date`, and two
browser algorithms, plus `PlannerWorkspaceService.batchUpdate` reachable but unexercised — on top
of the seven ordinary `Activity.planned_*` writers already inventoried in C0.

### 13.5a The one correct governance shape already in the codebase

`ScenarioPlanningService.promoteScenario` is the **only** mechanism in the system that does the
right thing structurally: it converts a proposed change set into a **governed request** rather
than writing dates.

```248:253:src/core/schedule/scenario/ScenarioPlanningService.ts
      const changes = scenario.activity_overrides.map((override: any) => ({
        activity_id: override.activity_id,
        new_start: override.planned_start,
        new_end: override.planned_end,
        new_duration: override.duration_hours !== null ? Number(override.duration_hours) : undefined,
      }));
```

It requires the scenario to be `ready` (`:229`) and emits a `ScheduleChangeRequest` in status
`proposed`. **This confirms §19's rejection of Option C from the opposite direction:**
`ScenarioActivityOverride` is not a candidate constraint model *because the codebase already
treats it correctly* — as a sandbox whose only route to the live plan is a change request. The
defect is not the scenario model; it is what the change request writes when applied.

**One incomplete wiring worth recording:** the change-request UI (`ChangeControlPanel`,
`ScheduleControlDashboard.tsx:626-685`) lists requests **read-only** — there are no approve or
apply controls. The approval path is therefore **API-only** today, while
`ResourceLevelingApplyService` has a full "Approve & Apply Scenario" button
(`LevelingPreviewModal.tsx:60-67`). **The governed path is the one users cannot reach, and the
ungoverned path is the one with a button.** That asymmetry is why OD6 must be settled by
architecture rather than by observing current usage.

### 13.6 A complete working-day scheduler exists and is unreachable — [SOURCE]

Method-level caller analysis of `CalendarEngine`:

| Method | Live caller |
|---|---|
| `getHoursPerDay` | ✅ `ScheduleOrchestrationService.ts:167, 185, 235`; `ScenarioCalculationService.ts:67-70` |
| `addWorkingDays` | ⚠️ **only** `SchedulingService.ts:167` |
| `hoursToDays` | ⚠️ **only** `SchedulingService.ts:97` |
| `isWorkingDay`, `subtractWorkingDays`, `workingDaysBetween` | ❌ **tests only** |

And `SchedulingService.calculateProjectSchedule` — the sole consumer of the working-day methods —
**has zero callers of its own.** So the product contains a second, calendar-aware scheduling path
that nothing invokes, while the live CPM path uses flat 24-hour arithmetic (`scheduleEngine.ts:96-99`).

**This raises the built-and-unwired count from four to five, and one of them is an entire
scheduling service.** It is also a direct warning for C4: the instruction *"do not create another
calendar engine"* is well founded, because the working-day logic C4 needs **already exists and is
already correct** — it simply was never connected to the engine that runs.

---

## 14. OD6 Constraint Taxonomy

Six categories, kept strictly distinct. Each row states which mechanism carries it after the
decision, so no two categories share a carrier.

| # | Category | Carrier (target) | Authored by | Consumed by |
|---|---|---|---|---|
| 1 | **Planner-authored constraint** | `Activity.constraint_type` + `constraint_date` (+ reason, author, timestamp) | Planner | **M11 only**, in the forward pass |
| 2 | **CPM-derived planned date** | `Activity.planned_start` / `planned_end` | **Nobody** — M11 writes it | All downstream, read-only |
| 3 | **Execution actual date** | `Activity.actual_start` / `actual_end` | Field execution | M8.13, M13–M15. **M12-owned, untouched** |
| 4 | **External availability constraint** | `MaterialConstraint`, `ResourceCapacity`, permits | Computed / external systems | Readiness gates today; CPM only if OD8 says so, and then **via category 1** |
| 5 | **Manual override** | **Does not exist. Prohibited.** A planner's date intent is category 1 | — | — |
| 6 | **Shutdown / Event boundary** | `Event.planned_start` / `planned_end` | Event planner | M11 as `project_start_date` + `target_finish_date` |

**Category 5 is deliberately empty.** That is the substance of OD6: there is no such thing as an
override of a calculated date. What users call an override is an input, and it belongs in
category 1 where it is visible, attributable and survives recalculation.

---

## 15. OD6 Product Semantics

### 15.1 `START_NO_EARLIER_THAN` — **RETAIN**

Lower bound. *"Activity cannot start before 10-Apr-2027 14:00."*

**Evidence [SOURCE]:** this is already the implemented behaviour, twice over. CPM treats
`planned_start` as exactly this for 45 activities (`scheduleEngine.ts:251-262`), and
`MaterialScheduleIntegrationService.applyConstraints` computes `max(planned_start,
constraint_date)` (`:93`) — a textbook SNET. Additionally `early_start_constraint` was declared
for this purpose. **Three independent expressions of one semantic. Retained.**

### 15.2 `FINISH_NO_LATER_THAN` — **RETAIN**

Upper bound. *"Activity must finish by 15-Apr-2027 18:00."*

**Evidence [SOURCE]:** the engine already accepts `target_finish_date` (`:36`, `:301-307`) with no
caller, and `Event.planned_end` is authored on 49/51 events with nothing consuming it. The
capability and the data both exist; only the wiring is missing. At activity scope this is the same
bound applied locally.

### 15.3 `MUST_START_ON` — **EXCLUDE** (reversing the predecessor gate's "flagged" status)

*"Activity must start exactly 12-Apr-2027 08:00."*

The instruction is explicit: *"Do NOT assume this is required unless evidence supports it."*
Evidence found: **none.** No column, no API, no UI, no data, and no test expresses a fixed-date
activity. The predecessor gate retained it on "domain plausibility", which is precisely the
reasoning the type-set rule forbids.

**Independently confirmed:** an exhaustive identifier search for `must_start`, `must_finish` and
`need_by` across `prisma/schema.prisma`, `src/**` and `app/**` returns **matches only in
documentation** — never in schema or code. [SOURCE — proven absence]

**Excluded.** A fixed date is expressible today as SNET + FNLT on the same instant, and adding the
type later is purely additive. This removes OD2 as an open decision rather than deferring it.
[PRODUCT]

### 15.4 `MUST_FINISH_ON` — **EXCLUDE**

Same rule, same absence of evidence, same additive escape hatch.

### 15.5 Shutdown window — **combination, and the combination matters**

| Role | Verdict | Basis |
|---|---|---|
| **Hard CPM boundary** | ❌ **No** | A hard bound would make an over-running plan *unrepresentable*, hiding the overrun. Wrong for a turnaround |
| **CPM backward-pass datum** | ✅ **Yes** | `Event.planned_end` → `target_finish_date`, so `late_*` is computed against the commitment and **negative float becomes reachable** |
| **Management KPI boundary** | ✅ Yes | The correct basis for "overdue", replacing the empty Workpack column |
| **Reporting boundary** | ✅ Yes | Already the baseline's `project_finish` |
| **Forecast boundary** | ✅ Yes | Forecast finish vs commitment finish is the headline turnaround metric |
| **Readiness boundary** | ⚠️ Indirectly | Via negative float, not as a separate check |

**The decisive distinction:** the window is a **datum for the backward pass**, not a clamp on the
forward pass. Today `baseLateFinishOffset = maxProjectFinishOffset`, so float is self-referential,
the critical path always has exactly zero float, and **an overrun is arithmetically invisible**
[EXECUTED, predecessor gate §10.3]. Supplying `target_finish_date` makes overrun visible as
negative float — the single highest-value wiring change in this program.

### 15.6 Material availability — **external constraint; not a CPM input in this phase**

| Question | Answer |
|---|---|
| Is material availability an external constraint? | **Yes** — category 4. Computed from supply-chain data, not authored by a planner |
| Should it influence CPM? | **Not decided here — OD8.** It is a real capability change: a supplier slipping would silently move the plan |
| Should it become a constraint object? | **If** OD8 says yes, then **only** by materialising a category-1 constraint row with `constraint_set_by = 'system:material'`, so it is visible and attributable |
| Should it merely be a readiness gate? | That is its current role, and it is a defensible endpoint |
| **Can it ever write `planned_start` directly?** | **NO. Absolutely not** — and note it does not do so today (§13.4). The in-memory injection must also stop, because an invisible input adjustment is no better than an invisible write |
| Sole writer of the final calculated date | **M11 / `ScheduleOrchestrationService`.** Unconditionally, under every branch of OD8 |

**`MaterialScheduleIntegrationService` must not be wired as it stands.** Not because it writes the
database — it does not — but because it silently substitutes CPM's input with no audit, no
visibility and date-only precision. Either it is rewritten to emit category-1 constraints, or it
is deleted. [PRODUCT]

---

## 16. OD6 Override Policy

### 16.1 The two patterns, decided

| | **PATTERN 1 — constraint stored separately, CPM respects it** | **PATTERN 2 — planner overwrites CPM output** |
|---|---|---|
| What is stored | An input, beside the result | A value on top of the result |
| Survives recalculation | ✅ Yes — it is re-consumed every run | ❌ Depends on whether CPM happens to read that column |
| Traceable | ✅ type, date, reason, author, timestamp | ⚠️ Only in an audit log, not in the schedule |
| Result stays visible | ✅ Both the ask and the outcome are shown | ❌ They are the same field; the computed value is destroyed |
| Conflict detectable | ✅ Constraint vs computed date → warning | ❌ Nothing to compare against |
| **In production here** | Only in-memory and unwired (§13.4) | **Twice, live** (§13.1) |
| **Observed failure** | — | **Levelling delays silently discarded for activities with predecessors (§13.2)** |

> ### PATTERN 1 IS THE ONLY ARCHITECTURALLY VALID OPTION. PATTERN 2 IS PROHIBITED.

This is not a preference. Pattern 2 is already producing a live, silent divergence between what
the planner sees and what the engine computes (§13.2), and under D4 — where M11 becomes the writer
of `planned_start` — every Pattern-2 write would additionally be **erased by the next
recalculation**. All three live Pattern-2 services must be re-pointed, not merely tolerated.

### 16.2 The policy, in full

Every question required by §11 of the instruction:

| Aspect | Policy | Basis |
|---|---|---|
| **Who can create** | Any principal with existing schedule-edit permission (planner role / `nav.schedule`). No new permission tier | Constraints *replace* an edit these users can already perform; adding a gate would reduce capability [PRODUCT] |
| **Is reason mandatory** | **Yes.** `constraint_reason` must be non-empty; enforced at the service boundary | Both existing mechanisms already capture a reason (`rec.reason`, `review_notes`), so this is continuity, not a new burden [SOURCE] |
| **Is approval required** | **No for a single constraint. Yes for bulk/scenario application** via the existing `ScheduleChangeRequest` flow | Evidence is split and the split is principled: a constraint is an **input**, and this product does not gate inputs — `duration_hours` needs no approval, and `ResourceLevelingApplyService` applies without one. Bulk changes already have an approval path (§13.3); it is retained for them [PRODUCT] |
| **Survives CPM recalculation** | **Yes, by construction.** It is re-read as input on every run | The definition of Pattern 1 |
| **Constraint or override?** | **Constraint.** Category 5 is empty (§14) | — |
| **Changes CPM input** | **Yes** — consumed in the forward pass | — |
| **Changes CPM output** | **Indirectly** — M11 computes a different date because of it. The planner never writes the output | — |
| **Stored separately from calculated dates** | **Yes** — distinct columns; `planned_*` remains M11-only | Non-negotiable; this is the whole decision |
| **Affects baseline** | **No.** Baselines snapshot *results*. A constraint may be recorded in baseline metadata for explanation, never as a baselined date | `ScheduleBaselineService` already snapshots results only [SOURCE] |
| **Is it audited** | **Yes** — `constraint_set_by` + `constraint_set_at` in-row, **plus** an `AuditLog` entry reusing the existing `old_values`/`new_values` shape | Reuses the shipped pattern from both Pattern-2 services [SOURCE] |
| **Can it be removed** | **Yes** — clearing `constraint_type` and `constraint_date`, with the removal audited like any other change | — |
| **Does removal trigger recalculation** | **Yes** — the same enqueue path as any schedule-affecting change (`enqueueEventScheduleRecalculate`) | Otherwise the schedule silently retains a bound that no longer exists |
| **Conflict with dependency logic** | The **dependency-driven date wins** and a warning is raised (`CONSTRAINT_NOT_SATISFIED`), in the engine's existing `warnings[]` channel alongside `NEGATIVE_FLOAT` | The engine already has this channel and precedent [SOURCE] |
| **Cardinality** | One constraint per activity (columns, not a child table) | Matches P6; a child table is a clean additive migration if multi-constraint demand appears |
| **Never permitted** | A UI that edits `planned_start` as the definition of an override; a second date column that CPM reads; an unaudited constraint; a constraint written by a background service without attribution | — |

### 16.3 What happens to the three live Pattern-2 services

| Service | Required change | Class |
|---|---|---|
| `ResourceLevelingApplyService` | `proposed_start` becomes a `START_NO_EARLIER_THAN` constraint with `reason = 'resource_leveling'`; then recalculate. **This also fixes the §13.2 divergence defect**, because the constraint is honoured for activities with predecessors, which the current write is not | MUST CHANGE |
| `ScheduleChangeControlService` | `applyChangeRequest` writes **constraints** for `new_start`/`new_end`, keeps writing `duration_hours` (a legitimate input), and **must additionally trigger CPM recalculation**, which it currently never does. Its false header comment (§13.1.1) must be corrected, and the missing approve/apply UI controls added so the governed path is reachable | MUST CHANGE |
| `ScopeChangeApplicationService` | Same treatment: `new_activity` and `modify_activity` items write **constraints** instead of `planned_*`, and the apply must trigger recalculation | MUST CHANGE |
| `PlannerWorkspaceService.batchUpdate` | Remove `planned_start`/`planned_end` from the accepted batch fields (`:119-120`) before any UI reaches it | MUST CHANGE |
| `override_start_date` | Retire, or bring under the same reason + audit rule. It moves an entire event's datum unaudited | MAY CHANGE (§26) |
| Browser-computed planned dates | Delete both client algorithms; dates come from M11 | MUST CHANGE |

**Note the retained asset:** `ScheduleChangeRequest`'s approval lifecycle, impact metrics and
supersession logic are kept intact. Only the payload written at "applied" changes. No new
governance mechanism is built. [PRODUCT]

### 16.4 Constraint expiry and soft constraints — decided by explicit exclusion

| Question | Decision | Basis |
|---|---|---|
| Do constraints expire? | **No.** A constraint persists until explicitly removed | No evidence of demand; a lifetime rule is a workflow policy that can be added additively. An auto-expiring bound that silently stops applying is a worse failure than one a planner must clear [PRODUCT] |
| Are soft constraints supported? | **No.** All constraints are hard: they move the date, or they raise `CONSTRAINT_NOT_SATISFIED` | A soft constraint is a distinct capability (a preference yielding to float optimisation) with no evidence of demand. **Exclusion is recorded as a decision, not an oversight** [PRODUCT] |

Both were open items (OD3, OD4) in the predecessor gate. They are **closed by conservative
exclusion** rather than deferred, because in both cases the excluded behaviour is strictly
additive later and the included behaviour is unambiguous now. That is what makes OD6 freezable.

---

## 17. OD6 Calendar Interaction

**Semantics only. Nothing implemented.**

### 17.1 Four concepts that must never merge

| Concept | Unit / type | Meaning | Consumed |
|---|---|---|---|
| **Activity duration** | hours of **work** | How much working effort/time the task occupies | Converted to elapsed time **through the calendar** |
| **Relationship lag** | **`lag_minutes`, signed — wall-clock** | A delay between two activities | Added as elapsed time, **not** calendar-adjusted (§17.2) |
| **Constraint date** | `timestamptz` | An absolute instant, a bound | Compared, never shifted |
| **Calendar availability** | working days + shift windows + exceptions | When work *may* occur | Shifts computed **starts** forward to the next working period |

### 17.2 Lag is WALL-CLOCK — and this is forced by D9, not chosen

D9 closed **GREEN** with the migration rule `lag_minutes = lag_days × 1440`, proven exact by
`hours_per_day` invariance [EXECUTED]. That rule is only correct if lag is elapsed wall-clock
time. **Declaring lag to be working-time would invalidate an already-frozen contract and reopen
D9.**

The domain agrees: turnaround lags are dominated by physical processes — cool-down, purge, cure,
pressure-test hold, permit waiting — which do not pause on Sunday. A 24-hour cure is 24 hours.

**Decision: lag is elapsed wall-clock minutes.** [PRODUCT, constrained by D9]

### 17.3 The required worked example

> A finishes **Friday 18:00**. B is FS + **120 minutes**. Saturday is non-working; Monday is
> working.

| Step | Operation | Result |
|---|---|---|
| 1 | Predecessor finish | Friday 18:00 |
| 2 | **Apply lag as wall-clock** | Friday 18:00 + 120 min = **Friday 20:00** |
| 3 | **Apply calendar availability to the start** | Friday 20:00 is outside the working window → advance to the next working period start. Saturday non-working → **Monday, shift start** |
| 4 | Apply constraint, if any | `B.start = max(Monday shift start, constraint_date)` |
| 5 | Apply duration through the calendar | Finish = Monday start + duration consumed across working periods only |

**The order is normative and must not be rearranged:** dependency → lag (wall-clock) → calendar
snap → constraint → duration (working time). Applying the calendar before the lag, or the
constraint before the calendar snap, produces different dates.

**One honest caveat, unchanged from the predecessor gate:** step 3 depends on **C4**.
`ScheduleCalendar` has **0 rows**, the real 2 × 12 h shifts live in `ShiftDefinition`, and that
table is currently **unreachable from application code** (B7/OD9). Until C4 and OD9 land, step 3
cannot execute. This decision makes the semantics explicit; it does not make them operational.

---

## 18. OD6 Negative Lag Policy

**Decision: OPTION C — negative lag is permitted, subject to an explicit policy.**

| Element | Rule |
|---|---|
| **Storage** | `lag_minutes INTEGER` **signed**. Negative permitted. Unchanged from D9 |
| **Meaning** | A lead/overlap: `FS − 480` means B may start 8 hours before A finishes |
| **Why permitted** | Overlap is standard, legitimate turnaround practice (start insulation stripping before scaffolding completes). Prohibiting it would remove real capability and push planners back to fabricating dependencies |
| **Boundary rule** | A computed start may not precede the project datum (`Event.planned_start`). The existing clamp is **retained** |
| **Critical change** | The clamp must **emit an explicit warning** — `LAG_CLAMPED_AT_PROJECT_START`, carrying activity, requested offset and applied offset — in the same `warnings[]` channel as `NEGATIVE_FLOAT` |
| **Prohibited** | The current behaviour: silent truncation. Lags of −1, −2 and −5 all produce offset 0 with **no** signal [EXECUTED, predecessor gate §5.4] |
| **Test-expectation note** | `scheduleEngine.test.ts:184` encodes the silent clamp. Per §13 of the instruction, current behaviour is **not** preserved merely because a test expects it: the clamp is retained as *policy*, its silence is a *defect*, and that test must be updated to assert the warning |

**Rejected alternatives:** (A) permit unbounded negative lag — allows a schedule to precede its
own campaign start, which is meaningless. (B) prohibit negative lag — removes a real capability
and, with all six live lag rows being fixtures, would be a purely speculative restriction.

---

## 19. OD6 Options

| Option | Valid? | Why |
|---|---|---|
| **A — separate constraint model consumed by M11 CPM** | ✅ **VALID** | The only option that separates input from output. Costs 5 additive columns on `Activity`; makes D4 implementable; makes the planner's ask and the computed result independently visible; reuses the existing audit and approval assets |
| **B — use `Activity.planned_start`/`end` as constraint inputs** | ❌ **INVALID** | This is the **status quo** and the defect. Under D4 the column becomes CPM's output, so CPM would consume its own output; the first computed value would freeze permanently; and planner intent would be forever indistinguishable from a calculated date. Already measured: 80.6% of activities predecessor-less, 45 seeded from `planned_start` [EXECUTED] |
| **C — use `ScenarioActivityOverride` as the production constraint model** | ❌ **INVALID** | Scenario-scoped by design, so it cannot bind the live plan; `early_start_constraint` is dead schema (one occurrence repository-wide); and scenarios exist precisely to be *discarded*. Promoting a sandbox to production authority inverts its purpose |
| **D — use Event/Workpack windows only** | ❌ **INVALID** | Wrong granularity. A window cannot express "this crane arrives Tuesday" for one activity. Also foreclosed by OD1: Workpack has no authored window, and `Event`'s window is a campaign datum, not a per-activity bound. It is **necessary but not sufficient** — §15.5 adopts the Event half of it |

### Recommendation — OPTION A, with Option D's Event wiring as a companion

Option A for activity-level bounds; Event window wiring (§15.5) for the campaign datum. Together
they cover every category in §14 with exactly one carrier each.

---

## 20. OD6 Decision

> # OD6 = 🟢 GREEN

**Decision:** A planner-imposed date is stored **exclusively** as an explicit, audited,
reason-bearing constraint on `Activity` (`constraint_type`, `constraint_date`, `constraint_reason`,
`constraint_set_by`, `constraint_set_at`) which M11 consumes as forward-pass input; **M11 remains
the sole writer of `planned_start` / `planned_end`**; the type set is **two** —
`START_NO_EARLIER_THAN` and `FINISH_NO_LATER_THAN`; direct mutation of a calculated date is
prohibited, and the **three** production services that do it today are re-pointed at the
constraint carrier while retaining their existing approval and audit machinery.

### 20.1 The decision in seven clauses

1. **Constraint columns on `Activity`** (shape (i) from the predecessor gate §11.2), one
   constraint per activity, `constraint_date` as `timestamptz`.
2. **Type set = 2.** `MUST_START_ON` and `MUST_FINISH_ON` **excluded** for want of evidence
   (§15.3–15.4) — reversing the predecessor gate's "flagged" status and closing OD2.
3. **Reason mandatory, audit mandatory, no approval for a single constraint**; the existing
   `ScheduleChangeRequest` approval flow is retained for bulk/scenario application (§16.2).
4. **Constraints are hard and do not expire; soft constraints are excluded** — both recorded as
   decisions, both additive later (§16.4). Closes OD3 and OD4.
5. **`Activity.planned_start` stops being a CPM input.** The predecessor-less seeding at
   `scheduleEngine.ts:251-262` must read `constraint_date`. **This is the change that makes D4
   possible.**
6. **`Event.planned_end` → `target_finish_date`**, making negative float against the commitment
   reachable for the first time (§15.5).
7. **Lag is wall-clock and signed**, with the project-datum clamp retained but warned
   (§17.2, §18).

### 20.2 Evidence

§13.1 three live Pattern-2 writers with full audit · §13.5a the one correct governance shape
(`promoteScenario` → change request) and the fact that the **governed path has no UI while the
ungoverned one has a button** · §13.6 a complete working-day scheduler with zero callers ·
§13.2 the observed silent divergence between
`planned_start` and `early_start` for levelled activities with predecessors · §13.3 the reusable
`ScheduleChangeRequest` lifecycle · §13.4 the corrected classification of
`MaterialScheduleIntegrationService` · §13.5 the 26-mechanism A–G inventory with zero class-G ·
§15.1 three independent expressions of SNET semantics · §15.5 the executed proof that float is
self-referential and overrun invisible · §17.2 D9's `× 1440` rule forcing wall-clock lag.

### 20.3 Required propagation example, worked

Per §12 of the instruction:

| Step | Input | Result |
|---|---|---|
| A | duration 2 h, finish **10-Apr-2027 10:00** | — |
| B | FS, `lag_minutes = 0` | Dependency-derived start = **10-Apr-2027 10:00** ✅ |
| B constraint | `START_NO_EARLIER_THAN`, `constraint_date = 10-Apr-2027 14:00`, reason + author captured | — |
| M11 forward pass | `start = max(dependency-derived, constraint)` = `max(10:00, 14:00)` | **B.planned_start = 10-Apr-2027 14:00** ✅ |
| What is stored | `planned_start = 14:00` (M11-written) **and** `constraint_date = 14:00` (planner-written, with reason) — **two facts, two columns, two authorities** | — |
| What is **never** stored | `planned_start = 14:00` with no record of why | — |
| If the constraint is removed | Recalculation returns `planned_start` to **10:00** automatically | — |
| If A slips to finish 16:00 | `max(16:00, 14:00)` = **16:00**; the constraint no longer binds but remains recorded | — |

The last two rows are the point. Under Pattern 2 neither is possible: removing the reason is
impossible because no reason was stored, and the 14:00 value would persist after A slipped,
silently misrepresenting the schedule.

---

## 21. Combined Time Authority Model

| Fact | Authority | Input/Derived | Storage (target) | Writer | Consumers |
|---|---|---|---|---|---|
| Campaign window start | **Event** | Input | `timestamptz` | `EventPlanningService` | M11 (`project_start_date`), baseline, KPIs, exports |
| Campaign window finish | **Event** | Input | `timestamptz` | `EventPlanningService` | M11 (**`target_finish_date`**), baseline, KPIs, exports |
| Activity duration | Planner | Input | `numeric(8,2)` hours | creation/edit paths, change requests | M11, EVM, resource loading |
| Relationship + lag | Planner | Input | `lag_minutes` signed int | predecessor API, templates | M11; readers convert at render only |
| **Activity constraint** | Planner (authors) | **Input** | `constraint_type` + `constraint_date timestamptz` + reason/author/timestamp | Constraint service, audited | **M11 only**; UI shows beside the derived date |
| Working calendar / shifts | M11 calendar | Input | `ScheduleCalendar` + `ShiftDefinition` | Calendar CRUD | M11 via `CalendarEngine` (**C4**) |
| Activity planned start/finish | **M11** | **Derived** | `timestamptz` | **M11 only** | UI, M10, M13–M16, exports, baseline, forecast |
| Activity early/late/float | **M11** | Derived, internal | `timestamptz` | M11 only | M11 internal; float displayed |
| **Workpack schedule span** | **M11** | **Derived** | derived `MIN`/`MAX`, NULL when empty | **M11**, in the CPM transaction | Gantt bounds, header/list, planner grid, M10 display, reports |
| Activity actual start/finish | **M12** | Input (execution fact) | `timestamptz` | `ExecutionWriteService` **only** | M8.13, M13–M15 |
| Progress | **M8.13** | Derived | integer percent | M8.13 **only** | All downstream |
| Baseline snapshot | Baseline service | Derived (frozen copy) | `BaselineActivity` | `ScheduleBaselineService` | Comparison reports |

**Retired by these decisions:** `Workpack.planned_start_date`, `Workpack.planned_end_date`,
`ScenarioActivityOverride.early_start_constraint` (dead), `Activity.window` (dead), and
`Activity.planned_start`'s role as CPM input.

**Every fact has exactly one writer.** No fact appears twice.

---

## 22. Enter-Once / Propagation Contract

```
AUTHORED ONCE (inputs, audited, few)
  Event window ─────────┐
  Activity duration ────┤
  Relationship + lag ───┤
  Activity constraint ──┤        ┌──────────────────────────┐
  Calendar / shifts ────┴───────►│  M11                     │
                                 │  ScheduleOrchestration   │
                                 │  → CalendarEngine        │
                                 │  → calculateSchedule     │
                                 └────────────┬─────────────┘
                                              │  SOLE WRITER
                                              ▼
                        Activity.planned_start / planned_end
                        Activity.early/late/float/is_critical
                                              │
                                              ├──► Workpack schedule span (derived)
                                              ├──► M10 readiness            (read-only)
                                              ├──► M13 Control Tower        (read-only)
                                              ├──► M14 reporting            (read-only)
                                              ├──► M15 intelligence         (read-only)
                                              ├──► M16 interaction          (read-only)
                                              ├──► Exports / MS Project     (read-only)
                                              └──► Baseline snapshot        (frozen copy)

  M12 ExecutionWriteService ──► actual_start / actual_end   (execution provenance only)
  M8.13                     ──► progress                    (derived)

  NO CONSUMER RE-ENTERS ANY DERIVED VALUE.
```

### The five invariants this contract asserts

1. **Enter once.** Every input has exactly one authoring surface. A planner never types a date
   that the system can compute.
2. **Store once.** No fact is stored in two columns. The constraint and the computed date are
   *different facts*, not two copies of one.
3. **Derive automatically.** The workpack span and every CPM field are recomputed by M11; nothing
   is manually synced. **The "Sync" button is deleted** — it is the physical embodiment of the
   violation.
4. **Propagate automatically.** Any input change enqueues recalculation, including **constraint
   removal**.
5. **Read downstream, never re-enter.** M10, M13, M14, M15, M16 and every export read `planned_*`.
   None writes it.

**Where the contract is currently violated, by count:** six live Pattern-2 date writers (§13.5),
seven ordinary `Activity.planned_*` writers, fourteen Workpack date entry points, two browser
scheduling algorithms, one manual Sync button, and one unaudited event-datum override. **The
target state has one writer.**

---

## 23. C2 Required Changes

**Design only. Nothing implemented. Nothing may begin until §24 clears.**

### 23.1 Schema

| Change | Detail | Risk |
|---|---|---|
| **ADD** to `Activity` | `constraint_type ScheduleConstraintType?`, `constraint_date DateTime? @db.Timestamptz(3)`, `constraint_reason String?`, `constraint_set_by String? @db.Uuid`, `constraint_set_at DateTime? @db.Timestamptz(3)` | Zero — additive, starts NULL |
| **ADD** enum | `ScheduleConstraintType { START_NO_EARLIER_THAN, FINISH_NO_LATER_THAN }` — **two values**. Name deliberately distinct from the existing `ConstraintType` issue-register enum | Zero |
| **ADD** to `Workpack` | *(optional)* `schedule_start` / `schedule_finish` as materialised derived columns, **or** compute on read. Recommend materialised, written only by M11, for query performance | Zero |
| **DROP** from `Workpack` | `planned_start_date`, `planned_end_date` | **Zero — 0 of 199 populated** |
| **DROP** from `ScenarioActivityOverride` | `early_start_constraint` (dead schema) | Zero — 0 of 11 rows, no code references |
| **DROP** from `Activity` | `window` (dead, name-collision hazard) | Zero — 0 of 72 rows |
| **RE-DECLARE** | `ShiftDefinition`, `ResourceCapacity`, `workpack_asset_snapshots` | **OD9 — prerequisite, §24** |
| **CONVERT** | `lag_days` → `lag_minutes` (`× 1440`), `lag_hours` → minutes | Near-zero (D9) |
| **CONVERT** | four `Activity` `@db.Date` → `timestamptz` | **B4 — the real data risk** |

### 23.2 Services

| Service | Change | Class |
|---|---|---|
| `scheduleEngine.ts` | Seed predecessor-less activities from `constraint_date`, not `planned_start`; apply SNET/FNLT in the forward pass; accept `lag_minutes`; remove `.slice(0,10)`; add `CONSTRAINT_NOT_SATISFIED` and `LAG_CLAMPED_AT_PROJECT_START` warnings; fix free-float relationship-type handling | **MUST CHANGE** |
| `ScheduleOrchestrationService` | Pass `Event.planned_end` as `target_finish_date`; persist `planned_start`/`planned_end`; compute and persist the workpack span; pass full calendar | **MUST CHANGE** |
| `ActivityCreationCommand` | Date arguments become constraint writes | **MUST CHANGE — requires OD10** |
| `ResourceLevelingApplyService` | Write constraints instead of dates (§16.3) | **MUST CHANGE** |
| `ScheduleChangeControlService` | "Applied" writes constraints; add CPM recalculation; fix the false header comment (§13.1.1) | **MUST CHANGE** |
| `ScopeChangeApplicationService` | `new_activity` / `modify_activity` items write constraints, not `planned_*`; add CPM recalculation | **MUST CHANGE** |
| `PlannerWorkspaceService` | Remove `planned_start`/`planned_end` from `batchUpdate`'s accepted fields (`:119-120`) | **MUST CHANGE** |
| `SchedulingService` | Retire the dead `calculateProjectSchedule` path, **or** harvest its working-day logic for C4 rather than writing new logic (§13.6) | MAY CHANGE |
| `MaterialScheduleIntegrationService` | Rewrite to emit constraints, or delete (OD8) | **MUST CHANGE** |
| `PlanningReadinessService` | `calendar` check re-points to schedule evidence | **MUST CHANGE** |
| `ReadinessScoreService` | `execution_calendar` criterion re-points | **MUST CHANGE** |
| `ScheduleBaselineService` | Remove the `?? new Date()` fabrication; baseline only scheduled activities | **MUST CHANGE** |
| `ExecutionWriteService` | **Nothing** | **MUST NOT CHANGE** |
| M8.13 progress services | **Nothing** | **MUST NOT CHANGE** |
| M13 / M15 / M16 services | **Nothing** — read-only consumers | **MUST NOT CHANGE** |

### 23.3 API

| Change | Class |
|---|---|
| New constraint endpoints (set / clear / list) on activity, audited | MUST CHANGE |
| Predecessor endpoints: `lag_minutes`; **remove** `lagHoursToDays` ÷8 and the ÷24 template path | MUST CHANGE |
| Workpack PATCH: **reject** `planned_start_date` / `planned_end_date`; remove from `WORKPACK_EDITABLE_FIELDS` | MUST CHANGE |
| **Delete** `activities/date-range` — superseded by the persisted span | MAY CHANGE |
| **Add** the missing approve/apply controls to the change-request UI, so the governed path is reachable (§13.5a) | MUST CHANGE |
| **Delete** the `events/[eventId]/phases` route and page — `EventPhase` has neither model nor table (§24) | MUST CHANGE |
| MS Project export: project window ← Event window; remove `now()` fallback | MUST CHANGE |
| `POST /api/schedule/calculate`: `override_start_date` retired or audited (OD5) | MAY CHANGE |

### 23.4 UI

Remove workpack date inputs (create form, header, planner grid); **remove the "Sync" button and
mismatch banner**; relabel workpack dates to "Schedule Start/Finish" (read-only); add constraint
editing with mandatory reason showing the constraint *beside* the computed date; delete both
browser scheduling algorithms; display new engine warnings. **MUST CHANGE.**

### 23.5 Module-by-module

| Module | Impact | Class |
|---|---|---|
| **M10** | Two check re-points; `planningState` logic unchanged | MUST CHANGE (small) |
| **M11** | Gains constraint consumption, `target_finish_date`, planned-date ownership, span rollup | **MUST CHANGE (largest)** |
| **M12** | **None.** GREEN/CLOSED, actual-date authority untouched | **MUST NOT CHANGE** |
| **M13** | Reads `planned_*` — gains precision when `timestamptz` lands | MUST NOT CHANGE |
| **M14** | Report providers re-point workpack dates to the span | MAY CHANGE |
| **M15** | None — already read-only; `DecisionIntelligenceService` explicitly does not call leveling apply | MUST NOT CHANGE |
| **M16** | None | MUST NOT CHANGE |
| **Import/export** | Lag unit conversion at named boundaries; MS Project window source | MUST CHANGE |
| **Baseline** | Fabrication removal; optional constraint metadata | MAY CHANGE |
| **Audit** | New `CONSTRAINT_SET` / `CONSTRAINT_CLEARED` events reusing the existing `AuditLog` shape | MUST CHANGE |

---

## 24. B1–B7 Migration Reconciliation Gate

**Carried forward. Not fixed. Not fixable by this task.**

> ### ⛔ C2 MUST NOT GENERATE A DESTRUCTIVE MIGRATION UNTIL EVERY ITEM BELOW IS CLEARED.

| ID | Blocker | State |
|---|---|---|
| **B1** | `Activity.project_id` schema/DB drift must be reconciled | OPEN |
| **B2** | Migration history must be made reproducible; **destructive diff proposing data-table drops must be stopped** (8 tables, 3 with data, 38 rows) | OPEN — mechanism now explained by B7 |
| **B3** | Verified `pg_dump` + restore before any destructive step | OPEN |
| **B4** | `timestamp without time zone` → `timestamptz` conversion semantics must be **tested** (the +05:30 skew) | OPEN — **the only real data risk in R1.0-C** |
| **B5** | Trigger/enqueue gaps (C0 §6.2) — otherwise every derived value goes stale | OPEN |
| **B6** | Three epoch rows (D7) | OPEN |
| **B7 / OD9** | **`ShiftDefinition`, `ResourceCapacity` and `workpack_asset_snapshots` must be re-declared in Prisma**; the `EventPhase` route/page must be deleted (model **and** table absent) | **OPEN — REQUIRED**, scope widened below |

### OD9 — schema re-declaration prerequisite

**Verified again in this task [SOURCE]:** a case-insensitive search of `prisma/schema.prisma` for
`ShiftDefinition`, `ResourceCapacity`, `shift_definitions`, `resource_capacity`,
`workpack_asset_snapshots` and `WorkpackAssetSnapshot` returns **no matches**, while
`src/core/resources/ResourcePlanningService.ts` calls `prisma.shiftDefinition.*` and
`prisma.resourceCapacity.*` at fifteen sites.

**Three consequences, all blocking:**

1. Those accessors do not exist on the generated client — **every shift and capacity operation
   throws at runtime.**
2. `migrate diff` proposes dropping the tables because the schema no longer declares them. It is
   reporting the drift faithfully. **Running it deletes 38 rows of real configuration.**
3. `ShiftDefinition` holds the plant's real 2 × 12 h working time — the input **C4 needs** and
   §17.3 step 3 depends on. It is currently unreachable from application code.

**OD9 = REQUIRED.** It must be scoped into the D1 reconciliation migration as a *re-declaration*,
never a drop.

### OD9 scope widens — a fourth missing model, and this one has no table either

`app/api/events/[eventId]/phases/route.ts:22-28` calls `prisma.eventPhase.create`, but **no
`EventPhase` model exists in `prisma/schema.prisma`** (confirmed absent; the removal is recorded in
`docs/M7.8.9_PRISMA_MODEL_MAP.md:96`). `app/(dashboard)/events/[eventId]/phases/page.tsx` renders
against the same route.

This is the **same defect class as B7 but a different variant**, and the distinction matters for
the migration:

| Variant | Example | Correct remedy |
|---|---|---|
| Table exists, model missing, **has data** | `ShiftDefinition` (6), `ResourceCapacity` (30), `workpack_asset_snapshots` (2) | **Re-declare the model.** Dropping destroys 38 rows |
| Model missing **and** no table | `EventPhase` | **Delete the dead route and page**, or model the feature deliberately. Nothing to preserve |

**Consequence for OD9:** the reconciliation must classify each missing accessor before acting —
re-declare where data exists, remove the caller where it does not. A blanket "re-add every missing
model" would resurrect a feature nobody built. **Add the `EventPhase` route and page to the C2
cleanup inventory.**

**Also recorded, same class, no data implication:** `ResourceLevelingService.ts:3` imports
`ResourceConstraintService` and never uses it (inline `calculateConstraints()` at `:161-260`
instead), and the legacy `src/modules/Constraints/Services/ConstraintService.ts` has no importers
anywhere. Both are dead code that a reader could mistake for live constraint machinery.

---

## 25. MUST CHANGE / MAY CHANGE / MUST NOT CHANGE

### 🔴 MUST CHANGE

`scheduleEngine.ts` (constraint seeding, SNET/FNLT, `lag_minutes`, truncation, warnings, free
float) · `ScheduleOrchestrationService` (`target_finish_date`, planned-date persistence, span,
calendar) · `ActivityCreationCommand` (**needs OD10**) · `ResourceLevelingApplyService` ·
`ScheduleChangeControlService` (+ its false header comment, + missing approve/apply UI) ·
**`ScopeChangeApplicationService`** · `PlannerWorkspaceService.batchUpdate` field allow-list ·
`MaterialScheduleIntegrationService` (rewrite or delete) ·
`PlanningReadinessService` `calendar` check · `ReadinessScoreService` `execution_calendar`
criterion · `ScheduleBaselineService` `now()` fabrication · predecessor APIs (÷8 and ÷24 removal) ·
Workpack PATCH allow-lists · MS Project export window · portfolio overdue basis · workpack date UI
+ **Sync button removal** · both browser scheduling algorithms · schema additions and drops in
§23.1 · **OD9 re-declarations**

### 🟡 MAY CHANGE

`activities/date-range` route (deletable once the span persists) · `override_start_date` (OD5) ·
M14 report providers · baseline constraint metadata · `event_milestones` (0 rows, no dependency) ·
materialised vs computed span · `ScheduleChangeRequest` change-type vocabulary

### 🟢 MUST NOT CHANGE

**M12 / `ExecutionWriteService`** — GREEN/CLOSED; `actual_*` receives execution provenance only ·
**M8.13** progress authority · **M13** Control Tower · **M15** intelligence (including
`DecisionIntelligenceService`'s deliberate non-invocation of leveling apply) · **M16** interaction ·
**R0.4 Event authority** — Event remains the campaign container · **the `Constraint` issue
register** (raise→own→resolve→close; must not be repurposed or name-collided) ·
**`ScheduleChangeRequest`'s approval lifecycle** (payload changes, governance does not) ·
**D9's `lag_minutes` contract and the `× 1440` rule** · the multi-tenant `organization_id`
scoping on every query

---

## 26. Remaining Open Decisions

| # | Decision | Blocks | Class | Why still open |
|---|---|---|---|---|
| **OD5** | `override_start_date` — retire, or bring under reason + audit? | C6 | Operational policy | Moves an entire event's CPM datum unaudited. Not a semantic ambiguity; the time contract holds either way |
| **OD7** | Ratify the six-row lag fixture classification | C3 | Ratification | "These are fixtures" is a strong **[INFERENCE]** from naming, timing and `created_by = NULL` — not proven |
| **OD8** | Material availability — connect as constraint, or keep as readiness gate? | Future phase | Product capability | §15.6 fixes the *how* (category-1 constraint, attributed) so that whichever way it goes, M11 stays sole writer. The *whether* is a capability decision |
| **OD9** | Re-declare three lost Prisma models | **C2** | Engineering prerequisite | §24. **REQUIRED** |
| **OD10** | Lift the freeze on `ActivityCreationCommand` and M11 for C4/C5 | C4, C5 | **Governance** | Formerly numbered OD6 (§2). D4 + D10 are not implementable without editing both. This task has no licence to lift its own constraints |

### Closed by this task

| Was | Now |
|---|---|
| **OD1** — Workpack commitment/Execution Calendar | ✅ **CLOSED** — §9 |
| **OD2** — ratify `MUST_START_ON` | ✅ **CLOSED** — excluded for want of evidence (§15.3) |
| **OD3** — constraint expiry | ✅ **CLOSED** — no expiry (§16.4) |
| **OD4** — soft constraints | ✅ **CLOSED** — excluded (§16.4) |
| **OD6** — override/constraint policy | ✅ **CLOSED** — §20 |

**Note on what "open" now means.** None of OD5, OD7, OD8 or OD10 is a *semantic* ambiguity about
what a date means. OD5 and OD8 are capability/policy choices whose answers do not alter the time
contract; OD7 is a ratification of an inference; OD10 is an authorisation. That is why C1 can
freeze while they remain open, and it is the substantive difference from the previous gate, where
the open items were about **meaning**.

---

## 27. Acceptance Matrix

| Requirement | Met? | Where |
|---|---|---|
| OD1 answered with one unambiguous decision | ✅ | §9 — six converging strands |
| OD1: commitment vocabulary searched exhaustively at workpack scope | ✅ | §9.1 strand 6, §9.1a — proven absence, with the eight carriers that *do* express it |
| OD1: all five business concepts assessed against all fourteen questions | ✅ | §5 |
| OD1: "scheduled" vs "required" vs "planner completed the step" kept distinct | ✅ | §5.6 |
| OD1: journeys A–F traced | ✅ | §7 |
| OD1: options A–D evaluated on all ten criteria, one recommendation | ✅ | §8 |
| OD1: precise names, no ambiguous reuse | ✅ | §8 |
| OD6 answered with one unambiguous policy | ✅ | §20 |
| OD6: every mechanism classified A–G | ✅ | §13.5 — **32** mechanisms, **zero class G** |
| OD6: nothing treated as a constraint merely for being named one | ✅ | §13.5 — `Constraint` register class E |
| OD6: all six semantics assessed (SNET, FNLT, MSO, MFO, window, material) | ✅ | §15 |
| OD6: full override policy — all thirteen questions | ✅ | §16.2 |
| OD6: Pattern 1 vs Pattern 2 decided | ✅ | §16.1 |
| OD6: direct mutation of calculated dates **not** accepted as default | ✅ | §16.1 — prohibited |
| OD6: propagation example worked | ✅ | §20.3 |
| OD6: negative lag policy explicit | ✅ | §18 — Option C |
| OD6: calendar interaction explicit; four concepts unmerged | ✅ | §17 |
| `MaterialScheduleIntegrationService` prevented from becoming a second writer | ✅ | §15.6, §16.3 |
| C2 impact with MUST/MAY/MUST NOT | ✅ | §23, §25 |
| B1–B7 recorded; OD9 named | ✅ | §24 |
| Evidence standard applied; no inference called proven | ✅ | §3.3 and inline tags |
| D9 not reopened | ✅ | §2, §17.2 (D9 *constrains* this task) |
| Read-only; nothing fixed | ✅ | §22 verification below |

---

## 28. Final C1 Gate Recommendation

> # C1 TIME CONTRACT: ✅ **FREEZABLE**

### The nine §20 conditions

| # | Condition | Met | Evidence |
|---|---|---|---|
| 1 | OD1 has one unambiguous product decision | ✅ | §9 — five converging strands; counter-evidence addressed |
| 2 | OD6 has one unambiguous constraint/override policy | ✅ | §20 — Pattern 1, two types, full policy table |
| 3 | No duplicate planned-date authority remains in the proposed model | ✅ | §21 — every fact has exactly one writer; M11 sole writer of `planned_*` |
| 4 | `lag_minutes` contract unchanged | ✅ | §17.2 — unchanged and load-bearing |
| 5 | Constraint input separate from CPM output | ✅ | §14 — categories 1 and 2 have distinct carriers; category 5 empty |
| 6 | Event window semantics explicit | ✅ | §15.5 — backward-pass datum, **not** a forward clamp |
| 7 | Workpack schedule-span semantics explicit | ✅ | §9, §21 — derived `MIN`/`MAX`, NULL when empty, M11-written |
| 8 | Calendar interaction explicit | ✅ | §17 — four concepts, normative ordering, worked example |
| 9 | Migration reconciliation blockers recorded | ✅ | §24 — B1–B7 + OD9 |

**No technical assumption was made to force GREEN.** The two AMBER items closed on evidence that
did not exist at the previous gate: the M10 gating logic (§6.2), the baseline exclusion (§6.4), the
three live Pattern-2 writers (§13.1) and the observed divergence they cause (§13.2). Where evidence
was genuinely absent, the decision was **exclusion** (`MUST_START_ON`, soft constraints, expiry) —
each conservative, each additive later, none inventing a business meaning.

### What C1 may now freeze

The complete time contract: the lag contract (D9); the constraint carrier, its two-value type set
and its audit requirements; the prohibition on mutating calculated dates; the Event window's role
as `project_start_date` + `target_finish_date`; the Workpack derived-span rule; the wall-clock lag
and working-time duration semantics with their normative ordering; the negative-lag policy; and
the authority map in §21.

### What C1 must record as pending, without blocking

OD5, OD7, OD8 (policy/ratification — do not alter the contract) and **OD10** (governance — blocks
C4/C5 *implementation*, not the contract).

### C2 readiness

> # C2: ⛔ **BLOCKED**

**Not on any semantic question** — those are closed. C2 is blocked on infrastructure:

1. **OD9** — three Prisma model re-declarations (§24). Until then `migrate diff` is destructive
   and `ResourcePlanningService` throws.
2. **B1–B3** — drift reconciliation, reproducible history, verified backup/restore.
3. **B4** — the `timestamptz` conversion must be tested on a restored copy before it runs on the
   +05:30-skewed columns.

**Recommended sequence:** OD9 + B1–B4 (no further decisions needed — start now) → freeze C1 → C2
schema (constraint columns land here) → C3 lag → **OD10 authorisation** → C4 M11 authority (which
requires C2's constraint columns, per the §9.3 circularity) → C5–C9.

---

**END — AURIANOA R1.0-C OD1 / OD6 PRODUCT DECISION GATE**

*READ-ONLY. No application code, Prisma schema, migration, database row, seed, test or UI was
created or modified by this task; the only file written is this document. No migration was
generated or applied. Nothing discovered during the task was "fixed" — every defect found
(the baseline `now()` fabrication, the levelling/CPM divergence, the missing CPM recalculation in
`ScheduleChangeControlService`) is recorded for the R1.0-C defect register and left in place.
M12, M8.13, M13, M15, M16, R0.4 Event authority, `ActivityCreationCommand` and
`ExecutionWriteService` are untouched. D9 was not reopened. C1 was not started. C2 was not
started. OD1 and OD6 were decided, not implemented.*
