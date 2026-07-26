-- Section 8: AI extraction v2
-- Site: engineering standards
ALTER TABLE "Site" ADD COLUMN IF NOT EXISTS "pressure_test_standard" TEXT NOT NULL DEFAULT 'ASME_VIII';
ALTER TABLE "Site" ADD COLUMN IF NOT EXISTS "hydrotest_multiplier" DOUBLE PRECISION NOT NULL DEFAULT 1.5;
ALTER TABLE "Site" ADD COLUMN IF NOT EXISTS "pneumatic_test_multiplier" DOUBLE PRECISION NOT NULL DEFAULT 1.1;
ALTER TABLE "Site" ADD COLUMN IF NOT EXISTS "torque_standard" TEXT NOT NULL DEFAULT 'ASME_PCC_1';
ALTER TABLE "Site" ADD COLUMN IF NOT EXISTS "test_standard_notes" TEXT;

-- WorkpackDocument: AI extraction traceability
ALTER TABLE "WorkpackDocument" ADD COLUMN IF NOT EXISTS "source_document_id" UUID;
ALTER TABLE "WorkpackDocument" ADD COLUMN IF NOT EXISTS "source_pages" INTEGER[] DEFAULT ARRAY[]::INTEGER[];
ALTER TABLE "WorkpackDocument" ADD COLUMN IF NOT EXISTS "extraction_job_id" UUID;

-- Self-relation for extracted sub-documents (add after columns exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'WorkpackDocument_source_document_id_fkey'
  ) THEN
    ALTER TABLE "WorkpackDocument" ADD CONSTRAINT "WorkpackDocument_source_document_id_fkey"
      FOREIGN KEY ("source_document_id") REFERENCES "WorkpackDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- ExtractionConflict
CREATE TABLE IF NOT EXISTS "extraction_conflicts" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "workpack_id" UUID NOT NULL REFERENCES "Workpack"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "ai_extraction_job_id" UUID NOT NULL REFERENCES "AiExtractionJob"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "field_path" TEXT NOT NULL,
  "field_label" TEXT NOT NULL,
  "existing_value" TEXT,
  "existing_entered_by" TEXT,
  "existing_entered_at" TIMESTAMP(3),
  "extracted_value" TEXT NOT NULL,
  "source_document_id" UUID NOT NULL,
  "source_page" INTEGER,
  "source_text" TEXT NOT NULL,
  "confidence" TEXT NOT NULL,
  "calculated" BOOLEAN NOT NULL DEFAULT false,
  "calculation_basis" TEXT,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "resolution" TEXT,
  "resolution_value" TEXT,
  "resolution_note" TEXT NOT NULL DEFAULT '',
  "resolved_by" UUID,
  "resolved_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "extraction_conflicts_workpack_id_status_idx" ON "extraction_conflicts"("workpack_id", "status");
CREATE INDEX IF NOT EXISTS "extraction_conflicts_ai_extraction_job_id_idx" ON "extraction_conflicts"("ai_extraction_job_id");
