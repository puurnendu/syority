# M15-R0 — Scenario Engine Recommendation

**Date:** 8 September 2026  
**Finding:** A scenario engine **already exists**. M15 should wrap it, not invent a parallel store or CPM.

## What exists

| Piece | Role |
|---|---|
| `ScheduleScenario` (`schedule_scenarios`) | Persisted workspace: org + **event_id**, status machine, `snapshot_json`, `base_baseline_id` |
| `ScenarioActivityOverride` | Duration / planned_start / planned_end overrides; unique per (scenario, activity) |
| `ScenarioPlanningService` | Create/get/override/status; validates baseline in **same org+event** |
| `ScenarioDomainService.resolveEffectiveActivities` | Baseline rows + overrides → in-memory activities (org-scoped scenario fetch) |
| `ScenarioCalculationService.calculate` | Status → `calculating`; load **live** relationships (org + ids); `calculateSchedule`; resource constraints; SHI; write snapshot; `ready` |
| `calculateScenarioEvmProjection` | In-memory EVM vs live; **zero** live mutation |
| `ResourceLevelingService` | Separate in-memory sim; can persist as scenario `source_type: 'leveling'` |
| `ResourceLevelingApplyService` | **Writes live planned dates** then SOS CPM persist — **not** a scenario sandbox |
| `ScheduleChangeRequest` | Governance to promote scenario toward live plan |

Live authoritative plan is **not** mutated by `ScenarioCalculationService`. That matches the required architecture:

```
LIVE AUTHORITATIVE PLAN (Activity + relationships + M11 persisted CPM)
        │
        ▼
Scenario Snapshot (baseline + overrides + snapshot_json)
        │
        ▼
Scenario Inputs (duration/date overrides today)
        │
        ▼
M11 math: calculateSchedule (in-memory)  — NOT SOS persist
        │
        ▼
Scenario Results (snapshot, SHI, resource constraints, EVM projection)
        │
        ▼
M15 Impact / Decision Analysis (delta vs live / vs baseline)
```

## Option comparison

| Option | Description | Fit to repo | Risk |
|---|---|---|---|
| **A Clone/snapshot schedule and calculate independently** | Copy all activities to a side table and run a private CPM | Would duplicate `ScheduleScenario` + `baselineActivity` | Second persist path; drift from SOS |
| **B Pure in-memory using M11 engine** | No DB scenario row | `ResourceLevelingService` already does this | Lost audit; no M16/M14 handle; retries lost |
| **C Persisted scenario workspace only** | Store overrides without engine | Incomplete — no finish/CP delta | Useless for “slip 12h” |
| **D Hybrid snapshot + in-memory calc + persisted result** | Current M8.9 design | **Already implemented** | Gaps below |

**Recommendation: Option D — reuse M8.9 as-is, add an M15 facade.**

Do not implement a fifth scenario table.

## Can the repo answer “If HX-204 slips 12 hours?”

**Deterministically, yes, if** M15 (or M16) does:

1. Resolve activity in org+event (M16 entity resolver / DimensionRegistry).
2. `createScenario` on current baseline for that event.
3. `setActivityOverride` with `duration_hours` or `planned_end` += 12h (product rule must pick one; duration vs finish constraint are not the same).
4. `ScenarioCalculationService.calculate`.
5. Diff snapshot CPM finish / critical set vs live Activity fields.

**Not** via `ScopeChangeImpactService` (heuristic hours/crew, CP flag if impact > 10% of event duration, baseline lookup **without event_id**).

## Gaps (P1/P2 for M15-R2, not reasons to rebuild)

| Gap | Severity | Note |
|---|---|---|
| Override model has no crew, shift, constraint-removed, sequence-changed, or successor-rewire | P2 | “Add two crews / remove constraint / change sequence” are **not** first-class |
| Relationships always **live**, not snapshotted | P1 | Concurrent live logic edits during calculate can mix TA graph with scenario dates |
| `calculateSchedule` invoked outside SOS | P2 | Acceptable if persist=false and results stay on scenario; document as governed in-memory use |
| Working hours hardcoded `10` in ScenarioCalculationService vs SOS calendar | P1 | Scenario CPM may disagree with live CPM calendar |
| Resource assignments from **live** `activityResource`, not baseline | P2 | Mixed temporal sources |
| No M15/M16 one-shot API | P2 | Pieces exist; wrapper missing |
| Apply-to-live is leveling ApplyService / change requests — must stay governed M11 | P1 | M15 must never auto-apply |

## Isolation

- Scenario rows: `organization_id` + `event_id` — **good**.
- `getScenario(id, organizationId)` does not also require `eventId` in the finder — caller must not pass a scenario id from another event (IDOR if IDs leak). Recommend M15 always query `{ id, organizationId, eventId }`.
- Effective activities come from **that scenario’s baseline** (event-bound at create). Identical tags in TA-2028 cannot appear unless the baseline contains them.

## M15 rule

```
M15.runScenario() → ScenarioPlanning + ScenarioCalculation
M15 must not → ResourceLevelingApplyService
M15 must not → prisma.activity.update of planned dates
M15 must not → ExecutionWriteService
```

Promotion of a scenario to the live plan remains **M11 change-request / leveling apply** with human approval — not M15.
