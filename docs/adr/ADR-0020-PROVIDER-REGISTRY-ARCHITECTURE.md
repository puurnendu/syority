# ADR-0020: Provider Registry Architecture

**Status**: Accepted  
**Date**: 2026-07-30  
**Decision Makers**: Engineering  

## Context

The platform needed a unified data access layer that could serve both the Report Engine (M7.6A/B) and the Operational Intelligence Studio (M7.6C) without duplicating queries, business logic, or data transformations.

## Decision

### ProviderRegistry is the single source of truth for all data

Every business data source is exposed as a `BaseProvider` implementation registered in the `ProviderRegistry`. Both reports and OIS widgets consume data exclusively through this registry.

### Provider Categories (8 categories, 32+ providers)

| Category    | Providers | Examples |
|-------------|-----------|----------|
| Planning    | 5         | lookahead_24h, lookahead_72h, constraint_register, critical_path, workpack_readiness |
| Shutdown    | 5         | scope_register, scope_change, punch_summary, material_status, moc |
| Execution   | 5         | daily_progress, unit_progress, activity_completion, milestone_tracker, variance |
| Management  | 4         | contractor_performance, cost_summary, risk_register, change_log |
| Platform    | 3         | system_health, user_activity, org_summary |
| Safety      | 4         | daily_log, incident_register, kpi_summary, trend |
| Workforce   | 3         | headcount, crew_utilization, manhour_analysis |
| Workspace   | 2         | event_rollup, hierarchy_progress |

### Provider Contract

```typescript
abstract class BaseProvider {
  abstract readonly key: string;        // "safety.kpi_summary"
  abstract readonly category: string;   // "safety"
  abstract readonly name: string;       // "Safety KPI Summary"
  abstract fetch(ctx: ProviderContext, params: Record<string, any>): Promise<DataFetcherResult>;
}
```

### Registration Flow

```
providers/SafetyProviders.ts    → exports safetyProviders[]
providers/WorkforceProviders.ts → exports workforceProviders[]
providers/index.ts              → providerRegistry.registerAll([...all])
```

## Consequences

### Positive
- ONE query implementation per data source
- Reports and dashboards always show consistent data
- New data sources are automatically available everywhere
- Caching works at the provider level, not per-consumer

### Negative
- Provider API is currently `Record<string, any>` for params — could benefit from typed params
- No provider versioning yet
- Large provider files may need splitting in future
