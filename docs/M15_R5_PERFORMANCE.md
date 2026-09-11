# M15-R5 — Performance

**Date:** 8 September 2026

**Grade: AMBER**

R3/R4 inherited AMBER because there is no live 5K production-like SQL Server soak. R5 does not reopen those milestones to force GREEN.

---

## What was measured

| Workload | Environment | Result |
|---|---|---|
| Compose 5,000 recommendations (`composeRecommendation`) | In-process vitest | Deterministic; under a 4s budget in `m15-r5-hardening.test.ts` |
| Live 5,000–50,000 activity SQL Server soak | Not performed | Missing |

No duplicate engines were added to “optimize.” Recommendation cap remains 50 returned; exception composition cap remains 500.

---

## What was not measured in production SQL

- M15 recommendation retrieval against 5K activities
- Risk retrieval / evidence assembly query counts
- Decision journal insert latency on SQL Server
- M16 entity resolution at large volume
- What-if on a 5K network
- Memory / payload size of live Control Tower summaries

Without that soak, PERFORMANCE cannot be GREEN. That is acceptable for M15 closure.

---

## Limits preserved

- `M15_EXCEPTION_LIMIT = 500`
- `M15_RECOMMENDATION_LIMIT = 50`
- Conversation rec ids stored: max 50, event-prefixed only
