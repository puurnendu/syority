# M16-R0.1 — Forensic Reconciliation

**Date:** 2026-09-07  
**Status:** FORENSIC RECONCILIATION — no code modified  
**Prior State:** M16-R0 = AMBER

---

## Reconciliation Summary

This document synthesizes the findings from four targeted reconciliation exercises:

1. [`M16_R0_1_ENTITY_RESOLUTION_AUDIT.md`](file:///c:/DEV/STO/docs/M16_R0_1_ENTITY_RESOLUTION_AUDIT.md) — Entity resolution deep dive
2. [`M16_R0_1_SECURITY_ARCHITECTURE.md`](file:///c:/DEV/STO/docs/M16_R0_1_SECURITY_ARCHITECTURE.md) — Three-layer security model, event context, action risk, scenarios
3. [`M16_R0_1_AUTHORITY_PROOF.md`](file:///c:/DEV/STO/docs/M16_R0_1_AUTHORITY_PROOF.md) — Prisma mutation proof, calculation audit
4. [`M16_R0_1_RELEASE_GATE.md`](file:///c:/DEV/STO/docs/M16_R0_1_RELEASE_GATE.md) — Release gate verdict

---

## Area A: Entity Resolution — DimensionRegistry Reconciliation

### Findings

- **16 entity types audited.** Only 3 are resolved (Equipment, Unit, Activity). 13 are NOT extracted or resolved.
- **No entity resolution uses DimensionRegistry or ControlledValueResolver.** All resolution uses raw string matching via `DbMatcher.ts`.
- **Workpack lookup is EVENT-UNSAFE** — queries `workpack.findMany({ asset_id })` without `event_id` filter. In multi-event orgs, can return workpacks from the wrong event.
- **Activity matching uses word overlap scoring** — `jdWords.filter(w => ad.includes(w))` — fragile and not connected to standard activity codes.

### Conclusions

| Resolver | Status |
|----------|--------|
| Equipment tag exact match (tenant-scoped) | ✅ SAFE within single-event |
| Unit substring match | ⚠️ SAFE but fragile |
| Workpack asset-linked lookup | ❌ UNSAFE — no event filter |
| Activity word overlap | ❌ UNSAFE — fragile, no event filter |
| All others (13 entities) | ❌ NOT RESOLVED |

**DimensionRegistry cannot be the single resolver.** It handles classification dimensions (discipline, equipment type, UDFs), not domain entity chains (equipment → workpack → activity). M16 needs BOTH:
1. `DimensionRegistry` / `ControlledValueResolver` for controlled values
2. A new `M16EntityResolver` for domain entity chains (event-scoped)

**No current schema/API limitation prevents this** — the schema already has `event_id` on `Workpack`. The limitation is purely in the query code (no `event_id` filter).

**Classification: P1 for M16-R1.**

---

## Area B: WhatsApp Webhook Security — Three-Layer Model

### Findings

| Layer | Status | Critical Finding |
|-------|--------|-----------------|
| **Layer 1 — Transport Authenticity** | ❌ BROKEN | Zero occurrences of `X-Hub-Signature-256` verification in entire codebase. POST handler accepts ANY body. |
| **Layer 2 — Application Identity** | 🟡 PARTIAL | Phone→User lookup works. `whatsapp_verified` and `whatsapp_opt_in` flags exist in schema but are NOT enforced in `MessageProcessor`. |
| **Layer 3 — Authorization** | 🟡 PARTIAL | EWS provides internal action validation, but no explicit permission check occurs before EWS call in WhatsApp pipeline. |

### Recommended Architecture Defined

11-step pipeline: Signature → Dedup → Identity → Organization → Event → Intent → Entity Resolution → Authorization → Confirmation → Execute → Audit.

See [`M16_R0_1_SECURITY_ARCHITECTURE.md`](file:///c:/DEV/STO/docs/M16_R0_1_SECURITY_ARCHITECTURE.md) §3 for full diagram.

---

## Area C: Event Context

### Findings

- **No `event_id` anywhere in WhatsApp code** — confirmed by grep search returning zero results
- **User model has no `active_event_id`** — cannot determine which event a WhatsApp user is working on
- **`whatsapp_sessions` lacks `event_id`** — conversation context cannot be event-scoped
- **`whatsapp_updates` lacks `event_id`** — historical records cannot be event-attributed
- **Workpack model HAS `event_id`** (schema L99) — the field exists but is never filtered

### Multi-Event Collision Demonstrated

User in org with events TA-2027 + TA-2028 + Shutdown-2029:
- "What's the status of HX-204?" → returns first workpack from ANY event
- "HX-204 bundle pullout 50%" → could update the wrong event's activity

### Recommended Rule

If org has one active event → use it automatically.  
If org has multiple active events → ASK user to select event.  
Never guess.

**Classification: P1.**

---

## Area D: AI → Prisma / Domain Authority Proof

### Hard Evidence

| Search | WhatsApp Services | AI Services | AI Lib |
|--------|-------------------|-------------|--------|
| `prisma.activity.update` | **ZERO** | **ZERO** | **ZERO** |
| `prisma.activity.create` | **ZERO** | **ZERO** | **ZERO** |
| `prisma.activity.delete` | **ZERO** | **ZERO** | **ZERO** |
| `prisma.workpack.update` | **ZERO** | **ZERO** | **ONE** (metadata flag only) |
| `prisma.progress.*` | **ZERO** | **ZERO** | **ZERO** |
| `prisma.$executeRaw` | **ZERO** | **ZERO** | **ZERO** |

**ALL execution mutations route through ExecutionWriteService. ✅**

The one `prisma.workpack.update` in `workpackAutoFill.ts` L324 only sets `ai_auto_filled: true` — a metadata flag, not business data.

---

## Area E: Authoritative Calculation Proof

### 14 Calculations Audited

| Classification | Count | Status |
|---------------|-------|--------|
| AUTHORITATIVE | 3 | ✅ `calculateProgressMetrics()`, DB counts |
| AUTHORITATIVE READ | 3 | ✅ Reads stored `overall_progress`, `progress_percent` |
| PRESENTATION | 5 | ✅ Status counts, date comparisons for display |
| ADAPTER | 2 | ✅ Confidence scoring for routing |
| UNAUTHORIZED | 1 | ❌ `ta-dashboard.tsx` hardcoded SPI/CPI/progress |
| FALSE POSITIVE | 0 | — |

**No unauthorized progress calculation, EVM, CPM, float, readiness, or forecast calculation found in AI/WhatsApp/Voice production code.**

The ONLY violation is `ta-dashboard.tsx` L80 which contains hardcoded demo metrics. This is a demo component, not the production AI chat.

---

## Area F: Action Risk & Confirmation Model

### Defined (Not Implemented)

| Action | Risk Level | Confirmation | Channel Behavior |
|--------|-----------|-------------|-----------------|
| READ | NONE | Never | All: immediate |
| UPDATE_PROGRESS | LOW-RISK | No (current behavior acceptable) | Auto at ≥90% confidence |
| REPORT_DELAY | LOW-RISK | No, but require reason | Structured input |
| START | HIGH-RISK | "Reply YES" | WhatsApp: confirmation prompt |
| HOLD | HIGH-RISK | Require reason | WhatsApp: "Why?" |
| RESUME | HIGH-RISK | "Reply YES" | WhatsApp: confirmation prompt |
| COMPLETE | GOVERNANCE | ✅✅ MANDATORY | All: explicit confirmation |
| VERIFY | GOVERNANCE | ✅✅ MANDATORY | Web-preferred, QA role check |
| CLOSE | GOVERNANCE | ✅✅ MANDATORY | Web-only recommended |
| RELEASE | GOVERNANCE | ✅✅ MANDATORY | Web-only recommended |
| Schedule change | GOVERNANCE | ✅✅ MANDATORY | Web-only, NOT via WhatsApp |

**OTP/PIN is NOT recommended** — adds friction, reduces adoption. Minimum safe mechanism is text confirmation for destructive actions.

---

## Area G: Conversation Context & Cross-Leakage

### Leakage Risk Matrix

| Scenario | User→User | Tenant→Tenant | Event→Event |
|----------|-----------|---------------|-------------|
| WhatsApp session | ❌ NONE (phone-keyed) | ❌ NONE (org_id) | ✅ YES (no event_id) |
| AI chat | ❌ NONE (tab-scoped) | ❌ NONE (session-bound) | ❌ NONE (project-scoped) |
| WhatsApp updates | ❌ NONE (user_id) | ❌ NONE (org_id) | ✅ YES (no event_id) |

**Cross-tenant leakage: NONE.**  
**Cross-event leakage: YES — in WhatsApp pipeline.**

---

## Area H: AI Tool/Function Calling

**NO tool/function calling exists.** Searched for `tools:`, `function_call`, `tool_choice` — zero results.

All AI interactions are unstructured text → text/JSON. No AI tool can call domain services, Prisma, or APIs.

---

## Area I: WhatsApp Command Safety Scenarios

| Scenario | Intent | Entity | Auth | Confirm | EWS | Event | Safe? |
|----------|--------|--------|------|---------|-----|-------|-------|
| A: "What's progress of HX-204?" | ✅ query | ✅ tag match | ❌ none | N/A | N/A | ❌ | ⚠️ Wrong event possible |
| B: "HX-204 bundle pullout is 60%" | ✅ update | ✅ tag→wp→activity | ❌ none | ❌ none | ✅ | ❌ | ⚠️ Wrong event possible |
| C: "Start HX-204 bundle pullout" | ❌ unknown | ❌ stops | N/A | N/A | N/A | N/A | ✅ Safe failure |
| D: "Complete HX-204" | ⚠️ update (100%) | ✅ tag match | ❌ none | **❌ NONE** | ✅ | ❌ | **❌ Auto-completes** |
| E: "Start bundle pullout" (no tag) | ❌ rejected | ❌ no tag | N/A | N/A | N/A | N/A | ✅ Safe failure |
| F: "Complete the exchanger" | ⚠️ rejected | ❌ no tag match | N/A | N/A | N/A | N/A | ✅ Safe failure |
| G: "Change the schedule for HX-204" | ❌ unknown | N/A | N/A | N/A | N/A | N/A | ✅ Safe failure |

**Key finding:** Unrecognized intents (C, E, F, G) fail safely. Scenario D is unsafe — COMPLETE auto-applies without confirmation.

---

## 10. Revised M16 Architecture

### Current vs Target

```
CURRENT                                TARGET
─────────────────────────              ─────────────────────────
WhatsApp POST (no auth)                WhatsApp POST
     ↓                                      ↓
Dedup                                  Signature Verification ←── NEW
     ↓                                      ↓
Phone → User                           Dedup
     ↓                                      ↓
FieldExtractor (GPT)                   Phone → User + Verified + OptIn ←── ENHANCED
     ↓                                      ↓
DbMatcher (string)                     Event Context ←── NEW
     ↓                                      ↓
[≥0.90] → EWS                         M16 Intent Engine ←── NEW
[<0.90] → park                              ↓
                                       M16 Entity Resolver ←── NEW
                                       (DimensionRegistry + domain queries)
                                            ↓
                                       Authorization ←── NEW
                                            ↓
                                       Confirmation Gate ←── NEW
                                            ↓
                                       Domain Service / EWS
                                            ↓
                                       Audit Log ←── NEW
                                            ↓
                                       EventBus notification
```

### Gap Inventory

| Target Component | Current Implementation | Gap Type | When to Address |
|-----------------|----------------------|----------|-----------------|
| Signature verification | ❌ NONE | NEW capability | M16-R1 |
| Verified/OptIn enforcement | Schema fields exist, NOT checked | FIX | M16-R1 |
| Event context | ❌ NONE | NEW capability | M16-R1 |
| Intent Engine | FieldExtractor (3 intents) | REPLACE/EXTEND | M16-R1 |
| Entity Resolver | DbMatcher (string match) | REPLACE | M16-R1 |
| DimensionRegistry integration | ❌ NONE | NEW integration | M16-R1 |
| Authorization | ❌ NONE (WhatsApp pipeline) | NEW capability | M16-R1 |
| Confirmation Gate | ❌ NONE | NEW capability | M16-R3 |
| AI function calling | ❌ NONE | NEW capability | M16-R2 |
| Conversation memory | Client-side only (AI chat) | NEW capability | M16-R2 |
| Audit logging | ❌ NONE (AI chat) | NEW capability | M16-R1 |
| M14 report delivery | Stub only | WIRE | M16-R4 |

---

## 11. Revised Release Sequence

Based on reconciliation evidence, the R0 sequence is confirmed with one structural change: **R3 and R4 swap scope**. WhatsApp already works — it needs hardening (R3), not creation. AI is minimal — it needs a core upgrade (R2) before governed actions (R3 → R4).

### Confirmed Sequence

| Release | Scope | Rationale |
|---------|-------|-----------|
| **M16-R1** | **Secure Interaction Foundation** | Webhook authenticity, identity enforcement, event context, DimensionRegistry entity resolution, intent model, authorization boundary, interaction audit, action-risk framework. This is the security + architecture layer that ALL subsequent releases depend on. |
| **M16-R2** | **AI Assistant Core** | Web AI with function calling, authoritative Q&A tools, entity-aware queries, structured tool-calling responses, conversation memory, audit logging. Builds on R1's Intent Engine and Entity Resolver. |
| **M16-R3** | **Governed AI Actions** | START, UPDATE_PROGRESS, HOLD, RESUME, REPORT_DELAY, COMPLETE, RELEASE, VERIFY, CLOSE — all through M12 EWS where applicable. Builds on R1 authorization + R2 AI tools. |
| **M16-R4** | **WhatsApp Operations Hardening** | Hardened webhook with R1 foundation, natural language queries through Intent Engine, progress updates through Entity Resolver, execution actions through R3 governed paths, confirmation gate for destructive actions, report delivery via M14. |
| **M16-R5** | **Voice & Mobile** | Browser STT, TTS response, voice queries/commands, mobile deep links — all through the same M16 Intent/Action Engine. |
| **M16-R6** | **Hardening & Closure** | Security audit, tenant/event isolation proof, idempotency, prompt injection protection, regression suite, channel acceptance, performance, final forensic closure. |

### Why This Sequence (Not R0's Proposed)

The R0 audit proposed "WhatsApp Hardening" as R3 and "Governed AI Actions + M14 Integration" as R4. After reconciliation:

1. **Governed Actions (R3) must precede WhatsApp Hardening (R4)** because WhatsApp needs the governed action framework to implement confirmation gates and expanded command support
2. **AI Core (R2) must precede Governed Actions (R3)** because the AI assistant needs function calling tools before it can execute governed actions
3. **R1 foundation must be comprehensive** — it establishes the security, identity, event context, and entity resolution that every subsequent release depends on
