# M15-R1 — Test Report

**Date:** 8 September 2026  
**Runner:** `npx vitest run` (node environment)

---

## 1. M15 facade suite

File: `src/core/m15/__tests__/m15-r1-decision-intelligence.test.ts`

**16 / 16 passed.**

| Gate | Coverage |
|---|---|
| A Tenant | Org A cannot load Org B event |
| B Event | Event A cannot load Event B activity; scenario finish requires org+event |
| C Entity collision | Activity lookup is UUID + org + event, not name |
| D Forecast | EAC is currency; execution finish is date; default payload has no unlabeled scenario finish |
| E Impact | Slip `hours`; network `activity_count`; resource `risk_record_count` |
| F Scenario | `runImpactScenario` calls M8.9; no `activity.update`; calendar via SOS; no leveling apply in scenario source |
| G M13 | `getSummary` consumed; `CRITICAL_LATE` interpreted; `evaluateExceptions` not imported |
| H Readiness | M15 does not import M10 or M12 readiness services |
| I Evidence | org/event on risk; downstream count unit `count` |
| J Auth | `withTenantGuard` 401 + `guardApi('nav.schedule')`; no body org/event |
| K AI | Adapter uses trusted ctx; `runImpactScenario` DENIED without `userId` |
| L Source scan | Forbidden engines, prisma domain writes, M16 `ActionRiskLevel` import |

Isolation remediations also asserted in source:

- M13 constraint `workpack.event_id`
- CP intelligence event-scoped relationships
- Scenario calc `resolveWorkingHoursPerDay` and no `working_hours_per_day: 10`

---

## 2. Directly related suites

| Suite | Result |
|---|---|
| `ControlTowerQueryService.test.ts` (M13) | Passed (includes workpack event filter) |
| `ScheduleOrchestrationService.test.ts` (M11) | Passed |
| `m10-planning.test.ts` + progress-calculation | **139 passed** (2 files in that invocation) |

---

## 3. M8–M16 regression pack

Command:

```
npx vitest run src/core/m15 src/core/control-tower src/core/schedule/ScheduleOrchestrationService.test.ts src/core/evm src/core/planning src/core/execution src/core/report-engine src/core/report-builder src/core/m16 tests/progress-calculation.test.ts
```

| | |
|---|---|
| Files | 31 passed, **2 failed** |
| Tests | **725 passed**, **2 failed** |

Failures (both M14 renderer, **not M15**):

1. `M14R4RenderingDelivery.test.ts` — HTML/PDF/XLSX/CSV dataset-hash test **timed out (5000ms)** after Puppeteer: Chrome not installed in sandbox cache.
2. `M14R5ReportDesigner.test.ts` — same class of PDF timeout.

These tests were not weakened. They fail on missing Chrome in this environment.

M16 suites in the pack passed. M12 execution suites passed. M8.10 EVM passed. M14 **provider** tests (non-PDF) passed.

---

## 4. Tests not added on purpose

- No live HTTP server / browser pass (no running app required for this composition layer; routes are source-scanned against existing `withTenantGuard` convention).
- No new M13 LATE-rule tests (rules must stay in ControlTowerRules).
- No rewrite of M12 readiness performance tests.

---

## 5. Test grade implication

- **M15: GREEN**
- **M8.13 / M10 / M11 / M12 / M13 / M16 in this pack: GREEN**
- **M14: AMBER** (Puppeteer/Chrome environment)

Overall TEST for the milestone: **AMBER** because the requested M8–M16 regression pack is not 100% green in this environment. The two failures are unrelated renderer timeouts.
