ALTER TABLE "Activity" ADD COLUMN IF NOT EXISTS "window" TEXT;
-- Valid values: 'PreSD' | 'OP' | 'IR' | 'CP' | 'TO' | 'SP' | 'PostSD' | NULL

-- Org-level PDF column configuration
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "workpack_pdf_columns" JSONB DEFAULT '{
  "showWindow": true,
  "showDuration": true,
  "showManpower": false,
  "showContractor": true,
  "showPredecessor": false,
  "showScaffolding": true,
  "showElectrical": true
}'::jsonb;
