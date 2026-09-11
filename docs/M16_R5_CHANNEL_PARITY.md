# M16-R5 — Cross-Channel Parity

**Milestone:** M16-R5 Voice & Mobile  
**Document type:** Channel confirmation policy (remediation)  
**Date:** 2026-09-08  

This document records the confirmation policy selected during M16-R5 remediation. It does **not** close R5 and does **not** declare GREEN.

---

## 1. Parity Core Principles

Channel is an ingress mechanism, not an authorization bypass or a second execution engine.

1. **Identical authorization:** The same role + intent yields the same allow/deny decision.
2. **Identical risk model:** `classifyRisk()` is the shared risk authority for every action.
3. **Identical mutation authority:** All channels terminate in `ExecutionWriteService.applyAction()`.
4. **Identical identity rule:** `userId`, `organizationId`, and role come from trusted application context, never from transcript, WhatsApp text, or LLM output.

---

## 2. Confirmation policy (P1-2 decision)

**Selected policy: web-button / tactile parity for Mobile (and Web deterministic operator controls).**

| Channel | Confirmation mechanism |
|---|---|
| **Web deterministic operator controls** (execution UI buttons) | The UI button press **is** the operator confirmation (tactile). Server still authenticates, authorizes, classifies risk, and executes via EWS. |
| **Mobile deterministic operator controls** (structured JSON action buttons) | Same as Web. The button press **is** the operator confirmation. **No `MobileConfirmationGate`.** Server still: JWT identity, trusted org, activity lookup scoped to org+event, `checkAuthorization()`, `classifyRisk()`, `requestId` for destructive/high-risk actions, then EWS. |
| **Conversational AI channels** (WhatsApp, Voice, AI assistant text) | Shared **`ConfirmationGate`** for START, HOLD, RESUME, RELEASE, VERIFY, CLOSE, COMPLETE, and other R3-designated high-risk/destructive intents. COMPLETE does **not** auto-execute because progress ≥ 100. |

This distinction is intentional:

- **Web/Mobile deterministic operator controls = tactile confirmation**
- **Conversational AI channels = ConfirmationGate**

Do not create `MobileConfirmationGate`, `WhatsAppConfirmationGate`, or `VoiceConfirmationGate`.

---

## 3. Cross-Channel Capability Comparison

| Capability / Attribute | Web Portal (buttons) | WhatsApp | Voice | Mobile App (buttons) |
|------------------------|:----------:|:--------:|:----------:|:---------------:|
| **Identity Source** | NextAuth JWT | Verified Phone Opt-In | NextAuth JWT | NextAuth JWT |
| **Spoken Text / Transcribe** | N/A | Whisper via Meta Audio | Whisper via Upload/Stream | N/A |
| **NLP Intent Resolution** | `IntentClassifier` (assistant) | `IntentClassifier` | `IntentClassifier` | Direct Action Enum |
| **Prompt Injection Defense** | Assistant path | `detectInjectionPatterns` | `detectInjectionPatterns` | N/A (Structured JSON) |
| **Event Scoping** | Bound | Bound / ASK if ambiguous | Bound / ASK if ambiguous | Bound (activity.event_id) |
| **Risk Model Evaluation** | `classifyRisk()` | `classifyRisk()` via pipeline | `classifyRisk()` via pipeline | `classifyRisk()` on every action |
| **Requires Confirmation** | Tactile UI | Shared ConfirmationGate | Shared ConfirmationGate | Tactile UI + `requestId` for destructive/high-risk |
| **Terminal Execution Unit** | EWS | writeTools → EWS | writeTools → EWS | MobileChannelAdapter → EWS |
| **Conversation identity** | session | `wa-${phone}` (stable) | `voice-${userId}-${eventId}` (stable) | `requestId` (required when risk requires it) |

---

## 4. Authorization parity (roles)

Evaluating permissions for a given intent produces the same boolean across channels:

| Intent | `supervisor` / `execution_engineer` | `operator` | `viewer` | missing role |
|--------|:------------:|:--------:|:--------:|:--------:|
| `QUERY_STATUS` | allowed | allowed | allowed | allowed (query) |
| `START_ACTIVITY` | allowed | denied | denied | denied (fail-closed) |
| `UPDATE_PROGRESS` | allowed | allowed | denied | denied |
| `HOLD_ACTIVITY` | allowed | denied | denied | denied |
| `COMPLETE_ACTIVITY` | allowed | denied | denied | denied |

Mobile COMPLETE without `execution.complete` is denied before EWS. Conversational COMPLETE without that permission is denied before ConfirmationGate.

---

## 5. Known limitations (not a closure claim)

- Mobile/ConfirmationGate stores remain **in-memory** (single-node). Destructive Mobile actions require `requestId` in this process; EWS uses `updateMany` + expected status for concurrent COMPLETE.
- GET `/api/voice/process` is an unauthenticated liveness probe (no secrets, no mutations).
- `src/app/api/reports/**` exists only under `src/app` and is **not** served while Next.js prefers `./app`.
