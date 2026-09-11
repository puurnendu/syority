# M15-R0 — Security Matrix

**Date:** 8 September 2026  
M15 is **read intelligence** and **write recommendation records** only. Execution stays M12/M16.

| Control | Current state | M15 requirement | Grade if M15 shipped naively | Notes |
|---|---|---|---|---|
| Authentication | NextAuth/JWT on web APIs; M16 channel identity | Same — no anonymous intelligence | GREEN | Do not add public M15 routes |
| Authorization | `guardApi` / RBAC; M16 fail-closed on writes | New permission(s) e.g. `intelligence.read`, `intelligence.recommend`, `scenario.calculate`; management-only for some views | AMBER | No dedicated intelligence permission found in `permissions.ts` grep |
| Tenant isolation | Most services take `organizationId` | Always session org; never LLM/body org | GREEN if callers pass session org | Fail-closed like M16 |
| Event isolation | Mixed | Mandatory `eventId` on every M15 query | **AMBER/RED if consuming CT constraints or BRE alerts as-is** | See below |
| Scenario isolation | Scenario has org+event; get-by-id is org-only | Require org **and** event match | AMBER | Prevent TA-2027 scenario id used in TA-2028 session |
| Data exposure | CT/EVM/progress are operationally sensitive | Role-gate contractor performance, cost EAC, recommendations | AMBER | M14 already exposes EVM in reports |
| Recommendation integrity | `RecommendationEngine` human accept; never auto-executes | Keep; **forbid `source_type: 'ai'` as sole authority for scores** | AMBER | Schema allows `ai` |
| AI interaction | Alerts have `ai_explanation`; M16 pipeline | Facts → deterministic M15 → recommendation → AI **explains** only | GREEN if designed so | M16 PromptInjectionBoundary already exists |
| Prompt injection | M16 adapters + pipeline block list | M15 inputs are ids/hours from app, not prompt-chosen org/event | GREEN | M16 must not pass LLM-chosen scenario ids without resolver |
| Audit | EWS AuditLog; `bre_recommendation_log`; scenario status | Audit generate/accept/reject/calculate | GREEN if using BRE + scenario | Query-only reads: optional |
| Management action ownership | `assigned_to` on alerts; `accepted_by` on recommendations; ConstraintLog `owner` | Pick one register (recommend BRE) | AMBER | Split ownership today |
| M16 integration | CT read tool only | Thin tools; no M15 math in adapters | GREEN | |
| M12 execution boundary | EWS sole named actions | M15 never imports EWS/apply leveling | GREEN if enforced | |
| Scenario write vs live write | Calculation writes snapshot only | Enforce; code review ApplyService | GREEN (exists) | |
| Secret leakage | Channel routes generic errors | Same for any future M15 API | GREEN | |

## Isolation defects M15 must not inherit

| Source | Defect | Impact |
|---|---|---|
| `ControlTowerQueryService` critical constraints | `constraintLog.findMany({ organization_id })` — **no event** | TA-2027 summary can mark workpacks blocked by TA-2028 constraints in same org |
| `ConstraintLog` schema | No `event_id`; event only via workpack | Easy to omit join |
| `ScopeChangeImpactService` | `scheduleBaseline.findFirst({ organization_id, is_current: true })` | Wrong event baseline |
| `bre_alerts` | No `event_id` | Cross-event alert mix in org |
| `bre_recommendations.event_id` | Optional | Event-less recs in an event UI |
| `FieldExecutionService.getPlanVsActual` | `eventId` optional | Org-wide variance if omitted |

Conceptual tests M15 APIs must pass:

| Org | Event | Must not see |
|---|---|---|
| A | TA-2027 | Org B anything; Org A TA-2028 HX-204 |
| A | TA-2028 | TA-2027 scenario snapshots, exceptions, recs |
| B | any | Org A baselines/scenarios |

## Distinguish three verbs

| Verb | Allowed M15 | Forbidden M15 |
|---|---|---|
| READ intelligence | Query compose | Recalculate CPM persist / progress |
| WRITE recommendation | `bre_recommendations.generate` + log | Auto-accept; auto-leveling apply |
| EXECUTION action | None | EWS, planned_date apply, activity status |

## AI

- LLM must not compute risk scores, SPI, float, or “is critical”.
- `ai_explanation` on alerts is explanation of a **rule trigger**, not a substitute for M11 `is_critical`.
- M16: “What are the top risks?” → M15 `getManagementRisks(org, event)` → formatter.

## Recommendation

Do not start M15 APIs until event scoping is specified on every consumer (even if the fix lives in M13/M8 later). Treat inherited isolation bugs as **P1 for M15 consumption**, not as permission to copy them.
