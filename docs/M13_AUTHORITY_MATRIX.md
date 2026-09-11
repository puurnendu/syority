# M13 Authority Matrix

This matrix explicitly maps system responsibilities to their authoritative service owners, ensuring M13 correctly delegates behavior.

| Domain Responsibility | Authoritative Component / Service | M13 Integration Method |
|-----------------------|-----------------------------------|------------------------|
| **Progress Calculation & EVM** | M8.13 (`ProgressCalculationService`, `ProgressAggregationService`) | **READ**: Call M8.13 services for SPI, CPI, EV, AC. |
| **Schedule, CPM & Float** | M11 (`ScheduleOrchestrationService`, `EvmSnapshotService`) | **READ**: Consume dates and float values established by M11. |
| **Execution Mutation (Status, Holds)** | M12 (`ExecutionWriteService`) | **DELEGATE**: Route any UI actions (Hold, Start) through M12 API. |
| **Execution Readiness (Gating)** | M12 (`ExecutionReadinessService`) | **READ**: Display constraints and readiness status. |
| **Planning Readiness** | M10 (`PlanningReadinessService`) | **READ**: Show planning gate completion. |
| **Dimensions & Structuring** | `DimensionRegistry`, `DimensionQueryBuilder` | **USE**: Build unified tenant-scoped queries using the registry. |
| **Management Dashboarding** | **M13** (`ControlTowerQueryService`, M13 UI) | **OWNER**: M13 owns the presentation and predictive aggregation logic (e.g., exception flagging based on read-only data). |

## M13 Core Responsibility
M13 is the **Authoritative Control-Tower / Management Visibility Layer**. It owns the orchestration of queries across M8.13, M11, and M12 to answer:
1. Where are we?
2. Are we ahead or behind plan?
3. What is late?
4. What is likely to become late?
