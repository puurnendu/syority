# M7.6C — Operational Intelligence Studio (OIS) Readiness Audit

**Audit Date:** 2026-07-30  
**Auditor:** Automated Codebase Analysis  
**Schema Version:** 4,593 lines — `prisma/schema.prisma`  
**Scope:** Full-stack audit — Prisma models, Services, APIs, UI Components, Permissions

---

## Executive Summary

The Aurianoa OS codebase has **substantial reusable infrastructure** for the Operational Intelligence Studio. The Report Engine (M7.6B), Notification Platform (M7.6), and Planner Workspace (M7.5) provide 60–70% of the foundation. However, a **Dashboard Builder, Widget Framework, and Cockpit** layer does not exist — these must be designed from scratch, but they can leverage the existing `BaseProvider` / `ProviderRegistry` pattern to avoid duplicating data access logic.

> [!IMPORTANT]
> The existing `ta-dashboard.tsx` (1,261 lines, 112KB) is a **demo-only monolith** with hardcoded static data. It is NOT production code and CANNOT be reused as-is. It is a design reference only.

---

## 1. Safety Module Audit

### 1.1 Existing Prisma Models

| Model | Lines | Fields | Key Purpose |
|-------|-------|--------|-------------|
| `SafetyLog` | L1252–L1288 | 24 fields | Daily safety log per event (LTI, near miss, manhours, PTW, cumulative stats) |
| `SafetyIncident` | L1214–L1250 | 26 fields | Individual incident records (type, severity, root cause, corrective actions) |
| `SafetyPhoto` | L1290–L1308 | 13 fields | Photo evidence for logs and incidents |

### 1.2 Existing APIs

| Route | Methods | Auth | Function |
|-------|---------|------|----------|
| `/api/events/[eventId]/safety` | GET, POST | `safety.view`, `safety.log` | CRUD for safety logs with cumulative stats computation |
| `/api/events/[eventId]/safety/incidents` | GET, POST | `safety.view`, `safety.log` | CRUD for incidents per event |
| `/api/events/[eventId]/safety/incidents/[incidentId]` | GET, PATCH, DELETE | `safety.view`, `safety.log` | Single incident management |
| `/api/events/[eventId]/safety/photos` | POST | `safety.log` | Photo upload for safety logs |

### 1.3 Existing UI

| File | Size | Description |
|------|------|-------------|
| `app/(dashboard)/safety/page.tsx` | 22.7KB (545 lines) | Full safety management page — log entry form, cumulative KPIs, incident CRUD, photo upload |

### 1.4 Safety KPIs Currently Tracked

| KPI | Field(s) | Computation |
|-----|----------|-------------|
| LTI Count | `SafetyLog.lti` | SUM across logs |
| LTI Frequency Rate | `SafetyLog.lti_frequency_rate` | `(cumulative_lti × 1,000,000) / cumulative_manhours` |
| Near Miss | `SafetyLog.near_miss` | SUM |
| First Aid | `SafetyLog.first_aid` | SUM |
| Medical Treatment | `SafetyLog.medical_treatment` | SUM |
| Manhours Worked | `SafetyLog.manhours_worked` | SUM / Cumulative |
| PTW Issued/Closed/Suspended | `SafetyLog.ptw_*` | SUM |
| Toolbox Talks | `SafetyLog.toolbox_talks` | SUM |
| Dangerous Occurrence | `SafetyLog.dangerous_occurrence` | SUM |

### 1.5 Safety Gaps for OIS

| Gap | Severity | Notes |
|-----|----------|-------|
| **No TRIR Computation** | HIGH | TRIR = `(incidents × 200,000) / manhours_worked`. Not computed anywhere. |
| **No dedicated SafetyKPI model** | MEDIUM | KPIs are computed inline in the API route, not pre-aggregated. |
| **No Unsafe Acts / Unsafe Conditions tracking** | HIGH | Schema has no fields for behavioral safety observation. |
| **No Safety Observation model** | HIGH | Only incidents are tracked; proactive observations are missing. |
| **No trend data / historical analysis** | MEDIUM | Cumulative stats exist per log but no pre-aggregated trend tables. |
| **Permission keys not in permissions.ts** | LOW | `safety.view` and `safety.log` are used in API guards but NOT defined as Permission types in `src/lib/permissions.ts`. They work via string passthrough. |
| **No Report Data Provider for Safety** | HIGH | No `SafetyProvider` in `src/core/report-engine/providers/`. Safety reports cannot be generated via the Enterprise Report Engine. |

### 1.6 Reusability Assessment

- **SafetyLog + SafetyIncident models**: ✅ Fully reusable for Safety Dashboard widgets.
- **Safety API routes**: ✅ Reusable — already return computed stats (totalManhours, totalLTI, ltiRate).
- **Safety UI page**: ⚠️ Monolithic client component — chart/KPI sections could be extracted into widgets but are tightly coupled. Refactor needed.

---

## 2. Planner Workspace Audit

### 2.1 Existing Services

| Service | File | Size | Purpose |
|---------|------|------|---------|
| `PlannerWorkspaceService` | `src/core/planner-workspace/PlannerWorkspaceService.ts` | 19.5KB | Hierarchical data loading, workpack/activity CRUD, bulk ops |
| `RollupEngine` | `src/core/planner-workspace/RollupEngine.ts` | 8.2KB | Hierarchical rollup computation (Activity→WP→Unit→Event) |
| `ValidationEngineService` | `src/core/planner-workspace/ValidationEngineService.ts` | 13KB | Workpack validation rules, compliance scoring |

### 2.2 RollupEngine — Widget-Ready Data

The `RollupEngine.computeEventRollups()` method already returns structured data ideal for dashboard widgets:

```typescript
interface RollupValues {
  workpackCount, activityCount, totalDurationHrs, totalCrew,
  totalResourceHrs, documentCount, certificateCount,
  avgReadiness, avgCompliance, udfRollups: Record<string, number>
}
```

**Widget candidates from RollupEngine:**
- Workpack count by unit
- Activity count by unit
- Duration hours by unit/system
- Readiness score heatmap
- Compliance score gauge
- Resource utilization bar chart

### 2.3 Existing UI Components

| Component | File | Size | Widget Potential |
|-----------|------|------|-----------------|
| `ActivityGrid` | `src/components/planner-workspace/ActivityGrid.tsx` | 10.9KB | Grid renderer — could power a table widget |
| `WorkpackGrid` | `src/components/planner-workspace/WorkpackGrid.tsx` | 10.9KB | Grid renderer — could power a table widget |
| `InspectorPanel` | `src/components/planner-workspace/InspectorPanel.tsx` | 9.5KB | Detail panel — reference for drill-down widgets |
| `HierarchyTreePanel` | `src/components/planner-workspace/HierarchyTreePanel.tsx` | 5.8KB | Tree navigation — reusable for hierarchy filters |
| `WorkspaceToolbar` | `src/components/planner-workspace/WorkspaceToolbar.tsx` | 6.6KB | Toolbar with filter/sort — reusable pattern |

### 2.4 Dashboard Components

| Component | File | Size | Widget Potential |
|-----------|------|------|-----------------|
| `PortfolioDashboard` | `src/components/Dashboard/PortfolioDashboard.tsx` | 21.4KB | ✅ **HIGH** — event selector, portfolio stats, S-curve, progress tables |
| `ConstraintHeatmap` | `src/components/Dashboard/ConstraintHeatmap.tsx` | 3.6KB | ✅ **HIGH** — heatmap widget, directly extractable |
| `SCurveChart` | `src/components/Dashboard/SCurveChart.tsx` | 3.7KB | ✅ **HIGH** — S-curve chart, directly extractable |
| `SystemProgressCard` | `src/components/Dashboard/SystemProgressCard.tsx` | 5KB | ✅ **HIGH** — progress card, directly extractable |
| `SystemProgressGrid` | `src/components/Dashboard/SystemProgressGrid.tsx` | 1.1KB | ✅ Grid wrapper for progress cards |
| `AIAssistantPanel` | `src/components/Dashboard/AIAssistantPanel.tsx` | 7KB | ✅ AI chat panel — reusable for cockpit AI |

### 2.5 Planner Workspace Reusability

- **RollupEngine**: ✅ Direct reuse as data source for OIS dashboard widgets.
- **ValidationEngineService**: ✅ Compliance data can power compliance widgets.
- **UI Components**: ⚠️ Extractable with refactoring. Currently coupled to workspace page state.

---

## 3. Report Engine Audit

### 3.1 Architecture Summary

```
Report Definitions → Report Engine → Data Providers → Business Services → Prisma
                                   → AI Report Assistant
                                   → Artifact Service (PDF/Excel/CSV)
                                   → Branding Service
                                   → Notification Platform (delivery)
```

### 3.2 Existing Data Providers

| Provider Category | File | Size | Registered Providers |
|-------------------|------|------|---------------------|
| Planning | `PlanningProviders.ts` | 9.5KB | lookahead_24h, lookahead_72h, constraint_register, critical_path_summary, workpack_readiness |
| Shutdown | `ShutdownProviders.ts` | 10.5KB | scope_register, scope_change_register, scope_package_summary, scope_comparison, scope_deferral_register |
| Execution | `ExecutionProviders.ts` | 9.1KB | daily_progress, punch_register, material_status, certification_status, activity_completion |
| Management | `ManagementProviders.ts` | 10KB | executive_dashboard, contractor_performance, manhour_analysis, milestone_tracker, lesson_learned_register |
| Platform | `PlatformProviders.ts` | 5.6KB | user_activity, tenant_summary, system_health |

**Total Registered Providers: ~23**

### 3.3 Provider Pattern — Widget Integration Path

The `BaseProvider` abstract class and `ProviderRegistry` singleton are the **ideal foundation** for OIS widget data sourcing:

```typescript
// Existing pattern — widgets can call this directly
const data = await providerRegistry.fetch('planning.lookahead_24h', ctx, params);
```

**This means:**
- ✅ Every report data provider can become a widget data source with ZERO new backend code.
- ✅ The `ProviderMeta` interface already exposes required/optional params for widget configuration.
- ✅ Future modules register providers via `providerRegistry.register()` — widgets auto-discover them.

### 3.4 Report Engine Reusability for OIS

| Component | Reusable? | Notes |
|-----------|-----------|-------|
| `ProviderRegistry` | ✅ YES | Widget data sourcing via existing provider keys |
| `BaseProvider` | ✅ YES | All providers return `DataFetcherResult` — uniform data contract |
| `AiReportAssistant` | ✅ YES | Can power AI-driven dashboard insights |
| `BrandingService` | ✅ YES | Can apply org branding to dashboard exports/print |
| `ArtifactService` | ✅ YES | Can generate downloadable widget snapshots |
| `report_definitions` model | ⚠️ PARTIAL | Useful as reference but widgets need their own definition model |
| `report_sections` model | ⚠️ PARTIAL | Section types (data, chart, kpi_cards) map to widget types |

---

## 4. Widget Candidate Audit

### 4.1 Existing Chart/Visual Components

| Component | Type | Source | Reusable? |
|-----------|------|--------|-----------|
| `SCurveChart` | Line/Area chart (Recharts) | Dashboard | ✅ Direct widget |
| `ConstraintHeatmap` | Heatmap grid | Dashboard | ✅ Direct widget |
| `SystemProgressCard` | Progress card | Dashboard | ✅ Direct widget |
| `PctBar` / `MiniBar` | Progress bars | ta-dashboard.tsx | ✅ Pattern only (static demo) |
| `AreaChart` / `BarChart` | Recharts charts | ta-dashboard.tsx | ✅ Recharts library is installed |

### 4.2 Widget Types Derivable from Existing Data

| Widget Type | Data Source | Provider Key | Status |
|-------------|------------|--------------|--------|
| KPI Card | RollupEngine | N/A (service) | ✅ Ready |
| S-Curve Chart | Planning Providers | `management.milestone_tracker` | ✅ Ready |
| Constraint Heatmap | Planning Providers | `planning.constraint_register` | ✅ Ready |
| Punch Summary | Execution Providers | `execution.punch_register` | ✅ Ready |
| Progress by Unit | RollupEngine | N/A (service) | ✅ Ready |
| Manhour Analysis | Management Providers | `management.manhour_analysis` | ✅ Ready |
| Contractor Performance | Management Providers | `management.contractor_performance` | ✅ Ready |
| Material Status | Execution Providers | `execution.material_status` | ✅ Ready |
| Safety KPIs | SafetyLog API | ❌ No provider | 🔴 Need SafetyProvider |
| TRIR Trend | SafetyLog + computation | ❌ No provider | 🔴 Need SafetyProvider |
| Scope Summary | Shutdown Providers | `shutdown.scope_register` | ✅ Ready |
| Activity Completion | Execution Providers | `execution.activity_completion` | ✅ Ready |
| Certification Status | Execution Providers | `execution.certification_status` | ✅ Ready |
| Lesson Learned | Management Providers | `management.lesson_learned_register` | ✅ Ready |
| Executive Dashboard | Management Providers | `management.executive_dashboard` | ✅ Ready |

### 4.3 Missing Widget Infrastructure

| Component | Status | Required For |
|-----------|--------|--------------|
| Widget Definition Model | 🔴 NEW | Widget registry, config, layout |
| Dashboard Definition Model | 🔴 NEW | Dashboard/Cockpit builder |
| Widget Instance Model | 🔴 NEW | Per-user/per-cockpit widget placement |
| Widget Renderer Framework | 🔴 NEW | Generic widget rendering engine |
| Dashboard Grid Layout | 🔴 NEW | Drag-and-drop grid (react-grid-layout) |
| TV Mode Renderer | 🔴 NEW | Full-screen auto-refresh display |
| Meeting Mode Renderer | 🔴 NEW | Presentation-optimized view |

---

## 5. Notification Platform Integration Audit

### 5.1 Existing Notification Models

| Model | Lines | Purpose |
|-------|-------|---------|
| `notification_providers` | L3944–L3976 | SMTP/SES/SendGrid provider config |
| `notification_templates` | L3979–L4002 | Reusable email templates with variables |
| `notification_rules` | L4006–L4027 | Event → template → channel mapping |
| `notification_rule_recipients` | L4030–L4039 | Recipients per rule |
| `notification_recipient_groups` | L4042–L4056 | Reusable recipient groups |
| `notification_queue` | L4059–L4095 | Queued notification items |
| `notification_delivery_logs` | L4098–L4132 | Delivery audit trail |

### 5.2 Existing Services

| Service | File | Purpose |
|---------|------|---------|
| `NotificationProviderService` | 7.3KB | Provider CRUD, test connection |
| `NotificationTemplateService` | 8.5KB | Template CRUD, variable resolution |
| `NotificationRuleEngine` | 13.9KB | Rule evaluation, recipient resolution |
| `NotificationQueueProcessor` | 13.7KB | Queue processing, retry logic, SMTP send |
| `NotificationDeliveryService` | 8KB | Delivery tracking, log management |
| `NotificationRecipientGroupService` | 5KB | Group CRUD |

### 5.3 Notification → OIS Integration

The Notification Platform can deliver:
- ✅ Dashboard alerts (via `notification_rules` event triggers)
- ✅ Scheduled dashboard snapshots (via `report_schedules` → `notification_queue`)
- ✅ Widget threshold alerts (new rules needed)
- ⚠️ Real-time push (WebSocket not implemented — would need new infra)

---

## 6. Workforce Integration Audit

### 6.1 Existing Workforce Models

| Model | Lines | Purpose |
|-------|-------|---------|
| `Resource` | L1159–L1179 | Named workforce resource linked to contractor/discipline |
| `ResourceType` | L1181–L1195 | Resource classification (craft code) |
| `ActivityResource` | Schema | Resource allocation per activity |
| `Contractor` | Schema | Contractor entity |
| `unit_responsibilities` | L2509–L2531 | Unit-level role assignments with notification preferences |
| `shift_reports` | L2393–L2418 | Shift handover reports |

### 6.2 Workforce Gaps for OIS

| Gap | Severity | Notes |
|-----|----------|-------|
| No workforce headcount tracking model | HIGH | No daily attendance/headcount table |
| No crew allocation dashboard data | HIGH | `ActivityResource` exists but no aggregation service |
| No discipline utilization metric | MEDIUM | Could be derived from `ResourceType` + `ActivityResource` |
| No contractor performance KPI model | MEDIUM | Performance data is inline in Management Provider |

---

## 7. Dashboard / Cockpit Readiness Assessment

### 7.1 What Exists

| Component | Status | Reusable? |
|-----------|--------|-----------|
| Portfolio Dashboard | ✅ Built | ✅ Widget patterns extractable |
| Safety Page | ✅ Built | ⚠️ Monolithic — needs decomposition |
| Planner Workspace | ✅ Built | ✅ Grid/tree patterns reusable |
| Report Builder | ✅ Built | ✅ Section/parameter config pattern |
| Reporting Dashboard | ✅ Built | ✅ Stats/chart patterns |
| TA Dashboard (demo) | ✅ Demo only | ❌ Hardcoded — design reference only |

### 7.2 What Must Be Built New

| Component | Complexity | Dependencies |
|-----------|-----------|--------------|
| Widget Definition Schema | MEDIUM | New Prisma models |
| Dashboard Builder UI | HIGH | react-grid-layout, widget renderer |
| Widget Builder UI | HIGH | Parameter config, chart config |
| Cockpit Container | MEDIUM | Dashboard composition engine |
| TV Mode | LOW | CSS fullscreen + auto-refresh interval |
| Meeting Mode | LOW | Print/presentation CSS + slide nav |
| Workforce Dashboard | HIGH | New provider + model additions |
| Safety Dashboard | MEDIUM | Extract from safety page + new provider |

---

## 8. API Structure Audit

### 8.1 API Pattern Consistency

| Pattern | Status | Notes |
|---------|--------|-------|
| `guardApi()` permission check | ✅ Consistent | All tenant APIs use this |
| `orgScope()` tenant isolation | ✅ Consistent | Organization ID extraction |
| Response format `{ data }` or `{ logs, stats }` | ⚠️ Inconsistent | Some return raw arrays, some wrap in objects |
| Error handling | ⚠️ Inconsistent | Some use try/catch, some don't |
| Pagination | ❌ Missing in most | Safety API returns all logs unpaginated |

### 8.2 API Routes for OIS

**52 existing API route groups** in `app/api/`. The following are directly relevant to OIS:

| Route Group | Widget Relevant? |
|-------------|-----------------|
| `/api/dashboard/*` | ✅ constraint-heatmap, portfolio-stats, system-progress |
| `/api/events/[eventId]/safety/*` | ✅ Safety widgets |
| `/api/planner-workspace/*` | ✅ Workspace widgets |
| `/api/report-builder/*` | ✅ Report data sourcing |
| `/api/reporting/*` | ✅ Report execution dashboard |
| `/api/notifications/*` | ✅ Notification widgets |

---

## 9. Security & Performance Audit

### 9.1 Security Risks for OIS

| Risk | Severity | Mitigation |
|------|----------|------------|
| Dashboard definitions must be scoped by org | HIGH | Follow `organization_id` pattern |
| Widget data access must respect role permissions | HIGH | Wrap provider.fetch() in permission check |
| TV Mode must not expose data without auth | MEDIUM | Require session token / room code |
| Meeting Mode print must apply branding | LOW | Use existing `BrandingService` |

### 9.2 Performance Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Multiple widgets fetching same data | HIGH | Implement data cache layer / batch fetching |
| RollupEngine queries all workpacks per event | MEDIUM | Already indexed; add caching for dashboards |
| Safety API returns all logs unpaginated | MEDIUM | Add pagination before widgetizing |
| Real-time updates would need WebSocket | MEDIUM | Polling with configurable interval initially |

---

## 10. Architecture Compatibility Matrix

### 10.1 Model Compatibility

| OIS Concept | Existing Model | Compatible? | Notes |
|-------------|---------------|-------------|-------|
| Dashboard Definition | `report_definitions` | ⚠️ Similar pattern | New model needed — different lifecycle |
| Widget Definition | `report_sections` | ⚠️ Similar fields | Section types ≈ widget types but semantics differ |
| Widget Data Source | `report_data_providers` | ✅ Direct reuse | Provider keys are the data source keys |
| Widget Parameters | `report_parameters` | ✅ Direct reuse | Same parameter system |
| Widget Layout | `report_layouts` | ⚠️ Different concept | Layouts are page-level, not grid-cell-level |
| Dashboard Schedule | `report_schedules` | ✅ Direct reuse | Can schedule dashboard snapshots |
| Branding | `report_branding_profiles` | ✅ Direct reuse | Same branding for dashboard exports |

### 10.2 Service Compatibility

| OIS Service Need | Existing Service | Compatible? |
|-----------------|-----------------|-------------|
| Widget Data Fetch | `ProviderRegistry.fetch()` | ✅ Direct |
| AI Insights | `AiReportAssistant` | ✅ Direct |
| Export/Download | `ArtifactService` | ✅ Direct |
| Branding | `BrandingService` | ✅ Direct |
| Delivery | `NotificationQueueProcessor` | ✅ Direct |
| Auth/Permissions | `guardApi()` / `hasPermission()` | ✅ Direct |
| Rollup Data | `RollupEngine` | ✅ Direct |
| Validation Data | `ValidationEngineService` | ✅ Direct |

---

## 11. Recommendations

### 11.1 Reuse Strategy

1. **DO NOT duplicate data access logic.** All widget data MUST flow through `ProviderRegistry`.
2. **Create a `SafetyProvider`** to register safety KPIs in the existing provider framework.
3. **Extract existing chart components** (`SCurveChart`, `ConstraintHeatmap`, `SystemProgressCard`) into a shared widget component library.
4. **Reuse `report_parameters`** for widget filter configuration.
5. **Reuse `BrandingService`** for dashboard theming and export.
6. **Reuse `ArtifactService`** for dashboard snapshot generation.

### 11.2 New Models Required

| Model | Purpose | Estimated Fields |
|-------|---------|-----------------|
| `DashboardDefinition` | Dashboard/cockpit metadata | ~15 fields |
| `DashboardWidget` | Widget placement within dashboard | ~12 fields |
| `WidgetDefinition` | Widget type registry | ~20 fields |
| `WidgetInstance` | Per-user widget configuration | ~10 fields |
| `SafetyObservation` (optional) | Proactive safety observations | ~15 fields |

### 11.3 Implementation Priority

| Phase | Component | Effort | Dependencies |
|-------|-----------|--------|--------------|
| Phase 1 | Widget Definition Schema | 2 days | None |
| Phase 1 | SafetyProvider for Report Engine | 1 day | SafetyLog model |
| Phase 2 | Dashboard Builder UI | 5 days | Widget schema |
| Phase 2 | Widget Renderer Framework | 3 days | Widget schema |
| Phase 3 | Cockpit Container | 2 days | Dashboard Builder |
| Phase 3 | TV Mode / Meeting Mode | 2 days | Dashboard Builder |
| Phase 4 | Workforce Dashboard | 3 days | New workforce provider |
| Phase 4 | Safety Dashboard | 2 days | SafetyProvider |

**Total estimated effort: 20 engineering days**

---

## 12. Conclusion

The Aurianoa OS codebase is **well-positioned** for OIS implementation:

- **23 existing data providers** cover 80% of widget data needs.
- **ProviderRegistry pattern** eliminates the need for duplicate data access.
- **6 chart/visual components** are directly extractable as widgets.
- **Notification Platform** provides the delivery engine for dashboard alerts/snapshots.
- **Report Engine** provides AI, branding, and artifact generation.

The primary gap is the **dashboard/widget schema layer** and the **widget renderer framework** — these are genuinely new concepts that don't exist in the codebase. The safety module needs a `SafetyProvider` and proactive observation tracking (TRIR, unsafe acts).

> [!TIP]
> The fastest path to OIS is to build the Widget Framework as a thin orchestration layer **on top of** the existing `ProviderRegistry` + `BrandingService` + `ArtifactService` stack. This avoids ALL duplication.
