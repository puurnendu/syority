# M15-R0 — Data Lineage Matrix

**Date:** 8 September 2026  
**Rule:** Every M15 output is derived from an existing authority. Persistence of *intelligence results* is optional; persistence of *facts* is never M15’s job.

| Capability | Input (facts) | Authoritative source | Transformation today | Proposed M15 calculation | Output | Evidence | Refresh trigger | Persist? | Audit? |
|---|---|---|---|---|---|---|---|---|---|
| Activity / WP / event progress | `progress_percent`, duration, status | M8.13 | Weighted aggregation | **None** — pass-through | Progress DTO | Activity IDs + formula version M8.13 | ProgressLog / EWS success | No | Via EWS |
| SPI / CPI / EAC | EV, PV, AC, baseline | M8.10 | `calculateActivityEvm` / event EVM | Pass-through; M15 may **rank** low SPI | EVM metrics | Baseline id, data date | Snapshot / data date | No (snapshots already M8.10) | Existing EVM snapshot |
| Planning readiness | WP score, materials, logic | M10 | 12-criteria orchestration | Pass-through | READY / NOT_READY (planning) | Check list + evidence strings | WP update | No | No extra |
| Execution readiness | Constraints, predecessors, permits | M12 `ExecutionReadinessService` | 3-dimension evaluate | Pass-through | READY / blockers[] | Blocker strings | Before START/RELEASE | No | EWS path |
| Critical path | `is_critical`, float, ES/EF | M11 persisted fields | Classification + graph | Rank “path threat” using persisted float | CP list + near-critical | Activity ids, float hours | After SOS `calculateEventSchedule` | No | SOS audit |
| Downstream impact | `ActivityRelationship` | M11 network | Transitive successor count (`CriticalPathIntelligenceService.computeDownstream`) | Reuse; do not BFS again in M15 | `downstream_impact` | Pred/succ ids | Relationship change / CPM | No | No |
| Schedule risk | CP + late + float + SPI + readiness + constraints | M11 + M8.10 + M12 + M13 rules | `ControlTowerRules.evaluateExceptions` | **Compose** exception codes into a risk object with severity already defined by M13 | Event/activity risk | Exception code + sourceAuthority | On query or event tick | Optional cache | Yes if persisted |
| Resource risk | Demand vs capacity, float, critical flag | Resource planning + M11 fields | `ResourceRiskService` score 0–n | Reuse score; do not fork | ResourceRisk[] | Date, resource type, affected activity ids | Demand/capacity change | Optional | Yes if persisted |
| TA completion forecast (duration method) | Status, remaining_duration, progress%, planned/actual dates | Live `Activity` | `ScheduleForecastService.computeForecast` | Label as **duration/progress forecast**, not CPM | `project_forecast_finish` | Method enum per activity | Query | No | No |
| TA completion forecast (network method) | Baseline + overrides + relationships | M8.9 scenario + M11 engine | `ScenarioCalculationService` → `calculateSchedule` | M15 **orchestrates scenario**, does not own CPM | Scenario snapshot finish | Scenario id, baseline id | User calculate | Yes (`snapshot_json` already) | Scenario status transitions |
| Cost forecast | AC, EV, CPI | M8.10 | `calculateEac` | Pass-through | EAC/ETC/VAC | CPI, BAC | EVM snapshot | Existing | Existing |
| Resource shortage forecast | Future demand/capacity | `ResourceForecastService` | Aggregation of daily points | Pass-through | AT_RISK / CRITICAL | First shortage date | Query | No | No |
| Plan vs actual (hours) | Planned/actual start-end | M12 facts | `FieldExecutionService.getPlanVsActual` | Pass-through | Variance hours | Activity id | Query | No | No |
| Baseline variance | Current vs `baselineActivity` | M8.8 `ScheduleVarianceService` | Per-activity day/hour delta | Pass-through | VarianceSummary | Baseline id | Baseline assign / CPM | No | No |
| SHI | CP, float erosion, milestones, resources, EV, baseline | Mixed M8.8/M11/M8.10 | Weighted 6-component | Pass-through; do not treat as exception list | 0–100 + class | Component scores | Query / scenario health | Scenario uses `calculateScenarioHealth` | No |
| “If activity slips 12h” | Duration/date override | M8.9 override + live relationships | **Exists** via `setActivityOverride` + `ScenarioCalculationService.calculate` | M15 `runImpactScenario({ activityId, slipHours })` must **create/calc scenario**, not heuristic | CPM delta, CP change, resource constraints | Scenario id + override row | User/M16 request | Scenario row | Yes |
| Scope-change impact | Estimated hours/cost/crew | Scope change items | **Heuristic** hours/(8×crew); CP flag if >10% event duration | **Do not** use for slip-hours questions | Days/cost | Item counts | Analyze action | Writes `impact_analysis` JSON | Scope change log |
| Lookahead | Planned start vs now | M13 bins + M12 `getLookahead` | Time-window counts | Consume M13 | LookaheadBin | Horizon key | Query | No | No |
| Contractor / discipline performance | Dimension progress | M8.13 via M13 | Weighted progress by dimension | Consume M13 | DimensionProgress[] | Contractor/discipline id | Query | No | No |
| Management exception | Same as schedule risk inputs | M13 `CONTROL_TOWER_RULES` | Deterministic rule eval | Reuse codes; M15 may **prioritize** for management | Exception[] | reason + severity | Query | Optional | If action created |
| Recommended action | Exception/risk/forecast | BRE `RecommendationEngine` **or** leveling PROPOSED | Rule/formula/kpi/ai/manual | M15 should **generate via deterministic mapping** then persist to `bre_recommendations` (prefer `source_type: rule\|formula\|kpi`) | Recommendation record | reasoning + supporting KPIs | On generate | Yes (`bre_recommendations`) | `bre_recommendation_log` |
| Leveling recommendation | Overload + float | `ResourceLevelingService` | In-memory date shifts + CPM | Simulation only | LevelingSimulationResult | scenario_id in-memory | User request | Optional as ScheduleScenario source_type `leveling` | Apply path audited in ApplyService — **not M15** |
| Constraint / delay register | ConstraintLog | M12 | CRUD facts | Consume; M15 may attach impact using CP graph | Constraint + optional downstream | workpack_id | Query | No | Constraint already audited elsewhere |
| Management action (proposed entity) | Recommendation + owner | **Does not exist as a dedicated table** | Split across recommendations, alerts, constraints, DiscoveryWork, engineering issues | **Recommend reuse/extend `bre_recommendations`** rather than a new source of truth | Action DTO | recommendation id | Accept/reject | Existing table | Existing log |

## Isolation lineage (mandatory)

Every query path M15 uses must pass:

`organizationId` (session) → `eventId` (application context) → entity ids resolved **inside** that pair.

Do not inherit:

- `ConstraintLog` org-wide without `workpack.event_id`
- `bre_alerts` (no event column)
- `ScopeChangeImpactService` `scheduleBaseline.findFirst({ organization_id, is_current: true })` without `event_id`
- `bre_recommendations` with null `event_id` for event-scoped advice

## Evidence object (recommended, not implemented)

```
{
  organizationId, eventId,
  capability, asOf,
  sources: [{ authority, service, entityType, entityId, field, value }],
  ruleOrMethod: "M13.CRITICAL_LATE | ScheduleForecast.remaining_duration | M11.calculateSchedule",
  scenarioId?: string
}
```

Current models contain **enough raw fields** for this (activity dates, float, SPI via EVM load, constraint title, successor graph). Missing is a **standardized evidence DTO** and consistent event scoping on some consumers.
