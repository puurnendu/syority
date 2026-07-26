SELECT code, name, type
FROM "ActivityUdfDefinition"
WHERE LOWER(code) IN ('equipment_tag', 'asset_tag', 'drawing_number', 'contractor', 'responsible_party')
AND deleted_at IS NULL;
