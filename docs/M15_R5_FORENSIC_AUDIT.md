# M15-R5 — Forensic Audit (pre-implementation baseline + post-implementation re-gate)

**Date:** 8 September 2026  
**Predecessors:** M15-R3 CLOSED AMBER, M15-R4 CLOSED AMBER. Neither was reopened to chase inherited PERFORMANCE/BROWSER GREEN.

This document records the independent tree inspection. It is not a walkthrough of prior GREEN reports.

---

## 1. R4 forensic baseline (verified in tree)

R4 delivered:

- In-memory recommendations (`m15-recommendation-compose@1.0`)
- Append-only journal `m15_management_decisions` via `ManagementDecisionService.record` (`create` only)
- `authorizesExecution` hardcoded `false` in `toRecord` (not a writable column)
- Live M16 tools wrapping `m15ToToolResult`
- Pipeline ASK for “execute the recommendation”
- Conversational ACCEPT required an explicit `m15-rec:{eventId}:…` id (**R4-P3-1**)
- Adapter `getRecommendation` previously guessed `recommendations[0]` when filtering by activity (removed in R5)

R4 AMBER (no live 5K SQL soak; no live browser session) is inherited honesty, not an R5 defect to “fix” by reopening R3/R4.

---

## 2. Conversational recommendation-resolution path (R4 vs R5)

**R4:** `extractRecommendationId` matched `m15-rec:[uuid]:…` in raw text only. No conversation last-rec store. “Accept this recommendation” / “Accept HX-204” failed without an id.

**R5 (live):**

1. M16 classifier → `GET_RECOMMENDATIONS` or `RECORD_MANAGEMENT_DECISION`
2. Pipeline passes trusted `organizationId` / `eventId` / `userId` plus `conversationRecommendationIds` from `ConversationContext`
3. `m15Tools` call `m15ToToolResult` (spoofed org/event/user/`authorizesExecution` arguments are ignored)
4. `DecisionIntelligenceService.resolveRecommendation` loads the **current event-scoped** recommendation set
5. `resolveRecommendationReference` resolves deterministically; multiple matches → `AMBIGUOUS` (ASK); never first-of-many

Hierarchy: explicit id (must be `m15-rec:{eventId}:` **and** in the current set for retrieval) → conversation ids (event-prefixed) → activity / equipment / workpack → unique text/title/category match → ASK or NOT_FOUND.

---

## 3. Decision journal mutation / read paths

| Path | Operation | Notes |
|---|---|---|
| `ManagementDecisionService.record` | `prisma.m15_management_decisions.create` | Only write |
| `ManagementDecisionService.list` | `findMany` org+event, take 100 | Read |
| `GET /api/events/[eventId]/management/decisions` | list | Session org, `nav.schedule` |
| `POST .../management/decisions` | record | Session org/user; `body.authorizesExecution` ignored |
| M16 `recordManagementDecision` | adapter → service | Trusted ctx only |

No `update` / `delete` / `upsert` in the service. Schema has `created_at` only (no `updated_at`). Append-only is **application-level** (no DB trigger). Replay of ACCEPT inserts a second row.

Explicit-id RECORD still allows an event-prefixed id that is not in the current composition (R4 compatibility). Retrieval/resolution of guessed/cross-event ids is `NOT_FOUND`.

---

## 4. M15 → M16 tool inventory (live)

Registered in `registerM15DecisionTools`:

| Tool | Mutates execution? |
|---|---|
| `getManagementRisks` | No |
| `getManagementForecast` | No |
| `getManagementImpact` | No |
| `getRecommendations` | No |
| `getRecommendation` | No (resolve only) |
| `getRecommendationEvidence` | No |
| `runWhatIf` | No (M8.9 / leveling **simulation**) |
| `recordManagementDecision` | Journal only; `authorizesExecution=false` |

No duplicate tools for the same function.

---

## 5. M16 → M12 execution boundary

Conversational execution: `writeTools` → `ExecutionWriteService.applyAction`.  
Mobile: `MobileChannelAdapter` → same EWS.  
ConfirmationGate remains on HIGH_RISK / DESTRUCTIVE intents (`START`, `COMPLETE`, …).  
`RECORD_MANAGEMENT_DECISION` is READ / confirmation NONE.  
Combined “accept it and execute it” is intercepted by `isAmbiguousRecommendationExecution` **before** any tool.

---

## 6. AI → Prisma mutation inventory (M15/M16)

**M15 may create only** `m15_management_decisions` through `ManagementDecisionService`.  
M15 Prisma otherwise: `event.findFirst`, `activity.findFirst`, `activityRelationship.count`, `scheduleScenario.findFirst`, `scheduleBaseline.findFirst` (reads for scope / what-if citation).

**M16 domain writes:** none. Allowed writes remain `m16_interaction_logs.create` and `whatsapp_sessions.update` (event continuity). Execution mutations stay in M12 EWS.

Planning/schedule CRUD (`ActivityService`, `SchedulingService`, …) is **not** part of the M15/M16 execution boundary and was not moved into EWS.

---

## 7. Tenant / event isolation

- Routes: `withTenantGuard` + `session.user.organization_id`; event from path.
- Facade: `assertEventScope` (`event.id` + `organization_id`).
- Journal list/create: `organization_id` + `event_id`.
- Resolver: other-event ids fail prefix check; conversation ids filtered to `m15-rec:{eventId}:`.
- Adapter envelope always returns trusted `ctx.organizationId` / `ctx.eventId`.

---

## 8. Performance gaps

In-memory composition of 5,000 recommendations is tested. There is **no live production-like SQL Server soak** at 5K–50K activities. PERFORMANCE remains **AMBER**.

---

## 9. Browser verification status

No browser MCP / live authenticated session against `/events/[eventId]/management-intelligence` in this environment. UI source includes list, detail/evidence, what-if, Accept/Reject/Defer/RFI, decision history, and explicit non-execution copy. BROWSER remains **AMBER**. Product code was not changed to force GREEN.

---

## 10. Post-implementation re-gate (independent)

Repeated after R5 code:

- Route inventory: 7 management routes (risks, forecast, impact, recommendations, recommendation by id, what-if, decisions). Unchanged set; decisions POST comment documents ignored `authorizesExecution`.
- M15 mutation inventory: journal `create` only; no Activity/Workpack/EWS imports.
- M16 tool inventory: eight M15 tools; write tools still sole pipeline EWS path (plus Mobile adapter).
- Recommendation resolution: `recommendationResolver.ts` + conversation ids; ASK on ambiguity.
- Prompt injection: `CONTEXT_OVERRIDE` includes ignore-event-context and “from another event”; pipeline blocks `EVENT_OVERRIDE`.
- Authority: M15 did not become another progress/CPM/readiness/execution engine.

---

## 11. Findings

| ID | Sev | Item |
|---|---|---|
| — | P0 | None |
| — | P1 | None |
| R5-P2-1 | P2 | No live 5K SQL soak (inherited) |
| R5-P2-2 | P2 | Browser not live-session verified (inherited infrastructure) |
| R5-P2-3 | P2 | Exception/recommendation caps 500/50 (inherited) |
| R5-P3-1 | P3 | Append-only has no DB trigger; service has no update/delete |
| R5-P3-2 | P3 | Explicit-id journal still accepts event-prefixed stale ids not in current composition (R4 compatibility) |
| R5-P3-3 | P3 | Informal phrases such as “critical exchanger” may NOT_FOUND unless the tag/title is in the trusted set |
