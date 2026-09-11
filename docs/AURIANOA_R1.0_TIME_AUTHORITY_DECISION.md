# AURIANOA R1.0 — TIME AUTHORITY DECISION

**Phase:** R1.0 — Time & Planning Propagation Foundation
**Type:** Architecture decision record. **No code was modified.**
**Date:** 2026-09-09
**Companion audit:** `docs/AURIANOA_R1.0_TIME_DATA_LINEAGE_AUDIT.md`
**Implementation status:** **GATED — NOT STARTED**

---

## 0. Status of This Document

This records the decisions R1.0 implementation must follow. It is **not** an
implementation report. Implementation is blocked by the gate in the R1.0 brief:
R0.4-XX is AMBER because no test, regression, database or browser verification
could be executed (the environment's shell will not run any command, including a
builtin). `docs/AURIANOA_R1.0_IMPLEMENTATION_RESULT.md` is deliberately **not
created** — there is no implementation to report.

Decisions below are numbered **D-1 … D-14** and map onto the defects
**R1-P0-001 … R1-P3-021** from the audit.

---

## 1. D-1 — Planned Dates Become M11-Derived (fixes R1-P0-001)

### Decision

`Activity.planned_start` and `Activity.planned_end` become **M11-derived outputs**.
M11 becomes their sole writer. They stop being planner-editable fields.

### Rationale

Three candidate architectures were considered:

| Option | Description | Verdict |
|---|---|---|
| **A** | UI reads `early_*` directly; retire `planned_*` | ❌ Rejected — ~40 consumer sites read `planned_*` (execution, readiness, EVM, reports, M15, M16, materials, health); a rename of that blast radius is a migration, not an authority fix, and it discards the semantic distinction between *the plan* and *the earliest possible dates* |
| **B** | M11 writes `planned_*` from its CPM result; `early_*` remains the internal CPM representation | ✅ **Selected** |
| **C** | Add new `schedule_start`/`schedule_finish` columns | ❌ Rejected — creates a *third* date pair, worsening the very problem R1.0 exists to fix |

Option B is also the pattern **already proven inside this codebase**:
`ScenarioCalculationService:120` maps `early_start → planned_start`. R1.0
generalises an existing, working mapping rather than inventing one. It satisfies
the brief's §5 allowance that "the exact internal CPM representation may remain if
required by the engine, but there must be a single authoritative mapping."

### Required mapping

M11 persistence (`ScheduleOrchestrationService:173-190`) must be extended so that
one transaction writes:

```
planned_start  ← calculated early_start   (authoritative plan)
planned_end    ← calculated early_finish
early_start    ← calculated early_start   (CPM internal, retained)
early_finish   ← calculated early_finish
late_start / late_finish / total_float / free_float / is_critical  (unchanged)
```

### Consequence for the CPM input contract

`planned_start` currently doubles as a *planner input* for activities without
predecessors (`scheduleEngine:251-262`). Once M11 owns the field, that input must
move to an explicit constraint — see **D-8**. Reading and writing the same column
is precisely what makes the current authority undefined, and it must not survive.

### Invariant to enforce

> `Activity.planned_start` / `planned_end` have exactly one writer:
> `ScheduleOrchestrationService`.

All five other writers identified in audit §4 must be removed or redirected
(**D-2**, **D-6**, **D-7**).

---

## 2. D-2 — Planner Inputs vs Derived Outputs (§10)

### Decision

A strict, enforced split.

**Planner may enter (inputs):**

| Input | Field |
|---|---|
| Duration | `Activity.duration_hours` |
| Predecessor / successor | `ActivityRelationship` |
| Relationship type | `ActivityRelationship.relationship_type` |
| Lag | `ActivityRelationship.lag_minutes` (**new** — D-4) |
| Calendar assignment | `Event.calendar_id`, optional activity override (D-5) |
| Constraint | `Activity.constraint_type` + `constraint_at` (**new** — D-8) |
| Resource assignment | `ActivityResource` |
| Approved override | Governed, audited (D-8) |

**M11 derives (outputs — read-only everywhere else):**

`planned_start`, `planned_end`, `early_*`, `late_*`, `total_float`, `free_float`,
`is_critical`, project start/finish, schedule health.

### Enforcement

Mirror the mechanism M12 already uses successfully. `executionFieldGuard`
(`src/core/execution/executionFieldGuard.ts`) rejects planning fields on execution
routes. R1.0 adds the symmetric guard — a **planning-field allow-list** that
rejects `planned_start`, `planned_end`, `early_*`, `late_*`, `total_float`,
`free_float`, `is_critical` on any non-M11 write path, returning an explicit
`SCHEDULE_DERIVED_FIELD` rejection.

This reuses a proven in-repo pattern rather than introducing a new mechanism.

---

## 3. D-3 — Time-of-Day Model (fixes R1-P0-002, R1-P0-003, R1-P1-009)

### Decision

Migrate operational schedule fields from `date` to **`timestamptz`**, and stop
truncating in the engine. Both changes are required; either alone is insufficient.

### Field classification (as §6 requires)

| Field | Current | Target | Class |
|---|---|---|---|
| `Activity.planned_start` | `@db.Date` | **`timestamptz`** | Timestamp |
| `Activity.planned_end` | `@db.Date` | **`timestamptz`** | Timestamp |
| `Activity.actual_start` | `@db.Date` | **`timestamptz`** | Timestamp |
| `Activity.actual_end` | `@db.Date` | **`timestamptz`** | Timestamp |
| `Activity.early_start` / `early_finish` / `late_start` / `late_finish` | `timestamp` | **`timestamptz`** | Timestamp |
| `Activity.constraint_at` (new) | — | **`timestamptz`** | Timestamp |
| `Activity.duration_hours` | `Decimal(8,2)` | unchanged | **Duration** |
| `ActivityRelationship.lag_minutes` (new) | — | `Int` | **Lag** |
| `ScheduleCalendar.work_days` / `hours_per_day` / `exceptions` / shifts | JSON/Int | unchanged + shifts (D-5) | **Calendar-relative** |
| `Event.planned_start` / `planned_end` | `@db.Date` | **`timestamptz`** | Timestamp (campaign window drives CPM day-zero) |
| `BaselineActivity.*` | `timestamp` | **`timestamptz`** | Timestamp (snapshot) |
| `Workpack.planned_start_date` / `planned_end_date` | `@db.Date` | **Date only** — or derived (D-12) | Date only |
| `MaterialConstraint.constraint_date` | `@db.Date` | **`timestamptz`** if it is to influence CPM (D-8) | Timestamp |
| `ProgressLog.log_date`, `platform_usage.period_date`, safety/permit/punch/certificate dates | `@db.Date` | **unchanged** | Date only |

Per the brief's "do not blindly convert every historical field", only fields on
the operational schedule and execution path are migrated. Reporting-period and
administrative dates stay `date`.

### Engine change

Remove every `.toISOString().slice(0, 10)` from `scheduleEngine.ts`
(`:398-401`, `:417-420`, `:428-429`) and carry full instants. Otherwise the schema
migration buys nothing, because CPM would still emit midnight.

### Timezone

`timestamptz` stores an absolute instant; site-local presentation uses the existing
site timezone already handled by `DateTimePicker`
(`src/components/Schedule/DateTimePicker.tsx` — "Decompose a Date into
site-timezone components"). Calendar day/holiday resolution must switch from UTC
keys to site-local keys (**D-5**, fixing R1-P2-015).

### Migration safety (§23)

No destructive change. Sequence: **census → widen column → backfill → verify →
switch reads → verify → only then consider removing anything.** `date → timestamptz`
is a widening conversion; existing values become local midnight, which is
semantically what they already meant. Rollback is a narrowing cast, losing only
time-of-day added after the migration.

---

## 4. D-4 — Lag Model (fixes R1-P0-005)

### Decision

Canonical lag unit = **minutes**, in a new `ActivityRelationship.lag_minutes Int`,
supporting negative values.

- Add `lag_minutes`; backfill **`lag_minutes = lag_days × 1440`**.

  > **Correction (R1.0-C review).** An earlier revision of this decision specified
  > `lag_days × hours_per_day × 60` on the reasoning that lag on a working calendar
  > means working time. That is wrong as a *migration* rule and would have silently
  > reinterpreted every existing lag value.
  >
  > Today's engine adds lag to day-offsets where one offset unit is 24 wall-clock
  > hours (`addDays` uses `days * 24 * 60 * 60 * 1000`, `scheduleEngine:96-99`).
  > So an existing `lag_days = 1` currently means **1440 wall-clock minutes**.
  > `×1440` therefore preserves observed behaviour exactly; the working-time
  > conversion would change the meaning of stored data during a migration whose
  > only job is to change its unit.
  >
  > Whether *new* lag is authored as working or calendar time is a separate
  > product decision to be taken in R1.0-D alongside calendar integration, and it
  > must not be smuggled into the backfill.
- Retain `lag_days` temporarily as legacy/compatibility, read-only, then retire per
  D-13.
- Fix `parsePredecessorString` to honour the unit suffix: `d` → days×hours/day×60,
  `h` → ×60, `m` → ×1, bare number → days. The current silent 24× error
  (`scheduleEngine:452-456`) must become impossible.
- UI may display `FS + 2h`; storage and computation use minutes.

Relationship *algebra* needs no change — FS/SS/FF/SF are already correct in both
passes.

---

## 5. D-5 — Calendar Becomes Part of CPM (fixes R1-P0-004, R1-P2-015)

### Decision

`scheduleEngine.calculateSchedule` accepts a **calendar interface** instead of a
bare `working_hours_per_day` scalar, and all date advancement goes through it.

```
interface ScheduleCalendarPort {
  addWorkingTime(from: Date, minutes: number): Date;
  workingMinutesBetween(a: Date, b: Date): number;
  isWorkingTime(at: Date): boolean;
  hoursPerDay(): number;
}
```

- `CalendarEngine` is promoted from day-granularity to **minute-granularity** and
  implements this port. `addWorkingDays` is retained for existing callers.
- `ScheduleOrchestrationService:167` passes the resolved calendar object, not
  `calendar.getHoursPerDay()`. The three-tier resolution
  (event → org default → fallback) already works and is kept.
- Duration is consumed as **working minutes**, so `duration_hours = 8` spans a
  break or a holiday correctly instead of assuming 8 contiguous hours.
- Exception/holiday keys move from UTC to **site-local** dates.
- Shift support is the calendar's concern (working windows within a day), not a
  new CPM concept.

The governing calendar must be explicitly identifiable in the CPM result — the
brief's "TA-2027 Shutdown Calendar must be the calendar governing its activities".
`EventScheduleResult` therefore carries the resolved `calendar_id` and its
resolution tier, so a planner can see *which* calendar produced a date.

### Explicitly not in scope

No new scheduling *algorithm*. Forward pass, backward pass, float and critical path
logic are unchanged; only the date arithmetic primitive changes. This is the
minimum required to fix existing authority, as §28 permits.

---

## 6. D-6 — No Client-Side Business Date Engine (fixes R1-P0-006)

### Decision

- `ScheduleContainer.tsx:835,847` must stop computing and sending `planned_end`.
  The client sends the **input** that changed (`duration_hours` or a constraint);
  M11 returns derived dates.
- `ActivityPlanningGrid.tsx:184,189` finish-from-duration arithmetic is removed;
  `:208-209,233-234` must stop defaulting planned dates to *today* — new rows carry
  no dates until M11 derives them.
- Display-only helpers are **retained and documented** as such: `ScheduleGantt:128`,
  `WorkspaceGantt:96-118`, `ResourceHistogram:50,55`,
  `ResourceAvailabilityMatrix:59`, `GanttChart:90`. These compute pixel offsets and
  axis ticks, never persisted values.

### Invariant

> The browser may lay out dates. It may never originate or persist one.

---

## 7. D-7 — Resource Leveling Becomes a Governed Input (fixes R1-P1-007)

### Decision

`ResourceLevelingApplyService` stops writing `planned_start`/`planned_end`
(`:118-124`). A levelling decision becomes an **explicit constraint** (D-8) plus a
recalculation request:

```
levelling recommendation accepted
  → persist Activity.constraint_type = 'START_NO_EARLIER_THAN'
            Activity.constraint_at   = proposed_start        (audited)
  → request M11 recalculation
  → M11 honours the constraint for ALL activities, not only roots
  → M11 writes planned_*
```

This fixes the silent-override defect: today a levelled activity with a predecessor
has its `planned_start` overwritten while CPM ignores it entirely. Expressed as a
constraint, the levelling decision actually binds — and remains visible and
auditable rather than being indistinguishable from a manual date edit.

The existing audit-log write is kept and extended with the constraint identity.

---

## 8. D-8 — Constraint Model (§18, fixes R1-P2-012)

### Decision

Add a first-class CPM constraint to `Activity`:

| Field | Purpose |
|---|---|
| `constraint_type` | enum: `START_NO_EARLIER_THAN`, `START_NO_LATER_THAN`, `FINISH_NO_EARLIER_THAN`, `FINISH_NO_LATER_THAN`, `MUST_START_ON`, `MUST_FINISH_ON`, `AS_LATE_AS_POSSIBLE` |
| `constraint_at` | `timestamptz` |
| `constraint_source` | `PLANNER`, `RESOURCE_LEVELING`, `MATERIAL`, `PERMIT`, `IMPORT` |
| `constraint_reason` | text |
| `constraint_owner_id` | user |
| `constraint_status` | `ACTIVE`, `SUPERSEDED`, `WAIVED` |
| created/updated metadata | audit |

This satisfies §18's required attribute set (type, date/time, source, reason,
owner, status, metadata) and replaces the current implicit "`planned_start` on a
root activity acts as a constraint" behaviour with something explicit and
universal.

CPM honours constraints in the forward and backward passes for **all** activities.

`MaterialConstraint.constraint_date` becomes a *source* that proposes an Activity
constraint through this one model, so material availability influences the schedule
without `MaterialScheduleIntegrationService` inventing its own date logic
(`:99-123` currently emits adjusted dates as a DTO). Control Tower and Reports must
never contain independent date logic, per §18.

---

## 9. D-9 — Recalculation Trigger Chain (fixes R1-P1-018)

### Decision

Every schedule-relevant mutation routes through the existing Event-authoritative
enqueue chokepoint established in R0.4
(`enqueueEventScheduleRecalculate`) — R1.0 adds **no second trigger mechanism**.

| Trigger | Current | R1.0 |
|---|---|---|
| Activity create / update / delete / approve | ✅ Wired | Keep |
| Resource leveling apply | ✅ Wired | Keep (via D-7) |
| **Relationship add / change / delete** | ❌ Missing | **Add** |
| **Lag change** | ❌ Missing | **Add** |
| **Calendar change** (`ScheduleCalendar` update) | ❌ Missing | **Add** — fan out to every Event using that calendar |
| **Constraint change** | n/a | **Add** |
| **Workpack sequence change** (`reorderActivities`) | ❌ Missing | **Add** |

"Save predecessor" must never again be inert.

### Propagation shape (§12)

EventBus remains an orchestration mechanism, never an authority. No business
calculation moves into an event handler:

```
Planner changes an input (duration | logic | lag | calendar | constraint)
        ↓  governed planning command — validates, authorizes, audits
persist planning INPUT only
        ↓  schedule-relevant domain event
enqueueEventScheduleRecalculate  (Event + org scoped — R0.4 chokepoint)
        ↓
M11 ScheduleOrchestrationService → calculateSchedule (calendar-aware)
        ↓  one transaction
persist derived schedule (planned_*, early_*, late_*, float, critical)
        ↓  read-only
M12 · M8.13 · M8.10 · M13 · M14 · M15 · M16
```

---

## 10. D-10 — Schedule → Execution, Execution → Actuals (§14, §15, §16)

### Decisions

1. **M12 consumes, never copies.** Execution reads `planned_start`, `planned_end`,
   `duration_hours`, logic, float and criticality from the M11 authority. It does
   not mirror them into execution-specific columns. `FieldExecutionService:329-330`
   already reads `planned_*` — after D-1 those values are finally M11-derived, so
   this path becomes correct without change beyond removing `.slice(0,10)`
   truncation.

2. **M12 remains the sole actual-time authority.** Confirmed already true
   (`ExecutionWriteService`). R1.0 preserves it and removes the planned-into-actual
   fallback at `:303` (**R1-P2-011**): if an activity completes with no recorded
   start, the actual start is the recorded execution instant or an explicit
   backdated entry — never a copied planning value.

3. **Actuals never silently become planned dates.** No write path from
   `actual_*` to `planned_*`. Reforecast is governed:

```
M12 actual (or variance signal)
   ↓
explicit, authorized reforecast request
   ↓
M11 recalculation
   ↓
new planned_* and/or forecast_* — baseline untouched
```

4. **Add hold / resume / delay timestamps** (**R1-P2-013**). M12-owned:
   `hold_started_at`, `hold_released_at`, and delay attribution linked to the
   existing `ConstraintLog`. Today only free-text `hold_point_*` exists, so a hold
   cannot be measured.

---

## 11. D-11 — Four Distinct Date Sets (§17, fixes R1-P1-010, R1-P2-020)

### Decision

Make all four explicit and non-overwriting:

| Value | Storage | Owner | Mutability |
|---|---|---|---|
| **Baseline** | `BaselineActivity.planned_start` / `planned_finish` | `ScheduleBaseline` | **Immutable once frozen** |
| **Current plan** | `Activity.planned_start` / `planned_end` | **M11** (D-1) | Recalculated |
| **Actual** | `Activity.actual_start` / `actual_end` | **M12** | Append-only in practice |
| **Forecast** | `Activity.forecast_start` / `forecast_finish` (**new**) | M11 governed reforecast | Recalculated |

Baseline immutability must be **enforced**, not assumed: a frozen
`ScheduleBaseline` rejects writes to its `BaselineActivity` rows at the service
layer, with the freeze state as the guard. The audit could not verify any current
enforcement (R1-P2-020).

`forecast_*` does not exist today, which is why "Forecast Finish" cannot be
distinguished from "Current Planned Finish" — a §17 requirement.

---

## 12. D-12 — Duration and Roll-Up (§7, fixes R1-P2-014, R1-P2-019)

### Decisions

- **One duration:** `Activity.duration_hours` remains canonical. `duration_days`
  stays a *computed* value (`duration_hours / hoursPerDay`), never a column.
  A UI showing "2 days 4 hours" derives it.
- `Activity.remaining_duration` (**R1-P2-014**) is classified **legacy** pending
  census: either derive it from `duration_hours × (1 − progress)` or retire it. No
  independently editable second duration survives.
- `Workpack.planned_start_date` / `planned_end_date` (**R1-P2-019**) become
  **derived roll-ups** (min child `planned_start`, max child `planned_end`) rather
  than independently entered dates, or are retired if no consumer needs them.
  `PlanningReadinessService:536-537` is the consumer to migrate.

---

## 13. D-13 — Field Retirement Discipline (§23)

No field is deleted in R1.0. Each is first classified, and only then migrated:

| Field | Classification | Action |
|---|---|---|
| `Activity.early_*` / `late_*` | **Derived (CPM internal)** | Retain — they are the engine's representation |
| `Activity.planned_*` | **Authoritative (post-D-1)** | Becomes M11-written |
| `ActivityRelationship.lag_days` | **Compatibility** | Read-only after backfill, retire later |
| `Activity.remaining_duration` | **Legacy** | Census, then derive or retire |
| `Workpack.planned_*_date` | **Duplicate** | Derive or retire |
| `BaselineActivity.*` | **Historical snapshot** | Immutable |
| `Activity.project_id` | **Legacy** | Already non-authoritative (R0.4) |
| `Activity.p6_object_id` / `p6_activity_id` | **External interchange** | Retain |

Required before any destructive step: census, dependency analysis, migration plan,
backfill, verification, rollback strategy.

---

## 14. D-14 — Import Is a Proposal, Not an Authority (§22)

### Decision

External schedule data (P6 / MS Project / Excel) is **never** written directly to
authoritative fields:

```
P6 / Excel planned dates, durations, logic, actuals
        ↓
staged import revision  (source, revision, timestamp, user, mapping,
                         validation, rejected-row reasons, audit)
        ↓
classified: planning INPUT (duration, logic, lag, calendar, constraint)
            vs INFORMATIONAL (external planned dates)
            vs EXECUTION FACT (actuals → M12 governed path)
        ↓
M11 recalculation
```

An imported external planned date does **not** overwrite `Activity.planned_start`
unless a governed decision explicitly promotes it to a constraint. The existing
`schedule_import_jobs` model (`schema:2481`) is the staging foundation;
`Activity.schedule_source` (`schema:55`) already records provenance
(`'workpack' | 'imported'`) and must be honoured by the planning-field guard
(D-2).

---

## 15. Authority Guard Plan (§25)

R1.0 extends the existing R0.4 architectural guard rather than creating a second
guard mechanism. It must remain evidence-based and allow-listed, never a crude
string ban.

**Forbidden (guard fails):**

| Rule | Detection |
|---|---|
| UI → CPM | No `calculateSchedule` import in `src/components/**` or `app/**` client code |
| UI → planned-date mutation | No `planned_start`/`planned_end` in any client-persisted payload |
| Non-M11 planned-date write | `planned_start:` in a Prisma write outside `ScheduleOrchestrationService` |
| M13/M14/M15/M16 → CPM | No `calculateSchedule` / `calculateEventSchedule` import in those layers |
| M16 → Prisma | Already guarded (`m16-r1-authority`, `m16-r3`, `m16-r4`) — keep |
| M13/M14/M15 → progress calculation | No progress arithmetic outside M8.13 |
| Second CPM engine | `calculateSchedule` defined exactly once |
| Second planned-date writer | Exactly one writer |
| Client-side business date arithmetic | Date arithmetic in components confined to the documented display-helper allow-list (audit §9) |

**Required (guard asserts presence):**

Schedule change → M11 · execution fact → M12 · progress → M8.13 · EVM → M8.10 ·
reporting → M14 · management intelligence → M15 · AI interaction → M16.

---

## 16. Test Plan (§19, §20, §24)

All 20 required behavioural tests map to defects. Their **current** expected
outcome against today's code — which is why implementation must precede any GREEN
claim:

| Test | Assertion | Today |
|---|---|---|
| R1-T01 | Duration change → schedule changes | ⚠️ `early_*` changes; `planned_*` does not |
| R1-T02 | Predecessor change → successor schedule changes | ❌ No recalculation trigger (R1-P1-018) |
| R1-T03 | FS + lag | ⚠️ Logic correct, unit wrong (R1-P0-005) |
| R1-T04/05/06 | FF / SS / SF | ⚠️ Same |
| R1-T07 | Calendar affects schedule | ❌ Calendar ignored (R1-P0-004) |
| R1-T08 | Time-of-day preserved | ❌ Blocked twice (schema + engine truncation) |
| R1-T09/T10 | Actuals only via M12 | ✅ Ownership holds; ❌ fidelity lost to `@db.Date` |
| R1-T11 | Baseline unchanged after execution | ⚠️ No enforcement verified |
| R1-T12/13/14 | Control Tower / Reports / M15 read authority | ⚠️ They read `planned_*`, which no authority writes |
| R1-T15 | M16 cannot calculate schedule | ✅ Guarded since M16-R1 |
| R1-T16/17 | Cross-tenant / cross-event rejected | ✅ Holds (R0.4 evidence) |
| R1-T18 | No second CPM engine | ✅ Holds |
| R1-T19 | No second planned-date writer | ❌ **Five writers, none of them M11** |
| R1-T20 | No downstream manual re-entry | ❌ Planned dates are manually entered |

**Golden Test Case (§20)** — HX-101 / WP-HX-101, six activities, five FS links,
TA-2027 calendar — is the correct acceptance vehicle and **cannot pass today**:
`Bundle Pullout START = 10-Apr-2027 14:00` is truncated to `2027-04-10` by
`actual_start @db.Date`, and the calendar has no effect on any derived date.

---

## 17. Recommended Implementation Sequence

Ordered so each step is independently verifiable and reversible:

| Step | Work | Unblocks |
|---|---|---|
| **0** | **Verify R0.4-XX GREEN on a working runner** | The gate itself |
| 1 | Census of all time fields (row counts, null rates, time-component presence) | Safe migration |
| 2 | Widen operational fields to `timestamptz`; backfill; verify | R1-T08 |
| 3 | Remove `.slice(0,10)` truncation from `scheduleEngine` | R1-T08 |
| 4 | Add `lag_minutes`; backfill; fix the parser unit bug | R1-T03…T06 |
| 5 | Promote `CalendarEngine` to minute granularity; inject the calendar port into CPM | R1-T07 |
| 6 | Add the constraint model; move root-activity `planned_start` input onto it | D-1 prerequisite |
| 7 | **M11 writes `planned_*`**; add the planning-field guard | R1-T01, T19, T20 |
| 8 | Remove client-side date persistence; redirect resource levelling to constraints | R1-P0-006, R1-P1-007 |
| 9 | Complete the recalculation trigger chain (logic, lag, calendar, sequence) | R1-T02 |
| 10 | Add `forecast_*`; enforce baseline immutability | R1-T11 |
| 11 | Behavioural tests R1-T01…T20 + Golden Test Case | Acceptance |
| 12 | Authority guards | Regression protection |

Step 7 is the pivot: it is small in code and total in consequence, and it is unsafe
before steps 2–6 because M11 would otherwise start writing date-only, calendar-
blind, lag-wrong values into the fields the entire product trusts.

---

## 18. Final E2E Acceptance Question (§29)

> "Can a planner enter a planning fact once, have M11 automatically derive the
> required schedule dates using the correct calendar and logic, have those dates
> automatically appear in execution and all downstream intelligence, and have
> execution actuals entered once through M12 propagate automatically to M8.13,
> M13, M14, M15 and M16 without duplicate manual entry or competing calculation
> engines?"

## **NO**

### Why

The **second half is largely true**; the **first half is not**, and the question
requires both.

**What works.** M12 is a genuine single authority for actuals, protected by an
execution-field allow-list, and its values do flow to progress, EVM, Control
Tower, reports, M15 and M16 without re-entry. There is exactly one CPM engine and
one EVM engine, Event authority is intact from R0.4, and the four relationship
types are correctly implemented.

**What fails, specifically:**

1. **M11 does not derive the dates the product uses.** CPM writes `early_*`; the
   UI, execution, readiness, reports, M15 and M16 all read `planned_*`, and M11
   never writes it (`ScheduleOrchestrationService:173-190`). The planner's derived
   schedule and the displayed schedule are disconnected value sets.

2. **The planner must still type planned dates,** which is the exact duplicate
   manual entry the principle forbids. Five writers touch `planned_*`; none is
   M11.

3. **The calendar is not applied.** Only `hours_per_day` reaches the engine, which
   advances dates by literal 24-hour arithmetic. A shutdown calendar's holidays
   and working days have no effect, so "using the correct calendar" is false today.

4. **Time-of-day cannot exist.** `planned_*` and `actual_*` are Postgres `date`
   columns, and the engine truncates to 10 characters regardless. A 14:00 start is
   unrepresentable.

5. **Competing calculation engines exist.** The browser computes and persists
   `planned_end` (`ScheduleContainer:835,847`), and resource levelling writes
   `planned_*` that CPM then ignores for any activity with a predecessor.

6. **Logic changes do not propagate.** Adding or changing a predecessor, lag,
   calendar or sequence triggers no recalculation — the brief's "inert *Save
   predecessor*", confirmed in code.

The encouraging part: nearly every missing piece already exists in correct form
somewhere in the repository — `CalendarEngine.addWorkingDays`, the
`early_start → planned_start` mapping in `ScenarioCalculationService`, the
execution-field guard pattern, the Event-scoped enqueue chokepoint, cycle
detection, three-tier calendar resolution. R1.0 is predominantly **connection
work plus two schema migrations**, not new invention.

---

## 19. R1.0 Gate Status (§30)

| Gate criterion | Status |
|---|---|
| P0 = 0 | ❌ **6 P0 defects** |
| P1 = 0 | ❌ **5 P1 defects** |
| One planned-date authority | ❌ None |
| One CPM authority | ✅ |
| One calendar authority | ⚠️ Exists but not applied |
| One actual-time authority | ✅ M12 |
| One progress authority | ✅ M8.13 |
| No client-side business date engine | ❌ Two found |
| No duplicate downstream date entry | ❌ |
| Time-of-day works | ❌ |
| Lag works | ❌ Wrong unit + 24× parser bug |
| Calendar works | ❌ |
| Automatic recalculation works | ⚠️ Partial — activity yes, logic/lag/calendar no |
| Baseline protected | ⚠️ Unverified |
| Event authority intact | ✅ |
| Tenant / event isolation | ✅ (static; behaviourally unproven) |
| Behavioural tests pass | ❌ Not run — environment |
| Regression passes | ❌ Not run — environment |
| DB verification passes | ❌ Not run — environment |
| Browser verification | ❌ Not run — environment |

### **R1.0 STATUS: NOT STARTED — BLOCKED**

Blocked by two independent conditions:

1. **The R0.4-XX gate.** R0.4 is AMBER because no verification could be executed.
   The brief forbids starting R1.0 implementation until it is GREEN.
2. **Environment.** Even were the gate open, R1.0's own §24 mandates behavioural
   tests, and §30 forbids declaring GREEN from static inspection. Neither is
   possible without a working shell.

No GREEN is claimed. No implementation was performed. The environment limitation
is stated separately from product status, as §30 requires: **product status is
that R1.0 has 6 P0 and 5 P1 defects to remediate; environment status is that
nothing can currently be executed to verify any remediation.**
