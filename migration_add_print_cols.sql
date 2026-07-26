ALTER TABLE workpack_print_settings ADD COLUMN IF NOT EXISTS cover_page_settings JSONB;
ALTER TABLE workpack_print_settings ADD COLUMN IF NOT EXISTS last_page_settings JSONB;
