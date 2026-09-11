-- M8.11 — Enterprise Scope Change & Discovery Work Workflow
-- Generated: 2026-09-01
-- Phase: 1 Foundation & Schema

-- ─────────────────────────────────────────────────────────────────────
-- 1. Formalize ScheduleChangeRequest (already exists — no DDL needed)
-- ─────────────────────────────────────────────────────────────────────

-- Table schedule_change_requests already exists from M8.8 migration.
-- Adding Prisma model mapping only. No structural changes.


-- ─────────────────────────────────────────────────────────────────────
-- 2. Discovery Work table
-- ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "discovery_work" (
    "id"                UUID         NOT NULL DEFAULT gen_random_uuid(),
    "organization_id"   UUID         NOT NULL,
    "event_id"          UUID         NOT NULL,
    "title"             TEXT         NOT NULL,
    "description"       TEXT,
    "discovery_type"    TEXT         NOT NULL DEFAULT 'field_discovery',
    "source"            TEXT,
    "location"          TEXT,
    "asset_id"          UUID,
    "discipline"        TEXT,
    "priority"          TEXT         NOT NULL DEFAULT 'medium',
    "estimated_hours"   INTEGER      NOT NULL DEFAULT 0,
    "estimated_cost"    DOUBLE PRECISION NOT NULL DEFAULT 0,
    "attachments"       JSONB        NOT NULL DEFAULT '[]',
    "status"            TEXT         NOT NULL DEFAULT 'discovered',
    "assessed_by"       UUID,
    "assessed_at"       TIMESTAMP(3),
    "assessment_notes"  TEXT,
    "scope_change_id"   UUID,
    "discovered_by"     UUID         NOT NULL,
    "discovered_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"        TIMESTAMP(3) NOT NULL,

    CONSTRAINT "discovery_work_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "discovery_work_event_status_idx" ON "discovery_work"("event_id", "status");
CREATE INDEX IF NOT EXISTS "discovery_work_org_idx" ON "discovery_work"("organization_id");

ALTER TABLE "discovery_work" ADD CONSTRAINT "discovery_work_event_fk"
    FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "discovery_work" ADD CONSTRAINT "discovery_work_org_fk"
    FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ─────────────────────────────────────────────────────────────────────
-- 3. Schedule Scope Change table
-- ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "schedule_scope_changes" (
    "id"                      UUID             NOT NULL DEFAULT gen_random_uuid(),
    "organization_id"         UUID             NOT NULL,
    "event_id"                UUID             NOT NULL,
    "discovery_id"            UUID,
    "change_number"           TEXT             NOT NULL,
    "title"                   TEXT             NOT NULL,
    "description"             TEXT,
    "change_category"         TEXT             NOT NULL DEFAULT 'scope_addition',
    "justification"           TEXT,
    "status"                  TEXT             NOT NULL DEFAULT 'draft',
    "priority"                TEXT             NOT NULL DEFAULT 'medium',
    "discipline"              TEXT,
    "schedule_impact_days"    DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cost_impact"             DOUBLE PRECISION NOT NULL DEFAULT 0,
    "resource_impact_hours"   DOUBLE PRECISION NOT NULL DEFAULT 0,
    "critical_path_affected"  BOOLEAN          NOT NULL DEFAULT false,
    "impact_analysis"         JSONB            NOT NULL DEFAULT '{}',
    "submitted_by"            UUID,
    "submitted_at"            TIMESTAMP(3),
    "reviewed_by"             UUID,
    "reviewed_at"             TIMESTAMP(3),
    "review_notes"            TEXT,
    "approved_by"             UUID,
    "approved_at"             TIMESTAMP(3),
    "applied_at"              TIMESTAMP(3),
    "applied_by"              UUID,
    "change_request_id"       UUID,
    "result_workpack_id"      UUID,
    "result_summary"          JSONB            NOT NULL DEFAULT '{}',
    "created_by"              UUID             NOT NULL,
    "created_at"              TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"              TIMESTAMP(3)     NOT NULL,

    CONSTRAINT "schedule_scope_changes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "schedule_scope_changes_number_idx"
    ON "schedule_scope_changes"("organization_id", "change_number");
CREATE INDEX IF NOT EXISTS "schedule_scope_changes_event_status_idx"
    ON "schedule_scope_changes"("event_id", "status");
CREATE INDEX IF NOT EXISTS "schedule_scope_changes_org_idx"
    ON "schedule_scope_changes"("organization_id");

ALTER TABLE "schedule_scope_changes" ADD CONSTRAINT "scope_changes_event_fk"
    FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "schedule_scope_changes" ADD CONSTRAINT "scope_changes_org_fk"
    FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "schedule_scope_changes" ADD CONSTRAINT "scope_changes_discovery_fk"
    FOREIGN KEY ("discovery_id") REFERENCES "discovery_work"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ─────────────────────────────────────────────────────────────────────
-- 4. Schedule Scope Change Items table
-- ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "schedule_scope_change_items" (
    "id"              UUID             NOT NULL DEFAULT gen_random_uuid(),
    "scope_change_id" UUID             NOT NULL,
    "item_type"       TEXT             NOT NULL DEFAULT 'new_activity',
    "description"     TEXT             NOT NULL,
    "workpack_id"     UUID,
    "activity_id"     UUID,
    "discipline"      TEXT,
    "estimated_hours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "estimated_cost"  DOUBLE PRECISION NOT NULL DEFAULT 0,
    "resource_type"   TEXT,
    "crew_size"       INTEGER          NOT NULL DEFAULT 1,
    "planned_start"   DATE,
    "planned_end"     DATE,
    "predecessor_ids" UUID[]           DEFAULT '{}',
    "notes"           TEXT,
    "sort_order"      INTEGER          NOT NULL DEFAULT 0,
    "created_at"      TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"      TIMESTAMP(3)     NOT NULL,

    CONSTRAINT "schedule_scope_change_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "scope_change_items_parent_idx"
    ON "schedule_scope_change_items"("scope_change_id");

ALTER TABLE "schedule_scope_change_items" ADD CONSTRAINT "scope_change_items_parent_fk"
    FOREIGN KEY ("scope_change_id") REFERENCES "schedule_scope_changes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
