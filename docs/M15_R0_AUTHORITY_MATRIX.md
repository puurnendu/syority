# M15-R0 — Authority Matrix

**Date:** 8 September 2026  
**Status:** Forensic recommendation only. No code or schema changes.

M15 is a **decision-intelligence consumer and composer**. It must not become a second source of truth for progress, CPM, readiness, EVM, or execution.

| Capability | Existing Authority | M15 Role | Conflict? |
|---|---|---|---|
| Actual progress (activity / workpack / event / identical / SPI adapters) | **M8.13** `ProgressCalculationService` / `ProgressAggregationService` / `SpiAdapter` | Consumer | None if M15 never reimplements `calculateProgressMetrics` |
| Identical activity progress | **M8.13** `getEventProgress({ includeIdenticalActivities })` | Consumer | None |
| Equipment / unit / contractor / discipline progress | **M8.13** dimension aggregation | Consumer | None |
| Dashboard progress | **M8.13** `getDashboardSummary` consumed by **M13** | Consumer (prefer M13 summary, not a third dashboard calc) | Do not add a third progress rollup |
| EVM / SPI / CPI / BAC / EAC / S-curve | **M8.10** `EvmCalculationService` / `EvmSnapshotService` | Consumer | M13 already calls `calculateActivityEvm` as adapter — reuse, do not fork |
| Planning readiness (workpack 12-criteria) | **M10** `PlanningReadinessService` | Consumer | Distinct from execution readiness — do not merge formulas |
| Execution readiness (constraints / predecessors / permits) | **M12** `ExecutionReadinessService` | Consumer | Three-dimension engine; do not expand inside M15 |
| CPM / ES-EF-LS-LF / float / critical path persistence | **M11** `ScheduleOrchestrationService` + `calculateSchedule` in `scheduleEngine.ts` | Consumer of **persisted** CPM fields; scenario may invoke engine **in-memory only** | `ScenarioCalculationService` and `ResourceLevelingService` already call `calculateSchedule` without SOS persist — allowed as derived, not a second persist path |
| Calendars | **M11** `CalendarEngine` | Consumer | None |
| Dependencies (FS/SS/FF/SF, lag) | **M11** `ActivityRelationship` | Consumer | Transitive impact already derived in `CriticalPathIntelligenceService` |
| Baseline | **M11/M8** `ScheduleBaseline` / `baselineActivity` | Consumer | `ScopeChangeImpactService` current-baseline lookup is **org-only** (missing `event_id`) — P1 if reused |
| Execution facts (status, actuals, progress logs) | **M12** `ExecutionWriteService` (write) / `FieldExecutionService` (read) | Consumer of facts only | **NEVER** call EWS |
| Holds / delays | **M12** activity status + `ConstraintLog` / REPORT_DELAY | Consumer | `FieldExecutionService.getPlanVsActual` is presentation variance, not a second EWS |
| Constraints (workpack) | **M12** `ConstraintLog` (org + workpack; **no `event_id` column**) | Consumer via workpack→event join | M13 constraint query is org-scoped without event filter — P1 |
| Material constraints | **M8.12** `MaterialConstraintService` | Consumer | None |
| Resource demand / capacity / overload | Resource planning stack (`ResourcePlanningService`, `ResourceConstraintService`) | Consumer | Resource risk scoring is **derived** (`ResourceRiskService`) |
| Control Tower KPIs / exceptions / lookahead / contractor / discipline | **M13** `ControlTowerQueryService` + `ControlTowerRules` | **Consumer / do not replace**. M15 may add *decision* ranking on top of exceptions | Overlap risk: recreating LATE/CRITICAL_LATE in M15 |
| Reports / snapshots | **M14** ReportDataset providers | **Provider** of M15 datasets to M14; M14 must not recalculate M15 risk | None if M15 exposes a stable DTO |
| Schedule forecast (remaining duration / earned progress) | **M8.8** `ScheduleForecastService` | Consumer; label method explicitly | **Conflicts conceptually** with CPM scenario finish and EVM EAC |
| Schedule variance vs baseline | **M8.8** `ScheduleVarianceService` | Consumer | Distinct from EVM SV and FieldExecution plan-vs-actual |
| Schedule Health Index | **M8.8** `ScheduleHealthService` | Consumer | Independent composite; do not treat as M13 exception list |
| Critical-path intelligence / downstream counts | **M8.8** `CriticalPathIntelligenceService` | Consumer | Derived from persisted M11 fields + relationship graph |
| Resource forecast | `ResourceForecastService` | Consumer | Utilization forecast, not TA completion date |
| Resource risk | `ResourceRiskService` | Consumer (candidate M15 risk input) | Scoring formula lives here — M15 must not invent a second resource risk score |
| Resource leveling simulation | `ResourceLevelingService` (in-memory) | Consumer of **simulation** | **NEVER** call `ResourceLevelingApplyService` from M15 |
| Schedule scenarios / what-if | **M8.9** `ScheduleScenario` + `ScenarioPlanningService` + `ScenarioCalculationService` | **Orchestrate / extend**, do not clone a second scenario store | CPM math must stay `calculateSchedule` |
| EVM scenario projection | **M8.10** `calculateScenarioEvmProjection` | Consumer | In-memory merge of overrides; zero live mutation |
| Scope-change impact | **M8.11** `ScopeChangeImpactService` | Do **not** use as slip-hours CPM impact | Heuristic (hours/crew), **not** network analysis |
| BRE alerts | **M7.6E** `AlertEngine` / `bre_alerts` | Optional input | **No `event_id`** on alerts — P1 isolation |
| BRE recommendations | **M7.6F** `RecommendationEngine` / `bre_recommendations` | Reuse as **management recommendation persistence** if extended | `event_id` nullable; `source_type` may be `ai` |
| BRE escalation | `EscalationEngine` | Out of M15 core (notification ops) | None |
| Action risk (confirmation) | **M16** `classifyRisk` / `ActionRiskLevel` | Unrelated — interaction risk, not operational risk | Naming collision only |
| Natural language / governed writes | **M16** pipeline + EWS | M16 **calls** M15 read APIs; M16 **never** recalculates M15 | None if tools are thin adapters |
| Execution mutation | **M12 EWS** | **NEVER M15** | Absolute |

## Explicit conflicts (must resolve in M15 design, not by new engines)

1. **Three “finish forecasts”:** remaining-duration (`ScheduleForecastService`), cost EAC (`EvmCalculationService`), scenario CPM finish (`ScenarioCalculationService`). M15 must name which forecast is which.
2. **Two readiness engines (legitimate):** M10 planning vs M12 execution. M15 recommendations must cite which.
3. **Exception vs alert vs constraint vs recommendation:** M13 rules, BRE alerts, `ConstraintLog`, `bre_recommendations`, leveling “PROPOSED” rows. M15 needs a **facade + provenance**, not a fifth register as the new truth.
4. **M13 vs M15:** Control Tower already *is* management-exception intelligence. M15 owns *decision ranking, forecast, impact, scenario comparison, recommended actions* — not a second exception scanner with different LATE logic.

## Absolute prohibitions

- M15 must not persist CPM fields on live `Activity`.
- M15 must not call `ExecutionWriteService`.
- M15 must not call `ResourceLevelingApplyService`.
- M15 must not implement `calculateProgressMetrics`.
- M15 must not let an LLM choose risk, criticality, SPI, or whether confirmation is required.
