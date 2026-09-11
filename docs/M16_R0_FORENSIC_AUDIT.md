# M16-R0 — AI / WhatsApp / Voice Forensic Audit

**Date:** 2026-09-07  
**Auditor:** Principal Software Architect  
**Scope:** Repository-wide forensic discovery of AI, WhatsApp, Voice interaction architecture  
**Status:** DISCOVERY ONLY — no code modifications made

---

## 1. Executive Summary

The STO platform has a **functional WhatsApp execution channel** and a **basic web AI chat** capability. Voice exists only as **WhatsApp voice note transcription** (Whisper STT). There is no standalone voice interaction system. The platform has no structured function/tool calling, no intent engine, no RAG, no embeddings, and no conversation memory beyond a 10-minute WhatsApp session.

### Critical Findings

| Severity | Count | Summary |
|----------|-------|---------|
| P0 | 1 | WhatsApp webhook has NO authentication — any POST to `/api/webhooks/whatsapp` is accepted |
| P1 | 7 | Missing authorization on WhatsApp execution, no confirmation for high-impact actions, AI assistant uses hardcoded demo context, QueryHandler queries DB directly bypassing authoritative services, no idempotency beyond message dedup, entity resolution uses string matching not DimensionRegistry, no audit trail for AI chat |
| P2 | 5 | WhatsApp report delivery is stub, conversation state limited to 10min, shift report queries DB directly, no EventBus integration for WhatsApp events, no M14 integration for report delivery |
| P3 | 4 | No advanced personalization, no multi-turn context for AI chat, no voice beyond STT, limited intent taxonomy |

---

## 2. AI Architecture Audit

### 2.1 AI Services Inventory

| File | Purpose | Provider | Status |
|------|---------|----------|--------|
| [`ProviderLoader.ts`](file:///c:/DEV/STO/src/services/ai/ProviderLoader.ts) | Central AI provider config loader | OpenAI / Gemini / Vertex | ✅ WORKING |
| [`AiPromptService.ts`](file:///c:/DEV/STO/src/services/ai/AiPromptService.ts) | Prompt template CRUD + defaults | N/A | ✅ WORKING |
| [`AiLoggingService.ts`](file:///c:/DEV/STO/src/services/ai/AiLoggingService.ts) | AI request logging | N/A | ✅ WORKING |
| [`AiWorkpackGenerator.ts`](file:///c:/DEV/STO/src/services/ai/AiWorkpackGenerator.ts) | AI workpack generation | OpenAI / Gemini / Vertex | ✅ WORKING |
| [`VisionAiService.ts`](file:///c:/DEV/STO/src/services/ai/VisionAiService.ts) | Image/document analysis | OpenAI / Gemini / Vertex | ✅ WORKING |
| [`DocumentParameterExtractor.ts`](file:///c:/DEV/STO/src/services/ai/DocumentParameterExtractor.ts) | Engineering doc parameter extraction | OpenAI / Gemini / Vertex | ✅ WORKING |
| [`PAndIdExtractor.ts`](file:///c:/DEV/STO/src/services/ai/PAndIdExtractor.ts) | P&ID diagram extraction | OpenAI / Gemini / Vertex | ✅ WORKING |
| [`LessonsSuggester.ts`](file:///c:/DEV/STO/src/services/ai/LessonsSuggester.ts) | Lessons learned suggestion | OpenAI / Gemini / Vertex | ✅ WORKING |
| [`PdfProcessor.ts`](file:///c:/DEV/STO/src/services/ai/PdfProcessor.ts) | PDF text extraction | N/A | ✅ WORKING |
| [`universalAiClient.ts`](file:///c:/DEV/STO/src/lib/ai/universalAiClient.ts) | Unified AI routing client | OpenAI / Gemini / Vertex | ✅ WORKING |

### 2.2 AI Job Types

Registered in `ProviderLoader`:
- `workpack_generation`
- `document_vision`
- `whatsapp_extraction`
- `whatsapp_report`
- `lessons_suggestion`
- `whisper_transcription`

### 2.3 Web AI Chat

**Entry Point:** [`/api/projects/[id]/ai-assistant`](file:///c:/DEV/STO/app/api/projects/%5Bid%5D/ai-assistant/route.ts)  
**Component:** [`AIAssistantPanel.tsx`](file:///c:/DEV/STO/src/components/Dashboard/AIAssistantPanel.tsx) + inline chat in [`ta-dashboard.tsx`](file:///c:/DEV/STO/src/components/ta-dashboard.tsx)

**Architecture:**

```
User → AIAssistantPanel → POST /api/projects/[id]/ai-assistant
                                      ↓
                              guardApi('projects.view')
                                      ↓
                              assertTenantAccess
                                      ↓
                              Load project context from DB
                                      ↓
                              M8.13 calculateProgressMetrics() ← AUTHORITATIVE ✅
                                      ↓
                              Build system prompt with live metrics
                                      ↓
                              generateSyorityAI() → AI provider
                                      ↓
                              SSE stream response to client
```

**Findings:**

| # | Finding | Severity |
|---|---------|----------|
| AI-1 | **Project progress uses M8.13 `calculateProgressMetrics()`** — correctly uses authoritative duration-weighted progress | ✅ CORRECT |
| AI-2 | **`ta-dashboard.tsx` line 80 uses HARDCODED demo data** — `AI_CTX` contains hardcoded "Progress: Planned 68.2%, Actual 62.4%"`. This is a demo panel, not production AI | **P1** |
| AI-3 | **No function calling / tool use** — AI can only answer from the system prompt context. Cannot query live data or execute commands | Info |
| AI-4 | **No conversation memory** — `chatHistory` is passed from client state but only used in message body, not stored server-side | **P2** |
| AI-5 | **Rate limiting exists** — `checkRateLimit(identifier, 'ai')` is correctly applied | ✅ CORRECT |
| AI-6 | **Tenant guard exists** — `guardApi` + `assertTenantAccess` enforced | ✅ CORRECT |
| AI-7 | **No audit log for AI chat** — AI interactions are not logged to `aiLog` | **P1** |
| AI-8 | **AI cannot execute commands** — read-only query path, no mutation capability | ✅ CORRECT |

### 2.4 Prompt / Instruction Inventory

| File | Purpose | Mutation Capability | Security Risk |
|------|---------|---------------------|---------------|
| [`AiPromptService.ts`](file:///c:/DEV/STO/src/services/ai/AiPromptService.ts) L27-153 | 6 default prompts (workpack, doc extraction, lessons, whatsapp, report, vision) | None — all prompts produce JSON extraction or text summary | LOW |
| [`FieldExtractor.ts`](file:///c:/DEV/STO/src/services/whatsapp/FieldExtractor.ts) L37-41 | WhatsApp field extraction prompt | None — extracts 4 structured fields | LOW |
| [`ai-assistant/route.ts`](file:///c:/DEV/STO/app/api/projects/%5Bid%5D/ai-assistant/route.ts) L78-86 | System prompt for AI chat | None — read-only advisor | LOW |
| [`ta-dashboard.tsx`](file:///c:/DEV/STO/src/components/ta-dashboard.tsx) L80 | Hardcoded demo AI context | None — demo data only | **MEDIUM** (misleading data) |

**No prompts instruct AI to calculate business metrics, bypass authorization, or execute without confirmation.**

---

## 3. WhatsApp Architecture Audit

### 3.1 WhatsApp Service Files

| File | Purpose | Lines | Status |
|------|---------|-------|--------|
| [`MessageProcessor.ts`](file:///c:/DEV/STO/src/services/whatsapp/MessageProcessor.ts) | Core message processing pipeline | 521 | ✅ WORKING |
| [`FieldExtractor.ts`](file:///c:/DEV/STO/src/services/whatsapp/FieldExtractor.ts) | GPT-based entity extraction | 97 | ✅ WORKING |
| [`DbMatcher.ts`](file:///c:/DEV/STO/src/services/whatsapp/DbMatcher.ts) | Database entity matching | 173 | ✅ WORKING |
| [`ReplyBuilder.ts`](file:///c:/DEV/STO/src/services/whatsapp/ReplyBuilder.ts) | Multi-language reply templates | 92 | ✅ WORKING |
| [`MetaClient.ts`](file:///c:/DEV/STO/src/services/whatsapp/MetaClient.ts) | Meta WhatsApp API wrapper | 123 | ✅ WORKING |
| [`AudioProcessor.ts`](file:///c:/DEV/STO/src/services/whatsapp/AudioProcessor.ts) | Voice note download + Whisper STT | 102 | ✅ WORKING |
| [`QueryHandler.ts`](file:///c:/DEV/STO/src/services/whatsapp/QueryHandler.ts) | WhatsApp query responder | 175 | ⚠️ DIRECT DB |
| [`ShiftReportGenerator.ts`](file:///c:/DEV/STO/src/services/whatsapp/ShiftReportGenerator.ts) | AI shift report generation | 433 | ⚠️ DIRECT DB |

### 3.2 WhatsApp Message Flow

```
Meta Webhook
      ↓
POST /api/webhooks/whatsapp         ← NO AUTH (P0)
      ↓
processInboundMessage()
      ↓
Dedup check (meta_message_id)       ← Idempotent ✅
      ↓
User lookup (phone → user)          ← Tenant isolation ✅
      ↓
Session check (10min expiry)
      ↓
┌─ Audio? → processVoiceNote() → Whisper STT
│
├─ Query? → handleQuery() → DIRECT DB queries (P1)
│
└─ Update? → extractFields() → matchToDatabase()
                    ↓
             Confidence routing:
             ≥0.90 → applyProgressUpdate() → ExecutionWriteService ✅
             ≥0.75 → parked_review
             <0.75 → rejected
```

### 3.3 WhatsApp API Routes

| Route | Method | Auth | Permission | Read/Write | Service | Audit | Status |
|-------|--------|------|------------|------------|---------|-------|--------|
| `/api/webhooks/whatsapp` | GET | VERIFY_TOKEN | None | Read | Webhook verify | ❌ | ✅ |
| `/api/webhooks/whatsapp` | POST | **NONE** | **NONE** | Write | MessageProcessor | ❌ | **P0** |
| `/api/whatsapp/updates` | GET | guardApi | workpacks.view | Read | Direct Prisma | ❌ | ✅ |
| `/api/whatsapp/updates/[id]` | GET | guardApi | — | Read | Direct Prisma | ❌ | ✅ |
| `/api/whatsapp/updates/[id]/approve` | POST | guardApi | workpacks.edit | Write | ExecutionWriteService | ❌ | ⚠️ |
| `/api/whatsapp/updates/[id]/reject` | POST | guardApi | workpacks.edit | Write | Direct Prisma | ❌ | ⚠️ |
| `/api/whatsapp/audio/[id]` | — | — | — | Read | — | — | Unknown |
| `/api/whatsapp/test-message` | — | — | — | Write | — | — | Unknown |
| `/api/cron/shift-reports` | POST | CRON_SECRET | None | Write | ShiftReportGenerator | ❌ | ✅ |
| `/api/whatsapp-config` | — | — | — | Read/Write | — | — | Unknown |
| `/api/ai-config` | — | — | — | Read/Write | — | — | Unknown |

### 3.4 WhatsApp Mutation Paths — CRITICAL AUDIT

| Mutation | Path | Uses EWS? | Direct DB? | Finding |
|----------|------|-----------|------------|---------|
| Auto progress update (≥0.90 confidence) | `MessageProcessor.applyProgressUpdate()` | **✅ YES** | No | CORRECT |
| Session reply progress (awaiting_activity) | `MessageProcessor.handleSessionReply()` | **✅ YES** | No | CORRECT |
| Session reply progress (awaiting_unit) | `MessageProcessor.handleSessionReply()` | **✅ YES** | No | CORRECT |
| Planner approve | `/api/whatsapp/updates/[id]/approve` | **✅ YES** | No | CORRECT |
| Planner reject | `/api/whatsapp/updates/[id]/reject` | No (status only) | ✅ Status update | ACCEPTABLE |
| Language auto-detect update | `MessageProcessor.processSingleMessage()` L116-120 | N/A | ✅ `user.update` | ACCEPTABLE (user preference) |
| WhatsApp update record | All message processing | N/A | ✅ `whatsapp_updates.create` | ACCEPTABLE (logging) |
| Session upsert | `MessageProcessor.upsertSession()` | N/A | ✅ `whatsapp_sessions.upsert` | ACCEPTABLE (session) |
| Shift report record | `ShiftReportGenerator` | N/A | ✅ `shift_reports.create` | ACCEPTABLE (reporting) |

> **VERDICT: All execution mutations route through ExecutionWriteService. ✅**  
> Non-execution DB writes (session state, logging, user preference) are appropriately direct.

---

## 4. Voice Audit

### Classification: **PARTIAL** (WhatsApp STT only)

| Capability | Status | Implementation |
|------------|--------|----------------|
| STT (Speech-to-Text) | ✅ WORKING | OpenAI Whisper via [`AudioProcessor.ts`](file:///c:/DEV/STO/src/services/whatsapp/AudioProcessor.ts) |
| TTS (Text-to-Speech) | ❌ NONE | Not implemented |
| Web microphone input | ❌ NONE | Not implemented |
| Voice commands | ❌ NONE | Only via WhatsApp voice note → text → same pipeline |
| Voice response | ❌ NONE | Text replies only |
| Standalone voice API | ❌ NONE | No `/api/voice/*` routes |
| Audio storage | ✅ WORKING | `uploads/whatsapp/audio/{date}/{uuid}.ogg` |
| Transcript storage | ✅ WORKING | `uploads/whatsapp/audio/{date}/{uuid}.txt` |

Voice is exclusively a WhatsApp voice note transcription capability. The transcribed text is then processed through the identical WhatsApp message pipeline. There is no independent voice interaction system.

---

## 5. M12 Authority Reconciliation

### Execution Write Paths

| Source | Direct DB Write Count | EWS Write Count | Legacy Write Count |
|--------|----------------------|------------------|--------------------|
| WhatsApp auto-update | 0 | 1 (applyProgressUpdate) | 0 |
| WhatsApp session reply | 0 | 1 (applyProgressUpdate) | 0 |
| WhatsApp planner approve | 0 | 1 (ExecutionWriteService.applyAction) | 0 |
| AI Chat | 0 | 0 | 0 |
| Voice | N/A (→ WhatsApp pipeline) | — | — |

**ALL execution mutations → ExecutionWriteService. ✅**

The `ExecutionWriteService` header comment at line 7-8 explicitly documents the architecture:
```
Web / WhatsApp / Mobile / API → ExecutionWriteService.applyAction()
```

`source_channel: 'whatsapp'` is correctly tracked in all WhatsApp mutation calls.

---

## 6. M8.13 Progress Authority Audit

### WhatsApp Progress Handling

| Location | Pattern | Classification |
|----------|---------|---------------|
| `MessageProcessor.ts` L240-244 | `applyProgressUpdate(match.best_match, extracted.progress_percent)` | **ADAPTER** — passes user-reported progress to EWS |
| `MessageProcessor.ts` L167-169 | `finalConfidence = aiConfidence * 0.6 + dbConfidence * 0.4` | **ADAPTER** — routing confidence, not progress calculation |
| `QueryHandler.ts` L52-55 | `done = wp.activities.filter(a => a.status === 'completed').length` | **PRESENTATION** — activity count for display |
| `QueryHandler.ts` L55 | `const progress = wp.overall_progress ?? 0` | **AUTHORITATIVE READ** — reads stored progress |
| `ShiftReportGenerator.ts` L258-266 | Reading `progress_percent` from activities | **PRESENTATION** — reads stored values |
| `ai-assistant/route.ts` L74 | `calculateProgressMetrics(progressInput)` | **AUTHORITATIVE** — uses M8.13 service ✅ |

> **No unauthorized progress calculation found in AI/WhatsApp/Voice code. ✅**

---

## 7. M11 Schedule Authority Audit

No CPM calculation, float computation, or schedule modification found in any AI/WhatsApp/Voice code. The AI chat reads project context (activity count, critical count) but does not calculate or modify schedule values.

> **M11 authority preserved. ✅**

---

## 8. Dimension & Entity Resolution Audit

### Current Entity Resolution (WhatsApp)

| Step | Method | Finding |
|------|--------|---------|
| Field extraction | GPT-4o Mini JSON extraction | Returns free-text strings |
| Unit matching | [`DbMatcher.ts`](file:///c:/DEV/STO/src/services/whatsapp/DbMatcher.ts) L63-73 | **String `.includes()` matching** — not DimensionRegistry |
| Equipment matching | `DbMatcher.ts` L48-57 | **Prisma `equals` with `mode: 'insensitive'`** — direct DB query |
| Activity matching | `DbMatcher.ts` L125-131 | **Word overlap scoring** — not DimensionRegistry |
| Query target | [`QueryHandler.ts`](file:///c:/DEV/STO/src/services/whatsapp/QueryHandler.ts) L25-31 | **Prisma `equals`/`contains` with `mode: 'insensitive'`** — direct DB |

### P1 Findings

| # | Finding | Severity |
|---|---------|----------|
| DIM-1 | **WhatsApp entity resolution does NOT use DimensionRegistry** — uses raw string matching and direct Prisma queries | **P1** |
| DIM-2 | **Unit resolution uses `.includes()` substring matching** — `unitName.includes(uName)` — fragile, case-insensitive but no fuzzy matching | **P1** |
| DIM-3 | **Activity matching uses word overlap scoring** — not ControlledValueResolver | **P1** |
| DIM-4 | **No discipline/equipment-type validation** via ControlledValueResolver | **P2** |

### How would current system resolve test cases?

| Input | Resolution Method | Result |
|-------|-------------------|--------|
| "HX-204" | `asset.tag_number equals 'HX-204' mode: insensitive` | ✅ Would find if exact match |
| "bundle pullout" | Word overlap: "bundle" and "pullout" checked against activity descriptions | ⚠️ Depends on description wording |
| "CDU" | `unit.name.includes('cdu')` or `unit.code.includes('cdu')` | ✅ Would find if unit exists |
| "mechanical" | NOT resolved — discipline is not extracted or validated | ❌ Not used |
| "WP-034" | Not directly searched — workpack_number not in WhatsApp extraction | ❌ Not supported |
| "Heat Exchanger" | Equipment type not resolved through ControlledValueResolver | ❌ Not used |

---

## 9. Controlled Field / UDF Governance Audit

WhatsApp currently extracts only 4 fields:
- `unit_name` (free text)
- `equipment_tag` (free text)
- `job_description` (free text)
- `progress_percent` (integer)

**No controlled field validation occurs in the WhatsApp pipeline.** The system does not validate:
- Discipline
- Equipment Type
- Contractor
- Priority / Criticality
- Activity Code / Standard Activity
- UDFs

The AI can suggest values (via GPT extraction) but never creates or validates against master data.

> **AI cannot create classification variants.** It extracts free-text from field messages and matches against DB records by tag_number. However, it also **cannot validate** that extracted values are controlled — they are simply passed as-is.

---

## 10. Authorization Audit

### Current Authorization Architecture

| Mechanism | Where Used | How |
|-----------|-----------|-----|
| Next-Auth session | Web AI chat, WhatsApp management | `getServerSession(authOptions)` |
| `guardApi(permission)` | WhatsApp updates list/approve/reject | Role-based permission check |
| `orgScope(session)` | All authenticated routes | Extracts `orgId` and `userId` from session |
| `assertTenantAccess` | AI assistant | Verifies entity belongs to tenant |
| Phone → User mapping | WhatsApp webhook | `user.findFirst({ whatsapp_number: phone })` |
| CRON_SECRET | Shift reports | Header `x-cron-secret` |
| WHATSAPP_VERIFY_TOKEN | Webhook verification (GET) | Query param `hub.verify_token` |
| **NONE** | **Webhook POST** | **NO authentication on incoming messages** |

### Permission Matrix

| Action | Web | AI Chat | WhatsApp | Voice | Required Permission | Confirmation |
|--------|-----|---------|----------|-------|---------------------|--------------|
| View project | ✅ | ✅ `projects.view` | N/A | N/A | `projects.view` | No |
| View updates | ✅ | N/A | N/A | N/A | `workpacks.view` | No |
| Query status | ✅ | ✅ | ✅ (no auth) | N/A | None for WhatsApp | No |
| Submit progress | ✅ | ❌ | ✅ (phone lookup) | ✅ (→ WA) | **Phone registration only** | **No** |
| Auto-update (≥90%) | N/A | N/A | ✅ | ✅ (→ WA) | **Phone registration only** | **No** |
| Approve update | ✅ | N/A | N/A | N/A | `workpacks.edit` | No |
| Reject update | ✅ | N/A | N/A | N/A | `workpacks.edit` | Yes (notes required) |
| Complete activity | ✅ | ❌ | ✅ (progress=100) | ✅ (→ WA) | **Phone registration only** | **No** |

### P0/P1 Authorization Findings

| # | Finding | Severity |
|---|---------|----------|
| AUTH-1 | **WhatsApp webhook POST has NO authentication** — any external party can POST crafted messages to `/api/webhooks/whatsapp` and trigger execution. The only protection is phone→user mapping. | **P0** |
| AUTH-2 | **WhatsApp execution uses phone number as sole identity** — no additional authentication or PIN confirmation | **P1** |
| AUTH-3 | **No confirmation for high-impact WhatsApp commands** — `progress >= 100` triggers COMPLETE without asking "Are you sure?" | **P1** |
| AUTH-4 | **AI chat has no execution capability** — mitigates risk but limits usefulness | Info |

---

## 11. Tenant Isolation Audit

### WhatsApp Tenant Isolation

| Check | Result | Evidence |
|-------|--------|----------|
| Phone → User → Organization | ✅ | `user.findFirst({ whatsapp_number: phone })` → `user.organization_id` |
| WhatsApp updates scoped | ✅ | `organization_id: orgId` in all queries |
| Asset lookup scoped | ✅ | `organization_id: organizationId` in DbMatcher |
| Workpack lookup scoped | ✅ | `organization_id: organizationId` in DbMatcher |
| Session scoped | ⚠️ | `organization_id` is nullable in schema, set during creation |
| Shift reports scoped | ✅ | `organization_id: orgId` in all queries |

### AI Chat Tenant Isolation

| Check | Result | Evidence |
|-------|--------|----------|
| Project scoped to org | ✅ | `project.findFirst({ id, orgId })` |
| Activities scoped | ✅ | `workpack: { project_id, organization_id }` |
| `assertTenantAccess` | ✅ | Called before any data access |

### Cross-Tenant Risk Assessment

| Scenario | Risk | Mitigation |
|----------|------|------------|
| Query another tenant's data via WhatsApp | LOW | Phone → User mapping isolates to org |
| Execute against another tenant | LOW | `applyProgressUpdate` passes `orgId` |
| Infer another tenant's data | LOW | No cross-org queries found |
| Webhook spoofing | **HIGH** | No webhook authentication (P0) |

---

## 12. Conversation State Audit

### WhatsApp Sessions

- **Model:** `whatsapp_sessions` — `phone_number` (unique), `state`, `pending_data`, `expires_at`
- **States:** `idle`, `awaiting_unit`, `awaiting_activity`
- **Expiry:** 10 minutes
- **Context:** Stored in `pending_data` JSON (extracted fields, match candidates, progress)

### Multi-Turn Example

```
User: "HX-204 bundle pullout 50%"
→ System finds 3 matching activities
→ Session state = 'awaiting_activity', candidates stored

User: "2"
→ System reads session, selects candidate[1]
→ Applies progress update
→ Session reset to 'idle'
```

**This WORKS for the limited 2-turn disambiguation flow.**

### Context Leak Assessment

| Scenario | Risk | Evidence |
|----------|------|---------|
| User A → User B | NONE | Session keyed by phone_number (unique) |
| Tenant A → Tenant B | LOW | Session has organization_id |
| Event A → Event B | **MEDIUM** | Sessions are NOT event-scoped — multi-event orgs could have ambiguity |

### AI Chat Conversation State

- **No server-side storage** — `chatHistory` passed from client component state
- **No persistent memory** — each session is independent
- **Page refresh loses all context**

---

## 13. Tool / Function Calling Audit

**NO function/tool calling exists in the platform.**

The AI capabilities are:
1. **Text extraction** (FieldExtractor → GPT JSON output)
2. **Text generation** (workpack generation, shift reports, lessons, AI chat)
3. **Vision** (document analysis, P&ID extraction)

None of these use structured function/tool calling schemas. All AI interactions produce unstructured or JSON text responses that are then parsed by application code.

---

## 14. WhatsApp Safety Audit

| Scenario | Current Handling | Finding |
|----------|-----------------|---------|
| Query: "What is progress of HX-204?" | `QueryHandler.handleQuery()` → direct DB lookup → reads `overall_progress` | ⚠️ Direct DB, not authoritative service |
| Update: "HX-204 bundle pullout is 60% complete" | Field extraction → DB match → if ≥90% confidence → auto-apply via EWS | ✅ Correct pipeline |
| Command: "Start HX-204 bundle pullout" | Not supported — only UPDATE_PROGRESS and COMPLETE actions | ❌ Not implemented |
| Ambiguous: "Start bundle pullout" | Would trigger `ask_unit` or `tag_not_found` if no tag matched | ✅ Asks for clarification |
| Dangerous: "Complete HX-204" | If progress=100 extracted → auto-applies COMPLETE if ≥90% confidence | **P1** — no confirmation |

### Missing WhatsApp Command Support

The WhatsApp pipeline currently supports ONLY:
- **UPDATE_PROGRESS** (progress < 100)
- **COMPLETE** (progress >= 100)

NOT supported:
- START, HOLD, RESUME, RELEASE, VERIFY, CLOSE, REPORT_DELAY

---

## 15. AI Hallucination / Trust Boundary Audit

| Location | Type | Source | Classification |
|----------|------|--------|----------------|
| AI chat system prompt | Project progress % | `calculateProgressMetrics()` | ✅ **AUTHORITATIVE** |
| AI chat system prompt | Activity count, critical count | Direct DB count | ✅ **AUTHORITATIVE** |
| AI chat response | Schedule analysis, recommendations | AI inference from system prompt | ⚠️ **AI INFERENCE** |
| WhatsApp query - workpack status | `overall_progress` | Direct DB read | ✅ **AUTHORITATIVE READ** |
| WhatsApp query - activity counts | `activities.filter(status)` | Direct DB query | ✅ **DERIVED FROM AUTHORITY** |
| Shift report | Completed/overdue/in-progress counts | Direct DB query | ✅ **DERIVED FROM AUTHORITY** |
| Shift report narrative | AI-generated summary | AI inference from DB data | ⚠️ **AI INFERENCE** |
| `ta-dashboard.tsx` | All metrics in AI_CTX | Hardcoded string | **❌ UNSUPPORTED** |

---

## 16. Error / Retry / Idempotency Audit

| Mechanism | Implementation | Status |
|-----------|---------------|--------|
| Webhook message dedup | `whatsapp_updates.findFirst({ meta_message_id })` | ✅ WORKING |
| Whisper retry | 3 attempts with 2s backoff | ✅ WORKING |
| OpenAI retry | 3 attempts with 1s backoff | ✅ WORKING |
| WhatsApp send failure | Logs error, returns null | ⚠️ No retry |
| Double COMPLETE | EWS would reject (activity already completed) | ✅ Protected by EWS |
| Duplicate progress update | EWS would apply (may produce duplicate ProgressLog) | ⚠️ Not idempotent at EWS level |
| Webhook timeout after DB commit | Webhook immediately returns 200 before processing | ✅ Fire-and-forget |
| Session expiry race | 10min expiry — race window minimal | ⚠️ Possible |

---

## 17. EventBus Audit

### Declared Events Relevant to M16

| Event | Declared | Emitted by | Consumer | Post-commit | Status |
|-------|----------|------------|----------|-------------|--------|
| `ActivityStarted` | ✅ | ExecutionWriteService | Unknown | Unknown | ✅ DECLARED |
| `ActivityProgressUpdated` | ✅ | ExecutionWriteService | Unknown | Unknown | ✅ DECLARED |
| `ActivityCompleted` | ✅ | ExecutionWriteService | Unknown | Unknown | ✅ DECLARED |
| `ActivityHeld` | ✅ | ExecutionWriteService | Unknown | Unknown | ✅ DECLARED |
| `ActivityResumed` | ✅ | ExecutionWriteService | Unknown | Unknown | ✅ DECLARED |
| `ExecutionDelayReported` | ✅ | ExecutionWriteService | Unknown | Unknown | ✅ DECLARED |
| `ActivityReleased` | ✅ | ExecutionWriteService | Unknown | Unknown | ✅ DECLARED |
| `ActivityVerified` | ✅ | ExecutionWriteService | Unknown | Unknown | ✅ DECLARED |
| `ActivityClosed` | ✅ | ExecutionWriteService | Unknown | Unknown | ✅ DECLARED |

**WhatsApp does NOT emit or subscribe to any EventBus events.** All WhatsApp events pass through EWS which emits the events. This is architecturally correct — WhatsApp is an input adapter, not an event source.

However, there is **no WhatsApp-specific event** for:
- `WhatsAppUpdateReceived`
- `WhatsAppUpdateApproved`
- `WhatsAppUpdateRejected`

---

## 18. M14 Integration Audit

### Current State

| Scenario | Current Implementation | Finding |
|----------|----------------------|---------|
| "Send me today's TA report on WhatsApp" | NOT SUPPORTED | ❌ No M14 integration |
| Report delivery via WhatsApp | Stub in [`reportDeliveryWorker.ts`](file:///c:/DEV/STO/src/workers/reportDeliveryWorker.ts) L86-90: `// TODO: wire to existing MessageProcessor` | **P2** — Stub only |
| Shift report | Independent implementation in ShiftReportGenerator — NOT using M14 pipeline | **P2** — Parallel implementation |
| Notification via WhatsApp | Stub in NotificationQueueProcessor L56-57: `// Future: handle SMS, WhatsApp, etc.` | **P2** — Stub only |

---

## 19. Database / Schema Audit

### M16-Related Models

| Model | Tenant Field | Event Field | Indexes | Issues |
|-------|-------------|-------------|---------|--------|
| `whatsapp_sessions` | `organization_id` (nullable!) | ❌ None | `phone_number` (unique) | ⚠️ Nullable org_id, no event scope |
| `whatsapp_updates` | `organization_id` (nullable!) | ❌ None | `[org_id, status]`, `[phone, created_at]`, `[workpack_id]` | ⚠️ Nullable org_id, no event scope |
| `shift_reports` | `organization_id` | ❌ via `unit_id` | None visible | ✅ |
| `AiProviderSetting` | `organization_id` (unique) | ❌ None | PK only | ✅ |
| `User` (whatsapp fields) | `organization_id` | N/A | `whatsapp_number` (unique) | ✅ |
| `AiExtractionJob` | `organization_id` | N/A | — | ✅ |
| `AiExtractionResult` | — | N/A | — | ✅ |
| `AiSuggestedItem` | `organization_id` | N/A | `[org_id, status]` | ✅ |

### Missing Schema Elements for M16

| Element | Status | Impact |
|---------|--------|--------|
| `aiPrompt` model | **NOT IN SCHEMA** — accessed via `prisma.aiPrompt` (likely via `@@map`) | ⚠️ Verify exists |
| `aiLog` model | **NOT IN SCHEMA** — accessed via `prisma.aiLog` | ⚠️ Verify exists |
| Conversation model | ❌ NOT EXISTS | Needed for M16 multi-turn |
| AI tool/function model | ❌ NOT EXISTS | Needed for M16 function calling |
| Event scope on WhatsApp models | ❌ MISSING | Multi-event orgs need event isolation |

---

## 20. Architecture Duplication Audit

| Capability | Implementation A | Implementation B | Authoritative | Recommendation |
|------------|-----------------|-----------------|---------------|----------------|
| AI provider loading | `ProviderLoader.loadProviderForJob()` | `universalAiClient.callSyorityAI()` | ProviderLoader | universalAiClient wraps ProviderLoader — not a duplicate |
| AI text call | `ProviderLoader.callTextAi()` | `universalAiClient.callSyorityAI()` | Both — different abstraction levels | KEEP BOTH |
| Shift report generation | `ShiftReportGenerator` (direct DB) | M14 ReportGenerationService | M14 | ShiftReportGenerator should delegate to M14 |
| WhatsApp delivery | `MetaClient.sendWhatsAppMessage()` | `reportDeliveryWorker` (stub) | MetaClient | Wire delivery worker to MetaClient |
| Notification delivery | `NotificationQueueProcessor` (email only) | `MetaClient` (WhatsApp direct) | Should unify | Wire WhatsApp channel into notification platform |
| Entity resolution | `DbMatcher` (string matching) | `DimensionRegistry` + `ControlledValueResolver` | DimensionRegistry | DbMatcher should consume DimensionRegistry |

---

## 21. Security Findings Summary

| # | Finding | Severity | Category |
|---|---------|----------|----------|
| SEC-1 | WhatsApp webhook POST has no authentication — can be spoofed | **P0** | Authentication |
| SEC-2 | WhatsApp phone number is sole identity — no PIN/OTP confirmation | **P1** | Identity |
| SEC-3 | No confirmation for COMPLETE action via WhatsApp | **P1** | Confirmation |
| SEC-4 | `whatsapp_sessions.organization_id` is nullable | **P1** | Tenant isolation |
| SEC-5 | `whatsapp_updates.organization_id` is nullable | **P1** | Tenant isolation |
| SEC-6 | AI chat interactions not logged to audit trail | **P1** | Auditability |
| SEC-7 | No event-level scoping in WhatsApp models | **P2** | Multi-event isolation |

---

## 22. M16 Release Recommendation

Based on forensic findings, the recommended structure is:

### Recommended M16 Release Sequence

| Release | Scope | Rationale |
|---------|-------|-----------|
| **M16-R0** | ✅ COMPLETE (this document) | Forensic Discovery |
| **M16-R1** | **Intent Engine + Entity Resolution Core** | Must build the M16 Interaction Engine with DimensionRegistry integration, ControlledValueResolver for entity resolution, and structured intent taxonomy BEFORE adding channels |
| **M16-R2** | **AI Assistant Upgrade** | Rebuild web AI chat with function calling, authoritative data retrieval tools, conversation memory, and audit logging |
| **M16-R3** | **WhatsApp Hardening** | Fix P0 webhook auth, add confirmation for destructive actions, integrate DimensionRegistry-based entity resolution, add event scoping |
| **M16-R4** | **Governed AI Actions + M14 Integration** | Add governed mutation capability to AI (with confirmation), wire WhatsApp to M14 for report delivery, unify notification channels |
| **M16-R5** | **Voice & Mobile** | Add web voice input (browser STT), TTS response, mobile deep links |
| **M16-R6** | **Hardening & Closure** | Performance, conversation memory optimization, comprehensive test suite, security audit |

### Rationale for Changed Sequence

The original proposed sequence had "AI Assistant Core" as R1 and "WhatsApp Operations" as R3. However, the audit reveals:

1. **WhatsApp already works** — it needs hardening, not creation
2. **AI chat is minimal** — it needs a complete upgrade with function calling
3. **Both need a shared Intent Engine** — this must come first
4. **Entity resolution is the #1 gap** — DimensionRegistry integration is prerequisite for everything

---

## 23. Final Audit Verdict

### M16-R0 VERDICT: **AMBER**

The platform has a functional WhatsApp execution channel with correct M12 authority boundaries, but critical gaps in authentication, entity resolution, and AI sophistication must be addressed before M16 production.

### Component Scores

| Component | Score | Evidence |
|-----------|-------|----------|
| AI Foundation | 🟡 AMBER | Working AI services but no function calling, no conversation memory, limited intent |
| WhatsApp | 🟡 AMBER | Functional pipeline with correct EWS routing, but P0 auth gap and limited commands |
| Voice | 🔴 RED | STT only via Whisper, no standalone voice system |
| Intent Resolution | 🔴 RED | Only 3 intents (update/query/unknown), no structured intent engine |
| Entity Resolution | 🔴 RED | String matching, no DimensionRegistry, no ControlledValueResolver |
| Authorization | 🔴 RED | P0 webhook auth gap, phone-only identity for WhatsApp |
| Tenant Isolation | 🟡 AMBER | Working but nullable org_id fields and no event scoping |
| Execution Authority | 🟢 GREEN | All mutations route through ExecutionWriteService ✅ |
| Progress Authority | 🟢 GREEN | No unauthorized calculations, AI chat uses M8.13 ✅ |
| Schedule Authority | 🟢 GREEN | No CPM/schedule modifications found ✅ |
| Auditability | 🔴 RED | No audit trail for AI chat, no EventBus for WhatsApp |
| EventBus | 🟡 AMBER | Events declared and emitted by EWS, but WhatsApp doesn't subscribe |
| Conversation State | 🟡 AMBER | Working 10min session for WhatsApp, no server-side AI chat memory |
| Error/Idempotency | 🟡 AMBER | Message dedup exists, retry logic exists, but gaps in progress idempotency |
| M14 Integration | 🔴 RED | Stubs only, shift reports bypass M14 |
| Architecture Duplication | 🟡 AMBER | ShiftReportGenerator duplicates M14 concern, entity resolution duplicates DimensionRegistry |

### Final Answers

**1. What can we reuse?**
- WhatsApp service layer (MessageProcessor, MetaClient, ReplyBuilder, AudioProcessor)
- ExecutionWriteService integration (correctly wired)
- ProviderLoader / universalAiClient (multi-provider AI routing)
- AiPromptService (tenant-specific prompt templates)
- AI logging infrastructure
- Multi-language reply system (5 languages)

**2. What must be deprecated?**
- `ta-dashboard.tsx` hardcoded AI_CTX demo context
- `DbMatcher.ts` string-matching entity resolution (replace with DimensionRegistry)
- ShiftReportGenerator direct DB queries (should delegate to M14 providers)

**3. What must be fixed before M16-R1?**
- **P0:** WhatsApp webhook authentication (Meta signature verification)
- **P1:** Make `whatsapp_sessions.organization_id` non-nullable
- **P1:** Make `whatsapp_updates.organization_id` non-nullable

**4. What should NOT be changed?**
- ExecutionWriteService architecture (working correctly)
- `source_channel: 'whatsapp'` tracking (correctly implemented)
- ProviderLoader multi-provider support (working correctly)
- WhatsApp → EWS pipeline (correctly implemented)
- EventBus architecture (working correctly)

**5. What is the minimum M16-R1 scope?**
- M16 Intent Engine with structured intent taxonomy
- DimensionRegistry-based entity resolution for AI/WhatsApp
- Webhook authentication (Meta signature verification)
- Schema: non-nullable org_id, add event_id to WhatsApp models

**6. What is the recommended M16-R1 → R6 implementation sequence?**
R1: Intent Engine + Entity Resolution Core  
R2: AI Assistant Upgrade (function calling, memory, audit)  
R3: WhatsApp Hardening (auth, confirmation, DimensionRegistry)  
R4: Governed AI Actions + M14 Integration  
R5: Voice & Mobile  
R6: Hardening & Closure

**7. Are there any P0 blockers?**
YES — 1 P0: WhatsApp webhook POST has no authentication.

**8. Does the current code violate any M8.13/M10/M11/M12/M13/M14 authority boundary?**
- M8.13: **NO** — progress reads are authoritative, no unauthorized calculations
- M10: Not tested (readiness)
- M11: **NO** — no schedule modifications
- M12: **NO** — all execution mutations route through ExecutionWriteService ✅
- M13: Not integrated
- M14: **PARTIAL** — ShiftReportGenerator creates an independent reporting implementation, but does not violate M14 authority (it reads, not writes business data)
