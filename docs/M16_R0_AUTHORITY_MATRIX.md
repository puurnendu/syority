# M16-R0 — Authority Matrix

**Date:** 2026-09-07  
**Status:** VERIFIED AGAINST CODE

---

## 1. Execution Mutation Authority

| Source Channel | Mutation | Authoritative Service | Intermediary | Confirmed in Code |
|---------------|----------|----------------------|--------------|-------------------|
| Web UI | All ExecutionActions | `ExecutionWriteService.applyAction()` | API route handlers | ✅ |
| WhatsApp auto-apply | UPDATE_PROGRESS | `ExecutionWriteService.applyAction()` | `MessageProcessor.applyProgressUpdate()` | ✅ [`MessageProcessor.ts`](file:///c:/DEV/STO/src/services/whatsapp/MessageProcessor.ts) |
| WhatsApp auto-apply | COMPLETE (progress=100) | `ExecutionWriteService.applyAction()` | `MessageProcessor.applyProgressUpdate()` | ✅ [`MessageProcessor.ts`](file:///c:/DEV/STO/src/services/whatsapp/MessageProcessor.ts) |
| WhatsApp session reply | UPDATE_PROGRESS | `ExecutionWriteService.applyAction()` | `MessageProcessor.handleSessionReply()` | ✅ [`MessageProcessor.ts`](file:///c:/DEV/STO/src/services/whatsapp/MessageProcessor.ts) |
| Planner approve | UPDATE_PROGRESS | `ExecutionWriteService.applyAction()` | `/api/whatsapp/updates/[id]/approve` | ✅ [`approve/route.ts`](file:///c:/DEV/STO/app/api/whatsapp/updates/%5BupdateId%5D/approve/route.ts) |
| Voice (via WhatsApp) | UPDATE_PROGRESS / COMPLETE | `ExecutionWriteService.applyAction()` | `AudioProcessor` → `MessageProcessor` | ✅ Same pipeline |
| AI Chat | **NONE** | N/A | N/A | ✅ Read-only |
| Excel import | Via import route | `ExecutionWriteService` | Import processor | ✅ |
| API | All ExecutionActions | `ExecutionWriteService.applyAction()` | API routes | ✅ |

## 2. Progress Calculation Authority

| Component | Calculation Type | Authoritative Service | Code Location | Status |
|-----------|-----------------|----------------------|---------------|--------|
| AI Chat system prompt | Duration-weighted progress | `M8.13 calculateProgressMetrics()` | [`ai-assistant/route.ts`](file:///c:/DEV/STO/app/api/projects/%5Bid%5D/ai-assistant/route.ts) L74 | ✅ CORRECT |
| WhatsApp query | Overall progress read | `workpack.overall_progress` (stored) | [`QueryHandler.ts`](file:///c:/DEV/STO/src/services/whatsapp/QueryHandler.ts) L55 | ✅ ACCEPTABLE |
| WhatsApp update | Activity progress pass-through | User-reported value → EWS | [`MessageProcessor.ts`](file:///c:/DEV/STO/src/services/whatsapp/MessageProcessor.ts) L240 | ✅ CORRECT |
| Shift report | Activity status counts | Direct DB count | [`ShiftReportGenerator.ts`](file:///c:/DEV/STO/src/services/whatsapp/ShiftReportGenerator.ts) L258 | ⚠️ Read-only presentation |
| Workpack generation (AI) | Estimated manhours | AI-generated estimates | [`AiWorkpackGenerator.ts`](file:///c:/DEV/STO/src/services/ai/AiWorkpackGenerator.ts) | ✅ PLANNING ESTIMATES |
| `ta-dashboard.tsx` | Hardcoded demo progress | Hardcoded string literal | [`ta-dashboard.tsx`](file:///c:/DEV/STO/src/components/ta-dashboard.tsx) L80 | ❌ DEMO ONLY |

## 3. Schedule Authority

| Component | Schedule Modification | CPM Calculation | Float Calculation | Status |
|-----------|----------------------|-----------------|-------------------|--------|
| AI Chat | ❌ NONE | ❌ NONE | ❌ NONE | ✅ |
| WhatsApp | ❌ NONE | ❌ NONE | ❌ NONE | ✅ |
| Voice | ❌ NONE | ❌ NONE | ❌ NONE | ✅ |
| AI Workpack Generator | Activity sequence (planning) | ❌ NONE | ❌ NONE | ✅ |

## 4. Domain Service Authority Boundaries

| Authority | Owner | M16 Usage | Status |
|-----------|-------|-----------|--------|
| Actual progress calculation | **M8.13 ProgressAggregationService** | AI chat reads via `calculateProgressMetrics()` | ✅ CORRECT |
| EVM (SPI/CPI) | **M8.10** | NOT used by M16 | ✅ N/A |
| Planning readiness | **M10** | NOT used by M16 | ✅ N/A |
| Planned schedule / CPM / float | **M11** | NOT used by M16 | ✅ N/A |
| Execution mutations | **M12 ExecutionWriteService** | All WhatsApp mutations route through EWS | ✅ CORRECT |
| Control Tower intelligence | **M13** | NOT used by M16 | ✅ N/A |
| Reporting & delivery | **M14** | NOT used (shift reports bypass M14) | ⚠️ GAP |
| Dimensions / classification | **DimensionRegistry / ControlledValueResolver** | NOT used by WhatsApp (uses DbMatcher instead) | ⚠️ GAP |

## 5. Source Channel Tracking

| Channel | `source_channel` Value | Set In | Verified |
|---------|----------------------|--------|----------|
| Web UI | `'web'` | API route handlers | ✅ |
| WhatsApp auto-update | `'whatsapp'` | `MessageProcessor.applyProgressUpdate()` | ✅ |
| WhatsApp session reply | `'whatsapp'` | `MessageProcessor.handleSessionReply()` | ✅ |
| Planner approve | `'whatsapp'` | `/api/whatsapp/updates/[id]/approve` L54 | ✅ |
| Voice (via WhatsApp) | `'whatsapp'` | Same pipeline | ✅ |
| AI Chat | N/A (read-only) | N/A | ✅ |
| Excel import | `'excel'` | Import handlers | ✅ |
| API | `'api'` | API route handlers | ✅ |
| Voice (future) | `'voice'` | Type declared in EWS L36 | ✅ Declared |
| AI (future) | `'ai'` | Type declared in EWS L36 | ✅ Declared |
| System | `'system'` | Type declared in EWS L36 | ✅ Declared |

## 6. Authority Violations Found

| # | Violation | Severity | Component | Evidence |
|---|-----------|----------|-----------|----------|
| NONE | **All execution mutations correctly route through ExecutionWriteService** | N/A | All M16 components | Verified in code audit |

## 7. Authority Gaps (Not Violations)

| # | Gap | Severity | Component | Recommendation |
|---|-----|----------|-----------|----------------|
| GAP-1 | WhatsApp entity resolution bypasses DimensionRegistry | P1 | `DbMatcher.ts` | Replace with DimensionRegistry-based resolution in M16-R1 |
| GAP-2 | Shift report generation bypasses M14 | P2 | `ShiftReportGenerator.ts` | Wire to M14 ReportGenerationService in M16-R4 |
| GAP-3 | WhatsApp queries bypass authoritative services | P2 | `QueryHandler.ts` | Route through Intent Engine in M16-R1 |
| GAP-4 | AI chat has no audit trail | P1 | `ai-assistant/route.ts` | Add logging to `m16_interaction_logs` in M16-R2 |

---

## Verdict

**ALL EXECUTION AUTHORITY BOUNDARIES ARE PRESERVED. ✅**

The M16 interaction layer correctly delegates ALL mutations through ExecutionWriteService with source channel tracking. The identified gaps are architectural improvements, not authority violations.
