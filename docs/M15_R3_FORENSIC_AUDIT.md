# M15-R3 — Forensic Audit

**Date:** 8 September 2026  
**Predecessor:** M15-R2 CLOSED AMBER (not reopened except where R3 required a contract extension).

---

## 1. Current-state map (verified against the tree)

| Layer | Location | Role |
|---|---|---|
| M15 facade | `src/core/m15/DecisionIntelligenceService.ts` | Composition only |
| R2 risks / evidence / ranking | same + `managementPriority.ts` | Inputs to R3 recommendations |
| R3 composer | `src/core/m15/recommendationComposer.ts` | Deterministic CONSIDER text |
| M13 | `ControlTowerQueryService` + `ControlTowerRules` | Exception detection |
| M12 | `ExecutionReadinessService` | Readiness (bulk since R2) |
| M8.8 | `ScheduleForecastService` | Execution finish forecast |
| M8.9 | `ScenarioPlanningService` / `ScenarioCalculationService` | Isolated scenario CPM |
| M8.10 | `calculateLiveEvm` | EAC / SPI / CPI |
| M8.11 | `ScopeChangeImpactService` | Heuristic; **not consumed** |
| M8.13 | `Activity.progress_percent` | Cited, not recalculated |
| M11 | SOS calendars, `Activity.is_critical`, relationships | Cited / scenario calendar |
| M12 EWS | `ExecutionWriteService` | **Forbidden** from M15 |
| Leveling sim | `ResourceLevelingService.generateLevelingRecommendations` | In-memory PROPOSED rows |
| Leveling apply | `ResourceLevelingApplyService` | **Forbidden** |
| BRE | `src/core/bre/RecommendationEngine.ts` + `bre_recommendations` | Lifecycle register; **not used** |
| M16 | `m15ToToolResult` adapter only | No live tool registration |
| UI | `/events/[eventId]/management-intelligence` | Advisory panel, not Control Tower |

R2 remaining AMBER (performance soak, M14 Puppeteer) is unchanged and is not treated as an R3 defect.

---

## 2. Recommendation-engine reuse decision

**Do not persist via BRE `RecommendationEngine` / `bre_recommendations`.**

Classification of candidates:

| Candidate | Class | Decision |
|---|---|---|
| BRE `RecommendationEngine` | **F unsafe for M15 reuse** (also **A** as a *lifecycle register*, not a composer) | Do not call `generate` / `accept` / `list` |
| `bre_recommendations` | **F** persist + optional `event_id` + required `confidence_score` + `source_type` includes `ai` | Do not write |
| `RecommendationEngine.getById(id)` | **F** unscoped by org/event | Would leak if reused |
| `RecommendationEngine.list` without `eventId` | **F** org-wide | Would violate event isolation |
| R2 `ManagementRisk` + evidence | **B** reusable intelligence | Compose from this |
| M13 exceptions | **A** detection | Consume via R2, do not fork |
| M8.8 / M8.9 / M8.10 | **A** forecasts | Cite / invoke scenario calc |
| `ResourceLevelingService` | **B** simulation | What-if only; never apply |
| `ResourceLevelingApplyService` | **F** | Forbidden |
| M8.11 scope-change | **E/F** heuristic, not CPM | `NOT_SUPPORTED` |
| M16 `ActionRiskLevel` | **C/F** different domain | Unused |
| Dashboard widgets / OIS | **C** presentation | Unused |

### Why BRE is not suitable for M15 management recommendations

1. It is a **persisted human-workflow register** (`pending → presented → accepted|rejected|…`), not an in-memory composition of M13/M8 facts.
2. `event_id` is **nullable**. Listing without it is organization-wide.
3. `getById` is **id-only** (no org/event guard).
4. `confidenceScore` is **required**. M15 must not invent confidence.
5. `source_type` includes **`ai`**. LLM/confidence must not become recommendation authority.
6. Persisting M15 output there would create a **second source of truth** that can drift from live M13/M12/M8 as-of.

M15 therefore **composes in memory** from R2 `ManagementRisk` using `m15-recommendation-compose@1.0`. Status is `ADVISORY` or `INSUFFICIENT_EVIDENCE`. No BRE row is created.

---

## 3. R3 gap list (pre-implementation, now closed unless noted)

| Gap | R3 action |
|---|---|
| No management recommendation object | Composer + `ManagementRecommendation` |
| No PROBLEM→EVIDENCE→OPTIONS→CONSEQUENCE chain | Template fields on each rec |
| No GET recommendations API | `/management/recommendations` |
| What-if only via `runImpactScenario` slip | `runWhatIf` with typed kinds |
| Unsupported overrides could be faked | Explicit `NOT_SUPPORTED` / `INSUFFICIENT_DATA` |
| M16 had no recommendation op | Adapter `getRecommendations` / `runWhatIf` |
| No management UI distinct from M13 | Management intelligence page |
| Filters for area/unit/system | **Not implemented** (entities are activity/workpack; P3) |
| Live 5K soak | **Not claimed** (P2, inherited) |

---

## 4. Callers after R3

- HTTP: `GET .../management/recommendations`, `POST .../management/what-if`
- M16: `m15ToToolResult` only (still not registered as live tools)
- UI: `ManagementIntelligencePanel` → those routes
- No Prisma writes of Activity / baseline / EWS from M15
- M8.9 `createScenario` / `setActivityOverride` / `calculate` for supported duration/start kinds only (scenario store, not live schedule)

---

## 5. Remaining P2 / P3 (inherited + R3)

See `docs/M15_R3_FINAL_CLOSURE.md`.
