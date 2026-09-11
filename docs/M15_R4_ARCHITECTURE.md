# M15-R4 — Architecture

**Date:** 8 September 2026

```
AUTHORITATIVE FACTS / CALCULATIONS
        ↓
M13 operational intelligence
        ↓
M15 decision intelligence + advisory recommendation
        ↓
HUMAN MANAGEMENT DECISION  (append-only journal)
        ↓
M16 interaction (query / what-if / decision record)
        ↓
M16 authorization + ConfirmationGate   (execution intents only)
        ↓
M12 ExecutionWriteService
```

M15 does not call EWS. Recording ACCEPT does not start, release, or complete an activity.

---

## Layers (never collapsed)

| Concept | Owner | Persistence |
|---|---|---|
| Recommendation | M15 composer (as-of) | None (deterministic id) |
| Management decision | `ManagementDecisionService` | `m15_management_decisions` |
| Execution request | M16 intent + ConfirmationGate | Pending confirmation + interaction log |
| Execution | M12 EWS | Execution/audit authorities |

---

## M16 tools (trusted ctx only)

`getManagementRisks` · `getRecommendations` · `getManagementForecast` · `getManagementImpact` · `runWhatIf` · `recordManagementDecision`

LLM cannot supply `organizationId` / `eventId` / `userId`. Adapter ignores spoofed params.

`RECORD_MANAGEMENT_DECISION` is a **QUERY-category** journal write so it cannot enter the EWS write-tool path. It still requires `ctx.userId`.

---

## What-if

Unchanged from R3. Unsupported kinds return `NOT_SUPPORTED`.
