-- Knowledge Engine: Platform-only sanitized knowledge repository

CREATE TYPE "KnowledgeAssetCategory" AS ENUM (
  'ACTIVITY_CODE',
  'UDF_DEFINITION',
  'WORKPACK_TEMPLATE',
  'EQUIPMENT_TYPE',
  'RESOURCE_TYPE',
  'CERTIFICATE_TEMPLATE',
  'PRINT_SETTINGS',
  'QA_QC_TEMPLATE',
  'SAFETY_TEMPLATE'
);

CREATE TYPE "KnowledgeAssetStatus" AS ENUM (
  'INCOMING',
  'AI_ANALYSIS',
  'REVIEW_QUEUE',
  'APPROVED',
  'REJECTED'
);

CREATE TYPE "KnowledgeReviewDecision" AS ENUM (
  'APPROVE',
  'MERGE',
  'REJECT',
  'REQUEST_REVISION'
);

CREATE TABLE "knowledge_assets" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "status" "KnowledgeAssetStatus" NOT NULL DEFAULT 'INCOMING',
  "category" "KnowledgeAssetCategory" NOT NULL,
  "asset_type" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "content_hash" TEXT NOT NULL,
  "sanitized_payload" JSONB NOT NULL,
  "source_industry" TEXT,
  "source_org_hash" TEXT,
  "similarity_score" DOUBLE PRECISION,
  "ai_suggestion" TEXT,
  "ai_recommendation" TEXT,
  "matched_asset_id" UUID,
  "first_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "times_seen" INTEGER NOT NULL DEFAULT 1,
  "times_used" INTEGER NOT NULL DEFAULT 0,
  "reviewer_notes" TEXT,
  "reviewed_by" UUID,
  "reviewed_at" TIMESTAMP(3),
  "promoted_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "knowledge_assets_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "knowledge_review_logs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "asset_id" UUID NOT NULL,
  "decision" "KnowledgeReviewDecision" NOT NULL,
  "notes" TEXT,
  "reviewed_by" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "knowledge_review_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "knowledge_assets_status_category_idx" ON "knowledge_assets"("status", "category");
CREATE INDEX "knowledge_assets_content_hash_idx" ON "knowledge_assets"("content_hash");
CREATE INDEX "knowledge_assets_category_title_idx" ON "knowledge_assets"("category", "title");
CREATE INDEX "knowledge_review_logs_asset_id_created_at_idx" ON "knowledge_review_logs"("asset_id", "created_at");

ALTER TABLE "knowledge_assets"
  ADD CONSTRAINT "knowledge_assets_matched_asset_id_fkey"
  FOREIGN KEY ("matched_asset_id") REFERENCES "knowledge_assets"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "knowledge_review_logs"
  ADD CONSTRAINT "knowledge_review_logs_asset_id_fkey"
  FOREIGN KEY ("asset_id") REFERENCES "knowledge_assets"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
