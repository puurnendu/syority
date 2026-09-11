# AURIANOA R1.0-C — PHASE C0 TIME IMPLEMENTATION PRECHECK

**Phase:** R1.0-C / C0 — final forensic precheck before any schema or migration work
**Date:** 2026-09-10
**Mode:** READ-ONLY. No schema change, no migration, no DDL, no DML, no cleanup, no backfill.
**Inputs:** `docs/AURIANOA_R1.0_C_TIME_FOUNDATION_IMPLEMENTATION_RESULT.md` (inventory),
`docs/AURIANOA_M12_EXECUTION_FACT_INTEGRITY_FIX_RESULT.md` (M12 closure, GREEN)

---

## STATUS

> # 🔴 HARD STOP — DO NOT ALTER THE SCHEMA
>
> C0 is **complete** — database dimension and code dimension both. It found **four blockers
> that sit upstream of R1.0-C** (B1–B4, none of them a time-model problem) and **two that
> redefine its scope** (B5–B6). B1–B4 must be resolved by explicit decision before C2 (schema
> design) or C11 (migration execution) may begin.
>
> | # | Blocker | Evidence | §15 stop condition |
> |---|---|---|---|
> | **B1** | The generated Prisma client **cannot read `Activity`** against this database — `P2022 — The column Activity.project_id does not exist in the current database` — and because `ActivityCreationCommand` writes `project_id` and `schedule_source` on every create, **activity creation cannot succeed either** (§12A). | Executed | "behavioural tests cannot execute" |
> | **B2** | Bringing the database to `schema.prisma` would **DROP 8 tables, 3 of them holding data** (`ResourceCapacity` 30 rows, `ShiftDefinition` 6 rows, `workpack_asset_snapshots` 2 rows). | Executed `migrate diff` | "migration cannot be rolled back" |
> | **B3** | Migration history is **not trustworthy**: 6 migrations unapplied while a *later* one is applied, ~30 recorded with `applied_steps_count = 0`, and the baseline itself recorded **rolled back**. | Executed | "migration cannot be rolled back" |
> | **B4** | The `timestamp without time zone` round trip in this configuration **shifts values by the session offset (+05:30)**. Migrating date→timestamp naively would bake the skew into planned/actual dates. | Executed, mechanism to confirm | "migration would reinterpret historical data" |
>
> **The time model itself is tractable.** The `@db.Date` inventory is now exact, the affected
> row counts are small, and there are no views, generated columns, triggers, or indexes
> obstructing the conversion. R1.0-C's *data* migration is blocked by database-state hygiene,
> not by its own design problem.
>
> **Code-side forensics are now complete (§6.1–§6.4) and trip two further §15 conditions:**
>
> | # | Finding | §15 stop condition |
> |---|---|---|
> | **B5** | **M11 writes no planned dates at all.** `ScheduleOrchestrationService` persists only `early_*`, `late_*`, float and `is_critical`. Invariant I2's owner does not exist. | "planned-date authority remains ambiguous" |
> | **B6** | **Seven server-side writers** of `Activity.planned_start`/`planned_end`, plus **two divergent browser algorithms** that persist their results. | "more than one planned-date writer remains" |
>
> B5/B6 are end-state conditions, so they define the C5 workload rather than blocking the
> phase — but they make C5 substantially larger than the instruction assumed. A third finding,
> an almost-empty recalculation trigger matrix with no worker in the default dev compose
> (§6.2), enlarges C6.
>
> **Decisions D1–D7 are now locked (§13).** D4 makes CPM the owner of
> `planned_start`/`planned_end`, which converts seven date writers into "intent inputs" — but
> `Activity` has **no constraint column**, so that intent has nowhere to live. D6 admits that
> constraint model into R1.0-C rather than deferring it. **R1.0-C is therefore no longer only a
> precision migration, and its GREEN criteria are wider than §15 as originally written.**
> D7 disposes of the epoch planned dates: 3 rows, all test fixtures, no actuals, no
> relationships — the smallest item in the phase.
>
> **Five decisions and one design task remain open** (items 3, 6, 7, 9, 12 plus the constraint
> model). C1 is blocked on item 6 (`Workpack` planned dates), item 7 (the six lag rows) and the
> constraint-model design.

---

## 1. What C0 established that the prior inventory could not

The R1.0-C inventory was produced by static reading only, because the command channel was
non-functional at the time. C0 had live database access for the first time. That changed
five conclusions and confirmed the rest.

| Prior inventory claim | C0 executed finding |
|---|---|
| `planned_*` / `actual_*` are `@db.Date` (P0-5) | **CONFIRMED** at the database, not just the schema file |
| `lag_days` is `Int?` and fractional lag is a risk | **CONFIRMED** as `integer`, default `0`; and the risk is **6 rows**, not a corpus |
| Calendar is disconnected from CPM | **WORSE** — `ScheduleCalendar` contains **0 rows**. There is no calendar to disconnect |
| The CPM engine truncates output to date granularity | **CONFIRMED** — see §4.1. An earlier revision of this document wrongly disputed this; the correction is recorded there rather than deleted |
| M11 owns calculated planned dates (I2) | **NOT IMPLEMENTED** — M11 writes no planned dates whatsoever (§6.1.1) |
| (not previously known) | The timestamp path is **already skewed by +05:30**, and that skew fully explains the observed `05:30` times |
| (not previously known) | Prisma **cannot read `Activity`** at all with a full scalar select |
| (not previously known) | **Seven** production writers of `planned_start`/`planned_end` (§6.1.2) |
| (not previously known) | Relationship, lag, calendar and event-window edits trigger **no** recalculation (§6.2) |

---

## 2. Database ground truth (executed)

```
PostgreSQL 17.10 on x86_64-windows
database          : syority @ localhost:5432, schema public
session TimeZone  : Asia/Calcutta   (+05:30)   ← NOT UTC
log_timezone      : Asia/Calcutta
database size     : 22 MB (23,213,747 bytes)
```

**Backup feasibility: GREEN.** At 22 MB a full `pg_dump` snapshot is trivial, so §15's
backup precondition is satisfiable. That is the one migration precondition that is not a
blocker.

### 2.1 Corpus size

| Table | Rows |
|---|---|
| Organization | 372 |
| events | 51 |
| Workpack | 199 |
| Activity | 73 (72 live, 1 soft-deleted) |
| ActivityRelationship | 20 |
| ProgressLog | 60 |
| BaselineActivity | 28 |
| ScheduleCalendar | **0** |

The migration surface is small. This materially de-risks C11 once B1–B4 are cleared.

---

## 3. The `@db.Date` inventory — exact, from `information_schema`

Every `date`-typed column in the `public` schema. This supersedes the schema-file-derived
list in the inventory document.

### 3.1 In R1.0-C scope (time-of-day is semantically required)

| Table | Column | Rows populated | Min | Max |
|---|---|---|---|---|
| `Activity` | `planned_start` | 49 / 73 | **1970-01-01** | 2027-01-15 |
| `Activity` | `planned_end` | 26 / 73 | **1970-01-01** | 2026-10-11 |
| `Activity` | `actual_start` | 14 / 73 | 2026-10-01 | 2026-10-06 |
| `Activity` | `actual_end` | 7 / 73 | 2026-10-02 | 2026-10-06 |
| `Workpack` | `planned_start_date` | **0 / 199** | — | — |
| `Workpack` | `planned_end_date` | **0 / 199** | — | — |
| `events` | `planned_start` | 49 / 51 | 2026-08-29 | — |
| `events` | `planned_end` | 49 / 51 | — | 2027-02-28 |
| `events` | `actual_start` | **0 / 51** | — | — |
| `events` | `actual_end` | **0 / 51** | — | — |
| `ScenarioActivityOverride` | `planned_start` | 2 / 11 | 2026-10-03 | 2026-10-03 |
| `ScenarioActivityOverride` | `planned_end` | 1 / 11 | — | — |
| `schedule_scope_change_items` | `planned_start` | **0 / 11** | — | — |
| `schedule_scope_change_items` | `planned_end` | **0 / 11** | — | — |
| `event_milestones` | `planned_date` | 0 / 0 | — | — |
| `event_milestones` | `actual_date` | 0 / 0 | — | — |

Two facts change the C1/C2 design:

1. **`Workpack.planned_start_date` / `planned_end_date` are entirely unpopulated (0 of 199).**
   Workpack planned dates are not campaign-window inputs and not rollups today — they are
   **dead fields**. C1 must decide whether they become a derived rollup or are retired;
   either way the conversion carries zero data risk.
2. **`Activity.planned_start` / `planned_end` contain `1970-01-01`.** That is epoch, i.e. a
   null or `0` was coerced into a date by some writer. These are **not** real plan dates and
   must be classified as BROKEN before any conversion, or the migration will faithfully
   preserve garbage as `1970-01-01T00:00:00`.

### 3.2 Date-only, but OUT of R1.0-C scope

`Constraint.target_resolution_date`, `Constraint.actual_resolution_date`,
`PunchListItem.target_close_date`, `ResourceCapacity.target_date`,
`SafetyIncident.action_due_date`, `SafetyIncident.action_completed_date`,
`SafetyLog.log_date`, `WorkpackMaterial.required_date`,
`workpack_material_lines.expected_eta`, `material_constraints.constraint_date`,
`material_constraints.earliest_eta`, `material_supply_records.expected_delivery`,
`material_supply_records.actual_delivery`, `ActivityResource.assigned_date`,
`ActivityUdfValue.value_date`, `ActivityLibraryUdfDefault.value_date`,
`asset_attribute_values.value_date`, `asset_attribute_history.value_date`,
`engineering_issues.raised_date`, `engineering_issues.due_date`,
`plant_documents.issue_date`, `shutdown_scopes.freeze_date`,
`platform_usage.period_date`.

**Do not touch these.** §4 of the governing instruction says convert only fields proven to
require time-of-day. None of the above is a CPM input or an execution fact.

---

## 4. The asymmetry nobody had spotted

`Activity` stores its **planning inputs** as `date` and its **CPM outputs** as `timestamp`:

| Column | DB type | Precision | Carries time? |
|---|---|---|---|
| `planned_start` | `date` | 0 | **NO** |
| `planned_end` | `date` | 0 | **NO** |
| `actual_start` | `date` | 0 | **NO** |
| `actual_end` | `date` | 0 | **NO** |
| `early_start` | `timestamp without time zone` | 3 | **YES** |
| `early_finish` | `timestamp without time zone` | 3 | **YES** |
| `late_start` | `timestamp without time zone` | 3 | **YES** |
| `late_finish` | `timestamp without time zone` | 3 | **YES** |
| `BaselineActivity.planned_start` | `timestamp without time zone` | 3 | **YES** |
| `BaselineActivity.planned_finish` | `timestamp without time zone` | 3 | **YES** |

"Carries time?" above is a statement about the **column's capacity**, not about the values.
§4.1 shows the `early_*` *values* are effectively date-only despite the column type.

### 4.1 CORRECTION — the engine *does* truncate; the times are a timezone artifact

An earlier revision of this section claimed the populated `early_*` times refuted the
inventory's "engine truncates to date granularity" finding. **That was wrong.** Code reading
and a full dump of all seven rows now agree, and they agree with the inventory. The corrected
evidence:

```
id                                    early_start           early_finish          dur_h  late_*  total_float
feca00c1…  2027-03-15 05:30:00   2027-03-15 13:30:00   8.00   NULL    NULL
8bb860b6…  2027-03-15 05:30:00   2027-03-15 15:30:00  10.00   NULL    NULL
f10004c0…  2027-03-16 05:30:00   2027-03-16 13:30:00   8.00   NULL    NULL
0c3c05c6…  2027-03-16 05:30:00   2027-03-16 15:30:00  10.00   NULL    NULL
cf181ee9…  2027-03-17 05:30:00   2027-03-17 15:30:00  10.00   NULL    NULL
3e9c3eee…  2027-03-17 05:30:00   2027-03-17 13:30:00   8.00   NULL    NULL
c6180ec4…  2027-03-18 05:30:00   2027-03-18 13:30:00   8.00   NULL    NULL

DISTINCT early_start time-of-day  : 05:30:00 ×7   ← every single row
DISTINCT early_finish time-of-day : 13:30:00 ×4, 15:30:00 ×3
```

Three deductions:

1. **`early_start` is uniformly `05:30:00`, which is UTC midnight expressed in `Asia/Calcutta`.**
   Zero variation across seven rows. That is the signature of a **date-only** value: the
   engine emits `'2027-03-15'` via `.toISOString().slice(0, 10)`, orchestration wraps it in
   `new Date('2027-03-15')` = UTC midnight, and the write into a `timestamp without time zone`
   column under a `+05:30` session shifts it to `05:30`. **The engine truncates. The inventory
   was right and §5's skew mechanism is now positively confirmed rather than merely
   consistent.**
2. **`early_finish` is exactly `early_start + duration_hours`** — `05:30 + 8h = 13:30`,
   `05:30 + 10h = 15:30`, matching each row's `duration_hours` precisely. A date-only engine
   output cannot produce that, so `early_finish` was **not** written by the same sliced-string
   path.
3. **`late_start`, `late_finish` and `total_float` are NULL on all seven rows.** M11's persist
   block writes `early_start`, `early_finish`, `late_start`, `late_finish`, `total_float`,
   `free_float` and `is_critical` in a **single** `data:` object, and the engine's backward
   pass always computes late dates. A row with early dates but null late dates and null float
   is therefore **inconsistent with having been written by M11 at all**.

**Conclusion: these seven rows are not trustworthy evidence of CPM behaviour.** All were
written within a 10 ms window (`updated_at` 2026-09-09 08:53:33.582–.592), i.e. one batch,
with a provenance that does not match the production persist path — most plausibly a seed or
a test that reached the real database. They are recorded here as a data-quality observation,
not as engine evidence, and the engine's actual behaviour is taken from code (§6.4.1).

`BaselineActivity` genuinely does hold real times, but of mixed provenance:

```
planned_start 00:00:00 → planned_finish 00:00:00   ×20
planned_start 08:00:00 → planned_finish 18:00:00   ×5    (10h shift)
planned_start 10:00:00 → planned_finish 20:00:00   ×3    (10h shift)
```

So 20 of 28 baseline rows are midnight-to-midnight (date-only in a timestamp column) and 8
carry plausible shift times. The baseline still stores **higher fidelity than the live plan
it was copied from**, and C1 must resolve that inversion — but the inversion is narrower than
first stated.

---

## 5. B4 — the +05:30 skew, and why it governs the migration

`Activity.early_start` for one row:

| View | Value |
|---|---|
| Stored, via SQL `::text` | `2027-03-15 05:30:00` |
| Returned through Prisma | `2027-03-15T05:30:00.000Z` |
| Session offset | `+05:30` |

The stored offset is **exactly** the session offset, and every populated row shows it. The
reading consistent with the evidence is: a UTC-midnight `Date` was written, PostgreSQL
converted it to the session zone (`Asia/Calcutta`) and stripped the zone because the column
is `timestamp without time zone`, and Prisma then read the naive value back **as if it were
UTC** — so the round trip does not cancel out and the value gains +05:30 each time.

**Now proven** (see §4.1): `early_start` is `05:30:00` on **every** populated row with zero
variation. A date-only engine output becomes UTC midnight becomes `05:30` local under a
`+05:30` session. The uniformity across all seven rows rules out coincidence, so the
write-path conversion is the mechanism, not merely a consistent hypothesis. A scratch-database
round-trip in C2 is still worth running to confirm behaviour **after** `TimeZone=UTC` is
pinned, but the diagnosis no longer depends on it.

Three consequences for the migration contract:

1. A naive `ALTER TABLE ... ALTER COLUMN planned_start TYPE timestamptz` performed in a
   session where `TimeZone = Asia/Calcutta` will read `2027-04-10` as
   `2027-04-10 00:00:00+05:30` = `2027-04-09T18:30:00Z`. **The date silently moves to the
   previous day in UTC.** The migration must pin the zone explicitly with an
   `AT TIME ZONE` clause and a documented plant zone, never rely on the implicit cast.
2. The existing database convention is `timestamp without time zone`, used by essentially
   every timestamp column. The only `timestamp with time zone` columns are
   `standard_activity_types.created_at` / `updated_at`, which arrived via hand-written SQL.
   Choosing `timestamptz` for planned/actual therefore introduces a **third** convention
   into the schema. C1 must decide this deliberately: `timestamptz` everywhere in scope
   (correct, inconsistent with the rest), or `timestamp(3)` matching the codebase
   (consistent, and inherits the skew defect). **This is a decision for the architect, not
   a default.** My recommendation, for C1 to accept or reject, is `timestamptz` plus forcing
   `TimeZone = UTC` at the connection, because the alternative preserves a known defect.
3. Whatever is chosen, the existing `early_*` / `late_*` / `BaselineActivity` values are
   **already skewed** and would need a separate, explicitly authorised correction. §11
   forbids silent reinterpretation, so C0 records it and proposes nothing.

---

## 6. Items A–T classification

**Complete.** Database-derived rows come from executed queries; code-derived rows come from the
six read-only forensics recorded in §6.1–§6.4. No row remains pending.

| # | Item | Classification | Evidence |
|---|---|---|---|
| A | `Activity.planned_start` | **AUTHORITATIVE INPUT + BROKEN + UNOWNED** — `date`, so cannot hold time; contains `1970-01-01` epoch values; **7 writers, none of them M11** (§6.1) | DB: `date`, 49/73, min 1970-01-01 |
| B | `Activity.planned_end` | **AUTHORITATIVE INPUT + BROKEN + UNOWNED** — as above | DB: `date`, 26/73, min 1970-01-01 |
| C | `Activity.actual_start` | **AUTHORITATIVE INPUT (M12-owned), precision-limited** — provenance correct since M12 closure; `date` truncates time | DB: `date`, 14/73 |
| D | `Activity.actual_end` | **AUTHORITATIVE INPUT (M12-owned), precision-limited** | DB: `date`, 7/73 |
| E | `Workpack` planned start/end | **LEGACY / DEAD** — 0 of 199 populated | DB |
| F | `events` planned/actual | **AUTHORITATIVE INPUT (campaign window)** for planned (49/51); actuals **UNUSED** (0/51) | DB |
| G | `Activity.early_start/early_finish` | **PERSISTED DERIVED** (CPM output) — carries time, but **skewed +05:30** | DB: 7/7 with time |
| H | `Activity.late_start/late_finish` | **PERSISTED DERIVED** — 0 populated, so CPM backward pass has never persisted | DB: 0/73 |
| I | `ActivityRelationship.lag_days` | **AUTHORITATIVE INPUT + IRRECONCILABLE UNIT** — `integer` default 0; only **6 non-zero rows**; written ÷8 / ÷24 / ÷10, read ×8 / ×10 / ×24 / raw; **author intent unrecoverable, no provenance column** | DB + §6.3, §7 |
| J | `ScheduleCalendar.work_days` | **BROKEN / UNPOPULATED** — `ARRAY` column, table has 0 rows | DB |
| K | `ScheduleCalendar.exceptions` | **BROKEN / UNPOPULATED** — `jsonb NOT NULL`, table has 0 rows | DB |
| L | Constraints | **OUT OF SCOPE** — `Constraint` dates are resolution-tracking, not CPM constraints | DB §3.2 |
| M | Resource leveling | **DUPLICATE planned-date writer** — persists `planned_start`/`planned_end` directly, then calls M11 (which does not write planned dates) | `ResourceLevelingApplyService.ts:118-124`, `:162-166` |
| N | Browser/client date calculation | **DUPLICATE + PERSISTED BUSINESS TRUTH** — two client components compute planned dates and POST them | `ScheduleContainer.tsx:832-847`, `ActivityPlanningGrid.tsx:181-190` |
| O | Imports / exports | **LEGACY (imports RETIRED, HTTP 410) + BROKEN (exports)** — export lag factors disagree ×8 / ×10 / ×24; MS Project workpack export emits a malformed datetime | §6.3, §6.4.4 |
| P | Baseline snapshots | **PERSISTED DERIVED, fidelity inverted vs source** — `timestamp(3)`, 28 rows: 20 midnight-only, 8 with shift times | DB §4.1 |
| Q | Forecast dates | **ABSENT on Activity** — no forecast date column; `ScheduleForecastService` computes in memory and persists nothing | code |
| R | Reports | **READ-ONLY CONSUMER, day-granularity** — outputs `split('T')[0]`; one planned→actual fallback in reporting | §6.4.2, §6.4.3 |
| S | Execution readiness | **READ-ONLY CONSUMER, day-granularity** — M10 reads Workpack dates via `slice(0,10)`; lookahead buckets are day-based | §6.4.3 |
| T | Recalculation triggers | **BROKEN** — only 2 production enqueue sites; relationship, lag, calendar and event-window changes trigger nothing. No DB triggers exist (0 rows in `information_schema.triggers`) | §6.2 |

---

## 6.1 Planned-date authority — the finding that defines R1.0-C's real workload

This is the most consequential result of C0's code-side forensics, and it is worse than
"ambiguous ownership".

### 6.1.1 M11 does not write planned dates at all

`ScheduleOrchestrationService.calculateEventSchedule()` persists exactly seven fields:

```174:189:src/core/schedule/ScheduleOrchestrationService.ts
data: {
  early_start:   act.early_start   ? new Date(act.early_start)   : null,
  early_finish:  act.early_finish  ? new Date(act.early_finish)  : null,
  late_start:    act.late_start    ? new Date(act.late_start)    : null,
  late_finish:   act.late_finish   ? new Date(act.late_finish)   : null,
  total_float:   act.total_float_hours,
  free_float:    act.free_float_days * calendar.getHoursPerDay(),
  is_critical:   act.is_critical,
}
```

`planned_start` and `planned_end` are **read as CPM inputs** and never written back. So the
architectural statement "M11 owns calculated planned dates" is not merely violated by
competing writers — **it is not implemented anywhere.** Nothing in the system derives
`planned_start`/`planned_end` from CPM. The CPM result lands in `early_*`, and the UI reads
`planned_*`. That is the planned/early split, now confirmed at the persistence layer.

### 6.1.2 Seven production writers of `Activity.planned_start` / `planned_end`

| # | Path | File:line | Class | Triggers CPM? |
|---|---|---|---|---|
| W1 | Activity creation (all create paths funnel here) | `ActivityCreationCommand.ts:481-482` | MANUAL / TEMPLATE / SCOPE | via caller only |
| W2 | Schedule grid inline edit | `app/api/projects/[id]/schedule/activities/[activityId]/route.ts:60-66` | MANUAL | **YES** (enqueue) |
| W3 | Planning bulk save | `app/api/activities/bulk/route.ts:135-136` | MANUAL | **NO** |
| W4 | Planner workspace batch update | `PlannerWorkspaceService.ts:493-496` | MANUAL | **NO** (and session auth only) |
| W5 | Resource leveling apply | `ResourceLevelingApplyService.ts:118-124` | LEVELING | YES (sync, but CPM does not write planned) |
| W6 | Scope change application | `ScopeChangeApplicationService.ts:199-219` | GOVERNED | **NO** |
| W7 | Schedule change control apply | `ScheduleChangeControlService.ts:271-278` | GOVERNED | **NO** |

By contrast, `early_*`/`late_*`/float/`is_critical` **do** have a single active writer (M11);
the only other implementation, `SchedulingService.calculateProjectSchedule()`, is `@deprecated`
with zero production callers.

### 6.1.3 Client components that compute planned dates and persist them

```832:847:src/components/Schedule/ScheduleContainer.tsx
payload.planned_end = new Date(new Date(finalValue).getTime() + durH * 3600000).toISOString();
```

Hour-based arithmetic in the browser, PUT to the schedule activity route.

```181:190:src/components/planning/ActivityPlanningGrid.tsx
const days = Math.max(1, Math.ceil(row.duration_hours / 8));
d.setDate(d.getDate() + days - 1);
updated.planned_end = d.toISOString().slice(0, 10);
```

Day-based arithmetic with a hard-coded `/8`, saved via `POST /api/activities/bulk`. It also
defaults `planned_start`/`planned_end` to `new Date()` on new rows, so the browser's clock
becomes plan truth. Two components, two *different* algorithms, neither calendar-aware,
both authoritative in practice. Workpack-level equivalents exist in
`WorkpackCreateForm.tsx:234-235` and `WorkpackHeader.tsx:140-146`.

### 6.1.4 §15 assessment

Two stop conditions are currently **true**: *"planned-date authority remains ambiguous"* and
*"more than one planned-date writer remains"*. They are the C5 workload rather than a reason
to abandon the phase, but they mean **C5 is much larger than the instruction assumed**: it is
not "remove a few client calculations", it is "introduce a planned-date owner that does not
yet exist, then retire seven writers and two client engines."

---

## 6.2 Recalculation propagation — the trigger matrix is mostly empty

Only **two** production call sites of `enqueueEventScheduleRecalculate` exist:
`ActivityService.ts` (create / update / delete / approve, lines 114, 145, 166, 213) and the
schedule activity PUT (`route.ts:78`, and only when the body contains `planned_start`,
`planned_end` or `duration_hours`).

**Mutations that change the schedule and trigger nothing:**

| Mutation | Path | Recalc |
|---|---|---|
| Predecessor create / replace / PATCH / DELETE | `workpacks/[id]/activities/[activityId]/predecessors/**` | **NO** |
| Relationship type change, **lag change** | same | **NO** |
| Calendar create / update / delete (`work_days`, `hours_per_day`, `exceptions`) | `settings/calendars/**` | **NO** |
| Event window / `calendar_id` change | `events/[eventId]/route.ts` → `EventPlanningService:173-177` | **NO** |
| `POST /api/activities/bulk` (create + update + delete in one tx) | `activities/bulk/route.ts` | **NO** |
| `PUT` / `DELETE /api/activities/[id]` | `activities/[id]/route.ts:47-53, 69-74` | **NO** |
| Planner workspace batch update | `PlannerWorkspaceService.batchUpdate` | **NO** |
| Template instantiation, workpack factory, AI generate, clone, admin template apply | `TemplateLibraryService.ts:612-659` et al. | **NO** |
| Scope change apply, schedule change control apply | as §17.2 | **NO** |

Relationship and lag edits not triggering recalculation is the sharpest gap: those are pure
CPM inputs with no other effect, so a lag change currently has **no observable consequence**
until someone presses the manual recalculate button.

**Two boundary bypasses** run CPM synchronously instead of through the queue:
`ResourceLevelingApplyService.ts:162` and `POST /api/schedule/calculate:41`. Both are
event-scoped and tenant-checked, so they are not isolation defects, but they mean the
"single boundary" invariant (I6/I7) is already three paths, not one.

**Operational gap:** the worker is started only by `npm run worker` or the `worker` service in
`docker-compose.prod.yml`. The base `docker-compose.yml` and `docker-compose.staging.yml` have
**no worker service**, and `instrumentation.ts` does not start one. Where no worker runs,
enqueued jobs accumulate in Redis and CPM silently never updates —
`ActivityService.createActivity` even catches enqueue failures and returns success
(`:115-116`). Combined with I9, this means **C6 must verify the worker is running, not just
that jobs are enqueued.**

**Read-after-enqueue races** exist at `ActivityService.ts:114-119` and `:145-147` and in
`ActivitiesPanel.tsx:470-488, 508-529`, where the UI refreshes immediately after an
async enqueue and reads pre-CPM values.

---

## 6.3 Lag — the conflict matrix, and why author intent is unrecoverable

Confirmed write factors:

| Path | File:line | Factor |
|---|---|---|
| Predecessor API POST / PUT / PATCH | `predecessors/route.ts:54`, `:120`, `[relId]/route.ts:29` | **÷ 8** via `lagHoursToDays` |
| Template instantiation | `TemplateLibraryService.ts:655` | **÷ 24** then `Math.round` |
| P6 XER / P6 XML / MS Project import (retired, HTTP 410) | parsers, default `hoursPerDay = 10` | **÷ 10** |
| Project branching clone | `ProjectBranchingService.ts:102` | copy-through, semantics inherited |

Read factors for a stored `lag_days = 1`:

| Consumer | Interpretation |
|---|---|
| CPM engine (`scheduleEngine.ts:172`) | raw offset unit → **+24 wall-clock hours** via `addDays` |
| `ActivitiesPanel`, `BulkPredecessorModal` | **8 hours** (×8) |
| XER project export | **8 hours** (×8) |
| Generic / bulk export | **24 hours** (×24) |
| Primavera XML formatter | **10 hours** (×10) |
| Workspace / Planner / PDF | label `+1d`, no conversion |

So one stored integer is simultaneously 8, 10 and 24 hours depending on who reads it, and was
authored as 8, 10 or 24 hours depending on who wrote it.

**Author intent is NOT recoverable.** `ActivityRelationship` carries only `created_by`,
`created_at`, `updated_at` — no `schedule_source`, no `import_batch_id`, no `lag_unit`. The
import path did not even set `created_by`. `Activity.schedule_source = 'imported'` on both
endpoints is a weak heuristic for import-origin rows and cannot separate the ÷8 path from the
÷24 path.

**The saving grace is the data**: 20 relationships, all `FS`, 14 with `lag_days = 0`, and only
**6 non-zero rows** (`5` ×3, `13` ×3). Six rows can be adjudicated individually by a human,
which is strictly better than any blanket formula. §12.7 remains open.

**Fractional lag → `Int` — still REQUIRES RUNTIME VERIFICATION.** `lagHoursToDays` returns
`Math.round((hours / 8) * 100) / 100`, so 4 lag-hours yields **0.5**, handed to Prisma for an
`Int?` column with no `Math.round`/`trunc`/`parseInt` in between. Whether Prisma 7.9.1 rejects,
coerces or truncates is not provable from source and there is no test covering it. I have **not**
run this experiment, because it requires a write. Recommended: run it inside a deliberately
rolled-back transaction, or against a scratch database, in C2 or C3.

---

## 6.4 Calendar and downstream consumers

### 6.4.1 Calendar — one engine, correctly built, simply not wired in

`CalendarEngine` (`src/lib/CalendarEngine.ts`) already implements `isWorkingDay`,
`addWorkingDays`, `subtractWorkingDays`, `workingDaysBetween`, `hoursToDays`, and honours
`work_days` plus `{ date, type: 'holiday' | 'work' }` exceptions. **There is exactly one
working-day engine — no second engine needs to be avoided, it needs to be *used*.**

`ScheduleOrchestrationService` already resolves the calendar through a three-tier fallback
(event `calendar_id` → org default → hard-coded `Mon–Sat, 10h`) at `:354-387`, then passes
**only** `calendar.getHoursPerDay()` into `calculateSchedule` (`:167`). `work_days` and
`exceptions` are loaded and discarded. So C4 is a **wiring** task, not a build task — which is
good news, tempered by §8: the table is empty, so there is nothing to wire yet.

Two defects inside the engine to fix while wiring:

- `CalendarEngine.isWorkingDay` (`:22-30`) matches exceptions on **UTC** date keys
  (`toISOString().split('T')[0]`) but derives the weekday from **local** `getDay()`. Under
  `Asia/Kolkata` these disagree near midnight. D2's `TimeZone=UTC` pin reduces but does not
  remove this.
- `scheduleEngine.addDays` (`:96-100`) is raw `days * 24 * 60 * 60 * 1000`, and every output
  goes through `.toISOString().slice(0, 10)` (`:398-401`, `:416-420`, `:428-429`). Both must
  change for time-of-day to survive, and that will break existing date expectations in
  `src/lib/scheduleEngine.test.ts` and the HX-204 runtime tests in
  `tests/m11-v1-schedule-view.test.ts`.

Also note `free_float` is persisted as `act.free_float_days * calendar.getHoursPerDay()` while
`total_float` is persisted as `act.total_float_hours` — two different unit derivations into two
columns documented as "canonical unit: HOURS". Worth checking during C4.

Duplicate naive day arithmetic to reconcile (not second calendar engines, but they will
conflict once the calendar is authoritative): `ScheduleForecastService.addDaysToDate:53-56`,
`ResourceLevelingService:294-295, 322`, and weekend-only checks in `ScheduleGantt.tsx:286`,
`WorkspaceGantt.tsx`, `ResourceHistogram.tsx`. `date-fns@4.1.0` is present; **no timezone
library** is a direct dependency, which D2/D3 will require.

### 6.4.2 Planned-substituted-for-actual — none of it persists

Searched repository-wide. Every occurrence is presentation, Gantt layout or report column
fallback; **no production path persists a planned value into an actual column.** That is
consistent with the M12 closure and means I4 currently holds at the database.

The `ScheduleContainer` fallback is nonetheless a real reporting-integrity problem:

```529:538:src/components/Schedule/ScheduleContainer.tsx
if (prog > 0 && !autoActualStart) autoActualStart = act.planned_start;
if (prog === 100 && !autoActualEnd) autoActualEnd = act.planned_end || act.planned_start;
```

`renderCell` (`:1018-1022`) formats `actual_start` and `planned_start` with the **identical**
formatter — no label, badge, opacity or "estimated" marker. A user cannot distinguish a
measured actual from a planned substitute, and the WBS rollup (`:618-619`) overwrites summary
rows from child min/max as well. §10 of the instruction requires this be explicitly classified
or removed; **as it stands it makes planned and actual visually indistinguishable, which is the
condition the instruction forbids.** Recommend removal or explicit visual marking in C8.

`Schedule/taskTransformer.ts:30-31` has the same pattern for Gantt bounds — acceptable as
layout, worth a comment.

### 6.4.3 Day-granularity consumers that will need review when time appears

Business logic, not just formatting: `FieldExecutionService` lookahead and delay buckets
(`:169-171, 433-434, 505-530`), EVM daily S-curve buckets
(`EvmCalculationService.ts:291, 329, 346`), resource histogram keys
(`ResourcePlanningService.ts:303-306`, `ScheduleOrchestrationService.ts:319, 345`), the 14-day
metrics loop (`projects/[id]/schedule/metrics/route.ts:81-102`), M10 readiness
(`PlanningReadinessService.ts:536-537`), M15 what-if `setUTCDate` shifts
(`DecisionIntelligenceService.ts:959, 1043-1058`), and M13 Control Tower full-millisecond
comparisons (`ControlTowerQueryService.ts:204-221, 265-266`) — the last of which **changes
behaviour** the moment planned dates stop being midnight.

Two additional defects found incidentally, both outside R1.0-C scope but worth recording:
`useWorkspaceStore.ts:507-508` hard-codes `actual_start`/`actual_end` to `null` when mapping
workspace grid rows, discarding M12 actuals; and `ActivityGrid.tsx` planned-date edits call
`updateCellValue` with no API persist path found.

### 6.4.4 Export adapters

`workpacks/[id]/export/ms-project/route.ts:47-49` builds its date string by
`...replace('Z','') + '00:00:00'`, producing a malformed datetime. Export lag factors disagree
(×8 XER project route, ×24 generic export, ×10 Primavera formatter). Excel and CSV exports use
`toLocaleDateString()` and so drop time entirely. All need a format audit in C8 once time-of-day
is authoritative.

---

## 7. Lag — the data is far less dangerous than the code

| Fact | Value |
|---|---|
| `ActivityRelationship.lag_days` type | `integer`, nullable, `DEFAULT 0` |
| Total relationships | 20 |
| `lag_days` NULL | 0 |
| `lag_days = 0` | 14 |
| `lag_days > 0` | **6** |
| `lag_days < 0` | 0 |
| Distinct non-zero values | `5` (×3 rows), `13` (×3 rows) |
| Relationship types present | `FS` only — no FF, SS or SF anywhere |
| `workpack_template_logic_links.lag_hours` | `double precision NOT NULL DEFAULT 0`, **0 rows** |

Three conclusions:

1. **The historical ambiguity affects six rows.** The `/8` versus `/24` versus
   `hoursPerDay` conflict is real in code and must be fixed, but the migration is not a
   large-scale reinterpretation problem. Six rows can be individually adjudicated by a human
   if desired, which is a far better option than a blanket formula.
2. **A second lag field exists that the inventory did not record.**
   `workpack_template_logic_links.lag_hours` is `double precision` — templates already
   store lag in **hours as a float**, while relationships store `lag_days` as an **integer**.
   That is the origin of the `÷24` conversion. It also means the fractional-lag →
   `Int` truncation hazard is real in code but has **no data** yet (0 rows), so it can be
   fixed before it ever corrupts anything.
3. **Only `FS` relationships exist.** The FF/SS/SF paths have never been exercised against
   real data, so C10's T9–T11 will be first-execution tests, not regression tests. Treat
   them as new behaviour, not preserved behaviour.

---

## 8. Calendar — there is nothing to connect

```
SELECT COUNT(*) FROM "ScheduleCalendar"  →  0
```

`ScheduleCalendar` structure is present and adequate:

| Column | Type |
|---|---|
| `work_days` | `ARRAY` (nullable) |
| `hours_per_day` | `double precision NOT NULL` |
| `exceptions` | `jsonb NOT NULL` |
| `is_default` | `boolean NOT NULL` |

But it holds **no rows**, and `events.calendar_id` is `null` on the event sampled. So the
C4 statement "M11 currently receives only `hours_per_day`" understates the position: M11
receives only a **fallback default**, because no calendar record exists to read. Every CPM
result in this database was computed against a hard-coded default.

C4 therefore has a prerequisite the instruction did not anticipate: **a calendar must exist
before calendar semantics can be made authoritative.** Creating the first calendar row is a
data-seeding decision (which working week, which holidays, whose plant) and it is a business
input, not something I may invent. That is a question for you, recorded in §11.

---

## 9. Migration state — B2 and B3 in detail

### 9.1 Unapplied migrations, out of order

```
35 migrations found in prisma/migrations
Not yet applied:
  20260906_m12r01_permit_org_id
  20260906_m12r01_progresslog_shift
  20260906_m12v1_udf_dimension_metadata
  20260908_m15_r4_management_decisions
  20260908_m16_r6_interaction_logs
  20260908_r01_activity_event_index
```

Yet `20260909_r04d_workpack_identity_review` **is** applied (`finished_at 2026-09-09
13:51:59`, `applied_steps_count 1`). A later migration is applied while six earlier ones are
not. `prisma migrate dev` would attempt to reconcile this and would not do so safely.

### 9.2 The history is largely fictional

Almost every recorded migration has `applied_steps_count = 0`, meaning it was marked applied
without executing its steps — the signature of `db push` followed by
`migrate resolve --applied`. The database schema was therefore not built by these
migrations, so they cannot be trusted to reproduce it, and **rollback by migration replay is
not available**.

Three entries are recorded as rolled back, including the baseline itself:

| Migration | started | rolled_back |
|---|---|---|
| `20260227000000_add_workpack_document` | 2026-08-14 | 2026-08-14 |
| `20250821_m86_add_history_refers_fk` | 2026-08-29 | 2026-09-01 |
| **`20260226000000_baseline`** | 2026-09-01 | **2026-09-01** |

### 9.3 What `migrate diff` would do — data loss

`prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma` produces a
390-line script. Its destructive content:

```sql
DROP TABLE "ResourceCapacity";          -- 30 rows
DROP TABLE "ShiftDefinition";           --  6 rows
DROP TABLE "workpack_asset_snapshots";  --  2 rows
DROP TABLE "asset_relationships";       --  0 rows
DROP TABLE "onboarding_requests";       --  0 rows
DROP TABLE "provisioning_job_logs";     --  0 rows
DROP TABLE "provisioning_jobs";         --  0 rows
DROP TABLE "provisioning_templates";    --  0 rows
```

plus `DROP COLUMN` on `Asset`, `ActivityLibrary`, `ActivityUdfDefinition`, `Organization`,
`Permit`, `ProgressLog`, `workpack_template_activities`, and a primary-key rebuild on
`Permit`.

`ResourceCapacity` and `ShiftDefinition` are live resource-planning tables with data.
**Any `prisma migrate dev` in this state destroys them.** This is why C11 cannot proceed.

### 9.4 It also drifts the other way

The same diff wants to **add** `Activity.project_id` and `Activity.schedule_source`, and to
add `released`, `verified`, `closed` to the `ActivityStatus` enum — i.e. `schema.prisma`
declares things the database does not have. See §10.

---

## 10. B1 — Prisma cannot read `Activity`, and a second consequence

### 10.1 Executed proof

```
prisma.activity.findFirst({ where: { deleted_at: null } })

  Invalid `prisma.activity.findFirst()` invocation
  The column `Activity.project_id` does not exist in the current database.
  CODE: P2022
```

A narrow projection succeeds:

```
prisma.activity.findFirst({ select: { id, planned_start, planned_end, actual_start, actual_end } })
  → OK
```

`schema.prisma` declares both fields:

```
54:  project_id                 String?
56:  schedule_source            String?
```

The live `Activity` table has neither. So **every full-scalar `Activity` read fails**, and
only queries with an explicit narrow `select` work. `Workpack`, `ActivityRelationship`,
`ProgressLog`, `Event` and `ScheduleCalendar` all read cleanly — the fault is confined to
`Activity`, which is precisely the table R1.0-C is about.

This is why R1.0-C's required database-backed behavioural tests (C10) cannot be written yet.
It is also, on its own, a live application defect for any Activity read path that does not
narrow its selection.

### 10.2 `ActivityStatus` is missing three values that M12 writes

The live enum:

```
not_started, in_progress, completed, on_hold, cancelled
```

`ExecutionWriteService` maps `RELEASE → 'released'`, `VERIFY → 'verified'`,
`CLOSE → 'closed'`. Those three labels **do not exist in this database**, so those three M12
actions cannot persist here. Statuses actually present in data: `not_started` 58,
`in_progress` 7, `completed` 7, `cancelled` 1 — consistent with `released`/`verified`/
`closed` never having been written.

**This does not reopen the M12 closure and I have changed nothing in M12.** The M12 P0 was
about *which value* populates `actual_start`, and that fix and its 7/7 behavioural tests
remain valid. What C0 adds is that three of M12's nine actions are blocked by *schema drift*
rather than by M12's logic. It went unnoticed because the M12 suite mocks Prisma, so no test
touches the real enum. It is recorded here as a C0 finding for separate decision, and it is
strong evidence for the instruction's own requirement that C10 tests be
"database-backed where required".

---

## 11. Structural obstacles to `ALTER TYPE` — none

| Obstacle | Result |
|---|---|
| Indexes on candidate columns | **NONE** |
| Generated columns | **NONE** (0 in schema) |
| Views / materialized views | **NONE** (0 of each) |
| Triggers | **NONE** (0 in `information_schema.triggers`) |
| Check constraints on planned/actual/lag | **NONE** |
| Foreign keys on candidate columns | **NONE** |

Once B1–B4 are cleared, the conversion itself is structurally clean: four columns on
`Activity`, small row counts, nothing depending on their type. The hard part of R1.0-C is
the authority and semantics work, not the DDL.

---

## 12. Decisions required from the architect before C1 can be frozen

### 12A. Item 2 is already settled — and B1 is worse than a read failure

D1 says "add the missing `Activity` columns". Code confirms that is the only viable reading:

```483:489:src/core/activity/ActivityCreationCommand.ts
      created_by: userId,
      schedule_source: workpack ? 'workpack' : legacyProjectId ? 'imported' : null,
      standard_activity_type_id: standardActivityTypeId,
      project_id: legacyProjectId,
    },
  });
```

`ActivityCreationCommand` — the funnel **every** activity-creation path goes through — writes
both columns unconditionally. `Activity.project_id` is additionally read by
`ActivityIdentityBackfillService` and its Prisma store. Removing either column from
`schema.prisma` would therefore require production code changes inside what is supposed to be
a database-repair task. **Decision: add both columns.** Any R0.4 retirement of
`Activity.project_id` is a separate, later cleanup.

**This also sharpens B1.** The missing columns do not merely break wide reads — because
`ActivityCreationCommand` writes `project_id` in its `data` payload, **activity creation
cannot succeed against this database at all.** That is consistent with the tiny, stale
activity corpus and confirms this database is not a functioning development database. Step 3
of the critical path must therefore verify a successful `create` as well as a successful
`findFirst`.

### 12B. The original nine

1. **Database-state remediation strategy** — how to reconcile `schema.prisma` with the live
   database without dropping `ResourceCapacity` / `ShiftDefinition` /
   `workpack_asset_snapshots`. Options: bring the schema to the database (introspect and
   reconcile), bring the database to the schema minus the drops (hand-written migration),
   or rebaseline the migration history. This is prerequisite to everything.
2. ~~**`Activity.project_id` / `schedule_source`** — add the columns to the database, or remove
   them from `schema.prisma`.~~ **RESOLVED — add both.** See §12.0 below; no architect input
   needed.
3. **`ActivityStatus` enum** — add `released` / `verified` / `closed`, or narrow M12. The
   architecture says the former.
4. **Storage type** — `timestamptz` (correct, third convention) versus `timestamp(3)`
   (consistent, inherits the +05:30 defect).
5. **Plant timezone** — the single authoritative zone for interpreting existing `date` values
   at midnight. `Asia/Calcutta` is the server's zone but that is an accident of the dev
   machine, not a plant declaration.
6. **`Workpack` planned dates** — retire, or define as a derived rollup. They are dead today.
7. **The six non-zero lag rows** — adjudicate individually, or apply `× 1440` wholesale and
   accept that `/8`-authored values are reinterpreted.
8. **The `1970-01-01` planned dates** — classify as BROKEN and null them under an explicit
   decision, or migrate them forward as `1970-01-01T00:00:00`.
9. **First calendar record** — which working week, hours per day, and holiday set. C4 cannot
   make CPM calendar-authoritative against an empty table.

### 12C. Three further decisions raised by the code-side forensics (§6.1–§6.4)

These were not anticipated by the instruction and are **more consequential than items 1–9**.

10. **Who owns `planned_start` / `planned_end`?** §6.1.1 proves M11 writes **no** planned
    dates — invariant I2 ("M11 owns calculated planned dates") is not implemented at all, not
    merely violated. There is a genuine architectural fork here and it cannot be resolved by
    an agent:
    - **(a) CPM becomes the planned-date owner** — M11 writes `planned_start`/`planned_end`
      from its forward pass, the seven writers in §6.1.2 become *intent inputs* (constraints /
      target dates), and the `early_*` columns become internal CPM detail. This implements I2
      as written but changes what every existing screen displays.
    - **(b) `planned_*` is declared authoritative human intent, `early_*` the calculated
      result.** I2 is reworded, CPM stays a read-only calculator, and the work becomes
      funnelling the seven writers through one service plus surfacing planned-vs-early
      variance. This matches how the system behaves today.

    **This decision gates C1, C5 and C6.** Every downstream unit, calendar and trigger
    question resolves differently under (a) than under (b), so it should be answered before
    the reconciliation migration is authored, even though it does not change that migration's
    DDL.
11. **Trigger coverage and worker guarantee for C6** — confirm that relationship/lag edits,
    calendar CRUD and event-window changes must all enqueue recalculation (§6.2), and that the
    base `docker-compose.yml` gains a `worker` service. Also whether
    `ActivityService`'s swallowed enqueue failure should become a hard error.
12. **The `ScheduleContainer` planned→actual display fallback** (§6.4.2) — remove it, or render
    it with an explicit "estimated" marker. It does not persist, so it is not an I4 violation,
    but as written it makes a planned substitute visually identical to a measured actual.

---

## 13. Architect decisions — RECEIVED AND LOCKED (2026-09-10)

Seven decisions have been answered directly by the architect (D1–D7), and one more (§12 item 2)
is settled by code inspection in §12A. They are binding inputs to C1 and are recorded here
verbatim in effect.

**D4 materially expands R1.0-C's scope, and D6 accepts that expansion into this phase** — see
D4's consequences, D6, and "D4's effect on the still-open items" below. Together they introduce
a schema requirement (a constraint model) that the governing instruction did not anticipate,
which means **R1.0-C's GREEN criteria are wider than §15 as originally written.**

### D1 — Database-state remediation: **hand-written reconciliation migration**

> Add the missing `Activity` columns and the missing enum values, **keep** the eight tables
> that `migrate diff` wants to drop, then rebaseline the migration history.

Consequences for the plan:

- `prisma migrate dev` is **forbidden** for this work — it would generate the destructive
  diff in §9.3. All DDL must be hand-authored SQL applied as an explicit migration and then
  recorded with `prisma migrate resolve --applied`.
- The reconciliation is a **separate migration from the time-foundation migration** and must
  land first. Order: snapshot → reconciliation → verify Prisma reads `Activity` → *then* C2.
- Rebaselining must be done in a way that leaves the history able to reproduce the schema,
  otherwise B3 is renamed rather than resolved.
- `schema.prisma` must end up describing the eight retained tables, or the next `migrate
  diff` will propose dropping them again. Retaining the tables in the database without
  declaring them in the schema leaves a permanent drift trap.

### D2 — Storage type: **`timestamptz`, with `TimeZone=UTC` forced on the connection**

Accepted with its known cost: this introduces a third datetime convention into a schema
that is otherwise `timestamp without time zone`. The justification on record is that the
alternative (`timestamp(3)`) knowingly inherits the +05:30 skew documented in §5.

Consequences:

- The connection must pin `TimeZone=UTC`. `src/lib/prisma.ts` constructs a `pg` `Pool`, so
  this is set once there (via connection options or `options=-c TimeZone=UTC`), not per
  query. This is a **production code change** and therefore belongs to C5, not C2.
- Pinning the session zone changes how the **existing** `timestamp without time zone`
  columns (`early_*`, `late_*`, `BaselineActivity.*`, and every `created_at`/`updated_at`)
  round-trip. That is a wanted correction, but it is a behaviour change beyond R1.0-C's
  four columns and must be regression-tested, not assumed benign.
- The already-skewed `early_*` / `late_*` / `BaselineActivity` values remain skewed. Pinning
  UTC stops new skew; it does not retro-correct old values. Correcting them is a separate,
  explicitly authorised decision and is **not** part of R1.0-C.

### D3 — Plant timezone: **`Asia/Kolkata`**

Existing date-only values are to be interpreted as **plant-local midnight in
`Asia/Kolkata`**, not UTC midnight.

The migration's `USING` clause therefore must be explicit, e.g.

```sql
ALTER TABLE "Activity"
  ALTER COLUMN planned_start TYPE timestamptz
  USING (planned_start::timestamp AT TIME ZONE 'Asia/Kolkata');
```

so that `2027-04-10` becomes `2027-04-10T00:00:00+05:30` = `2027-04-09T18:30:00Z`. The
stored UTC instant is *deliberately* the previous calendar day in UTC; it is the same
wall-clock moment at the plant. Every consumer that renders these values must render them in
the plant zone, or dates will appear to shift by one day. That display obligation is a C8
requirement and is the main risk introduced by D3.

`Asia/Calcutta` (the server's setting) and `Asia/Kolkata` are the same zone; the IANA
canonical name `Asia/Kolkata` is adopted for all code and migrations.

### D4 — Planned-date ownership: **CPM becomes the owner** (answers item 10)

> M11 writes `planned_start`/`planned_end` from its forward pass. The seven writers in §6.1.2
> become **intent inputs** (constraints / target dates), not date writers. `early_*` becomes
> internal CPM detail.

This adopts I2 as literally written, and matches P6, where an activity's Start/Finish for
un-started work *is* the CPM early date and a manually typed date is a **constraint**, not a
stored result.

Consequences, in rising order of cost:

- **`early_*` stops being a separate user-facing concept.** Once `planned_*` carries the CPM
  forward pass, `early_start`/`early_finish` are duplicates of it. C1 must state whether they
  are retained as internal columns or retired; if retained, they must not be independently
  displayed or exported, or the system will show the same fact twice.
- **A constraint model is now required, and `Activity` does not have one.** There is no
  `constraint_type` / `constraint_date` on `Activity`. Every one of the seven writers currently
  expresses planner intent *by writing a date*; under D4 that intent needs somewhere to live, or
  converting those writers to "inputs" silently discards it. **This is new schema surface that
  C1/C2 must design** — not in the original R1.0-C scope, and a larger addition than the
  `date → timestamptz` conversion itself.

  A **partial precedent already exists** and is the natural starting point:

  ```5844:5851:prisma/schema.prisma
  model ScenarioActivityOverride {
    duration_hours         Decimal?          @db.Decimal(8, 2)
    planned_start          DateTime?         @db.Date
    planned_end            DateTime?         @db.Date
    is_active              Boolean           @default(true)
    early_start_constraint DateTime?
  ```

  Note three things about it. It is **scenario-scoped**, so it does not help the live plan. It
  models only one constraint type — an implicit start-no-earlier-than — with no type
  discriminator, so it cannot express finish-no-later-than or must-start-on. And it is the
  **only datetime field in this area without `@db.Date`**, i.e. someone already recognised that
  a constraint needs time precision while the planned dates beside it do not. Note also that
  this model's own `planned_start`/`planned_end` are `@db.Date` and are already inside the
  §3.1 in-scope conversion list.

  Two other things named "constraint" in the schema are **not** relevant: the `Constraint` /
  `ConstraintLog` / `project_constraints` family is the turnaround blocker register, and
  `MaterialConstraint.constraint_date` is a material-ETA readiness record. Neither is a CPM
  scheduling constraint, and C1 must not conflate them — the naming collision is a real trap
  for whoever implements this.
- **The two browser algorithms are deleted rather than corrected** (§6.1.3). `ScheduleContainer`
  and `ActivityPlanningGrid` stop computing dates entirely and submit duration and constraint
  intent instead. This is a straightforward simplification and the clearest win of the branch.
- **CPM must run reliably before it owns anything.** If planned dates are CPM output and the
  worker does not run (§6.2), planned dates simply never appear. **D4 makes D5 a hard
  prerequisite, not a parallel improvement.**
- **Every screen and export that reads `planned_*` changes meaning** from "what the planner
  typed" to "what CPM computed". C8 must audit the downstream consumers in §6.4.3 against the
  new semantics.

### D5 — Recalculation coverage: **full** (answers item 11)

> All CPM-input mutations enqueue recalculation; a `worker` service is added to the base
> `docker-compose.yml`; `ActivityService`'s swallowed enqueue failure becomes a hard error.

Consequences:

- Nine mutation classes in §6.2 gain enqueue calls, including all four relationship/lag
  endpoints and calendar CRUD. Calendar CRUD is org-scoped, so a calendar edit must fan out to
  **every event using that calendar** — the existing `enqueueEventScheduleRecalculate` signature
  is event-scoped and will need a fan-out path.
- The two synchronous bypasses (`ResourceLevelingApplyService`, `POST /api/schedule/calculate`)
  must be reconciled with I6/I7 — either routed through the queue or explicitly documented as
  sanctioned synchronous entry points.
- Making enqueue failure fatal means **activity creation starts failing when Redis is down**,
  where today it succeeds silently. That is the correct trade under D4 (a create with no CPM run
  produces an activity with no planned dates at all), but it is a real availability change and
  should be called out in C6's acceptance notes.

### D6 — Scope: **amend R1.0-C to include the constraint model**

> The constraint model required by D4 is designed inside R1.0-C (C1/C2), alongside the
> `timestamptz` conversion, rather than split into a later phase.

The rationale on record is coherence: there is little value in migrating the precision of
columns whose ownership is changing in the same programme. The accepted cost is that R1.0-C
takes longer to reach GREEN, and that its §15 GREEN criteria must now include the constraint
model and the retirement of the seven writers — **the phase cannot be declared GREEN on the
storage conversion alone.**

### D7 — The epoch planned dates: **classify BROKEN and null them** (answers item 8)

> Nulled under this explicit decision, recorded in the migration as a deliberate audited
> correction, and excluded from any constraint derivation so they cannot poison CPM.

**Executed scoping — the correction is 3 rows, and they are test fixtures:**

```
id                                    description        ps          pe          dur_h  status       prog  actuals  rels
e5303f4d-941c-4ebb-9492-7ef8f42a8af8  Test Activity 1    1970-01-01  1970-01-01  20.00  not_started  0     none     0
ccc8de63-3dbe-4c24-b946-98c282b953d2  Test Activity 1    1970-01-01  1970-01-01  20.00  not_started  0     none     0
1ac78091-0ad0-4c2b-aca4-f92b821dc113  Test Activity 1    1970-01-01  1970-01-01  20.00  not_started  0     none     0

created_at: 2026-09-01 10:58:27 / 11:16:16 / 11:26:46, three DIFFERENT created_by users
each is the ONLY activity in its own event (3 distinct single-activity events)
```

Six facts that make this the lowest-risk item in the phase:

1. **Exactly 3 rows**, and both `planned_start` *and* `planned_end` are epoch on all three —
   there is no mixed case where one end is real and the other is epoch.
2. **No other absurd dates exist.** A `planned_start < 2000-01-01 AND <> 1970-01-01` check
   returns 0.
3. **Zero epoch values in any other in-scope column** — `Activity.actual_start`/`actual_end`,
   `events.planned_start`/`planned_end`, `ScenarioActivityOverride.planned_start`, and
   `BaselineActivity.planned_start` (pre-2000) are all 0. The defect is confined to
   `Activity.planned_*`.
4. **They carry no execution facts** — no actuals, 0% progress, `not_started`. Nulling their
   planned dates cannot affect any M12 fact, so I4 and the M12 closure are untouched.
5. **They have no relationships** (`n_rels = 0`), so the constraint-poisoning scenario in
   "D4's effect" cannot actually propagate from these particular rows. The exclusion rule is
   still worth stating as a general safeguard, but there is no live successor chain at risk.
6. **Their provenance is automated test runs**, not planning: identical description
   `Test Activity 1`, identical `duration_hours` of 20.00, three different creating users within
   28 minutes on 2026-09-01, each in its own orphan single-activity event.

One consequence to handle in C9: 3 `BaselineActivity` rows and 6 `ScenarioActivityOverride`
rows reference these activities. Neither carries epoch values of its own (both checked, 0), so
nulling the `Activity` values will not leave an epoch copy behind — but the migration should
record that those 9 dependent rows were inspected and deliberately left alone.

**Execution constraints on D7:** it is a DML correction, so it does **not** run during C0. It
runs as part of the migration, after step 1 of the critical path (a `pg_dump` snapshot with a
*verified* restore), scoped by explicit `id IN (...)` rather than by a `WHERE planned_start =
DATE '1970-01-01'` predicate, so the statement cannot widen if data changes between now and
execution. I13's "no destructive cleanup without a separate explicit decision" is satisfied by
D7 being that decision, and the audit trail is this section.

### D4's effect on the still-open items

D4 is not neutral toward the remaining data-disposition questions:

- **Item 8 (the `1970-01-01` planned dates) is dangerous in principle, though not in this
  corpus.** My earlier reasoning was that CPM ownership makes historical planned values
  disposable because they get recomputed. That is wrong under D4 as specified: if the seven
  writers' dates become *constraints*, then a `1970-01-01` planned date migrates into a
  **`1970-01-01` constraint**, which would drag its whole successor chain to 1970 on the first
  recalculation. **The rule stands: epoch values must be excluded from constraint derivation,
  never carried forward.** D7's scoping then shows the three actual rows have no relationships,
  so nothing would have propagated here — the safeguard matters for the general rule, not for
  these three.
- **Item 6 (`Workpack` planned dates) resolves toward "derived rollup"** — under D4 they cannot
  be independently authored, since activity dates are CPM output. "Retire" and "derive" become
  the same answer expressed at different layers.
- **Item 7 (the six lag rows) is unchanged** by D4, but becomes more urgent: lag now feeds dates
  that are authoritative rather than advisory.

### Still open — five decisions plus one design task

| §12 item | Question | Gates |
|---|---|---|
| ~~2~~ | ~~`project_id` / `schedule_source`~~ | **RESOLVED by §12A — add both** |
| 3 | enum wording settled by D1; M12's status mapping still needs confirming | reconciliation migration |
| 6 | `Workpack` planned dates: retire or derive — D4 pushes toward derive | C1 |
| 7 | the six non-zero lag rows | C1, C3 |
| ~~8~~ | ~~the `1970-01-01` planned dates~~ | **RESOLVED by D7 — null 3 test-fixture rows** |
| 9 | the first calendar record | C4 |
| ~~10~~ | ~~planned-date ownership fork~~ | **RESOLVED by D4 — CPM owns** |
| ~~11~~ | ~~trigger coverage and the worker~~ | **RESOLVED by D5 — full** |
| 12 | the `ScheduleContainer` display fallback | C8 |
| **NEW** | **constraint model design** — D4 requires a place to store planner date intent; `Activity` has no such column. **D6 places this inside R1.0-C.** | **C1, C2** |

**C1 is now blocked on three things:** item 6 (`Workpack` planned dates, which D4 pushes toward
"derived rollup"), item 7 (the six non-zero lag rows), and the design of the constraint model.
Item 9 gates C4; item 12 gates C8; item 3 gates the reconciliation migration.

The constraint model is the largest open design item — D4 converted seven date writers into
"intent inputs" without there being anywhere for that intent to live, and D6 assigned that work
to this phase.

---

## 14. Backup / rollback capability — **CONFIRMED GREEN**

```
C:\Program Files\PostgreSQL\17\bin\pg_dump.exe     → pg_dump (PostgreSQL) 17.10
C:\Program Files\PostgreSQL\17\bin\pg_restore.exe  → pg_restore (PostgreSQL) 17.10

data_directory : C:/Program Files/PostgreSQL/17/data
config_file    : C:/Program Files/PostgreSQL/17/data/postgresql.conf
connection user: postgres   (superuser = true)
database size  : 22 MB
```

`pg_dump` is not on `PATH` — invoke it by full path, or via the short path
`C:\Progra~1\PostgreSQL\17\bin` to avoid shell-quoting failures. The connection user is a
**superuser**, so `ALTER TYPE ... ADD VALUE`, `ALTER TABLE`, and history rebaselining are all
permitted.

This closes the §15 stop condition *"database backup/snapshot cannot be established"*. A
full logical snapshot of a 22 MB database is seconds of work, and `pg_restore` is present, so
the rollback strategy required by I12 is **available in principle**. It must still be
*exercised* — a dump that has never been restored is not verified rollback evidence.

---

## 15. What C0 did NOT do

No schema change. No migration generated, applied, or resolved. No `ALTER`, `CREATE`,
`DROP`, `INSERT`, `UPDATE`, `DELETE`. No seed, cleanup, or backfill. No historical data
touched. No production code modified. No M12, M11, M10 or M8.13 file altered. R0.4 and M12
closures untouched.

All database access was `SELECT` / `information_schema` / `pg_catalog`, plus
`prisma migrate status` and `prisma migrate diff` which are read-only. Temporary probe
scripts and capture files were deleted after transcription.

The code-side forensics in §6.1–§6.4 were carried out by six read-only investigations
(planned-date writers, recalculation triggers, lag semantics, calendar and CPM date maths,
schema/column type truth, downstream consumers). They read source and wrote nothing.

Two things C0 deliberately left unproven, both requiring a write and therefore deferred to a
scratch database in C2:

- whether Prisma 7.9.1 rejects, coerces or truncates a fractional `lag_days` (§6.3);
- the `timestamptz` round trip under a pinned `TimeZone=UTC` (§5).

---

## 16. C0 verdict

> # 🔴 STOP — B1 through B4 must be decided before C1 is frozen and before any schema work
>
> R1.0-C's **data** problem is smaller than feared: 4 columns, 96 populated date values,
> 6 ambiguous lag rows, no structural obstacles, and a 22 MB database that is trivial to
> snapshot. But the database it must migrate is in a state where the ORM cannot read the
> central table, the migration history cannot reproduce the schema, and the only mechanical
> path to alignment destroys live data.
>
> Proceeding to C2 now would mean designing a migration for a schema that does not match the
> database, and executing it through a migration system whose history is fictional. That is
> exactly what §15 exists to prevent.

### The code-side findings enlarge the phase rather than block it

B1–B4 are database blockers and stand unchanged — nothing in §6.1–§6.4 alters them. What the
code forensics change is the **size and shape of C5/C6**, and they trip two more §15
conditions:

| §15 stop condition | State | Basis |
|---|---|---|
| "planned-date authority remains ambiguous" | **TRIPPED** | I2's owner does not exist; M11 writes no planned dates (§6.1.1) |
| "more than one planned-date writer remains" | **TRIPPED** | seven server writers + two client engines (§6.1.2–§6.1.3) |
| "lag semantics cannot be reconciled" | **NOT tripped** | irreconcilable in code, but only 6 non-zero rows, individually adjudicable (§6.3) |
| "migration would reinterpret historical data" | **NOT tripped** | D2/D3 fix the rule; the six lag rows are the only reinterpretation risk |

Both tripped conditions are end-state tests, so they are the C5 workload rather than grounds
to abandon the phase — but they mean **C5 is materially bigger than the instruction assumed**.
With D4 now answered (CPM owns planned dates), C5 becomes: build the planned-date owner inside
M11, design and add a constraint model so the seven writers' intent is not discarded, retire
those seven writers, and delete two divergent browser algorithms. C6 is likewise larger: nine
mutation classes currently trigger no recalculation at all, and in the default dev compose no
worker runs to service the two that do — and under D4, CPM output *is* the plan, so D5 is a
prerequisite rather than an improvement.

**Net effect of D4 on the phase:** R1.0-C is no longer only a time-precision migration. It is a
time-precision migration **plus** the introduction of planned-date ownership and a constraint
model. That is a defensible sequencing choice — there is little point migrating the precision of
columns whose ownership is about to change — but it should be an explicit scope amendment rather
than something absorbed silently into C1.

One correction to the record: §4.1 replaces an earlier claim in this document that the CPM
engine emits hour-level offsets. It does not — it truncates to date strings, exactly as the
original inventory said. The observed `05:30` is entirely the +05:30 write-path skew.

### Revised position after D1–D3 (§13) and the backup confirmation (§14)

Two of the four blockers now have an agreed route, and one is closed:

| Blocker | Position |
|---|---|
| B1 `Activity.project_id` | **Route agreed and unblocked** — D1 adds the missing columns; §12A confirms both must be added, because `ActivityCreationCommand` writes both and therefore **activity creation currently fails outright**. |
| B2 destructive diff | **Route agreed** — D1 forbids `migrate dev`; hand-authored SQL retains all eight tables. Requires `schema.prisma` to declare the retained tables or the trap returns. |
| B3 fictional history | **Route agreed, highest residual risk** — rebaselining must leave the history able to reproduce the schema, or B3 is only renamed. |
| B4 +05:30 skew | **Decided** — D2 (`timestamptz` + UTC connection) and D3 (`Asia/Kolkata`) settle the conversion rule. Mechanism still needs one round-trip experiment in C2. |
| §15 backup | ✅ **CLOSED** — `pg_dump`/`pg_restore` 17.10 present, superuser, 22 MB. |

**Ordered critical path from here:**

1. Snapshot with `pg_dump` and **verify it restores** into a scratch database (turns I12 from
   available into evidenced).
2. ~~Answer §12.2~~ — **no longer blocking**: §12A settles it as "add both columns".
3. Author and apply the reconciliation migration; rebaseline history; confirm both
   `prisma.activity.findFirst()` **and an `Activity` create** succeed. **B1–B3 closed only when
   both pass** (§12A shows creation is currently impossible, not just wide reads).
4. Round-trip experiment on a scratch database to confirm B4 behaviour under `TimeZone=UTC`,
   and — on that same scratch database — settle the fractional-lag question in §6.3 (does
   Prisma 7.9.1 accept `0.5` into `lag_days Int?`).
5. Design the **constraint model** required by D4 and admitted to this phase by D6 (new schema
   surface, not in the original R1.0-C scope), then answer items 6 and 7; freeze C1.
6. Answer item 9; then C2 onwards. Item 12 is needed by C8, not by C1. D7's 3-row epoch
   correction executes inside the migration, after step 1's verified restore.

Steps 1–4 are database-state repair, not R1.0-C. R1.0-C proper begins at step 5, and step 5
now leads with the ownership fork rather than the unit questions, because the unit questions
resolve differently under each branch.

This document remains the gate: **no schema conversion until step 3 demonstrably passes.**
