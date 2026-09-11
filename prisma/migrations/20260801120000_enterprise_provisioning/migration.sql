-- M7.7.1 — Enterprise Tenant Provisioning
-- Migration: Add provisioning infrastructure tables and Organization lifecycle fields

-- 1. Organization lifecycle columns
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "lifecycle_status" TEXT DEFAULT 'active';
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "lifecycle_changed_at" TIMESTAMPTZ;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "lifecycle_changed_by" UUID;

-- 2. Provisioning Templates
CREATE TABLE IF NOT EXISTS "provisioning_templates" (
    "id"          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "slug"        TEXT NOT NULL UNIQUE,
    "name"        TEXT NOT NULL,
    "industry"    TEXT,
    "description" TEXT,
    "is_builtin"  BOOLEAN NOT NULL DEFAULT false,
    "config"      JSONB NOT NULL DEFAULT '{}',
    "created_by"  UUID,
    "created_at"  TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updated_at"  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "provisioning_templates_industry_idx" ON "provisioning_templates"("industry");
CREATE INDEX IF NOT EXISTS "provisioning_templates_is_builtin_idx" ON "provisioning_templates"("is_builtin");

-- 3. Provisioning Jobs (async queue)
CREATE TABLE IF NOT EXISTS "provisioning_jobs" (
    "id"               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "organization_id"  UUID,
    "template_id"      UUID,
    "request"          JSONB NOT NULL DEFAULT '{}',
    "status"           TEXT NOT NULL DEFAULT 'queued',
    "current_step"     TEXT,
    "completed_steps"  JSONB NOT NULL DEFAULT '[]',
    "failed_step"      TEXT,
    "error"            TEXT,
    "stack_trace"      TEXT,
    "progress_pct"     INTEGER NOT NULL DEFAULT 0,
    "retries"          INTEGER NOT NULL DEFAULT 0,
    "max_retries"      INTEGER NOT NULL DEFAULT 3,
    "duration_ms"      INTEGER,
    "started_at"       TIMESTAMPTZ,
    "completed_at"     TIMESTAMPTZ,
    "cancelled_at"     TIMESTAMPTZ,
    "created_by"       UUID NOT NULL,
    "created_at"       TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "provisioning_jobs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id"),
    CONSTRAINT "provisioning_jobs_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "provisioning_templates"("id")
);
CREATE INDEX IF NOT EXISTS "provisioning_jobs_status_idx" ON "provisioning_jobs"("status");
CREATE INDEX IF NOT EXISTS "provisioning_jobs_created_by_idx" ON "provisioning_jobs"("created_by");
CREATE INDEX IF NOT EXISTS "provisioning_jobs_organization_id_idx" ON "provisioning_jobs"("organization_id");

-- 4. Provisioning Job Logs (step-level execution log)
CREATE TABLE IF NOT EXISTS "provisioning_job_logs" (
    "id"          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "job_id"      UUID NOT NULL,
    "step"        TEXT NOT NULL,
    "status"      TEXT NOT NULL DEFAULT 'running',
    "message"     TEXT,
    "metadata"    JSONB DEFAULT '{}',
    "duration_ms" INTEGER,
    "created_at"  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "provisioning_job_logs_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "provisioning_jobs"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "provisioning_job_logs_job_id_idx" ON "provisioning_job_logs"("job_id");
CREATE INDEX IF NOT EXISTS "provisioning_job_logs_step_idx" ON "provisioning_job_logs"("step");
