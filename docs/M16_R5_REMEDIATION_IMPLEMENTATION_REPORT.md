# M16-R5 Remediation Implementation Report

**Date:** 8 September 2026  
**Pass type:** REMEDIATION ONLY — not a forensic closure  
**R6:** Not started. Forbidden until a **new independent** R5 forensic audit.

This report does **not** declare GREEN, GREEN/CLOSED, or GREEN WITH P2 FOLLOW-UP.

---

## 1. Original RED findings

Independent forensic (`docs/M16_R5_FINAL_FORENSIC_RECHECK.md`) classified M16-R5 as **RED**.

| Severity | Count | Summary |
|---|---|---|
| P0 | 2 | Live Meta webhook used `MessageProcessor` → auto-EWS. Unauthenticated `GET /api/test-phase2c` mutated DB/EWS. |
| P1 | 6 | Live Voice stub deps; Mobile skipped `classifyRisk`/confirmation policy; PromptInjectionBoundary unused on live Voice; ConfirmationGate omitted `activityId` compare; in-memory idempotency / no EWS optimistic COMPLETE; `app/` vs `src/app` duplicate APIs. |
| P2 | 6 | `Date.now()` conversation ids; broken `fail()` writer test; Voice GET health; Mobile `newStatus` mismatch; in-memory confirmation; overstated prior GREEN. |
| P3 | 2 | `test-exec.ts` harness; in-memory confirmation multi-instance. |

**Live-route fact (Next.js 16.1.6):** `node_modules/next/dist/lib/find-pages-dir.js` `findDir` prefers `./app` over `./src/app`. Production APIs are `app/api/**`.

Git at start of this pass (preserved): branch `develop`, HEAD `6e45b54`, origin `https://github.com/puurnendu/syority.git`. Working tree not reset, rebased, cleaned, or committed.

---

## 2. P0-1 remediation — live WhatsApp

**Live file:** `app/api/webhooks/whatsapp/route.ts`

POST now:

1. Requires `WHATSAPP_APP_SECRET`
2. Verifies `X-Hub-Signature-256` (missing/invalid → **401**)
3. ACKs Meta with 200
4. Delegates to `processWhatsAppWebhook` (WhatsAppChannelAdapter)

It does **not** call `processInboundMessage`.

Adapter path:

Meta request → HMAC → rate limit → webhook idempotency → WhatsApp identity → organization → event (ASK if AMBIGUOUS, deny if NONE) → stable `conversationId = wa-${phone}` → PromptInjectionBoundary (blocking patterns) → `M16InteractionPipeline` → entity resolution → authorization → risk → ConfirmationGate → `writeTools` → EWS → audit/reply.

`MessageProcessor.applyProgressUpdate` is a fail-closed stub: it never calls EWS. Session handlers may still invoke it; they receive `{ success: false }` and park. Live webhook does not use that processor.

`validateToolExecution` no longer blanket-rejects write tools (obsolete R2 guard). Writes are governed by R3 authorization + ConfirmationGate + EWS. Without this, COMPLETE could never create a pending confirmation.

---

## 3. P0-2 remediation — test-phase2c

**Removed:** `app/api/test-phase2c/route.ts`  
**Absent:** `src/app/api/test-phase2c/route.ts`

Unauthenticated and production requests to `GET /api/test-phase2c` have no handler → **404**. No Prisma mutation can occur through this route.

---

## 4. P1-1 remediation — live Voice

**Live file:** `app/api/voice/process/route.ts`

- JWT required (`getToken`); missing session → **401**
- `createGovernedPipelineDependencies`:
  - `llmCaller(systemPrompt, userPrompt)` matching the pipeline
  - `loadProviderForJob` + `callTextAi(config, combined, …)`
  - `resolveEntities` → `resolveEntityChain` (org/event scoped)
  - `logInteraction` → `M16InteractionAuditService.logInteraction`
- Adapter: transcribe → `detectInjectionPatterns` (block ROLE_ESCALATION / AUTH_BYPASS / TENANT_* / CONTEXT_OVERRIDE) → pipeline
- Stable `conversationId = voice-${userId}-${eventId}`

---

## 5. P1-2 policy decision — Mobile

**Policy B (web-button / tactile parity) selected.**

- Web/Mobile deterministic operator controls = **tactile confirmation**
- Conversational AI (WhatsApp / Voice) = shared **ConfirmationGate**
- No `MobileConfirmationGate`

Server still: JWT → trusted user/org → activity lookup (`organization_id` + `event_id`) → `checkAuthorization()` → `classifyRisk()` on every action → `requestId` required for EXPLICIT / DESTRUCTIVE / HIGH_RISK_WRITE → EWS.

Documented in `docs/M16_R5_CHANNEL_PARITY.md`.

`newStatus` mapped from `result.activity?.status`.

---

## 6. P1-3 — activityId confirmation binding

`validateSecurityBindings(pending, ctx, currentActivityId?)` now:

- Rejects if `pending.toolParams.activityId` was tampered vs `securityBinding.activityId`
- Rejects if `currentActivityId` is supplied and differs from the bound activity

`createPendingConfirmation` shallow-copies `toolParams`.

Pipeline confirm path passes `pending.toolParams?.activityId` as the current bound id.

Adversarial tests: confirm Activity A, substitute Activity B → rejected; B does not execute. Event substitution likewise rejected.

---

## 7. P1-4 — concurrency / idempotency

**Mobile:** Destructive/high-risk actions require `requestId`. Duplicate `requestId` replays the in-memory result (single-node; documented P2).

**EWS:** Activity write uses `updateMany` where `{ id, organization_id, status: expectedStatus, deleted_at: null }`. `count !== 1` → `Execution conflict: activity was modified concurrently`.

COMPLETE on already `completed` / `verified` / `closed` is a state-machine rejection.

`Promise.all` two COMPLETE against a shared in-memory store with a stale-read barrier: one fulfilled, one conflict.

No second execution engine. Execution remains inside EWS.

---

## 8. P1-5 — route consolidation

Removed dead M16 duplicates (Next.js did not serve them):

- `src/app/api/mobile/execute/route.ts`
- `src/app/api/voice/process/route.ts`
- `src/app/api/whatsapp/webhook/route.ts`

**Preserved:** `src/app/api/reports/{artifacts,generate,definitions}/route.ts` — only copy of those handlers; **not served** while `./app` exists. Not deleted.

Authoritative M16 HTTP APIs live under `app/api/**`.

---

## 9. P2 remediation (only where safe)

| Item | Action |
|---|---|
| Stable conversationId | Done for WhatsApp (`wa-${phone}`) and Voice (`voice-${userId}-${eventId}`) |
| Broken `fail()` writer test | Replaced with `expect(offenders).toEqual([])`; comments stripped in writer classifier |
| Mobile `newStatus` | Mapped from EWS `activity.status` |
| Voice GET health | **Not changed** (liveness only) |
| MIME allowlist | **Not changed** (`audio/` prefix remains) |
| Readiness 11-dimension | **Not changed** (still constraints/predecessors/permits) |
| In-memory confirmation | **Not changed** (single-node limitation documented) |

---

## 10. Live route map

Next.js 16.1.6 `findDir`: if `./app` exists, `./src/app` is ignored.

| Endpoint | Served file | Implementation |
|---|---|---|
| `POST /api/webhooks/whatsapp` | `app/api/webhooks/whatsapp/route.ts` | HMAC + `WhatsAppChannelAdapter.processWhatsAppWebhook` |
| `GET /api/webhooks/whatsapp` | same | Meta verify token |
| `POST /api/voice/process` | `app/api/voice/process/route.ts` | JWT + `processVoiceInteraction` + governed deps |
| `GET /api/voice/process` | same | Unauthenticated `{ status: 'ok' }` liveness |
| `POST /api/mobile/execute` | `app/api/mobile/execute/route.ts` | JWT + `processMobileExecution` |
| `GET /api/test-phase2c` | **none** | 404 |

No insecure duplicate of the WhatsApp/Voice/Mobile routes remains under a served tree.

---

## 11. EWS caller map

Production callers of `ExecutionWriteService.applyAction` / `EWS.applyAction`:

| Caller | Channel | Governance |
|---|---|---|
| `src/core/m16/tools/writeTools.ts` | ai (WhatsApp/Voice/assistant pipeline) | Auth + ConfirmationGate + writeTools |
| `src/core/m16/channels/MobileChannelAdapter.ts` | mobile | JWT + RBAC + classifyRisk + requestId + EWS |
| `app/api/execution/action/route.ts` | web | `guardApi` + tenant guard |
| `app/api/execution/activity-action/route.ts` | web | `guardApi` |
| `app/api/execution/bulk-action/route.ts` | web | `guardApi('execution.bulk')` → `bulkApplyAction` |
| `app/api/whatsapp/updates/[updateId]/approve/route.ts` | web planner | `guardApi('workpacks.edit')` then UPDATE_PROGRESS |

**Not live conversational auto-exec:** `MessageProcessor.applyProgressUpdate` (stub).  
**Not HTTP:** `test-exec.ts` local harness (P3).

M16 adapters do not call `prisma.activity.update`. Conversational WhatsApp/Voice do not call EWS except via pipeline `writeTools`.

Other `prisma.activity.update` sites (planning codes, hold-points, admin backfill, schedule) are non-M16 CRUD/planning writers — classified by the existing M12 writer allowlist; not used as a second conversational execution path.

---

## 12. Security controls

- Identity: JWT / verified WhatsApp phone / session — never LLM or transcript
- Event: `EventContextResolver`; AMBIGUOUS → ask; NONE → deny; no silent pick
- Authorization: `M16AuthorizationBoundary.checkAuthorization` fail-closed
- Risk: shared `classifyRisk()`
- Confirmation: shared ConfirmationGate on conversational channels; tactile on Mobile/Web buttons
- HMAC on live Meta webhook
- Prompt injection blocking on WhatsApp and Voice adapters
- Confirmation `activityId` + event/user/org/channel/conversation binding
- EWS expected-status `updateMany` for concurrent COMPLETE

---

## 13. Tests

New/updated:

- `src/core/m16/__tests__/m16-r5-live-route-remediation.test.ts` (live tree + COMPLETE binding)
- `src/core/execution/__tests__/m12-r5-complete-concurrency.test.ts` (`Promise.all` COMPLETE)
- Confirmation activity substitution in `m16-r3-security-closure.test.ts`
- Mobile requestId / classifyRisk / invalid event / Promise.all COMPLETE
- Voice stable conversationId / ROLE_ESCALATION block / PromptInjectionBoundary
- WhatsApp stable `wa-${phone}`
- M12 writer `fail()` removal; `applyProgressUpdate` comment-stripped EWS check
- R2 `validateToolExecution` updated to R3 (event-scoped writes allowed)

Mapped to the required list (1–24): covered by live-route tests + adapter tests + EWS concurrency tests. Unauthenticated Voice/Mobile HTTP 401 is source-proven on live routes (`getToken` → 401); full HTTP was not exercised against a running server.

---

## 14. Browser/API status

No Next.js process was running in the session terminal. Endpoints were not POSTed/GETed over HTTP.

**BROWSER/API ACCEPTANCE UNVERIFIED**

Do not treat source inspection as HTTP GREEN.

---

## 15. Remaining findings

These are **not** a closure verdict. An independent forensic must re-score.

1. ConfirmationGate and Mobile idempotency remain **process-local Maps** (multi-instance replay possible).
2. `GET /api/voice/process` is unauthenticated liveness.
3. Transcription MIME allowlist is still `audio/` prefix.
4. ExecutionReadinessService still covers constraints / predecessors / permits only (not 11-dimension marketing).
5. `src/app/api/reports/**` is not served (Next prefers `./app`).
6. Planner approve route can apply `UPDATE_PROGRESS` (including 100%) via EWS behind `guardApi` — authenticated web, not conversational auto-exec.
7. Pipeline calls `detectInjectionPatterns(text)` but does not block on the return; adapters block before `processInteraction`.
8. Live WhatsApp POST with missing `WHATSAPP_APP_SECRET` still ACKs Meta with 200 and does not process (existing Meta retry behavior).
9. `test-exec.ts` remains a local EWS harness (not an HTTP route).
10. Full vitest: two **pre-existing** M14 report-builder tests timed out waiting for Puppeteer Chrome (not in M16/R3/R5 scope).

---

## 16. Known limitations

- Single-node in-memory confirmation and Mobile idempotency.
- No new Prisma migration for durable request ids (none added this pass).
- Voice job type reuses `whatsapp_extraction` (`JobType` has no `voice_interaction`).
- Mobile `conversationId` fallback `mobile-${Date.now()}` is unused for ConfirmationGate (tactile policy); destructive actions require `requestId`.
- R5 is **not closed**. This file is remediation evidence only.

---

## Test execution (recorded)

```
npx vitest run src/core/m16/__tests__ src/core/execution/__tests__ tests/progress-calculation.test.ts
→ 20 files, 510 passed, 0 failed
```

Includes M16 R1–R5, live-route tests, M12 execution tests, M8.13 progress tests.

```
npx vitest run
→ 55 files, 1270 passed, 2 failed
```

Failures (pre-existing, not M16):

- `src/core/report-builder/__tests__/M14R4RenderingDelivery.test.ts` — timeout 5000ms; Puppeteer Chrome missing
- `src/core/report-builder/__tests__/M14R5ReportDesigner.test.ts` — timeout 5000ms; same Chrome cache miss

Those two tests are **not GREEN**.

---

## Stop condition

R5 forensic closure was **not** performed. R6 was **not** started.

Independent re-audit is required before any R5 close decision.
