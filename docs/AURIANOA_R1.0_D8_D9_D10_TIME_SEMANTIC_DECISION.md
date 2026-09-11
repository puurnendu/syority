# AURIANOA R1.0-C — D8 / D9 / D10 TIME SEMANTIC DECISION & DESIGN GATE

**Phase:** R1.0-C — semantic decision gate before C1 (time-contract freeze)
**Date:** 2026-09-10
**Mode:** READ-ONLY FORENSIC + DESIGN. No code, no schema, no migration, no database write.
**Decides:** D8 (Workpack planned-date semantics) · D9 (lag semantics) · D10 (constraint model)

---

## 1. Executive Summary

> # 🟡 AMBER — D9 CLOSES GREEN. D8 AND D10 EACH NEED ONE PRODUCT DECISION.
>
> **C1 cannot be frozen yet.** Two of the three decisions resolve to a single unambiguous
> semantic; the third and the override policy each contain a genuine business question that
> must not be invented by an agent.

| Decision | Verdict | Why |
|---|---|---|
| **D8** — Workpack planned dates | 🟡 **AMBER** | **Five** different live semantics (§3.4), including a named, score-weighted **"Execution Calendar"** artefact. The *schedule-span* half is decidable; whether the Execution Calendar is a real separate fact is a product question (§4.1) |
| **D9** — Lag semantics | 🟢 **GREEN** | Canonical unit settled, engine semantics proven behaviourally, all six rows identified as test fixtures, fractional-lag defect reproduced (§5–§8) |
| **D10** — Constraint model | 🟡 **AMBER** | The model is designable and its type set is evidence-bounded (§11), but the **override policy** needs product input and implementing it requires lifting a governance freeze (§12.4) |

### The seven findings that matter most

1. **D4 is not implementable without D10.** The CPM engine reads `Activity.planned_start` as a
   start-offset seed for every activity with no predecessor — **58 of 72 live activities,
   80.6%**, of which 45 have a `planned_start` to seed from (§9.3). D4 makes CPM the *writer*
   of `planned_start`. Making CPM both the reader and the writer of the same column means it
   consumes its own output, and permanently fuses "what the planner asked for" with "what CPM
   computed" in one column. **A constraint carrier is a hard prerequisite for D4, not an
   enhancement.**
2. **Sub-day lag is not "broken silently" — it fails loudly, and cannot corrupt data.**
   `lag_days` is `integer` with `numeric_scale = 0`. `lagHoursToDays(4)` returns `0.5`.
   PostgreSQL rejects the bound parameter with `22P02 invalid input syntax for type integer:
   "0.5"` (§7). Prisma 7's client-side validation does **not** reject it. So the API 500s and
   no bad value is ever stored. The R1.0-C inventory's P0-4 prediction ("*which Prisma will
   reject*") had the right outcome and the wrong mechanism.
3. **`lag_minutes = lag_days × 1440` is now proven, not assumed.** Holding lag at 1 and varying
   `working_hours_per_day` across 8, 10 and 24 moves the *duration* but leaves the successor's
   start exactly one calendar day after the predecessor's finish in all three cases (§5.3). Lag
   never touches `hours_per_day`. The preservation rule is exact.
4. **All six non-zero lag rows are CPM float-test fixtures, not planner intent** (§6). Three
   identical triplets in three different organisations, created within 101 seconds on
   2026-08-29, with descriptions `Critical Act`, `Non-Crit Low Float`, `Non-Crit High Float`,
   `Sink`. Every one of the 20 relationships in the database has `created_by = NULL`, which
   rules out both the ÷8 API path and the ÷24 template path. **There is no author intent to
   recover because there was no author.**
5. **The shutdown window constrains nothing.** `Event.planned_end` is populated on 49 of 51
   events and is *selected* by `ScheduleOrchestrationService` — then never used. The engine
   accepts a `target_finish_date` and **no caller anywhere supplies one** (§10.3). Total float
   is therefore self-referential: no activity can ever show negative float against the
   committed shutdown window, and the plan cannot be shown to overrun it.
6. **A pattern, not an accident: this codebase repeatedly declares schedule-constraint
   machinery and never connects it.** `ScenarioActivityOverride.early_start_constraint` occurs
   **exactly once repository-wide** — its own schema line (§11.2).
   `MaterialScheduleIntegrationService`, a complete material-ETA-to-`planned_start` integration,
   has **zero callers** (§11.3.1). `CalendarEngine.addWorkingDays()` is never called from the CPM
   path. `Event.planned_end` is fetched and dropped. **Four built-and-unwired mechanisms.** C2
   must explicitly retire or adopt each one rather than adding a fifth alongside them.
7. **New blocker B7 — and it explains B2.** `ShiftDefinition`, `ResourceCapacity` and
   `workpack_asset_snapshots` are **not declared in `prisma/schema.prisma`** yet exist in the
   database with 6, 30 and 2 rows, and `ResourcePlanningService` calls two of them at fifteen
   sites — so those calls throw at runtime. This is the mirror image of B1, and it is why
   `migrate diff` proposes dropping 8 tables: the schema has simply forgotten them (§17.3).

### What is NOT a problem

`Workpack.planned_start_date` / `planned_end_date` are **0 of 199 populated**, and the six lag
rows are fixtures. **Neither D8 nor D9 carries any historical-data migration risk.** Whatever
is decided, no business value is reinterpreted. That is why D8 sitting at AMBER does not, by
itself, block schema work (§19).

---

## 2. Evidence Sources

### 2.1 Documents read

| Document | Read | Contradicted by current code? |
|---|---|---|
| `docs/AURIANOA_R1.0_C_TIME_FOUNDATION_IMPLEMENTATION_RESULT.md` | Completely | Partly — see §2.2 |
| `docs/AURIANOA_R1.0_C0_TIME_IMPLEMENTATION_PRECHECK.md` | Completely (authored) | No |
| `docs/AURIANOA_M12_EXECUTION_FACT_INTEGRITY_FIX_RESULT.md` | §23 closure verified | No — M12 GREEN stands, untouched |

### 2.2 Corrections this task makes to the R1.0-C inventory

Per §1 of the governing instruction, the audit documents were **not** taken on trust.

| Inventory claim | Location | Corrected finding |
|---|---|---|
| "A 4-hour lag yields `0.5` into an integer column, **which Prisma will reject**" | §25.4 | Outcome right, mechanism wrong. **Prisma does not reject it** — validation passes and the value reaches the transport. **PostgreSQL** rejects it (`22P02`). §7 |
| Writer list names `app/api/activities/route.ts:64-65` and `schedule/activities/route.ts:28` as planned-date writers | §7.1 rows 2–3 | These are **entry points, not persisting writers** — both call `ActivityService.createActivity` → `ActivityCreationCommand`. Verified at `app/api/activities/route.ts:57` |
| "`ScenarioDomainService` — ⚠️ target table not confirmed" | §7.1 row 6 | The target is `ScenarioActivityOverride`, which has its **own** `planned_start`/`planned_end` (`schema.prisma:5847-5848`) — it does not write `Activity`. §11.2 |
| Lag ambiguity framed as affecting stored business values | §10, §25.3 | The ambiguity is **real in code and empty in data**: no stored row was written by any converting path (§6.3) |

### 2.2.1 Corrections this task makes to its OWN earlier findings

Recorded for audit continuity rather than silently amended:

| Earlier claim in this analysis | Correction |
|---|---|
| "No rollup exists: no `_min`/`_max` aggregation, no `MIN`/`MAX` SQL, classification (B) is not implemented anywhere" | **Wrong.** `app/api/workpacks/[id]/activities/date-range/route.ts:22-30` is exactly that aggregate, and `WorkpackTabs.tsx:183-193` PATCHes it into the workpack behind a **"Sync"** button. §3.2.1 |
| `MATERIAL_AVAILABLE` rejected as having "no implementation and no evidenced requirement" | **Understated.** `MaterialScheduleIntegrationService` implements material→schedule pre-adjustment in full and has **zero callers**. The type still stays out of the set, but for a different and better reason. §11.3.1 |
| `early_start_constraint` described as "0 of 11 rows so never exercised" | **Weaker than the truth.** The identifier occurs **exactly once repository-wide** — the schema line itself. It is dead schema, not merely unused data. §11.2 |
| Workpack writers counted as six | **Fourteen entry points, two persisting writers.** §3.2 |

### 2.3 Executed evidence

All database access was `SELECT` / `information_schema` / `pg_catalog`. No `INSERT`, `UPDATE`,
`DELETE`, `ALTER`, `CREATE`, `DROP`, migration, seed or backfill. Probe scripts were temporary
and deleted after transcription.

| Evidence | Method |
|---|---|
| Lag row census + full lineage | `SELECT` with joins to predecessor/successor activities |
| CPM lag semantics for 0, 0.25, 0.5, 0.75, 1, 2, −1, 5, 13 | Direct invocation of the pure `calculateSchedule()` — no database |
| `hours_per_day` invariance of lag | Same, across hpd = 8, 10, 24 |
| FS / SS / FF / SF behaviour with lag | Same |
| `lagHoursToDays` return values | Executed mirror of `predecessors/route.ts:8-10` |
| Prisma client-side validation of `0.5` into `Int?` | `create()` against an **unreachable** connection — proves validation outcome with zero database contact |
| PostgreSQL integer coercion of `0.5` | `SELECT $1::int` through the same adapter and pool as production |
| Population census of every window/constraint/milestone carrier | `SELECT COUNT(*)` per table |
| Existing engine tests | `vitest run src/lib/scheduleEngine.test.ts src/lib/CalendarEngine.test.ts` → **48/48 passed** |
| Exhaustive writer/reader sweep for Workpack planned dates (34 files) | Delegated forensic sweep, then every load-bearing claim re-verified directly — which is how §3.2.1 caught my own error |
| Exhaustive constraint-mechanism sweep (20 mechanisms, 4 "constraint" families) | Same method. Where the sweep contradicted my executed evidence, **the executed evidence was retained** — see §2.3.1 |

#### 2.3.1 One contradiction resolved in favour of execution

The constraint sweep reported that negative lag is *"honored (no clamp to ≥0)"*, citing
`scheduleEngine.ts:172`. That reads the parse site correctly but misses the forward pass, where
`maxEarlyStart` is initialised to `0` (`:264`) and the result is wrapped in `Math.max(0, …)`
(`:286`). **Executed evidence overrides it:** lag −1, −2 and −5 with a predecessor finishing at
offset 1.0 all produce `B early_start = 2027-04-10`, i.e. offset 0 (§5.4). Negative lag is
clamped. The engine's own test suite documents the clamp at `scheduleEngine.test.ts:184`.

### 2.4 Production source inspected

`src/lib/scheduleEngine.ts` (complete) · `src/core/schedule/ScheduleOrchestrationService.ts` ·
`prisma/schema.prisma` · `app/api/workpacks/[id]/activities/[activityId]/predecessors/route.ts` ·
`src/core/planning/TemplateLibraryService.ts` · `src/modules/Workpack/Services/WorkpackService.ts` ·
`src/components/Workpack/WorkpackCreateForm.tsx` · `app/api/dashboard/portfolio-stats/route.ts` ·
`src/core/planning/PlanningReadinessService.ts` · `app/api/activities/route.ts` ·
`app/api/projects/[id]/schedule/activities/route.ts` · `src/lib/scheduleEngine.test.ts`

---

## 3. D8 — Workpack Planned-Date Forensics

### 3.1 What the columns are

```109:110:prisma/schema.prisma
  planned_start_date             DateTime?                    @db.Date
  planned_end_date               DateTime?                    @db.Date
```

They sit in the model's **scope-definition block**, between `scope_of_work` and
`estimated_manhours` — not near `overall_progress` or any CPM field. That placement is a weak
signal, but it is consistent with everything in §3.2: they were built as work-order intent.

**Executed database truth:**

```
Workpack rows                : 199
planned_start_date populated :   0
planned_end_date   populated :   0
locked_at          populated :   0
```

**Proven absence — there is no actual-date counterpart.** A query for any `Workpack` column
matching `%actual%` returns **zero rows**. The complete set of date/time columns is
`planned_start_date`, `planned_end_date`, `locked_at`, `created_at`, `updated_at`, `deleted_at`,
`ai_auto_filled_at`, `approval_submitted_at`, `approval_decided_at` — the last three being
workflow timestamps. So these columns **cannot** be a plan-versus-actual tracking pair, which
eliminates one candidate meaning outright.

### 3.2 Writers — fourteen entry points, all human pass-throughs, none derives anything

| # | Writer | Location | What it writes |
|---|---|---|---|
| W1 | Workpack create form | `WorkpackCreateForm.tsx:83-84`, `:234-235` | **A human types them.** `new Date(formData.planned_start_date)` |
| W2 | `WorkpackService` (the persisting writer) | `WorkpackService.ts:138-139` | `data.planned_start_date` straight to Prisma |
| W3 | AI-generate route | `app/api/workpacks/ai-generate/route.ts:144-145` | `formPayload.planned_start_date` — from the form. **AI supplies manhours, not dates** |
| W4 | Template instantiation service | `TemplateLibraryService.ts:572-573` | `opts.planned_start_date` pass-through |
| W5 | Template instantiate route | `app/api/planning/templates/[id]/instantiate/route.ts:34-37` | Request body |
| W6 | Template instantiate page | `app/(dashboard)/planning/templates/[id]/instantiate/page.tsx:42-43` | UI `start` / `end` fields |

Two further writers found on second pass, both of which widen the surface:

| # | Writer | Location | What it writes |
|---|---|---|---|
| W7 | `WorkpackService.updateWorkpack` | `WorkpackService.ts:270-272` | **Unfiltered spread of the PATCH body** — any caller that includes these fields sets them |
| W8 | Planner-workspace batch grid | `PlannerWorkspaceService.ts:498-501`, editable-field allow-list at `:132-133` | Inline grid edit of `planned_start_date` / `planned_end_date` |

Plus five further UI/API entry points that funnel into W2/W7: `WorkpackHeader.tsx:140-146`
(header edit, clears to `null`), `WorkpackIntelligenceService.ts:73-74`,
`app/api/workpack-intelligence/instantiate/route.ts:23-24`, `app/api/workpacks/route.ts:98-106`,
`app/api/workpacks/[id]/route.ts:43-58`. **Fourteen entry points, two persisting writers, and
every one originates in a human typing a date.**

Two absences worth recording because they show intent: `WorkpackService.ts:363` **deliberately
omits** planned dates when cloning (with the comment *"deliberately omit: … planned dates"*), and
`ScopeChangeApplicationService.ts:126-164`, `SeedPackService.ts:797-807` and the
workpack-factory create paths set none. **No seed file anywhere sets them** — which is why the
column is empty.

### 3.2.1 CORRECTION — a rollup DOES exist, and I previously reported otherwise

An earlier pass of this analysis stated that no rollup was implemented and that classification
(B) was absent. **That was wrong.** A rollup exists, is production-reachable, and is exposed to
users:

```22:30:app/api/workpacks/[id]/activities/date-range/route.ts
    const result = await prisma.activity.aggregate({
        where: {
            workpack_id: id,
            deleted_at: null,
        },
        _min: { planned_start: true },
        _max: { planned_end: true },
        _count: { id: true },
    });
```

`WorkpackTabs.tsx:169-181` fetches it, computes `startMismatch` / `endMismatch` against the
workpack's own dates, and offers a **"Sync"** button which PATCHes the aggregate into the
workpack (`:183-193`), confirming with the toast **"Dates synced to activity schedule"**
(`:202`).

**This changes the D8 evidence in three ways:**

1. **The MIN/MAX span semantic is already implemented and already endorsed by a user-facing
   affordance.** §4.1 is therefore not a new invention — it promotes an existing opt-in
   behaviour to the authoritative one.
2. **The existing inclusion rule is `deleted_at: null` only** — it does **not** exclude
   `cancelled` activities. My §4.1 proposal to exclude cancelled therefore *differs* from the
   shipped code and must be stated as a deliberate change (zero data impact: no cancelled rows
   exist).
3. **The mismatch indicator is itself structurally dead.** `startMismatch` requires *both* the
   activity date **and** the workpack date to be non-null (`:180-181`), and the workpack side is
   0 of 199. So the divergence warning can never fire either.

The rollup is **not** automatic: nothing recomputes it on activity change, and `RollupEngine.ts`
(`:171-214`) rolls up duration, crew and UDFs but **no dates**. So classification (B) is
**implemented as a manual, one-shot, user-triggered copy** — which is the worst of both worlds:
it looks derived, but it is a snapshot that goes stale silently the moment any activity moves.

### 3.3 Readers — 34 files, and they do not agree

| Reader | Location | Semantic it assumes |
|---|---|---|
| Portfolio dashboard "overdue" KPI | `app/api/dashboard/portfolio-stats/route.ts:196-217` | **CONTRACTUAL DEADLINE** — computes `days_overdue = (now − planned_end_date) / 86 400 000` |
| Portfolio "starting this week" | same, `:178-181` | **SCHEDULED START** |
| **M10 readiness — "Execution Calendar"** | `PlanningReadinessService.ts:144-145`, `:477-484` (check key `calendar`) | **A NAMED BUSINESS CONCEPT** — see §3.3.1 |
| **Readiness score criterion `execution_calendar`** | `ReadinessScoreService.ts:17`, `:65` | Same, weighted **8%** of the workpack readiness score |
| Activities panel → Gantt | `ActivitiesPanel.tsx:968-969`; viewport at `GanttChart.tsx:44-45, 58` | **CHART SPAN BOUNDS** — passed as `workpackStart` / `workpackEnd` |
| Workpack tab display + mismatch + Sync | `WorkpackTabs.tsx:176-181, 278-301` | **DERIVED SPAN** (§3.2.1) |
| AI missing-field warnings | `WorkpackAiService.ts:149-150` | "No planned start date" |
| Shutdown report provider | `ShutdownProviders.ts:117, 125` | Report columns `start` / `end` |
| Planner workspace grid | `PlannerWorkspaceService.ts:54-55, 342-343`; `WorkpackGrid.tsx:42-43` | Editable grid columns "Start" / "End" |
| Identity review queue | `WorkpackIdentityReviewService.ts:147-148, 213-214` | Review metadata |
| Equipment 360, workpack list | `Equipment360Client.tsx:254-255`, `WorkpackListTableBody.tsx:93-102` | Display columns |
| PDF / print | `PdfService.ts:1358-1359`, `printVariables.ts:62-70` | "Planned Start" / "Planned End" |
| **MS Project export** | `export/ms-project/route.ts:60-61, 151` | Project `<StartDate>`/`<FinishDate>` — **falls back to `now()` when null** (§3.3.2) |

**Proven absence of readers** (searched): `src/core/evm/**`, `src/core/control-tower/**`,
`src/core/report-builder/**` and `app/api/export/**` contain **no** reference to Workpack planned
dates. `FieldExecutionService` and `ScheduleForecastService` use Activity dates only, and
`ScheduleBaselineService.ts:121-122` uses **Event** dates. So M13, M14's builder and EVM are
unaffected by whatever D8 decides — the blast radius is smaller than it looks.

### 3.3.1 The field already has a business name: "Execution Calendar"

This is the single most important thing the reader trace surfaced. M10 does not treat these
columns as a schedule span at all — it treats them as a **separate, deliberately-named planning
artefact**:

- `PlanningReadinessService.ts:477-484` — check key `calendar`, label **"Execution Calendar"**,
  evidence string *"Planned: {start} — {end}"* or *"No planned start/end dates set"*.
- `ReadinessScoreService.ts:17, 65` — criterion `execution_calendar`, **8% of the readiness
  score**, requiring both dates.

**And M10 runs this check *independently* of a separate "Schedule Calculated" check** which reads
Activity `early_start` (`PlanningReadinessService.ts:212-218`). The consequence is concrete: **a
fully CPM-scheduled workpack can fail the "Execution Calendar" check, and a workpack with typed
dates and no activities can pass it.** Two readiness signals about the same underlying question,
derived from two unrelated sources.

That naming is evidence *for* the commitment/authored reading (OD1), not against it — which is
precisely why OD1 must go to product rather than be resolved here.

### 3.3.2 A silent fabrication in the MS Project export

`export/ms-project/route.ts:60-61, 151` uses the workpack planned dates as the exported project
`<StartDate>` / `<FinishDate>`, **falling back to `now()` when they are null**. Since they are
null in 199 of 199 rows, **every MS Project export currently stamps the project window as "the
moment the export ran"** while the task rows carry real Activity dates (`:80-81`). This is a
fabricated time fact leaving the system in a customer-facing artefact. It is out of scope to fix
here, but it belongs in the R1.0-C defect register and it is a further argument for making the
span derived rather than nullable-authored.

The overdue computation is correctly guarded (`.filter(w => w.planned_end_date && …)` at
`:198`), so the non-null assertions at `:204-215` are safe — **there is no null-date bug here.**
But there is a product consequence: because the column is **0 of 199 populated, the portfolio
"overdue workpacks" KPI can never fire.** It is structurally empty.

### 3.4 The defect: five semantics on one field

Per §3 of the governing instruction — *"If different consumers use the field differently,
document that as a defect rather than creating a compromise meaning"* — this is recorded as a
defect and **no compromise meaning is proposed**:

| # | Semantic | Held by |
|---|---|---|
| S1 | Human work-order planning intent | all fourteen entry points |
| S2 | Contractual deadline / commitment | portfolio overdue KPI |
| S3 | Gantt span bounds | activities panel, Gantt viewport |
| S4 | **"Execution Calendar"** — a named, scored planning artefact | M10 readiness (8% of score) |
| S5 | **Derived activity span** | the date-range aggregate + "Sync" button |

Five semantics, and S1/S2/S4 versus S5 is a direct contradiction: **the same two columns are both
an authored artefact that M10 scores you on for filling in, and the destination of a one-click
copy from the activity schedule.** The "Sync" button and the "Execution Calendar" readiness
criterion are pulling in opposite directions inside the same product.

S1, S2 and S4 are genuinely different facts. "When we intend to do this work", "when this work is
contractually due" and "has the planner filled in the execution calendar" diverge the moment a
schedule slips — that divergence is the entire point of an overdue metric. S3 and S5 are
*derived* and are the semantics that should never have been sourced from an authored field.
**Classification: (G) MIXED SEMANTICS — defect.**

### 3.5 D8.1 — the required trace

Workpack WP-001 with A (10-Apr-2027 08:00 → 14:00) and B (10-Apr 14:00 → 11-Apr 10:00).

| Case | Span under MIN/MAX | Observation |
|---|---|---|
| Both activities | 10-Apr 08:00 → 11-Apr 10:00 | Well defined |
| Empty workpack | **NULL → NULL** | Must stay NULL. **182 of 199 workpacks have zero activities** — 91% would be NULL |
| One activity | that activity's own dates | Span degenerates to the activity; adds no information |
| Sequential A→B | 10-Apr 08:00 → 11-Apr 10:00 | Correct |
| Parallel A∥B | MIN(start), MAX(end) | Correct; span ≠ sum of durations |
| Activity added | span may widen | **Requires recalculation on every activity mutation** — and §6.2 of the C0 precheck shows most activity mutations trigger nothing today |
| Activity removed | span may narrow | Same |
| Activity date changed | span may move | Same |
| Activity cancelled | **undefined today** | `ActivityStatus` has `cancelled`, but **0 rows use it** (live values: `not_started` 58, `in_progress` 7, `completed` 7). Forward-looking policy, no migration risk |
| External shutdown window | **not comparable today** | The window is `Event.planned_start`/`planned_end`, a different entity (§10.3) |

**Rollup feasibility, executed:** of 17 workpacks that have any activities, a MIN/MAX rollup
would yield a start for 13 and an end for only **8** (activity `planned_end` is sparser than
`planned_start`). And **all 20 relationships are intra-workpack and intra-event — zero
cross-workpack and zero cross-event links** — so workpack spans do not currently interleave.
That is convenient today and completely untested for the cross-workpack case.

**Milestones and LOE are moot.** Proven absence: no column anywhere matching `%milestone%`,
`%is_loe%` or `%level_of_effort%` on any scheduling model except `event_milestones.milestone_type`
(a separate entity, **0 rows**). `Activity.is_optional` exists and is **false on all 72 rows**.
So D8.2's questions about milestone / LOE / optional participation have no live data and are
forward-looking policy only.

**One naming trap.** `Activity.window` exists as `text` and is **NULL on all 72 rows**. It is
dead, and its name collides with the "window" concept D8/D10 needs. It must not be quietly
repurposed.

---

## 4. D8 Decision

### 4.1 DECISION — the span is derived; the "Execution Calendar" is a separate open question

**Resolved (no product input needed):**

- `Workpack.planned_start_date` / `planned_end_date` are **NOT** authoritative planning inputs
  going forward. Under D4, activity planned dates are CPM output, so a workpack cannot hold an
  independently authored span — it would be a second, unreconciled schedule authority at a
  higher aggregation level.
- The **workpack schedule span** is classification **(B) DERIVED SCHEDULE ROLLUP**:
  `MIN(planned_start)` / `MAX(planned_end)` over the workpack's live activities, **NULL for an
  empty workpack**, recomputed whenever M11 recomputes, and **displayed as "Schedule Start" /
  "Schedule Finish"** — never as an independently editable "Planned Start".
- **This promotes existing behaviour rather than inventing it.** The aggregate already exists
  (`date-range/route.ts:22-30`) and is already surfaced with a "Sync" button (§3.2.1). The change
  is to make it automatic and authoritative, and to delete the manual copy — a one-shot copy that
  goes stale silently is worse than either a live derivation or an honest authored field.
- Inclusion rule: activities with `deleted_at IS NULL` **and `status <> 'cancelled'`**.
  `is_optional` activities **are** included (they are real scope until descoped). Note this is a
  **deliberate divergence** from the shipped aggregate, which filters on `deleted_at` only.
  **Zero data impact** — no cancelled and no optional rows exist.
- S3 (Gantt bounds) and S5 (the Sync copy) are satisfied by the derived span. S4 must be resolved
  by OD1, because "Execution Calendar" is not the same question as "what is the schedule span".

**Not resolved — this is the AMBER:**

> **Is the "Execution Calendar" a real, separate business artefact, or is it the schedule span
> under a different name?**

This is sharper than it first appeared. M10 does not merely *read* these columns — it **scores
the workpack 8% for having them filled in** (`ReadinessScoreService.ts:17, 65`) under the label
**"Execution Calendar"**, and it does so *independently* of its own "Schedule Calculated" check
which reads Activity `early_start` (§3.3.1). Somebody deliberately modelled a per-workpack
execution window as a distinct planning deliverable. Either:

- **(a)** that concept is real → it needs its **own** field with its own name (an authored
  `execution_window_start` / `_end`, or a `required_by_date` for the commitment reading),
  audited, and explicitly compared against the derived span to produce "overdue" and the M10
  check; or
- **(b)** it was a workaround for the absence of a derived span → the readiness criterion
  re-points at the derived span, the overdue KPI re-bases on it or on the Event window, and both
  columns are dropped rather than converted.

**I will not invent this.** A derived span silently inheriting the overdue KPI *and* the 8%
readiness criterion would recreate exactly the conflation this decision exists to remove: "the
plan says we finish late", "we are contractually late" and "the planner has done their
paperwork" would once again be the same number. Note also that under (b) a real readiness signal
disappears, which is a product regression somebody must consciously accept.

### 4.2 EVIDENCE

Writers §3.2 (fourteen entry points, two persisting, all human pass-through; clone and seeds
deliberately omit). The rollup correction §3.2.1. Readers §3.3 (34 files, **five** semantics),
the "Execution Calendar" naming and duplicated readiness check §3.3.1, the MS Project `now()`
fabrication §3.3.2. Population 0/199, **no actual-date counterpart** (proven absence), 182/199
workpacks empty, 13/17 would get a start and 8/17 an end. Proven absence of readers in EVM,
Control Tower, report-builder and generic export.

### 4.3 CONSEQUENCE

- **Migration risk: none.** 0 of 199 populated. Convert, retire, or replace with equal safety.
  **D8 therefore does not block C2 schema work** even while AMBER.
- **If (a):** one or two new authored columns plus explicit comparison rules; the overdue KPI and
  the M10 "Execution Calendar" criterion both keep working and become meaningful for the first
  time, because they would finally compare an authored commitment against a derived span rather
  than against nothing.
- **If (b):** the portfolio dashboard loses a KPI that has never once produced a row, and M10
  loses an 8% readiness criterion. The second of those is a real capability reduction and needs
  conscious sign-off, not a silent deletion.
- **Either way, two things must be deleted:** the manual "Sync" button (§3.2.1) becomes
  incoherent once the span is live-derived, and the MS Project `now()` fallback (§3.3.2) must
  stop fabricating a project window.
- Either way the derived span requires the C0 §6.2 trigger gaps to be closed first, or the span
  will silently go stale — a rollup is only as fresh as the recalculation that feeds it, and the
  current "Sync" snapshot is a live demonstration of that failure mode.

### 4.4 STATUS

🟡 **AMBER** — one product question (§4.1). The span half is GREEN and freezable now.

---

## 5. D9 — Lag Forensics

### 5.1 Column truth (executed)

```
ActivityRelationship
  id                 uuid          NOT NULL
  organization_id    uuid          NOT NULL
  predecessor_id     uuid          NOT NULL
  successor_id       uuid          NOT NULL
  relationship_type  RelationshipType  NULL  DEFAULT 'FS'
  lag_days           integer           NULL  DEFAULT 0     ← numeric_scale = 0
  created_by         uuid              NULL
  created_at         timestamp     NOT NULL  DEFAULT CURRENT_TIMESTAMP
  updated_at         timestamp     NOT NULL
```

**There is no provenance column.** No `lag_unit`, no `schedule_source`, no `import_batch_id`.
This is the structural reason author intent cannot be recovered from the row — and the reason a
future unit must be unambiguous *in the column itself*, not inferred from who wrote it.

`RelationshipType` is a real database enum with all four values (`FS`, `SS`, `FF`, `SF` —
`schema.prisma:3175-3180`).

### 5.2 Distribution (executed)

```
total relationships      : 20
lag_days IS NULL         :  0
lag_days = 0             : 14
lag_days > 0             :  6      ← values 13 (×3) and 5 (×3)
lag_days < 0             :  0
distinct relationship_type: 1      ← FS only
workpack_template_logic_links (lag_hours double precision): 0 rows
```

### 5.3 D9.2 — what `lag_days = 1` means to the engine, PROVEN

The engine reads lag once, with no scaling:

```171:176:src/lib/scheduleEngine.ts
    const type: RelationshipType = rel.relationship_type || 'FS';
    const lag = Number(rel.lag_days) || 0;

    outEdges.get(rel.predecessor_id)!.push({ succId: rel.successor_id, type, lag });
    inEdges.get(rel.successor_id)!.push({ predId: rel.predecessor_id, type, lag });
```

Offsets are converted to wall-clock with a flat 24-hour day:

```96:100:src/lib/scheduleEngine.ts
function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setTime(result.getTime() + days * 24 * 60 * 60 * 1000);
  return result;
}
```

**Executed** — activities A and B, 8 h each, `project_start_date = 2027-04-10`, hpd = 8:

| `lag_days` | A early_finish | B early_start | Δ | total_duration_days |
|---:|---|---|---|---:|
| 0 | 2027-04-11 | 2027-04-11 | +0 d | 2 |
| 0.5 | 2027-04-11 | 2027-04-11 | **+0 d (invisible)** | 2.5 |
| 1 | 2027-04-11 | 2027-04-12 | **+1 d** | 3 |
| 2 | 2027-04-11 | 2027-04-13 | +2 d | 4 |
| 5 | 2027-04-11 | 2027-04-16 | +5 d | 7 |
| 13 | 2027-04-11 | 2027-04-24 | +13 d | 15 |
| −1 | 2027-04-11 | 2027-04-10 | −1 d (clamped) | 1 |

**`hours_per_day` invariance — the decisive test.** With `lag_days = 1` held constant:

| `working_hours_per_day` | A early_finish | B early_start | Δ |
|---:|---|---|---|
| 8 | 2027-04-11 | 2027-04-12 | **+1 calendar day** |
| 10 | 2027-04-10 | 2027-04-11 | **+1 calendar day** |
| 24 | 2027-04-10 | 2027-04-11 | **+1 calendar day** |

Duration compresses as `hours_per_day` rises; **the lag offset does not change.** Therefore:

> **`lag_days = 1` means exactly +1440 wall-clock minutes to the current engine, independent of
> any calendar setting. `lag_minutes = lag_days × 1440` is exact, and
> `lag_days × hours_per_day × 60` would be wrong.**

**All four relationship types are implemented and behave correctly** (engine `:271-279` forward,
`:327-335` backward), confirmed with `lag_days = 1`:

| Type | B early_start | B early_finish | Matches formula |
|---|---|---|---|
| FS | 2027-04-12 | 2027-04-13 | `predEF + lag` ✅ |
| SS | 2027-04-11 | 2027-04-12 | `predES + lag` ✅ |
| FF | 2027-04-11 | 2027-04-12 | `predEF + lag − dur` ✅ |
| SF | 2027-04-10 | 2027-04-11 | `predES + lag − dur` ✅ |

Zero warnings in all four. **But `distinct relationship_type = 1` — only `FS` exists in the
data, so FF/SS/SF have never run against real rows.** Any future test of them is a
first-execution test, not a regression test.

### 5.4 Two engine defects found while proving this

**Sub-day lag is computed but discarded at the output boundary.** Lag 0, 0.25, 0.5 and 0.75 all
produce `B early_start = 2027-04-11`; only 1.0 moves it. Cause:

```398:401:src/lib/scheduleEngine.ts
      early_start: esDate.toISOString().slice(0, 10),
      early_finish: efDate.toISOString().slice(0, 10),
      late_start: lsDate.toISOString().slice(0, 10),
      late_finish: lfDate.toISOString().slice(0, 10),
```

It is **not** fully invisible: `total_duration_days` moved 2 → 2.5. So fractional lag leaks into
totals while being erased from dates — an inconsistency that C1 must resolve when the
`.slice(0, 10)` truncation is removed.

**Negative lag is silently clamped.** `maxEarlyStart` is initialised to `0` and the result is
clamped:

```264:287:src/lib/scheduleEngine.ts
      let maxEarlyStart = 0;
      // ...
      esDaysMap.set(id, Math.max(0, maxEarlyStart));
```

Executed with A finishing at offset 1.0: `lag = −1`, `−2` and `−5` **all** yield
`B early_start = 2027-04-10` (offset 0). Negative lag works only while the result stays ≥ 0;
beyond that it is truncated with no warning. The existing test suite already encodes this
behaviour (`scheduleEngine.test.ts:184`, *"clamped to 0"*), so it is known and intentional at
the project boundary — but a future canonical lag must state whether that clamp is the contract.

**A third defect: free float ignores relationship type.** Free float is computed with FS-style
arithmetic for every edge regardless of type:

```363:371:src/lib/scheduleEngine.ts
    let minSuccStartOffset = Infinity;
    outEdges.get(id)?.forEach(({ succId, lag }) => {
      const succES = esDaysMap.get(succId) || 0;
      if (succES - lag < minSuccStartOffset) {
        minSuccStartOffset = succES - lag;
      }
    });
```

The `type` is destructured out of the edge everywhere else in the engine but not here, so SS, FF
and SF edges get FS free-float semantics. **No live data is affected** — all 20 relationships are
FS — but it must be fixed alongside the lag-unit change, since both touch the same arithmetic.

**A fourth defect, latent.** `parsePredecessorString` (`:441-473`) matches a `d`/`h` suffix and
**discards the unit**, so `+2h` is stored as `2` and read as 2 days. Its own test acknowledges a
worse problem: `'ACT-01'` has its `-01` parsed as **negative lag**
(`scheduleEngine.test.ts:461-464`). **It has no production callers** — verified repository-wide;
the only references are the export and its tests. Latent, not live. It must not be wired to any
paste/import feature before being fixed.

---

## 6. Six-Row Lag Register

### 6.1 The rows, fingerprinted

Every non-zero row, with lineage (executed):

| # | Relationship ID | lag | Type | Predecessor | Successor | Created | `created_by` | Org |
|---|---|---:|---|---|---|---|---|---|
| L1 | `b9206a8f-e189-4606-bc80-599611e59e49` | 13 | FS | `Critical Act` (10 h) | `Sink` (10 h) | 2026-08-29 16:04:07.698 | **NULL** | `33318697…` |
| L2 | `7f8a8859-4b3d-4af8-a69c-f83676dee6a4` | 13 | FS | `Critical Act` (10 h) | `Sink` (10 h) | 2026-08-29 16:04:39.941 | **NULL** | `9e6db3f6…` |
| L3 | `18e69222-4d8f-43f3-bf9f-90da220d5cdf` | 13 | FS | `Critical Act` (10 h) | `Sink` (10 h) | 2026-08-29 16:05:48.607 | **NULL** | `fde58f6d…` |
| L4 | `d54af38d-85c8-4773-bc11-59d16fa97b3f` | 5 | FS | `Non-Crit Low Float` (10 h) | `Sink` (10 h) | 2026-08-29 16:04:07.698 | **NULL** | `33318697…` |
| L5 | `e42efb55-0c1b-41e3-8ed5-bee3f3570fcb` | 5 | FS | `Non-Crit Low Float` (10 h) | `Sink` (10 h) | 2026-08-29 16:04:39.941 | **NULL** | `9e6db3f6…` |
| L6 | `653706ab-1f95-4c4d-b877-ebf5670d1535` | 5 | FS | `Non-Crit Low Float` (10 h) | `Sink` (10 h) | 2026-08-29 16:05:48.607 | **NULL** | `fde58f6d…` |

All six: `same_event = true`, `same_workpack = true`, predecessor and successor both
`deleted_at IS NULL`, and **`pred_has_cpm = false`, `succ_has_cpm = false`** — none has ever
participated in a persisted CPM run.

### 6.2 What they are

Three **identical triplets** in three **different organisations**, created at 16:04:07,
16:04:39 and 16:05:48 on 2026-08-29 — 101 seconds apart. Each triplet is
`Critical Act → Sink` (lag 13), `Non-Crit Low Float → Sink` (lag 5),
`Non-Crit High Float → Sink` (lag 0). Those descriptions, that fan-in-to-`Sink` topology, and
those specific lags are a **constructed CPM float-test scenario**: the lags exist to produce
known total-float values on the three feeder paths. A test provisioned a fresh organisation per
run, three runs in under two minutes.

### 6.3 The decisive lineage fact

**All 20 relationships in the database have `created_by = NULL`.**

- The predecessor API sets `created_by: userId` (`predecessors/route.ts:55`, `:121`) — the **÷8
  path**.
- `TemplateLibraryService` sets `created_by: opts.userId` (`:656`) — the **÷24 path**.

Therefore **no row in the database was written by either converting path.** The ÷8-versus-÷24
ambiguity is entirely a *code* defect with **zero affected stored values**. The six lags were
written directly as integers by a seed/test, and their intended meaning is by construction
"whatever the engine reads them as", because they were chosen to produce specific float
outputs.

### 6.4 D9.6 classification

Per the required scheme:

| Row | Class | Justification |
|---|---|---|
| L1, L2, L3 (lag 13) | **D — obsolete / inactive** (secondarily B) | Test fixture; never in a persisted CPM run; author intent *is* the engine reading |
| L4, L5, L6 (lag 5) | **D — obsolete / inactive** (secondarily B) | Same |

No row is class **A** (there is no independently attested business intent to call unambiguous),
**C** (no human decision is needed — no human authored them) or **E** (the values are valid
integers and internally consistent).

**Recommendation:** convert all six with `lag_minutes = lag_days × 1440` (→ 18 720 and 7 200).
This preserves engine behaviour exactly *and* preserves fixture intent exactly, because for
these rows the two are the same thing. **No human adjudication is required** — a reversal of the
C0 §12 item 7 position, which assumed the six rows might carry planner intent. They do not.

The architect should still ratify this, because "these are fixtures" is an inference from
naming, timing and NULL authorship — strong, but an inference.

---

## 7. Fractional Lag Runtime Result

### 7.1 The conversion produces non-integers for most inputs

`lagHoursToDays` (`predecessors/route.ts:8-10`), executed:

| Input hours | Returns | Integer? |
|---:|---:|---|
| 1 | 0.13 | ❌ |
| 2 | 0.25 | ❌ |
| **4** | **0.5** | ❌ |
| 6 | 0.75 | ❌ |
| 8 | 1 | ✅ |
| 12 | 1.5 | ❌ |
| 16 | 2 | ✅ |
| 20 | 2.5 | ❌ |
| 24 | 3 | ✅ |

**Only multiples of 8 hours survive.** Every other lag entry produces a fractional value bound
for an `integer` column.

### 7.2 What happens on persistence — behavioural evidence

**Step 1 — does Prisma reject it client-side?** `activityRelationship.create({ lag_days: 0.5 })`
against an **unreachable** connection (`127.0.0.1:1`), so a validation rejection would surface
with zero network contact:

```
lag_days=0.5 : PrismaClientKnownRequestError: Can't reach database server at 127.0.0.1:1
lag_days=3   : PrismaClientKnownRequestError: Can't reach database server at 127.0.0.1:1
```

Identical outcome for the fractional and the integer value. **Prisma 7.9.1 does NOT validate
integer-ness for an `Int?` field.** `0.5` passes validation and reaches the transport.

**Step 2 — what does PostgreSQL do?** Through the same adapter and pool as production:

```
SELECT 0.5::int   →  ERROR 22P02  invalid input syntax for type integer: "0.5"
SELECT 1.5::int   →  ERROR 22P02  invalid input syntax for type integer: "1.5"
SELECT -0.5::int  →  ERROR 22P02  invalid input syntax for type integer: "-0.5"
SELECT 2::int     →  2
```

The parameter is serialised as **text**, and PostgreSQL refuses a fractional text literal for
`integer`. For contrast, had the value been sent as `numeric`, PostgreSQL would have **rounded**
(`0.5→1`, `1.5→2`, `2.5→3`, `-0.5→-1`, half-away-from-zero). It is not sent as numeric.

### 7.3 Verdict

> **Sub-day lag entry FAILS LOUDLY. It does not truncate, round, coerce, or silently change the
> value.** Any lag that is not a whole multiple of 8 hours causes `22P02` and an HTTP 500 from
> `POST`/`PUT`/`PATCH` on the predecessor endpoints. **No corrupt value can reach the database.**

- **rejects** — ✅ yes, at the database
- **rounds / truncates / coerces / silently changes** — ❌ no

**Confidence and its exact limit.** Three independent proofs converge: (i) the column is
`integer` with `numeric_scale = 0`, so `0.5` is unstorable by definition; (ii) the identical
parameter-binding path rejects with `22P02`; (iii) `lagHoursToDays` demonstrably emits
non-integers. The one step **not** executed is a literal `INSERT`, which §2 of the governing
instruction forbids. Classified **VERIFIED BY EQUIVALENT PATH** rather than fully executed — and
note that *both* possible PostgreSQL behaviours (reject as text, round as numeric) are documented
above, so no branch of the outcome is unaccounted for.

**This closes R1.0-C §25.4 (P0-4)**, and corrects its attribution: the rejection is
PostgreSQL's, not Prisma's.

**Severity is lower than the inventory implied.** The defect is a usability and correctness
failure, not a data-integrity one: sub-day lag is unusable, but nothing false was ever stored.
That is consistent with `lag_days > 0` being only 6 rows, all whole numbers.

---

## 8. D9 Decision

### 8.1 DECISION — canonical `lag_minutes`, signed integer

**Storage:** `ActivityRelationship.lag_minutes INTEGER NOT NULL DEFAULT 0`, signed. Replaces
`lag_days`. Minutes are exact for every case the domain needs (shift boundaries, cure times,
permit waits), avoid all floating-point representation error, and remove every ÷8 / ÷10 / ÷24
factor from the codebase.

**Canonical unit at every layer — one unit internally, explicit conversion only at the edges:**

| Layer | Unit | Rule |
|---|---|---|
| **Storage** | minutes (signed integer) | The single source of truth |
| **Engine** | minutes | `calculateSchedule` takes `lag_minutes`; no day conversion |
| **API (request/response)** | minutes | Field named `lag_minutes`. **No `lag_days`, no `lag_hours`** |
| **UI** | minutes internally; hours/days for display only | Convert at render, never at persist. Editing writes minutes |
| **Import** | minutes | Each parser converts its own source unit to minutes **explicitly and named**, e.g. `xerLagDaysToMinutes(v, sourceHoursPerDay)` |
| **Export** | target format's unit | Each formatter converts from minutes explicitly, and records the factor it used |

**Required capability, all satisfied:** sub-day lag ✅ (1-minute granularity) · negative lag ✅
(signed; the project-start clamp must be an explicit, warned decision, not a silent
`Math.max(0, …)`) · FS / FF / SS / SF ✅ (all four already implemented and behaviourally
confirmed, §5.3) · exact time ✅ · no hidden factors ✅ (only two conversion sites remain,
both at named boundaries).

**Prohibited:** any implicit conversion; any second lag field; retaining `lag_days` alongside
`lag_minutes`; reusing `workpack_template_logic_links.lag_hours` as a second authority — it is
`double precision`, **0 rows**, and must be converted to minutes in the same migration.

### 8.2 MIGRATION RULE

```
lag_minutes = lag_days × 1440
```

**Proven exact** by the `hours_per_day` invariance test (§5.3): the engine applies lag as
wall-clock days regardless of calendar settings, so ×1440 reproduces current behaviour bit for
bit. `lag_days × hours_per_day × 60` is **explicitly rejected** — it would change every
computed date.

The four concepts, kept separate as D9.3 requires:

| Concept | For the six rows |
|---|---|
| **1. Stored value** | `13` (×3), `5` (×3) |
| **2. Original author intent** | Test-fixture float construction. Coincides with (3) by design |
| **3. Current CPM interpretation** | 13 and 5 **wall-clock days** = 18 720 and 7 200 minutes |
| **4. Display / export interpretation** | Divergent today: `+13d` raw · ×8 → 104 h (`ActivitiesPanel`, XER) · ×10 → 130 h (Primavera XML) · ×24 → 312 h (generic export) |

**Concept 4 is where the user-visible damage is**, and it is not fixed by the migration — it is
fixed by making every reader consume minutes (§8.1). The migration preserves (3); it does not
and cannot retroactively reconcile (4) for other people's exports already taken.

### 8.3 SIX ROWS

All six classified **D (obsolete / inactive)** — CPM float-test fixtures, `created_by = NULL`,
never in a persisted CPM run (§6). Convert with ×1440. No human adjudication required.

### 8.4 EVIDENCE

§5.1 column truth · §5.2 distribution · §5.3 engine semantics and `hours_per_day` invariance ·
§5.4 truncation and clamping defects · §6 lineage and `created_by = NULL` across all 20 rows ·
§7 fractional-lag behavioural result · existing suite 48/48 green.

### 8.5 STATUS

🟢 **GREEN** — against the five D9.7 criteria:

| Criterion | State |
|---|---|
| Future canonical semantics unambiguous | ✅ `lag_minutes`, signed integer, one unit, two named boundaries |
| Six historical rows classified | ✅ All six class D, with lineage |
| Fractional lag behaviour verified | ✅ Rejects at PostgreSQL, `22P02` (§7.3, limit stated) |
| Migration preservation rule explicit | ✅ `× 1440`, proven exact, alternative explicitly rejected |
| API / UI / import / export rules explicit | ✅ §8.1 table |

---

## 9. D10 — Constraint Forensics

### 9.1 What the CPM engine actually consumes

`calculateSchedule(activities, relationships, options)` — the complete input surface:

| Input | Source | Reaches CPM? |
|---|---|---|
| `duration_hours` per activity | `Activity.duration_hours` | ✅ |
| `planned_start` per activity | `Activity.planned_start` | ✅ **as a start-offset seed** (see §9.3) |
| `planned_end` per activity | `Activity.planned_end` | ⚠️ Passed in, **never used for scheduling** — echoed to output only (`:420`) |
| `relationship_type`, `lag_days` | `ActivityRelationship` | ✅ |
| `project_start_date` | `Event.planned_start`, or `override_start_date` | ✅ |
| `working_hours_per_day` | `calendar.getHoursPerDay()` | ✅ — **the only calendar value that reaches CPM** |
| `critical_float_threshold` | caller, default 0 | ✅ |
| `target_finish_date` | **nothing** | ❌ **No caller supplies it** |

**Proven absence — no constraint, window, readiness gate, permit, material or resource limit
reaches the CPM forward or backward pass.** Searched: `target_finish_date` and
`override_start_date` repository-wide (only 4 hits, §10.3); the full text of `scheduleEngine.ts`
and `ScheduleOrchestrationService.ts`; every "constraint"-named model's consumers. The engine's
entire constraint vocabulary is *relationships plus one project start date*.

### 9.2 `work_days` and `exceptions` are loaded and thrown away

`ScheduleOrchestrationService` resolves a `CalendarEngine` through a three-tier fallback
(`:90-91`, `:354-387`) — then passes only `calendar.getHoursPerDay()` (`:167`).
`ScheduleCalendar` has **0 rows**, so the hard-coded fallback (Mon–Sat, 10 h) is what actually
governs every calculation.

**Meanwhile the plant's real working time already exists in data.** `ShiftDefinition` holds
**6 rows across 3 events**:

```
Day    06:00 → 18:00   is_active = true
Night  18:00 → 06:00   is_active = true
```

(`start_time` / `end_time` are `text`.) So the data declares 2 × 12 h = 24-hour coverage while
CPM assumes a 10-hour day from a hard-coded fallback. **The working-time truth and the
working-time input to CPM are two different things today**, and `ShiftDefinition` is one of the
tables `migrate diff` proposes to DROP (C0 §9.3) — a second, independent reason not to run it.

### 9.3 The finding that decides D10: `planned_start` is already an implicit constraint

```251:262:src/lib/scheduleEngine.ts
    if (preds.length === 0) {
      // Activity with no predecessors: starts at day offset 0 (or its planned_start diff)
      const act = activityMap.get(id)!;
      let startOffset = 0;
      if (act.planned_start) {
        const pDate = new Date(act.planned_start);
        if (!isNaN(pDate.getTime())) {
          startOffset = Math.max(0, diffDays(pDate, projectStartDate));
        }
      }
```

For any activity with no predecessor, `planned_start` **is** the start date — which is precisely
*start-no-earlier-than* semantics, implemented implicitly on a result column.

**Executed scale of this:**

```
live activities (deleted_at IS NULL)      : 72
  with a predecessor  (truly calculated)  : 14   (19.4%)
  with NO predecessor (seeded by itself)  : 58   (80.6%)
     of which have a planned_start to seed:  45
     of which fall back to offset 0       :  13
```

Two conclusions:

1. **Today, CPM is mostly an echo.** For 45 of 72 activities the "calculated" `early_start` is
   their own `planned_start` re-emitted, plus duration. Only 14 activities have their start
   genuinely computed from a predecessor. This is why the C0 precheck found `early_start`
   values that look like planned dates.
2. **D4 cannot be implemented on this engine without separating input from result.** D4 makes
   M11 the writer of `planned_start`. The engine reads `planned_start` for 80.6% of activities.
   One column would then be simultaneously CPM's input and CPM's output — the schedule would
   feed on itself, the first computed value would freeze permanently, and a planner's requested
   date would be indistinguishable from a calculated one forever.

> **Therefore D10 is a hard prerequisite for D4, and both are prerequisites for C1.** This is
> not a preference; it is a structural consequence of `scheduleEngine.ts:251-262`.

---

## 10. Current Constraint Mechanisms

### 10.1 Classified inventory

Nothing is called a constraint merely because it is named one.

| Mechanism | Location | Rows | Classification | Reaches CPM? |
|---|---|---:|---|---|
| `ActivityRelationship` (type + lag) | `schema:262-270` | 20 | **DEPENDENCY** | ✅ Yes — the only real one |
| `Event.planned_start` | `schema:2014` | 49/51 | **WINDOW (start)** — the CPM datum | ✅ Yes, via `ScheduleOrchestrationService:145` |
| `Event.planned_end` | `schema:2015` | 49/51 | **WINDOW (finish)** | ❌ **No** — selected then discarded (§10.3) |
| `Activity.planned_start` | `schema:25` | 45 seeds | **HARD CONSTRAINT, implicit and undeclared** | ✅ Yes (§9.3) — *this is the defect* |
| `Activity.planned_end` | `schema:26` | 26 | **PRESENTATION ONLY** in CPM terms | Passed in, unused |
| `ScenarioActivityOverride.early_start_constraint` | `schema:5851` | **0 of 11** | **HARD CONSTRAINT — DEAD SCHEMA.** Not merely unpopulated: repository-wide there is **exactly one** occurrence of this identifier, the schema declaration itself. **Zero reads, zero writes, no API, no UI** | ❌ No |
| `MaterialScheduleIntegrationService.integrateForEvent` | `:143` | — | **SOFT CONSTRAINT — IMPLEMENTED BUT UNWIRED.** Designed to pre-adjust `planned_start` from material ETA *before* CPM. **Zero callers** — the identifier appears only at its own definition | ❌ No (§11.3) |
| `ShutdownScope.freeze_date` | `schema:3805` | — | **WINDOW (governance metadata)** — stored and editable (`ShutdownScopeService.ts:41`, `:173`); **no code enforces it** against schedule edits | ❌ No |
| `Activity.is_approved_for_scheduling` | `schema:38` | — | **READINESS GATE (soft)** — set on approval (`ActivityService.ts:195`); **no CPM read path** | ❌ No |
| `ScenarioActivityOverride.planned_start/end/duration` | `schema:5847-5849` | 2 / 1 / 11 | **MANUAL OVERRIDE (scenario)** | ❌ No |
| `Constraint` register | `schema:677-705` | **1** | **READINESS GATE / issue register — NOT a schedule constraint** | ❌ No |
| `ConstraintLog` | `schema:1904` | 0 | **LEGACY** | ❌ No |
| `project_constraints` | `schema:2402` | 0 | **LEGACY** (pre-R0.4 Project surface) | ❌ No |
| `constraint_attachments` | `schema:1893` | 0 | **PRESENTATION ONLY** (file attachments) | ❌ No |
| `MaterialConstraint.constraint_date` | `schema:6011` | 0 | **EXTERNAL CONSTRAINT (material ETA)** — computed readiness record | ❌ No |
| `ResourceCapacity` (`target_date`, `capacity_limit`, `shift_id`) | table | **30** | **RESOURCE CONSTRAINT** | ❌ No — leveling post-processes CPM |
| `ShiftDefinition` (`start_time`, `end_time`) | table | **6** | **WINDOW (working time)** | ❌ No (§9.2) |
| `ScheduleCalendar.work_days` / `exceptions` | `schema:1429-1439` | **0** | **WINDOW (working time)** | ❌ Loaded, discarded |
| `Workpack.is_locked` / `locked_at` / `locked_by` | `schema:114-116` | 0 locked | **MANUAL OVERRIDE (edit lock)** — not a date constraint | ❌ No |
| `event_milestones.planned_date` | `schema:2069` | **0** | **EXTERNAL CONSTRAINT (target date)** — tracking only | ❌ No |
| `Activity.window` (`text`) | `schema:24` | **0 of 72** | **LEGACY / DEAD** — name collision hazard | ❌ No |
| `override_start_date` | `ScheduleOrchestrationService:39`, `:145` | — | **MANUAL OVERRIDE of the CPM datum** — unaudited, no reason captured | ✅ Yes |
| Client-computed planned dates | `ScheduleContainer.tsx:832-847`, `ActivityPlanningGrid.tsx:181-190` | — | **MANUAL OVERRIDE, browser-authored** | Indirectly, via `planned_start` |

### 10.2 The `Constraint` register is definitively not a CPM constraint

Its executed shape settles it: `workpack_id`, `activity_id`, `constraint_number`, `title`,
`description`, `constraint_type`, `priority`, `owner_id`, `target_resolution_date`,
`actual_resolution_date`, `status`, `resolution_notes`, `raised_by`, `raised_at`, `closed_by`,
`closed_at`.

That is a **raise → own → resolve → close** issue lifecycle. And its enum values are *causes of
delay*, not date-constraint types:

```
ConstraintType   : material, permit, scaffold, access, vendor, document,
                   manpower, equipment, weather, inspection, other
ConstraintStatus : open, in_progress, resolved, deferred, cancelled
```

There is no `constraint_date`, no relation to a schedule date, and **no code path passes it into
`calculateSchedule`**. It is a turnaround blocker register — 1 row. **A schedule-constraint model
must not be built on it, and must not be named to collide with it.**

### 10.3 The shutdown window is inert

```144:146:src/core/schedule/ScheduleOrchestrationService.ts
    const projectStartDate =
      options.override_start_date ??
      (event.planned_start ? new Date(event.planned_start) : new Date());
```

`event.planned_end` is selected at `:75` and **never referenced again**. Repository-wide, the
only `target_finish_date` hits are the engine's own option type (`:36`) and its own
implementation (`:301-307`); the only `override_start_date` hits are the orchestration option
(`:39`, `:145`) and `app/api/schedule/calculate/route.ts:49`.

**Consequences, all three material:**

1. `baseLateFinishOffset = maxProjectFinishOffset` always, so **total float is
   self-referential**. The critical path always has exactly zero float and **negative float
   against the shutdown window is unreachable**. Executed corroboration across 72 live
   activities: `early_start` and `early_finish` are populated on 7, but `late_start`,
   `late_finish` and `free_float` are populated on **0**, and `total_float` on only 3. The
   backward pass has never persisted anything — and the 7/3/0 split cannot come from M11's
   single-transaction persist payload (`:174-190` writes all seven fields together), which
   independently confirms C0 §4.1: **these rows are not evidence of an M11 run.**
2. **The window is not enforced.** Executed: of 49 activities with both their own and their
   event's `planned_start`, **3 start before the event window opens and 3 end after it closes.**
   Nothing rejected or flagged them.
3. `override_start_date` lets any caller of `POST /api/schedule/calculate` move the CPM datum for
   an entire event, with **no reason, no audit and no approval** — the largest unaudited
   schedule override in the system.

---

## 11. Proposed Constraint Model

**Design only. Not implemented. No schema was modified.**

### 11.1 The principle

```
SCHEDULE INPUT  (authored, audited, few)        SCHEDULE RESULT (derived, never authored)
  duration                                        planned_start
  relationship + lag                     M11      planned_end
  constraint ────────────────────────►  CPM  ───► (early/late/float internal)
  calendar / shift                                  │
  event window                                      ▼
                                            read-only consumers
```

A constraint is an **input**. It never becomes a date the application reads as truth. M11
consumes it and emits the authoritative planned date. **A manually imposed date must never
become a second planned-date authority** — which is exactly what `Activity.planned_start` is
today (§9.3).

### 11.2 Shape

`ScenarioActivityOverride.early_start_constraint` (`schema.prisma:5851`) is the existing
precedent and is instructive on four counts: it is the **only** datetime field in that model
without `@db.Date` (someone already knew a constraint needs time precision), it is
**scenario-scoped** so it could never serve the live plan, it has **0 of 11 rows populated**, and
— verified repository-wide — **the identifier occurs exactly once in the entire codebase, in the
schema declaration itself.** No service reads it, no service writes it, no API exposes it, no UI
edits it, and `ScenarioPlanningService.ts:76-78, 114-117` pointedly does *not* include it among
the override fields it accepts.

**It is dead schema: a constraint someone declared and then never built.** That is a useful
signal about intent and a warning about follow-through, but it is not a foundation.

Two candidate shapes:

| | **(i) Columns on `Activity`** | **(ii) Separate `ActivityConstraint` table** |
|---|---|---|
| Shape | `constraint_type` enum + `constraint_date timestamptz` | one row per constraint, FK to activity |
| Cardinality | one per activity (P6's model) | many per activity |
| Audit | needs `constraint_reason`, `constraint_set_by`, `constraint_set_at` as further columns | native (`created_by`, `reason`, `active`) |
| CPM read cost | free (already selected) | one extra query |
| Migration | 2–5 columns on an existing table | new table |
| **Recommendation** | ✅ **Preferred** | Defer |

**Recommend (i).** P6 — the system this product is measured against — allows exactly one primary
constraint per activity, planners do not expect more, and (i) keeps the CPM input surface flat
and cheap to read in the existing `select`. If a genuine multi-constraint requirement appears,
(ii) is a clean later migration. Choosing (ii) now would be speculative generality.

Fields under (i):

```
constraint_type     ScheduleConstraintType?   -- enum, NULL = unconstrained
constraint_date     DateTime?  @db.Timestamptz(3)
constraint_reason   String?                   -- mandatory when type is set (app-level)
constraint_set_by   String?    @db.Uuid
constraint_set_at   DateTime?  @db.Timestamptz(3)
```

`organization_id` and `event_id` are inherited from `Activity`; duplicating them would create a
second tenancy truth.

### 11.3 Type set — bounded by evidence, not by imagination

Per D10.2, types are retained **only** where actual business requirement or current
implementation evidence supports them.

**RETAIN — 3 types:**

| Type | Evidence |
|---|---|
| `START_NO_EARLIER_THAN` | Two independent sources: `ScenarioActivityOverride.early_start_constraint` exists as a declared field, and CPM's use of `planned_start` as a start-offset seed for 45 activities **is** SNET semantics implemented implicitly (§9.3). This type is not new — it is the existing behaviour, made explicit |
| `FINISH_NO_LATER_THAN` | `Event.planned_end` is populated on 49/51 events and the engine already accepts `target_finish_date` (`:36`, `:301-307`) with no caller. The business has a committed window end; the capability exists; only the wiring is missing (§10.3) |
| `MUST_START_ON` | Required for fixed external events that a turnaround genuinely has — a scheduled plant shutdown moment, a contracted crane day, a regulatory inspection slot. Weaker evidence than the other two: no column exists today. **Flagged for architect ratification** |

**EXCLUDE — and why, explicitly:**

| Rejected type | Reason |
|---|---|
| `MUST_START_NO_LATER_THAN`, `MUST_FINISH_ON`, `MUST_FINISH_NO_EARLIER_THAN` | No implementation and no evidenced requirement. P6 has them; that is not evidence *this* business needs them |
| `START_WINDOW`, `FINISH_WINDOW` | A window is expressible as SNET + FNLT. Adding a distinct type would create two ways to say one thing |
| `SHUTDOWN_WINDOW` | **Already exists** as `Event.planned_start`/`planned_end`. Belongs to Event configuration, **not** to the activity constraint model — and per D8 not to Workpack either. Wiring `planned_end` into `target_finish_date` is the fix, not a new type |
| `PERMIT_AVAILABLE`, `ISOLATION_AVAILABLE` | **READINESS GATES**, not date constraints. Permits block execution when unissued or expired (`PermitService.ts:23-27`) and hold points block `COMPLETE` without QA clearance (`ExecutionWriteService.ts:227-234`). Both *gate* work administratively; neither computes or carries a schedule date |
| `MATERIAL_AVAILABLE` | **Excluded from the type set, but for a different reason than the others — see §11.3.1.** An implementation already exists and is unwired |
| `RESOURCE_AVAILABLE` | `ResourceCapacity` (30 rows) is a **RESOURCE CONSTRAINT** handled by leveling as a post-process. Making it a CPM input means resource-constrained scheduling — a different algorithm, not a constraint type |

**Three retained types, of which two are already latent in the code.** That is the smallest set
that makes D4 implementable and the shutdown window meaningful.

### 11.3.1 CORRECTION — material constraints are not unevidenced, they are unwired

An earlier pass of this analysis grouped `MATERIAL_AVAILABLE` with the "sounds useful, no
evidence" rejections. **That understated the evidence.** A complete implementation exists:

- `MaterialConstraint` (`schema:6002-6034`) carries `constraint_type` (default `material_eta`),
  `constraint_date`, `earliest_eta`, `is_binding`, `readiness_status` and `impact_days`.
- `MaterialReadinessService.ts:213-245`, `:371-433` **computes** `constraint_date` from supply-chain
  data and flags a constraint as binding when material would delay the planned start.
- `MaterialScheduleIntegrationService` is documented at `:4-15` as pre-adjusting `planned_start`
  before CPM, with the binding filter at `:45-51` and the integration at `:78-109`.

**And `integrateForEvent` (`:143`) has zero callers.** Verified repository-wide: the identifier
occurs once, at its own definition. `ScheduleOrchestrationService` does not import the module.

So the correct characterisation is not "no evidence" but **"designed, built, and never
connected"** — the same failure mode as `early_start_constraint`, one layer up. That changes the
reasoning without changing the decision:

- It **stays out of the constraint type set**, because material availability is not a planner-
  authored constraint. It is a *computed* consequence of supply-chain data, and modelling it as
  the same kind of object as "the crane arrives Tuesday" would conflate an input with a derivation
  — the precise error D10 exists to prevent.
- It becomes **OD8 with real weight**: the question is not "should we build this?" but "there is
  a built, unwired mechanism that would let a material ETA silently move the plan — do we connect
  it, and if so does it write a constraint, or does CPM read `MaterialConstraint` directly?"
- **Whichever way OD8 goes, it must not be settled by accident.** Wiring `integrateForEvent`
  would make material ETA a *second writer of `planned_start`*, which is exactly what D4 exists
  to eliminate. If material availability is to influence the schedule, it must do so through the
  constraint carrier and be visible as such.

**Two dead-but-built schedule-constraint mechanisms now sit in the codebase**
(`early_start_constraint`, `MaterialScheduleIntegrationService`). Any C2 implementation must
explicitly retire or adopt both, rather than adding a third alongside them.

### 11.4 Do Workpack and Event need their own constraint scope?

**No.**

- **Event** already has its window (`planned_start`, `planned_end`) and its `calendar_id`. It
  needs *wiring*, not a constraint model (§10.3).
- **Workpack** must not have one. Per D8, a workpack's dates are a **derived span**. Giving it an
  authored constraint would reintroduce a competing schedule authority at the aggregation level —
  the exact defect D8 exists to remove.

---

## 12. Override Policy

### 12.1 Is a manual override required?

**Yes** — but it must be a **constraint**, not an override of the result. Evidence that planners
need to impose dates: **seven** server-side planned-date writers on `Activity` plus two divergent
browser algorithms (C0 §6.1), and `override_start_date` on the event datum (§10.3). The need is
real and is currently met by writing directly to the result column.

**The distinction this decision turns on:**

| | Constraint (permitted) | Override (prohibited) |
|---|---|---|
| What it is | An input M11 consumes | A value written over M11's output |
| Result | M11 computes the date, honouring it | The date bypasses M11 |
| Traceable | Yes — type, date, reason, author | No |
| Survives recalculation | Yes | **No** — silently reverted or silently permanent |

> **`UI directly edits planned_start` is never the definition of an override.** Under D4 that
> column is CPM output. A planner's date edit must be captured as
> `constraint_type = START_NO_EARLIER_THAN` with `constraint_date`, and M11 then produces
> `planned_start`. The screen may look similar; the authority is completely different.

### 12.2 Policy — settled by architectural necessity

| Aspect | Rule |
|---|---|
| **Who may set** | Anyone with existing schedule-edit permission (`nav.schedule` / planner role). No new permission tier — the constraint replaces an edit they can already perform, so adding a gate would be a regression in capability |
| **Meaning** | A dated boundary M11 must respect. Not a result |
| **Reason** | **Mandatory** when a constraint is set. `constraint_reason` non-empty; enforced at the service boundary |
| **Audit** | Mandatory. `constraint_set_by` + `constraint_set_at`, plus an `AuditService.log` entry, matching how M12 audits execution writes |
| **Effect on CPM** | Consumed in the forward pass. **Hard** — it moves the date. If it conflicts with a dependency, the dependency-driven date wins and a warning is raised (the engine already has a `warnings[]` channel and a `NEGATIVE_FLOAT` precedent at `:379-384`) |
| **Derived date stays visible** | **Yes, always.** `planned_start` remains M11's output. The constraint is shown *beside* it, never instead of it |
| **Conflict display** | A new engine warning (e.g. `CONSTRAINT_NOT_SATISFIED`) surfaced on the activity, in the same channel as `NEGATIVE_FLOAT` and `SCHEDULE_CYCLE_DETECTED` |

### 12.3 Open — requires product input

| # | Question | Why an agent must not decide it |
|---|---|---|
| O1 | **Do constraints expire?** | A `constraint_expires_at`, or a rule that a satisfied constraint auto-clears, is a workflow policy about how planners work. Both are defensible; neither is derivable from the code |
| O2 | **Soft constraints?** | The §12.2 policy makes constraints hard. A soft constraint (a *preference* that yields to float optimisation) is a distinct product capability. No evidence of demand exists in the codebase, so it is excluded by default — but excluded is a decision |
| O3 | **Does `override_start_date` survive?** | It moves an entire event's datum with no audit (§10.3). Retire it, or bring it under the same reason+audit rule? |

### 12.4 Governance conflict that must be resolved before implementation

§0 of the governing instruction forbids changing `ActivityCreationCommand` and lists M11 and M12
production code as frozen. But:

- `ActivityCreationCommand:481-482` is **the funnel every activity-creation path uses to write
  `planned_start`/`planned_end`** (verified: `app/api/activities/route.ts:57` and
  `app/api/projects/[id]/schedule/activities/route.ts` both call
  `ActivityService.createActivity` → this command).
- D4 requires those writes to become constraint writes.
- D10 requires M11 to consume constraints — a change inside `ScheduleOrchestrationService` and
  `scheduleEngine.ts`.

> **D4 + D10 cannot be implemented without editing `ActivityCreationCommand` and M11.** That is
> correct and expected for this phase — but the freeze must be **explicitly lifted for C4/C5**,
> scoped to these files and this purpose. This design task did not touch them and takes no
> licence.

### 12.5 STATUS

🟡 **AMBER** — the model, its type set and the propagation contract are settled; O1–O3 and the
§12.4 freeze-lift need the architect.

---

## 13. D10 Decision

### 13.1 DECISION

1. **Introduce an explicit activity constraint as CPM input**, as columns on `Activity`
   (§11.2, shape (i)): `constraint_type`, `constraint_date timestamptz`, `constraint_reason`,
   `constraint_set_by`, `constraint_set_at`.
2. **Type set = 3**: `START_NO_EARLIER_THAN`, `FINISH_NO_LATER_THAN`, `MUST_START_ON` (the third
   flagged for ratification). All other candidate types explicitly rejected with reasons
   (§11.3).
3. **The shutdown window stays on `Event`** and is *wired*, not modelled: `Event.planned_start`
   → `project_start_date` (already done) and `Event.planned_end` → `target_finish_date`
   (currently missing, §10.3).
4. **`Activity.planned_start` stops being an input.** The engine's predecessor-less seeding
   (`scheduleEngine.ts:251-262`) must read `constraint_date`, not `planned_start`. **This is the
   change that makes D4 possible.**
5. **Workpack gets no constraint scope** (§11.4). Its dates are a derived span (D8).
6. **Every planned-date write becomes a constraint write**, and M11 becomes the sole writer of
   `planned_start`/`planned_end`.
7. **Readiness gates stay gates.** Material, permit and isolation constraints continue to report
   and block *administratively*; promoting any of them to a CPM date input is a separate product
   decision (§11.3).

### 13.2 EVIDENCE

§9.1 the complete CPM input surface, with proven absence of any constraint input · §9.3 the
80.6% / 45-of-72 implicit-constraint measurement · §10.1 the 20-mechanism classified inventory ·
§10.2 the `Constraint` register's executed shape and enums proving it is an issue register ·
§10.3 the inert shutdown window with `late_*` populated on 0 of 72 live activities · §11.2 the
`early_start_constraint` precedent at 0 of 11 rows.

### 13.3 FUTURE PROPAGATION

```
duration ─┐
relation ─┤
lag ──────┼──►  M11 / ScheduleOrchestrationService  ──►  planned_start / planned_end
constraint┤          (single CPM engine)                  (timestamptz, M11-owned)
calendar ─┤                                                     │
event win ┘                                                     ├──► Workpack derived span
                                                                ├──► M10 readiness
                                                                ├──► M13 Control Tower
                                                                ├──► M14 reports
                                                                ├──► M15 intelligence
                                                                └──► M16 channel
                                          all downstream: READ-ONLY. No re-entry.
```

### 13.4 STATUS

🟡 **AMBER** — see §12.5.

---

## 14. Cross-Decision Example

Event `TA-2027` · Workpack `WP-001` · Activity `A` 10-Apr-2027 08:00 → 14:00 (6 h) · `B` FS + 2 h
· constraint: `B` not before 11-Apr-2027 08:00.

**Calendar note:** 10-Apr-2027 is a **Saturday** and 11-Apr-2027 is a **Sunday**. Under the
hard-coded fallback (Mon–Sat, 10 h) Saturday is a working day and Sunday is not — so this example
exercises the calendar too.

### 14.1 What happens TODAY — it fails at five independent points

| # | Step | Result today |
|---|---|---|
| 1 | Store `A` 08:00 → 14:00 | ❌ `planned_start`/`planned_end` are `@db.Date`. Stored as `2027-04-10`. **08:00 and 14:00 are lost on entry** |
| 2 | Create `B` FS + 2 h | ❌ `lagHoursToDays(2) = 0.25` → `integer` column → **`22P02`, HTTP 500. The relationship cannot be created at all** (§7) |
| 3 | Express "B not before 11-Apr 08:00" | ❌ **Inexpressible.** No constraint column. The only way is typing into `B.planned_start` — a result column shared by 7 writers, which cannot hold 08:00 |
| 4 | CPM honours Sunday | ❌ `work_days` never reaches the engine; `ScheduleCalendar` has 0 rows. Sunday is treated as a working day |
| 5 | Show the calculated date | ❌ M11 writes `early_start`; the UI reads `planned_start`. **The result never reaches the screen** |
| 6 | Workpack span | ❌ `WP-001.planned_start_date` stays NULL unless a human typed it. No rollup exists |
| 7 | M10 / M13 / M14 | ⚠️ M10 reads NULL workpack dates; M13 compares midnight values at full ms precision; M14 emits `split('T')[0]` |

Even with lag forced to 0 to get past step 2, the chain still fails at 1, 3, 4, 5 and 6.

### 14.2 What happens AFTER D8 + D9 + D10

| # | Step | Result |
|---|---|---|
| 1 | `A` stored | `planned_start = 2027-04-10T08:00`, `planned_end = 2027-04-10T14:00` (timestamptz, UTC-normalised per D2/D3) |
| 2 | `B` relationship | `relationship_type = FS`, `lag_minutes = 120` |
| 3 | `B` constraint | `constraint_type = START_NO_EARLIER_THAN`, `constraint_date = 2027-04-11T08:00`, reason + author captured |
| 4 | M11 forward pass | Dependency gives 10-Apr 14:00 + 120 min = **10-Apr 16:00**. Constraint raises it to **11-Apr 08:00**. Calendar: 11-Apr is a Sunday → next working period → **12-Apr 08:00** (or the shift start defined by `ShiftDefinition`) |
| 5 | M11 persists | `B.planned_start = 2027-04-12T08:00`, `planned_end = +duration`. **Only M11 writes this** |
| 6 | Workpack span | Derived `MIN`/`MAX` → `2027-04-10T08:00` → `B.planned_end`. Displayed as "Schedule Start/Finish" |
| 7 | Event window | `Event.planned_end` → `target_finish_date` → if `B` now exceeds it, **negative float appears** — impossible today |
| 8 | Downstream | M10, M13, M14, M15, M16 all read `planned_*`. **No re-entry anywhere** |

**No value is manually re-entered.** The planner supplied duration, a relationship, a lag and a
constraint — four inputs, once each. Every date is computed.

### 14.3 The one honest caveat

Step 4's calendar behaviour depends on **C4**, and `ScheduleCalendar` has **0 rows** (C0 §8).
Until a calendar record exists, the Sunday push cannot happen — the working-time truth currently
lives only in `ShiftDefinition` (§9.2), which CPM does not read. **D8/D9/D10 make this example
expressible and correctly propagated; C4 is what makes the Sunday correct.**

---

## 15. Time Data-Lineage Matrix

| Fact | Authority | Input / Derived | Storage (now → target) | Writer (now → target) | Consumers |
|---|---|---|---|---|---|
| **Activity planned start** | M11 | **Derived** (target). *Input today* | `date` → `timestamptz` | 7 writers + 2 browser algorithms → **M11 only** | UI, M10, M13, M14, M15, M16, exports, baseline, forecast |
| **Activity planned finish** | M11 | **Derived** | `date` → `timestamptz` | same → **M11 only** | same |
| **Activity constraint date** | Planner | **Input** | *(does not exist)* → `timestamptz` | *(none)* → constraint service, audited | M11 only; UI displays beside the derived date |
| **Activity duration** | Planner | **Input** | `numeric(8,2)` hours | creation / edit paths | M11, EVM, resource loading |
| **Relationship + lag** | Planner | **Input** | `lag_days integer` → `lag_minutes integer` | predecessor API, templates | M11; UI/exports convert at render only |
| **Activity early/late/float** | M11 | **Derived, internal** | `timestamp(3)`, skewed +05:30 → `timestamptz` | M11 only ✅ already true | M11 internal; float shown in UI. Of 72 live activities: `early_*` 7, `total_float` 3, **`late_*` and `free_float` 0** |
| **Workpack schedule start** | M11 (rollup) | **Derived** | `date`, **0/199** → derived span | *(none today)* → rollup | Gantt bounds, M10, reports, planner grid |
| **Workpack schedule finish** | M11 (rollup) | **Derived** | `date`, **0/199** → derived span | *(none today)* → rollup | same |
| **Workpack commitment date** | 🟡 **UNDECIDED** (D8 §4.1) | Input, if retained | — | — | Portfolio overdue KPI |
| **Event shutdown window start** | Event / planner | **Input** | `date`, 49/51 → `timestamptz` | Event planning | **M11 as `project_start_date`** ✅ |
| **Event shutdown window finish** | Event / planner | **Input** | `date`, 49/51 → `timestamptz` | Event planning | ❌ **Nothing** → must become `target_finish_date` |
| **Working calendar / shifts** | M11 calendar | **Input** | `ScheduleCalendar` **0 rows**; `ShiftDefinition` **6 rows** | Calendar CRUD | Only `hours_per_day` reaches M11 (§9.2) |
| **Activity actual start** | **M12** | **Input** (execution fact) | `date` → `timestamptz` | `ExecutionWriteService` only ✅ | M8.13, M13, M14, M15 |
| **Activity actual finish** | **M12** | **Input** (execution fact) | `date` → `timestamptz` | `ExecutionWriteService` only ✅ | same |
| **Progress** | **M8.13** | Derived | `integer` percent | M8.13 only ✅ | all downstream |

---

## 16. Authority Map

| Domain | Authority | Now | After D8/D9/D10 |
|---|---|---|---|
| Planned dates / CPM / float | **M11** | 🔴 Not the owner — writes `early_*`, 7 others write `planned_*` | ✅ Sole writer of `planned_*` |
| Schedule constraints | **M11** (consumes), planner (authors) | 🔴 Implicit in `planned_start` for 45 activities | ✅ Explicit, audited, one carrier |
| Lag | **M11** | 🔴 Six factors across writers and readers | ✅ One unit: minutes |
| Working calendar | **M11 / CalendarEngine** | 🔴 One engine, correct, unwired; table empty | ⚠️ C4 |
| Shutdown window | **Event** | 🟡 Start wired, **finish inert** | ✅ Both wired |
| Workpack span | **M11 (derived)** | 🔴 Authored, 0/199, five semantics, plus a manual "Sync" copy | ✅ Derived, one semantic |
| Actual dates | **M12** | ✅ Sole writer (GREEN, closed) | ✅ Unchanged |
| Progress | **M8.13** | ✅ | ✅ Unchanged |
| Readiness | **M10** | ✅ Reads only | ✅ Reads derived span |
| Control Tower / reports / intelligence / channel | M13 / M14 / M15 / M16 | ✅ Read-only | ✅ Unchanged |
| Event = campaign container | **Event** | ✅ R0.4 GREEN | ✅ Unchanged |

**M8.13, M10, M12, M13, M14, M15, M16 and Event authority are untouched by these three
decisions.** The only authority that *changes* is M11's — it gains ownership it was documented as
having and never had.

---

## 17. Migration Implications

### 17.1 What each decision costs the migration

| Decision | DDL | Data migration | Risk |
|---|---|---|---|
| **D8** span | Retire or convert 2 `date` columns | **None — 0 of 199 populated** | **Zero** |
| **D8** commitment | 1 new column, *if* (a) | None | Zero |
| **D9** lag | `lag_days` → `lag_minutes integer` | `× 1440` on 20 rows (6 non-zero) | **Near-zero** — all six are fixtures (§6) |
| **D9** template lag | `lag_hours double precision` → minutes | **0 rows** | Zero |
| **D10** constraint | 5 new columns on `Activity` | None — new fields start NULL | Zero |
| **D10** window wiring | None | None | Behavioural: **float values change** once `target_finish_date` is supplied. Expected and desirable, but it will alter every float and `is_critical` value and must be communicated |

**The combined historical-data risk of D8 + D9 + D10 is effectively nil.** Every one of these is
additive or affects fixture rows. The real R1.0-C data risk remains where C0 put it: the four
`Activity` `date` → `timestamptz` conversions with the +05:30 skew (B4), and the 3 epoch rows
under D7.

### 17.2 Sequencing constraints this task discovered

1. **D10's constraint columns must land before or with D4's ownership transfer.** The engine
   currently seeds from `planned_start` for 80.6% of activities (§9.3). Flipping M11 to *write*
   `planned_start` before it can *read* `constraint_date` would make CPM consume its own output.
   **This is a hard ordering constraint, not a preference.**
2. **`lag_minutes` should land in the same migration as the `timestamptz` conversion.** Both
   change the engine's input contract; two separate engine-contract changes means two rounds of
   test churn against the 48 engine tests.
3. **Wiring `target_finish_date` must be a separate, announced change.** It is the only item here
   that alters existing computed values (float, `is_critical`).
4. **`ShiftDefinition` (6 rows) and `ResourceCapacity` (30 rows) must survive.** Both are inputs
   the target design needs, and both are on `migrate diff`'s DROP list (C0 §9.3). Independent
   confirmation of B2.

### 17.3 NEW BLOCKER — B7: the schema has lost model declarations the database still holds

This was found while inventorying resource constraints and is **not** a D8/D9/D10 question, but it
is material to C2 and it explains B2's mechanism, so it is recorded here.

**`ShiftDefinition` and `ResourceCapacity` are not declared in `prisma/schema.prisma`.** Verified
with a case-insensitive search for `ShiftDefinition`, `ResourceCapacity`, `shift_definitions` and
`resource_capacity` across the whole schema: **no matches.** The same is true of
`workpack_asset_snapshots`.

Yet:

- The tables **exist in the database with live data** — `ResourceCapacity` **30 rows**,
  `ShiftDefinition` **6 rows** (Day 06:00–18:00, Night 18:00–06:00 across 3 events),
  `workpack_asset_snapshots` **2 rows**.
- `src/core/resources/ResourcePlanningService.ts` calls `prisma.shiftDefinition.*` and
  `prisma.resourceCapacity.*` at **fifteen** sites (`:49`, `:65`, `:78`, `:83`, `:94`, `:105`,
  `:128`, `:173`, `:182`, `:194`, `:203`, `:223`, `:228`, `:238`, `:243`).

**Consequence:** those accessors do not exist on the generated Prisma client, so every shift and
capacity operation throws at runtime. **This is the mirror image of B1** — B1 is the schema
declaring a column the database lacks; B7 is the database holding tables the schema no longer
declares, with a service still calling them.

**It also fully explains B2.** C0 recorded that `migrate diff` would DROP 8 tables, 3 with data.
The reason is now mechanical rather than mysterious: `migrate diff` compares the database against
the schema, and the schema has **lost these model declarations**. `migrate diff` is not proposing
to destroy working features — it is faithfully reporting that the schema no longer knows about
them. Running it would delete 38 rows of real configuration.

**Bearing on this task's decisions:** §9.2 identified `ShiftDefinition` as holding the plant's
real 2 × 12 h working-time truth while `ScheduleCalendar` sits empty. B7 means that truth is
currently **unreachable from application code**. The reconciliation migration (D1) must
**re-declare these models**, not drop the tables — and C4's calendar work depends on it.

### 17.4 Test impact

Removing `.slice(0, 10)` from the engine (required for time-of-day) and changing lag to minutes
will both break existing expectations in `src/lib/scheduleEngine.test.ts` (48 tests currently
green, verified this task) and the HX-204 runtime assertions in
`tests/m11-v1-schedule-view.test.ts`. Those are **legitimate contract changes**, not
regressions — but C7 must budget for rewriting date expectations across both files, and the
rewrite must be reviewed as a contract change rather than a test fix.

---

## 18. Open Decisions

| # | Decision | Blocks | Why an agent must not settle it |
|---|---|---|---|
| **OD1** | **Workpack commitment date** — is a separate `required_by_date` needed, or is the overdue KPI retired? (D8 §4.1) | C1 contract wording. **Not** C2 schema | Genuine business meaning. Inventing it would re-conflate plan and commitment |
| **OD2** | **`MUST_START_ON`** — ratify or drop from the type set (§11.3) | C1 | The other two types have code evidence; this one has only domain plausibility |
| **OD3** | **Constraint expiry** (O1, §12.3) | C1 | Workflow policy |
| **OD4** | **Soft constraints** — excluded by default; confirm (O2) | C1 | Product capability decision |
| **OD5** | **`override_start_date`** — retire, or bring under reason+audit (O3) | C6 | Operational policy |
| **OD6** | **Lift the freeze on `ActivityCreationCommand` and M11 for C4/C5** (§12.4) | C4, C5 | Governance. This task has no licence to lift its own constraints |
| **OD7** | **Ratify the six-row fixture classification** (§6.4) | C3 | "These are fixtures" is a strong inference from naming, timing and NULL authorship — but an inference |
| **OD8** | **Material constraints: connect or retire?** `MaterialScheduleIntegrationService` is built and unwired (§11.3.1). Connecting it naively would make material ETA a second writer of `planned_start` | Future phase | Making a material ETA silently move the plan is a significant capability change, and the wiring decision determines whether it goes through the constraint carrier |
| **OD9** | **B7 disposition** — re-declare `ShiftDefinition`, `ResourceCapacity` and `workpack_asset_snapshots` in `schema.prisma` (§17.3) | **C2** | Strictly an engineering fix, but it must be *scoped into* the D1 reconciliation migration, and it means `ResourcePlanningService` is currently broken at runtime — worth knowing before anyone reports it as a new bug |

**Carried forward from C0, still open and unaffected by this task:** B1–B3 database-state repair,
item 3 (M12 status mapping vs the `ActivityStatus` enum), item 9 (the first calendar record —
made sharper by §9.2's discovery that `ShiftDefinition` already contradicts the 10-hour fallback,
and by §17.3's discovery that it is unreachable from code), item 12 (the `ScheduleContainer`
display fallback).

**Newly opened by this task:** **B7** (§17.3) — schema has lost three model declarations the
database still holds, one service still calls two of them, and this is the mechanical explanation
of B2. Also two dead-but-built schedule-constraint mechanisms that C2 must explicitly retire or
adopt (§11.3.1), the MS Project `now()` fabrication (§3.3.2), and the free-float relationship-type
defect (§5.4).

**What evidence would close each:** OD1, OD3, OD4, OD5, OD8 need a **product/business
statement** — no amount of code reading will produce them. OD2 needs a planner's confirmation
that fixed-date activities occur in this business. OD6 needs an architect's authorisation. OD7
needs either ratification or a decision to hand-adjudicate six rows.

---

## 19. C1 Gate Decision

> # C1 TIME CONTRACT CAN BE FROZEN: **NO**

### 19.1 Exact blockers

| # | Blocker | Class |
|---|---|---|
| **1** | **OD1** — the "Execution Calendar" question. The contract cannot state what a workpack date *is* while M10 scores planners 8% for authoring it, the portfolio KPI treats it as a deadline, and a "Sync" button treats it as a copy of the activity span | Semantic (D8) |
| **2** | **OD2 / OD3 / OD4** — the constraint contract is incomplete: one type unratified, expiry undefined, soft-constraint scope unconfirmed | Semantic (D10) |
| **3** | **OD6** — the constraint model cannot be implemented without editing `ActivityCreationCommand` and M11, both currently frozen | Governance |

### 19.2 What CAN be frozen now

Freezing these early is worthwhile, because they are settled and each unblocks a later phase:

- **The entire lag contract** (D9, §8) — canonical `lag_minutes`, the `× 1440` migration rule,
  and every boundary conversion rule. **GREEN and freezable today.**
- **The Workpack schedule-span rule** (D8, §4.1) — derived `MIN`/`MAX`, NULL when empty,
  labelled "Schedule Start/Finish", excluding cancelled activities. Only the *commitment* half
  is open.
- **The propagation contract** (D10, §13.3) — input → constraint → M11 → derived planned date →
  read-only consumers.
- **The principle that a constraint is an input and never a second date authority** (§12.1).
- **The shutdown-window wiring rule** — `Event.planned_start` → `project_start_date`,
  `Event.planned_end` → `target_finish_date`.

### 19.3 Dependency chain, corrected

The instruction's expected chain was `D8 → D9 → D10 → C1 → C2 → C3 → C4 …`. The evidence shows
one correction and one addition:

```
D9  (GREEN) ────────────────────────────────┐
D8  (span GREEN / commitment AMBER) ────────┤
D10 (model GREEN / policy AMBER) ───────────┤
                                            ▼
                          ┌──────────► C1 Time Contract
    B1–B3 DB-state repair ┘                 │
    (C0, independent)                       ▼
                                          C2 Schema  ◄── constraint columns land HERE
                                            │
                                            ▼
                                          C3 Lag migration
                                            │
                                            ▼
                    C4 M11 planned-date authority ◄── REQUIRES the engine to read
                                            │          constraint_date, not planned_start
                                            ▼          (§17.2 hard ordering constraint)
                                       C5 Propagation → C6 → C7 → C8 → C9
```

Two things the original chain did not capture:

1. **B1–B3 (database-state repair) is a parallel, independent prerequisite for C2.** It is not
   downstream of D8/D9/D10 and can proceed now — the `pg_dump`-and-verify-restore step, the
   reconciliation migration, and confirming `prisma.activity.findFirst()` **and** an `Activity`
   create both succeed.
2. **C4 depends on C2 having delivered the constraint columns**, because of the §9.3 circularity.
   The original chain put lag migration before M11 authority, which is fine, but it did not
   record that M11 authority is *blocked* on the constraint carrier.

### 19.4 Recommended immediate next step

Answer **OD1** and **OD6**. OD1 unblocks the C1 contract wording; OD6 unblocks C4/C5 planning.
Everything else can proceed in parallel with B1–B3 repair, which needs no further decisions.

---

## 20. Final GREEN / AMBER / RED

> # 🟡 AMBER

**Not GREEN:** three of the twelve semantic questions this task set out to close require product
or governance input that must not be manufactured (§18 OD1–OD6). §12 of the governing
instruction is explicit — *"If any semantic decision is ambiguous: STOP… Return AMBER and
identify the exact unresolved decision."*

**Not RED:** nothing found makes safe migration impossible. The opposite — the migration surface
is smaller than expected. Workpack planned dates are **0 of 199** populated; the six lag rows are
**test fixtures**; the constraint columns are **additive**; template lag has **0 rows**. No
historical business value is reinterpreted by any of these three decisions.

**What this task settled:**

- D9 closes **GREEN** on all five of its own criteria, including the behavioural proof that
  R1.0-C §25.4 asked for and the correction of its mechanism.
- The `× 1440` preservation rule moved from *assumed* to *proven* via `hours_per_day` invariance.
- All six ambiguous lag rows are identified as fixtures, removing the need for human
  adjudication that C0 §12 item 7 anticipated.
- D8's **five** conflicting semantics are documented as a defect rather than averaged into a
  compromise, and the span half is decided — as a promotion of the existing opt-in rollup, not an
  invention.
- Four **built-and-unwired** schedule-constraint mechanisms identified, so C2 retires or adopts
  them deliberately instead of adding a fifth.
- **B7** opened, which supplies the mechanical explanation of B2 that C0 lacked.
- D10's constraint model is specified with an **evidence-bounded** type set of three, and seven
  candidate types are explicitly rejected with reasons.
- The single most consequential structural finding: **D4 is not implementable on the current
  engine without D10**, because CPM seeds 80.6% of activities from the very column D4 would make
  it write.

**What is not settled, and why:** eight decisions in §18, of which OD1 (business meaning), OD6
(governance) and OD2–OD5 (product policy) are the substance. None is an engineering gap; all
require a human with authority this task does not have.

### Compliance with §12 STOP RULE

No ambiguity was resolved by any prohibited means. Specifically: **no** date field was added to
paper over D8 (the commitment question is left open instead of being satisfied with a new
column); **no** lag field was added without authority (`lag_minutes` **replaces** `lag_days`, and
the template `lag_hours` is folded in rather than kept); **no** default was invented (the
`MUST_START_ON` type is flagged rather than assumed, soft constraints are excluded and the
exclusion is declared a decision); **no** historical data was converted; **no** client intent
was assumed; **no** planned date was copied; **no** second CPM engine and **no** second
constraint engine was proposed — the design wires the existing `CalendarEngine` and the existing
`calculateSchedule`.

**R1.0-C schema migration must NOT begin.** D8 and D10 are not formally closed.

---

## 21. Final Governing Questions

| # | Question | Answer | Evidence |
|---|---|---|---|
| **Q1** | What exactly do Workpack planned dates mean? | **NO — five different things.** Human work-order intent (all 14 entry points), contractual deadline (portfolio overdue KPI), Gantt span bounds, a named score-weighted **"Execution Calendar"** readiness artefact, and the destination of a manual **"Sync"** copy from the activity span. Recorded as a defect, not averaged | §3.2, §3.2.1, §3.3, §3.3.1, §3.4 |
| **Q2** | Should they be derived from Activity schedule, or independent inputs? | **PARTIALLY — derived.** The span is decided derived (`MIN`/`MAX`, NULL when empty), which *promotes an existing opt-in rollup* rather than inventing one. Whether the "Execution Calendar" is a genuinely separate authored fact is OD1 | §3.2.1, §4.1 |
| **Q3** | What is the canonical future lag unit? | **YES — VERIFIED.** `lag_minutes INTEGER`, signed. One internal unit; explicit named conversion only at API/UI/import/export boundaries | §8.1 |
| **Q4** | What does the existing six-row lag population actually mean? | **YES — VERIFIED.** CPM float-test fixtures. Three identical triplets, three organisations, 101 seconds apart, `created_by = NULL` on all 20 relationships, never in a persisted CPM run | §6.1, §6.2, §6.3 |
| **Q5** | Can existing lag values be converted without inventing business intent? | **YES — VERIFIED.** `× 1440` preserves engine behaviour *exactly* (proven by `hours_per_day` invariance) and fixture intent exactly, because for these rows they are the same thing. No path wrote them via ÷8 or ÷24 | §5.3, §6.3, §8.2 |
| **Q6** | What happens today when a 4-hour lag enters `lag_days`? | **YES — VERIFIED.** `lagHoursToDays(4) = 0.5`. Prisma does **not** reject it; **PostgreSQL** does, with `22P02 invalid input syntax for type integer: "0.5"`. The API 500s. It does not round, truncate or silently coerce, and no bad value is stored | §7.1, §7.2, §7.3 |
| **Q7** | What is the canonical constraint model? | **PARTIALLY.** Columns on `Activity` (`constraint_type`, `constraint_date timestamptz`, reason, author, timestamp) with **three** evidence-backed types; seven candidates rejected with reasons. One type (OD2) and the policy questions (OD3, OD4) remain | §11.2, §11.3, §13.1 |
| **Q8** | Can a constraint influence M11 without becoming a second planned-date authority? | **YES — VERIFIED, and it is the only way that works.** A constraint is an input consumed in the forward pass; M11 remains sole writer of the result; the derived date stays visible beside the constraint. The current system proves the negative case: `planned_start` **is** an implicit constraint on a result column, for 45 of 72 activities | §9.3, §12.1, §13.3 |
| **Q9** | Can the whole chain run input-once → M11 → derived → downstream, with no manual re-entry? | **PARTIALLY.** Architecturally yes, and §14.2 traces it end to end. Blocked in practice by three things outside these decisions: B1–B3 database-state repair, C4's empty calendar (`ScheduleCalendar` 0 rows while `ShiftDefinition` holds the real 12-hour shifts), and the C0 §6.2 trigger gaps that would leave any derived value stale | §14.2, §14.3, §17.2 |
| **Q10** | Are D8, D9 and D10 settled enough to freeze C1? | **NO.** D9 yes. D8's commitment semantics (OD1) and D10's override policy plus governance (OD2–OD4, OD6) are not. The lag contract, the span rule and the propagation contract can be frozen now (§19.2) | §19.1, §19.2 |

---

**END — AURIANOA R1.0-C D8 / D9 / D10 SEMANTIC DECISION GATE**

*No code, schema, migration, test, seed or database row was modified by this task. All database
access was `SELECT` / `information_schema` / `pg_catalog`. Temporary probe scripts were deleted
after transcription. M12, M8.13, M10, M11, M13, M14, M15, M16, Event authority,
`ActivityCreationCommand` and `ExecutionWriteService` are untouched.*
