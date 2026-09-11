# M14-R5 — Report Designer, UX & Performance Implementation Guide

**Milestone:** M14-R5  
**Domain:** Reporting & Communication Engine (M14)  
**Status:** IMPLEMENTED — CODE/TEST GREEN  
**Authoritative Standards:** M8.10 (EVM), M8.13 (Progress), M11 (CPM/Schedule), M12 (Field Execution), M13 (Control Tower Exceptions)  

---

## 1. Architectural Overview & Objectives

Milestone **M14-R5** elevates the Syority Enterprise STO reporting engine into a flexible, business-user Report Designer and high-performance Report Consumption Workspace while maintaining strict zero-calculation and zero-mutation boundaries.

### Core Architectural Directives:
1. **Reuse and Extend Existing Architecture**:
   - Instead of building disconnected parallel engines, M14-R5 reuses and extends `ReportLayoutService`, `SavedViewService`, `DimensionRegistry`, `ControlledValueResolver`, and `ReportGenerationService`.
2. **Strict Presentation / Configuration Scope**:
   - M14-R5 operates purely on layout, styling, section composition, column presentation, and caching/delivery performance.
   - Zero progress derivation, zero EVM math, zero CPM float calculation, zero readiness/delay metrics calculation.
3. **Four-Tier Configuration Precedence**:
   $$\text{PLATFORM DEFAULT} \longrightarrow \text{TENANT CONFIGURATION} \longrightarrow \text{EVENT CONFIGURATION} \longrightarrow \text{USER PERSONAL VIEW}$$
   - Platform seed defaults serve as intelligent baselines; tenant and user customizations override without altering the baseline or polluting other tenants.
4. **100,000+ Activity Scalability**:
   - Zero N+1 query degradation across multi-dimensional activity models.
   - Batch dictionary dimension resolution in exactly 2 queries.
   - Empirical sub-second throughput for in-memory grouping, filtering, pagination, and multi-format serialization.

---

## 2. Component Catalog (`ReportComponentCatalog.ts`)

A governed component registry defining all available visual blocks that can be placed on a report canvas:

| Category | Component Types | Data Binding Contract |
| :--- | :--- | :--- |
| **Layout** | `layout.header`, `layout.footer`, `layout.section`, `layout.grid2`, `layout.grid3`, `layout.grid4`, `layout.pagebreak` | Structural only; resolves dynamic variables (`{{orgName}}`, `{{datetime}}`). |
| **Text** | `text.heading`, `text.paragraph`, `text.callout`, `text.ai_summary` | Binds to `dataset.data.summary` or `dataset.aiSummary`. |
| **KPI** | `kpi.card`, `kpi.row`, `kpi.badge` | Extracts metric cards directly from authoritative `dataset.data.kpis`. |
| **Charts** | `charts.scurve`, `charts.bar`, `charts.donut`, `charts.trend` | Consumes pre-computed EVM curves (`dataset.data.curves`) or distribution series. |
| **Tables** | `tables.activity_grid`, `tables.summary_table`, `tables.exception_list` | Consumes `dataset.data.rows` with client-side column visibility & sorting. |
| **Control** | `control.filter_summary`, `control.signature_block`, `control.metadata` | Renders `dataset.filters`, `dataset.provenance`, and approval sign-off lines. |

**Governance Invariant**: Every component's `extractData` function strictly receives an immutable `ReportDataset` and returns display-ready values. No component performs calculations or queries the database.

---

## 3. Designer State Engine (`ReportDesignerStateManager.ts`)

A pure TypeScript state manager providing reactive, predictable visual report design:
- **Canvas Layout Model**: Manages report sections, nested component trees, column layouts (`1-col`, `2-col`, `3-col`, `4-col`), widths, margins, and visibility flags.
- **Undo / Redo Stack**: Maintains up to 50 historical states using deep cloning, providing instant undo/redo capabilities for all design operations (add, remove, move, resize, property change).
- **Component Lifecycle**: Functions for `addComponent`, `removeComponent`, `duplicateComponent`, `moveComponent`, `updateComponentConfig`, `addSection`, `reorderSections`, `deleteSection`.
- **Serialization & Deserialization**: Clean export to / import from standard JSON layout definitions compatible with `report_layouts.configuration`.

---

## 4. Governed Filter Builder (`ReportFilterBuilder.tsx`)

Binds directly to `DimensionRegistry` and `ControlledValueResolver`:
- **Dynamic Dimension Discovery**: Calls `/api/workspace/dimensions` to discover all standard enterprise dimensions (Plant, Area, Unit, System, Equipment, Discipline, Contractor, Priority, Criticality, Status) and active tenant UDFs.
- **Zero Free-Text on Controlled Fields**:
  - Controlled classification dimensions strictly render as single-select, multi-select, or cascading dropdowns.
  - Arbitrary free-text entry is restricted exclusively to text search filters (description, remarks).
- **Tenant & Event Scope**: Automatically injects and freezes the active `organization_id` and `event_id` into all filter payloads.

---

## 5. Table Designer (`ReportTableDesigner.tsx`)

Provides presentation-layer customization of tabular data views:
- **Presentation Column Selection**: Planners can toggle column visibility and choose custom column header labels without changing database field names.
- **Alignment & Widths**: Per-column text alignment (`left`, `center`, `right`) and explicit pixel widths for PDF pagination control.
- **Repeated Headers for Multi-Page PDF**: Option to repeat the table header row across page breaks.
- **Hierarchical Presentation Grouping**: Supports multi-level grouping (e.g. `Area` $\to$ `Unit` $\to$ `System` $\to$ `Equipment`) with collapsible section headers and group count badges.

---

## 6. Template Management & Precedence (`SavedViewService.ts`)

Extended existing `SavedViewService` with production template workflows:
- **`duplicate(id, userId, newName)`**: Creates an isolated personal copy of any system, organization, or personal template.
- **`saveAs(id, userId, newName, overrides)`**: Enables saving current modifications as a distinct new template without mutating the original.
- **`resolveHierarchy(opts)`**: Implements the governed 4-tier precedence resolution:
  1. Inspects Platform baseline (`report_definitions.default_layout_id`).
  2. Overrides with Tenant baseline (`report_layouts` where `organization_id = tenantId`).
  3. Overrides with Event configuration if specified.
  4. Applies User Personal View (`report_saved_views`) as final override.
- **Tenant Isolation**: Strict enforcement that non-owners cannot mutate or delete templates belonging to other users or organizations.

---

## 7. Responsive Report Center (`ReportCenter.tsx`)

Modernized the `/reports` UI workspace:
- **Tabbed Experience**: Standard Catalog (R01–R18), Custom Templates, Generation History & Snapshots.
- **Visual Designer Embed**: One-click transition from any report into the visual `ReportDesigner` canvas.
- **Multi-Device Support**: Responsive layout for desktop workstations, turnaround control room screens, and field tablets.
- **Direct Export Shortcuts**: Instant generation to HTML preview, PDF download, XLSX workbook, or CSV data.

---

## 8. High-Scale Empirical Performance

Benchmarked via `src/core/report-builder/benchmarks/M14R5PerformanceBenchmark.ts` on 10K, 25K, 50K, 100K, and 250K activity datasets.

### Empirical Performance Summary (100K Activities):
- **Dataset Generation**: **37 ms**
- **Grid First Page (50 rows)**: **< 1 ms**
- **Multi-Column Filter**: **1.00 ms**
- **Multi-Level Grouping**: **2.91 ms**
- **RFC 4180 CSV Export**: **189 ms**
- **ExcelJS Multi-Sheet XLSX Export**: **485 ms**
- **N+1 Database Queries**: **0 (exactly 2 batch queries)**
- **Heap Memory Delta**: **34.3 MB**

See [docs/M14_R5_PERFORMANCE_REPORT.md](file:///c:/DEV/STO/docs/M14_R5_PERFORMANCE_REPORT.md) for full benchmark details.

---

## 9. Verification & Quality Gate

- **Automated Tests**: 12/12 dedicated tests passing in `src/core/report-builder/__tests__/M14R5ReportDesigner.test.ts`.
- **Full Report Suite**: 28/28 tests passing in `src/core/report-builder/__tests__/`.
- **Repository Regression**: 890/890 Vitest tests passing across 39 test files.
- **Calculation Audit**: Certified **0 unauthorized calculations** across all R5 files.
- **Execution Safety**: Certified **0 references** to `ExecutionWriteService`.
