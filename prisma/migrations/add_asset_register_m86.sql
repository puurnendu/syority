-- M8.6 Asset Register Migration
-- Architecture: M8.6_ASSET_REGISTER_FINAL_ARCHITECTURE.md (R2.1 Frozen)
-- All changes are ADDITIVE — no DROP, no ALTER COLUMN TYPE, no data modification.

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. ALTER existing "Asset" table — add new nullable columns
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE "Asset" ADD COLUMN IF NOT EXISTS "parent_asset_id" UUID;
ALTER TABLE "Asset" ADD COLUMN IF NOT EXISTS "area_id" UUID;
ALTER TABLE "Asset" ADD COLUMN IF NOT EXISTS "design_code" TEXT;
ALTER TABLE "Asset" ADD COLUMN IF NOT EXISTS "corrosion_loop_id" TEXT;

-- Self-referencing FK for parent/child hierarchy
ALTER TABLE "Asset"
  ADD CONSTRAINT "Asset_parent_asset_id_fkey"
  FOREIGN KEY ("parent_asset_id") REFERENCES "Asset"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "Asset_parent_asset_id_idx" ON "Asset"("parent_asset_id");

-- ═══════════════════════════════════════════════════════════════════════════════
-- 2. CREATE "asset_attribute_definitions"
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE "asset_attribute_definitions" (
  "id"               UUID         NOT NULL DEFAULT gen_random_uuid(),
  "organization_id"  UUID,
  "code"             TEXT         NOT NULL,
  "name"             TEXT         NOT NULL,
  "description"      TEXT,
  "data_type"        TEXT         NOT NULL,
  "unit"             TEXT,
  "equipment_types"  TEXT[]       NOT NULL DEFAULT '{}',
  "group_name"       TEXT,
  "group_sort_order" INTEGER      NOT NULL DEFAULT 0,
  "sort_order"       INTEGER      NOT NULL DEFAULT 0,
  "is_required"      BOOLEAN      NOT NULL DEFAULT false,
  "is_design_basis"  BOOLEAN      NOT NULL DEFAULT false,
  "validation_rule"  JSONB,
  "select_options"   JSONB,
  "scope"            TEXT         NOT NULL DEFAULT 'TENANT',
  "is_active"        BOOLEAN      NOT NULL DEFAULT true,
  "created_by"       UUID,
  "created_at"       TIMESTAMPTZ  NOT NULL DEFAULT now(),
  "updated_at"       TIMESTAMPTZ  NOT NULL DEFAULT now(),

  CONSTRAINT "asset_attribute_definitions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "org_attr_code"
  ON "asset_attribute_definitions"("organization_id", "code");

CREATE INDEX "asset_attribute_definitions_organization_id_is_active_idx"
  ON "asset_attribute_definitions"("organization_id", "is_active");

-- ═══════════════════════════════════════════════════════════════════════════════
-- 3. CREATE "asset_attribute_values"
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE "asset_attribute_values" (
  "id"                  UUID         NOT NULL DEFAULT gen_random_uuid(),
  "organization_id"     UUID         NOT NULL,
  "asset_id"            UUID         NOT NULL,
  "definition_id"       UUID         NOT NULL,
  "value_string"        TEXT,
  "value_number"        DOUBLE PRECISION,
  "value_boolean"       BOOLEAN,
  "value_date"          DATE,
  "source_type"         TEXT         NOT NULL DEFAULT 'manual',
  "source_document_id"  UUID,
  "source_doc_revision" TEXT,
  "source_page"         INTEGER,
  "source_region"       TEXT,
  "ai_model"            TEXT,
  "ai_confidence"       DOUBLE PRECISION,
  "extraction_job_id"   UUID,
  "status"              TEXT         NOT NULL DEFAULT 'unverified',
  "entered_by"          UUID,
  "entered_at"          TIMESTAMPTZ  NOT NULL DEFAULT now(),
  "verified_by"         UUID,
  "verified_at"         TIMESTAMPTZ,
  "verification_notes"  TEXT,
  "created_at"          TIMESTAMPTZ  NOT NULL DEFAULT now(),
  "updated_at"          TIMESTAMPTZ  NOT NULL DEFAULT now(),

  CONSTRAINT "asset_attribute_values_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "asset_attribute_values"
  ADD CONSTRAINT "asset_attribute_values_asset_id_fkey"
  FOREIGN KEY ("asset_id") REFERENCES "Asset"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "asset_attribute_values"
  ADD CONSTRAINT "asset_attribute_values_definition_id_fkey"
  FOREIGN KEY ("definition_id") REFERENCES "asset_attribute_definitions"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX "asset_attr_unique"
  ON "asset_attribute_values"("asset_id", "definition_id");

CREATE INDEX "asset_attribute_values_asset_id_status_idx"
  ON "asset_attribute_values"("asset_id", "status");

CREATE INDEX "asset_attribute_values_definition_id_idx"
  ON "asset_attribute_values"("definition_id");

-- ═══════════════════════════════════════════════════════════════════════════════
-- 4. CREATE "asset_attribute_history" (STRICT APPEND-ONLY)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE "asset_attribute_history" (
  "id"                    UUID         NOT NULL DEFAULT gen_random_uuid(),
  "organization_id"       UUID         NOT NULL,
  "asset_id"              UUID         NOT NULL,
  "definition_id"         UUID         NOT NULL,
  "value_id"              UUID,
  "value_string"          TEXT,
  "value_number"          DOUBLE PRECISION,
  "value_boolean"         BOOLEAN,
  "value_date"            DATE,
  "source_type"           TEXT         NOT NULL,
  "source_document_id"    UUID,
  "source_doc_revision"   TEXT,
  "source_page"           INTEGER,
  "source_region"         TEXT,
  "ai_model"              TEXT,
  "ai_confidence"         DOUBLE PRECISION,
  "extraction_job_id"     UUID,
  "action"                TEXT         NOT NULL,
  "status_at_time"        TEXT         NOT NULL,
  "refers_to_history_id"  UUID,
  "performed_by"          UUID         NOT NULL,
  "performed_at"          TIMESTAMPTZ  NOT NULL DEFAULT now(),
  "reason"                TEXT,
  "created_at"            TIMESTAMPTZ  NOT NULL DEFAULT now(),

  CONSTRAINT "asset_attribute_history_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "asset_attribute_history"
  ADD CONSTRAINT "asset_attribute_history_asset_id_fkey"
  FOREIGN KEY ("asset_id") REFERENCES "Asset"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "asset_attribute_history"
  ADD CONSTRAINT "asset_attribute_history_definition_id_fkey"
  FOREIGN KEY ("definition_id") REFERENCES "asset_attribute_definitions"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "asset_attribute_history"
  ADD CONSTRAINT "asset_attribute_history_value_id_fkey"
  FOREIGN KEY ("value_id") REFERENCES "asset_attribute_values"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "asset_attribute_history_asset_def_performed_idx"
  ON "asset_attribute_history"("asset_id", "definition_id", "performed_at");

CREATE INDEX "asset_attribute_history_asset_performed_idx"
  ON "asset_attribute_history"("asset_id", "performed_at");

CREATE INDEX "asset_attribute_history_org_performed_idx"
  ON "asset_attribute_history"("organization_id", "performed_at");

CREATE INDEX "asset_attribute_history_refers_to_idx"
  ON "asset_attribute_history"("refers_to_history_id");

-- ═══════════════════════════════════════════════════════════════════════════════
-- 5. CREATE "asset_relationships"
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE "asset_relationships" (
  "id"                UUID         NOT NULL DEFAULT gen_random_uuid(),
  "organization_id"   UUID         NOT NULL,
  "source_asset_id"   UUID         NOT NULL,
  "target_asset_id"   UUID,
  "target_line_id"    UUID,
  "relationship_type" TEXT         NOT NULL,
  "description"       TEXT,
  "nozzle_id"         UUID,
  "is_active"         BOOLEAN      NOT NULL DEFAULT true,
  "created_by"        UUID,
  "created_at"        TIMESTAMPTZ  NOT NULL DEFAULT now(),
  "updated_at"        TIMESTAMPTZ  NOT NULL DEFAULT now(),

  CONSTRAINT "asset_relationships_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "asset_relationships"
  ADD CONSTRAINT "asset_relationships_source_asset_id_fkey"
  FOREIGN KEY ("source_asset_id") REFERENCES "Asset"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "asset_relationships"
  ADD CONSTRAINT "asset_relationships_target_asset_id_fkey"
  FOREIGN KEY ("target_asset_id") REFERENCES "Asset"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX "asset_rel_unique"
  ON "asset_relationships"("source_asset_id", "target_asset_id", "relationship_type");

CREATE INDEX "asset_relationships_source_asset_id_idx"
  ON "asset_relationships"("source_asset_id");

CREATE INDEX "asset_relationships_target_asset_id_idx"
  ON "asset_relationships"("target_asset_id");

-- ═══════════════════════════════════════════════════════════════════════════════
-- 6. CREATE "workpack_asset_snapshots"
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE "workpack_asset_snapshots" (
  "id"                 UUID         NOT NULL DEFAULT gen_random_uuid(),
  "workpack_id"        UUID         NOT NULL,
  "asset_id"           UUID         NOT NULL,
  "snapshot_revision"  TEXT         NOT NULL,
  "asset_data_json"    JSONB        NOT NULL,
  "attributes_json"    JSONB        NOT NULL,
  "nozzles_json"       JSONB,
  "lines_json"         JSONB,
  "documents_json"     JSONB,
  "snapshotted_by"     UUID         NOT NULL,
  "snapshotted_at"     TIMESTAMPTZ  NOT NULL DEFAULT now(),

  CONSTRAINT "workpack_asset_snapshots_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "workpack_asset_snapshots"
  ADD CONSTRAINT "workpack_asset_snapshots_workpack_id_fkey"
  FOREIGN KEY ("workpack_id") REFERENCES "Workpack"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "workpack_asset_snapshots"
  ADD CONSTRAINT "workpack_asset_snapshots_asset_id_fkey"
  FOREIGN KEY ("asset_id") REFERENCES "Asset"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX "wp_asset_snapshot_rev"
  ON "workpack_asset_snapshots"("workpack_id", "snapshot_revision");

CREATE INDEX "workpack_asset_snapshots_workpack_id_idx"
  ON "workpack_asset_snapshots"("workpack_id");
