-- Materials section enhancement: discipline segregation + PDF inclusion + planner overrides
-- Target: workpack_material_lines (used for AI-generated and consolidated materials)

ALTER TABLE "workpack_material_lines"
  ADD COLUMN IF NOT EXISTS "included_in_pdf"   BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS "planner_notes"      TEXT,
  ADD COLUMN IF NOT EXISTS "custom_name"        TEXT;

-- Indexes for PDF and discipline filtering
CREATE INDEX IF NOT EXISTS "workpack_material_lines_material_category_idx" ON "workpack_material_lines"("material_category");
CREATE INDEX IF NOT EXISTS "workpack_material_lines_included_pdf_idx" ON "workpack_material_lines"("included_in_pdf");
