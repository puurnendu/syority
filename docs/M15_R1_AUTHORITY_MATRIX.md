# M15-R1 — Authority Matrix

**Date:** 8 September 2026  
**Rule:** If a requirement needs M15 to calculate progress, persist CPM, call EWS, fork LATE rules, or treat LLM output as org/event/score — stop. That conflict was not worked around.

| Capability | Authority | M15 R1 role | Notes |
|---|---|---|---|
| Actual / workpack / event / identical / dimension progress | M8.13 | Indirect consumer via M13 evidence | No `calculateProgressMetrics` |
| EVM BAC/CPI/SPI/EAC | M8.10 | `calculateLiveEvm` for `EAC_COST_FORECAST` | SPI on exceptions is already computed inside M13 |
| Planning readiness | M10 | Not called | Distinct from execution readiness; not merged |
| Execution readiness | M12 `ExecutionReadinessService` | Not called | M13 may skip at ≥5K not-started; M15 inherits that gap |
| Execution writes | M12 EWS | **Forbidden** | Not imported |
| Persisted CPM / calendars / baseline | M11 SOS | Read `total_float`, `is_critical`; hours/day via `resolveWorkingHoursPerDay` | No SOS persist from M15 |
| In-memory CPM | M11 `calculateSchedule` via M8.9 | Orchestration only | Snapshot on scenario row |
| Activity relationships | M11 | Event-scoped reads | Scenario + CP intelligence |
| Control Tower exceptions / lookahead | M13 | `getSummary` | Detection stays in `ControlTowerRules` |
| Constraints | M12 `ConstraintLog` | Via M13 workpack→event join | No new `event_id` column |
| Resource risk | `ResourceRiskService` | Compose into `ManagementRisk` / `RESOURCE_IMPACT` | Score formula stays in that service |
| Resource leveling apply | `ResourceLevelingApplyService` | **Forbidden** | Not imported |
| Scope-change heuristic | M8.11 | **Not used** | Would be mislabeled as network impact |
| BRE alerts / recommendations | M7.6 | **Not used** | Isolation / AI-source debt remains there |
| Reporting composition | M14 | Not registered | Facade DTOs are M14-ready later |
| Interaction / confirmation / action risk | M16 | Thin adapter only | `ActionRiskLevel` ≠ `ManagementRisk` |
| Natural-language writes | M16 + EWS | M15 never executes | POST impact = scenario simulation only |

## Permission decision

No `intelligence.*` permission exists in `src/lib/permissions.ts`.

R1 uses **`nav.schedule`** — the same gate as `/schedule/forecast` and `/schedule/scenarios`.

This is the narrowest existing **read** (and existing scenario-create) permission consistent with the data. It is **not** a bypass. A future `intelligence.read` / `intelligence.scenario` split is optional P2, not invented here.

## Tenant / event contract

| Input | Trusted source |
|---|---|
| `organizationId` | Session (`withTenantGuard`) or M16 resolved user org |
| `eventId` | URL path or M16 frozen interaction context |
| `userId` | Session (required for `runImpactScenario`) |

Rejected as authority: request body org/event, LLM text, WhatsApp transcript, scenario description.

There is no `EventMember` table. Access model is: authenticated user + org membership + event belongs to that org + `nav.schedule`.
