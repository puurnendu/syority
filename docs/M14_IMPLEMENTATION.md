# M14 Implementation Guide

M14 will be implemented in a phased approach, transforming the existing `report-builder` into a governed, enterprise-grade Reporting & Communication Engine.

## Phase Strategy

### M14-R1: Reporting Foundation
- Establish `ReportExecutionContext` and enforce a strictly immutable `ReportDataset` that acts as the single source of truth for all renders (HTML, PDF, XLSX, CSV).
- Introduce report data provenance and snapshot metadata (capturing generated_by, timestamp, filters applied, dataset hash).
- Wire `DimensionRegistry` into the report filtering system.
- Secure tenant and event boundaries across all reporting API endpoints.
- Establish the `/reports` Report Center UI.

### M14-R2: Core Reports & Authority Rewiring
- **Critical Action**: Conduct a repository-wide provider authority audit across all files in `src/core/report-engine/providers` (Management, Execution, Safety, Workforce, etc.) to identify and deprecate unauthorized logic.
- Rewire data providers to strictly call `EvmCalculationService` (M8.10), `ProgressAggregationService` (M8.13), M12 `FieldExecutionService`, and `ControlTowerQueryService` (M13). M13 remains the absolute authority for management exceptions.
- Implement the Executive Daily (R01), Daily TA Progress (R02), Workpack (R05), Contractor (R07), and Discipline (R08) reports.

### M14-R3: Intelligence Reports
- Implement Lookahead (R09), Critical Activities (R10), Constraints (R11), Hold & Delay (R12), Readiness (R13), Identical Activity (R14), Plan vs Actual (R15), S-Curve (R16), Schedule Health (R17), and Management Exception (R18).
- Wire S-Curve (R16) directly to M8.10.

### M14-R4: Rendering, Export, Scheduling & Delivery (COMPLETED)
- **Deep Immutability & Provenance**: Enforced recursive `deepFreeze()` on `ReportDataset`. Immutable dataset preserves full provenance (`organization_id`, `event_id`, `generated_at`, `data_as_of`, `generated_by`, `report_definition_id/version`, `template_id/version`, `filters`, `dimensions`, `authority_sources`, `dataset_hash`).
- **Deterministic Hashing**: Implemented deterministic SHA-256 hash excluding nondeterministic runtime timestamps (`generatedAt`) and execution IDs. Identical query context yields identical hashes across all output formats.
- **Governed Multi-Format Renderers**:
  - **HTML**: Native DOM rendering via `ReportViewer` and iframe preview.
  - **PDF**: Puppeteer headless PDF generation with print CSS, page numbers, running headers/footers, and orientation support. Stored in `report_artifacts`.
  - **XLSX**: Multi-sheet workbook export via `ExcelJS` containing structured report data and an immutable `Metadata & Provenance` audit sheet.
  - **CSV**: Deterministic RFC 4180 CSV serializer with UTF-8 BOM (`\uFEFF`) and quote escaping.
- **Master Rendering Matrix**: Complete R01–R18 applicability mapping documented in [docs/M14_R4_RENDERING_MATRIX.md](file:///c:/DEV/STO/docs/M14_R4_RENDERING_MATRIX.md).
- **Presentation & Branding Isolation**: Presentation profiles (logo, colors, margins, title, confidentiality) adjust layout only; cannot mutate authoritative metrics.
- **Governed Scheduling & Delivery**: Tenant-isolated `ReportScheduleService` with unified execution pipeline (`ReportGenerationService.generate`). Email notifications via `notification_queue` and in-app delivery. Failed delivery is isolated without corrupting dataset.
- **Tenant & Event Isolation**: Hardened `ArtifactService` and API routes (`/api/report-builder/artifacts/[id]`, `/generations/[id]`, `/schedules/[id]`) to strictly enforce tenant and event boundaries with 403 Forbidden.
- **Verification**: 16 dedicated automated tests passing, 47 provider tests passing, 878 repository tests passing. Certified 0 unauthorized calculations in [docs/M14_R4_FORENSIC_AUDIT.md](file:///c:/DEV/STO/docs/M14_R4_FORENSIC_AUDIT.md).

### M14-R5: Designer / UX / Performance (COMPLETED)
- **Governed Component Catalog**: Implemented `ReportComponentCatalog` with 25+ visual components across Layout, Text, KPI, Charts, Tables, and Control categories, strictly consuming immutable `ReportDataset`.
- **Designer State Engine**: Built `ReportDesignerStateManager` with pure client-side section and component tree management, configuration inspection, and a 50-step undo/redo stack.
- **DimensionRegistry & ControlledValueResolver Integration**: Built `ReportFilterBuilder` dynamically discovering standard dimensions and tenant UDFs. Guaranteed zero free-text on controlled business classifications.
- **Table Designer**: Built `ReportTableDesigner` supporting presentation column selection, custom labels, alignment, column widths, repeated PDF headers, and hierarchical presentation grouping.
- **Template Management & Precedence Hierarchy**: Extended `SavedViewService` with `duplicate`, `saveAs`, and `resolveHierarchy`, enforcing $\text{PLATFORM DEFAULT} \to \text{TENANT CONFIGURATION} \to \text{EVENT CONFIGURATION} \to \text{USER PERSONAL VIEW}$.
- **Modernized Report Center UX**: Responsive `/reports` workspace featuring catalog cards, custom template management, generation snapshots, and instant transition to the visual `ReportDesigner`.
- **100K+ Activity Performance Benchmark**: Verified sub-second serialization and zero N+1 queries across synthetic refinery datasets (100K activities generated in 37ms, CSV export in 189ms, 0 N+1 queries across dimensions and UDFs).
- **Verification**: 12/12 dedicated tests passing in `M14R5ReportDesigner.test.ts`, 28/28 report-builder tests passing, 890/890 total Vitest tests passing. Certified 0 unauthorized calculations in [docs/M14_R5_FORENSIC_AUDIT.md](file:///c:/DEV/STO/docs/M14_R5_FORENSIC_AUDIT.md). Full performance report in [docs/M14_R5_PERFORMANCE_REPORT.md](file:///c:/DEV/STO/docs/M14_R5_PERFORMANCE_REPORT.md). Implementation details in [docs/M14_R5_IMPLEMENTATION.md](file:///c:/DEV/STO/docs/M14_R5_IMPLEMENTATION.md). Closure report in [docs/M14_R5_CLOSURE_REPORT.md](file:///c:/DEV/STO/docs/M14_R5_CLOSURE_REPORT.md).

### M14-R6: Final Milestone Closure & Comprehensive Audit (COMPLETED)
- **Full Architectural Reconciliation**: Reconciled complete M14 reporting engine against upstream authorities (M8.10, M8.13, M10, M11, M12, M13).
- **Forensic Audit**: Certified **0 unauthorized calculations**, **0 execution mutations**, and **0 duplicate authority engines**.
- **Full Regression**: Executed 890 Vitest tests across 39 test files with **100% pass rate (0 failures)**.
- **TypeScript Compiler Audit**: Certified 0 TypeScript errors in core M14 reporting and designer files.
- **Browser Acceptance Assessment**: Transparently documented **AMBER** status due to Playwright socket EOF protocol limitation on Windows sandbox container.
- **Authoritative Closure Document**: Produced [docs/M14_FINAL_CLOSURE_AUDIT.md](file:///c:/DEV/STO/docs/M14_FINAL_CLOSURE_AUDIT.md) with Option B (Conditional Green) release determination.

## Governance Check
Code reviews during implementation must strictly look for unauthorized data manipulation. Any logic performing multiplication or percentage derivation inside a Report Provider or React UI Component will result in a failed audit.
