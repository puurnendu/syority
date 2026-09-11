-- M8.5 — Knowledge Bank schema delta
-- 10 additive fields across 4 tables. Zero breaking changes.

-- D4 Fix: ActivityLibrary PLATFORM scope
ALTER TABLE "ActivityLibrary" ALTER COLUMN "organization_id" DROP NOT NULL;
ALTER TABLE "ActivityLibrary" ADD COLUMN IF NOT EXISTS "library_scope" TEXT NOT NULL DEFAULT 'TENANT';

-- ActivityUdfDefinition enhancements
ALTER TABLE "ActivityUdfDefinition" ADD COLUMN IF NOT EXISTS "unit" TEXT;
ALTER TABLE "ActivityUdfDefinition" ADD COLUMN IF NOT EXISTS "is_progress_driving" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ActivityUdfDefinition" ADD COLUMN IF NOT EXISTS "is_exportable" BOOLEAN NOT NULL DEFAULT false;

-- ProgressLog quantity tracking
ALTER TABLE "ProgressLog" ADD COLUMN IF NOT EXISTS "quantity_actual" DECIMAL(10,2);
ALTER TABLE "ProgressLog" ADD COLUMN IF NOT EXISTS "quantity_unit" TEXT;
ALTER TABLE "ProgressLog" ADD COLUMN IF NOT EXISTS "udf_definition_id" UUID;

-- D3 Fix: Template activity conditionality
ALTER TABLE "workpack_template_activities" ADD COLUMN IF NOT EXISTS "conditionality" TEXT NOT NULL DEFAULT 'MANDATORY';
ALTER TABLE "workpack_template_activities" ADD COLUMN IF NOT EXISTS "condition_expression" TEXT;
