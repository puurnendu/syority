-- M8.13 Phase 1: Standard Activity Classification Schema
-- ADDITIVE ONLY — no drops, no renames, no destructive changes

-- 1. Create standard_activity_types table
CREATE TABLE IF NOT EXISTS "standard_activity_types" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID,
  "equipment_type_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "description" TEXT,
  "is_mandatory" BOOLEAN NOT NULL DEFAULT true,
  "typical_duration_hrs" DOUBLE PRECISION,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "standard_activity_types_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "sat_equip_code" UNIQUE ("equipment_type_id", "code"),
  CONSTRAINT "standard_activity_types_equipment_type_id_fkey" FOREIGN KEY ("equipment_type_id") REFERENCES "EquipmentType"("id") ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS "standard_activity_types_organization_id_equipment_type_id_idx" ON "standard_activity_types"("organization_id", "equipment_type_id");

-- 2. Add standard_activity_type_id to Activity
ALTER TABLE "Activity" ADD COLUMN IF NOT EXISTS "standard_activity_type_id" UUID;
ALTER TABLE "Activity" DROP CONSTRAINT IF EXISTS "Activity_standard_activity_type_id_fkey";
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_standard_activity_type_id_fkey" FOREIGN KEY ("standard_activity_type_id") REFERENCES "standard_activity_types"("id") ON DELETE SET NULL;

-- 3. Add equipment_type_id to Asset
ALTER TABLE "Asset" ADD COLUMN IF NOT EXISTS "equipment_type_id" TEXT;
ALTER TABLE "Asset" DROP CONSTRAINT IF EXISTS "Asset_equipment_type_id_fkey";
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_equipment_type_id_fkey" FOREIGN KEY ("equipment_type_id") REFERENCES "EquipmentType"("id") ON DELETE SET NULL;
