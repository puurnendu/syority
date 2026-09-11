# M15-R4 — Forensic Audit

**Date:** 8 September 2026  
**Predecessor:** M15-R3 CLOSED AMBER (not reopened).

---

## 1. Current M15-R3 architecture (verified)

- Facade `DecisionIntelligenceService`: risks, forecasts, impact, recommendations, what-if
- Composer `m15-recommendation-compose@1.0` (in-memory, not BRE)
- Ranking `m15-management-priority@1.0`
- Adapter `m15ToToolResult` existed but was **not registered** as live M16 tools
- Routes: risks / forecast / impact / recommendations / what-if
- UI: `/events/[eventId]/management-intelligence`
- Read-only vs live Activity / EWS / leveling apply

R3 AMBER (no 5K soak, no live browser) is inherited, not treated as an R4 defect.

---

## 2. Existing management decision / action mechanisms

| Candidate | Class | Verdict |
|---|---|---|
| BRE `RecommendationEngine` / `bre_recommendations` | Lifecycle register | **Unsafe** (nullable `event_id`, required confidence, `source_type=ai`, `getById` unscoped) |
| OIS `MeetingPanel` Decision Log | Client `useState` | **Not persistence** |
| M16 `m16_interaction_logs` | Interaction audit | **Not a decision record**; M16 must not grow extra Prisma writes |
| `AuditService` / `AuditLog` | Mutation audit | Reuse as **side log**, not the journal |
| M12 execution history | Execution | **Not** a management decision |
| Action register (search) | None in Prisma | No reusable register |

---

## 3. Is a new decision table required?

**Yes — proven, not decorative.**

R4 requires: durable ACCEPT/REJECT/DEFER/RFI, human actor, org+event scope, evidence snapshot, audit of “management decision made”, and explicit non-execution.

No existing store is safe. M15 remains read-only for **execution**. The journal is append-only and `authorizesExecution: false`.

---

## 4. M16 → M15 status before R4

- Adapter ops existed for risks/forecast/impact/recommendations/what-if
- `readTools.ts` / `intents.ts` had **no** M15 intents
- Instrumentation registered R2 read + R3 write only
- “Why is HX-204 a concern?” could not reach M15 through the pipeline

---

## 5. R4 gaps (closed unless noted)

| Gap | Action |
|---|---|
| Live M16 tools | `registerM15DecisionTools` |
| QUERY intents | GET_RECOMMENDATIONS, GET_MANAGEMENT_RISKS, forecast, impact, RUN_WHAT_IF, RECORD_MANAGEMENT_DECISION |
| Decision journal | `m15_management_decisions` |
| Ambiguous “execute the recommendation” | Pipeline ASK; never EWS |
| UI Accept/Reject | POST `/management/decisions` |
| Single-rec GET | `/management/recommendations/[recommendationId]` |

---

## 6. Authority / security / tenant

See `M15_R4_AUTHORITY_MATRIX.md` and `M15_R4_SECURITY_ACCEPTANCE.md`.

P0/P1: none after reuse decision.
