-- Milestone 5: Enterprise Organization Hierarchy
-- Adds Area, Unit.area_id, Asset.plant_id/unit_id, parent-scoped unique codes, UUID defaults.

-- UUID defaults for hierarchy tables (safe if already present)
ALTER TABLE "Site" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "Plant" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "Unit" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "System" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "Asset" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

-- Area (optional Plant → Unit level)
CREATE TABLE IF NOT EXISTS "Area" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "site_id" UUID NOT NULL,
    "plant_id" UUID NOT NULL,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN DEFAULT true,
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "Area_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "area_plant_code" ON "Area"("plant_id", "code");
CREATE INDEX IF NOT EXISTS "Area_organization_id_idx" ON "Area"("organization_id");
CREATE INDEX IF NOT EXISTS "Area_site_id_plant_id_idx" ON "Area"("site_id", "plant_id");

DO $$ BEGIN
  ALTER TABLE "Area" ADD CONSTRAINT "Area_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Area" ADD CONSTRAINT "Area_site_id_fkey"
    FOREIGN KEY ("site_id") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Area" ADD CONSTRAINT "Area_plant_id_fkey"
    FOREIGN KEY ("plant_id") REFERENCES "Plant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Unit.area_id (optional)
ALTER TABLE "Unit" ADD COLUMN IF NOT EXISTS "area_id" UUID;
CREATE INDEX IF NOT EXISTS "Unit_area_id_idx" ON "Unit"("area_id");
CREATE INDEX IF NOT EXISTS "Unit_organization_id_idx" ON "Unit"("organization_id");

DO $$ BEGIN
  ALTER TABLE "Unit" ADD CONSTRAINT "Unit_area_id_fkey"
    FOREIGN KEY ("area_id") REFERENCES "Area"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Asset denormalized parents for Workpack / reporting
ALTER TABLE "Asset" ADD COLUMN IF NOT EXISTS "plant_id" UUID;
ALTER TABLE "Asset" ADD COLUMN IF NOT EXISTS "unit_id" UUID;
CREATE INDEX IF NOT EXISTS "Asset_plant_id_idx" ON "Asset"("plant_id");
CREATE INDEX IF NOT EXISTS "Asset_unit_id_idx" ON "Asset"("unit_id");
CREATE INDEX IF NOT EXISTS "Asset_system_id_idx" ON "Asset"("system_id");

DO $$ BEGIN
  ALTER TABLE "Asset" ADD CONSTRAINT "Asset_plant_id_fkey"
    FOREIGN KEY ("plant_id") REFERENCES "Plant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Asset" ADD CONSTRAINT "Asset_unit_id_fkey"
    FOREIGN KEY ("unit_id") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Clear colliding duplicate codes (keep earliest) before unique indexes
WITH d AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY site_id, code ORDER BY created_at) rn
  FROM "Plant" WHERE code IS NOT NULL AND deleted_at IS NULL
)
UPDATE "Plant" p SET code = p.code || '-DUP-' || LEFT(p.id::text, 8)
FROM d WHERE p.id = d.id AND d.rn > 1;

WITH d AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY plant_id, code ORDER BY created_at) rn
  FROM "Unit" WHERE code IS NOT NULL AND deleted_at IS NULL
)
UPDATE "Unit" u SET code = u.code || '-DUP-' || LEFT(u.id::text, 8)
FROM d WHERE u.id = d.id AND d.rn > 1;

WITH d AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY unit_id, code ORDER BY created_at) rn
  FROM "System" WHERE code IS NOT NULL AND deleted_at IS NULL
)
UPDATE "System" s SET code = s.code || '-DUP-' || LEFT(s.id::text, 8)
FROM d WHERE s.id = d.id AND d.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS "plant_site_code" ON "Plant"("site_id", "code");
CREATE UNIQUE INDEX IF NOT EXISTS "unit_plant_code" ON "Unit"("plant_id", "code");
CREATE UNIQUE INDEX IF NOT EXISTS "system_unit_code" ON "System"("unit_id", "code");
CREATE INDEX IF NOT EXISTS "Plant_organization_id_idx" ON "Plant"("organization_id");
