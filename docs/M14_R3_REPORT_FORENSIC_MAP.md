# M14-R3 Report Forensic Map & Classification

**Milestone:** M14-R3 (Intelligence Reports Implementation)  
**Governance Standard:** Zero Unauthorized Calculation Engines | Frozen M14-R2 Authority Chain  
**Date:** 2026-09-07  

---

## 1. Classification Methodology

Every report in the M14 Report Catalogue and seeded definitions is forensically classified into one of the following five categories:

1. **`CORE_R3`**: High-priority intelligence reports implemented in R3 that directly expose authoritative domain intelligence (R09–R18).
2. **`DEPENDENT_ON_EXISTING_AUTHORITY`**: Baseline reports from R1/R2 that delegate to authoritative services (R01, R02, R04, R05, R07, R08, EVM trends).
3. **`PRESENTATION_ONLY`**: Read-only presentation, log viewers, register tables, or administration summaries without complex business authority.
4. **`DEFERRED`**: Advanced delivery, scheduling, WhatsApp/Email distribution, template designers, or AI builders designated for R4+.
5. **`DUPLICATE/REDUNDANT`**: Redundant aliases or variations consolidated into unified, parameter-driven providers.

---

## 2. Forensic Report Classification Matrix

### A. M14 Catalog Standard Reports (R01 – R18)

| Report ID | Report Name | Business Purpose | Authority | Provider Key | Dataset Shape | Required Dimensions | Required Filters | Required Parameters | Rendering Requirement | Classification | Status |
| :---: | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :---: | :---: |
| **R01** | Executive Daily Report | High-level event summary for executive stakeholders | M13 Control Tower & M8.10 EVM | `management.executive_dashboard` | KPIs (SPI, CPI, BAC, EAC, % Progress), Summary text | EVENT, SITE | event_id | `event` | KPI Cards + Summary Block | `DEPENDENT_ON_EXISTING_AUTHORITY` | 🟢 Active |
| **R02** | Daily TA Progress Report | Detailed daily operational progress and activity tracking | M8.13 Progress & M12 Execution | `execution.daily_progress` | Progress logs list, activity updates, daily KPIs | EVENT, AREA, UNIT, DISCIPLINE | event_id, date | `event` | KPI Cards + Table | `DEPENDENT_ON_EXISTING_AUTHORITY` | 🟢 Active |
| **R03** | Area Progress Report | Progress breakdown constrained to physical area boundaries | M8.13 Progress Aggregation | `shutdown.unit_progress` (DimensionRegistry) | Grouped area progress %, planned vs actual | SITE, AREA | event_id, area_id | `event`, `area` | Table + Progress Bars | `PRESENTATION_ONLY` | 🟢 Active |
| **R04** | Unit Progress Report | Progress breakdown constrained to physical unit boundaries | M8.13 Progress Aggregation | `shutdown.unit_progress` | Unit list, workpack count, weighted progress % | SITE, AREA, UNIT | event_id, unit_id | `event`, `unit` | Table + Progress Bars | `DEPENDENT_ON_EXISTING_AUTHORITY` | 🟢 Active |
| **R05** | Workpack Status Report | Status and execution progress across all workpacks | M8.13 Progress & M10 Readiness | `shutdown.workpack_status` / `planning.workpack_readiness` | Workpack rows, status, readiness %, overall progress % | UNIT, SYSTEM, DISCIPLINE, CONTRACTOR | event_id | `event` | KPI Cards + Workpack Table | `DEPENDENT_ON_EXISTING_AUTHORITY` | 🟢 Active |
| **R06** | Equipment Activity Report | Asset-centric view linking physical equipment to execution | M8.14 Digital Plant & M12 Execution | `planning.activity_status_summary` (by Equipment) | Equipment tag, type, activities count, status distribution | EQUIPMENT, EQUIPMENT_TYPE | event_id | `event`, `equipment` | Equipment Cards + Table | `PRESENTATION_ONLY` | 🟢 Active |
| **R07** | Contractor Performance Report | Performance and completion rates by contractor workforce | M8.13 Progress Aggregation | `shutdown.contractor_progress` | Contractor name, assigned workpacks, completion %, delays | CONTRACTOR, DISCIPLINE | event_id | `event` | KPI Cards + Comparison Table | `DEPENDENT_ON_EXISTING_AUTHORITY` | 🟢 Active |
| **R08** | Discipline Performance Report | Performance tracking by technical discipline | M8.13 Progress Aggregation | `shutdown.discipline_progress` | Discipline name, workpack counts, weighted completion % | DISCIPLINE | event_id | `event` | KPI Cards + Comparison Table | `DEPENDENT_ON_EXISTING_AUTHORITY` | 🟢 Active |
| **R09** | Lookahead Report | Forward-looking 24h/48h/72h/7d/14d task execution and readiness | M12 `FieldExecutionService.getLookahead` | `planning.lookahead` | Activity list, readiness state, blocking reasons, categories | AREA, UNIT, SYSTEM, EQUIPMENT, CONTRACTOR, DISCIPLINE, STATUS, CRITICALITY | event_id, horizon, discipline, contractor | `event`, `horizon` (24h, 48h, 72h, 7d, 14d) | KPI Cards + Execution Matrix Table | `CORE_R3` | 🟢 Green |
| **R10** | Critical Activities Report | Strict tracking of CPM critical path activities and float | M11 Schedule Engine CPM persistence | `planning.critical_activities` | Activity number, description, workpack, planned start/finish, actual start/finish, total float, is_critical, status, progress, constraint | EQUIPMENT, WORKPACK, DISCIPLINE, STATUS, CRITICALITY | event_id, is_critical=true | `event` | Critical Path KPIs + Schedule Table | `CORE_R3` | 🟢 Green |
| **R11** | Constraint Report | Overview of open constraints, age, impact, and critical path blockers | M12 Constraints (`prisma.constraintLog`) & M13 Severity | `planning.constraint_register` | Constraint number, title, category, activity, equipment, workpack, area, unit, owner, status, age, due date, impact, severity, remarks | AREA, UNIT, WORKPACK, CONTRACTOR, STATUS, PRIORITY | event_id, status, severity | `event`, `status` | Constraint Severity Distribution + Table | `CORE_R3` | 🟢 Green |
| **R12** | Holds & Delays Report | Activities currently on hold or delayed past late finish with root causes | M12 `FieldExecutionService.getPlanVsActual` & Execution facts | `execution.holds_and_delays` | Activity, equipment, workpack, hold reason/category, delay reason/category, start, duration, status, responsible party, impact, remarks | AREA, UNIT, WORKPACK, DISCIPLINE, CONTRACTOR, STATUS | event_id, delayed_only, on_hold_only | `event` | Delay Summary KPIs + Root Cause Table | `CORE_R3` | 🟢 Green |
| **R13** | Readiness Report | 12-criteria workpack readiness scoring and blocking prerequisites | M10 `PlanningReadinessService.getReadiness` & M12 Readiness | `planning.workpack_readiness` | Workpack, equipment, readiness state, readiness score, failed checks, blocking conditions (permit, isolation, material, manpower, tools, predecessor, documentation, QA/QC, safety) | UNIT, SYSTEM, EQUIPMENT, DISCIPLINE, STATUS | event_id, readiness_state | `event` | Readiness KPIs + Detailed Matrix Table | `CORE_R3` | 🟢 Green |
| **R14** | Identical Activities Report | Standardized activity intelligence across repeating equipment types | M8.13 `ProgressAggregationService.getIdenticalActivityProgress` | `planning.identical_activities` | Standard activity, equipment type, planned qty, completed qty, progress %, balance, visual progress bar (`██████░░░░ 30% Balance 70%`) | UNIT, SYSTEM, EQUIPMENT_TYPE, CONTRACTOR, DISCIPLINE | event_id, equipment_type | `event` | Visual Progress Bar Cards + Tabular Breakdown | `CORE_R3` | 🟢 Green |
| **R15** | Plan vs Actual Report | Direct execution variance against planned baseline | M11 Schedule, M12 `FieldExecutionService.getPlanVsActual`, M8.13 Progress | `planning.plan_vs_actual` | Activity, equipment, workpack, planned start/finish, actual start/finish, variance hours, progress %, status, criticality, delay flag | AREA, UNIT, WORKPACK, DISCIPLINE, STATUS, CRITICALITY | event_id, discipline | `event` | Variance KPIs + Plan vs Actual Table | `CORE_R3` | 🟢 Green |
| **R16** | S-Curve Report | Authoritative cumulative Earned Value S-Curve visualization | M8.10 `EvmSnapshotService.generateEventCurve` | `management.scurve` | Date series, Planned Value (PV), Earned Value (EV), Actual Cost (AC), EAC Forecast projection | EVENT, SITE | event_id, date_from, date_to | `event` | S-Curve Trend Chart + Cumulative Data Table | `CORE_R3` | 🟢 Green |
| **R17** | Schedule Health Report | Schedule integrity diagnostics and logic validation | M11 `ValidationEngineService.validate` | `planning.schedule_health_index` | Total issues, error count, warning count, info count, rule breakdown | WBS_CODE, DISCIPLINE, STATUS | event_id | `event` | Diagnostic Severity Cards + Validation Issue Table | `CORE_R3` | 🟢 Green |
| **R18** | Management Exceptions Report | Predictive warnings, anomalies, and exception intelligence | M13 `ControlTowerQueryService.getSummary` | `management.control_tower_exceptions` | Exception title, priority (P1–P4), category, area, unit, equipment, workpack, activity, owner, status, age, impact, recommended action | AREA, UNIT, EQUIPMENT, WORKPACK, PRIORITY, STATUS | event_id, priority | `event`, `priority` | Priority Exception Cards + Actionable Table | `CORE_R3` | 🟢 Green |

---

### B. Seeded Report Definitions Audit (30 Seed Definitions)

| Seed Slug | Seed Name | Seed Category | Data Source Key | Audit Classification | Rationalized Target Provider / Handling |
| :--- | :--- | :--- | :--- | :---: | :--- |
| `lookahead-24h` | 24 Hour Look Ahead | planning | `planning.lookahead_24h` | `CORE_R3` | R09 (24h horizon) via M12 `FieldExecutionService.getLookahead(orgId, eventId, 24)` |
| `lookahead-72h` | 72 Hour Look Ahead | planning | `planning.lookahead_72h` | `CORE_R3` | R09 (72h horizon) via M12 `FieldExecutionService.getLookahead(orgId, eventId, 72)` |
| `constraint-register` | Constraint Register | planning | `planning.constraint_register` | `CORE_R3` | R11 via `prisma.constraintLog` & M13 classification |
| `critical-path-summary`| Critical Path Summary | planning | `planning.critical_path_summary`| `CORE_R3` | R10 via M11 CPM persistence |
| `workpack-readiness` | Workpack Readiness | planning | `planning.workpack_readiness` | `CORE_R3` | R13 via M10 `PlanningReadinessService.getReadiness` |
| `scope-register` | Scope Register | shutdown | `shutdown.scope_register` | `PRESENTATION_ONLY` | Scope item tabular presentation |
| `scope-change-register`| Scope Change Register | shutdown | `shutdown.scope_change_register`| `PRESENTATION_ONLY` | Scope change approval log |
| `deferred-scope` | Deferred Scope | shutdown | `shutdown.deferred_scope` | `PRESENTATION_ONLY` | Deferred scope item log |
| `shutdown-workpack-status`| Workpack Status | shutdown | `shutdown.workpack_status` | `DEPENDENT_ON_EXISTING_AUTHORITY` | R05 baseline report |
| `unit-progress` | Unit Progress | shutdown | `shutdown.unit_progress` | `DEPENDENT_ON_EXISTING_AUTHORITY` | R04 baseline report via M8.13 |
| `contractor-progress` | Contractor Progress | shutdown | `shutdown.contractor_progress` | `DEPENDENT_ON_EXISTING_AUTHORITY` | R07 baseline report via M8.13 |
| `discipline-progress` | Discipline Progress | shutdown | `shutdown.discipline_progress` | `DEPENDENT_ON_EXISTING_AUTHORITY` | R08 baseline report via M8.13 |
| `shift-progress` | Shift Progress Report | execution | `execution.shift_progress` | `PRESENTATION_ONLY` | Shift log 12h presentation |
| `daily-progress` | Daily Progress Report | execution | `execution.daily_progress` | `DEPENDENT_ON_EXISTING_AUTHORITY` | R02 baseline report via M8.13 & M12 |
| `delay-register` | Delay Register | execution | `execution.delay_register` | `CORE_R3` | R12 via M12 `FieldExecutionService.getPlanVsActual` |
| `qa-pending` | QA Pending | execution | `execution.qa_pending` | `PRESENTATION_ONLY` | QA clearance log |
| `certificate-status` | Certificate Status | execution | `execution.certificate_status` | `PRESENTATION_ONLY` | Certificate status counts |
| `punch-register` | Punch List Register | execution | `execution.punch_register` | `PRESENTATION_ONLY` | Punch list register |
| `executive-dashboard` | Executive Dashboard | management | `management.executive_dashboard`| `DEPENDENT_ON_EXISTING_AUTHORITY` | R01 baseline report via M8.10 & M13 |
| `kpi-dashboard` | KPI Dashboard | management | `management.kpi_dashboard` | `DEPENDENT_ON_EXISTING_AUTHORITY` | Executive KPI cards via M8.13 |
| `scurve-report` | S-Curve Report | management | `management.scurve` | `CORE_R3` | R16 via M8.10 `generateEventCurve` |
| `spi-trend` | SPI Trend | management | `management.spi` | `DEPENDENT_ON_EXISTING_AUTHORITY` | EVM SPI series via M8.10 |
| `cpi-trend` | CPI Trend | management | `management.cpi` | `DEPENDENT_ON_EXISTING_AUTHORITY` | EVM CPI series via M8.10 |
| `cost-summary` | Cost Summary | management | `management.cost_summary` | `DEPENDENT_ON_EXISTING_AUTHORITY` | Cost EVM summary via M8.10 |
| `resource-summary` | Resource Summary | management | `management.resource_summary` | `PRESENTATION_ONLY` | Resource hours table |
| `user-activity` | User Activity Report | platform | `platform.user_activity` | `PRESENTATION_ONLY` | Audit log aggregation |
| `audit-log-report` | Audit Log Report | platform | `platform.audit_log` | `PRESENTATION_ONLY` | Audit log rows |
| `notification-statistics`| Notification Statistics| platform | `platform.notification_statistics`| `PRESENTATION_ONLY` | Delivery queue log |
| `login-history` | Login History | platform | `platform.login_history` | `PRESENTATION_ONLY` | User login log |
| `near-critical-path` | Near Critical Path | planning | `planning.near_critical_path` | `DUPLICATE/REDUNDANT` | Parameterized variant of R10 (float <= threshold) |

---

### C. Deferred Capabilities (Reserved for M14-R4)

| Deferred Item | Reason for Deferral | Scheduled Milestone |
| :--- | :--- | :---: |
| Automated Scheduled Delivery | Email/WhatsApp automated queue and dispatcher | M14-R4 |
| Visual Report Designer | Drag-and-drop report layout builder and canvas | M14-R4 |
| Snapshot Lifecycle Archiving | S3/Blob snapshot lifecycle and warm/cold tiering | M14-R4 |
| Generative AI Report Writer | Dynamic AI narrative generation on custom layouts | M14-R4 |
| Custom PDF Template Engine | Headless Chrome/Puppeteer cluster refactoring | M14-R4 |

---

## 3. Summary of Catalog Review

- **Total Reports Classified:** 31 (18 standard catalog + 30 seed definitions reconciled)
- **`CORE_R3` Reports:** 10 (R09, R10, R11, R12, R13, R14, R15, R16, R17, R18)
- **`DEPENDENT_ON_EXISTING_AUTHORITY` Reports:** 10 (R01, R02, R04, R05, R07, R08, and EVM trend variants)
- **`PRESENTATION_ONLY` Reports:** 10 (Scope register, QA, Certificates, Punch list, User/Audit logs)
- **`DUPLICATE/REDUNDANT` Consolidations:** 1 (`near-critical-path` consolidated into R10 float filtering)
- **`DEFERRED` Capabilities:** 5 (Reserved strictly for R4)
