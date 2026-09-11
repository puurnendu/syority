# M14 Forensic Audit

This document outlines the findings of the M14-R0 forensic audit across the STO codebase to identify existing reporting engines, document generation utilities, and duplicate logic that violates the authority model.

## 1. Existing Reporting Engines & Frameworks

### 1.1 `src/core/report-builder/`
- **Purpose**: Template-driven report generation service.
- **Key Files**: 
  - `ReportGenerationService.ts`: Core engine rendering HTML, triggering PDF generation, creating CSV exports, and handling AI summaries.
  - `ReportDefinitionService.ts`, `ReportLayoutService.ts`: Manages templates and branding.
  - `ReportScheduleService.ts`: Handles cron/scheduling logic.
- **Assessment**: This is the foundation we must extend and govern. It already contains the architectural separation of templates, layouts, and definitions required by M14.

### 1.2 `src/core/report-engine/`
- **Purpose**: Data providers feeding into reports.
- **Key Files**: `ExecutionProviders.ts`, `ManagementProviders.ts`, `SafetyProviders.ts`, `WorkforceProviders.ts`.
- **Assessment**: These currently fetch data directly from `prisma` instead of consuming authoritative service outputs (M8.13, M11, M12). They contain significant logic duplications (see Section 2).

### 1.3 Hardcoded PDF Generators
- `src/services/pdf/PdfGenerator.ts`: Hardcoded PDF generator for shift reports using `pdf-lib`.
- `src/modules/Workpack/Services/PdfService.ts`: Massive hardcoded PDF generation file for printing workpacks.
- **Assessment**: These should eventually be migrated to use the M14 template-driven `ReportGenerationService`, but immediately, they are isolated and do not act as platform-wide reporting authorities.

### 1.4 Exports & Dashboards
- Numerous `/export` and `/route.ts` handlers scattered across modules (e.g., `activities-csv/route.ts`, `bom-export/route.ts`, `ois/dashboards/[id]/export/route.ts`).
- **Assessment**: Standardized M14 generic exports should replace these scattered, direct Prisma-query export routes.

## 2. Duplicate / Unauthorized Engines

### 2.1 ManagementProviders.ts -> `computeEvm()`
- **Location**: `src/core/report-engine/providers/ManagementProviders.ts`
- **Violation**: Manually calculates BAC, BCWS, BCWP, ACWP, SPI, CPI by querying `prisma.activity` directly. 
- **Authority Conflict**: M8.10 (`EvmCalculationService`) is the absolute authority for EVM and SPI. The reporting layer MUST NOT implement its own version of EVM logic.
- **Action Required**: DEPRECATE and replace with M8.13 / M11 authoritative payloads.

### 2.2 ExecutionProviders.ts -> `DelayRegisterProvider`
- **Location**: `src/core/report-engine/providers/ExecutionProviders.ts`
- **Violation**: Evaluates delayed activities via `late_finish: { lt: new Date() }` directly against Prisma.
- **Authority Conflict**: M11 and M12 define delay and execution status.
- **Action Required**: Consume from M11 schedule status payload.

### 2.3 Hardcoded Quantities
- Found instances where PDF generation directly interacts with activity counts or progress calculations without going through M8.13 progress truth.

## 3. Existing Delivery & Scheduling
- `src/workers/reportDeliveryWorker.ts`: Evaluates scheduled reports and handles email delivery.
- **Assessment**: Reusable. Do not duplicate cron infrastructure. Integrate this worker cleanly with the `ReportGenerationService`.

## 4. Conclusion
The repository already contains a fledgling, template-driven reporting infrastructure (`report-builder`) but it suffers from a lack of authority governance—the data providers (`report-engine/providers`) are bypassing the established domain services (M8, M11, M12, M13) and querying Prisma directly, inventing their own EVM and progress calculations.

M14 must refactor these providers to be strictly adapter/consumption layers that fetch their datasets from the authoritative engines.
