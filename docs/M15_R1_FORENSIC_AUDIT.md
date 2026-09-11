# M15-R1 — Forensic Audit

**Date:** 8 September 2026  
**Scope:** Source-tree verification of M15-R0 findings, then the R1 facade and isolation remediations.  
**Method:** Inspected live `src/core`, `app/api`, Prisma usage, and tests. Documentation is not treated as authority.

**Git:** No commit, reset, rebase, or history rewrite. Working tree includes this R1 work plus prior M8–M16 uncommitted work.

---

## 1. What R0 claimed vs what the tree actually had

M15-R0 was documentation-only. None of its P1s were remediations until R1.

| R0 P1 | Pre-R1 source truth | R1 disposition |
|---|---|---|
| Event-blind M13 constraint query | `ControlTowerQueryService` loaded `constraintLog` by org + severity + status only | **Fixed.** `workpack: { event_id, organization_id, deleted_at: null }` |
| Three unlabeled finish forecasts | `ScheduleForecastService`, EAC, scenario `project_finish` coexisted without a facade type | **Fixed in M15.** Named `ForecastType` values; EAC is currency, not a date |
| Scope-change heuristic vs slip/network | `ScopeChangeImpactService` remains a crew-hours heuristic; baseline lookup still org-only `is_current` | **Not consumed by M15.** Proven unused. Remaining debt for other callers |
| Scenario calc hardcoded 10h/day | `ScenarioCalculationService` passed `working_hours_per_day: 10` | **Fixed.** `ScheduleOrchestrationService.resolveWorkingHoursPerDay` (event calendar → org default → engine fallback) |
| Live relationships in scenario calc | Loaded org relationships by activity id set, no event join | **Fixed.** Predecessor/successor must belong to `scenario.event_id` |
| `bre_alerts` without `event_id` | Still no `event_id` column | **Not consumed by M15.** Fail-closed by omission |
| Risk/exception duplicated from M13 | No M15 module existed; risk of a second LATE engine | **Avoided.** Facade maps `ControlTowerQueryService.getSummary()`; does not call `evaluateExceptions` |
| Resource leveling apply path | `ResourceLevelingApplyService` exists | **Not imported or called by M15** |
| Execution-readiness N+1 / skip ~5K | M13 still skips `evaluateBulkReadiness` when `notStartedIds.length >= 5000` | **Not rewritten.** M15 does not call readiness itself. Inherited completeness gap documented |
| Scope-change baseline without event_id | Still org-only in `ScopeChangeImpactService` | **Not consumed.** Remaining for that service |

R0 P2/P3 that R1 changed:

| Item | R1 |
|---|---|
| No single M15 facade | **Resolved.** `DecisionIntelligenceService` |
| No Evidence DTO | **Resolved.** `IntelligenceEvidence` |
| Weak ScheduleForecast wiring | **Resolved for M15.** Hours from SOS calendar, not a hard-coded 8/10 in the facade |
| M15 vs M16 “risk” naming | **Resolved.** `ManagementRisk` vs `ActionRiskLevel` (M16 enum is not imported) |
| `downstream_impact` is a count | **Labeled** as `activity_count` / `downstream_activity_count` with unit `count` |
| Scenario get-by-id org-only | **M15 forecast** uses `scheduleScenario.findFirst({ id, organization_id, event_id })`. `ScenarioPlanningService.getScenario` remains org+id (unused by M15) |
| Split recommendation registers / AI `source_type` | **Not implemented as an M15 write path.** Resource `recommended_action` is evidence only |

---

## 2. Authority map (verified files)

| Area | Actual path | M15 uses it? |
|---|---|---|
| M13 exceptions | `src/core/control-tower/ControlTowerQueryService.ts`, `ControlTowerRules.ts` | Yes — `getSummary` + rule descriptions |
| M8.8 forecast | `src/core/resources/ScheduleForecastService.ts` | Yes — `computeForecast` |
| M8.8 CP intelligence | `src/core/resources/CriticalPathIntelligenceService.ts` | Yes — downstream **counts** |
| M8.8 SHI / variance | `ScheduleHealthService`, `ScheduleVarianceService` | No (R1) |
| M8.9 scenarios | `src/core/schedule/scenario/*` | Yes — orchestrate create/override/calculate |
| M8.10 EVM | `src/core/evm/EvmSnapshotService.calculateLiveEvm` | Yes — EAC only as cost forecast |
| M8.11 scope change | `src/core/scope-change/ScopeChangeImpactService.ts` | **No** |
| M8.13 progress | `ProgressAggregationService` | Indirect via M13 summary evidence (`progress_percent`) |
| M10 planning readiness | `PlanningReadinessService` | **No** (not merged, not called) |
| M11 SOS / engine | `ScheduleOrchestrationService`, `src/lib/scheduleEngine.ts` | Hours/day + persisted float/critical; scenario CPM stays in M8.9 |
| M12 EWS / readiness | `ExecutionWriteService`, `ExecutionReadinessService` | **Neither called** |
| Resources | `ResourceRiskService` | Yes (read). `ResourceLevelingApplyService` **never** |
| BRE | `AlertEngine`, `RecommendationEngine` | **No** |
| M14 | ReportDataset providers | Not registered in R1 |
| M16 | `src/core/m16/tools/readTools.ts` | Thin `m15ToToolResult` exists; **no live tool registration** |

Live App Router is `app/`, not `src/app`.

---

## 3. Isolation traces (consumed joins)

### 3.1 M13 constraints — was P1, now event-safe

`ConstraintLog` has no `event_id`. R1 does **not** add a column.

Join: `constraintLog.workpack.event_id == requested event` and `workpack.organization_id == requested org`.

### 3.2 Critical-path graph — was org-wide load

Pre-R1: `activityRelationship.findMany({ organization_id })` then filter successors by event activity id set (counts were mostly event-safe; predecessor/successor **counts** could include cross-event edges if they existed).

R1: predecessor and successor activities must match `event_id` + `organization_id`.

### 3.3 Scenario relationships — was P1, now event-safe

`ScenarioCalculationService` loads live `ActivityRelationship` rows for in-memory `calculateSchedule` only. Snapshot is written to `schedule_scenarios`, not `Activity`.

### 3.4 Facade queries

Every `DecisionIntelligenceService` method starts with `assertEventScope`:

```
event.findFirst({ id: eventId, organization_id, deleted_at: null })
```

Missing org or event → `EVENT_REQUIRED`. Unknown pair → `EVENT_NOT_FOUND`. Activity/scenario lookups always include both keys.

---

## 4. Forbidden-path scan (M15 module)

Searched `src/core/m15` (excluding tests):

- No `ExecutionWriteService`
- No `ResourceLevelingApplyService` import/call
- No `calculateProgressMetrics`
- No `evaluateExceptions`
- No `ScopeChangeImpactService`
- No `PlanningReadinessService` / `ExecutionReadinessService`
- No `prisma.*.create|update|delete` (scenario writes go through M8.9 services)
- No import from `@/core/m16`

`runImpactScenario` persists **only** via `ScenarioPlanningService` / `ScenarioCalculationService` (scenario store + snapshot).

---

## 5. Remaining debt (do not hide)

**P2 (not R1-blocking for consumed paths):**

1. M13 skips execution readiness at ≥5000 not-started activities — M15 risk list may omit `READINESS_BLOCKED` at that scale.
2. `bre_alerts` still has no `event_id` (unused by M15).
3. `bre_recommendations.event_id` nullable; `source_type: 'ai'` allowed (unused by M15).
4. `ScopeChangeImpactService` baseline lookup still org-only (unused by M15).
5. `ScenarioPlanningService.getScenario` / `ScenarioCalculationService.calculate` fetch by org+id, not event (M15 does not use get-by-id without event).
6. Existing `GET /api/events/[eventId]/schedule/forecast` still defaults `hoursPerDay=8` — **not** the M15 path.
7. No dedicated `intelligence.*` permission (uses `nav.schedule`).
8. M16 tools are not registered; adapter is a module only.
9. Scenario override surface is duration-slip only.

**P3:**

- `CalendarEngine` fallback remains Mon–Sat 10h when no event/org calendar exists (correct fallback; the bug was ignoring calendars).
- `scheduleCalendar.findUnique({ id })` in SOS is not org-filtered (pre-existing M11; event is already org-scoped).
- Platform `AnalyticsService` still unused.
- `WorkpackIntelligence` naming collision unchanged (unused).

---

## 6. Audit verdict

R1 consumed-path isolation P1s are **resolved or proven unused**. Unused engines were **not** silently “fixed” by wrapping them.

No P0. No second progress/CPM/readiness/exception engine.
