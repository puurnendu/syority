# M15-R4 — Test Report

**Date:** 8 September 2026  
**Runner:** `npx vitest run`

## Focused

```
src/core/m15
src/core/m16/__tests__/m16-r4-m15-handoff.test.ts
src/core/m16/__tests__/m16-r6-production-hardening.test.ts
src/core/m16/__tests__/m16-r1-authority.test.ts
src/core/m16/__tests__/m16-r2-assistant-core.test.ts
src/core/m16/__tests__/m16-r5-parity.test.ts
```

**9 files, 192/192 passed** (includes R1–R4 M15).

New files:

- `src/core/m15/__tests__/m15-r4-decision-workflow.test.ts`
- `src/core/m16/__tests__/m16-r4-m15-handoff.test.ts`

R1 source scan was **narrowed** (not weakened): domain `prisma.*.create/update/delete` still forbidden; only `m15_management_decisions.create` is allowed.

## Regression

```
src/core/m15 src/core/m16 src/core/control-tower src/core/execution
src/core/evm src/core/planning ScheduleOrchestrationService
src/core/report-engine tests/progress-calculation.test.ts
```

**36 files, 745/745 passed.**

M14 PDF/Puppeteer not re-run. Unrelated tests not modified to chase GREEN.
