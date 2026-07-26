-- Section 10: Asset Register + Hierarchy Foundation
-- Event, EventUnit
CREATE TABLE IF NOT EXISTS "events" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "site_id" UUID NOT NULL REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "name" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "event_type" TEXT NOT NULL DEFAULT 'turnaround',
  "planned_start" DATE,
  "planned_end" DATE,
  "actual_start" DATE,
  "actual_end" DATE,
  "status" TEXT NOT NULL DEFAULT 'planning',
  "scope_notes" TEXT,
  "budget_manhours" INTEGER,
  "budget_cost" DECIMAL(15,2),
  "created_by" UUID REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMP(3)
);
CREATE INDEX IF NOT EXISTS "events_organization_id_status_idx" ON "events"("organization_id", "status");
CREATE INDEX IF NOT EXISTS "events_site_id_idx" ON "events"("site_id");

CREATE TABLE IF NOT EXISTS "event_units" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "event_id" UUID NOT NULL REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "unit_id" UUID NOT NULL REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "notes" TEXT,
  UNIQUE("event_id", "unit_id")
);

-- Asset enrichment (nullable columns)
ALTER TABLE "Asset" ADD COLUMN IF NOT EXISTS "manufacturer" TEXT;
ALTER TABLE "Asset" ADD COLUMN IF NOT EXISTS "model_number" TEXT;
ALTER TABLE "Asset" ADD COLUMN IF NOT EXISTS "serial_number" TEXT;
ALTER TABLE "Asset" ADD COLUMN IF NOT EXISTS "year_installed" INTEGER;
ALTER TABLE "Asset" ADD COLUMN IF NOT EXISTS "design_pressure_barg" DOUBLE PRECISION;
ALTER TABLE "Asset" ADD COLUMN IF NOT EXISTS "design_temp_c" DOUBLE PRECISION;
ALTER TABLE "Asset" ADD COLUMN IF NOT EXISTS "operating_pressure_barg" DOUBLE PRECISION;
ALTER TABLE "Asset" ADD COLUMN IF NOT EXISTS "operating_temp_c" DOUBLE PRECISION;
ALTER TABLE "Asset" ADD COLUMN IF NOT EXISTS "test_pressure_barg" DOUBLE PRECISION;
ALTER TABLE "Asset" ADD COLUMN IF NOT EXISTS "weight_empty_kg" DOUBLE PRECISION;
ALTER TABLE "Asset" ADD COLUMN IF NOT EXISTS "weight_operating_kg" DOUBLE PRECISION;
ALTER TABLE "Asset" ADD COLUMN IF NOT EXISTS "service_description" TEXT;
ALTER TABLE "Asset" ADD COLUMN IF NOT EXISTS "fluid_service" TEXT;
ALTER TABLE "Asset" ADD COLUMN IF NOT EXISTS "criticality" TEXT;
ALTER TABLE "Asset" ADD COLUMN IF NOT EXISTS "maintenance_strategy" TEXT;
ALTER TABLE "Asset" ADD COLUMN IF NOT EXISTS "inspection_interval_months" INTEGER;
ALTER TABLE "Asset" ADD COLUMN IF NOT EXISTS "p_and_id_numbers" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Asset" ADD COLUMN IF NOT EXISTS "ga_drawing_number" TEXT;
ALTER TABLE "Asset" ADD COLUMN IF NOT EXISTS "isometric_drawing_numbers" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Asset" ADD COLUMN IF NOT EXISTS "plot_area" TEXT;
ALTER TABLE "Asset" ADD COLUMN IF NOT EXISTS "elevation" TEXT;
ALTER TABLE "Asset" ADD COLUMN IF NOT EXISTS "train" TEXT;
ALTER TABLE "Asset" ADD COLUMN IF NOT EXISTS "sap_functional_location" TEXT;
ALTER TABLE "Asset" ADD COLUMN IF NOT EXISTS "extracted_from_document_id" UUID;
ALTER TABLE "Asset" ADD COLUMN IF NOT EXISTS "extraction_confidence" DOUBLE PRECISION;

-- Nozzles
CREATE TABLE IF NOT EXISTS "nozzles" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "asset_id" UUID NOT NULL REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "designation" TEXT NOT NULL,
  "service" TEXT,
  "nominal_size_inches" DOUBLE PRECISION,
  "pressure_rating" TEXT,
  "flange_face" TEXT,
  "flange_standard" TEXT,
  "gasket_type" TEXT,
  "gasket_material" TEXT,
  "bolt_spec" TEXT,
  "bolt_count" INTEGER,
  "default_torque_nm" DOUBLE PRECISION,
  "p_and_id_number" TEXT,
  "connected_line_number" TEXT,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "sequence_number" INTEGER DEFAULT 0,
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMP(3)
);
CREATE INDEX IF NOT EXISTS "nozzles_asset_id_idx" ON "nozzles"("asset_id");

-- LineList
CREATE TABLE IF NOT EXISTS "line_lists" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "site_id" UUID NOT NULL REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "unit_id" UUID NOT NULL REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "system_id" UUID REFERENCES "System"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "line_number" TEXT NOT NULL,
  "nominal_size_inches" DOUBLE PRECISION,
  "fluid_service_code" TEXT,
  "sequence_number" TEXT,
  "pipe_class" TEXT,
  "design_pressure_barg" DOUBLE PRECISION,
  "design_temp_c" DOUBLE PRECISION,
  "operating_pressure_barg" DOUBLE PRECISION,
  "test_pressure_barg" DOUBLE PRECISION,
  "insulation_type" TEXT,
  "heat_tracing" BOOLEAN DEFAULT false,
  "material" TEXT,
  "from_asset_id" UUID REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "from_nozzle_id" UUID REFERENCES "nozzles"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "to_asset_id" UUID REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "to_nozzle_id" UUID REFERENCES "nozzles"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "p_and_id_number" TEXT,
  "isometric_number" TEXT,
  "total_joint_count" INTEGER NOT NULL DEFAULT 0,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "notes" TEXT,
  "created_by" UUID REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMP(3),
  UNIQUE("organization_id", "line_number")
);
CREATE INDEX IF NOT EXISTS "line_lists_unit_id_idx" ON "line_lists"("unit_id");
CREATE INDEX IF NOT EXISTS "line_lists_system_id_idx" ON "line_lists"("system_id");

-- AssetLine
CREATE TABLE IF NOT EXISTS "asset_lines" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "asset_id" UUID NOT NULL REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "line_id" UUID NOT NULL REFERENCES "line_lists"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "connection_type" TEXT NOT NULL DEFAULT 'from',
  UNIQUE("asset_id", "line_id")
);

-- JointMaster
CREATE TABLE IF NOT EXISTS "joint_masters" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "site_id" UUID NOT NULL REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "joint_number" TEXT NOT NULL,
  "joint_type" TEXT NOT NULL DEFAULT 'flanged',
  "asset_id" UUID REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "nozzle_id" UUID UNIQUE REFERENCES "nozzles"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "line_id" UUID REFERENCES "line_lists"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "sequence_in_line" INTEGER,
  "nominal_size_inches" DOUBLE PRECISION,
  "pressure_rating" TEXT,
  "flange_face" TEXT,
  "default_gasket_type" TEXT,
  "default_gasket_material" TEXT,
  "default_bolt_spec" TEXT,
  "default_bolt_count" INTEGER,
  "default_torque_nm" DOUBLE PRECISION,
  "last_opened_date" TIMESTAMP(3),
  "last_workpack_id" UUID,
  "total_open_count" INTEGER NOT NULL DEFAULT 0,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "notes" TEXT,
  "created_by" UUID REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE("organization_id", "joint_number")
);
CREATE INDEX IF NOT EXISTS "joint_masters_asset_id_idx" ON "joint_masters"("asset_id");
CREATE INDEX IF NOT EXISTS "joint_masters_line_id_idx" ON "joint_masters"("line_id");

-- JointIntegrityItem additions (table name from Prisma default)
ALTER TABLE "JointIntegrityItem" ADD COLUMN IF NOT EXISTS "joint_master_id" UUID REFERENCES "joint_masters"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "JointIntegrityItem" ADD COLUMN IF NOT EXISTS "line_number" TEXT;

-- UnitResponsibility
CREATE TABLE IF NOT EXISTS "unit_responsibilities" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "unit_id" UUID NOT NULL REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "user_id" UUID NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "role" TEXT NOT NULL,
  "receives_shift_reports" BOOLEAN NOT NULL DEFAULT false,
  "receives_constraint_alerts" BOOLEAN NOT NULL DEFAULT false,
  "receives_daily_briefing" BOOLEAN NOT NULL DEFAULT false,
  "receives_overdue_alerts" BOOLEAN NOT NULL DEFAULT false,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "valid_from" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "valid_to" TIMESTAMP(3),
  "created_by" UUID REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE("unit_id", "user_id", "role")
);
CREATE INDEX IF NOT EXISTS "unit_responsibilities_organization_id_role_idx" ON "unit_responsibilities"("organization_id", "role");

-- Workpack additions
ALTER TABLE "Workpack" ADD COLUMN IF NOT EXISTS "event_id" UUID REFERENCES "events"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Workpack" ADD COLUMN IF NOT EXISTS "plant_id" UUID REFERENCES "Plant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Workpack" ADD COLUMN IF NOT EXISTS "system_id" UUID REFERENCES "System"("id") ON DELETE SET NULL ON UPDATE CASCADE;
