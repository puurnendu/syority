# M15-R0 — Forensic Audit

**Date:** 8 September 2026  
**Scope:** Repository-wide discovery for proposed M15 Enterprise Decision & Operations Intelligence.  
**Method:** Source inspection of `src/core`, Prisma models, M16 tools, M13/M14 providers. **No code, schema, API, test, or Git changes.**

**Git context (observational):** working tree includes closed M16-R6 work; this audit does not modify it.

---

## 1. Executive summary

The platform already contains most **ingredients** of M15 — Control Tower exceptions (M13), EVM (M8.10), progress (M8.13), CPM (M11), execution/readiness/constraints (M12), remaining-duration forecast and SHI (M8.8), persisted what-if scenarios (M8.9), resource risk/forecast/leveling, BRE alerts/recommendations, and M16 as a governed interaction layer.

What does **not** exist is a **single decision-intelligence facade** with consistent event isolation, named forecast methods, slip-hours impact as one API, and a unified management-action model.

**M15-R0 verdict: AMBER**

No P0 that makes M15 impossible. P1 gaps (isolation in some consumers, conflicting forecast/impact definitions, M13/M15 overlap, scenario calendar mismatch, forbidden apply paths) must be designed **before** feature code.

M15 must **compose** existing authorities, not calculate progress, CPM, SPI, or readiness again.

---

## 2. Repository inventory (decision-relevant)

| Area | Location |
|---|---|
| Progress | `src/core/progress/*` |
| EVM | `src/core/evm/*` |
| CPM / schedule | `src/lib/scheduleEngine.ts`, `src/core/schedule/ScheduleOrchestrationService.ts` |
| Scenarios | `src/core/schedule/scenario/*`, Prisma `ScheduleScenario` |
| Control Tower | `src/core/control-tower/*` |
| Execution | `src/core/execution/*` |
| Planning readiness | `src/core/planning/PlanningReadinessService.ts` |
| Resources / forecast / risk / leveling | `src/core/resources/*` |
| Scope impact | `src/core/scope-change/ScopeChangeImpactService.ts` |
| BRE | `src/core/bre/*`, `bre_alerts`, `bre_recommendations` |
| Reports | `src/core/report-engine/providers/*` |
| M16 | `src/core/m16/*` — CT/progress/constraints/delays tools only |
| Materials | `src/core/materials/MaterialConstraintService.ts` |
| Issues / discovery | `engineering-issues`, `DiscoveryWork` |

There is **no** `src/core/m15` and no `docs/M15_*` prior to this R0 set.

---

## 3. Existing intelligence

Already derived (not raw facts):

- M13 exception codes (LATE, CRITICAL_LATE, READINESS_BLOCKED, CONSTRAINT_BLOCKED, ON_HOLD, PROGRESS_LAG, CRITICAL, UPCOMING_RISK)
- ResourceRisk scores + `recommended_action` strings
- ScheduleForecast finish dates (four methods)
- ResourceForecast utilization/shortage
- SHI 0–100
- CriticalPathIntelligence (float distribution, downstream_impact)
- Leveling PROPOSED date moves
- Scenario snapshots (CPM + resources + SHI)
- EVM scenario projection
- Scope-change heuristic impact
- BRE alerts and recommendations
- Contractor/discipline dimension progress (M8.13 via M13)

---

## 4. Existing calculations vs authority

See `docs/M15_R0_INTELLIGENCE_INVENTORY.md` and `docs/M15_R0_AUTHORITY_MATRIX.md`.

Live **authoritative** math:

- Progress: M8.13  
- EVM: M8.10  
- CPM persist: M11 SOS  
- Planning readiness: M10  
- Execution readiness: M12  
- Execution writes: M12 EWS  

**Derived / adapter:** M13, M8.8 intelligence services, resource risk, scenarios (in-memory CPM).

---

## 5. Authority map (how M15 should consume)

| Milestone | Consume how |
|---|---|
| M8.13 | `getEventProgress` / dashboard summary — never re-weight |
| M10 | Planning readiness checks as evidence, not mixed into M12 formula |
| M11 | Read `is_critical`, float, dates; scenario uses `calculateSchedule` in memory; persist only via SOS |
| M12 | Facts from FieldExecution/EWS results; readiness via ExecutionReadinessService |
| M13 | `getSummary` as the operational exception/KPI bundle |
| M14 | M15 provides DTOs; providers stay adapters |
| M16 | New read tools later; no intelligence math in channel adapters |

---

## 6. Duplicate engines

Highest-risk duplicates for M15:

1. **Finish forecast** — `ScheduleForecastService` vs scenario CPM finish vs EAC.  
2. **Impact** — scope heuristic vs CP downstream count vs scenario network.  
3. **Exceptions** — M13 vs BRE alerts vs ConstraintLog.  
4. **Recommendations** — BRE vs leveling vs ResourceRisk strings.  
5. **Variance** — plan-vs-actual hours vs baseline days vs EVM SV.  
6. **Readiness** — M10 vs M12 (valid split; M15 must cite which).

SPI in M13 uses `calculateActivityEvm` (adapter to M8.10), not a rogue SPI formula.

---

## 7. Data lineage

See `docs/M15_R0_DATA_LINEAGE_MATRIX.md`.

Provenance is **possible** from activity fields + exception `sourceAuthority` + constraint rows + successor graph. Missing: a standard **evidence DTO** and event filters on several consumers.

---

## 8. Risk / forecast findings

**Risk:** No enterprise risk object. Closest: M13 exceptions (schedule/readiness/constraint) + ResourceRisk (capacity). Activity/workpack/unit/contractor **composite** risk is missing. M16 `ActionRiskLevel` is unrelated.

**Forecast:** Duration/progress forecast exists (M8.8) but is poorly integrated with M16/M13. Network forecast exists only inside **scenarios**. Cost forecast is EAC. M15 must **name the method** on every forecast output.

---

## 9. Dependency / impact findings

- Network: `ActivityRelationship` + `CriticalPathIntelligenceService` transitive successors (DFS with cycle guard + cache).  
- “Slip 12 hours”: **not** a public one-shot; **can** be done with M8.9 overrides + calculate.  
- ScopeChangeImpact: **not** network-safe; **do not** use for this question.  
- Cross-system/unit cascade: workpack has asset/unit; no dedicated M15 graph.

---

## 10. Scenario findings

See `docs/M15_R0_SCENARIO_ENGINE_RECOMMENDATION.md`.

Option **D already implemented**. P1: live relationships + hardcoded 10h/day vs SOS calendar; get-by-id org-only.

---

## 11. Optimization findings

`ResourceLevelingService` + `ResourceConflictService` = in-memory recovery/leveling simulation. Apply path writes live plan via M11 SOS. M15 may **simulate**. Sequencing/shift/crew-add as override types are **missing**.

---

## 12. AI findings

- M16: LLM classifies intent; cannot set org/event; writes only via EWS after R3.  
- BRE: `source_type` includes `ai`; alerts have `ai_explanation`.  
- Workpack/Document “intelligence” = planning/extraction, not TA decisions.  
- **No evidence** that an LLM currently computes SPI/CPM/progress as authority.  
- M15 must keep: facts → deterministic engine → recommendation → optional LLM explanation.

---

## 13. M13 overlap

M13 **is** management-exception intelligence plus KPI composition. Recreating LATE/CRITICAL_LATE in M15 is a duplicate engine.

**Boundary:** M13 detects and displays; M15 ranks, forecasts, scenarios, recommends, explains with evidence packs. M15 **calls** `ControlTowerQueryService`, does not replace `ControlTowerDashboard`.

**Inherited P1:** constraint query without event scope.

**Performance:** bulk readiness skipped if ≥ 5000 not-started activities — silent intelligence gap on large TAs.

---

## 14. M14 overlap

Management/planning providers already delegate to M8.10, M10, M13. M15 should add **datasets** (risk list, scenario delta), not new EVM math.

---

## 15. M16 boundary

Today M16 can explain Control Tower, progress, constraints, delays, readiness — **not** “top risks” or “slip 12h” as first-class tools.

Future:

```
M16 "top three risks?" → M15.getManagementRisks()
M16 "HX-204 slips 12h?" → M15.runImpactScenario() → scenario calc
M16 "start HX-204" → R3 → EWS   (unchanged; not M15)
```

M16 must not copy M15 formulas. Confirmation/auth stay R3.

---

## 16. Tenant / event isolation

**Good:** Progress, SOS, scenarios (on create), ResourceRisk activity load (`event_id` + `organization_id`), M16 entity resolver (org+event for WP/activity).

**Weak:** CT constraints; ConstraintLog schema; BRE alerts; optional event on recommendations; optional event on plan-vs-actual; scope-change current baseline; scenario get by org+id only.

Identical tag HX-204 across TA-2027/2028 is safe **only** if every M15 query includes `event_id` the way M16 workpack/activity resolve does.

---

## 17. Security

See `docs/M15_R0_SECURITY_MATRIX.md`.

No M15-specific permission. Recommendations already “never auto-execute.” Leveling apply is the dangerous write adjacent to intelligence.

---

## 18. Performance

| Path | Concern | Scale |
|---|---|---|
| `ExecutionReadinessService.evaluateBulkReadiness` | N+1 per activity | Documented; CT caps at 4999 |
| `CriticalPathIntelligenceService` | Full activity load + DFS (cached) | 10k OK-ish; 100k+ heavy |
| `ResourceLevelingService` | Loads **all** event activities + rels + resources in memory | 100k+ risky |
| `ScenarioCalculationService` | Full effective set + rels + resource analysis | Same |
| M13 `getSummary` | Progress + EVM per activity + active activities + optional readiness | Large TAs skip readiness |
| Unbounded relationship walk | Guarded by visited set | Cycles OK; still O(E) |

M15 must not add a second full-event CPM persist on every risk poll. Prefer persisted M11 fields for live risk; full engine only for scenarios.

---

## 19. Architecture recommendation

See `docs/M15_R0_DECISION_INTELLIGENCE_ARCHITECTURE.md`.

Facade over existing services; Option D scenarios; BRE for recommendation persistence; never EWS/leveling apply.

---

## 20. Findings

### P0

None. Authorities required for M15 exist. No mandatory second source of truth.

### P1

1. Consuming M13 constraint blocking **without event filter** would mix events.  
2. Three incompatible “forecasts” if M15 exposes one unlabeled number.  
3. Scope-change impact **must not** back “slip N hours.”  
4. Scenario CPM calendar (`working_hours_per_day: 10`) vs SOS `CalendarEngine` — scenario vs live disagreement.  
5. Scenario uses **live** relationships (not snapshotted).  
6. `bre_alerts` lack `event_id`.  
7. M15 vs M13 exception-rule duplication if M15 forks `ControlTowerRules`.  
8. `ResourceLevelingApplyService` adjacent — product must not let M15/M16 “optimize” apply live dates without M11 governance.  
9. Readiness bulk N+1 / 5k skip — large-event intelligence silently incomplete.  
10. `ScopeChangeImpactService` baseline query missing `event_id`.

### P2

- No M15 facade or M16 tools.  
- Override model cannot express crew/shift/sequence/constraint-removal.  
- Split action registers (BRE / alerts / constraints / issues).  
- `bre_recommendations.event_id` nullable; `source_type: 'ai'` allowed.  
- Scenario get-by-id without event.  
- No standard evidence DTO.  
- ScheduleForecast weakly wired to interaction/reporting.  
- SHI vs CT vs ResourceRisk — three “health” stories.  
- ConstraintLog has no `event_id` column.  
- Naming: M8.8 services live under `resources/`; M16 “risk” vs operational risk.

### P3

- Platform `AnalyticsService` relevance unknown.  
- WorkpackIntelligenceService name collision.  
- CP intelligence `downstream_impact` is activity-count, not hour-slip.  
- Hardcoded emoji/lock in M16 permission text (unrelated).  

---

## 21. M15 release recommendation

**Do not implement a greenfield intelligence platform.**

| Release | Content |
|---|---|
| **M15-R1** | Read-only facade: risks from M13 (+ ResourceRisk), named forecasts, evidence DTO, strict org+event, **no** new schema if possible |
| **M15-R2** | `runImpactScenario` wrapping M8.9; fix/document calendar + relationship snapshot **as M11/M8.9 work if required** |
| **M15-R3** | Recommendation policy → `RecommendationEngine` (rule/kpi only) |
| **M15-R4** | Optimization **simulate** only |

Gate R1 on: event-scoped constraint reads (even if the join is in the facade, not a schema change).

---

## 22. Final verdict

**AMBER**

The architecture **can** support M15 as a composer. It cannot support M15 as a new progress/CPM/readiness/EVM engine, and it cannot safely expose unlabeled forecasts or M13 constraint flags until event isolation is specified.

Related documents:

- `docs/M15_R0_AUTHORITY_MATRIX.md`
- `docs/M15_R0_DATA_LINEAGE_MATRIX.md`
- `docs/M15_R0_INTELLIGENCE_INVENTORY.md`
- `docs/M15_R0_SCENARIO_ENGINE_RECOMMENDATION.md`
- `docs/M15_R0_SECURITY_MATRIX.md`
- `docs/M15_R0_DECISION_INTELLIGENCE_ARCHITECTURE.md`
