# M15-R5 — Conversational Recommendation Resolution

**Date:** 8 September 2026

The LLM may propose a reference. The application resolves it. The LLM cannot manufacture `recommendationId`, `organizationId`, `eventId`, `userId`, or authorization.

---

## Resolution order

Implemented in `src/core/m15/recommendationResolver.ts`, applied only to the current event-scoped recommendation set:

1. **Explicit recommendation ID** (`params.recommendationId` or `m15-rec:…` in text). Must start with `m15-rec:{trustedEventId}:` and exist in the current composition for retrieval.
2. **Current conversation recommendation ids** stored by the pipeline after a successful M15 tool result (`updateConversationRecommendations`). Ids that do not match the trusted event prefix are discarded. Event change clears the list.
3. **Explicit equipment / activity / workpack** from the M16 entity resolver (verified ids/tags, not LLM UUIDs).
4. **Unique text / title / category match** on remaining candidates.
5. If more than one candidate remains: **ASK**. Never guess.

Examples:

| Utterance | Expected |
|---|---|
| Accept this recommendation | Unique last conversation rec, else ASK |
| Accept the recommendation for HX-204 | Unique HX-204 rec, else ASK (“two recommendations concerning HX-204”) |
| Show me the recommendation about HX-204 | Singular resolve or ASK; list language still lists |
| What was the recommendation you just gave me? | Conversation last rec(s) |
| Reject that recommendation | Same resolver + `REJECT` |
| Defer the recommendation concerning the CDU | Unique CDU match |
| Accept it and execute it | **Not resolved as execution.** ASK / handoff text. No EWS |

---

## Security

- Conversation ids are those the **application returned**, not LLM-invented strings.
- Cross-event / cross-org ids are not resolvable in the trusted event.
- Adapter always executes against `ctx.organizationId` / `ctx.eventId`.
- `executeGetRecommendations` only attempts singular resolve for singular language; “show recommendations” still returns the list (does not ASK the entire pool).

---

## Ambiguity contract

`AMBIGUOUS` returns candidate titles and ids for the user to choose. No journal row is written. No EWS call.
