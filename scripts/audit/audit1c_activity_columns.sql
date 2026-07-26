SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
AND LOWER(table_name) = 'activity'
AND column_name ILIKE '%discip%'
ORDER BY column_name;
