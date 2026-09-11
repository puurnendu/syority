# AURIANOA R1.0 — TIME DATA LINEAGE AUDIT

**Phase:** R1.0 — Time & Planning Propagation Foundation
**Type:** Read-only forensic audit. **No code was modified.**
**Date:** 2026-09-09
**Status of R1.0 implementation:** **GATED — NOT STARTED** (see §0)
**Method:** Implementation-first. Every claim below cites a file and line. Prior
documentation was treated as a hypothesis to verify, not as evidence.

---

## 0. Gate Status — Why This Is Audit-Only

The R1.0 mission brief states:

> Do not start R1.0 implementation if R0.4-XX has not been verified GREEN.
> If the environment is still unable to execute tests, do not claim R1.0 GREEN.
> You may perform forensic/design work, but implementation acceptance remains blocked.

**R0.4-XX is AMBER, not GREEN.** Targeted tests, regression, database verification
and browser verification were all impossible: the shell in this environment will
not execute any command, including a shell builtin. Four independent probes across
two sessions (`node -e`, `echo`, `node -v` ×2) each stalled without output or exit;
one accumulated 17 minutes of wall time on `echo`.

Therefore this phase delivers **forensic and design work only**:

| Deliverable | Status |
|---|---|
| `docs/AURIANOA_R1.0_TIME_DATA_LINEAGE_AUDIT.md` | ✅ This document |
| `docs/AURIANOA_R1.0_TIME_AUTHORITY_DECISION.md` | ✅ Companion design decision |
| `docs/AURIANOA_R1.0_IMPLEMENTATION_RESULT.md` | ⛔ **Not created** — no implementation was performed |

No schema migration, no engine change, and no propagation wiring was written.

---

## 1. Headline Finding

**R1.0's governing principle is not currently satisfiable, and the reason is
structural rather than a matter of missing wiring.**

Three independent facts, each verified in implementation, combine to block it:

1. **M11 does not write the planned dates the product displays.**
   `ScheduleOrchestrationService` persists `early_start/early_finish/late_start/late_finish/total_float/free_float/is_critical`
   and **never writes `planned_start`/`planned_end`**
   (`src/core/schedule/ScheduleOrchestrationService.ts:173-190`). The UI, execution,
   readiness and reporting layers read `planned_*`. So CPM output and the
   product's planned dates are two disconnected value sets.

2. **The database physically cannot store a time of day for operational dates.**
   `Activity.planned_start`, `planned_end`, `actual_start`, `actual_end` are all
   `DateTime? @db.Date` — a PostgreSQL `date` column
   (`prisma/schema.prisma:25-28`). The Golden Test Case value
   `Bundle Pullout START = 10-Apr-2027 14:00` is **truncated to `2027-04-10`** on
   write. R1-T08 cannot pass without a migration.

3. **CPM performs naive 24-hour arithmetic and ignores the calendar.**
   The engine receives only `working_hours_per_day` from the calendar
   (`ScheduleOrchestrationService.ts:167`); `work_days` and `exceptions` are never
   passed. Date advancement is `days * 24 * 60 * 60 * 1000`
   (`src/lib/scheduleEngine.ts:96-99`). `CalendarEngine.addWorkingDays()` is
   **never called by M11** — its only production caller is the legacy
   `SchedulingService` (`src/modules/Scheduling/Services/SchedulingService.ts:167`).

There is a fourth, compounding fact: **the browser calculates and persists
planned finish dates** (`src/components/Schedule/ScheduleContainer.tsx:835,847`),
making the client a de-facto second date engine.

---

## 2. Authority Reality vs. Intended Model

| Business fact | Intended authority | Actual authority in code | Verdict |
|---|---|---|---|
| Activity duration | Planner input | `Activity.duration_hours` — single field | ✅ Sound |
| Relationship type | Planner input | `ActivityRelationship.relationship_type` | ✅ Sound |
| Lag | Planner input | `ActivityRelationship.lag_days` — **integer days** | ❌ Wrong unit |
| Calendar | M11 | `ScheduleCalendar`, resolved but only `hours_per_day` consumed | ❌ Partly ignored |
| Early/Late dates, Float, Critical path | M11 | `ScheduleOrchestrationService` | ✅ Single writer |
| **Planned Start / Finish** | **M11** | **UI + API + Resource Leveling + ActivityCreationCommand — not M11** | ❌ **No authority** |
| Actual Start / Finish | M12 | `ExecutionWriteService` — sole writer | ✅ Sound (but date-only) |
| Progress | M8.13 | Progress services | ✅ Out of scope here |
| EVM | M8.10 | `EvmSnapshotService` | ✅ Closed in R0.4 |
| Baseline | Frozen snapshot | `BaselineActivity` | ⚠️ Immutability unverified |
| Forecast | Governed prediction | **No field exists** | ❌ Missing |

---

## 3. Time Data Lineage Matrix

Columns as required by §4 of the brief. "Editable downstream?" means: can a user
in a *later* phase change the value after it has been established upstream.

### 3.1 Planning inputs

| Fact | DB field | First entry | Authority | Derived by | Consumers | Editable downstream? | Duplicate? |
|---|---|---|---|---|---|---|---|
| Activity duration | `Activity.duration_hours` `Decimal(8,2)` (`schema:23`) | Activity Editor / Grid / template | Planner input | — | CPM (`scheduleEngine:144`), EVM, progress, readiness, reports, M15 | Yes — grid + API | ⚠️ `Activity.remaining_duration` (`schema:52`); `workpack_template_activities.duration_hours` (`schema:2907`); `ActivityLibrary.duration_hours` (`schema:232`) |
| Duration unit | *none* — implied hours | — | Implicit | `duration_days = duration_hours / hoursPerDay` (`scheduleEngine:145`) | CPM, UI display | n/a | ✅ No competing unit column |
| Calendar | `ScheduleCalendar.work_days`, `hours_per_day`, `exceptions` (`schema:1429`) | Calendar admin | M11 | 3-tier resolve: event → org default → `Mon–Sat/10h` fallback (`ScheduleOrchestrationService:357-387`) | **Only `hours_per_day` reaches CPM** | Yes | ❌ `work_days`/`exceptions` loaded then discarded |
| Predecessor / Successor | `ActivityRelationship.predecessor_id` / `successor_id` (`schema:263-264`) | Logic tab / grid / import | Planner input | — | CPM forward+backward pass | Yes | ✅ `@@unique([predecessor_id, successor_id])` |
| Relationship type | `ActivityRelationship.relationship_type` enum, default `FS` (`schema:266`) | Logic tab | Planner input | — | CPM (all four types implemented, `scheduleEngine:271-279`, `327-335`) | Yes | ✅ |
| Lag | `ActivityRelationship.lag_days` `Int? @default(0)` (`schema:267`) | Logic tab / import | Planner input | — | CPM (`scheduleEngine:172`) | Yes | ❌ **Integer days only.** `parsePredecessorString` matches `+2h` but discards the unit and stores `2` — read as **2 days** (`scheduleEngine:452-456`) |
| Constraint date (CPM) | **No field on `Activity`** | — | — | — | — | — | ❌ Only `ScenarioActivityOverride.early_start_constraint` (`schema:5851`) and `MaterialConstraint.constraint_date` (`schema:6011`) |

### 3.2 M11 derived outputs

| Fact | DB field | First entry | Authority | Derived by | Consumers | Editable downstream? | Duplicate? |
|---|---|---|---|---|---|---|---|
| Early Start | `Activity.early_start` `DateTime?` — **timestamp-capable** (`schema:39`) | CPM | M11 | `calculateSchedule` forward pass | Lookahead (`ScheduleOrchestrationService:261-272`), S-curve (`:298`), reports fallback (`PlanningIntelligenceProviders:67`) | No direct writer found | ⚠️ Diverges from `planned_start` |
| Early Finish | `Activity.early_finish` (`schema:40`) | CPM | M11 | Forward pass | Lookahead, S-curve | No | ⚠️ Same |
| Late Start | `Activity.late_start` (`schema:41`) | CPM | M11 | Backward pass | Float/criticality | No | — |
| Late Finish | `Activity.late_finish` (`schema:42`) | CPM | M11 | Backward pass | Float/criticality | No | — |
| Total Float | `Activity.total_float` `Decimal(12,2)` — **hours**, documented in schema (`schema:43-44`) | CPM | M11 | `total_float_hours` (`scheduleEngine:360`) | UI (÷ hours_per_day), health, M15 | No | ⚠️ Unit differs from `free_float` source |
| Free Float | `Activity.free_float` `Float?` (`schema:49`) | CPM | M11 | `free_float_days × hoursPerDay` (`ScheduleOrchestrationService:185`) | Health | No | ⚠️ Computed ignoring relationship type (`scheduleEngine:363-371`) |
| Critical flag | `Activity.is_critical` (`schema:45`) | CPM | M11 | `total_float <= threshold` | Gantt, Control Tower, M15 | No | — |
| **Planned Start** | `Activity.planned_start` `@db.Date` (`schema:25`) | **UI / API / import** | ❌ **None** | **Not derived by M11** | Execution (`FieldExecutionService:329`), readiness, reports, M15, M16 (`readTools:117`), EVM, Gantt | **Yes — 4+ writers** | ❌ **Competes with `early_start`** |
| **Planned Finish** | `Activity.planned_end` `@db.Date` (`schema:26`) | **UI / API / browser arithmetic** | ❌ **None** | Browser: `start + durH × 3600000` (`ScheduleContainer:835,847`) | Same as above | **Yes** | ❌ **Competes with `early_finish`** |

### 3.3 M12 execution facts

| Fact | DB field | First entry | Authority | Derived by | Consumers | Editable downstream? | Duplicate? |
|---|---|---|---|---|---|---|---|
| Actual Start | `Activity.actual_start` `@db.Date` (`schema:27`) | Execution workspace / mobile / WhatsApp | **M12** `ExecutionWriteService:267,283,303` | Set on first progress or START | Progress, EVM (`EvmSnapshotService`), Control Tower, reports, M15, M16 | Guarded by execution-field allow-list (`executionFieldGuard`) | ✅ Single writer — ⚠️ but **time truncated** |
| Actual Finish | `Activity.actual_end` `@db.Date` (`schema:28`) | Execution | **M12** `ExecutionWriteService:286,299` | Set at 100% / COMPLETE | Same | No | ✅ Single writer — ⚠️ time truncated |
| Hold start | **No field** | — | — | — | — | — | ❌ Only `Activity.hold_point_type` / `hold_point_description` — free text, no timestamp (`schema:34-35`) |
| Resume time | **No field** | — | — | — | — | — | ❌ Missing |
| Delay time | **No field on `Activity`** | — | — | — | — | — | ❌ `ConstraintLog` (`schema:1904`) is the nearest analogue |

### 3.4 Baseline and forecast

| Fact | DB field | First entry | Authority | Derived by | Consumers | Editable downstream? | Duplicate? |
|---|---|---|---|---|---|---|---|
| Baseline Start | `BaselineActivity.planned_start` `DateTime` **required, timestamp-capable** (`schema:613`) | Baseline freeze | `ScheduleBaseline` (`schema:1408`) | Snapshot at freeze | EVM (retired Project engine formerly read it), variance | ⚠️ Immutability not enforced in schema | ⚠️ Baseline has timestamp precision the live field lacks |
| Baseline Finish | `BaselineActivity.planned_finish` | Baseline freeze | Baseline | Snapshot | Variance | ⚠️ Unverified | — |
| Baseline early/late/float | `BaselineActivity.early_start…free_float` (`schema:618-623`) | Freeze | Baseline | Snapshot of CPM | Variance | ⚠️ Unverified | — |
| **Forecast Start** | **No field** | — | ❌ **None** | — | — | — | ❌ Cannot distinguish Forecast from Current Plan |
| **Forecast Finish** | **No field** | — | ❌ **None** | — | — | — | ❌ Same |

### 3.5 Container-level dates

| Fact | DB field | First entry | Authority | Derived by | Consumers | Editable downstream? | Duplicate? |
|---|---|---|---|---|---|---|---|
| Event planned window | `Event.planned_start` / `planned_end` `@db.Date` (`schema:2014-2015`) | Event create/edit | Planner input | — | **CPM day-zero reference** (`ScheduleOrchestrationService:144-146`), S-curve window | Yes — Event edit UI | ✅ Single field, but date-only |
| Event actuals | `Event.actual_start` / `actual_end` `@db.Date` (`schema:2016-2017`) | Event close | Event | — | Reports | Yes | — |
| Workpack planned window | `Workpack.planned_start_date` / `planned_end_date` `@db.Date` (`schema:109-110`) | Workpack form | Planner input | **Not derived from child activities** | Readiness (`PlanningReadinessService:536-537`) | Yes | ❌ Independent of Activity dates — no roll-up |
| Scenario planned dates | `ScenarioActivityOverride.planned_start` / `planned_end` `@db.Date` (`schema:5848-5849`) | Scenario editor | M8.9 scenario | `ScenarioCalculationService:120` maps `early_start → planned_start` | Scenario compare | Scenario-scoped | ⚠️ **The early→planned mapping M11 itself lacks** |
| Scope-change dates | `ScheduleScopeChangeItem.planned_start` / `planned_end` `@db.Date` (`schema:5957-5958`) | Scope change | Scope change | — | Impact analysis | Yes | ⚠️ Another planned-date pair |

---

## 4. Every Writer of `Activity.planned_start` / `planned_end`

This is the direct evidence for R1-T19 ("no second planned-date writer"). It
currently **fails**: there are at least five writers, and **M11 is not among them**.

| # | Writer | Location | Nature | Legitimate as planner input? |
|---|---|---|---|---|
| 1 | `ActivityCreationCommand` | `src/core/activity/ActivityCreationCommand.ts:481-482` | Creation-time `plannedStart`/`plannedEnd` | Arguable — creation seed |
| 2 | `POST /api/activities` | `app/api/activities/route.ts:64-65` | Raw body → planned dates | ❌ Unguarded |
| 3 | Legacy Project activities route | `app/api/projects/[id]/schedule/activities/route.ts:28` | Raw body → `planned_start` | ❌ Deprecated surface |
| 4 | **Resource Leveling apply** | `src/core/resources/ResourceLevelingApplyService.ts:118-124` | `tx.activity.update({ planned_start, planned_end })` then triggers CPM | ⚠️ See §5 |
| 5 | **Browser (Schedule grid)** | `src/components/Schedule/ScheduleContainer.tsx:835,847` | Computes `planned_end` from start + duration and sends it | ❌ Client-side business truth |
| 6 | Browser (Planning grid) | `src/components/planning/ActivityPlanningGrid.tsx:184,189,208-209` | `d.setDate(d.getDate() + days - 1)`; defaults planned dates to **today** | ❌ Client-side business truth |
| — | **M11 `ScheduleOrchestrationService`** | `:173-190` | **Writes `early_*` only** | ❌ **Absent** |

---

## 5. The Resource-Leveling Silent-Override Defect

`ResourceLevelingApplyService.applyRecommendations` writes `planned_start` /
`planned_end` for each levelled activity, then calls M11 to recalculate
(`:118-124`, then step 2). But CPM honours `planned_start` **only for activities
with no predecessors**:

```
// src/lib/scheduleEngine.ts:251-262
if (preds.length === 0) {
  let startOffset = 0;
  if (act.planned_start) { startOffset = Math.max(0, diffDays(pDate, projectStartDate)); }
  ...
} else {
  // planned_start is IGNORED — ES derives purely from predecessors
}
```

Consequences for any levelled activity that has a predecessor:

1. `planned_start` shows the levelled date (what the planner sees).
2. `early_start` shows the CPM date, which ignores the levelling.
3. The audit log records a change that had no effect on the critical path.

The levelling therefore *appears* applied while CPM behaves as if it never
happened. Classified **R1-P1-007**.

---

## 6. Time-of-Day: Physically Blocked

| Field | Prisma | Postgres type | Time-of-day survives? |
|---|---|---|---|
| `Activity.planned_start` | `DateTime? @db.Date` | `date` | ❌ Truncated |
| `Activity.planned_end` | `DateTime? @db.Date` | `date` | ❌ Truncated |
| `Activity.actual_start` | `DateTime? @db.Date` | `date` | ❌ Truncated |
| `Activity.actual_end` | `DateTime? @db.Date` | `date` | ❌ Truncated |
| `Activity.early_start` | `DateTime?` | `timestamp` | ✅ Column capable |
| `Activity.early_finish` | `DateTime?` | `timestamp` | ✅ Column capable |
| `Activity.late_start` / `late_finish` | `DateTime?` | `timestamp` | ✅ Column capable |
| `Event.planned_start` / `planned_end` | `@db.Date` | `date` | ❌ Truncated |
| `BaselineActivity.planned_start` | `DateTime` | `timestamp` | ✅ Column capable |

**An inversion:** the derived CPM columns can hold a time of day, while the
operational columns the whole product reads cannot.

Even where the column is capable, the **engine destroys the time anyway** —
every date output is serialized with `.toISOString().slice(0, 10)`
(`scheduleEngine.ts:398-401`, `428-429`), then re-parsed by
`ScheduleOrchestrationService:179-182` as UTC midnight. So `early_start` is
timestamp-capable but always midnight in practice.

There are therefore **two independent blockers** to R1-T08, and fixing the schema
alone would not be sufficient.

---

## 7. Calendar: Loaded, Then Discarded

```
// ScheduleOrchestrationService.ts:91  — full calendar resolved
const calendar = await this.loadCalendar(orgId, event.calendar_id);

// ScheduleOrchestrationService.ts:165-169 — only one scalar reaches the engine
{ project_start_date: projectStartDate,
  working_hours_per_day: calendar.getHoursPerDay(),
  critical_float_threshold }
```

`work_days` and `exceptions` are read from `ScheduleCalendar`
(`:363-383`) and then never used. `scheduleEngine` has no calendar parameter and
advances dates with raw 24-hour milliseconds (`:96-99`).

**Consequence:** a "TA-2027 Shutdown Calendar" with holidays or a 6-day week has
no effect on any CPM date. R1-T07 fails. The correct primitive already exists and
is unused: `CalendarEngine.addWorkingDays()` (`src/lib/CalendarEngine.ts:36-44`).

Secondary defect: `CalendarEngine.isWorkingDay` matches exceptions via
`date.toISOString().split('T')[0]` — a **UTC** date key
(`CalendarEngine.ts:23`). For a site in UTC+05:30, a holiday is evaluated against
the wrong local day near midnight. Classified **R1-P2-015**.

---

## 8. Lag: Wrong Unit, and a Silent Unit Bug

`ActivityRelationship.lag_days` is `Int? @default(0)` (`schema:267`). The brief
requires minute precision (`FS + 120 minutes`). Integer days cannot express it.

Worse, the predecessor parser accepts an hours suffix and then throws it away:

```
// src/lib/scheduleEngine.ts:452-456
const lagMatch = rem.match(/([+-]\d+)(?:d|h)?$/i);
if (lagMatch) { lag = parseInt(lagMatch[1], 10); ... }
```

`ACT-01FS+2h` yields `lag = 2`, consumed downstream as **2 days**. A planner
typing hours gets a 24× error with no warning. Classified **R1-P0-005**.

Relationship *types* are, by contrast, correctly implemented for all four
variants in both passes (`scheduleEngine:271-279`, `327-335`), so R1-T03…T06 are
blocked only by the lag unit, not by missing logic.

---

## 9. Client-Side Date Arithmetic (§13 Classification)

| Location | Calculation | Classification |
|---|---|---|
| `src/components/Schedule/ScheduleContainer.tsx:835,847` | `planned_end = start + durationHours × 3600000`, then **persisted** | ❌ **Business truth — must move to M11** |
| `src/components/planning/ActivityPlanningGrid.tsx:184,189` | `d.setDate(d.getDate() + days - 1)` finish-from-duration | ❌ **Business truth** |
| `src/components/planning/ActivityPlanningGrid.tsx:208-209,233-234` | Defaults planned dates to `new Date()` | ❌ Fabricates planning data |
| `src/components/Schedule/ScheduleGantt.tsx:128` | Timeline axis tick generation | ✅ Display helper |
| `src/components/planner-workspace/WorkspaceGantt.tsx:96-118` | Viewport window + pixel offsets | ✅ Display helper |
| `src/components/Schedule/ResourceHistogram.tsx:50,55` | Histogram window ±7/90 days | ✅ Display helper |
| `src/components/planner-workspace/resources/ResourceAvailabilityMatrix.tsx:59` | Column iteration | ✅ Display helper |
| `src/components/Workpack/GanttChart.tsx:90` | `d.setDate(1)` month bucket | ✅ Display helper |

Neither business-truth calculation applies a calendar, so the browser can produce
a finish date on a holiday that CPM would never generate.

---

## 10. Execution → Actuals Propagation

M12 is a genuine single authority for actuals — `ExecutionWriteService` is the
only writer of `actual_start`/`actual_end` (`:267,283,286,299,303`), and an
execution-field allow-list (`src/core/execution/executionFieldGuard.ts`) rejects
attempts to smuggle planning fields through execution routes (verified by
`m12-final-balance.test.ts:26`).

Two concerns:

1. **Planned leaks into actual.** `ExecutionWriteService:303` sets
   `updates.actual_start = existing.planned_start || executionDate` when
   completing an activity that never recorded a start. That writes a *planning*
   value into an *execution* fact. Classified **R1-P2-011**.
2. **Time is lost regardless**, because `actual_start` is `@db.Date` (§6). A
   09:42 START is stored as a bare date, so "Bundle Pullout START = 10-Apr-2027
   14:00" cannot be represented. R1-T09/T10 can pass for *ownership* but not for
   *fidelity*.

---

## 11. Recalculation Trigger Coverage (§11)

| Trigger | Wired to M11? | Evidence |
|---|---|---|
| Activity create | ✅ | `ActivityService.createActivity` → `enqueueRecalculate` (`:114`) |
| Activity update (duration/dates) | ✅ | `:145` |
| Activity delete | ✅ | `:166` |
| Approve for scheduling | ✅ | `:213` |
| Resource leveling apply | ✅ | `ResourceLevelingApplyService` step 2 |
| **Relationship add/change/delete** | ❌ **Not found** | No `enqueueRecalculate` call in any relationship write path |
| **Lag change** | ❌ Not found | Same — lag lives on `ActivityRelationship` |
| **Calendar change** | ❌ Not found | No recalculation on `ScheduleCalendar` update |
| **Constraint change** | ❌ n/a | No CPM constraint field exists |
| Workpack sequence change | ❌ Not found | `reorderActivities` (`ActivityService:171`) does **not** enqueue |

This is the brief's "inert *Save predecessor*" concern, confirmed: **changing
logic or lag does not trigger CPM.** Classified **R1-P1-018**.

---

## 12. Defect Register

Severity per the brief: P0 = authority/release blocker; P1 = material operational
defect; P2 = non-blocking; P3 = documentation.

### P0

| ID | Defect | Evidence |
|---|---|---|
| **R1-P0-001** | **No planned-date authority.** M11 writes `early_*`; UI/execution/reports read `planned_*`. The two never reconcile. | `ScheduleOrchestrationService:173-190` vs `FieldExecutionService:329-330` |
| **R1-P0-002** | `actual_start`/`actual_end` are `@db.Date` — execution time-of-day is physically unstorable. | `schema:27-28` |
| **R1-P0-003** | `planned_start`/`planned_end` are `@db.Date` — planning time-of-day unstorable. | `schema:25-26` |
| **R1-P0-004** | CPM ignores working days, holidays and shifts; naive 24-hour arithmetic; `addWorkingDays` never called by M11. | `scheduleEngine:96-99`; `ScheduleOrchestrationService:167` |
| **R1-P0-005** | Lag is integer **days**; parser silently converts `+2h` into 2 days (24× error). | `schema:267`; `scheduleEngine:452-456` |
| **R1-P0-006** | Browser computes and persists `planned_end` — a client-side date engine producing business truth. | `ScheduleContainer:835,847`; `ActivityPlanningGrid:184,189` |

### P1

| ID | Defect | Evidence |
|---|---|---|
| **R1-P1-007** | Resource leveling writes `planned_*`, which CPM ignores for any activity with a predecessor — levelling silently has no schedule effect. | `ResourceLevelingApplyService:118-124`; `scheduleEngine:251-262` |
| **R1-P1-008** | Unguarded planned-date writes via `POST /api/activities` and the legacy Project activities route. | `app/api/activities/route.ts:64-65`; `app/api/projects/[id]/schedule/activities/route.ts:28` |
| **R1-P1-009** | CPM truncates all outputs to date-only strings, so even timestamp-capable `early_*` columns always hold midnight. | `scheduleEngine:398-401,428-429` |
| **R1-P1-010** | No `forecast_start`/`forecast_finish` anywhere — Forecast cannot be distinguished from Current Plan, as §17 requires. | Schema-wide absence |
| **R1-P1-018** | Relationship, lag, calendar and sequence changes do not trigger M11 recalculation. | §11 |

### P2

| ID | Defect | Evidence |
|---|---|---|
| R1-P2-011 | `actual_start` falls back to `planned_start`, mixing a planning value into an execution fact. | `ExecutionWriteService:303` |
| R1-P2-012 | No CPM constraint model on `Activity` (no `constraint_type`/`constraint_date`). | `schema:9-83` |
| R1-P2-013 | No hold-start / resume / delay timestamps; only free-text `hold_point_*`. | `schema:34-35` |
| R1-P2-014 | `Activity.remaining_duration` is a second, ungoverned duration field. | `schema:52` |
| R1-P2-015 | `CalendarEngine.isWorkingDay` keys exceptions on a **UTC** date string — wrong local day for non-UTC sites. | `CalendarEngine.ts:23` |
| R1-P2-016 | Free float computed without regard to relationship type. | `scheduleEngine:363-371` |
| R1-P2-017 | `ScenarioCalculationService` maps `early_start → planned_start` — the very mapping M11 lacks, creating inconsistent semantics between scenario and live schedule. | `ScenarioCalculationService:120` |
| R1-P2-019 | `Workpack.planned_start_date`/`planned_end_date` are independent of child Activity dates — no roll-up. | `schema:109-110` |
| R1-P2-020 | Baseline immutability is not enforced at schema level. | `schema:608-633` |

### P3

| ID | Defect |
|---|---|
| R1-P3-021 | Schema comment on `total_float` documents hours, but `free_float` (a `Float?`) carries no unit documentation despite also being hours. |

---

## 13. Data-Lineage Acceptance Criterion (§26)

The brief requires clear answers per fact. Applying it to the pivotal fact:

**Fact: Activity Planned Start**

| Question | Answer |
|---|---|
| Where is it first entered? | Activity Editor, Planning Grid (defaulted to *today*), `POST /api/activities`, import, or `ActivityCreationCommand` |
| Where is it stored? | `Activity.planned_start`, Postgres `date` |
| Who owns it? | **Nobody.** Five writers, no authority |
| How does the next phase obtain it? | Direct read of `planned_start` — *not* from CPM output |
| Can a downstream user edit it? | Yes, from multiple surfaces |
| If yes, why? | No governed reason; it is an ordinary editable column |
| Does the downstream edit create a new fact or overwrite? | **Overwrites**, with no audit except in the leveling path |

**Per §26, "if these answers cannot be given clearly, the item is not R1.0
complete."** Planned Start fails this criterion outright. It is the single item
that most defines R1.0.

---

## 14. Confirmed-Sound Foundations

Not everything is broken. R1.0 can build on:

- **One CPM engine.** `calculateSchedule` is the only CPM implementation; the
  R0.4 guard enforces a single enqueue chokepoint.
- **Correct relationship algebra.** FS/SS/FF/SF are correctly implemented in both
  passes — only the lag *unit* is wrong.
- **Cycle detection.** Kahn's algorithm with explicit `SCHEDULE_CYCLE_DETECTED`
  and cycle node reporting (`scheduleEngine:199-223`).
- **One actual-time authority.** M12 `ExecutionWriteService`, protected by an
  execution-field allow-list.
- **Calendar model already exists** with `work_days`, `hours_per_day`,
  `exceptions`, 3-tier resolution, and a working `addWorkingDays` — it simply
  isn't connected.
- **Float unit already canonicalised** to hours, with a schema comment.
- **Event authority intact** from R0.4 — CPM is Event-scoped, tenant-checked.

Consistent with the prior E2E audit's conclusion, most of R1.0 is **connecting
components that already exist correctly**, plus two genuine schema migrations
(time-of-day and lag units).

---

## 15. Scope Discipline (§28)

Observed but **deliberately not addressed**, as they are capability expansion:

- No new AI/WhatsApp/Voice/mobile capability was designed.
- No new CPM algorithm is proposed beyond connecting the calendar and fixing lag
  units — both required to fix existing authority.
- No new progress, EVM, reporting, Control Tower or management-intelligence
  feature.
- Resource levelling *algorithm* is untouched; only its planned-date write path is
  identified as a defect.

---

## 16. Next Step

Design decisions for every defect above are recorded in
`docs/AURIANOA_R1.0_TIME_AUTHORITY_DECISION.md`.

Implementation remains **gated** until R0.4-XX is verified GREEN on a working
runner, per §0.
