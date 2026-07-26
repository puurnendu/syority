-- AlterTable
ALTER TABLE "Workpack" ADD COLUMN IF NOT EXISTS "equipment_technical_data" JSONB DEFAULT '{}';
