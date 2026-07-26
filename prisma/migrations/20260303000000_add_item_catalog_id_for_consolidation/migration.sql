-- Add item_catalog_id to WorkpackMaterial
ALTER TABLE "WorkpackMaterial" ADD COLUMN IF NOT EXISTS "item_catalog_id" UUID;

ALTER TABLE "WorkpackMaterial" ADD CONSTRAINT "WorkpackMaterial_item_catalog_id_fkey"
  FOREIGN KEY ("item_catalog_id") REFERENCES "item_catalog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add item_catalog_id to ActivityResource
ALTER TABLE "ActivityResource" ADD COLUMN IF NOT EXISTS "item_catalog_id" UUID;

ALTER TABLE "ActivityResource" ADD CONSTRAINT "ActivityResource_item_catalog_id_fkey"
  FOREIGN KEY ("item_catalog_id") REFERENCES "item_catalog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add resolved_item_catalog_id to AiSuggestedItem
ALTER TABLE "AiSuggestedItem" ADD COLUMN IF NOT EXISTS "resolved_item_catalog_id" UUID;

ALTER TABLE "AiSuggestedItem" ADD CONSTRAINT "AiSuggestedItem_resolved_item_catalog_id_fkey"
  FOREIGN KEY ("resolved_item_catalog_id") REFERENCES "item_catalog"("id") ON DELETE SET NULL ON UPDATE CASCADE;
