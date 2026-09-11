-- M8.8 — Schedule Control: Baseline, Scenario & Change Request Schema Extension
-- Generated: 2026-08-31
-- Phase: 2J.1 Foundation & Schema

-- ─────────────────────────────────────────────────────────────────────
-- 1. Extend ScheduleBaseline: add event_id, description, snapshot_metadata
-- ─────────────────────────────────────────────────────────────────────

ALTER TABLE "ScheduleBaseline" ALTER COLUMN "project_id" DROP NOT NULL;

ALTER TABLE "ScheduleBaseline" ADD COLUMN IF NOT EXISTS "event_id" UUID;
ALTER TABLE "ScheduleBaseline" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "ScheduleBaseline" ADD COLUMN IF NOT EXISTS "snapshot_metadata" JSONB DEFAULT '{}';

-- Indexes
CREATE INDEX IF NOT EXISTS "ScheduleBaseline_organization_id_idx" ON "ScheduleBaseline"("organization_id");
CREATE INDEX IF NOT EXISTS "ScheduleBaseline_event_id_is_current_idx" ON "ScheduleBaseline"("event_id", "is_current");
CREATE INDEX IF NOT EXISTS "ScheduleBaseline_project_id_idx" ON "ScheduleBaseline"("project_id");

-- FK to events table
ALTER TABLE "ScheduleBaseline" ADD CONSTRAINT "ScheduleBaseline_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ─────────────────────────────────────────────────────────────────────
-- 2. Extend BaselineActivity: add organization_id, CPM fields, progress, indexes
-- ─────────────────────────────────────────────────────────────────────

ALTER TABLE "BaselineActivity" ADD COLUMN IF NOT EXISTS "organization_id" UUID;
ALTER TABLE "BaselineActivity" ADD COLUMN IF NOT EXISTS "early_start" TIMESTAMP(3);
ALTER TABLE "BaselineActivity" ADD COLUMN IF NOT EXISTS "early_finish" TIMESTAMP(3);
ALTER TABLE "BaselineActivity" ADD COLUMN IF NOT EXISTS "late_start" TIMESTAMP(3);
ALTER TABLE "BaselineActivity" ADD COLUMN IF NOT EXISTS "late_finish" TIMESTAMP(3);
ALTER TABLE "BaselineActivity" ADD COLUMN IF NOT EXISTS "total_float" DECIMAL(12,2);
ALTER TABLE "BaselineActivity" ADD COLUMN IF NOT EXISTS "free_float" DOUBLE PRECISION;
ALTER TABLE "BaselineActivity" ADD COLUMN IF NOT EXISTS "is_critical" BOOLEAN DEFAULT false;
ALTER TABLE "BaselineActivity" ADD COLUMN IF NOT EXISTS "status" TEXT;
ALTER TABLE "BaselineActivity" ADD COLUMN IF NOT EXISTS "progress_percent" INTEGER DEFAULT 0;

-- Indexes
CREATE INDEX IF NOT EXISTS "BaselineActivity_baseline_id_idx" ON "BaselineActivity"("baseline_id");
CREATE INDEX IF NOT EXISTS "BaselineActivity_activity_id_idx" ON "BaselineActivity"("activity_id");
CREATE INDEX IF NOT EXISTS "BaselineActivity_organization_id_idx" ON "BaselineActivity"("organization_id");

-- FK: BaselineActivity → ScheduleBaseline (cascade delete)
ALTER TABLE "BaselineActivity" ADD CONSTRAINT "BaselineActivity_baseline_id_fkey" FOREIGN KEY ("baseline_id") REFERENCES "ScheduleBaseline"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ─────────────────────────────────────────────────────────────────────
-- 3. Create ScheduleScenario table
-- ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "schedule_scenarios" (
    "id"                   UUID         NOT NULL DEFAULT gen_random_uuid(),
    "organization_id"      UUID         NOT NULL,
    "event_id"             UUID         NOT NULL,
    "name"                 TEXT         NOT NULL,
    "description"          TEXT,
    "source_type"          TEXT         NOT NULL DEFAULT 'leveling',
    "snapshot_json"        JSONB        NOT NULL,
    "activities_affected"  INTEGER      NOT NULL DEFAULT 0,
    "float_consumed"       DOUBLE PRECISION DEFAULT 0,
    "project_finish_delta" DOUBLE PRECISION DEFAULT 0,
    "constraints_resolved" INTEGER      NOT NULL DEFAULT 0,
    "status"               TEXT         NOT NULL DEFAULT 'draft',
    "created_by"           UUID         NOT NULL,
    "created_at"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"           TIMESTAMP(3) NOT NULL,

    CONSTRAINT "schedule_scenarios_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX IF NOT EXISTS "schedule_scenarios_event_id_status_idx" ON "schedule_scenarios"("event_id", "status");
CREATE INDEX IF NOT EXISTS "schedule_scenarios_organization_id_idx" ON "schedule_scenarios"("organization_id");

-- FK to events
ALTER TABLE "schedule_scenarios" ADD CONSTRAINT "schedule_scenarios_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ─────────────────────────────────────────────────────────────────────
-- 4. Create ScheduleChangeRequest table
-- ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "schedule_change_requests" (
    "id"                   UUID         NOT NULL DEFAULT gen_random_uuid(),
    "organization_id"      UUID         NOT NULL,
    "event_id"             UUID         NOT NULL,
    "change_type"          TEXT         NOT NULL,
    "title"                TEXT         NOT NULL,
    "description"          TEXT,
    "scenario_id"          UUID,
    "simulation_data"      JSONB,
    "activities_affected"  INTEGER      NOT NULL DEFAULT 0,
    "float_consumed"       DOUBLE PRECISION DEFAULT 0,
    "project_finish_delta" DOUBLE PRECISION DEFAULT 0,
    "constraints_resolved" INTEGER      NOT NULL DEFAULT 0,
    "status"               TEXT         NOT NULL DEFAULT 'proposed',
    "submitted_by"         UUID         NOT NULL,
    "submitted_at"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_by"          UUID,
    "reviewed_at"          TIMESTAMP(3),
    "review_notes"         TEXT,
    "applied_at"           TIMESTAMP(3),
    "applied_by"           UUID,
    "created_at"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"           TIMESTAMP(3) NOT NULL,

    CONSTRAINT "schedule_change_requests_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX IF NOT EXISTS "schedule_change_requests_event_id_status_idx" ON "schedule_change_requests"("event_id", "status");
CREATE INDEX IF NOT EXISTS "schedule_change_requests_organization_id_idx" ON "schedule_change_requests"("organization_id");

-- FK to events
ALTER TABLE "schedule_change_requests" ADD CONSTRAINT "schedule_change_requests_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
