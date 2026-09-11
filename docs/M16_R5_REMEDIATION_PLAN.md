# M16-R5 Remediation Plan

**Date:** 8 September 2026  
**Trigger:** Independent R5 forensic recheck = **RED**  
**R6 status:** **Do not start** until this plan is executed and R5 is re-audited GREEN/CLOSED (P0 = 0, P1 = 0).

This is not an implementation pass. It specifies what must be fixed, in order, without weakening R3.

---

## Blocking principle

R5 may not be re-closed because:

- unit tests are green
- adapters comment that they call EWS
- a previous report said GREEN

Re-close only after **live routes** (`app/api/**`, the tree Next.js actually serves) match the R3/R4/R5 design.

---

## P0 — must fix before any re-gate

### P0-1. Live WhatsApp is a second execution authority

**Fact:** Next.js `findDir` prefers `./app` over `./src/app`. Live Meta webhook is:

`app/api/webhooks/whatsapp/route.ts` → `processInboundMessage` → `applyProgressUpdate` → `ExecutionWriteService.applyAction` for `UPDATE_PROGRESS` / `COMPLETE`.

No `checkAuthorization`, no ConfirmationGate, no event bind. Confidence ≥ 0.9 auto-mutates.

The governed adapter is only at `src/app/api/whatsapp/webhook/route.ts` (not served).

**Required fix (pick one, then prove it):**

1. **Preferred:** Make `/api/webhooks/whatsapp` (the URL Meta actually calls) delegate to `processWhatsAppWebhook` / `WhatsAppChannelAdapter`. Keep HMAC, rate limit, 200 ACK. **Delete or hard-disable** `applyProgressUpdate` auto-apply.
2. **Interim fail-closed:** Keep MessageProcessor for parking/review only. **Never** call EWS from `applyProgressUpdate`. Planner approve route may call EWS only behind `guardApi` + R3-equivalent permission for COMPLETE/UPDATE_PROGRESS.

**Acceptance:**

- Grep live `app/api/webhooks/whatsapp` for `processInboundMessage` / `applyProgressUpdate` → no EWS call without `checkAuthorization`.
- HTTP path Meta uses is the R4 adapter **or** park-only processor.
- Tests: webhook source scan + a test that COMPLETE via WhatsApp without `execution.complete` is denied.
- `conversationId` must be stable per phone/session (not `Date.now()`), or ConfirmationGate YES cannot work.

### P0-2. Unauthenticated `/api/test-phase2c`

**Fact:** `GET app/api/test-phase2c` creates/updates activities and workpacks and calls EWS. `src/middleware.ts` matcher excludes `api`.

**Required fix:**

- Delete the route from production trees, **or**
- Guard with platform-admin auth **and** `NODE_ENV !== 'production'` hard deny.

**Acceptance:** Unauthenticated GET returns 401/404; no prisma creates.

---

## P1 — must fix before GREEN/CLOSED

### P1-1. Voice live `PipelineDependencies`

File: `app/api/voice/process/route.ts` (and keep `src/app` copy in sync **or delete the dead copy**).

**Required:**

- `llmCaller: (system, user) => string` matching `IntentClassifier` / `M16InteractionPipeline`.
- `callTextAi` invoked with a real `ProviderConfig`, not `(prompt, metadata)`.
- `resolveEntities` = `resolveEntityChain` (same as R4 WhatsApp webhook), org/event scoped.
- `logInteraction` = `M16InteractionAuditService.logInteraction`.
- Run transcript through `PromptInjectionBoundary` (sanitize / detect) **before** `processInteraction`.
- Stable `conversationId` (session/requestId), not `voice-${Date.now()}` as the confirm key.

**Acceptance:** Authenticated Voice START/COMPLETE with resolved activity hits ConfirmationGate then EWS in a test or recorded API trace. Stub `{ activity: null }` is gone.

### P1-2. Mobile confirmation policy

Today: RBAC + EWS, no ConfirmationGate, unused `classifyRisk` import.

**Choose explicitly (do not leave comments lying):**

- **A (R3-strict):** For HIGH_RISK/DESTRUCTIVE, Mobile must create/consume ConfirmationGate (or a **shared** confirmation API, not `MobileConfirmationGate`). Re-auth at execute.
- **B (web-parity):** Document that tactile UI is the confirmation, matching `app/api/execution/*`. Server still: JWT, `checkAuthorization`, event-scoped activity, EWS. Call `classifyRisk()` at least for audit. Client must not be the only control for COMPLETE without server RBAC (RBAC already exists).

Either is acceptable if **documented in the parity matrix and tests**. Mixing “we have ConfirmationGate on all channels” tests that only check the absence of a class named `MobileConfirmationGate` is not enough.

### P1-3. Confirmation `activityId` binding

`createPendingConfirmation` stores `activityId`. `validateSecurityBindings` does not compare it.

**Required:** Reject confirm if `pending.securityBinding.activityId` ≠ current tool params / bound activity. Add a test that swaps activityId between create and confirm.

### P1-4. Idempotency / COMPLETE races

- Replace Mobile in-memory Map with a durable key (DB unique on `(organization_id, request_id)` or Redis) **or** document single-instance-only and fail if `requestId` missing for destructive actions.
- EWS: update with `where: { id, status: expected }` (or version) so two COMPLETEs cannot both insert ProgressLogs from a stale read.

**Acceptance:** A real concurrent test (`Promise.all` two COMPLETEs) shows one success and one state-machine reject, or one idempotent replay.

### P1-5. Collapse `app/` vs `src/app` API duplicates

Next.js will keep serving `app/`. Either:

- Delete `src/app/api/**`, or
- Never add routes only under `src/app`.

R4 WhatsApp must live under **`app/api/...`**.

---

## P2 — may remain only after P0/P1, with owner

| ID | Item | Owner (fill) | Mitigation until fixed |
|---|---|---|---|
| P2-1 | Readiness service only constraints/predecessors/permits | M12 | START still blocked on those; do not advertise 11-dimension readiness |
| P2-2 | `m12-r01` `fail is not defined` + comment matches | Test | Switch to `expect(writers).toEqual([])`; ignore comments |
| P2-3 | GET `/api/voice/process` public health | M16 | Optional: require auth or move to `/api/health` |
| P2-4 | Mobile `newStatus` field mismatch | M16 | Map `result.activity.status` |
| P2-5 | In-memory ConfirmationGate store | M16 | Single-node only until Redis/DB |
| P2-6 | MIME `audio/*` prefix | Voice | Tighten allowlist |

---

## Explicitly out of scope for this remediation

- Do not rewrite M8–M15 domain engines.
- Do not weaken R3 tests.
- Do not add a Mobile-specific confirmation class.
- Do not “fix” isolation by trusting transcript/body for `userId` / `organizationId` / role.
- Do not start M16-R6 until a **new** independent forensic (not this RED file restated) is GREEN/CLOSED.

---

## Re-gate evidence pack (minimum)

After fixes, the next forensic must include:

1. Proof of which directory Next.js serves (`app` vs `src/app`).
2. The exact webhook file Meta would hit, with the first 30 lines quoted.
3. `git grep applyAction` classified again.
4. Voice POST trace: auth fail, auth ok + stub gone, destructive confirm.
5. Mobile: unauthenticated 401; cross-org activity deny; COMPLETE without permission deny.
6. Concurrent COMPLETE test result.
7. `npx vitest run` M16 + M12 + progress + any new webhook tests, counts recorded.
8. Browser/API: **BROWSER ACCEPTANCE UNVERIFIED** unless actually exercised.

Until then: **R5 remains RED. R6 remains forbidden.**
