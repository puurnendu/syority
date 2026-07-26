CREATE TABLE IF NOT EXISTS "DocLibrary" (
  "id"              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "org_id"          TEXT NOT NULL,
  "event_id"        TEXT,
  "project_id"      TEXT,
  "title"           TEXT NOT NULL,
  "description"     TEXT,
  "category"        TEXT NOT NULL DEFAULT 'General',
  "revision"        TEXT,
  "document_number" TEXT,
  "equipment_tags"  TEXT[],
  "tags"            TEXT[],
  "filename"        TEXT NOT NULL,
  "original_name"   TEXT NOT NULL,
  "storage_path"    TEXT NOT NULL,
  "public_url"      TEXT NOT NULL,
  "file_size"       INTEGER,
  "mime_type"       TEXT,
  "page_count"      INTEGER,
  "ai_summary"      TEXT,
  "ai_text"         TEXT,
  "ai_indexed"      BOOLEAN DEFAULT false,
  "uploaded_by"     TEXT,
  "uploaded_by_name" TEXT,
  "downloads"       INTEGER DEFAULT 0,
  "is_org_library"  BOOLEAN DEFAULT false,
  "created_at"      TIMESTAMPTZ DEFAULT now(),
  "updated_at"      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "DocLibrary_org_idx"     ON "DocLibrary"("org_id");
CREATE INDEX IF NOT EXISTS "DocLibrary_event_idx"   ON "DocLibrary"("event_id");
CREATE INDEX IF NOT EXISTS "DocLibrary_category_idx" ON "DocLibrary"("category");
