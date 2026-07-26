-- 1. Find all separate material catalog tables
SELECT table_name, pg_size_pretty(
  pg_total_relation_size(quote_ident(table_name))
) as size
FROM information_schema.tables
WHERE table_schema = 'public'
AND (
  table_name ILIKE '%gasket%'
  OR table_name ILIKE '%bolt%'
  OR table_name ILIKE '%consumable%'
  OR table_name ILIKE '%blind%catalog%'
  OR table_name ILIKE '%blind%template%'
  OR table_name = 'item_catalog'
  OR table_name = 'Consumable'
)
ORDER BY table_name;
