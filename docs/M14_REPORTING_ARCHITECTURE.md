# M14 Reporting Architecture

The M14 Reporting & Communication engine follows a strict separation of concerns, acting solely as a consumer of authoritative operational intelligence.

## 1. Core Architecture Pattern

The system acts in a pipeline:

`Report Definition` -> `Report Template` -> `Report Data Sources` -> `Report Dataset` -> `Report Renderer` -> `Delivery`

### A. Report Definition
Defines the metadata of the report (e.g., "Daily TA Progress Report", "Contractor Summary"). Mapped via the `ReportDefinitionService`.

### B. Report Template
Defines the layout, branding, and cards (e.g., KPI cards on page 1, Area progress on page 2). Mapped via `ReportLayoutService`.

### C. Report Data Sources & Dataset (The Integration Layer)
Providers in `src/core/report-engine/providers` resolve specific queries.
**CRITICAL LIMITATION**: Data sources must query the authoritative services (`M8.13`, `M11`, `M12`, `M13`), NOT `Prisma` directly for business calculations.
The dataset is bundled into a `ReportExecutionContext` to prevent redundant queries and ensure snapshot immutability.

### D. Report Renderer
Takes the unified `ReportDataset` and the `ReportTemplate` to produce the final output.
- **HTML**: Rendered via UI React components or SSR templates.
- **PDF**: Rendered using standard engine (headless browser/Puppeteer or `pdf-lib` via html-to-pdf conversion) so that it matches HTML output precisely.
- **Excel/CSV**: Generated directly from tabular elements of the `ReportDataset`.

### E. Delivery
Managed by `reportDeliveryWorker.ts`. Handles Scheduled Jobs (cron), Email delivery, and In-app notifications. Records success/failures to the Audit logs.

## 2. Abstractions

### `ReportExecutionContext`
```typescript
interface ReportExecutionContext {
  organizationId: string;
  eventId: string;
  userId: string;
  reportDefinition: ReportDefinition;
  templateVersion: string;
  filters: ReportFilters;
  dimensions: string[];
  generatedAt: Date;
  dataset: ReportDataset; // The fetched, immutable payload for the template to render
}
```

### Component Contract
UI cards or PDF sections do not make API or database calls. They receive prepared data from the `ReportDataset`. This prevents N+1 queries during PDF generation and guarantees the report renders consistently across all formats.

## 3. Large Dataset Performance
To support 100K+ activities, M14 will rely on server-side queries. Summarization must happen in the source database via standard queries or authoritative aggregation endpoints, not by fetching 100,000 JSON records into the Node.js memory space or browser memory.
