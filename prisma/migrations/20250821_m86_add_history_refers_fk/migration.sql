-- M8.6 P0/P1 Remediation: Self-referencing FK on asset_attribute_history
-- Ensures decision rows (ai_accepted/ai_modified/ai_rejected) cannot be
-- orphaned from their original AI extraction row.
-- ON DELETE RESTRICT preserves the append-only invariant.
--
-- NOTE (M8.14-R1): Table is created in 20260905_m814r1 migration.
-- This migration is made conditional so it succeeds on fresh DBs
-- where the table doesn't exist yet at this migration point.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'asset_attribute_history') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE constraint_name = 'asset_attribute_history_refers_to_fkey'
      AND table_name = 'asset_attribute_history'
    ) THEN
      ALTER TABLE "asset_attribute_history"
        ADD CONSTRAINT "asset_attribute_history_refers_to_fkey"
        FOREIGN KEY ("refers_to_history_id") REFERENCES "asset_attribute_history"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
  END IF;
END $$;
