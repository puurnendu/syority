# M15-R2 — Performance

**Date:** 8 September 2026

## Finding that drove R2

M13 skipped readiness at ≥5,000 not-started activities because `evaluateBulkReadiness` was:

```
for (id of activityIds) await evaluateReadiness(id)
```

Each call: activity + constraint count + relationships + permits (**N+1**).

## Remediation measurement (unit / query-count)

`evaluateBulkReadiness` for **50** activities (test `m12-bulk-readiness.test.ts`):

| Query | Count |
|---|---|
| `activity.findMany` | 1 |
| `constraintLog.findMany` | 1 |
| `activityRelationship.findMany` | 1 |
| `permit.findMany` | 1 |

Not 50×4.

M13 at **5,000** not-started (test `ControlTowerQueryService.test.ts`):

- `evaluateBulkReadiness` called **once** with 5,000 ids
- `readinessCoverage.complete === true` when the bulk map is complete

No new M15 cache. No second readiness formula.

## Remaining cost (honest)

| Path | Behavior |
|---|---|
| M13 `getSummary` | Still loads all active (non-completed) activities and runs `evaluateExceptions` in memory |
| M15 risks | One `getSummary` (limit 500) + CP intelligence + resource risk |
| CP intelligence | Event-scoped activities + event-scoped relationships |
| `getForecast` | SOS hours + M8.8 and/or M8.10; scenario only when requested |
| `runImpactScenario` | M8.9 in-memory CPM on explicit POST only |

**Not measured:** wall-clock on a live 5K-row database in this environment. Query-count and skip-removal are proven in tests.

## Caching

None added. Persisted M11 CPM and M13 summary remain the inputs. Scenario CPM is on-demand only.
