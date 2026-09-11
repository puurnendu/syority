# M16-R6 — Execution Authority

**Date:** 8 September 2026

There is **one named field-execution action authority:** `ExecutionWriteService` (EWS).

M16 / WhatsApp / Voice / Mobile / `/api/execution/*` / Excel bulk / planner WhatsApp approve all terminate in EWS.

**Historical planning/schedule CRUD can still write `status` and `progress_percent` without EWS.** That is authenticated tenant-scoped M8/M11 web editing, not a second channel execution engine. It is **not** AI-reachable. It **is** a live alternate column-level mutation path. Accepted as P2 (do not expand M12 in R6).

Independent inventory: [EWS caller matrix](8b0beaa0-d4cf-46a2-a78b-b4a04add6c89).

## Planning CRUD (not EWS) — live

| Caller | Channel | Mutation | Auth | EWS | Verdict |
|---|---|---|---|---|---|
| `app/api/activities/[id]` PUT | web | `status`, `progress_percent`, actuals | `workpacks.edit` | No | P2 historical actuals API (M8.4) |
| `app/api/projects/[id]/schedule/activities/[activityId]` PUT | web | `status`, `progress_percent` + schedule fields | `projects.edit` | No | P2 schedule grid |
| `app/api/activities/bulk` POST | web | create/update status/progress | `nav.schedule` | No | P2 planning grid |
| `app/api/workpacks/[id]/activities/bulk` PATCH | web | bulk status/progress (100% → completed) | `workpacks.edit` | No | P2 workpack grid |

HOLD/RESUME as **named actions** have no alternate path. Status field writes can approximate them poorly.

## Execution Authority Matrix

| Caller | Channel | Mutation | Authorization | Risk | Confirmation | EWS | Audit | EventBus | Verdict |
|---|---|---|---|---|---|---|---|---|---|
| R3 writeTools | web AI / WhatsApp / Voice pipeline | 9 actions | R3 fail-closed | `classifyRisk` | ConfirmationGate if EXPLICIT | `applyAction` `source_channel: 'ai'` | AuditService in tx | post-tx | GREEN |
| MobileChannelAdapter | mobile | 9 actions | R3 fail-closed | `classifyRisk` | Tactile + `requestId` for high/destructive | `applyAction` `mobile` | in tx | post-tx | GREEN |
| `app/api/execution/activity-action` | web | action body | `guardApi` / session | UI | Tactile | EWS | in tx | post-tx | GREEN |
| `app/api/execution/action` | web | action body | session | UI | Tactile | EWS | in tx | post-tx | GREEN |
| Planner approve | web | `UPDATE_PROGRESS` | `workpacks.edit` | implicit | Human approval screen | EWS `whatsapp` | in tx | post-tx | GREEN (same EWS) |
| ExecutionExcelAdapter | excel | bulk actions | `execution.bulk` | import | Operator file | `bulkApplyAction` | in tx | post-tx | GREEN EWS; P2 event-number resolve |
| `MessageProcessor.applyProgressUpdate` | none live | stub fail-closed | n/a | n/a | n/a | not called | n/a | n/a | DEAD for live webhook |
| `processInboundMessage` | none live | — | — | — | — | not imported by live route | — | — | DEAD |
| `test-exec.ts` | script | applyAction | none | none | none | yes | — | — | P3 keep out of prod image |
| LLM / Prisma | — | — | — | — | — | — | — | — | ZERO domain writes |

## Nine actions

RELEASE, START, UPDATE_PROGRESS, HOLD, RESUME, REPORT_DELAY, COMPLETE, VERIFY, CLOSE.

State machine + readiness (where EWS enforces) + org-scoped row lock via `updateMany` expected status.

REPORT_DELAY does not change activity status; it creates a constraint then emits `ExecutionDelayReported`.

## Concurrency

| Scenario | Expected | Actual (tests) |
|---|---|---|
| COMPLETE ∥ COMPLETE | one winner | conflict on second |
| START ∥ START | one winner | same CAS pattern |
| UPDATE_PROGRESS ∥ UPDATE_PROGRESS | one winner per version | same |
| Confirmation replay | fail | CONFIRMED terminal |
| WhatsApp duplicate Meta id | skip | adapter idempotency |
| Mobile duplicate requestId | skip/replay safe | in-memory Map (single instance) |

## Not created in R6

No MobileConfirmationGate, WhatsAppConfirmationGate, or second EWS.
