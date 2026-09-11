-- M16-R6: interaction audit table + WhatsApp event columns missing from deployable migrations.
-- conversation_id is TEXT: live ids are wa-${phone} / voice-${userId}-${eventId}, not UUIDs.

CREATE TABLE IF NOT EXISTS "m16_interaction_logs" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "event_id" UUID,
  "channel" TEXT NOT NULL,
  "conversation_id" TEXT,
  "message_id" TEXT,
  "intent" TEXT,
  "intent_category" TEXT,
  "raw_message" TEXT,
  "resolved_entity" JSONB,
  "action_risk_level" TEXT,
  "authorization" TEXT NOT NULL DEFAULT 'pending',
  "denied_reason" TEXT,
  "confirmation" TEXT,
  "result" TEXT NOT NULL DEFAULT 'pending',
  "result_detail" TEXT,
  "identity_source" TEXT,
  "source_channel" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "m16_interaction_logs_organization_id_created_at_idx"
  ON "m16_interaction_logs"("organization_id", "created_at");
CREATE INDEX IF NOT EXISTS "m16_interaction_logs_user_id_created_at_idx"
  ON "m16_interaction_logs"("user_id", "created_at");
CREATE INDEX IF NOT EXISTS "m16_interaction_logs_event_id_idx"
  ON "m16_interaction_logs"("event_id");
CREATE INDEX IF NOT EXISTS "m16_interaction_logs_channel_created_at_idx"
  ON "m16_interaction_logs"("channel", "created_at");

ALTER TABLE "whatsapp_sessions" ADD COLUMN IF NOT EXISTS "event_id" UUID;
ALTER TABLE "whatsapp_updates" ADD COLUMN IF NOT EXISTS "event_id" UUID;
