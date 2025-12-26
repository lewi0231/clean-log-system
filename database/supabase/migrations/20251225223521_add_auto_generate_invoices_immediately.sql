-- Add auto-generate invoices immediately flag to organization_settings
-- When enabled, invoices are automatically created in pending_review state
-- when jobs are completed (for non-location organizations)

ALTER TABLE organization_settings 
  ADD COLUMN IF NOT EXISTS auto_generate_invoices_immediately BOOLEAN DEFAULT FALSE;

-- Add comment for documentation
COMMENT ON COLUMN organization_settings.auto_generate_invoices_immediately IS 'If true, automatically generates invoices in pending_review state immediately when jobs are completed. Only applies to jobs without location hierarchies or jobs with locations that do not have hierarchy auto-generate enabled.';

