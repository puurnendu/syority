-- M12-V1 — Dimension Registry metadata for ActivityUdfDefinition
-- Adds filter/sort/group/export metadata so UDF dimensions expose the same
-- DimensionDefinition contract as system dimensions (Plant, Unit, System, etc.).

ALTER TABLE "ActivityUdfDefinition"
  ADD COLUMN IF NOT EXISTS "is_filterable"    BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "is_sortable"      BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "is_groupable"     BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "is_bulk_editable" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "validation_rules" TEXT,
  ADD COLUMN IF NOT EXISTS "display_order"    INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "width"            INTEGER NOT NULL DEFAULT 150;
