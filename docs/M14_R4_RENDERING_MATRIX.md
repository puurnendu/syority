# M14-R4 — REPORT RENDERING & EXPORT MATRIX

**Milestone:** M14-R4 (Report Rendering, Export, Scheduling & Delivery)  
**Standard Catalog:** Reports R01 through R18  
**Applicability Classifications:**
- `SUPPORTED`: Full native rendering supported by the format.
- `SUPPORTED_WITH_LAYOUT_VARIATION`: Supported with layout adaptations suited to the medium (e.g. key-value rows for KPI-heavy reports in CSV, landscape orientation in PDF).
- `NOT_APPLICABLE`: Format cannot meaningfully represent the data (all R01–R18 support at least tabular export).

---

## 1. Master Rendering Matrix (R01 — R18)

| Report ID | Report Name | Data Source Key | HTML | PDF | XLSX | CSV | Preferred Orientation | Notes |
| :--- | :--- | :--- | :---: | :---: | :---: | :---: | :---: | :--- |
| **R01** | Executive Daily Report | `management.executive_dashboard` | `SUPPORTED` | `SUPPORTED` | `SUPPORTED` | `SUPPORTED_WITH_LAYOUT_VARIATION` | Portrait | CSV serializes KPI cards as key-value pairs; XLSX includes KPI summary block and provenance sheet. |
| **R02** | Daily TA Progress Report | `execution.daily_progress` | `SUPPORTED` | `SUPPORTED` | `SUPPORTED` | `SUPPORTED` | Portrait | Shift notes and completed/delayed activities in structured tabular rows. |
| **R03** | Area Progress Report | `shutdown.unit_progress` | `SUPPORTED` | `SUPPORTED` | `SUPPORTED` | `SUPPORTED` | Portrait | Physical area aggregation with duration-weighted progress from M8.13. |
| **R04** | Unit Progress Report | `shutdown.unit_progress` | `SUPPORTED` | `SUPPORTED` | `SUPPORTED` | `SUPPORTED` | Portrait | Process unit progress with critical path status indicator. |
| **R05** | Shift Handover Report | `execution.shift_handover` | `SUPPORTED` | `SUPPORTED` | `SUPPORTED` | `SUPPORTED` | Portrait | Handover notes, active permits, ongoing holds, and immediate next shift priorities. |
| **R06** | Milestone Status Report | `planning.milestones` | `SUPPORTED` | `SUPPORTED` | `SUPPORTED` | `SUPPORTED` | Portrait | Milestone target dates, forecast dates, and variance from M11. |
| **R07** | Contractor Performance | `shutdown.contractor_progress` | `SUPPORTED` | `SUPPORTED` | `SUPPORTED` | `SUPPORTED` | Landscape | Multi-column comparison of headcount, hours, workpacks, and delay count. |
| **R08** | Discipline Performance | `shutdown.discipline_progress` | `SUPPORTED` | `SUPPORTED` | `SUPPORTED` | `SUPPORTED` | Portrait | Mechanical, electrical, instrumentation, civil, insulation, and scaffolding breakdown. |
| **R09** | Lookahead Report | `planning.lookahead` | `SUPPORTED` | `SUPPORTED` | `SUPPORTED` | `SUPPORTED` | Landscape | Horizons (24h, 48h, 72h, 7d, 14d) from M12; wide tabular layout with readiness badges. |
| **R10** | Critical Activities Report | `planning.critical_activities` | `SUPPORTED` | `SUPPORTED` | `SUPPORTED` | `SUPPORTED` | Landscape | Filtered by `is_critical: true` and float values from M11 CPM persistence. |
| **R11** | Constraint Register | `planning.constraint_register` | `SUPPORTED` | `SUPPORTED` | `SUPPORTED` | `SUPPORTED` | Landscape | Equipment, workpack, category, status, blocking flag, and resolution target dates. |
| **R12** | Holds & Delays Report | `execution.holds_and_delays` | `SUPPORTED` | `SUPPORTED` | `SUPPORTED` | `SUPPORTED` | Landscape | Finish variance hours, delay categories, hold categories, and root cause notes from M12. |
| **R13** | Workpack Readiness Report | `planning.workpack_readiness` | `SUPPORTED` | `SUPPORTED` | `SUPPORTED` | `SUPPORTED` | Landscape | Full 12-criteria readiness breakdown from M10/M12. XLSX preserves all criterion flags. |
| **R14** | Identical Activities Report | `planning.identical_activities` | `SUPPORTED` | `SUPPORTED` | `SUPPORTED` | `SUPPORTED` | Portrait | HTML/PDF render progress bars; XLSX/CSV preserve exact numeric progress % and balances. |
| **R15** | Plan vs Actual Report | `planning.plan_vs_actual` | `SUPPORTED` | `SUPPORTED` | `SUPPORTED` | `SUPPORTED` | Landscape | Direct comparison of planned vs actual start/finish dates and schedule variance hours. |
| **R16** | S-Curve Report | `management.scurve` | `SUPPORTED` | `SUPPORTED` | `SUPPORTED` | `SUPPORTED` | Landscape | Timeseries data of PV, EV, AC, and EAC from M8.10. PDF includes chart visual; CSV timeseries table. |
| **R17** | Schedule Health Report | `planning.schedule_health_index` | `SUPPORTED` | `SUPPORTED` | `SUPPORTED` | `SUPPORTED_WITH_LAYOUT_VARIATION` | Portrait | Error, Warning, and Info counts from M11 validation engine. CSV serializes validation rules. |
| **R18** | Management Exceptions | `management.control_tower_exceptions` | `SUPPORTED` | `SUPPORTED` | `SUPPORTED` | `SUPPORTED` | Landscape | Control Tower P1–P4 alerts, anomaly details, and recommended actions from M13. |

---

## 2. Invariant Single-Dataset Rule

Across all 18 reports and all four output formats:
1. **Zero Multi-Querying**: The authoritative provider executes **once** to generate the frozen `ReportDataset`.
2. **Deterministic Hashing**: The `dataset_hash` is computed from the immutable semantic dataset content, invariant across HTML, PDF, XLSX, and CSV generation.
3. **No Metric Recalculation**: Renderers format dates, numbers, and strings into the target medium without performing mathematical alterations, aggregation, or business rule reconstruction.
4. **Provenance Continuity**: Every exported artifact (PDF, XLSX, CSV) embeds or preserves provenance metadata (Organization, Event, Generated By, Data As Of, Dataset Hash, Authority Sources).
