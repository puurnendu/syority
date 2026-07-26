SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND ( table_name ILIKE '%clearance%' OR table_name ILIKE '%party%' )
ORDER BY table_name;
