-- Section 9: WhatsApp integration
-- AiProviderSetting: per-job provider overrides
ALTER TABLE "AiProviderSetting" ADD COLUMN IF NOT EXISTS "vision_provider" TEXT;
ALTER TABLE "AiProviderSetting" ADD COLUMN IF NOT EXISTS "vision_model" TEXT;
ALTER TABLE "AiProviderSetting" ADD COLUMN IF NOT EXISTS "vision_api_key_encrypted" TEXT;
ALTER TABLE "AiProviderSetting" ADD COLUMN IF NOT EXISTS "whatsapp_provider" TEXT DEFAULT 'openai';
ALTER TABLE "AiProviderSetting" ADD COLUMN IF NOT EXISTS "whatsapp_model" TEXT DEFAULT 'gpt-4o-mini';
ALTER TABLE "AiProviderSetting" ADD COLUMN IF NOT EXISTS "whatsapp_api_key_encrypted" TEXT;
ALTER TABLE "AiProviderSetting" ADD COLUMN IF NOT EXISTS "whisper_api_key_encrypted" TEXT;
ALTER TABLE "AiProviderSetting" ADD COLUMN IF NOT EXISTS "lessons_provider" TEXT;
ALTER TABLE "AiProviderSetting" ADD COLUMN IF NOT EXISTS "lessons_model" TEXT;

-- User: WhatsApp fields
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "whatsapp_number" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "whatsapp_verified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "whatsapp_opt_in" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "preferred_language" TEXT DEFAULT 'en';
CREATE UNIQUE INDEX IF NOT EXISTS "User_whatsapp_number_key" ON "User"("whatsapp_number") WHERE "whatsapp_number" IS NOT NULL;

-- Workpack: overall_progress
ALTER TABLE "Workpack" ADD COLUMN IF NOT EXISTS "overall_progress" INTEGER DEFAULT 0;

-- Activity: responsible
ALTER TABLE "Activity" ADD COLUMN IF NOT EXISTS "responsible" TEXT;

-- WhatsappSession
CREATE TABLE IF NOT EXISTS "whatsapp_sessions" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" UUID,
  "phone_number" TEXT NOT NULL UNIQUE,
  "user_id" UUID UNIQUE REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "state" TEXT NOT NULL DEFAULT 'idle',
  "pending_data" JSONB,
  "detected_language" TEXT DEFAULT 'en',
  "expires_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- WhatsappUpdate
CREATE TABLE IF NOT EXISTS "whatsapp_updates" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" UUID REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "user_id" UUID REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "phone_number" TEXT NOT NULL,
  "meta_message_id" TEXT UNIQUE,
  "message_type" TEXT NOT NULL,
  "raw_message_text" TEXT,
  "detected_language" TEXT,
  "audio_storage_path" TEXT,
  "audio_file_size_bytes" BIGINT,
  "audio_duration_secs" INTEGER,
  "audio_downloaded_at" TIMESTAMP(3),
  "transcript_path" TEXT,
  "extracted_unit" TEXT,
  "extracted_tag" TEXT,
  "extracted_description" TEXT,
  "extracted_progress" INTEGER,
  "confidence_breakdown" JSONB,
  "ai_confidence" DOUBLE PRECISION,
  "db_confidence" DOUBLE PRECISION,
  "final_confidence" DOUBLE PRECISION,
  "matched_workpack_id" UUID REFERENCES "Workpack"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "matched_activity_id" UUID REFERENCES "Activity"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "match_candidates" JSONB,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "review_notes" TEXT,
  "reviewed_by" UUID REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "reviewed_at" TIMESTAMP(3),
  "reply_sent" TEXT,
  "reply_sent_at" TIMESTAMP(3),
  "reply_language" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "whatsapp_updates_organization_id_status_idx" ON "whatsapp_updates"("organization_id", "status");
CREATE INDEX IF NOT EXISTS "whatsapp_updates_phone_number_created_at_idx" ON "whatsapp_updates"("phone_number", "created_at");
CREATE INDEX IF NOT EXISTS "whatsapp_updates_matched_workpack_id_idx" ON "whatsapp_updates"("matched_workpack_id");

-- ShiftReport
CREATE TABLE IF NOT EXISTS "shift_reports" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "site_id" UUID NOT NULL REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "unit_id" UUID REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "shift_type" TEXT NOT NULL,
  "shift_start" TIMESTAMP(3) NOT NULL,
  "shift_end" TIMESTAMP(3) NOT NULL,
  "report_text" TEXT NOT NULL,
  "report_summary" TEXT,
  "activities_completed" INTEGER NOT NULL DEFAULT 0,
  "activities_overdue" INTEGER NOT NULL DEFAULT 0,
  "activities_in_progress" INTEGER NOT NULL DEFAULT 0,
  "whatsapp_updates_count" INTEGER NOT NULL DEFAULT 0,
  "open_constraints_count" INTEGER NOT NULL DEFAULT 0,
  "critical_constraints" INTEGER NOT NULL DEFAULT 0,
  "sent_to_numbers" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "sent_at" TIMESTAMP(3),
  "meta_message_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "delivery_status" TEXT NOT NULL DEFAULT 'pending',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "shift_reports_organization_id_shift_start_idx" ON "shift_reports"("organization_id", "shift_start");
CREATE INDEX IF NOT EXISTS "shift_reports_unit_id_idx" ON "shift_reports"("unit_id");

-- UnitShiftReportRecipient
CREATE TABLE IF NOT EXISTS "unit_shift_report_recipients" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "unit_id" UUID NOT NULL REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "user_id" UUID NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "receives_shift_reports" BOOLEAN NOT NULL DEFAULT false,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE("unit_id", "user_id")
);
