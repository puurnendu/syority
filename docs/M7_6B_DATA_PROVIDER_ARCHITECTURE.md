# M7.6B — Data Provider Architecture

## Overview

The Data Provider Framework replaces the M7.6A inline data fetchers with a class-based provider system. Every provider consumes business services (never raw Prisma), supports self-documentation, and can be registered at runtime.

## Provider Lifecycle

```
1. Provider extends BaseProvider
2. Provider registered via providerRegistry.register()
3. Report Engine calls providerRegistry.fetch(key, ctx, params)
4. Provider fetches data from business services
5. Provider returns DataFetcherResult { rows, kpis, summary, metadata }
6. Engine renders data into report sections
```

## BaseProvider Contract

```typescript
abstract class BaseProvider {
  abstract readonly key: string;        // "planning.lookahead_24h"
  abstract readonly category: string;   // "planning"
  abstract readonly name: string;       // "24 Hour Look Ahead"
  abstract readonly description: string;
  
  readonly module: string = 'core';
  readonly requiredParams: string[] = [];
  readonly optionalParams: string[] = [];
  readonly maxRows?: number;
  
  abstract fetch(ctx: ProviderContext, params: Record<string, any>): Promise<DataFetcherResult>;
}
```

## Provider Categories

### Planning (5 providers)
| Key | Provider | Description |
|-----|----------|-------------|
| `planning.lookahead_24h` | `Lookahead24hProvider` | Activities starting within 24 hours |
| `planning.lookahead_72h` | `Lookahead72hProvider` | Activities starting within 72 hours |
| `planning.constraint_register` | `ConstraintRegisterProvider` | Constraint tracking |
| `planning.critical_path_summary` | `CriticalPathSummaryProvider` | Critical path analysis |
| `planning.workpack_readiness` | `WorkpackReadinessProvider` | Readiness scores |

### Shutdown (7 providers)
| Key | Provider | Description |
|-----|----------|-------------|
| `shutdown.scope_register` | `ScopeRegisterProvider` | Complete scope register |
| `shutdown.scope_change_register` | `ScopeChangeRegisterProvider` | Change requests |
| `shutdown.deferred_scope` | `DeferredScopeProvider` | Deferred items |
| `shutdown.workpack_status` | `WorkpackStatusProvider` | Workpack status breakdown |
| `shutdown.unit_progress` | `UnitProgressProvider` | Progress by unit |
| `shutdown.contractor_progress` | `ContractorProgressProvider` | Progress by contractor |
| `shutdown.discipline_progress` | `DisciplineProgressProvider` | Progress by discipline |

### Execution (6 providers)
| Key | Provider | Description |
|-----|----------|-------------|
| `execution.shift_progress` | `ShiftProgressProvider` | Current shift progress |
| `execution.daily_progress` | `DailyProgressProvider` | Today's progress updates |
| `execution.delay_register` | `DelayRegisterProvider` | Delayed activities |
| `execution.qa_pending` | `QaPendingProvider` | Pending QA checks |
| `execution.certificate_status` | `CertificateStatusProvider` | Certificate tracking |
| `execution.punch_register` | `PunchRegisterProvider` | Punch list items |

### Management (7 providers)
| Key | Provider | Description |
|-----|----------|-------------|
| `management.executive_dashboard` | `ExecutiveDashboardProvider` | Full EVM metrics |
| `management.kpi_dashboard` | `KpiDashboardProvider` | Workpack/activity KPIs |
| `management.scurve` | `ScurveProvider` | S-Curve chart data |
| `management.spi` | `SpiTrendProvider` | SPI trend |
| `management.cpi` | `CpiTrendProvider` | CPI trend |
| `management.cost_summary` | `CostSummaryProvider` | Cost breakdown |
| `management.resource_summary` | `ResourceSummaryProvider` | Resource utilization |

### Platform (4 providers)
| Key | Provider | Description |
|-----|----------|-------------|
| `platform.user_activity` | `UserActivityProvider` | User action counts |
| `platform.audit_log` | `AuditLogProvider` | Audit log entries |
| `platform.notification_statistics` | `NotificationStatisticsProvider` | Notification delivery stats |
| `platform.login_history` | `LoginHistoryProvider` | Login events |

## Registering a New Provider

```typescript
import { BaseProvider, type ProviderContext, providerRegistry } from '@/core/report-engine';
import type { DataFetcherResult } from '@/core/report-engine';
import { MyBusinessService } from '@/core/my-module/MyBusinessService';

export class MyCustomProvider extends BaseProvider {
  readonly key = 'my_module.custom_report';
  readonly category = 'my_module';
  readonly name = 'Custom Report';
  readonly description = 'Custom data for my module.';
  readonly module = 'my_module';
  readonly requiredParams = ['site'];
  readonly optionalParams = ['date_range'];

  async fetch(ctx: ProviderContext, params: Record<string, any>): Promise<DataFetcherResult> {
    // ALWAYS consume business services — never raw Prisma
    const data = await MyBusinessService.getSummary(ctx.organizationId, params);
    
    return {
      rows: data.items.map(item => ({
        name: item.name,
        status: item.status,
        value: item.value,
      })),
      kpis: [
        { label: 'Total Items', value: data.items.length },
        { label: 'Active', value: data.activeCount, color: '#059669' },
      ],
      metadata: { recordCount: data.items.length },
    };
  }
}

// Register at module initialization
providerRegistry.register(new MyCustomProvider());
```

## Backward Compatibility

The M7.6A `dataFetcherRegistry` continues to work. Both share the same underlying Prisma queries. New providers should be registered via `providerRegistry` only.
