# M12 Final Balance — Closure

**Date:** 8 September 2026

---

## 1. What M12 owns

The single **execution command boundary**: `ExecutionWriteService.applyAction` / `bulkApplyAction`.  
Actions: RELEASE, START, UPDATE_PROGRESS, HOLD, RESUME, REPORT_DELAY, COMPLETE, VERIFY, CLOSE.

## 2. What M11 owns

Planned dates, duration, logic, calendar, resources, CPM persist (SOS), leveling apply of planned dates, schedule change control.

## 3. What M8.13 owns

Progress calculation / aggregation. EWS writes facts; `syncWorkpackProgress` refreshes workpack cache after commit. No second progress engine.

## 4. Activity mutations that remain outside EWS (and why)

See `docs/M12_FINAL_CALLER_MATRIX.md`. Summary: planning create/update/soft-delete, sequence, WBS, planned dates, CPM outputs, leveling planned dates, hold-point **designation**, seeds/backfills, scope-change **create/modify**, template instantiate.

## 5. Activity mutations now forced through EWS

- Schedule grid and workpack grid **status / progress / actuals**
- Workpack **bulk status/progress**
- `ActivityService.updateProgress`
- Excel execution import (already EWS; now event-scoped)
- Cockpit `UPDATE_PROGRESS` (permission path fixed)

Generic/schedule/planning-bulk endpoints **reject** execution fields (409) rather than writing them.

## 6. Genuine execution bypass remaining?

**None (P0 = 0, P1 = 0).**

## 7. Tenant / event isolation

Cross-tenant EWS: rejected. Excel and workpack bulk execution: event-bound. Web/M16 EWS without explicit `eventId` still keys off org + activity UUID (**P2**).

## 8. Audit / EventBus

EWS transaction still writes ProgressLog + AuditLog and emits EventBus. Planning PUTs no longer change execution facts, so they no longer silently mutate execution without ProgressLog.

## 9. Bulk execution

`bulkApplyAction` remains per-activity success/failure (not one all-or-nothing execution transaction). Workpack bulk returns `results` / `failed`. Planning bulk is unchanged except execution fields are refused for the whole request (no silent execution mutation).

## 10. Excel

`event_id` required. `activity_number` resolved in org+event. Ambiguous numbers fail. Writes still only via EWS.

## 11. Tests

847 passed in the M10–M16 + M11 + M12 + M14 pack listed in `M12_FINAL_TEST_REPORT.md`.

## 12. Remaining P2 / P3

| ID | Sev | Item |
|---|---|---|
| M12-P2-1 | P2 | Web/M16 `applyAction` does not require `eventId` (UUID uniqueness) |
| M12-P2-2 | P2 | EWS does not enforce CASL; routes must |
| M12-P2-3 | P2 | Scope-change `status: cancelled` outside EWS (M8.11 planning disposition) |
| M12-P2-4 | P2 | Workpack bulk execution authorized with `workpacks.edit` (same as `/api/execution/action`) |
| M12-P2-5 | P2 | `verifyPrerequisites` in EWS is still a stub; readiness service is the live gate |
| M12-P3-1 | P3 | Excel still prefers `act_` prefix for raw UUIDs |
| M12-P3-2 | P3 | Project branch clone copies activity rows including status |
| M12-P3-3 | P3 | Hold-point PATCH updates by id after org-scoped find (not a second `where` org) |

---

## Grades

| Gate | Grade |
|---|---|
| CODE | GREEN |
| TEST | GREEN |
| AUTHORITY | GREEN |
| SECURITY | GREEN |
| TENANT | GREEN |
| EVENT | GREEN (Excel/bulk); web UUID path AMBER-as-P2 |
| PERFORMANCE | AMBER (no new soak; out of scope) |
| API | GREEN |
| DATABASE | GREEN (no schema change) |
| DOCUMENTATION | GREEN |
| BROWSER | AMBER (no live session this job) |

**Overall: GREEN** for execution-authority balance (P0/P1 = 0). PERFORMANCE/BROWSER remain inherited AMBER and are not treated as M12 blockers.

**M12 status: CLOSED for this balance job.**

---

## Acceptance statement

All genuine execution mutations are governed by M12 ExecutionWriteService. Legitimate planning/scheduling mutations remain governed by their respective authorities. No second execution mutation engine exists.

No commit was created.
