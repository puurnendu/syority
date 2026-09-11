-- M8.12 — Material Supply Chain Migration
-- Creates material_supply_records and material_constraints tables
-- Extends workpack_material_lines with supply chain fields
-- Non-destructive: only CREATE TABLE and ALTER TABLE ADD COLUMN

-- 1. Extend workpack_material_lines with supply chain fields
ALTER TABLE "workpack_material_lines" ADD COLUMN IF NOT EXISTS "quantity_available" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "workpack_material_lines" ADD COLUMN IF NOT EXISTS "quantity_on_order" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "workpack_material_lines" ADD COLUMN IF NOT EXISTS "expected_eta" DATE;
ALTER TABLE "workpack_material_lines" ADD COLUMN IF NOT EXISTS "supplier_name" TEXT;
ALTER TABLE "workpack_material_lines" ADD COLUMN IF NOT EXISTS "po_number" TEXT;
ALTER TABLE "workpack_material_lines" ADD COLUMN IF NOT EXISTS "material_readiness" TEXT NOT NULL DEFAULT 'not_assessed';

-- 2. Create material_supply_records table
CREATE TABLE IF NOT EXISTS "material_supply_records" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "material_line_id" UUID NOT NULL,
    "supplier_name" TEXT,
    "po_number" TEXT,
    "po_line_number" TEXT,
    "quantity_ordered" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "quantity_received" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "expected_delivery" DATE,
    "actual_delivery" DATE,
    "delivery_status" TEXT NOT NULL DEFAULT 'pending',
    "unit_cost" DOUBLE PRECISION,
    "total_cost" DOUBLE PRECISION,
    "notes" TEXT,
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "material_supply_records_pkey" PRIMARY KEY ("id")
);

-- 3. Create material_constraints table
CREATE TABLE IF NOT EXISTS "material_constraints" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "activity_id" UUID NOT NULL,
    "workpack_id" UUID,
    "material_line_id" UUID,
    "constraint_type" TEXT NOT NULL DEFAULT 'material_eta',
    "constraint_date" DATE,
    "readiness_status" TEXT NOT NULL DEFAULT 'not_ready',
    "readiness_percent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "quantity_required" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "quantity_available" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "quantity_on_order" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "earliest_eta" DATE,
    "is_binding" BOOLEAN NOT NULL DEFAULT false,
    "is_critical_material" BOOLEAN NOT NULL DEFAULT false,
    "impact_days" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "last_calculated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "material_constraints_pkey" PRIMARY KEY ("id")
);

-- 4. Foreign keys for material_supply_records
ALTER TABLE "material_supply_records" ADD CONSTRAINT "material_supply_records_material_line_id_fkey"
    FOREIGN KEY ("material_line_id") REFERENCES "workpack_material_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "material_supply_records" ADD CONSTRAINT "material_supply_records_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 5. Foreign keys for material_constraints
ALTER TABLE "material_constraints" ADD CONSTRAINT "material_constraints_activity_id_fkey"
    FOREIGN KEY ("activity_id") REFERENCES "Activity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "material_constraints" ADD CONSTRAINT "material_constraints_event_id_fkey"
    FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "material_constraints" ADD CONSTRAINT "material_constraints_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 6. Indexes for material_supply_records
CREATE INDEX IF NOT EXISTS "material_supply_records_material_line_id_idx" ON "material_supply_records"("material_line_id");
CREATE INDEX IF NOT EXISTS "material_supply_records_organization_id_idx" ON "material_supply_records"("organization_id");
CREATE INDEX IF NOT EXISTS "material_supply_records_delivery_status_idx" ON "material_supply_records"("delivery_status");

-- 7. Indexes for material_constraints
CREATE UNIQUE INDEX IF NOT EXISTS "material_constraints_activity_id_material_line_id_key" ON "material_constraints"("activity_id", "material_line_id");
CREATE INDEX IF NOT EXISTS "material_constraints_event_id_readiness_status_idx" ON "material_constraints"("event_id", "readiness_status");
CREATE INDEX IF NOT EXISTS "material_constraints_activity_id_idx" ON "material_constraints"("activity_id");
CREATE INDEX IF NOT EXISTS "material_constraints_organization_id_idx" ON "material_constraints"("organization_id");
