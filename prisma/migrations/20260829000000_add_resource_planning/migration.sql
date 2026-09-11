-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "WorkpackStatus" ADD VALUE 'in_execution';
ALTER TYPE "WorkpackStatus" ADD VALUE 'completed';

-- DropForeignKey
ALTER TABLE "Asset" DROP CONSTRAINT "Asset_parent_asset_id_fkey";

-- DropForeignKey
ALTER TABLE "asset_attribute_definitions" DROP CONSTRAINT "asset_attribute_definitions_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "asset_attribute_history" DROP CONSTRAINT "asset_attribute_history_asset_id_fkey";

-- DropForeignKey
ALTER TABLE "asset_attribute_history" DROP CONSTRAINT "asset_attribute_history_definition_id_fkey";

-- DropForeignKey
ALTER TABLE "asset_attribute_history" DROP CONSTRAINT "asset_attribute_history_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "asset_attribute_history" DROP CONSTRAINT "asset_attribute_history_value_id_fkey";

-- DropForeignKey
ALTER TABLE "asset_attribute_values" DROP CONSTRAINT "asset_attribute_values_asset_id_fkey";

-- DropForeignKey
ALTER TABLE "asset_attribute_values" DROP CONSTRAINT "asset_attribute_values_definition_id_fkey";

-- DropForeignKey
ALTER TABLE "asset_attribute_values" DROP CONSTRAINT "asset_attribute_values_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "asset_relationships" DROP CONSTRAINT "asset_relationships_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "asset_relationships" DROP CONSTRAINT "asset_relationships_source_asset_id_fkey";

-- DropForeignKey
ALTER TABLE "asset_relationships" DROP CONSTRAINT "asset_relationships_target_asset_id_fkey";

-- DropForeignKey
ALTER TABLE "workpack_asset_snapshots" DROP CONSTRAINT "workpack_asset_snapshots_asset_id_fkey";

-- DropForeignKey
ALTER TABLE "workpack_asset_snapshots" DROP CONSTRAINT "workpack_asset_snapshots_workpack_id_fkey";

-- AlterTable
ALTER TABLE "ActivityLibrary" ADD COLUMN     "library_scope" TEXT NOT NULL DEFAULT 'TENANT',
ALTER COLUMN "organization_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "ActivityUdfDefinition" ADD COLUMN     "is_exportable" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "is_progress_driving" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "unit" TEXT;

-- AlterTable
ALTER TABLE "Permit" DROP CONSTRAINT "Permit_pkey",
ADD COLUMN     "organization_id" UUID NOT NULL,
ADD COLUMN     "site_id" UUID NOT NULL,
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
DROP COLUMN "project_id",
ADD COLUMN     "project_id" UUID,
DROP COLUMN "workpack_id",
ADD COLUMN     "workpack_id" UUID,
DROP COLUMN "activity_id",
ADD COLUMN     "activity_id" UUID,
DROP COLUMN "issued_by",
ADD COLUMN     "issued_by" UUID,
ALTER COLUMN "status" SET DEFAULT 'draft',
DROP COLUMN "closed_by",
ADD COLUMN     "closed_by" UUID,
ADD CONSTRAINT "Permit_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "ProgressLog" ADD COLUMN     "quantity_actual" DECIMAL(10,2),
ADD COLUMN     "quantity_unit" TEXT,
ADD COLUMN     "shift" TEXT DEFAULT 'day',
ADD COLUMN     "udf_definition_id" UUID;

-- AlterTable
ALTER TABLE "asset_attribute_definitions" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "asset_attribute_history" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "asset_attribute_values" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "asset_relationships" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "workpack_asset_snapshots" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "workpack_template_activities" ADD COLUMN     "condition_expression" TEXT,
ADD COLUMN     "conditionality" TEXT NOT NULL DEFAULT 'MANDATORY';

-- CreateTable
CREATE TABLE "ShiftDefinition" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "shift_name" TEXT NOT NULL,
    "start_time" TEXT NOT NULL,
    "end_time" TEXT NOT NULL,
    "is_active" BOOLEAN DEFAULT true,
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "ShiftDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResourceCapacity" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "resource_type_id" UUID NOT NULL,
    "contractor_id" UUID,
    "shift_id" UUID,
    "target_date" DATE NOT NULL,
    "capacity_limit" DECIMAL(10,2) NOT NULL,
    "notes" TEXT,
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "ResourceCapacity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ShiftDefinition_organization_id_idx" ON "ShiftDefinition"("organization_id");

-- CreateIndex
CREATE INDEX "ShiftDefinition_event_id_idx" ON "ShiftDefinition"("event_id");

-- CreateIndex
CREATE UNIQUE INDEX "ShiftDefinition_event_id_shift_name_key" ON "ShiftDefinition"("event_id", "shift_name");

-- CreateIndex
CREATE INDEX "ResourceCapacity_organization_id_idx" ON "ResourceCapacity"("organization_id");

-- CreateIndex
CREATE INDEX "ResourceCapacity_event_id_idx" ON "ResourceCapacity"("event_id");

-- CreateIndex
CREATE INDEX "ResourceCapacity_resource_type_id_idx" ON "ResourceCapacity"("resource_type_id");

-- CreateIndex
CREATE UNIQUE INDEX "ResourceCapacity_event_id_resource_type_id_contractor_id_sh_key" ON "ResourceCapacity"("event_id", "resource_type_id", "contractor_id", "shift_id", "target_date");

-- CreateIndex
CREATE INDEX "Asset_parent_asset_id_idx" ON "Asset"("parent_asset_id");

-- CreateIndex
CREATE INDEX "Permit_organization_id_site_id_idx" ON "Permit"("organization_id", "site_id");

-- CreateIndex
CREATE INDEX "Permit_workpack_id_idx" ON "Permit"("workpack_id");

-- CreateIndex
CREATE INDEX "Permit_activity_id_idx" ON "Permit"("activity_id");

-- CreateIndex
CREATE UNIQUE INDEX "Permit_organization_id_permit_number_key" ON "Permit"("organization_id", "permit_number");

-- CreateIndex
CREATE INDEX "asset_attribute_definitions_organization_id_is_active_idx" ON "asset_attribute_definitions"("organization_id", "is_active");

-- CreateIndex
CREATE INDEX "asset_attribute_history_asset_id_performed_at_idx" ON "asset_attribute_history"("asset_id", "performed_at");

-- CreateIndex
CREATE INDEX "asset_attribute_values_definition_id_idx" ON "asset_attribute_values"("definition_id");

-- CreateIndex
CREATE INDEX "asset_relationships_source_asset_id_idx" ON "asset_relationships"("source_asset_id");

-- CreateIndex
CREATE INDEX "asset_relationships_target_asset_id_idx" ON "asset_relationships"("target_asset_id");

-- CreateIndex
CREATE INDEX "workpack_asset_snapshots_workpack_id_idx" ON "workpack_asset_snapshots"("workpack_id");

-- RenameForeignKey
ALTER TABLE "asset_attribute_history" RENAME CONSTRAINT "asset_attribute_history_refers_to_fkey" TO "asset_attribute_history_refers_to_history_id_fkey";

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_parent_asset_id_fkey" FOREIGN KEY ("parent_asset_id") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Permit" ADD CONSTRAINT "Permit_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Permit" ADD CONSTRAINT "Permit_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Permit" ADD CONSTRAINT "Permit_workpack_id_fkey" FOREIGN KEY ("workpack_id") REFERENCES "Workpack"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Permit" ADD CONSTRAINT "Permit_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "Activity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_attribute_values" ADD CONSTRAINT "asset_attribute_values_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_attribute_values" ADD CONSTRAINT "asset_attribute_values_definition_id_fkey" FOREIGN KEY ("definition_id") REFERENCES "asset_attribute_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_attribute_history" ADD CONSTRAINT "asset_attribute_history_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_attribute_history" ADD CONSTRAINT "asset_attribute_history_definition_id_fkey" FOREIGN KEY ("definition_id") REFERENCES "asset_attribute_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_attribute_history" ADD CONSTRAINT "asset_attribute_history_value_id_fkey" FOREIGN KEY ("value_id") REFERENCES "asset_attribute_values"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_relationships" ADD CONSTRAINT "asset_relationships_source_asset_id_fkey" FOREIGN KEY ("source_asset_id") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_relationships" ADD CONSTRAINT "asset_relationships_target_asset_id_fkey" FOREIGN KEY ("target_asset_id") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workpack_asset_snapshots" ADD CONSTRAINT "workpack_asset_snapshots_workpack_id_fkey" FOREIGN KEY ("workpack_id") REFERENCES "Workpack"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workpack_asset_snapshots" ADD CONSTRAINT "workpack_asset_snapshots_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftDefinition" ADD CONSTRAINT "ShiftDefinition_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftDefinition" ADD CONSTRAINT "ShiftDefinition_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourceCapacity" ADD CONSTRAINT "ResourceCapacity_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourceCapacity" ADD CONSTRAINT "ResourceCapacity_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourceCapacity" ADD CONSTRAINT "ResourceCapacity_resource_type_id_fkey" FOREIGN KEY ("resource_type_id") REFERENCES "ResourceType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourceCapacity" ADD CONSTRAINT "ResourceCapacity_contractor_id_fkey" FOREIGN KEY ("contractor_id") REFERENCES "Contractor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourceCapacity" ADD CONSTRAINT "ResourceCapacity_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "ShiftDefinition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "asset_attr_def_org_code_idx" RENAME TO "asset_attribute_definitions_organization_id_code_key";

-- RenameIndex
ALTER INDEX "asset_attr_hist_asset_def_idx" RENAME TO "asset_attribute_history_asset_id_definition_id_performed_at_idx";

-- RenameIndex
ALTER INDEX "asset_attr_hist_org_idx" RENAME TO "asset_attribute_history_organization_id_performed_at_idx";

-- RenameIndex
ALTER INDEX "asset_attr_hist_refers_idx" RENAME TO "asset_attribute_history_refers_to_history_id_idx";

-- RenameIndex
ALTER INDEX "asset_attr_val_asset_def_idx" RENAME TO "asset_attribute_values_asset_id_definition_id_key";

-- RenameIndex
ALTER INDEX "asset_attr_val_asset_status_idx" RENAME TO "asset_attribute_values_asset_id_status_idx";

-- RenameIndex
ALTER INDEX "asset_rel_unique_idx" RENAME TO "asset_relationships_source_asset_id_target_asset_id_relatio_key";

-- RenameIndex
ALTER INDEX "wp_asset_snapshot_rev_idx" RENAME TO "workpack_asset_snapshots_workpack_id_snapshot_revision_key";

