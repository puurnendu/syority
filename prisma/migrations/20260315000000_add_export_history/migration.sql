-- CreateTable
CREATE TABLE IF NOT EXISTS "export_history" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "org_id" UUID NOT NULL,
    "project_id" UUID,
    "format" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "workpack_count" INTEGER NOT NULL,
    "activity_count" INTEGER NOT NULL,
    "file_size_bytes" INTEGER,
    "exported_by" UUID,
    "exported_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "export_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "export_history_org_id_idx" ON "export_history"("org_id");

-- AddForeignKey
ALTER TABLE "export_history" ADD CONSTRAINT "export_history_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
