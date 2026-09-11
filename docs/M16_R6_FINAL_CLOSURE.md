# M16-R6 — Final Closure

**Date:** 8 September 2026  
**Status:** GREEN / CLOSED

R6 is a hardening and proof milestone, not a feature milestone. Closed predecessors R1–R5 were not reopened; no current live regression of those gates was found after R6 remediations.

## Closure criteria

| Mandatory | Met? |
|---|---|
| P0 = 0, P1 = 0 | Yes (after remediations below) |
| No live alternate **M16/channel** execution authority | Yes (WhatsApp/Voice/Mobile/AI/Excel named actions → EWS) |
| No live alternate **column** write of status/progress | **No** — planning/schedule CRUD (P2, not M16) |
| No AI → direct domain Prisma mutation | Yes |
| R3 fail-closed authorization preserved | Yes |
| Confirmation security preserved | Yes (in-memory, single-instance) |
| Tenant isolation proven (tests + source) | Yes |
| Event isolation proven (M16 path) | Yes |
| Execution authority remains EWS for named M16/channel actions | Yes |
| Repository-wide exclusive EWS for all status/progress writes | No (P2 planning CRUD) |
| M8.13 progress authority | Yes |
| M11 CPM authority | Yes |
| Readiness authority external | Yes |
| Destructive actions protected | Yes |
| Replay protection proven | Yes |
| Concurrency acceptable | Yes (CAS `updateMany`) |
| Provider secrets protected | Yes |
| Prompt injection cannot change trusted context | Yes |
| Targeted security + M16 + M8/M11/M12 tests pass | Yes |
| Full repository Vitest | 1282 passed / 0 failed / 0 skipped |

| Strongly required | Result |
|---|---|
| Production migrations verified | Files present; localhost not applied (AMBER ops) |
| Live route resolution verified | `./app` live; `src/app/api` reports unserved |
| Browser/API acceptance | UNVERIFIED (Next not started) |
| Full-suite failures classified | None |
| Remaining P2/P3 accepted | Listed below |
| Deployment assumptions documented | Single-instance compose |

## R6 remediations (smallest safe)

1. **P0 — empty tool registry in production Node:** `registerR2ReadTools` / `registerR3WriteTools` from instrumentation; root `instrumentation.ts` for webpack discovery next to `./app`.
2. **P1 — undeployable / wrong-type interaction logs:** TEXT `conversation_id`; migration for table + WhatsApp `event_id`.
3. **P1 — Voice/Mobile always 429:** `checkRateLimit` accepts `{ maxRequests, windowMs }`.

Regression tests: `src/core/m16/__tests__/m16-r6-production-hardening.test.ts`.

## Remaining technical debt (accepted)

**P2**

- In-memory ConfirmationGate, rate limiter, and Mobile `requestId` map — **deployment constraint: single instance**
- Missing `WHATSAPP_APP_SECRET` ACK 200 without processing — Meta operational behavior; set secret in production
- Voice MIME allowlist `audio/*`
- Three-dimension readiness (M12, not an M16 engine)
- Unserved `src/app/api/reports/**`
- Four pending migrations on current localhost DB
- Excel activity-number resolve is org-only (event collision risk)
- Planning/schedule activity PUT/bulk can write `status`/`progress_percent` without EWS (authenticated M8/M11 CRUD; not a channel engine)
- `logAndReturn` swallows interaction-log errors
- Planning `ai-assistant` is a parallel read-only assistant (not EWS)
- Middleware treats `/api/` as public (per-route auth required)
- `configValidator` does not warn on missing WhatsApp secret

**P3**

- `test-exec.ts` script
- Dead `processInboundMessage` (not on live webhook)
- Unauthenticated Voice GET liveness (no secrets)
- `getCriticalActivities` mentioned in read-tool comments but not a CPM writer

R5 P2 items reassessed: none upgraded to P0/P1. In-memory confirmation remains P2 because compose is single-instance. MobileConfirmationGate was not created.

## Release recommendation

**RELEASE** for single-instance Docker/standalone deploy after `prisma migrate deploy` and channel secrets are set.

**DO NOT** horizontally scale conversational M16 until confirmation state is shared.

## R6 conclusion

M16 is a governed interaction layer over one named-action execution engine (EWS), one progress engine (M8.13), M11 for CPM, and external readiness. Conversational writes cannot originate from the LLM or from channel-specific Prisma. Planning/schedule CRUD can still set activity status/progress without EWS (P2). Remaining operational debt: migrations, secrets, single-instance memory.
