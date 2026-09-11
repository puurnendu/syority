# M16-R0.1 — Security Architecture

**Date:** 2026-09-07  
**Status:** FORENSIC RECONCILIATION — no code modified

---

## 1. Three-Layer Security Model Reconciliation

### Layer 1 — Transport Authenticity ("Is this actually a legitimate Meta webhook?")

| Check | Current Implementation | Present? | Verified? | Evidence |
|-------|----------------------|----------|-----------|----------|
| `X-Hub-Signature-256` header verification | ❌ NOT IMPLEMENTED | ❌ | ❌ | Zero occurrences of `X-Hub-Signature`, `hub.signature`, or HMAC verification in webhook code. Searched entire codebase. |
| Meta App Secret (`WHATSAPP_APP_SECRET`) in env | ❌ NOT CONFIGURED | ❌ | ❌ | No `WHATSAPP_APP_SECRET` environment variable referenced anywhere |
| Webhook verification token (GET) | ✅ `WHATSAPP_VERIFY_TOKEN` | ✅ | ✅ | [`webhook/route.ts`](file:///c:/DEV/STO/app/api/webhooks/whatsapp/route.ts) GET handler checks `hub.verify_token` against env |
| Request body signature comparison | ❌ NOT IMPLEMENTED | ❌ | ❌ | POST handler at L32-47 immediately parses body and processes — no signature check |
| IP allowlist (Meta servers) | ❌ NOT IMPLEMENTED | ❌ | ❌ | No IP filtering |

**Layer 1 Verdict: ❌ BROKEN** — Any external party can POST crafted JSON to `/api/webhooks/whatsapp` and it will be processed as a legitimate WhatsApp message.

### Layer 2 — Application Identity ("Which STO user is sending this?")

| Check | Current Implementation | Present? | Verified? | Evidence |
|-------|----------------------|----------|-----------|----------|
| Phone → User mapping | ✅ `prisma.user.findFirst({ whatsapp_number: phone })` | ✅ | ✅ | [`MessageProcessor.ts`](file:///c:/DEV/STO/src/services/whatsapp/MessageProcessor.ts#L55-L64) L55-64 |
| User active check | ✅ `is_active: true` | ✅ | ✅ | Same query L56 |
| Unregistered rejection | ✅ Sends "unregistered" reply | ✅ | ✅ | [`MessageProcessor.ts`](file:///c:/DEV/STO/src/services/whatsapp/MessageProcessor.ts#L66-L77) L66-77 |
| Phone format normalization | ✅ `+` prefix | ✅ | ✅ | L48 |
| WhatsApp verification flag | ⚠️ `whatsapp_verified` exists in schema but NOT checked | ❌ | ❌ | `whatsapp_verified` field exists on User model (schema L1544) but `processSingleMessage()` does not check it |
| WhatsApp opt-in flag | ⚠️ `whatsapp_opt_in` exists in schema but NOT checked | ❌ | ❌ | `whatsapp_opt_in` field exists (schema L1545) but not checked |
| OTP/PIN verification | ❌ NOT IMPLEMENTED | ❌ | ❌ | No challenge-response mechanism |

**Layer 2 Verdict: 🟡 PARTIAL** — Phone-to-user lookup works and rejects unknown numbers, but `whatsapp_verified` and `whatsapp_opt_in` flags are ignored, and no additional identity verification exists.

### Layer 3 — Authorization ("Is this user permitted to perform this action?")

| Check | Current Implementation | Present? | Verified? | Evidence |
|-------|----------------------|----------|-----------|----------|
| Role-based permission (WhatsApp auto-update) | ❌ NOT CHECKED | ❌ | ❌ | `applyProgressUpdate()` passes `userId` to EWS but no permission check before calling EWS |
| EWS internal authorization | ✅ EWS validates action permissions internally | ✅ | ✅ | [`ExecutionWriteService`](file:///c:/DEV/STO/src/core/execution/ExecutionWriteService.ts) validates action applicability |
| `guardApi` on WhatsApp management routes | ✅ `guardApi('workpacks.edit')` for approve/reject | ✅ | ✅ | [`approve/route.ts`](file:///c:/DEV/STO/app/api/whatsapp/updates/%5BupdateId%5D/approve/route.ts), [`reject/route.ts`](file:///c:/DEV/STO/app/api/whatsapp/updates/%5BupdateId%5D/reject/route.ts) |
| Action-level confirmation for destructive ops | ❌ NOT IMPLEMENTED | ❌ | ❌ | `progress >= 100` auto-applies COMPLETE without confirmation |
| Event-level authorization | ❌ NOT IMPLEMENTED | ❌ | ❌ | No event context in WhatsApp pipeline |

**Layer 3 Verdict: 🟡 PARTIAL** — EWS provides internal guardrails (prerequisite checks, hold-point blocks), but no explicit WhatsApp-layer authorization occurs before calling EWS.

---

## 2. Complete Security Layer Matrix

| Security Layer | Current Mechanism | Present? | Verified? | Gap |
|----------------|------------------|----------|-----------|-----|
| Meta webhook authenticity | ❌ NONE | ❌ | ❌ | **P0** — No `X-Hub-Signature-256` verification |
| User identity | Phone → User lookup | ✅ | ✅ | `whatsapp_verified` and `whatsapp_opt_in` not enforced |
| Tenant identity | User → `organization_id` | ✅ | ✅ | ✅ SAFE — all queries scoped to org |
| Event identity | ❌ NONE | ❌ | ❌ | **P1** — No event context in WhatsApp pipeline |
| Permission | ❌ NONE (WhatsApp auto-update) | ❌ | ❌ | **P1** — No permission check before EWS call |
| Action authorization | EWS internal validation | ⚠️ | ✅ | EWS validates action applicability but does not check WhatsApp-specific permissions |
| Confirmation for destructive actions | ❌ NONE | ❌ | ❌ | **P1** — COMPLETE auto-applies without confirmation |

---

## 3. Recommended M16 Security Architecture

```
Meta Webhook POST
         ↓
┌────────────────────────────┐
│ 1. SIGNATURE VERIFICATION  │ ← X-Hub-Signature-256 vs APP_SECRET
│    Reject if invalid       │
└─────────────┬──────────────┘
              ↓
┌────────────────────────────┐
│ 2. MESSAGE DEDUP           │ ← meta_message_id check (ALREADY EXISTS ✅)
│    Skip if duplicate       │
└─────────────┬──────────────┘
              ↓
┌────────────────────────────┐
│ 3. USER IDENTITY           │ ← Phone → User lookup (ALREADY EXISTS ✅)
│    + whatsapp_verified     │ ← CHECK FLAG (NEW)
│    + whatsapp_opt_in       │ ← CHECK FLAG (NEW)
│    Reject if unregistered  │
└─────────────┬──────────────┘
              ↓
┌────────────────────────────┐
│ 4. ORGANIZATION CONTEXT    │ ← User → organization_id (ALREADY EXISTS ✅)
└─────────────┬──────────────┘
              ↓
┌────────────────────────────┐
│ 5. EVENT CONTEXT           │ ← Determine active event (NEW)
│    If ambiguous → ask user │
│    If none → reject        │
└─────────────┬──────────────┘
              ↓
┌────────────────────────────┐
│ 6. INTENT CLASSIFICATION   │ ← M16 Intent Engine (NEW)
│    Classify: query/command │
└─────────────┬──────────────┘
              ↓
┌────────────────────────────┐
│ 7. ENTITY RESOLUTION       │ ← M16 Entity Resolver (NEW)
│    DimensionRegistry for   │    controlled values
│    Domain queries for      │    entities (event-scoped)
└─────────────┬──────────────┘
              ↓
┌────────────────────────────┐
│ 8. AUTHORIZATION           │ ← Permission check (NEW)
│    Role + action based     │
└─────────────┬──────────────┘
              ↓
┌────────────────────────────┐
│ 9. CONFIRMATION GATE       │ ← For HIGH-RISK/DESTRUCTIVE (NEW)
│    "Are you sure?" → wait  │
└─────────────┬──────────────┘
              ↓
┌────────────────────────────┐
│ 10. EXECUTE                │ ← Domain Service / EWS (ALREADY EXISTS ✅)
└─────────────┬──────────────┘
              ↓
┌────────────────────────────┐
│ 11. AUDIT LOG              │ ← m16_interaction_logs (NEW)
└────────────────────────────┘
```

### Implementation Priority

| Step | Status | Priority | When |
|------|--------|----------|------|
| 1. Signature verification | ❌ NEW | **P0** | Before M16-R1 coding |
| 2. Message dedup | ✅ EXISTS | — | Already done |
| 3. User identity + flag enforcement | ⚠️ EXTEND | P1 | M16-R1 |
| 4. Organization context | ✅ EXISTS | — | Already done |
| 5. Event context | ❌ NEW | P1 | M16-R1 |
| 6. Intent classification | ❌ NEW | P1 | M16-R1 |
| 7. Entity resolution | ⚠️ REPLACE | P1 | M16-R1 |
| 8. Authorization | ❌ NEW | P1 | M16-R1 |
| 9. Confirmation gate | ❌ NEW | P1 | M16-R3 (WhatsApp) |
| 10. Execute via EWS | ✅ EXISTS | — | Already done |
| 11. Audit log | ❌ NEW | P1 | M16-R1 |

---

## 4. Event Context Architecture

### Current Event-Selection Behavior

| Context | Current Source | Explicit? | Persistent? | Safe? |
|---------|---------------|-----------|-------------|-------|
| User | Phone → `prisma.user.findFirst` | ✅ Explicit | ✅ DB | ✅ |
| Organisation | `user.organization_id` | ✅ Explicit | ✅ DB | ✅ |
| Event | ❌ NOT DETERMINED | ❌ | ❌ | **❌ UNSAFE** |
| Conversation | WhatsApp session (10min) | ⚠️ Session-level | ⚠️ 10min | ⚠️ |
| WhatsApp session | `whatsapp_sessions.phone_number` | ✅ Phone-keyed | ⚠️ 10min | ✅ |
| Equipment | `asset.findFirst` (org-scoped) | ✅ Tag match | N/A | ✅ within-org |

### Multi-Event Scenario Analysis

Given: User belongs to Organisation with events:
- TA-2027 (event_id: `e1`)
- TA-2028 (event_id: `e2`)
- Shutdown-2029 (event_id: `e3`)

**User asks: "What's the status of HX-204?"**

| Step | Current Behavior | Issue |
|------|-----------------|-------|
| 1. Lookup asset HX-204 | `asset.findFirst({ org_id, tag_number: 'HX-204' })` | ✅ Finds the ONE equipment record (assets are not event-specific) |
| 2. Find workpacks | `workpack.findMany({ org_id, asset_id })` — **NO event_id filter** | ❌ Returns workpacks from TA-2027 AND TA-2028 AND Shutdown-2029 |
| 3. Return status | Returns first workpack found | ❌ Could be from ANY event |

**Consequence:** A user working on TA-2028 could receive status from TA-2027's workpack for the same equipment.

### Recommended Event Resolution Rule

```
Phone
  ↓
Verified User
  ↓
Organisation
  ↓
Active Event Context
  ↓
Entity Resolution (event-scoped)
```

Event context should be determined by:

1. **Session state** — if a conversation session has `event_id`, use it
2. **User preference** — if user has `active_event_id`, use it
3. **Single active event** — if org has exactly one active event, use it
4. **Multiple active events** — ASK the user to select

**If there is no unambiguous event: M16 must ask the user to select the event rather than guess.**

### Classification: **P1** — Must be resolved in M16-R1

Not P0 because:
- Most current deployments are single-event organizations
- The system is tenant-safe (no cross-org leakage)
- Incorrect event resolution within same org is a correctness issue, not a security breach

Is P1 because:
- Multi-event orgs exist and will grow
- Wrong-event resolution silently corrupts data

---

## 5. Action Risk & Confirmation Model

### Risk Classification

| Action | Risk Level | Authorization | Confirmation Required? | Recommended Channel Behavior |
|--------|-----------|--------------|----------------------|------------------------------|
| **READ** (query status, schedule, constraints) | NONE | Read permission | Never | All channels: immediate response |
| **START** | HIGH-RISK WRITE | `workpacks.edit` | ✅ Explicit "Are you sure?" | Web: button click; WhatsApp: "Reply YES to start" |
| **UPDATE_PROGRESS** | LOW-RISK WRITE | `workpacks.edit` | ❌ No confirmation (current behavior is acceptable at ≥90% confidence) | Web: slider; WhatsApp: auto-apply at ≥90% confidence |
| **HOLD** | HIGH-RISK WRITE | `workpacks.edit` | ✅ Require reason text | Web: dialog with reason; WhatsApp: "Why? Send reason to confirm" |
| **RESUME** | HIGH-RISK WRITE | `workpacks.edit` | ✅ "Reply YES to resume HX-204" | Web: button; WhatsApp: confirmation prompt |
| **REPORT_DELAY** | LOW-RISK WRITE | `workpacks.edit` | ❌ But require reason and hours | Web: form; WhatsApp: structured "hours: X, reason: Y" |
| **COMPLETE** | GOVERNANCE / DESTRUCTIVE | `workpacks.edit` | ✅✅ MANDATORY — "Are you sure? This marks HX-204 bundle pullout as 100% complete. Reply YES to confirm." | All channels: explicit confirmation |
| **VERIFY** | GOVERNANCE / DESTRUCTIVE | QA permission | ✅✅ MANDATORY | Web: sign-off dialog; WhatsApp: confirmation + QA role check |
| **CLOSE** | GOVERNANCE / DESTRUCTIVE | Supervisor permission | ✅✅ MANDATORY | Web: approval workflow; WhatsApp: confirmation + role check |
| **RELEASE** | GOVERNANCE / DESTRUCTIVE | Supervisor permission | ✅✅ MANDATORY | Web: approval workflow; WhatsApp: confirmation + role check |
| **Schedule change** | GOVERNANCE / DESTRUCTIVE | Schedule editor permission | ✅✅ MANDATORY — must be web-only | ❌ NOT via WhatsApp/Voice |

### Confirmation Mechanism by Channel

| Channel | Confirmation Method | Timeout |
|---------|-------------------|---------|
| Web | Modal dialog with explicit button | None (user controls) |
| WhatsApp | "Reply YES to confirm" → session state `awaiting_confirmation` | 5 minutes |
| Voice | "Say YES to confirm" → STT check | 30 seconds |
| Mobile | Modal dialog | None |

### Important: NOT every action needs OTP

OTP/PIN is **not recommended** for any action because:
1. It adds friction that will reduce field worker adoption
2. The phone number is already a reasonably strong identity signal for field updates
3. EWS provides internal safety nets (prerequisite checks, hold-point blocks)

The minimum safe mechanism is:
- **Low-risk**: No confirmation (current behavior)
- **High-risk**: Text confirmation ("Reply YES")
- **Governance/Destructive**: Text confirmation + role verification via EWS

---

## 6. Conversation Context & Cross-Leakage Audit

### Context Isolation Matrix

| Context Type | Isolation Mechanism | Leak Risk: User→User | Leak Risk: Tenant→Tenant | Leak Risk: Event→Event |
|-------------|--------------------|-----------------------|--------------------------|------------------------|
| WhatsApp session | `phone_number` (unique) | ❌ NONE — sessions keyed by phone | ❌ NONE — org_id on session | ✅ YES — no event_id on session |
| WhatsApp update records | `user_id`, `organization_id` | ❌ NONE | ❌ NONE | ✅ YES — no event_id |
| AI chat `chatHistory` | Client-side React state | ❌ NONE — per-browser-tab | ❌ NONE — session-bound | ❌ NONE — project-scoped |
| AI chat system prompt | Rebuilt per request | ❌ NONE | ❌ NONE | ❌ NONE — project-scoped |

### Scenario Tests

**Scenario 1:** User A asks about TA-2027, then asks "What's HX-204 status?"
- **Current:** Session has no event context. Query returns first matching workpack across all events.
- **Risk:** MEDIUM — may return wrong event's data

**Scenario 2:** User switches to TA-2028, then asks "What's HX-204 status?"
- **Current:** No mechanism to "switch" events via WhatsApp
- **Risk:** HIGH — same as Scenario 1, no way to indicate event change

**Scenario 3:** Two tenants have the same equipment tag
- **Current:** `organization_id` filter prevents cross-tenant leakage
- **Risk:** NONE — ✅ SAFE

---

## 7. AI Tool/Function Calling Architecture

### Current State: NO tool/function calling exists

**Evidence:** Searched entire `src/` for `tools:`, `function_call`, `tool_choice`, `functions:` — zero results related to AI tool calling.

All AI interactions use unstructured text prompts → text/JSON responses:

| AI Interaction | Input | Output | Method |
|---------------|-------|--------|--------|
| Field extraction | Raw message text | JSON with 4 fields | `fetch('openai.com/v1/chat/completions')` with `max_tokens: 512` |
| AI chat | System prompt + user question | SSE text stream | `generateSyorityAI()` |
| Workpack generation | Workpack context | JSON with activities/materials | `callSyorityAI()` |
| Shift report | Activity data | Narrative text | `callSyorityAI()` |
| Vision/document | Image + prompt | JSON extraction | Provider-specific vision API |

### Recommended Future Architecture

```
User question: "What's the progress of HX-204?"
         ↓
M16 AI Assistant (with tool definitions)
         ↓
Tool call: query_entity_status({ tag: "HX-204", event_id: ctx.event_id })
         ↓
M16 Entity Resolver → event-scoped asset lookup
         ↓
M8.13 ProgressAggregationService (authoritative)
         ↓
Structured response → formatted for channel
```

**Tools would call domain services, NOT Prisma directly.**

---

## 8. WhatsApp Command Safety Scenarios

### Scenario A: "What's progress of HX-204?"

| Step | Current Behavior | Safe? |
|------|-----------------|-------|
| Intent detected? | ✅ `query` | ✅ |
| Entity resolved? | ✅ `asset.findFirst({ tag_number })` | ✅ tenant-scoped |
| Ambiguous? | ⚠️ No event filter — may return wrong event's workpack | ❌ Event-unsafe |
| Authorization? | ❌ None required for query | ✅ (read-only) |
| Confirmation? | ❌ Not needed | ✅ |
| Domain service? | ❌ Direct Prisma query | ⚠️ Not authoritative |
| Audit? | ✅ `whatsapp_updates` record | ✅ |
| Event? | ❌ NOT SCOPED | ❌ |

### Scenario B: "HX-204 bundle pullout is 60% complete."

| Step | Current Behavior | Safe? |
|------|-----------------|-------|
| Intent detected? | ✅ `update` | ✅ |
| Entity resolved? | ✅ Tag → asset → workpack → activity | ⚠️ Event-unsafe |
| Ambiguous? | ⚠️ Depends on activity matching score | ⚠️ |
| Authorization? | ❌ No permission check before EWS | ⚠️ |
| Confirmation? | ❌ None (auto-applies at ≥90% confidence) | ✅ Acceptable for progress update |
| Domain service? | ✅ ExecutionWriteService | ✅ |
| Audit? | ✅ `whatsapp_updates` + `progress_logs` via EWS | ✅ |
| Event? | ❌ NOT SCOPED | ❌ |

### Scenario C: "Start HX-204 bundle pullout."

| Step | Current Behavior | Safe? |
|------|-----------------|-------|
| Intent detected? | ❌ `unknown` (START not in taxonomy) | ❌ |
| Entity resolved? | ❌ Pipeline stops at unrecognized intent | ❌ |
| Ambiguous? | N/A | N/A |
| Authorization? | N/A | N/A |
| Confirmation? | N/A | N/A |
| Domain service? | N/A | N/A |
| Audit? | ⚠️ Recorded as unrecognized | ✅ |
| Event? | N/A | N/A |

### Scenario D: "Complete HX-204."

| Step | Current Behavior | Safe? |
|------|-----------------|-------|
| Intent detected? | ⚠️ `update` (progress_percent = 100 extracted by GPT) | ⚠️ |
| Entity resolved? | ✅ Same as B | ⚠️ Event-unsafe |
| Ambiguous? | ⚠️ Same activity matching | ⚠️ |
| Authorization? | ❌ No permission check | ⚠️ |
| Confirmation? | ❌ **NONE — auto-applies COMPLETE at ≥90% confidence** | **❌ UNSAFE** |
| Domain service? | ✅ EWS with action `COMPLETE` | ✅ |
| Audit? | ✅ Full audit via EWS | ✅ |
| Event? | ❌ NOT SCOPED | ❌ |

### Scenario E: "Start bundle pullout." (no equipment tag)

| Step | Current Behavior | Safe? |
|------|-----------------|-------|
| Intent detected? | ❌ `unknown` or `update` with no tag | ❌ |
| Entity resolved? | ❌ `equipment_tag` is null → DbMatcher returns empty | ✅ Safely rejected |
| Confirmation? | N/A | N/A |
| **Result** | `tag_not_found` reply | ✅ Safe failure |

### Scenario F: "Complete the exchanger." (ambiguous tag)

| Step | Current Behavior | Safe? |
|------|-----------------|-------|
| Intent detected? | ⚠️ `update` with progress=100 | ⚠️ |
| Entity resolved? | ❌ GPT may extract `equipment_tag: "exchanger"` → no exact tag match → `tag_not_found` | ✅ Safely rejected |
| **Result** | "Equipment tag not found" | ✅ Safe failure |

### Scenario G: "Change the schedule for HX-204."

| Step | Current Behavior | Safe? |
|------|-----------------|-------|
| Intent detected? | ❌ `unknown` (schedule change not in taxonomy) | ✅ |
| **Result** | "Could not understand" reply | ✅ Safely rejected |
