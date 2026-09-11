# M14 Report Catalog

This catalog outlines the standard management intelligence reports (R01 through R18) provided out-of-the-box by the M14 Reporting and Communication engine. All reports adhere strictly to the frozen M14-R2 authority architecture, consuming upstream authority query engines with zero local calculation engines.

All reports support multi-dimensional filtering via `DimensionRegistry` (Event, Site, Plant, Area, Unit, System, Equipment, Contractor, Discipline) and custom User Defined Fields (UDFs).

---

## Executive & Management Intelligence

### R01 — Executive Daily Report
- **Purpose**: High-level event summary for executive stakeholders providing an immediate pulse of safety, schedule, progress, and financial health.
- **Provider Key**: `management.executive_dashboard`
- **Upstream Authority**: M8.10 EVM (`calculateEventEvm`), M8.13 Physical Progress (`getDashboardSummary`), M13 Control Tower (`getSummary`).
- **Required Dimensions**: `EVENT`, `SITE`.
- **Required Parameters**: `event` (Event ID).
- **Dataset Output**:
  - `kpis`: Overall Progress %, Planned Progress %, SPI, CPI, BAC, EAC, Active Delay Count, Open Constraints.
  - `summary`: Narrative executive summary block.
  - `provenance`: Authority snapshot timestamp, hash, and source keys.
- **Supported Formats**: HTML, PDF, XLSX, CSV.

### R16 — S-Curve Report
- **Purpose**: Cumulative Earned Value Management (EVM) tracking comparing baseline Planned Value (PV), Earned Value (EV), and Actual Cost (AC) with projected EAC completion.
- **Provider Key**: `management.scurve`
- **Upstream Authority**: M8.10 `EvmSnapshotService.generateEventCurve`.
- **Required Dimensions**: `EVENT`, `SITE`.
- **Required Parameters**: `event` (Event ID), optional `date_from`, `date_to`.
- **Dataset Output**:
  - `kpis`: Current BAC, PV, EV, AC, SPI, CPI.
  - `rows`: Chronological array of `{ date, planned, earned, actual, forecast }`.
  - `chartData`: Ready-to-render curve series points.
- **Supported Formats**: HTML, PDF, XLSX, CSV.

### R18 — Management Exception Report
- **Purpose**: Predictive warnings, critical path exceptions, priority alerts (P1–P4), and anomaly detection from the Control Tower.
- **Provider Key**: `management.control_tower_exceptions`
- **Upstream Authority**: M13 `ControlTowerQueryService.getSummary` and `CONTROL_TOWER_RULES`.
- **Required Dimensions**: `AREA`, `UNIT`, `EQUIPMENT`, `WORKPACK`, `PRIORITY`, `STATUS`.
- **Required Parameters**: `event` (Event ID), optional `priority` (`P1`, `P2`, `P3`, `P4`), `category`.
- **Dataset Output**:
  - `kpis`: Total Exceptions, Critical (P1) Count, High (P2) Count, Medium/Low Count.
  - `rows`: Array of `{ id, title, priority, category, area, unit, equipment, workpack, activity, owner, status, age_days, impact, recommended_action }`.
- **Supported Formats**: HTML, PDF, XLSX, CSV.

---

## Progress & Performance Intelligence

### R02 — Daily TA Progress Report
- **Purpose**: Comprehensive daily turnaround operational progress tracking covering activities completed, underway, and upcoming shifts.
- **Provider Key**: `execution.daily_progress`
- **Upstream Authority**: M8.13 `ProgressAggregationService`, M12 `FieldExecutionService`.
- **Required Dimensions**: `EVENT`, `AREA`, `UNIT`, `DISCIPLINE`.
- **Required Parameters**: `event` (Event ID), optional `date`.
- **Dataset Output**:
  - `kpis`: Daily Progress %, Shift Completion Rate, Hours Burned, Active Crews.
  - `rows`: Activity execution log entries, progress updates, and shift observations.
- **Supported Formats**: HTML, PDF, XLSX, CSV.

### R03 — Area Progress Report
- **Purpose**: Progress and execution health breakdown constrained to physical geographical area boundaries.
- **Provider Key**: `shutdown.unit_progress` (grouped by `Area` via `DimensionRegistry`)
- **Upstream Authority**: M8.13 `ProgressAggregationService.getEventProgress`.
- **Required Dimensions**: `SITE`, `AREA`.
- **Required Parameters**: `event` (Event ID), `area` (Area ID).
- **Dataset Output**:
  - `kpis`: Area Weighted Progress %, Total Workpacks, Completed Workpacks.
  - `rows`: Sub-areas, units within area, planned vs actual progress %, variances.
- **Supported Formats**: HTML, PDF, XLSX, CSV.

### R04 — Unit Progress Report
- **Purpose**: Detailed breakdown of physical progress within a specific process unit battery limit.
- **Provider Key**: `shutdown.unit_progress`
- **Upstream Authority**: M8.13 `ProgressAggregationService.getEventProgress(..., { includeUnit: true })`.
- **Required Dimensions**: `SITE`, `AREA`, `UNIT`.
- **Required Parameters**: `event` (Event ID), `unit` (Unit ID).
- **Dataset Output**:
  - `kpis`: Unit Weighted Progress %, Critical Path Status, Total Tasks.
  - `rows`: Equipment list, workpack count, duration-weighted completion %, status.
- **Supported Formats**: HTML, PDF, XLSX, CSV.

### R07 — Contractor Performance Report
- **Purpose**: Quantitative performance and productivity evaluation across contracted workforce organizations.
- **Provider Key**: `shutdown.contractor_progress`
- **Upstream Authority**: M8.13 `ProgressAggregationService.getEventProgress(..., { includeContractor: true })`.
- **Required Dimensions**: `CONTRACTOR`, `DISCIPLINE`.
- **Required Parameters**: `event` (Event ID), optional `contractor`.
- **Dataset Output**:
  - `kpis`: Average Contractor Progress, Delay Counts, Active Manpower.
  - `rows`: Array of `{ contractor, total_workpacks, completed_workpacks, weighted_progress, delays }`.
- **Supported Formats**: HTML, PDF, XLSX, CSV.

### R08 — Discipline Performance Report
- **Purpose**: Cross-cutting technical discipline progress tracking (Mechanical, Electrical, Piping, Instrumentation, Scaffolding, Insulation).
- **Provider Key**: `shutdown.discipline_progress`
- **Upstream Authority**: M8.13 `ProgressAggregationService.getEventProgress(..., { includeDiscipline: true })`.
- **Required Dimensions**: `DISCIPLINE`.
- **Required Parameters**: `event` (Event ID), optional `discipline`.
- **Dataset Output**:
  - `kpis`: Overall Discipline Progress %, Top Leading Discipline, Top Lagging Discipline.
  - `rows`: Array of `{ discipline, workpack_count, duration_weighted_progress, completed_activities }`.
- **Supported Formats**: HTML, PDF, XLSX, CSV.

### R14 — Identical Activities Report
- **Purpose**: Cross-asset productivity intelligence on structurally identical tasks across repeating equipment (e.g., Heat Exchanger Pullout, Tray Inspection, Valve Overhaul).
- **Provider Key**: `planning.identical_activities`
- **Upstream Authority**: M8.13 `ProgressAggregationService.getIdenticalActivityProgress`.
- **Required Dimensions**: `UNIT`, `SYSTEM`, `EQUIPMENT_TYPE`, `CONTRACTOR`, `DISCIPLINE`.
- **Required Parameters**: `event` (Event ID), optional `equipment_type`.
- **Dataset Output**:
  - `kpis`: Total Standard Activities, Average Completion Rate %, Leading Equipment Type.
  - `rows`: Array of `{ standard_activity, equipment_type, planned_qty, completed_qty, progress_percent, balance_percent, visual_bar }`.
  - `visual_bar`: ASCII/HTML progress indicator (e.g., `██████░░░░ 60% Balance 40%`).
- **Supported Formats**: HTML, PDF, XLSX, CSV.

---

## Planning & Schedule Intelligence

### R09 — Lookahead Report
- **Purpose**: Operational rolling window lookahead for upcoming shift and daily task assignments across 24h, 48h, 72h, 7d, or 14d horizons.
- **Provider Key**: `planning.lookahead`
- **Upstream Authority**: M12 `FieldExecutionService.getLookahead`.
- **Required Dimensions**: `AREA`, `UNIT`, `SYSTEM`, `EQUIPMENT`, `CONTRACTOR`, `DISCIPLINE`, `STATUS`, `CRITICALITY`.
- **Required Parameters**: `event` (Event ID), `horizon` (`24h`, `48h`, `72h`, `7d`, `14d`).
- **Dataset Output**:
  - `kpis`: Tasks in Horizon, Critical Tasks, Ready to Execute, Blocked Tasks.
  - `rows`: Array of `{ activity_number, description, planned_start, planned_finish, status, readiness_status, blocking_reasons, equipment, workpack }`.
- **Supported Formats**: HTML, PDF, XLSX, CSV.

### R10 — Critical Activities Report
- **Purpose**: Real-time visibility into the schedule critical path (Total Float = 0 or below threshold) governing event completion.
- **Provider Key**: `planning.critical_activities`
- **Upstream Authority**: M11 Schedule Engine CPM persistence (`is_critical: true`, `total_float`), M8.13 Physical Progress.
- **Required Dimensions**: `EQUIPMENT`, `WORKPACK`, `DISCIPLINE`, `STATUS`, `CRITICALITY`.
- **Required Parameters**: `event` (Event ID), optional `max_float`.
- **Dataset Output**:
  - `kpis`: Total Critical Tasks, Completed Critical %, Delayed Critical Count, Driving Path Status.
  - `rows`: Array of `{ activity_number, description, workpack, equipment, planned_start, planned_finish, actual_start, actual_finish, total_float, is_critical, status, progress, constraint }`.
- **Supported Formats**: HTML, PDF, XLSX, CSV.

### R11 — Constraint Report
- **Purpose**: Comprehensive log of active operational, engineering, and material constraints with age, impact, and severity tracking.
- **Provider Key**: `planning.constraint_register`
- **Upstream Authority**: `prisma.constraintLog` joined with Equipment, Workpack, Area, and Unit.
- **Required Dimensions**: `AREA`, `UNIT`, `WORKPACK`, `CONTRACTOR`, `STATUS`, `PRIORITY`.
- **Required Parameters**: `event` (Event ID), optional `status`, `severity`.
- **Dataset Output**:
  - `kpis`: Open Constraints, Critical Severity Count, High Severity Count, Average Age (Days).
  - `rows`: Array of `{ constraint_number, title, category, activity, equipment, workpack, area, unit, owner, status, age_days, due_date, impact, severity, remarks }`.
- **Supported Formats**: HTML, PDF, XLSX, CSV.

### R15 — Plan vs Actual Report
- **Purpose**: Schedule variance and slippage analysis comparing planned schedule commitments directly against execution timestamps.
- **Provider Key**: `planning.plan_vs_actual`
- **Upstream Authority**: M11 Planned Schedule, M12 `FieldExecutionService.getPlanVsActual`, M8.13 Progress.
- **Required Dimensions**: `AREA`, `UNIT`, `WORKPACK`, `DISCIPLINE`, `STATUS`, `CRITICALITY`.
- **Required Parameters**: `event` (Event ID), optional `discipline`.
- **Dataset Output**:
  - `kpis`: Total Delayed Activities, Average Variance (Hours), On-Time Completion %, Critical Variances.
  - `rows`: Array of `{ activity_number, description, equipment, workpack, planned_start, planned_finish, actual_start, actual_finish, finish_variance_hours, progress_percent, status, is_delayed, is_critical }`.
- **Supported Formats**: HTML, PDF, XLSX, CSV.

### R17 — Schedule Health Report
- **Purpose**: Formal schedule integrity and quality diagnostics reporting objective logic errors, dangling activities, and missing predecessors.
- **Provider Key**: `planning.schedule_health_index`
- **Upstream Authority**: M11 `ValidationEngineService.validate`.
- **Required Dimensions**: `WBS_CODE`, `DISCIPLINE`, `STATUS`.
- **Required Parameters**: `event` (Event ID).
- **Dataset Output**:
  - `kpis`: Total Diagnostic Issues, Error Count (Critical), Warning Count, Info Count.
  - `rows`: Array of `{ rule_id, rule_name, severity, affected_element, message, recommendation }`.
- **Supported Formats**: HTML, PDF, XLSX, CSV.

---

## Execution & Readiness Intelligence

### R05 — Workpack Status Report
- **Purpose**: Status, scope completeness, and physical execution tracking across all active workpacks.
- **Provider Key**: `shutdown.workpack_status`
- **Upstream Authority**: M8.13 Progress, M10 Readiness.
- **Required Dimensions**: `UNIT`, `SYSTEM`, `DISCIPLINE`, `CONTRACTOR`.
- **Required Parameters**: `event` (Event ID).
- **Dataset Output**:
  - `kpis`: Total Workpacks, In Progress, Completed, Blocked.
  - `rows`: Array of `{ workpack_number, title, unit, discipline, contractor, readiness_state, overall_progress, status }`.
- **Supported Formats**: HTML, PDF, XLSX, CSV.

### R06 — Equipment Activity Report
- **Purpose**: Physical plant asset-centric tracking linking Tag numbers and equipment types to associated execution activities.
- **Provider Key**: `planning.activity_status_summary`
- **Upstream Authority**: M8.14 Digital Plant, M12 Field Execution.
- **Required Dimensions**: `EQUIPMENT`, `EQUIPMENT_TYPE`.
- **Required Parameters**: `event` (Event ID), optional `equipment`.
- **Dataset Output**:
  - `kpis`: Total Monitored Equipment, Overhauled Assets, Active Permits.
  - `rows`: Equipment tag, description, equipment type, unit, activities count, completed %, status.
- **Supported Formats**: HTML, PDF, XLSX, CSV.

### R12 — Holds & Delays Report
- **Purpose**: Focused analysis on activities stalled on hold points (QA/QC, Operations, Safety) or delayed past scheduled completion.
- **Provider Key**: `execution.holds_and_delays` (and `execution.delay_register`)
- **Upstream Authority**: M12 `FieldExecutionService.getPlanVsActual` and `getExecutionBoard`.
- **Required Dimensions**: `AREA`, `UNIT`, `WORKPACK`, `DISCIPLINE`, `CONTRACTOR`, `STATUS`.
- **Required Parameters**: `event` (Event ID), optional `status`.
- **Dataset Output**:
  - `kpis`: Currently on Hold, Actively Delayed, Total Lost Hours, Longest Active Hold.
  - `rows`: Array of `{ activity_number, description, equipment, workpack, hold_reason, hold_category, delay_reason, delay_category, start_time, duration_hours, current_status, responsible_party, impact, remarks }`.
- **Supported Formats**: HTML, PDF, XLSX, CSV.

### R13 — Readiness Report
- **Purpose**: Gatekeeper pre-execution evaluation evaluating all 12 operational readiness criteria and highlighting blocking prerequisites.
- **Provider Key**: `planning.workpack_readiness`
- **Upstream Authority**: M10 `PlanningReadinessService.getReadiness` and M12 Execution Readiness.
- **Required Dimensions**: `UNIT`, `SYSTEM`, `EQUIPMENT`, `DISCIPLINE`, `STATUS`.
- **Required Parameters**: `event` (Event ID), optional `readiness_state`.
- **Dataset Output**:
  - `kpis`: Ready Workpacks %, Blocked Count, Pending Permits, Material Shortages.
  - `rows`: Array of `{ workpack_number, title, equipment, readiness_state, readiness_score, failed_checks, blocking_conditions: { permit, isolation, material, manpower, tools, predecessor, documentation, qaqc, safety } }`.
- **Supported Formats**: HTML, PDF, XLSX, CSV.

---

## Technical Delivery & Integration Specifications

1. **Immutable Single Source of Truth**:
   Every report generation executes through `ReportGenerationService.generateDataset()`, which deep-freezes the dataset recursively (`deepFreeze()`) and seals it with a SHA-256 integrity hash (`datasetHash` / `dataset_hash`) excluding non-deterministic runtime attributes.
2. **Format Neutrality & Master Rendering Matrix**:
   The exact same `ReportDataset` drives HTML preview, Puppeteer PDF print engine, ExcelJS multi-sheet workbook generation, and RFC 4180 CSV export. Refer to [M14-R4 Rendering Matrix](file:///c:/DEV/STO/docs/M14_R4_RENDERING_MATRIX.md) for explicit per-report format applicability (`SUPPORTED`, `SUPPORTED_WITH_LAYOUT_VARIATION`, `NOT_APPLICABLE`).
3. **Multi-Tenant & Event Security**:
   Every report request strictly validates `organizationId` + `eventId` ownership. Cross-tenant queries, schedule updates, generation access, and artifact downloads are strictly rejected with 403 Forbidden.
4. **Execution Safety & Zero Calculations**:
   Reporting code has read-only access to query services and database tables. Calling `ExecutionWriteService` or altering authoritative metrics is architecturally prohibited.
5. **Visual Report Designer & Governed Components (M14-R5)**:
   Every report can be customized or composed visually using the `ReportDesigner` canvas and `ReportComponentCatalog`. Planners can configure section layouts, column selections, alignments, column widths, repeated PDF headers, and hierarchical presentation grouping without altering underlying domain metrics. Custom templates enforce the 4-tier configuration precedence ($\text{PLATFORM DEFAULT} \to \text{TENANT CONFIGURATION} \to \text{EVENT CONFIGURATION} \to \text{USER PERSONAL VIEW}$) and scale efficiently to 100,000+ activities with zero N+1 database queries.

