-- OD9.1 / Final diff gate — create the three report provenance columns.
--
-- Same class of defect as Activity.schedule_source: declared in Prisma, absent from the
-- database, and written unconditionally by live code. M14's ReportGenerationService writes
-- all three on every generation (ReportGenerationService.ts:668-670) and the report centre
-- renders dataset_hash to the user (ReportCenter.tsx:468-470), so every report generation
-- was failing on write rather than degrading.
--
-- Discovered by the OD9.1 final diff gate, not by the OD9 forensic audit, which recorded
-- only Activity.project_id and Activity.schedule_source in this category. Recorded as
-- OD9-036.
--
-- Additive and idempotent. report_generations holds 4 rows; all three columns are nullable,
-- so existing rows keep NULL provenance — which is the truth, because those reports were
-- generated before the columns existed. No backfill is performed: a dataset hash cannot be
-- reconstructed after the fact, and inventing one would fabricate provenance.
ALTER TABLE "report_generations"
  ADD COLUMN IF NOT EXISTS "dataset_hash" TEXT,
  ADD COLUMN IF NOT EXISTS "dataset_path" TEXT,
  ADD COLUMN IF NOT EXISTS "filters_applied" JSONB DEFAULT '{}';
