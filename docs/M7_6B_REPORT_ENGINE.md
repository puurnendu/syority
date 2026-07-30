# M7.6B — Enterprise Report Engine Architecture

## Overview

M7.6B transforms the M7.6A Report Builder into a reusable Enterprise Reporting Engine by introducing:

1. **Data Provider Framework** — class-based providers replacing inline Prisma queries
2. **Branding Profiles** — company-level visual identity separate from layouts
3. **Saved Report Views** — planner-saved parameter sets reusable by schedules
4. **Planner Workspace Integration** — current filters → report parameters
5. **Report Artifact Repository** — managed storage for generated outputs
6. **Execution Dashboard** — real-time generation metrics and performance
7. **AI Report Assistant** — structured analysis consuming providers only

## Architecture

```
Business Modules
        │
        ▼
Report Data Providers          ← M7.6B: 29 providers in 5 categories
        │
        ▼
Report Definitions             ← M7.6A: metadata-driven, no hardcoded reports
        │
        ▼
Report Engine                  ← M7.6A: generation + M7.6B: artifacts + AI
        │
        ├──→ Artifact Repository   ← M7.6B: persistent storage
        │
        ▼
Notification Platform          ← M7.6: delivery engine (untouched)
        │
        ▼
Email / PDF / Excel / CSV / Future Channels
```

## Key Design Decisions

### Separation of Concerns

| Concept | Responsibility | M7.6A | M7.6B |
|---------|---------------|-------|-------|
| **Definition** | What report exists | ✅ | Enhanced (version, owner, draft) |
| **Schedule** | When to deliver | ✅ | Enhanced (saved_view_id) |
| **Execution** | Immutable generation record | ✅ | Enhanced (record_count, retry, notifications) |
| **Provider** | How data is fetched | Inline fetchers | Class-based providers |
| **Branding** | Visual identity | Via layout only | Branding profiles + resolution chain |
| **Artifact** | Generated file storage | In-memory | Persistent repository |
| **AI** | Intelligent analysis | Inline function | Structured assistant |

### Provider Framework

Providers consume business services, never raw Prisma:

```
ProviderRegistry
    ├── PlanningProviders (5)
    ├── ShutdownProviders (7)
    ├── ExecutionProviders (6)
    ├── ManagementProviders (7)
    └── PlatformProviders (4)
```

### Branding Resolution Chain

```
Layout → Branding Profile → Organization Settings → Platform Defaults
```

Each level overrides only the fields it sets. Null fields fall through.

## File Structure

```
src/core/report-engine/
├── index.ts                  # Barrel export
├── data-fetchers.ts          # Type re-export from M7.6A
├── BrandingService.ts        # Branding profile CRUD + resolution
├── SavedViewService.ts       # Saved view CRUD
├── ArtifactService.ts        # Artifact storage + download + re-send
├── AiReportAssistant.ts      # AI analysis (6 types)
└── providers/
    ├── index.ts              # Bootstrap + barrel
    ├── BaseProvider.ts       # Abstract base class
    ├── ProviderRegistry.ts   # Runtime registration
    ├── PlanningProviders.ts  # 5 providers
    ├── ShutdownProviders.ts  # 7 providers
    ├── ExecutionProviders.ts # 6 providers
    ├── ManagementProviders.ts # 7 providers
    └── PlatformProviders.ts  # 4 providers
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET/POST | `/api/report-builder/branding` | Branding profiles list/create |
| GET/PUT/DELETE | `/api/report-builder/branding/[id]` | Branding profile detail |
| GET/POST | `/api/report-builder/views` | Saved views list/create |
| GET/PUT/DELETE | `/api/report-builder/views/[id]` | Saved view detail |
| GET | `/api/report-builder/artifacts` | Artifacts list |
| GET/DELETE | `/api/report-builder/artifacts/[id]` | Download/archive artifact |
| POST | `/api/report-builder/artifacts/[id]/resend` | Re-send via notifications |
| POST | `/api/report-builder/parameters/cascade` | Hierarchical parameter filtering |
| POST | `/api/report-builder/from-workspace` | Workspace filters → report params |
| GET | `/api/report-builder/dashboard/metrics` | Execution metrics |
| GET | `/api/report-builder/dashboard/popular` | Popular reports & schedules |
| GET | `/api/report-builder/providers` | Registered data providers |

## Schema Extensions (5 new models)

| Model | Purpose |
|-------|---------|
| `report_branding_profiles` | Company branding: logo, theme, signatures, legal |
| `report_saved_views` | Planner's saved parameter sets |
| `report_artifacts` | Generated file storage with retention |
| `report_execution_metrics` | Pre-aggregated dashboard metrics |
| `report_data_providers` | Self-documenting provider registry |

## How to Add a New Report

1. Create a provider class extending `BaseProvider`
2. Register it: `providerRegistry.register(new YourProvider())`
3. Create a `report_definitions` record with `data_source_key` matching the provider key
4. Add sections and parameters as needed
5. The engine handles everything else

## How to Add a New Module

Future modules (RBI, Corrosion, Inspection) can register providers at runtime:

```typescript
import { providerRegistry } from '@/core/report-engine';
import { RbiAssessmentProvider } from './providers/RbiProviders';

providerRegistry.register(new RbiAssessmentProvider());
```

No core code changes required.
