# M15-R5 — Authority Matrix

**Date:** 8 September 2026

M15 does not become another authority. It cites existing authorities and records a human management decision.

| Capability | Authority |
|---|---|
| Actual progress | M8.13 |
| SPI | M8.13 |
| Planning readiness | M10 / M12 as already defined |
| CPM | M11 |
| Schedule | M11 |
| EVM | M8.10 |
| Operational exceptions | M13 |
| Reporting | M14 |
| Recommendation | M15 composer (`m15-recommendation-compose@1.0`) |
| Management priority | M15 ranking (`m15-management-priority@1.0`) — **not** M16 `ActionRiskLevel` |
| What-if | M8.9 / approved leveling **simulation** |
| Human management decision | M15 journal (`ManagementDecisionService`) |
| Conversation | M16 |
| Action risk | M16 |
| Execution mutation | M12 `ExecutionWriteService` |

---

## Proof M15 is not a second engine

- No `calculateProgressMetrics`, `evaluateExceptions`, CPM recompute, or readiness engine inside M15.
- No `ExecutionWriteService` import in `src/core/m15`.
- No `prisma.activity.(create|update|delete)`.
- What-if persists only M8.9 scenario rows (hypothetical), never live Activity.
- Ranking CRITICAL ≠ M16 execution risk CRITICAL.
- ACCEPT ≠ authorization ≠ START.

BRE `RecommendationEngine` / `bre_recommendations` remains unused.
