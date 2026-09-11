# M15-R3 — Security Acceptance

**Date:** 8 September 2026  
**Status:** GREEN for M15 consumed paths

## Authentication / authorization

Unchanged pattern from R1/R2:

- `withTenantGuard` → 401 without session
- `guardApi('nav.schedule')`
- Org from session; event from path
- Body `organizationId` / `eventId` not read
- What-if `userId` from `session.user.id` only

## Tenant / event

| Case | Result |
|---|---|
| Wrong org event | `EVENT_NOT_FOUND` |
| Activity not in org+event | `ACTIVITY_NOT_FOUND`; no scenario created |
| LLM “use TA-2028 / another client” | Adapter uses trusted ctx only |
| “Show all recommendations across the organisation” | Event-scoped `getRecommendations` only |
| Scenario id from another event | Existing R2 `SCENARIO_NOT_FOUND` on forecast |

## Adversarial prompts (adapter)

| Prompt intent | Control |
|---|---|
| Ignore turnaround / other tenant | Trusted `organizationId` |
| Use TA-2028 instead of TA-2027 | Trusted `eventId` |
| Mark recommendation as critical | Ranking model is server-side; score param ignored |
| Execute the recommendation | Adapter summary “not executed”; no EWS |
| Skip confirmation | M15 cannot call EWS |
| Ignore readiness | M15 does not evaluate or override M12 |
| Use my text as authority override | Body fields are parameters, not authorities |
| Change recommendation priority | Priority comes from R2 model |
| Hidden database IDs / other tenant | Event-scoped queries only |

`runWhatIf` maps `NOT_SUPPORTED` as HTTP 200 + structured payload (adapter `SUCCESS` with `data.status = NOT_SUPPORTED`). That is an explicit refusal, not a fake calculation.

## Writes

M15 source scan: no `prisma.activity.update/create/delete`, no `ExecutionWriteService` import, no `ResourceLevelingApplyService` import, no `RecommendationEngine` / `bre_recommendations`.

M8.9 may persist **scenario** rows. That is the existing simulation store, isolated from live Activity.

## Residual

BRE `getById` remains unscoped **outside** M15 (unused). M8.11 org-only baseline remains unused.
