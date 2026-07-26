SELECT
  t.table_name,
  COALESCE(s.n_live_tup::bigint, 0) AS row_count_estimate,
  pg_size_pretty(pg_total_relation_size(quote_ident(t.table_name))) AS total_size
FROM information_schema.tables t
LEFT JOIN pg_stat_user_tables s ON s.relname = t.table_name
WHERE t.table_schema = 'public'
AND t.table_type = 'BASE TABLE'
ORDER BY pg_total_relation_size(quote_ident(t.table_name)) DESC NULLS LAST;
