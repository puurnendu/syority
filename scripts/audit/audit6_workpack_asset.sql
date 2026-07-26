SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
AND LOWER(table_name) = 'workpack'
AND ( column_name ILIKE '%asset%' OR column_name ILIKE '%equipment%' OR column_name ILIKE '%tag%' )
ORDER BY column_name;
