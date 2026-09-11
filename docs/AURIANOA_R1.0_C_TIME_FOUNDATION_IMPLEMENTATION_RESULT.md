# AURIANOA R1.0-C — TIME FOUNDATION IMPLEMENTATION RESULT

**Phase:** R1.0-C — Time Data Foundation
**Date:** 2026-09-09
**Mode:** Mandatory forensic inventory (§9, §17) COMPLETE. Implementation NOT PERFORMED.

---

## STATUS

> # 🔴 SUPERSEDED BY C0 — HARD STOP, FOUR UPSTREAM BLOCKERS
>
> **Read `docs/AURIANOA_R1.0_C0_TIME_IMPLEMENTATION_PRECHECK.md` first.** On 2026-09-10 the
> C0 precheck obtained live database access for the first time and re-verified this inventory
> against the running database. The environment reason for AMBER below is **resolved** (the
> command channel works via file redirection), but four **new** blockers replaced it, none of
> which is a time-model problem:
>
> | # | Blocker | Status |
> |---|---|---|
> | B1 | `prisma.activity.findFirst()` fails — `P2022 Activity.project_id does not exist in the current database` | Executed proof |
> | B2 | Aligning DB to `schema.prisma` would DROP 8 tables, 3 with data (30 / 6 / 2 rows) | Executed `migrate diff` |
> | B3 | Migration history is not reproducible — 6 unapplied while a later one is applied; ~30 with `applied_steps_count = 0`; baseline recorded rolled back | Executed |
> | B4 | `timestamp without time zone` round trip is skewed by the session offset (+05:30) | Executed, mechanism to confirm |
>
> **Corrections C0 made to this document's findings** (details in the C0 precheck, §1):
> `early_*`/`late_*` are `timestamp(3)` and **do** carry time-of-day, so §25.5's blanket
> precision claim was too broad; `ScheduleCalendar` holds **0 rows**, so the calendar is not
> merely disconnected but absent; the lag ambiguity affects **6 rows**, not a corpus; a
> **second** lag field (`workpack_template_logic_links.lag_hours`, `double precision`) exists
> that this inventory did not record; and `Workpack` planned dates are **entirely
> unpopulated** (0 of 199).
>
> P0-1 (M12 execution-fact fabrication, §25.1) is **CLOSED GREEN** — see
> `docs/AURIANOA_M12_EXECUTION_FACT_INTEGRITY_FIX_RESULT.md` §23.
>
> The AMBER assessment below is retained unedited for audit continuity.

---

## STATUS (historical — 2026-09-09)

> # 🟡 AMBER — INVENTORY COMPLETE, IMPLEMENTATION BLOCKED
>
> **§9 requires the time-model inventory before any schema change, from actual
> production code rather than the audit document. That inventory is complete and is the
> substance of this report.**
>
> **No schema, migration, DTO, validation, test, or product file was modified.**
>
> Implementation is blocked by §29 (*"If the environment prevents testing: report
> AMBER"*). The agent shell channel is non-functional — `echo SHELL_OK` ran **398
> seconds with zero output**. A `date`→`timestamptz` migration and a lag migration
> cannot be applied or verified, and §27 requires **executing** behaviour for
> business-critical facts. Writing an unrunnable migration against 4 date columns and
> every `ActivityRelationship` row would be unverifiable by construction.
>
> **The inventory found 5 P0 and 4 P1 defects, two of which change the R1.0-C plan
> itself.** One is a live execution-fact fabrication (§25.1). One invalidates the
> assumption that a single "current lag semantics" exists to preserve (§25.3).

---

## 1. Scope

Performed: the §9 inventory of every time field, the §17 lineage for 13 time facts, the
authority map, and the writer inventory — all from production source.

Not performed: schema conversion, lag migration, DTO/validation changes, behavioural
tests, E2E, performance, browser. Deferred to R1.0-D/E by §9/§11/§13/§14: calendar-aware
CPM, working-time lag semantics, removal of client-side date calculation.

## 2. Preconditions

| Precondition | State |
|---|---|
| R0.4 gate cleared | ✅ Yes — `AURIANOA_R0.4XX_VERIFICATION_RESULT.md` §30 GREEN |
| 177 → 11 finding withdrawn | ✅ Yes — measurement-unit error (§29.1 there) |
| Retention policy recorded | ✅ Yes — no deletion, no Event assignment |
| Frozen authorities untouched | ✅ M8.13 / M10 / M11 / M12 / M13 / M14 / M15 / M16 unmodified |
| Shell / DB / browser | ❌ **Non-functional** |

## 3. Files inspected

`prisma/schema.prisma` · `src/lib/scheduleEngine.ts` · `src/lib/CalendarEngine.ts` ·
`src/core/schedule/ScheduleOrchestrationService.ts` ·
`src/core/schedule/enqueueEventScheduleRecalculate.ts` ·
`src/workers/scheduleRecalculateWorker.ts` · `src/core/execution/ExecutionWriteService.ts` ·
`src/core/execution/FieldExecutionService.ts` · `src/core/activity/ActivityCreationCommand.ts` ·
`src/core/resources/ResourceLevelingApplyService.ts` · `src/core/resources/ResourceLevelingService.ts` ·
`src/core/resources/CriticalPathIntelligenceService.ts` ·
`src/core/planning/TemplateLibraryService.ts` · `src/core/planning/PlanningReadinessService.ts` ·
`src/core/materials/MaterialScheduleIntegrationService.ts` ·
`src/core/report-engine/providers/PlanningIntelligenceProviders.ts` ·
`src/core/workspace/WorkspaceQueryService.ts` · `src/core/planner-workspace/PlannerWorkspaceService.ts` ·
`src/modules/Scheduling/Services/SchedulingService.ts` ·
`src/modules/Scheduling/parsers/MsProjectXmlParser.ts` ·
`src/modules/Scheduling/formatters/PrimaveraXmlFormatter.ts` ·
`src/components/Schedule/ScheduleContainer.tsx` · `src/components/planning/ActivityPlanningGrid.tsx` ·
`src/components/Workpack/ActivitiesPanel.tsx` · `src/components/Workpack/Activity/BulkPredecessorModal.tsx` ·
`app/api/activities/route.ts` · `app/api/projects/[id]/schedule/activities/route.ts` ·
`app/api/projects/[id]/schedule/activities/[activityId]/route.ts` ·
`app/api/workpacks/[id]/activities/[activityId]/predecessors/route.ts` (+ `[relId]`) ·
`app/api/export/generate/route.ts` · `app/api/projects/[id]/schedule/export/xer/route.ts`

## 4. Schema changes

**NONE.** `prisma/schema.prisma` is unmodified. No migration created.

Current state, verified:

| Field | Model | Declared type | Consequence |
|---|---|---|---|
| `planned_start`, `planned_end` | `Activity` | `DateTime? @db.Date` | **Cannot store time-of-day** |
| `actual_start`, `actual_end` | `Activity` | `DateTime? @db.Date` | **Cannot store time-of-day** |
| `early_start`, `early_finish`, `late_start`, `late_finish` | `Activity` | `DateTime?` (no `@db.Date`) | **Already timestamp-capable** |
| `total_float` | `Activity` | `Decimal? @db.Decimal(12,2)` | Hours (canonical, documented at schema:43) |
| `free_float` | `Activity` | `Float?` | Unit undocumented |
| `duration_hours`, `remaining_duration` | `Activity` | `Float?` | Hours |
| `lag_days` | `ActivityRelationship` | **`Int? @default(0)`** | Integer only — see P0-4 |
| `planned_start_date`, `planned_end_date` | `Workpack` | `DateTime? @db.Date` | Date-only |

**Notable:** the CPM output columns (`early_*`, `late_*`) are **already** full timestamps.
Only the *planned* and *actual* columns are date-truncated. The migration surface is
therefore 4 Activity columns + 2 Workpack columns, not the whole schedule model.

## 5. Date/time model

**Target (designed, not implemented):** `planned_start`, `planned_end`, `actual_start`,
`actual_end` → `timestamptz`; canonical lag in minutes; no truncation of authoritative
values anywhere in the chain.

**Migration policy — no fabricated time-of-day.** Existing `date` values must convert
to that date at **00:00 in the operational timezone**, and this must be recorded as
*"time-of-day was not captured"* rather than presented as a real 00:00 execution fact.
Historical `actual_*` values must **not** receive an invented hour (§16, §29).

## 6. Authority map

| Domain | Authority | Verified |
|---|---|---|
| Progress calculation / aggregation | **M8.13** | ✅ Unmodified |
| Planning readiness | **M10** | ✅ Unmodified |
| Planned dates / CPM / calendar / float | **M11** | ⚠️ **Not actually the owner of `planned_*`** — P0-2 |
| Execution writes / actuals | **M12** | ⚠️ Sole writer, but fabricates one fact — P0-1 |
| Reporting | **M14** | ✅ Read-only over schedule |
| Management intelligence | **M15** | ✅ |
| Conversational interaction | **M16** | ✅ Read tools only (`readTools.ts` selects, never writes) |
| Event = STO campaign boundary | **Event** | ✅ R0.4 GREEN |
| AI → Prisma | **Prohibited** | ✅ No violation found |

## 7. Writer inventory — BEFORE (current state)

### 7.1 `Activity.planned_start` / `planned_end` — persisting writers

| # | Writer | Location | Authority | Verified |
|---|---|---|---|---|
| 1 | `ActivityCreationCommand` | `:481-482` | R0.1 creation | ✅ Read |
| 2 | Activity create API | `app/api/activities/route.ts:64-65` | **none** | ✅ Read |
| 3 | Schedule activity create API | `app/api/projects/[id]/schedule/activities/route.ts:28` | **none** | ✅ Read |
| 4 | Schedule activity PUT | `app/api/projects/[id]/schedule/activities/[activityId]/route.ts:13-18` | **none** | ✅ Read |
| 5 | `ResourceLevelingApplyService` | `:121-122` | leveling | ✅ Read |
| 6 | `ScenarioDomainService` | `:99-100` | scenario | ⚠️ Target table not confirmed |
| 7 | Bulk activity routes | `app/api/activities/bulk`, `app/api/workpacks/[id]/activities/bulk` | **none** | ⚠️ Not read |
| — | **M11 `ScheduleOrchestrationService`** | `:74-75, 105-106, 285` | **M11** | ✅ **SELECT only — never writes `planned_*`** |

**M11 writes `early_*`, `late_*`, `total_float`, `free_float`, `is_critical` — not
`planned_start`/`planned_end`.** Confirmed by reading the service and by
`tests/m11-v1-schedule-view.test.ts:149-163`, which asserts persistence of `early_start`,
`early_finish`, `late_start`, `is_critical`, `free_float` and never `planned_*`.

### 7.2 `Activity.actual_start` / `actual_end`

| Writer | Location | Verdict |
|---|---|---|
| `ExecutionWriteService` START | `:265-267` | ✅ Correct — `executionDate` |
| `ExecutionWriteService` UPDATE_PROGRESS | `:282-286` | ✅ Correct — `executionDate` |
| `ExecutionWriteService` COMPLETE | **`:302-303`** | 🔴 **P0-1 — writes `existing.planned_start` into `actual_start`** |
| `ScheduleContainer.tsx` | `:536-538, 567-568` | ⚠️ Presentation-only, but misleading — P1-1 |

**M12 is the sole persisting writer of actuals.** That boundary holds.

### 7.3 `ActivityRelationship.lag_days` — writers and readers

**Writers (day↔hour conversion factor):**

| Writer | Location | Factor |
|---|---|---|
| Predecessor create API | `predecessors/route.ts:7-10, 54, 120` | **÷ 8** (comment: *"1 day = 8 hrs"*) |
| Predecessor update API | `predecessors/[relId]/route.ts:29` | **÷ 8** |
| `TemplateLibraryService` | `:655` | **÷ 24** |
| MS Project import | `MsProjectXmlParser.ts:102-105` | **÷ hoursPerDay** (working days) |
| `ProjectBranchingService` | `:102` | copy-through |

**Readers (interpretation):**

| Reader | Location | Factor |
|---|---|---|
| **CPM engine** | `scheduleEngine.ts:172` | **raw days** (wall-clock, via 24h `addDays`) |
| Deprecated CPM | `SchedulingService.ts:119, 137, 158` | raw days |
| `ActivitiesPanel` display + editor | `:319, 764` | **× 8** |
| `BulkPredecessorModal` | `:54` | **× 8** |
| XER export | `export/xer/route.ts:102` | **× 8** (*"Assuming 8h/day"*) |
| Generic export | `export/generate/route.ts:505` | **× 24** |
| Primavera XML formatter | `PrimaveraXmlFormatter.ts:104` | **× 10** (*"assume 10h/day"*) |
| Workspace / PlannerWorkspace | `:154` / `:404` | raw, rendered `+Nd` |

## 8. Writer inventory — AFTER

**Unchanged.** No writer was added, removed, or re-pointed. Target end-state (R1.0-C/D):
M11 becomes the sole writer of derived `planned_*`; writers 2–7 above become
constraint/input writers, not date-truth writers; one canonical lag unit.

## 9. Calendar implementation

**Unchanged and incomplete.** `CalendarEngine` exists and exposes `addWorkingDays()`, but
M11 consumes only `calendar.getHoursPerDay()` — asserted by
`tests/m11-v1-schedule-view.test.ts:891-894, 1012-1015`
(`working_hours_per_day: calendar.getHoursPerDay()`).

`ScheduleCalendar.work_days`, holidays/`exceptions`, and shifts are **not** reaching the
CPM engine; `scheduleEngine` advances time with raw 24-hour arithmetic. Full calendar
integration is explicitly **R1.0-D** (§13) and was not attempted. **No second calendar
engine was created.**

## 10. Lag implementation

**Unchanged.** No `lag_minutes` column added, no migration written.

The §12 rule (`lag_minutes = lag_days × 1440`, never `× hours_per_day × 60`) is
**correct for preserving CPM behaviour**, because the engine reads `lag_days` as
wall-clock days (`scheduleEngine.ts:172` feeding 24-hour arithmetic).

**But see P0-3:** stored values were authored under **three different writer
conventions** (÷8, ÷24, ÷hoursPerDay). `× 1440` faithfully preserves *what the engine
currently computes*, which is the right invariant — while necessarily **not** preserving
original author intent for rows written by the ÷8 and ÷24 paths. This must be stated in
the migration record, not glossed: it is the difference between preserving engine
behaviour and preserving business meaning, and only the former is achievable.

## 11. CPM integration

**Unchanged and verified correct.** The single chain, traced file by file:

```
route/change → enqueueEventScheduleRecalculate (Event-scoped, tenant-checked, fails closed)
             → scheduleRecalculateQueue
             → scheduleRecalculateWorker (rejects missing eventId/orgId)
             → ScheduleOrchestrationService.calculateEventSchedule
             → CalendarEngine (hours/day only) → scheduleEngine.calculateSchedule
             → $transaction persistence of early_*/late_*/float/is_critical
```

No browser CPM, no report CPM, no dashboard CPM. `ResourceLevelingService:135` calls
`calculateSchedule` for **simulation** only and is classified as such by
`tests/m11-v1-schedule-view.test.ts:1070-1071`. `SchedulingService` retains CPM math but
is `@deprecated` — recorded as **P2-1**.

## 12. Planned date propagation

**Not implemented — and currently not possible.** The §15 requirement (A finishes
10-Apr-2027 14:00 ⇒ B starts 10-Apr-2027 14:00 automatically) fails on two independent
grounds:

1. **P0-5** — `planned_start`/`planned_end` are `@db.Date`; 14:00 cannot be stored.
2. **P0-2** — M11 writes `early_*`, not `planned_*`; nothing propagates CPM output into
   the fields the UI reads.

## 13. Actual date propagation

**Not implemented.** `actual_*` are `@db.Date`, so execution time-of-day is unstorable.
M12 remains the sole writer, but **P0-1** means one path persists a planned value as an
execution fact.

## 14. Baseline handling

**Not modified.** `BaselineActivity` / `ScheduleBaseline` exist; baseline timestamp
capability was **not verified** (would require reading the baseline write path). Baseline
was **not** made mutable. Carried to R1.0-D as an open verification item.

## 15. Forecast handling

**Not implemented.** `ScheduleForecastService` reads `planned_start`/`planned_end`
(`:92-93`) and is subject to the same date-only limitation. No forecast engine was
created.

## 16. Legacy-data handling

Fully aligned with the retention policy. **No** deletion, soft-deletion, Event
assignment, Event inference, ownership change, reseed, or mass update. The Event-less
population is retained as class **B/C** regression material. No row was read or written —
the database was never contacted.

## 17. Test-data strategy

Recorded, not built. Scenarios must exercise the real engines (§6): `ActivityCreationCommand`
for creation, `ScheduleOrchestrationService` for planned schedule, `ExecutionWriteService`
for execution, M8.13 for progress, M14/M15/M16 downstream. **No parallel test-data engine
was created.** No provenance field was added, and no retroactive labelling of existing
rows was performed (§24).

## 18. Behavioural tests

**NONE WRITTEN.** §27 requires executing behaviour for business-critical facts; with no
shell, a written test cannot be distinguished from a passing test. Writing 25 unrunnable
scenarios (T01–T25) would manufacture the appearance of coverage. Deferred intact.

## 19. Regression tests

**Not re-run.** Last known state (user-executed): **1482/1485 passing**, 73/75 files;
3 failures classified **B — stale source-string expectations** with the authority chain
verified. Nothing in this phase could change that, since no product file was touched.

## 20. E2E evidence

**NONE.** §18/§19/§20 chains not executed — no runtime.

## 21. Performance evidence

**NONE.** No benchmark executed.

## 22. Browser evidence

**NONE — ENVIRONMENT BLOCKED.** Not attempted, not claimed as PASS.

## 23. Tenant / event isolation

**Unchanged.** No query, guard, or scope was modified. R0.4 evidence stands:
`enqueueEventScheduleRecalculate:44-51` verifies Event ownership by `organization_id` and
returns `CROSS_TENANT_EVENT`; the worker rejects missing `orgId`.

## 24. Authority compliance

| §26 anti-pattern | Introduced by this phase? |
|---|---|
| Browser-owned planned dates | ❌ No (pre-existing — P1-2) |
| Second CPM / calendar / progress engine | ❌ No |
| Copied planned dates maintained independently | ❌ No |
| Manually duplicated actual dates | ❌ No (pre-existing — P0-1) |
| Date-only truncation of operational timestamps | ❌ No (pre-existing — P0-5, P1-3) |
| Silent lag-unit conversion | ❌ No — documented instead (§10) |
| AI-written schedule / execution facts | ❌ No |
| Report/dashboard-specific schedule calculation | ❌ No |
| SQL repair of test data | ❌ No |
| Organisation-wide deletion | ❌ No |
| Automatic Event inference | ❌ No |
| Project as STO operational authority | ❌ No |

**This phase introduced no anti-pattern, because it changed no product code.**

## 25. Remaining defects

### 25.1 ✅ P0-1 — M12 fabricates an execution fact — **FIXED AND CLOSED GREEN**

> **Closed 2026-09-09.** The fallback was removed; `COMPLETE` now assigns `executionDate`.
> Behaviourally verified — T1–T6 plus structural guard **7/7 PASS**, M12 suite **108/108**,
> M8.13 **48/48**, M11 **146/146**. Evidence in
> `docs/AURIANOA_M12_EXECUTION_FACT_INTEGRITY_FIX_RESULT.md` §23. The defect description
> below is retained unedited as the historical record of what was wrong.

```302:303:src/core/execution/ExecutionWriteService.ts
      if (!existing.actual_start) {
        updates.actual_start = existing.planned_start || executionDate;
      }
```

On `COMPLETE`, a missing `actual_start` is **persisted from `planned_start`**. This
directly violates §16 (*"Do not derive an actual Start from a planned Start merely
because the actual Start was not supplied"*) and §26 (fabricated execution facts). It is
also **internally inconsistent**: `START` (`:265-267`) and `UPDATE_PROGRESS` (`:282-283`)
both correctly use `executionDate`. Only `COMPLETE` back-fills from the plan. A planned
date then becomes indistinguishable from a measured execution fact forever.

### 25.2 🔴 P0-2 — planned dates have no authoritative owner

M11 persists `early_*`/`late_*`; **six or seven** other paths write `planned_*` (§7.1).
Per §17, a fact with multiple business writers is a defect unless justified — there is no
justification here. This is the core R1.0-C/D problem.

### 25.3 🔴 P0-3 — lag has no single current semantics (changes the plan)

Six mutually inconsistent day↔hour factors across writers and readers: **÷8, ÷24,
÷hoursPerDay** on write; **raw, ×8, ×10, ×24** on read (§7.3). Identical user intent
produces different stored values depending on entry path, and identical stored values
export differently to XER (×8) versus Primavera XML (×10) versus generic export (×24).

**Impact on R1.0-C:** the premise that migration "preserves current semantics" needs
qualifying — it preserves the **CPM engine's** reading (§10), which is the only coherent
invariant available.

### 25.4 🔴 P0-4 — fractional lag written into an `Int` column

`lagHoursToDays` (`predecessors/route.ts:8-10`) returns `Math.round((hours/8)*100)/100` —
a 2-decimal value. `lag_days` is **`Int? @default(0)`** (`schema.prisma:267`). A 4-hour
lag yields `0.5` into an integer column, which Prisma will reject. **Sub-day lag appears
to be broken end-to-end via this API.** Needs a runtime confirmation.

### 25.5 🔴 P0-5 — date-only operational columns

`planned_start`, `planned_end`, `actual_start`, `actual_end` are `@db.Date`.
`10-Apr-2027 14:00` is unstorable. This is the primary R1.0-C target.

### 25.6 P1 defects

| ID | Defect | Location |
|---|---|---|
| P1-1 | Browser displays `planned_start` **as** `actual_start` when progress > 0, indistinguishably — violates §19's "clear incomplete-data state"; also derives `status` in the view | `ScheduleContainer.tsx:536-538, 567-568` |
| P1-2 | Browser generates planned dates: `new Date().toISOString().slice(0,10)` | `ActivityPlanningGrid.tsx:208-209, 233-234` |
| P1-3 | CPM engine truncates planned/actual inputs to `YYYY-MM-DD` | `scheduleEngine.ts:416-420` |
| P1-4 | Second planned-date writer, applied before M11 recalculation | `ResourceLevelingApplyService.ts:121-122` |

**Truncation sites (all authoritative-value truncations):** `scheduleEngine.ts:416-420` ·
`FieldExecutionService.ts:329-330, 541-542` · `PlanningReadinessService.ts:536-537` ·
`MaterialScheduleIntegrationService.ts:99,101,108,114,116,123` ·
`PlanningIntelligenceProviders.ts:67,69` · `CriticalPathIntelligenceService.ts:226-229` ·
`ActivityPlanningGrid.tsx:102-103`.

## 26. P0 / P1 / P2 / P3 classification

| Severity | Count | Items |
|---|---:|---|
| **P0** | **5** | P0-1 fabricated actual · P0-2 no planned-date owner · P0-3 lag semantics · P0-4 fractional lag into Int · P0-5 date-only columns |
| **P1** | **4** | P1-1 misleading actuals in UI · P1-2 browser-generated planned dates · P1-3 CPM input truncation · P1-4 leveling second writer |
| **P2** | **2** | P2-1 `SchedulingService` deprecated but retains CPM math · P2-2 `free_float` unit undocumented |
| **P3** | **2** | P3-1 export factors inconsistent (×8/×10/×24) · P3-2 3 stale source-string tests (R0.4 §27) |

**P0-1 is newly discovered and is a live data-integrity issue** independent of R1.0-C:
it silently converts plan into recorded fact on every `COMPLETE` with a missing actual
start.

## 27. Rollback plan

**No rollback required — nothing was changed.**

| Artefact | State |
|---|---|
| `prisma/schema.prisma` | Unmodified |
| Migrations | None created |
| Product source | Unmodified |
| Tests | Unmodified |
| Database | Never contacted |
| Files changed | `AURIANOA_R0.4XX_VERIFICATION_RESULT.md` (§4 correction), this document |

## 28. Final decision

> **Superseded by C0 (2026-09-10).** The environment blocker cited here is resolved; the
> current decision is the C0 hard stop on blockers B1–B4 recorded in
> `docs/AURIANOA_R1.0_C0_TIME_IMPLEMENTATION_PRECHECK.md` §14. Retained unedited for audit
> continuity.

# 🟡 AMBER — R1.0-C INVENTORY COMPLETE, IMPLEMENTATION DEFERRED

**Not GREEN:** no schema change, migration, or behavioural test was executed. Under §27
and §29, unrunnable artefacts cannot be evidence.

**Not RED:** the mandatory precondition is satisfied, and no anti-pattern was introduced.

### §29 stop conditions encountered

| Condition | Encountered |
|---|---|
| Tests cannot distinguish product failure from environment failure | 🔴 **Yes** — shell dead |
| Timestamp precision cannot be preserved *(currently)* | 🔴 **Yes** — P0-5 |
| Actual execution facts would be fabricated | 🔴 **Yes, already are** — P0-1 |
| Planned dates remain writable outside M11 | 🔴 **Yes** — P0-2 |
| Lag semantics changed without design approval | ✅ No — documented (§10) |
| Calendar semantics cannot be established | ⚠️ Partially — R1.0-D |
| Real customer identity in data targeted for modification | ✅ No data targeted |
| Project found to be operational authority | ✅ No |
| Second CPM / progress engine required | ✅ No |
| Tenant / event isolation uncertain | ✅ No |

### §30 Final governing question

> *"Can AURIANOA enter a time-related business fact once, preserve it with correct time
> precision and authority, automatically propagate it through planning, execution,
> progress, Control Tower, reporting and management, while safely handling incomplete
> legacy data?"*

# PARTIALLY

**What holds today:** single CPM chain through M11 (§11, chain-verified); M12 as sole
persisting execution writer; M8.13 as sole progress authority; Event as sole STO
container; tenant/event isolation; AI never writing Prisma; and legacy incomplete data
handled without inference.

**What does not hold:** time **precision** is lost — `planned_*` and `actual_*` are
date-only, so `14:00` cannot survive entry (P0-5). **Propagation** does not occur — M11
writes `early_*` while the application reads `planned_*` (P0-2). **Enter once** is
violated by six-plus planned-date writers plus browser-generated dates (P0-2, P1-2). And
one execution fact is **fabricated** rather than recorded (P0-1).

### Recommended order

1. **Fix P0-1 immediately** — a one-line change, independent of R1.0-C, currently
   corrupting execution facts. Requires explicit approval since it touches M12.
2. Confirm **P0-4** at runtime (does sub-day lag error or silently coerce?).
3. Restore the shell, then execute R1.0-C: `timestamptz` migration + `lag_minutes = lag_days × 1440`
   + behavioural tests T01–T25 with real execution.
4. R1.0-D: calendar-aware CPM, working-time lag decision, M11 as sole `planned_*` writer.
5. R1.0-E: remove browser date authority (P1-2), fix misleading actuals display (P1-1).

**R1.0-D was not started.**
