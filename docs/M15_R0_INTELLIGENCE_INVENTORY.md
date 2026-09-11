# M15-R0 — Intelligence Inventory

**Date:** 8 September 2026  
Classification: Existing / Reusable / Duplicate / Incomplete / Missing / Deprecated / Unknown.

Authority classes: AUTHORITATIVE | ADAPTER | PRESENTATION | DERIVED INTELLIGENCE | DUPLICATE / CONFLICTING | UNKNOWN.

| Item | File | Function/class | Callers (representative) | Data source | Calculation | Authority class | Status | Proposed M15 disposition |
|---|---|---|---|---|---|---|---|---|
| Progress metrics | `src/core/progress/ProgressCalculationService.ts` | `calculateProgressMetrics` | AggregationService, SpiAdapter, tests | Activity rows | Weighted by duration | AUTHORITATIVE (M8.13) | Existing | Consume only |
| Progress aggregation | `src/core/progress/ProgressAggregationService.ts` | `getEventProgress`, `getDashboardSummary` | M13, M16 `getProgress`, reports | Prisma + calc | Dimension rollup; writes `workpack.overall_progress` cache | AUTHORITATIVE persist of **cache**, math is M8.13 | Existing | Consume |
| SPI adapter | `src/core/progress/SpiAdapter.ts` | — | Progress types docs | M8.13 + schedule health notes | Adapter | ADAPTER | Existing | Consume |
| EVM math | `src/core/evm/EvmCalculationService.ts` | `calculateActivityEvm`, `calculateEac` | M13, M14, snapshots | Baseline + actuals | SPI/CPI/EAC | AUTHORITATIVE (M8.10) | Existing | Consume |
| EVM snapshots | `src/core/evm/EvmSnapshotService.ts` | `loadEvmActivities` | M13, reports | DB | Load | AUTHORITATIVE | Existing | Consume |
| EVM scenario | `src/core/evm/EvmScenarioProjection.ts` | `calculateScenarioEvmProjection` | Scenario/EVM path | Live + `ScenarioActivityOverride` | In-memory merge | DERIVED INTELLIGENCE | Existing / Reusable | Consume for scenario EVM |
| CPM engine | `src/lib/scheduleEngine.ts` | `calculateSchedule` | SOS, ScenarioCalculation, ResourceLeveling | Activity+rel in-memory | Forward/backward pass | AUTHORITATIVE math (M11) | Existing | Only via SOS persist **or** scenario in-memory |
| CPM persist | `src/core/schedule/ScheduleOrchestrationService.ts` | `calculateEventSchedule` | APIs, leveling apply | Event-scoped load | Persist ES/LF/float | AUTHORITATIVE persist | Existing | Consume persisted fields |
| Planning readiness | `src/core/planning/PlanningReadinessService.ts` | `getReadiness` | M14 providers | WP + materials + activities | Orchestration of existing scores | AUTHORITATIVE (M10) | Existing | Consume |
| Execution readiness | `src/core/execution/ExecutionReadinessService.ts` | `evaluateReadiness`, `evaluateBulkReadiness` | EWS, M16, M13 | Constraints, preds, permits | 3 checks | AUTHORITATIVE (M12) | Existing / Incomplete (N+1 bulk, 3 dims) | Consume; do not replace |
| Control Tower | `src/core/control-tower/ControlTowerQueryService.ts` | `getSummary` | M16 `getControlTowerSummary`, UI | M8.13 + M8.10 + M11 fields + M12 | Compose | ADAPTER + DERIVED exceptions | Existing / Reusable | **Primary M15 input** for exceptions/KPIs |
| CT exception rules | `src/core/control-tower/ControlTowerRules.ts` | `evaluateExceptions` | QueryService | Facts from authorities | LATE, CRITICAL_LATE, … | DERIVED INTELLIGENCE (M13) | Existing | Reuse; do not fork rules |
| Lookahead (execution) | `src/core/execution/FieldExecutionService.ts` | `getLookahead` | M16, APIs | Activities | Time windows | PRESENTATION / ADAPTER | Existing | Consume alongside M13 bins |
| Plan vs actual | same | `getPlanVsActual` | M16 getDelays | Planned/actual dates | Hour deltas | PRESENTATION | Existing | Consume; not EVM SV |
| Constraints | Prisma `ConstraintLog` | CRUD + M16 `getConstraints` | Execution, CT | Workpack-scoped | Fact register | AUTHORITATIVE facts | Existing / Incomplete (no event_id) | Consume via WP→event |
| Material constraints | `src/core/materials/MaterialConstraintService.ts` | — | Planning/materials | Supply records | Fact | AUTHORITATIVE | Existing | Consume |
| Resource constraints | `src/core/resources/ResourceConstraintService.ts` | `detectConstraints` | Risk, leveling, scenario | Demand vs capacity | DERIVED | Existing | Consume |
| Resource demand/capacity | `src/core/resources/ResourcePlanningService.ts` | `getDemandVsCapacity` | Forecast, risk | Assignments + capacity | AUTHORITATIVE planning | Existing | Consume |
| Resource conflict rank | `src/core/resources/ResourceConflictService.ts` | `analyzeConflicts` | Leveling | Constraints + float | DERIVED | Existing | Consume inside leveling |
| Resource risk | `src/core/resources/ResourceRiskService.ts` | `getRisks` | Resource APIs | Constraints + utilization + CP | DERIVED score + `recommended_action` string | Existing / Reusable | M15 risk input; do not duplicate score |
| Resource forecast | `src/core/resources/ResourceForecastService.ts` | `getForecast` | Resource APIs | Demand/capacity forward | DERIVED | Existing | Consume |
| Schedule forecast | `src/core/resources/ScheduleForecastService.ts` | `computeForecast` | (few live callers — verify API) | Activity dates/progress | Remaining duration / earned / planned | DERIVED / **CONFLICTING** vs CPM finish | Existing / Incomplete integration | Consume as **duration forecast** only |
| Schedule variance | `src/core/resources/ScheduleVarianceService.ts` | — | SHI | Current vs baseline | DERIVED | Existing | Consume |
| Schedule health | `src/core/resources/ScheduleHealthService.ts` | SHI 6 components | Scenario calc, M10 tests protect it | Mixed | DERIVED composite | Existing | Consume; not M13 |
| CP intelligence | `src/core/resources/CriticalPathIntelligenceService.ts` | `getIntelligence` | Resource/schedule APIs | Persisted CPM + relationships | DERIVED graph | Existing / Reusable | Consume; watch O(n) DFS per activity (cached) |
| Scenario domain | `src/core/schedule/scenario/ScenarioDomainService.ts` | `resolveEffectiveActivities` | CalculationService | Baseline + overrides | Merge | ADAPTER | Existing | **Required** for what-if |
| Scenario planning | `src/core/schedule/scenario/ScenarioPlanningService.ts` | CRUD, overrides, status | APIs | `schedule_scenarios` | State machine | AUTHORITATIVE scenario store | Existing / Reusable | M15 orchestrates |
| Scenario calculation | `src/core/schedule/scenario/ScenarioCalculationService.ts` | `calculate` | APIs | Engine + resources + SHI | In-memory CPM + snapshot | DERIVED (must not persist live CPM) | Existing / Reusable | **Preferred what-if engine** |
| Leveling sim | `src/core/resources/ResourceLevelingService.ts` | `generateLevelingRecommendations` | APIs | Full event in memory | In-memory CPM + date shifts | DERIVED optimization | Existing | M15 sim only |
| Leveling apply | `src/core/resources/ResourceLevelingApplyService.ts` | apply + SOS | APIs | Live planned dates | **WRITE live schedule** | AUTHORITATIVE apply (M11 path) | Existing | **Forbidden to M15** |
| Scope impact | `src/core/scope-change/ScopeChangeImpactService.ts` | `analyze` | Scope change | Item hours/cost | Heuristic; CP if >10% duration | DUPLICATE / CONFLICTING vs scenario CPM | Existing | Not for slip-hours; keep as scope-change estimate |
| BRE rules | `src/core/bre/RulesEngine.ts` | — | Alerts | Formulas/KPIs | DERIVED | Existing | Optional input |
| BRE alerts | `src/core/bre/AlertEngine.ts` | lifecycle | OIS/TV/reports | `bre_alerts` | Threshold/trend | DERIVED | Existing / Incomplete (no event_id) | Isolate before M15 use |
| BRE escalation | `src/core/bre/EscalationEngine.ts` | time chains | Notifications | `bre_escalation_*` | Ops | Existing | Not M15 core |
| BRE recommendations | `src/core/bre/RecommendationEngine.ts` | generate/accept | Dashboards | `bre_recommendations` | Persistence + human accept | Existing / Reusable | **Preferred action register** |
| M16 action risk | `src/core/m16/risk.ts` | `classifyRisk` | Pipeline | Intent enum | AUTHORITATIVE for **interaction** | Existing | Do not mix with operational risk |
| M16 CT tool | `src/core/m16/tools/readTools.ts` | `getControlTowerSummary` | Pipeline | M13 | ADAPTER | Existing | Pattern for future M15 tools |
| Workpack intelligence | `src/core/workpack-intelligence/WorkpackIntelligenceService.ts` | instantiate from scope | Planning | Templates | **Not decision intel** | Existing | Out of M15 |
| Document intelligence | `DocumentIntelligenceService.ts` | extraction | AI jobs | Docs | Not M15 | Existing | Out of M15 |
| Platform analytics | `src/core/Platform/AnalyticsService.ts` | — | Platform | Unknown mix | UNKNOWN | Existing | Inspect before reuse; not turnaround decision layer |
| Engineering issues | `src/core/engineering-issues/IssueService.ts` | CRUD | Engineering | Issue register | Fact | Existing | Possible evidence/source, not M15 engine |
| Discovery work | Prisma `DiscoveryWork` | — | Execution discovery | Fact | Existing | Evidence / scope intake |
| M14 management providers | `src/core/report-engine/providers/ManagementProviders.ts` | EVM, CT exceptions | Reports | Delegates | ADAPTER | Existing | M15 should feed, not copy |
| M14 planning intel | `PlanningIntelligenceProviders.ts` | readiness, EAC | Reports | M10/M8.10 | ADAPTER | Existing | Same |
| Unified event risk API | — | — | — | — | — | **Missing** | M15-R1 |
| Unified slip-hours impact API | Scenario pieces exist | — | — | — | Incomplete wrapper | **Missing facade** | M15-R2 |
| Unified management action table | — | — | Split stores | — | **Missing** dedicated; reuse BRE | Recommend extend BRE |
| Crew productivity / manhour PF | — | — | EVM EV/AC partial | — | **Missing** as named engine | Later release |
| Material/permit risk composite | Facts exist | — | — | Incomplete composition | **Missing** | Compose M8.12 + M12 permits |
| Cross-system/unit cascade | Asset/unit on workpack | CP intelligence is activity graph | — | Incomplete | **Missing** equipment/system rollup | Derive via WP.asset after activity graph |
| AI as decision authority | `source_type: 'ai'` on recommendations; `ai_explanation` on alerts | — | LLM | **Must not** remain an authority | Existing risk | Ban AI as source of scores |

## Duplicate / conflicting engines (summary)

| Topic | Locations | Verdict |
|---|---|---|
| Progress | M8.13 vs presentation strings vs WP cache | AUTHORITATIVE + cache + presentation |
| SPI | M8.10 vs M13 adapter vs SHI “progress earned” component | One EVM SPI; SHI is separate composite |
| Finish forecast | ScheduleForecast vs Scenario CPM vs EVM EAC | **CONFLICTING meanings** |
| Variance | FieldExecution hours vs ScheduleVariance days vs EVM SV | Different definitions — label |
| Criticality | M11 `is_critical` vs CT CRITICAL vs CP intelligence | Same fields, different lists |
| Risk | ResourceRisk vs CT UPCOMING_RISK vs M16 ActionRisk | Different domains |
| Readiness | M10 vs M12 | Two authorities, both valid |
| Exceptions | CT rules vs BRE alerts vs ConstraintLog | Three registers |
| Recommendations | BRE vs leveling PROPOSED vs ResourceRisk strings | Three shapes |
| Impact | ScopeChange heuristic vs CP downstream vs Scenario CPM | **CONFLICTING** |

## Category coverage (A–G)

| Category | Exists? | Gap |
|---|---|---|
| A Risk | Partial: CT exceptions, ResourceRisk, UPCOMING_RISK | No activity/workpack/unit composite with evidence DTO; material/permit risk not unified |
| B Forecast | Partial: ScheduleForecast, ResourceForecast, EAC | No single TA forecast with method disclosure; weak live wiring of ScheduleForecast |
| C Dependency | Yes: ActivityRelationship + CP intelligence | No first-class cross-workpack/system cascade API |
| D Impact | Partial: scenario CPM; heuristic scope impact | **“Slip 12h” not a one-call API**; heuristic must not be used |
| E Management exceptions | Yes: M13 | Ranking/owner/due-date action not on the exception itself |
| F Scenario | Yes: M8.9 persisted + in-memory CPM | Overrides limited to duration/dates; no crew/shift/constraint-remove in override model |
| G Optimization | Partial: leveling sim + conflict scores | Sequencing/shift/recovery strategy not a dedicated optimizer |

Callers of `ScheduleForecastService` / `CriticalPathIntelligenceService` / `ResourceRiskService` are concentrated under `src/core/resources` and schedule/scenario — they are **not** wired into M16 today except Control Tower.
