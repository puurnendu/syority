SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'workpack_print_settings'
ORDER BY ordinal_position;
