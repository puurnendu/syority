# M16-R6 — Forensic Audit

**Date:** 8 September 2026  
**Milestone:** M16-R6 Final Hardening & Production Closure  
**Predecessor:** M16-R1 through M16-R5 GREEN / CLOSED  
**Method:** Independent source forensic + targeted runtime tests. Next.js was not started (writes `.next`). Local Prisma migrations were not applied (would mutate the live database).

**Git (read-only):** branch `develop`, HEAD `6e45b54`, remote unchanged. R6 remediations are uncommitted working-tree changes.

---

## 1. Live route resolution (Area 1)

Next.js 16.1.6 `findDir` still prefers `./app` over `./src/app`. Confirmed in `node_modules/next/dist/lib/find-pages-dir.js`.

| Endpoint | Candidate files | Live file | Auth | Authority |
|---|---|---|---|---|
| WhatsApp Meta webhook | `app/api/webhooks/whatsapp/route.ts` | **live** | HMAC `X-Hub-Signature-256`; missing secret ACKs 200 without processing | `processWhatsAppWebhook` → M16 pipeline → R3 writeTools → EWS |
| Voice process | `app/api/voice/process/route.ts` | **live** | NextAuth JWT | `createGovernedPipelineDependencies` → pipeline → EWS |
| Mobile execute | `app/api/mobile/execute/route.ts` | **live** | NextAuth JWT | Mobile adapter → R3 auth/risk → EWS |
| Web execution | `app/api/execution/activity-action`, `action` | **live** | session `guardApi` / tenant guard | EWS |
| Planner WhatsApp approve | `app/api/whatsapp/updates/[updateId]/approve` | **live** | `guardApi('workpacks.edit')` | EWS `UPDATE_PROGRESS` |
| Excel bulk | `app/api/execution/bulk-upload` | **live** | `execution.bulk` | `ExecutionExcelAdapter` → `EWS.bulkApplyAction` |
| Planning AI assistant | `app/api/projects/[id]/ai-assistant` | **live** | JWT + `guardApi` + tenant | **Read-only** stream; M8.13 for context; **not** M16 pipeline; **not** EWS |
| Reports under `src/app/api/reports/**` | 3 files | **unserved** | n/a | Dead duplicate; Next ignores `src/app` |

`src/app/api` contains only the three unserved report routes. Live M16/R5 duplicates under `src/app/api/{mobile,voice,whatsapp}` were removed in R5.

`GET /api/test-phase2c` remains absent (404).

Middleware (`src/middleware.ts`) treats `/api/` as public. Channel routes must (and do) authenticate themselves. This is defense-in-depth debt, not a live bypass of R3.

---

## 2. AI → domain Prisma (Area 2)

Classification of Prisma writes in M16 / channel / AI paths:

| Class | Location | Verdict |
|---|---|---|
| A infrastructure | WhatsApp session/update rows, audio job metadata | Allowed |
| B audit | `m16_interaction_logs`, `AuditService` via EWS | Allowed |
| C session/context | `whatsapp_sessions.event_id` | Allowed |
| D domain mutation | **None in M16 tools, adapters, pipeline, or LLM callers** | Required |

Write tools and Mobile call `ExecutionWriteService.applyAction` only. Read tools use Prisma **reads** (org/event scoped) plus M8.13 / FieldExecution / ExecutionReadinessService.

Legacy `MessageProcessor.applyProgressUpdate` is a fail-closed stub and is **not** imported by the live webhook.

---

## 3. Execution authority (Area 3)

Single mutation boundary **for named M16/channel/execution-API actions:** `ExecutionWriteService.applyAction` / `bulkApplyAction`.

Callers: R3 `writeTools`, `MobileChannelAdapter`, web execution routes, planner approve, Excel adapter, `test-exec.ts` (script, not a route).

No WhatsApp/Voice/Mobile-specific execution engine.

**P2:** authenticated planning/schedule CRUD (`/api/activities/[id]`, schedule activity PUT, activities bulk, workpack activities bulk) can still write `status` / `progress_percent` without EWS. Inventory: [EWS caller matrix](8b0beaa0-d4cf-46a2-a78b-b4a04add6c89).

---

## 4. Nine actions, isolation, confirmation (Areas 4, 7–9, 6)

Covered by existing M12 + M16-R3/R5 suites: identity → org → event → entity → authorization → risk → confirmation (conversational) → EWS → `$transaction` (`updateMany` with expected status) → AuditLog → EventBus.

Invalid transitions, unauthorized roles, cross-tenant activity IDs, and confirmation binding mismatches are rejected in tests.

Equipment tags resolve org-scoped (assets are org-level). Workpacks and activities resolve `organization_id` **and** `event_id`. Identical tags (HX-204) cannot cross TA-2027 / TA-2028 in the M16 resolver.

---

## 5. Concurrency / idempotency (Area 5)

EWS uses `activity.updateMany` with `status: expectedStatus`. Concurrent COMPLETE: one success, one `Execution conflict`. Already-completed COMPLETE is rejected.

WhatsApp Meta `message.id` idempotency is adapter-level. Confirmation is single-use in-memory. Mobile `requestId` is an in-memory Map.

**Deployment constraint:** all three in-memory stores are safe on the current `docker-compose` single `app` replica. They are **not** safe across horizontally scaled instances. Redis confirmation was **not** introduced because the immediate architecture is single-instance.

---

## 6. Prompt injection, identity, exfiltration (Areas 10–12, 14–15)

Trusted fields (`organizationId`, `userId`, `eventId`, channel, conversation) cannot be set from LLM output (`PromptInjectionBoundary`). Voice/WhatsApp run injection detection on transcript/text before the pipeline.

Identity sources: Web/Mobile JWT; WhatsApp verified phone → user → org; Voice session only; LLM never establishes identity.

Provider secrets are not logged. Voice/WhatsApp/AI route errors return generic messages (`err.message` only in server logs). `callTextAi` treats provider output as untrusted text.

---

## 7. WhatsApp / Voice / Mobile (Areas 13–15)

**WhatsApp:** HMAC required when secret is set. Missing signature / invalid signature → 401. Missing `WHATSAPP_APP_SECRET` → 200 ACK, no processing (Meta retry contract; no mutation). Unknown/unverified/opted-out phones fail identity. Ambiguous event asks. Destructive actions use ConfirmationGate.

**Voice:** JWT → transcribe → injection boundary → same pipeline. GET liveness returns `{ status: 'ok' }` with no secrets. MIME allowlist is `audio/*` (P2 tightness).

**Mobile:** JWT → R3 auth + `classifyRisk` → tactile confirmation policy (documented) → EWS. Destructive/high-risk require `requestId`. No `MobileConfirmationGate`.

---

## 8. Progress / CPM / Readiness (Areas 16–18)

- **Progress:** `ProgressCalculationService` / `ProgressAggregationService` (M8.13). M16 `getProgress` delegates. Presentation strings in read tools are not a second engine.
- **CPM:** no `calculateCPM` / float / early-late persistence in M16. Schedule queries use FieldExecution / Control Tower reads, not an M16 CPM writer.
- **Readiness:** `ExecutionReadinessService` (constraints, predecessors, permits). Three dimensions — M12 scope, not an M16 duplicate engine. Not expanded in R6.

---

## 9. Audit / EventBus / errors / rate limit (Areas 19–22)

EWS emits EventBus **after** successful `$transaction`. Failed transactions do not emit. REPORT_DELAY emits after successful constraint create (no activity row change).

`logAndReturn` swallows `m16_interaction_logs` failures so domain execution is not blocked (P2 audit completeness).

Rate limiter: named tiers plus `{ maxRequests, windowMs }` (R6 fix). Voice/Mobile previously passed custom options into a string-tier API and **always 429**. In-memory limiter matches single-instance deploy.

---

## 10. Schema / tests / legacy (Areas 23–24, 32)

New migration `prisma/migrations/20260908_m16_r6_interaction_logs/`: `m16_interaction_logs` with TEXT `conversation_id`; WhatsApp `event_id` columns.

`prisma migrate status` against localhost: four migrations pending (including R6). Not applied this pass.

Legacy: `processInboundMessage` defined, not called from live routes. `test-exec.ts` is a script. `MessageProcessor` is not on the live webhook.

---

## 11. R6 remediations (only P0/P1)

1. Register R2/R3 tools from Node `register()` (`src/instrumentation.ts`) so production conversational M16 is not an empty registry.
2. Root `instrumentation.ts` re-export so `next build` (webpack scans files next to `./app`) actually loads the hook.
3. `conversation_id` is TEXT; deployable migration for logs + WhatsApp `event_id`.
4. `checkRateLimit` accepts Voice/Mobile custom options (was always 429).

Idempotent tool registration for hot reload. `registerTool` duplicate-throw behavior unchanged.

---

## 12. Browser / API HTTP

Not performed. Starting Next.js writes `.next`. Localhost:3000 was not running. Verdict: **UNVERIFIED**.
