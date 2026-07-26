-- Runtime fix: WebhookConfig / WebhookLog / ApiKey used by settings APIs but missing from schema.

CREATE TABLE IF NOT EXISTS "webhook_configs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "url" TEXT NOT NULL DEFAULT '',
    "secret" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "events" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "webhook_configs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "webhook_configs_organization_id_key" ON "webhook_configs"("organization_id");

DO $$ BEGIN
  ALTER TABLE "webhook_configs" ADD CONSTRAINT "webhook_configs_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "webhook_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "webhook_id" UUID,
    "event" TEXT NOT NULL,
    "status_code" INTEGER,
    "response" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "webhook_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "webhook_logs_organization_id_created_at_idx"
  ON "webhook_logs"("organization_id", "created_at");

DO $$ BEGIN
  ALTER TABLE "webhook_logs" ADD CONSTRAINT "webhook_logs_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "webhook_logs" ADD CONSTRAINT "webhook_logs_webhook_id_fkey"
    FOREIGN KEY ("webhook_id") REFERENCES "webhook_configs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "api_keys" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "key_hash" TEXT NOT NULL,
    "last_used_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "api_keys_organization_id_idx" ON "api_keys"("organization_id");
CREATE INDEX IF NOT EXISTS "api_keys_key_hash_idx" ON "api_keys"("key_hash");

DO $$ BEGIN
  ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_created_by_fkey"
    FOREIGN KEY ("created_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
