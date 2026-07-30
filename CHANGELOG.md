# Changelog

All notable changes to Aurianoa OS (Syority Platform) will be documented in this file.

## [1.0.0] — 2026-07-30

### 🎯 Version 1.0.0 — Planning & Intelligence Foundation

This release represents the first production-ready version of Aurianoa OS.
It includes the complete Planning, Intelligence, and Safety foundation for
Turnaround, Shutdown, and Outage Management.

---

### M5 — Core Platform

- **Authentication & Authorization** — NextAuth.js with role-based access control
- **Multi-Tenant Architecture** — Full tenant isolation with organization-scoped data
- **Platform Administration** — Super admin console with tenant management
- **Company Administration** — Organization settings, branding, user management
- **Role Catalog** — 18 roles with type-safe permission matrix (frozen M5.3)

### M6 — Digital Plant & Engineering

- **Digital Plant** — Site → Plant → Area → Unit → System → Asset hierarchy
- **Asset Register** — Equipment tracking with technical data
- **Hierarchy Management** — Full CRUD with cascading operations
- **Engineering Issues** — Issue tracking with batch import
- **Shutdown Scope** — Scope definition and management

### M7 — Planning & Intelligence

#### M7.1 — Planner Workspace
- **Workpack Management** — Create, edit, approve workpacks
- **Activity Library** — Reusable activity definitions
- **Activity Relationships** — Predecessor/successor with FS/FF/SS/SF types
- **Resource Management** — Crew, equipment, material planning
- **Constraint Management** — Pre-requisite tracking
- **Punch List** — Deficiency tracking
- **UDF Framework** — User-defined fields with custom definitions
- **WBS Generation** — Work Breakdown Structure auto-generation
- **Blind Management** — Blind list tracking per system

#### M7.2 — Workpack Intelligence
- **RollupEngine** — Automated event-level progress aggregation
- **ValidationEngine** — Data quality checks with severity levels
- **AI Extraction** — PDF scope extraction with multi-provider AI
- **Knowledge Engine** — Lessons learned analysis and recommendation

#### M7.3 — Schedule & Planning
- **CPM Engine** — Critical Path Method scheduling
- **Schedule Recalculation** — Background BullMQ workers
- **Progress Logging** — Daily progress capture and tracking
- **Baseline Management** — Schedule baseline snapshots

#### M7.4 — Notification Platform
- **Multi-Channel Delivery** — In-app, email, WhatsApp notifications
- **Rule Engine** — Event-driven notification rules
- **Template System** — Customizable notification templates
- **Webhook Integration** — Outbound webhook support
- **Scheduled Deliveries** — Automated report delivery

#### M7.5 — Report Engine
- **Report Builder** — Template-based report generation
- **PDF Export** — Server-side PDF rendering with Puppeteer
- **Excel Export** — Spreadsheet generation with XLSX
- **Branded Reports** — Organization branding in all exports
- **Shift Reports** — Automated shift summaries
- **Lookahead Reports** — Forward-looking schedule reports

#### M7.6A — Report Engine v2
- **ProviderRegistry** — Centralized data provider architecture
- **BaseProvider** — Abstract provider with standardized interface
- **14 Provider Categories** — Planning, Safety, Workforce, Execution, etc.
- **Data Fetcher Compatibility** — Backward-compatible adapter layer
- **ArtifactService** — Report artifact management

#### M7.6B — Operational Intelligence Studio Foundation
- **Dashboard Schema** — JSON-based dashboard definitions
- **Widget Framework** — Pluggable widget architecture
- **Cockpit Builder** — Real-time operational cockpits
- **TV Mode** — Auto-cycling display mode
- **Meeting Mode** — Presentation mode with annotations
- **CrossFilterEngine** — Inter-widget filtering
- **Visualization Engine** — Chart rendering framework

#### M7.6C — OIS Experience & Dashboard Designer
- **Drag-and-Drop Designer** — Full dashboard layout editor
- **Widget Gallery** — Pre-built widget library
- **Theme Engine** — Dashboard theming and branding
- **Export Engine** — Dashboard PDF/Excel export
- **Dashboard Sharing** — Public and org-scoped sharing
- **Scheduled Snapshots** — Automated dashboard captures

#### M7.6D — Safety Management
- **Safety Logging** — Daily safety observation logging
- **Incident Management** — Near miss, incident, LTI tracking
- **Safety Metrics** — TRIR, LTIR, frequency rates
- **Photo Evidence** — Incident photo uploads
- **SafetyService** — Centralized service layer
- **Safety Data Providers** — 8 safety intelligence providers

#### M7.6E — Business Rules Engine
- **FormulaEngine** — 29 built-in functions with recursive descent parser
- **RulesEngine** — Condition-based rule evaluation
- **AlertEngine** — Alert lifecycle with deduplication and escalation
- **KPI Engine** — Key Performance Indicator definitions
- **Escalation Chains** — Multi-level escalation with recipients
- **Evaluation Logging** — Full audit trail for all evaluations

#### M7.6F — Production Hardening (This Release)

##### Infrastructure
- Enhanced health check API (DB + Redis component status)
- Kubernetes-compatible readiness and liveness probes
- Security headers (X-Content-Type-Options, X-Frame-Options, HSTS, etc.)
- Docker container health checks and resource limits
- CI/CD pipeline (GitHub Actions)

##### API Standardization
- Standard response envelope (`{ data, meta, error }`)
- Zod request validation utilities
- Pagination helpers with safe defaults
- Common validation schemas (UUID, pagination, sort, date range)

##### Permissions
- BRE permission types (14 new permissions)
- Full role-permission assignments for BRE

##### Testing
- FormulaEngine unit tests (49 test cases)
- ProviderRegistry unit tests (14 test cases)
- Permission system unit tests (25 test cases)
- Vitest coverage configuration

##### Monitoring
- In-memory metrics collector (counters, gauges, histograms)
- Prometheus-compatible export format
- Structured JSON logging (production)

##### Decision Recommendation Engine
- Recommendation lifecycle (pending → accepted/rejected/deferred)
- Confidence scoring with reasoning
- Supporting KPIs and alternatives
- Accept/reject/defer with audit trail
- Dashboard, TV Mode, Meeting Mode, and Report integration
- Human-only execution (no autonomous actions)

---

### Known Limitations

1. **Test Coverage** — Unit test coverage is below the 80% target. Critical paths covered; comprehensive coverage is a post-V1.0 priority.
2. **API Documentation** — OpenAPI spec not yet generated. API Guide documents conventions.
3. **Legacy Models** — Dual model patterns exist for LessonLearned, ConstraintLog, PunchListItem. Migrations planned for post-V1.0.
4. **Bundle Size** — `ta-dashboard.tsx` (112KB) demo component inflates the bundle. Marked for removal.
5. **E2E Tests** — No Playwright tests yet. Manual testing covers critical paths.

---

### Migration Notes

- Run `npx prisma migrate deploy` after updating
- New environment variables: None required (all new features use existing config)
- New Redis keys: None (recommendation engine uses PostgreSQL only)
- Breaking changes: None

---

### Contributors

- Platform Engineering Team
- AI & Intelligence Team

[1.0.0]: https://github.com/syority/sto/releases/tag/v1.0.0
