# M12 Final — Direct Activity Caller Matrix

**Date:** 8 September 2026  
**Legend:** GREEN = legitimate non-execution or EWS execution. AMBER = documented exception. RED = bypass (none remaining).

| File / route | Purpose | Fields | UI / channel | User initiated | Class | EWS used | EWS should | Authority | Risk | Disposition |
|---|---|---|---|---|---|---|---|---|---|---|
| `ExecutionWriteService.ts` | Execution command | status, progress, actuals | all execution channels | yes | execution | yes | yes | M12 | — | GREEN |
| `PUT /api/activities/[id]` | Generic activity edit | planning only; execution **409** | ScheduleContainer, misc | yes | planning CRUD | no (reject) | no for planning | planning | was P0 | GREEN — split |
| `PUT .../schedule/activities/[activityId]` | Schedule grid | planned dates/duration/WBS; execution **409** | ScheduleContainer | yes | schedule config | no (reject) | no | M11 | was P0 | GREEN — split |
| `POST /api/activities/bulk` | Planning bulk grid | create not_started/0; update planning; execution **409** | ActivityPlanningGrid | yes | planning | no (reject) | no | planning | was P0 | GREEN — split |
| `PATCH .../workpacks/.../activities/bulk` | Bulk status or discipline | status/progress → EWS; discipline → updateMany | ActivitiesPanel | yes | mixed | yes for execution | yes | M12 / planning | was P0 | GREEN — routed |
| `ActivityService.updateActivity` | Workpack activity PATCH | rejects execution fields | ActivitiesPanel non-exec columns | yes | planning CRUD | no | no | planning | was P1 | GREEN |
| `ActivityService.updateProgress` | legacy progress API | delegates UPDATE_PROGRESS | none (dead) | n/a | execution | yes | yes | M12 | was P1 | GREEN |
| `ActivityService.create/delete/reorder/approve` | planning CRUD | create status=not_started; soft delete; sequence; schedule flag | workpack UI | yes | planning / admin | no | no | planning | — | GREEN |
| `POST /api/activities` | create loose activity | forced not_started / 0 | schedule add | yes | planning create | no | no | planning | — | GREEN |
| `POST .../schedule/activities` | create schedule activity | create | ScheduleContainer add | yes | planning create | no | no | M11/planning | — | GREEN |
| `ScheduleOrchestrationService` | persist CPM | early/late/float/critical | recalc | system | schedule config | no | no | M11 | — | GREEN |
| `SchedulingService` | legacy CPM persist | CPM fields | import/recalc | system | schedule config | no | no | M11 | — | GREEN |
| `ResourceLevelingApplyService` | apply leveling | planned_start/end | planner approve | yes | schedule config | no | no | M11 | — | GREEN |
| `ScheduleChangeControlService` | apply CR | planned dates/duration | change control | yes | schedule config | no | no | M11 | — | GREEN |
| `PlannerWorkspaceService.batchUpdate` | planner cells | duration, planned dates, manpower, notes, wbs — **not** status/progress | workspace | yes | planning | no | no | planning | — | GREEN |
| `ScopeChangeApplicationService` create | new activity | not_started / 0 | scope apply | yes | planning create | no | no | M8.11 | — | GREEN |
| `ScopeChangeApplicationService` modify | duration/cost/planned | planning | scope apply | yes | planning | no | no | M8.11 | — | GREEN |
| `ScopeChangeApplicationService` remove | `status: cancelled` | cancel via scope | scope apply | yes | planning disposition | no | no | M8.11 | P2 | AMBER — not field execution |
| `.../hold-points/[activityId]` | QA hold-point type | hold_point_type/description | QA UI | yes | admin / QA config | no | no | planning/QA | — | GREEN |
| `.../assign-code` | activity id code | activity_id | workpack | yes | admin | no | no | admin | — | GREEN |
| `TemplateLibraryService` | instantiate template | create planning rows | template apply | yes | planning create | no | no | M10 | — | GREEN |
| `WorkpackTemplateService` | template activities | create | master data | yes | master data | no | no | admin | — | GREEN |
| `workpacks/ai-generate` | generate activities | createMany | AI assist planning | yes | planning create | no | no | planning | — | GREEN |
| `ProjectBranchingService` | clone activities | copy including state | branch | yes | admin/planning copy | no | no | admin | P3 | AMBER — clone, not live execution |
| `SeedPackService` / prisma seeds | seed | create | ops | no | admin | no | no | admin | — | GREEN |
| `ResetService` | wipe | deleteMany | ops | no | admin | no | no | admin | — | GREEN |
| `scripts/backfill-*`, `admin/backfill-activity-codes` | codes | activity_number | ops | no | admin | no | no | admin | — | GREEN |
| `scripts/migrate-to-imported` | one-off | updateMany | ops | no | admin | no | no | admin | — | GREEN |
| `ExecutionExcelAdapter` | bulk execution | EWS actions | Excel | yes | execution | yes | yes | M12 | was P1 event | GREEN — event-scoped |
| M16 `writeTools` | conversation execution | EWS | WhatsApp/web/voice | yes | execution | yes | yes | M12 via M16 | — | GREEN |
| `MobileChannelAdapter` | mobile execution | EWS | mobile | yes | execution | yes | yes | M12 | — | GREEN |
| `FieldExecutionService.syncWorkpackProgress` | cache | **workpack** overall_progress only | post-EWS | system | M8.13 sync | n/a | n/a | M8.13 | — | GREEN |

**RED / P0 / P1 remaining:** none.
