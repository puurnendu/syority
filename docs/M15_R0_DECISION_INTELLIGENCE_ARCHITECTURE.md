# M15-R0 — Decision Intelligence Architecture

**Date:** 8 September 2026  
**Recommendation:** Introduce M15 as a **composition facade** over M8–M14, with deterministic engines that **call** existing authorities. Do not add dashboards that re-derive progress/CPM/EVM.

```
Authoritative Data Layer
  Activity, ProgressLog, ActivityRelationship, ScheduleBaseline,
  ConstraintLog, permits, resources, EVM snapshots, workpacks
        │
        ▼
Intelligence Input Layer (existing services — consume, don’t copy)
  M8.13 ProgressAggregationService
  M8.10 EvmCalculationService / snapshots
  M10 PlanningReadinessService
  M11 SOS persisted CPM + calculateSchedule (in-memory for scenarios)
  M12 FieldExecutionService + ExecutionReadinessService + ConstraintLog
  M13 ControlTowerQueryService
  M8.8/M8.9 forecast, variance, SHI, CP intelligence, scenarios
  Resource planning / risk / leveling (simulate)
        │
        ▼
Deterministic Intelligence Engines (NEW M15 modules — thin)
  ├── Risk          compose M13 exceptions + ResourceRisk + readiness + constraints
  ├── Forecast      dispatch to named methods (duration | CPM-scenario | EAC)
  ├── Dependency    wrap CriticalPathIntelligenceService
  ├── Impact        wrap ScenarioCalculation (not ScopeChange heuristic)
  ├── Exception     reuse ControlTowerRules; optional rank/owner mapping
  ├── Scenario      wrap ScenarioPlanningService + CalculationService
  └── Optimization  wrap ResourceLevelingService.generate* only
        │
        ▼
Decision Model (NEW DTO)
  issue, severity, evidence[], affectedEntities, forecastDelta?, scenarioId?
        │
        ▼
Management Recommendation
  persist via RecommendationEngine (human accept/reject)
        │
        ▼
  M14 Reporting   ← M15 dataset provider
  M16 Interaction ← M15 read tools (no math in adapters)
```

## Distinguish layers

| Layer | Meaning | Example | Who owns write |
|---|---|---|---|
| **Facts** | Recorded operational/planning state | `actual_start`, `progress_percent`, open constraint | M12 EWS / planning CRUD / constraint APIs |
| **Calculations** | Authoritative derived fields | Weighted progress, CPM float, SPI | M8.13 / M11 / M8.10 |
| **Intelligence** | Cross-authority interpretation | CRITICAL_LATE, resource HIGH risk, SHI 42 | M13 / M8.8 / M15 compose |
| **Recommendations** | Human-actionable advice | “Level 3 scaffolders on 12-Sep or CP slips 1.2d” | `bre_recommendations` |
| **Actions** | Domain mutation | START activity, apply leveling dates | M16+EWS or M11 apply — **never M15** |

## Module boundaries

**Leave in M13:** Control Tower dashboard, exception **detection** rules, lookahead bins, contractor/discipline progress **display**, S-curve **from M8.10**.

**Leave in M11:** CPM persist, calendars, live relationship edits, leveling **apply**, change requests.

**Leave in M12:** EWS, execution readiness formula, delay/hold facts.

**Leave in M14:** Rendering, snapshots, distribution.

**Leave in M16:** Identity, confirmation, NL, governed execution.

**Put in M15:** Cross-authority **decision objects**, named forecast **dispatch**, impact **facade**, recommendation **generation policy**, scenario **orchestration**, optimization **simulation requests**.

## First implementation shape (not this phase)

`DecisionIntelligenceService` (name indicative):

- `getManagementRisks(orgId, eventId)`
- `getForecast(orgId, eventId, method)`
- `getDependencyView(orgId, eventId, activityId)`
- `runImpactScenario(orgId, eventId, { activityId, slipHours })`
- `listRecommendations(orgId, eventId)`
- `generateRecommendationFromDecision(...)` → RecommendationEngine

All methods: session org, required event, evidence array, no Prisma domain writes except recommendation/scenario tables already designed for that.

## What-if

See `docs/M15_R0_SCENARIO_ENGINE_RECOMMENDATION.md` — Option D reuse.

## AI

```
Authoritative facts → Deterministic M15 → Recommendation record → AI explanation (optional)
```

Never: `Database → LLM → Decision`.

## Naming

Do not reuse `ActionRiskLevel` for operational risk. Use `OperationalRisk` / `ScheduleRisk` in M15 types.
