# M15-R2 — Architecture

**Date:** 8 September 2026

```
M8–M12 facts/calculations
        ↓
M13 Control Tower (detection + coverage metadata)
        ↓
M15 DecisionIntelligenceService
   ├── Management risks (priority ≠ M13 severity)
   ├── Named forecasts + assumptions + quality
   ├── Typed impact (count ≠ hours)
   ├── Layered evidence
   └── M8.9 scenario orchestration
        ↓
M16 m15ToToolResult (trusted ctx only)
```

R2 does not add engines. It hardens explainability and large-volume readiness **through M12/M13**.

---

## 1. Management risk

M13: exception **detection** (`evaluateExceptions` / `ControlTowerRules`).

M15: **management priority** via `managementPriority.ts` model `m15-management-priority@1.0`.

`exceptionSeverity` remains P1–P4. `priority` is M15 intelligence. `severity` aliases `priority` for R1 consumers.

Return shape (R2 contract):

```
ManagementRiskResult { risks[], completeness, rankingModel, asOf, organizationId, eventId }
```

---

## 2. Evidence layers

Every evidence row has `layer`:

| Layer | Meaning |
|---|---|
| FACT | Recorded operational field |
| CALCULATION | Authoritative derived metric |
| INTELLIGENCE | M15 composition / ranking |
| RECOMMENDATION | Advisory text only — not executed |

---

## 3. Forecasts

Unchanged types. Each result now has `assumptions[]`, `quality`, `asOf`, `confidence: NOT_AVAILABLE`.

Calendar hours come from M11 SOS, never a facade 8/10/24 default.

---

## 4. Impact

| Field | Unit |
|---|---|
| slip | hours |
| network / `downstreamActivityCount` | activity count |
| resource | risk_record_count |
| `networkCompletionImpactHours` | hours from M8.9 only; **null** on `getImpact` |

---

## 5. Readiness completeness

M15 does not compute readiness.

M13 `readinessCoverage.complete` is copied into `ManagementRiskResult.completeness`. Incomplete evaluation must not be implied complete.

---

## 6. APIs

Same R1 routes. `GET .../management/risks` now returns the bundle (risks + completeness), not a bare array.
