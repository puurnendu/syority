# M12 Final — Execution Authority

**Date:** 8 September 2026

---

## What M12 owns

Governed **execution mutations** of live Activity execution state:

RELEASE, START, UPDATE_PROGRESS, HOLD, RESUME, REPORT_DELAY, COMPLETE, VERIFY, CLOSE

Command boundary: `ExecutionWriteService.applyAction` (and `bulkApplyAction` looping the same command).

Guarantees retained:

- tenant (`organization_id`) isolation
- optional `eventId` bind on the write
- workpack issued / in_execution gate
- readiness on RELEASE / START-from-not_started
- hold-point check on COMPLETE / 100% progress
- transaction: Activity + ProgressLog + AuditLog
- EventBus after commit
- M8.13 workpack cache sync **after** transaction (`FieldExecutionService.syncWorkpackProgress`) — not a second progress engine

M12 does **not** calculate progress, CPM, or planning readiness.

---

## What M11 owns

Planned schedule configuration and CPM persistence:

- planned dates, duration, logic, calendar, resources
- SOS persist of early/late/float/critical
- leveling apply of **planned** dates
- schedule change control of planned dates/duration

These must **not** go through EWS.

---

## What M8.13 owns

Authoritative progress **calculation / aggregation**. EWS writes the execution facts (status, `progress_percent`, actuals, ProgressLog). M8.13 remains the aggregation authority via post-write sync. EWS does not call `calculateProgressMetrics`.

---

## Channel contract

| Channel | Path |
|---|---|
| Web execution cockpit | `/api/execution/activity-action` → EWS |
| Web schedule/workpack execution cells | `/api/execution/action` → EWS |
| Workpack bulk status/progress | workpack bulk route → `bulkApplyAction` |
| Excel | `ExecutionExcelAdapter` → `bulkApplyAction` (event required) |
| M16 conversation | writeTools → EWS |
| Mobile | MobileChannelAdapter → EWS |
| WhatsApp approve | existing EWS UPDATE_PROGRESS |

M16 remains interaction. M15 remains intelligence. Neither writes execution Prisma.

---

## State machine (persisted)

```
not_started + READY → RELEASED
RELEASED → IN_PROGRESS          (START)
not_started + READY → IN_PROGRESS (START, readiness still enforced)
IN_PROGRESS → ON_HOLD
ON_HOLD → IN_PROGRESS           (RESUME)
IN_PROGRESS → COMPLETED
COMPLETED → VERIFIED
VERIFIED → CLOSED
```

Invalid transitions are rejected inside EWS. Generic CRUD cannot set these statuses.

`cancelled` remains a **scope-change / planning** disposition (M8.11 apply), not a field-execution action. Documented AMBER exception.

---

## Acceptance statement

All genuine execution mutations are governed by M12 ExecutionWriteService. Legitimate planning/scheduling mutations remain governed by their respective authorities. No second execution mutation engine exists.
