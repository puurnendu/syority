# M15-R3 — Architecture

**Date:** 8 September 2026

M15 remains a **read-only decision intelligence composition layer**.

```
AUTHORITATIVE FACTS (M8.13, M11, M12, M13, …)
        ↓
AUTHORITATIVE CALCULATIONS (M8.8, M8.9, M8.10, M11 CPM-in-scenario)
        ↓
M13 / M15 INTELLIGENCE (exceptions + management priority)
        ↓
M15 RECOMMENDATION (advisory CONSIDER text)
        ↓
M16 INTERACTION (adapter; confirmation)
        ↓
M12 EWS EXECUTION
```

R3 does **not** execute. R3 does **not** create a second recommendation register.

---

## Composition path

1. `getRecommendations(org, event, filters?)`
   - Calls R2 `getManagementRisks` (M13 exceptions + resource risks, ranked).
   - Maps each risk through `composeRecommendation`.
   - Filters by priority / category / activityId.
   - Caps at **50**; sets `recommendationsTruncated`.
2. Each recommendation copies **evidence from the risk**. Empty evidence → `INSUFFICIENT_EVIDENCE`.
3. `estimatedImpact` is always `null` on composition. Numeric finish deltas come only from `runWhatIf` when M8.9 (or leveling sim) actually produces them.

## What-if path

`runWhatIf(org, event, userId?, input)`:

| Kind | Behaviour |
|---|---|
| `DURATION_SLIP` | M8.9 override `duration_hours = current + slip` |
| `DURATION_CHANGE` | M8.9 override absolute `duration_hours` |
| `DELAYED_START` | M8.9 override `planned_start` shifted by `delayDays` |
| `RESOURCE_LEVELING_SIMULATION` | `ResourceLevelingService.generateLevelingRecommendations` (PROPOSED) |
| `ADDITIONAL_CREWS` | `NOT_SUPPORTED` |
| `CONSTRAINT_REMOVAL` | `NOT_SUPPORTED` |
| `SCOPE_CHANGE` | `NOT_SUPPORTED` (M8.11 heuristic not used) |

M8.9 writes **scenario store only**. `ScenarioCalculationService` does not `prisma.activity.update`. Leveling apply is never called.

Unsupported kinds never invent a finish date.

## Layers preserved

| Layer | Where |
|---|---|
| FACT | M13 exception code, M11 critical flag, M12 readiness via exception |
| CALCULATION | M8.8/M8.9/M8.10, float, SPI citation |
| INTELLIGENCE | `m15-management-priority@1.0` score |
| RECOMMENDATION | Composer text (`calculationType: RECOMMENDATION`) |
| SCENARIO | What-if result `hypothetical: true` |

The recommendation text is **not** an authoritative fact.

## Execution boundary

```
RECOMMENDATION  →  MANAGEMENT DECISION  →  EXECUTION ACTION
     M15                 (human / M16)         M12 EWS
```

M15 never calls EWS, never mutates live Activity, never applies leveling, never skips M16 confirmation.
