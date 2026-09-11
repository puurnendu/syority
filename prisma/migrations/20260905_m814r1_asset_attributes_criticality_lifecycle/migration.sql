-- M8.14-R1: Equipment Criticality/Lifecycle/Auditability + Fill Missing Attribute Table Gaps
-- The 3 attribute tables already exist. This migration adds:
-- 1. AssetCriticality enum + migrate criticality column
-- 2. AssetStatus enum + add status column
-- 3. updated_by, data_source, parent_id columns to Asset

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. Create the AssetCriticality enum
-- ═══════════════════════════════════════════════════════════════════════════════
DO $$ BEGIN
  CREATE TYPE "AssetCriticality" AS ENUM ('low', 'medium', 'high', 'critical');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 2. Create the AssetStatus enum
-- ═══════════════════════════════════════════════════════════════════════════════
DO $$ BEGIN
  CREATE TYPE "AssetStatus" AS ENUM ('draft', 'active', 'retired');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 3. Add new columns to Asset table
-- ═══════════════════════════════════════════════════════════════════════════════

-- status (lifecycle) — default 'active' for existing records, 'draft' for schema default
DO $$ BEGIN
  ALTER TABLE "Asset" ADD COLUMN "status" "AssetStatus" NOT NULL DEFAULT 'active';
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Migrate existing is_active data: false → retired
UPDATE "Asset" SET "status" = 'retired' WHERE "is_active" = false AND "status" = 'active';

-- Now change default to 'draft' for new records
ALTER TABLE "Asset" ALTER COLUMN "status" SET DEFAULT 'draft';

-- updated_by
DO $$ BEGIN
  ALTER TABLE "Asset" ADD COLUMN "updated_by" UUID;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- data_source (provenance)
DO $$ BEGIN
  ALTER TABLE "Asset" ADD COLUMN "data_source" TEXT DEFAULT 'manual';
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- parent_id (self-relation)
DO $$ BEGIN
  ALTER TABLE "Asset" ADD COLUMN "parent_id" UUID;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Self-referencing FK for parent/child equipment hierarchy
DO $$ BEGIN
  ALTER TABLE "Asset" ADD CONSTRAINT "Asset_parent_id_fkey"
    FOREIGN KEY ("parent_id") REFERENCES "Asset"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 4. Migrate criticality from free-text to enum
-- ═══════════════════════════════════════════════════════════════════════════════

-- Step 1: Normalize existing free-text values
UPDATE "Asset" SET "criticality" = CASE
  WHEN LOWER("criticality") IN ('low', 'l') THEN 'low'
  WHEN LOWER("criticality") IN ('medium', 'med', 'm', 'moderate') THEN 'medium'
  WHEN LOWER("criticality") IN ('high', 'h') THEN 'high'
  WHEN LOWER("criticality") IN ('critical', 'crit', 'c', 'very high') THEN 'critical'
  ELSE NULL
END WHERE "criticality" IS NOT NULL;

-- Step 2: Convert column type from text to enum
-- Must use USING clause since text→enum needs explicit cast
ALTER TABLE "Asset" 
  ALTER COLUMN "criticality" TYPE "AssetCriticality" 
  USING "criticality"::"AssetCriticality";

-- ═══════════════════════════════════════════════════════════════════════════════
-- 5. Ensure attribute tables have correct structure (idempotent)
-- ═══════════════════════════════════════════════════════════════════════════════

-- Create tables IF NOT EXISTS (they already exist but this is safe for fresh DBs)
CREATE TABLE IF NOT EXISTS "asset_attribute_definitions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "data_type" TEXT NOT NULL,
    "unit" TEXT,
    "equipment_types" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "group_name" TEXT,
    "group_sort_order" INTEGER NOT NULL DEFAULT 0,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_required" BOOLEAN NOT NULL DEFAULT false,
    "is_design_basis" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "validation_rule" JSONB,
    "select_options" JSONB,
    "scope" TEXT NOT NULL DEFAULT 'PLATFORM',
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "asset_attribute_definitions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "asset_attribute_values" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "asset_id" UUID NOT NULL,
    "definition_id" UUID NOT NULL,
    "value_string" TEXT,
    "value_number" DOUBLE PRECISION,
    "value_boolean" BOOLEAN,
    "value_date" TIMESTAMP(3),
    "source_type" TEXT NOT NULL DEFAULT 'manual',
    "source_document_id" UUID,
    "source_doc_revision" TEXT,
    "source_page" INTEGER,
    "source_region" TEXT,
    "ai_model" TEXT,
    "ai_confidence" DOUBLE PRECISION,
    "extraction_job_id" UUID,
    "status" TEXT NOT NULL DEFAULT 'unverified',
    "entered_by" UUID,
    "verified_by" UUID,
    "verified_at" TIMESTAMP(3),
    "verification_notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "asset_attribute_values_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "asset_attribute_history" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "asset_id" UUID NOT NULL,
    "definition_id" UUID NOT NULL,
    "value_id" UUID,
    "value_string" TEXT,
    "value_number" DOUBLE PRECISION,
    "value_boolean" BOOLEAN,
    "value_date" TIMESTAMP(3),
    "source_type" TEXT NOT NULL,
    "source_document_id" UUID,
    "source_doc_revision" TEXT,
    "source_page" INTEGER,
    "source_region" TEXT,
    "ai_model" TEXT,
    "ai_confidence" DOUBLE PRECISION,
    "extraction_job_id" UUID,
    "action" TEXT NOT NULL,
    "status_at_time" TEXT NOT NULL,
    "refers_to_history_id" UUID,
    "performed_by" UUID NOT NULL,
    "performed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT,
    CONSTRAINT "asset_attribute_history_pkey" PRIMARY KEY ("id")
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 6. Foreign Keys (idempotent)
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$ BEGIN
  ALTER TABLE "asset_attribute_values" ADD CONSTRAINT "asset_attribute_values_definition_id_fkey"
    FOREIGN KEY ("definition_id") REFERENCES "asset_attribute_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "asset_attribute_values" ADD CONSTRAINT "asset_attribute_values_asset_id_fkey"
    FOREIGN KEY ("asset_id") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "asset_attribute_history" ADD CONSTRAINT "asset_attribute_history_definition_id_fkey"
    FOREIGN KEY ("definition_id") REFERENCES "asset_attribute_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "asset_attribute_history" ADD CONSTRAINT "asset_attribute_history_value_id_fkey"
    FOREIGN KEY ("value_id") REFERENCES "asset_attribute_values"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Self-referencing FK for refers_to_history_id
DO $$ BEGIN
  ALTER TABLE "asset_attribute_history" ADD CONSTRAINT "asset_attribute_history_refers_to_fkey"
    FOREIGN KEY ("refers_to_history_id") REFERENCES "asset_attribute_history"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 7. Unique Constraints (idempotent)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE UNIQUE INDEX IF NOT EXISTS "attr_def_org_code" ON "asset_attribute_definitions"("organization_id", "code");
CREATE UNIQUE INDEX IF NOT EXISTS "asset_attr_unique" ON "asset_attribute_values"("asset_id", "definition_id");

-- ═══════════════════════════════════════════════════════════════════════════════
-- 8. Indexes (idempotent)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS "asset_attribute_definitions_organization_id_is_active_idx" ON "asset_attribute_definitions"("organization_id", "is_active");
CREATE INDEX IF NOT EXISTS "asset_attribute_values_organization_id_asset_id_idx" ON "asset_attribute_values"("organization_id", "asset_id");
CREATE INDEX IF NOT EXISTS "asset_attribute_history_asset_id_definition_id_idx" ON "asset_attribute_history"("asset_id", "definition_id");
CREATE INDEX IF NOT EXISTS "asset_attribute_history_organization_id_asset_id_idx" ON "asset_attribute_history"("organization_id", "asset_id");
CREATE INDEX IF NOT EXISTS "asset_attribute_history_refers_to_history_id_idx" ON "asset_attribute_history"("refers_to_history_id");
