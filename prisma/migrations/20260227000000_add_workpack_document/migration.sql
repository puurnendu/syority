-- CreateTable
CREATE TABLE "WorkpackDocument" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "site_id" UUID NOT NULL,
    "workpack_id" UUID NOT NULL,
    "document_type" TEXT,
    "original_filename" TEXT NOT NULL,
    "storage_path" TEXT NOT NULL,
    "mime_type" TEXT,
    "file_size_bytes" BIGINT DEFAULT 0,
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "WorkpackDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkpackDocument_workpack_id_idx" ON "WorkpackDocument"("workpack_id");

-- CreateIndex
CREATE INDEX "WorkpackDocument_organization_id_idx" ON "WorkpackDocument"("organization_id");

-- AddForeignKey
ALTER TABLE "WorkpackDocument" ADD CONSTRAINT "WorkpackDocument_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkpackDocument" ADD CONSTRAINT "WorkpackDocument_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkpackDocument" ADD CONSTRAINT "WorkpackDocument_workpack_id_fkey" FOREIGN KEY ("workpack_id") REFERENCES "Workpack"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkpackDocument" ADD CONSTRAINT "WorkpackDocument_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
