# M16-R0.1 — Authority Proof

**Date:** 2026-09-07  
**Status:** FORENSIC RECONCILIATION — no code modified

---

## 1. AI → Prisma / Domain Authority Matrix

### Channel × Capability Matrix

| Channel | Capability | Direct Prisma Mutation? | Domain Service | EWS? | Authoritative Module | Audit | EventBus |
|---------|-----------|----------------------|----------------|------|---------------------|-------|----------|
| **AI Chat** | Progress query | ❌ NO — read-only | `calculateProgressMetrics()` | ❌ | **M8.13** ✅ | ❌ Not logged | ❌ |
| **AI Chat** | Activity count | ❌ NO — read-only | Direct `prisma.activity.count` | ❌ | N/A (simple count) | ❌ Not logged | ❌ |
| **AI Chat** | Constraint count | ❌ NO — read-only | Direct `prisma.project_constraints.count` | ❌ | N/A (simple count) | ❌ Not logged | ❌ |
| **AI Chat** | Execution command | ❌ NO — **AI chat cannot execute** | N/A | ❌ | N/A | N/A | N/A |
| **WhatsApp** | Progress query | ❌ NO — read-only | Direct `prisma.workpack.findFirst` | ❌ | Reads stored `overall_progress` | ⚠️ `whatsapp_updates` | ❌ |
| **WhatsApp** | Progress update (auto, ≥90%) | ❌ | `ExecutionWriteService.applyAction()` | ✅ | **M12** ✅ | ✅ EWS audit | ✅ EWS events |
| **WhatsApp** | Progress update (parked) | ❌ — `whatsapp_updates.create` (logging) | N/A | ❌ | N/A (pending) | ⚠️ `whatsapp_updates` | ❌ |
| **WhatsApp** | COMPLETE (progress=100) | ❌ | `ExecutionWriteService.applyAction()` | ✅ | **M12** ✅ | ✅ EWS audit | ✅ EWS events |
| **WhatsApp** | START | ❌ — **NOT IMPLEMENTED** | N/A | N/A | N/A | N/A | N/A |
| **WhatsApp** | HOLD / RESUME | ❌ — **NOT IMPLEMENTED** | N/A | N/A | N/A | N/A | N/A |
| **WhatsApp** | Planner Approve | ❌ | `ExecutionWriteService.applyAction()` | ✅ | **M12** ✅ | ✅ EWS audit | ✅ EWS events |
| **WhatsApp** | Planner Reject | ✅ `whatsapp_updates.update({ status })` | ❌ Direct | ❌ | N/A (status only) | ⚠️ No audit_log | ❌ |
| **Voice** | Query | Same as WhatsApp (→ STT → pipeline) | Same | Same | Same | Same | Same |
| **Voice** | Command | Same as WhatsApp (→ STT → pipeline) | Same | Same | Same | Same | Same |
| **Mobile** | Query | ❌ — **NOT IMPLEMENTED** | N/A | N/A | N/A | N/A | N/A |
| **Mobile** | Command | ❌ — **NOT IMPLEMENTED** | N/A | N/A | N/A | N/A | N/A |

### Direct Prisma Mutation Search Results

| Pattern | WhatsApp (`src/services/whatsapp/`) | AI (`src/services/ai/`) | AI lib (`src/lib/ai/`) |
|---------|-------------------------------------|------------------------|------------------------|
| `prisma.activity.update` | **ZERO** | **ZERO** | **ZERO** |
| `prisma.activity.create` | **ZERO** | **ZERO** | **ZERO** |
| `prisma.activity.delete` | **ZERO** | **ZERO** | **ZERO** |
| `prisma.workpack.update` | **ZERO** | **ZERO** | ⚠️ **ONE** — `workpackAutoFill.ts` L324 |
| `prisma.workpack.create` | **ZERO** | **ZERO** | **ZERO** |
| `prisma.progress.*` | **ZERO** | **ZERO** | **ZERO** |
| `prisma.$executeRaw` | **ZERO** | **ZERO** | **ZERO** |

### The ONE Exception: `workpackAutoFill.ts`

**Location:** [`workpackAutoFill.ts`](file:///c:/DEV/STO/src/lib/ai/workpackAutoFill.ts#L324-L327) L324-327

```typescript
await prisma.workpack.update({
  where: { id: workpackId },
  data: { ai_auto_filled: true, ai_auto_filled_at: new Date() },
});
```

**Classification:** ✅ ACCEPTABLE  
**Reason:** This updates ONLY the `ai_auto_filled` metadata flag. It does NOT modify business data (progress, status, scope, schedule). It is a "workpack was AI-populated" timestamp marker. It does NOT require EWS routing.

### Architecture Paths Verified

| Path | Found? | Evidence |
|------|--------|----------|
| AI → Prisma (mutation) | ❌ NONE (except metadata flag) | Searched all AI-related dirs |
| WhatsApp → Prisma (execution mutation) | ❌ NONE | All execution goes through EWS |
| WhatsApp → Prisma (logging/session) | ✅ YES (acceptable) | `whatsapp_updates.create`, `whatsapp_sessions.upsert`, `user.update` (language preference) |
| AI → Legacy service | ❌ NONE | No legacy service calls found |
| WhatsApp → Legacy service | ❌ NONE | MessageProcessor imports EWS directly |
| Voice → Prisma | ❌ NONE | Voice is processed through WhatsApp pipeline |

---

## 2. Authoritative Calculation Audit

### All Calculations in AI/WhatsApp/Voice Code

| File | Function/Line | Calculation | Classification | Authority |
|------|--------------|-------------|---------------|-----------|
| [`ai-assistant/route.ts`](file:///c:/DEV/STO/app/api/projects/%5Bid%5D/ai-assistant/route.ts#L74) L74 | `calculateProgressMetrics(progressInput)` | Duration-weighted progress | **AUTHORITATIVE** | M8.13 ✅ |
| [`ai-assistant/route.ts`](file:///c:/DEV/STO/app/api/projects/%5Bid%5D/ai-assistant/route.ts#L59-L64) L59-64 | `prisma.activity.count({ is_critical: true })` | Critical activity count | **AUTHORITATIVE** (DB count, not calculation) | ✅ |
| [`ai-assistant/route.ts`](file:///c:/DEV/STO/app/api/projects/%5Bid%5D/ai-assistant/route.ts#L51-L53) L51-53 | `prisma.project_constraints.count({ status: 'Open' })` | Open constraint count | **AUTHORITATIVE** (DB count) | ✅ |
| [`MessageProcessor.ts`](file:///c:/DEV/STO/src/services/whatsapp/MessageProcessor.ts#L169) L169 | `finalConfidence = aiConfidence * 0.6 + dbConfidence * 0.4` | Confidence routing score | **ADAPTER** — routing decision, not business metric | ✅ |
| [`QueryHandler.ts`](file:///c:/DEV/STO/src/services/whatsapp/QueryHandler.ts#L52-L55) L52-55 | `done = wp.activities.filter(a => a.status === 'completed').length` | Activity completion count | **PRESENTATION** — counting completed for display | ✅ |
| [`QueryHandler.ts`](file:///c:/DEV/STO/src/services/whatsapp/QueryHandler.ts#L55) L55 | `progress = wp.overall_progress ?? 0` | Workpack progress read | **AUTHORITATIVE READ** — reads stored M8.13 value | ✅ |
| [`QueryHandler.ts`](file:///c:/DEV/STO/src/services/whatsapp/QueryHandler.ts#L59) L59 | `total - done - inProg` | Pending activity count | **PRESENTATION** — derived from status counts | ✅ |
| [`QueryHandler.ts`](file:///c:/DEV/STO/src/services/whatsapp/QueryHandler.ts#L140) L140 | `activities.filter(a => a.planned_end && a.planned_end < now)` | Overdue filter | **PRESENTATION** — date comparison for display | ✅ |
| [`ShiftReportGenerator.ts`](file:///c:/DEV/STO/src/services/whatsapp/ShiftReportGenerator.ts#L257) L257 | `completedActivities.length` | Completed count | **PRESENTATION** — count for display | ✅ |
| [`ShiftReportGenerator.ts`](file:///c:/DEV/STO/src/services/whatsapp/ShiftReportGenerator.ts#L263) L263 | `inProgressActivities.length` | In-progress count | **PRESENTATION** — count for display | ✅ |
| [`ShiftReportGenerator.ts`](file:///c:/DEV/STO/src/services/whatsapp/ShiftReportGenerator.ts#L266) L266 | `a.progress_percent ?? 0` | Activity progress read | **AUTHORITATIVE READ** — reads stored value | ✅ |
| [`ShiftReportGenerator.ts`](file:///c:/DEV/STO/src/services/whatsapp/ShiftReportGenerator.ts#L266) L266 | `a.planned_end < shiftEnd ? ' [OVERDUE]'` | Overdue flag | **PRESENTATION** — date comparison | ✅ |
| [`DbMatcher.ts`](file:///c:/DEV/STO/src/services/whatsapp/DbMatcher.ts#L124-L131) L124-131 | `matches / jdWords.length` | Word overlap ratio | **ADAPTER** — entity matching, not business metric | ✅ |
| [`ta-dashboard.tsx`](file:///c:/DEV/STO/src/components/ta-dashboard.tsx#L80) L80 | `Progress: Planned 68.2%, Actual 62.4%`, `SPI: 0.915`, `CPI: 0.943` | Hardcoded demo values | **❌ UNAUTHORIZED** — fabricated metrics not sourced from M8.13/M8.10 | ❌ |

### Keyword Search Verification — No Unauthorized Calculations Found

| Keyword | AI Chat | WhatsApp | Voice | Result |
|---------|---------|----------|-------|--------|
| `SPI` | ❌ | ❌ | ❌ | Only in `ta-dashboard.tsx` (hardcoded demo) |
| `CPI` | ❌ | ❌ | ❌ | Only in `ta-dashboard.tsx` (hardcoded demo) |
| `EVM` | ❌ | ❌ | ❌ | Not found in AI/WhatsApp |
| `CPM` | ❌ | ❌ | ❌ | Not found |
| `float` | ❌ | ❌ | ❌ | Not found (scheduling context) |
| `critical path` | ❌ | ❌ | ❌ | Not found |
| `readiness` | ❌ | ❌ | ❌ | Not found in AI/WhatsApp calculation |
| `forecast` | ❌ | ❌ | ❌ | Only in `ta-dashboard.tsx` (hardcoded demo) |

### Authority Compliance Summary

| Authority | Owner | M16 Compliance | Evidence |
|-----------|-------|----------------|----------|
| Progress | **M8.13** | ✅ AI chat uses `calculateProgressMetrics()`. WhatsApp reads stored `overall_progress`. | [`route.ts`](file:///c:/DEV/STO/app/api/projects/%5Bid%5D/ai-assistant/route.ts#L74) L74, [`QueryHandler.ts`](file:///c:/DEV/STO/src/services/whatsapp/QueryHandler.ts#L55) L55 |
| EVM | **M8.10** | ✅ Not accessed by M16 | Keyword search: zero results |
| Readiness | **M10** | ✅ Not accessed by M16 | Keyword search: zero results |
| Schedule/CPM | **M11** | ✅ Not accessed by M16 | Keyword search: zero results |
| Execution | **M12 EWS** | ✅ All mutations route through EWS | [`MessageProcessor.ts`](file:///c:/DEV/STO/src/services/whatsapp/MessageProcessor.ts#L326-L335) L326-335 |
| Control Tower | **M13** | ✅ Not accessed by M16 | Keyword search: zero results |
| Reporting | **M14** | ⚠️ ShiftReportGenerator queries DB directly (parallel to M14, not a violation) | Documented gap |

### Critical Finding: `ta-dashboard.tsx` Hardcoded Demo

**File:** [`ta-dashboard.tsx`](file:///c:/DEV/STO/src/components/ta-dashboard.tsx#L80) L80

```typescript
const AI_CTX=`...Progress: Planned 68.2%, Actual 62.4% (-5.8%) | SPI: 0.915 | CPI: 0.943. 
Forecast MC: 09-Apr-2026 vs Planned 05-Apr-2026 (4 days behind)...`;
```

**Classification: ❌ UNAUTHORIZED**

This presents fabricated SPI, CPI, forecast, and progress values as if they were real metrics. While this is clearly a demo component (not production AI chat), it violates the principle that AI must never silently present non-authoritative values.

**Recommendation:** Replace with live data fetched via `calculateProgressMetrics()` or clearly label as "DEMO MODE — not real data".

---

## 3. AI Inference vs Authoritative Value Rule

### When AI Says: "TA progress is 67%"

| Source of "67%" | Classification | Acceptable? |
|----------------|---------------|-------------|
| `calculateProgressMetrics().weightedProgress` → system prompt → AI repeats | **AUTHORITATIVE** | ✅ YES |
| AI calculates from activity counts | **UNAUTHORIZED** | ❌ NO |
| `wp.overall_progress` (stored by M8.13) | **AUTHORITATIVE READ** | ✅ YES |
| Hardcoded in demo context | **UNAUTHORIZED** | ❌ NO |

### When AI Says: "HX-204 will cause a 9-hour delay"

| Source of "9-hour" | Classification | Acceptable? |
|-------------------|---------------|-------------|
| M11 CPM calculation result | **AUTHORITATIVE** | ✅ YES |
| AI inference from activity durations in system prompt | **AI INFERENCE** | ⚠️ ONLY if explicitly labeled |
| AI hallucination | **UNAUTHORIZED** | ❌ NO |

### M16 Rule: AI Inference Labeling

Every AI-generated response that contains a numeric value SHOULD include provenance:
- Values from authoritative services: Present without qualification
- Values from AI inference: Must be prefixed with "AI estimate:" or "Approximate:" or similar qualification

This is an **M16-R2 implementation concern** (AI Assistant Core), not an R1 concern.

---

## 4. Desired vs Current Architecture

### Desired Architecture
```
AI / WhatsApp / Voice
         ↓
    Intent Engine
         ↓
    Entity Resolution
         ↓
    Authorization
         ↓
    Authoritative Domain Service
         ↓
    Transaction
         ↓
    Audit
         ↓
    EventBus
```

### Current Architecture (Violations Highlighted)

```
AI Chat → Direct DB queries (✅ read-only) → M8.13 calculateProgressMetrics (✅)
                                                  ↓
                                          AI text generation (✅ no mutation)

WhatsApp → FieldExtractor (GPT) → DbMatcher (⚠️ no DimensionRegistry)
                                       ↓
                                  [≥0.90 confidence]
                                       ↓
                                  ExecutionWriteService (✅)
                                       ↓
                                  Audit + EventBus (✅)

Voice → AudioProcessor → WhatsApp pipeline (✅ same path)
```

### What's Missing

| Gap | Current | Target |
|-----|---------|--------|
| Intent Engine | FieldExtractor (3 intents) | Structured taxonomy with 15+ intents |
| Entity Resolution | DbMatcher (string matching) | DimensionRegistry + domain resolver |
| Authorization | None (WhatsApp pipeline) | Permission check before EWS |
| Audit (AI chat) | None | `m16_interaction_logs` |
| Event context | Missing | Event-scoped entity resolution |
| Confirmation | Missing | Action-risk-based confirmation gate |
