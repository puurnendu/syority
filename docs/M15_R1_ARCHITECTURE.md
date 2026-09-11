# M15-R1 — Architecture

**Date:** 8 September 2026  
**Role of M15:** Deterministic **decision-intelligence composition**. Not a progress, CPM, readiness, exception, execution, dashboard, or AI authority.

```
FACTS (Activity, ConstraintLog, baselines, resources)
        ↓
EXISTING AUTHORITIES (M8–M14)
        ↓
M15 DecisionIntelligenceService   ← single facade
        ↓
RECOMMENDATION TEXT (interpretive; no domain write)
        ↓
M16 thin adapter (later: tools)   ← no math
```

---

## 1. Facade

`src/core/m15/DecisionIntelligenceService.ts`

| Method | Meaning |
|---|---|
| `getManagementRisks(organizationId, eventId)` | Rank M13 exceptions + resource-risk records |
| `getForecast(organizationId, eventId, options?)` | Named forecasts only |
| `getImpact(organizationId, eventId, activityId, slipHours)` | Read-only slip / network count / resource-hit split |
| `runImpactScenario(...)` | Orchestrate **existing** M8.9 simulation |

There is no `M15ScenarioEngine`, `M15CpmEngine`, or `M15ScheduleCalculator`.

---

## 2. Forecast types (G2)

Do not expose a bare field named `forecast`.

| `forecastType` | Meaning | Source | Unit |
|---|---|---|---|
| `EXECUTION_FINISH_FORECAST` | If current execution trajectory continues, likely completion | M8.8 `ScheduleForecastService.computeForecast` | `date` |
| `SCHEDULE_SCENARIO_FINISH` | Under this scenario snapshot, CPM network finish | M8.9 snapshot `cpm_result.project_finish` (in-memory `calculateSchedule`) | `date` |
| `EAC_COST_FORECAST` | Projected final cost from cost performance | M8.10 `calculateLiveEvm` | `currency` |

EAC is never presented as a finish date. Scenario finish is not live Activity CPM.

Hours/day for execution forecast come from M11 `resolveWorkingHoursPerDay`, not a facade hard-code.

---

## 3. Impact types (G3)

| `impactKind` | Meaning | Unit in R1 |
|---|---|---|
| `SLIP_IMPACT` | Stated slip vs persisted M11 `total_float` | `hours` |
| `NETWORK_IMPACT` | Downstream relationship measure | `activity_count` (not hours) |
| `RESOURCE_IMPACT` | Resource-risk records that list the activity | `risk_record_count` |

`ScopeChangeImpactService` is **not** wired. Downstream counts are not called hours.

Network impact in `getImpact` does **not** re-run CPM. For CPM finish under a slip, callers use `runImpactScenario` (M8.9).

---

## 4. Management risk

M13 **detects** (`evaluateExceptions` inside Control Tower).

M15 **interprets and ranks**:

- Maps M13 P1–P4 → `CRITICAL|HIGH|MEDIUM|LOW`
- Adds downstream **count** from CP intelligence when present
- Appends `ResourceRiskService` rows as `kind: 'RESOURCE'`

`CRITICAL_LATE` statement is consequence language on top of the existing exception. It is not a second detection rule.

`ManagementRisk` is **not** M16 `ActionRiskLevel`.

---

## 5. Scenario architecture (Option D / R0)

```
runImpactScenario
  → assert event
  → current ScheduleBaseline for org+event
  → ScenarioPlanningService.createScenario
  → setActivityOverride(duration_hours += slip)
  → ScenarioCalculationService.calculate
  → getForecast(SCHEDULE_SCENARIO_FINISH)
```

CPM runs in memory. Results persist on `schedule_scenarios.snapshot_json` only.

M15 never writes `Activity` CPM fields and never calls EWS or `ResourceLevelingApplyService`.

---

## 6. HTTP

Event-scoped, matching `app/api/events/[eventId]/schedule/*`:

| Method | Path | Guard |
|---|---|---|
| GET | `/api/events/[eventId]/management/risks` | `withTenantGuard` + `guardApi('nav.schedule')` |
| GET | `/api/events/[eventId]/management/forecast` | same |
| GET | `/api/events/[eventId]/management/impact?activityId&slipHours` | same |
| POST | `/api/events/[eventId]/management/impact` | same; body `{ activityId, slipHours }` |

Organization comes from **session**. Event comes from **path**. Routes contain no intelligence math.

POST writes only the M8.9 scenario store (same permission as existing scenario POST).

---

## 7. M16

`src/core/m15/m16Adapter.ts` — `m15ToToolResult(trustedCtx, op, params?)`.

Trusted `organizationId` / `eventId` / `userId` must come from M16 session/phone resolution, never from an LLM transcript. R1 does **not** register live M16 tools.

---

## 8. What R1 deliberately does not do

- No new tables
- No M14 provider
- No RecommendationEngine persistence
- No call to M10 or M12 readiness engines (M13 already consumed readiness for exceptions)
- No generic `health` field
- No merge of EVM SV, FieldExecution plan-vs-actual, and schedule variance
