ALTER TABLE "activity_libraries"
  ADD COLUMN IF NOT EXISTS work_category  TEXT,
  ADD COLUMN IF NOT EXISTS phase          TEXT,
  ADD COLUMN IF NOT EXISTS level_code     TEXT;
