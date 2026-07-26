SELECT
  (SELECT COUNT(*) FROM "Consumable") AS consumable_rows,
  (SELECT COUNT(*) FROM item_catalog) AS item_catalog_rows;
