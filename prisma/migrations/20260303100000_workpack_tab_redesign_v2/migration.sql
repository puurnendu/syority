-- Workpack: add workpack_id_code, unit_code, portfolio_id
ALTER TABLE "Workpack" ADD COLUMN IF NOT EXISTS "workpack_id_code" TEXT;
ALTER TABLE "Workpack" ADD COLUMN IF NOT EXISTS "unit_code" TEXT;
ALTER TABLE "Workpack" ADD COLUMN IF NOT EXISTS "portfolio_id" UUID;
CREATE UNIQUE INDEX IF NOT EXISTS "Workpack_workpack_id_code_key" ON "Workpack"("workpack_id_code") WHERE "workpack_id_code" IS NOT NULL;

-- WorkpackDocument: add title, description, include_in_pdf, source; default document_type
ALTER TABLE "WorkpackDocument" ADD COLUMN IF NOT EXISTS "title" TEXT;
ALTER TABLE "WorkpackDocument" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "WorkpackDocument" ADD COLUMN IF NOT EXISTS "include_in_pdf" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "WorkpackDocument" ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT 'manual';

-- WorkpackIdCounter
CREATE TABLE IF NOT EXISTS "workpack_id_counters" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
  "unit_code" TEXT NOT NULL,
  "discipline_code" TEXT NOT NULL,
  "last_number" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "workpack_id_counters_org_unit_disc_key" ON "workpack_id_counters"("organization_id", "unit_code", "discipline_code");

-- ConstraintLog
CREATE TABLE IF NOT EXISTS "constraint_logs" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL REFERENCES "Organization"("id"),
  "workpack_id" UUID NOT NULL REFERENCES "Workpack"("id") ON DELETE CASCADE,
  "portfolio_id" UUID,
  "constraint_number" TEXT,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "category" TEXT NOT NULL DEFAULT 'technical',
  "severity" TEXT NOT NULL DEFAULT 'medium',
  "status" TEXT NOT NULL DEFAULT 'open',
  "raised_by" TEXT,
  "raised_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "owner" TEXT,
  "target_resolution" TIMESTAMP(3),
  "resolution_steps" TEXT,
  "resolved_by" TEXT,
  "resolved_date" TIMESTAMP(3),
  "resolution_notes" TEXT,
  "impact_on_schedule" TEXT,
  "is_in_central_register" BOOLEAN NOT NULL DEFAULT true,
  "deleted_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "constraint_logs_organization_id_idx" ON "constraint_logs"("organization_id");
CREATE INDEX IF NOT EXISTS "constraint_logs_workpack_id_idx" ON "constraint_logs"("workpack_id");
CREATE INDEX IF NOT EXISTS "constraint_logs_status_idx" ON "constraint_logs"("status");

-- ConstraintAttachment
CREATE TABLE IF NOT EXISTS "constraint_attachments" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "constraint_id" UUID NOT NULL REFERENCES "constraint_logs"("id") ON DELETE CASCADE,
  "filename" TEXT NOT NULL,
  "file_path" TEXT NOT NULL,
  "file_size" INTEGER,
  "mime_type" TEXT DEFAULT 'application/pdf',
  "uploaded_by" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- LessonLearned (applicable_to as TEXT[])
CREATE TABLE IF NOT EXISTS "lessons_learned" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL REFERENCES "Organization"("id"),
  "workpack_id" UUID NOT NULL REFERENCES "Workpack"("id") ON DELETE CASCADE,
  "portfolio_id" UUID,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "category" TEXT NOT NULL DEFAULT 'general',
  "impact" TEXT NOT NULL DEFAULT 'medium',
  "recommendation" TEXT,
  "applicable_to" TEXT[] DEFAULT '{}',
  "is_in_central_register" BOOLEAN NOT NULL DEFAULT true,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "reviewed_by" TEXT,
  "reviewed_date" TIMESTAMP(3),
  "deleted_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "lessons_learned_organization_id_idx" ON "lessons_learned"("organization_id");
CREATE INDEX IF NOT EXISTS "lessons_learned_workpack_id_idx" ON "lessons_learned"("workpack_id");

-- CertificateTemplate (equipment_types as TEXT[])
CREATE TABLE IF NOT EXISTS "certificate_templates" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" UUID,
  "cert_type" TEXT NOT NULL,
  "cert_name" TEXT NOT NULL,
  "equipment_types" TEXT[] DEFAULT '{}',
  "fields" JSONB NOT NULL DEFAULT '[]',
  "is_platform" BOOLEAN NOT NULL DEFAULT false,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CertificateInstance
CREATE TABLE IF NOT EXISTS "certificate_instances" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "workpack_id" UUID NOT NULL REFERENCES "Workpack"("id") ON DELETE CASCADE,
  "template_id" UUID NOT NULL REFERENCES "certificate_templates"("id") ON DELETE CASCADE,
  "cert_number" TEXT,
  "cert_type" TEXT NOT NULL,
  "cert_name" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'not_started',
  "field_values" JSONB NOT NULL DEFAULT '{}',
  "prepared_by" TEXT,
  "prepared_date" TIMESTAMP(3),
  "reviewed_by" TEXT,
  "reviewed_date" TIMESTAMP(3),
  "approved_by" TEXT,
  "approved_date" TIMESTAMP(3),
  "third_party_inspector" TEXT,
  "third_party_date" TIMESTAMP(3),
  "pass_fail" TEXT,
  "remarks" TEXT,
  "include_in_pdf" BOOLEAN NOT NULL DEFAULT true,
  "deleted_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "certificate_instances_workpack_id_idx" ON "certificate_instances"("workpack_id");
