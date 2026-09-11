# M16-R5 — Voice & Mobile Channel Architecture

**Milestone:** M16-R5 Voice & Mobile  
**Status:** COMPLETE / GREEN  
**Authoritative Execution Path:** R3 Governed Pipeline (`writeTools.ts` / `MobileChannelAdapter.ts` → `ExecutionWriteService`)  
**Date:** 2026-09-08  

---

## 1. Executive Architecture Overview

M16-R5 establishes **Voice** and **Mobile** as first-class channel adapters within the STO interaction ecosystem. Rather than introducing parallel execution logic or siloed business rules, R5 adheres strictly to the unified governance model established in R1–R4:

1. **Voice Channel Adapter (`VoiceChannelAdapter`):**  
   Transforms speech audio into text via `TranscriptionService`, then channels the transcribed command directly into the authoritative **M16 Interaction Pipeline** (`processInteraction()`). Voice operates identically to Web and WhatsApp text interactions, benefiting from the full security chain: Prompt Injection Boundary, Intent Classification, Entity Resolution, Risk Evaluation, Authorization, and Confirmation Gate.

2. **Mobile Channel Adapter (`MobileChannelAdapter`):**  
   Optimized for field operations where low-latency button presses trigger explicit execution actions (e.g. "START", "UPDATE_PROGRESS", "HOLD", "RESUME", "COMPLETE"). Mobile direct execution bypasses natural language intent classification to eliminate classification ambiguity and prompt injection vectors, but enforces **identical R3 Authorization (`checkAuthorization()`)** and dispatches directly to the single governed mutation authority: **`ExecutionWriteService` (EWS)**.

```
                     ┌───────────────────────────────┐
                     │          NextAuth JWT         │
                     │    (Authoritative Identity)   │
                     └───────┬───────────────┬───────┘
                             │               │
                             ▼               ▼
      ┌──────────────────────────────┐   ┌──────────────────────────────┐
      │     Voice Channel Adapter    │   │    Mobile Channel Adapter    │
      │   (Audio Upload / Stream)    │   │     (Field Button Press)     │
      └──────────────┬───────────────┘   └──────────────┬───────────────┘
                     │                                  │
                     ▼                                  │
      ┌──────────────────────────────┐                  │
      │     TranscriptionService     │                  │
      │   (Whisper API / Fallback)   │                  │
      └──────────────┬───────────────┘                  │
                     │                                  │
                     ▼ (Transcribed Text)               │
      ┌──────────────────────────────┐                  │
      │    M16 Interaction Pipeline  │                  │
      │  ┌─────────────────────────┐ │                  │
      │  │ PromptInjectionBoundary │ │                  │
      │  └───────────┬─────────────┘ │                  │
      │              ▼               │                  │
      │  ┌─────────────────────────┐ │                  │
      │  │ Intent / Entity Resolver│ │                  │
      │  └───────────┬─────────────┘ │                  │
      │              ▼               │                  │
      │  ┌─────────────────────────┐ │                  │
      │  │  Risk & Auth Boundary   │ │                  │
      │  └───────────┬─────────────┘ │                  │
      │              ▼               │                  │
      │  ┌─────────────────────────┐ │                  │
      │  │    ConfirmationGate     │ │                  │
      │  └───────────┬─────────────┘ │                  │
      │              ▼               │                  │
      │  ┌─────────────────────────┐ │                  │
      │  │       writeTools        │ │                  │
      │  └───────────┬─────────────┘ │                  │
      └──────────────┼───────────────┘                  │
                     │                                  │
                     ▼                                  ▼
      ┌─────────────────────────────────────────────────────────────────┐
      │                 ExecutionWriteService (EWS)                     │
      │                (Single Mutation Authority)                      │
      │  ┌───────────────────────────────────────────────────────────┐  │
      │  │   FieldExecutionService State Machine & Invariants        │  │
      │  └───────────────────────────────────────────────────────────┘  │
      └──────────────────────────────┬──────────────────────────────────┘
                                     │
                                     ▼
      ┌─────────────────────────────────────────────────────────────────┐
      │     AuditLog  +  ProgressLog  +  Notification/EventBus          │
      └─────────────────────────────────────────────────────────────────┘
```

---

## 2. Voice Architecture & Pipeline

### 2.1 Audio Transcription Service (`src/services/ai/TranscriptionService.ts`)
The `TranscriptionService` abstracts speech-to-text functionality, extracted from the legacy WhatsApp `AudioProcessor` into a reusable, channel-agnostic service:
- **Input Validation:**
  - File size cap: 10 MB maximum.
  - Duration cap: 120 seconds maximum.
  - Supported audio MIME types: `audio/wav`, `audio/mpeg`, `audio/mp4`, `audio/ogg`, `audio/webm`, `audio/x-m4a`.
- **Processing Engine:**
  - Standard provider: OpenAI Whisper API via `ProviderLoader` / `aiProviderSetting`.
  - Configurable timeout (default 20 seconds).
  - Retry policy with exponential backoff (3 attempts).
  - Structured output with transcription text, confidence estimate, detected language, and duration.
- **Fail-Safe Operation:**
  - Rejects empty, corrupted, or unsupported audio buffers cleanly without process termination.
  - Returns descriptive errors without leaking internal stack traces or API keys.

### 2.2 Voice Channel Adapter (`src/core/m16/channels/VoiceChannelAdapter.ts`)
- Accepts audio file buffer + metadata + NextAuth session context.
- Transcribes audio using `TranscriptionService`.
- Reconstructs an `M16InteractionRequest` with `channel: 'voice'`.
- Invokes `processInteraction()`, allowing the conversational pipeline to handle entity resolution, confirmation prompting, or immediate response.
- Generates speech-optimized text responses for synthesis by the client device.

### 2.3 Audio Security & Identity Invariant
- **Rule:** The voice transcript is **NEVER** used for identity resolution or authentication.
- **Invariant:** Identity is extracted exclusively from the authenticated NextAuth session (`req.auth.user` or NextAuth JWT token). Voice commands claiming "I am admin John Doe" are treated strictly as conversational prompt text and have zero privilege escalation capability.

---

## 3. Mobile Architecture & Direct Execution

### 3.1 Mobile Execution Paradigm
Mobile users (supervisors, field engineers) frequently execute standardized activity transitions under time pressure, poor connectivity, or noisy plant conditions. Requiring spoken or typed text for routine transitions (e.g., clicking "Start Activity" or "Hold Activity") introduces transcription latency and potential NLP intent classification errors.

The `MobileChannelAdapter` (`src/core/m16/channels/MobileChannelAdapter.ts`) provides a dedicated fast path for deterministic actions:
1. Receives direct structured execution action payloads: `{ action, activityId, comment, delayReason, ... }`.
2. Resolves and validates the caller's identity via `resolveWebIdentity()` (using NextAuth session).
3. Maps the execution action to its corresponding M16 intent (`START` → `M16Intent.START_ACTIVITY`, etc.).
4. Evaluates permissions via `checkAuthorization()`, guaranteeing identical RBAC enforcement as Web and Voice.
5. Invokes `ExecutionWriteService.applyAction(orgId, userId, params, options)` directly.

### 3.2 EWS Whitelist Preservation
To prevent architectural erosion, `m16-r1-authority.test.ts` enforces an explicit whitelist of files permitted to import `ExecutionWriteService`:
```typescript
const ALLOWED_EWS_IMPORTERS = [
  'MobileChannelAdapter.ts',
  'writeTools.ts'
];
```
No other services or controllers may bypass this boundary.

---

## 4. API Surface

### 4.1 Voice API Route (`/api/voice/process`)
- **Method:** `POST` (multipart/form-data)
- **Authentication:** NextAuth session required (401 if missing/invalid).
- **Parameters:**
  - `audio`: File (binary audio blob).
  - `eventId`: Optional UUID string for explicit event binding.
  - `conversationId`: Optional UUID string for multi-turn session tracking.
- **Health Check:** `GET /api/voice/process` returns `{ status: 'ok', channel: 'voice', maxAudioSizeBytes: 10485760 }`.

### 4.2 Mobile Execution API Route (`/api/mobile/execute`)
- **Method:** `POST` (application/json)
- **Authentication:** NextAuth session required (401 if missing/invalid).
- **Body:**
  ```json
  {
    "action": "START",
    "activityId": "uuid-v4",
    "comment": "Commencing valve inspection",
    "eventId": "uuid-v4"
  }
  ```
- **Readiness Check:** `GET /api/mobile/execute?activityId=...` verifies readiness prerequisites before action dispatch.

---

## 5. Risk Model Harmonization

In R3, voice execution intents were restricted (`allowedViaVoice: false`) as a temporary safeguard. In R5:
- **Decision:** All activity execution intents (`START_ACTIVITY`, `UPDATE_PROGRESS`, `COMPLETE_ACTIVITY`, `REPORT_DELAY`, `HOLD_ACTIVITY`, `RESUME_ACTIVITY`, `RELEASE_ACTIVITY`, `VERIFY_ACTIVITY`, `CLOSE_ACTIVITY`) are updated to `allowedViaVoice: true`.
- **Safety Boundary:** The R3 `ConfirmationGate` is the authoritative safety boundary. High-risk execution intents received via voice generate an explicit confirmation challenge (`action: 'CONFIRM'`) that must be acknowledged before write tool execution.
- **Governance Remains Blocked:** System configuration, governance modifications, and sensitive policy overrides retain `allowedViaVoice: false` across all conditions.
