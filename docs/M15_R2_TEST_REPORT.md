# M15-R2 — Test Report

**Date:** 8 September 2026  
**Runner:** `npx vitest run`

## Focused pack (this milestone)

```
src/core/m15
src/core/control-tower
src/core/execution/__tests__/m12-bulk-readiness.test.ts
src/core/schedule/ScheduleOrchestrationService.test.ts
```

**5 files, 45/45 passed** (includes R1 + R2 + M13 + M12 bulk + M11 SOS).

New file: `src/core/m15/__tests__/m15-r2-evidence-forecast-risk.test.ts`

| Gate | Result |
|---|---|
| A Evidence layers + event-scoped entity ids | Pass |
| B Forecast types, EAC currency, no 87% confidence | Pass |
| C M13 reused; ranking deterministic; P4 ≠ HIGH | Pass |
| D Completeness flag when readiness incomplete | Pass |
| E Impact count vs hours; completion hours null | Pass |
| F Adapter ignores LLM org/event | Pass |
| G M13 5K no skip; M12 bulk query-count | Pass |
| H Source scan: no EWS, leveling apply, progress, M15Readiness | Pass |

R1 tests updated only for `ManagementRiskResult` (`.risks`) and `getSummary` third argument. Not weakened.

## Regression pack (M8–M13, M16, M14 providers, progress)

```
npx vitest run src/core/m15 src/core/control-tower src/core/execution src/core/evm
  src/core/planning src/core/schedule/ScheduleOrchestrationService.test.ts
  src/core/m16 src/core/report-engine tests/progress-calculation.test.ts
```

**33 files, 712/712 passed.**

M14 `report-builder` PDF/Puppeteer tests were **not** re-run to force GREEN. R1 documented Chrome-missing timeouts. Those tests were not modified.

## Large-volume

5000 not-started activities: M13 **calls** M12 bulk (does not skip). Completeness recorded.

No live database soak.
