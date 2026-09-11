# AURIANOA — Phase 2 Authority Consolidation Draft

**Status:** DRAFT — do not execute until the architect says go.  
**Date:** 2026-09-11  
**Predecessor:** Phase 0 done · Phase 1a done · Phase 1b done and verified (46/23 snapshot identical after flip; A5/A6/A8/A9 behavioural).  
**Source of truth:** `docs/AURIANOA_STO_E2E_PROCESS_DATA_LINEAGE_AUDIT.md` §26 items 11–16, §28 authority table, §29 risks 5–6, §30 A12/A13/A14.

This draft is written from a discovery pass against the tree **after** Phase 1 landed, not from the audit’s original guess. Several audit claims are now stale; the prompt below pins the current facts so the next session does not re-discover them.

---

## 1. What Phase 1 actually touched (do not reopen)

Phase 1 changed the **time model and planned-date authority**. Phase 2 is a different axis (who owns equipment / area / discipline / punch / readiness / progress). Crossing these wires will silently undo 1b.

### Schema Phase 2 must leave alone

| Object | Why |
|---|---|
| `Activity.planned_start` / `planned_end` as `timestamptz(3)` | 1a widening |
| `Activity.planned_start_override` / `planned_end_override` / `planned_derived_*` / `planned_override_*` | 1b snapshot + TYPE 5 |
| `Activity.early_*` / `late_*` / `total_float` (hours) | M11 persist |
| `ActivityRelationship.lag_minutes` (canonical) + leftover `lag_days` | 1a lag |
| Any other operational `@db.Timestamptz(3)` columns from 1a | do not retype |

### Code Phase 2 must not rewrite

| File | Role after Phase 1 |
|---|---|
| `src/lib/scheduleEngine.ts` | Calendar-aware CPM; `actual_end` feeds FS; ISO timestamps |
| `src/core/schedule/ScheduleOrchestrationService.ts` | Sole Event CPM persist |
| `src/core/schedule/PlannedDateAuthority.ts` | Writes `planned_*` from CPM unless override |
| `src/core/schedule/plannedDateGuard.ts` | 409 on silent planned-date writes |
| `src/lib/CalendarEngine.ts` | Already wired; do not “re-integrate” |
| `src/lib/lagFormat.ts` | Canonical lag display |
| `app/api/activities/[id]/planned-override/route.ts` | Override API |
| `tests/sprint1a-time-model.test.ts` | A5 / A8 |
| `tests/sprint1b-planned-date-authority.test.ts` | A6 / A9 |

### Protected authorities (§29 risk 6) — still in force

Do **not** touch: `ExecutionWriteService` (EWS), `ProgressCalculationService` (M8.13 core), M16 channel delegation. Phase 0 already extended `ExecutionReadinessService` to gate START/RELEASE on material + isolation — leave that gate; Phase 2 item 15 is the **planning** readiness store, not execution readiness.

### Dual fields Phase 2 must not “unify”

| Pair | Owner after Phase 1 | Wrong move |
|---|---|---|
| `planned_start` vs `early_start` | Same authority (M11); `planned_*` is effective, `early_*` is CPM-native | Do not drop either; do not make planned dates editable again |
| `lag_minutes` vs `lag_days` | `lag_minutes` canonical | Do not convert back to days |
| `Event.planned_start` vs `Project.planned_sd_date` | Event | Out of Phase 2 scope (legacy quarantine already done in Phase 0) |

---

## 2. What discovery found today (Phase 2 starting facts)

| Item | Audit assumed | Tree today | Implication |
|---|---|---|---|
| **11 Punch** | Two live registers | `PunchListItem` is the live Event-chain register. `punch_items` has **no writers** in `src/`, legacy API returns **410** unless the quarantine flag is on, and an OD9 doc recorded **0 rows**. JCC reads **only** `PunchListItem` (`JobCompletionService.ts:21-23`) and ignores `_orgId`. | Retirement is cheap if census is still 0. A14 is still architecturally open until JCC cannot miss a Cat-A regardless of table. |
| **11 Lessons** | Two live registers | Workpack UI (`LessonsLearntPanel`) already calls `/api/workpacks/[id]/lessons` → `LessonLearned`. `lessons_learnt` is an **orphaned API** (`LessonsLearntService`) with no UI caller found. | Likely a migrate-if-any-rows + delete route, not a UI rewrite. |
| **12 Asset** | “Add `area_id`” | `Asset.area_id` **column already exists** (empty, no Prisma relation, no writers). `equipment_type_id` FK exists but Asset CRUD does not write it. `asset_type`, `is_active`, `plot_area` still written. `status` enum is the intended replacement for `is_active`. | Do not add a second `area_id`. Wire the FK + writers; then retire the copies. |
| **13 Scope text** | Convert to FKs | Unchanged. `ScopeItem.discipline` text; `ScopePackage.discipline` / `area` / `contractor` text. Downstream Workpack/Activity/Punch already use `discipline_id`. | Real mapping + backfill work. |
| **14 Workpack dups** | Delete one side | Unchanged. Factory writes **both** `Workpack.scope_item_id` (no relation) and `ScopeItem.workpack_id` (real FK). `/workpacks/new` still creates packs with no scope link. | `ScopeItem.workpack_id` is the keeper. |
| **15 Readiness** | One store | Execution readiness **already extended** (Phase 0). Planning readiness still dual-written: `Workpack.readiness_score` default 0 **and** `WorkpackInstantiation.readiness_score` / `compliance_score` default **100**. | Phase 2 is the planning store only. |
| **16 Progress / S-curve** | Six rivals | Fabricated S-curve **deleted** (Phase 0). Legacy project `/s-curve` **retired**. Event progress/EVM paths already call M8.13/M8.10. Remaining rivals: `unit-progress` simple average, `ShutdownProviders` average-of-averages, Control Tower lookahead inline, `dashboard-data` third EVM, `ScheduleOrchestrationService` S-curve, client WBS rollup. | A12/A13 are the pass criteria, not “delete every file”. |

---

## 3. Sequencing (same pattern as 1a / 1b)

Phase 2 is lower-risk than Phase 1 **except item 11/JCC** (§29 risk 5): once Cat-A in the surviving register is visible to JCC, workpacks that certify today may stop certifying. Census first.

Do **not** run 2a–2c in one session. Close the session between sprints.

### Sprint 2a — registers (item 11, A14) — no identity-model surgery

Additive until the last step. Goal: one punch register, one lessons register, JCC cannot miss a Cat-A.

1. Take a full DB backup; restore and verify on a staging copy first.
2. Census live rows: `punch_items`, `PunchListItem`, `lessons_learnt`, `LessonLearned` (deleted vs live, org, workpack). Confirm the OD9 “0 punch_items” claim is still true.
3. If `punch_items` is empty: do not invent a data migration. Quarantine is already in place. Drop or mark the model unused only after JCC + A14 tests exist against `PunchListItem` **and** a behavioural test that a Cat-A inserted through the legacy shape (if any rows appear) cannot certify. If rows exist: map into `PunchListItem` (org from workpack, category/status normalised), then drop writers/readers.
4. Org-scope JCC punch counts (`_orgId` is accepted and unused today).
5. Lessons: census `lessons_learnt`. If empty or unused, retire `LessonsLearntService` + `/lessons-learnt` routes; keep `LessonLearned`. If rows exist, migrate into `LessonLearned` (`is_in_central_register` default false) then retire.
6. Acceptance **A14**: raise a Cat-A, request a JCC — blocked. Add a regression that would have failed when the Cat-A lived only in `punch_items` (seed one mapped row, or prove zero leftover rows and lock that with a census test).

Stop and report census + A14. Do not start 2b until this is verified.

### Sprint 2b — identity FKs (items 12–14)

Breaking for scope/asset/workpack copy fields. Snapshot first.

1. Backup + staging, same as 1a/1b.
2. **Census before any DROP:** counts of `Asset.asset_type` vs `equipment_type_id`, `is_active` vs `status`, `plot_area` vs `area_id`; `ScopeItem.discipline` distinct values vs `Discipline`; `ScopePackage` text vs FKs; `Workpack.scope_item_id` vs `ScopeItem.workpack_id` mismatches; `/workpacks/new` orphans.
3. Item 12: declare `Asset.area_id` → `Area` relation + FK. Write `area_id` / `equipment_type_id` / `status` on Asset create/update/import. Stop writing `asset_type` / `is_active` / `plot_area` from those paths. Do **not** drop the old columns in the same sprint unless the census is empty **and** no reader remains — prefer deprecate + stop-write, drop in a follow-up if readers are wide.
4. Item 13: add `ScopeItem.discipline_id` and `ScopePackage.discipline_id` / `area_id` / `contractor_id`. Backfill from text via `ControlledValueResolver` (already used for equipment type). Keep text columns readable until backfill verified.
5. Item 14: treat `ScopeItem.workpack_id` as the only link. Stop writing `Workpack.scope_item_id`. Repair mismatches (census them; do not guess). Factory already writes both — remove the Workpack-side write. Do not delete `unit_code` / `work_type` / `equipment_type` copies in the same PR as the link fix unless census says they are unused.
6. Report mismatch counts before and after. They must not get worse.

### Sprint 2c — readiness + progress authority (items 15–16, A12, A13)

No schema drop required if 2b already chose a store.

1. Item 15: pick `Workpack.readiness_score` / `compliance_score` as the single planning store (§28). Stop writing the pair on `WorkpackInstantiation` (or make Instantiation a labelled cache that copies Workpack, never a second formula). Align defaults (0 vs 100 is the bug). `ReadinessScoreService` and `WorkpackIntelligenceService` must write one place.
2. Item 16: do **not** delete Event M8.13/M8.10 routes. Replace the remaining rivals so they **call** those services:
   - `app/api/projects/[id]/activities/unit-progress/route.ts` — duration-weighted M8.13, not simple average
   - `src/core/report-engine/providers/ShutdownProviders.ts` — do not average already-weighted event percents
   - `src/core/control-tower/ControlTowerQueryService.ts` lookahead — M8.13
   - `app/api/reporting/dashboard-data/route.ts` — M8.10, not a third EVM
   - `ScheduleOrchestrationService.generateSCurveData` — M8.10 `generateEventCurve`
   - Client WBS rollups (`ScheduleContainer`, `WbsView`) — display server values; do not recompute
3. Acceptance **A12**: same unit progress from Control Tower, reports, dashboard, unit-progress route.
4. Acceptance **A13**: every S-curve point traces to stored planned/actual facts; no `(i/n)` interpolation (already gone from schedule/metrics — keep it gone).

---

## 4. Executable prompt (paste into a fresh session)

Use this after the architect says go. Run **2a only** unless the prompt is edited to name 2b or 2c.

```
You are working in the AURIANOA/STO codebase at C:\DEV\STO.

Phase 0, 1a and 1b are done. Do not reopen the time model.
Read docs/AURIANOA_PHASE2_AUTHORITY_CONSOLIDATION_DRAFT.md and
docs/AURIANOA_STO_E2E_PROCESS_DATA_LINEAGE_AUDIT.md §26 items 11–16,
§28, §29 risks 5–6, §30 A12–A14.

DO NOT TOUCH: ExecutionWriteService, ProgressCalculationService (M8.13 core),
M16 adapters, scheduleEngine, PlannedDateAuthority, plannedDateGuard,
CalendarEngine wiring, Activity planned_* / override / lag_minutes columns,
or the 1a/1b tests except to keep them passing.

Take a full database backup first and verify on a staging copy.

=== SPRINT 2a ONLY — punch + lessons registers (A14) ===
1. Census punch_items, PunchListItem, lessons_learnt, LessonLearned.
   Report live/deleted counts before any DML.
2. If punch_items has rows, migrate them into PunchListItem (org from
   workpack; normalise category/status). If it is empty, do not invent rows.
3. Org-scope JobCompletionService punch counts (today _orgId is unused).
4. Retire or 410 the leftover punch_items / lessons-learnt write paths
   after migration. Workpack UI already uses PunchListItem and LessonLearned
   — do not rebuild those panels.
5. Behavioural test for A14: Cat-A punch blocks JCC. Also lock the
   punch_items leftover count (must stay 0 after migrate, or the migrated
   Cat-A must block).

Stop. Report census before/after and A14. Do not start items 12–16.
```

---

## 5. Token estimate (updated after Phase 1b)

Caveat unchanged: order-of-magnitude, not a quote. Fresh session per sprint.

| Phase | Estimated tokens | Status |
|---|---|---|
| Phase 0 | ~~400K–900K~~ | **Done** |
| Phase 1a | ~~1.2M–2.2M~~ | **Done** |
| Phase 1b | ~~1.5M–2.5M~~ | **Done** — snapshot 46/23 identical after flip; A6/A9 pass; A5/A8 still pass |
| Phase 2a (registers + A14) | 400K–900K | Next |
| Phase 2b (identity FKs 12–14) | 800K–1.6M | After 2a |
| Phase 2c (readiness + progress A12/A13) | 800K–1.6M | After 2b |
| Remaining A-tests + regression (A1–A4, A7, A10–A11 already Phase 0; A15–A17 later) | 600K–1.2M | Ongoing |
| **Remaining through January** | **~2.6M–5.3M** | Was ~5.7M–10.2M when 1b was still open |

Phase 2a should come in at the low end if `punch_items` is still empty and lessons UI is already on `LessonLearned` — same pattern as Phase 0 (verify and retire, don’t rebuild).

---

## Appendix A — Phase 1 touch inventory (post-verification)

Condensed from the [Phase 1 touch inventory](6e84ace4-8dda-4543-a8fa-5bd266d62b66) pass. Use this as the “do not reopen” checklist for every Phase 2 session.

**Migrations:** `20260910233000_sprint1a_time_model_widening`, `20260911000000_sprint1b_planned_date_overrides`.

**Authority core:** `PlannedDateAuthority.ts`, `plannedDateGuard.ts`, `ScheduleOrchestrationService.ts`, `scheduleEngine.ts`, `CalendarEngine.ts`, `lagFormat.ts`, `app/api/activities/[id]/planned-override/route.ts`.

**Tests that must keep passing:** `tests/sprint1a-time-model.test.ts` (A5, A8), `tests/sprint1b-planned-date-authority.test.ts` (A6, A9).

**39 operational date columns** widened to `timestamptz(3)` in 1a (Activity, Event, Workpack, constraints, scenarios, etc.) — Phase 2 must not retype them.

---

## Appendix B — Acceptance test matrix (A1–A17)

| ID | Status after Phase 1 | Owner sprint |
|---|---|---|
| A1–A4 | Open | Phase 0 (event_id / board / baseline) — verify still pass |
| **A5** | **Pass** | 1a |
| **A6** | **Pass** | 1b |
| A7 | Open | Needs behavioural test (duration change → successor moves) |
| **A8** | **Pass** | 1a |
| **A9** | **Pass** | 1b |
| A10–A11 | Open | Phase 0 execution readiness — verify still pass |
| A12–A13 | Open | Phase 2c |
| A14 | Open | Phase 2a |
| A15–A17 | Open | Phase 3 / hygiene |

---

## Appendix C — Leftover `planned_*` writers (Event vs legacy)

Event-chain silent writers were closed in 1b. These paths remain; Phase 2 must not confuse them with register/identity work.

| Path | Chain | Risk | Action |
|---|---|---|---|
| `ProjectWorkpackService.createUnderWbs` | Legacy Project (`event_id` null) | Was silent write | **Fixed** — create leaves `planned_*` null; optional dates go through `PlannedDateAuthority.applyOverride` |
| `P6XerParser` / `P6XmlParser` / `MsProjectXmlParser` | Import (legacy Scheduling) | Parsed dates not yet routed through override at persist | **Deferred** — parsers only referenced from `scripts/test-ms-parser.ts`; wire override + `schedule_source: imported` when import route is next touched |
| `ScenarioCalculationService` | M8.9 what-if | Maps `early_*` → scenario `planned_*` in memory | **By design** — isolated from live authority |
| `ScheduleChangeControlService` `updateData.planned_*` | Event | Looks like double-write | **Audit snapshot only** — DB write is `applyOverride` + optional `duration_hours` update |
| `lagFormat` / export routes | Read | Mixed `/480` vs `/8/60` display | **P2 hygiene** — not Phase 2 authority scope |

Two rules that kept 0/1a/1b cheap still apply: (1) census before DML, (2) new session per sprint.
