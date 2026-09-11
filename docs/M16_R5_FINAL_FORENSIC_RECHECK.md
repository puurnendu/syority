# M16-R5 — Independent Final Forensic Recheck

**Date:** 8 September 2026  
**Audit type:** Independent source forensic (not a walkthrough of prior GREEN reports)  
**Predecessor claims:** R1–R4 closed; R5 implementation reported GREEN/COMPLETE  
**Prior document on disk:** `docs/M16_R5_FINAL_FORENSIC_RECHECK.md` previously declared GREEN/CLOSED on the same date. This pass **rejects that closure**.  
**Code modified this pass:** none (read-only forensic)

**Git state at audit:**
- Branch: `develop` tracking `origin/develop`
- HEAD: `6e45b54`
- Remote unchanged: `https://github.com/puurnendu/syority.git`
- Substantial uncommitted M8–M16 work preserved; nothing staged or committed

---

## 1. Executive Summary

**M16-R5 is a governed channel *design*, but it is not a closed production gate.**

| Question | Answer |
|---|---|
| Has Mobile created a second execution mutation engine? | **No.** Mobile writes only through `ExecutionWriteService.applyAction()`. |
| Has Voice created a second execution mutation engine? | **No** (adapter). Live `/api/voice/process` wiring currently **cannot complete governed writes**. |
| Is R5 a governed channel extension of R3? | **Partially, in source adapters.** |
| Is the live WhatsApp execution path the R3/R4 pipeline? | **No. Live Meta webhook still uses legacy `MessageProcessor`.** |
| Can R5 be declared GREEN/CLOSED? | **No.** |

**Architectural verdict on the R5 question:**

- **Mobile** = direct governed **operator channel** into EWS (web-button parity): JWT identity → R3 `checkAuthorization` → activity org/event check → EWS. **Not** a second M12 state machine. **Does not** invoke `ConfirmationGate` or `classifyRisk()` at runtime.
- **Voice** = intended conversational channel into the **same** `processInteraction()` pipeline. Speech cannot set `userId` / `organizationId` / role. Live route dependencies are **miswired** (stub entity resolver, wrong `llmCaller` arity, no-op audit).
- **The second execution authority still present in the live tree is legacy WhatsApp `MessageProcessor.applyProgressUpdate`**, which calls EWS without M16 authorization or ConfirmationGate. Next.js serves `./app` and **ignores** `./src/app`, so the R4 webhook at `src/app/api/whatsapp/webhook` is **not the live endpoint**.

**R5 VERDICT: RED**

R6 was **not started**.

---

## 2. Files inspected

### Live HTTP (Next.js `findDir` prioritizes `./app` over `./src/app`)

- `app/api/mobile/execute/route.ts`
- `app/api/voice/process/route.ts`
- `app/api/webhooks/whatsapp/route.ts` (**live Meta webhook**)
- `app/api/whatsapp/updates/[updateId]/approve/route.ts`
- `app/api/execution/action/route.ts`
- `app/api/execution/activity-action/route.ts`
- `app/api/test-phase2c/route.ts`
- `app/(dashboard)/execution/mobile/page.tsx`
- `src/middleware.ts` (`matcher` excludes `api`)

### Dead / duplicate tree (not served)

- `src/app/api/mobile/execute/route.ts`
- `src/app/api/voice/process/route.ts`
- `src/app/api/whatsapp/webhook/route.ts` (R4 governed adapter — **not live**)

### M16 / M12 core

- `src/core/m16/channels/MobileChannelAdapter.ts`
- `src/core/m16/channels/VoiceChannelAdapter.ts`
- `src/core/m16/channels/WhatsAppChannelAdapter.ts`
- `src/core/m16/tools/writeTools.ts`
- `src/core/m16/pipeline/M16InteractionPipeline.ts`
- `src/core/m16/pipeline/ConfirmationGate.ts`
- `src/core/m16/auth/M16AuthorizationBoundary.ts`
- `src/core/m16/risk.ts`
- `src/core/m16/context/EventContextResolver.ts`
- `src/core/m16/security/PromptInjectionBoundary.ts` (exported; **not called from pipeline/channels**)
- `src/core/m16/intent/IntentClassifier.ts`
- `src/core/execution/ExecutionWriteService.ts`
- `src/core/execution/ExecutionReadinessService.ts`
- `src/services/whatsapp/MessageProcessor.ts`
- `src/services/ai/TranscriptionService.ts`
- `src/services/ai/ProviderLoader.ts` (`callTextAi`)
- `node_modules/next/dist/lib/find-pages-dir.js` (app dir precedence)

### Prior reports compared (not treated as evidence)

- `docs/M16_R5_FINAL_FORENSIC_RECHECK.md` (previous GREEN/CLOSED — superseded)
- `docs/M16_R5_IMPLEMENTATION_REPORT.md`, `M16_R5_ARCHITECTURE.md`, `M16_R5_CHANNEL_PARITY.md`, `M16_R5_SECURITY_ACCEPTANCE.md`, `M16_R5_AUTHORITY_MATRIX.md`

---

## 3. Mobile execution authority

**Classification: A — governed operator channel, not a second execution authority.**

Trace (live):

```
Mobile UI (app/(dashboard)/execution/mobile)
  → POST /api/mobile/execute
  → getToken() JWT (userId, organization_id)
  → rate limit
  → processMobileExecution(body, session)
       → ACTION_TO_INTENT map
       → resolveWebIdentity(session)     // not body
       → buildInteractionContext(channel: 'mobile')
       → organizationMembership.role     // fail-closed if lookup throws
       → checkAuthorization()            // R3
       → prisma.activity.findFirst({ id, organization_id, event_id, deleted_at })
       → terminal-status guard
       → ExecutionWriteService.applyAction(..., { source_channel: 'mobile' })
            → state machine + readiness (START/RELEASE)
            → $transaction: activity.update + ProgressLog + AuditLog
            → FieldExecutionService.syncWorkpackProgress (M8.13 cache)
            → EventBus
```

### Preserved

| Invariant | Status |
|---|---|
| Fail-closed authorization | Yes — missing role → deny via `checkAuthorization` |
| Trusted user / org | Yes — JWT `token.sub` / `token.organization_id`; body cannot set them |
| Trusted event (relative to activity) | Yes — activity must match `session.organizationId` **and** `request.eventId` |
| Valid activity | Yes — `findFirst` or deny |
| EWS only for mutation | Yes — no `prisma.activity.update` in adapter |
| M12 state machine | Yes — inside EWS |
| AuditLog / ProgressLog / EventBus | Yes — inside/after EWS `$transaction` |
| M8.13 sync | Yes — `syncWorkpackProgress` post-commit |
| Progress / CPM / EVM calc in adapter | No such code |

### Not preserved (vs full R3 conversational contract)

| Invariant | Status |
|---|---|
| `classifyRisk()` | Imported; **never called** |
| `ConfirmationGate` | **Never invoked.** `confirmation_required` is a result type that is never returned |
| Re-auth at confirmation | N/A (no server confirmation) |
| Channel/conversation binding | Conversation id is `requestId` or `mobile-${Date.now()}` — not a confirm store |
| Idempotency | In-process `Map`, 5 min TTL, optional `requestId` — not durable, not multi-instance |
| AI-mediated mobile mode | Documented in header; **not implemented** |

`eventId` **is** taken from the client body, then bound by the activity lookup. A client cannot execute an activity in another org. A client **can** name another event in the **same** org; if the activity UUID does not belong to that event, the lookup fails (deny). That is acceptable tenant isolation; it is not a second authority.

### Actions Mobile can execute (all nine)

START, UPDATE_PROGRESS, COMPLETE, HOLD, RESUME, RELEASE, REPORT_DELAY, VERIFY, CLOSE — all mapped in `ACTION_TO_INTENT` and allowed by the route `validActions` list. Destructive actions go to EWS after RBAC **without** ConfirmationGate.

Calling EWS is proven. Calling ConfirmationGate is **not**. That is web-button parity, not a second M12 engine.

---

## 4. Voice execution trace

**Intended path (adapter):**

```
audio → JWT session → TranscriptionService
  → resolveWebIdentity(session)     // not transcript
  → resolveEventContext(org, 'voice', request.eventId)
  → role from membership
  → processInteraction()            // R3 pipeline
       → ConfirmationGate
       → writeTools → EWS.applyAction({ source_channel: 'ai' })
```

Speech **cannot** establish `userId`, `organizationId`, `role`, or `permission`. `eventId` from the form is passed into `resolveEventContext`, which **re-validates** `organization_id`. Saying “I am admin” / “use TA-2028” cannot mint JWT identity. Entity resolution (when wired) would still be org/event scoped.

`allowedViaVoice: true` for all nine execution intents; governance `CHANGE_*` remains `false`. That flag only gates **channel allowlist** inside `checkAuthorization`. It does not skip risk, confirmation, or EWS **in the pipeline**.

### Live route defects (`app/api/voice/process/route.ts`)

```ts
llmCaller: (prompt: string) =>
  callTextAi(prompt, { organizationId, userId, jobType: 'voice_interaction' }),
resolveEntities: async () => ({ equipment: null, workpack: null, activity: null }),
logInteraction: async () => {},
```

| Defect | Effect |
|---|---|
| `llmCaller` is 1-arg; pipeline/IntentClassifier call `(systemPrompt, userPrompt)` | Classification will throw/fail closed to UNKNOWN |
| `callTextAi` actual signature is `(config, prompt, ...)` | Even if arity matched, config is wrong |
| `resolveEntities` always null | Write tools return NOT_FOUND (no `activityId`) |
| `logInteraction` no-op | Prior report’s “every Voice action logs `m16_interaction_logs`” is **false** for the live route |
| `PromptInjectionBoundary` not invoked | Transcript is raw user text into the pipeline |
| Fallback `conversationId = voice-${Date.now()}` | Breaks ConfirmationGate continuity unless client sends stable `requestId` |

Voice is **not** a second execution authority. It is also **not** a proven governed write channel on the live API.

---

## 5. R3 security preservation

R3 **modules** still exist and are used by the conversational pipeline:

| # | Contract | Module | Web AI | Web buttons | WhatsApp live | WhatsApp R4 (dead tree) | Voice intended | Voice live | Mobile |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Fail-closed auth | `M16AuthorizationBoundary` | No prod M16 web AI write route | `guardApi` (different) | **No** | Yes | Yes | Broken before gate | Yes |
| 2 | Permission map | `INTENT_PERMISSION_MAP` | — | Different permission names | **No** | Yes | Yes | — | Yes |
| 3 | Invalid/missing role deny | same | — | — | **No** | Yes | Yes | — | Yes |
| 4 | ConfirmationGate | `ConfirmationGate.ts` | — | No | **No** | Yes (broken conv id) | Yes | Unreachable writes | **No** |
| 5 | Re-auth at confirm | pipeline 176–193 | — | No | **No** | Yes | Yes | — | N/A |
| 6–9 | user/org/event/channel bind | `validateSecurityBindings` | — | JWT+guardApi | Phone→user | Yes except conv id | Session | Session | JWT+activity event |
| 10 | conversation bind | keyed by conversationId | — | N/A | N/A | **Broken (`Date.now()`)** | Weak | Weak | Weak |
| 11 | activity bind | stored, **not compared** in `validateSecurityBindings` | — | — | — | Gap | Gap | Gap | Pre-checked |
| 12–14 | expiry / single-use / replay | in-memory Map, 2 min | — | N/A | N/A | Process-local | Process-local | — | Different Map |
| 15 | cancel on new intent | ConfirmationGate | — | N/A | N/A | Yes | Yes | — | N/A |

**R3 was not rewritten for R5.** It was **bypassed on the live WhatsApp webhook** and **not applied to Mobile destructive confirms**.

`validateSecurityBindings` does not compare `activityId`. Tests that only assert the field is **stored** do not prove substitution rejection.

---

## 6. M12 authority

EWS remains the mutation boundary for execution **state**:

- Load activity by `{ id, organization_id }` (event is **not** in EWS where-clause; Mobile adds event before call).
- Workpack must be `issued` | `in_execution`.
- State machine for START / HOLD / RESUME / RELEASE / COMPLETE / VERIFY / CLOSE / UPDATE_PROGRESS / REPORT_DELAY.
- START/RELEASE re-check `ExecutionReadinessService`.
- `$transaction` then EventBus then `syncWorkpackProgress`.

EWS itself performs **no** RBAC, risk, or confirmation. Channels must apply those **before** calling. Legacy WhatsApp does not.

No optimistic `status` predicate on `update`. Two concurrent COMPLETEs can both pass the in-memory status check and both write ProgressLogs. State ends completed, but duplicate logs are possible. Mobile “concurrency” tests are sequential mocks, not `Promise.all` races.

---

## 7. Readiness authority

Mobile/Voice **do not** implement a readiness engine.

- Mobile GET readiness → `ExecutionReadinessService.evaluateReadiness(orgId, activityId)` (read-only).
- EWS START/RELEASE call the same service.
- That service currently checks: **critical constraints, predecessors, permits**.
- It does **not** separately compute equipment, isolation, material, manpower, tools, documents, QA, safety, or hold-points as distinct formulas (hold-points are enforced in EWS COMPLETE, not in this readiness list).

No duplicate R5 readiness calculator. Full 11-dimension readiness is **not** proven inside this service; that is an M12 completeness gap (P2), not an R5 second engine.

---

## 8. Progress / CPM / EVM authority

Source scan of Mobile and Voice adapters: no `calculateProgress`, SPI, CPM, float, EVM, or S-curve.

M8.13 remains progress authority (`ProgressCalculationService` / `ProgressAggregationService`). M11 remains schedule. M16 may **read** domain fields via `readTools`.

---

## 9. Tenant + event isolation

| Attack | Mobile | Voice | Live WhatsApp |
|---|---|---|---|
| Body/speech sets userId | No (JWT) | No (JWT) | No (phone → `user.whatsapp_number`) |
| Body/speech sets organizationId | No | No | Taken from matched user row |
| Body sets eventId | Yes, then activity must match org+event | Form eventId validated to org | No M16 event bind; EWS is org+activity only |
| “I am admin” | Ignored | Ignored as identity; LLM cannot set role | Ignored; no R3 role check at all |
| Org A vs Org B | JWT org + activity.organization_id | JWT org + event.organization_id | User’s org only |
| TA-2027 vs TA-2028 same org | Activity.event_id must match | Event resolver scoped to org | **Not enforced at EWS** |

Cross-tenant execution via Mobile/Voice request fields is not established. Cross-event execution on **legacy WhatsApp** is weaker (org-only at EWS).

---

## 10. Voice security

| Control | Live status |
|---|---|
| Authentication | JWT required on POST |
| Unauthenticated GET | Health `{ status: 'ok' }` — no secrets |
| MIME | `audio/*` prefix only |
| Size | 10MB default |
| Timeout / retry | TranscriptionService 20s, 3 retries |
| Duration | Enforced **after** Whisper (120s) |
| API key | `WHATSAPP_OPENAI_API_KEY` server-side; empty → reject |
| Key logging | Route logs `err.message` only |
| Prompt injection | Boundary **not wired**; transcript treated as user text |
| Malicious audio | Size/MIME/empty/low-confidence handled; no antivirus story |
| Rate limit | 30/min per user |

---

## 11. Mobile concurrency / idempotency

| Scenario | Control | Proven? |
|---|---|---|
| Double tap with same `requestId` | In-memory Map | Only in-process; lost on restart / second instance |
| Duplicate HTTP without `requestId` | None at adapter | Relies on EWS state machine |
| Two operators same activity | EWS load-then-update | No row lock / version column |
| COMPLETE/VERIFY/CLOSE race | State machine after read | Duplicate ProgressLog possible |
| Tests | `m16-r5-mobile.test.ts` sequential mock | **Does not exercise true concurrency** |

---

## 12. Channel parity

Legend: Y = supported through intended governance; L = live path differs; — = not this channel’s job.

| Action | WEB buttons | WHATSAPP live | WHATSAPP R4 dead | VOICE live | MOBILE live |
|---|---|---|---|---|---|
| READ | UI/APIs | Legacy query helper | Pipeline read tools | Stub entities | GET readiness only |
| START | EWS + `guardApi` | No (progress auto-path) | Pipeline + confirm | Wiring broken | Auth + EWS, no ConfirmGate |
| UPDATE_PROGRESS | EWS + guard | **Auto EWS if confidence ≥ 0.9** | Pipeline IMPLICIT | Wiring broken | Auth + EWS |
| COMPLETE | EWS + guard | **Auto COMPLETE if progress ≥ 100** | Pipeline EXPLICIT | Wiring broken | Auth + EWS, no ConfirmGate |
| HOLD | EWS + guard | No | Pipeline EXPLICIT | Wiring broken | Auth + EWS |
| RESUME | EWS + guard | No | Pipeline EXPLICIT | Wiring broken | Auth + EWS |
| RELEASE | EWS + guard | No | Pipeline EXPLICIT | Wiring broken | Auth + EWS |
| REPORT_DELAY | EWS + guard | No | Pipeline IMPLICIT | Wiring broken | Auth + EWS |
| VERIFY | EWS + guard | No | Pipeline EXPLICIT | Wiring broken | Auth + EWS |
| CLOSE | EWS + guard | No | Pipeline EXPLICIT | Wiring broken | Auth + EWS |

**Intentional differences (acceptable if documented, not currently production-true):**

- Mobile/Web buttons = tactile confirmation, server ConfirmationGate optional.
- Voice/WhatsApp AI = ConfirmationGate required for HIGH_RISK/DESTRUCTIVE.

**Unintentional / blocking:**

- Live WhatsApp ≠ R4 pipeline.
- Live Voice ≠ working pipeline writes.

Authorization/risk/confirmation/audit/EventBus for Mobile writes that **do** reach EWS: RBAC yes; risk/confirm no; audit/EventBus yes via EWS. Tenant/event: org JWT + activity event match.

---

## 13. AI → Prisma audit

**M16 adapters and `writeTools`:** no `prisma.activity.*` / `workpack.*` / `progressLog.create` mutations (read `findFirst`/`findMany` only).

**Direct domain writes still in repo (not M16 adapters):**

| Path | Class |
|---|---|
| `ExecutionWriteService` `tx.activity.update` + `progressLog.create` | Authorized M12 |
| `MessageProcessor` → EWS | Mutation via EWS **without** R3 |
| `app/api/test-phase2c` `prisma.activity.create/update`, `workpack.create/update` | **Unauthenticated HTTP** |
| `ActivityService`, schedule/planner services, hold-point/activity APIs | Existing non-M16 CRUD / planning / schedule |

**P0 is not “AI prisma.activity.update in MobileChannelAdapter”.** P0 is **channel execution without R3** and **open test route**.

---

## 14. EWS caller audit

| File | Function | Channel | Authorization | Confirmation | Actions |
|---|---|---|---|---|---|
| `writeTools.ts` | `executeViaEWS` | ai (Voice/WA R4/Web AI) | Pipeline `checkAuthorization` | ConfirmationGate | All nine |
| `MobileChannelAdapter.ts` | `processMobileExecution` | mobile | R3 `checkAuthorization` | **None** | All nine |
| `MessageProcessor.ts` | `applyProgressUpdate` | whatsapp **live** | Phone user only | **None** | UPDATE_PROGRESS / COMPLETE |
| `app/api/execution/action/route.ts` | POST | web | `guardApi` | None | Body action |
| `app/api/execution/activity-action/route.ts` | POST | web | Per-action `guardApi` | None | Mapped actions |
| `app/api/whatsapp/updates/.../approve/route.ts` | POST | planner web | `workpacks.edit` | None | Approve parked update |
| `app/api/test-phase2c/route.ts` | GET | test **HTTP** | **None** | None | START + direct prisma |
| `test-exec.ts` | CLI | harness | N/A | N/A | Dev only |

Voice has **no** direct `applyAction` import.

---

## 15. Audit / EventBus

When EWS succeeds: AuditLog + ProgressLog in transaction; EventBus after commit; workpack sync best-effort.

When Voice live route runs: **no** `logInteraction`. Prior GREEN claim that every Voice action writes `m16_interaction_logs` is **not true** of current `app/api/voice/process`.

Mobile: no M16 interaction log; EWS audit only.

---

## 16. Test results

Command:

```
npx vitest run src/core/m16/__tests__ src/core/execution/__tests__ tests/progress-calculation.test.ts --reporter=verbose
```

| Result | Count |
|---|---|
| Test files | 17 passed, **1 failed** (18) |
| Tests | **471 passed, 1 failed** (472) |

**Failed:** `m12-r01-p0-remediation.test.ts` → `Classify all prisma.activity.update callers` → `ReferenceError: fail is not defined`.

Cause: Vitest has no Jasmine `fail()`. The assertion fires because comment strings in `writeTools.ts` / `readTools.ts` / EWS match `/prisma\.activity\.update\b/`. This is **test-integrity debt**, not proof of a new M16 prisma writer.

**M16 R1–R5 files in this run all passed**, including `m16-r5-voice`, `m16-r5-mobile`, `m16-r5-parity`, `m16-r3-security-closure`, `m16-r3-execution`.

**Why tests passing do not close R5:**

- Parity tests only forbid *named* `MobileConfirmationGate` classes; they do not require Mobile to call `ConfirmationGate`.
- No test asserts live `app/api/webhooks/whatsapp` uses `WhatsAppChannelAdapter`.
- No test asserts `app/api/voice/process` `llmCaller` arity or non-stub `resolveEntities`.
- Mobile concurrency tests do not race.
- Full repository suite was **not** re-run in this pass beyond M16 + M12 + progress-calculation (timeboxed; R5 already RED).

R5 tests were **not weakened** in this pass (no test file edits).

---

## 17. Browser / API results

No Next.js server was running in the session terminal.

**BROWSER ACCEPTANCE UNVERIFIED.**

Source-only notes (not a browser GREEN):

- POST `/api/mobile/execute` and `/api/voice/process` require JWT (`401` if missing token).
- GET `/api/voice/process` is unauthenticated health.
- GET `/api/test-phase2c` has **no auth** and mutates the database if reached.
- Destructive Mobile actions are RBAC-gated, not ConfirmationGate-gated.

Do not claim browser GREEN from inspection.

---

## 18. P0–P3 findings

### P0 (block GREEN and block R6)

1. **Live WhatsApp webhook is still the legacy second execution path.** `app/api/webhooks/whatsapp` → `processInboundMessage` → `applyProgressUpdate` → EWS `UPDATE_PROGRESS`/`COMPLETE` with **no** `checkAuthorization`, **no** ConfirmationGate, **no** event bind. R4 adapter lives only at `src/app/api/whatsapp/webhook`, which Next.js does not serve (`findDir` prefers `./app`).
2. **Unauthenticated `GET /api/test-phase2c`** creates workpacks/activities, updates them, and calls EWS. Middleware matcher excludes `/api`.

### P1

3. **Voice live dependencies cannot perform governed execution** (wrong `llmCaller` / `callTextAi`, stub entities, no-op audit).
4. **Mobile skips ConfirmationGate** for COMPLETE/VERIFY/CLOSE while comments claim `classifyRisk()` (unused import).
5. **`PromptInjectionBoundary` is not used** on Voice or `M16InteractionPipeline`.
6. **`validateSecurityBindings` omits `activityId`.**
7. **Mobile idempotency is process-local**; EWS has no optimistic concurrency.
8. **Duplicate `app/` vs `src/app` API copies** — drift and false confidence that R4 is live.

### P2

9. Voice/WhatsApp R4 `conversationId` includes `Date.now()` — ConfirmationGate cannot survive YES/NO turns even if R4 were wired.
10. Readiness service covers only constraints / predecessors / permits.
11. M12 writer-classification test uses `fail()` (broken) and comment false-positives.
12. GET `/api/voice/process` unauthenticated health.
13. Mobile `newStatus: result?.newStatus` does not match EWS return shape.
14. Prior GREEN forensic overstated Voice audit coverage and EWS caller whitelist.

### P3

15. `test-exec.ts` local harness (not an HTTP route).
16. Confirmation stores are in-memory (multi-instance loss) even on the pipeline path.

---

## 19. Required remediation

See `docs/M16_R5_REMEDIATION_PLAN.md`.

Minimum to re-enter the R5 gate:

1. Point the **live** Meta webhook at the R4 adapter **or** disable `MessageProcessor` auto-apply (fail closed to park/review) and add R3 auth+confirm before any EWS call.
2. Remove or auth-gate `/api/test-phase2c`.
3. Fix Voice `PipelineDependencies` (real entity resolver, correct `llmCaller`, real `logInteraction`, `PromptInjectionBoundary`).
4. Decide and implement Mobile confirmation policy (server ConfirmationGate **or** an explicit documented web-parity exception with client attest + audit).
5. Stable conversation ids; bind `activityId` at confirm time.
6. Durable idempotency / concurrency for Mobile COMPLETE races.
7. Independent re-audit; do not reuse this RED as GREEN.

---

## 20. Final verdict

**R5 VERDICT: RED**

Not GREEN/CLOSED. Not GREEN WITH P2 FOLLOW-UP. Not AMBER (P0 exploit paths exist on live routes).

Discrepancy vs previous same-day GREEN/CLOSED document:

| Previous claim | Current source |
|---|---|
| Voice/WhatsApp reach EWS only via `writeTools` | Live WA uses `MessageProcessor` |
| Every Voice action writes interaction audit | Live `logInteraction` is `async () => {}` |
| Mobile `classifyRisk()` in the flow | Import only |
| R4 webhook is the WhatsApp path | Served path is `/api/webhooks/whatsapp` |
| Browser/API GREEN after copying routes to `app/` | This pass: **BROWSER ACCEPTANCE UNVERIFIED**; Voice still miswired |

**R6 EXECUTED: NO**

---

## Gate checklist (this pass)

| Stop condition | Tripped? |
|---|---|
| P0 > 0 | **Yes** |
| P1 > 0 | **Yes** |
| Mobile is a second execution authority | No (EWS-only) |
| R3 security contract bypassed | **Yes — live WhatsApp** |
| Tenant isolation uncertain | Mobile/Voice org isolation OK; WA event isolation weak |
| Event isolation uncertain | **Yes on live WA** |
| M12 execution authority bypassed | No (EWS still mutates); **governance around EWS bypassed** |
| M8.13 bypassed | No |
| Tests reveal real regression | 1 harness failure; M16 unit tests green but **insufficient** |
