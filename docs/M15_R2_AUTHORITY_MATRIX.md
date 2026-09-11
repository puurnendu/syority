# M15-R2 — Authority Matrix

**Date:** 8 September 2026

| Topic | Authority | R2 change |
|---|---|---|
| Progress | M8.13 | Evidence citation only |
| EAC / CPI / SPI / BAC | M8.10 | Named `EAC_COST_FORECAST` |
| Execution finish date | M8.8 `ScheduleForecastService` | Assumptions + quality |
| Scenario finish | M8.9 snapshot / in-memory `calculateSchedule` | Calendar hours in snapshot |
| Persisted CPM / calendar | M11 | `resolveWorkingHoursPerDay` |
| Execution readiness | **M12** `ExecutionReadinessService` | **Bulk queries**; same rules |
| Permits (readiness) | `PermitService.evaluatePermitRecords` | Shared with bulk |
| Exception detection | **M13** `ControlTowerRules` | Unchanged; 5K skip removed |
| Management priority | **M15** ranking model v1 | Not a detector |
| Execution writes | M12 EWS | Forbidden |
| Leveling apply | `ResourceLevelingApplyService` | Forbidden |
| Scope-change heuristic | M8.11 | Not consumed |
| Action risk | M16 `ActionRiskLevel` | Not used |
| Interaction | M16 adapter | Structured provenance; no live tools |

## Modified files (authorities)

- `src/core/execution/ExecutionReadinessService.ts` — bulk evaluation
- `src/modules/Permits/Services/PermitService.ts` — shared permit blocker evaluation
- `src/core/control-tower/ControlTowerQueryService.ts` — consume bulk always; coverage DTOs
- `src/core/schedule/scenario/ScenarioPlanningService.ts` — activity must match scenario event
- `src/core/schedule/scenario/ScenarioCalculationService.ts` — snapshot calendar provenance
- `src/core/m15/*` — facade / types / adapter / ranking

Dashboard `getSummary(org, event)` default `exceptionLimit=100` is unchanged for M13 UI.
