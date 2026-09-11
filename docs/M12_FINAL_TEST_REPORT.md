# M12 Final Balance — Test Report

**Date:** 8 September 2026

Existing assertions were not weakened to chase GREEN. The M16-R6 test that **documented** the old planning-CRUD bypass was updated to assert the new split (reject / EWS), which is the M12 balance contract.

---

## New tests

`src/core/execution/__tests__/m12-final-balance.test.ts`

| # | Coverage |
|---|---|
| 1 | Direct execution fields rejected on generic/schedule PUT (source) |
| 2 | Legitimate planning/schedule fields remain on those routes |
| 3 | Schedule mutation remains M11 SOS for planned dates |
| 4 | EWS command boundary + event bind |
| 5 | Cross-event Excel number resolution uses event_id |
| 6 | Invalid status reverse (not_started from in_progress) not mapped |
| 7–12 | HOLD/RESUME/COMPLETE/VERIFY/CLOSE mapping |
| 13 | Workpack bulk uses `bulkApplyAction` + per-row results |
| 14 | Excel event-safe runtime mock |
| 15–17 | Audit/EventBus/M8.13 comments remain on EWS (no second calculator) |
| 18 | Remaining writers classified; no second engine |

Hold/resume/complete/verify/close/cross-tenant invalid transitions continue to live in `m12-hold-resume.test.ts` and `m12-tenant-isolation.test.ts`.

---

## Regression run (8 September 2026)

```
npx vitest run src/core/execution src/core/m15 src/core/m16 src/core/planning/__tests__ src/core/control-tower/__tests__ src/core/schedule tests/m11-v1-schedule-view.test.ts tests/m11-cross-event-safety.test.ts src/core/report-builder/__tests__/M14R5ReportDesigner.test.ts
```

**36 files, 847 tests, 0 failed.**

Includes M12 (balance + R0.1 + hold/resume + tenant + bulk readiness + concurrency), M15, M16, M10 planning, M13 control tower, M11 schedule tests, M14 designer.

M8.13 has no dedicated vitest pack under `src/core/progress`; EWS still delegates post-write sync and does not calculate progress.

---

## Not run

Live SQL Server 5k soak, live browser session. Not required to close this governance job; remaining PERFORMANCE/BROWSER debt stays P2 where previously AMBER.
