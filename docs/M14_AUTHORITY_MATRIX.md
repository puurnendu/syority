# M14 Authority Matrix

**Absolute Rule:** M14 is a presentation and orchestration layer. It is explicitly prohibited from creating, maintaining, or calculating business logic that competes with the established STO authorities.

Any discrepancy between M14's output and the underlying authority must be resolved by fixing the M14 query, not by adjusting logic in M14.

| Information Domain | Authoritative Source | Notes for M14 Consumption |
| :--- | :--- | :--- |
| **Physical Progress** | M8.13 (`ProgressAggregationService`) | M14 must never calculate progress from activities itself. |
| **Planned Schedule** | M11 (`ScheduleEngine`, Baseline) | M14 must use M11 explicitly. Do not invent planned progress if M11 only provides dates. |
| **CPM / Float / Critical Path** | M11 (`CriticalPathIntelligenceService`) | Do not recalculate float in the reporting engine. |
| **Execution Status** | M12 `FieldExecutionService` | Use M12 status payload via authoritative methods like `getPlanVsActual`. |
| **Readiness / Constraints** | M12 `FieldExecutionService` | Do not build custom constraint logic or readiness checks; defer to M12 methods. |
| **Management Exceptions** | M13 (`ControlTowerQueryService`) | Lookaheads and SPI exceptions come strictly from M13. M13 remains absolute authority for management exceptions. |
| **Dimensions & Grouping** | `DimensionRegistry` | M14 must group by Tenant UDFs and standard dimensions via the registry, not hardcoded `customText1` fields. |
| **Reporting / Communication** | M14 | M14 owns the definition of report layouts, schedules, and delivery, but NOT the data it portrays. |

## Data Provenance & Immutability
All M14 generation flows must produce an **immutable `ReportDataset`**. This singular, immutable JSON dataset must be uniquely consumed by HTML, PDF, XLSX, and CSV renderers. Renderer implementations are forbidden from directly executing independent business queries or recalculating progress metrics. Report generation must store snapshot metadata capturing who generated the report, when, and the applied filters.

## Explicit Prohibitions
1. M14 MUST NOT calculate progress (`M14ProgressService` is forbidden).
2. M14 MUST NOT calculate EVM/SPI/CPI (`computeEvm` in `ManagementProviders.ts` must be removed).
3. M14 MUST NOT calculate Lookaheads (consume from M13).
4. M14 MUST NOT calculate Delays (consume from M11 / M12).
5. All providers across `report-engine/providers` (Safety, Workforce, Platform, Workspace, Execution, Management) must be audited and stripped of independent business rules.
6. Renderers (HTML, PDF, XLSX, CSV) MUST NOT perform independent queries or recalculate metrics.
7. Report schedules and manual triggers MUST use the exact same `ReportGenerationService` pipeline.

## M14-R4 Delivery Layer Governance & Forensic Certification
1. **Single Source of Truth**: Every renderer consumes the exact same deep-frozen `ReportDataset`.
2. **Dataset Hash Determinism**: SHA-256 hash excludes non-deterministic execution timestamps, verifying dataset identity across all formats.
3. **Forensic Audit Result**: 0 unauthorized calculations across all 17 inventoried rendering, export, schedule, and delivery components (see [M14-R4 Forensic Audit Report](file:///c:/DEV/STO/docs/M14_R4_FORENSIC_AUDIT.md)).
4. **Client Presentation Only**: Branding and layout profiles (logo, colors, fonts, margins, headers, confidentiality) adjust visual rendering only and can never alter authoritative metrics.
5. **Separation of M14 and M16**: M14 owns tabular/document reporting, PDF/XLSX/CSV export, scheduling, and email/in-app delivery. Conversational reporting, AI summaries, WhatsApp, and voice interfaces are strictly deferred to M16.

## M14-R5 Designer, UX & Performance Governance
1. **Governed Component Catalog**: 25+ visual components in `ReportComponentCatalog` strictly consume immutable `ReportDataset`. No component has access to raw database query engines.
2. **State Engine Isolation**: `ReportDesignerStateManager` is a pure presentation state machine. All operations (add, remove, reorder, resize, undo, redo) manipulate layout JSON only.
3. **Strict Controlled Fields**: `ReportFilterBuilder` binds to `DimensionRegistry` and `ControlledValueResolver`, strictly prohibiting free-text entry on controlled business classifications.
4. **Four-Tier Precedence Hierarchy**: $\text{PLATFORM DEFAULT} \to \text{TENANT CONFIGURATION} \to \text{EVENT CONFIGURATION} \to \text{USER PERSONAL VIEW}$. Platform seed defaults never overwrite tenant customizations.
5. **Empirical High-Scale Performance**: Certified zero N+1 query degradation up to 250,000 activities. Multi-dimensional queries resolve via batch dictionary mapping in exactly 2 queries.
6. **Forensic Audit Result**: 0 unauthorized calculations across all 45 inventoried designer, state manager, filter, and table components (see [M14-R5 Forensic Audit Report](file:///c:/DEV/STO/docs/M14_R5_FORENSIC_AUDIT.md)).

