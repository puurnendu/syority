# M7.6A — Enterprise Report Builder

## Overview

M7.6A extends the existing Notification Platform (M7.6) into a complete Enterprise Reporting & Communication Framework. The Report Builder is a **producer** that generates reports and feeds them to the Notification Platform for delivery.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Report Builder                               │
│                                                                   │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────────────┐ │
│  │  Definitions  │──▶│  Parameters  │──▶│  Data Fetcher        │ │
│  │  (metadata)   │   │  (filters)   │   │  Registry            │ │
│  └──────┬───────┘   └──────────────┘   │  (29 query keys)     │ │
│         │                               └──────────┬───────────┘ │
│         ▼                                          ▼              │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────────────┐ │
│  │   Sections   │──▶│  Generation  │──▶│  Output Formatter    │ │
│  │  (rendering) │   │   Engine     │   │  (HTML/PDF/Excel/CSV)│ │
│  └──────────────┘   └──────┬───────┘   └──────────────────────┘ │
│                             │                                     │
│  ┌──────────────┐           │           ┌──────────────────────┐ │
│  │   Layouts    │───────────┘           │  AI Summary          │ │
│  │  (branding)  │                       │  (optional)          │ │
│  └──────────────┘                       └──────────────────────┘ │
│                             │                                     │
│                             ▼                                     │
│  ┌──────────────┐   ┌──────────────┐                             │
│  │  Schedules   │──▶│  Generations │──────▶ Notification Queue  │
│  │  (frequency) │   │  (audit)     │       (M7.6 delivery)      │
│  └──────────────┘   └──────────────┘                             │
└─────────────────────────────────────────────────────────────────┘
```

## Database Models (9 new tables)

| Model | Table | Purpose |
|-------|-------|---------|
| `report_categories` | `report_categories` | Top-level grouping (Planning, Shutdown, etc.) |
| `report_definitions` | `report_definitions` | Metadata-driven report definitions |
| `report_parameters` | `report_parameters` | Reusable filter parameters |
| `report_definition_parameters` | `report_definition_parameters` | Junction: params per definition |
| `report_sections` | `report_sections` | Configurable sections per report |
| `report_layouts` | `report_layouts` | Branding and page configuration |
| `report_schedules` | `report_schedules` | Scheduled delivery configuration |
| `report_schedule_recipients` | `report_schedule_recipients` | Recipients per schedule |
| `report_generations` | `report_generations` | Audit trail for every generation |

## Core Services

| Service | Path | Purpose |
|---------|------|---------|
| `ReportDefinitionService` | `src/core/report-builder/` | CRUD for definitions & categories |
| `ReportParameterService` | `src/core/report-builder/` | Parameter management & dynamic option resolution |
| `ReportLayoutService` | `src/core/report-builder/` | Layout CRUD & branding resolution |
| `ReportGenerationService` | `src/core/report-builder/` | Core generation engine |
| `ReportScheduleService` | `src/core/report-builder/` | Schedule CRUD & trigger |

## Data Fetcher Registry

29 registered data fetchers across 5 categories:

- **Planning** (5): lookahead_24h, lookahead_72h, constraint_register, critical_path_summary, workpack_readiness
- **Shutdown** (7): scope_register, scope_change_register, deferred_scope, workpack_status, unit_progress, contractor_progress, discipline_progress
- **Execution** (6): shift_progress, daily_progress, delay_register, qa_pending, certificate_status, punch_register
- **Management** (7): executive_dashboard, kpi_dashboard, scurve, spi, cpi, cost_summary, resource_summary
- **Platform** (4): user_activity, audit_log, notification_statistics, login_history

## API Endpoints

### Report Definitions
- `GET /api/report-builder/definitions` — List definitions
- `POST /api/report-builder/definitions` — Create definition
- `GET /api/report-builder/definitions/:id` — Get definition
- `PUT /api/report-builder/definitions/:id` — Update definition
- `DELETE /api/report-builder/definitions/:id` — Deactivate definition

### Categories & Parameters
- `GET /api/report-builder/categories` — List categories
- `GET /api/report-builder/parameters` — List parameters
- `GET /api/report-builder/parameters/:key/options` — Resolve dynamic options

### Layouts
- `GET /api/report-builder/layouts` — List layouts
- `POST /api/report-builder/layouts` — Create layout
- `PUT /api/report-builder/layouts/:id` — Update layout
- `DELETE /api/report-builder/layouts/:id` — Deactivate layout

### Schedules
- `GET /api/report-builder/schedules` — List schedules
- `POST /api/report-builder/schedules` — Create schedule
- `PUT /api/report-builder/schedules/:id` — Update schedule
- `DELETE /api/report-builder/schedules/:id` — Delete schedule
- `POST /api/report-builder/schedules/:id/trigger` — Trigger now

### Generation
- `POST /api/report-builder/generate` — Generate report
- `POST /api/report-builder/preview` — Preview (HTML only)
- `GET /api/report-builder/generations` — List history
- `GET /api/report-builder/generations/:id` — Get generation
- `GET /api/report-builder/generations/:id/download` — Download report

### Library
- `GET /api/report-builder/library` — Full library grouped by category

## UI Pages

### Tenant
- `/report-builder` — Report Library (browsable catalog)
- `/report-builder/:definitionId` — Report Configuration (parameters, sections, preview, generate)
- `/report-builder/schedules` — Schedule Manager
- `/report-builder/history` — Generation History

### Platform Admin
- `/platform/report-builder` — Admin Dashboard
- `/platform/report-builder/definitions` — Definition Management
- `/platform/report-builder/layouts` — Layout Management

## Seed Data

Run the seed to populate 30 report definitions:

```bash
npx ts-node prisma/seeds/report-builder-seed.ts
```

Or it runs automatically as part of `prisma db seed`.

## Environment Variables

No additional environment variables required. The Report Builder uses existing database and notification platform configuration.

## Permissions

| Permission | Description |
|-----------|-------------|
| `reporting:view` | View reports and library |
| `reporting:build` | Generate reports and manage schedules |
| `reporting:admin` | Create/edit/delete definitions and layouts |
