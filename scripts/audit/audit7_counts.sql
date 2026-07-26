SELECT
  (SELECT COUNT(*) FROM "Resource" WHERE deleted_at IS NULL) AS resource_count,
  (SELECT COUNT(*) FROM item_catalog WHERE deleted_at IS NULL
   AND (item_category = 'tool' OR item_category = 'consumable')) AS catalog_tool_consumable;
