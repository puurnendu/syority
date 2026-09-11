# M15-R3 — Scenario / What-If Model

**Date:** 8 September 2026

What-if is **hypothetical**. It is not a live schedule write and not an execution action.

---

## Supported (M8.9 override schema)

`ScenarioActivityOverride` supports `duration_hours`, `planned_start`, `planned_end` only.

| Kind | Override | Requires |
|---|---|---|
| `DURATION_SLIP` | `duration_hours = current + slipHours` | activityId, current baseline, session userId |
| `DURATION_CHANGE` | `duration_hours = durationHours` | same |
| `DELAYED_START` | `planned_start += delayDays` | planned_start present; else `INSUFFICIENT_DATA` |

Flow:

1. `assertEventScope(org, event)`
2. Activity `findFirst` with `organization_id` + `event_id` + `deleted_at: null`
3. Current baseline for that event
4. `ScenarioPlanningService.createScenario` (scenario store)
5. `setActivityOverride` (also verifies activity belongs to scenario event)
6. `ScenarioCalculationService.calculate` (in-memory CPM; snapshot on scenario row)
7. `getForecast(..., SCHEDULE_SCENARIO_FINISH)`
8. `impact_summary.project_finish_delta` if present (number); else null — **never inferred from downstream count**

Result: `status: CALCULATED`, `hypothetical: true`, `assumptions[]`, `scenarioId`.

Live `Activity` and baseline are not updated.

---

## Supported (leveling simulation, not apply)

`RESOURCE_LEVELING_SIMULATION` → `ResourceLevelingService.generateLevelingRecommendations(eventId, organizationId)`.

- In-memory PROPOSED rows
- `ResourceLevelingApplyService` is **not** called
- Metrics reported only if the service returns them (`project_finish_before/after/impact`, `constraints_resolved`, `proposed_changes.length`)

---

## Explicitly unsupported (never faked)

| Kind | Reason |
|---|---|
| `ADDITIONAL_CREWS` | No crew-count field on M8.9 override |
| `CONSTRAINT_REMOVAL` | No constraint-toggle override |
| `SCOPE_CHANGE` | M8.11 is a heuristic, not network CPM |

Returns `NOT_SUPPORTED` + reason string.

Also `INSUFFICIENT_DATA` when: missing userId (for M8.9 persist), missing activityId, no baseline, missing planned_start, invalid numeric inputs.

---

## Isolation

- Org from session; event from path
- Activity and scenario queries include `organization_id` and `event_id`
- Cross-event activity → `ACTIVITY_NOT_FOUND` (no scenario created)
- Snapshot is labelled hypothetical in API, adapter, and UI
