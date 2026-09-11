# M16-R4 Forensic Audit — WhatsApp Operations

**Date:** 2026-09-08
**Pre-condition:** M16-R3 GREEN/CLOSED
**Scope:** Forensic discovery — no code modified

---

## Component Classification

| # | Component | File | Classification | Finding |
|---|-----------|------|---------------|---------|
| 1 | **MessageProcessor** | `src/services/whatsapp/MessageProcessor.ts` | **D — Direct Domain Authority** | Lines 239-244: `applyProgressUpdate()` calls `EWS.applyAction()` directly, bypassing M16 pipeline, authorization boundary, confirmation gate, risk classification. No intent classification. No M16 entity resolution. No M16 audit. Line 328: decides `COMPLETE` vs `UPDATE_PROGRESS` based on progress ≥ 100 — domain logic in transport layer. |
| 2 | **FieldExtractor** | `src/services/whatsapp/FieldExtractor.ts` | **C — Duplicate M16 Logic** | Marked `@deprecated`. Own GPT-4o-mini call for intent/entity extraction. Duplicates M16 IntentClassifier + EntityResolver. No event context. Calls OpenAI directly (bypasses ProviderLoader). |
| 3 | **DbMatcher** | `src/services/whatsapp/DbMatcher.ts` | **C — Duplicate M16 Logic** | Marked `@deprecated`. Ad-hoc string matching without event scoping. Duplicates M16 EntityResolver + DimensionRegistry. No event isolation. No tenant-scoped dimension registry. |
| 4 | **QueryHandler** | `src/services/whatsapp/QueryHandler.ts` | **D — Direct Domain Authority** | Marked `@deprecated`. Queries Prisma directly (`workpack`, `asset`, `activity`). Calculates progress counts locally. No M16 entity resolution. No event context. No authorization. |
| 5 | **MetaClient** | `src/services/whatsapp/MetaClient.ts` | **A — Safe Adapter** | Transport-only. Sends/receives WhatsApp messages. Downloads audio. Manages Meta API credentials. No domain logic. **RETAIN.** |
| 6 | **AudioProcessor** | `src/services/whatsapp/AudioProcessor.ts` | **B — Legacy but Safe** | Downloads audio, transcribes via Whisper. No domain logic. Audio → text transform only. **RETAIN** (used for voice notes). |
| 7 | **ReplyBuilder** | `src/services/whatsapp/ReplyBuilder.ts` | **B — Legacy but Safe** | i18n reply templates. No domain logic. Will need R4 expansion for confirmation prompts and execution results. **RETAIN + EXTEND.** |
| 8 | **ShiftReportGenerator** | `src/services/whatsapp/ShiftReportGenerator.ts` | **B — Legacy but Safe** | Cron-triggered report generation. Uses Prisma for data gathering (read-only for report content). Sends via MetaClient. Not an execution path. **RETAIN** (M14 report delivery). |
| 9 | **WebhookSignatureVerifier** | `src/core/m16/security/WebhookSignatureVerifier.ts` | **A — Safe M16 Adapter** | HMAC-SHA256 verification. Already in M16 core. **USE.** |
| 10 | **IdentityResolver** | `src/core/m16/security/IdentityResolver.ts` | **A — Safe M16 Adapter** | `resolveWhatsAppIdentity()` — phone → User with verified/opt-in enforcement. Already in M16 core. **USE.** |
| 11 | **InteractionContextBuilder** | `src/core/m16/context/InteractionContextBuilder.ts` | **A — Safe M16 Adapter** | Builds immutable `M16InteractionContext`. Already validates mandatory fields. **USE.** |
| 12 | **M16InteractionPipeline** | `src/core/m16/pipeline/M16InteractionPipeline.ts` | **A — Safe M16 Adapter** | R3 governed pipeline with intent → entity → auth → risk → confirmation → tool → EWS. **USE** — this IS the target entry point. |
| 13 | **M16AuthorizationBoundary** | `src/core/m16/auth/M16AuthorizationBoundary.ts` | **A — Safe M16 Adapter** | R3 fail-closed. **USE** — WhatsApp must go through this. |
| 14 | **ConfirmationGate** | `src/core/m16/pipeline/ConfirmationGate.ts` | **A — Safe M16 Adapter** | R3 security-bound gate. **USE** — single confirmation mechanism. |
| 15 | **M16 writeTools** | `src/core/m16/tools/writeTools.ts` | **A — Safe M16 Adapter** | 9 tools → EWS.applyAction(). **USE.** |
| 16 | **RateLimiter** | `src/lib/rateLimiter.ts` | **A — Safe Adapter** | Has `webhook` tier (60/min). **USE.** |
| 17 | **WhatsApp Sessions** | `prisma.whatsapp_sessions` | **B — Legacy but Safe** | Session state for multi-turn disambiguation. May coexist with M16 ConfirmationGate for entity clarification (not for execution confirmation). |
| 18 | **WhatsApp Updates** | `prisma.whatsapp_updates` | **B — Legacy but Safe** | Audit trail for WhatsApp messages. Supplements M16 InteractionAudit. |

---

## Critical Findings

### Finding 1: PARALLEL EXECUTION PATH (P0)

`MessageProcessor.applyProgressUpdate()` (line 313-344) calls `ExecutionWriteService.applyAction()` **directly**, bypassing:
- M16 IntentClassifier
- M16 EntityResolver
- M16 AuthorizationBoundary (fail-closed)
- R3 ConfirmationGate
- R3 risk classification
- R3 security bindings
- M16 InteractionAudit

This is a **governed execution bypass**. A WhatsApp user can execute `COMPLETE` (destructive action) with zero confirmation and zero authorization check.

**Fix:** Route through `M16InteractionPipeline.processInteraction()`.

### Finding 2: DUPLICATE INTENT/ENTITY RESOLUTION (P1)

`FieldExtractor` + `DbMatcher` duplicate M16 IntentClassifier + EntityResolver + DimensionRegistry with:
- No event scoping
- No tenant-scoped dimension registry
- Ad-hoc string matching (not authoritative)
- Direct OpenAI calls (bypasses ProviderLoader)

**Fix:** Deprecate and replace with M16 pipeline.

### Finding 3: DIRECT PRISMA QUERIES (P1)

`QueryHandler` queries `prisma.workpack`, `prisma.asset`, `prisma.activity` directly. Calculates progress counts locally instead of using M8.13 authority.

**Fix:** Route through M16 read tools.

### Finding 4: NO WEBHOOK ROUTE EXISTS

`processInboundMessage` is defined but never called from any Next.js API route. The webhook endpoint needs to be created as the R4 entry point.

### Finding 5: SESSION STATE OVERLAP

`whatsapp_sessions` manages multi-turn disambiguation (awaiting_unit, awaiting_activity). This is entity clarification — distinct from R3 execution confirmation. Both can coexist, but must not conflict.

---

## R4 Architecture Decision

```
WhatsApp Webhook (API route)
  │
  ├─ HMAC verification (WebhookSignatureVerifier)
  ├─ Rate limit (rateLimiter.webhook)
  ├─ Idempotency check (meta_message_id in whatsapp_updates)
  │
  ├─ Audio? → AudioProcessor → transcript
  │
  ├─ Identity (IdentityResolver.resolveWhatsAppIdentity)
  │   └─ DENY if not_found / not_verified / not_opted_in / inactive
  │
  ├─ Event context resolution
  │   └─ ASK if ambiguous
  │
  ├─ Build M16InteractionContext (InteractionContextBuilder)
  │
  ├─ Resolve user role (for fail-closed auth)
  │
  └─ M16InteractionPipeline.processInteraction()
      │
      ├─ IntentClassifier
      ├─ EntityResolver
      ├─ AuthorizationBoundary (fail-closed)
      ├─ RiskClassification
      ├─ ConfirmationGate (R3 security bindings)
      ├─ Tool execution → EWS.applyAction()
      └─ Response → ReplyBuilder → MetaClient.sendWhatsAppMessage()
```

### What to Build (New)

| Component | Purpose |
|-----------|---------|
| `WhatsAppChannelAdapter.ts` | Entry point: HMAC → identity → context → M16 pipeline → reply |
| `src/app/api/whatsapp/webhook/route.ts` | Next.js API route |
| `m16-r4-whatsapp.test.ts` | Comprehensive test suite |

### What to Retain

| Component | Status |
|-----------|--------|
| MetaClient | **USE** as-is (transport) |
| AudioProcessor | **USE** as-is (transcription) |
| ReplyBuilder | **EXTEND** for R3 confirmations/execution results |
| ShiftReportGenerator | **RETAIN** (M14 delivery, not execution) |
| WebhookSignatureVerifier | **USE** (already M16 core) |
| IdentityResolver | **USE** (already M16 core) |
| InteractionContextBuilder | **USE** (already M16 core) |
| RateLimiter | **USE** |

### What to Deprecate

| Component | Reason |
|-----------|--------|
| FieldExtractor | Replaced by M16 IntentClassifier |
| DbMatcher | Replaced by M16 EntityResolver |
| QueryHandler | Replaced by M16 read tools via pipeline |
| MessageProcessor.applyProgressUpdate | Replaced by M16 writeTools via pipeline |

### What NOT to Create

- ❌ WhatsAppConfirmationGate
- ❌ WhatsAppAuthorizationService
- ❌ WhatsAppExecutionService
- ❌ WhatsApp-specific risk engine
- ❌ WhatsApp-specific entity resolver
- ❌ WhatsApp-specific intent classifier

---

## Verdict

**R4 is architecturally simple**: build a channel adapter that transforms WhatsApp messages into M16 pipeline calls. The M16 core (R1/R2/R3) already handles everything else.

The primary risk is the **existing parallel execution path** in MessageProcessor, which must be eliminated.
