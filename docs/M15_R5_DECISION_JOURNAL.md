# M15-R5 — Decision Journal

**Date:** 8 September 2026

Table: `m15_management_decisions` (migration `prisma/migrations/20260908_m15_r4_management_decisions/`). R5 adds no schema change.

---

## What the journal is

- Append-only **management decision record**
- Not execution, not authorization, not Activity mutation
- Distinct from M16 interaction logs and from M12 execution audit

Lifecycle values: `ACCEPT` | `REJECT` | `DEFER` | `REQUEST_MORE_INFORMATION`

---

## Hardened fields

| Field | Source | Spoofable by LLM/API/transcript? |
|---|---|---|
| organization_id | Session / trusted ctx | No |
| event_id | Path / trusted ctx | No |
| decided_by | Authenticated user | No (`ctx.userId` required) |
| recommendation_id | Resolved or explicit event-prefixed id | Cross-event prefix rejected |
| decision | Allow-list | Invalid values rejected |
| created_at | Database now() | No |
| source_channel | Route (`web`) or M16 channel | Not taken from recommendation payload as identity |
| authorizesExecution | **Always false** in `toRecord` | Not a column; `body.authorizesExecution` ignored |

REJECT still requires rationale (R4).

---

## Append-only

`ManagementDecisionService` performs `create` and `findMany` only. Tests assert no `.update` / `.delete` / `.upsert`. Replay of the same ACCEPT inserts a second immutable row. Historical rows are not converted into mutable status records.

No database trigger was added (smallest safe change: keep application-level append-only; P3).

---

## Audit

Each record calls `AuditService.log` with action `m15.management_decision.recorded` and `authorizes_execution: false`. This is **not** duplicated as an M12 execution audit. Execution audit remains M12 EventBus / EWS.

Source channels where supported: `web`, `whatsapp`, `voice`, `mobile`, `api`.

---

## Isolation

`list` filters `organization_id` + `event_id`. Prefix check `m15-rec:{eventId}:`. Tenant isolation is the session org, not a client-supplied org.
