-- ═══════════════════════════════════════════════════════
-- PHASE 1: AURIANOA OS EXPANSION
-- Run: npx prisma db execute --file prisma/migrations/phase1_expansion.sql
-- ═══════════════════════════════════════════════════════

-- ── 1. Projects ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "Project" (
  "id"               TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "org_id"           UUID NOT NULL,
  "name"             TEXT NOT NULL,
  "code"             TEXT NOT NULL,
  "client"           TEXT,
  "location"         TEXT,
  "plant_name"       TEXT,
  "status"           TEXT NOT NULL DEFAULT 'Planning',
  "planned_sd_date"  TIMESTAMPTZ,
  "planned_su_date"  TIMESTAMPTZ,
  "forecast_sd_date" TIMESTAMPTZ,
  "forecast_su_date" TIMESTAMPTZ,
  "actual_sd_date"   TIMESTAMPTZ,
  "actual_su_date"   TIMESTAMPTZ,
  "description"      TEXT,
  "created_by"       TEXT,
  "created_at"       TIMESTAMPTZ DEFAULT now(),
  "updated_at"       TIMESTAMPTZ DEFAULT now()
);

-- ── 2. Project Units (refinery process units under a project; avoid conflict with existing Unit) ──
CREATE TABLE IF NOT EXISTS "project_units" (
  "id"          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "project_id"  TEXT NOT NULL REFERENCES "Project"("id") ON DELETE CASCADE,
  "name"        TEXT NOT NULL,
  "code"        TEXT,
  "description" TEXT,
  "order_index" INTEGER DEFAULT 0,
  "created_at"  TIMESTAMPTZ DEFAULT now()
);

-- ── 3. Equipment Types ───────────────────────────────────
CREATE TABLE IF NOT EXISTS "EquipmentType" (
  "id"          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "org_id"      TEXT NOT NULL,
  "name"        TEXT NOT NULL,
  "code"        TEXT,
  "description" TEXT,
  "is_active"   BOOLEAN DEFAULT true,
  "created_at"  TIMESTAMPTZ DEFAULT now()
);

-- ── 4. Equipment Registry ────────────────────────────────
CREATE TABLE IF NOT EXISTS "Equipment" (
  "id"                   TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "project_id"           TEXT NOT NULL REFERENCES "Project"("id") ON DELETE CASCADE,
  "unit_id"              TEXT REFERENCES "project_units"("id"),
  "equipment_type_id"    TEXT REFERENCES "EquipmentType"("id"),
  "tag"                  TEXT NOT NULL,
  "description"          TEXT,
  "area"                 TEXT,
  "manufacturer"         TEXT,
  "model"                TEXT,
  "serial_number"        TEXT,
  "year_of_manufacture"  INTEGER,
  "technical_data"       JSONB,
  "created_at"           TIMESTAMPTZ DEFAULT now(),
  "updated_at"           TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "Equipment_project_id_idx" ON "Equipment"("project_id");
CREATE INDEX IF NOT EXISTS "Equipment_tag_idx" ON "Equipment"("tag");

-- ── 5. Link existing Workpack to Project (optional) ──
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Workpack' AND column_name = 'project_id'
  ) THEN
    ALTER TABLE "Workpack" ADD COLUMN "project_id" TEXT REFERENCES "Project"("id");
  END IF;
END $$;

-- ── 6. Add scheduling fields to existing Activity table ──
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Activity' AND column_name = 'early_start') THEN
    ALTER TABLE "Activity"
      ADD COLUMN "early_start"    TIMESTAMPTZ,
      ADD COLUMN "early_finish"   TIMESTAMPTZ,
      ADD COLUMN "late_start"     TIMESTAMPTZ,
      ADD COLUMN "late_finish"    TIMESTAMPTZ,
      ADD COLUMN "total_float"    NUMERIC,
      ADD COLUMN "is_critical"    BOOLEAN DEFAULT false,
      ADD COLUMN "manpower_count" INTEGER,
      ADD COLUMN "manpower_type"  TEXT,
      ADD COLUMN "wbs_code"       TEXT;
  END IF;
END $$;

-- ── 7. Project-level constraints (separate from existing workpack Constraint) ──
CREATE TABLE IF NOT EXISTS "project_constraints" (
  "id"           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "project_id"   TEXT REFERENCES "Project"("id") ON DELETE CASCADE,
  "workpack_id"  UUID REFERENCES "Workpack"("id") ON DELETE CASCADE,
  "activity_id"  UUID REFERENCES "Activity"("id") ON DELETE SET NULL,
  "title"        TEXT NOT NULL,
  "description"  TEXT,
  "owner"        TEXT,
  "discipline"   TEXT,
  "impact"       TEXT NOT NULL DEFAULT 'Medium',
  "status"       TEXT NOT NULL DEFAULT 'Open',
  "due_date"     DATE,
  "resolution"   TEXT,
  "resolved_at"  TIMESTAMPTZ,
  "created_by"   TEXT,
  "created_at"   TIMESTAMPTZ DEFAULT now(),
  "updated_at"   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "project_constraints_project_id_idx" ON "project_constraints"("project_id");
CREATE INDEX IF NOT EXISTS "project_constraints_status_idx" ON "project_constraints"("status");

-- ── 8. Project-level punch items (separate from existing PunchListItem) ──
CREATE TABLE IF NOT EXISTS "punch_items" (
  "id"           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "project_id"   TEXT REFERENCES "Project"("id") ON DELETE CASCADE,
  "workpack_id"  UUID REFERENCES "Workpack"("id") ON DELETE CASCADE,
  "equipment_id" TEXT REFERENCES "Equipment"("id") ON DELETE SET NULL,
  "punch_number" TEXT,
  "category"     TEXT NOT NULL DEFAULT 'B',
  "description"  TEXT NOT NULL,
  "discipline"   TEXT,
  "location"     TEXT,
  "raised_by"    TEXT,
  "assigned_to"  TEXT,
  "status"       TEXT NOT NULL DEFAULT 'Open',
  "due_date"     DATE,
  "closed_at"    TIMESTAMPTZ,
  "remarks"      TEXT,
  "photo_paths"  JSONB,
  "created_at"   TIMESTAMPTZ DEFAULT now(),
  "updated_at"   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "punch_items_project_id_idx" ON "punch_items"("project_id");
CREATE INDEX IF NOT EXISTS "punch_items_status_idx" ON "punch_items"("status");
CREATE INDEX IF NOT EXISTS "punch_items_category_idx" ON "punch_items"("category");

-- ── 9. Permits (PTW) ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS "Permit" (
  "id"              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "project_id"      TEXT REFERENCES "Project"("id") ON DELETE CASCADE,
  "workpack_id"     UUID REFERENCES "Workpack"("id") ON DELETE CASCADE,
  "activity_id"     UUID REFERENCES "Activity"("id") ON DELETE SET NULL,
  "permit_number"   TEXT NOT NULL,
  "permit_type"     TEXT NOT NULL,
  "work_description" TEXT,
  "location"        TEXT,
  "issued_by"       TEXT,
  "issued_at"       TIMESTAMPTZ,
  "valid_until"     TIMESTAMPTZ,
  "extended_until"  TIMESTAMPTZ,
  "status"          TEXT NOT NULL DEFAULT 'Draft',
  "precautions"     TEXT,
  "gas_test_result" TEXT,
  "closed_by"       TEXT,
  "closed_at"       TIMESTAMPTZ,
  "remarks"         TEXT,
  "created_at"      TIMESTAMPTZ DEFAULT now(),
  "updated_at"      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "Permit_project_id_idx" ON "Permit"("project_id");
CREATE INDEX IF NOT EXISTS "Permit_status_idx" ON "Permit"("status");
CREATE INDEX IF NOT EXISTS "Permit_workpack_id_idx" ON "Permit"("workpack_id");

-- ── 10. Progress Logs ────────────────────────────────────
CREATE TABLE IF NOT EXISTS "ProgressLog" (
  "id"               TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "activity_id"      UUID NOT NULL REFERENCES "Activity"("id") ON DELETE CASCADE,
  "log_date"         DATE NOT NULL,
  "progress_percent" NUMERIC NOT NULL,
  "manhours_actual"  NUMERIC,
  "logged_by"        TEXT,
  "remarks"          TEXT,
  "created_at"       TIMESTAMPTZ DEFAULT now()
);

-- ── 11. Safety Logs ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS "SafetyLog" (
  "id"               TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "project_id"       TEXT NOT NULL REFERENCES "Project"("id") ON DELETE CASCADE,
  "log_date"         DATE NOT NULL,
  "lti"              INTEGER DEFAULT 0,
  "near_miss"        INTEGER DEFAULT 0,
  "first_aid"        INTEGER DEFAULT 0,
  "ptw_issued"       INTEGER DEFAULT 0,
  "ptw_closed"       INTEGER DEFAULT 0,
  "toolbox_talks"    INTEGER DEFAULT 0,
  "manpower_onsite"  INTEGER DEFAULT 0,
  "notes"            TEXT,
  "created_at"       TIMESTAMPTZ DEFAULT now(),
  UNIQUE("project_id", "log_date")
);
