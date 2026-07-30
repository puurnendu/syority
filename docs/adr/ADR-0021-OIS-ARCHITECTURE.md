# ADR-0021: OIS Architecture

**Status**: Accepted  
**Date**: 2026-07-30  
**Decision Makers**: Engineering, Product  

## Context

The platform required an enterprise-grade visualization and intelligence studio that could serve dashboards, cockpits, TV displays, meeting views, and scheduled exports — without duplicating any logic from the existing Report Engine (M7.6A/B) or Notification Platform (M7.5).

## Decision

### OIS is a thin orchestration layer

The OIS does NOT implement its own data fetching, rendering, branding, or delivery logic. Instead:

```
ProviderRegistry (existing)
      ↓
WidgetDataService (caching + deduplication)
      ↓
DashboardGrid ←→ WidgetRenderer ←→ VisualizationEngine
      ↓
DashboardSnapshotService → ArtifactService (existing)
      ↓
DashboardScheduleService → NotificationPlatform (existing)
```

### Key Architectural Decisions

1. **ONE ProviderRegistry** — All data sources (safety, planning, execution, workforce, workspace) are registered as BaseProvider implementations. Both reports and dashboards consume data through the same registry.

2. **ONE VisualizationEngine** — A single registry maps 20+ visualization types to their component specs. Dashboards, cockpits, TV mode, meeting mode, and PDF exports all use the same mapping.

3. **ONE WidgetRenderer** — A single React component dispatches rendering to visualization subcomponents based on the visualization_type from the widget definition.

4. **Database-driven widget definitions** — Widgets are metadata in `ois_widget_definitions`, not hardcoded components. New widget types require only: (a) a provider in ProviderRegistry, (b) a row in the widget definitions table.

5. **Shared caching layer** — `WidgetDataService` caches provider results by provider_key + params_hash + org_id. Multiple widgets sharing the same data source hit the cache once.

6. **Dashboard types are discriminated, not separated** — All surface types (dashboard, cockpit, tv, meeting) share the `ois_dashboard_definitions` model. The `dashboard_type` field controls behavior (rotation in TV, auto-advance in meeting).

## Consequences

### Positive
- Zero logic duplication with Report Engine
- Zero duplication with Notification Platform
- New providers automatically become available as widgets
- Template system enables rapid deployment
- 27 widget definitions shipped on day 1

### Negative
- VisualizationEngine component map grows with each new viz type
- CSS Grid layout doesn't support drag-and-drop natively (future: add react-grid-layout)
- TV mode session codes are 6 chars — collision risk at very high scale

## Schema

11 new models:
- `ois_widget_definitions` — widget type registry
- `ois_dashboard_definitions` — dashboard metadata
- `ois_dashboard_pages` — multi-page support
- `ois_dashboard_widgets` — widget instances
- `ois_dashboard_versions` — version history
- `ois_dashboard_shares` — access control
- `ois_dashboard_schedules` — scheduled delivery
- `ois_dashboard_schedule_recipients` — delivery recipients
- `ois_dashboard_snapshots` — export artifacts
- `ois_tv_sessions` — TV/kiosk sessions
- `ois_widget_data_cache` — provider data cache
