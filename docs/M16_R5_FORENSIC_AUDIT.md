# M16-R5 Forensic Audit — Voice & Mobile

**Date:** 2026-09-08
**Pre-condition:** M16-R4 GREEN/COMPLETE
**Scope:** Forensic discovery — no code modified

---

## 1. Existing Voice Components

| Component | File | Status | Finding |
|-----------|------|--------|---------|
| AudioProcessor | `src/services/whatsapp/AudioProcessor.ts` | **REUSABLE** | Downloads audio, transcribes via Whisper (OpenAI). 20s timeout, 3 retries. No domain logic. Currently WhatsApp-specific (downloads from Meta API). R5 needs a generalized variant that accepts audio buffers directly (for web/mobile voice). |
| MetaClient | `src/services/whatsapp/MetaClient.ts` | **WhatsApp-only** | Meta API transport. Not applicable to voice channel. |
| Whisper integration | AudioProcessor lines 42-82 | **REUSABLE** | Whisper API call with retry/timeout. Can be extracted into a standalone `TranscriptionService` that AudioProcessor and VoiceChannelAdapter both use. |
| Voice UI components | — | **NONE EXIST** | No microphone, speech recognition, or voice input components exist in the UI. No `SpeechRecognition` API usage. |
| Voice API routes | — | **NONE EXIST** | No `/api/voice` or `/api/audio` routes exist. |

---

## 2. Existing Mobile Components

| Component | File | Status | Finding |
|-----------|------|--------|---------|
| MobileExecutionView | `src/components/execution/MobileExecutionView.tsx` | **EXISTS — P1 FINDING** | Calls `/api/execution/activity-action` which does NOT exist as an API route. Uses `ActivityExecutionDTO` from `FieldExecutionService`. Displays readiness via `/api/execution/readiness`. **Neither API route exists.** The component is dead code. |
| ExecutionCockpit | `src/components/execution/ExecutionCockpit.tsx` | **EXISTS** | 60KB desktop execution workspace. Not imported by any page. |
| ActivityGrid | `src/components/planner-workspace/ActivityGrid.tsx` | **EXISTS** | Used by LayoutManager. Calls `/api/execution` endpoints. |
| Service Worker | `public/sw.js` | **BASIC** | Minimal caching (offline fallback). GET-only. Does NOT queue offline mutations. |
| PWA manifest | `public/manifest.json` | **EXISTS** | Basic PWA config. |

---

## 3. Existing AI Components

| Component | File | Status |
|-----------|------|--------|
| ProviderLoader | `src/services/ai/ProviderLoader.ts` | **REUSABLE** — `callTextAi()` supports arbitrary jobType |
| AiPromptService | `src/services/ai/AiPromptService.ts` | **REUSABLE** — prompt templates + ai_logs |
| M16 IntentClassifier | `src/core/m16/intent/IntentClassifier.ts` | **REUSABLE** — works with any text input |
| M16 EntityResolver | `src/core/m16/entity/M16EntityResolver.ts` | **REUSABLE** — resolves entities from text hints |

---

## 4. Existing Execution Paths

| Path | Components | Authority | Finding |
|------|-----------|-----------|---------|
| **R3 governed** | M16 pipeline → writeTools → EWS.applyAction() | **AUTHORITATIVE** | Single governed mutation path. R5 MUST use this. |
| **Web direct** | UI → `/api/execution/activity-action` → ? | **MISSING** | API route does not exist. MobileExecutionView references it. |
| **WhatsApp legacy** | MessageProcessor → applyProgressUpdate() → EWS | **DEPRECATED (P0 from R4)** | Bypasses M16 pipeline. |
| **FieldExecutionService** | `src/core/execution/FieldExecutionService.ts` | **DOMAIN LOGIC** | Called by EWS internally. Contains state machine, validation, prerequisite enforcement. Not a direct execution path. |

---

## 5. Existing Authentication

| Mechanism | File | Channel |
|-----------|------|---------|
| NextAuth JWT | `src/lib/auth.ts`, `src/lib/apiAuth.ts` | Web, Mobile |
| `getOrgIdFromRequest()` | `src/lib/apiAuth.ts` | API routes |
| `getUserIdFromRequest()` | `src/lib/apiAuth.ts` | API routes |
| `resolveWebIdentity()` | `src/core/m16/security/IdentityResolver.ts` | Web, Mobile |
| `resolveWhatsAppIdentity()` | `src/core/m16/security/IdentityResolver.ts` | WhatsApp |
| Platform Admin proxy | `apiAuth.ts` lines 14-26 | Web |

---

## 6. Existing Provider / Security

| Item | Status |
|------|--------|
| Whisper API key | Via ProviderLoader / env `WHATSAPP_OPENAI_API_KEY` or `aiProviderSetting` |
| Key logging | Not logged (direct header injection) ✅ |
| Audio size limit | None enforced ⚠ |
| Audio format validation | None — accepts anything sent ⚠ |
| Transcription timeout | 20s ✅ |
| Transcription retry | 3 attempts with backoff ✅ |

---

## 7. Risk Model — Voice Channel

**Current voice restrictions (R3):**

| Intent | allowedViaVoice | R5 Decision |
|--------|----------------|-------------|
| READ intents (all) | `true` | Keep `true` |
| UPDATE_PROGRESS | `true` | Keep `true` |
| REPORT_DELAY | `true` | Keep `true` |
| START_ACTIVITY | `false` | → `true` (with EXPLICIT confirmation) |
| HOLD_ACTIVITY | `false` | → `true` (with EXPLICIT confirmation) |
| RESUME_ACTIVITY | `false` | → `true` (with EXPLICIT confirmation) |
| RELEASE_ACTIVITY | `false` | → `true` (with EXPLICIT confirmation) |
| COMPLETE_ACTIVITY | `false` | → `true` (with EXPLICIT confirmation) |
| VERIFY_ACTIVITY | `false` | → `true` (with EXPLICIT confirmation) |
| CLOSE_ACTIVITY | `false` | → `true` (with EXPLICIT confirmation) |
| GOVERNANCE intents | `false` | Keep `false` |

**R5 rationale:** Voice is now a governed channel. All execution intents already require EXPLICIT confirmation via R3 ConfirmationGate. Blocking them at the channel level is redundant — the confirmation gate IS the safety boundary.

---

## 8. Legacy Code Classification

| Component | Classification | Action |
|-----------|---------------|--------|
| AudioProcessor | CHANNEL ADAPTER | Extract Whisper logic into TranscriptionService; keep AudioProcessor for WhatsApp |
| MessageProcessor | LEGACY AND DANGEROUS | Already marked deprecated (R4). Contains parallel execution path. |
| FieldExtractor | LEGACY (DEPRECATED) | Replaced by M16 IntentClassifier |
| DbMatcher | LEGACY (DEPRECATED) | Replaced by M16 EntityResolver |
| QueryHandler | LEGACY (DEPRECATED) | Replaced by M16 read tools |
| MobileExecutionView | DEAD CODE | References non-existent API routes. Must be rebuilt. |
| ExecutionCockpit | ACTIVE BUT NOT WIRED | 60KB desktop component. Not imported by any page. |

---

## 9. Authority Map

| Capability | Authority | R5 Violation Risk |
|-----------|-----------|-------------------|
| Progress calculation | M8.13 ProgressAggregationService | LOW — M16 doesn't calculate |
| CPM/schedule | M11 | LOW — M16 doesn't calculate |
| Execution mutation | M12 EWS.applyAction() | MEDIUM — MobileExecutionView uses non-existent API |
| Readiness | M12/M10 ExecutionReadinessService | LOW — read-only service |
| Control Tower | M13 | LOW — M16 doesn't invoke |
| Reporting | M14 | LOW — ShiftReportGenerator is separate |
| AI interaction | M16 pipeline | R5 adds voice/mobile as channels |
| Authorization | R3 AuthorizationBoundary | Must apply to voice/mobile |
| Confirmation | R3 ConfirmationGate | Must apply to voice |
| Risk | R3 RiskClassification | Must enable voice intents |

---

## 10. Recommended R5 Architecture

### Voice Channel Adapter

```
Web/Mobile UI → Voice Input (browser MediaRecorder)
  → POST /api/voice/process (authenticated NextAuth)
  → Audio validation (size, format, duration)
  → TranscriptionService (Whisper)
  → PromptInjectionBoundary
  → resolveWebIdentity(session) — identity from auth, NOT from voice
  → resolveEventContext(orgId, 'voice')
  → buildInteractionContext(identity, 'voice', ...)
  → processInteraction() — SAME pipeline
  → Response (text + optional TTS)
```

### Mobile Channel Adapter

```
Mobile UI → Execution Action
  → POST /api/mobile/execute (authenticated NextAuth)
  → resolveWebIdentity(session) — identity from auth
  → resolveEventContext(orgId, 'mobile')
  → buildInteractionContext(identity, 'mobile', ...)
  → processInteraction() OR direct EWS.applyAction() (for non-AI actions)
  → Response
```

### New Files

| File | Purpose |
|------|---------|
| `src/core/m16/channels/VoiceChannelAdapter.ts` | Audio → transcription → M16 pipeline |
| `src/core/m16/channels/MobileChannelAdapter.ts` | Mobile execution → M16 pipeline / EWS |
| `src/services/ai/TranscriptionService.ts` | Extracted Whisper transcription (reusable) |
| `src/app/api/voice/process/route.ts` | Voice API route |
| `src/app/api/mobile/execute/route.ts` | Mobile execution API route |
| `src/core/m16/__tests__/m16-r5-voice.test.ts` | Voice test suite |
| `src/core/m16/__tests__/m16-r5-mobile.test.ts` | Mobile test suite |

### Modified Files

| File | Change |
|------|--------|
| `src/core/m16/risk.ts` | Enable voice for all execution intents (was `false`, now `true`) |
| `src/core/m16/__tests__/m16-r3-execution.test.ts` | Update test to reflect voice now allowed for execution intents |
| `src/core/m16/security/IdentityResolver.ts` | No change needed — `resolveWebIdentity` already works for mobile/voice |
| `src/core/m16/index.ts` | Add R5 exports |

---

## 11. Tenant / Event Isolation Risks

| Risk | Mitigation |
|------|-----------|
| Voice transcript overrides orgId | Identity from NextAuth session, NOT from transcript |
| Voice transcript overrides eventId | Event from EventContextResolver, NOT from transcript |
| Mobile cross-tenant activity | EWS validates org_id on activity lookup |
| Mobile cross-event activity | EventContextResolver scopes to org |
| Concurrent operators | EWS uses `$transaction` — atomic state transitions |
| Stale mobile commands | EWS validates current state before applying action |

---

## 12. Security Risks

| Risk | Severity | Mitigation |
|------|---------|-----------|
| No audio size limit | MEDIUM | Add 10MB max in voice API route |
| No audio format validation | MEDIUM | Accept only audio/* MIME types |
| Prompt injection via voice | HIGH | PromptInjectionBoundary already handles this |
| Voice says "I'm admin" | HIGH | Role from organizationMembership, NOT from voice |
| Offline mutation queue | LOW | Service worker is GET-only. No offline mutations. |

---

## 13. Offline Capability

**Status:** Not safely implementable within R5 scope.

The existing service worker (`sw.js`) only caches GET requests. There is no offline mutation queue, no idempotency key system for queued commands, and no conflict detection.

**R5 Decision:** Explicitly defer offline execution to a future release. Document as known limitation.

---

## 14. R3 Dependencies

All R5 channels MUST flow through:

1. `M16InteractionPipeline.processInteraction()` — for AI-mediated interactions
2. `ExecutionWriteService.applyAction()` — for all execution mutations
3. `M16AuthorizationBoundary.checkAuthorization()` — fail-closed
4. `R3 ConfirmationGate` — for HIGH_RISK and DESTRUCTIVE intents
5. `PromptInjectionBoundary` — for voice transcripts
6. `M16InteractionAuditService.logInteraction()` — for audit

---

## 15. Cross-Channel Parity

All 4 channels must resolve to the same:

| Dimension | Source |
|-----------|--------|
| Organization | Authenticated identity |
| Event | EventContextResolver |
| Equipment | M16EntityResolver |
| Activity | M16EntityResolver |
| Intent | M16IntentClassifier |
| Permission | R3 AuthorizationBoundary |
| Risk | R3 RiskClassification |
| Execution | R3 writeTools → EWS |
| Audit | M16InteractionAudit + M12 ExecutionAudit |

Only presentation and input mechanism differ.
