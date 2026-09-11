# M13 Turnaround Control Tower - Forensic Audit

## 1. Objective
Perform a repository-wide forensic audit before implementing M13 (Turnaround Control Tower & Management Intelligence) to identify reusable components, existing management metrics, duplication risks, and architectural boundaries.

## 2. Reusable Existing Services
- **M8.13 Progress:** `ProgressCalculationService`, `ProgressAggregationService` (Authoritative progress calculations, EVM).
- **M11 Schedule:** `ScheduleOrchestrationService` (Authoritative CPM and Schedule resolution), `EvmSnapshotService` (Time-phased data).
- **M12 Execution:** `ExecutionWriteService` (Mutation boundary), `ExecutionReadinessService` (Execution gating).
- **Workspace/Dimensions:** `WorkspaceQueryService`, `DimensionRegistry`, `DimensionQueryBuilder` (Cross-cutting dynamic data aggregation).

## 3. Reusable APIs
- `GET /api/projects/[id]/s-curve` (Existing EVM S-Curve data).
- `GET /api/workspace/query` (Existing dynamic grid/data querying).
- Existing Reporting APIs (`ManagementProviders`, `PlanningIntelligenceProviders`).

## 4. Reusable UI Components
- `SCurveChart.tsx` (Various implementations in Dashboard and Schedule modules).
- OIS Widget components (`ta-dashboard.tsx`, `CockpitLibraryService.ts`).
- Workspace grid and column choosers.

## 5. Existing Management Metrics
- S-Curve (Planned vs Actual vs Earned Value).
- Shift Reports (AI-driven generation and KPIs).
- Execution readiness constraints.
- RAG status (Milestone tracking).

## 6. Missing M13 Capabilities
- **Predictive Exception Engine:** "What is likely to become late?" requires aggregating SPI/CPI at the workpack/system level to flag upcoming exceptions.
- **Unified Control Layer:** Existing dashboards (`ta-dashboard.tsx`) are scattered or specialized. M13 requires a unified, high-level control tower view over M8.13, M11, and M12.

## 7. Authority Risks
- **Risk:** M13 attempting to re-calculate progress or CPM.
- **Mitigation:** M13 must strictly import and invoke `ProgressCalculationService.calculateProgressMetrics` and `ScheduleOrchestrationService` for any scheduled or progress-related aggregations.
- **Risk:** M13 dashboard actions (e.g., "force close" from dashboard) bypassing M12.
- **Mitigation:** Any action invoked from M13 MUST delegate to `ExecutionWriteService.applyAction`.

## 8. Tenant-Isolation Risks
- **Risk:** Aggregating data across an entire plant without tenant context.
- **Mitigation:** All M13 queries must accept and strictly filter by `organizationId` and `eventId`. `DimensionQueryBuilder` automatically applies these filters.

## 9. Performance Risks
- **Risk:** N+1 queries when loading a massive control tower dashboard (100K+ activities).
- **Mitigation:** Rely on pre-aggregated data (e.g., `ProgressLog`, EVM snapshots) and `WorkspaceQueryService` batch queries instead of iterating through Prisma `Activity` records on the fly.
