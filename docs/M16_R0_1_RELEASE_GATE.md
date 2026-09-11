# M16-R0.1 — Release Gate

**Date:** 2026-09-07  
**Status:** FORENSIC RECONCILIATION COMPLETE — no code modified

---

## M16-R0.1 GATE VERDICT

# 🟡 AMBER

Architecture is understood. Security gaps are documented and bounded. Authority boundaries are verified GREEN. However, P0 webhook authentication gap and P1 event context gap must be addressed before M16-R1 implementation can begin safely.

The AMBER verdict reflects:
- ✅ **Execution authority is GREEN** — all mutations route through EWS
- ✅ **Progress authority is GREEN** — M8.13 is correctly used
- ✅ **Cross-tenant isolation is GREEN** — organization_id always filtered
- ❌ **Transport authenticity is RED** — webhook POST is unauthenticated
- ❌ **Event context is RED** — no event scoping in WhatsApp pipeline
- 🟡 **Entity resolution is AMBER** — working but fragile, event-unsafe

**R1 implementation IS architecturally viable** once the gate conditions below are accepted.

---

## Findings

### P0 Findings

| # | Finding | Evidence | Impact |
|---|---------|----------|--------|
| P0-1 | **WhatsApp webhook POST has no signature verification** | Zero occurrences of `X-Hub-Signature-256` or HMAC verification. POST at [`webhook/route.ts`](file:///c:/DEV/STO/app/api/webhooks/whatsapp/route.ts) L32-47 accepts any body. | External party can inject crafted messages to trigger execution mutations |

### P1 Findings

| # | Finding | Evidence | Impact |
|---|---------|----------|--------|
| P1-1 | **No event context in WhatsApp pipeline** | `event_id` not referenced anywhere in `src/services/whatsapp/`. `DbMatcher.ts` queries workpacks without event filter. | Multi-event orgs can match wrong event's workpack/activity |
| P1-2 | **Entity resolution uses string matching, not DimensionRegistry** | `DbMatcher.ts` uses `.includes()` and word overlap scoring | Fragile matching, no controlled value validation |
| P1-3 | **No confirmation for COMPLETE action via WhatsApp** | `applyProgressUpdate()` auto-applies when progress≥100 and confidence≥0.90 | Destructive action without user confirmation |
| P1-4 | **`whatsapp_sessions.organization_id` is nullable** | Prisma schema definition | Theoretical tenant isolation gap |
| P1-5 | **`whatsapp_updates.organization_id` is nullable** | Prisma schema definition | Theoretical tenant isolation gap |
| P1-6 | **AI chat interactions not audit-logged** | [`ai-assistant/route.ts`](file:///c:/DEV/STO/app/api/projects/%5Bid%5D/ai-assistant/route.ts) — no `writeAiLog()` or audit_log write | No accountability for AI recommendations |
| P1-7 | **`whatsapp_verified` and `whatsapp_opt_in` flags not enforced** | Schema fields exist on User model (L1544-1545) but `processSingleMessage()` does not check them | Unverified phone numbers can submit updates |
| P1-8 | **Intent taxonomy limited to 3 values** | [`FieldExtractor.ts`](file:///c:/DEV/STO/src/services/whatsapp/FieldExtractor.ts#L28) L28: `'update' | 'query' | 'unknown'` | Cannot detect START, HOLD, RESUME, REPORT_DELAY |
| P1-9 | **`ta-dashboard.tsx` hardcoded demo metrics** | [`ta-dashboard.tsx`](file:///c:/DEV/STO/src/components/ta-dashboard.tsx#L80) L80: fabricated SPI/CPI/progress | Unauthorized non-authoritative metrics in AI context |

### P2 Findings

| # | Finding | Evidence | Impact |
|---|---------|----------|--------|
| P2-1 | No rate limiting on webhook endpoint | Open to message flooding | DoS risk |
| P2-2 | Prompt injection risk on WhatsApp messages | User text sent directly to GPT-4o Mini without sanitization | AI manipulation risk |
| P2-3 | ShiftReportGenerator queries DB directly, bypasses M14 | Direct Prisma queries for activity data | Parallel reporting implementation |
| P2-4 | AI chat has no conversation memory (server-side) | `chatHistory` is client-side React state only | Context loss on page refresh |
| P2-5 | QueryHandler queries DB directly, not through authoritative services | Direct `prisma.workpack.findFirst()` | Not using M8.13 for progress reads in queries |

---

## Gate Conditions

### R1 Prerequisites (Must Be True Before R1 Coding)

1. ✅ Execution authority boundary verified GREEN
2. ✅ Progress authority boundary verified GREEN
3. ✅ Cross-tenant isolation verified GREEN
4. ✅ Architecture recommendation documented
5. ✅ Entity resolution gaps mapped
6. ✅ Security three-layer model defined
7. ✅ Action-risk classification defined
8. ✅ Release sequence confirmed
9. ✅ Event context architecture designed
10. ⚠️ P0 webhook auth — MUST be first task of R1

### R1 Scope (What R1 Must Deliver)

1. Meta webhook signature verification (`X-Hub-Signature-256`)
2. M16 Intent Engine with structured intent taxonomy
3. M16 Entity Resolver using DimensionRegistry for controlled values and event-scoped domain queries
4. Event context determination (single-event auto-select, multi-event prompt)
5. Authorization boundary for WhatsApp commands
6. `m16_interaction_logs` audit table and logging
7. Schema migration: non-nullable `organization_id` on `whatsapp_sessions` and `whatsapp_updates`
8. Schema migration: add `event_id` to `whatsapp_sessions` and `whatsapp_updates`
9. Enforce `whatsapp_verified` and `whatsapp_opt_in` flags
10. AI chat audit logging

### R1 Prohibited Scope (Must NOT Be in R1)

1. ❌ DO NOT implement AI function calling (R2)
2. ❌ DO NOT implement conversation memory (R2)
3. ❌ DO NOT implement governed mutation actions START/HOLD/RESUME/CLOSE (R3)
4. ❌ DO NOT implement confirmation gate UX (R3)
5. ❌ DO NOT implement M14 report delivery via WhatsApp (R4)
6. ❌ DO NOT implement browser STT/TTS (R5)
7. ❌ DO NOT implement mobile channel (R5)
8. ❌ DO NOT modify ExecutionWriteService internals
9. ❌ DO NOT modify M8.13 progress calculation
10. ❌ DO NOT modify M11 scheduling
11. ❌ DO NOT create a new calculation engine

---

## Existing Code to Reuse

| Component | Path | Reuse Strategy |
|-----------|------|---------------|
| ExecutionWriteService | `src/core/execution/ExecutionWriteService.ts` | ✅ Use as-is for all mutations |
| DimensionRegistry | `src/core/dimensions/DimensionRegistry.ts` | ✅ Use for dimension metadata |
| ControlledValueResolver | `src/core/governance/ControlledValueResolver.ts` | ✅ Use for controlled value validation |
| ProviderLoader / universalAiClient | `src/services/ai/ProviderLoader.ts`, `src/lib/ai/universalAiClient.ts` | ✅ Use for all AI calls |
| AiPromptService | `src/services/ai/AiPromptService.ts` | ✅ Extend with M16 intent prompts |
| AudioProcessor | `src/services/whatsapp/AudioProcessor.ts` | ✅ Use as-is for voice notes |
| MetaClient | `src/services/whatsapp/MetaClient.ts` | ✅ Use for outbound WhatsApp |
| ReplyBuilder | `src/services/whatsapp/ReplyBuilder.ts` | ✅ Extend with new intents |
| EventBus | `src/lib/eventBus.ts` | ✅ Subscribe to EWS events |
| calculateProgressMetrics | `src/core/progress/ProgressCalculationService.ts` | ✅ Use for authoritative progress |

## Existing Code to Deprecate (Over M16 Lifecycle)

| Component | Path | Replacement | When |
|-----------|------|-------------|------|
| DbMatcher | `src/services/whatsapp/DbMatcher.ts` | M16 Entity Resolver | M16-R1 |
| FieldExtractor (current prompt) | `src/services/whatsapp/FieldExtractor.ts` | M16 Intent Engine | M16-R1 |
| QueryHandler (direct DB) | `src/services/whatsapp/QueryHandler.ts` | M16 Query Handler via authoritative services | M16-R2 |
| `ta-dashboard.tsx` AI_CTX | `src/components/ta-dashboard.tsx` L80 | Live data from M8.13 | M16-R2 |

## Schema Changes Eventually Required

| Change | Model | Type | When |
|--------|-------|------|------|
| `organization_id` → non-nullable | `whatsapp_sessions` | ALTER | M16-R1 |
| `organization_id` → non-nullable | `whatsapp_updates` | ALTER | M16-R1 |
| Add `event_id` (nullable) | `whatsapp_sessions` | ADD COLUMN | M16-R1 |
| Add `event_id` (nullable) | `whatsapp_updates` | ADD COLUMN | M16-R1 |
| New `m16_conversations` model | — | NEW TABLE | M16-R2 |
| New `m16_interaction_logs` model | — | NEW TABLE | M16-R1 |
| Add `active_event_id` to User | `User` | ADD COLUMN | M16-R1 (optional, could use session) |

## API Changes Eventually Required

| Change | Route | Type | When |
|--------|-------|------|------|
| Add signature verification | `/api/webhooks/whatsapp` POST | MODIFY | M16-R1 |
| Add event context endpoint | `/api/whatsapp/event-context` | NEW | M16-R1 |
| Add AI chat audit logging | `/api/projects/[id]/ai-assistant` | MODIFY | M16-R1 |
| Add function calling | `/api/projects/[id]/ai-assistant` | MODIFY | M16-R2 |
| Add conversation endpoint | `/api/m16/conversations` | NEW | M16-R2 |
| Add governed action endpoints | `/api/m16/actions` | NEW | M16-R3 |

## Security Changes Eventually Required

| Change | Priority | When |
|--------|----------|------|
| Webhook `X-Hub-Signature-256` verification | **P0** | M16-R1 (first task) |
| Enforce `whatsapp_verified` flag | P1 | M16-R1 |
| Enforce `whatsapp_opt_in` flag | P1 | M16-R1 |
| Event-scoped entity resolution | P1 | M16-R1 |
| Confirmation for COMPLETE action | P1 | M16-R3 |
| Non-nullable org_id on WA models | P1 | M16-R1 |
| Webhook rate limiting | P2 | M16-R4 |
| Prompt injection sanitization | P2 | M16-R4 |
| AI chat audit logging | P1 | M16-R1 |

---

## Final Statement

> **M16-R1 implementation is NOT authorized by this task.**
>
> Only after the R0.1 gate is reviewed and approved should implementation begin.

The R0.1 reconciliation has removed architectural ambiguity across all 13 investigation areas. The exact boundaries, gaps, existing code to reuse, code to deprecate, schema changes, API changes, and security changes are documented. The release sequence R1→R6 is confirmed with evidence-based rationale.

The gate conditions define exactly what R1 must deliver, what R1 must NOT deliver, and what must be true before R1 coding begins.
