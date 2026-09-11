# M13-R1 Forensic Hardening Review

## 1. Current Implementation
The M13 Control Tower has been refactored to comply strictly with the read-only management intelligence layer constraint. Previous violations where M13 calculated SPI locally have been eradicated. The dashboard unifies execution progress, EVM-based SPI, schedule anomalies, readiness, and constraints into a single view without mutating data or acting as a secondary source of truth.

## 2. Authority Chain Verification

### Progress (M8.13 Authority)
- **Status:** COMPLIANT
- **Details:** Overall dashboard metrics and identical activity groupings are fetched exclusively from `ProgressAggregationService`. Activity-level `progress_percent` is queried directly from `prisma.activity` for anomaly evaluation; this acts as a direct read of the canonical physical progress state persisted by M12/M8.13.

### SPI (M8.10 Authority)
- **Status:** COMPLIANT
- **Details:** The local `SPI = EV / PV` calculation was removed from `ControlTowerQueryService`. It now uses `EvmSnapshotService.loadEvmActivities` combined with `EvmCalculationService.calculateActivityEvm` to fetch true EVM-based SPI values.

### Float (M11 Authority)
- **Status:** COMPLIANT
- **Details:** No CPM calculations exist in M13. M13 evaluates the `total_float` and `is_critical` flags directly from `prisma.activity`, reflecting the canonical output of the M11 Schedule Engine.

### Readiness and Constraints (M12 Authority)
- **Status:** COMPLIANT
- **Details:** M13 queries `ExecutionReadinessService.evaluateBulkReadiness` to identify blocked un-started activities, and `prisma.constraintLog` to identify constraint-blocked workpacks.

## 3. Exception Rules Formalization
Exceptions are no longer hardcoded business rules buried in the query service. They have been externalized into `src/core/control-tower/ControlTowerRules.ts` and cataloged in `docs/M13_CONTROL_RULES.md`.

**Implemented Rules:**
- `CRITICAL_LATE` (P1)
- `LATE` (P2)
- `READINESS_BLOCKED` (P2)
- `CONSTRAINT_BLOCKED` (P2)
- `ON_HOLD` (P3)
- `PROGRESS_LAG` (P3)
- `CRITICAL` (P3)
- `LOW_FLOAT` (P4)
- `UPCOMING_RISK` (P4)

## 4. Tenant Isolation
- **Status:** VERIFIED
- **Details:** Unit tests (`ControlTowerQueryService.test.ts`) assert that `organization_id` and `event_id` are passed faithfully down through every nested adapter and database call, including `ProgressAggregationService`, `EvmSnapshotService`, `ExecutionReadinessService`, and direct Prisma queries.

## 5. Performance Context
The service currently queries all active activities (excluding `completed` and `cancelled`) into memory. For large 100K+ activity datasets, memory overhead is bound by the active workfront size (typically ~5k-15k items at any given moment). 
- **Bulk Readiness:** Sent only for `not_started` items to bound the impact of N+1 database queries inherent in the current M12 `ExecutionReadinessService`. A complete optimization of `evaluateBulkReadiness` will be necessary as part of future M12 scaling operations.

## 6. S-Curve Data Integrity
The `SCurveChart` UI component fetches data via `/api/projects/[id]/s-curve`. This endpoint natively wraps the EVM generation layer. M13 correctly consumes the S-Curve component directly without attempting to re-plot its own curves, maintaining a single visual source of truth for EVM.

## 7. Browser Status
- **Status:** GREEN — CODE/TEST VERIFIED; BROWSER ACCEPTANCE PENDING
- **Details:** The `ControlTowerDashboard` includes all required drill-down URLs utilizing `WorkspaceQueryService` parameters (`/planner-workspace?eventId=X&filter=late`). Full visual verification pending browser availability.

## 8. Remaining M13 Phases
- **DEFERRED:** Advanced lookahead visualizations (e.g., Gantt overlays for upcoming week critical paths).
- **DEFERRED:** Real-time push notifications or WebSockets for P1 anomalies (currently relying on 60-second SWR polling).
