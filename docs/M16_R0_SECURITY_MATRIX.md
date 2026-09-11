# M16-R0 — Security Matrix

**Date:** 2026-09-07  
**Status:** VERIFIED AGAINST CODE

---

## 1. Authentication & Identity Matrix

| Channel | Auth Mechanism | Identity Source | Session Type | Tenant Resolution | Status |
|---------|---------------|-----------------|-------------|-------------------|--------|
| Web AI Chat | NextAuth session | `getServerSession()` | JWT/cookie | `orgScope(session)` | ✅ SECURE |
| WhatsApp Management UI | NextAuth session | `getServerSession()` | JWT/cookie | `orgScope(session)` | ✅ SECURE |
| WhatsApp Webhook (GET) | WHATSAPP_VERIFY_TOKEN | Query param | None | N/A (verification) | ✅ ACCEPTABLE |
| WhatsApp Webhook (POST) | **NONE** | **Phone number** | **None** | **Phone → User → Org** | **❌ P0** |
| WhatsApp Voice | Same as webhook POST | Phone number | None | Phone → User → Org | **❌ P0** |
| Cron Shift Reports | CRON_SECRET header | None (system) | None | Iterates all orgs | ✅ ACCEPTABLE |
| AI Config API | NextAuth session | `getServerSession()` | JWT/cookie | `orgScope(session)` | ✅ SECURE |

## 2. Authorization (Permission) Matrix

| Endpoint | Method | Required Permission | Guard Function | Bypass Possible? | Status |
|----------|--------|---------------------|---------------|-------------------|--------|
| `/api/projects/[id]/ai-assistant` | POST | `projects.view` | `guardApi` + `assertTenantAccess` | No | ✅ |
| `/api/whatsapp/updates` | GET | `workpacks.view` | `guardApi` | No | ✅ |
| `/api/whatsapp/updates/[id]` | GET | `workpacks.view` | `guardApi` | No | ✅ |
| `/api/whatsapp/updates/[id]/approve` | POST | `workpacks.edit` | `guardApi` | No | ✅ |
| `/api/whatsapp/updates/[id]/reject` | POST | `workpacks.edit` | `guardApi` | No | ✅ |
| `/api/whatsapp/updates/count` | GET | `workpacks.view` | `guardApi` | No | ✅ |
| `/api/webhooks/whatsapp` | GET | None (verify) | VERIFY_TOKEN check | Requires token | ✅ |
| `/api/webhooks/whatsapp` | POST | **NONE** | **NO CHECK** | **YES — open endpoint** | **❌ P0** |
| `/api/cron/shift-reports` | POST | None (system) | CRON_SECRET header | Requires secret | ✅ |
| `/api/ai-config` | GET/POST | Admin-level | `guardApi` | No | ✅ |

## 3. Rate Limiting Matrix

| Endpoint | Rate Limiter | Identifier | Limit | Status |
|----------|-------------|------------|-------|--------|
| `/api/projects/[id]/ai-assistant` | `checkRateLimit(id, 'ai')` | User ID or IP | Configured per tier | ✅ ACTIVE |
| `/api/webhooks/whatsapp` | **NONE** | N/A | N/A | **⚠️ P2** — DoS risk |
| All `/api/whatsapp/*` | **NONE** | N/A | N/A | ⚠️ P3 |

## 4. Tenant Isolation Matrix

| Data Access | Scope Filter | Field | Nullable | Status |
|-------------|-------------|-------|----------|--------|
| WhatsApp updates list | `organization_id: orgId` | `organization_id` | **YES** | **⚠️ P1** |
| WhatsApp update approve | `organization_id: orgId` | `organization_id` | **YES** | **⚠️ P1** |
| WhatsApp update reject | `organization_id: orgId` | `organization_id` | **YES** | **⚠️ P1** |
| WhatsApp session | Set during creation | `organization_id` | **YES** | **⚠️ P1** |
| AI chat project | `orgId` in project query | `orgId` | No | ✅ |
| AI chat activities | `organization_id` in workpack | `organization_id` | No | ✅ |
| Asset lookup (DbMatcher) | `organization_id` in query | `organization_id` | No | ✅ |
| Workpack lookup (DbMatcher) | `organization_id` in query | `organization_id` | No | ✅ |
| Shift report | `organization_id` in query | `organization_id` | No | ✅ |

## 5. Data Exposure Matrix

| Data Type | Web AI Chat | WhatsApp | Voice | Risk |
|-----------|------------|----------|-------|------|
| Project name/code | ✅ In system prompt | ❌ Not exposed | ❌ | LOW |
| Overall progress % | ✅ In system prompt | ✅ In query response | ✅ (via WA) | LOW |
| Activity count | ✅ In system prompt | ✅ In query response | ✅ (via WA) | LOW |
| Open constraint count | ✅ In system prompt | ✅ In query response | ✅ (via WA) | LOW |
| Individual activity progress | ❌ Not exposed directly | ❌ Not exposed | ❌ | LOW |
| Financial data (EVM/CPI/SPI) | ❌ Not exposed | ❌ Not exposed | ❌ | N/A |
| User PII | ❌ Not exposed | Phone number used as ID | ❌ | MEDIUM |
| API keys | ❌ Not in responses | ❌ Not in responses | ❌ | LOW |
| AI prompts | ❌ Not exposed | ❌ Not exposed | ❌ | LOW |

## 6. API Key Security

| Key | Storage | Encryption | Access Pattern | Status |
|-----|---------|------------|----------------|--------|
| OpenAI API Key | `AiProviderSetting.api_key_encrypted` | Column name suggests encryption | `ProviderLoader.loadProviderForJob()` decrypts | ⚠️ Verify actual encryption |
| Gemini API Key | `AiProviderSetting.api_key_encrypted` | Same as above | Same | ⚠️ Verify |
| WhatsApp AI Key | `AiProviderSetting.whatsapp_api_key_encrypted` | Same as above | Same | ⚠️ Verify |
| Whisper API Key | `AiProviderSetting.whisper_api_key_encrypted` | Same as above | `AudioProcessor` reads directly | ⚠️ Verify |
| Vision AI Key | `AiProviderSetting.vision_api_key_encrypted` | Same as above | Same | ⚠️ Verify |
| WHATSAPP_VERIFY_TOKEN | Environment variable | N/A | `process.env.WHATSAPP_VERIFY_TOKEN` | ✅ Env |
| CRON_SECRET | Environment variable | N/A | `process.env.CRON_SECRET` | ✅ Env |
| Meta WhatsApp Token | Environment variable | N/A | `process.env.WHATSAPP_TOKEN` | ✅ Env |

## 7. Injection & Trust Boundary Matrix

| Attack Vector | Current Protection | Risk | Status |
|---------------|-------------------|------|--------|
| Prompt injection via WhatsApp message | None — raw user text sent to GPT | MEDIUM | ⚠️ P2 |
| SQL injection via entity extraction | Prisma parameterized queries | LOW | ✅ |
| XSS via WhatsApp reply | Replies are plain text, not HTML | LOW | ✅ |
| SSRF via AI model URL | Model URL from DB, not user input | LOW | ✅ |
| Webhook spoofing | **NO protection on POST** | **HIGH** | **❌ P0** |
| Cross-tenant data access via WhatsApp | Phone → User → Org mapping | LOW | ✅ |
| Privilege escalation via WhatsApp | Phone → User → role → permissions | LOW (EWS checks) | ✅ |

## 8. Audit Trail Matrix

| Action | Audit Logged? | Where | Includes User? | Includes Source? | Status |
|--------|--------------|-------|----------------|------------------|--------|
| WhatsApp progress update | ✅ | `progress_logs` + `audit_log` via EWS | ✅ user_id | ✅ `source_channel: 'whatsapp'` | ✅ |
| WhatsApp update creation | ⚠️ | `whatsapp_updates` record only | ✅ user_id | ✅ message_type | ⚠️ Not in audit_log |
| Planner approve | ✅ | `progress_logs` + `audit_log` via EWS | ✅ user_id | ✅ `source_channel: 'whatsapp'` | ✅ |
| Planner reject | ⚠️ | `whatsapp_updates.status` update only | ✅ reviewed_by | ❌ Not in audit_log | ⚠️ |
| AI chat interaction | **❌** | **NOT LOGGED** | N/A | N/A | **❌ P1** |
| AI workpack generation | ✅ | `writeAiLog()` | ✅ org_id | ✅ job_type | ✅ |
| Shift report generation | ⚠️ | `shift_reports` record | ✅ org_id | ❌ No AI log | ⚠️ |
| Audio transcription | ⚠️ | Stored in `whatsapp_updates` | ✅ | ✅ | ⚠️ |

## 9. Critical Security Findings

### P0 — Must Fix Before M16-R1

| # | Finding | Evidence | Recommendation |
|---|---------|----------|----------------|
| SEC-P0-1 | **WhatsApp webhook POST has NO authentication** | [`webhook/route.ts`](file:///c:/DEV/STO/app/api/webhooks/whatsapp/route.ts) L32-47 — POST handler accepts any body with no signature verification | Implement Meta `X-Hub-Signature-256` verification against `WHATSAPP_APP_SECRET` |

### P1 — Must Fix During M16-R1

| # | Finding | Evidence | Recommendation |
|---|---------|----------|----------------|
| SEC-P1-1 | WhatsApp phone = sole identity | `MessageProcessor.ts` user lookup by phone | Consider OTP or PIN for sensitive actions |
| SEC-P1-2 | No confirmation for COMPLETE via WhatsApp | `applyProgressUpdate()` auto-applies if ≥90% confidence and progress=100 | Add confirmation step for destructive actions |
| SEC-P1-3 | `whatsapp_sessions.organization_id` is nullable | [`schema.prisma`](file:///c:/DEV/STO/prisma/schema.prisma) L2666 | Make non-nullable via migration |
| SEC-P1-4 | `whatsapp_updates.organization_id` is nullable | [`schema.prisma`](file:///c:/DEV/STO/prisma/schema.prisma) L2679 | Make non-nullable via migration |
| SEC-P1-5 | AI chat interactions not logged | [`ai-assistant/route.ts`](file:///c:/DEV/STO/app/api/projects/%5Bid%5D/ai-assistant/route.ts) | Add audit logging for all AI chat requests |
| SEC-P1-6 | WhatsApp rejection not in audit_log | [`reject/route.ts`](file:///c:/DEV/STO/app/api/whatsapp/updates/%5BupdateId%5D/reject/route.ts) | Add AuditService call for rejections |
| SEC-P1-7 | Whisper API key access bypasses ProviderLoader | [`AudioProcessor.ts`](file:///c:/DEV/STO/src/services/whatsapp/AudioProcessor.ts) — reads `whisper_api_key_encrypted` directly | Route through ProviderLoader |

### P2 — Should Fix During M16

| # | Finding | Evidence | Recommendation |
|---|---------|----------|----------------|
| SEC-P2-1 | No rate limiting on webhook endpoint | Open to message flooding | Add per-phone rate limiting |
| SEC-P2-2 | Prompt injection risk on WhatsApp messages | User text sent directly to GPT-4o Mini | Add input sanitization layer |
| SEC-P2-3 | No event-level scoping | WhatsApp models lack event_id | Add event_id to models for multi-event orgs |

---

## Verdict

**OVERALL SECURITY POSTURE: AMBER**

The platform has correct tenant isolation (via phone→user→org mapping) and proper authorization on all web-facing API routes. The critical gap is the **P0 unauthenticated webhook endpoint**, which allows external message injection. All execution mutations are correctly routed through ExecutionWriteService with source channel tracking.

### Risk Summary

```
Authentication:      🔴 P0 — Webhook POST unauthenticated
Authorization:       🟢 GREEN — All management routes use guardApi
Tenant Isolation:    🟡 AMBER — Working but nullable org_id fields
Execution Authority: 🟢 GREEN — All mutations via EWS
Audit Trail:         🟡 AMBER — Execution audited, AI chat not audited
Data Exposure:       🟢 GREEN — Minimal data in channel responses
API Key Security:    🟡 AMBER — Encrypted storage, verify actual encryption
Rate Limiting:       🟡 AMBER — AI chat limited, webhook unlimited
```
