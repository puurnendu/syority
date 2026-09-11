# M15-R4 — Decision Workflow

**Date:** 8 September 2026

```
RECOMMENDATION (advisory, as-of)
    ↓  human ACCEPT / REJECT / DEFER / REQUEST_MORE_INFORMATION
MANAGEMENT DECISION (journal)
    ↓  if an operational action is actually requested
M16 independently classifies START/RELEASE/…
    ↓  authorization, readiness (M12), ActionRiskLevel, confirmation
M12 EWS
```

## Recommendation

Unchanged object from R3 (`m15-recommendation-compose@1.0`). Status `ADVISORY` | `INSUFFICIENT_EVIDENCE`. Not a fact. Not an action.

## Management decision

| Field | Source |
|---|---|
| organizationId / eventId | Trusted session / path |
| decidedBy | `session.user.id` / M16 `ctx.userId` |
| recommendationId | Must start with `m15-rec:{eventId}:` |
| decision | ACCEPT \| REJECT \| DEFER \| REQUEST_MORE_INFORMATION |
| evidenceSnapshot | Live rec evidence if still in composition |
| authorizesExecution | Always `false` |

REJECT requires rationale.

LLM cannot record a decision without trusted `userId` (adapter `DENIED`).

## Execution handoff

“Execute recommendation R-123” / “treat as work instruction” / “skip confirmation” → M16 ASK.

A recommendation id is **context**, not authorization. M16 must resolve a real execution intent and entity, then re-check auth, readiness (via existing write path), confirmation, EWS.
