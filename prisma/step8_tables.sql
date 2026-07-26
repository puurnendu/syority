SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND (
  table_name ILIKE '%consumable%'
  OR table_name ILIKE '%gasket%catalog%'
  OR table_name ILIKE '%bolt%catalog%'
  OR table_name = 'item_catalog'
)
ORDER BY table_name;
