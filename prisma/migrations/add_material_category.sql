ALTER TABLE "WorkpackMaterial" ADD COLUMN IF NOT EXISTS "material_category" TEXT DEFAULT 'mechanical';
ALTER TABLE "workpack_material_lines" ADD COLUMN IF NOT EXISTS "material_category" TEXT DEFAULT 'mechanical';
