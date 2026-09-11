# M16-R1 — Security Acceptance Report

## Status: GREEN ✅
**Date:** 2026-09-07

---

## 1. Webhook Authentication

### X-Hub-Signature-256 Verification
| Test | Result |
|------|--------|
| S1 — Invalid Meta signature | REJECTED ✅ |
| S2 — Missing Meta signature | REJECTED ✅ |
| S2b — Null-like signature | REJECTED ✅ |
| S3 — Modified payload | REJECTED ✅ |
| S4 — Valid Meta signature | ACCEPTED ✅ |
| S4b — Wrong prefix (md5=) | REJECTED ✅ |
| S4c — No sha256= prefix | REJECTED ✅ |
| S4d — Empty secret | REJECTED ✅ |
| S4e — Invalid hex | REJECTED ✅ |

**Implementation:** `crypto.createHmac('sha256', secret)` + `crypto.timingSafeEqual()`

**No secrets are logged.**

---

## 2. Tenant Isolation

| Test | Result |
|------|--------|
| S5 — organizationId from trusted source only | ✅ |
| Context is Object.freeze'd — cannot be mutated | ✅ |
| organizationId comes from User record, not LLM | ✅ |

---

## 3. Event Isolation

| Test | Result |
|------|--------|
| S6 — eventId from trusted session/context only | ✅ |
| Context is frozen after build | ✅ |
| Stale session events are rejected and fall through | ✅ |

---

## 4. Identity

| Security Layer | Status |
|----------------|--------|
| `whatsapp_verified` enforcement | ✅ Required |
| `whatsapp_opt_in` enforcement | ✅ Required |
| `is_active` check | ✅ Required |
| Phone → User → Org resolution chain | ✅ Implemented |

---

## 5. Authorization

| Restriction | Status |
|-------------|--------|
| Governance intents blocked on WhatsApp | ✅ |
| Governance intents blocked on Voice | ✅ |
| Execution intents require event context | ✅ |
| LLM cannot assert authorization | ✅ (application-side only) |

---

## 6. Prompt Injection Protection

| Test | Attack | Result |
|------|--------|--------|
| PI1 | Override eventId | BLOCKED ✅ |
| PI2 | Override organizationId | BLOCKED ✅ |
| PI3 | Manufacture entity UUIDs | STRIPPED ✅ |
| PI4 | Change identitySource/channel | BLOCKED ✅ |
| PI5 | 6 injection patterns detected | DETECTED ✅ |
| PI5b | Clean messages pass through | CLEAN ✅ |
| PI_extra | Compound attack (3 fields) | ALL BLOCKED ✅ |

**Trust boundary architecture:** LLM output NEVER populates trusted context fields, regardless of content.

---

## 7. Rate Limiting

| Tier | Limit | Purpose |
|------|-------|---------|
| `webhook` | 60 calls/min per phone | Webhook abuse protection |
| `ai` (existing) | 20 calls/min | AI invocation abuse protection |

Reuses existing `RateLimiterMemory` infrastructure — no new implementation.

---

## 8. Three Separate Concepts

The implementation maintains strict separation of:

1. **Meta transport authenticity** — `WebhookSignatureVerifier` (HMAC-SHA256)
2. **WhatsApp user identity** — `IdentityResolver` (phone → user + verified/opted-in)
3. **Application authorization** — `M16AuthorizationBoundary` (intent → permission)

These are NEVER combined. Each layer operates independently.

---

## Verdict: GREEN ✅

All P0/P1 security requirements are implemented and tested.
