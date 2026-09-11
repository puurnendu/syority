# M15-R2 — Forensic Audit

**Date:** 8 September 2026  
**Predecessor:** M15-R1 CLOSED AMBER (not reopened except where R2 required a contract extension).

---

## 1. R1 source vs docs

R1 closure matched the tree:

- Facade: `src/core/m15/DecisionIntelligenceService.ts`
- Routes under `app/api/events/[eventId]/management/*`
- M16 adapter module only (no live tools)
- M13 constraint join event-scoped via workpack
- Scenario calendar via SOS `resolveWorkingHoursPerDay`

The R1 AMBER cause **was real in source**:

```
if (notStartedIds.length > 0 && notStartedIds.length < 5000) {
  readinessMap = await ExecutionReadinessService.evaluateBulkReadiness(...)
}
```

Root cause was **not** M13 wanting a second readiness engine. `evaluateBulkReadiness` was an N+1 loop calling `evaluateReadiness` per id (constraints + relationships + permits each). The 5K guard hid `READINESS_BLOCKED` while presenting a full Control Tower / M15 answer.

---

## 2. Competing M15 paths

Repository search: the only composition entry is `DecisionIntelligenceService`. M16 still uses `ControlTowerQueryService` directly for `getControlTowerSummary` (M13, not a second M15).

No `M15ReadinessService`, no M15 CPM, no M15 progress.

---

## 3. R2 remediations (authorities, not forks)

| Change | Authority | Why |
|---|---|---|
| `ExecutionReadinessService.evaluateBulkReadiness` set-based (4 queries) | **M12** | Same blocker rules: critical constraints, incomplete predecessors, permits |
| `evaluateReadiness` delegates to bulk for one id | **M12** | Formula cannot drift |
| `PermitService.evaluatePermitRecords` shared | Permits / M12 | Same issued/expiry rules |
| M13 always calls bulk; **5K skip removed** | **M13** | Still consumes M12; does not calculate readiness |
| `readinessCoverage` + `exceptionCoverage` on summary | **M13** | Hidden truncation is no longer presented as complete |
| M15 `exceptionLimit: 500` | **M15 consumer** | Dashboard default remains 100 |
| Management priority model v1 | **M15** | Ranks M13 exceptions; does not detect them |
| Evidence layers + forecast quality | **M15** | Composition metadata |
| Scenario override must belong to scenario event | **M8.9** | Isolation |
| Snapshot `calendar.working_hours_per_day` | **M8.9** | Evidence of M11 hours |

---

## 4. What was not done (correctly)

- No M12 readiness formula copy inside M15
- No silent deletion of the 5K guard without replacing N+1
- No ScopeChangeImpactService
- No EWS / leveling apply
- No live M16 tool registration
- No autonomous recommendations
- No schema / new action register
- M14 Puppeteer tests not weakened

---

## 5. Remaining P2 / P3

- M13 still loads all non-completed activities and evaluates rules in memory (dashboard cost at 100K).
- Exception lists still **capped** (100 dashboard, 500 M15) with `exceptionCoverage.truncated`.
- `bre_alerts` / `ScopeChangeImpactService` isolation debt unchanged (unused by M15).
- No live 5K-row database soak in this environment (query-count proven in tests).
- M14 PDF tests still require Chrome (R1 pre-existing).
