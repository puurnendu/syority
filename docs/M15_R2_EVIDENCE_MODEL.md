# M15-R2 — Evidence Model

**Date:** 8 September 2026

## Envelope

`DecisionResultBase`: `organizationId`, `eventId`, `sourceAuthority`, `sourceService`, `calculatedAt`, `asOf`, `calculationType`, `evidence[]`.

## Evidence row

| Field | Use |
|---|---|
| entityType / entityId / entityLabel | What the fact is about |
| metric / value / unit | Named scalar |
| sourceAuthority / sourceService / sourceRecord | Who produced it (`Activity.progress_percent`, not SQL) |
| layer | FACT / CALCULATION / INTELLIGENCE / RECOMMENDATION |
| explanation | Optional, especially for INTELLIGENCE |

Not included: passwords, tokens, credentials, arbitrary SQL, security internals.

## Distinctions (required)

**FACT:** `progress_percent` 60% — M8.13.

**CALCULATION:** remaining-duration finish, EAC, downstream count — owning engine.

**INTELLIGENCE:** management priority score, “likely to affect TA completion” — M15 composition of M13+M11.

**RECOMMENDATION:** ResourceRisk `recommended_action` text. R2 does **not** execute it.

M15 interpretation is never labeled FACT.

## Completeness is evidence of coverage

`IntelligenceCompleteness` on the risk bundle:

- `readinessComplete`
- `readinessNotStartedCount` / `readinessEvaluatedCount`
- `exceptionsTruncated` / returned / total

If readiness was not evaluated, M15 says so. It does not invent `READINESS_BLOCKED` locally.
