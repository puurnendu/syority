CREATE TABLE IF NOT EXISTS "WorkpackAttachment" (
  "id"              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "workpack_id"     UUID NOT NULL REFERENCES "Workpack"("id") ON DELETE CASCADE,
  "group"           TEXT NOT NULL,
  "sub_group"       TEXT,
  "sort_order"      INTEGER DEFAULT 0,
  "title"           TEXT NOT NULL,
  "attachment_type" TEXT NOT NULL,
  "template_key"    TEXT,
  "content"         JSONB,
  "is_active"       BOOLEAN DEFAULT true,
  "created_at"      TIMESTAMPTZ DEFAULT now(),
  "updated_at"      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "WorkpackAttachment_workpack_id_idx" ON "WorkpackAttachment"("workpack_id");
