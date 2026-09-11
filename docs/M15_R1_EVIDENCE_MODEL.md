# M15-R1 — Evidence Model

**Date:** 8 September 2026  
**Purpose:** Every significant M15 result must answer “why did M15 say this?” without asking an LLM to reconstruct the calculation.

---

## 1. Decision envelope

Shared fields (`DecisionResultBase`):

| Field | Role |
|---|---|
| `organizationId` | Requested tenant |
| `eventId` | Requested event |
| `sourceAuthority` | Milestone / engine family (M13, M8.8, M8.10, M11, …) |
| `sourceService` | Concrete function |
| `calculatedAt` | ISO timestamp of composition |
| `evidence[]` | Provenance slices |

`ManagementRisk` adds `kind`, `severity`, `title`, `statement`, optional `exceptionCode` / `activityId` / `workpackId`.

`ForecastResult` adds `forecastType`, `value`, `unit`, `explanation`.

`ImpactSlice` adds `impactKind`, `activityId`, `value`, `unit`, `explanation`.

---

## 2. Evidence row

`IntelligenceEvidence`:

| Field | Role |
|---|---|
| `entityType` / `entityId` | activity, event, scenario, … |
| `metric` | Named fact (not a dump of Prisma internals) |
| `value` | Scalar |
| `unit` | `hours`, `date`, `currency`, `count`, `%`, … when applicable |
| `sourceAuthority` / `sourceService` | Who produced the fact |

Evidence is **citation**, not a second engine.

---

## 3. Examples

### CRITICAL_LATE interpretation

Evidence typically includes:

- `exception_code` / `m13_severity` — M13 `ControlTowerRules`
- `is_critical`, `total_float` — persisted M11
- `spi` — M8.10 via M13
- `progress_percent` — M8.13 via M13
- `downstream_activity_count` — M11 graph, unit `count`

Statement may say the activity is likely to affect TA completion **because** it is critical-path and has N downstream activities. Detection of CRITICAL_LATE remains M13.

### EXECUTION_FINISH_FORECAST

- `project_forecast_finish`, `project_planned_finish`, `project_variance_days` — M8.8
- `hours_per_day` — M11 calendar resolution

### EAC_COST_FORECAST

- `eac`, `cpi`, `spi`, `bac` — M8.10  
Explanation states this is **not** a schedule finish date.

### NETWORK_IMPACT

- `downstream_activity_count` with unit `count`  
Explicitly not scope-change heuristic hours.

---

## 4. What is not evidence

- Raw SQL
- LLM-generated scores
- Unscoped BRE alerts
- Scope-change heuristic hours labeled as CPM impact

Resource `recommended_action` may appear as evidence of **what ResourceRiskService suggested**. It is not an executed action and not an AI authority.
