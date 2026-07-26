-- Scheduling Phase 1: minimal UDF extensions (add only, no renames/deletes)
-- ActivityUdfDefinition: is_mandatory, sort_order, unique(organization_id, code)
ALTER TABLE "ActivityUdfDefinition" ADD COLUMN IF NOT EXISTS "is_mandatory" BOOLEAN DEFAULT false;
ALTER TABLE "ActivityUdfDefinition" ADD COLUMN IF NOT EXISTS "sort_order" INTEGER;

ALTER TABLE "ActivityUdfDefinition" ADD CONSTRAINT "ActivityUdfDefinition_organization_id_code_key" UNIQUE ("organization_id", "code");

-- ActivityUdfOption: code_value, description, unique(udf_definition_id, code_value)
ALTER TABLE "ActivityUdfOption" ADD COLUMN IF NOT EXISTS "code_value" TEXT;
ALTER TABLE "ActivityUdfOption" ADD COLUMN IF NOT EXISTS "description" TEXT;

UPDATE "ActivityUdfOption" SET "code_value" = "value" WHERE "code_value" IS NULL AND "deleted_at" IS NULL;

ALTER TABLE "ActivityUdfOption" ADD CONSTRAINT "ActivityUdfOption_udf_definition_id_code_value_key" UNIQUE ("udf_definition_id", "code_value");
