-- AlterTable
ALTER TABLE "DocumentInstance" ADD COLUMN IF NOT EXISTS "content_json" JSONB;
