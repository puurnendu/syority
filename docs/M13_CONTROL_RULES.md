# M13 Control Tower Exception Rules

The M13 Control Tower acts as a read-only management intelligence layer. It identifies business anomalies (exceptions) based on authoritative execution, schedule, and progress data.

M13 strictly follows the architectural rule: **No local calculation of Progress, SPI, or Float**. All exceptions are defined as pure logical evaluations of states populated by the respective authorities.

## Authority Model
- **Actual Progress Authority:** M8.13 (`ProgressAggregationService`)
- **Planned Schedule / Float Authority:** M11 (`prisma.activity.total_float`, `is_critical`, `planned_start`, `planned_end`)
- **SPI Authority:** M8.10 (`EvmCalculationService`, `EvmSnapshotService`)
- **Execution Mutation / Readiness / Constraints Authority:** M12 (`ExecutionReadinessService`, `prisma.constraintLog`)

## Exception Rules Definition

The following rules evaluate the state of each active activity. If an activity triggers multiple rules, it is categorized by the highest severity rule (P1 > P2 > P3 > P4).

### 1. CRITICAL_LATE (Severity: P1)
- **Description:** Activity is on the critical path and has passed its planned finish date.
- **Source Authority:** M11 (`planned_end`, `is_critical`, `total_float`)
- **Condition:** `dataDate > planned_end` AND (`is_critical` OR `total_float <= 0`)
- **Rationale:** Immediate management intervention is required. Delays here directly push out the entire turnaround completion.

### 2. LATE (Severity: P2)
- **Description:** Activity is not critical but has passed its planned finish date.
- **Source Authority:** M11 (`planned_end`)
- **Condition:** `dataDate > planned_end` AND NOT critical
- **Rationale:** The activity is absorbing float. It requires attention before it exhausts its float and becomes critical.

### 3. READINESS_BLOCKED (Severity: P2)
- **Description:** Activity is scheduled to start but has execution readiness blockers.
- **Source Authority:** M12 (`ExecutionReadinessService`)
- **Condition:** `ExecutionReadinessService.evaluateBulkReadiness` returns `is_ready = false`
- **Rationale:** Field teams cannot execute this work due to missing permits, predecessors, or materials. Must be unblocked prior to shift start.

### 4. CONSTRAINT_BLOCKED (Severity: P2)
- **Description:** Activity is blocked by an active, critical constraint.
- **Source Authority:** M12 (`prisma.constraintLog`)
- **Condition:** Workpack has open constraints with `severity = critical`
- **Rationale:** A known issue (safety, resource, design) is actively halting progress.

### 5. ON_HOLD (Severity: P3)
- **Description:** Activity is explicitly placed on hold.
- **Source Authority:** M12 (`prisma.activity.status`)
- **Condition:** `status = 'on_hold'`
- **Rationale:** Execution has been manually paused.

### 6. PROGRESS_LAG (Severity: P3)
- **Description:** Activity is falling behind its planned value (SPI < 0.90).
- **Source Authority:** M8.10 (`EvmCalculationService.calculateActivityEvm`)
- **Condition:** `spi < 0.90` (and `spi > 0`)
- **Rationale:** The activity is burning time without corresponding physical progress. While it may not be formally late yet, the trajectory is problematic.

### Identical Activity Progress
M13 fetches Identical Activities from M8.13 to compare structurally identical items across the plant, isolating execution variance from systematic planning variance.

## 4. Lookahead Horizons (Cumulative)
M13 aggregates active tasks into cumulative Lookahead Horizons strictly using the authoritative `planned_start` from M11 schedule and readiness blockages from M12:
- **24h**: `planned_start <= now + 24 hours`
- **48h**: `planned_start <= now + 48 hours`
- **72h**: `planned_start <= now + 72 hours`
- **7d**: `planned_start <= now + 7 days`
- **14d**: `planned_start <= now + 14 days`

*Note: These horizons are explicitly cumulative. M13 must NOT invent planned progress values for these horizons if missing from the authoritative EVM baseline.*

### 7. CRITICAL (Severity: P3)
- **Description:** Active activity is on the critical path.
- **Source Authority:** M11 (`is_critical`, `total_float`)
- **Condition:** `is_critical = true` OR `total_float <= 0`
- **Rationale:** Visibility for management. All active critical activities need daily monitoring even if they are currently on schedule.

### 8. UPCOMING_RISK (Severity: P4)
- **Description:** Activity is degrading in performance while having zero float.
- **Source Authority:** M11 (Float) / M8.10 (SPI)
- **Condition:** Critical AND `0 < spi < 0.95` AND NOT Late
- **Rationale:** Early warning indicator. A critical activity is beginning to slip but has not yet breached its end date.

### 9. LOW_FLOAT (Severity: P4)
- **Description:** Activity is near the critical path.
- **Source Authority:** M11 (`total_float`)
- **Condition:** `0 < total_float <= 24` hours
- **Rationale:** Near-critical activities that need monitoring to prevent them from becoming critical.
