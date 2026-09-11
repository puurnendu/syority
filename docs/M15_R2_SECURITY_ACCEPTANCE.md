# M15-R2 — Security Acceptance

**Date:** 8 September 2026  
**Status:** GREEN for M15 consumed paths

## Authentication / authorization

Unchanged from R1:

- `withTenantGuard` → 401 without session
- `guardApi('nav.schedule')`
- Org from session; event from path
- Body `organizationId` / `eventId` not trusted

## Tenant / event

| Case | Result |
|---|---|
| Wrong org event | `EVENT_NOT_FOUND` |
| Same org, other event activity | `ACTIVITY_NOT_FOUND` |
| Same equipment name | UUID + org + event lookup |
| Scenario id from other event | `SCENARIO_NOT_FOUND` |
| Override activity from other event | M8.9 `setActivityOverride` rejects if activity not in scenario event |
| Evidence queried under Event B | No evidence store; all reads re-scope org+event |

## LLM / adapter

`m15ToToolResult` copies **only** `ctx.organizationId` / `ctx.eventId`. Params may contain spoofed org/event; they are ignored. Tests cover Org B injection.

Ranking scores cannot be passed in; model `m15-management-priority@1.0` is server-side.

`runImpactScenario` still requires trusted `userId` or `DENIED`.

## Writes

M15 still has no `prisma.activity.update`. Scenario store only via M8.9.

## Residual

Unused `bre_alerts` / org-only scope-change baseline remain outside M15.
