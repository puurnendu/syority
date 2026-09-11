# M12 Final Balance — Forensic Audit

**Date:** 8 September 2026  
**Job:** Execution-authority balance (not a feature expansion)  
**M15 / M16:** Not reopened. No M17.

This audit inspected the live tree. It does not assume that every `prisma.activity.update` is an execution bypass.

---

## Canonical field split

**Execution action fields (M12 EWS when they represent actual execution):**

- persisted execution `status` transitions (`not_started`, `released`, `in_progress`, `on_hold`, `completed`, `verified`, `closed`)
- `progress_percent`
- `actual_start` / `actual_end`
- EVM actual percent fields (`physical_percent_complete`, `duration_percent_complete`, `unit_percent_complete`)
- hold / resume / delay / release / verify / close as actions

**Planning / schedule fields (M11 / planning CRUD — not EWS):**

- `planned_start` / `planned_end`
- `duration_hours` / `remaining_duration`
- predecessors / successors
- calendar / resources / constraints (via their own services)
- WBS, sequence, description, discipline, notes, activity number
- CPM outputs (`early_*`, `late_*`, `total_float`, `free_float`, `is_critical`)

NOT_READY / READY remain **derived** readiness, not persisted execution states.

---

## Four previously identified routes (UI → API → Prisma)

| Route | UI | Before | After |
|---|---|---|---|
| `PUT /api/activities/[id]` | `ScheduleContainer` (no projectId), generic activity edit | Wrote `status`, `progress_percent`, `actual_start/end` with `workpacks.edit`, org-only | **409** if execution fields present. Planning fields only. |
| `PUT /api/projects/[id]/schedule/activities/[activityId]` | `ScheduleContainer` schedule grid | Same execution fields + planned dates; CPM trigger included actuals | Execution fields **409**. Planned dates/duration still M11 + SOS recalc. |
| `POST /api/activities/bulk` | `ActivityPlanningGrid` | Create/update could set status/progress | Creates forced `not_started` / 0%. Updates **409** if execution fields present. |
| `PATCH /api/workpacks/[id]/activities/bulk` | `ActivitiesPanel` bulk status | Direct `updateMany` status/progress; auto in_progress/completed; silent skip | Execution → `ExecutionWriteService.bulkApplyAction` with per-row results + workpack `event_id`. Discipline remains planning `updateMany`. |

Additional live bypass closed:

- `ActivityService.updateActivity` (workpack activity PATCH) accepted any body including status/progress. Now rejects execution fields.
- `ActivityService.updateProgress` was a second progress writer (no remaining callers). Now delegates to EWS.
- `ExecutionExcelAdapter` resolved `activity_number` **org-wide** (duplicate numbers across events could map the wrong UUID). Now **event-scoped**; ambiguous numbers in the same event error; `event_id` required on bulk-upload.
- `POST /api/execution/activity-action` did not accept `UPDATE_PROGRESS` (cockpit already sent it). Mapped to `execution.update`.

---

## UI traces that were mixed-purpose

**Schedule grid (`ScheduleContainer`):** planners edit planned dates (M11) and also edited % complete / status / actuals as generic cells. Actuals auto-filled from progress on the planning PUT. That was execution through a schedule API.

**After:** execution cells POST `/api/execution/action` (EWS). Planned date/duration cells remain the schedule PUT.

**Workpack activity grid:** inline progress/status PATCH went to `ActivityService.updateActivity`. Now POST `/api/execution/action`. Other columns (activity id, duration, discipline, predecessors) stay planning PATCH.

**Planner workspace `ActivityGrid`:** already posted execution cells to `/api/execution/action`. Unchanged.

**Execution cockpit:** already used `/api/execution/activity-action`. UPDATE_PROGRESS permission hole closed.

---

## Post-remediation scan principle

The result is **not** “zero `prisma.activity.update` outside EWS”.

The result is: **no execution mutation path bypasses M12 ExecutionWriteService.**

See `docs/M12_FINAL_CALLER_MATRIX.md` for every remaining writer classified GREEN / AMBER.
