# M15-R1 — Final Closure

**Date:** 8 September 2026  
**Milestone:** M15 Decision Intelligence Facade (first usable composition layer)

---

## Grades

| Gate | Grade |
|---|---|
| CODE | **GREEN** |
| TEST | **AMBER** |
| AUTHORITY | **GREEN** |
| SECURITY | **GREEN** |
| TENANT | **GREEN** |
| EVENT | **GREEN** |
| PERFORMANCE | **AMBER** |
| API | **GREEN** |
| DATABASE | **GREEN** |
| DOCUMENTATION | **GREEN** |

**Overall: AMBER**

No P0. R1 is architecturally a composition facade over M8–M14, not a second engine. Overall is AMBER because (1) inherited M13 readiness skip at ≥5K not-started activities still affects `getManagementRisks` completeness, and (2) the M8–M16 regression pack had two pre-existing M14 Puppeteer/Chrome timeouts in this environment.

Optimizing for a cosmetic GREEN would have required pretending those gaps were gone or rewriting M12 readiness. That was refused.

---

## Acceptance criteria

| # | Criterion | Result |
|---|---|---|
| 1 | No P0 | Met |
| 2 | R1 event-isolation P1s resolved or proven safe | Met for **consumed** paths; unused engines documented |
| 3 | Named forecasts + sources | Met |
| 4 | Impact types differentiated | Met |
| 5 | Single facade | Met — `DecisionIntelligenceService` |
| 6 | M13 rules reused | Met — `getSummary` / `CONTROL_TOWER_RULES` descriptions |
| 7 | M8.9 remains scenario engine | Met |
| 8 | Scenario calc non-mutating for live Activity | Met |
| 9 | M15 never calls EWS | Met |
| 10 | M15 never calls ResourceLevelingApplyService | Met |
| 11 | M15 does not calculate progress or CPM | Met (orchestrates M8.9 for what-if) |
| 12 | Evidence/provenance | Met |
| 13 | M16 can consume via thin adapters | Met (`m15ToToolResult`; tools not registered) |
| 14 | Org + event isolation tests | Met |
| 15 | No cross-event leakage on consumed joins | Met (constraints, CP graph, scenarios, facade) |
| 16 | No new second source of truth | Met — no new Activity/Workpack/Schedule tables |
| 17 | Performance acceptable | **Partial** — no extra N+1 from M15; inherited CT 5K skip remains |
| 18 | M8–M14/M16 regressions healthy | **Partial** — two M14 PDF timeouts (env) |
| 19 | No unrelated cleanup | Met |
| 20 | Git history untouched | Met — no commit |

---

## What shipped

**Facade**

- `src/core/m15/types.ts`
- `src/core/m15/DecisionIntelligenceService.ts`
- `src/core/m15/m16Adapter.ts`
- `src/core/m15/index.ts`

**API** (`app/`, not `src/app`)

- `GET /api/events/[eventId]/management/risks`
- `GET /api/events/[eventId]/management/forecast`
- `GET|POST /api/events/[eventId]/management/impact`

**Isolation remediations (minimal)**

- M13 constraint query: workpack event + org
- M11 `ScheduleOrchestrationService.resolveWorkingHoursPerDay`
- M8.9 scenario calc: calendar hours + event-scoped relationships
- M8.9 `createScenario` / override IDs via `crypto.randomUUID()` (schema has no `@default`)
- M8.8 CP intelligence: event-scoped relationships

**Tests:** `src/core/m15/__tests__/m15-r1-decision-intelligence.test.ts` (16)

**Docs:** this set (`M15_R1_*`).

---

## Remaining P2 / P3

See `docs/M15_R1_FORENSIC_AUDIT.md` §5.

Do not treat unused `bre_alerts` or `ScopeChangeImpactService` as M15-fixed. They are still unsafe if other code paths call them without event scope.

M16 live tools for `getManagementRisks` / `getForecast` / `getImpact` are a later milestone. R1 provides the adapter contract only.

---

## Forensic re-gate (post-implementation)

Independently re-read:

- Routes resolve to `DecisionIntelligenceService` only (no inline LATE/CPM/progress math).
- Call path for risks: facade → M13 `getSummary` → optional `ResourceRiskService` + CP counts.
- Call path for scenario: facade → M8.9 → `calculateSchedule` in memory → scenario snapshot.
- No M15 prisma writes to `Activity`.
- No EWS / leveling apply / `ScopeChangeImpactService`.

Conflict rule honored: M12 readiness was **not** forked to make Control Tower complete at 5K+ activities.

---

## Overall statement

M15-R1 is a **reliable deterministic composition layer** for management risks, named forecasts, and typed impact, with organization+event fail-closed queries.

It is **AMBER**, not GREEN, because completeness at large not-started volumes still depends on M13’s readiness skip, and M14 PDF tests did not run to completion in this environment.
