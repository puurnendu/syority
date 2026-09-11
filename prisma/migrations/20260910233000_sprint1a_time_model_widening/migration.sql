-- Sprint 1a — Time model widening (E2E lineage audit §7.1, Phase 1 item 7;
-- C1 Time Authority Contract: storage = timestamptz, operational zone
-- Asia/Kolkata, historical date values → midnight in that zone).
--
-- ADDITIVE ONLY. date → timestamptz(3) preserves every existing value as
-- midnight Asia/Kolkata (e.g. 2026-09-01 → 2026-08-31T18:30:00.000Z).
-- No row is rewritten to a different civil date; no workflow changes.
--
-- Live census before this migration (syority, 2026-09-10):
--   39 date columns; non-empty: events.planned_start/end (49),
--   Activity planned/actual (46/23/14/7), ResourceCapacity.target_date (30),
--   material_supply_records (4/5), workpack_material_lines.expected_eta (4),
--   ScenarioActivityOverride (2/1). All others empty.
--   No views or materialized views depend on these columns.
--
-- Sequencing (audit §24): widening runs BEFORE any planned-field unification,
-- so unification cannot truncate time-of-day.
--
-- lag: lag_minutes added alongside lag_days (untouched, integer — OD9.1 guard).
-- Backfill restores the hours the retired /8 API divisor saw:
-- lag_minutes = lag_days * 8 * 60. 6 non-zero rows affected (5, 13 days).

-- ── 1. Activity ─────────────────────────────────────────────────────────────
ALTER TABLE "Activity"
  ALTER COLUMN "planned_start" TYPE timestamptz(3) USING ("planned_start"::timestamp AT TIME ZONE 'Asia/Kolkata'),
  ALTER COLUMN "planned_end"   TYPE timestamptz(3) USING ("planned_end"::timestamp AT TIME ZONE 'Asia/Kolkata'),
  ALTER COLUMN "actual_start"  TYPE timestamptz(3) USING ("actual_start"::timestamp AT TIME ZONE 'Asia/Kolkata'),
  ALTER COLUMN "actual_end"    TYPE timestamptz(3) USING ("actual_end"::timestamp AT TIME ZONE 'Asia/Kolkata');

-- ── 2. Workpack ─────────────────────────────────────────────────────────────
ALTER TABLE "Workpack"
  ALTER COLUMN "planned_start_date" TYPE timestamptz(3) USING ("planned_start_date"::timestamp AT TIME ZONE 'Asia/Kolkata'),
  ALTER COLUMN "planned_end_date"   TYPE timestamptz(3) USING ("planned_end_date"::timestamp AT TIME ZONE 'Asia/Kolkata');

-- ── 3. Event (physical: events) ─────────────────────────────────────────────
ALTER TABLE "events"
  ALTER COLUMN "planned_start" TYPE timestamptz(3) USING ("planned_start"::timestamp AT TIME ZONE 'Asia/Kolkata'),
  ALTER COLUMN "planned_end"   TYPE timestamptz(3) USING ("planned_end"::timestamp AT TIME ZONE 'Asia/Kolkata'),
  ALTER COLUMN "actual_start"  TYPE timestamptz(3) USING ("actual_start"::timestamp AT TIME ZONE 'Asia/Kolkata'),
  ALTER COLUMN "actual_end"    TYPE timestamptz(3) USING ("actual_end"::timestamp AT TIME ZONE 'Asia/Kolkata');

-- ── 4. EventMilestone (physical: event_milestones) ─────────────────────────
ALTER TABLE "event_milestones"
  ALTER COLUMN "planned_date" TYPE timestamptz(3) USING ("planned_date"::timestamp AT TIME ZONE 'Asia/Kolkata'),
  ALTER COLUMN "actual_date"  TYPE timestamptz(3) USING ("actual_date"::timestamp AT TIME ZONE 'Asia/Kolkata');

-- ── 5. Material readiness / supply chain ────────────────────────────────────
ALTER TABLE "material_constraints"
  ALTER COLUMN "constraint_date" TYPE timestamptz(3) USING ("constraint_date"::timestamp AT TIME ZONE 'Asia/Kolkata'),
  ALTER COLUMN "earliest_eta"    TYPE timestamptz(3) USING ("earliest_eta"::timestamp AT TIME ZONE 'Asia/Kolkata');

ALTER TABLE "material_supply_records"
  ALTER COLUMN "expected_delivery" TYPE timestamptz(3) USING ("expected_delivery"::timestamp AT TIME ZONE 'Asia/Kolkata'),
  ALTER COLUMN "actual_delivery"   TYPE timestamptz(3) USING ("actual_delivery"::timestamp AT TIME ZONE 'Asia/Kolkata');

ALTER TABLE "workpack_material_lines"
  ALTER COLUMN "expected_eta" TYPE timestamptz(3) USING ("expected_eta"::timestamp AT TIME ZONE 'Asia/Kolkata');

ALTER TABLE "WorkpackMaterial"
  ALTER COLUMN "required_date" TYPE timestamptz(3) USING ("required_date"::timestamp AT TIME ZONE 'Asia/Kolkata');

-- ── 6. Scenario / scope-change schedule payloads ────────────────────────────
ALTER TABLE "ScenarioActivityOverride"
  ALTER COLUMN "planned_start" TYPE timestamptz(3) USING ("planned_start"::timestamp AT TIME ZONE 'Asia/Kolkata'),
  ALTER COLUMN "planned_end"   TYPE timestamptz(3) USING ("planned_end"::timestamp AT TIME ZONE 'Asia/Kolkata');

ALTER TABLE "schedule_scope_change_items"
  ALTER COLUMN "planned_start" TYPE timestamptz(3) USING ("planned_start"::timestamp AT TIME ZONE 'Asia/Kolkata'),
  ALTER COLUMN "planned_end"   TYPE timestamptz(3) USING ("planned_end"::timestamp AT TIME ZONE 'Asia/Kolkata');

-- ── 7. Constraints / punch / resources / safety (operational dates) ─────────
ALTER TABLE "Constraint"
  ALTER COLUMN "target_resolution_date" TYPE timestamptz(3) USING ("target_resolution_date"::timestamp AT TIME ZONE 'Asia/Kolkata'),
  ALTER COLUMN "actual_resolution_date" TYPE timestamptz(3) USING ("actual_resolution_date"::timestamp AT TIME ZONE 'Asia/Kolkata');

ALTER TABLE "PunchListItem"
  ALTER COLUMN "target_close_date" TYPE timestamptz(3) USING ("target_close_date"::timestamp AT TIME ZONE 'Asia/Kolkata');

ALTER TABLE "ResourceCapacity"
  ALTER COLUMN "target_date" TYPE timestamptz(3) USING ("target_date"::timestamp AT TIME ZONE 'Asia/Kolkata');

ALTER TABLE "ActivityResource"
  ALTER COLUMN "assigned_date" TYPE timestamptz(3) USING ("assigned_date"::timestamp AT TIME ZONE 'Asia/Kolkata');

ALTER TABLE "SafetyIncident"
  ALTER COLUMN "action_due_date"       TYPE timestamptz(3) USING ("action_due_date"::timestamp AT TIME ZONE 'Asia/Kolkata'),
  ALTER COLUMN "action_completed_date" TYPE timestamptz(3) USING ("action_completed_date"::timestamp AT TIME ZONE 'Asia/Kolkata');

ALTER TABLE "SafetyLog"
  ALTER COLUMN "log_date" TYPE timestamptz(3) USING ("log_date"::timestamp AT TIME ZONE 'Asia/Kolkata');

-- ── 8. Remaining date-only columns (master data / documents / platform) ─────
-- Widened for storage-model consistency (C1: timestamptz is the ratified
-- storage standard). Day-granularity semantics unchanged.
ALTER TABLE "ActivityLibraryUdfDefault"
  ALTER COLUMN "value_date" TYPE timestamptz(3) USING ("value_date"::timestamp AT TIME ZONE 'Asia/Kolkata');

ALTER TABLE "ActivityUdfValue"
  ALTER COLUMN "value_date" TYPE timestamptz(3) USING ("value_date"::timestamp AT TIME ZONE 'Asia/Kolkata');

ALTER TABLE "asset_attribute_values"
  ALTER COLUMN "value_date" TYPE timestamptz(3) USING ("value_date"::timestamp AT TIME ZONE 'Asia/Kolkata');

ALTER TABLE "asset_attribute_history"
  ALTER COLUMN "value_date" TYPE timestamptz(3) USING ("value_date"::timestamp AT TIME ZONE 'Asia/Kolkata');

ALTER TABLE "plant_documents"
  ALTER COLUMN "issue_date" TYPE timestamptz(3) USING ("issue_date"::timestamp AT TIME ZONE 'Asia/Kolkata');

ALTER TABLE "engineering_issues"
  ALTER COLUMN "raised_date" TYPE timestamptz(3) USING ("raised_date"::timestamp AT TIME ZONE 'Asia/Kolkata'),
  ALTER COLUMN "due_date"    TYPE timestamptz(3) USING ("due_date"::timestamp AT TIME ZONE 'Asia/Kolkata');

ALTER TABLE "shutdown_scopes"
  ALTER COLUMN "freeze_date" TYPE timestamptz(3) USING ("freeze_date"::timestamp AT TIME ZONE 'Asia/Kolkata');

ALTER TABLE "platform_usage"
  ALTER COLUMN "period_date" TYPE timestamptz(3) USING ("period_date"::timestamp AT TIME ZONE 'Asia/Kolkata');

-- ── 9. Lag in minutes (Phase 1 item 8, first half) ──────────────────────────
-- lag_days remains (integer, untouched). lag_minutes is the canonical
-- sub-day-capable representation going forward.
ALTER TABLE "ActivityRelationship" ADD COLUMN "lag_minutes" INTEGER;

-- Restore the hours the retired /8 API divisor saw (lag_days * 8h * 60m).
-- Provenance caveat: rows written by template instantiation used lag_hours/24;
-- 6 non-zero rows exist and their origin is not recorded per-row.
UPDATE "ActivityRelationship"
SET "lag_minutes" = "lag_days" * 8 * 60
WHERE "lag_days" IS NOT NULL AND "lag_days" <> 0;

-- Rows with lag_days = 0 / NULL get lag_minutes = 0 for a clean canonical read.
UPDATE "ActivityRelationship"
SET "lag_minutes" = 0
WHERE "lag_minutes" IS NULL;
