-- Platform branding settings stored in Organization table
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='Organization' AND column_name='logo_url'
  ) THEN
    ALTER TABLE "Organization"
      ADD COLUMN "logo_url"          TEXT,
      ADD COLUMN "logo_width_px"     INTEGER DEFAULT 140,
      ADD COLUMN "logo_height_px"    INTEGER DEFAULT 40,
      ADD COLUMN "sidebar_logo_url"  TEXT,
      ADD COLUMN "sidebar_logo_width_px"  INTEGER DEFAULT 120,
      ADD COLUMN "sidebar_logo_height_px" INTEGER DEFAULT 36,
      ADD COLUMN "favicon_url"       TEXT,
      ADD COLUMN "primary_color"     TEXT DEFAULT '#4F46E5',
      ADD COLUMN "platform_name"     TEXT DEFAULT 'SYORITY';
  END IF;
END $$;
