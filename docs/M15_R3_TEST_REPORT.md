# M15-R3 — Test Report

**Date:** 8 September 2026  
**Runner:** `npx vitest run`

## Focused pack (this milestone)

```
src/core/m15
src/core/control-tower
src/core/execution/__tests__/m12-bulk-readiness.test.ts
src/core/schedule/ScheduleOrchestrationService.test.ts
```

**6 files, 58/58 passed** (R1 + R2 + R3 + M13 + M12 bulk + M11 SOS).

New file: `src/core/m15/__tests__/m15-r3-recommendations-whatif.test.ts`

R1/R2 tests were **not** weakened. The only R3-related scan issue was a comment that named a forbidden class; the comment was reworded so R1/R2 `not.toContain('ScopeChangeImpactService')` remains valid.

| Gate | Result |
|---|---|
| Recommendation authority / compose model | Pass |
| Evidence required or INSUFFICIENT_EVIDENCE | Pass |
| Deterministic compose | Pass |
| Event isolation | Pass |
| Tenant: activity not in event | Pass |
| Permission: routes `nav.schedule` + session org | Pass (source scan) |
| Priority reused from R2 | Pass |
| No BRE / EWS / leveling apply / exception fork | Pass (source scan) |
| No Activity mutation on DURATION_SLIP | Pass |
| Scenario assumptions / hypothetical flag | Pass |
| Unsupported what-if | Pass |
| Insufficient evidence / delayed start without planned_start | Pass |
| M16 adapter ignores LLM org/event; no execute | Pass |
| Large set cap 50 | Pass |
| R1/R2 regression | Pass (same pack) |

## Regression pack

**34 files, 725/725 passed.**

M14 `report-builder` PDF/Puppeteer tests were **not** re-run to force GREEN. R1 documented Chrome-missing timeouts. Those tests were not modified.

## Large-volume

Recommendation cap 50 with `recommendationsTruncated`. Exception list still capped at 500 (R2 P2). No live 5K DB soak.
