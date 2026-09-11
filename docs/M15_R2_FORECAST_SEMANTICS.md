# M15-R2 — Forecast Semantics

**Date:** 8 September 2026

There is no generic field named `forecast`.

| `forecastType` | Meaning | Authority | Unit |
|---|---|---|---|
| `EXECUTION_FINISH_FORECAST` | Completion if current execution/progress trajectory continues | M8.8 `ScheduleForecastService.computeForecast` | `date` |
| `SCHEDULE_SCENARIO_FINISH` | Completion under explicit scenario snapshot assumptions | M8.9 `snapshot_json.cpm_result.project_finish` (in-memory M11 `calculateSchedule`) | `date` |
| `EAC_COST_FORECAST` | Estimated final **cost** | M8.10 `calculateLiveEvm` | `currency` |

EAC is never a finish date.

## Required metadata (every forecast)

- `forecastType`, `value`, `unit`
- `eventId`, `organizationId`
- `sourceAuthority`, `sourceService`
- `asOf`
- `evidence[]`
- `assumptions[]`
- `quality` including `confidence: NOT_AVAILABLE`

No statistical confidence percentage is manufactured. No LLM assigns confidence.

## Calendar

`working_hours_per_day` is taken from M11 `ScheduleOrchestrationService.resolveWorkingHoursPerDay` (event calendar → org default → engine fallback). Scenario snapshots record that value under `calendar.working_hours_per_day`.

The leftover `GET /schedule/forecast?hoursPerDay=8` default is **not** the M15 path (P2 on that older route).

## Quality flags

When the authority provides enough data:

- `actualProgressAvailable` — execution forecast has completed/in-progress counts
- `baselineAvailable` — planned finish or EVM baseline present
- `cpmAvailable` — scenario snapshot has `cpm_result`
- `scenarioAssumptionsPresent` — scenario forecast only
- `resourceDataAvailable` — scenario resource_analysis present

Otherwise the flag is `null`, not a guessed boolean.
