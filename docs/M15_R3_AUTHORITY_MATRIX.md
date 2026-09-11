# M15-R3 — Authority Matrix

**Date:** 8 September 2026

| Topic | Authority | R3 use |
|---|---|---|
| Progress | M8.13 | Cited on risk evidence only |
| EAC / CPI / SPI / BAC | M8.10 | Named forecast; SPI cited, not recalculated |
| Execution finish date | M8.8 | Cited; not used as invented rec impact |
| Scenario finish / delta | **M8.9** snapshot | What-if `SCHEDULE_SCENARIO_FINISH` + `project_finish_delta` |
| Persisted CPM / calendars | M11 | Scenario uses SOS hours; criticality cited |
| Execution readiness | **M12** | Via M13 `READINESS_BLOCKED`; M15 does not evaluate |
| Exception detection | **M13** | Via R2 risks; no `evaluateExceptions` in M15 |
| Management priority | **M15** `m15-management-priority@1.0` | Rec priority = risk priority (no second severity) |
| Recommendation composition | **M15** `m15-recommendation-compose@1.0` | Advisory text only |
| BRE recommendation register | M7.6F `RecommendationEngine` | **Not used** |
| Scope-change heuristic | M8.11 | `NOT_SUPPORTED` |
| Leveling simulation | `ResourceLevelingService` | What-if only |
| Leveling apply | `ResourceLevelingApplyService` | **Forbidden** |
| Execution writes | M12 EWS | **Forbidden** |
| Interaction | M16 adapter | `getRecommendations` / `runWhatIf`; no Prisma |

## What M15 is not

- Not a second CPM
- Not a second readiness engine
- Not a second progress engine
- Not a second exception engine
- Not a second S-curve
- Not an action register
- Not an executor

## Route trust

| Input | Trusted source |
|---|---|
| organizationId | `session.user.organization_id` |
| eventId | URL path |
| userId (scenario persist) | `session.user.id` |
| kind / slipHours / durationHours / delayDays | Request body (parameters only, not authority) |
| LLM org/event/priority/score | **Ignored** |
