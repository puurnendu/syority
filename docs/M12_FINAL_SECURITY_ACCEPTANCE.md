# M12 Final — Security Acceptance

**Date:** 8 September 2026

---

## Tenant isolation

EWS loads Activity with `organization_id = orgId`. Cross-tenant UUID execution is rejected (`Activity not found`). Existing `m12-tenant-isolation` suite still passes.

Planning PUTs remain org-scoped (`withTenantGuard` + `organization_id`). That is correct for planning CRUD and is not an execution path.

---

## Event isolation

| Path | Result |
|---|---|
| Excel activity_number | Resolved with `organization_id` **and** `event_id`. Ambiguous numbers in the same event fail closed. |
| Excel / bulk-upload API | `event_id` required. |
| EWS `options.eventId` | Activity and workpack must match; write `where` includes `event_id`. |
| Workpack bulk execution | Passes workpack `event_id` into `bulkApplyAction`. |
| Web/M16 EWS without eventId | Relies on globally unique Activity UUID + org. **P2:** session event cookie is not yet a mandatory EWS argument for cockpit/M16. |

Confirmation context for M16 remains conversation-bound (unchanged; M16 not reopened).

---

## Authorization

- Cockpit `/api/execution/activity-action`: per-action `execution.*` permissions (including `UPDATE_PROGRESS` → `execution.update`).
- `/api/execution/action`: `workpacks.edit` then EWS (pre-existing web path; same as schedule-grid execution cells).
- `/api/execution/bulk-action` and bulk-upload: `execution.bulk`.
- Planning PUTs: `workpacks.edit` / `projects.edit` / `nav.schedule` but **cannot persist execution fields**.
- AI / WhatsApp / Voice / Mobile cannot write Activity execution Prisma; they reach EWS only through governed adapters.

EWS itself does not re-check CASL (**P2**). Routes must keep calling `guardApi`.

---

## Audit / EventBus / ProgressLog

Every EWS mutation (except REPORT_DELAY, which writes a constraint) still:

1. ProgressLog in the same transaction
2. AuditService.log in the same transaction (`execution_action`, `source_channel`)
3. EventBus after commit (`ActivityStarted`, `ActivityProgressUpdated`, etc.)

Planning CRUD that remains outside EWS uses ActivityService AuditService where that service is used. Schedule PUT still has no ProgressLog — correct, because it is no longer allowed to change execution facts.

---

## Prompt / identity

No change to M16 identity rules. LLM cannot set org/event/user. This job did not add an AI→Prisma execution path.

---

## Attacks that now fail

| Attack | Result |
|---|---|
| PUT generic activity with `status: completed` | 409, no Prisma execution write |
| Schedule PUT `progress_percent` | 409 |
| Planning bulk update progress | 409 |
| Workpack bulk status | EWS per row; invalid transitions fail that row |
| Excel HX-204 from another event | not in event-scoped map |
| Excel without event_id | 400 |
| `authorizesExecution` / M15 ACCEPT | unchanged; not execution |
