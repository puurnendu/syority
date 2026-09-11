# M16-R5 — Multi-Channel Authority Matrix

**Milestone:** M16-R5 Voice & Mobile  
**Status:** COMPLETE / GREEN  
**Reference Specification:** R3 Governed Authority Model (`M16_R3_SECURITY_CLOSURE.md`)  
**Date:** 2026-09-08  

---

## 1. Multi-Channel Governance Overview

STO supports interaction across four primary channels: **Web**, **WhatsApp**, **Voice**, and **Mobile**. All channels converge on identical security, authorization, and execution rules.

| Dimension | Web | WhatsApp | Voice | Mobile |
|-----------|-----|----------|-------|--------|
| **Identity Authority** | NextAuth JWT Session | Phone Number Mapping (Opt-in) | NextAuth JWT Session | NextAuth JWT Session |
| **Identity Source** | `resolveWebIdentity()` | `resolveWhatsAppIdentity()` | `resolveWebIdentity()` | `resolveWebIdentity()` |
| **Input Format** | Text / UI Clicks | Text / WhatsApp Audio | Raw Audio (Whisper) | Direct Action JSON / UI |
| **Processing Path** | M16 Pipeline | M16 Pipeline | M16 Pipeline (via Transcription) | Direct R3 Execution |
| **Intent Detection** | `IntentClassifier` | `IntentClassifier` | `IntentClassifier` | Explicit Action Mapping |
| **Authorization Check** | `checkAuthorization()` | `checkAuthorization()` | `checkAuthorization()` | `checkAuthorization()` |
| **Confirmation Gate** | R3 `ConfirmationGate` | R3 `ConfirmationGate` | R3 `ConfirmationGate` | Client UI Confirmation |
| **Execution Authority** | `ExecutionWriteService` | `ExecutionWriteService` | `ExecutionWriteService` | `ExecutionWriteService` |
| **Caller Whitelist** | `writeTools.ts` | `writeTools.ts` | `writeTools.ts` | `MobileChannelAdapter.ts` |

---

## 2. Intent-Level Channel Authority Matrix

| Intent Category | Intent Name | Web | WhatsApp | Voice (R5) | Mobile | Required Permission | Risk Tier |
|-----------------|-------------|:---:|:--------:|:----------:|:------:|---------------------|-----------|
| **Read** | `QUERY_STATUS` | ✅ Allowed | ✅ Allowed | ✅ Allowed | ✅ Allowed | `read:execution` | LOW |
| **Read** | `QUERY_PROGRESS` | ✅ Allowed | ✅ Allowed | ✅ Allowed | ✅ Allowed | `read:execution` | LOW |
| **Read** | `QUERY_KPIS` | ✅ Allowed | ✅ Allowed | ✅ Allowed | ✅ Allowed | `read:reports` | LOW |
| **Read** | `LIST_ACTIVITIES` | ✅ Allowed | ✅ Allowed | ✅ Allowed | ✅ Allowed | `read:execution` | LOW |
| **Read** | `EXPLAIN_DELAY` | ✅ Allowed | ✅ Allowed | ✅ Allowed | ✅ Allowed | `read:execution` | LOW |
| **Execution** | `START_ACTIVITY` | ⚠️ Confirm | ⚠️ Confirm | ⚠️ Confirm | ✅ Direct | `execute:activity:start` | MEDIUM |
| **Execution** | `UPDATE_PROGRESS` | ⚠️ Confirm | ⚠️ Confirm | ⚠️ Confirm | ✅ Direct | `execute:activity:update` | MEDIUM |
| **Execution** | `COMPLETE_ACTIVITY` | ⚠️ Confirm | ⚠️ Confirm | ⚠️ Confirm | ✅ Direct | `execute:activity:complete` | HIGH |
| **Execution** | `REPORT_DELAY` | ⚠️ Confirm | ⚠️ Confirm | ⚠️ Confirm | ✅ Direct | `execute:activity:delay` | MEDIUM |
| **Execution** | `HOLD_ACTIVITY` | ⚠️ Confirm | ⚠️ Confirm | ⚠️ Confirm | ✅ Direct | `execute:activity:hold` | HIGH |
| **Execution** | `RESUME_ACTIVITY` | ⚠️ Confirm | ⚠️ Confirm | ⚠️ Confirm | ✅ Direct | `execute:activity:resume` | HIGH |
| **Execution** | `RELEASE_ACTIVITY` | ⚠️ Confirm | ⚠️ Confirm | ⚠️ Confirm | ✅ Direct | `execute:activity:release` | HIGH |
| **Execution** | `VERIFY_ACTIVITY` | ⚠️ Confirm | ⚠️ Confirm | ⚠️ Confirm | ✅ Direct | `execute:activity:verify` | CRITICAL |
| **Execution** | `CLOSE_ACTIVITY` | ⚠️ Confirm | ⚠️ Confirm | ⚠️ Confirm | ✅ Direct | `execute:activity:close` | CRITICAL |
| **Governance** | `UPDATE_POLICY` | ⚠️ Confirm | 🛑 Blocked | 🛑 Blocked | 🛑 Blocked | `admin:governance` | CRITICAL |
| **Governance** | `CHANGE_SETTINGS` | ⚠️ Confirm | 🛑 Blocked | 🛑 Blocked | 🛑 Blocked | `admin:settings` | CRITICAL |
| **Governance** | `DELETE_DATA` | ⚠️ Confirm | 🛑 Blocked | 🛑 Blocked | 🛑 Blocked | `admin:delete` | CRITICAL |

*Legend:*  
- ✅ **Allowed:** Action executes immediately upon authorization.  
- ⚠️ **Confirm:** Action generates an explicit confirmation challenge via `ConfirmationGate`; requires secondary user consent before execution.  
- 🛑 **Blocked:** Intent is permanently disallowed via this channel at the policy level (`allowedViaVoice: false` or unsupported mobile action).  

---

## 3. Whitelist of Authorized Mutation Callers

To maintain strict architectural boundaries, direct writes to `ExecutionWriteService` are restricted to an enforced whitelist:

```typescript
// Verified by src/core/m16/__tests__/m16-r1-authority.test.ts
const ALLOWED_EWS_IMPORTERS = [
  'MobileChannelAdapter.ts',
  'writeTools.ts'
];
```

### Invariant Checks:
1. **No Voice Direct Write:** `VoiceChannelAdapter` does **NOT** import `ExecutionWriteService`. Voice commands must traverse `processInteraction()` → `writeTools.ts` → `ExecutionWriteService`.
2. **No Web Controller Direct Write:** Web API controllers invoke M16 interaction routes or governed service layers; they do not call EWS directly.
3. **No WhatsApp Direct Write:** WhatsApp webhook dispatches to `WhatsAppChannelAdapter` → `processInteraction()` → `writeTools.ts`.
4. **Mobile Controlled Access:** `MobileChannelAdapter` is the sole non-AI importer of `ExecutionWriteService`, strictly guarded by `checkAuthorization()` before invocation.

---

## 4. Fail-Closed Authority Invariants

1. **Role Requirement:**  
   If `user.role` is `undefined`, `null`, empty string, or an unrecognized string, `checkAuthorization()` returns `{ authorized: false, reason: 'No role provided' }`. There is zero fail-open allowance.
2. **Tenant Scoping:**  
   Execution requests without an authoritative `organization_id` in the authenticated session are rejected with HTTP 401/403.
3. **Event Scoping:**  
   Activities belonging to Event A cannot be mutated by a session scoped to Event B. Field execution state machine verifies activity-to-event association.
4. **Prerequisite & State Machine Validation:**  
   Even with valid permissions, attempts to perform invalid state transitions (e.g., starting an activity whose predecessors are incomplete or completing an unstarted activity) are rejected by `FieldExecutionService`.
5. **Idempotency & Replay Invariant:**  
   `MobileChannelAdapter` maintains an in-memory `idempotencyStore` with 5-minute TTL keyed by `requestId`. Repeated requests with the same `requestId` return identical cached execution results without re-executing state transitions against EWS.
6. **Stale Command Protection:**  
   If an activity has reached a terminal status (`completed`, `verified`, or `closed`), any stale `UPDATE_PROGRESS` (< 100) or `START`/`HOLD`/`RESUME` command is rejected immediately, preventing corruption of the authoritative terminal state.
