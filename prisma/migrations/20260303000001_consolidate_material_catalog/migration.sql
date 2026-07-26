-- Drop Consumable table and old FK columns

-- WorkpackMaterial: drop consumable_id FK and column
ALTER TABLE "WorkpackMaterial" DROP CONSTRAINT IF EXISTS "WorkpackMaterial_consumable_id_fkey";
ALTER TABLE "WorkpackMaterial" DROP COLUMN IF EXISTS "consumable_id";

-- ActivityResource: drop consumable_id FK and column
ALTER TABLE "ActivityResource" DROP CONSTRAINT IF EXISTS "ActivityResource_consumable_id_fkey";
ALTER TABLE "ActivityResource" DROP COLUMN IF EXISTS "consumable_id";

-- AiSuggestedItem: drop resolved_consumable_id FK and column
ALTER TABLE "AiSuggestedItem" DROP CONSTRAINT IF EXISTS "AiSuggestedItem_resolved_consumable_id_fkey";
ALTER TABLE "AiSuggestedItem" DROP COLUMN IF EXISTS "resolved_consumable_id";

-- Drop Consumable table
DROP TABLE IF EXISTS "Consumable";
