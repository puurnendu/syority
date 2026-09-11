# AURIANOA R1.0-C1 — TIME AUTHORITY CONTRACT

**Phase:** R1.0-C1 — final semantic contract freeze before schema / migration implementation
**Date:** 2026-09-10
**Mode:** READ-ONLY CONTRACT FREEZE. No application code, Prisma schema, migration, database row, seed, test or UI was created or modified.
**Freezes:** the authoritative meaning, owner, writer and lifecycle of every time-related business fact in AURIANOA STO.

**Inputs read completely:**

| Document | Note |
|---|---|
| `docs/AURIANOA_R1.0_OD1_OD6_PRODUCT_DECISION_GATE.md` | The authoritative decision document. **Path correction:** §0 of the C1 instruction cites `AURIANOA_R1.0-C_OD1_OD6_PRODUCT_DECISION_GATE.md`; the file on disk is `AURIANOA_R1.0_OD1_OD6_PRODUCT_DECISION_GATE.md`. No document exists at the cited path. |
| `docs/AURIANOA_R1.0_D8_D9_D10_TIME_SEMANTIC_DECISION.md` | Complete |
| `docs/AURIANOA_R1.0_C_TIME_FOUNDATION_IMPLEMENTATION_RESULT.md` | Complete (superseded by C0, retained for audit) |
| `docs/AURIANOA_R1.0_C0_TIME_IMPLEMENTATION_PRECHECK.md` | Referenced for B1–B4 detail |

---

## 1. Executive Summary

> # 🟢 C1 IS FREEZABLE. THE SEMANTIC CONTRACT IS FROZEN.
> # ⛔ C2 REMAINS BLOCKED. MIGRATION SAFETY IS 🔴 RED.

**The distinction that governs this document:** every question about *what a date means* is now
closed. Every remaining blocker is about *whether the database can be changed safely*. Those are
different problems, and conflating them is what stalled the three previous attempts.

| Item | State |
|---|---|
| **C1** | ✅ **FREEZABLE** |
| **Semantic contract** | ✅ **FROZEN** |
| **C2** | ⛔ **BLOCKED** — on infrastructure only (§26) |
| **OD9** | **REQUIRED** — and wider than recorded: **four** missing models, not three (§24) |
| **C4** | ✅ **DEFINED** (§25) |
| **Blocking semantic ambiguity** | **NONE** |
| **Migration safety** | 🔴 **RED** (§26.2) |

### What this task establishes that was not previously established

1. **Forecast has no authoritative stored source anywhere on the live surface — and the only
   forecast columns that exist belong to the retired `Project` entity.** `Project.forecast_sd_date`
   / `forecast_su_date` (`schema.prisma:1212-1213`) have **zero references** in `src/**` or
   `app/**`. `Activity`, `Event` and `Workpack` have **no** forecast column. Per §24 of the
   instruction this is recorded as **absent**, not invented (§20). [SOURCE — proven absence]
2. **The retired entity has the complete time model the live entity lacks.** `Project` carries a
   full `planned_ / forecast_ / actual_` triplet for shutdown and startup
   (`schema.prisma:1210-1215`). The live `Event` carries only `planned_start` / `planned_end`.
   R0.4 retired the right entity, but the *shape* that was retired is the shape reporting now
   wants — which is why §20 marks forecast OPEN rather than absent-by-design. [SOURCE]
3. **A client-supplied query parameter changes a schedule-derived business figure.**
   `app/api/events/[eventId]/schedule/forecast/route.ts:20` reads `hoursPerDay` from the URL,
   defaulting to **8**, and passes it into `ScheduleForecastService.computeForecast`. The
   calendar's own fallback is **10** h. The forecast never consults `CalendarEngine` at all. So
   the same event yields different forecast finish dates depending on a query string. [SOURCE]
   New defect **D-17**.
4. **B1 is two columns, not one, and it breaks writes as well as reads.** `Activity.project_id`
   (`schema.prisma:54`) **and** `Activity.schedule_source` (`:56`) are both declared in Prisma and
   both absent from the live database, and `ActivityCreationCommand:486` writes
   `schedule_source` on every create. B1 therefore blocks activity *creation*, not merely
   `findFirst`. [SOURCE + EXECUTED via C0 §12A]
5. **Seven stale schema copies sit beside the authoritative schema.** `prisma/` contains
   `schema.prisma.clean`, `schema_clean_download.prisma`, `schema_server_105kb.prisma`,
   `schema_part1..5.prisma` and `test.prisma` — all dated **28-Mar-2026**, ~100 KB each, against a
   262 KB `schema.prisma` dated 09-Sep-2026. One of them (`phase1_expansion.sql`) declares the
   Project forecast columns as `TIMESTAMPTZ` while the baseline migration declares them
   `TIMESTAMP(3)`. **An auditor or a CLI pointed at the wrong file would read a six-month-old
   model.** New defect **D-18**, material to gate G3. [SOURCE]
6. **`Activity.status` is nullable, which makes the workpack span inclusion rule a correctness
   hazard rather than a formality.** `status ActivityStatus? @default(not_started)`
   (`schema.prisma:30`). A naive `status <> 'cancelled'` predicate silently **drops every
   NULL-status activity**, because `NULL <> 'cancelled'` is `NULL`. §7 freezes the rule in
   three-valued-logic-safe form. [SOURCE]
7. **`Activity.schedule_source` already exists as an import-provenance column** (`:56`, values
   `'workpack' | 'imported' | null`). The import contract (§19) does not need a new provenance
   field — it needs the existing one to survive B1. [SOURCE]
8. **🔴 NEW BLOCKER B8 — the live enum has five `ActivityStatus` values, not eight, and M12 writes
   three that do not exist.** `released`, `verified` and `closed` are declared at
   `schema.prisma:3026-3035` and **absent from the live PostgreSQL enum** [EXECUTED], while
   `ExecutionWriteService` writes all three (`:255`, `:312`, `:320`). **Three M12 execution actions
   cannot persist against this database.** This does **not** reopen M12 — it is schema drift breaking
   M12's *writes*, exactly as B1 breaks `ActivityCreationCommand`'s. §7.2.1, **D-41**.
9. **🔴 No repository evidence pins one operational timezone, and three different zones are in
   play.** The database session reports `Asia/Calcutta` [EXECUTED]; the schema defaults
   `Organization.timezone` and `Site.timezone` to **`"UTC"`** (`:1002`, `:1458`); the UI defaults to
   browser-local; WhatsApp hard-codes `Asia/Kolkata`. There is no `TZ` in any env or compose file, no
   timezone pin on the Prisma pool, and **no timezone library among the dependencies**. §17.3.1,
   **D-39**.
10. **Schema and database have drifted in BOTH directions simultaneously, producing five runtime
    breaks from one root cause** — declared-but-absent columns (B1), absent-but-existing tables
    (B7/OD9), declared-but-absent enum values (B8), a phantom `is_milestone` query (D-44), and a
    model absent from both (EventPhase). §23.1.
11. **Planned progress is not absent — it is computed four times from three different date sources**
    (baseline planned, current planned, CPM early dates). A conflict, not a gap. §20.3, **D-45**.

### Corrections this document makes to its own earlier claims

Per instruction §31 (*"executed evidence outranks documentation"*), which applies to this document as
much as to any other:

| Earlier claim | Correction | Basis |
|---|---|---|
| "No per-organization or per-event timezone column exists" | **Wrong for organization and site.** `Organization.timezone` and `Site.timezone` both exist and default to `"UTC"`. Correct only for `Event` and `Plant` | [SOURCE] §17.3.2 |
| `ActivityStatus` has eight usable members | **Only five exist in the database.** Three are Prisma-only | [EXECUTED] §7.2.1 |
| Excluding `cancelled` has "zero data impact" because no cancelled rows exist | **One cancelled row exists** — and it is the same row as the one soft-deleted activity, so it is already excluded. Zero *live* impact, for a different reason | [EXECUTED] §7.2.2 |
| Planned progress is absent / OPEN | **Computed four times with three date sources** | [SOURCE] §20.3 |
| `CalendarEngine.getHoursPerDay` is reached only from M11 and scenarios | **Also from M15** via `resolveWorkingHoursPerDay` (`DecisionIntelligenceService.ts:336`) | [SOURCE] §10A |
| D-01's `?? new Date()` is one site, cause unstated | **Two sites**, and the cause is that `BaselineActivity.planned_start/finish` are **NOT NULL** — which removes one of the two remedies | [SOURCE] §14.3 |
| D-37 "C2 must verify `BaselineActivity` retains `workpack_id`" | **Verified: it does not.** Option B stands, but C2 **must add** the column or the frozen span stays retroactively mutable | [SOURCE] §14.2 |

### What this document does NOT do

**Twenty new defects were opened and none was fixed:** D-17 (client-controlled forecast
hours-per-day), D-18 (seven stale schema copies), D-19 (dead `Project` time columns), D-20
(`Asia/Calcutta` vs `Asia/Kolkata` alias), D-38 (shift times as `text`), **D-39** (UTC defaults vs the
chosen zone), D-40 (hard-coded zone in M16), **D-41 (B8, enum drift)**, D-42 (UI offers a rejected
status), D-43 (missing soft-delete filter), D-44 (phantom `is_milestone` query), D-45 (four
planned-progress engines), D-46 (dead public methods), D-47 (seed writes a non-enum status), D-48
(false forecast header comment), D-49 (`remaining_duration` written by nobody), D-50 (the `0.1`-day
duration floor), D-51 (a fourth hard-coded hours-per-day), D-52 (export fabricates a duration), D-53
(export strips the timezone marker), D-54 (the S-curve "Forecast" is money, not a date). **Existing
D-01 and D-02 were widened** — two and four fabrication sites respectively, not one each.

It does not reopen D8, D9, D10, OD1, OD6, M12 or R0.4. Where those decisions constrain C1, they
constrain it — most visibly at §9 (D9 forces lag to be wall-clock) and §7 (OD1 forecloses a
workpack-authored window). Nothing here contradicts them.

---

## 2. Scope

### In scope

Defining the final authoritative meaning, owner, writer and lifecycle of every time-related
business fact; classifying every current planned-date writer against its target role; specifying
the constraint, calendar, baseline, scenario, change-control, timestamp, import/export and
reporting contracts that C2 and C4 must implement; and enumerating the exact gates before C2.

### Out of scope, and verified untouched (§32)

Application code · Prisma schema · migrations · database data · seeds · tests · UI · APIs · service
refactors · defect fixes · backfills · table drops · `db push` · `migrate reset` · schema-drift
repair.

**Nothing discovered during this task was fixed.** Twenty new defects (D-17 … D-20, D-38 … D-54) and
one new blocker (**B8**) were found and recorded only.

### Decisions treated as CLOSED and not reopened

| Decision | State | Where it constrains C1 |
|---|---|---|
| **OD1** | GREEN | §7 — no workpack-authored window may be reintroduced |
| **OD6** | GREEN | §8, §16 — Pattern 1 only; category 5 empty |
| **D8** | GREEN | §7 |
| **D9** | GREEN | §9 — `lag_minutes`, `× 1440`, and therefore **wall-clock lag** (§10.6) |
| **D10** | GREEN | §8 |
| **M12** | GREEN / CLOSED | §5.4 — `actual_*` untouched. **Note:** §7.2.1 records that three M12 *writes* fail against the current database because of enum drift (**B8**). That is an infrastructure defect, **not** a reopening of M12's authority decision, exactly as B1 breaking activity creation is not a reopening of M11 |
| **R0.4** | GREEN / CLOSED | Event is the campaign container; `Project` is retired (§20.1) |

### The five variants of one drift defect

Schema and database have drifted **in both directions simultaneously**. C2 must treat these as one
workstream, not five bugs (§23.1):

| Variant | Prisma | Database | Consequence |
|---|---|---|---|
| **B1** | declares 2 `Activity` columns | absent | Activity reads **and creates** fail |
| **B7 / OD9** | 3 models missing | tables + 38 rows exist | All shift / capacity operations fail |
| **`EventPhase`** | model missing | table also missing | The phases route and page fail |
| **B8** (new) | declares 3 enum values | absent | **3 M12 execution actions fail** |
| **`is_milestone`** | not declared | absent | One M14 report provider fails |

**Seven stale schema copies** sit beside the authoritative `schema.prisma` (D-18), which is the most
likely mechanism by which declarations were lost in both directions.

### One internal inconsistency in the input documents, recorded not fixed

`OD1_OD6_PRODUCT_DECISION_GATE.md` §28 condition 1 says *"five converging strands"* while §9.1 of
the same document lists **six** (a sixth was added when a later sweep landed). The substantive
count is six. **Not corrected**, because §29 permits creating only this file. [SOURCE]

---

## 3. Frozen Authority Model

> **This model is FROZEN. No C2 or C4 change may alter it.**

```
EVENT ─── owns the campaign / turnaround commitment window
  │        (authored, Event-only operational boundary per R0.4)
  │
  ├── ScheduleCalendar / ShiftDefinition ─── owns working-time availability
  │
  ▼
M11  ScheduleOrchestrationService + scheduleEngine + CalendarEngine
     ═══ SOLE planned-date / CPM authority ═══
     Consumes:  duration · relationship + lag · constraint · calendar · Event window
     Writes:    Activity.planned_start / planned_end
                Activity.early_* / late_* / total_float / free_float / is_critical
                Workpack.schedule_start / schedule_finish  (derived span)
  │
  ▼
ACTIVITY ─── owns execution work
  │
  ├── M12 ExecutionWriteService ═══ SOLE execution-fact mutation authority ═══
  │        Writes: actual_start / actual_end  (execution provenance only)
  │
  └── M8.13 ═══ SOLE progress-calculation authority ═══
  │
  ▼
WORKPACK ─── owns scope / work identity
             exposes a DERIVED schedule span only
             owns NO second authored execution window

M10 ─── owns readiness EVALUATION. Never a schedule authority. Never a date writer.
M13 ─── Control Tower.            Read-only over time facts.
M14 ─── Reporting.                Read-only over time facts.
M15 ─── Management intelligence.  Read-only over time facts.
M16 ─── Interaction layer.        Read-only over time facts.
```

### The three prohibitions this model implies

1. **No new calculation engine.** Not a CPM engine, not a calendar engine, not a span engine, not
   a progress engine. Where logic is missing, the existing engine is extended (§10A).
2. **No fact has two writers.** Verified fact-by-fact in §21.
3. **No downstream module writes a time fact it consumes.** M10, M13, M14, M15 and M16 are
   read-only over every fact in §4.

---

## 4. Time Fact Catalogue

Twenty facts, covering §2 items A–T. All fourteen required attributes are specified: the first
table gives meaning, ownership, direction, entry point and consumers; the second gives the eight
behavioural attributes. **"Target"** describes the frozen contract; **"today"** notes are given
only where current behaviour differs materially.

### 4.1 Meaning, owner, writer, direction, entry, consumers

| # | Fact | Semantic meaning (frozen) | Owning entity | Authoritative writer | Input / Derived | First point of entry | Downstream consumers |
|---|---|---|---|---|---|---|---|
| **A** | `Event.planned_start` | The instant the turnaround campaign is committed to begin. The commercial and operational datum for the whole campaign | **Event** | `EventPlanningService` **only** | **INPUT** (authored) | Event creation form, before any workpack or activity exists | M11 as `project_start_date`; baseline metadata; portfolio KPIs; M13–M16; MS Project `<StartDate>` |
| **B** | `Event.planned_end` | The instant the campaign is committed to complete. **Not** a clamp — the backward-pass datum against which overrun becomes visible | **Event** | `EventPlanningService` **only** | **INPUT** (authored) | Same | M11 as **`target_finish_date`** (target; unwired today); baseline; overdue KPI; MS Project `<FinishDate>` |
| **C** | `Activity.planned_start` | The instant M11 calculates that this activity will start, honouring logic, lag, calendar and constraints | **Activity** | **M11 only** | **DERIVED** | Never entered. Emitted by the CPM persist transaction | UI, M10, M13, M14, M15, M16, exports, baseline, forecast, span |
| **D** | `Activity.planned_end` | The instant M11 calculates it will finish | **Activity** | **M11 only** | **DERIVED** | Same | Same |
| **E** | `Activity.actual_start` | The instant work actually began, as recorded by field execution. **Execution provenance only** | **Activity** | **M12 `ExecutionWriteService` only** | **INPUT** (measured fact) | Field execution / progress capture | M8.13, M13, M14, M15 |
| **F** | `Activity.actual_end` | The instant work actually finished | **Activity** | **M12 only** | **INPUT** (measured fact) | Same | Same |
| **G** | `Activity.duration_hours` | Quantity of **working** time the task occupies. A magnitude, not an instant | **Activity** | Creation / edit paths; governed change requests | **INPUT** | Activity authoring | M11 (converted to elapsed time through the calendar), EVM, resource loading, forecast |
| **H** | `ActivityRelationship.lag` → **`lag_minutes`** | Signed **elapsed wall-clock** minutes inserted between two activities. Never calendar-adjusted (§9, §10.6) | **ActivityRelationship** | Predecessor API; template instantiation | **INPUT** | Logic authoring | M11 only. Readers convert at render, never at persist |
| **I** | `Activity.constraint_type` | Which kind of dated bound the planner has imposed. NULL = unconstrained | **Activity** | Constraint service (new), audited | **INPUT** | Planner imposes a date | **M11 only.** UI displays it *beside* the derived date |
| **J** | `Activity.constraint_date` | The bounding instant itself | **Activity** | Constraint service, audited | **INPUT** | Same | **M11 only** |
| **K** | `Workpack.schedule_start` | The earliest calculated start across the workpack's in-scope activities. A **derived rollup**, never authored | **Workpack** (derived attribute) | **M11**, inside the CPM persist transaction | **DERIVED** | Never entered | Gantt bounds, workpack header/list, planner grid, PDF/print, M10 display, M14 |
| **L** | `Workpack.schedule_finish` | The latest calculated finish across the same set | **Workpack** (derived) | **M11** | **DERIVED** | Never entered | Same |
| **M** | `ScheduleCalendar` (`work_days`, `exceptions`, `hours_per_day`) | Which days and how many hours per day work may occur. The single working-time authority | **Organization / Event** | Calendar CRUD | **INPUT** | Calendar configuration | **M11 via `CalendarEngine`** (C4). **0 rows today** |
| **N** | `ShiftDefinition` (`start_time`, `end_time`, `is_active`) | The within-day windows work may occupy. Refines `M` | **Event** | Shift CRUD (**broken — OD9**) | **INPUT** | Shift configuration | M11 via `CalendarEngine` (C4); resource planning. **6 rows, unreachable** |
| **O** | `ResourceCapacity` (`target_date`, `capacity_limit`, `shift_id`) | How much resource is available on a date. An **external constraint**, not a date fact | **Event / Resource** | Capacity CRUD (**broken — OD9**) | **INPUT** | Capacity planning | Resource levelling (post-process). **Never a CPM date input.** 30 rows, unreachable |
| **P** | `MaterialConstraint.constraint_date` | The earliest instant material availability permits work. **Computed** from supply-chain data, not authored | **Activity** (via material line) | `MaterialReadinessService` | **DERIVED** (from external data) | Supply-chain integration | Readiness gates. CPM **only** if OD8 says so, and then **only** by materialising a category-1 constraint (§12) |
| **Q** | `EventMilestone.planned_date` | An authored dated target inside the campaign. A genuine commitment carrier, distinct from A/B | **Event** | `EventPlanningService.upsertMilestone` | **INPUT** (authored) | Milestone form | `ScheduleHealthService` variance scoring (`:262-265`, `:403-405`). **0 rows; mechanism complete** |
| **R** | `BaselineActivity` dates | A frozen copy of M11's calculated Activity dates at the moment of baselining. Evidence of what was committed | **ScheduleBaseline** | `ScheduleBaselineService` (create only) | **DERIVED** (frozen copy) | Baseline creation | Variance / comparison reporting |
| **S** | `ScenarioActivityOverride` dates | A sandbox proposal. **Never** binds the live plan | **Scenario** | `ScenarioPlanningService` | **INPUT to a sandbox** | Scenario authoring | Scenario calculation only. Reaches the live plan **only** via `promoteScenario` → `ScheduleChangeRequest` (§15) |
| **T** | **Forecast dates** | *"If the current trajectory continues, when will this finish?"* | — | **NONE — no stored carrier exists** | **DERIVED, transient** | Computed on request by M8.8 | M15 `DecisionIntelligenceService:346`; forecast API. **§20 — recorded ABSENT / OPEN** |

### 4.2 Behavioural attributes

| # | Fact | Editable by a user? | Can recalculation change it? | Baseline-frozen? | Audit required? | Can influence CPM? | Can influence readiness? | Can influence execution? | Can influence reporting? |
|---|---|---|---|---|---|---|---|---|---|
| **A** | `Event.planned_start` | ✅ Yes — authored | ❌ No | ✅ As baseline metadata (`project_start`) | ✅ **Yes** | ✅ **Yes** — `project_start_date` | ✅ Indirectly | ❌ No | ✅ Yes |
| **B** | `Event.planned_end` | ✅ Yes — authored | ❌ No | ✅ As `project_finish` | ✅ **Yes** | ✅ **Yes** — `target_finish_date` (target) | ✅ Via negative float | ❌ No | ✅ Yes |
| **C** | `Activity.planned_start` | ❌ **NO — never** | ✅ **Yes, every run** | ✅ Yes | ✅ Yes (M11 provenance) | ❌ **No — it is the output** | ✅ Yes (as evidence) | ✅ Yes (lookahead, sequencing) | ✅ Yes |
| **D** | `Activity.planned_end` | ❌ **NO** | ✅ Yes | ✅ Yes | ✅ Yes | ❌ No | ✅ Yes | ✅ Yes | ✅ Yes |
| **E** | `Activity.actual_start` | ⚠️ Only by M12 correction, audited | ❌ **No — never touched by CPM** | ❌ No | ✅ **Yes — mandatory** | ❌ **No** | ✅ Yes | ✅ Yes | ✅ Yes |
| **F** | `Activity.actual_end` | ⚠️ M12 correction only | ❌ **No** | ❌ No | ✅ **Yes** | ❌ No | ✅ Yes | ✅ Yes | ✅ Yes |
| **G** | `duration_hours` | ✅ Yes | ❌ No (it is an input) | ✅ Yes | ✅ Yes | ✅ **Yes** | ✅ Yes | ✅ Yes | ✅ Yes |
| **H** | `lag_minutes` | ✅ Yes | ❌ No | ⚠️ Not today; **may** be captured as baseline logic metadata | ✅ Yes | ✅ **Yes** | ❌ No | ❌ No | ✅ Via exports |
| **I** | `constraint_type` | ✅ Yes — with mandatory reason | ❌ No | ❌ **No** — may appear as baseline *metadata*, never as a baselined date | ✅ **Yes — mandatory** | ✅ **Yes** | ⚠️ Indirectly | ❌ No | ✅ As explanation |
| **J** | `constraint_date` | ✅ Yes — with mandatory reason | ❌ No | ❌ No (metadata only) | ✅ **Yes** | ✅ **Yes** | ⚠️ Indirectly | ❌ No | ✅ As explanation |
| **K** | `Workpack.schedule_start` | ❌ **NO** | ✅ **Yes** | ❌ **No** — recomputable from `R` (§14) | ⚠️ No (derived) | ❌ **No** | ✅ Yes (as evidence) | ❌ No | ✅ Yes |
| **L** | `Workpack.schedule_finish` | ❌ **NO** | ✅ **Yes** | ❌ No | ⚠️ No | ❌ No | ✅ Yes | ❌ No | ✅ Yes |
| **M** | `ScheduleCalendar` | ✅ Yes | ❌ No | ⚠️ Should be captured as baseline metadata | ✅ Yes | ✅ **Yes** | ❌ No | ⚠️ Indirectly | ✅ Yes |
| **N** | `ShiftDefinition` | ✅ Yes | ❌ No | ⚠️ Metadata | ✅ Yes | ✅ **Yes** (C4) | ❌ No | ✅ Yes | ✅ Yes |
| **O** | `ResourceCapacity` | ✅ Yes | ❌ No | ❌ No | ✅ Yes | ❌ **No** — levelling post-process only | ❌ No | ✅ Yes | ✅ Yes |
| **P** | `MaterialConstraint.constraint_date` | ❌ No — computed | ✅ Recomputed from supply data | ❌ No | ✅ Yes | ⚠️ **Only via `I`/`J`** (OD8) | ✅ **Yes** — its current role | ✅ Yes | ✅ Yes |
| **Q** | `EventMilestone.planned_date` | ✅ Yes — authored | ❌ No | ⚠️ Not today | ✅ Yes | ❌ **No** | ❌ No | ❌ No | ✅ Yes — variance scoring |
| **R** | `BaselineActivity` dates | ❌ **NO — immutable** | ❌ **No** | ✅ **It *is* the freeze** | ✅ Creation audited | ❌ No | ❌ No | ❌ No | ✅ Yes |
| **S** | `ScenarioActivityOverride` dates | ✅ Yes — in the sandbox | ❌ No (scenario recalc only) | ❌ No | ⚠️ Scenario-scoped | ❌ **No — never binds the live plan** | ❌ No | ❌ No | ⚠️ Scenario reports only |
| **T** | Forecast dates | ❌ Not stored | N/A — recomputed on every request | ❌ No | ❌ No | ❌ **No — never** | ❌ No | ❌ No | ✅ **Yes** — its only purpose |

### 4.3 Three notes the catalogue must carry

**(a) `T` is deliberately blank in the writer column.** Per §24 of the instruction, forecast is
recorded as having **no authoritative source** rather than being assigned one. §20 states the
consequences.

**(b) `O` is not a date fact.** `ResourceCapacity.target_date` is the date a *capacity* applies
to, not a date any activity is scheduled on. Making it a CPM input would mean resource-constrained
scheduling — a different algorithm, explicitly out of scope (§25).

**(c) `Q` is the only authored dated target below campaign scope that survives this contract.**
OD1 retired the workpack window; `EventMilestone` is the sanctioned carrier if intermediate dated
commitments are ever required.

---

## 5. Activity Date Contract

### 5.1 The freeze

> **`Activity.planned_start` and `Activity.planned_end` are M11 CALCULATED OUTPUTS.**
> **No other production service may directly establish them.**

Corollary, and the reason this is not merely tidiness: under this contract
`Activity.planned_start` **ceases to be a CPM input**. The engine's predecessor-less seeding at
`scheduleEngine.ts:251-262` must read `constraint_date`. Without that change M11 would consume its
own output for the 80.6 % of activities that have no predecessor (45 of 72 currently seeded from
`planned_start`) [EXECUTED, D10 §9.3]. **This ordering is a hard prerequisite, not a preference.**

### 5.2 Classification of every current writer

Each of the ten mechanisms named in §3 of the instruction, plus the two the prior gates added.

| Mechanism | Location | Current behaviour | Target role | Disposition |
|---|---|---|---|---|
| `ActivityCreationCommand` | `:481-482` | The funnel every creation path uses; writes `planned_start` / `planned_end` on create | **Input / constraint conversion** — a supplied date becomes `constraint_type` + `constraint_date` | **CONVERT** — requires **OD10** |
| Activity creation APIs | `app/api/activities/route.ts:57`; `app/api/projects/[id]/schedule/activities/route.ts` | Entry points that delegate to `ActivityCreationCommand` (**not** independent writers — corrected at D8 §2.2) | Same conversion, inherited | **CONVERT** (via the command) |
| `ActivityService.updateActivity` | edit path; enqueues CPM recalculation | Direct `planned_*` write | **Input / constraint conversion** | **CONVERT** |
| `ResourceLevelingApplyService` | `:118-124` | Writes dates, audits fully, then recalculates CPM — **which discards the delay for any activity with a predecessor** (§23 D-03) | **Input / constraint conversion**: `proposed_start` → `START_NO_EARLIER_THAN`, reason `resource_leveling` | **CONVERT** |
| `ScheduleChangeControlService` | `:271-279` | Approval-gated date write; **never recalculates CPM** | **Governed schedule change** — writes constraints; must trigger recalculation | **CONVERT** |
| `ScopeChangeApplicationService` | `:182-183`, `:199-200`, `:213-219` | Approval-gated date write on `new_activity` and `modify_activity`; no recalculation | **Governed schedule change** — writes constraints | **CONVERT** |
| `PlannerWorkspaceService.batchUpdate` | `:119-120` | Accepts `planned_start` / `planned_end` over the API; **no UI caller** | None. The field allow-list loses both | **RETIRE (fields)** |
| `ScheduleContainer.tsx` | `:832-847`; display fallback `:536-538`, `:567-568` | Browser-side date computation, **and** displays `planned_start` as `actual_start` when progress > 0 | None | **RETIRE** |
| `ActivityPlanningGrid.tsx` | `:181-190`, `:208-209`, `:233-234` | Second, divergent browser date algorithm generating `new Date()` dates | None | **RETIRE** |
| `override_start_date` | `ScheduleOrchestrationService:39`, `:145`; `app/api/schedule/calculate/route.ts:49` | Moves an entire event's CPM datum, **unaudited, no reason** | Either retired, or brought under the constraint reason + audit rule | **RETIRE or GOVERN — OD5** |
| `MaterialScheduleIntegrationService` | `:78-158` | **No database write.** In-memory substitution of CPM's `planned_start` input; zero callers | **External constraint**, emitted as a category-1 constraint row — or deleted | **CONVERT or RETIRE — OD8** |
| `ScenarioDomainService` / `ScenarioActivityOverride` | `schema:5847-5849` | Writes the scenario's **own** columns, not `Activity` | **Scenario proposal** | **KEEP as-is** |
| `ScenarioPlanningService.promoteScenario` | `:214-276` | Creates a `ScheduleChangeRequest`; **does not touch `Activity`** | **Governed schedule change** — already correct | **KEEP** |
| `SchedulingService.calculateProjectSchedule` | `:97`, `:167` | A complete working-day CPM path with **zero callers** | None — a second CPM engine | **RETIRE** (harvest calendar logic, §10A) |
| **M11 `ScheduleOrchestrationService`** | `:74-75`, `:105-106`, `:285` | **Writes `early_*` / `late_*` / float / `is_critical` only — never `planned_*`** | **THE SOLE WRITER of `planned_*`** | **EXTEND** |

**No current writer remains a second planned-date authority under this contract.** Every row
above resolves to conversion, retirement, or the single authority.

### 5.3 Preserved: the recalculation boundary

The one chain, unchanged and not to be duplicated:

```
change → enqueueEventScheduleRecalculate (Event-scoped, tenant-checked, fails closed)
       → BullMQ "schedule-recalculate"
       → scheduleRecalculateWorker (rejects missing eventId / orgId)
       → ScheduleOrchestrationService.calculateEventSchedule
       → CalendarEngine → calculateSchedule
       → single-transaction persistence
```

Every mutation that can change a schedule **must** enter through this path — including
**constraint removal** (§8.5) and **Event window change** (§6.5).

### 5.4 Actual dates — M12 boundary preserved verbatim

**M12 is CLOSED GREEN and is not reopened.**

- `actual_start` / `actual_end` are written **only** by `ExecutionWriteService`, **only** from
  `executionDate`, with `ProgressLog` / `AuditLog` provenance, feeding M8.13.
- **No planned date may ever be copied into an actual date.** The historical violation
  (`ExecutionWriteService:302-303`) is fixed and closed.
- The `@db.Date` → `timestamptz` change on `actual_*` is a **schema concern only** (§17). It
  confers no new authority and changes no writer.
- `ScheduleContainer.tsx:536-538` displaying `planned_start` as `actual_start` is a **presentation
  defect** (D-06), not an authority breach, and is a C2 UI fix.

---

## 6. Event Window Contract

### 6.1 The freeze

`Event.planned_start` and `Event.planned_end` are the **authored campaign / turnaround commitment
window** — the single carrier of "when this work is *required*", as distinct from "when it is
*scheduled*" (§7) and "whether planning is *complete*" (§13).

M11 **must** consume:

```
project_start_date  ←  Event.planned_start      (wired today: ScheduleOrchestrationService:144-146)
target_finish_date  ←  Event.planned_end        (NOT wired today — the highest-value fix in R1.0)
```

### 6.2 The window is a backward-pass datum, not a forward clamp

| Role | Verdict | Consequence |
|---|---|---|
| Hard forward clamp on activity starts | ❌ **No** | A clamp would make an over-running plan *unrepresentable*, hiding the very overrun the window exists to reveal |
| **Backward-pass datum** (`target_finish_date`) | ✅ **Yes** | `late_*` is computed against the commitment, so **negative float becomes reachable** |
| Management KPI boundary | ✅ Yes | The correct basis for "overdue", replacing the permanently empty Workpack column |
| Reporting / baseline boundary | ✅ Yes | Already captured as `project_start` / `project_finish` |
| Readiness boundary | ⚠️ Indirect only | Via negative float; never as a separate M10 check |

**Why this matters, measured:** today `baseLateFinishOffset = maxProjectFinishOffset`, so float is
self-referential — the critical path always has exactly zero float and **an overrun is
arithmetically invisible**. Executed corroboration: 3 live activities already start before their
event window opens and 3 finish after it closes, and nothing flagged them [EXECUTED, D10 §10.3].

### 6.3 Null handling — frozen

| Condition | Rule |
|---|---|
| `Event.planned_start` IS NULL | **CPM must refuse to calculate** and emit `MISSING_PROJECT_START`. The current fallback `?? new Date()` (`ScheduleOrchestrationService:146`) is **prohibited** — it silently anchors an entire campaign to the moment the job ran. **Defect D-05.** |
| `Event.planned_end` IS NULL | **CPM proceeds**, `target_finish_date` is not supplied, and the backward pass falls back to `maxProjectFinishOffset` **with an explicit `NO_TARGET_FINISH` warning** so that zero-float results are not mistaken for on-time results |
| May a schedule exist without an Event window? | **A schedule may exist without `planned_end`. It may NOT exist without `planned_start`** — there is no defensible zero point, and inventing one fabricates every date downstream |
| Both NULL | No schedule. `planningState` cannot reach `SCHEDULED` |

**Asymmetry justified:** the start is a *datum* (arithmetic is impossible without it); the finish
is a *comparator* (its absence loses a signal but corrupts nothing).

### 6.4 Overrun and negative float — frozen

| Concept | Definition |
|---|---|
| **Overrun** | `MAX(Activity.planned_end) > Event.planned_end`. Expressed as **negative total float** on the driving path, never as a separate stored "overrun" field |
| **Negative float** | `late_finish − early_finish < 0`, i.e. the activity must finish earlier than logic permits to meet the commitment. Unit: **hours** (canonical, `schema.prisma:43`) |
| **Float sign convention** | Negative = behind the commitment. Zero = exactly critical. Positive = slack |
| **Prohibited** | Clamping float at zero; computing float against `MAX(planned_end)` instead of the commitment; storing a duplicate "days late" column |

`free_float`'s unit remains **undocumented** in the schema (`Float?`, `schema.prisma:49`) —
defect **D-13**, and it must be declared as hours in C2 to match `total_float`.

### 6.5 Event window change → recalculation — frozen

A change to `Event.planned_start` or `planned_end` **must** enqueue
`enqueueEventScheduleRecalculate` for that event. It is the only input whose change invalidates
*every* activity date in the campaign simultaneously.

**Today it does not.** `EventPlanningService.updateEvent` (`:173-178`) writes the window and
enqueues nothing — so every date in the campaign silently goes stale. **Defect D-09**, part of
blocker B5.

### 6.6 How reports and Control Tower interpret it

| Consumer | Rule |
|---|---|
| M13 Control Tower | Reads Activity `planned_*` and the Event window. Compares them. **Writes neither** |
| M14 reporting | The Event window is the campaign header and the overdue basis. The **derived span** (§7) is the workpack-level bar |
| MS Project export | Project `<StartDate>` / `<FinishDate>` ← **Event window**. The current `now()` fallback (D-02) is removed |
| Portfolio "overdue" | Re-based on Event window vs derived span. It becomes functional for the first time — today it reads a column empty in 199/199 rows |

**No workpack-level commitment date may be created** (§7.1).

---

## 7. Workpack Schedule Span Contract

### 7.1 The freeze — retirement is absolute

> **`Workpack.planned_start_date` and `Workpack.planned_end_date` are RETIRED.**

They must **NOT** be renamed to another authored window · repurposed · used as planner input ·
used as an implicit SNET · used as the MS Project project window · used as a commitment · used as
a readiness authority.

**Migration risk: zero.** 0 of 199 rows populated [EXECUTED].

Replacement, on `Workpack`:

```
schedule_start    -- derived, M11-written, read-only
schedule_finish   -- derived, M11-written, read-only
```

Displayed as **"Schedule Start" / "Schedule Finish"**. Deliberately **not** named `planned_*`, so
the five-semantic conflation cannot silently reassemble.

### 7.2 The exact inclusion rule — frozen

This is the item §10 of the instruction requires to be explicit rather than implicit. The span
answers exactly one question: **"across the work that is in scope for this workpack, when does the
calculated schedule begin and end?"**

`ActivityStatus` has **eight** members in `prisma/schema.prisma:3026-3035` — but **only five exist in
the live database enum** (§7.2.1). Every declared member is dispositioned, because the span rule must
survive the enum reconciliation:

| Status | In the span? | Reason |
|---|---|---|
| `not_started` | ✅ **INCLUDE** | Scheduled future work. 58 of 72 live rows |
| `released` | ✅ **INCLUDE** | Scheduled, authorised work |
| `in_progress` | ✅ **INCLUDE** | Work is running. 7 live rows |
| `completed` | ✅ **INCLUDE** | It happened; its dates are part of when the workpack ran. 7 live rows |
| `verified` | ✅ **INCLUDE** | Completed and checked — still part of the span |
| `closed` | ✅ **INCLUDE** | Administratively closed; the work still occurred |
| `on_hold` | ✅ **INCLUDE** | **Paused, not descoped.** Excluding it would shrink the span and hide work that is still owed |
| `cancelled` | ❌ **EXCLUDE** | Descoped. This work will not happen, so it does not define when the workpack runs |
| `status IS NULL` | ✅ **INCLUDE** | The column is nullable with default `not_started`; a NULL status is an unclassified live activity, not a cancelled one |
| `deleted_at IS NOT NULL` | ❌ **EXCLUDE** | Soft-deleted rows are not scope |

**Normative predicate.** Because `status` is nullable, the rule must be expressed in
three-valued-logic-safe form. A bare `status <> 'cancelled'` **silently drops every NULL-status
row**, since `NULL <> 'cancelled'` evaluates to `NULL`:

```sql
WHERE workpack_id = :id
  AND deleted_at IS NULL
  AND (status IS NULL OR status <> 'cancelled')
```

Any ORM expression of this rule **must be verified to emit the `IS NULL` branch.** [SOURCE —
`schema.prisma:30`]

**The rule is not new — it already exists in M8.13.** `ProgressCalculationService.isActivityIncluded`
is exactly this predicate:

```47:48:src/core/progress/ProgressCalculationService.ts
export function isActivityIncluded(activity: ProgressActivityInput): boolean {
  return activity.status !== 'cancelled';
```

**The span rule therefore adopts the progress authority's existing definition rather than inventing a
new one** — and note that in TypeScript `null !== 'cancelled'` is `true`, so the JavaScript form
already includes NULL-status rows. It is only the **SQL** form that needs the explicit `IS NULL`
branch. That asymmetry is the whole hazard.

### 7.2.1 🔴 NEW BLOCKER **B8** — the live enum has FIVE values, and M12 writes three that do not exist

| Source | Members | Class |
|---|---|---|
| `prisma/schema.prisma:3026-3035` | `not_started`, `released`, `in_progress`, `completed`, `on_hold`, `verified`, `closed`, `cancelled` — **8** | [SOURCE] |
| Baseline migration `20260226000000_baseline/migration.sql:11` | `not_started`, `in_progress`, `completed`, `on_hold`, `cancelled` — **5** | [SOURCE] |
| **Live PostgreSQL enum** | `not_started`, `in_progress`, `completed`, `on_hold`, `cancelled` — **5** | **[EXECUTED]** via `pg_enum` |

**`released`, `verified` and `closed` are declared in Prisma and absent from the database.** Yet
`ExecutionWriteService` writes all three:

| Action | Value written | Location |
|---|---|---|
| `RELEASE` | `'released'` | `ExecutionWriteService.ts:255` |
| `VERIFY` | `'verified'` | `:312` |
| `CLOSE` | `'closed'` | `:320` |

> **Three M12 execution actions therefore fail at the database today.** [EXECUTED enum + SOURCE
> writers; the failure itself is **[INFERENCE]** — strong, from an unstorable value, not observed]

**This is the third instance of one defect class, and the mirror image of the other two:**

| Blocker | Direction of drift |
|---|---|
| **B1** | Prisma declares **columns** the database lacks (`project_id`, `schedule_source`) |
| **B7 / OD9** | The database holds **tables** Prisma no longer declares (4 models) |
| **B8 (new)** | Prisma declares **enum values** the database lacks (3 members) |

**This does NOT reopen M12.** M12's authority decision — `ExecutionWriteService` as the sole writer of
execution facts — is GREEN and untouched. B8 is schema drift breaking M12's *writes*, exactly as B1
breaks `ActivityCreationCommand`'s writes. It is an infrastructure blocker, not a semantic question,
and it belongs to gate **G3** alongside B1. Defect **D-41**.

**Consequence for this contract:** the span rule above disposes all **eight** declared members so
that it remains correct whichever way the enum is reconciled. C2 must decide explicitly whether to
**add the three missing values** to the database (the reading consistent with `ExecutionWriteService`
being live and correct) or **remove them from Prisma** (which would break three shipped execution
actions). The evidence favours adding them.

### 7.2.2 The `cancelled` row — reconciled, and the exclusion has zero live impact

| Fact | Value | Class |
|---|---|---|
| Total `"Activity"` rows | **73** | [EXECUTED] |
| `deleted_at IS NOT NULL` | **1** | [EXECUTED] |
| Status distribution | `not_started` 58 · `in_progress` 7 · `completed` 7 · **`cancelled` 1** | [EXECUTED] |
| Live rows (`deleted_at IS NULL`) | **72** = 58 + 7 + 7 | [EXECUTED, D8 §3.5] |

58 + 7 + 7 = 72 live rows, and 72 + 1 = 73 total. **The single `cancelled` row is therefore the single
soft-deleted row** — it is already excluded by `deleted_at IS NULL`. [INFERENCE — arithmetic
reconciliation of two executed censuses, not a direct per-row query]

**So the cancelled-exclusion clause has zero impact on live data today**, exactly as D8 predicted,
but for a sharper reason than "no cancelled rows exist": one exists, and it is already gone.

**And no application code writes it.** `status: 'cancelled'` has **no writer** in `src/**` or `app/**`
[SOURCE — proven absence]; the bulk/API path explicitly **refuses** it
(`executionFieldGuard.ts:74-77` has no `cancelled` case and returns an error by default), while the UI
still offers it as an option (`ActivitiesPanel.tsx:57`, `ScheduleContainer.tsx:1828`). The row's origin
is **not attributable to current code** — legacy seed, manual SQL, or a removed path. Defect **D-42**
(UI offers a status the API rejects). One path could still propagate it:
`ProjectBranchingService.ts:47-49` clones with `...actData`, copying whatever status the source had.

### 7.2.3 Four competing "active activity" definitions exist today

The codebase does **not** enforce one definition. This contract's rule must therefore be named as
*the* rule for the span, while acknowledging that some other filters are legitimately asking
different questions:

| Variant | Filter | Used by | Verdict |
|---|---|---|---|
| **A** | `deleted_at: null` only | **CPM** (`ScheduleOrchestrationService.ts:94-99`), the `date-range` aggregate, progress loaders, lookahead, S-curve | Correct for **CPM** — a cancelled activity must still be scheduled out before it is descoped |
| **B** | `deleted_at: null` + exclude `cancelled` | **M8.13 progress** (`ProgressCalculationService.ts:47-48`), `FieldExecutionService.ts:404`, resource planning/levelling/constraints, `M16EntityResolver.ts:172` | ✅ **THE SPAN RULE** (§7.2) |
| **C** | `deleted_at: null` + `status notIn ['cancelled','completed']` | Control Tower (`ControlTowerQueryService.ts:122`) | Legitimate — it asks *"what is still open?"*, a different question |
| **D** | `deleted_at: null` + `status not 'completed'` | WhatsApp (`QueryHandler.ts:123`) | Legitimate — "my remaining jobs" |

**Frozen:** the workpack schedule span uses **variant B**. Variants C and D are **not** span rules and
must not be re-pointed at the span. **Variant A remains correct for CPM** — the engine schedules every
non-deleted activity, and that is deliberate. One genuine defect surfaced here:
`JobCompletionService.ts:20` filters `NOT: { status: 'completed' }` with **no `deleted_at` filter at
all**, so it counts soft-deleted activities (**D-43**, P2).

**Further inclusion decisions:**

| Question | Decision | Basis |
|---|---|---|
| `is_optional` activities | ✅ **INCLUDE** | Optional is still scope until descoped. False on all 72 rows, so zero impact |
| Zero-duration activities / milestones | ✅ **INCLUDE** | `duration_hours` defaults to `0` (`schema.prisma:23`), so zero duration is the *default*, not an exception, and **6 live rows have `duration_hours = 0`** [EXECUTED]. The engine already handles them (`scheduleEngine.ts:144-145` → `durDays = 0`). A boundary milestone legitimately defines a span edge. **No `is_milestone`, `milestone`, `zero_duration` or `activity_type` column exists** on `Activity` [SOURCE — proven absence]; `standard_activity_type_id` is a classification FK, NULL on 72 of 73 rows [EXECUTED], not a milestone flag |
| Activities with NULL dates | Naturally excluded from that bound by `MIN`/`MAX` — **not** from the workpack |
| Cross-workpack activities | Not applicable — all 20 live relationships are intra-workpack and intra-event [EXECUTED]. The rule is per-`workpack_id` regardless |

⚠️ **A fourth instance of the B1 defect class, found here:**
`src/core/report-engine/providers/PlanningIntelligenceProviders.ts:231` queries
**`is_milestone: true`** on `Activity` — a column that exists in neither Prisma nor the database.
**That provider throws at runtime if invoked.** Defect **D-44**, P1, same class as B1/B7/B8. Recorded
because a reader could otherwise conclude a milestone flag exists.

### 7.3 Each bound is computed independently — frozen

```
schedule_start  = MIN(planned_start)  over the included set, NULL if none has one
schedule_finish = MAX(planned_end)    over the included set, NULL if none has one
```

**The two halves may resolve over different subsets, and a half-open span is a legal state.**
Executed today: of 17 workpacks with activities, a rollup yields a start for **13** and a finish
for only **8** [EXECUTED, D8 §3.5]. This asymmetry disappears once M11 writes both dates for every
activity, but the contract must tolerate it during transition rather than fabricating the missing
bound.

**Empty workpack → both NULL.** 182 of 199 workpacks (91 %) have zero activities. NULL is the
correct, honest answer; it must never be filled with `now()`, the Event window, or a zero date.

### 7.4 Storage: materialised, written only by M11

| Option | Verdict |
|---|---|
| Materialised columns on `Workpack`, written in the CPM transaction | ✅ **RECOMMENDED** — one query cost at write, cheap reads for Gantt/list/grid/report, and the value is transactionally consistent with the Activity dates it derives from |
| Computed on read | ⚠️ Acceptable and equally correct semantically, but forces an aggregate into every list and report query |

Either way: **read-only to every consumer, and never present in any PATCH allow-list.**

---

## 8. Constraint Contract

### 8.1 The canonical carrier — frozen

Columns on `Activity`, one constraint per activity:

```
constraint_type     ScheduleConstraintType?              -- NULL = unconstrained
constraint_date     DateTime?  @db.Timestamptz(3)
constraint_reason   String?                              -- MANDATORY when type is set
constraint_set_by   String?    @db.Uuid
constraint_set_at   DateTime?  @db.Timestamptz(3)
```

`organization_id` and `event_id` are **inherited from `Activity`** — duplicating them would create
a second tenancy truth.

**Cardinality: one per activity** (P6's model). A child table is a clean additive migration if
genuine multi-constraint demand ever appears; building it now would be speculative generality.

**Change-request linkage:** where a constraint originates from a governed change, `constraint_reason`
carries the `ScheduleChangeRequest` id and the audit entry references it. **No new FK column is
required** — evidence for a dedicated reference field is absent, and §4's rule forbids adding
fields on plausibility.

### 8.2 Permitted types — frozen at TWO

```
enum ScheduleConstraintType {
  START_NO_EARLIER_THAN
  FINISH_NO_LATER_THAN
}
```

The enum name is **deliberately distinct** from the existing `ConstraintType`
(`schema.prisma:3101-3113`), which is an *issue register* whose members are causes of delay
(`material`, `permit`, `scaffold`, …). **The two must never be collided or merged.**

| Type | Verdict | Evidence |
|---|---|---|
| `START_NO_EARLIER_THAN` | ✅ **PERMITTED** | Three independent expressions already exist: CPM treats `planned_start` as exactly this for 45 activities (`scheduleEngine.ts:251-262`); `MaterialScheduleIntegrationService:93` computes `max(planned_start, constraintDate)`; `early_start_constraint` was declared for it [SOURCE] |
| `FINISH_NO_LATER_THAN` | ✅ **PERMITTED** | The engine already accepts `target_finish_date` (`:36`, `:301-307`) with no caller, and `Event.planned_end` is authored on 49/51 events with nothing consuming it [SOURCE] |
| `MUST_START_ON` | ❌ **NOT IMPLEMENTED** | No column, no API, no UI, no data, no test. An exhaustive search for `must_start` returns **matches only in documentation** [SOURCE — proven absence]. Per §4 of the instruction, the default stands: **not implemented** |
| `MUST_FINISH_ON` | ❌ **NOT IMPLEMENTED** | Same absence, same rule |

**A fixed date remains expressible** as SNET + FNLT on the same instant, so no capability is lost,
and adding either type later is purely additive.

### 8.3 The calculation rule — frozen (conceptual, §5 of the instruction)

For each activity, in this **normative order**:

```
1.  derived predecessor date   (dependency type + predecessor's calculated date)
2.  + relationship lag         (signed elapsed wall-clock minutes)
3.  → calendar snap            (advance a start to the next working period)
4.  → apply constraint         (SNET raises a start; FNLT bounds a finish)
5.  → apply duration           (consumed through working time)
        ⇒ calculated planned date
```

**The order must not be rearranged.** Applying the calendar before the lag, or the constraint
before the calendar snap, produces different dates. The constraint remains a **separately stored
fact** at every step.

Worked example, exactly as §5 of the instruction requires:

| Step | Value |
|---|---|
| A finishes | 10-Apr-2027 10:00 |
| B relationship | FS + 0 |
| B derived start | 10-Apr-2027 10:00 |
| B constraint | `START_NO_EARLIER_THAN` @ 10-Apr-2027 14:00, with reason and author |
| **B `planned_start`** | `max(10:00, 14:00)` = **10-Apr-2027 14:00** |
| **What is stored** | `planned_start = 14:00` (M11-written) **and** `constraint_date = 14:00` (planner-written, with reason) — **two facts, two columns, two authorities** |
| **What is never stored** | `planned_start = 14:00` with no record of why |

> **The value 14:00 must NOT erase the reason that it is 14:00.**

Two consequences that only Pattern 1 delivers: removing the constraint returns `planned_start` to
**10:00** automatically; and if A slips to finish 16:00, the result becomes `max(16:00, 14:00)` =
**16:00** — the constraint stops binding but remains recorded.

### 8.4 Conflict handling — frozen

| Situation | Rule |
|---|---|
| Constraint conflicts with dependency logic | **The dependency-driven date wins**, and the engine raises `CONSTRAINT_NOT_SATISFIED` in its existing `warnings[]` channel (precedent: `NEGATIVE_FLOAT` at `scheduleEngine.ts:379-384`) |
| Constraint conflicts with the Event window | Surfaces as negative float. No separate error |
| Constraint is satisfied trivially | No warning. It remains recorded and inert |
| Constraint on an activity with no predecessor | This is the **primary** case — it replaces `planned_start` as the seed (§5.1) |

### 8.5 Lifecycle — frozen

| Aspect | Rule |
|---|---|
| Who may set | Any principal with existing schedule-edit permission (`nav.schedule` / planner). **No new permission tier** — the constraint replaces an edit these users can already perform |
| Reason | **Mandatory.** `constraint_reason` non-empty, enforced at the service boundary |
| Approval | **Not required for a single constraint** (this product does not gate inputs — `duration_hours` needs none). **Required for bulk / scenario application**, via the existing `ScheduleChangeRequest` flow |
| Audit | **Mandatory** — in-row `constraint_set_by` / `constraint_set_at`, **plus** an `AuditLog` entry (`CONSTRAINT_SET` / `CONSTRAINT_CLEARED`) reusing the shipped `old_values` / `new_values` shape |
| Expiry | **None.** A constraint persists until explicitly removed. An auto-expiring bound that silently stops applying is a worse failure than one a planner must clear |
| Soft constraints | **Not supported.** All constraints are hard: they move the date or they warn |
| Removal | Permitted, audited, **and must enqueue recalculation** — otherwise the schedule silently retains a bound that no longer exists |
| Survives recalculation | ✅ **Yes, by construction** — it is re-read as input on every run |

### 8.6 Prohibited, explicitly

Editing `planned_start` as the definition of an override · a second date column that CPM reads ·
an unaudited constraint · a constraint written by a background service without attribution · a
constraint stored on `Workpack` or `Event` (wrong granularity — §7.1, §6.1) · reusing
`ScenarioActivityOverride.early_start_constraint` (dead schema) · reusing `Activity.window` (dead,
name-collision hazard).

---

## 9. Negative Lag Contract

### 9.1 The freeze — D9 unchanged

```
canonical lag = ActivityRelationship.lag_minutes  INTEGER NOT NULL DEFAULT 0, SIGNED
```

Replaces `lag_days`. **D9 is GREEN and is not reopened.**

| Case | Meaning | Permitted |
|---|---|---|
| **Positive** | A delay: successor waits after the dependency is met | ✅ |
| **Zero** | No delay; the default | ✅ |
| **Negative** | A lead / overlap: `FS − 480` means B may start 8 h before A finishes | ✅ **Permitted** |

**Why negative is permitted:** overlap is standard turnaround practice (begin insulation stripping
before scaffolding completes). Prohibiting it removes real capability and pushes planners into
fabricating dependencies.

### 9.2 Conversion rules — the distinction that must be preserved

Two things that look alike and must never be merged:

| | **CURRENT CORPUS CONVERSION** | **FUTURE AUTHORING** |
|---|---|---|
| Rule | `lag_minutes = legacy lag_days × 1440` | The planner explicitly chooses the value; the unit is always minutes |
| What it preserves | **The CPM engine's current reading, exactly** — proven by `hours_per_day` invariance across 8, 10 and 24 [EXECUTED, D9 §5.3] | The author's actual intent, captured unambiguously at entry |
| What it does **not** preserve | **Original author intent.** It cannot | — |

> **`× 1440` does NOT recover historical author intent.** Stored values were authored under three
> mutually inconsistent factors (÷8 via the predecessor API, ÷24 via templates, ÷hoursPerDay via
> MS Project import). `× 1440` faithfully reproduces *what the engine computes*, which is the only
> coherent invariant available — and for the six live rows the two coincide, because all 20
> relationships have `created_by = NULL` and none was written by a converting path [EXECUTED,
> D9 §6.3]. **This must be stated in the migration record, not glossed.**

`lag_days × hours_per_day × 60` is **explicitly rejected** — it would change every computed date.

### 9.3 Boundary conversions — one internal unit, named conversions only at the edges

| Layer | Unit | Rule |
|---|---|---|
| **Storage** | minutes, signed int | The single source of truth |
| **Engine** | minutes | `calculateSchedule` takes `lag_minutes`; no day conversion |
| **API** | minutes | Field named `lag_minutes`. **No `lag_days`, no `lag_hours`** |
| **UI** | minutes internally | Hours/days for **display only**. Editing writes minutes |
| **Import** | minutes | Each parser converts explicitly and by name, e.g. `xerLagDaysToMinutes(v, sourceHoursPerDay)` |
| **Export** | the target format's unit | Each formatter converts from minutes explicitly **and records the factor it used** |

The six divergent factors in current code (÷8, ÷24, ÷hoursPerDay on write; raw, ×8, ×10, ×24 on
read) are all removed. **Prohibited:** any implicit conversion; any second lag field; retaining
`lag_days` alongside `lag_minutes`; keeping `workpack_template_logic_links.lag_hours` (`double
precision`, 0 rows) as a second authority — it converts to minutes in the same migration.

### 9.4 Validation — frozen

| Rule | Detail |
|---|---|
| Type | Integer minutes. **Fractional input is rejected at the API boundary with a 4xx**, never coerced |
| Range | Signed. No artificial magnitude cap |
| Sub-day | ✅ Fully supported at 1-minute granularity — this is the defect `lag_minutes` exists to fix |
| Current behaviour being replaced | `lagHoursToDays(4) = 0.5` reaches an `integer` column and **PostgreSQL** rejects it with `22P02`, producing an HTTP 500. Prisma does **not** validate it [EXECUTED, D9 §7]. Loud failure, no corrupt data — but sub-day lag is unusable today |

### 9.5 CPM calculation and the clamp — frozen, and the silence is a defect

| Element | Rule |
|---|---|
| Application | Lag is added as **elapsed wall-clock** minutes at step 2 of §8.3. **Never calendar-adjusted** |
| Boundary rule | A computed start may not precede the project datum (`Event.planned_start`). **The clamp is retained as policy** |
| **Required change** | The clamp **must emit `LAG_CLAMPED_AT_PROJECT_START`**, carrying activity, requested offset and applied offset, in the same `warnings[]` channel as `NEGATIVE_FLOAT` |
| **Prohibited** | The current behaviour — silent truncation. Lags of −1, −2 and −5 all produce offset 0 with **no signal** [EXECUTED, D9 §5.4] |

> **The current clamp behaviour is NOT silently preserved.** Per §6 of the instruction: the clamp
> survives as *policy*; its **silence is a defect**. `scheduleEngine.test.ts:184` encodes the silent
> clamp and **must be updated to assert the warning**. That is a contract change, not a test fix.

Two further engine defects sit on the same arithmetic and must be fixed with it: fractional lag
leaks into `total_duration_days` while being erased from dates by `.slice(0, 10)` (D-11), and free
float is computed with FS semantics for **every** relationship type (D-12).

---

## 10. Calendar Contract

**Semantics only. C1 defines; C4 implements. Nothing is built here.**

### 10.1 Ownership — frozen

| Aspect | Owner |
|---|---|
| **The calendar authority** | **`CalendarEngine`** — the single calendar implementation. Already partially wired to M11 (`getHoursPerDay`) |
| Working-time configuration | `ScheduleCalendar` (days, hours/day, exceptions) refined by `ShiftDefinition` (within-day windows) |
| Who applies it | **M11 only**, inside `calculateSchedule` |
| Who may create another | **Nobody.** §25 forbids it |

### 10.2 The definitions — frozen

The complete carrier, verified [SOURCE]:

```1429:1439:prisma/schema.prisma
model ScheduleCalendar {
  id              String   @id @db.Uuid
  organization_id String   @db.Uuid
  name            String
  work_days       Int[]
  hours_per_day   Float    @default(10)
  exceptions      Json     @default("[]")
  is_default      Boolean  @default(false)
  created_at      DateTime @default(now())
  events          Event[]
}
```

| Concept | Definition | Carrier |
|---|---|---|
| **Working day** | A calendar date on which work may occur | `ScheduleCalendar.work_days Int[]` — **ISO weekday integers, 1 = Monday … 7 = Sunday** (`CalendarEngine.ts:4-5`) |
| **Working hours** | Hours of work available on a working day | `ScheduleCalendar.hours_per_day Float @default(10)`, refined by shifts |
| **Shift** | A within-day window (`start_time` → `end_time`, `is_active`) | `ShiftDefinition` — **6 live rows**: Day 06:00→18:00, Night 18:00→06:00. **No shift fields exist on `ScheduleCalendar`** |
| **Exception** | A date-specific override of `work_days`, shaped `{ date, type }` where **`type` is `holiday` OR `work`** (`CalendarEngine.ts:7-9, 15, 24-25`) | `ScheduleCalendar.exceptions Json` |
| **Holiday** | An exception with `type: 'holiday'`. **Not a separate model** — a second carrier for one concept is forbidden | `ScheduleCalendar.exceptions` |
| **Working exception** | An exception with `type: 'work'` — **makes a normally non-working day working.** Required for turnarounds, where a shutdown routinely runs through a weekend | `ScheduleCalendar.exceptions` |
| **Timezone** | The operational timezone in which working days and shift times are interpreted | §17 |

**The exception mechanism is bidirectional and that is a genuine capability**, not an accident: C4 must
preserve both directions. A holiday calendar that could only *remove* working days would be unable to
express a weekend shutdown push.

**Proven absences** [SOURCE]: there is **no** `Calendar`, `WorkCalendar`, `CalendarException`,
`Holiday`, `NonWorkingDay` or `WorkingHours` model, and **no** `working_days` / `workdays` identifier
anywhere in the repository. `ScheduleCalendar` is the only calendar model. `shift_reports`
(`schema.prisma:2511-2536`) records operational shift *reports* and is **not** a working-time calendar;
`bre_escalation_chains.holiday_calendar` (`:5381`) is a BRE escalation JSON blob, not a schedule
calendar. Neither may be repurposed.

### 10.3 Inheritance — frozen

```
Organization default calendar
        ↓  (overridden by)
Event.calendar_id
        ↓  (refined by)
ShiftDefinition rows for that Event
        ↓  (applied to)
every Activity in the Event
```

| Relationship | Rule |
|---|---|
| **Event → calendar** | An Event resolves exactly one calendar. This is the existing three-tier fallback (`ScheduleOrchestrationService:90-91`, `:354-387`) |
| **Activity → calendar** | **Inherited from its Event. No per-activity calendar.** ✅ **Confirmed as already-the-state:** `calendar_id` exists **only** on `Event` (`schema.prisma:2023`, relation `:2041`); `Activity`, `Workpack` and `Resource` have **no** calendar field or relation [SOURCE — proven absence]. Per-activity calendars are also the single largest source of unexplainable P6 schedules. This decision **adds no column** |
| **Resource → calendar** | **Not in scope for C4.** `ResourceCapacity` constrains *levelling*, not CPM dates (§4.3b) |
| Fallback when no record exists | The hard-coded Mon–Sat / 10 h fallback is retained **only** as a last resort and **must warn**. `ScheduleCalendar` has **0 rows**, so today the fallback governs every calculation while `ShiftDefinition` declares 2 × 12 h — **the working-time truth and the working-time input to CPM are different things** (D-15) |

### 10.4 Duration uses WORKING time — frozen

`duration_hours` is a quantity of **work**. Converting it to elapsed time **must** consume only
working periods. An 8-hour task starting Friday 16:00 under a 06:00–18:00 shift finishes Monday,
not Saturday 00:00.

Today it does not: `durDays = durHours / hoursPerDay` then `addDays` multiplies by a flat 24 h
(`scheduleEngine.ts:96-100`). That is C4's core change.

**Two engine behaviours C4 must preserve deliberately or change deliberately** — neither may be
changed by accident:

```144:146:src/core/scheduling/scheduleEngine.ts
  const durDays = durHours === 0
    ? 0
    : Math.max(0.1, durHours / hoursPerDay);
```

| Behaviour | Consequence | C4 requirement |
|---|---|---|
| **Zero duration passes through as 0** | A milestone occupies no time. Correct, and it is why §7.2 can include the 6 zero-duration rows | **PRESERVE** |
| **A `0.1`-day floor on all non-zero durations** | A 0.4-hour task under a 10 h day becomes 0.1 day, not 0.04. Under working-time arithmetic the floor becomes **meaningless or harmful** — it is a guard against a flat-24 h `addDays` collapsing short tasks | **RE-EVALUATE explicitly.** Working-time arithmetic should express short durations in hours, making the floor unnecessary. It must not be carried across silently (**D-50**, P3) |

### 10.4.1 There are FOUR hours-per-day sources, not one

| # | Source | Value | Class |
|---|---|---|---|
| 1 | `ScheduleCalendar.hours_per_day` | `@default(10)` — **0 rows exist** | Intended authority |
| 2 | `CalendarEngine.getHoursPerDay` fallback | **10** | Fallback |
| 3 | `ScheduleForecastService` / its route | **8**, overridable by a **client query parameter** | D-17 |
| 4 | **`ResourceLevelingService.ts:86, 135`** | **hard-coded `HOURS_PER_DAY = 10`**, bypassing `CalendarEngine` entirely | **D-51**, P2 |

**Frozen:** source 1 is the only authority; 2 is a warning-emitting last resort; 3 and 4 are defects.
**C4 must leave exactly one path to hours-per-day** — `CalendarEngine` — and no module may hold its own
constant.

### 10.5 Lag uses WALL-CLOCK time — frozen, and forced

> **`duration ≠ lag`. Activity duration may use the working calendar; relationship lag remains
> elapsed wall-clock time.**

Two independent reasons, and the first is binding:

1. **D9 forces it.** The frozen migration rule `lag_minutes = lag_days × 1440` is only correct if
   lag is elapsed time. Declaring lag to be working-time would invalidate an already-GREEN
   contract and reopen D9. [PRODUCT, constrained by D9]
2. **The domain agrees.** Turnaround lags are physical processes — cool-down, purge, cure,
   pressure-test hold, permit wait. A 24-hour cure is 24 hours; it does not pause on Sunday.

### 10.6 Four concepts that must never merge

| Concept | Unit / type | Calendar-adjusted? |
|---|---|---|
| **Activity duration** | hours of work | ✅ **Yes** — consumed through working periods |
| **Relationship lag** | `lag_minutes`, signed | ❌ **No** — elapsed wall-clock |
| **Constraint date** | `timestamptz` | ❌ **No** — an absolute instant; compared, never shifted |
| **Calendar availability** | working days + shift windows + exceptions | It *is* the calendar |

### 10.7 Constraint × calendar interaction — frozen

| Rule | Detail |
|---|---|
| A constraint date is **never** snapped | It is an absolute instant. Snapping it would silently change what the planner asked for |
| The **calculated start** is snapped | Order per §8.3: calendar snap (step 3) **then** constraint (step 4) |
| SNET falling in non-working time | The constraint is honoured as a lower bound; the *calculated start* advances to the next working period ≥ `constraint_date` |
| FNLT falling in non-working time | Compared as an absolute instant. If the calculated finish exceeds it → negative float, not an error |

### 10.8 Event window × calendar interaction — frozen

| Rule | Detail |
|---|---|
| `Event.planned_start` | The **datum**, used as-is. Not snapped — a campaign begins when the business says it begins |
| `Event.planned_end` | The backward-pass **comparator**, used as-is |
| Non-working days inside the window | Normal. The window is elapsed calendar time; the *work* inside it is calendar-constrained |

### 10.9 Worked example

> A finishes **Friday 18:00**. B is FS + **120 minutes**. Saturday non-working; Monday working.

| Step | Operation | Result |
|---|---|---|
| 1 | Predecessor finish | Friday 18:00 |
| 2 | Lag as **wall-clock** | Friday 18:00 + 120 min = **Friday 20:00** |
| 3 | **Calendar snap** | Friday 20:00 is outside the working window → next working period → **Monday, shift start** |
| 4 | Constraint, if any | `max(Monday shift start, constraint_date)` |
| 5 | Duration through working time | Finish = start + duration consumed across working periods only |

**Honest caveat:** step 3 depends on C4 **and** on OD9. `ScheduleCalendar` has 0 rows, the real
shifts live in `ShiftDefinition`, and that table is currently **unreachable from application
code**. This contract makes the semantics explicit; it does not make them operational.

---

## 10A. Two Existing Calendar Worlds — Reconciled

*(This resolves §8 of the instruction. It is part of the Calendar Contract and is numbered 10A so
that §11 onwards match the §29 required section list exactly.)*

### 10A.1 The framing needs one correction before it can be answered

The instruction contrasts **World A** (`CalendarEngine` + `SchedulingService.calculateProjectSchedule`)
with **World B** (`ScheduleOrchestrationService` + `scheduleEngine`). That grouping conflates two
different kinds of artefact, and the correction determines the answer:

| Artefact | What it is | Actual world | Evidence |
|---|---|---|---|
| **`CalendarEngine`** | A **library** of working-time functions | **Already shared with World B, and more widely than previously recorded.** M11 calls `getHoursPerDay` at `ScheduleOrchestrationService.ts:167`, `:185`, `:235`; and the public accessor **`ScheduleOrchestrationService.resolveWorkingHoursPerDay`** (`:223-236`) exposes it to `ScenarioCalculationService.ts:67-70` **and `DecisionIntelligenceService.ts:336`** | [SOURCE] |
| **`SchedulingService.calculateProjectSchedule`** | A **second CPM engine** that happens to be the only caller of the library's working-day methods | Genuinely World A, and **dead — zero callers** | [SOURCE] |

> **There is only ONE calendar engine already. The duplication is in the *scheduler*, not the
> calendar.**

**Independently confirmed by caller analysis** [SOURCE]: `addWorkingDays` and `hoursToDays` have
exactly two production call sites between them — `SchedulingService.ts:167` and `:97`, both inside
`calculateProjectSchedule`; `isWorkingDay`, `subtractWorkingDays` and `workingDaysBetween` have
**no production callers at all** (tests only); and `SchedulingService` is marked `@deprecated`
at `:5-16` with **every one of its four public methods at zero callers** —
`calculateProjectSchedule`, `generateSCurveData`, `getLookaheadActivities`, `buildCalendar`. The live
S-curve route uses `EvmSnapshotService` instead
(`app/api/events/[eventId]/schedule/evm/s-curve/route.ts:40`). **`ScheduleOrchestrationService` has
two dead public methods of its own** — `getLookaheadActivities` and `generateSCurveData`, both zero
callers (**D-46**, P3 cleanup).

### 10A.2 Recommendation — **OPTION B**, precisely scoped

| Component | Disposition |
|---|---|
| **`CalendarEngine`** | ✅ **RETAIN and EXTEND** as the single calendar authority. It is already M11's calendar dependency. `addWorkingDays`, `hoursToDays`, `isWorkingDay`, `subtractWorkingDays` and `workingDaysBetween` are **proven, tested logic that C4 must consume rather than rewrite** |
| **`SchedulingService.calculateProjectSchedule`** | ❌ **RETIRE.** It is a second CPM engine. Retaining it violates §25's prohibition, and it has no callers to preserve |
| **`ScheduleOrchestrationService` + `scheduleEngine`** | ✅ **THE surviving M11 path.** C4 changes it to consume the full calendar instead of only `hours_per_day` |

**Why not Option A** ("incorporate World A logic into the M11 path"): it reads as though the dead
*scheduler* should be absorbed. It should not — only the *library* it calls is worth keeping, and
that library is already wired in. Option A would preserve a duplicate CPM path.

**Why this is not a rewrite:** the working-day logic C4 needs already exists and is already
correct. C4's task is **connection, not creation** — which is exactly why the instruction's
prohibition on a second calendar engine is well founded.

**Not implemented here.** This is a recommendation with a stated basis, per §8 of the instruction.

---

## 11. Shift / Capacity Contract

### 11.1 Current state — frozen as fact, and it is a runtime break

| Carrier | Rows in DB | Prisma model | Consequence |
|---|---:|---|---|
| `ShiftDefinition` | **6** — Day 06:00→18:00, Night 18:00→06:00, across 3 events | ❌ **ABSENT** | `prisma.shiftDefinition.*` **throws at runtime** |
| `ResourceCapacity` | **30** | ❌ **ABSENT** | `prisma.resourceCapacity.*` **throws at runtime** |
| `workpack_asset_snapshots` | **2** | ❌ **ABSENT** | — |

`src/core/resources/ResourcePlanningService.ts` calls the first two at **fifteen** sites (`:49`,
`:65`, `:78`, `:83`, `:94`, `:105`, `:128`, `:173`, `:182`, `:194`, `:203`, `:223`, `:228`, `:238`,
`:243`). A case-insensitive search of `prisma/schema.prisma` for `ShiftDefinition`,
`ResourceCapacity`, `shift_definitions`, `resource_capacity`, `workpack_asset_snapshots` and
`WorkpackAssetSnapshot` returns **no matches** [SOURCE].

### 11.1.1 The mechanism of the loss — now established

**The tables were created by a migration that is still in the repository:**
`prisma/migrations/20260829000000_add_resource_planning/migration.sql:111-146` declares both
`ShiftDefinition` (`shift_name`, `start_time TEXT`, `end_time TEXT`, `event_id`, …) and
`ResourceCapacity` (`target_date DATE`, `capacity_limit`, `shift_id`, …) [SOURCE].

> **So the models were never "forgotten" from the database — they were dropped from
> `schema.prisma` after the migration ran.** The migration history and the database agree with each
> other; only the schema disagrees with both.

**And the application worked around it rather than fixing it:**
`src/components/planner-workspace/resources/types.ts:1-10` defines **local TypeScript interfaces**
for these entities instead of using generated Prisma types [SOURCE]. That is why the loss went
unnoticed — the UI type-checks against hand-written shapes while the runtime calls a client accessor
that does not exist.

**This makes OD9 unambiguous:** the correct action is **re-declaration to match the existing
migration DDL**, not a fresh design. The authoritative shape is already written down.
Note `target_date` is `DATE` and `start_time` / `end_time` are `TEXT` — both must be preserved as
declared, not "improved" during re-declaration (§11.3, D-38).

### 11.2 The freeze

> **These tables are NOT to be dropped. 38 rows of live configuration depend on it.**

Before any destructive schema migration:

```
1.  Reconcile Prisma with the existing database
2.  RE-DECLARE the models where live data exists
3.  Inspect relations, indexes and constraints against the real tables
4.  PRESERVE every row
5.  ONLY THEN perform time-schema changes
```

**This is OD9.** It is **not implemented** here (§24).

### 11.3 Semantic roles — frozen

| Carrier | Role | May it influence CPM dates? |
|---|---|---|
| `ShiftDefinition` (`start_time`, `end_time`, `is_active`) | **Working-time availability** — the within-day windows work may occupy. Refines `ScheduleCalendar` | ✅ **Yes — via `CalendarEngine` in C4.** It is a calendar input, consumed only by M11 |
| `ResourceCapacity` (`target_date`, `capacity_limit`, `shift_id`) | **External resource constraint** | ❌ **No.** It constrains *levelling*, a post-process. Making it a CPM date input means resource-constrained scheduling — a different algorithm, explicitly prohibited (§25.2) |
| `workpack_asset_snapshots` | Not a time fact. Carried only because it holds live data | ❌ No |

**`start_time` / `end_time` are `text`** in the live table. C2 must decide their canonical form as
part of the re-declaration; a shift window is a time-of-day, not an instant, and must not be
converted to `timestamptz` (**D-38**, P3).

### 11.4 Why this is load-bearing for the time contract

`ShiftDefinition` holds the plant's **real 2 × 12 h working-time truth**, while CPM currently runs
on a hard-coded Mon–Sat / 10 h fallback because `ScheduleCalendar` has **0 rows** (**D-15**). So
today:

> **The working-time truth and the working-time input to CPM are two different things, and the
> truth is the one that is unreachable from application code.**

§10.9 step 3 (the calendar snap) cannot execute until this is resolved. **OD9 is therefore a C4
prerequisite as well as a C2 prerequisite.**

### 11.5 Prohibited

Dropping any of the three tables · re-declaring models without inspecting the live relations and
indexes · treating `ResourceCapacity` as a CPM date input · creating a second shift or capacity
model alongside the existing tables · converting shift times to absolute instants.

---

## 12. Material Availability Contract

### 12.1 Current state — frozen as fact

| Component | State |
|---|---|
| `MaterialScheduleIntegrationService` | **In-memory only. Not a database writer.** `applyConstraints` (`:78-138`) returns a new `ScheduleActivityInput[]`; `integrateForEvent` (`:143`) has **zero callers** [SOURCE] |
| `MaterialConstraint` | `constraint_date`, `earliest_eta`, `is_binding`, `readiness_status`, `impact_days`. **0 rows** |
| `MaterialReadinessService` | **Computes** `constraint_date` from supply-chain data and flags binding constraints (`:213-245`, `:371-433`) |

### 12.2 The target semantic — frozen

> **Material ETA is an EXTERNAL AVAILABILITY CONSTRAINT.** It is *computed* from supply-chain
> data, never authored by a planner.

If it is to affect CPM, the only permitted path is:

```
material availability  →  governed constraint (category 1, attributed)  →  M11
```

Explicitly **NOT**:

```
material service  →  Activity.planned_start          ← PROHIBITED
material service  →  CPM's in-memory input, silently ← PROHIBITED (current design)
```

### 12.3 Why the current design is prohibited even though it writes nothing

`MaterialScheduleIntegrationService` is the closest thing in the codebase to a correct Pattern-1
mechanism — a constraint applied as CPM *input*. But it is built against the wrong carrier and
must not be wired as it stands:

1. It substitutes `planned_start`, which only works **because that column is currently the
   implicit SNET seed** — the very coupling this contract removes.
2. The adjustment is **invisible**: no audit, no attribution, nothing on screen explaining why a
   date moved.
3. It truncates to date-only (`.slice(0, 10)`, `:108`), discarding time precision.

**An invisible input adjustment is no better than an invisible write.**

### 12.4 Readiness-only, CPM constraint, or both — the frozen part and the open part

| Question | Answer |
|---|---|
| Is material availability currently a **readiness** input? | ✅ **Yes**, and that is a defensible endpoint |
| Should it **also** become a CPM constraint? | **OD8 — OPEN.** A supplier slipping would then silently move the plan. That is a real capability change requiring a product decision |
| **If** OD8 says yes, how? | **Only** by materialising a category-1 constraint row with `constraint_set_by = 'system:material'`, so it is visible and attributable |
| Is there a single authoritative material fact? | ✅ **Yes — `MaterialConstraint`, computed by `MaterialReadinessService`.** One carrier, one writer, under both branches of OD8 |
| Who writes the final calculated date? | **M11, unconditionally, under every branch of OD8** |

**Frozen regardless of OD8:** `MaterialScheduleIntegrationService` must be **rewritten to emit
category-1 constraints or deleted.** It may not be wired in its present form.

---

## 13. Readiness Contract

### 13.1 The freeze

> **M10 owns readiness EVALUATION. M10 is never a schedule authority and never writes a date.**

The retired test:

```
execution_calendar = !!Workpack.planned_start_date && !!Workpack.planned_end_date
```

is **prohibited**. It is a duplicate-date presence test on columns that are empty in 199 of 199
rows, and it is **circular** — it measures whether two fields were typed into, not whether
planning happened.

### 13.2 The replacement — evidenced by actual schedule state

"Calendar planning complete" must be evidenced by the schedule itself:

```
calendar_planning_complete  ⇔  the workpack's in-scope activities have CALCULATED schedule dates
                               (i.e. schedule_start IS NOT NULL AND schedule_finish IS NOT NULL)
```

This is **already implemented** in M10 as the `schedule` / "Schedule Calculated" check
(`PlanningReadinessService.ts:466-474`), which reads Activity CPM output. The intent survives; only
the evidence source changes, from a typed field to a derived one.

### 13.3 The six readiness facts, kept distinct — frozen

The instruction requires these to be separable. They are six different questions and must never
collapse into one flag:

| # | Fact | Test | Source |
|---|---|---|---|
| 1 | **Activities exist** | `COUNT(in-scope activities) > 0` | `Activity` |
| 2 | **Activities have duration** | every in-scope activity has `duration_hours > 0` | `Activity.duration_hours` |
| 3 | **Logic exists** | relationships exist for the set (where more than one activity) | `ActivityRelationship` |
| 4 | **CPM calculated** | activities carry M11 output (`early_*` / `planned_*` populated by M11) | M11 |
| 5 | **Workpack schedule span exists** | `schedule_start IS NOT NULL AND schedule_finish IS NOT NULL` | §7 (derived) |
| 6 | **Event campaign window exists** | `Event.planned_start IS NOT NULL` (and `planned_end` for commitment comparison) | §6 |

**4, 5 and 6 are different facts.** 4 says the engine ran; 5 says the rollup produced a span; 6
says a commitment exists to measure against. A workpack can satisfy 4 and 5 while its Event has no
window at all — and that must be visible, not averaged away.

**Note on gating force.** The current `calendar` check appears in **neither** `mandatoryChecks`
nor `planningPrereqKeys` (`PlanningReadinessService.ts:487-497`), so it gates nothing today. The
replacement's gating force is a **separate M10 product decision** and is deliberately left as it
is: this contract changes *what the check measures*, not *how much it counts*. Increasing its force
would be a capability change disguised as a refactor.

### 13.4 The score criterion

`ReadinessScoreService`'s `execution_calendar` criterion (weight **8** of 100,
`src/core/workpack-intelligence/ReadinessScoreService.ts:17`, `:65`) **re-points to the derived
span**. Weight retained; circularity removed. Note this criterion lives in a **different module**
from M10 — a distinction that must survive the change.

### 13.5 Prohibited

M10 writing any date · M10 recomputing a span · M10 calling CPM · readiness credit for typing a
date into a workpack with no activities in it.

---

## 14. Baseline Contract

### 14.1 The freeze

| Element | Rule |
|---|---|
| `BaselineActivity` dates | A **frozen snapshot of M11-calculated Activity dates** at the instant of baselining. Immutable |
| Event window | Frozen as baseline **metadata** (`project_start` / `project_finish`, `ScheduleBaselineService.ts:121-122`) |
| Constraints | **May** be captured as baseline metadata for explanation. **Never** as a baselined date |
| Mutability | **None.** A baseline is never updated; a new baseline is created |
| Who may create | The baseline service only, audited |

### 14.2 Workpack derived span in the baseline — **OPTION B**

| Option | Verdict |
|---|---|
| **A — snapshot the span explicitly** | ❌ Stores a second copy of a fact already frozen in `BaselineActivity`. Two carriers for one truth, capable of disagreeing |
| **B — recomputable from frozen `BaselineActivity`** | ✅ **CHOSEN** |
| **C — not stored and not recomputable** | ❌ Loses the ability to compare a workpack's committed span to its current span |

**Consistency with OD1 is the deciding argument.** OD1's finding is that the workpack span is
*derived and never authored*. A baseline that **stored** the span would make it authored-at-a-point
— reintroducing exactly the second authority OD1 retired. Applying the **same §7.2 inclusion rule**
to the frozen `BaselineActivity` rows yields the baselined span deterministically, with one carrier
and no drift.

**Requirement this imposes on C2 — now verified, and it needs one additive change.**
`BaselineActivity` (`schema.prisma:608-632`) carries `baseline_id`, `activity_id` and
`organization_id` but **no `workpack_id`** [SOURCE]. The span is therefore recomputable only by
joining `activity_id` → the **live** `Activity.workpack_id`.

**That makes the baselined span retroactively mutable:** if an activity is moved to another workpack
after baselining, the historical baseline span changes — which is exactly the property a baseline
exists to prevent.

> **C2 MUST add `workpack_id` to `BaselineActivity`**, captured at snapshot time. It is a small
> additive column and it is what makes Option B honest. Without it, Option B is not "recomputable
> from a frozen source" but "recomputable from a frozen source plus a mutable one." Defect **D-37**,
> upgraded from *verify* to **MUST FIX**.

### 14.3 No baseline may fabricate a missing date

```150:151:src/core/resources/ScheduleBaselineService.ts
          planned_start: act.planned_start ?? new Date(),
          planned_finish: act.planned_end ?? new Date(),
```

**A baseline of an unscheduled activity currently records "now" as its baseline date.** Defect
**D-01**, P1, C2 MUST FIX.

**The fabrication has a structural cause, which changes the available remedy.**
`BaselineActivity.planned_start` and `planned_finish` are declared **NOT NULL**
(`schema.prisma:613-614` — `DateTime` without `?`) [SOURCE]. The `?? new Date()` is not carelessness;
it is the only way to satisfy a non-nullable column when the source date is absent.

So "baseline them with NULL dates" is **not available without a schema change**, and the remedy is one
of exactly two:

| Remedy | Consequence |
|---|---|
| **(a) Refuse to baseline unscheduled activities** | ✅ **RECOMMENDED.** Consistent with the service's existing refusal to baseline an event with no activities (`:112-113`). A baseline is a commitment; an unscheduled activity has nothing to commit |
| **(b) Make the two columns nullable**, recording unscheduled activities honestly | Acceptable, but it weakens the guarantee that every `BaselineActivity` row carries a real committed date |

**A second fabrication site exists on the identical pattern:**
`app/api/projects/[id]/baseline/route.ts:75-76` — the legacy project baseline route repeats
`?? new Date()`. Both must be fixed together; fixing one leaves the defect live.

**One correct precedent already exists in the codebase and should be the model:**
`MsProjectXmlFormatter.ts:184-189` **omits** the Start/Finish elements entirely when the date is null
rather than substituting `now()`. That is the right shape — **absence travels as absence.**

---

## 15. Scenario Contract

### 15.1 The freeze

> **`ScenarioActivityOverride` is scenario / sandbox input ONLY. It must never become the
> production constraint model.**

Three reasons: it is scenario-scoped by design, so it cannot bind the live plan; its
`early_start_constraint` field is dead schema (the identifier occurs **exactly once**
repository-wide — its own declaration); and scenarios exist precisely to be **discarded**.
Promoting a sandbox to production authority inverts its purpose.

### 15.2 The one governed path — already correct

```
Scenario authoring
   → ScenarioActivityOverride            (sandbox; scenario calculation only)
   → promoteScenario (:214-276)          (requires scenario status 'ready', :229)
   → ScheduleChangeRequest               (status 'proposed', simulation_data.changes :248-253)
   → governed review / approval
   → APPLIED  →  governed M11 INPUT (constraint)  →  M11 recalculates  →  M11 writes dates
```

**`promoteScenario` does not touch `Activity`** — verified [SOURCE]. It is the only mechanism in
the codebase whose structure is already right. **No direct scenario → Activity commit exists**
(searched `promote`, `apply.*scenario`, `commit`, `merge`, `adopt`).

**Explicitly prohibited:** `Scenario → Activity.planned_start` direct write, under any name.

### 15.3 The governance asymmetry — recorded, not a licence to build

| Path | Approval | UI |
|---|---|---|
| `ScheduleChangeRequest` (the **governed** path) | ✅ Mandatory | ❌ **Read-only.** `ChangeControlPanel` (`ScheduleControlDashboard.tsx:626-685`) has **no approve or apply controls** |
| `ResourceLevelingApplyService` (the **ungoverned** path) | ❌ None | ✅ Full "Approve & Apply Scenario" button (`LevelingPreviewModal.tsx:60-67`) |

> **The governed path is the one users cannot reach; the ungoverned one has a button.**

This is a **UI / governance C2 issue (D-04)**, and explicitly **not** a reason to build another
approval engine. `ScheduleChangeRequest` already provides the state machine, mandatory approval,
reviewer identity and notes, impact metrics and supersession. **Only what "applied" writes
changes.**

---

## 16. Schedule Change Control Contract

### 16.1 The single governed pattern — frozen

```
Planner intent
   → Constraint  (single change)   ─────┐
   → ScheduleChangeRequest (bulk)  ─────┤
                                        ▼
                              approval where required
                                        ▼
                              M11 RECALCULATION
                                        ▼
                              M11 writes planned dates
```

> **No service may write `planned_start` / `planned_end`, then call CPM, and assume CPM will
> preserve the override.**

That assumption is **already false in production and measurably so.** Resource levelling writes
`planned_start` for a non-critical activity, then recalculates — but CPM reads `planned_start` only
for activities with **no predecessor**. For any levelled activity *with* a predecessor the delay is
written, displayed, and then **completely ignored** by `early_start`, with no warning. The UI shows
the delay; the engine does not. This is the concrete, shipped cost of Pattern 2 (defect **D-03**).

### 16.2 Required conformance

| Mechanism | Required change |
|---|---|
| `ResourceLevelingApplyService` | Write `START_NO_EARLIER_THAN` constraints instead of dates. **This also fixes D-03**, because a constraint is honoured for activities with predecessors |
| `ScheduleChangeControlService` | "Applied" writes constraints; keep writing `duration_hours` (a legitimate input); **add CPM recalculation**, which it never performs today; correct the false header comment at `:10` |
| `ScopeChangeApplicationService` | Same: `new_activity` / `modify_activity` items write constraints; add recalculation |
| `PlannerWorkspaceService.batchUpdate` | Remove `planned_start` / `planned_end` from the accepted field list (`:119-120`) |
| Browser planning components | Delete both client-side date algorithms |
| `override_start_date` | Retire, or bring under the same reason + audit rule (**OD5**) |

### 16.3 Retained assets — do not rebuild

`ScheduleChangeRequest`'s lifecycle (`proposed → review → approved → applied | rejected |
superseded`), mandatory approval (`:216-218`), tenant and event ownership validation (`:234-257`),
before/after `AuditLog` snapshots (`:315-330`), supersession of competing requests (`:304-312`),
and impact metrics. **Governance does not change; the payload does.**

**One misleading comment, recorded:** `ScheduleChangeControlService.ts:10` claims it *"Uses
ResourceLevelingApplyService for actual schedule mutations"*. It neither imports nor calls it —
which is precisely why the two mechanisms diverged on approval and recalculation. **Defect D-14.**

---

## 17. Timestamp / Timezone Contract

### 17.1 Target types — frozen

| Carrier | Fields | Current | Target |
|---|---|---|---|
| `Activity` | `planned_start`, `planned_end`, `actual_start`, `actual_end` | `DateTime? @db.Date` (`schema.prisma:25-28`) | **`timestamptz`** |
| `Activity` | `early_start`, `early_finish`, `late_start`, `late_finish` | `DateTime?` → `timestamp(3)` — **already time-capable** | `timestamptz` (alignment) |
| `Workpack` | `schedule_start`, `schedule_finish` (new, derived) | — | **timestamp-capable** (`timestamptz`) if persisted |
| `Event` | `planned_start`, `planned_end`, **`actual_start`, `actual_end`** — **four** fields, not two (`schema.prisma:2014-2017`) | live type `date`, precision 0 [EXECUTED] | **timestamp-capable** (`timestamptz`) |
| `EventMilestone` | `planned_date`, `actual_date` | live type `date`, precision 0 [EXECUTED] | **`timestamptz`** |
| `BaselineActivity` | `planned_start`, `planned_finish` — **NOT NULL** (`:613-614`) | `timestamp without time zone`, precision 3 [EXECUTED] | `timestamptz(3)` (alignment) |
| `Activity` | `constraint_date`, `constraint_set_at` (new) | — | **`timestamptz(3)`** |

**Live column types, verified** [EXECUTED]: every `planned_*` / `actual_*` on `Activity`, `Workpack`,
`events` and `event_milestones` is `date` with precision 0. Every `early_*` / `late_*` and every
`BaselineActivity` timestamp is `timestamp without time zone` with precision 3. **Nothing in the
schedule model is `timestamptz` today.**

**Note:** the CPM output columns are **already** full timestamps, so they need alignment rather than
conversion. The genuine date-only conversion surface is **4 `Activity` + 4 `Event` + 2 `Workpack` + 2
`EventMilestone` columns** — twelve, not six — and not the whole schedule model.

### 17.2 The historical conversion rule — frozen

> **Do not invent time-of-day for historical date-only values.**

```
date-only value
   → that date at 00:00 in the explicitly selected operational timezone
   → provenance MUST record that the original time-of-day was NOT CAPTURED
```

A converted `actual_start` of `2026-08-29 00:00+05:30` is **not** a claim that work began at
midnight. It is a claim that the date is known and the time is not. **This distinction must be
recorded in the migration record and must be surfaceable to users** — otherwise every historical
execution fact acquires a false precision that no later audit can undo.

**Prohibited:** assigning a shift start, a working-hours start, `08:00`, or any other plausible
hour to a historical value. **Prohibited:** mass-correcting historical `actual_*` values. Migration
preserves information; it does not manufacture information.

### 17.3 Timezone — explicitly chosen, and the basis stated

> **Selected operational timezone: `Asia/Kolkata` (UTC+05:30).**
> **Selected storage: `timestamptz`.**

| Aspect | Status |
|---|---|
| **Basis of the choice** | An **explicit architect decision** recorded during R1.0-C: storage = `timestamptz`, operational timezone = Asia/Kolkata, historical `date` values → midnight in that zone. [PRODUCT — architect decision, not an inference] |
| **UTC not assumed** | ✅ Correct. UTC was **not** assumed; a zone was chosen and recorded |

### 17.3.1 There is NO repository evidence pinning one operational timezone — and four semantics conflict

Per §17 of the instruction (*"do not hard-code that as the database semantic without repository
evidence"*), the repository was searched exhaustively. **The honest answer is that timezone handling
for scheduling and storage is entirely implicit, and the four places that do express a zone disagree
with each other:**

| Layer | What it says | Evidence |
|---|---|---|
| **Live database session** | `TimeZone = Asia/Calcutta` (+05:30) | [EXECUTED] — `SHOW TimeZone` and `current_setting('TimeZone')` |
| **Prisma schema defaults** | `Organization.timezone String? @default("UTC")` (`schema.prisma:1002`) and `Site.timezone String? @default("UTC")` (`:1458`) | [SOURCE] |
| **UI default** | `siteTimezone: 'local'` — the **browser's** zone via `Intl.DateTimeFormat().resolvedOptions().timeZone` (`UserPreferencesContext.tsx:52`) | [SOURCE] |
| **WhatsApp / M16 paths** | **Hard-coded `Asia/Kolkata`** (`MessageProcessor.ts:378, 439`; `QueryHandler.ts:163`; `whatsapp/updates/[updateId]/approve/route.ts:80`) | [SOURCE] |

**Proven absences that matter:**

- **No `TZ=` in `.env.example`, `docker-compose.yml` or `docker-compose.prod.yml`** [SOURCE — proven absence]
- **No timezone pin on the Prisma connection pool** (`src/lib/prisma.ts:10-28`) — the session zone is whatever the server supplies [SOURCE — proven absence]
- **No timezone library is a declared dependency.** `date-fns@^4.1.0` is present with **no** `date-fns-tz`; no `moment-timezone`, no `dayjs` as a direct dependency [SOURCE]
- **`Event` and `Plant` have no timezone column** — only `Organization` and `Site` do [SOURCE]

### 17.3.2 The correction this forces, and the conflict C2 must resolve

**Correcting this document's own earlier claim:** an earlier draft stated that *"no per-organization
or per-event timezone column exists."* That is **wrong for organization and site** —
`Organization.timezone` and `Site.timezone` both exist. It is correct only for `Event` and `Plant`.

**The conflict, stated plainly:** the schema's own default is **UTC**, the database session is
**Asia/Calcutta**, and the chosen operational zone is **Asia/Kolkata**. These are not three spellings
of one decision — the first is a *different zone*, five and a half hours away.

| Item | Requirement on C2 |
|---|---|
| **`Asia/Calcutta` vs `Asia/Kolkata`** | The deprecated alias and the canonical name must be standardised on **`Asia/Kolkata`**; they must not be treated as different zones (**D-20**) |
| **UTC defaults vs the chosen zone** | `Organization.timezone` / `Site.timezone` defaulting to `"UTC"` **contradicts** the selected operational zone. Either the defaults change or the tenant rows are set explicitly — **before** conversion, because the conversion's meaning depends on which one is authoritative (**D-39**) |
| **Browser-local display** | Display may remain user-selectable. It must never round-trip a locally-formatted value back into storage (§17.4) |
| **Hard-coded `Asia/Kolkata` in WhatsApp** | Must read the resolved operational zone rather than a literal (**D-40**) |

**The hard requirement this places on C2:** because `@db.Date` columns carry no zone, the session
offset is +05:30, and the schema's own default says UTC, the conversion must be executed and
verified **on a restored copy** before it touches production. Gate **G6** (§26) exists for exactly
this. **This finding is the single strongest reason migration safety is RED rather than AMBER:** the
system does not currently agree with itself about what timezone it operates in, and a
`date → timestamptz` conversion is precisely the operation that makes that disagreement permanent.

**Multi-timezone operation** (per-site scheduling zones) would be a new capability, not a migration
detail. Recorded as a forward-looking limit, not an open blocker.

### 17.4 Precision — frozen

| Rule | Detail |
|---|---|
| Storage precision | Milliseconds (`timestamptz(3)`) — matches the existing `timestamp(3)` CPM columns |
| **No truncation of authoritative values** | `.slice(0, 10)` / `split('T')[0]` on any authoritative date is **prohibited**. Current sites: `scheduleEngine.ts:398-401`, `:416-420`; `FieldExecutionService.ts:329-330`, `:541-542`; `PlanningReadinessService.ts:536-537`; `MaterialScheduleIntegrationService.ts:99-123`; `PlanningIntelligenceProviders.ts:67,69`; `CriticalPathIntelligenceService.ts:226-229`; `ScheduleForecastService.ts:50`; `ActivityPlanningGrid.tsx:102-103` (**D-10**) |
| Display formatting | May format to any precision. **Must not** round-trip a truncated value back into storage |

### 17.5 Three epoch rows

Three rows carry epoch-like dates (D7 / blocker **B6**). They are **not** silently converted. They
are corrected or nulled by an explicit, recorded decision before conversion — **gate G8**.

---

## 18. Enter-Once Propagation Contract

### 18.1 The complete target lineage

```
AUTHORED ONCE  (inputs — few, audited, one surface each)
   Event window ────────┐
   Activity duration ───┤
   Relationship + lag ──┤
   Activity constraint ─┤        ┌───────────────────────────────┐
   Calendar / shifts ───┴───────►│  M11                          │
                                  │  ScheduleOrchestrationService │
                                  │   → CalendarEngine            │
                                  │   → calculateSchedule         │
                                  └───────────────┬───────────────┘
                                                  │  SOLE WRITER
                                                  ▼
                          Activity.planned_start / planned_end
                          Activity.early_* / late_* / float / is_critical
                          Workpack.schedule_start / schedule_finish
                                                  │
        ┌─────────────────────────────────────────┼──────────────────────────────┐
        ▼                ▼            ▼           ▼            ▼          ▼      ▼
   Schedule/Gantt   Readiness   Control Tower  Reports   Mgmt Intel   Exports  Baseline
                                                                                (frozen)
        └──────────────────── ALL READ-ONLY. NO RE-ENTRY. ──────────────────────┘

ACTIVITY CONSTRAINT ──► M11 ──► Activity planned dates ──► all downstream readers

ACTUAL EXECUTION ──► M12 ExecutionWriteService ──► actual_start / actual_end
                                                        │
                                                        ▼
                                                     M8.13 progress
                                                        │
                                             ┌──────────┼──────────┐
                                             ▼          ▼          ▼
                                            M13        M14        M15
                                                        │
                                                        ▼
                                            M16 presentation / action
```

### 18.2 The no-re-entry rule — frozen

> **No downstream module may ask a user to re-enter: planned start · planned finish · activity
> actual start · activity actual finish · progress.**

The single exception, tightly bounded: a module may accept input for one of these **only** when it
is **explicitly correcting the authoritative fact through that fact's governed owner** — a planned
date via a constraint or change request routed to M11; an actual date via M12's audited correction
path; progress via M8.13. **Correcting through the owner is not re-entry. Collecting the same fact
a second time is.**

### 18.3 The five invariants

1. **Enter once.** Every input has exactly one authoring surface. A planner never types a date the
   system can compute.
2. **Store once.** No fact lives in two columns. A constraint and a calculated date are *different
   facts*, not two copies of one.
3. **Derive automatically.** The span and every CPM field are recomputed by M11. **The "Sync"
   button is deleted** — it is the physical embodiment of the violation.
4. **Propagate automatically.** Every input change enqueues recalculation — including **constraint
   removal** (§8.5) and **Event window change** (§6.5).
5. **Read downstream, never re-enter.**

### 18.4 Where the contract is violated today, by count

Six live Pattern-2 date writers · seven ordinary `Activity.planned_*` writers · fourteen Workpack
date entry points · two browser scheduling algorithms · one manual Sync button · one unaudited
event-datum override. **The target state has one writer.**

---

## 19. Import / Export Contract

### 19.1 What imports may and may not provide — frozen

| Imports MAY provide | Imports MUST NOT create |
|---|---|
| Activities | A second planned-date authority |
| Duration | Direct `planned_start` / `planned_end` truth that bypasses M11 |
| Relationships | A second lag unit |
| Lag (converted to minutes at a **named** boundary) | A second calendar |
| **Constraints** (mapped to the two permitted types) | Constraint types outside the frozen enum |
| External IDs (`p6_object_id`, `p6_activity_id`) | New provenance columns — **`Activity.schedule_source` already exists** (`schema.prisma:56`) |

**An imported date is an input, and inputs become constraints.** A P6 file's activity start becomes
`START_NO_EARLIER_THAN` where the source marks it constrained, and is otherwise discarded in favour
of M11's calculation. This is the same rule that applies to a planner typing a date — the source
being a file changes nothing about the authority.

### 19.2 Per-channel semantics — frozen

| Channel | Rule |
|---|---|
| **Primavera P6 / XER** | Import: activities, durations, logic, lag → minutes via a named converter recording the source's hours-per-day; constraints → the two permitted types. Export: convert from minutes explicitly and **record the factor used**. The current ×8 (`export/xer/route.ts:102`) and ×10 (`PrimaveraXmlFormatter.ts:104`) hard-codings are removed |
| **MS Project** | **Project `<StartDate>` / `<FinishDate>` ← Event window.** Activity dates ← M11 planned dates. The `now()` fallback is **removed** (**D-02**) |
| **Excel** | Same input rules. No date column may write `planned_*` directly |
| **API** | `lag_minutes` only. Workpack PATCH **rejects** `planned_start_date` / `planned_end_date`. Constraint endpoints are audited and require a reason |
| **Mobile** | Read-only over planned dates. May submit **execution facts** through M12 and progress through M8.13 |
| **WhatsApp / M16** | **Read-only over every time fact.** M16 may present and may trigger a governed action; it may never write a date |

### 19.3 The `now()` prohibition — frozen

> **`null date → now()` is PROHIBITED in every import, export, baseline and report path.**

A missing date must travel as missing. Recorded `now()` fallbacks, all C2 defects:

| Site | Defect |
|---|---|
| `app/api/workpacks/[id]/export/ms-project/route.ts:58, 60-62, 80-81, 151` — project window ← `now()` when workpack dates are null, i.e. **in 199 of 199 cases**; task-level `Start`/`Finish` fall back to the fabricated project start | **D-02**, P1 |
| `app/api/export/generate/route.ts:290-296` — **bulk** MS Project export, same `\|\| new Date()` on both project and task dates | **D-02**, P1 |
| `app/api/export/generate/route.ts:338` — project-level `<StartDate>` ← `new Date()` | **D-02**, P1 |
| `app/api/export/generate/route.ts:554` — **P6 XML** `<PlannedStartDate>` ← `new Date()` | **D-02**, P1 |
| `ScheduleBaselineService.ts:150-151` — `act.planned_start ?? new Date()` | **D-01**, P1 |
| `app/api/projects/[id]/baseline/route.ts:75-76` — the same `?? new Date()` on the legacy project baseline path | **D-01**, P1 |
| `ScheduleOrchestrationService.ts:146` — `event.planned_start ? … : new Date()` — anchors an entire campaign to the run instant | **D-05**, P1 |
| `ScheduleForecastService.ts:129` — `addDaysToDate(now, remainDays)` — legitimate for a *transient* forecast, but makes the result non-deterministic despite the header's claim | **D-16**, P3 |

**There are therefore six `now()` fabrication sites across export and baseline, not two.** Every one
must be removed together; leaving any single site live preserves the defect.

**One path already handles null dates correctly and is the model to copy:**

```183:189:src/modules/Scheduling/formatters/MsProjectXmlFormatter.ts
                const durationH = Number(act.duration_hours ?? 8);
                const startSeg = act.planned_start
                    ? `<Start>${(act.planned_start as Date).toISOString().replace('.000Z', '')}</Start>`
                    : '';
                const finishSeg = act.planned_end
                    ? `<Finish>${(act.planned_end as Date).toISOString().replace('.000Z', '')}</Finish>`
                    : '';
```

`MsProjectXmlFormatter` **omits the element entirely** when the date is null rather than substituting
an instant — absence travels as absence. The fabricating route sits beside a correct formatter, so
C2's fix is to route through the formatter rather than to write new null-handling.

**Two defects remain in this otherwise-correct path**, and they must be fixed with it:

| Issue | Location | Defect |
|---|---|---|
| **`duration_hours ?? 8` fabricates a duration.** The schema default is `0`, so a null duration is genuinely unknown — and 8 contradicts both the 10 h fallback and the 12 h shift data | `:183` | **D-52**, P2 |
| **`.toISOString().replace('.000Z','')` emits a UTC instant with the zone marker stripped**, so the receiving tool reads a +05:30 value as local. This is the export-side face of the §17.3 timezone conflict | `:185`, `:188` | **D-53**, P1 — must be fixed **as part of** the `timestamptz` conversion, not after it |

---

## 20. Reporting / Forecast Contract

### 20.1 Sources — frozen where they exist, OPEN where they do not

| Figure | Authoritative source | State |
|---|---|---|
| **Actual progress** | **M8.13** — sole progress authority | ✅ **FROZEN** |
| **Workpack schedule span** | §7 — M11-derived `schedule_start` / `schedule_finish` | ✅ **FROZEN** |
| **Event overrun** | `MAX(Activity.planned_end)` vs **`Event.planned_end`**, expressed as negative float (§6.4) | ✅ **FROZEN** — requires the `target_finish_date` wiring |
| **Baseline variance** | Current M11 `planned_*` vs frozen `BaselineActivity` dates | ✅ **FROZEN** |
| **Schedule variance** | **`ScheduleVarianceService`** — current `planned_*` vs `BaselineActivity` snapshot (`:180-189`). Milestone variance via `EventMilestone` (`ScheduleHealthService.ts:402-440`) | ✅ **FROZEN** — §20.4 |
| **Plan vs actual** | `FieldExecutionService.getPlanVsActual:507-555` — a **separate** figure from baseline variance | ✅ **FROZEN** — §20.4 |
| **Planned progress** (the S-curve "should be at" line) | Computed **four times with three different date sources** | ⚠️ **CONFLICT → OPEN** — §20.3 |
| **Forecast completion** | — | ⛔ **ABSENT** — see §20.2 |

### 20.2 Forecast — recorded ABSENT, not invented

Per §24 of the instruction (*"If forecast does not currently have an authoritative source,
explicitly mark it as OPEN/absent rather than inventing one"*):

> **There is NO stored forecast fact anywhere on the live surface, and no authoritative forecast
> source.**

Evidence:

| Finding | Class |
|---|---|
| **No forecast column on `Activity`, `Event` or `Workpack`** | [SOURCE — proven absence] |
| The **only** forecast columns in the schema are `Project.forecast_sd_date` / `forecast_su_date` (`schema.prisma:1212-1213`), on the **retired** pre-R0.4 `Project` entity, with **zero references** in `src/**` or `app/**` | [SOURCE — proven absence of readers/writers] |
| `ScheduleForecastService.computeForecast` **computes and persists nothing**. It is live, reachable at `app/api/events/[eventId]/schedule/forecast/route.ts:23` and consumed by M15 `DecisionIntelligenceService.ts:346` | [SOURCE] |
| Three conceptually different "finish forecasts" coexist — duration-based (`ScheduleForecastService`), cost EAC (`EvmCalculationService`, a **currency** not a date), and scenario CPM finish (`ScenarioCalculationService`). **M15 already named them** via `ForecastType` rather than merging them | [SOURCE] |

**M15's three `ForecastType` members, and why keeping them separate is correct** [SOURCE]:

| `ForecastType` | What it produces | Built from |
|---|---|---|
| `EXECUTION_FINISH_FORECAST` | A **date** | `ScheduleForecastService` output (`DecisionIntelligenceService.ts:345-428`) |
| `EAC_COST_FORECAST` | A **currency amount** — `EAC = BAC / CPI` | EVM (`:431-447`) |
| `SCHEDULE_SCENARIO_FINISH` | A **date**, hypothetical | Scenario CPM (`:510-574`) |

⚠️ **The S-curve's "Forecast" series is COST, not a date.** `mapEventCurveToChart.ts:47` maps the
chart's forecast series from `EvmSnapshotService`'s EAC (`:203-208`), and `SCurveChart.tsx:144` labels
it "Forecast". A reader comparing the S-curve "Forecast" to `ScheduleForecastService`'s
`project_forecast_finish` is comparing **money to a date**. These must never be presented under one
label (**D-54**, P2).

**What C1 freezes about forecast:**

1. Forecast is a **transient, derived read-model**. It is **not** a time fact of record.
2. It is computed from Activity planned dates, actual dates, progress and `remaining_duration`.
   **It may never be written to any `planned_*` or `actual_*` column.**
2a. ⚠️ **`remaining_duration` is a USER INPUT, not a derived value** — and that contradicts how it is
   documented. **No service computes or auto-maintains it** [SOURCE — proven absence]; it is writable
   only through the PATCH allowlists at `app/api/activities/[id]/route.ts:30, 35`, while
   `ScheduleForecastService` treats it as an authoritative driver (`:97`, `:119`). **C2 must decide
   explicitly** whether it is an authored input (in which case it needs an owner and an entry surface
   per §18) or a derived value (in which case something must compute it). Today it is neither
   (**D-49**).
3. M15's `ForecastType` naming is the authority for *which* forecast is being discussed. **No new
   forecast engine may be created** (§25).
4. `Project.forecast_sd_date` / `forecast_su_date` are **dead columns on a retired entity** and
   are C2 cleanup candidates — **not** a carrier to revive.

**What remains OPEN — `OD11`:** *should a forecast finish be **persisted** (per activity, workpack
or event) so that forecast history and forecast-vs-commitment trending become possible?* Today it
cannot be, because nothing stores it. This is a **product capability decision**, and it does not
alter any frozen semantic — which is why it does not block C1.

**A note worth recording:** the retired `Project` entity carries a complete
`planned_ / forecast_ / actual_` triplet for shutdown and startup (`schema.prisma:1210-1215`), a
shape the live `Event` lacks. R0.4 retired the right *entity*; the *shape* it retired is what
reporting now wants. That is context for OD11, not a reason to un-retire `Project`.

### 20.3 Planned progress — NOT absent. It exists FOUR times, with four different definitions

**Correcting this document's own earlier framing.** Planned progress is not missing; it is computed in
four independent places from four different sources, and no two agree:

| # | Engine | Definition | Baseline or current? | Location |
|---|---|---|---|---|
| 1 | **EVM PV** | `BAC × (elapsed fraction of the baseline duration)` | **Baseline** (`BaselineActivity.planned_start/finish`) | `EvmCalculationService.calculatePv:67-89` |
| 2 | **Schedule health "Progress Earned"** | Per activity `(elapsed / planned window) × 100`, duration-weighted, compared to actual progress | **Current** `Activity.planned_start/end` | `ScheduleHealthService.scoreProgressEarned:475-506` |
| 3 | **Event S-curve (legacy)** | `Σ duration where early_finish ≤ date / Σ duration × 100` | **CPM `early_finish`** | `ScheduleOrchestrationService.generateSCurveData:322-339` — **zero callers** |
| 4 | **Reporting dashboard BCWS** | Time fraction on `early_start`/`early_finish` × `budgeted_cost` | **CPM early dates** | `app/api/reporting/dashboard-data/route.ts:62-71` |

**Three different date sources for one concept** — baseline planned, current planned, and CPM early —
which will diverge the moment a schedule slips. That is a **conflict**, not an absence, and it is
recorded as a defect rather than averaged into a compromise (**D-45**, P2).

**And one module states the absence explicitly in code:**

```290:290:src/core/control-tower/ControlTowerQueryService.ts
        plannedPercent: null,  // M13 has no planned progress engine
```

**What C1 freezes:** planned progress is a **derived read-model**, never stored. **No stored
`planned_percent_complete` field exists** [SOURCE — proven absence]. C2 must **name one canonical
definition** and re-point the others at it — without creating a fifth engine (§25.2). The natural
choice is definition 1 (baseline-phased PV), because a "should be at" figure is only meaningful
against a commitment; but that is a reporting decision, **folded into OD11** with forecast
persistence rather than settled here.

### 20.4 What the variance authorities actually compare — frozen

Recorded because five surfaces compute a variance and they do not all mean the same thing:

| Service | Subtraction | Against |
|---|---|---|
| **`ScheduleVarianceService`** — the schedule-variance authority | `Activity.planned_start` − `BaselineActivity.planned_start`; same for finish, duration, float erosion | **Baseline snapshot** (`:180-189`) |
| `ScheduleForecastService` | `forecastFinish` − `plannedEnd`; `maxForecast` − `maxPlanned` | **Current plan** (`:152`, `:193`) |
| `FieldExecutionService.getPlanVsActual` | `actual_start` − `planned_start`; `actual_end` − `planned_end` | **Actuals** (`:507-555`) |
| `EvmCalculationService` | `SV = EV − PV`, `SPI = EV / PV` | **Cost units, explicitly "not calendar days"** (`:139-143`) |
| `ScenarioCalculationService` | `projectFinishDelta` = scenario CPM finish − baseline max finish | **Baseline** (`:168-179`) |

**Frozen:** **no baseline reader computes variance against actual dates** [SOURCE]. Baseline variance
is always *current planned (or CPM early) vs baseline planned*. Plan-vs-actual is a **separate**
figure owned by `FieldExecutionService`, and EVM's `SV` is a **currency**, not a duration. **These four
must never be merged or labelled identically in a report.**

### 20.4 The forecast defect that must not survive C2

`ScheduleForecastService` is a **third day-arithmetic implementation**: its own
`addDaysToDate` (flat 24 h, `:53-56`), its own `diffDays` (`:59-65`), and an `hoursPerDay`
**supplied by the caller** — read from a **URL query parameter, defaulting to 8**
(`app/api/events/[eventId]/schedule/forecast/route.ts:20`), against the calendar's fallback of
**10**.

> **A client-supplied query parameter therefore changes a schedule-derived business figure.**

Defect **D-17**, P2. Under this contract the forecast **must** obtain hours-per-day from
`CalendarEngine`, not from the request. No new engine is created — an existing one is consulted.

---

## 21. Current → Target Authority Matrix

| Business Fact | Carrier | Input / Derived | Writer (target) | Consumer | Editable? | Recalculation changes it? |
|---|---|---|---|---|---|---|
| Campaign window start | `Event.planned_start` | **Input** | `EventPlanningService` | M11 (`project_start_date`), baseline, KPIs, exports | ✅ | ❌ |
| Campaign window finish | `Event.planned_end` | **Input** | `EventPlanningService` | M11 (**`target_finish_date`**), baseline, KPIs, exports | ✅ | ❌ |
| Activity duration | `Activity.duration_hours` | **Input** | Creation / edit / change request | M11, EVM, resource loading, forecast | ✅ | ❌ |
| Relationship + lag | `ActivityRelationship.lag_minutes` | **Input** | Predecessor API, templates | M11; readers convert at render | ✅ | ❌ |
| **Activity constraint type** | `Activity.constraint_type` | **Input** | Constraint service (audited) | **M11 only** | ✅ (reason required) | ❌ |
| **Activity constraint date** | `Activity.constraint_date` | **Input** | Constraint service (audited) | **M11 only** | ✅ (reason required) | ❌ |
| Working calendar | `ScheduleCalendar` | **Input** | Calendar CRUD | M11 via `CalendarEngine` | ✅ | ❌ |
| Shifts | `ShiftDefinition` | **Input** | Shift CRUD (**OD9**) | M11 via `CalendarEngine`; resource planning | ✅ | ❌ |
| Resource capacity | `ResourceCapacity` | **Input** | Capacity CRUD (**OD9**) | Levelling only — **never a CPM date input** | ✅ | ❌ |
| Material availability | `MaterialConstraint.constraint_date` | **Derived** (external) | `MaterialReadinessService` | Readiness; CPM only via a category-1 constraint (**OD8**) | ❌ | ✅ (from supply data) |
| Milestone target | `EventMilestone.planned_date` | **Input** | `EventPlanningService.upsertMilestone` | `ScheduleHealthService` variance | ✅ | ❌ |
| **Activity planned start** | `Activity.planned_start` | **DERIVED** | **M11 only** | UI, M10, M13–M16, exports, baseline, forecast, span | ❌ **Never** | ✅ **Every run** |
| **Activity planned finish** | `Activity.planned_end` | **DERIVED** | **M11 only** | Same | ❌ **Never** | ✅ |
| Activity early/late/float | `early_*`, `late_*`, `total_float`, `free_float`, `is_critical` | **Derived, internal** | **M11 only** | M11 internal; float displayed | ❌ | ✅ |
| **Workpack schedule span** | `Workpack.schedule_start` / `schedule_finish` | **DERIVED** | **M11**, in the CPM transaction | Gantt, header/list, planner grid, M10 display, M14 | ❌ **Never** | ✅ |
| **Activity actual start** | `Activity.actual_start` | **Input** (execution fact) | **M12 `ExecutionWriteService` only** | M8.13, M13–M15 | ⚠️ M12 correction only | ❌ **Never** |
| **Activity actual finish** | `Activity.actual_end` | **Input** (execution fact) | **M12 only** | Same | ⚠️ M12 correction only | ❌ **Never** |
| Progress | `Activity.progress_percent` | **Derived** | **M8.13 only** | All downstream | ⚠️ Via M8.13 | ❌ |
| Baseline snapshot | `BaselineActivity` dates | **Derived** (frozen) | `ScheduleBaselineService` (create only) | Variance reporting | ❌ **Immutable** | ❌ |
| Scenario proposal | `ScenarioActivityOverride` dates | **Sandbox input** | `ScenarioPlanningService` | Scenario calc; live plan only via change request | ✅ (in sandbox) | ❌ |
| **Forecast finish** | **none — not stored** | **Derived, transient** | **none** | Forecast API, M15 | ❌ | N/A — recomputed |

**Every fact has exactly one writer. No fact appears twice.**

**Retired by this contract:** `Workpack.planned_start_date` · `Workpack.planned_end_date` ·
`ScenarioActivityOverride.early_start_constraint` (dead) · `Activity.window` (dead) ·
`ActivityRelationship.lag_days` (→ `lag_minutes`) ·
`workpack_template_logic_links.lag_hours` (→ minutes) ·
`Activity.planned_start`'s role as a CPM **input** ·
`Project.forecast_sd_date` / `forecast_su_date` / `planned_sd_date` / `planned_su_date` /
`actual_sd_date` / `actual_su_date` (dead columns on a retired entity).

---

## 22. Current → Target Writer Migration Matrix

Every current planned-date writer, with its target role and disposition. **Twenty-six mechanisms;
exactly one survives as an authority.**

| # | Current location | Current behaviour | Target role | Keep / Convert / Retire | C2 remediation |
|---|---|---|---|---|---|
| 1 | `ScheduleOrchestrationService:74-75, 105-106, 285` | Writes `early_*`/`late_*`/float only; **never `planned_*`** | **Sole planned-date authority** | **KEEP + EXTEND** | Persist `planned_*`; consume constraints + `target_finish_date` + full calendar; compute the span in the same transaction |
| 2 | `scheduleEngine.ts:251-262` | Seeds predecessor-less activities from `planned_start` | Seeds from `constraint_date` | **CONVERT** | The change that makes M11 ownership possible; **must land with or before #1** |
| 3 | `ActivityCreationCommand:481-482` | Writes `planned_*` on create | Constraint conversion | **CONVERT** | **Requires OD10** |
| 4 | `app/api/activities/route.ts:57` + schedule activity routes | Entry points delegating to #3 | Inherit #3 | **CONVERT** (inherited) | Reject `planned_*`; accept constraint fields |
| 5 | `ActivityService.updateActivity` | Direct `planned_*` write; enqueues recalc | Constraint conversion | **CONVERT** | Re-point to constraints |
| 6 | `ResourceLevelingApplyService:118-124` | Date write + full audit + recalc; **delay discarded for activities with predecessors** | Constraint conversion (`resource_leveling`) | **CONVERT** | Write SNET; **fixes D-03** |
| 7 | `ScheduleChangeControlService:271-279` | Approval-gated date write; **no recalc** | Governed schedule change | **CONVERT** | Write constraints; **add recalc**; fix comment `:10`; add approve/apply UI |
| 8 | `ScopeChangeApplicationService:182-183, 199-200, 213-219` | Approval-gated date write; no recalc | Governed schedule change | **CONVERT** | Write constraints; add recalc |
| 9 | `PlannerWorkspaceService.batchUpdate:119-120` | Accepts `planned_*`; no UI caller | None | **RETIRE (fields)** | Remove from the allow-list before any UI reaches it |
| 10 | `PlannerWorkspaceService:498-501`, allow-list `:132-133` | Inline grid edit of **Workpack** dates | None | **RETIRE** | Remove both columns from `WORKPACK_EDITABLE_FIELDS` |
| 11 | `WorkpackService.updateWorkpack:270-272` | **Unfiltered PATCH spread** — any caller can set workpack dates | None | **RETIRE (fields)** | Explicit allow-list; reject the retired columns |
| 12 | `WorkpackCreateForm.tsx:83-84, 234-235` + 12 further entry points | A human types a workpack window | None | **RETIRE** | Remove the inputs |
| 13 | `WorkpackTabs.tsx:183-193` — **"Sync"** | One-shot manual copy of MIN/MAX into the workpack | None | **RETIRE** | Delete the button **and** the mismatch banner |
| 14 | `app/api/workpacks/[id]/activities/date-range/route.ts:22-30` | The MIN/MAX aggregate, on demand | **Reusable calculation logic** | **HARVEST, then RETIRE the route** | Its aggregate is the model for §7.3; the endpoint is superseded once the span persists |
| 15 | `ScheduleContainer.tsx:832-847`, `:536-538`, `:567-568` | Browser date computation; displays planned as actual | None | **RETIRE** | Delete; fix the display (**D-06**) |
| 16 | `ActivityPlanningGrid.tsx:181-190, 208-209, 233-234` | Second browser date algorithm using `new Date()` | None | **RETIRE** | Delete |
| 17 | `override_start_date` (`ScheduleOrchestrationService:39,145`; `app/api/schedule/calculate/route.ts:49`) | Moves an event's CPM datum, unaudited | Retired or governed | **RETIRE or GOVERN** | **OD5** |
| 18 | `MaterialScheduleIntegrationService:78-158` | In-memory input substitution; zero callers | External constraint emitter | **CONVERT or RETIRE** | **OD8**; must not be wired as-is |
| 19 | `SchedulingService.calculateProjectSchedule:97,167` | Dead second CPM engine; sole caller of the working-day methods | None | **RETIRE** | Harvest nothing — the library it calls (`CalendarEngine`) is already shared (§10A) |
| 20 | `predecessors/route.ts:7-10, 54, 120` (÷8); `TemplateLibraryService:655` (÷24) | Two divergent lag conversions | Named minute conversion | **CONVERT** | Remove both factors; accept `lag_minutes` |
| 21 | `export/ms-project/route.ts:60-61, 151` | Project window ← workpack dates, `now()` fallback | Event window | **CONVERT** | **D-02** |
| 22 | `ScheduleBaselineService:150-151` | `?? new Date()` fabrication | Refuse or NULL | **CONVERT** | **D-01** |
| 23 | `app/api/events/[eventId]/schedule/forecast/route.ts:20` | `hoursPerDay` from a **query parameter** | From `CalendarEngine` | **CONVERT** | **D-17** |
| 24 | `EventPlanningService.updateEvent:173-178` | Writes the window; **enqueues nothing** | Must enqueue recalculation | **CONVERT** | **D-09**, part of B5 |
| 25 | `ExecutionWriteService` | Sole actual-date writer | **Unchanged** | **KEEP** | **MUST NOT CHANGE** |
| 26 | `ScenarioPlanningService.promoteScenario:214-276` | Creates a change request; no `Activity` write | **Already correct** | **KEEP** | None |

**Disposition summary:** KEEP + EXTEND **1** (M11) · KEEP as-is **2** · CONVERT **12** ·
RETIRE **9** · RETIRE-or-GOVERN **1** · CONVERT-or-RETIRE **1**.

---

## 23. C2 Defect Register

**P0** = corrupts or fabricates a business fact now · **P1** = wrong result or lost information ·
**P2** = correctness/consistency risk · **P3** = hygiene.

| ID | Defect | Location | Sev | Disposition |
|---|---|---|---|---|
| **D-01** | **Baseline fabricates dates at TWO sites.** `?? new Date()` — a baseline of an unscheduled activity records "now" as its commitment. **Cause: `BaselineActivity.planned_start`/`planned_finish` are NOT NULL** (`schema.prisma:613-614`), so the remedy is to refuse, not to write NULL (§14.3) | `ScheduleBaselineService.ts:150-151`; `app/api/projects/[id]/baseline/route.ts:75-76` | **P1** | **C2 MUST FIX** |
| **D-02** | **Export fabricates dates at FOUR sites** — MS Project (workpack + bulk), project-level, and P6 XML. The `now()` fallback fires in **199 of 199** cases. A correct precedent exists at `MsProjectXmlFormatter.ts:184-189` | `workpacks/[id]/export/ms-project/route.ts:58,60-62,80-81,151`; `export/generate/route.ts:290-296, 338, 554` | **P1** | **C2 MUST FIX** |
| **D-03** | **Levelling delays silently discarded.** `planned_start` written, then ignored by `early_start` for any activity with a predecessor. UI and engine disagree permanently, no warning | `ResourceLevelingApplyService.ts:118-124` + `scheduleEngine.ts:251-262` | **P1** | **C2 MUST FIX** (fixed by the constraint conversion) |
| **D-04** | **Governed path unreachable; ungoverned path has a button.** Change-request UI is read-only; levelling apply has "Approve & Apply" | `ScheduleControlDashboard.tsx:626-685` vs `LevelingPreviewModal.tsx:60-67` | **P1** | **C2 MUST FIX** |
| **D-05** | **Missing Event start silently becomes `now()`** — anchors an entire campaign to the run instant | `ScheduleOrchestrationService.ts:146` | **P1** | **C2 MUST FIX** |
| **D-06** | **UI displays `planned_start` as `actual_start`** when progress > 0, indistinguishably | `ScheduleContainer.tsx:536-538, 567-568` | **P1** | **C2 MUST FIX** |
| **D-07** | **Six/seven planned-date writers** — no single authority | §21 rows 3–16 | **P0** | **C2 MUST FIX** (the core of R1.0-C) |
| **D-08** | **Two divergent client-side date engines** generating `new Date()` planned dates in the browser | `ScheduleContainer.tsx:832-847`; `ActivityPlanningGrid.tsx:181-190` | **P1** | **C2 MUST FIX** |
| **D-09** | **Missing recalculation triggers.** `EventPlanningService.updateEvent` writes the campaign window and enqueues nothing; most activity mutations trigger nothing (C0 §6.2) | `EventPlanningService.ts:173-178` + B5 | **P1** | **C2 MUST FIX** |
| **D-10** | **Authoritative dates truncated to `YYYY-MM-DD`** at nine sites | §17.4 list | **P1** | **C2 MUST FIX** |
| **D-11** | **Fractional lag leaks into totals while being erased from dates** — `total_duration_days` moves 2 → 2.5 but no date changes | `scheduleEngine.ts:398-401` | **P2** | **C2 MUST FIX** (with the lag migration) |
| **D-12** | **Free float ignores relationship type** — FS arithmetic applied to SS/FF/SF edges | `scheduleEngine.ts:363-371` | **P2** | **C2 MUST FIX** (same arithmetic) |
| **D-13** | **`free_float` unit undocumented** while `total_float` is documented as hours | `schema.prisma:49` vs `:43` | **P3** | **C2 MUST FIX** (declare hours) |
| **D-14** | **False header comment** claims `ScheduleChangeControlService` uses `ResourceLevelingApplyService`; it neither imports nor calls it | `ScheduleChangeControlService.ts:10` | **P3** | **C2 MAY FIX** |
| **D-15** | **`ScheduleCalendar` empty (0 rows)** while `ShiftDefinition` (6 rows) holds the real 2 × 12 h working time. CPM runs on a hard-coded Mon–Sat / 10 h fallback | `ScheduleOrchestrationService.ts:90-91, 354-387` | **P1** | **C2 MUST FIX** (first calendar record) — depends on **OD9** |
| **D-16** | **`MaterialScheduleIntegrationService` dead wiring** — a complete material-ETA integration with zero callers, injecting input silently and date-only | `MaterialScheduleIntegrationService.ts:78-158` | **P2** | **C2 MUST FIX** (rewrite or delete) — **OD8** |
| **D-17** | **Forecast hours-per-day comes from a URL query parameter** (default 8) against the calendar's 10, and the forecast never consults `CalendarEngine`. A client changes a business figure | `app/api/events/[eventId]/schedule/forecast/route.ts:20`; `ScheduleForecastService.ts:53-65` | **P2** | **C2 MUST FIX** |
| **D-18** | **Seven stale schema copies** (~100 KB each, 28-Mar-2026) beside the 262 KB authoritative `schema.prisma`, one declaring different column types | `prisma/schema.prisma.clean`, `schema_clean_download.prisma`, `schema_server_105kb.prisma`, `schema_part1..5.prisma`, `test.prisma` | **P2** | **C2 MUST FIX** (delete or move out of `prisma/`) — material to **G3** |
| **D-19** | **Dead columns on the retired `Project` entity** carry the full `planned_/forecast_/actual_` SD/SU triplet with zero code references | `schema.prisma:1210-1215` | **P3** | **POST-C2** |
| **D-20** | **Timezone alias inconsistency** — the database session reports `Asia/Calcutta` (deprecated alias) while the chosen operational zone is `Asia/Kolkata` | DB session vs §17.3 | **P2** | **C2 MUST FIX** (standardise before conversion) |
| **D-21** | **`Event.planned_end` not wired to CPM** — selected then discarded, so float is self-referential and overrun is arithmetically invisible | `ScheduleOrchestrationService.ts:75` + `scheduleEngine.ts:301-307` | **P0** | **C2 MUST FIX** — highest value single change |
| **D-22** | **Calendar-aware scheduler unreachable.** `SchedulingService.calculateProjectSchedule` — sole caller of the working-day methods — has zero callers | `SchedulingService.ts:97, 167` | **P2** | **C2 MUST FIX** (retire; §10A) |
| **D-23** | **`ShiftDefinition` missing Prisma model** — 6 rows in DB; `ResourcePlanningService` calls it and throws | `schema.prisma` (absent) | **P0** | **C2 MUST FIX — OD9** |
| **D-24** | **`ResourceCapacity` missing Prisma model** — 30 rows in DB; same 15 call sites throw | `schema.prisma` (absent) | **P0** | **C2 MUST FIX — OD9** |
| **D-25** | **`workpack_asset_snapshots` missing Prisma model** — 2 rows in DB | `schema.prisma` (absent) | **P0** | **C2 MUST FIX — OD9** |
| **D-26** | **`EventPhase` orphan caller** — `prisma.eventPhase.create` called with **neither model nor table** | `app/api/events/[eventId]/phases/route.ts:22-28` | **P1** | **C2 MUST FIX — OD9** (delete the caller) |
| **D-27** | **B1 schema drift** — `Activity.project_id` **and** `Activity.schedule_source` declared in Prisma, absent from the DB. Blocks reads **and** creates | `schema.prisma:54, 56`; `ActivityCreationCommand:486` | **P0** | **C2 MUST FIX — gate G3** |
| **D-28** | **B2 destructive diff** — `migrate diff` proposes dropping **8 tables, 3 populated (38 rows)** | Executed `migrate diff` | **P0** | **C2 MUST FIX — gates G2/G3** |
| **D-29** | **B3 migration history unreproducible** — 6 unapplied while a later one is applied; ~30 with `applied_steps_count = 0`; baseline recorded rolled back | `_prisma_migrations` | **P0** | **C2 MUST FIX — gate G3** |
| **D-30** | **Timezone conversion risk** — `timestamp without time zone` round-trip skewed by the +05:30 session offset, **untested** | B4 | **P0** | **C2 MUST FIX — gate G6** |
| **D-31** | **Negative lag silently clamped** — −1, −2, −5 all yield offset 0 with no warning | `scheduleEngine.ts:264, 286` | **P2** | **C2 MUST FIX** (§9.5) |
| **D-32** | **Sub-day lag unusable** — `lagHoursToDays(4) = 0.5` into an `integer` column → `22P02`, HTTP 500 | `predecessors/route.ts:7-10`; `schema.prisma:267` | **P1** | **C2 MUST FIX** (the lag migration resolves it) |
| **D-33** | **Three epoch rows** | D7 / B6 | **P2** | **C2 MUST FIX — gate G8** |
| **D-34** | **Export lag factors inconsistent** — ×8 (XER), ×10 (Primavera XML), ×24 (generic) for the same stored value | `export/xer/route.ts:102`; `PrimaveraXmlFormatter.ts:104`; `export/generate/route.ts:505` | **P2** | **C2 MUST FIX** |
| **D-35** | **`parsePredecessorString` discards unit suffixes** and parses `'ACT-01'`'s `-01` as negative lag. **No production callers** | `scheduleEngine.ts:441-473` | **P3** | **POST-C2** — must not be wired to any paste/import feature first |
| **D-36** | **Dead constraint machinery** a reader could mistake for live: `ScenarioActivityOverride.early_start_constraint` (1 occurrence repo-wide), legacy `ConstraintService` (no importers), unused `ResourceConstraintService` import, `Activity.window` (0/72), `ScheduleScopeChangeItem.planned_start/end` | Various | **P3** | **C2 MAY FIX** |
| **D-37** | **Baseline span recomputability unverified** — §14.2 requires `BaselineActivity` to retain a resolvable `workpack_id` | `ScheduleBaselineService.ts:144-164` | **P2** | **C2 MUST VERIFY** |
| **D-38** | **Shift times stored as `text`** — `ShiftDefinition.start_time` / `end_time`. A shift window is a time-of-day, not an instant, and must not be swept into the `timestamptz` conversion | Migration `20260829000000_add_resource_planning:111-125` | **P3** | **C2 MUST FIX** (with the OD9 re-declaration) |
| **D-39** | **`Organization.timezone` / `Site.timezone` default to `"UTC"`**, contradicting the selected operational zone (Asia/Kolkata) and the live session zone (Asia/Calcutta). **Three different zones in one system** | `schema.prisma:1002`, `:1458` | **P0** | **C2 MUST FIX — gate G6** |
| **D-40** | **Hard-coded `Asia/Kolkata` in WhatsApp paths** instead of the resolved operational zone | `MessageProcessor.ts:378, 439`; `QueryHandler.ts:163`; `whatsapp/updates/[updateId]/approve/route.ts:80` | **P2** | **C2 MUST FIX** |
| **D-41** | **B8 — live enum has 5 of 8 `ActivityStatus` values.** `ExecutionWriteService` writes `'released'` (`:255`), `'verified'` (`:312`), `'closed'` (`:320`) — **none exists in the database.** Three M12 actions cannot persist | `schema.prisma:3026-3035` vs live `pg_enum` | **P0** | **C2 MUST FIX — gate G3** |
| **D-42** | **UI offers `cancelled` but the API refuses it.** `executionFieldGuard.ts:74-77` has no `cancelled` case; the dropdowns still list it | `ActivitiesPanel.tsx:57`; `ScheduleContainer.tsx:1828` | **P2** | **C2 MUST FIX** |
| **D-43** | **Query with no soft-delete filter** — counts deleted activities toward job completion | `JobCompletionService.ts:20` | **P2** | **C2 MUST FIX** |
| **D-44** | **`is_milestone: true` queried on a column that exists in neither Prisma nor the database** — the provider throws if invoked. Fourth instance of the B1 class | `PlanningIntelligenceProviders.ts:231` | **P1** | **C2 MUST FIX** |
| **D-45** | **Planned progress computed four times from three different date sources** — baseline planned (EVM PV), current planned (schedule health), and CPM early dates (two S-curve paths). They diverge the moment the schedule slips | §20.3 table | **P2** | **C2 MUST FIX** (name one definition) |
| **D-46** | **Dead public methods on live services** — `ScheduleOrchestrationService.getLookaheadActivities` and `.generateSCurveData` (zero callers); all four `SchedulingService` public methods (zero callers) | `ScheduleOrchestrationService.ts:253-307`; `SchedulingService.ts:48-326` | **P3** | **C2 MAY FIX** |
| **D-47** | **Seed writes `status: 'ready'`** — a value in no enum, Prisma or database | `prisma/seeds/validation-plant-seed.ts:413` | **P3** | **C2 MAY FIX** |
| **D-48** | **`ScheduleForecastService` header contradicts its code** — the comment says `forecast = actual_start + remaining_duration`; line 129 uses **`now`**, not `actualStart` | `ScheduleForecastService.ts:6-7` vs `:129` | **P3** | **C2 MAY FIX** |
| **D-49** | **`remaining_duration` is user-writable and computed by nothing**, yet it drives the `'remaining_duration'` forecast method. Documented as derived; **no service writes it** | `app/api/activities/[id]/route.ts:30,35`; `ScheduleForecastService.ts:97,119` | **P2** | **C2 MUST FIX** (declare it an input or compute it) |
| **D-50** | **A `0.1`-day minimum-duration floor** in the engine, a workaround for flat-24 h `addDays`. Must not survive into working-time arithmetic unexamined | `scheduleEngine.ts:144-146` | **P3** | **C4 MUST RE-EVALUATE** |
| **D-51** | **A fourth hard-coded hours-per-day**, bypassing `CalendarEngine` | `ResourceLevelingService.ts:86, 135` | **P2** | **C2 MUST FIX** |
| **D-52** | **Export fabricates a DURATION** — `duration_hours ?? 8`, contradicting the schema default of `0`, the 10 h fallback and the 12 h shift data | `MsProjectXmlFormatter.ts:183` | **P2** | **C2 MUST FIX** |
| **D-53** | **Export strips the timezone marker from a UTC instant** (`.toISOString().replace('.000Z','')`), so the receiving tool reads a +05:30 value as local — the export-side face of the §17.3 conflict | `MsProjectXmlFormatter.ts:185, 188` | **P1** | **C2 MUST FIX — with the conversion, not after** |
| **D-54** | **The S-curve "Forecast" series is a CURRENCY (EAC), not a date**, while `ScheduleForecastService` publishes a forecast **date** under the same word | `mapEventCurveToChart.ts:47`; `SCurveChart.tsx:144`; `EvmSnapshotService.ts:203-208` | **P2** | **C2 MUST FIX** (relabel) |

**Totals:** P0 = **12** · P1 = **14** · P2 = **22** · P3 = **12** — **58 defects**.
**C2 MUST FIX = 47 · C2 MAY FIX = 6 · POST-C2 = 2 · C4 MUST RE-EVALUATE = 1 · C2 MUST VERIFY = 0**
(D-37 upgraded from *verify* to MUST FIX).

**The shape of the register is the argument of this document.** All twelve P0 defects are either the
multiple-writer problem itself (D-07), the unwired commitment window (D-21), or **pure
schema/migration/timezone state** (D-23 … D-30, D-39, D-41). **Not one P0 is a question about what a
date means.**

### 23.1 One defect class, now with four instances

B1, B7, B8 and D-44 are the same failure in four directions, and C2 must treat them as one workstream
rather than four bugs:

| Instance | Prisma says | Database says | Broken today |
|---|---|---|---|
| **B1** (D-27) | `Activity.project_id`, `schedule_source` **exist** | absent | Activity **reads and creates** |
| **B7 / OD9** (D-23/24/25) | 3 models **do not exist** | tables exist, 38 rows | All shift + capacity operations |
| **OD9 variant** (D-26) | `EventPhase` **does not exist** | table also absent | The phases route and page |
| **B8** (D-41) | 3 enum values **exist** | absent | 3 M12 execution actions |
| **D-44** | `is_milestone` **does not exist** | absent | One M14 report provider |

> **Five runtime breaks, one root cause: `prisma/schema.prisma` and the live database have drifted in
> both directions simultaneously.** This is why gate G3 cannot be satisfied by a single `migrate diff`
> and why migration safety is RED.

**The shape of the register is the argument of this document.** All ten P0 defects are either the
multiple-writer problem itself (D-07), the unwired commitment window (D-21), or **pure
schema/migration state** (D-23 … D-30). **Not one P0 is a question about what a date means.**

---

## 24. OD9 / Schema Reconciliation Gate

> ### ⛔ NO DESTRUCTIVE MIGRATION MAY BE GENERATED OR APPLIED UNTIL THIS GATE CLEARS.

### 24.1 The frozen principle

> **DO NOT blindly re-declare every missing model. Classify each missing accessor first.**

```
For each Prisma accessor called by code but absent from schema.prisma:

  IF a live table with data exists   →  RE-DECLARE the model and reconcile
                                        (inspect relations, indexes, constraints; PRESERVE rows)

  IF neither model nor table exists  →  REMOVE / RETIRE the orphan caller
```

A blanket "re-add every missing model" would resurrect a feature nobody built. A blanket drop
would destroy 38 rows of live configuration.

### 24.2 The cases, classified

| Model / object | Table | Data | Callers | Classification | Remedy |
|---|---|---|---|---|---|
| `ShiftDefinition` | ✅ exists | **6 rows** (Day 06:00–18:00, Night 18:00–06:00, across 3 events) | `ResourcePlanningService` (15 sites) | **Table + data exist** | **RE-DECLARE** from the existing DDL |
| `ResourceCapacity` | ✅ exists | **30 rows** | Same 15 sites | **Table + data exist** | **RE-DECLARE** from the existing DDL |
| `workpack_asset_snapshots` | ✅ exists | **2 rows** | — | **Table + data exist** | **RE-DECLARE** |
| **`EventPhase`** | ❌ **absent** | **none** | `app/api/events/[eventId]/phases/route.ts:22-28`; `app/(dashboard)/events/[eventId]/phases/page.tsx` | **Neither model nor table** | **DELETE the route and page** |
| **`ActivityStatus` enum values** (B8) | enum exists with **5** of 8 members | — | `ExecutionWriteService.ts:255, 312, 320` writes all three missing values | **Declared in Prisma, absent in DB — the mirror of B7** | **ADD the 3 values to the database** (§7.2.1) |
| **`Activity.is_milestone`** | ❌ **absent** | — | `PlanningIntelligenceProviders.ts:231` | **Neither column nor declaration** | **FIX the query** (D-44) |

**OD9 is therefore wider than previously recorded: four missing models plus two non-model drift
objects, and four distinct remedies.** The `EventPhase`, enum and `is_milestone` variants must each be
classified **separately** and must **not** be swept into the re-declaration set — re-declaring a model
and adding an enum value are different migrations with different risk.

**The re-declaration is not a design task.** The authoritative DDL for both resource-planning models
already exists in the repository at
`prisma/migrations/20260829000000_add_resource_planning/migration.sql:111-146` [SOURCE]. **The models
were dropped from `schema.prisma` after that migration ran** — the migration history and the database
agree with each other, and only the schema disagrees with both. C2 re-declares to match the DDL
verbatim, preserving `target_date DATE` and `start_time`/`end_time TEXT` as written (§11.1.1,
D-38).

### 24.3 Why this is a time-contract prerequisite, not just hygiene

Three consequences, all blocking:

1. Those accessors **do not exist on the generated client** — every shift and capacity operation
   **throws at runtime** today.
2. `migrate diff` proposes dropping the tables **because the schema no longer declares them.** It
   is reporting drift faithfully. **Running it deletes 38 rows.** This is the mechanical
   explanation of B2.
3. **`ShiftDefinition` holds the plant's real working time** — the input C4 needs and §10.9 step 3
   depends on. It is currently unreachable from application code, which is why CPM runs on a
   hard-coded 10-hour fallback while the data says 2 × 12 h.

### 24.4 Required order

```
1.  Verified pg_dump + test restore                      (B3 / G10)
2.  Classify every missing accessor                      (§24.2)
3.  Re-declare where data exists; delete orphan callers   (OD9)
4.  Reconcile B1: add Activity.project_id AND schedule_source, or remove both from Prisma
5.  Make migration history reproducible                  (B3)
6.  Confirm prisma.activity.findFirst() AND an Activity create both succeed
7.  Verify migrate diff is now NON-DESTRUCTIVE
    ─────────────────────────────────────────────────────
8.  ONLY THEN: time-schema changes (timestamptz, lag_minutes, constraint columns)
```

**Steps 1–7 involve no time semantics whatsoever.** They are pure database-state repair and can
begin immediately — they require no further decisions.

---

## 25. C4 Contract

### 25.1 C4 MUST

| # | Requirement |
|---|---|
| 1 | **Reuse the existing calendar logic.** `CalendarEngine`'s `addWorkingDays`, `hoursToDays`, `isWorkingDay`, `subtractWorkingDays`, `workingDaysBetween` are proven and tested. Consume them |
| 2 | **Connect the calendar to M11.** Pass the full calendar into `calculateSchedule`, not only `hours_per_day` |
| 3 | **Support real working days** — `ScheduleCalendar.work_days` must reach the engine |
| 4 | **Support holidays / exceptions** — via `ScheduleCalendar.exceptions`, not a new model |
| 5 | **Support shifts** — `ShiftDefinition` (requires **OD9** first) |
| 6 | **Support resource capacity where required** — for **levelling only**, never as a CPM date input |
| 7 | **Preserve wall-clock lag** — `lag_minutes` is never calendar-adjusted (§10.5) |
| 8 | **Preserve timezone** — all arithmetic in the selected operational timezone; no implicit UTC coercion |
| 9 | **Produce deterministic planned dates** — identical inputs yield identical dates, independent of run time, request parameters, and server locale |

### 25.2 C4 MUST NOT

| # | Prohibition |
|---|---|
| 1 | **Create another calendar engine.** One exists and is correct |
| 2 | **Create another CPM engine.** One exists; a second (`SchedulingService.calculateProjectSchedule`) is being retired, not replicated |
| 3 | **Write dates outside M11** |
| 4 | **Create another constraint model.** The §8 carrier is the only one |
| 5 | **Make `MaterialScheduleIntegrationService` a date writer** — nor leave it as a silent input substituter (§12.3) |

### 25.3 C4 preconditions

C2 must have delivered the constraint columns **before** C4 transfers planned-date ownership to
M11 — otherwise the engine seeds from the column it is about to write (§5.1). **OD9 must have
cleared**, or `ShiftDefinition` remains unreachable and requirement 5 is impossible. **OD10 must
be authorised**, or `ActivityCreationCommand` and M11 cannot legally be edited.

---

## 26. C2 Preconditions

### 26.1 The gates

| Gate | Condition | State | Blocking? |
|---|---|---|---|
| **G1** | **C1 contract frozen** | ✅ **GREEN** — this document | — |
| **G2** | **OD9 schema-reconciliation plan approved** (four models, two remedies — §24.2) | ⛔ **RED** | **YES** |
| **G3** | **B1 / B2 / B3 / B8 reconciled** — column drift (both columns), **enum drift (3 missing `ActivityStatus` values, D-41)**, non-destructive diff, reproducible history. Includes removing the seven stale schema copies (**D-18**) and the `is_milestone` phantom (**D-44**) | ⛔ **RED** | **YES** |
| **G4** | **B7 models reconciled** — `ShiftDefinition`, `ResourceCapacity`, `workpack_asset_snapshots` re-declared with rows preserved | ⛔ **RED** | **YES** |
| **G5** | **`EventPhase` orphan resolved** — caller deleted (no model, no table) | ⛔ **RED** | **YES** |
| **G6** | **Timezone conversion semantics EXECUTED and approved** — the `timestamp` → `timestamptz` round trip proven on a restored copy under the +05:30 session offset; the alias standardised (**D-20**); **and the three-way conflict resolved** between the schema's `"UTC"` defaults, the session's `Asia/Calcutta` and the chosen `Asia/Kolkata` (**D-39**, §17.3.1) | ⛔ **RED** | **YES** |
| **G7** | **Timestamp migration dry-run** on a restored copy, with before/after row-level comparison of all 4 `Activity` + 2 `Event` columns | ⛔ **RED** | **YES** |
| **G8** | **Epoch-row correction plan prepared** — the 3 rows corrected or nulled by explicit decision, never silently converted | ⛔ **RED** | **YES** |
| **G9** | **Lag migration plan prepared** — `lag_minutes = lag_days × 1440`, with the record explicitly stating it preserves **engine behaviour, not author intent** (§9.2), plus `lag_hours` → minutes | 🟡 **AMBER** — rule proven, plan not written; **OD7** ratification outstanding | **YES** |
| **G10** | **No destructive migration without a verified snapshot and rollback** — `pg_dump` **and a proven test restore** | ⛔ **RED** | **YES** |

**G6 and G7 require EXECUTED evidence.** A written plan does not satisfy them. This is the single
most important line in this section: the +05:30 skew was *observed*, and the only acceptable proof
that a conversion is safe is a conversion that has been run and inspected on a copy.

### 26.2 Migration safety — 🔴 **RED**

Four conditions, **each independently sufficient** to cause data loss or an unreproducible database:

1. **`migrate diff` is destructive today** — it proposes dropping 8 tables, 3 populated, 38 rows,
   because the schema has lost four model declarations (D-28, D-23/24/25).
2. **Migration history is not reproducible** — 6 unapplied migrations while a later one is applied,
   ~30 with `applied_steps_count = 0`, and the baseline recorded as rolled back (D-29). The
   database cannot currently be rebuilt from its own history.
3. **The timezone conversion is untested** against a live +05:30 session offset on date-only
   columns (D-30) — **and the system does not agree with itself about which timezone it operates in**
   (D-39: schema defaults `"UTC"`, session `Asia/Calcutta`, chosen `Asia/Kolkata`). A
   `date → timestamptz` conversion is precisely the operation that makes that disagreement permanent.
4. **Schema and database have drifted in both directions at once**, producing **five runtime breaks**
   from one root cause (§23.1). A single `migrate diff` cannot resolve drift that runs both ways.

Additionally, **the pre-migration state is not a working baseline**: activity creation is already
broken (D-27), and three M12 execution actions cannot persist (D-41).

> **Per §30 of the instruction: migration safety is not GREEN, therefore C2 remains BLOCKED.**

### 26.3 What may proceed now

Gates G2–G5, G8 and G10 involve **no time semantics** and need **no further decisions**. They are
database-state repair and can start immediately, in parallel. G6/G7 need a restored copy, which
G10 produces. **The critical path to C2 runs through G10 → G3/G4/G5/G2 → G6/G7 — not through any
remaining product question.**

---

## 27. Acceptance Matrix

| # | Requirement (from the instruction) | Met | Where |
|---|---|---|---|
| 1 | Governing authority model frozen (§1) | ✅ | §3 |
| 2 | Every time fact A–T given meaning, owner, writer, direction, entry, consumers | ✅ | §4.1 — 20 facts |
| 3 | Every time fact given all 8 behavioural attributes | ✅ | §4.2 |
| 4 | Forecast dates addressed even though absent | ✅ | §4.1 T, §20.2 — **recorded absent, not invented** |
| 5 | `Activity.planned_*` frozen as M11 outputs | ✅ | §5.1 |
| 6 | All 10 named current writers classified | ✅ | §5.2 — 15 rows |
| 7 | No writer left as a second planned-date authority | ✅ | §5.2, §21 matrix |
| 8 | Constraint carrier frozen with reason/author/timestamps | ✅ | §8.1 |
| 9 | Permitted constraint types defined; SNET + FNLT evaluated | ✅ | §8.2 |
| 10 | `MUST_START_ON` / `MUST_FINISH_ON` explicitly decided | ✅ | §8.2 — **NOT IMPLEMENTED**, proven absence |
| 11 | Constraint calculation rule frozen with the worked example | ✅ | §8.3 — 14:00 does not erase why |
| 12 | Canonical lag = signed `lag_minutes` | ✅ | §9.1 |
| 13 | Positive / zero / negative / display / import-export / validation / CPM all documented | ✅ | §9.1–9.5 |
| 14 | Corpus conversion vs future authoring kept distinct | ✅ | §9.2 — `× 1440` does **not** recover intent |
| 15 | Negative-lag clamp preserved as policy, **not** silently as behaviour | ✅ | §9.5 — warning mandated; test must change |
| 16 | Calendar contract: all 14 required elements | ✅ | §10.1–10.8 |
| 17 | `duration ≠ lag` preserved | ✅ | §10.5, §10.6 |
| 18 | Two calendar worlds reconciled to ONE authority | ✅ | §10A — Option B, with the World-A framing corrected |
| 18b | Shift / capacity contract; B7 carried forward | ✅ | §11 |
| 19 | Event window frozen; null / overrun / negative float / triggers defined | ✅ | §6.3–6.6 |
| 20 | Workpack dates retired; span inclusion rule fully explicit | ✅ | §7.1–7.3 — all 8 declared statuses + NULL + soft-delete |
| 20b | Enum drift (B8) recorded; the span rule survives the reconciliation | ✅ | §7.2.1 — **new P0, D-41** |
| 20c | The `cancelled` row reconciled against the live census | ✅ | §7.2.2 — it **is** the soft-deleted row |
| 20d | Competing "active activity" filters enumerated and one chosen | ✅ | §7.2.3 — 4 variants |
| 21 | Span propagation without a Sync click | ✅ | §7.4, §18.3 invariant 3 |
| 22 | `date-range` route and Sync button classified | ✅ | §21 rows 13–14 |
| 23 | M10 duplicate-date presence test replaced | ✅ | §13.1–13.2 |
| 24 | Six readiness facts kept distinct | ✅ | §13.3 |
| 25 | M10 prevented from becoming a date writer | ✅ | §13.5 |
| 26 | Material availability role frozen | ✅ | §12 |
| 27 | Resource capacity / shifts carried forward as B7 | ✅ | §24 |
| 28 | `EventPhase` classified **separately** | ✅ | §24.2 |
| 29 | Schema reconciliation defined as a migration prerequisite, not time semantics | ✅ | §24.3, §26.3 |
| 30 | Timestamp targets frozen | ✅ | §17.1 |
| 31 | No invented time-of-day; provenance recorded | ✅ | §17.2 |
| 32 | Timezone explicitly chosen, not assumed UTC, basis stated | ✅ | §17.3 |
| 32b | Repository evidence for the zone tested rather than asserted | ✅ | §17.3.1 — **NO zone is pinned anywhere**; three conflicting defaults found |
| 32c | The `Organization`/`Site` `"UTC"` default recorded as a conflict with the chosen zone | ✅ | §17.3.2, **D-39**, gate G6 |
| 33 | M12 not reopened; no planned → actual copy | ✅ | §5.4 |
| 34 | Baseline contract with the span option chosen | ✅ | §14.2 — **Option B** |
| 35 | Baseline `new Date()` fabrication recorded | ✅ | §14.3, D-01 |
| 36 | Scenario contract; promote → change request → governed input | ✅ | §15 |
| 37 | Read-only CR UI vs levelling button recorded as a C2 issue | ✅ | §15.3, D-04 |
| 38 | One governed change-control pattern | ✅ | §16.1 |
| 39 | Enter-once lineage end to end | ✅ | §18.1 |
| 40 | No re-entry of the five named facts | ✅ | §18.2 |
| 41 | Import/export contract for all six channels | ✅ | §19.2 |
| 42 | All `now()` fallbacks recorded | ✅ | §19.3 |
| 43 | Reporting sources determined; forecast marked OPEN/absent | ✅ | §20 |
| 43b | Planned progress: **not** absent — four divergent implementations recorded | ✅ | §20.3, **D-45** |
| 43c | The five variance authorities distinguished (baseline / plan / actual / cost / scenario) | ✅ | §20.4 |
| 44 | No new calculation engine anywhere | ✅ | §3, §10A, §25.2 |
| 45 | Authority matrix containing every §2 fact | ✅ | §21 |
| 46 | Current → target writer migration matrix | ✅ | §21 (26 rows) |
| 47 | Defect register with all 19 required items | ✅ | §23 — 58 defects |
| 48 | P0–P3 and MUST/MAY/POST assigned | ✅ | §23 |
| 48b | Bidirectional schema drift consolidated as one workstream | ✅ | §23.1 — 5 runtime breaks, 1 root cause |
| 49 | C4 contract: must / must not | ✅ | §25 |
| 50 | C2 preconditions G1–G10 | ✅ | §26.1 |
| 51 | Evidence classified throughout; no inference called proven | ✅ | Inline tags |
| 52 | Already-GREEN decisions not reopened | ✅ | §2 |
| 53 | Read-only; only this document created | ✅ | §28.3 |

---

## 28. Final C1 Decision

### 28.1 The required declarations (§30)

| Question | Answer |
|---|---|
| **C1** | ✅ **FREEZABLE** |
| **Semantic contract** | ✅ **FROZEN** |
| **C2** | ⛔ **BLOCKED** |
| **OD9** | **REQUIRED** — and wider than recorded: **four** missing models plus **two** non-model drift objects, **four** distinct remedies (§24.2) |
| **C4** | ✅ **DEFINED** (§25) |
| **Blocking ambiguity** | **NONE** |
| **Migration safety** | 🔴 **RED** (§26.2) |

> **Because migration safety is RED, C2 remains BLOCKED.** That is the instruction's own rule and
> it is the correct outcome: the contract is complete, and the database is not yet safe to change.

**These seven declarations were re-tested against three post-freeze forensic sweeps** (calendar model,
timezone evidence, activity lifecycle) and **none changed.** The sweeps produced two new P0 defects
(**D-39** timezone conflict, **D-41** enum drift), corrected seven factual claims (listed in §1), and
widened OD9 — all of which **reinforce** `Migration safety: RED` while leaving
`Blocking ambiguity: NONE` intact. That asymmetry is the finding: **every new discovery was about
database state or duplicated implementation, and not one was about what a date means.**

### 28.2 Open items — none of which is a semantic ambiguity

| # | Item | Class | Blocks |
|---|---|---|---|
| **OD5** | `override_start_date` — retire or govern | Operational policy | C6 |
| **OD7** | Ratify the six-row lag fixture classification | Ratification of an **[INFERENCE]** | C3 / gate G9 |
| **OD8** | Material availability — CPM constraint or readiness-only | Product capability | Future phase |
| **OD9** | Re-declare three models; delete one orphan caller | **Engineering prerequisite** | **C2** |
| **OD10** | Lift the freeze on `ActivityCreationCommand` + M11 | **Governance authorisation** | C4 / C5 |
| **OD11** | **NEW** — should forecast finish (and planned progress) be **persisted**? | Product capability | Future phase |

**Why none of these blocks the freeze.** OD5 and OD8 are capability choices whose answers do not
alter any frozen semantic — §12.2 and §16.2 already specify the *shape* either answer must take.
OD7 ratifies an inference about six fixture rows. OD9 is engineering. OD10 is an authorisation.
OD11 asks whether to *store* a value the contract already defines as transient. **Not one of them
is a question about what a date means** — and that is precisely the difference from the two
previous gates, where the open items were about meaning.

### 28.3 §32 Final safety check

| Check | Result |
|---|---|
| Only the new C1 document created | ✅ Verified by modification time (§28.4) |
| No source code changed | ✅ |
| No schema changed | ✅ `prisma/schema.prisma` unmodified (09-Sep-2026 13:34:57) |
| No migration created or applied | ✅ No `prisma migrate` command was run |
| No database data changed | ✅ Read-only inspection only; no `INSERT` / `UPDATE` / `DELETE` / `ALTER` / `DROP` |
| No tests changed | ✅ |
| No seed changed | ✅ |
| No generated artifacts remain | ✅ No temporary capture file was created by this task |

**Nothing discovered during this task was fixed.** **Twenty new defects (D-17 … D-20, D-38 … D-54)**
plus the sharpened B1 finding and the new blocker **B8** are recorded and left in place. In
particular, the three M12 execution actions that cannot persist (D-41) were **not** repaired, and the
`Organization`/`Site` `"UTC"` defaults (D-39) were **not** changed — both are C2 work behind gates G3
and G6.

The `§28`/`§9.1` strand-count inconsistency in the predecessor document was **not corrected**, because
§29 permits creating only this file.

### 28.4 The one governing question

> *"Can AURIANOA enter a time-related business fact once, preserve it with correct time precision
> and authority, automatically propagate it through planning, execution, progress, Control Tower,
> reporting and management, while safely handling incomplete legacy data?"*

# SEMANTICALLY YES. OPERATIONALLY NOT YET.

**The contract now answers the question completely.** Every time fact has exactly one meaning, one
owner, one writer and one lifecycle (§4, §21). Every current violation has a named target role
(§21 matrix). The propagation chain is specified end to end with no re-entry (§18). Incomplete
legacy data is handled by preserving absence rather than fabricating values (§17.2, §19.3).

**What stands between the contract and the behaviour is not a decision — it is a database.** Twelve
P0 defects, of which **ten** are pure schema, migration or timezone state (D-23 … D-30, D-39, D-41)
and **not one is a semantic question**. The system currently cannot create an activity (D-27), cannot
release, verify or close one (D-41), and does not agree with itself about which timezone it operates in
(D-39). That is why C1 freezes today and C2 does not start today.

**Recommended sequence:**

```
G10 (verified dump + test restore)
   → G2/G3/G4/G5 (OD9 + B1/B2/B3 reconciliation)   ── no decisions needed, start now
   → G6/G7 (executed timezone + timestamp dry-run)
   → G8/G9 (epoch + lag plans; OD7 ratification)
   → C2  schema: constraint columns, timestamptz, span columns, drops
   → C3  lag migration
   → OD10 authorisation
   → C4  M11 planned-date authority + calendar connection
   → C5–C9
```

---

**END — AURIANOA R1.0-C1 TIME AUTHORITY CONTRACT**

*READ-ONLY. No application code, Prisma schema, migration, database row, seed, test, UI or API was
created or modified by this task; the only file written is this document. No migration was
generated or applied. D8, D9, D10, OD1, OD6, M12, M8.13, M10, M13, M14, M15, M16 and R0.4 Event
authority were not reopened. `ActivityCreationCommand` and `ExecutionWriteService` are untouched.
C2 was not started. C4 was not implemented. OD1/OD6 were not re-decided. Every defect found was
recorded and left in place.*
